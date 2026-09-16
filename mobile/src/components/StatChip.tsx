import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/theme';

export default function StatChip({
  icon,
  label,
  value,
  tint = colors.textPrimary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.value, { color: tint }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  value: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  label: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
