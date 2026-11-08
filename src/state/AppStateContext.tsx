import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MarshmelloBridge,
  DiscoveredTag,
  StatusChangedEvent,
  AlarmTriggeredEvent,
  AlarmDisarmedEvent,
  SettingsConfig,
} from '../native/MarshmelloNative';

export type SensitivityLevel = 'NEAR' | 'MEDIUM' | 'FAR';

export interface AppSettings {
  sensitivity: SensitivityLevel;
  gracePeriodSec: number;
  autoDisarmOnReturn: boolean;
  pinCode: string;
  alarmSound: string;
}

interface AppStateContextType {
  isArmed: boolean;
  isConnected: boolean;
  rssi: number;
  battery: number;
  isAlarmActive: boolean;
  alarmReason: string;
  savedTagMac: string | null;
  savedTagName: string | null;
  isScanning: boolean;
  discoveredTags: DiscoveredTag[];
  settings: AppSettings;
  armSystem: () => Promise<boolean>;
  disarmWithBiometrics: () => Promise<boolean>;
  disarmWithPin: (enteredPin: string) => Promise<boolean>;
  triggerTestAlarm: () => Promise<boolean>;
  startTagScan: () => Promise<void>;
  stopTagScan: () => Promise<void>;
  pairTag: (tag: DiscoveredTag) => Promise<void>;
  forgetTag: () => Promise<void>;
  updateAppSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 'MEDIUM',
  gracePeriodSec: 3,
  autoDisarmOnReturn: true,
  pinCode: '1234',
  alarmSound: 'Police Warble',
};

const SENSITIVITY_THRESHOLDS: Record<SensitivityLevel, number> = {
  NEAR: -75.0,   // ~5 meters
  MEDIUM: -85.0, // ~10 meters
  FAR: -92.0,    // ~20 meters
};

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

