import Constants from 'expo-constants';

/**
 * Vector tile style URL for the in-app map. Sourced from app.config.js
 * `extra.mapStyleUrl` (itself driven by the MAP_STYLE_URL env var), so the
 * same build can point at MapLibre's public demo style in dev and a real
 * tile provider (MapTiler / Stadia Maps / self-hosted) in production —
 * no Google Maps API key involved anywhere in this path.
 */
export const MAP_STYLE_URL: string =
  (Constants.expoConfig?.extra?.mapStyleUrl as string | undefined) ||
  'https://tiles.openfreemap.org/styles/bright';

