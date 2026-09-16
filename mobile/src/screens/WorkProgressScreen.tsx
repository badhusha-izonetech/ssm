import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldMovement, addWorkUpdate } from '../api/fieldMovements';
import { enqueueMutation, removeFromMutationQueue, listPendingMutations, PendingMutation } from '../tracking/pendingMutationQueue';
import { trackingManager } from '../tracking/TrackingManager';
import { WorkStage, WORK_STAGE_LABELS } from '../siteVisit/types';
import { FieldMovementWorkUpdateRead } from '../types';
import { describeActionFailure } from '../utils/fieldErrorMessages';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import SyncPendingNote from '../components/SyncPendingNote';
import { formatDateTime } from '../utils/format';
import { colors, spacing, radius } from '../theme/theme';

const SEQUENCE: WorkStage[] = ['site_verified', 'ready_to_start', 'in_progress', 'work_completed'];

const NEXT_ACTION: Record<WorkStage, { label: string; next: WorkStage } | null> = {
  equipment_ready: { label: 'Confirm Site Verified', next: 'site_verified' },
  travelling: { label: 'Confirm Site Verified', next: 'site_verified' },
  arrived: { label: 'Confirm Site Verified', next: 'site_verified' },
  site_verified: { label: 'Mark Ready to Start Work', next: 'ready_to_start' },
  ready_to_start: { label: 'Start Work', next: 'in_progress' },
  in_progress: { label: 'Finish Work', next: 'work_completed' },
  work_completed: null,
  returning: null,
  completed: null,
};

/**
 * Work Progress / Stages — real backend-authoritative Field Technician
 * progress (§B). Every advance creates a new history row via POST
 * /field-movements/{id}/work-updates (never overwrites a prior update —
 * the full day's progression stays visible to CEO/Project Head/History),
 * and FieldMovement.work_stage is only a denormalized "current stage"
 * snapshot behind that. AsyncStorage here is only a temporary offline
 * queue (pendingMutationQueue.ts), never the authoritative state.
 */
export default function WorkProgressScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [stage, setStage] = useState<WorkStage | null>(null);
  const [history, setHistory] = useState<FieldMovementWorkUpdateRead[]>([]);
  const [pending, setPending] = useState<PendingMutation[]>([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [fm, pendingItems] = await Promise.all([
        getFieldMovement(fieldMovementId),
        listPendingMutations(fieldMovementId, 'work_update'),
      ]);
      setStage((fm.work_stage as WorkStage | null) || 'site_verified');
      setHistory([...(fm.work_updates || [])].reverse()); // newest first
      setPending(pendingItems);
    } catch {
      setError('Could not load current progress. You can still record an update below.');
      setStage((prev) => prev || 'site_verified');
    } finally {
      setLoading(false);
    }
  }, [fieldMovementId]);

  useEffect(() => {
    load();
  }, [load]);

  async function advanceTo(next: WorkStage) {
    setAdvancing(true);
    setError(null);
    try {
      // Best-effort current location — recorded when available, but a
      // stage update is never blocked on GPS (unlike the selfie proof,
      // "location where applicable" here is a nice-to-have, not a gate).
      const fix = await trackingManager.getCurrentFix().catch(() => null);
      const payload = {
        stage: next,
        remarks: remarks.trim() || undefined,
        latitude: fix?.latitude,
        longitude: fix?.longitude,
        accuracy: fix?.accuracy,
      };

      // Persist BEFORE the network call, same durability contract as
      // Site Notes — survives a killed app or lost connection (§B, §G).
      const operationId = await enqueueMutation({
        fieldMovementId,
        kind: 'work_update',
        payload,
      });
      try {
        await addWorkUpdate(fieldMovementId, payload, operationId);
        await removeFromMutationQueue(operationId);
      } catch (err) {
        // Left queued — App.tsx's auto-drain retries on reconnect, using
        // the same operationId to stay idempotent server-side. The
        // employee still sees their stage advance locally below so they
        // aren't blocked from continuing their work.
        const failure = describeActionFailure(err);
        setError(failure.message);
      }
      setStage(next);
      setRemarks('');
      await load();
    } finally {
      setAdvancing(false);
    }
  }

  if (loading || !stage) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const action = NEXT_ACTION[stage];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Start / Track Work" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {pending.length > 0 && (
          <SyncPendingNote
            label={`${pending.length} update${pending.length > 1 ? 's' : ''} saved on device — syncing when connected`}
          />
        )}

        <Card style={styles.stageCard} padded>
          <Text style={styles.stageLabel}>Current Stage</Text>
          <Text style={styles.stageValue}>{WORK_STAGE_LABELS[stage]}</Text>
        </Card>

        <View style={styles.timeline}>
          {SEQUENCE.map((s) => {
            const currentIndex = SEQUENCE.indexOf(stage);
            const reached = SEQUENCE.indexOf(s) <= currentIndex;
            return (
              <View key={s} style={styles.timelineRow}>
                <Ionicons
                  name={reached ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={reached ? colors.success : colors.textMuted}
                />
                <Text style={[styles.timelineText, reached && { color: colors.textPrimary, fontWeight: '600' }]}>
                  {WORK_STAGE_LABELS[s]}
                </Text>
              </View>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {action ? (
          <>
            <TextInput
              style={styles.remarksInput}
              placeholder="Remarks for this update (optional)"
              placeholderTextColor={colors.textMuted}
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />
            <Button title={action.label} onPress={() => advanceTo(action.next)} loading={advancing} style={{ marginTop: spacing.sm }} />
          </>
        ) : (
          <Text style={styles.doneText}>Work is marked complete for this visit.</Text>
        )}

        {history.length > 0 && (
          <>
            <Text style={styles.historyTitle}>Update History</Text>
            {history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyStage}>{WORK_STAGE_LABELS[h.stage as WorkStage] || h.stage}</Text>
                {!!h.remarks && <Text style={styles.historyRemarks}>{h.remarks}</Text>}
                <Text style={styles.historyMeta}>{formatDateTime(h.created_at)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg },
  stageCard: { marginTop: spacing.md, marginBottom: spacing.lg, alignItems: 'center' },
  stageLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '700' },
  stageValue: { fontSize: 19, fontWeight: '700', color: colors.primary, marginTop: 4 },
  timeline: { marginBottom: spacing.lg },
  timelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  timelineText: { fontSize: 13, color: colors.textMuted, marginLeft: spacing.sm },
  doneText: { textAlign: 'center', color: colors.success, fontWeight: '600', marginTop: spacing.lg },
  errorText: { fontSize: 12, color: colors.danger, marginBottom: spacing.sm },
  remarksInput: {
    minHeight: 60,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  historyTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  historyRow: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  historyStage: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  historyRemarks: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  historyMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
