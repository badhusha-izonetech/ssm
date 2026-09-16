import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { uploadFieldFile, submitEquipment } from '../api/fieldMovements';
import { loadSiteVisitRecord, updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { EquipmentItem, EquipmentRecord, SiteVisitRecord } from '../siteVisit/types';
import ScreenHeader from '../components/ScreenHeader';
import EquipmentCaptureForm from '../components/EquipmentCaptureForm';
import Card from '../components/Card';
import { colors, spacing } from '../theme/theme';

type Stage = 'before' | 'after';

export default function EquipmentStageScreen({ route, navigation }: any) {
  const { fieldMovementId, stage } = route.params as { fieldMovementId: string; stage: Stage };
  const [siteRecord, setSiteRecord] = useState<SiteVisitRecord | null>(null);

  useEffect(() => {
    loadSiteVisitRecord(fieldMovementId).then(setSiteRecord);
  }, [fieldMovementId]);

  async function persist(next: EquipmentRecord) {
    const updated = await updateSiteVisitRecord(fieldMovementId, (r) => ({ ...r, equipment: { ...r.equipment, [stage]: next } }));
    setSiteRecord(updated);
  }

  if (!siteRecord) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const current = siteRecord.equipment[stage];
  const expected = siteRecord.equipment.before.items;
  const returned = siteRecord.equipment.after.items;
  const missing = stage === 'after' ? expected.filter((e) => !returned.some((r) => r.name.toLowerCase() === e.name.toLowerCase())) : [];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={stage === 'before' ? 'Equipment — Before Work' : 'Equipment — After Work'}
        onBack={() => navigation.goBack()}
        subtitle={stage === 'before' ? 'What you took, as confirmed at the depot' : "Confirm what's being returned"}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {stage === 'after' && expected.length > 0 && (
          <Card style={styles.compareCard} padded>
            <Text style={styles.compareTitle}>Expected → Returned</Text>
            {expected.map((item) => {
              const isReturned = returned.some((r) => r.name.toLowerCase() === item.name.toLowerCase());
              return (
                <Text key={item.id} style={styles.compareRow}>
                  {item.name} ({item.quantity}) — {isReturned ? 'Returned ✓' : 'Not yet returned'}
                </Text>
              );
            })}
            {missing.length > 0 && <Text style={styles.missingText}>{missing.length} item(s) not yet accounted for.</Text>}
          </Card>
        )}

        <EquipmentCaptureForm
          record={current}
          photoLabel={stage === 'before' ? 'Equipment photo' : 'Returned equipment photo'}
          remarksLabel={stage === 'before' ? 'Remarks' : 'Missing / damaged remarks'}
          remarksPlaceholder={stage === 'before' ? 'Any remarks about the equipment issued…' : 'Note any missing or damaged items…'}
          confirmLabel={stage === 'before' ? 'Confirm' : 'Confirm Return'}
          onCapturePhoto={async (uri) => {
            const fileName = `equipment-${stage}-${Date.now()}.jpg`;
            const photo = await uploadFieldFile(fieldMovementId, uri, fileName, 'image/jpeg');
            await persist({ ...current, photo: { id: photo.id, uri: photo.file_url, takenAt: photo.uploaded_at, uploaded: true } });
          }}
          onAddItem={async (item: EquipmentItem) => persist({ ...current, items: [...current.items, item] })}
          onRemoveItem={async (id) => persist({ ...current, items: current.items.filter((i) => i.id !== id) })}
          onRemarksChange={(remarks) => persist({ ...current, remarks })}
          onConfirm={async () => {
            const confirmedAt = new Date().toISOString();
            await submitEquipment(fieldMovementId, {
              stage,
              photo_url: current.photo?.uri || null,
              items: current.items.map((i) => ({ name: i.name, quantity: i.quantity, condition: i.condition })),
              remarks: current.remarks || null,
              confirmed_at: confirmedAt,
            });
            await persist({ ...current, confirmedAt });
            navigation.goBack();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 40 },
  compareCard: { marginBottom: spacing.md },
  compareTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
  compareRow: { fontSize: 13, color: colors.textPrimary, marginTop: 4 },
  missingText: { fontSize: 12, color: colors.warning, fontWeight: '600', marginTop: spacing.sm },
});
