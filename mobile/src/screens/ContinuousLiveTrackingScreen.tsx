import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AppState,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
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
import * as leadsApi from '../api/leads';
import { FieldMovementRead, FieldMovementPinRead, GpsFix } from '../types';
import { distanceMeters, routeDistanceMeters, reverseGeocode } from '../utils/geo';
import { formatDistanceKm, formatDuration, formatSpeedKmh } from '../utils/format';
import { colors, radius, spacing } from '../theme/theme';

interface PinnedStop {
  id: string;
  latitude: number;
  longitude: number;
  place_name?: string | null;
  reason: string;
  pinned_at: string;
}

export default function ContinuousLiveTrackingScreen({ route, navigation }: any) {
  const { fieldMovementId } = route.params as { fieldMovementId: string };

  const [fm, setFm] = useState<FieldMovementRead | null>(null);
  const [lastFix, setLastFix] = useState<GpsFix | null>(null);
  const [routePoints, setRoutePoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [pinnedStops, setPinnedStops] = useState<PinnedStop[]>([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResult | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('Locating...');
  const [reasonInput, setReasonInput] = useState<string>('');
  const [pinning, setPinning] = useState(false);
  const [assignedLeadCount, setAssignedLeadCount] = useState(0);

  // Stationary state tracking
  const [stationaryAlertActive, setStationaryAlertActive] = useState(false);
  const [locationOffAlertActive, setLocationOffAlertActive] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  const anchorFixRef = useRef<GpsFix | null>(null);
  const stationarySinceRef = useRef<number>(Date.now());
  const alertSentForCurrentStationaryRef = useRef<boolean>(false);
  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const lastGeocodeTimeRef = useRef<number>(0);

  // Load pinned stops and assigned leads
  const loadData = useCallback(async () => {
    try {
      const [fmsRes, pinsRes, leadsRes] = await Promise.allSettled([
        fieldMovementsApi.listMine(1, 30),
        fieldMovementsApi.listPins(fieldMovementId),
        leadsApi.listAssignedFieldLeads(1, 50),
      ]);

      if (fmsRes.status === 'fulfilled') {
        const found = fmsRes.value.items.find((f) => f.id === fieldMovementId);
        if (found) setFm(found);
      }
      if (pinsRes.status === 'fulfilled') {
        setPinnedStops(pinsRes.value || []);
      }
      if (leadsRes.status === 'fulfilled') {
        setAssignedLeadCount(leadsRes.value.total || 0);
      }
    } catch {
      // non-fatal
    }
  }, [fieldMovementId]);

  // Update current reverse-geocoded locality
  const updateAddress = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastGeocodeTimeRef.current < 15000) return;
    lastGeocodeTimeRef.current = now;
    try {
      const addr = await reverseGeocode(lat, lng);
      if (addr) setCurrentAddress(addr);
    } catch {
      // non-fatal
    }
  }, []);

  // Check stationary status (>30 mins within 50m without pin)
  const checkStationary = useCallback(
    async (fix: GpsFix) => {
      const now = Date.now();
      if (!anchorFixRef.current) {
        anchorFixRef.current = fix;
        stationarySinceRef.current = now;
        alertSentForCurrentStationaryRef.current = false;
        return;
      }

      const dist = distanceMeters(
        { latitude: anchorFixRef.current.latitude, longitude: anchorFixRef.current.longitude },
        { latitude: fix.latitude, longitude: fix.longitude }
      );

      if (dist <= 50) {
        const durationStationaryMs = now - stationarySinceRef.current;
        // 30 minutes = 1800000 ms
        if (durationStationaryMs >= 1800000 && !alertSentForCurrentStationaryRef.current) {
          alertSentForCurrentStationaryRef.current = true;
          setStationaryAlertActive(true);

          try {
            await fieldMovementsApi.sendStationaryAlert(fieldMovementId, {
              latitude: fix.latitude,
              longitude: fix.longitude,
              duration_minutes: Math.round(durationStationaryMs / 60000),
              address: currentAddress,
            });
          } catch {
            // non-fatal
          }

          Alert.alert(
            '⚠️ Stationary Alert (>30 mins)',
            'You have remained within 50 meters for over 30 minutes without marking a pinned update. Please pin your location and state why you are here.'
          );
        }
      } else {
        // Moved outside 50m radius — reset stationary anchor
        anchorFixRef.current = fix;
        stationarySinceRef.current = now;
        alertSentForCurrentStationaryRef.current = false;
        setStationaryAlertActive(false);
      }
    },
    [fieldMovementId, currentAddress]
  );

  // Initialize tracking
  useEffect(() => {
    let cancelled = false;

    async function begin() {
      if (startedRef.current) return;
      startedRef.current = true;
      startTimeRef.current = Date.now();

      const servicesOn = await trackingManager.isLocationServicesEnabled();
      if (!servicesOn) {
        setLocationOffAlertActive(true);
        Alert.alert('Location is off', 'Please enable Location Services for continuous live tracking.');
      }

      const outcome = await trackingManager.requestPermissions();
      if (cancelled) return;

      if (outcome === 'denied') {
        Alert.alert(
          'Location permission required',
          'Continuous field tracking requires location permissions. Please allow location in settings.'
        );
        return;
      }

      // Pre-load past route points for this session
      try {
        const locs = await fieldMovementsApi.listLocations(fieldMovementId, 500);
        if (!cancelled && locs.items && locs.items.length > 0) {
          const sorted = [...locs.items].sort(
            (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
          );
          setRoutePoints(sorted.map((l) => ({ latitude: l.latitude, longitude: l.longitude })));
          const latest = sorted[sorted.length - 1];
          const latestFix: GpsFix = {
            latitude: latest.latitude,
            longitude: latest.longitude,
            accuracy: latest.accuracy,
            speed: latest.speed,
            heading: latest.heading,
            timestamp: new Date(latest.captured_at).getTime(),
          };
          setLastFix(latestFix);
          anchorFixRef.current = latestFix;
          updateAddress(latest.latitude, latest.longitude);
        }
      } catch {
        // non-fatal
      }

      // Start background tracking
      await trackingManager.start(fieldMovementId, {
        onQueueDepth: (depth) => !cancelled && setQueueDepth(depth),
        onSyncStatus: (result) => !cancelled && setSyncStatus(result),
        onFix: (fix) => {
          if (cancelled) return;
          setLastFix(fix);
          setRoutePoints((prev) => [...prev, { latitude: fix.latitude, longitude: fix.longitude }]);
          updateAddress(fix.latitude, fix.longitude);
          checkStationary(fix);
        },
        onError: (err) => {
          if (!cancelled) console.warn('[continuous tracking]', err);
        },
      });

      loadData();
    }

    begin();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadData();
        checkLocationServices();
      }
    });

    async function checkLocationServices() {
      const servicesOn = await trackingManager.isLocationServicesEnabled();
      if (!servicesOn) {
        setLocationOffAlertActive(true);
        try {
          await fieldMovementsApi.sendLocationOffAlert(fieldMovementId, {
            reason: 'Employee disabled location services',
            last_latitude: lastFix?.latitude,
            last_longitude: lastFix?.longitude,
          });
        } catch {
          // non-fatal
        }
      } else {
        setLocationOffAlertActive(false);
      }
    }
    checkLocationServices();

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [fieldMovementId, loadData, updateAddress, checkStationary]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGoBack = useCallback(() => {
    // Navigating back leaves continuous live tracking active in the background
    navigation.reset({ index: 0, routes: [{ name: 'TodayWork' }] });
    return true;
  }, [navigation]);

  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    return () => backSub.remove();
  }, [handleGoBack]);

  // Handle Pinning Current Location
  const handlePinLocation = async () => {
    if (!lastFix) {
      Alert.alert('Acquiring GPS fix', 'Waiting for accurate GPS coordinates before pinning location.');
      return;
    }
    if (!reasonInput.trim()) {
      Alert.alert('Reason Required', 'Please enter why you are at this location (e.g. random lead meeting, tea break, site survey).');
      return;
    }

    setPinning(true);
    try {
      const clientOpId = `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPin = await fieldMovementsApi.addPin(fieldMovementId, {
        latitude: lastFix.latitude,
        longitude: lastFix.longitude,
        accuracy: lastFix.accuracy,
        place_name: currentAddress !== 'Locating...' ? currentAddress : null,
        reason: reasonInput.trim(),
        pinned_at: new Date().toISOString(),
        client_operation_id: clientOpId,
        duration_minutes: Math.round((Date.now() - stationarySinceRef.current) / 60000),
      });

      setPinnedStops((prev) => [newPin, ...prev]);
      setReasonInput('');
      setStationaryAlertActive(false);
      // Reset stationary timer since employee explicitly acknowledged and pinned this location
      anchorFixRef.current = lastFix;
      stationarySinceRef.current = Date.now();
      alertSentForCurrentStationaryRef.current = false;

      Alert.alert('📍 Location Pinned', `Successfully recorded pinned stop at ${currentAddress || 'current coordinates'}.`);
    } catch (e: any) {
      Alert.alert('Could not pin location', e?.message || 'Check network connection.');
    } finally {
      setPinning(false);
    }
  };

  const distanceMetersTraveled = routeDistanceMeters(routePoints);
  const currentCoords = lastFix
    ? { latitude: lastFix.latitude, longitude: lastFix.longitude }
    : routePoints[routePoints.length - 1];

  const cameraCenter: [number, number] = currentCoords
    ? [currentCoords.longitude, currentCoords.latitude]
    : [80.2707, 13.0827]; // default Chennai fallback

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Top Header ── */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.headerTitle}>Continuous Live Tracking</Text>
          </View>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {currentAddress}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.leadsBtn}
          onPress={() => navigation.navigate('AssignedWorkInbox')}
        >
          <Ionicons name="clipboard" size={16} color="#fff" />
          <Text style={styles.leadsBtnText}>Leads ({assignedLeadCount})</Text>
        </TouchableOpacity>
      </View>

      {/* ── Status Alerts Bar ── */}
      {locationOffAlertActive && (
        <View style={styles.warningAlertBar}>
          <Ionicons name="alert-circle" size={18} color="#fff" />
          <Text style={styles.warningAlertText}>
            Location turned off! Tracking paused. Re-enable location services.
          </Text>
        </View>
      )}

      {stationaryAlertActive && (
        <View style={styles.stationaryAlertBar}>
          <Ionicons name="time" size={18} color="#fff" />
          <Text style={styles.stationaryAlertText}>
            Stationary (30+ mins)! Please pin your location and state why you stopped here.
          </Text>
        </View>
      )}

      {/* ── Metrics Chip Bar ── */}
      <View style={styles.metricsBar}>
        <View style={styles.metricItem}>
          <Ionicons name="time-outline" size={14} color={colors.info} />
          <Text style={styles.metricVal}>{formatDuration(elapsedMs)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Ionicons name="navigate-outline" size={14} color={colors.success} />
          <Text style={styles.metricVal}>{formatDistanceKm(distanceMetersTraveled)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Ionicons name="speedometer-outline" size={14} color={colors.primary} />
          <Text style={styles.metricVal}>{formatSpeedKmh(lastFix?.speed)}</Text>
        </View>
        {queueDepth > 0 && (
          <>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
              <Text style={[styles.metricVal, { color: colors.warning }]}>Queued: {queueDepth}</Text>
            </View>
          </>
        )}
      </View>

      {/* ── Full Viewport Real Map ── */}
      <View style={styles.mapContainer}>
        {currentCoords ? (
          <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL} logo={false}>
            <Camera center={cameraCenter} zoom={16} duration={250} />

            {/* Travelled Route Polyline */}
            {routePoints.length > 1 && (
              <GeoJSONSource
                id="continuousRouteTrail"
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
                  id="continuousRouteLine"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': colors.success, 'line-width': 5 }}
                />
              </GeoJSONSource>
            )}

            {/* Strictly Non-Draggable Real GPS Location Marker */}
            <Marker lngLat={[currentCoords.longitude, currentCoords.latitude]}>
              <View style={styles.puckWrap}>
                <View style={styles.puckRing} />
                <View style={styles.puckDot} />
              </View>
            </Marker>

            {/* Markers for Today's Pinned Stops */}
            {pinnedStops.map((stop) => (
              <Marker key={stop.id} lngLat={[stop.longitude, stop.latitude]}>
                <View style={styles.pinMarkerContainer}>
                  <View style={styles.pinCallout}>
                    <Text style={styles.pinCalloutText} numberOfLines={1}>
                      {stop.reason}
                    </Text>
                  </View>
                  <Ionicons name="location" size={30} color={colors.primary} />
                </View>
              </Marker>
            ))}
          </Map>
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Acquiring accurate GPS signal…</Text>
          </View>
        )}
      </View>

      {/* ── Bottom Pinning Drawer / Control Sheet ── */}
      <View style={[styles.drawer, drawerExpanded && styles.drawerExpanded]}>
        <TouchableOpacity
          style={styles.dragHandle}
          activeOpacity={0.8}
          onPress={() => setDrawerExpanded(!drawerExpanded)}
        >
          <View style={styles.handleBar} />
          <View style={styles.drawerTitleRow}>
            <Text style={styles.drawerTitle}>
              📍 Pin Place & Mark Location
            </Text>
            <Ionicons
              name={drawerExpanded ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {/* Input & Pin CTA */}
        <View style={styles.pinInputRow}>
          <TextInput
            style={styles.reasonInput}
            placeholder="Why are you here? (e.g. Random lead visit, tea break, client follow-up)"
            placeholderTextColor={colors.textMuted}
            value={reasonInput}
            onChangeText={setReasonInput}
          />
          <TouchableOpacity
            style={[styles.pinBtn, pinning && { opacity: 0.6 }]}
            onPress={handlePinLocation}
            disabled={pinning}
            activeOpacity={0.8}
          >
            {pinning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="pin" size={16} color="#fff" />
                <Text style={styles.pinBtnText}>Pin Place</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Chronological List of Today's Pinned Stops */}
        {drawerExpanded && (
          <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
            <Text style={styles.stopsListHeader}>
              Today's Pinned Stops ({pinnedStops.length})
            </Text>
            {pinnedStops.length === 0 ? (
              <Text style={styles.emptyStopsText}>
                No pinned stops yet. When you pause or visit random sites, enter the reason above and tap Pin Place.
              </Text>
            ) : (
              pinnedStops.map((stop, idx) => (
                <View key={stop.id || idx} style={styles.stopCard}>
                  <View style={styles.stopIconWrap}>
                    <Ionicons name="pin" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopReason}>{stop.reason}</Text>
                    <Text style={styles.stopTime}>
                      {new Date(stop.pinned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {stop.place_name || `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  headerBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  leadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    gap: 5,
  },
  leadsBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  warningAlertBar: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  warningAlertText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  stationaryAlertBar: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  stationaryAlertText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 9,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  puckWrap: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  puckRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
  },
  puckDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinMarkerContainer: {
    alignItems: 'center',
  },
  pinCallout: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
    maxWidth: 140,
  },
  pinCalloutText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  drawer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 30 : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  drawerExpanded: {
    maxHeight: 340,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
  drawerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  reasonInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: '#f8fafc',
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    borderRadius: radius.md,
    gap: 4,
  },
  pinBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  stopsList: {
    marginTop: spacing.sm,
    maxHeight: 180,
  },
  stopsListHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  emptyStopsText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: spacing.xs + 2,
    borderRadius: radius.sm,
    marginBottom: 6,
    gap: spacing.sm,
  },
  stopIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(234, 88, 12, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopReason: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stopTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
});
