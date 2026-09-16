import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';

export type BottomTabKey = 'Home' | 'Tracking' | 'SiteVisit' | 'Equipment' | 'Profile';

const TABS: { key: BottomTabKey; label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { key: 'Home', label: 'Home', icon: 'home', route: 'TodayWork' },
  { key: 'Tracking', label: 'Tracking', icon: 'navigate', route: 'FieldTrackingHistory' },
  { key: 'SiteVisit', label: 'Work/Site', icon: 'business', route: 'SiteVisitHub' },
  { key: 'Equipment', label: 'Equipment', icon: 'construct', route: 'MaterialsEquipment' },
  { key: 'Profile', label: 'Profile', icon: 'person', route: 'Profile' },
];

export default function BottomNav({ active, navigation }: { active: BottomTabKey; navigation: any }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => {
              if (!isActive) navigation.navigate(tab.route);
            }}
          >
            <Ionicons name={tab.icon} size={21} color={isActive ? colors.primary : colors.textMuted} />
            <Text style={[styles.label, { color: isActive ? colors.primary : colors.textMuted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '600', marginTop: 3 },
});
