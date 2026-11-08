import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../state/AppStateContext';
import { DiscoveredTag } from '../native/MarshmelloNative';
import { colors } from '../theme/colors';

export const PairTagScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    isScanning,
    discoveredTags,
    savedTagMac,
    savedTagName,
    isConnected,
    startTagScan,
    stopTagScan,
    pairTag,
    forgetTag,
  } = useAppState();

  useEffect(() => {
    startTagScan();
    return () => {
      stopTagScan();
    };
  }, []);

  const renderDiscoveredItem = ({ item }: { item: DiscoveredTag }) => {
    const isThisPaired = savedTagMac === item.address;

    return (
      <View style={styles.tagItemCard}>
        <View style={styles.tagItemLeft}>
          <Text style={styles.tagItemIcon}>🏷️</Text>
          <View>
            <Text style={styles.tagItemName}>{item.name || 'Marshmello-Tag'}</Text>
            <Text style={styles.tagItemMac}>{item.address}</Text>
            <Text style={styles.tagItemRssi}>Signal: {item.rssi} dBm</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.pairButton, isThisPaired ? styles.pairedButton : styles.unpairedButton]}
          onPress={() => pairTag(item)}
          disabled={isThisPaired}>
          <Text style={styles.pairButtonText}>
            {isThisPaired ? 'Connected' : 'Pair'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pair Hardware Tag</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {/* Currently Paired Tag Card */}
        {savedTagMac && (
          <View style={styles.currentPairedCard}>
            <View style={styles.currentPairedHeader}>
              <View>
                <Text style={styles.sectionLabel}>Active Remembered Tag</Text>
                <Text style={styles.currentTagName}>{savedTagName || 'Marshmello-Tag'}</Text>
                <Text style={styles.currentTagMac}>{savedTagMac}</Text>
              </View>
              <View
                style={[
                  styles.connectionBadge,
                  { backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' },
                ]}>
                <Text style={[styles.connectionBadgeText, { color: isConnected ? colors.success : colors.accent }]}>
                  {isConnected ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.forgetBtn} onPress={forgetTag}>
              <Text style={styles.forgetBtnText}>Forget & Disconnect Tag</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan Status & Control */}
        <View style={styles.scanControlRow}>
          <View style={styles.scanStatusTextRow}>
            {isScanning && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
            <Text style={styles.scanStatusText}>
              {isScanning ? 'Scanning for Marshmello-Tag peripherals...' : 'Scan stopped'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={isScanning ? stopTagScan : startTagScan}>
            <Text style={styles.rescanBtnText}>{isScanning ? 'Stop' : 'Scan'}</Text>
          </TouchableOpacity>
        </View>

        {/* Discovered Peripherals List */}
        <FlatList
          data={discoveredTags}
          keyExtractor={(item) => item.address}
          renderItem={renderDiscoveredItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={styles.emptyTitle}>Searching for Tag...</Text>
              <Text style={styles.emptySubtitle}>
                Ensure your ESP32 tag is powered on, flashed with Marshmello firmware, and in range.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
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
    flex: 1,
    padding: 20,
  },
  currentPairedCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderActive,
  },
  currentPairedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  currentTagName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  currentTagMac: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  connectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  forgetBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  forgetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  scanControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanStatusTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scanStatusText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  rescanBtn: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rescanBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  tagItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tagItemIcon: {
    fontSize: 24,
  },
  tagItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  tagItemMac: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  tagItemRssi: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  pairButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unpairedButton: {
    backgroundColor: colors.primaryDark,
  },
  pairedButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  pairButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

