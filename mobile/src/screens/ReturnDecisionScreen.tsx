import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as fieldMovementsApi from '../api/fieldMovements';
import { ApiError } from '../api/client';
import { describeActionFailure } from '../utils/fieldErrorMessages';
import { updateSiteVisitRecord, loadSiteVisitRecord, completionSummary } from '../siteVisit/localSiteVisitStore';
import { getModulesForWorkType } from '../roles/roleConfig';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { colors, spacing } from '../theme/theme';

const TASK_TITLES: Record<string, string> = {
  selfie: 'Arrival Proof Selfie',
  generalPhotos: 'General Site Photos',
  installationPhotos: 'Installation Area Photos',
  video: 'Site View Video',
  measurements: 'Measurements',
  documents: 'Documents',
  notes: 'Site Notes',
  equipmentBefore: 'Equipment — Before Work',
  equipmentAfter: 'Equipment — After Work',
  workProgress: 'Work Progress',
};

export default function ReturnDecisionScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [startingReturn, setStartingReturn] = useState(false);
  const [completingNow, setCompletingNow] = useState(false);

  async function handleStartReturning() {
    setStartingReturn(true);
    try {
      await fieldMovementsApi.updateFieldMovement(fieldMovementId, { status: 'Returning' });
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        returnMovement: { ...r.returnMovement, status: 'returning', startedAt: new Date().toISOString() },
      }));
      navigation.reset({ index: 0, routes: [{ name: 'TodayWork' }] });
    } catch (err) {
      const message = describeActionFailure(err).message;
      Alert.alert('Error', message);
    } finally {
      setStartingReturn(false);
    }
  }

  async function executeStop() {
    setCompletingNow(true);
    try {
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        completedAt: new Date().toISOString(),
      }));
      navigation.reset({ index: 0, routes: [{ name: 'TodayWork' }] });
    } catch (err) {
      const message = describeActionFailure(err).message;
      Alert.alert('Error', message);
    } finally {
      setCompletingNow(false);
    }
  }

  async function handleCompleteNow() {
    try {
      const record = await loadSiteVisitRecord(fieldMovementId);
      let fmWorkType: string | null = null;
      let hasNotes = false;
      let workStage: string | null = null;

      try {
        const fm = await fieldMovementsApi.getFieldMovement(fieldMovementId);
        fmWorkType = fm.work_type || null;
        hasNotes = (fm.notes || []).length > 0;
        workStage = fm.work_stage || null;
      } catch {
        // offline or fetch failed fallback
      }

      const activeModules = getModulesForWorkType(fmWorkType);
      const summary = completionSummary(record, { hasNotes, workStage });
      const unfinished = activeModules.filter((m) => m !== 'siteEvidenceReview' && !summary[m]);

      if (unfinished.length > 0) {
        const list = unfinished.map((k) => `• ${TASK_TITLES[k] || k}`).join('\n');
        Alert.alert(
          'Unfinished Field Tasks',
          `You have unfinished tasks on this site visit:\n\n${list}\n\nWould you like to go back to finish them, or complete anyway?`,
          [
            {
              text: 'Go Back to Tasks',
              onPress: () => navigation.navigate('SiteVisitHub', { fieldMovementId }),
            },
            {
              text: 'Complete Anyway',
              style: 'destructive',
              onPress: executeStop,
            },
          ]
        );
        return;
      }
    } catch {
      // If error inspecting record, fall through to prompt
    }

    Alert.alert('Complete journey?', "You are completing this journey without return tracking. All data is saved.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        style: 'destructive',
        onPress: executeStop,
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Outbound Work Complete" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={40} color={colors.success} />
        </View>
        <Text style={styles.title}>Great work!</Text>
        <Text style={styles.subtitle}>What would you like to do next?</Text>

        <Card style={styles.optionCard} padded>
          <View style={styles.optionRow}>
            <Ionicons name="navigate-outline" size={22} color={colors.info} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.optionTitle}>Start Returning / Return Home</Text>
              <Text style={styles.optionSub}>
                Resume live GPS tracking for your journey back — no destination needed.
              </Text>
            </View>
          </View>
          <Button
            title="Start Returning"
            icon="arrow-back-circle"
            onPress={handleStartReturning}
            loading={startingReturn}
            disabled={completingNow}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Card style={styles.optionCard} padded>
          <View style={styles.optionRow}>
            <Ionicons name="flag-outline" size={22} color={colors.textSecondary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.optionTitle}>Complete Without Return Tracking</Text>
              <Text style={styles.optionSub}>Use this if you're not travelling directly back (e.g. staying on-site, moving to another job).</Text>
            </View>
          </View>
          <Button
            title="Complete Now"
            variant="outline"
            icon="checkmark"
            onPress={handleCompleteNow}
            loading={completingNow}
            disabled={startingReturn}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center' },
  iconWrap: { marginTop: spacing.lg, marginBottom: spacing.sm },
  title: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  optionCard: { width: '100%', marginBottom: spacing.md },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start' },
  optionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  optionSub: { fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 16 },
});
