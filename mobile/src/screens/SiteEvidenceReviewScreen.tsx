import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as fieldMovementsApi from '../api/fieldMovements';
import * as siteVisitsApi from '../api/siteVisits';
import { getSharedProjectEvidence, SharedProjectEvidence } from '../api/projects';
import { loadSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { SiteVisitRecord } from '../siteVisit/types';
import { FieldMovementNoteRead } from '../types';
import { ApiError } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime } from '../utils/format';
import { describeActionFailure } from '../utils/fieldErrorMessages';

export default function SiteEvidenceReviewScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [record, setRecord] = useState<SiteVisitRecord | null>(null);
  const [notes, setNotes] = useState<FieldMovementNoteRead[]>([]);
  const [backendPhotos, setBackendPhotos] = useState<any[]>([]);
  const [backendVideos, setBackendVideos] = useState<any[]>([]);
  const [siteVisitData, setSiteVisitData] = useState<any | null>(null);
  const [shared, setShared] = useState<SharedProjectEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharedError, setSharedError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const localRecord = await loadSiteVisitRecord(fieldMovementId);
    setRecord(localRecord);

    try {
      const fm = await fieldMovementsApi.getFieldMovement(fieldMovementId);
      setNotes(fm.notes || []);
      const allPhotos = fm.photos || [];
      const seenVideoKeys = new Set<string>();
      const rawVideos = [
        ...(fm.videos || []),
        ...allPhotos.filter((p: any) => p.media_type === 'video' || p.mediaType === 'video'),
      ];
      const videoItems = rawVideos.filter((v: any) => {
        const key = v.id || v.file_url;
        if (!key || seenVideoKeys.has(key)) return false;
        seenVideoKeys.add(key);
        return true;
      });

      const seenPhotoKeys = new Set<string>();
      const nonVideoPhotos = allPhotos
        .filter((p: any) => p.media_type !== 'video' && p.mediaType !== 'video')
        .filter((p: any) => {
          const key = p.id || p.file_url;
          if (!key || seenPhotoKeys.has(key)) return false;
          seenPhotoKeys.add(key);
          return true;
        });

      setBackendPhotos(nonVideoPhotos);
      setBackendVideos(videoItems);

      if (fm.site_visit_id) {
        try {
          const sv = await siteVisitsApi.getSiteVisit(fm.site_visit_id);
          setSiteVisitData(sv);
        } catch {
          // non-fatal
        }
      }

      if (fm.project_id) {
        try {
          const evidence = await getSharedProjectEvidence(fm.project_id);
          setShared(evidence);
        } catch {
          setShared(null);
        }
      } else {
        setShared(null);
      }
      setSharedError(null);
    } catch {
      setShared(null);
      setSharedError(null);
    } finally {
      setLoading(false);
    }
  }, [fieldMovementId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasAnyLocalEvidence =
    (record.selfieProof?.length ?? 0) > 0 ||
    record.generalPhotos.length > 0 ||
    record.installationPhotos.length > 0 ||
    !!record.video ||
    record.measurements.length > 0 ||
    record.documents.length > 0 ||
    backendPhotos.length > 0 ||
    backendVideos.length > 0 ||
    notes.length > 0;

  const hasAnySharedEvidence =
    !!shared &&
    (shared.photos.length > 0 ||
      shared.videos.length > 0 ||
      shared.measurements.length > 0 ||
      shared.documents.length > 0 ||
      shared.equipment.length > 0);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Site Evidence" onBack={() => navigation.goBack()} subtitle="What's known about this site so far" />
      <ScrollView contentContainerStyle={styles.content}>
        {shared && shared.contributors.length > 0 && (
          <Card style={styles.teamCard} padded>
            <Ionicons name="people-outline" size={15} color={colors.primary} />
            <Text style={styles.teamCardText}>
              {shared.contributors.length} technician{shared.contributors.length === 1 ? '' : 's'} on this project:{' '}
              {shared.contributors.map((c) => c.employee_name).join(', ')}
            </Text>
          </Card>
        )}


        {hasAnySharedEvidence && (
          <>
            <Text style={styles.sectionHeader}>ALREADY UPLOADED BY THE TEAM</Text>

            {shared!.photos.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Photos ({shared!.photos.length})</Text>
                <FlatList
                  horizontal
                  data={shared!.photos}
                  keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `shared-photo-${idx}`)}
                  renderItem={({ item }) => (
                    <View style={styles.attributedThumbWrap}>
                      <Image source={{ uri: item.file_url }} style={styles.thumb} />
                      <Text style={styles.attribution} numberOfLines={1}>{item.employee_name}</Text>
                    </View>
                  )}
                  showsHorizontalScrollIndicator={false}
                />
              </>
            )}

            {shared!.videos.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Videos ({shared!.videos.length})</Text>
                {shared!.videos.map((v, idx) => (
                  <Card key={v.id ? `${v.id}-${idx}` : `shared-video-${idx}`} padded style={styles.rowCard}>
                    <Ionicons name="videocam" size={18} color={colors.primary} />
                    <Text style={styles.rowText}>Recorded by {v.employee_name} - {formatDateTime(v.uploaded_at)}</Text>
                  </Card>
                ))}
              </>
            )}

            {shared!.measurements.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Measurements ({shared!.measurements.length})</Text>
                <FlatList
                  horizontal
                  data={shared!.measurements}
                  keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `shared-measure-${idx}`)}
                  renderItem={({ item }) => (
                    <View style={styles.attributedThumbWrap}>
                      <Image source={{ uri: item.file_url }} style={styles.thumb} />
                      <Text style={styles.attribution} numberOfLines={1}>{item.category} - {item.employee_name}</Text>
                    </View>
                  )}
                  showsHorizontalScrollIndicator={false}
                />
              </>
            )}

            {shared!.documents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Documents ({shared!.documents.length})</Text>
                <Card padded>
                  {shared!.documents.map((d, idx) => (
                    <Text key={d.id ? `${d.id}-${idx}` : `shared-doc-${idx}`} style={styles.docText}>{d.name} - {d.employee_name}</Text>
                  ))}
                </Card>
              </>
            )}

            {shared!.equipment.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Equipment Custody ({shared!.equipment.length})</Text>
                <Card padded>
                  {shared!.equipment.map((e, idx) => (
                    <Text key={e.id ? `${e.id}-${idx}` : `shared-eq-${idx}`} style={styles.docText}>
                      {e.stage === 'before' ? 'Before' : 'After'} - {e.employee_name} ({(e.items as any[]).length} item{(e.items as any[]).length === 1 ? '' : 's'})
                    </Text>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        <Text style={styles.sectionHeader}>YOUR OWN EVIDENCE ON THIS VISIT</Text>

        {!hasAnyLocalEvidence && (
          <EmptyState icon="albums-outline" title="You haven't added anything yet on this visit" />
        )}

        {record.selfieProof && record.selfieProof.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Arrival Proof Selfie ({record.selfieProof.length})</Text>
            <FlatList
              horizontal
              data={record.selfieProof}
              keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `selfie-${idx}`)}
              renderItem={({ item }) => (
                <View style={styles.attributedThumbWrap}>
                  <Image source={{ uri: item.compositedUri || item.uri }} style={styles.thumb} />
                  <Text style={styles.attribution} numberOfLines={1}>{item.employeeName || 'Selfie'}</Text>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}

        {record.generalPhotos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>General Site Photos ({record.generalPhotos.length})</Text>
            <FlatList
              horizontal
              data={record.generalPhotos}
              keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `gen-photo-${idx}`)}
              renderItem={({ item }) => <Image source={{ uri: item.uri }} style={styles.thumb} />}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}

        {record.installationPhotos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Installation Area Photos ({record.installationPhotos.length})</Text>
            <FlatList
              horizontal
              data={record.installationPhotos}
              keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `inst-photo-${idx}`)}
              renderItem={({ item }) => <Image source={{ uri: item.uri }} style={styles.thumb} />}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}

        {record.video && (
          <>
            <Text style={styles.sectionTitle}>Site View Video</Text>
            <Card padded style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="videocam" size={18} color={colors.primary} />
              <Text style={styles.videoText}>Recorded ({record.video.durationSeconds}s)</Text>
            </Card>
          </>
        )}

        {record.measurements.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Measurements ({record.measurements.length})</Text>
            <FlatList
              horizontal
              data={record.measurements}
              keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `meas-${idx}`)}
              renderItem={({ item }) => <Image source={{ uri: item.uri }} style={styles.thumb} />}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}

        {record.documents.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Documents ({record.documents.length})</Text>
            <Card padded>
              {record.documents.map((d, idx) => (
                <Text key={d.id ? `${d.id}-${idx}` : `doc-${idx}`} style={styles.docText}>
                  {d.name}
                </Text>
              ))}
            </Card>
          </>
        )}

        {backendPhotos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Uploaded Photos & Proofs ({backendPhotos.length})</Text>
            <FlatList
              horizontal
              data={backendPhotos}
              keyExtractor={(p, idx) => (p.id ? `${p.id}-${idx}` : `backend-photo-${idx}`)}
              renderItem={({ item }) => (
                <View style={styles.attributedThumbWrap}>
                  <Image source={{ uri: item.file_url }} style={styles.thumb} />
                  <Text style={styles.attribution} numberOfLines={1}>{item.photo_type || 'site'}</Text>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}

        {backendVideos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Uploaded Videos ({backendVideos.length})</Text>
            {backendVideos.map((v, idx) => (
              <Card key={v.id ? `${v.id}-${idx}` : `backend-video-${idx}`} padded style={styles.rowCard}>
                <Ionicons name="videocam" size={18} color={colors.primary} />
                <Text style={styles.rowText}>
                  Panoramic Video ({v.duration_seconds || 15}s) · {formatDateTime(v.uploaded_at)}
                </Text>
              </Card>
            ))}
          </>
        )}

        {siteVisitData && (
          <>
            <Text style={styles.sectionTitle}>Site Visit Form & Stock Data</Text>
            <Card padded style={{ gap: 6 }}>
              {siteVisitData.customer_name && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Client: {siteVisitData.customer_name} ({siteVisitData.customer_mobile || ''})
                </Text>
              )}
              {siteVisitData.feasibility_result && (
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  Feasibility: {siteVisitData.feasibility_result}
                </Text>
              )}
              {siteVisitData.installation_area && (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Installation Area: {siteVisitData.installation_area}
                </Text>
              )}
              {siteVisitData.measurements && (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Measurements: {siteVisitData.measurements}
                </Text>
              )}
              {siteVisitData.raw_material_details && siteVisitData.raw_material_details.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Stock Products Requested ({siteVisitData.raw_material_details.length})
                  </Text>
                  {siteVisitData.raw_material_details.map((item: any, idx: number) => (
                    <Text key={idx} style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>
                      • {item.itemName || item.item_name} ({item.quantity} {item.unit || 'units'})
                    </Text>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        {notes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Site Notes ({notes.length})</Text>
            <Card padded>
              {notes.map((n, i) => (
                <View key={n.id ? `${n.id}-${i}` : `note-${i}`} style={i > 0 ? { marginTop: spacing.sm } : undefined}>
                  <Text style={styles.notesText}>{n.note}</Text>
                  <Text style={styles.noteMeta}>{formatDateTime(n.created_at)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 40 },
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  teamCardText: { flex: 1, fontSize: 12, color: colors.textPrimary, marginLeft: 6 },
  gapNotice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.infoSoft, borderColor: colors.infoSoft, marginBottom: spacing.md },
  gapNoticeText: { flex: 1, fontSize: 11, color: colors.info, marginLeft: 8, lineHeight: 16 },
  sectionHeader: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.lg, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  attributedThumbWrap: { marginRight: spacing.sm, width: 72 },
  attribution: { fontSize: 9, color: colors.textSecondary, marginTop: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  rowText: { fontSize: 13, color: colors.textPrimary, marginLeft: 8 },
  videoText: { fontSize: 13, color: colors.textPrimary, marginLeft: 8 },
  docText: { fontSize: 13, color: colors.textPrimary, marginTop: 4 },
  notesText: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  noteMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
