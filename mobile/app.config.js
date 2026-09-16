// Dynamic Expo config. API_BASE_URL / WS_BASE_URL come from the environment
// (e.g. .env via `expo start`, or EAS build secrets/profiles) so the same
// codebase can point at local/staging/production instances of the existing
// FastAPI backend without any code change. See .env.example.
//
// Falls back to a same-network dev default so `expo start` still boots
// without a .env file present.
const API_BASE_URL = process.env.API_BASE_URL || 'http://192.168.1.10:8000/api/v1';
const WS_BASE_URL =
  process.env.WS_BASE_URL || API_BASE_URL.replace(/^http/, 'ws');

// Vector tile style for the in-app map (MapLibre — no Google Maps API key
// required). Defaults to MapLibre's public demo style so the app still runs
// out of the box; production deployments should point this at a real tile
// provider (e.g. a MapTiler/Stadia Maps/self-hosted style URL) via the
// MAP_STYLE_URL env var / EAS build secret. See README.
const MAP_STYLE_URL =
  process.env.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/bright';

module.exports = {
  expo: {
    name: 'Success Solar Field',
    slug: 'success-solar-field',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    // Enables successsolar://lead/{id}, successsolar://site-visit/{id},
    // successsolar://project/{id}, successsolar://tracking/{id} (§33).
    scheme: 'successsolar',
    splash: {
      backgroundColor: '#0F172A',
    },
    assetBundlePatterns: ['**/*'],
    android: {
      package: 'care.successsolar.field',
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
        'RECEIVE_BOOT_COMPLETED',
        'INTERNET',
        'CAMERA',
        'RECORD_AUDIO',
      ],
    },
    ios: {
      bundleIdentifier: 'care.successsolar.field',
      infoPlist: {
        UIBackgroundModes: ['location', 'fetch'],
        NSLocationWhenInUseUsageDescription:
          "Success Solar Field needs your location while you're on an active field task so your assignment status stays accurate on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Success Solar Field needs to keep tracking your location in the background during an active field task (e.g. while the phone is locked) so your manager can see progress and your visit history is recorded.',
        NSLocationAlwaysUsageDescription:
          'Success Solar Field needs to keep tracking your location in the background during an active field task.',
        NSCameraUsageDescription:
          'Success Solar Field needs camera access to capture your site-arrival selfie, site photos, and site-view video as work evidence.',
        NSMicrophoneUsageDescription:
          'Success Solar Field needs microphone access to record the site-view video.',
        NSPhotoLibraryUsageDescription:
          'Success Solar Field needs photo library access to attach equipment/measurement photos and documents.',
      },
    },
    plugins: [
      "expo-font",
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Success Solar Field to use your location during an active field task, including while the app is in the background.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      'expo-task-manager',
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow Success Solar Field to use the camera to capture site-arrival proof, site photos and site-view video.',
          microphonePermission:
            'Allow Success Solar Field to use the microphone to record the site-view video.',
          recordAudioAndroid: true,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Success Solar Field to access your photos to attach equipment/measurement images.',
          cameraPermission:
            'Allow Success Solar Field to use the camera to capture equipment/measurement images.',
        },
      ],
      [
        'expo-notifications',
        {
          // Assignment/work notifications (§32): New Site Visit Assigned,
          // New Direct Marketing Task, Project Assigned, etc.
          color: '#0EA5A5',
        },
      ],
      [
        '@maplibre/maplibre-react-native',
        {
          // Default ("default") location engine keeps the build free of any
          // Google Play Services dependency — deliberately not "google".
          android: { locationEngine: 'default' },
        },
      ],
    ],
    extra: {
      apiBaseUrl: API_BASE_URL,
      wsBaseUrl: WS_BASE_URL,
      mapStyleUrl: MAP_STYLE_URL,
      eas: {
        // projectId: "<set after `eas init`>"
      },
    },
  },
};
