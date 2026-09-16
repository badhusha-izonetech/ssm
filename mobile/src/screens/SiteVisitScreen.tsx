import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, TouchableOpacity, Linking, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as fieldMovementsApi from '../api/fieldMovements';
import * as siteVisitsApi from '../api/siteVisits';
import * as leadsApi from '../api/leads';
import { SiteVisitRead } from '../api/siteVisits';
import { FieldMovementRead } from '../types';
import { ApiError } from '../api/client';
import { loadSiteVisitRecord, completionSummary, updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { SiteVisitRecord } from '../siteVisit/types';
import { SiteVisitModuleKey, getModulesForWorkType } from '../roles/roleConfig';
import { useRole } from '../roles/useRole';
import { useGeofenceMonitor } from '../tracking/useGeofenceMonitor';
import ScreenHeader from '../components/ScreenHeader';
import BottomNav from '../components/BottomNav';
import Card from '../components/Card';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { describeActionFailure } from '../utils/fieldErrorMessages';

const ACTIVE_STATUSES = ['Checked In', 'On Field', 'Returning'];

const MODULE_INFO: Record<
  SiteVisitModuleKey,
  { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; route?: string; params?: object }
> = {
  selfie: { title: 'Arrival Proof Selfie', subtitle: 'Front camera — confirm you reached the destination', icon: 'person-circle-outline', route: 'SiteSelfieProof' },
  generalPhotos: { title: 'Site / Field Photos', subtitle: 'Photos of the location and surroundings', icon: 'camera-outline', route: 'SitePhotos', params: { photoType: 'general' } },
  installationPhotos: { title: 'Installation Area Photos', subtitle: 'Mounting / electrical / installation location', icon: 'flash-outline', route: 'SitePhotos', params: { photoType: 'installation' } },
  periodicPhotos: { title: 'Periodic Progress Photos (2h / 4h)', subtitle: '2-hr & 4-hr on-site progress photos', icon: 'time-outline', route: 'PeriodicProgressPhoto' },
  video: { title: 'Site View Video', subtitle: 'Panoramic site & field video recording', icon: 'videocam-outline', route: 'SiteViewVideo' },
  siteVisitForm: { title: 'Site Visit Form', subtitle: 'Area, measurements, notes & stock requirements', icon: 'clipboard-outline', route: 'SiteVisitForm' },
  measurements: { title: 'Measurements', subtitle: 'Length / Width / Height / Installation Area', icon: 'resize-outline', route: 'Measurements' },
  materials: { title: 'Site Materials & Requirements', subtitle: 'Required raw materials, quantities & items', icon: 'cube-outline', route: 'SiteVisitMaterials' },
  documents: { title: 'Documents', subtitle: 'Upload related documents', icon: 'document-text-outline', route: 'Documents' },
  notes: { title: 'Site Notes', subtitle: 'Add field observations & notes', icon: 'create-outline', route: 'SiteNotes' },
  equipmentBefore: { title: 'Equipment — Before Work', subtitle: 'Tool/material custody check', icon: 'construct-outline', route: 'EquipmentStage', params: { stage: 'before' } },
  siteEvidenceReview: { title: 'Review Site Evidence (Optional)', subtitle: 'See photos/video/measurements/documents/notes', icon: 'albums-outline', route: 'SiteEvidenceReview' },
  workProgress: { title: 'Start / Track Work', subtitle: 'Move through Ready → In Progress → Completed', icon: 'hammer-outline', route: 'WorkProgress' },
  equipmentAfter: { title: 'Equipment — After Work', subtitle: 'Returned tools/material check', icon: 'return-down-back-outline', route: 'EquipmentStage', params: { stage: 'after' } },
};

function getRequiredModulesForRole(
  roleKey: string,
  workType?: string | null,
  activeModules: SiteVisitModuleKey[] = []
): SiteVisitModuleKey[] {
  const normWorkType = (workType || '').toUpperCase().trim();
  const isDirectMarket = normWorkType === 'DIRECT MARKET' || normWorkType === 'DIRECT_MARKETING' || roleKey === 'direct_marketing';

  if (isDirectMarket) {
    // Direct marketing: selfie, field photos, video, and notes are required!
    return (['selfie', 'generalPhotos', 'video', 'notes'] as SiteVisitModuleKey[]).filter((k) => activeModules.includes(k));
  }
  if (normWorkType === 'SITE VISIT' || normWorkType === 'SITE_VISIT' || roleKey === 'site_visit') {
    // Site Engineer / Site Visit: selfie, general photos, video, siteVisitForm, notes
    return (['selfie', 'generalPhotos', 'video', 'siteVisitForm', 'notes'] as SiteVisitModuleKey[]).filter(
      (k) => activeModules.includes(k)
    );
  }
  if (roleKey === 'field_technician') {
    // Field technician: equipment before, selfie, installation photos, periodic photos, equipment after
    return (['equipmentBefore', 'selfie', 'installationPhotos', 'periodicPhotos', 'equipmentAfter'] as SiteVisitModuleKey[]).filter(
      (k) => activeModules.includes(k)
    );
  }
  return activeModules.filter((m) => m !== 'siteEvidenceReview');
}

/** Customer/Lead details fetched from the real backend SiteVisit or Lead. */
interface CustomerInfo {
  name: string;
  mobile: string;
  address: string;
  area: string;
  siteType: string;
  visitStatus: string;
  product?: string;
  requirement?: string;
  workType?: string;
}

export default function SiteVisitScreen({ route, navigation }: any) {
  const paramFmId = route.params?.fieldMovementId as string | undefined;
  const role = useRole();

  const [fmId, setFmId] = useState<string | null>(paramFmId ?? null);
  const [currentFm, setCurrentFm] = useState<FieldMovementRead | null>(null);
  const [record, setRecord] = useState<SiteVisitRecord | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [backendStatus, setBackendStatus] = useState<{
    hasNotes?: boolean;
    workStage?: string | null;
    materialsCount?: number;
    hasPeriodicPhotos?: boolean;
    hasVideo?: boolean;
    hasPhotos?: boolean;
  }>({});
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [incompleteRequiredTasks, setIncompleteRequiredTasks] = useState<SiteVisitModuleKey[]>([]);

  const destLat = currentFm?.destination_latitude ?? record?.destinationCoords?.latitude;
  const destLng = currentFm?.destination_longitude ?? record?.destinationCoords?.longitude;
  const geofenceRadius = currentFm?.geofence_radius_meters ?? record?.geofenceRadiusMeters ?? 60;
  const { isBreached, currentDistance } = useGeofenceMonitor({
    fieldMovementId: fmId,
    destinationCoords: destLat && destLng ? { latitude: destLat, longitude: destLng } : null,
    geofenceRadiusMeters: geofenceRadius,
    destinationAddress: currentFm?.destination,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let id = paramFmId;
      if (!id) {
        const res = await fieldMovementsApi.listMine(1, 30);
        const active = res.items.find((f) => ACTIVE_STATUSES.includes(f.status));
        id = active?.id;
      }
      if (!id) {
        setFmId(null);
        setRecord(null);
        setCustomerInfo(null);
        return;
      }
      setFmId(id);
      const rec = await loadSiteVisitRecord(id);
      setRecord(rec);

      try {
        const fm = await fieldMovementsApi.getFieldMovement(id);
        setCurrentFm(fm);
        let materialsCount = 0;
        const hasPeriodicPhotos = Array.isArray(fm.work_updates) && fm.work_updates.length > 0;
        const hasVideo =
          (Array.isArray(fm.videos) && fm.videos.length > 0) ||
          (Array.isArray(fm.photos) && fm.photos.some((p: any) => p.media_type === 'video' || p.mediaType === 'video'));
        const hasPhotos = Array.isArray(fm.photos) && fm.photos.length > 0;

        let resolvedCustomer: CustomerInfo = {
          name: '',
          mobile: '',
          address: '',
          area: '',
          siteType: fm.work_type === 'DIRECT MARKET' ? 'Direct Market' : 'Site Visit',
          visitStatus: '',
          workType: fm.work_type || (role.key === 'direct_marketing' ? 'DIRECT MARKET' : 'SITE VISIT'),
        };

        // Fetch customer/lead details and materials from the linked SiteVisit
        if (fm.site_visit_id) {
          try {
            const sv = await siteVisitsApi.getSiteVisit(fm.site_visit_id);
            resolvedCustomer = {
              ...resolvedCustomer,
              name: sv.customer_name || resolvedCustomer.name,
              mobile: sv.customer_mobile || resolvedCustomer.mobile,
              address: (sv as any).site_address || resolvedCustomer.address,
              area: (sv as any).area || resolvedCustomer.area,
              siteType: (sv as any).site_type || resolvedCustomer.siteType,
              visitStatus: sv.status || resolvedCustomer.visitStatus,
            };
            if (Array.isArray(sv.raw_materials)) materialsCount += sv.raw_materials.length;
            if (Array.isArray(sv.cable_accessories)) materialsCount += sv.cable_accessories.length;
          } catch {
            // non-fatal
          }
        }

        // Fetch from Lead details if linked
        if (fm.lead_id) {
          try {
            const ld = await leadsApi.getLead(fm.lead_id);
            if (ld) {
              resolvedCustomer = {
                ...resolvedCustomer,
                name: ld.customer_name || resolvedCustomer.name,
                mobile: ld.mobile || ld.customer_mobile || resolvedCustomer.mobile,
                address: ld.site_address || ld.address || resolvedCustomer.address,
                area: ld.area || resolvedCustomer.area,
                visitStatus: ld.status || resolvedCustomer.visitStatus,
                product: ld.product_interested || undefined,
                requirement: ld.requirement_description || ld.approximate_requirement || undefined,
              };
            }
          } catch {
            // non-fatal
          }
        }

        if (resolvedCustomer.name || resolvedCustomer.address) {
          setCustomerInfo(resolvedCustomer);
        }

        setBackendStatus({
          hasNotes: (fm.notes || []).length > 0,
          workStage: fm.work_stage,
          materialsCount,
          hasPeriodicPhotos,
          hasVideo,
          hasPhotos,
        });
      } catch {
        // Offline or fetch failed — completionSummary falls back to local record
      }
    } finally {
      setLoading(false);
    }
  }, [paramFmId, role.key]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleCall(phone: string) {
    const clean = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Cannot make call', `Unable to call ${phone}`);
    });
  }

  async function performCompletion() {
    if (!fmId) return;
    setCompleting(true);
    try {
      await updateSiteVisitRecord(fmId, (r) => ({ ...r, outboundCompletedAt: new Date().toISOString() }));
      navigation.navigate('ReturnDecision', { fieldMovementId: fmId });
    } catch (err) {
      const message = describeActionFailure(err).message;
      Alert.alert('Error', message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleComplete() {
    if (!fmId || !record) return;
    const effectiveWorkType = currentFm?.work_type || (role.key === 'direct_marketing' ? 'DIRECT MARKET' : 'SITE VISIT');
    const activeModules = getModulesForWorkType(effectiveWorkType, role.siteVisitModules);
    const status = completionSummary(record, backendStatus);
    const requiredKeys = getRequiredModulesForRole(role.key, effectiveWorkType, activeModules);
    const unfinishedRequired = requiredKeys.filter((k) => !status[k]);

    if (unfinishedRequired.length > 0) {
      setIncompleteRequiredTasks(unfinishedRequired);
      setWarningModalVisible(true);
      return;
    }

    Alert.alert('Complete outbound work?', "All required tasks are completed! Ready to proceed to return/checkout.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: performCompletion },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!fmId || !record) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Work / Site" onBack={route.params ? () => navigation.goBack() : undefined} />
        <EmptyState
          icon="business-outline"
          title="No active site visit"
          subtitle="Start tracking and mark your destination to open your work checklist."
        />
        <BottomNav active="SiteVisit" navigation={navigation} />
      </View>
    );
  }

  const effectiveWorkType = currentFm?.work_type || (role.key === 'direct_marketing' ? 'DIRECT MARKET' : 'SITE VISIT');
  const status = completionSummary(record, backendStatus);
  const modules = getModulesForWorkType(effectiveWorkType, role.siteVisitModules);
  const alreadyCompleted = !!record.outboundCompletedAt;
  const fullAddress = [customerInfo?.address, customerInfo?.area].filter(Boolean).join(', ');

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Work / Site" onBack={paramFmId ? () => navigation.goBack() : undefined} subtitle={role.label} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Geofence Warning / Status Banner ── */}
        {isBreached ? (
          <View style={styles.geofenceAlertCard}>
            <Ionicons name="alert-circle" size={22} color="#DC2626" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.geofenceAlertTitle}>Geofence Alert: Outside Designated Site</Text>
              <Text style={styles.geofenceAlertText}>
                You are ~{Math.round(currentDistance || 0)}m from the marked site destination (allowed {geofenceRadius}m). Immediate alerts have been sent to CEO & Management.
              </Text>
            </View>
          </View>
        ) : (destLat && destLng) ? (
          <View style={styles.geofenceSafeCard}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.geofenceSafeText}>
              Within designated site radius (~{Math.round(currentDistance || 0)}m / {geofenceRadius}m limit)
            </Text>
          </View>
        ) : null}

        {/* ── Customer / Lead Details Card ── */}
        {customerInfo && (customerInfo.name || customerInfo.address) ? (
          <Card style={styles.customerCard} padded>
            <View style={styles.customerHeader}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customerInfo.name || 'Lead / Destination'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View style={[
                    styles.siteTypeBadge,
                    customerInfo.workType === 'DIRECT MARKET' && { backgroundColor: colors.primarySoft }
                  ]}>
                    <Text style={[
                      styles.siteTypeText,
                      customerInfo.workType === 'DIRECT MARKET' && { color: colors.primary }
                    ]}>
                      {customerInfo.workType || 'Site Visit'}
                    </Text>
                  </View>
                  {customerInfo.siteType && customerInfo.siteType !== customerInfo.workType ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>• {customerInfo.siteType}</Text>
                  ) : null}
                </View>
              </View>
              {customerInfo.visitStatus ? (
                <View style={[
                  styles.statusDot,
                  customerInfo.visitStatus === 'In Progress' && { backgroundColor: colors.success },
                  customerInfo.visitStatus === 'Upcoming' && { backgroundColor: colors.info },
                  customerInfo.visitStatus === 'Completed' && { backgroundColor: colors.textMuted },
                ]}>
                  <Text style={styles.statusDotText}>
                    {customerInfo.visitStatus === 'In Progress' ? '● Live' : customerInfo.visitStatus}
                  </Text>
                </View>
              ) : null}
            </View>

            {customerInfo.mobile ? (
              <TouchableOpacity style={styles.customerRow} onPress={() => handleCall(customerInfo.mobile)} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={15} color={colors.primary} />
                <Text style={styles.customerPhone}>{customerInfo.mobile}</Text>
                <Text style={styles.callHint}>(Tap to call)</Text>
              </TouchableOpacity>
            ) : null}

            {fullAddress ? (
              <View style={styles.customerRow}>
                <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                <Text style={styles.customerAddress} numberOfLines={2}>{fullAddress}</Text>
              </View>
            ) : null}

            {customerInfo.product ? (
              <View style={styles.customerRow}>
                <Ionicons name="sunny-outline" size={15} color={colors.warning} />
                <Text style={[styles.customerAddress, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                  Product: {customerInfo.product}
                </Text>
              </View>
            ) : null}

            {customerInfo.requirement ? (
              <View style={styles.customerRow}>
                <Ionicons name="document-text-outline" size={15} color={colors.info} />
                <Text style={[styles.customerAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                  Requirement: {customerInfo.requirement}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* ── Module Checklist ── */}
        {modules.map((key) => {
          const mod = MODULE_INFO[key];
          const done = status[key];
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() =>
                mod.route &&
                navigation.navigate(mod.route, {
                  fieldMovementId: fmId,
                  siteVisitId: currentFm?.site_visit_id,
                  ...(mod.params || {}),
                })
              }
            >
              <Card style={styles.moduleCard} padded>
                <View style={styles.moduleRow}>
                  <View style={[styles.moduleIcon, done && { backgroundColor: colors.successSoft }]}>
                    <Ionicons name={mod.icon} size={19} color={done ? colors.success : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moduleTitle}>{mod.title}</Text>
                    <Text style={styles.moduleSubtitle} numberOfLines={1}>
                      {mod.subtitle}
                    </Text>
                  </View>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={alreadyCompleted ? 'Outbound Work Completed' : 'Complete Outbound Work'}
          onPress={handleComplete}
          loading={completing}
          disabled={alreadyCompleted}
          variant={alreadyCompleted ? 'outline' : 'primary'}
        />
      </View>
      <BottomNav active="SiteVisit" navigation={navigation} />

      {/* ── Required Tasks Incomplete Warning Modal ── */}
      <Modal
        visible={warningModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalWarningIconWrap}>
              <Ionicons name="warning" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>Incomplete Required Tasks</Text>
            <Text style={styles.modalSubtitle}>
              {role.key === 'field_technician'
                ? 'Field Technician protocol requires equipment custody verification (before & after), arrival selfie, installation photos, and periodic 2h/4h progress photos before submitting work.'
                : effectiveWorkType === 'DIRECT MARKET'
                ? 'Direct Market protocol requires arrival selfie, site/field photos, site video, and site notes before completing outbound work.'
                : 'Site visit protocol requires arrival selfie, site photos, site video, site visit form, and site notes before completing outbound work.'}
            </Text>

            <View style={styles.missingListContainer}>
              {incompleteRequiredTasks.map((key) => {
                const mod = MODULE_INFO[key];
                return (
                  <View key={key} style={styles.missingItemRow}>
                    <Ionicons name={mod?.icon || 'alert-circle-outline'} size={18} color={colors.danger} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.missingItemTitle}>{mod?.title || key}</Text>
                      <Text style={styles.missingItemSubtitle}>{mod?.subtitle || ''}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Review & Complete Tasks"
                variant="primary"
                onPress={() => setWarningModalVisible(false)}
                style={{ width: '100%', marginBottom: spacing.sm }}
              />
              <Button
                title="Complete Anyway"
                variant="outline"
                onPress={() => {
                  setWarningModalVisible(false);
                  performCompletion();
                }}
                style={{ width: '100%' }}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg },

  // Customer card
  customerCard: { marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  customerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  customerName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  siteTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 3,
  },
  siteTypeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  statusDot: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  statusDotText: { fontSize: 10, fontWeight: '700', color: colors.success },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  customerPhone: { fontSize: 14, fontWeight: '600', color: colors.primary, marginLeft: 6 },
  callHint: { fontSize: 11, color: colors.textMuted, marginLeft: 6 },
  customerAddress: { fontSize: 13, color: colors.textSecondary, marginLeft: 6, flex: 1 },

  // Module cards
  moduleCard: { marginBottom: spacing.sm },
  moduleRow: { flexDirection: 'row', alignItems: 'center' },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  moduleSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  footer: { padding: spacing.lg, paddingTop: 0 },

  // Warning Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalWarningIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  missingListContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  missingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  missingItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  missingItemSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  modalActions: {
    width: '100%',
  },
  geofenceAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  geofenceAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  geofenceAlertText: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  geofenceSafeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
    gap: 6,
  },
  geofenceSafeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#065F46',
  },
});
