import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as siteVisitsApi from '../api/siteVisits';
import { StockItemRead } from '../api/siteVisits';
import { getFieldMovement } from '../api/fieldMovements';
import { loadSiteVisitRecord, updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { colors, radius, spacing } from '../theme/theme';

const FEASIBILITY_OPTIONS = [
  'Feasible',
  'Feasible with Conditions',
  'Revisit Required',
  'Not Feasible',
  'Customer Requirement Not Supported',
];

interface SelectedProduct {
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  remarks?: string;
  available_quantity?: number;
}

export default function SiteVisitFormScreen({ route, navigation }: any) {
  const paramVisitId = route.params?.siteVisitId as string | undefined;
  const paramFmId = route.params?.fieldMovementId as string | undefined;

  const [siteVisitId, setSiteVisitId] = useState<string | null>(paramVisitId || null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [installationArea, setInstallationArea] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [feasibilityResult, setFeasibilityResult] = useState('Feasible');
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [stockStatus, setStockStatus] = useState<string | null>(null);

  // Stock Selection Modal State (Amazon-style multi-select)
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [stockCatalog, setStockCatalog] = useState<StockItemRead[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [selectedStockMap, setSelectedStockMap] = useState<Record<string, { item: StockItemRead; qty: number }>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        if (paramFmId) {
          const rec = await loadSiteVisitRecord(paramFmId);
          if (rec?.siteVisitFormData && !cancelled) {
            setInstallationArea(rec.siteVisitFormData.installationArea || '');
            setMeasurements(rec.siteVisitFormData.measurements || '');
            setAdditionalNotes(rec.siteVisitFormData.notes || '');
            setFeasibilityResult(rec.siteVisitFormData.feasibilityResult || 'Feasible');
            if (rec.siteVisitFormData.products?.length) {
              setProducts(rec.siteVisitFormData.products);
            }
          }
        }
        if (resolvedId) {
          try {
            const visit = await siteVisitsApi.getSiteVisit(resolvedId);
            if (!cancelled) {
              if (visit.installation_area) setInstallationArea(visit.installation_area);
              if (visit.measurements) setMeasurements(visit.measurements);
              if (visit.notes) setAdditionalNotes(visit.notes);
              if (visit.feasibility_result) setFeasibilityResult(visit.feasibility_result);
              if (visit.stock_availability_status) setStockStatus(visit.stock_availability_status);
              if (visit.raw_material_details?.length) {
                setProducts(
                  visit.raw_material_details.map((m) => ({
                    item_id: m.item_id || null,
                    item_name: m.item_name,
                    quantity: m.quantity,
                    unit: m.unit || 'Nos',
                    remarks: m.remarks || '',
                  }))
                );
              }
            }
          } catch {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paramVisitId, paramFmId]);

  async function openStockModal() {
    setStockModalVisible(true);
    setLoadingStock(true);
    setSelectedStockMap({});
    try {
      const items = await siteVisitsApi.listStockItems();
      setStockCatalog(items);
    } catch {
      Alert.alert('Error', 'Failed to load stock items from warehouse.');
    } finally {
      setLoadingStock(false);
    }
  }

  function toggleStockSelection(item: StockItemRead) {
    setSelectedStockMap((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { item, qty: 1 };
      }
      return next;
    });
  }

  function adjustModalQty(itemId: string, delta: number) {
    setSelectedStockMap((prev) => {
      if (!prev[itemId]) return prev;
      const current = prev[itemId].qty;
      const nextQty = Math.max(1, current + delta);
      return { ...prev, [itemId]: { ...prev[itemId], qty: nextQty } };
    });
  }

  function handleAddAllSelected() {
    const selectedList = Object.values(selectedStockMap);
    if (selectedList.length === 0) {
      setStockModalVisible(false);
      return;
    }

    setProducts((prev) => {
      const next = [...prev];
      for (const entry of selectedList) {
        const existingIdx = next.findIndex((p) => p.item_id === entry.item.id);
        if (existingIdx >= 0) {
          next[existingIdx].quantity += entry.qty;
        } else {
          next.push({
            item_id: entry.item.id,
            item_name: entry.item.product_name,
            quantity: entry.qty,
            unit: entry.item.unit || 'Nos',
            available_quantity: entry.item.available_quantity,
          });
        }
      }
      return next;
    });

    setStockModalVisible(false);
  }

  function updateProductQty(index: number, delta: number) {
    setProducts((prev) => {
      const next = [...prev];
      const newQty = Math.max(1, next[index].quantity + delta);
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!siteVisitId && !paramFmId) {
      Alert.alert('Missing Context', 'No active site visit found to link this form.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: siteVisitsApi.SiteVisitFormPayload = {
        installation_area: installationArea.trim() || undefined,
        measurements: measurements.trim() || undefined,
        additional_notes: additionalNotes.trim() || undefined,
        feasibility_result: feasibilityResult,
        products: products.map((p) => ({
          item_id: p.item_id,
          item_name: p.item_name,
          quantity: p.quantity,
          unit: p.unit,
          remarks: p.remarks,
        })),
      };

      if (siteVisitId) {
        await siteVisitsApi.submitSiteVisitForm(siteVisitId, payload);
      }

      if (paramFmId) {
        await updateSiteVisitRecord(paramFmId, (r) => ({
          ...r,
          siteVisitFormCompleted: true,
          siteVisitFormData: {
            installationArea,
            measurements,
            notes: additionalNotes,
            feasibilityResult,
            products,
          },
        }));
      }

      Alert.alert('Form Submitted', 'Site visit form details and stock requirements saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Submission Error', err?.message || 'Failed to submit form. Saved locally for retry.');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredStock = stockCatalog.filter(
    (item) =>
      !stockSearch.trim() ||
      item.product_name.toLowerCase().includes(stockSearch.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(stockSearch.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(stockSearch.toLowerCase()))
  );

  const selectedCount = Object.keys(selectedStockMap).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Site Visit Form" onBack={() => navigation.goBack()} subtitle="Installation, Measurements & Products" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {stockStatus ? (
          <View style={styles.stockStatusBanner}>
            <Ionicons name="cube" size={16} color={colors.info} />
            <Text style={styles.stockStatusText}>Stock Status: {stockStatus}</Text>
          </View>
        ) : null}

        {/* ── 1. Installation Area ── */}
        <Card padded style={styles.card}>
          <Text style={styles.sectionTitle}>1. Installation Area</Text>
          <Text style={styles.hint}>Specify roof, ground, corridor, or specific location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rooftop 1500 sqft / South-facing concrete slab"
            placeholderTextColor={colors.textMuted}
            value={installationArea}
            onChangeText={setInstallationArea}
          />
        </Card>

        {/* ── 2. Measurements ── */}
        <Card padded style={styles.card}>
          <Text style={styles.sectionTitle}>2. Measurements</Text>
          <Text style={styles.hint}>Length, width, height, shadow-free area</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Length: 50ft, Width: 30ft, Cable path: 25m"
            placeholderTextColor={colors.textMuted}
            value={measurements}
            onChangeText={setMeasurements}
          />
        </Card>

        {/* ── 3. Additional Notes ── */}
        <Card padded style={styles.card}>
          <Text style={styles.sectionTitle}>3. Additional Notes</Text>
          <Text style={styles.hint}>Client preferences, grid connection, earthing details</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Enter any additional site observations or client notes..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
          />
        </Card>

        {/* ── 4. Product Requirements for Quotation (From Warehouse Stock) ── */}
        <Card padded style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>4. Project Products / Materials</Text>
              <Text style={styles.hint}>Select solar panels, inverters & installation raw materials</Text>
            </View>
            <TouchableOpacity style={styles.addProductBtn} onPress={openStockModal} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addProductText}>Add Product</Text>
            </TouchableOpacity>
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Ionicons name="cart-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyProductsText}>No products added yet. Click "Add Product" to select from warehouse stock.</Text>
            </View>
          ) : (
            <View style={styles.productList}>
              {products.map((item, idx) => (
                <View key={idx} style={styles.productRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>{item.item_name}</Text>
                    <Text style={styles.prodSub}>
                      Unit: {item.unit}
                      {item.available_quantity != null ? ` · Avail: ${item.available_quantity}` : ''}
                    </Text>
                  </View>

                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateProductQty(idx, -1)}>
                      <Ionicons name="remove" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyVal}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateProductQty(idx, 1)}>
                      <Ionicons name="add" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(idx)}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── 5. Feasibility Result Dropdown ── */}
        <Card padded style={styles.card}>
          <Text style={styles.sectionTitle}>5. Feasibility Result</Text>
          <Text style={styles.hint}>Site engineer verification & technical approval</Text>
          <View style={styles.feasibilityContainer}>
            {FEASIBILITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.feasibilityOption, feasibilityResult === opt && styles.feasibilitySelected]}
                onPress={() => setFeasibilityResult(opt)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={feasibilityResult === opt ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={feasibilityResult === opt ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.feasibilityText, feasibilityResult === opt && styles.feasibilityTextSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Button
          title="Submit Site Visit Form"
          variant="primary"
          icon="checkmark-circle-outline"
          onPress={handleSubmit}
          loading={submitting}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
      </ScrollView>

      {/* ── Amazon-style Multi-Select Stock Modal ── */}
      <Modal visible={stockModalVisible} animationType="slide" transparent onRequestClose={() => setStockModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Warehouse Stock Products</Text>
                <Text style={styles.modalSubtitle}>Select multiple products & set quantities</Text>
              </View>
              <TouchableOpacity onPress={() => setStockModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search panels, inverters, cables, rails..."
                placeholderTextColor={colors.textMuted}
                value={stockSearch}
                onChangeText={setStockSearch}
              />
            </View>

            {loadingStock ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : filteredStock.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.hint}>No matching stock items found in warehouse catalog.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStock}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: spacing.lg }}
                renderItem={({ item }) => {
                  const isSelected = !!selectedStockMap[item.id];
                  const currentQty = selectedStockMap[item.id]?.qty || 1;
                  return (
                    <TouchableOpacity
                      style={[styles.stockItemCard, isSelected && styles.stockItemSelected]}
                      onPress={() => toggleStockSelection(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={styles.stockItemName}>{item.product_name}</Text>
                        <Text style={styles.stockItemMeta}>
                          {item.brand ? `${item.brand} · ` : ''}
                          Avail: {item.available_quantity} {item.unit}
                        </Text>
                      </View>

                      {isSelected && (
                        <View style={styles.modalQtyControls} onStartShouldSetResponder={() => true}>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustModalQty(item.id, -1)}>
                            <Ionicons name="remove" size={12} color={colors.primary} />
                          </TouchableOpacity>
                          <Text style={styles.qtyVal}>{currentQty}</Text>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustModalQty(item.id, 1)}>
                            <Ionicons name="add" size={12} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <View style={styles.modalFooter}>
              <Button
                title={selectedCount > 0 ? `Add All Selected Products (${selectedCount})` : 'Close'}
                variant={selectedCount > 0 ? 'primary' : 'outline'}
                onPress={handleAddAllSelected}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.lg },
  card: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  addProductText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  emptyProducts: { alignItems: 'center', paddingVertical: spacing.lg },
  emptyProductsText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  productList: { marginTop: spacing.xs },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prodName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  prodSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.sm },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyVal: { fontSize: 13, fontWeight: '700', marginHorizontal: 8, minWidth: 20, textAlign: 'center', color: colors.textPrimary },
  removeBtn: { padding: spacing.xs },
  feasibilityContainer: { marginTop: spacing.xs },
  feasibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  feasibilitySelected: { backgroundColor: colors.primarySoft },
  feasibilityText: { fontSize: 13, color: colors.textSecondary, marginLeft: spacing.sm },
  feasibilityTextSelected: { fontWeight: '700', color: colors.primary },
  stockStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  stockStatusText: { color: colors.info, fontSize: 13, fontWeight: '700', marginLeft: spacing.sm },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, marginLeft: spacing.xs },
  stockItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  stockItemSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  stockItemName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  stockItemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  modalQtyControls: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm },
  modalFooter: { paddingTop: spacing.md },
});
