import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useAppState } from '../state/AppStateContext';
import { colors } from '../theme/colors';

export const AlarmScreen: React.FC = () => {
  const {
    alarmReason,
    rssi,
    disarmWithBiometrics,
    disarmWithPin,
  } = useAppState();

  const [flashRed, setFlashRed] = useState(true);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  // Screen flashing effect (alternates colors every 250ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setFlashRed((prev) => !prev);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const handleBiometricDisarm = async () => {
    await disarmWithBiometrics();
  };

  const handlePinDisarm = async () => {
    if (!enteredPin) return;
    const success = await disarmWithPin(enteredPin);
    if (success) {
      setPinModalVisible(false);
      setEnteredPin('');
    } else {
      Alert.alert('Incorrect PIN', 'The PIN entered is not correct.');
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: flashRed ? colors.alarmRed : '#991B1B' },
      ]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.alarmRed} />

      <View style={styles.content}>
        {/* Flashing Top Alert Icon */}
        <View style={styles.alertIconBadge}>
          <Text style={styles.alertIconText}>🚨</Text>
        </View>

        <Text style={styles.emergencyHeading}>MARSHMELLO ALARM</Text>
        <Text style={styles.reasonText}>
          {alarmReason ? alarmReason.toUpperCase() : 'SNATCH THEFT DETECTED'}
        </Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusBoxLabel}>Current Tag Status</Text>
          <Text style={styles.statusBoxValue}>
            {rssi <= -95 ? 'TAG OUT OF RANGE' : `Signal: ${Math.round(rssi)} dBm`}
          </Text>
          <Text style={styles.statusBoxHint}>
            Siren is sounding at max volume and strobe light is active.
            Owner must authenticate to silence.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={styles.biometricBtn}
            activeOpacity={0.8}
            onPress={handleBiometricDisarm}>
            <Text style={styles.biometricIcon}>👆</Text>
            <Text style={styles.biometricBtnText}>DISARM WITH BIOMETRIC</Text>
            <Text style={styles.biometricSubText}>Fingerprint or Face Unlock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pinFallbackBtn}
            onPress={() => setPinModalVisible(true)}>
            <Text style={styles.pinFallbackText}>Disarm with PIN</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PIN Fallback Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Owner Disarm PIN</Text>
            <Text style={styles.modalSubtitle}>
              Please enter your 4-6 digit security PIN:
            </Text>

            <TextInput
              style={styles.modalPinInput}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoFocus
              value={enteredPin}
              onChangeText={setEnteredPin}
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setPinModalVisible(false);
                  setEnteredPin('');
                }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handlePinDisarm}>
                <Text style={styles.modalConfirmText}>Confirm Disarm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 30,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertIconBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginTop: 20,
  },
  alertIconText: {
    fontSize: 54,
  },
  emergencyHeading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 16,
  },
  reasonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FEF08A',
    textAlign: 'center',
    marginTop: 4,
  },
  statusBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusBoxLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 8,
  },
  statusBoxHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 18,
  },
  actionGroup: {
    width: '100%',
    gap: 12,
  },
  biometricBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    elevation: 8,
  },
  biometricIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  biometricBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 1,
  },
  biometricSubText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
    marginTop: 2,
  },
  pinFallbackBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
  },
  pinFallbackText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  modalPinInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.accentDark,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
});

