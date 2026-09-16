import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as siteVisitsApi from '../api/siteVisits';
import { SiteVisitMaterial } from '../api/siteVisits';
import { getFieldMovement } from '../api/fieldMovements';
import { ApiError } from '../api/client';
import { generateOperationId } from '../tracking/mediaUploadQueue';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';

const UNIT_OPTIONS = ['Nos', 'Mtr', 'Kg', 'Sqft', 'Set', 'Box'];

export default function SiteVisitMaterialsScreen({ route, navigation }: any) {
  const paramVisitId = route.params?.siteVisitId as string | undefined;
  const paramFmId = route.params?.fieldMovementId as string | undefined;

  const [siteVisitId, setSiteVisitId] = useState<string | null>(paramVisitId || null);
  const [materials, setMaterials] = useState<SiteVisitMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Nos');
  const [remarks, setRemarks] = useState('');
  const operationIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedId = paramVisitId;
      if (!resolvedId && paramFmId) {
        try {
          const fm = await getFieldMovement(paramFmId);
          if (fm.site_visit_id) {
            resolvedId = fm.site_visit_id;
            setSiteVisitId(fm.site_visit_id);
          }
        } catch {}
      }
      if (!resolvedId) {
        setLoading(false);
        return;
      }
      const visit = await siteVisitsApi.getSiteVisit(resolvedId);
      setMaterials(visit.raw_material_details || []);
    } catch (e) {
      Alert.alert('Could not load materials', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [paramVisitId, paramFmId]);


  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleAdd() {
    if (!siteVisitId) return;
    const qty = parseFloat(quantity);
    if (!itemName.trim()) {
      Alert.alert('Material name required', 'Enter what material is needed.');
      return;
    }
    if (!qty || qty <= 0) {
      Alert.alert('Quantity required', 'Enter a quantity greater than zero.');
      return;
    }
    setSaving(true);
    if (!operationIdRef.current) {
      operationIdRef.current = generateOperationId();
    }
    try {
      const visit = await siteVisitsApi.addSiteVisitMaterial(siteVisitId, {
        item_name: itemName.trim(),
        quantity: qty,
        unit,
        remarks: remarks.trim() || undefined,
        client_operation_id: operationIdRef.current,
      });
      setMaterials(visit.raw_material_details || []);
      setItemName('');
      setQuantity('');
      setRemarks('');
      operationIdRef.current = null;
    } catch (e) {
      Alert.alert('Could not save material', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(materialId: string) {
    if (!siteVisitId) return;
    try {
      const visit = await siteVisitsApi.removeSiteVisitMaterial(siteVisitId, materialId);
      setMaterials(visit.raw_material_details || []);
    } catch (e) {
      Alert.alert('Could not remove material', e instanceof ApiError ? e.message : 'Please try again.');
    }
  }

  if (!siteVisitId) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Materials Required" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="cube-outline"
          title="No site visit selected"
          subtitle="Start a Site Visit against a lead first, then record required materials here."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Materials Required" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card padded>
          <Text style={styles.label}>Material</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mounting Rail, 5m"
            value={itemName}
            onChangeText={setItemName}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unit</Text>
              <View style={styles.unitRow}>
                {UNIT_OPTIONS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitChip, unit === u && styles.unitChipActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.label}>Remarks (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Any notes for the quotation/lead owner"
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />

          <Button title="Add Material" icon="add-circle-outline" onPress={handleAdd} loading={saving} style={{ marginTop: spacing.md }} />
        </Card>

        <Text style={styles.sectionTitle}>Recorded so far{materials.length ? ` (${materials.length})` : ''}</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : materials.length === 0 ? (
          <EmptyState icon="cube-outline" title="No materials added yet" subtitle="Anything you add here is saved immediately and visible to the office." />
        ) : (
          materials.map((m) => (
            <Card key={m.id} padded style={styles.materialCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.materialName}>{m.item_name}</Text>
                <Text style={styles.materialMeta}>
                  {m.quantity} {m.unit}
                </Text>
                {m.remarks ? <Text style={styles.materialRemarks}>{m.remarks}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleRemove(m.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', marginTop: 0 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginRight: 6,
    marginBottom: 6,
  },
  unitChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  unitChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  unitChipTextActive: { color: colors.primary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  materialCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  materialName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  materialMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  materialRemarks: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
});
