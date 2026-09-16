import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { uploadDocument, listDocuments, deleteDocument } from '../api/fieldMovements';
import { enqueueMediaUpload, removeFromQueue, listPendingUploads } from '../tracking/mediaUploadQueue';
import { SiteDocument } from '../siteVisit/types';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing } from '../theme/theme';
import { formatBytes, formatDateTime } from '../utils/format';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

export default function DocumentsScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const [docs, setDocs] = useState<SiteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState<Record<string, { uri: string; name: string; size: number; mimeType: string }>>({});

  function refresh() {
    return listDocuments(fieldMovementId).then((rows: any[]) => {
      setDocs(
        rows.map((r) => ({
          id: r.id,
          uri: r.file_url,
          name: r.name,
          size: r.size ?? 0,
          mimeType: r.mime_type || 'application/octet-stream',
          addedAt: r.added_at,
          uploaded: true,
        }))
      );
    });
  }

  useEffect(() => {
    // Rehydrate any documents that were queued but not yet confirmed
    // uploaded — including ones queued in a previous app session, since
    // this now reads from the durable queue instead of ephemeral React
    // state (§30: uploads must survive an app restart).
    listPendingUploads(fieldMovementId).then((pending) => {
      const rehydrated: Record<string, { uri: string; name: string; size: number; mimeType: string }> = {};
      for (const p of pending) {
        if (p.endpoint === 'documents') {
          rehydrated[p.operationId] = { uri: p.fileUri, name: p.fileName, size: 0, mimeType: p.mimeType };
        }
      }
      setPendingLocal(rehydrated);
      Object.keys(rehydrated).forEach((id) => uploadEntry(id));
    });
    refresh().finally(() => setLoading(false));
  }, [fieldMovementId]);

  async function uploadEntry(localId: string) {
    const local = pendingLocal[localId];
    if (!local) return;
    setUploadingId(localId);
    try {
      await uploadDocument(fieldMovementId, local.uri, local.name, local.mimeType, localId);
      await removeFromQueue(localId);
      setPendingLocal((prev) => {
        const next = { ...prev };
        delete next[localId];
        return next;
      });
      await refresh();
    } catch {
      Alert.alert('Saved for retry', `"${local.name}" is saved on your device and will upload automatically once you have a connection.`);
    } finally {
      setUploadingId(null);
    }
  }

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    let size = asset.size ?? 0;
    if (!size) {
      // expo-file-system's function-based API (getInfoAsync) still works via
      // a legacy compat shim in SDK 57 but is deprecated in favor of the new
      // File/Directory classes — fine for now, worth migrating later.
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        size = info.exists && 'size' in info ? info.size ?? 0 : 0;
      } catch {
        size = 0;
      }
    }

    const mimeType = asset.mimeType || 'application/octet-stream';
    const operationId = await enqueueMediaUpload({
      fieldMovementId,
      endpoint: 'documents',
      fileUri: asset.uri,
      fileName: asset.name,
      mimeType,
    });
    setPendingLocal((prev) => ({ ...prev, [operationId]: { uri: asset.uri, name: asset.name, size, mimeType } }));
    uploadEntry(operationId);
  }

  async function handleRemove(id: string) {
    if (id in pendingLocal) {
      await removeFromQueue(id);
      setPendingLocal((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    await deleteDocument(fieldMovementId, id);
    await refresh();
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
      <ScreenHeader title="Documents" onBack={() => navigation.goBack()} subtitle="Upload related documents" />

      <View style={styles.content}>
        <TouchableOpacity style={styles.dropZone} onPress={handlePick}>
          <Ionicons name="cloud-upload-outline" size={30} color={colors.primary} />
          <Text style={styles.dropTitle}>Tap to upload a file</Text>
          <Text style={styles.dropSub}>Supports PDF, DOC, DOCX, JPG, PNG (Max 10 MB)</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Uploaded documents</Text>
        <FlatList
          data={[
            ...Object.entries(pendingLocal).map(([id, p]) => ({
              id, uri: p.uri, name: p.name, size: p.size, mimeType: p.mimeType,
              addedAt: new Date().toISOString(), uploaded: false,
            } as SiteDocument)),
            ...docs,
          ]}
          keyExtractor={(d) => d.id}
          ListEmptyComponent={<EmptyState icon="document-outline" title="No documents added yet" />}
          renderItem={({ item }) => (
            <Card style={styles.docRow} padded>
              <View style={styles.docIcon}>
                <Ionicons name="document-text-outline" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.docMeta}>
                  {formatBytes(item.size)} · {formatDateTime(item.addedAt)}
                </Text>
              </View>
              {uploadingId === item.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : item.uploaded ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : (
                <TouchableOpacity onPress={() => uploadEntry(item.id)} hitSlop={8}>
                  <Ionicons name="refresh-circle" size={22} color={colors.warning} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg },
  dropZone: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.card,
  },
  dropTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  dropSub: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  docRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  docIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  docName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  docMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
