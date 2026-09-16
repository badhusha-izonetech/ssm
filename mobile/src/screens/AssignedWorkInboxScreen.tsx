import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as leadsApi from '../api/leads';
import { LeadSummary } from '../api/leads';
import * as projectsApi from '../api/projects';
import { ProjectListItem } from '../api/projects';
import * as fieldMovementsApi from '../api/fieldMovements';
import { FieldMovementRead } from '../types';
import { ApiError } from '../api/client';
import { useRole } from '../roles/useRole';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import StatusPill from '../components/StatusPill';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime } from '../utils/format';

function getPriorityTone(priority?: string): 'danger' | 'warning' | 'info' | 'muted' {
  const p = (priority || '').toLowerCase();
  if (p === 'high' || p === 'urgent') return 'danger';
  if (p === 'medium') return 'warning';
  if (p === 'low') return 'info';
  return 'muted';
}

type TabType = 'all' | 'projects' | 'leads' | 'completed';

type InboxItem =
  | { type: 'project'; data: ProjectListItem }
  | { type: 'lead'; data: LeadSummary }
  | { type: 'completed'; data: FieldMovementRead };

export default function AssignedWorkInboxScreen({ navigation }: any) {
  const role = useRole();
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [completedMovements, setCompletedMovements] = useState<FieldMovementRead[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFm, setActiveFm] = useState<FieldMovementRead | null>(null);

  const load = useCallback(async () => {
    try {
      const [leadsRes, projectsRes, movementsRes] = await Promise.allSettled([
        leadsApi.listAssignedFieldLeads(1, 50),
        projectsApi.listMyProjects(1, 50),
        fieldMovementsApi.listMine(1, 50),
      ]);

      let checkedOutFms: FieldMovementRead[] = [];
      if (movementsRes.status === 'fulfilled') {
        const rawFms = movementsRes.value.items || [];
        const currentActive = rawFms.find((f) => ['Checked In', 'On Field', 'Returning'].includes(f.status));
        setActiveFm(currentActive || null);

        const checkedOut = rawFms.filter((f) => f.status === 'Checked Out');
        checkedOutFms = Array.from(new Map(checkedOut.map((m) => [m.id, m])).values());
        setCompletedMovements(checkedOutFms);
      }

      // Collect IDs of completed leads & projects so completed work moves to Recent Work
      const completedLeadIds = new Set<string>();
      const completedProjectIds = new Set<string>();
      checkedOutFms.forEach((f) => {
        if (f.lead_id) completedLeadIds.add(f.lead_id);
        if (f.project_id) completedProjectIds.add(f.project_id);
      });

      const getPriorityRank = (p?: string) => {
        const s = (p || '').toLowerCase();
        if (s === 'urgent') return 1;
        if (s === 'high') return 2;
        if (s === 'medium') return 3;
        if (s === 'low') return 4;
        return 5;
      };

      if (leadsRes.status === 'fulfilled') {
        const rawLeads = leadsRes.value.items || [];
        const activeLeads = rawLeads.filter(
          (l) => !completedLeadIds.has(l.id) && !['Quotation Stage', 'Converted', 'Lost'].includes(l.status)
        );
        // Sort leads: Priority (Urgent/High first), then earliest scheduled meet/date
        const sortedLeads = [...activeLeads].sort((a, b) => {
          const rankDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
          if (rankDiff !== 0) return rankDiff;
          const timeA = a.assigned_at || a.created_at || '';
          const timeB = b.assigned_at || b.created_at || '';
          return new Date(timeA).getTime() - new Date(timeB).getTime();
        });
        setLeads(sortedLeads);
      }
      if (projectsRes.status === 'fulfilled') {
        const rawProjects = projectsRes.value.items || [];
        const activeProjects = rawProjects.filter(
          (p) => !completedProjectIds.has(p.id) && p.status !== 'Completed'
        );
        const sortedProjects = [...activeProjects].sort((a, b) => {
          const rankDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
          if (rankDiff !== 0) return rankDiff;
          const dueA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const dueB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return dueA - dueB;
        });
        setProjects(sortedProjects);
      }
    } catch (e) {
      Alert.alert('Could not load assigned work', e instanceof ApiError ? e.message : 'Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Cannot make call', `Unable to call ${phone}`);
    });
  };

  const handleStartLeadJourney = async (lead: LeadSummary, chosenWorkType: 'DIRECT MARKET' | 'SITE VISIT') => {
    const dest = lead.site_address || lead.address || lead.city || '';
    if (activeFm) {
      // Keep master continuous tracking running! Update destination
      try {
        await fieldMovementsApi.updateFieldMovement(activeFm.id, {
          destination: dest,
        });
      } catch {
        // non-fatal
      }
      navigation.navigate('TrackingLive', {
        fieldMovementId: activeFm.id,
      });
      return;
    }

    navigation.navigate('StartTracking', {
      leadId: lead.id,
      customerName: lead.customer_name,
      destination: dest,
      workType: chosenWorkType,
    });
  };

  const handleStartProjectJourney = async (project: ProjectListItem) => {
    const dest = project.site || project.area || '';
    if (activeFm) {
      try {
        await fieldMovementsApi.updateFieldMovement(activeFm.id, {
          destination: dest,
        });
      } catch {
        // non-fatal
      }
      navigation.navigate('TrackingLive', {
        fieldMovementId: activeFm.id,
      });
      return;
    }

    navigation.navigate('StartTracking', {
      projectId: project.id,
      customerName: project.customer_name,
      destination: dest,
      workType: 'SITE VISIT',
    });
  };

  const handleProjectEquipmentBefore = (project: ProjectListItem) => {
    navigation.navigate('EquipmentBefore', { projectId: project.id });
  };

  // Build combined list
  const combinedItems: InboxItem[] = [];
  if (activeTab === 'all') {
    projects.forEach((p) => combinedItems.push({ type: 'project', data: p }));
    leads.forEach((l) => combinedItems.push({ type: 'lead', data: l }));
  } else if (activeTab === 'projects') {
    projects.forEach((p) => combinedItems.push({ type: 'project', data: p }));
  } else if (activeTab === 'leads') {
    leads.forEach((l) => combinedItems.push({ type: 'lead', data: l }));
  } else if (activeTab === 'completed') {
    completedMovements.forEach((m) => combinedItems.push({ type: 'completed', data: m }));
  }

  const activeTotal = projects.length + leads.length;
  const subtitle = `${projects.length} project${projects.length === 1 ? '' : 's'}, ${leads.length} lead${leads.length === 1 ? '' : 's'}${completedMovements.length > 0 ? ` · ${completedMovements.length} done` : ''}`;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Assigned Work"
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
      />

      {/* ── Filter Tabs ── */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
          onPress={() => setActiveTab('all')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            To Do ({activeTotal})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'projects' && styles.tabButtonActive]}
          onPress={() => setActiveTab('projects')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>
            Projects ({projects.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leads' && styles.tabButtonActive]}
          onPress={() => setActiveTab('leads')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}>
            Leads ({leads.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'completed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Recent ({completedMovements.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={combinedItems}
          keyExtractor={(item, index) => `${item.type}-${item.data.id}-${index}`}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-outline"
              title={
                activeTab === 'projects'
                  ? 'No projects assigned'
                  : activeTab === 'leads'
                  ? 'No leads assigned'
                  : activeTab === 'completed'
                  ? 'No completed work yet'
                  : 'No work assigned to you'
              }
              subtitle={
                activeTab === 'completed'
                  ? 'Completed journeys and uploaded field records will appear here for review.'
                  : 'When your Project Head or team assigns projects or site visits to you, they will appear here.'
              }
            />
          }
          renderItem={({ item }) => {
            if (item.type === 'project') {
              const project = item.data;
              const locationStr = [project.site, project.area].filter(Boolean).join(', ');

              return (
                <Card padded style={styles.card}>
                  <View style={styles.projectBadgeRow}>
                    <View style={styles.codeBadge}>
                      <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                      <Text style={styles.codeBadgeText}>{project.project_code}</Text>
                    </View>
                    <View style={styles.badgeRow}>
                      {project.priority ? (
                        <StatusPill label={project.priority} tone={getPriorityTone(project.priority)} />
                      ) : null}
                      <View style={{ width: 6 }} />
                      <StatusPill label={project.current_stage || project.status} tone="info" />
                    </View>
                  </View>

                  <Text style={styles.customerName}>{project.customer_name}</Text>

                  {locationStr ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                      <Text style={styles.infoText} numberOfLines={2}>
                        {locationStr}
                      </Text>
                    </View>
                  ) : null}

                  {project.due_date ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.infoText}>Due: {project.due_date}</Text>
                    </View>
                  ) : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.quickMatButton}
                      activeOpacity={0.8}
                      onPress={() => handleProjectEquipmentBefore(project)}
                    >
                      <Ionicons name="construct-outline" size={16} color={colors.primary} />
                      <Text style={[styles.quickMatText, { color: colors.primary }]}>Equipment Check</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.startButton}
                      activeOpacity={0.8}
                      onPress={() => handleStartProjectJourney(project)}
                    >
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={styles.startText}>Start Journey</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            }

            if (item.type === 'lead') {
              // Lead Item
              const lead = item.data;
              const phone = lead.mobile || lead.customer_mobile;
              const fullAddress = [lead.site_address || lead.address, lead.area, lead.city]
                .filter(Boolean)
                .join(', ');

              return (
                <Card padded style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName}>{lead.customer_name}</Text>
                    </View>
                    <View style={styles.badgeRow}>
                      {lead.priority ? (
                        <StatusPill label={lead.priority} tone={getPriorityTone(lead.priority)} />
                      ) : null}
                      <View style={{ width: 6 }} />
                      <StatusPill label={lead.status || 'Assigned'} tone="info" />
                    </View>
                  </View>

                  {phone ? (
                    <TouchableOpacity
                      style={styles.phoneRow}
                      activeOpacity={0.7}
                      onPress={() => handleCall(phone)}
                    >
                      <Ionicons name="call-outline" size={15} color={colors.primary} />
                      <Text style={styles.phoneText}>{phone}</Text>
                      <Text style={styles.callHint}>(Tap to call)</Text>
                    </TouchableOpacity>
                  ) : null}

                  {fullAddress ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                      <Text style={styles.infoText} numberOfLines={2}>
                        {fullAddress}
                      </Text>
                    </View>
                  ) : null}

                  {lead.product_interested || lead.approximate_requirement ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="sunny-outline" size={15} color={colors.textMuted} />
                      <Text style={styles.infoText}>
                        {[lead.product_interested, lead.approximate_requirement].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  ) : null}

                  {lead.requirement_description ? (
                    <View style={styles.descBox}>
                      <Text style={styles.descText} numberOfLines={2}>
                        {lead.requirement_description}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.directMarketButton}
                      activeOpacity={0.8}
                      onPress={() => handleStartLeadJourney(lead, 'DIRECT MARKET')}
                    >
                      <Ionicons name="megaphone-outline" size={15} color={colors.primary} />
                      <Text style={styles.directMarketText}>Direct Market</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.startButton}
                      activeOpacity={0.8}
                      onPress={() => handleStartLeadJourney(lead, 'SITE VISIT')}
                    >
                      <Ionicons name="business" size={15} color="#fff" />
                      <Text style={styles.startText}>Site Visit</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            }

            // Completed Item
            const fm = item.data;
            const isDirect = fm.work_type === 'DIRECT MARKET';
            const title = fm.destination || fm.purpose || 'Completed Field Work';

            return (
              <Card padded style={styles.card}>
                <View style={styles.topRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={[
                        styles.siteTypeBadge,
                        isDirect && { backgroundColor: colors.primarySoft }
                      ]}>
                        <Text style={[
                          styles.siteTypeText,
                          isDirect && { color: colors.primary }
                        ]}>
                          {fm.work_type || 'Site Visit'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <StatusPill label="Completed" tone="muted" />
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.infoText}>
                    {formatDateTime(fm.end_time || fm.last_update || fm.start_time)}
                  </Text>
                </View>

                {fm.destination ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.infoText} numberOfLines={2}>{fm.destination}</Text>
                  </View>
                ) : null}

                <View style={{ marginTop: spacing.md }}>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('SiteEvidenceReview', { fieldMovementId: fm.id })}
                  >
                    <Ionicons name="albums-outline" size={16} color={colors.primary} />
                    <Text style={styles.reviewButtonText}>Review Recorded Work & Evidence</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  card: { marginBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs },
  projectBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  customerName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 6,
  },
  callHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  descBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#F8FAFC',
  },
  descText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  quickMatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  quickMatText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.success,
  },
  startText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 6,
  },
  directMarketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  directMarketText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 6,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 6,
    marginRight: 4,
  },
  siteTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.infoSoft,
  },
  siteTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.info,
  },
});
