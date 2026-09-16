import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import * as fieldMovementsApi from '../api/fieldMovements';
import * as leadsApi from '../api/leads';
import * as projectsApi from '../api/projects';
import { FieldMovementRead } from '../types';
import { ApiError } from '../api/client';
import { loadSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { SiteVisitRecord } from '../siteVisit/types';
import { useRole } from '../roles/useRole';
import { trackingManager } from '../tracking/TrackingManager';
import ScreenHeader from '../components/ScreenHeader';
import BottomNav from '../components/BottomNav';
import AppDrawer from '../components/AppDrawer';
import Card from '../components/Card';
import Button from '../components/Button';
import StatusPill from '../components/StatusPill';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime } from '../utils/format';

const ACTIVE_STATUSES = ['Checked In', 'On Field', 'Returning'];

/** Primary action is always the master continuous live tracking session */
function resolvePrimaryAction(
  active: FieldMovementRead | undefined,
  siteRecord: SiteVisitRecord | null
): { label: string; sub: string; route: string; params: object } | null {
  if (!active) return null;
  return {
    label: 'Live Tracking Active',
    sub: 'Continuous GPS tracking active • Tap to view live map & pin places',
    route: 'ContinuousLiveTracking',
    params: { fieldMovementId: active.id },
  };
}

