# Success Solar — Field Employee App

React Native (Expo) client for field employees. Talks to the **existing**
FastAPI backend only — no new backend, no new database, no new auth system.
Login uses the same JWT bearer flow as the web app (`POST /auth/login`,
`POST /auth/refresh`), and tracking uses the endpoints added in Phase 1
(`/field-movements/*`).

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # set API_BASE_URL / WS_BASE_URL to your machine's LAN IP
npx expo start --dev-client
```

**Background location requires a custom dev client or EAS build — it will
not work in the plain "Expo Go" app.** `expo-location`'s Android foreground
service and `ACCESS_BACKGROUND_LOCATION` permission need native config
(already set up in `app.config.js` via the `expo-location` config plugin),
which only takes effect in a prebuilt/dev-client or standalone build:

```bash
npx expo prebuild            # generates android/ (and ios/) native projects
npx expo run:android         # builds & installs a dev client on a connected device/emulator
# or, for a distributable build:
# eas build --platform android --profile development
```

## Environment configuration

`API_BASE_URL` / `WS_BASE_URL` are read from the environment at config time
(`app.config.js`) — set them per environment (dev/staging/prod) via `.env`
locally or EAS build profile secrets. No URLs are hardcoded in the app code.

## App flow (MVP)

```
Login
  -> Today's Work (own recent field movements + "start work" form)
  -> Start Work (POST /field-movements/start)
  -> Tracking Active (background GPS -> WS live + offline queue)
  -> Stop / Complete Work (POST /field-movements/{id}/stop)
```

## Structure

```
App.tsx                        entry point — registers the background task first
src/
  api/
    client.ts                  axios instance, AsyncStorage token store, 401-refresh interceptor
    auth.ts                    login/me/logout
    fieldMovements.ts          start/stop/update/location/history calls
  auth/
    AuthContext.tsx            session state, hydrates from AsyncStorage on boot
  tracking/
    locationTask.ts            expo-task-manager background task (module-scope, see App.tsx)
    offlineQueue.ts            AsyncStorage-backed durable FIFO queue of unsent GPS fixes
    trackingSocket.ts          WebSocket client (mirrors web's useSiteVisitTracking.ts protocol)
    TrackingManager.ts         orchestrates permissions + background task + WS + queue pump
  screens/
    LoginScreen.tsx
    TodayWorkScreen.tsx
    TrackingScreen.tsx
  navigation/
    RootNavigator.tsx
  types.ts                     mirrors backend Pydantic schemas
```

## How background tracking works

1. `TrackingManager.start()` requests foreground, then background, location
   permission (Android 10+ requires two separate prompts — this is handled
   in sequence, not as one combined request).
2. `Location.startLocationUpdatesAsync()` is started with a persistent
   Android **foreground service notification** ("Field tracking active"),
   which is what lets Android keep delivering location updates while the
   phone is locked or another app is open — plain background *fetch* is not
   sufficient and is not used here.
3. Every fix the OS delivers is written to `locationTask.ts`'s callback,
   which has no React context (it can fire while the JS app is fully
   backgrounded) — so it does exactly one thing: durably enqueue the fix
   to AsyncStorage (`offlineQueue.ts`) keyed by the active session id.
4. A separate pump (`TrackingManager`'s `setInterval`, plus triggers on
   `NetInfo` reconnect and `AppState` foregrounding) drains that queue: it
   tries the live WebSocket first (same protocol as the web app's Site
   Visit tracking), and falls back to the `POST /location` REST endpoint
   per-fix if the socket isn't connected. Nothing is dropped — a fix only
   leaves the queue once it's confirmed sent.
5. `Stop / Complete Work` does one last drain, stops the background task,
   closes the socket, and calls `POST /field-movements/{id}/stop`.

This satisfies "no fake GPS data": every fix comes from `expo-location`'s
real device GPS, never simulated.

## Known limitations (see Phase 4 for real-device hardening)

- **Not yet tested on a real Android device or emulator** — this sandbox
  has neither available. See `PHASE4_TEST_PLAN.md` for the exact script to
  run on real hardware before treating this as production-ready; do not
  assume background tracking is reliable until that script has passed.
- Recovery/hardening already implemented in anticipation of that testing:
  - **App restart while tracking**: `RootNavigator` checks the durable
    active-session flag on boot and lands directly on the Tracking screen
    (instead of Today's Work) so a killed-and-relaunched app resumes
    tracking without the employee having to notice and tap back in.
  - **Permission revoked / GPS disabled mid-session**: the background task
    records any error it hits (`recordLocationTaskError`); the Tracking
    screen checks for it — and re-checks location-services status — on
    every foreground transition, surfacing a warning banner instead of
    silently going stale.
- In-app maps (Tracking Live, Mark Destination) use **MapLibre**
  (`@maplibre/maplibre-react-native`) with a vector-tile style URL —
  no Google Maps SDK, no Google Maps API key. Set `MAP_STYLE_URL` (env var /
  EAS secret) to your tile provider's style JSON (e.g. MapTiler, Stadia
  Maps, or a self-hosted style); it falls back to MapLibre's public demo
  style if unset, which is fine for development but not for production
  volume/branding. The Android location engine is explicitly pinned to
  `"default"` (not `"google"`) so the build has no Google Play Services
  dependency either.
- Android battery optimization / manufacturer-specific "app hibernation"
  (common on Xiaomi/OnePlus/etc.) can still kill the foreground service
  despite correct permissions — this is a device/OS setting, not something
  fixable from app code; `PHASE4_TEST_PLAN.md` covers what to check.
- Photo upload endpoint is wired (`uploadPhoto`) but no camera screen was
  built yet — the brief scoped photos as "where required"; add a screen
  reusing `expo-image-picker` if/when a specific workflow needs it.



## what i have practiced in terminal to run or integrate an mobile app

