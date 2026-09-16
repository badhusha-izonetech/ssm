import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL } from '../utils/mapConfig';
import { Ionicons } from '@expo/vector-icons';
import { trackingManager } from '../tracking/TrackingManager';
import * as fieldMovementsApi from '../api/fieldMovements';
import { ApiError } from '../api/client';
import { reverseGeocode } from '../utils/geo';
import { updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { formatDistanceKm } from '../utils/format';
import { colors, radius, spacing } from '../theme/theme';
import { describeActionFailure } from '../utils/fieldErrorMessages';

export default function MarkDestinationScreen({ route, navigation }: any) {
  const { fieldMovementId, distanceMeters } = route.params as {
    fieldMovementId: string;
    distanceMeters?: number;
  };

  const [locating, setLocating] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fix = await trackingManager.getCurrentFix();
        if (cancelled) return;
        setCoords({ latitude: fix.latitude, longitude: fix.longitude });
        const addr = await reverseGeocode(fix.latitude, fix.longitude);
        if (!cancelled) setAddress(addr);
      } catch {
        // leave address null — screen still lets them mark with coords absent
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMark() {
    setMarking(true);
    try {
      try {
        await trackingManager.stop();
      } catch {
        // tracking manager may already be stopped
      }
      await fieldMovementsApi.updateFieldMovement(fieldMovementId, {
        destination: address || undefined,
        current_location: address || undefined,
        destination_latitude: coords?.latitude,
        destination_longitude: coords?.longitude,
        geofence_radius_meters: 60,
        status: 'On Field',
      });
      await updateSiteVisitRecord(fieldMovementId, (r) => ({
        ...r,
        destinationMarkedAt: new Date().toISOString(),
        destinationAddress: address,
        destinationCoords: coords ? { latitude: coords.latitude, longitude: coords.longitude } : null,
        geofenceRadiusMeters: 60,
        travelledDistanceMeters: distanceMeters ?? r.travelledDistanceMeters,
      }));
      // Direct protocol transition: destination marked & tracking complete -> take to Work / Site hub
      navigation.replace('SiteVisit', { fieldMovementId });
    } catch (err) {
      const message = describeActionFailure(err).message;
      Alert.alert('Error', message);
    } finally {
      setMarking(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mark Destination" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={40} color={colors.primary} />
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        </View>
        <Text style={styles.title}>I have reached my destination</Text>
        <Text style={styles.subtitle}>Please confirm your current location{address ? ` — ${address}` : ''}</Text>

        <Text style={styles.label}>Current Location</Text>
        <Card style={styles.locationCard} padded>
          {locating ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.locationText}>{address || 'Address unavailable — GPS coordinates only'}</Text>
            </View>
          )}
        </Card>

        {typeof distanceMeters === 'number' && (
          <Card style={styles.distanceCard} padded>
            <Ionicons name="navigate-outline" size={16} color={colors.info} />
            <Text style={styles.distanceText}>Distance travelled: {formatDistanceKm(distanceMeters)}</Text>
          </Card>
        )}

        <View style={styles.mapWrap}>
          {coords ? (
            <Map
              style={StyleSheet.absoluteFill}
              mapStyle={MAP_STYLE_URL}
              logo={false}
              dragPan={false}
              touchZoom={false}
              touchRotate={false}
              touchPitch={false}
            >
              <Camera center={[coords.longitude, coords.latitude]} zoom={16} />
              <Marker lngLat={[coords.longitude, coords.latitude]}>
                <View style={styles.pinWrap}>
                  <Ionicons name="location" size={32} color={colors.primary} />
                </View>
              </Marker>
            </Map>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
              <ActivityIndicator color={colors.textMuted} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Mark as Destination" onPress={handleMark} loading={marking} disabled={locating} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 },
  label: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 6 },
  locationCard: { width: '100%' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 13, color: colors.textPrimary, marginLeft: 8, flex: 1 },
  distanceCard: { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, backgroundColor: colors.infoSoft, borderColor: colors.infoSoft },
  distanceText: { fontSize: 13, color: colors.info, fontWeight: '600', marginLeft: 8 },
  mapWrap: { width: '100%', height: 180, borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.lg, backgroundColor: '#E2E8F0' },
  mapFallback: { alignItems: 'center', justifyContent: 'center' },
  pinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  footer: { padding: spacing.lg },

});