export default function TodayWorkScreen({ navigation }: any) {
  const { employee } = useAuth();
  const role = useRole();
  const [items, setItems] = useState<FieldMovementRead[]>([]);
  const [siteRecord, setSiteRecord] = useState<SiteVisitRecord | null>(null);
  const [assignedCount, setAssignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startingTracking, setStartingTracking] = useState(false);

  const handleStartLiveTracking = async () => {
    if (role.usesEquipmentCustody) {
      navigation.navigate('EquipmentBefore');
      return;
    }
    setStartingTracking(true);
    try {
      const servicesOn = await trackingManager.isLocationServicesEnabled();
      if (!servicesOn) {
        Alert.alert(
          'Location Services Off',
          'Please enable Location Services in device settings to begin live tracking.'
        );
        return;
      }
      const outcome = await trackingManager.requestPermissions();
      if (outcome === 'denied') {
        Alert.alert('Location Required', 'Continuous live tracking requires location access.');
        return;
      }
      const fm = await fieldMovementsApi.startFieldMovement({
        purpose: 'Field Mobility & Continuous Live Tracking',
        current_location: 'Office Departure',
      });
      await trackingManager.start(fm.id, {});
      await load();
      navigation.navigate('ContinuousLiveTracking', { fieldMovementId: fm.id });
    } catch (err: any) {
      Alert.alert('Could not start tracking', err?.message || 'Check network connection.');
    } finally {
      setStartingTracking(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fieldMovementsApi.listMine(1, 30);
      const uniqueItems = Array.from(new Map((res.items || []).map((it) => [it.id, it])).values());
      setItems(uniqueItems);
      const active = uniqueItems.find((f) => ACTIVE_STATUSES.includes(f.status));
      setSiteRecord(active ? await loadSiteVisitRecord(active.id) : null);
      if (role.canTrack) {
        try {
          const [leadsRes, projectsRes] = await Promise.allSettled([
            leadsApi.listAssignedFieldLeads(1, 1),
            projectsApi.listMyProjects(1, 1),
          ]);
          let total = 0;
          if (leadsRes.status === 'fulfilled') {
            total += leadsRes.value.total || 0;
          }
          if (projectsRes.status === 'fulfilled') {
            total += projectsRes.value.total || 0;
          }
          setAssignedCount(total);
        } catch {
          // Non-fatal if assigned work fails to load
        }
      }
    } catch (err) {
      // Non-fatal on this screen — recent work list just stays empty/stale.
      if (__DEV__ && err instanceof ApiError) console.warn('[TodayWork]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const active = items.find((f) => ACTIVE_STATUSES.includes(f.status));
  const primaryAction = resolvePrimaryAction(active, siteRecord);

  const today = new Date();
  const todaysItems = useMemo(
    () =>
      items.filter((f) => {
        const d = new Date(f.start_time);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      }),
    [items]
  );
  const todaysCompleted = todaysItems.filter((f) => f.status === 'Checked Out').length;

  const recent = items.filter((f) => f.id !== active?.id).slice(0, 10);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Today's Work" onMenu={() => setDrawerOpen(true)} rightIcon="notifications-outline" />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />

      <FlatList
        data={recent}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `recent-${index}`)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.greetRow}>
              <View>
                <Text style={styles.greeting}>Hi, {employee?.name?.split(' ')[0] || 'there'} 👋</Text>
                <View style={styles.roleRow}>
                  <Ionicons name={role.homeIcon} size={12} color={colors.textMuted} />
                  <Text style={styles.role}>{employee?.designation || role.label}</Text>
                </View>
              </View>
            </View>

            {role.canTrack && primaryAction ? (
              <View style={{ marginBottom: spacing.sm }}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate(primaryAction.route, primaryAction.params)}>
                  <Card style={styles.activeCard} padded>
                    <View style={styles.activeTopRow}>
                      <View style={styles.liveDotWrap}>
                        <View style={styles.liveDot} />
                      </View>
                      <Text style={styles.activeTitle}>{primaryAction.label}</Text>
                    </View>
                    <Text style={styles.activeSub}>{primaryAction.sub}</Text>
                    <View style={styles.activeCta}>
                      <Text style={styles.activeCtaText}>Open Live Map & Pin</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </View>
                  </Card>
                </TouchableOpacity>

                {siteRecord && (
                  <TouchableOpacity
                    style={{ marginTop: 8 }}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('SiteVisitHub', { fieldMovementId: active?.id })}
                  >
                    <Card style={{ padding: 12, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="clipboard-outline" size={18} color={colors.success} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                            On-Site Visit Tasks in Progress
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                )}
              </View>
            ) : role.canTrack ? (
              <Card style={styles.startCard} padded>
                <View style={styles.startIconRow}>
                  <View style={styles.playCircle}>
                    <Ionicons name="navigate" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.startTitle}>Start Live Tracking</Text>
                    <Text style={styles.startSub}>
                      Turn on continuous GPS tracking before leaving office. Record random stops, visits, and assigned leads.
                    </Text>
                  </View>
                </View>
                <Button
                  title={startingTracking ? 'Starting Tracking…' : 'Start Live Tracking'}
                  variant="success"
                  icon="navigate"
                  disabled={startingTracking}
                  onPress={handleStartLiveTracking}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : null}

            <Text style={styles.sectionTitle}>Today's Summary</Text>
            <Card style={styles.summaryCard} padded>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{todaysItems.length}</Text>
                  <Text style={styles.summaryLabel}>Visits</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{todaysCompleted}</Text>
                  <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{active ? 1 : 0}</Text>
                  <Text style={styles.summaryLabel}>Active</Text>
                </View>
              </View>
            </Card>

            {role.canTrack && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('AssignedWorkInbox')}>
                <Card style={styles.summaryCard} padded>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.inboxIconWrap}>
                      <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.startTitle}>Assigned Field Work</Text>
                        {assignedCount > 0 && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{assignedCount}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.startSub}>
                        {assignedCount > 0
                          ? `${assignedCount} assigned task${assignedCount === 1 ? '' : 's'} (projects & leads)`
                          : 'View projects and leads assigned to you'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                </Card>
              </TouchableOpacity>
            )}

            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Work</Text>
              <TouchableOpacity onPress={() => navigation.navigate('FieldTrackingHistory')}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const isDirect = item.work_type === 'DIRECT MARKET';
          const workTypeBadge = item.work_type || 'SITE VISIT';
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (item.status === 'Checked Out') {
                  navigation.navigate('SiteEvidenceReview', { fieldMovementId: item.id });
                } else {
                  navigation.navigate('SiteVisit', { fieldMovementId: item.id });
                }
              }}
            >
              <Card style={styles.row} padded>
                <View style={[styles.rowIconWrap, isDirect && { backgroundColor: colors.primarySoft }]}>
                  <Ionicons
                    name={isDirect ? 'megaphone' : 'location'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.destination || item.purpose || 'Field visit'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <View style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: radius.pill,
                      backgroundColor: isDirect ? colors.primarySoft : colors.infoSoft
                    }}>
                      <Text style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: isDirect ? colors.primary : colors.info
                      }}>
                        {workTypeBadge}
                      </Text>
                    </View>
                    <Text style={styles.rowSub}>{formatDateTime(item.start_time)}</Text>
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>· Review Evidence →</Text>
                  </View>
                </View>
                <StatusPill
                  label={item.status === 'Checked Out' ? 'Completed' : item.status}
                  tone={
                    item.status === 'Checked Out'
                      ? 'muted'
                      : item.status === 'On Field'
                      ? 'success'
                      : item.status === 'Returning'
                      ? 'warning'
                      : 'info'
                  }
                />
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyState icon="briefcase-outline" title="No previous field visits yet" />}
      />

      <BottomNav active="Home" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  roleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  role: { fontSize: 12, color: colors.textMuted, marginLeft: 5 },
  activeCard: { backgroundColor: colors.navy, marginBottom: spacing.lg, borderColor: colors.navy },
  activeTopRow: { flexDirection: 'row', alignItems: 'center' },
  liveDotWrap: { marginRight: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  activeTitle: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  activeSub: { color: '#E2E8F0', marginTop: 6, fontSize: 13 },
  activeCta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  activeCtaText: { color: '#fff', fontWeight: '700', fontSize: 12, marginRight: 6 },
  startCard: { marginBottom: spacing.lg },
  startIconRow: { flexDirection: 'row', alignItems: 'center' },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  startSub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
  summaryCard: { marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },
  recentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewAll: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  inboxIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
