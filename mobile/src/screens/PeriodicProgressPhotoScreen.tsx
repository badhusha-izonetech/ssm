import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { trackingManager } from '../tracking/TrackingManager';
import * as fieldMovementsApi from '../api/fieldMovements';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime } from '../utils/format';
import { describeActionFailure } from '../utils/fieldErrorMessages';

const INTERVALS = [
  { id: '2h', label: '2-Hour Progress', icon: 'time-outline' as const },
  { id: '4h', label: '4-Hour Progress', icon: 'timer-outline' as const },
  { id: 'mid', label: 'Mid-Day Check', icon: 'sunny-outline' as const },
  { id: 'post', label: 'Afternoon Progress', icon: 'partly-sunny-outline' as const },
];

interface PeriodicPhotoItem {
  id: string;
  interval: string;
  uri: string;
  remarks?: string;
  takenAt: string;
}

export default function PeriodicProgressPhotoScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [selectedInterval, setSelectedInterval] = useState('4h');
  const [remarks, setRemarks] = useState('');
  const [stagedUri, setStagedUri] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PeriodicPhotoItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load existing work updates that have photos
    fieldMovementsApi.getFieldMovement(fieldMovementId)
      .then((fm) => {
        const items: PeriodicPhotoItem[] = [];
        (fm.work_updates || []).forEach((u) => {
          const photoUrl = (u as any).photo_url;
          if (photoUrl) {
            items.push({
              id: u.id,
              interval: u.remarks?.includes('4-Hour') ? '4h' : '2h',
              uri: photoUrl,
              remarks: u.remarks || '',
              takenAt: u.created_at,
            });
          }
        });
        setPhotos(items.reverse());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fieldMovementId]);

  async function handlePickImage(useCamera: boolean = true) {
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission Needed', 'Please allow camera access to take periodic progress photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (!result.canceled && result.assets?.[0]) {
        setStagedUri(result.assets[0].uri);
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Gallery Permission Needed', 'Please allow photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
      if (!result.canceled && result.assets?.[0]) {
        setStagedUri(result.assets[0].uri);
      }
    }
  }

  async function handleSaveProgress() {
    if (!stagedUri) {
      Alert.alert('Photo Required', 'Please take or select a progress photo before saving.');
      return;
    }

    setSaving(true);
    const intervalObj = INTERVALS.find((i) => i.id === selectedInterval);
    const intervalLabel = intervalObj?.label || 'Periodic Progress';

    try {
      const fix = await trackingManager.getCurrentFix().catch(() => null);
      const combinedRemarks = `[${intervalLabel}] ${remarks.trim()}`.trim();
      const fileName = `periodic-${selectedInterval}-${Date.now()}.jpg`;

      // Upload file directly
      const uploadedFile = await fieldMovementsApi.uploadFieldFile(
        fieldMovementId,
        stagedUri,
        fileName,
        'image/jpeg'
      );

      // Record work update with photo
      await fieldMovementsApi.addWorkUpdate(fieldMovementId, {
        stage: 'in_progress',
        remarks: combinedRemarks,
        latitude: fix?.latitude,
        longitude: fix?.longitude,
        accuracy: fix?.accuracy,
      });

      const newItem: PeriodicPhotoItem = {
        id: String(Date.now()),
        interval: selectedInterval,
        uri: uploadedFile.file_url || stagedUri,
        remarks: combinedRemarks,
        takenAt: new Date().toISOString(),
      };
      setPhotos((prev) => [newItem, ...prev]);
      setStagedUri(null);
      setRemarks('');
      Alert.alert('Success', `${intervalLabel} saved and synced to management immediately!`);
    } catch (err) {
      const msg = describeActionFailure(err).message;
      Alert.alert('Save Failed', msg);
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
    <View style={styles.screen}>
      <ScreenHeader
        title="Periodic Progress Photos"
        subtitle="2-Hr & 4-Hr interval photo verification"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.infoCard} padded>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color={colors.info} />
            <Text style={styles.infoTitle}>Installation Photo Requirement</Text>
          </View>
          <Text style={styles.infoBody}>
            Field Technicians must capture on-site verification photos every 2 to 4 hours during active project installation to log continuous work proof.
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Select Interval Check-In</Text>
        <View style={styles.intervalRow}>
          {INTERVALS.map((item) => {
            const active = selectedInterval === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedInterval(item.id)}
                style={[styles.intervalChip, active && styles.intervalChipActive]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? '#fff' : colors.textSecondary}
                />
                <Text style={[styles.intervalText, active && styles.intervalTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Card style={styles.captureCard} padded>
          <Text style={styles.inputLabel}>Progress Photo (Mandatory)</Text>
          {stagedUri ? (
            <View style={styles.stagedPreviewContainer}>
              <Image source={{ uri: stagedUri }} style={styles.stagedImage} />
              <View style={styles.retakeRow}>
                <TouchableOpacity style={styles.retakeButton} onPress={() => handlePickImage(true)}>
                  <Ionicons name="camera" size={16} color={colors.primary} />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.retakeButton} onPress={() => setStagedUri(null)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.retakeText, { color: colors.danger }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoPickerRow}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => handlePickImage(true)}>
                <Ionicons name="camera" size={24} color={colors.primary} />
                <Text style={styles.pickerBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => handlePickImage(false)}>
                <Ionicons name="images" size={24} color={colors.primary} />
                <Text style={styles.pickerBtnText}>From Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Work Remarks / Current Activity</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Structure erection 80% done, mounting rails aligned..."
            placeholderTextColor={colors.textMuted}
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />
          <Button
            title={saving ? 'Saving Progress...' : 'Save Progress Now'}
            icon="checkmark-circle"
            variant="primary"
            onPress={handleSaveProgress}
            loading={saving}
            disabled={!stagedUri || saving}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Text style={styles.sectionTitle}>Captured Periodic Photos ({photos.length})</Text>
        {photos.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="No interval photos yet"
            subtitle="Capture your 2-hr or 4-hr check-in photo above to log your installation progress."
          />
        ) : (
          photos.map((item) => (
            <Card key={item.id} style={styles.photoCard} padded>
              <View style={styles.photoRow}>
                <Image source={{ uri: item.uri }} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.badgeRow}>
                    <View style={styles.intervalBadge}>
                      <Text style={styles.intervalBadgeText}>
                        {INTERVALS.find((i) => i.id === item.interval)?.label || item.interval}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  </View>
                  {item.remarks ? (
                    <Text style={styles.photoRemarks} numberOfLines={2}>
                      {item.remarks}
                    </Text>
                  ) : null}
                  <Text style={styles.photoDate}>{formatDateTime(item.takenAt)}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 40 },
  infoCard: { marginBottom: spacing.lg, backgroundColor: colors.infoSoft, borderColor: colors.info },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: colors.info },
  infoBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  intervalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.border,
  },
  intervalChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  intervalText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  intervalTextActive: { color: '#fff' },
  captureCard: { marginBottom: spacing.lg },
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  photoCard: { marginBottom: spacing.sm },
  photoRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 70, height: 70, borderRadius: radius.md, backgroundColor: colors.border },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  intervalBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  intervalBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  photoRemarks: { fontSize: 12, color: colors.textPrimary, marginBottom: 4 },
  photoDate: { fontSize: 11, color: colors.textMuted },
  stagedPreviewContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stagedImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  retakeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: '#F1F5F9',
  },
  retakeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.sm,
  },
  pickerBtn: {
    flex: 1,
    height: 70,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  pickerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
