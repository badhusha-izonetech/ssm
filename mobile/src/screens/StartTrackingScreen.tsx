import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { trackingManager } from '../tracking/TrackingManager';
import * as fieldMovementsApi from '../api/fieldMovements';
import * as siteVisitsApi from '../api/siteVisits';
import { ApiError } from '../api/client';
import { reverseGeocode, parseGoogleMapsUrl, distanceMeters, calculateRouteEtaMinutes } from '../utils/geo';
import { linkPendingEquipmentToFieldMovement, loadPendingEquipmentBefore } from '../siteVisit/localSiteVisitStore';
import { useRole } from '../roles/useRole';
import { colors, radius, spacing } from '../theme/theme';
import { formatDistanceKm } from '../utils/format';
import { describeActionFailure } from '../utils/fieldErrorMessages';

export default function StartTrackingScreen({ navigation, route }: any) {
  const projectId: string | undefined = route?.params?.projectId;
  const targetLeadId: string | undefined = route?.params?.leadId;
  const targetCustomerName: string | undefined = route?.params?.customerName;
  const targetDestination: string | undefined = route?.params?.destination;
  const targetLocationUrl: string | undefined = route?.params?.locationUrl;
  const initialWorkType: 'DIRECT MARKET' | 'SITE VISIT' | undefined = route?.params?.workType;
  const role = useRole();
  const [locating, setLocating] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [workType, setWorkType] = useState<'DIRECT MARKET' | 'SITE VISIT' | null>(initialWorkType || null);

  const parsedDest = parseGoogleMapsUrl(targetLocationUrl || targetDestination || '');
  const destCoords = parsedDest.latitude && parsedDest.longitude ? { latitude: parsedDest.latitude, longitude: parsedDest.longitude } : null;
  const routeDistMeters = coords && destCoords ? distanceMeters(coords, destCoords) : null;
  const routeEtaMins = routeDistMeters ? calculateRouteEtaMinutes(routeDistMeters) : null;

  async function checkAndAcquireLocation() {
    setLocating(true);
    setLocationError(null);
    try {
      const servicesOn = await trackingManager.isLocationServicesEnabled();
      if (!servicesOn) {
        setLocationError('Location services are turned off.');
        Alert.alert(
          'Location is off',
          'Please turn on Location Services in your phone settings to continue.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocationError('Location permission was not granted.');
        if (!perm.canAskAgain) {
          Alert.alert(
            'Location Access Required',
            'Location permission is blocked in settings. Please allow location access in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
        return;
      }
      const fix = await trackingManager.getCurrentFix();
      setCoords({ latitude: fix.latitude, longitude: fix.longitude });
      const addr = await reverseGeocode(fix.latitude, fix.longitude);
      setAddress(addr);
    } catch (err) {
      setLocationError('Could not read your current location.');
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    checkAndAcquireLocation();
  }, []);

  async function handleStart() {
    if (targetLeadId) {
      setStarting(true);
      try {
        const wt = workType || 'SITE VISIT';
        if (wt === 'DIRECT MARKET') {
          const fm = await fieldMovementsApi.startFieldMovement({
            work_type: 'DIRECT MARKET',
            lead_id: targetLeadId,
            destination: targetDestination || undefined,
          });
          navigation.replace('TrackingLive', { fieldMovementId: fm.id });
          return;
        } else {
          const visit = await siteVisitsApi.getOrCreateSiteVisitForLead(targetLeadId);
          const fm = await fieldMovementsApi.startFieldMovement({
            work_type: 'SITE VISIT',
            lead_id: targetLeadId,
            site_visit_id: visit.id,
            destination: targetDestination || undefined,
          });
          navigation.replace('TrackingLive', { fieldMovementId: fm.id, siteVisitId: visit.id });
          return;
        }
      } catch (err) {
        const message = describeActionFailure(err).message;
        Alert.alert('Could not start', message);
      } finally {
        setStarting(false);
      }
      return;
    }

    if (role.choosesWorkType && !workType) {
      Alert.alert('Choose work type', 'Please select Direct Market or Site Visit before starting.');
      return;
    }
    if (role.choosesWorkType && workType === 'SITE VISIT') {
      // SITE VISIT must be tied to a real Lead/SiteVisit, not started
      // blind — hand off to lead selection, which resolves the real
      // site_visit_id and starts the FieldMovement itself (§1).
      navigation.navigate('LeadSiteVisit', { mode: 'start-tracking', workType: 'SITE VISIT' });
      return;
    }
    setStarting(true);
    try {
      const fm = await fieldMovementsApi.startFieldMovement(
        role.choosesWorkType && workType ? { work_type: workType } : (projectId ? { project_id: projectId } : {})
      );
      if (role.usesEquipmentCustody) {
        // Fold the technician's pre-tracking equipment-before record onto
        // the real field movement id now that one exists. The photo (if
        // any) can only be uploaded now, since it needs a real fm_id — so
        // that upload, plus the real backend equipment submission, both
        // happen here rather than staying device-local (§22, §28, §58).
        const pending = await loadPendingEquipmentBefore();
        let photoUrl: string | null = null;
        if (pending.photo?.uri) {
          const photo = await fieldMovementsApi.uploadFieldFile(
            fm.id, pending.photo.uri, `equipment-before-${Date.now()}.jpg`, 'image/jpeg'
          );
          photoUrl = photo?.file_url ?? null;
        }
        await fieldMovementsApi.submitEquipment(fm.id, {
          stage: 'before',
          photo_url: photoUrl,
          items: pending.items.map((i) => ({ name: i.name, quantity: i.quantity, condition: i.condition })),
          remarks: pending.remarks || null,
          confirmed_at: pending.confirmedAt || null,
        });
        await linkPendingEquipmentToFieldMovement(fm.id);
      }
      navigation.replace('TrackingLive', { fieldMovementId: fm.id });
    } catch (err) {
      const message = describeActionFailure(err).message;
      Alert.alert('Could not start', message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Start Tracking" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.mapPreview}>
          <View style={styles.mapCircle}>
            {locating ? (
              <ActivityIndicator color={colors.info} />
            ) : locationError ? (
              <Ionicons name="warning-outline" size={30} color={colors.danger} />
            ) : (
              <Ionicons name="navigate-circle" size={38} color={colors.info} />
            )}
          </View>
        </View>

        <Text style={styles.title}>{role.startActionLabel}</Text>
        <Text style={styles.subtitle}>Start your journey by clicking the button below.</Text>

        {(targetCustomerName || targetDestination || targetLocationUrl) ? (
          <Card style={styles.gpsCard} padded>
            <View style={styles.gpsRow}>
              <Ionicons name="map-outline" size={16} color={colors.primary} />
              <Text style={[styles.gpsLabel, { color: colors.primary, fontWeight: '700' }]}>
                {targetCustomerName ? `Destination · ${targetCustomerName}` : 'Site Destination'}
              </Text>
            </View>
            <Text style={[styles.gpsValue, { fontWeight: '700', fontSize: 14 }]}>
              {parsedDest.placeName || targetDestination || 'Client Location'}
            </Text>
            {targetLocationUrl ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(targetLocationUrl)}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}
              >
                <Ionicons name="open-outline" size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }} numberOfLines={1}>
                  Open Google Maps Link
                </Text>
              </TouchableOpacity>
            ) : null}

            {routeDistMeters !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="navigate-outline" size={14} color={colors.info} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    {formatDistanceKm(routeDistMeters)}
                  </Text>
                </View>
                {routeEtaMins !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={14} color={colors.warning} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      ~{routeEtaMins} mins travel
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        ) : null}

        {role.choosesWorkType && (
          <Card style={styles.gpsCard} padded>
            <View style={styles.gpsRow}>
              <Ionicons name="briefcase-outline" size={16} color={colors.info} />
              <Text style={styles.gpsLabel}>What are you doing right now?</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {(['DIRECT MARKET', 'SITE VISIT'] as const).map((wt) => {
                const active = workType === wt;
                return (
                  <TouchableOpacity
                    key={wt}
                    onPress={() => setWorkType(wt)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: 10,
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primarySoft : colors.card,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.primary : colors.textSecondary }}>
                      {wt === 'DIRECT MARKET' ? 'Direct Market' : 'Site Visit'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        <Card style={styles.gpsCard} padded>
          <View style={styles.gpsRow}>
            <Ionicons name="location" size={16} color={colors.info} />
            <Text style={styles.gpsLabel}>Current Location</Text>
          </View>
          {locating ? (
            <Text style={styles.gpsValue}>Locating…</Text>
          ) : locationError ? (
            <Text style={[styles.gpsValue, { color: colors.danger }]}>{locationError}</Text>
          ) : (
            <>
              <Text style={styles.gpsValue}>{address || 'Address unavailable'}</Text>
              {coords && (
                <Text style={styles.gpsCoords}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </Text>
              )}
            </>
          )}
        </Card>

        <Card style={styles.noteCard} padded>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.noteText}>Make sure your location is enabled for accurate tracking.</Text>
        </Card>
      </View>

      <View style={styles.footer}>
        <Button
          title="Start Journey"
          onPress={handleStart}
          loading={starting}
          disabled={locating || !!locationError || (role.choosesWorkType && !workType)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center' },
  mapPreview: { marginTop: spacing.lg, marginBottom: spacing.lg },
  mapCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  gpsCard: { width: '100%', marginTop: spacing.xl },
  gpsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  gpsLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginLeft: 6 },
  gpsValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  gpsCoords: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  noteCard: {
    width: '100%',
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background,
  },
  noteText: { flex: 1, fontSize: 12, color: colors.textSecondary, marginLeft: 8, lineHeight: 17 },
  footer: { padding: spacing.lg },
});
