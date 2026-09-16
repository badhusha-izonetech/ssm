import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as fieldMovementsApi from '../api/fieldMovements';
import { FieldMovementRead } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import BottomNav from '../components/BottomNav';
import Card from '../components/Card';
import StatusPill from '../components/StatusPill';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime, formatDuration } from '../utils/format';

const ACTIVE_STATUSES = ['Checked In', 'On Field', 'Returning'];

function toneFor(status: string): 'success' | 'warning' | 'info' | 'muted' {
  if (status === 'On Field') return 'success';
  if (status === 'Returning') return 'warning';
  if (status === 'Checked Out') return 'muted';
  return 'info';
}

export default function FieldTrackingHistoryScreen({ navigation }: any) {
  const [tab, setTab] = useState<'today' | 'history'>('history');
  const [items, setItems] = useState<FieldMovementRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fieldMovementsApi.listMine(1, 50);
      const uniqueItems = Array.from(new Map((res.items || []).map((it) => [it.id, it])).values());
      setItems(uniqueItems);
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
  const today = new Date();
  const isToday = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };
  const list = (tab === 'today' ? items.filter((f) => isToday(f.start_time)) : items).filter((f) => f.id !== active?.id);

  const completedToday = items.filter((f) => isToday(f.start_time) && f.status === 'Checked Out');
  const totalDurationMs = completedToday.reduce((sum, f) => {
    if (!f.end_time) return sum;
    return sum + (new Date(f.end_time).getTime() - new Date(f.start_time).getTime());
  }, 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Field Tracking" />

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'today' && styles.tabActive]} onPress={() => setTab('today')}>
          <Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `history-${index}`)}
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
            <Card style={styles.summaryCard} padded>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{completedToday.length}</Text>
                  <Text style={styles.summaryLabel}>Visits Today</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatDuration(totalDurationMs)}</Text>
                  <Text style={styles.summaryLabel}>Total Duration</Text>
                </View>
              </View>
            </Card>

            {active && (
              <TouchableOpacity onPress={() => navigation.navigate('TrackingLive', { fieldMovementId: active.id })}>
                <Card style={styles.liveCard} padded>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveTitle}>Live now — {active.status}</Text>
                  </View>
                  <Text style={styles.liveSub} numberOfLines={1}>
                    {active.current_location || active.destination || 'Tracking in progress'}
                  </Text>
                  <View style={styles.liveCta}>
                    <Text style={styles.liveCtaText}>View live map</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </View>
                </Card>
              </TouchableOpacity>
            )}
          </>
        }
        renderItem={({ item }) => {
          const durationMs = item.end_time
            ? new Date(item.end_time).getTime() - new Date(item.start_time).getTime()
            : Date.now() - new Date(item.start_time).getTime();
          return (
            <Card style={styles.row} padded>
              <View style={styles.rowTop}>
                <Text style={styles.rowDate}>{formatDateTime(item.start_time)}</Text>
                <StatusPill label={item.status} tone={toneFor(item.status)} />
              </View>
              <Text style={styles.rowDest} numberOfLines={1}>
                {item.destination || item.purpose || 'Field visit'}
              </Text>
              <View style={styles.rowStatsRow}>
                <View style={styles.rowStat}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.rowStatText}>{formatDuration(durationMs)}</Text>
                </View>
                {item.last_location_at && (
                  <View style={styles.rowStat}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.rowStatText} numberOfLines={1}>
                      {item.current_location || 'Last known location recorded'}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState icon="navigate-outline" title="No tracking history yet" />}
      />

      <BottomNav active="Tracking" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  content: { padding: spacing.lg },
  summaryCard: { marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  liveCard: { backgroundColor: colors.navy, borderColor: colors.navy, marginBottom: spacing.md },
  liveRow: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 8 },
  liveTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  liveSub: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
  liveCta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  liveCtaText: { color: '#fff', fontSize: 11, fontWeight: '700', marginRight: 4 },
  row: { marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowDate: { fontSize: 11, color: colors.textMuted },
  rowDest: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  rowStatsRow: { flexDirection: 'row', marginTop: 6 },
  rowStat: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md, flexShrink: 1 },
  rowStatText: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
});
