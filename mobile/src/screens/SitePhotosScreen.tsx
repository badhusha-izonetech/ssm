import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, FlatList, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadFieldFile } from '../api/fieldMovements';
import { enqueueMediaUpload, removeFromQueue } from '../tracking/mediaUploadQueue';
import { loadSiteVisitRecord, updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { CapturedPhoto } from '../siteVisit/types';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { colors, radius, spacing } from '../theme/theme';

type PhotoType = 'general' | 'installation';

const CONFIG: Record<
  PhotoType,
  { title: string; subtitle: string; field: 'generalPhotos' | 'installationPhotos'; namePrefix: string }
> = {
  general: {
    title: 'General Site Photos',
    subtitle: 'Roof, floor, corridor, ceiling & surrounding site conditions',
    field: 'generalPhotos',
    namePrefix: 'site-general',
  },
  installation: {
    title: 'Installation Area Photos',
    subtitle: 'Mounting area, electrical area & the exact installation location',
    field: 'installationPhotos',
    namePrefix: 'site-installation',
  },
};

export default function SitePhotosScreen({ route, navigation }: any) {
  const { fieldMovementId, photoType } = route.params as { fieldMovementId: string; photoType: PhotoType };
  const config = CONFIG[photoType];

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<CapturedPhoto[]>([]);

  useEffect(() => {
    loadSiteVisitRecord(fieldMovementId).then((r) => setExisting(r[config.field]));
  }, [fieldMovementId, config.field]);

  async function handleLaunchDeviceCamera() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setCapturedUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera error', 'Could not open device camera app.');
    }
  }

  async function handlePickFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setCapturedUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Gallery error', 'Could not pick image from library.');
    }
  }

  async function handleSave() {
    if (!capturedUri) return;
    setSaving(true);
    const fileName = `${config.namePrefix}-${Date.now()}.jpg`;
    const photoCaption = caption.trim() || undefined;
    try {
      const operationId = await enqueueMediaUpload({
        fieldMovementId,
        endpoint: 'photo',
        fileUri: capturedUri,
        fileName,
        mimeType: 'image/jpeg',
      });

      const entry: CapturedPhoto = {
        id: `${Date.now()}`,
        uri: capturedUri,
        takenAt: new Date().toISOString(),
        uploaded: false,
        caption: photoCaption,
      };
      const updated = await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        [config.field]: [...r[config.field], entry],
      }));
      setExisting(updated[config.field]);
      setCapturedUri(null);
      setCaption('');

      try {
        await uploadFieldFile(fieldMovementId, capturedUri, fileName, 'image/jpeg', operationId, photoCaption);
        await removeFromQueue(operationId);
        const marked = await updateSiteVisitRecord(fieldMovementId, (r) => ({
          ...r,
          [config.field]: r[config.field].map((p) => (p.id === entry.id ? { ...p, uploaded: true } : p)),
        }));
        setExisting(marked[config.field]);
      } catch {
        Alert.alert(
          'Saved for retry',
          'This photo is saved on your device and will upload automatically once you have a connection.'
        );
      }
    } catch {
      Alert.alert('Capture failed', 'The photo could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={config.title}
        onBack={() => navigation.goBack()}
        subtitle={config.subtitle}
      />

      {/* Main Viewport */}
      <View style={styles.cameraWrap}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <View style={styles.placeholderWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="camera-outline" size={42} color={colors.primary} />
            </View>
            <Text style={styles.placeholderTitle}>{config.title}</Text>
            <Text style={styles.placeholderDesc}>{config.subtitle}</Text>
            <View style={styles.tipBadge}>
              <Ionicons name="images-outline" size={14} color={colors.primary} />
              <Text style={styles.tipText}>
                {existing.length} photo{existing.length === 1 ? '' : 's'} recorded so far
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Existing Photos Horizontal Thumbnails Strip */}
      {existing.length > 0 && !capturedUri && (
        <View style={{ marginVertical: spacing.sm }}>
          <FlatList
            horizontal
            data={existing}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            renderItem={({ item }) => (
              <View style={styles.thumbContainer}>
                <Image source={{ uri: item.uri }} style={styles.thumb} />
                {item.caption ? (
                  <Text style={styles.thumbCaption} numberOfLines={1}>
                    {item.caption}
                  </Text>
                ) : null}
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Controls & Action Footer */}
      <View style={styles.footer}>
        {capturedUri ? (
          <View style={{ width: '100%' }}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add photo notes / caption (optional)..."
              placeholderTextColor={colors.textMuted}
              value={caption}
              onChangeText={setCaption}
            />
            <View style={styles.reviewRow}>
              <Button
                title="Retake"
                variant="outline"
                icon="refresh"
                onPress={() => {
                  setCapturedUri(null);
                  setCaption('');
                }}
                style={{ flex: 1, marginRight: spacing.sm }}
                disabled={saving}
              />
              <Button
                title="Save Photo"
                icon="cloud-upload-outline"
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <View style={{ width: '100%', gap: spacing.sm }}>
            <Button
              title="Open Phone Camera to Capture"
              variant="primary"
              icon="camera-outline"
              onPress={handleLaunchDeviceCamera}
              style={{ width: '100%' }}
            />

            <Button
              title="Choose from Gallery"
              variant="outline"
              icon="images-outline"
              onPress={handlePickFromGallery}
              style={{ width: '100%' }}
            />

            <Button
              title={`Done (${existing.length} captured)`}
              variant="secondary"
              icon="checkmark-circle-outline"
              onPress={() => navigation.goBack()}
              style={{ width: '100%', marginTop: 2 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  cameraWrap: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0c1626',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(250, 182, 23, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(250, 182, 23, 0.25)',
  },
  placeholderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  placeholderDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(250, 182, 23, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250, 182, 23, 0.15)',
  },
  tipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '500',
  },
  thumbContainer: { width: 64, marginRight: spacing.sm, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: '#000' },
  thumbCaption: { color: colors.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 2, maxWidth: 64 },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#fff',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  footer: { padding: spacing.lg },
  reviewRow: { flexDirection: 'row' },
});
