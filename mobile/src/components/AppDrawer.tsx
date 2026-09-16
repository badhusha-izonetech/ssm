import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme/theme';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

const ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: "Today's Work", icon: 'home-outline', route: 'TodayWork' },
  { label: 'Field Tracking', icon: 'navigate-outline', route: 'FieldTrackingHistory' },
  { label: 'Work / Site', icon: 'business-outline', route: 'SiteVisitHub' },
  { label: 'Materials & Equipment', icon: 'construct-outline', route: 'MaterialsEquipment' },
  { label: 'Profile', icon: 'person-outline', route: 'Profile' },
];

export default function AppDrawer({ visible, onClose, navigation }: AppDrawerProps) {
  const { employee, logout } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.panel, { paddingTop: insets.top + spacing.lg }]} onPress={() => {}}>
          <View style={styles.brandRow}>
            <View style={styles.logoDot}>
              <Ionicons name="sunny" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.brand}>SUCCESS SOLAR</Text>
              <Text style={styles.brandSub}>Field Employee App</Text>
            </View>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(employee?.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {employee?.name}
              </Text>
              <Text style={styles.role} numberOfLines={1}>
                {employee?.designation}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.item}
              onPress={() => {
                onClose();
                navigation.navigate(item.route);
              }}
            >
              <Ionicons name={item.icon} size={19} color={colors.textPrimary} style={{ width: 26 }} />
              <Text style={styles.itemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              onClose();
              logout();
            }}
          >
            <Ionicons name="log-out-outline" size={19} color={colors.danger} style={{ width: 26 }} />
            <Text style={[styles.itemText, { color: colors.danger }]}>Logout</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', flexDirection: 'row' },
  panel: {
    width: '78%',
    maxWidth: 320,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  logoDot: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  brand: { fontSize: 13, fontWeight: '800', color: colors.navy, letterSpacing: 0.5 },
  brandSub: { fontSize: 11, color: colors.textMuted },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  role: { fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  itemText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginLeft: 4 },
});
