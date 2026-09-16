import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { trackingManager } from '../tracking/TrackingManager';
import { reverseGeocode } from '../utils/geo';
import { uploadSelfie } from '../api/fieldMovements';
import { enqueueMediaUpload, removeFromQueue } from '../tracking/mediaUploadQueue';
import { loadSiteVisitRecord, updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import { SelfieProof } from '../siteVisit/types';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { formatDateTime, formatDistanceKm } from '../utils/format';
import { colors, radius, spacing } from '../theme/theme';

/**
 * Arrival Proof Selfie — this is a verification record, not a plain photo.
 * The raw camera frame is captured, then re-rendered with the verification
 * overlay (name/date/time/distance/location/GPS + Success Solar branding)
 * burned in via react-native-view-shot BEFORE upload, so the metadata stays
 * physically part of the evidence file rather than only existing as
 * separate app UI. Only real authenticated employee + GPS/tracking data is
 * used — nothing here is fabricated.
 */
export default function SiteSelfieProofScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };
  const { employee } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);
  const shotRef = useRef<ViewShotRef>(null);

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    fixTimestamp: number | null;
  } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const capturedAtRef = useRef<Date>(new Date());

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    loadSiteVisitRecord(fieldMovementId).then((r) => setDistanceMeters(r.travelledDistanceMeters));
  }, [fieldMovementId]);

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      capturedAtRef.current = new Date();
      setCapturedUri(photo?.uri ?? null);

      // A fresh GPS fix at the moment of capture
      const fix = await trackingManager.getCurrentFix().catch(() => null);
      const address = fix ? await reverseGeocode(fix.latitude, fix.longitude) : null;
      setMeta({
        address,
        latitude: fix?.latitude ?? null,
        longitude: fix?.longitude ?? null,
        accuracy: fix?.accuracy ?? null,
        fixTimestamp: fix?.timestamp ?? null,
      });
      if (!fix) {
        Alert.alert(
          'GPS unavailable',
          'A current GPS fix is required for this proof photo. Please retake once location is available.'
        );
      }
    } catch (err) {
      Alert.alert('Capture failed', 'Could not capture the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  function handleRetake() {
    setCapturedUri(null);
    setMeta(null);
  }

  async function handleSave() {
    if (!capturedUri || !employee) return;
    if (meta?.latitude == null || meta?.longitude == null || meta?.accuracy == null || meta?.fixTimestamp == null) {
      Alert.alert(
        'GPS required',
        'A current GPS fix is required to save this proof photo. Please retake so location can be captured.'
      );
      return;
    }
    setSaving(true);
    try {
      // Composite the photo + verification overlay into one real image
      const compositedUri = (await shotRef.current?.capture()) ?? capturedUri;
      const fileName = `selfie-proof-${Date.now()}.jpg`;
      const capturedAtIso = new Date(meta.fixTimestamp).toISOString();

      const operationId = await enqueueMediaUpload({
        fieldMovementId,
        endpoint: 'selfie',
        fileUri: compositedUri,
        fileName,
        mimeType: 'image/jpeg',
        extraFields: {
          latitude: String(meta.latitude),
          longitude: String(meta.longitude),
          accuracy: String(meta.accuracy),
          capturedAt: capturedAtIso,
        },
      });

      const entry: SelfieProof = {
        id: `${Date.now()}`,
        uri: capturedUri,
        compositedUri,
        takenAt: capturedAtRef.current.toISOString(),
        uploaded: false,
        employeeName: employee.name,
        distanceMeters,
        address: meta?.address ?? null,
        latitude: meta?.latitude ?? null,
        longitude: meta?.longitude ?? null,
      };
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        selfieProof: [...r.selfieProof, entry],
      }));

      try {
        await uploadSelfie(
          fieldMovementId, compositedUri, fileName,
          { latitude: meta.latitude, longitude: meta.longitude, accuracy: meta.accuracy, capturedAt: capturedAtIso },
          operationId
        );
        await removeFromQueue(operationId);
        await updateSiteVisitRecord(fieldMovementId, (r) => ({
          ...r,
          selfieProof: r.selfieProof.map((s) => (s.id === entry.id ? { ...s, uploaded: true } : s)),
        }));
      } catch {
        Alert.alert(
          'Saved for retry',
          'The proof photo is saved on this device and will upload automatically once you have a connection.'
        );
      }

      // Navigate directly to SiteVisit work/checklist hub rather than returning Home
      navigation.replace('SiteVisit', { fieldMovementId });
    } catch (err) {
      Alert.alert('Capture failed', 'The proof photo could not be captured. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Arrival Proof Selfie" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
          <Text style={styles.permText}>Camera access is needed to capture site-arrival proof.</Text>
          <Button title="Grant Camera Access" onPress={requestPermission} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Arrival Proof Selfie"
        onBack={() => navigation.goBack()}
        subtitle="Face the camera with the site behind you to confirm arrival"
      />

      <View style={styles.cameraWrap}>
        {capturedUri ? (
          <ViewShot
            ref={shotRef}
            style={StyleSheet.absoluteFill}
            options={{ format: 'jpg', quality: 0.9 }}
          >
            <Image
              source={{ uri: capturedUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={styles.overlay}>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#fff" />
                <Text style={styles.verifiedText}>VERIFIED SITE ARRIVAL — SUCCESS SOLAR</Text>
              </View>
              <Text style={styles.overlayName}>{employee?.name}</Text>
              <View style={styles.overlayRow}>
                <Text style={styles.overlayLabel}>Date & Time</Text>
                <Text style={styles.overlayValue}>{formatDateTime(capturedAtRef.current)}</Text>
              </View>
              {distanceMeters != null && (
                <View style={styles.overlayRow}>
                  <Text style={styles.overlayLabel}>Distance Travelled</Text>
                  <Text style={styles.overlayValue}>{formatDistanceKm(distanceMeters)}</Text>
                </View>
              )}
              <View style={styles.overlayRow}>
                <Text style={styles.overlayLabel}>Location</Text>
                <Text style={styles.overlayValue} numberOfLines={2}>
                  {meta?.address || 'Address unavailable'}
                </Text>
              </View>
              {meta?.latitude != null && meta?.longitude != null && (
                <Text style={styles.overlayCoords}>
                  {meta.latitude.toFixed(5)}, {meta.longitude.toFixed(5)}
                </Text>
              )}
            </View>
          </ViewShot>
        ) : (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing}>
            <TouchableOpacity
              style={styles.flipBtn}
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </CameraView>
        )}
      </View>

      <View style={styles.footer}>
        {capturedUri ? (
          <View style={{ width: '100%', gap: spacing.sm }}>
            <View style={styles.reviewRow}>
              <Button title="Retake" variant="outline" icon="refresh" onPress={handleRetake} style={{ flex: 1, marginRight: spacing.sm }} disabled={saving} />
              <Button title="Save Proof" icon="checkmark" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.shutter} onPress={handleCapture} disabled={capturing}>
            {capturing ? <ActivityIndicator color={colors.navy} /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  permText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  cameraWrap: { flex: 1, margin: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  flipBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.85)',
    padding: spacing.md,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 8,
  },
  verifiedText: { color: '#fff', fontSize: 9, fontWeight: '800', marginLeft: 4, letterSpacing: 0.3 },
  overlayName: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 6 },
  overlayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  overlayLabel: { color: '#94A3B8', fontSize: 11, flex: 1 },
  overlayValue: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1.4, textAlign: 'right' },
  overlayCoords: { color: '#94A3B8', fontSize: 10, marginTop: 6, textAlign: 'right' },
  footer: { padding: spacing.lg, alignItems: 'center' },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary },
  reviewRow: { flexDirection: 'row', width: '100%' },
  flipReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 163, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignSelf: 'center',
    marginBottom: 4,
    gap: 6,
  },
  flipReviewText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
});
