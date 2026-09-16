import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AppState,
  TouchableOpacity,
  Linking,
  Platform,
  BackHandler,
} from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL } from '../utils/mapConfig';
import { Ionicons } from '@expo/vector-icons';
import { trackingManager } from '../tracking/TrackingManager';
import { consumeLastLocationTaskError } from '../tracking/locationTask';
import { SyncStatusResult } from '../tracking/syncStatus';
import * as fieldMovementsApi from '../api/fieldMovements';
import * as siteVisitsApi from '../api/siteVisits';
import * as leadsApi from '../api/leads';
import { FieldMovementRead, GpsFix } from '../types';
import { ApiError } from '../api/client';
import { updateSiteVisitRecord } from '../siteVisit/localSiteVisitStore';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import StatChip from '../components/StatChip';
import { distanceMeters, routeDistanceMeters, reverseGeocode, geocode } from '../utils/geo';
import { formatDistanceKm, formatDuration, formatSpeedKmh, formatRelativeTime } from '../utils/format';
import { colors, radius, spacing } from '../theme/theme';
import { describeActionFailure } from '../utils/fieldErrorMessages';

function getZoomForDistance(distMeters: number): number {
  if (distMeters > 50000) return 9;
  if (distMeters > 25000) return 10;
  if (distMeters > 12000) return 11;
  if (distMeters > 6000) return 12;
  if (distMeters > 3000) return 13;
  if (distMeters > 1500) return 14;
  if (distMeters > 800) return 15;
  return 16;
}

