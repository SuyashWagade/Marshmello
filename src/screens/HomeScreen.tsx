import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAppState } from '../state/AppStateContext';
import { colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    isArmed,
    isConnected,
    rssi,
    battery,
    savedTagMac,
    savedTagName,
    armSystem,
    disarmWithBiometrics,
    triggerTestAlarm,
  } = useAppState();

  const handleArmToggle = async () => {
    if (isArmed) {
      await disarmWithBiometrics();
    } else {
      await armSystem();
    }
  };

  const getRssiQuality = (dbm: number) => {
    if (!isConnected || dbm <= -100) return { label: 'Out of Range', color: colors.accent, bars: 0 };
    if (dbm >= -72) return { label: 'Immediate (~2m)', color: colors.success, bars: 4 };
    if (dbm >= -82) return { label: 'Near (~5m)', color: colors.primary, bars: 3 };
    if (dbm >= -90) return { label: 'Medium (~12m)', color: colors.warning, bars: 2 };
    return { label: 'Weak (~20m)', color: colors.accent, bars: 1 };
  };

  const signal = getRssiQuality(rssi);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MARSHMELLO</Text>
          <Text style={styles.headerSubtitle}>Anti-Snatch Protection</Text>
        </View>

        <TouchableOpacity
          style={styles.settingsHeaderBtn}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsHeaderIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Main Status Container */}
      <View style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, isArmed ? styles.cardArmed : styles.cardDisarmed]}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isArmed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)' },
              ]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isArmed ? colors.success : colors.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  { color: isArmed ? colors.success : colors.textSecondary },
                ]}>
                {isArmed ? 'ARMED & MONITORING' : 'DISARMED'}
              </Text>
            </View>

            <View style={styles.batteryBadge}>
              <Text style={styles.batteryText}>🔋 {isConnected ? `${battery}%` : '--'}</Text>
            </View>
          </View>

          {/* Central Shield Graphic */}
          <View style={styles.shieldWrapper}>
            <View
              style={[
                styles.shieldCircleOuter,
                isArmed ? styles.shieldCircleArmed : styles.shieldCircleDisarmed,
              ]}>
              <Text style={styles.shieldEmoji}>{isArmed ? '🛡️' : '🔓'}</Text>
            </View>
          </View>

          <Text style={styles.cardMainState}>
            {isArmed ? 'Snatch & Link Guard Active' : 'System Standing By'}
          </Text>

          <Text style={styles.cardSubState}>
            {isArmed
              ? 'Detects sudden jerks, rapid running motion, and tag range breach.'
              : 'Tap below to arm before heading outside.'}
          </Text>
        </View>

        {/* Tag Connectivity & Proximity Gauge */}
        <View style={styles.tagInfoCard}>
          <View style={styles.tagHeaderRow}>
            <View>
              <Text style={styles.tagLabel}>Paired Hardware Tag</Text>
              <Text style={styles.tagNameText}>
                {savedTagName ? savedTagName : 'No Tag Paired'}
              </Text>
              <Text style={styles.tagMacText}>
                {savedTagMac ? savedTagMac : 'Tap "Pair Tag" to connect ESP32'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pairShortcutBtn}
              onPress={() => navigation.navigate('PairTag')}>
              <Text style={styles.pairShortcutText}>
                {savedTagMac ? 'Manage' : 'Pair'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Live RSSI Signal Bar */}
          <View style={styles.signalSection}>
            <View style={styles.signalLabelRow}>
              <Text style={styles.signalTitle}>Tag Proximity Signal</Text>
              <Text style={[styles.signalValueText, { color: signal.color }]}>
                {isConnected ? `${signal.label} (${Math.round(rssi)} dBm)` : 'Disconnected'}
              </Text>
            </View>

            <View style={styles.signalBarsRow}>
              {[1, 2, 3, 4].map((barIndex) => (
                <View
                  key={barIndex}
                  style={[
                    styles.signalBarSegment,
                    {
                      backgroundColor:
                        barIndex <= signal.bars ? signal.color : colors.surfaceLight,
                      height: 6 + barIndex * 4,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Primary Arm / Disarm Action Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.armActionButton,
            isArmed ? styles.armBtnDisarm : styles.armBtnArm,
          ]}
          onPress={handleArmToggle}>
          <Text style={styles.armActionText}>
            {isArmed ? 'DISARM WITH BIOMETRIC' : 'ARM SYSTEM NOW'}
          </Text>
          <Text style={styles.armActionSub}>
            {isArmed ? 'Fingerprint or PIN required to disarm' : 'Activate motion & BLE shield'}
          </Text>
        </TouchableOpacity>

        {/* Secondary Test Alarm Button */}
        <TouchableOpacity
          style={styles.testAlarmBtn}
          onPress={triggerTestAlarm}>
          <Text style={styles.testAlarmText}>🚨 Test Alarm Siren & Strobe</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  settingsHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsHeaderIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  statusCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardArmed: {
    backgroundColor: '#062826',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  cardDisarmed: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  batteryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  batteryText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  shieldWrapper: {
    marginVertical: 20,
  },
  shieldCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldCircleArmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: colors.success,
  },
  shieldCircleDisarmed: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderWidth: 2,
    borderColor: colors.border,
  },
  shieldEmoji: {
    fontSize: 44,
  },
  cardMainState: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  cardSubState: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  tagInfoCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tagLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tagNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  tagMacText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  pairShortcutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pairShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  signalSection: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  signalLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  signalTitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  signalValueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  signalBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 22,
  },
  signalBarSegment: {
    flex: 1,
    borderRadius: 4,
  },
  armActionButton: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 4,
  },
  armBtnArm: {
    backgroundColor: colors.primaryDark,
  },
  armBtnDisarm: {
    backgroundColor: colors.accentDark,
  },
  armActionText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 1,
  },
  armActionSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 3,
  },
  testAlarmBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  testAlarmText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});

