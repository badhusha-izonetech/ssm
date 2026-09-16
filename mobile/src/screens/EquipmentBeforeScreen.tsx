import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import {
  loadPendingEquipmentBefore,
  savePendingEquipmentBefore,
} from '../siteVisit/localSiteVisitStore';
import { EquipmentItem, EquipmentRecord } from '../siteVisit/types';
import ScreenHeader from '../components/ScreenHeader';
import EquipmentCaptureForm from '../components/EquipmentCaptureForm';
import { colors } from '../theme/theme';

export default function EquipmentBeforeScreen({ navigation, route }: any) {
  const projectId: string | undefined = route?.params?.projectId;
  const [record, setRecord] = useState<EquipmentRecord | null>(null);

  useEffect(() => {
    loadPendingEquipmentBefore().then(setRecord);
  }, []);

  async function persist(next: EquipmentRecord) {
    setRecord(next);
    await savePendingEquipmentBefore(next);
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Equipment — Before Work"
        onBack={() => navigation.goBack()}
        subtitle="Confirm tools/material you're taking, before you leave"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <EquipmentCaptureForm
          record={record}
          photoLabel="Equipment photo"
          remarksLabel="Remarks"
          remarksPlaceholder="Any remarks about the equipment issued…"
          confirmLabel="Confirm & Continue to Start Tracking"
          onCapturePhoto={async (uri) => {
            // No field movement id exists yet at this point in the
            // technician flow, so the photo can't be uploaded to the
            // backend until Start Tracking creates one — it's attached
            // locally here and uploaded then (see StartTrackingScreen).
            await persist({ ...record, photo: { id: `${Date.now()}`, uri, takenAt: new Date().toISOString(), uploaded: false } });
          }}
          onAddItem={async (item: EquipmentItem) => persist({ ...record, items: [...record.items, item] })}
          onRemoveItem={async (id) => persist({ ...record, items: record.items.filter((i) => i.id !== id) })}
          onRemarksChange={(remarks) => persist({ ...record, remarks })}
          onConfirm={async () => {
            const confirmed = { ...record, confirmedAt: new Date().toISOString() };
            await persist(confirmed);
            navigation.navigate('StartTracking', projectId ? { projectId } : undefined);
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
});