function openExternalNavigation(lat: number, lng: number, label?: string) {
  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const scheme = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label || 'Destination')}@${lat},${lng}`,
    android: `google.navigation:q=${lat},${lng}`,
  });

  if (scheme) {
    Linking.canOpenURL(scheme)
      .then((supported) => {
        if (supported) {
          Linking.openURL(scheme);
        } else {
          Linking.openURL(fallbackUrl);
        }
      })
      .catch(() => {
        Linking.openURL(fallbackUrl);
      });
  } else {
    Linking.openURL(fallbackUrl);
  }
}

interface DestinationInfo {
  latitude: number;
  longitude: number;
  title: string;
  address?: string;
}

interface NearbyLeadMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export default function TrackingLiveScreen({ route, navigation }: any) {
  const { fieldMovementId, mode = 'outbound' } = route.params as {
    fieldMovementId: string;
    mode?: 'outbound' | 'return';
  };
  const isReturn = mode === 'return';

  const [fm, setFm] = useState<FieldMovementRead | null>(null);
  const [queueDepth, setQueueDepth] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResult | null>(null);
  const [lastFix, setLastFix] = useState<GpsFix | null>(null);
  const [routePoints, setRoutePoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [permissionOutcome, setPermissionOutcome] = useState<'granted' | 'foreground_only' | 'denied' | null>(null);
  const [taskWarning, setTaskWarning] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Destination & Nearby context
  const [destination, setDestination] = useState<DestinationInfo | null>(null);
  const [nearbyLocality, setNearbyLocality] = useState<string | null>(null);
  const [nearbyLeads, setNearbyLeads] = useState<NearbyLeadMarker[]>([]);
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>('follow');

  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const lastGeocodeTimeRef = useRef<number>(0);

  const resolveDestination = useCallback(async (movement: FieldMovementRead) => {
    let resolvedLat: number | null = null;
    let resolvedLng: number | null = null;
    let title = movement.destination || movement.purpose || 'Destination';
    let address = movement.destination || '';

    if (movement.site_visit_id) {
      try {
        const sv = await siteVisitsApi.getSiteVisit(movement.site_visit_id);
        if (sv) {
          if (typeof sv.customer_latitude === 'number' && typeof sv.customer_longitude === 'number') {
            resolvedLat = sv.customer_latitude;
            resolvedLng = sv.customer_longitude;
          }
          if (sv.customer_name) title = String(sv.customer_name);
          const svAddr = (sv.site_address as string) || (sv.area as string);
          if (svAddr) address = svAddr;
        }
      } catch {
        // non-fatal
      }
    }

    if (movement.lead_id && (!resolvedLat || !resolvedLng || title === 'Destination' || !address)) {
      try {
        const ld = await leadsApi.getLead(movement.lead_id);
        if (ld) {
          if (ld.customer_name) title = ld.customer_name;
          const ldAddr = [ld.site_address || ld.address, ld.area].filter(Boolean).join(', ');
          if (ldAddr) address = ldAddr;
        }
      } catch {
        // non-fatal
      }
    }

    if ((resolvedLat === null || resolvedLng === null) && address) {
      const coords = await geocode(address);
      if (coords) {
        resolvedLat = coords.latitude;
        resolvedLng = coords.longitude;
      }
    }

    if (resolvedLat !== null && resolvedLng !== null) {
      setDestination({
        latitude: resolvedLat,
        longitude: resolvedLng,
        title,
        address,
      });
    }
  }, []);

  const refreshFm = useCallback(async () => {
    try {
      const res = await fieldMovementsApi.listMine(1, 30);
      const found = res.items.find((f) => f.id === fieldMovementId);
      if (found) {
        setFm(found);
        resolveDestination(found);
      }
    } catch {
      // non-fatal
    }
  }, [fieldMovementId, resolveDestination]);

  const updateLocality = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastGeocodeTimeRef.current < 20000) return;
    lastGeocodeTimeRef.current = now;
    try {
      const addr = await reverseGeocode(lat, lng);
      if (addr) setNearbyLocality(addr);
    } catch {
      // non-fatal
    }
  }, []);

  const loadNearbyLeads = useCallback(async () => {
    try {
      const res = await leadsApi.listAssignedFieldLeads(1, 10);
      if (res.items && res.items.length > 0) {
        const plotted: NearbyLeadMarker[] = [];
        for (const item of res.items.slice(0, 4)) {
          const addr = item.site_address || item.address || item.area || '';
          if (addr) {
            const coords = await geocode(addr);
            if (coords) {
              plotted.push({
                id: item.id,
                name: item.customer_name,
                latitude: coords.latitude,
                longitude: coords.longitude,
                address: addr,
              });
            }
          }
        }
        setNearbyLeads(plotted);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function begin() {
      if (startedRef.current) return;
      startedRef.current = true;
      startTimeRef.current = Date.now();

      const servicesOn = await trackingManager.isLocationServicesEnabled();
      if (!servicesOn) {
        Alert.alert('Location is off', 'Please enable Location Services for this device before starting tracking.');
        setStarting(false);
        return;
      }

      const outcome = await trackingManager.requestPermissions();
      if (cancelled) return;
      setPermissionOutcome(outcome);

      if (outcome === 'denied') {
        Alert.alert(
          'Location permission required',
          'Success Solar Field needs location access to track your field work. Please enable it in system settings.'
        );
        setStarting(false);
        return;
      }
      if (outcome === 'foreground_only') {
        Alert.alert(
          'Background location not granted',
          "Tracking will pause while the app is backgrounded or the phone is locked. For continuous tracking, allow location access \"All the time\" in system settings."
        );
      }

      // Pre-load historical route points recorded for this session so the map
      // is immediately populated with the existing route trail
      try {
        const locs = await fieldMovementsApi.listLocations(fieldMovementId, 500);
        if (!cancelled && locs.items && locs.items.length > 0) {
          const sorted = [...locs.items].sort(
            (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
          );
          setRoutePoints(sorted.map((l) => ({ latitude: l.latitude, longitude: l.longitude })));
          const latest = sorted[sorted.length - 1];
          setLastFix({
            latitude: latest.latitude,
            longitude: latest.longitude,
            accuracy: latest.accuracy,
            speed: latest.speed,
            heading: latest.heading,
            timestamp: new Date(latest.captured_at).getTime(),
          });
          updateLocality(latest.latitude, latest.longitude);
        }
      } catch {
        // non-fatal if historical route points not loaded
      }

      await trackingManager.start(fieldMovementId, {
        onQueueDepth: (depth) => !cancelled && setQueueDepth(depth),
        onSyncStatus: (result) => !cancelled && setSyncStatus(result),
        onFix: (fix) => {
          if (cancelled) return;
          setLastFix(fix);
          setRoutePoints((prev) => [...prev, { latitude: fix.latitude, longitude: fix.longitude }]);
          updateLocality(fix.latitude, fix.longitude);
        },
        onError: (message) => {
          if (!cancelled) console.warn('[tracking]', message);
        },
      });

      await refreshFm();
      loadNearbyLeads();
      if (!cancelled) setStarting(false);
    }

    begin();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshFm();
        checkForTaskWarnings();
      }
    });

    async function checkForTaskWarnings() {
      const lastError = await consumeLastLocationTaskError();
      if (lastError) setTaskWarning(lastError.message);
      const servicesOn = await trackingManager.isLocationServicesEnabled();
      if (!servicesOn) {
        setTaskWarning('Location services are turned off — tracking has paused. Please re-enable them.');
      }
    }
    checkForTaskWarnings();

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [fieldMovementId, refreshFm, updateLocality, loadNearbyLeads]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'TodayWork' }] });
    }
    return true;
  }, [navigation]);

  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    return () => backSub.remove();
  }, [handleGoBack]);

  const distanceMetersTraveled = routeDistanceMeters(routePoints);

  function handlePause() {
    Alert.alert('Pause not available', 'Pausing mid-journey isn\u2019t supported yet \u2014 use End Tracking once you reach the site.');
  }

  async function handleEnd() {
    if (isReturn) {
      Alert.alert('Arrived?', 'This confirms your return journey is complete and checks you out.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "I've Arrived",
          onPress: async () => {
            setStopping(true);
            try {
              await trackingManager.stop();
              await fieldMovementsApi.stopFieldMovement(fieldMovementId);
              await updateSiteVisitRecord(fieldMovementId, (r) => ({
                ...r,
                returnMovement: {
                  ...r.returnMovement,
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                  distanceMeters: Math.round(distanceMetersTraveled),
                },
              }));
              navigation.reset({ index: 0, routes: [{ name: 'TodayWork' }] });
            } catch (err) {
              const message = describeActionFailure(err).message;
              Alert.alert('Error', message);
            } finally {
              setStopping(false);
            }
          },
        },
      ]);
      return;
    }

    Alert.alert('Reached your destination?', 'This will stop live location tracking so you can mark the destination.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Tracking',
        style: 'destructive',
        onPress: async () => {
          setStopping(true);
          try {
            await trackingManager.stop();
            navigation.replace('MarkDestination', {
              fieldMovementId,
              distanceMeters: Math.round(distanceMetersTraveled),
            });
          } catch (err) {
            const message = describeActionFailure(err).message;
            Alert.alert('Error', message);
          } finally {
            setStopping(false);
          }
        },
      },
    ]);
  }

  if (starting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Starting tracking…</Text>
      </View>
    );
  }

  const current = lastFix
    ? { latitude: lastFix.latitude, longitude: lastFix.longitude }
    : routePoints[routePoints.length - 1];

  const distanceToDestination =
    current && destination ? distanceMeters(current, destination) : null;

  // Calculate camera center & zoom based on cameraMode
  let cameraCenter: [number, number] = current
    ? [current.longitude, current.latitude]
    : [80.2707, 13.0827]; // fallback Chennai
  let cameraZoom = 16;

  if (cameraMode === 'overview' && current && destination) {
    cameraCenter = [
      (current.longitude + destination.longitude) / 2,
      (current.latitude + destination.latitude) / 2,
    ];
    cameraZoom = getZoomForDistance(distanceToDestination || 1000);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isReturn ? 'Returning' : 'Tracking Live'}
        onBack={handleGoBack}
        liveBadge
        subtitle={isReturn ? 'Real GPS tracking your journey back' : fm?.purpose || fm?.destination || undefined}
      />

      <View style={styles.statsRow}>
        <StatChip icon="time-outline" label="Duration" value={formatDuration(elapsedMs)} tint={colors.info} />
        <StatChip icon="navigate-outline" label="Distance" value={formatDistanceKm(distanceMetersTraveled)} tint={colors.success} />
        <StatChip icon="speedometer-outline" label="Avg Speed" value={formatSpeedKmh(lastFix?.speed)} tint={colors.primary} />
      </View>

      <View style={styles.mapWrap}>
        {current ? (
          <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL} logo={false}>
            <Camera center={cameraCenter} zoom={cameraZoom} duration={300} />

            {/* Travelled Route Polyline */}
            {routePoints.length > 1 && (
              <GeoJSONSource
                id="fieldMovementRoute"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: routePoints.map((p) => [p.longitude, p.latitude]),
                  },
                }}
              >
                <Layer
                  id="fieldMovementRouteLine"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': colors.success, 'line-width': 5 }}
                />
              </GeoJSONSource>
            )}

            {/* Direct Planned Path to Destination */}
            {destination && (
              <GeoJSONSource
                id="destinationGuideLine"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [current.longitude, current.latitude],
                      [destination.longitude, destination.latitude],
                    ],
                  },
                }}
              >
                <Layer
                  id="destinationGuideLineLayer"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{
                    'line-color': colors.primary,
                    'line-width': 3,
                    'line-dasharray': [2, 2],
                  }}
                />
              </GeoJSONSource>
            )}

            {/* Current Employee Location Marker */}
            <Marker lngLat={[current.longitude, current.latitude]}>
              <View style={styles.currentDotWrap}>
                <View style={styles.currentDotPulse} />
                <View style={styles.currentDot} />
              </View>
            </Marker>

            {/* Destination Target Marker */}
            {destination && (
              <Marker lngLat={[destination.longitude, destination.latitude]}>
                <View style={styles.destPinContainer}>
                  <View style={styles.destPinCallout}>
                    <Ionicons name="flag" size={11} color="#fff" />
                    <Text style={styles.destPinText} numberOfLines={1}>
                      {destination.title}
                    </Text>
                  </View>
                  <Ionicons name="location" size={32} color={colors.danger} />
                </View>
              </Marker>
            )}

            {/* Other Nearby Assigned Leads */}
            {nearbyLeads.map((lead) => (
              <Marker key={lead.id} lngLat={[lead.longitude, lead.latitude]}>
                <View style={styles.nearbyPinContainer}>
                  <View style={styles.nearbyCallout}>
                    <Text style={styles.nearbyCalloutText} numberOfLines={1}>
                      {lead.name}
                    </Text>
                  </View>
                  <Ionicons name="business" size={20} color={colors.primary} />
                </View>
              </Marker>
            ))}
          </Map>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
            <Ionicons name="map-outline" size={26} color={colors.textMuted} />
            <Text style={styles.mapFallbackText}>Waiting for GPS fix…</Text>
          </View>
        )}

        {/* Top Badges */}
        <View style={styles.topBadgesRow}>
          <View style={styles.connBadge}>
            <View style={[styles.connDot, { backgroundColor: syncStatusColor(syncStatus?.status) }]} />
            <Text style={styles.connText}>
              {syncStatus?.label ?? 'Starting…'}
              {queueDepth > 0 ? ` · ${queueDepth} queued` : ''}
            </Text>
          </View>

          {syncStatus?.lastSyncedAt !== undefined && (
            <View style={styles.lastSyncBadge}>
              <Text style={styles.lastSyncText}>
                Last synced: {formatRelativeTime(syncStatus?.lastSyncedAt ?? null)}
              </Text>
            </View>
          )}
        </View>

        {/* Locality Chip */}
        {nearbyLocality && (
          <View style={styles.localityBadge}>
            <Ionicons name="compass-outline" size={13} color={colors.primary} />
            <Text style={styles.localityText} numberOfLines={1}>
              Near {nearbyLocality}
            </Text>
          </View>
        )}

        {/* Floating Map Actions */}
        <View style={styles.floatingControls}>
          {destination && (
            <TouchableOpacity
              style={[styles.controlBtn, cameraMode === 'overview' && styles.controlBtnActive]}
              onPress={() => setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))}
            >
              <Ionicons
                name={cameraMode === 'overview' ? 'locate' : 'map'}
                size={20}
                color={cameraMode === 'overview' ? '#fff' : colors.navy}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setCameraMode('follow')}
          >
            <Ionicons name="navigate" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Destination & Navigation Overlay Card */}
        {destination && (
          <View style={styles.destCard}>
            <View style={styles.destHeader}>
              <View style={styles.destIconBadge}>
                <Ionicons name="location" size={18} color="#fff" />
              </View>
              <View style={styles.destTextWrap}>
                <Text style={styles.destTitle} numberOfLines={1}>
                  {destination.title}
                </Text>
                {destination.address ? (
                  <Text style={styles.destSubtitle} numberOfLines={1}>
                    {destination.address}
                  </Text>
                ) : null}
              </View>
              {distanceToDestination !== null && (
                <View style={styles.distChip}>
                  <Text style={styles.distChipValue}>
                    {formatDistanceKm(distanceToDestination)}
                  </Text>
                  <Text style={styles.distChipLabel}>away</Text>
                </View>
              )}
            </View>

            <View style={styles.destActionsRow}>
              <TouchableOpacity
                style={styles.openNavBtn}
                onPress={() =>
                  openExternalNavigation(
                    destination.latitude,
                    destination.longitude,
                    destination.title
                  )
                }
              >
                <Ionicons name="navigate-circle" size={16} color="#fff" />
                <Text style={styles.openNavBtnText}>Open in Google Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleViewBtn}
                onPress={() =>
                  setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))
                }
              >
                <Text style={styles.toggleViewBtnText}>
                  {cameraMode === 'follow' ? 'Full Route' : 'Follow Me'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {(permissionOutcome === 'foreground_only' || taskWarning) && (
        <Card style={styles.warningCard} padded>
          {permissionOutcome === 'foreground_only' && (
            <Text style={styles.warningText}>
              Background permission not granted — tracking pauses when the app isn't in the foreground.
            </Text>
          )}
          {taskWarning && <Text style={styles.warningText}>{taskWarning}</Text>}
        </Card>
      )}

      <View style={styles.footer}>
        <Button
          title={isReturn ? "I've Arrived" : 'End Tracking / Reach Destination'}
          variant={isReturn ? 'success' : 'primary'}
          icon={isReturn ? 'checkmark-circle' : 'location'}
          onPress={handleEnd}
          loading={stopping}
          style={styles.endBtn}
        />
      </View>
    </View>
  );
}

/** Maps the derived sync status to a badge color — real severity, not decoration. */
function syncStatusColor(status?: SyncStatusResult['status']): string {
  switch (status) {
    case 'live':
    case 'synced':
      return colors.success;
    case 'syncing':
    case 'upload_pending':
    case 'network_delayed':
    case 'reconnecting':
      return colors.warning;
    case 'offline':
    case 'gps_unavailable':
    case 'failed_retry':
      return colors.danger;
    case 'stopped':
      return colors.textMuted;
    default:
      return colors.warning;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  centerText: { marginTop: 12, color: colors.textMuted },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: colors.navy },
  mapWrap: { flex: 1, margin: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  mapFallback: { alignItems: 'center', justifyContent: 'center' },
  mapFallbackText: { color: colors.textMuted, fontSize: 12, marginTop: 8 },

  // Current Dot
  currentDotWrap: { alignItems: 'center', justifyContent: 'center' },
  currentDotPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
  },
  currentDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },

  // Destination Pin
  destPinContainer: { alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  destPinCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  destPinText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 3, maxWidth: 110 },

  // Nearby Lead Pin
  nearbyPinContainer: { alignItems: 'center', justifyContent: 'center' },
  nearbyCallout: {
    backgroundColor: colors.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 1,
  },
  nearbyCalloutText: { color: '#fff', fontSize: 9, fontWeight: '600', maxWidth: 80 },

  // Top Badges
  topBadgesRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  connDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  connText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  lastSyncBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  lastSyncText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

  // Locality Badge
  localityBadge: {
    position: 'absolute',
    top: 48,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  localityText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, marginLeft: 5, flex: 1 },

  // Floating Controls
  floatingControls: {
    position: 'absolute',
    right: spacing.sm,
    top: 90,
    alignItems: 'center',
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  controlBtnActive: {
    backgroundColor: colors.navy,
  },

  // Destination Card
  destCard: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.md,
    padding: spacing.sm,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  destHeader: { flexDirection: 'row', alignItems: 'center' },
  destIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  destTextWrap: { flex: 1 },
  destTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  destSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  distChip: { alignItems: 'flex-end', marginLeft: spacing.xs },
  distChipValue: { fontSize: 13, fontWeight: '700', color: colors.primary },
  distChipLabel: { fontSize: 9, color: colors.textMuted },
  destActionsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  openNavBtnText: { color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  toggleViewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  toggleViewBtnText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },


  warningCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
  warningText: { color: colors.warning, fontSize: 12 },
  footer: { flexDirection: 'row', padding: spacing.lg, paddingTop: 0 },
  endBtn: { flex: 1 },
});
