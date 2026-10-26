import React, { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, {
  setOnUnauthorizedCallback,
  setCachedAuthToken,
} from '../api/client';
import { socketService } from '../services/socketService';

export interface User {
  _id: string;
  id?: string;
  apiKey?: string;
  name: string;
  email: string;
  phoneNumber?: string;
  countryCode?: string;
  balance: number;
  balances?: { usd: number; ngn: number };
  currency?: string;
  isVerified?: boolean;
  role?: string;
  status?: string;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: string;
  referralCode?: string;
  pricingDiscount?: number;
  apiTier?: string;
  developerStatus?: string;
  createdAt?: string;
  authProvider?: string;
  isGoogleLinked?: boolean;
  isTelegramLinked?: boolean;
  telegramId?: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLinkedAt?: string;
  accountDeletion?: {
    status?: 'none' | 'pending' | string;
    scheduledFor?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updated: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize auth state from SecureStore
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('gv_auth_token');
        const storedUser = await SecureStore.getItemAsync('gv_user_data');

        if (storedToken && storedUser) {
          setCachedAuthToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // Unblock app launch immediately (critical for offline & fast startup!)
          setLoading(false);

          // Fetch fresh profile non-blockingly in the background
          apiClient
            .get('/auth/profile', { timeout: 6000 })
            .then(async (res) => {
              const profileUser = res.data?.user || (res.data?._id ? res.data : null);
              if (profileUser) {
                setUser(profileUser);
                await SecureStore.setItemAsync('gv_user_data', JSON.stringify(profileUser));
              }
            })
            .catch(() => {
              // Offline or slow network — keep cached user profile seamlessly
            });
          return;
        }
      } catch (err) {
        console.warn('[AuthContext] Error loading session:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Register 401 callback
    setOnUnauthorizedCallback(() => {
      setCachedAuthToken(null);
      setToken(null);
      setUser(null);
    });
  }, []);

  const login = async (newToken: string, userData: User) => {
    if (!newToken || typeof newToken !== 'string') {
      console.warn('[AuthContext] Cannot save token to SecureStore: invalid or empty token value:', newToken);
      return;
    }

    setCachedAuthToken(newToken);
    setToken(newToken);
    if (userData && typeof userData === 'object') {
      setUser(userData);
    }

    try {
      await SecureStore.setItemAsync('gv_auth_token', String(newToken));
      if (userData && typeof userData === 'object') {
        await SecureStore.setItemAsync('gv_user_data', JSON.stringify(userData));
      }
    } catch (err) {
      console.warn('[AuthContext] Error saving token to SecureStore:', err);
    }
  };

  const logout = async () => {
    socketService.disconnect();
    setCachedAuthToken(null);
    setToken(null);
    setUser(null);
    try {
      await SecureStore.deleteItemAsync('gv_auth_token');
      await SecureStore.deleteItemAsync('gv_user_data');
    } catch (err) {
      console.warn('[AuthContext] Error removing token from SecureStore:', err);
    }
  };

  // Connect real-time Socket.IO whenever authenticated user is present
  useEffect(() => {
    const uid = user?._id || user?.id;
    if (token && uid) {
      socketService.connect(uid);
    } else {
      socketService.disconnect();
    }
  }, [token, user?._id, user?.id]);

  const refreshUser = async () => {
    try {
      const res = await apiClient.get('/auth/profile');
      const profileUser = res.data?.user || (res.data?._id ? res.data : null);
      if (profileUser) {
        setUser(profileUser);
        await SecureStore.setItemAsync('gv_user_data', JSON.stringify(profileUser));
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to refresh profile:', err);
    }
  };

  const updateUser = async (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updated };
      SecureStore.setItemAsync('gv_user_data', JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
