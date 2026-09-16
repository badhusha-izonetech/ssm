# Phase 4 — Real Android Validation Checklist

This sandbox has **no physical Android device, no emulator, and no running
Postgres/backend instance** — so the scenarios below have not actually been
executed anywhere. What Phase 4's brief asks for (a real-device pass proving
background tracking, not just "GPS works while the app is open") can only be
done on your side. This document is the concrete script to run that pass,
plus the code-level hardening already made in anticipation of it.

## Prerequisites

1. Backend running with the Phase 1 migration applied: `alembic upgrade head`.
2. A dev-client or EAS build of the mobile app installed on a real Android
   device (**not Expo Go** — see mobile/README.md for why):
   ```bash
   cd mobile
   npx expo prebuild
   npx expo run:android
   ```
3. `mobile/.env` pointed at a backend reachable from the phone (LAN IP, or a
   deployed staging URL — not `localhost`).
4. Two ways to observe results: the CEO web app's Field Movement page (Live
   + Historical Route tabs, from Phase 3), and `adb logcat` for device-side
   diagnostics.

## Test script

Run these in order; each depends on the previous state.

| # | Step | Expected result | What to check if it fails |
|---|------|------------------|----------------------------|
| 1 | Log in as a field-role employee | Lands on Today's Work | Check `API_BASE_URL` reachability, backend `/auth/login` |
| 2 | Grant location "While using the app" only when first prompted, then Start Work | Foreground-only warning banner appears on Tracking screen | `requestBackgroundPermissionsAsync` result — Android 10+ shows a second prompt, easy to fumble in a quick test |
| 3 | Stop, restart, this time grant "Allow all the time" | No warning banner; status dot goes green ("Live — connected") | WS URL/token; check `adb logcat \| grep -i location` for the foreground service notification appearing |
| 4 | **Lock the phone** for 2+ minutes while stationary | New `FieldMovementLocation` rows keep appearing (check via CEO web Live tab or `GET /field-movements/{id}/locations`); notification "Field tracking active" stays visible | If updates stop the moment the screen locks: OEM battery optimization is very likely killing the foreground service — check device battery settings for this app (see "Known risk" below) |
| 5 | **Put phone in pocket** and physically walk a short route (5+ min) | CEO Live map marker moves along the route in near real time | Confirms `distanceInterval`/`timeInterval` are actually firing on real GPS, not just simulator ticks |
| 6 | **Switch to another app** (e.g. browser) for a few minutes, keep walking | Tracking continues; same checks as step 4 | Confirms it's not just a "screen on" artifact |
| 7 | Turn on **Airplane mode** for ~1 minute while still moving, then turn it back off | Queue depth on the Tracking screen rises while offline, then drains back toward 0 within a few pump cycles after reconnect; no fixes are missing from history afterward | `offlineQueue.ts` / `TrackingManager.drainQueue` — check `NetInfo` events actually fire on this device/OS version |
| 8 | Force-kill the app (swipe away from recents) while tracking is active, then reopen it | App reopens **directly onto the Tracking screen** (not Today's Work) and reconnects | This is the app-restart recovery path added in this hardening pass — confirms `getActiveTrackingSessionId()` + `initialRouteName` logic in `RootNavigator.tsx` |
| 9 | In system Settings, revoke location permission entirely while the app is backgrounded and tracking | On next foreground, the Tracking screen shows a warning banner (via `recordLocationTaskError`) rather than silently going stale forever | Confirms the task-error surfacing added in this pass actually reaches the UI |
| 10 | Turn device GPS/Location services off entirely mid-session, then back on | Screen shows the "Location services are turned off" warning while off; resumes silently once back on | `isLocationServicesEnabled()` check on foreground |
| 11 | Tap "Stop / Complete Work" | Session status flips to Checked Out; CEO Historical Route tab shows the full recorded route for this session with a plausible distance | `POST /field-movements/{id}/stop`, `GET .../locations?max_points=` |
| 12 | Repeat steps 4–8 back-to-back for **2+ continuous hours** (a realistic field shift) | No crashes, no permanently-stuck "Offline" status, battery drain is noticeably higher than idle but not alarming (record the % drop) | This is the one thing a short test can't catch — OEM task-killers and battery managers often only strike after 20–60+ minutes backgrounded |

## Known risk to specifically watch for

Several Android OEMs (Xiaomi/MIUI, OnePlus/OxygenOS, Oppo/ColorOS, Vivo,
and some Samsung power-saving modes) apply **aggressive background-app
killing** that can stop a foreground-service location update stream even
though every permission is correctly granted and the manifest is correct.
This is a device/OS-level setting, not something the app can fully control
from code. If step 4, 6, or 12 fails on a specific device:

1. Check whether the OS shows the "Field tracking active" notification
   continuously, or whether it silently disappears — disappearing means the
   OS killed the service.
2. Look for a manufacturer-specific battery/app-management setting (often
   named something like "Battery saver", "App auto-launch", "Protected
   apps", "No restrictions") and whitelist Success Solar Field there.
3. If this is a fleet of company-owned/managed devices, the most reliable
   fix is an MDM profile that whitelists the app from OEM battery
   management, rather than relying on each employee to find the setting.

Record which devices/OEMs were tested and their outcome — this becomes the
"remaining Android/platform limitations" section of your real sign-off.

## Result template

Fill this in after running the script on real hardware:

```
Device / Android version:
OEM battery-management quirks encountered:
Steps 1–11 pass/fail:
Step 12 (2hr soak) battery drop:
Step 12 (2hr soak) any missed location gaps (compare CEO history route continuity):
Production-ready? (yes / no, with caveats):
```
