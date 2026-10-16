import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.globeverify.com/api';
const ENCRYPTION_KEY =
  process.env.EXPO_PUBLIC_API_ENCRYPTION_KEY ||
  'aa4b4bcab9aa4802c8b4ae58dff39f06ba8a22d58fa11e3fc84e904a458cb155';

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
      console.warn('[API Client] Failed to decrypt response payload:', err);
    }
  }
  return data;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor to attach stored authentication tokens and log requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('gv_auth_token');
      if (token) {
        // Send as both Bearer and x-auth-token per GlobeVerify backend requirements
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['x-auth-token'] = token;
      }
    } catch (err) {
      console.warn('[API Client] Error reading auth token:', err);
    }

    console.log(
      `🌐 [API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
      config.data ? JSON.stringify(config.data) : ''
    );
    return config;
  },
  (error) => {
    console.warn('❌ [API Request Error]:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to log responses and handle session expiration (HTTP 401)
let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorizedCallback = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

apiClient.interceptors.response.use(
  (response) => {
    // Decrypt if response contains encrypted AES payload
    if (response.data) {
      response.data = decryptPayload(response.data);
    }

    try {
      console.log(
        `\n==================== [API RESPONSE] ====================\n` +
        `✅ ${response.config.method?.toUpperCase()} ${response.config.url} [Status: ${response.status}]\n` +
        `📦 Data:\n${JSON.stringify(response.data, null, 2)}\n` +
        `========================================================\n`
      );
    } catch {
      console.log(`✅ [API Response] ${response.config.method?.toUpperCase()} ${response.config.url} [Status: ${response.status}]`, response.data);
    }
    return response;
  },
  async (error) => {
    // Decrypt error body if encrypted
    if (error.response?.data) {
      error.response.data = decryptPayload(error.response.data);
    }

    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const data = error.response?.data;

    try {
      console.warn(
        `\n================== [API RESPONSE ERROR] ==================\n` +
        `❌ ${method} ${url} [Status: ${status || 'NETWORK_ERROR'}]\n` +
        `⚠️ Error Body:\n${JSON.stringify(data || error.message, null, 2)}\n` +
        `==========================================================\n`
      );
    } catch {
      console.warn(`❌ [API Response Error] ${method} ${url} [Status: ${status || 'NETWORK_ERROR'}]`, data || error.message);
    }

    if (status === 401) {
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
