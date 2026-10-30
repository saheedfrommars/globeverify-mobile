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
      handleNotification: async (notification) => {
        const isCall = notification?.request?.content?.data?.type === 'incoming_call';
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: isCall
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.DEFAULT,
        };
      },
    });
  }
} catch (err) {
}

export interface PushRegistrationResult {
  success: boolean;
  token?: string;
  error?: string;
}

type IncomingCallListener = (callData: any) => void;
const incomingCallListeners = new Set<IncomingCallListener>();

export const onIncomingCallReceived = (listener: IncomingCallListener) => {
  incomingCallListeners.add(listener);
  return () => {
    incomingCallListeners.delete(listener);
  };
};

export const triggerIncomingCallEvent = (callData: any) => {
  incomingCallListeners.forEach((fn) => {
    try {
      fn(callData);
    } catch (e) {
      console.warn('[PushService] Incoming call listener error:', e);
    }
  });
};

export const CALL_CATEGORY_ID = 'incoming_call';
export const ACTION_ANSWER_CALL = 'ACTION_ANSWER_CALL';
export const ACTION_DECLINE_CALL = 'ACTION_DECLINE_CALL';

/**
 * Configure interactive notification action buttons (Answer & Decline) for incoming voice calls.
 */
export async function setupCallNotificationCategory() {
  if (Notifications && typeof Notifications.setNotificationCategoryAsync === 'function') {
    try {
      await Notifications.setNotificationCategoryAsync(CALL_CATEGORY_ID, [
        {
          identifier: ACTION_ANSWER_CALL,
          buttonTitle: '🟢 Answer Call',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: ACTION_DECLINE_CALL,
          buttonTitle: '🔴 Decline',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    } catch (err) {
      console.warn('[PushService] setupCallNotificationCategory notice:', err);
    }
  }
}

// Ensure category is immediately initialized on bundle import
setupCallNotificationCategory().catch(() => {});

/**
 * Reject call directly from background if user taps Decline action button.
 */
export async function rejectIncomingCallFromBackground(data: any) {
  const rentalId = data?.rentalId;
  const callControlId = data?.callControlId;
  if (rentalId && callControlId) {
    try {
      await apiClient.post(`/numbers/rentals/${rentalId}/call-action`, {
        action: 'reject',
        callControlId,
      });
    } catch (err) {
      console.warn('[PushService] Background reject error:', err);
    }
  }
}

/**
 * Configure Android notification channels with high importance and vibration.
 */
export async function setupAndroidNotificationChannel() {
  await setupCallNotificationCategory();

  if (Platform.OS === 'android' && Notifications && typeof Notifications.setNotificationChannelAsync === 'function') {
    try {
      // 1. General notifications (OTPs, balance updates)
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

      // 2. High-priority incoming phone calls channel (Ringing sound + vibrating pattern)
      // Delete old channel if exists to ensure sound and priority update on Android
      if (typeof Notifications.deleteNotificationChannelAsync === 'function') {
        await Notifications.deleteNotificationChannelAsync('incoming-calls').catch(() => {});
      }

      await Notifications.setNotificationChannelAsync('incoming-calls-v2', {
        name: 'Incoming Phone Calls',
        description: 'Ringing incoming voice calls on your leased numbers',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 800, 1000, 800, 1000, 800, 1000],
        lightColor: '#2563EB',
        sound: 'ringtone',
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (err) {
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
      return { success: false, error: 'Must use a physical device for Push Notifications' };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
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

    return { success: true, token: expoPushToken };
  } catch (error: any) {
    console.warn('[PushService] Registration error:', error?.response?.data || error.message);
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
            const data = response.notification.request.content.data || {};
            if (data.type === 'incoming_call') {
              const actionId = response.actionIdentifier;
              if (actionId === ACTION_DECLINE_CALL) {
                rejectIncomingCallFromBackground(data);
                return;
              }
              const autoAnswer = actionId === ACTION_ANSWER_CALL;
              triggerIncomingCallEvent({
                ...data,
                autoAnswer,
              });
              return;
            }
            handleNotificationPayload(response.notification, onNavigateScreen);
          }
        })
        .catch(() => {});
    }

    // Listen for incoming notifications while the app is in the foreground
    const foregroundSubscription = typeof Notifications.addNotificationReceivedListener === 'function'
      ? Notifications.addNotificationReceivedListener((notification) => {
          const data = notification?.request?.content?.data;
          if (data?.type === 'incoming_call') {
            triggerIncomingCallEvent(data);
          }
        })
      : null;

    // Listen for taps while the app is running in foreground or background
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data || {};

      if (data.type === 'incoming_call') {
        if (actionId === ACTION_DECLINE_CALL) {
          rejectIncomingCallFromBackground(data);
          if (response.notification.request?.identifier && typeof Notifications.dismissNotificationAsync === 'function') {
            Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
          }
          return;
        }

        const autoAnswer = actionId === ACTION_ANSWER_CALL;
        triggerIncomingCallEvent({
          ...data,
          autoAnswer,
        });
        return;
      }

      handleNotificationPayload(response.notification, onNavigateScreen);
    });

    return () => {
      try {
        subscription.remove();
        foregroundSubscription?.remove();
      } catch {}
    };
  } catch (err) {
    return () => {};
  }
}

function handleNotificationPayload(
  notification: Notifications.Notification,
  onNavigateScreen: (screen: AppScreenId) => void
) {
  try {
    const data = notification.request.content.data || {};

    // Check if this notification is an incoming call
    if (data.type === 'incoming_call') {
      triggerIncomingCallEvent(data);
      return;
    }

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
