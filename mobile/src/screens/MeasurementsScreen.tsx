import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadMeasurement, listMeasurements, getFieldMovement } from '../api/fieldMovements';
import * as siteVisitsApi from '../api/siteVisits';
import { enqueueMediaUpload, removeFromQueue } from '../tracking/mediaUploadQueue';
import { MeasurementCategory, MeasurementPhoto } from '../siteVisit/types';
import { updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import StatusPill from '../components/StatusPill';
import { colors, radius, spacing } from '../theme/theme';

const CATEGORIES: { key: MeasurementCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'Length', icon: 'resize-outline' },
  { key: 'Width', icon: 'swap-horizontal-outline' },
  { key: 'Height', icon: 'swap-vertical-outline' },
  { key: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const ROOF_GROUND_TYPES = [
  'RCC Flat Roof',
  'Tiled Roof (Sloped)',
  'Metal Sheet Roof',
  'Asbestos Sheet Roof',
  'Ground Mount Open Land',
  'Terrace Elevated Structure',
];

export default function MeasurementsScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [siteVisitId, setSiteVisitId] = useState<string | null>(null);
  const [category, setCategory] = useState<MeasurementCategory>('Length');
  const [photos, setPhotos] = useState<MeasurementPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  // Structured measurement fields
  const [lengthVal, setLengthVal] = useState('');
  const [widthVal, setWidthVal] = useState('');
  const [heightVal, setHeightVal] = useState('');
  const [installationArea, setInstallationArea] = useState('');
  const [roofGroundDetails, setRoofGroundDetails] = useState(ROOF_GROUND_TYPES[0]);
  const [cableAccessories, setCableAccessories] = useState('');

  useEffect(() => {
    Promise.all([
      listMeasurements(fieldMovementId).catch(() => []),
      getFieldMovement(fieldMovementId).catch(() => null),
    ]).then(async ([rows, fm]: [any[], any]) => {
      setPhotos(
        (rows || []).map((r) => ({
          id: r.id,
          uri: r.file_url,
          category: r.category as MeasurementCategory,
          takenAt: r.taken_at,
          uploaded: true,
        }))
      );

      if (fm?.site_visit_id) {
        setSiteVisitId(fm.site_visit_id);
        try {
          const sv: any = await siteVisitsApi.getSiteVisit(fm.site_visit_id);
          if (sv.installation_area) setInstallationArea(sv.installation_area);
          if (sv.roof_ground_details) setRoofGroundDetails(sv.roof_ground_details);
          if (sv.cable_accessories) setCableAccessories(sv.cable_accessories);
          if (sv.measurements) {
            // Parse formatted measurements like "L: 30ft, W: 20ft, H: 10ft"
            const lMatch = sv.measurements.match(/L:\s*([^,]+)/);
            const wMatch = sv.measurements.match(/W:\s*([^,]+)/);
            const hMatch = sv.measurements.match(/H:\s*([^,]+)/);
            if (lMatch) setLengthVal(lMatch[1].trim());
            if (wMatch) setWidthVal(wMatch[1].trim());
            if (hMatch) setHeightVal(hMatch[1].trim());
            if (!lMatch && !wMatch && !hMatch) setLengthVal(sv.measurements);
          }
        } catch {}
      }
      setLoading(false);
    });
  }, [fieldMovementId]);

  // Auto-calculate area if length and width are numbers
  function handleDimensionChange(l: string, w: string) {
    setLengthVal(l);
    setWidthVal(w);
    const numL = parseFloat(l);
    const numW = parseFloat(w);
    if (!isNaN(numL) && !isNaN(numW) && numL > 0 && numW > 0) {
      setInstallationArea((numL * numW).toFixed(1) + ' Sq.Ft');
    }
  }

  async function handleSaveDetails() {
    setSavingDetails(true);
    const combinedMeasurements = [
      lengthVal ? `L: ${lengthVal}` : '',
      widthVal ? `W: ${widthVal}` : '',
      heightVal ? `H: ${heightVal}` : '',
    ].filter(Boolean).join(', ') || lengthVal;

    try {
      if (siteVisitId) {
        await siteVisitsApi.updateSiteVisitDetails(siteVisitId, {
          measurements: combinedMeasurements || undefined,
          installation_area: installationArea.trim() || undefined,
          roof_ground_details: roofGroundDetails || undefined,
          cable_accessories: cableAccessories.trim() || undefined,
        });
      }

      // Mark locally as recorded
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        measurements: photos.length > 0 ? r.measurements : [{ id: 'details-saved', uri: '', takenAt: new Date().toISOString(), uploaded: true, category: 'Length' }],
      }));

      Alert.alert('Saved', 'Measurements and site details successfully saved to project!');
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save measurements. Check network.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleAddPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Please allow camera access to capture measurement photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;

    setCapturing(true);
    const uri = result.assets[0].uri;
    const fileName = `measurement-${category.toLowerCase()}-${Date.now()}.jpg`;
    try {
      const operationId = await enqueueMediaUpload({
        fieldMovementId,
        endpoint: 'measurements',
        fileUri: uri,
        fileName,
        mimeType: 'image/jpeg',
        extraFields: { category },
      });

      const pendingEntry: MeasurementPhoto = {
        id: operationId,
        uri,
        category,
        takenAt: new Date().toISOString(),
        uploaded: false,
      };
      setPhotos((prev) => [...prev, pendingEntry]);

      try {
        const saved = await uploadMeasurement(fieldMovementId, uri, fileName, category, operationId);
        await removeFromQueue(operationId);
        setPhotos((prev) =>
          prev.map((p) => (p.id === operationId ? { id: saved.id, uri: saved.file_url, category, takenAt: saved.taken_at, uploaded: true } : p))
        );
      } catch {
        Alert.alert('Saved for retry', 'This photo is saved on your device and will upload automatically once you have a connection.');
      }
    } catch {
      Alert.alert('Capture failed', 'The measurement photo could not be saved. Please try again.');
    } finally {
      setCapturing(false);
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
        title="Measurements & Site Details"
        onBack={() => navigation.goBack()}
        subtitle="Site dimensions, roof type & evidence"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Numeric & Structured Input Card ── */}
        <Card style={styles.card} padded>
          <View style={styles.cardHeader}>
            <Ionicons name="calculator-outline" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Site Dimensions</Text>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.inputCol}>
              <Text style={styles.label}>Length (ft/m)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 35"
                placeholderTextColor={colors.textMuted}
                value={lengthVal}
                onChangeText={(v) => handleDimensionChange(v, widthVal)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={styles.label}>Width (ft/m)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 20"
                placeholderTextColor={colors.textMuted}
                value={widthVal}
                onChangeText={(v) => handleDimensionChange(lengthVal, v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={styles.label}>Height (ft/m)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10"
                placeholderTextColor={colors.textMuted}
                value={heightVal}
                onChangeText={setHeightVal}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Total Installation Area</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 700 Sq.Ft / 65 Sq.M"
            placeholderTextColor={colors.textMuted}
            value={installationArea}
            onChangeText={setInstallationArea}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Roof / Ground Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roofScroll}>
            {ROOF_GROUND_TYPES.map((type) => {
              const active = roofGroundDetails === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setRoofGroundDetails(type)}
                  style={[styles.roofChip, active && styles.roofChipActive]}
                >
                  <Text style={[styles.roofChipText, active && styles.roofChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Cable & Accessories Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 50 }]}
            placeholder="e.g. 25m DC cable, 40A MCB, 2 earth pits required..."
            placeholderTextColor={colors.textMuted}
            value={cableAccessories}
            onChangeText={setCableAccessories}
            multiline
          />

          <Button
            title={savingDetails ? 'Saving Details...' : 'Save Site Dimensions'}
            icon="save-outline"
            variant="success"
            onPress={handleSaveDetails}
            loading={savingDetails}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        {/* ── Photo Evidence Section ── */}
        <Text style={styles.sectionTitle}>Measurement Photo Proof</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.categoryTile, active && styles.categoryTileActive]}
                onPress={() => setCategory(c.key)}
              >
                <Ionicons name={c.icon} size={20} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.categoryLabel, active && { color: colors.primary }]}>{c.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title={capturing ? 'Uploading…' : `Capture ${category} Photo Proof`}
          icon="camera"
          onPress={handleAddPhoto}
          loading={capturing}
          style={{ marginTop: spacing.md }}
        />

        <Text style={styles.sectionTitle}>Captured Evidence ({photos.length})</Text>
        {photos.length === 0 ? (
          <EmptyState icon="resize-outline" title="No measurement photos yet" />
        ) : (
          <View style={styles.photosGrid}>
            {photos.map((item) => (
              <Card key={item.id} padded={false} style={styles.thumbCard}>
                <Image source={{ uri: item.uri }} style={styles.thumbImg} />
                <View style={styles.thumbTag}>
                  <StatusPill label={item.category} tone="info" />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryTile: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  categoryTileActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  thumbCard: { width: '31%', aspectRatio: 1, overflow: 'hidden', borderRadius: radius.md },
  thumbImg: { width: '100%', height: '100%' },
  thumbTag: { position: 'absolute', bottom: 4, left: 4 },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowInputs: { flexDirection: 'row', gap: spacing.sm },
  inputCol: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  roofScroll: { flexDirection: 'row', marginTop: 4 },
  roofChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  roofChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roofChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  roofChipTextActive: { color: '#fff', fontWeight: '700' },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.xl },
});

