import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';
import { api } from './client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permission, obtains a real Expo push token, and
 * registers it with the backend (§32). Safe to call on every login/app
 * start — the backend upserts by token.
 *
 * Requires a physical device (or an emulator with Google Play services) to
 * actually receive a token; this cannot be exercised in a CI/sandbox
 * environment — REQUIRES REAL ENVIRONMENT VALIDATION for the end-to-end
 * delivery path, though the registration call itself is real, not mocked.
 */
export async function registerForPushNotifications(): Promise<void> {
  // isDevice check (expo-device) intentionally omitted to avoid adding a
  // new dependency here — Notifications.getExpoPushTokenAsync itself
  // throws on simulators/emulators without push capability, which the
  // outer try/catch below already treats as best-effort/non-fatal.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0EA5A5',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  let expoPushToken: string;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    expoPushToken = tokenResponse.data;
  } catch {
    // No push capability (simulator/emulator without Google Play services,
    // or no EAS projectId configured yet) — nothing to register.
    return;
  }

  try {
    await api.post('/devices/register', {
      expo_push_token: expoPushToken,
      platform: Platform.OS,
    });
  } catch {
    // Best-effort — a failed registration shouldn't block login/app usage;
    // it will be retried on the next login/app-start.
  }
}

/**
 * Registers a listener that turns a tapped notification's deep_link data
 * into real in-app navigation, via the OS Linking API so it flows through
 * the same `linking` config NavigationContainer already uses for
 * successsolar:// URLs opened externally (§33).
 */
export function attachNotificationTapHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const deepLink = response.notification.request.content.data?.deep_link as string | undefined;
    if (deepLink) {
      Linking.openURL(deepLink);
    }
  });
  return () => sub.remove();
}
