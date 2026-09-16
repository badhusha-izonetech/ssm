import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldMovement, addNote } from '../api/fieldMovements';
import { enqueueMutation, removeFromMutationQueue, listPendingMutations, PendingMutation } from '../tracking/pendingMutationQueue';
import { FieldMovementNoteRead } from '../types';
import { describeActionFailure } from '../utils/fieldErrorMessages';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import SyncPendingNote from '../components/SyncPendingNote';
import { formatDateTime } from '../utils/format';
import { updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { colors, radius, spacing } from '../theme/theme';

const MAX_LENGTH = 2000;

/**
 * Site Notes — real backend-backed note log (§A). Every "Add Note" creates
 * a durable, timestamped entry via POST /field-movements/{id}/notes
 * (PostgreSQL, visible on Web/History), not a single locally-overwritten
 * text field. AsyncStorage here is only ever a temporary offline queue —
 * see pendingMutationQueue.ts — never the authoritative record.
 */
export default function SiteNotesScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [savedNotes, setSavedNotes] = useState<FieldMovementNoteRead[]>([]);
  const [pending, setPending] = useState<PendingMutation[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [fm, pendingItems] = await Promise.all([
        getFieldMovement(fieldMovementId),
        listPendingMutations(fieldMovementId, 'note'),
      ]);
      const notesList = fm.notes || [];
      setSavedNotes([...notesList].reverse()); // newest first
      setPending(pendingItems);
      if (notesList.length > 0) {
        const combined = notesList.map((n) => n.note).join('\n');
        await updateSiteVisitRecord(fieldMovementId, (r) => ({ ...r, notes: combined }));
      }
    } catch {
      // Real backend note history couldn't load (likely offline) — the
      // employee can still add notes below; they'll queue for sync.
      setError('Could not load previous notes. You can still add a new note below.');
    } finally {
      setLoading(false);
    }
  }, [fieldMovementId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    const note = draft.trim();
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      // Persist the note to the offline queue BEFORE attempting the
      // network call, so it survives a killed app or lost connection
      // instead of only existing as unsaved text in this input (§A, §G).
      const operationId = await enqueueMutation({
        fieldMovementId,
        kind: 'note',
        payload: { note },
      });
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        notes: r.notes ? `${r.notes}\n${note}` : note,
      }));
      try {
        await addNote(fieldMovementId, note, operationId);
        await removeFromMutationQueue(operationId);
      } catch (err) {
        // Left in the queue — the app-level auto-drain (App.tsx) will
        // retry it on reconnect, and the same operationId keeps the retry
        // idempotent server-side.
        const failure = describeActionFailure(err);
        setError(failure.message);
      }
      setDraft('');
      await load();
    } catch {
      setError('Could not save your note. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.screen}>
        <ScreenHeader title="Site Notes" onBack={() => navigation.goBack()} subtitle="Add notes about the site" />

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={savedNotes}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
          ListHeaderComponent={
            pending.length > 0 ? (
              <SyncPendingNote
                label={`${pending.length} note${pending.length > 1 ? 's' : ''} saved on device — syncing when connected`}
              />
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notes yet. Add the first one below.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{item.note}</Text>
              <Text style={styles.noteMeta}>{formatDateTime(item.created_at)}</Text>
            </View>
          )}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Add a note about the site…"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, MAX_LENGTH))}
            textAlignVertical="top"
          />
          <View style={styles.counterRow}>
            <Text style={styles.counter}>
              {draft.length}/{MAX_LENGTH}
            </Text>
          </View>
          <Button title="Add Note" onPress={handleSave} loading={saving} disabled={!draft.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  noteCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: { fontSize: 14, color: colors.textPrimary },
  noteMeta: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  composer: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    minHeight: 90,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },
  counterRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, marginBottom: spacing.sm },
  counter: { fontSize: 11, color: colors.textMuted },
  errorText: { fontSize: 12, color: colors.danger, marginHorizontal: spacing.lg, marginTop: spacing.sm },
});
