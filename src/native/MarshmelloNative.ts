import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface SystemStatus {
  isArmed: boolean;
  isConnected: boolean;
  rssi: number;
  battery: number;
  isAlarmActive: boolean;
  targetMacAddress: string | null;
}

export interface SettingsConfig {
  rssiThreshold: number;       // e.g. -75, -85, -92
  gracePeriodMs: number;       // 0 to 10000 ms
  jerkThreshold: number;       // e.g. 28.0 m/s^3
  gyroThreshold: number;       // e.g. 4.2 rad/s
  autoDisarmOnReturn: boolean;
}

export interface DiscoveredTag {
  name: string;
  address: string;
  rssi: number;
}

export interface StatusChangedEvent {
  isArmed: boolean;
  isConnected: boolean;
  rssi: number;
  battery: number;
}

export interface AlarmTriggeredEvent {
  reason: string;
  stateCode: number;
}

export interface AlarmDisarmedEvent {
  reason: string;
}

const { MarshmelloNative } = NativeModules;

if (Platform.OS === 'android' && !MarshmelloNative) {
  console.warn('MarshmelloNative module is not linked.');
}

const eventEmitter = MarshmelloNative ? new NativeEventEmitter(MarshmelloNative) : null;

export const MarshmelloBridge = {
  startService: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.startService();
  },

  stopService: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.stopService();
  },

  arm: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.arm();
  },

  disarmWithBiometrics: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.disarmWithBiometrics();
  },

  disarmWithPin: async (pin: string, correctPin: string): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.disarmWithPin(pin, correctPin);
  },

  startBleScan: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.startBleScan();
  },

  stopBleScan: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.stopBleScan();
  },

  connectTag: async (macAddress: string): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.connectTag(macAddress);
  },

  disconnectTag: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.disconnectTag();
  },

  triggerTestAlarm: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.triggerTestAlarm();
  },

  stopAlarm: async (): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.stopAlarm();
  },

  updateSettings: async (settings: SettingsConfig): Promise<boolean> => {
    if (!MarshmelloNative) return false;
    return await MarshmelloNative.updateSettings(settings);
  },

  getStatus: async (): Promise<SystemStatus> => {
    if (!MarshmelloNative) {
      return {
        isArmed: false,
        isConnected: false,
        rssi: -100,
        battery: 100,
        isAlarmActive: false,
        targetMacAddress: null,
      };
    }
    return await MarshmelloNative.getStatus();
  },

  // Event Listeners
  onTagDiscovered: (callback: (tag: DiscoveredTag) => void) => {
    return eventEmitter?.addListener('onTagDiscovered', callback);
  },

  onStatusChanged: (callback: (status: StatusChangedEvent) => void) => {
    return eventEmitter?.addListener('onStatusChanged', callback);
  },

  onAlarmTriggered: (callback: (event: AlarmTriggeredEvent) => void) => {
    return eventEmitter?.addListener('onAlarmTriggered', callback);
  },

  onAlarmDisarmed: (callback: (event: AlarmDisarmedEvent) => void) => {
    return eventEmitter?.addListener('onAlarmDisarmed', callback);
  },

  onError: (callback: (error: { message: string }) => void) => {
    return eventEmitter?.addListener('onError', callback);
  },
};

