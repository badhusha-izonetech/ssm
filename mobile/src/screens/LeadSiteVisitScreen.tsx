import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as leadsApi from '../api/leads';
import { LeadSummary } from '../api/leads';
import * as siteVisitsApi from '../api/siteVisits';
import * as fieldMovementsApi from '../api/fieldMovements';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';

const SITE_TYPES = ['Residential', 'Commercial'];

/**
 * Real entry point for the Site Engineer flow: pick a lead assigned to me,
 * resolve the real backend SiteVisit for it (reusing an open one or
 * creating it from the Lead's own data — GET /site-visits/for-lead/{id}),
 * then hand off with the real site_visit_id — not a locally-invented id.
 *
 * Two modes:
 *  - 'start-tracking' (from the SITE VISIT work-type picker): also starts
 *    the real FieldMovement with lead_id + site_visit_id so tracking,
 *    selfie, media, materials and completion all stay attached to the same
 *    business context — one authoritative flow, not a second mobile-only
 *    system.
 *  - 'materials' (default, from Today's Work): goes straight to materials
 *    entry for a quick requirement note without starting live tracking.
 */
export default function LeadSiteVisitScreen({ navigation, route }: any) {
  const mode: 'materials' | 'start-tracking' = route?.params?.mode || 'materials';
  const targetLeadId: string | undefined = route?.params?.leadId;
  const { employee } = useAuth();
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const autoPickedRef = React.useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsApi.listAssignedFieldLeads(1, 50);
      if (res.items && res.items.length > 0) {
        setLeads(res.items);
      } else {
        const fallback = await leadsApi.listMyLeads(1, 50);
        setLeads(fallback.items || []);
      }
    } catch (e) {
      Alert.alert('Could not load leads', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePick(lead: LeadSummary) {
    if (!employee) return;
    setCreatingFor(lead.id);
    try {
      if (mode === 'start-tracking') {
        const selectedWorkType: 'DIRECT MARKET' | 'SITE VISIT' = route?.params?.workType || 'SITE VISIT';
        const destination = lead.site_address || lead.address || lead.city || undefined;

        if (selectedWorkType === 'DIRECT MARKET') {
          const fm = await fieldMovementsApi.startFieldMovement({
            work_type: 'DIRECT MARKET',
            lead_id: lead.id,
            destination,
          });
          navigation.replace('TrackingLive', { fieldMovementId: fm.id });
          return;
        }

        // SITE VISIT flow: find or create real backend SiteVisit
        const visit = await siteVisitsApi.getOrCreateSiteVisitForLead(lead.id);
        const fm = await fieldMovementsApi.startFieldMovement({
          work_type: 'SITE VISIT',
          lead_id: lead.id,
          site_visit_id: visit.id,
          destination,
        });
        navigation.replace('TrackingLive', { fieldMovementId: fm.id, siteVisitId: visit.id });
        return;
      }

      const now = new Date();
      const visit = await siteVisitsApi.createSiteVisit({
        lead_id: lead.id,
        customer_name: lead.customer_name,
        customer_mobile: lead.customer_mobile,
        site_address: lead.site_address || '',
        area: lead.area || '',
        visit_date: now.toISOString().slice(0, 10),
        visit_time: now.toTimeString().slice(0, 5),
        employee_id: employee.id,
        employee_name: employee.name,
        site_type: SITE_TYPES[0],
      });
      navigation.navigate('SiteVisitMaterials', { siteVisitId: visit.id });
    } catch (e) {
      Alert.alert('Could not start site visit', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setCreatingFor(null);
    }
  }

  // Web → Mobile deep link (§F): successsolar://lead/{id} lands here with
  // a real lead id already known (the employee tapped a specific lead row
  // in the Web ERP, not the generic "open app" button). Once the real
  // "my leads" list has loaded, auto-run the same action a manual tap
  // would trigger for that lead — an unrecognized/unauthorized id (not in
  // this employee's own lead list; backend authorization is still the
  // final word on any subsequent API calls) just leaves the normal picker
  // showing instead of silently failing.
  useEffect(() => {
    if (!targetLeadId || loading || autoPickedRef.current) return;
    const match = leads.find((l) => l.id === targetLeadId);
    if (match) {
      autoPickedRef.current = true;
      handlePick(match);
    }
  }, [targetLeadId, loading, leads]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Select Lead" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No leads assigned to you" />}
          renderItem={({ item }) => (
            <Card padded style={styles.leadCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.leadName}>{item.customer_name}</Text>
                <Text style={styles.leadMeta}>{item.customer_mobile}</Text>
                {item.site_address ? <Text style={styles.leadMeta}>{item.site_address}</Text> : null}
                <Text style={styles.leadStatus}>{item.status}</Text>
              </View>
              <TouchableOpacity
                style={styles.pickButton}
                onPress={() => handlePick(item)}
                disabled={creatingFor === item.id}
              >
                {creatingFor === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  leadCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  leadName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  leadMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  leadStatus: { fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 4 },
  pickButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});
