import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { listMyProjects, ProjectListItem } from '../api/projects';
import { ApiError } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { describeActionFailure } from '../utils/fieldErrorMessages';

/**
 * Field Technician's "which assigned project am I working on today"
 * screen. Real backend data only — GET /projects/mine, scoped server-side
 * to actual ProjectAssignment membership (§26, §45, §62). Selecting a
 * project threads project_id through to EquipmentBefore -> StartTracking
 * -> FieldMovement.project_id, which is what makes the shared
 * multi-technician evidence view (§25) resolve to the right project.
 */
export default function ProjectSelectionScreen({ navigation }: any) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listMyProjects(1, 50);
      setProjects(res.items);
      setError(null);
    } catch (err) {
      setError(describeActionFailure(err).message);
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

  function handleSelect(project: ProjectListItem) {
    navigation.navigate('EquipmentBefore', { projectId: project.id });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Select Project" onBack={() => navigation.goBack()} />
      {error ? (
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.danger }}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="construct-outline"
            title="No assigned projects"
            subtitle="You don't have any active projects assigned to you right now."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleSelect(item)}>
            <Card padded style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.code}>{item.project_code}</Text>
                <View style={styles.stageBadge}>
                  <Text style={styles.stageText}>{item.current_stage}</Text>
                </View>
              </View>
              <Text style={styles.customer}>{item.customer_name}</Text>
              {item.site ? <Text style={styles.site}>{item.site}{item.area ? `, ${item.area}` : ''}</Text> : null}
              <View style={styles.footer}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.teamCount}>
                  {item.assignments.length} technician{item.assignments.length === 1 ? '' : 's'} on this project
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { gap: 4 },
  code: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  stageText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  customer: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  site: { fontSize: 12, color: colors.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  teamCount: { fontSize: 12, color: colors.textSecondary },
});
