import * as Location from 'expo-location';

/** Great-circle distance between two points, in meters. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of consecutive-point distances — the travelled route length. */
export function routeDistanceMeters(points: { latitude: number; longitude: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Best-effort human-readable address for a GPS fix. Never fabricates — returns null on failure. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const r = results?.[0];
    if (!r) return null;
    const parts = [r.name, r.street, r.district || r.subregion, r.city, r.region, r.postalCode].filter(
      (p, i, arr) => !!p && arr.indexOf(p) === i
    );
    return parts.join(', ') || null;
  } catch {
    return null;
  }
}

/** Geocode an address string to coordinates. Returns null on failure. */
export async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!address || !address.trim()) return null;
  try {
    const results = await Location.geocodeAsync(address);
    const r = results?.[0];
    if (r && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
      return { latitude: r.latitude, longitude: r.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

export interface ParsedGoogleMapsLocation {
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
}

/**
 * Parses Google Maps URLs or coordinate strings.
 * Handles patterns:
 * - https://www.google.com/maps/place/Bethel+Nagar.../@12.954194,80.2467475,17z/...
 * - ?q=12.954194,80.2467475
 * - raw "12.954194, 80.2467475"
 */
export function parseGoogleMapsUrl(input: string): ParsedGoogleMapsLocation {
  if (!input || typeof input !== 'string') {
    return { latitude: null, longitude: null, placeName: null };
  }
  const clean = input.trim();

  // 1. @lat,lng
  const atMatch = clean.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    const placeMatch = clean.match(/\/place\/([^/@]+)/);
    const placeName = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : null;
    return { latitude: lat, longitude: lng, placeName };
  }

  // 2. query param ?q=lat,lng or ll=lat,lng
  const qMatch = clean.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]), placeName: null };
  }

  // 3. raw coordinates "12.954194, 80.2467475"
  const rawMatch = clean.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (rawMatch) {
    return { latitude: parseFloat(rawMatch[1]), longitude: parseFloat(rawMatch[2]), placeName: null };
  }

  return { latitude: null, longitude: null, placeName: null };
}

/**
 * Estimates travel duration in minutes based on distance in meters.
 * Assumes average field travel speed of ~25 km/h plus 3 min buffer.
 */
export function calculateRouteEtaMinutes(distanceMeters: number): number {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const km = distanceMeters / 1000;
  const hours = km / 25;
  const minutes = Math.round(hours * 60) + 3;
  return Math.max(minutes, 2);
}

