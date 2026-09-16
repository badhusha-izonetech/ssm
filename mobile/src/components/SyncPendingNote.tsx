import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/theme';

export default function SyncPendingNote({ label = 'Saved on device — pending backend sync' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={13} color={colors.warning} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, color: colors.warning, fontWeight: '600', marginLeft: 6 },
});
