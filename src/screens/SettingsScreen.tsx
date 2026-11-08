import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppState, SensitivityLevel } from '../state/AppStateContext';
import { colors } from '../theme/colors';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { settings, updateAppSettings, triggerTestAlarm } = useAppState();

  const [pinInput, setPinInput] = useState(settings.pinCode);

  const sensitivityOptions: { label: string; value: SensitivityLevel; desc: string }[] = [
    { label: 'Near', value: 'NEAR', desc: '~5 meters (-75 dBm) - tight crowd/cafe' },
    { label: 'Medium', value: 'MEDIUM', desc: '~10 meters (-85 dBm) - standard walking' },
    { label: 'Far', value: 'FAR', desc: '~20 meters (-92 dBm) - open park / bicycle' },
  ];

  const soundOptions = ['Police Warble', 'Piercing Dual-Tone', 'High-Frequency Chirp'];

  const handleSavePin = () => {
    if (pinInput.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits.');
      return;
    }
    updateAppSettings({ pinCode: pinInput });
    Alert.alert('PIN Updated', 'Backup disarm PIN saved successfully.');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Range Sensitivity Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Range Sensitivity (BLE Distance)</Text>
          <Text style={styles.sectionSubtitle}>
            Calibrated signal threshold before range breach warning starts:
          </Text>

          <View style={styles.sensitivityButtonGroup}>
            {sensitivityOptions.map((opt) => {
              const selected = settings.sensitivity === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.sensitivityOption,
                    selected && styles.sensitivityOptionSelected,
                  ]}
                  onPress={() => updateAppSettings({ sensitivity: opt.value })}>
                  <View style={styles.optionHeaderRow}>
                    <Text
                      style={[
                        styles.sensitivityLabel,
                        selected && styles.sensitivityLabelSelected,
                      ]}>
                      {opt.label}
                    </Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.sensitivityDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Grace Period Section */}
        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>Alarm Grace Period</Text>
              <Text style={styles.sectionSubtitle}>
                Time before siren fires when tag goes out of range
              </Text>
            </View>
            <Text style={styles.stepperValueText}>{settings.gracePeriodSec}s</Text>
          </View>

          <View style={styles.stepperRow}>
            {[0, 2, 3, 5, 10].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.stepperButton,
                  settings.gracePeriodSec === sec && styles.stepperButtonActive,
                ]}
                onPress={() => updateAppSettings({ gracePeriodSec: sec })}>
                <Text
                  style={[
                    styles.stepperBtnText,
                    settings.gracePeriodSec === sec && styles.stepperBtnTextActive,
                  ]}>
                  {sec === 0 ? 'Instant' : `${sec}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Snatch & Recovery Toggles */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Detection & Disarm Behavior</Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleLabel}>Auto-Disarm on Tag Return</Text>
              <Text style={styles.toggleDesc}>
                If you recover within 3 meters of the phone, siren automatically silences.
              </Text>
            </View>
            <Switch
              value={settings.autoDisarmOnReturn}
              onValueChange={(val) => updateAppSettings({ autoDisarmOnReturn: val })}
              trackColor={{ false: colors.border, true: colors.primaryDark }}
              thumbColor={settings.autoDisarmOnReturn ? colors.primary : '#ccc'}
            />
          </View>
        </View>

        {/* Alarm Sound Profile */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Emergency Alarm Siren</Text>
          <Text style={styles.sectionSubtitle}>Bypasses DND and plays at 100% volume</Text>

          {soundOptions.map((snd) => {
            const isSelected = settings.alarmSound === snd;
            return (
              <TouchableOpacity
                key={snd}
                style={[styles.soundRow, isSelected && styles.soundRowSelected]}
                onPress={() => updateAppSettings({ alarmSound: snd })}>
                <Text style={[styles.soundName, isSelected && styles.soundNameSelected]}>
                  {snd}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.testBtn} onPress={triggerTestAlarm}>
            <Text style={styles.testBtnText}>🔊 Test Sound & Strobe (2 Seconds)</Text>
          </TouchableOpacity>
        </View>

        {/* Backup PIN Setup */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Backup Disarm PIN</Text>
          <Text style={styles.sectionSubtitle}>
            Fallback code if fingerprint sensor is wet or fails during an emergency
          </Text>

          <View style={styles.pinInputRow}>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="Enter 4-6 digit PIN"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.savePinBtn} onPress={handleSavePin}>
              <Text style={styles.savePinBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* OEM Background Execution Warning */}
        <View style={styles.oemNoticeCard}>
          <Text style={styles.oemNoticeTitle}>⚠️ OEM Battery Optimization Warning</Text>
          <Text style={styles.oemNoticeText}>
            Xiaomi (MIUI/HyperOS), Samsung (OneUI), and Oppo/Vivo (ColorOS) may terminate background BLE
            services after 15 minutes unless battery optimization is set to "No restrictions" and "Autostart" is enabled.
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 18,
  },
  sensitivityButtonGroup: {
    gap: 8,
  },
  sensitivityOption: {
    backgroundColor: colors.surfaceLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sensitivityOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  optionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensitivityLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  sensitivityLabelSelected: {
    color: colors.primary,
  },
  sensitivityDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkmark: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stepperButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperButtonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  stepperBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  stepperBtnTextActive: {
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  toggleDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  soundRowSelected: {
    borderColor: colors.primary,
  },
  soundName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  soundNameSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  testBtn: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 10,
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pinInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savePinBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 10,
  },
  savePinBtnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  oemNoticeCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  oemNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.warning,
    marginBottom: 4,
  },
  oemNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

