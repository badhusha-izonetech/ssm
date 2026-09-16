import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { trackingManager } from './TrackingManager';
import { distanceMeters } from '../utils/geo';
import * as fieldMovementsApi from '../api/fieldMovements';

interface UseGeofenceMonitorProps {
  fieldMovementId: string | null;
  destinationCoords?: { latitude: number; longitude: number } | null;
  geofenceRadiusMeters?: number;
  destinationAddress?: string | null;
  active?: boolean;
}

export function useGeofenceMonitor({
  fieldMovementId,
  destinationCoords,
  geofenceRadiusMeters = 60,
  destinationAddress,
  active = true,
}: UseGeofenceMonitorProps) {
  const [isBreached, setIsBreached] = useState(false);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const alertShownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!active || !fieldMovementId || !destinationCoords) {
      setIsBreached(false);
      return;
    }

    let isMounted = true;

    const checkPerimeter = async () => {
      try {
        const fix = await trackingManager.getCurrentFix();
        if (!isMounted || !fix) return;

        const dist = distanceMeters(
          { latitude: fix.latitude, longitude: fix.longitude },
          { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude }
        );

        setCurrentDistance(dist);

        if (dist > geofenceRadiusMeters) {
          setIsBreached(true);
          const now = Date.now();

          // Debounce alert popup and notification (at most once every 5 minutes while breached)
          if (now - lastAlertTimeRef.current > 5 * 60 * 1000) {
            lastAlertTimeRef.current = now;

            // In-app warning popup
            Alert.alert(
              '⚠️ Perimeter Breach Warning',
              `You have moved ${Math.round(dist)}m away from the marked destination (permitted site radius: ${geofenceRadiusMeters}m). Please stay within the assigned work site. Management has been notified.`,
              [{ text: 'I Understand', onPress: () => { alertShownRef.current = false; } }]
            );

            // Notify CEO & Project Head via backend
            fieldMovementsApi.sendGeofenceAlert(fieldMovementId, {
              latitude: fix.latitude,
              longitude: fix.longitude,
              distance_meters: dist,
              destination_address: destinationAddress,
            }).catch(() => {
              // Non-fatal if offline
            });
          }
        } else {
          setIsBreached(false);
        }
      } catch {
        // Non-fatal if GPS fix unavailable
      }
    };

    // Initial check
    checkPerimeter();

    // Periodic check every 12 seconds
    const interval = setInterval(checkPerimeter, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [active, fieldMovementId, destinationCoords, geofenceRadiusMeters, destinationAddress]);

  return { isBreached, currentDistance };
}
