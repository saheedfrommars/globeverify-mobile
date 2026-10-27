import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import apiClient from '../api/client';
import { getPendingReferral } from './deepLinkService';

// Lets the in-app browser close cleanly when it redirects back to the app
WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthResult =
  | { type: 'success'; token: string; isNew: boolean; user: any }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  email_exists_use_password:
    'This email is already registered. Sign in with your password, then link Google in Settings.',
  google_auth_failed: 'Google authentication failed. Please try again.',
  server_error: 'Server error during Google sign-in. Please try again.',
};

/**
 * Google sign-in from the mobile app.
 *
 * 1. Opens the backend /auth/google URL in a secure in-app browser
 *    (Chrome Custom Tab / ASWebAuthenticationSession).
 * 2. Backend completes Google OAuth and redirects to globeverify://auth/callback?token=...
 * 3. The browser closes automatically and we receive the token here —
 *    the user never ends up logged in on the website instead of the app.
 */
export const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
  try {
    // globeverify://auth/callback in builds, exp://.../--/auth/callback in Expo Go
    const redirectUri = Linking.createURL('auth/callback');
    const apiBase = (apiClient.defaults.baseURL || 'https://api.globeverify.com/api').replace(/\/+$/, '');
    const ref = await getPendingReferral();

    const params = new URLSearchParams({ platform: 'mobile', redirect_uri: redirectUri });
    if (ref) params.set('ref', ref);

    const result = await WebBrowser.openAuthSessionAsync(
      `${apiBase}/auth/google?${params.toString()}`,
      redirectUri
    );

    if (result.type !== 'success' || !result.url) {
      return { type: 'cancelled' };
    }

    const { queryParams } = Linking.parse(result.url);
    const error = typeof queryParams?.error === 'string' ? queryParams.error : '';
    if (error) {
      return { type: 'error', message: ERROR_MESSAGES[error] || 'Google sign-in failed.' };
    }

    const token = typeof queryParams?.token === 'string' ? queryParams.token : '';
    if (!token) {
      return { type: 'error', message: 'No authentication token was returned.' };
    }

    // Fetch the profile with the new token
    const profileRes = await apiClient.get('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = profileRes.data?.data || profileRes.data?.user || profileRes.data;

    return { type: 'success', token, isNew: queryParams?.new === 'true', user };
  } catch (err: any) {
    return {
      type: 'error',
      message: err?.response?.data?.message || err?.message || 'Google sign-in failed.',
    };
  }
};
