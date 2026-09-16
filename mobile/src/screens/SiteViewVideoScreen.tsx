import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { uploadFieldVideo } from '../api/fieldMovements';
import { enqueueMediaUpload, removeFromQueue } from '../tracking/mediaUploadQueue';
import { updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { formatDuration } from '../utils/format';
import { colors, radius, spacing } from '../theme/theme';

export default function SiteViewVideoScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };

  const [elapsedMs, setElapsedMs] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('SiteVisit', { fieldMovementId });
    }
    return true;
  }, [navigation, fieldMovementId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    return () => sub.remove();
  }, [handleGoBack]);

  const player = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = true;
  });

  async function handleLaunchDeviceCamera() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 180,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setVideoUri(result.assets[0].uri);
        if (result.assets[0].duration) {
          setElapsedMs(Math.round(result.assets[0].duration * 1000));
        } else {
          setElapsedMs(15000);
        }
      }
    } catch {
      Alert.alert('Camera error', 'Could not open device camera app.');
    }
  }

  async function handlePickFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setVideoUri(result.assets[0].uri);
        if (result.assets[0].duration) {
          setElapsedMs(Math.round(result.assets[0].duration * 1000));
        } else {
          setElapsedMs(15000);
        }
      }
    } catch {
      Alert.alert('Gallery error', 'Could not pick video from gallery.');
    }
  }

  async function handleSave() {
    if (!videoUri) return;
    setSaving(true);
    const fileName = `site-view-${Date.now()}.mp4`;
    try {
      const operationId = await enqueueMediaUpload({
        fieldMovementId,
        endpoint: 'video',
        fileUri: videoUri,
        fileName,
        mimeType: 'video/mp4',
      });
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        video: {
          uri: videoUri,
          durationSeconds: Math.max(1, Math.round(elapsedMs / 1000)),
          recordedAt: new Date().toISOString(),
          uploaded: false,
        },
      }));

      try {
        await uploadFieldVideo(fieldMovementId, videoUri, fileName, 'video/mp4', operationId);
        await removeFromQueue(operationId);
        await updateSiteVisitRecord(fieldMovementId, (r) => ({
          ...r,
          video: r.video ? { ...r.video, uploaded: true } : r.video,
        }));
      } catch {
        Alert.alert(
          'Saved for retry',
          'The video is saved on your device and will upload automatically once you have a connection.'
        );
      }

      handleGoBack();
    } catch {
      Alert.alert('Save failed', 'The video could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Site Video"
        onBack={handleGoBack}
        subtitle="Capture panoramic / 360° video of the site"
      />

      {/* Main Viewport */}
      <View style={styles.cameraWrap}>
        {videoUri ? (
          <>
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              contentFit="cover"
              nativeControls={false}
            />
            <View style={styles.timerBadge}>
              <Ionicons name="videocam" size={13} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.timerText}>
                {elapsedMs > 0 ? formatDuration(elapsedMs) : 'Video Ready'}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholderWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="videocam-outline" size={42} color={colors.primary} />
            </View>
            <Text style={styles.placeholderTitle}>Record Site Video</Text>
            <Text style={styles.placeholderDesc}>
              Tap below to open your phone's native camera app and record a 360° panoramic video of the site, roof area, and surroundings.
            </Text>
            <View style={styles.tipBadge}>
              <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.tipText}>Up to 3 minutes duration supported</Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer Controls */}
      <View style={styles.footer}>
        {videoUri ? (
          <View style={styles.reviewRow}>
            <Button
              title="Retake"
              variant="outline"
              icon="refresh"
              onPress={() => {
                setVideoUri(null);
                setElapsedMs(0);
              }}
              style={{ flex: 1, marginRight: spacing.sm }}
              disabled={saving}
            />
            <Button
              title="Save Video"
              icon="cloud-upload-outline"
              onPress={handleSave}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={{ width: '100%', gap: spacing.sm }}>
            <Button
              title="Open Phone Camera to Record"
              variant="primary"
              icon="videocam-outline"
              onPress={handleLaunchDeviceCamera}
              style={{ width: '100%' }}
            />

            <Button
              title="Choose Video from Gallery"
              variant="outline"
              icon="images-outline"
              onPress={handlePickFromGallery}
              style={{ width: '100%' }}
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
  },
  placeholderDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.md,
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
  timerBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  timerText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 12,
  },
  footer: {
    padding: spacing.lg,
  },
  reviewRow: {
    flexDirection: 'row',
  },
});