const STORAGE_KEY_TAG_MAC = '@marshmello_tag_mac';
const STORAGE_KEY_TAG_NAME = '@marshmello_tag_name';
const STORAGE_KEY_SETTINGS = '@marshmello_settings';

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isArmed, setIsArmed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [rssi, setRssi] = useState(-100);
  const [battery, setBattery] = useState(100);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmReason, setAlarmReason] = useState('');
  const [savedTagMac, setSavedTagMac] = useState<string | null>(null);
  const [savedTagName, setSavedTagName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredTags, setDiscoveredTags] = useState<DiscoveredTag[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const applySettingsToNative = useCallback(async (cfg: AppSettings) => {
    const nativeConfig: SettingsConfig = {
      rssiThreshold: SENSITIVITY_THRESHOLDS[cfg.sensitivity],
      gracePeriodMs: cfg.gracePeriodSec * 1000,
      jerkThreshold: 28.0,
      gyroThreshold: 4.2,
      autoDisarmOnReturn: cfg.autoDisarmOnReturn,
    };
    await MarshmelloBridge.updateSettings(nativeConfig);
  }, []);

  // Load persistent configurations on launch
  useEffect(() => {
    const loadState = async () => {
      try {
        const storedMac = await AsyncStorage.getItem(STORAGE_KEY_TAG_MAC);
        const storedName = await AsyncStorage.getItem(STORAGE_KEY_TAG_NAME);
        const storedSettingsJson = await AsyncStorage.getItem(STORAGE_KEY_SETTINGS);

        if (storedMac) setSavedTagMac(storedMac);
        if (storedName) setSavedTagName(storedName);

        let activeSettings = DEFAULT_SETTINGS;
        if (storedSettingsJson) {
          activeSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettingsJson) };
          setSettings(activeSettings);
        }

        // Start Foreground Security Service
        await MarshmelloBridge.startService();
        await applySettingsToNative(activeSettings);

        // Auto-connect to remembered tag
        if (storedMac) {
          await MarshmelloBridge.connectTag(storedMac);
        }
      } catch (err) {
        console.error('Failed to restore Marshmello state:', err);
      }
    };

    loadState();
  }, [applySettingsToNative]);

  // Subscribe to native events
  useEffect(() => {
    const subTag = MarshmelloBridge.onTagDiscovered((tag: DiscoveredTag) => {
      setDiscoveredTags((prev) => {
        const exists = prev.some((d) => d.address === tag.address);
        if (exists) {
          return prev.map((d) => (d.address === tag.address ? tag : d));
        }
        return [...prev, tag];
      });
    });

    const subStatus = MarshmelloBridge.onStatusChanged((event: StatusChangedEvent) => {
      setIsArmed(event.isArmed);
      setIsConnected(event.isConnected);
      setRssi(event.rssi);
      setBattery(event.battery);
    });

    const subAlarm = MarshmelloBridge.onAlarmTriggered((event: AlarmTriggeredEvent) => {
      setIsAlarmActive(true);
      setAlarmReason(event.reason);
    });

    const subDisarm = MarshmelloBridge.onAlarmDisarmed(() => {
      setIsAlarmActive(false);
      setAlarmReason('');
      setIsArmed(false);
    });

    return () => {
      subTag?.remove();
      subStatus?.remove();
      subAlarm?.remove();
      subDisarm?.remove();
    };
  }, []);

  const armSystem = async (): Promise<boolean> => {
    try {
      const res = await MarshmelloBridge.arm();
      setIsArmed(true);
      return res;
    } catch (e) {
      console.error('Failed to arm:', e);
      return false;
    }
  };

  const disarmWithBiometrics = async (): Promise<boolean> => {
    try {
      const res = await MarshmelloBridge.disarmWithBiometrics();
      if (res) {
        setIsArmed(false);
        setIsAlarmActive(false);
      }
      return res;
    } catch (e) {
      console.warn('Biometric disarm cancelled or failed:', e);
      return false;
    }
  };

  const disarmWithPin = async (enteredPin: string): Promise<boolean> => {
    try {
      const res = await MarshmelloBridge.disarmWithPin(enteredPin, settings.pinCode);
      if (res) {
        setIsArmed(false);
        setIsAlarmActive(false);
      }
      return res;
    } catch (e) {
      console.warn('Invalid PIN:', e);
      return false;
    }
  };

  const triggerTestAlarm = async (): Promise<boolean> => {
    try {
      return await MarshmelloBridge.triggerTestAlarm();
    } catch (e) {
      console.error('Failed to trigger test alarm:', e);
      return false;
    }
  };

  const startTagScan = async () => {
    setDiscoveredTags([]);
    setIsScanning(true);
    await MarshmelloBridge.startBleScan();
  };

  const stopTagScan = async () => {
    setIsScanning(false);
    await MarshmelloBridge.stopBleScan();
  };

  const pairTag = async (tag: DiscoveredTag) => {
    await stopTagScan();
    setSavedTagMac(tag.address);
    setSavedTagName(tag.name || 'Marshmello-Tag');
    await AsyncStorage.setItem(STORAGE_KEY_TAG_MAC, tag.address);
    await AsyncStorage.setItem(STORAGE_KEY_TAG_NAME, tag.name || 'Marshmello-Tag');
    await MarshmelloBridge.connectTag(tag.address);
  };

  const forgetTag = async () => {
    await MarshmelloBridge.disconnectTag();
    setSavedTagMac(null);
    setSavedTagName(null);
    setIsConnected(false);
    await AsyncStorage.removeItem(STORAGE_KEY_TAG_MAC);
    await AsyncStorage.removeItem(STORAGE_KEY_TAG_NAME);
  };

  const updateAppSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    await applySettingsToNative(updated);
  };

  return (
    <AppStateContext.Provider
      value={{
        isArmed,
        isConnected,
        rssi,
        battery,
        isAlarmActive,
        alarmReason,
        savedTagMac,
        savedTagName,
        isScanning,
        discoveredTags,
        settings,
        armSystem,
        disarmWithBiometrics,
        disarmWithPin,
        triggerTestAlarm,
        startTagScan,
        stopTagScan,
        pairTag,
        forgetTag,
        updateAppSettings,
      }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

