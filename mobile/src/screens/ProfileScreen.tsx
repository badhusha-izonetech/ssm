import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import BottomNav from '../components/BottomNav';
import Card from '../components/Card';
import ListRow from '../components/ListRow';
import { colors, radius, spacing } from '../theme/theme';

export default function ProfileScreen({ navigation }: any) {
  const { employee, logout } = useAuth();

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  function comingSoon(feature: string) {
    Alert.alert(feature, 'This will be available in a future update.');
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.headerCard} padded>
          <View style={[styles.avatar, employee?.avatar_color ? { backgroundColor: employee.avatar_color } : null]}>
            <Text style={styles.avatarText}>{(employee?.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{employee?.name}</Text>
          <Text style={styles.role}>{employee?.designation}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>Employee ID: {employee?.employee_code}</Text>
          </View>
          {employee?.mobile ? <Text style={styles.mobile}>{employee.mobile}</Text> : null}
        </Card>

        <Text style={styles.sectionTitle}>Account</Text>
        <Card padded>
          <ListRow icon="person-outline" title="Personal Information" subtitle={employee?.department} onPress={() => comingSoon('Personal Information')} />
          <ListRow icon="key-outline" title="Name & Password" onPress={() => comingSoon('Change Password')} />
        </Card>

        <Text style={styles.sectionTitle}>Work</Text>
        <Card padded>
          <ListRow icon="construct-outline" title="Equipment" onPress={() => navigation.navigate('MaterialsEquipment')} />
          <ListRow icon="document-text-outline" title="Documents" onPress={() => comingSoon('Documents overview')} />
          <ListRow icon="navigate-outline" title="Field Tracking" onPress={() => navigation.navigate('FieldTrackingHistory')} />
        </Card>

        <Text style={styles.sectionTitle}>Support</Text>
        <Card padded>
          <ListRow icon="settings-outline" title="App Settings" onPress={() => comingSoon('App Settings')} />
          <ListRow icon="help-circle-outline" title="Help / Support" onPress={() => comingSoon('Help & Support')} />
          <ListRow icon="log-out-outline" iconTint={colors.danger} iconBg={colors.dangerSoft} title="Logout" onPress={handleLogout} right={<View />} />
        </Card>
      </ScrollView>
      <BottomNav active="Profile" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  headerCard: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  role: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badgeRow: { marginTop: spacing.sm },
  badge: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  mobile: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.sm, textTransform: 'uppercase' },
});
