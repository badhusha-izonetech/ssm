import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as fieldMovementsApi from '../api/fieldMovements';
import { loadSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { EquipmentRecord } from '../siteVisit/types';
import ScreenHeader from '../components/ScreenHeader';
import BottomNav from '../components/BottomNav';
import Card from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import SyncPendingNote from '../components/SyncPendingNote';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime } from '../utils/format';

const ACTIVE_STATUSES = ['Checked In', 'On Field', 'Returning'];
type Stage = 'before' | 'after';

function StageSummary({ record, onOpen, actionLabel }: { record: EquipmentRecord; onOpen: () => void; actionLabel: string }) {
  return (
    <Card style={styles.stageCard} padded>
      <View style={styles.stageRow}>
        {record.photo ? (
          <Image source={{ uri: record.photo.uri }} style={styles.stagePhoto} />
        ) : (
          <View style={styles.stagePhotoPlaceholder}>
            <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.stageItems}>
            {record.items.length} item{record.items.length === 1 ? '' : 's'}
          </Text>
          {record.confirmedAt ? (
            <Text style={styles.stageConfirmed}>Confirmed {formatDateTime(record.confirmedAt)}</Text>
          ) : (
            <Text style={styles.stagePending}>Not confirmed yet</Text>
          )}
        </View>
      </View>
      <Button title={actionLabel} variant="outline" icon="open-outline" onPress={onOpen} style={{ marginTop: spacing.md }} />
    </Card>
  );
}

export default function MaterialsEquipmentScreen({ navigation }: any) {
  const [fmId, setFmId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('before');
  const [before, setBefore] = useState<EquipmentRecord | null>(null);
  const [after, setAfter] = useState<EquipmentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fieldMovementsApi.listMine(1, 30);
      const active = res.items.find((f) => ACTIVE_STATUSES.includes(f.status));
      if (!active) {
        setFmId(null);
        return;
      }
      setFmId(active.id);
      const rec = await loadSiteVisitRecord(active.id);
      setBefore(rec.equipment.before);
      setAfter(rec.equipment.after);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!fmId || !before || !after) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Materials / Equipment" />
        <EmptyState
          icon="construct-outline"
          title="No active field visit"
          subtitle="Start tracking to log equipment received or returned for this visit."
        />
        <BottomNav active="Equipment" navigation={navigation} />
      </View>
    );
  }

  const current = stage === 'before' ? before : after;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Materials / Equipment" />

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, stage === 'before' && styles.tabActive]} onPress={() => setStage('before')}>
          <Text style={[styles.tabText, stage === 'before' && styles.tabTextActive]}>Before Work</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, stage === 'after' && styles.tabActive]} onPress={() => setStage('after')}>
          <Text style={[styles.tabText, stage === 'after' && styles.tabTextActive]}>After Work</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SyncPendingNote />
        <StageSummary
          record={current}
          actionLabel={current.confirmedAt ? 'View / Edit' : `Open ${stage === 'before' ? 'Before' : 'After'}-Work Check`}
          onOpen={() => navigation.navigate('EquipmentStage', { fieldMovementId: fmId, stage })}
        />
      </ScrollView>

      <BottomNav active="Equipment" navigation={navigation} />
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
  stageCard: { marginTop: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center' },
  stagePhoto: { width: 52, height: 52, borderRadius: radius.sm },
  stagePhotoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageItems: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  stageConfirmed: { fontSize: 11, color: colors.success, marginTop: 3 },
  stagePending: { fontSize: 11, color: colors.warning, marginTop: 3 },
});
