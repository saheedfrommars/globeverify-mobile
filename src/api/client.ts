import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.globeverify.com/api';
const ENCRYPTION_KEY =
  process.env.EXPO_PUBLIC_API_ENCRYPTION_KEY ||
  'aa4b4bcab9aa4802c8b4ae58dff39f06ba8a22d58fa11e3fc84e904a458cb155';

// ─── Fast In-Memory Token Cache (Avoids Native Bridge Lag on Parallel Requests) ─
let memoryAuthToken: string | null = null;
let tokenInitialized = false;

export const setCachedAuthToken = (token: string | null) => {
  memoryAuthToken = token;
  tokenInitialized = true;
};

// ─── Global Offline / Network Connectivity State ─────────────────────────────
type NetworkListener = (isOffline: boolean) => void;
let isOfflineState = false;
const networkListeners = new Set<NetworkListener>();

export const getIsOffline = () => isOfflineState;

export const setNetworkOffline = (offline: boolean) => {
  if (isOfflineState !== offline) {
    isOfflineState = offline;
    networkListeners.forEach((listener) => {
      try {
        listener(isOfflineState);
      } catch {}
    });
  }
};

export const subscribeNetworkStatus = (listener: NetworkListener): (() => void) => {
  networkListeners.add(listener);
  listener(isOfflineState);
  return () => {
    networkListeners.delete(listener);
  };
};

// ─── Fast Memory + AsyncStorage Cache for Offline Support & 0ms Tab Switches ─
const memoryDataCache = new Map<string, any>();

export const getMemoryCache = <T>(key: string): T | null => {
  return (memoryDataCache.get(key) as T) ?? null;
};

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  if (memoryDataCache.has(key)) {
    return memoryDataCache.get(key) as T;
  }
  try {
    const raw = await AsyncStorage.getItem(`gv_offline_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      memoryDataCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  return null;
};

export const setCachedData = async <T>(key: string, data: T): Promise<void> => {
  memoryDataCache.set(key, data);
  try {
    await AsyncStorage.setItem(`gv_offline_cache_${key}`, JSON.stringify(data));
  } catch {}
};

/**
 * Decrypts server response payload if encrypted with AES
 */
export const decryptPayload = (data: any) => {
  if (data && data.payload && typeof data.payload === 'string') {
    try {
      const bytes = CryptoJS.AES.decrypt(data.payload, ENCRYPTION_KEY);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedString) {
        return JSON.parse(decryptedString);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[API Client] Failed to decrypt response payload:', err);
      }
    }
  }
  return data;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 12000,
});

// Interceptor to attach stored authentication tokens without blocking on SecureStore every time
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (!tokenInitialized) {
        memoryAuthToken = await SecureStore.getItemAsync('gv_auth_token');
        tokenInitialized = true;
      }
      if (memoryAuthToken) {
        config.headers.Authorization = `Bearer ${memoryAuthToken}`;
        config.headers['x-auth-token'] = memoryAuthToken;
      }
    } catch {}

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle decryption, network status, and 401 expiration
let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorizedCallback = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

apiClient.interceptors.response.use(
  (response) => {
    // Request succeeded -> device is online
    if (isOfflineState) {
      setNetworkOffline(false);
    }

    if (response.data) {
      response.data = decryptPayload(response.data);
    }

    return response;
  },
  async (error) => {
    if (error.response?.data) {
      error.response.data = decryptPayload(error.response.data);
    }

    const status = error.response?.status;

    // Detect offline / network unreachable (no HTTP response received)
    if (!error.response && error.code !== 'ERR_CANCELED') {
      setNetworkOffline(true);
    } else if (error.response && isOfflineState) {
      setNetworkOffline(false);
    }

    if (status === 401) {
      memoryAuthToken = null;
      try {
        await SecureStore.deleteItemAsync('gv_auth_token');
        await SecureStore.deleteItemAsync('gv_user_data');
      } catch {}
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
