import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { parseDeepLink, markDeepLinkScreenLaunch } from './deepLinkService';
import type { AppScreenId } from '../context/WalletSettingsContext';

const PUSH_TOKEN_STORAGE_KEY = 'gv_expo_push_token';
const PUSH_ENABLED_STORAGE_KEY = 'gv_push_notifications_enabled';

// Set global foreground notification presentation options safely
try {
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (err) {
  console.log('[PushService] setNotificationHandler skipped in current environment:', err);
}

export interface PushRegistrationResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Configure Android notification channels with high importance and vibration.
 */
async function setupAndroidNotificationChannel() {
  if (Platform.OS === 'android' && Notifications && typeof Notifications.setNotificationChannelAsync === 'function') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'GlobeVerify Updates',
        description: 'Real-time SMS OTPs, rental notifications, and deposit updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (err) {
      console.log('[PushService] setupAndroidNotificationChannel notice:', err);
    }
  }
}

/**
 * Request notification permissions and register the Expo Push Token with GlobeVerify backend.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  try {
    await setupAndroidNotificationChannel();

    if (!Device.isDevice) {
      console.log('[PushService] Must use a physical device for push notifications');
      return { success: false, error: 'Must use a physical device for Push Notifications' };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushService] Notification permission not granted');
      await AsyncStorage.setItem(PUSH_ENABLED_STORAGE_KEY, 'false');
      return { success: false, error: 'Permission not granted' };
    }

    // Retrieve EAS project ID if available in app configuration
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const expoPushToken = tokenData.data;

    if (!expoPushToken) {
      return { success: false, error: 'Unable to retrieve Expo Push Token' };
    }

    // Register with backend endpoint: POST /api/push/expo/register
    await apiClient.post('/push/expo/register', {
      expoPushToken,
      platform: Platform.OS,
    });

    // Save locally
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
    await AsyncStorage.setItem(PUSH_ENABLED_STORAGE_KEY, 'true');

    console.log('[PushService] Push notifications registered successfully:', expoPushToken);
    return { success: true, token: expoPushToken };
  } catch (error: any) {
    console.error('[PushService] Registration error:', error?.response?.data || error.message);
    return {
      success: false,
      error: error?.response?.data?.message || error.message || 'Push registration failed',
    };
  }
}

/**
 * Unregister the Expo Push Token from the backend (e.g. on user logout).
 */
export async function unregisterPushNotificationsAsync(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      await apiClient.post('/push/expo/unregister', { expoPushToken: token }).catch(() => {});
      await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }
    await AsyncStorage.setItem(PUSH_ENABLED_STORAGE_KEY, 'false');
    return true;
  } catch (error) {
    console.error('[PushService] Unregister error:', error);
    return false;
  }
}

/**
 * Check if push notifications are enabled on this device and account.
 */
export async function isPushNotificationEnabledAsync(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
    if (enabled === 'false') return false;

    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Listen for notification response (when a user taps a push notification).
 * Automatically parses target URL/screen and calls onNavigateScreen.
 */
export function setupNotificationResponseListener(
  onNavigateScreen: (screen: AppScreenId) => void
) {
  try {
    if (!Notifications || typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
      return () => {};
    }

    // Check if the app was launched by tapping a push notification
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            handleNotificationPayload(response.notification, onNavigateScreen);
          }
        })
        .catch(() => {});
    }

    // Listen for taps while the app is running in foreground or background
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationPayload(response.notification, onNavigateScreen);
    });

    return () => {
      try {
        subscription.remove();
      } catch {}
    };
  } catch (err) {
    console.log('[PushService] setupNotificationResponseListener skipped:', err);
    return () => {};
  }
}

function handleNotificationPayload(
  notification: Notifications.Notification,
  onNavigateScreen: (screen: AppScreenId) => void
) {
  try {
    const data = notification.request.content.data || {};
    const targetUrl = data.url || data.path || data.link;

    if (targetUrl && typeof targetUrl === 'string') {
      const parsed = parseDeepLink(targetUrl);
      if (parsed?.screen) {
        markDeepLinkScreenLaunch();
        onNavigateScreen(parsed.screen);
        return;
      }
    }

    if (data.screen && typeof data.screen === 'string') {
      markDeepLinkScreenLaunch();
      onNavigateScreen(data.screen as AppScreenId);
    }
  } catch (err) {
    console.warn('[PushService] Error handling notification response payload:', err);
  }
}
