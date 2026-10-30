import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import apiClient from '../api/client';
import { getPendingReferral } from './deepLinkService';

WebBrowser.maybeCompleteAuthSession();

export type AppleAuthResult =
  | { type: 'success'; token: string; isNew: boolean; user: any }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

/**
 * Apple sign-in service for iOS devices.
 */
export const signInWithApple = async (): Promise<AppleAuthResult> => {
  if (Platform.OS !== 'ios') {
    return { type: 'error', message: 'Apple Sign-In is only available on iOS devices.' };
  }

  try {
    const redirectUri = Linking.createURL('auth/callback');
    const apiBase = (apiClient.defaults.baseURL || 'https://api.globeverify.com/api').replace(/\/+$/, '');
    const ref = await getPendingReferral();

    const params = new URLSearchParams({ platform: 'mobile', redirect_uri: redirectUri });
    if (ref) params.set('ref', ref);

    const result = await WebBrowser.openAuthSessionAsync(
      `${apiBase}/auth/apple?${params.toString()}`,
      redirectUri
    );

    if (result.type !== 'success' || !result.url) {
      return { type: 'cancelled' };
    }

    const { queryParams } = Linking.parse(result.url);
    const error = typeof queryParams?.error === 'string' ? queryParams.error : '';
    if (error) {
      return { type: 'error', message: 'Apple sign-in could not be completed. Please try with Email or Google.' };
    }

    const token = typeof queryParams?.token === 'string' ? queryParams.token : '';
    if (!token) {
      return { type: 'error', message: 'No authentication token was returned.' };
    }

    const profileRes = await apiClient.get('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = profileRes.data?.data || profileRes.data?.user || profileRes.data;

    return { type: 'success', token, isNew: queryParams?.new === 'true', user };
  } catch (err: any) {
    return {
      type: 'error',
      message: err?.response?.data?.message || err?.message || 'Apple Sign-In is being initialized for App Store review.',
    };
  }
};
