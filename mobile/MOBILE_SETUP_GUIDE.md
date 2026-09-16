# Success Solar Field App — Setup Guide (First-Time / Local)

This is a step-by-step guide assuming you have **never worked with React
Native before**. Follow it in order. Every command is meant to be copy-pasted
exactly as written (adjust only the parts marked with `<...>`).

---

## 0. What this app is

A separate mobile app (`mobile/`) for field employees. It talks to your
**existing** Success Solar backend (from `SuccessSolarApplication-web.zip`)
over the network — it does not include or run its own backend. So before
testing the mobile app, your backend must already be running and reachable.

---

## 1. Install prerequisites (one-time, on your computer)

You need three things installed on your machine (Windows/Mac/Linux):

### 1a. Node.js
Download and install the **LTS version** from https://nodejs.org (v18 or
newer; this project was verified against v22).
Check it worked:
```bash
node --version
npm --version
```

### 1b. Android Studio (for the emulator + Android SDK/build tools)
Download from https://developer.android.com/studio and install it.
During setup, let it install:
- Android SDK
- Android SDK Platform-Tools
- An Android Virtual Device (emulator) — or skip this if you'll use a real
  physical phone instead (recommended, since this app needs to test real
  GPS and background behavior, which emulators can't do well).

### 1c. A way to run the app: Expo Go is NOT enough
**Important:** this app uses background location tracking, which requires
a **custom "dev client" build** — it will not work in the plain Expo Go app
from the Play Store. You'll build your own dev client once (step 4 below),
then reuse it.

### 1d. (If testing on a real phone) USB debugging
On your Android phone: Settings → About Phone → tap "Build Number" 7 times
to unlock Developer Options → go back to Settings → Developer Options →
enable **USB Debugging**. Connect the phone to your computer with a USB
cable and accept the "Allow USB debugging?" prompt that appears on the
phone.

Check your computer sees the phone:
```bash
adb devices
```
You should see your phone listed (not "unauthorized" — if it says that,
check the phone screen for the permission prompt again).

---

## 2. Unpack the project

Unzip both files you downloaded, into the **same parent folder** so the
mobile app can find the backend's API easily to reference (they don't have
to be side by side technically, but it keeps things tidy):

```bash
mkdir -p ~/success-solar
cd ~/success-solar
unzip /path/to/SuccessSolarApplication-web.zip
unzip /path/to/SuccessSolarApplication-mobile.zip -d mobile-app
```

You should now have:
```
~/success-solar/
  SuccessSolarApplication/
    backend/
    frontend/
  mobile-app/
    mobile/
      App.tsx
      package.json
      src/
      ...
```

---

## 3. Start the backend first (mobile app needs something to talk to)

```bash
cd ~/success-solar/SuccessSolarApplication/backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your actual Postgres connection
string. Then run the migrations (this applies the new tracking tables too):

```bash
alembic upgrade head
```

Start the server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Important — find your computer's LAN IP**, not `localhost`. Your phone
is a separate device on the network and can't reach "localhost" (that
would mean the phone itself). Find your IP:
```bash
# Mac/Linux:
ipconfig getifaddr en0        # Mac Wi-Fi, adjust interface name if needed
# or:
hostname -I                   # Linux
# Windows (in cmd):
ipconfig
```
Look for something like `192.168.1.23`. Note this down — you'll need it
in step 5. Confirm the backend is reachable from another device on the
same Wi-Fi by opening `http://<your-ip>:8000/docs` in a phone browser —
you should see the FastAPI docs page.

---

## 4. Install the mobile app's dependencies

```bash
cd ~/success-solar/mobile-app/mobile
npm install
```

This downloads all the packages the app needs (React Native, Expo, etc.).
It's normal for this to take a minute or two and print some deprecation
warnings — those are harmless.

---

## 5. Point the app at your backend

```bash
cp .env.example .env
```
Open the new `.env` file and edit it:
```
API_BASE_URL=http://<your-computer-ip>:8000/api/v1
WS_BASE_URL=ws://<your-computer-ip>:8000/api/v1
```
Replace `<your-computer-ip>` with the IP you found in step 3 (e.g.
`192.168.1.23`). Both your phone and your computer must be on the **same
Wi-Fi network** for this to work.

---

## 6. Build and install the dev client on your phone

This step compiles a real Android app (once) and installs it on your
connected phone or emulator. This can take 5–15 minutes the first time.

```bash
npx expo prebuild
npx expo run:android
```

If prompted to choose a device and your phone is connected via USB, select
it from the list. When this finishes, the app will automatically open on
your phone — you now have "Success Solar Field" installed as a real app
icon, just like any other app.

**If `npx expo run:android` fails** with an SDK/licenses error, run:
```bash
sdkmanager --licenses
```
(accept all with `y`), then try `npx expo run:android` again.

---

## 7. Run it day-to-day (after the first build)

You don't need to repeat step 6 every time. Once installed, just start the
Metro bundler (the JavaScript dev server) and open the already-installed
app on your phone:

```bash
cd ~/success-solar/mobile-app/mobile
npx expo start --dev-client
```

This prints a QR code / menu in your terminal. Open the "Success Solar
Field" app icon on your phone — it will connect to this dev server
automatically (as long as the phone is on the same Wi-Fi as your
computer). Any code changes you make will hot-reload in the app.

If you change the `.env` file (e.g. new backend IP), stop this command
(Ctrl+C) and restart it — environment variables are only read on startup.

---

## 8. Log in and test

Use a real employee's username/password from your backend's `employees`
table (same credentials as the CEO web app login, for a field-role
employee — Site Engineer, Field Technician, Driver, etc.).

From there, follow the flow: Today's Work → Start Work → grant location
permissions when prompted (choose **"Allow all the time"** when Android
asks the second time, not just "While using the app" — otherwise
background tracking won't work) → Tracking Active screen.

For the full real-device validation checklist (locking the phone,
background app-switching, offline recovery, etc.), see
`mobile/PHASE4_TEST_PLAN.md` in the mobile zip.

---

## Troubleshooting

| Problem | Likely cause |
|---|---|
| App can't log in / "Network error" | Wrong IP in `.env`, phone not on same Wi-Fi, or backend not running/reachable — test `http://<ip>:8000/docs` from the phone's browser first |
| `npx expo run:android` can't find a device | Run `adb devices` — phone must show as authorized; check USB debugging is on |
| Background location doesn't work at all | You're running this in plain Expo Go instead of the dev client built in step 6 — background location requires the dev client |
| Location tracking stops when phone is locked/backgrounded on some phones | Check your phone's battery-saver/app-management settings and whitelist "Success Solar Field" (common on Xiaomi, OnePlus, Oppo, some Samsung modes) — see `PHASE4_TEST_PLAN.md` |
