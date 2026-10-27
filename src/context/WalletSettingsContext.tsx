import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  CustomDialogModal,
  type DialogConfig,
  type ToastConfig,
} from '../components/ui/CustomDialogModal';
import { hasDeepLinkScreenLaunch } from '../services/deepLinkService';

const STORAGE_KEY = 'gv_app_display_settings_v6';

// ─── App-Wide Customization Types ────────────────────────────────────────────

export type AppScreenId =
  | 'dashboard'
  | 'buy-number'
  | 'numbers'
  | 'rentals'
  | 'wallet'
  | 'more'
  | 'customization'
  | 'affiliate'
  | 'developer'
  | 'support'
  | 'legal'
  | 'terms'
  | 'privacy';

export type ThemeMode = 'light' | 'dark';

export type NavigationStyle =
  | 'floating-pill'   // Default: Clean floating bottom pill dock
  | 'classic-tabs'    // Full-width docked bottom tab bar with labels
  | 'top-bar'         // Horizontal navigation bar at the top under header
  | 'compact-dock'    // Minimal icon-only floating dock
  | 'menu-drawer';    // Slide-out sidebar drawer mode

export type DialogStyle =
  | 'bottom-sheet'    // Default: Smooth slide-up bottom sheet modal with drag handle
  | 'center-modern'   // Spring-animated floating center dialog card
  | 'floating-banner' // Compact floating action card at the bottom
  | 'minimal-compact';// Ultra-clean typographic prompt without extra chrome

export type GlobalLoadingStyle =
  | 'shimmer'         // Default: Smooth pulsing skeleton cards
  | 'spinner'         // Clean minimal centered spinner
  | 'wave'            // Staggered wave bars
  | 'minimal';        // Simple ultra-clean line placeholders

export type LoadingSpeed = 'fast' | 'normal' | 'calm';

export type ContentDensity = 'compact' | 'comfortable' | 'spacious';

export type ListDisplayStyle = 'cards' | 'minimal-rows';

// ─── Web-Matched Theme Palette ───────────────────────────────────────────────

export interface ThemeColors {
  isDark: boolean;
  statusBar: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  shadowColor: string;
}

export const LIGHT_WEB_COLORS: ThemeColors = {
  isDark: false,
  statusBar: 'dark',
  bg: '#F8FAFC',               // Web light --color-bg
  surface: '#FFFFFF',          // Web light --color-surface
  surfaceSecondary: '#F1F5F9', // Web light --color-surface-secondary
  surfaceElevated: '#F8FAFC',
  border: '#E2E8F0',           // Web light --color-border
  borderStrong: '#CBD5E1',
  text: '#0F172A',             // Web light --color-text
  textSecondary: '#475569',    // Web light --color-text-secondary
  textMuted: '#64748B',        // Web light --color-text-muted
  primary: '#2563EB',          // GlobeVerify Royal Blue
  primarySoft: '#DBEAFE',      // Soft blue icon/pill bg
  primaryBorder: '#BFDBFE',
  accent: '#7C3AED',           // GlobeVerify Purple Accent
  accentSoft: '#F3E8FF',       // Soft purple icon/banner bg
  accentBorder: '#DDD6FE',
  success: '#10B981',          // GlobeVerify Emerald Green
  successSoft: '#D1FAE5',
  warning: '#F97316',          // GlobeVerify Orange
  warningSoft: '#FFEDD5',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  shadowColor: '#0F172A',
};

export const DARK_WEB_COLORS: ThemeColors = {
  isDark: true,
  statusBar: 'light',
  bg: '#0A0A0A',               // Web dark --color-bg
  surface: '#121212',          // Web dark --color-surface
  surfaceSecondary: '#1A1A1E', // Web dark --color-surface-secondary
  surfaceElevated: '#1E1E24',
  border: '#262626',           // Web dark --color-border
  borderStrong: '#333338',
  text: '#FFFFFF',             // Web dark --color-text
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',        // Web dark --color-text-muted
  primary: '#3B82F6',          // GlobeVerify Electric Blue
  primarySoft: 'rgba(59, 130, 246, 0.15)',
  primaryBorder: 'rgba(59, 130, 246, 0.32)',
  accent: '#8B5CF6',           // GlobeVerify Violet Accent
  accentSoft: 'rgba(139, 92, 246, 0.15)',
  accentBorder: 'rgba(139, 92, 246, 0.32)',
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.15)',
  warning: '#F97316',
  warningSoft: 'rgba(249, 115, 22, 0.15)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
  shadowColor: '#000000',
};

export interface AppDisplaySettings {
  // 0. Web Theme Mode
  themeMode: ThemeMode;

  // 1. Navigation & Screens
  navigationStyle: NavigationStyle;
  showHamburgerMenu: boolean; // Hidden by default, can be enabled in Settings!
  defaultStartScreen: AppScreenId;
  visibleTabs: {
    home: boolean;
    buy: boolean;
    sms: boolean;
    rentals: boolean;
    wallet: boolean;
    settingsInNav: boolean;
  };

  // 2. Global Loading & Dialogs (All Screens)
  loadingStyle: GlobalLoadingStyle;
  loadingSpeed: LoadingSpeed;
  dialogStyle: DialogStyle;

  // 3. Global Content Display (All Screens)
  contentDensity: ContentDensity;
  listDisplayStyle: ListDisplayStyle;
  compactHeader: boolean;
  hapticFeedback: boolean;
  privacyHideBalance: boolean;
  soundMuted: boolean;

  // 4. Home Dashboard Screen Options
  showPromoBanner: boolean;
  showDashboardGreeting: boolean;
  showDashboardStats: boolean;
  showDashboardBreakdown: boolean;
  showDashboardActiveOrders: boolean;
  showDashboardTransactions: boolean;

  // 5. Numbers & SMS Screen Options
  showSmsMessagePreview: boolean;
  showExpiryTimer: boolean;

  // 6. Wallet Screen Options
  showDualCurrency: boolean;
  showTelecomCredits: boolean;
  groupTransactionsByDate: boolean;
}

// ─── Sensible Clean Defaults ─────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS: AppDisplaySettings = {
  themeMode: 'light',
  navigationStyle: 'floating-pill',
  showHamburgerMenu: false, // Hamburger hidden by default; user can enable in Settings
  defaultStartScreen: 'dashboard',
  visibleTabs: {
    home: true,
    buy: true,
    sms: true,
    rentals: true,
    wallet: true,
    settingsInNav: false,
  },
  loadingStyle: 'shimmer',
  loadingSpeed: 'normal',
  dialogStyle: 'bottom-sheet',
  contentDensity: 'comfortable',
  listDisplayStyle: 'cards',
  compactHeader: false,
  hapticFeedback: true,
  privacyHideBalance: false,
  soundMuted: false,
  showPromoBanner: true,
  showDashboardGreeting: true,
  showDashboardStats: true,
  showDashboardBreakdown: true,
  showDashboardActiveOrders: true,
  showDashboardTransactions: true,
  showSmsMessagePreview: true,
  showExpiryTimer: true,
  showDualCurrency: true,
  showTelecomCredits: true,
  groupTransactionsByDate: false,
};

// ─── Context Interface ───────────────────────────────────────────────────────

interface AppSettingsContextType {
  settings: AppDisplaySettings;
  colors: ThemeColors;
  isLoaded: boolean;
  activeScreen: AppScreenId;
  setActiveScreen: (screen: AppScreenId) => void;
  toggleTheme: () => Promise<void>;
  updateSetting: <K extends keyof AppDisplaySettings>(
    key: K,
    value: AppDisplaySettings[K]
  ) => Promise<void>;
  toggleVisibleTab: (tabKey: keyof AppDisplaySettings['visibleTabs']) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  triggerHaptic: (style?: 'light' | 'medium' | 'selection' | 'success' | 'warning') => void;
  showDialog: (options: Omit<DialogConfig, 'visible'>) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const WalletSettingsProvider: React.FC<{
  children: ReactNode;
  activeScreen?: AppScreenId;
  onNavigateScreen?: (screen: AppScreenId) => void;
}> = ({ children, activeScreen = 'dashboard', onNavigateScreen }) => {
  const [settings, setSettings] = useState<AppDisplaySettings>(DEFAULT_APP_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [internalScreen, setInternalScreen] = useState<AppScreenId>(activeScreen);

  const [dialogState, setDialogState] = useState<DialogConfig | null>(null);
  const [toastState, setToastState] = useState<ToastConfig | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInternalScreen(activeScreen);
  }, [activeScreen]);

  useEffect(() => {
    const loadStored = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const merged: AppDisplaySettings = {
            ...DEFAULT_APP_SETTINGS,
            ...parsed,
            visibleTabs: {
              ...DEFAULT_APP_SETTINGS.visibleTabs,
              ...(parsed.visibleTabs || {}),
            },
          };
          setSettings(merged);
          if (merged.defaultStartScreen && onNavigateScreen && !hasDeepLinkScreenLaunch()) {
            onNavigateScreen(merged.defaultStartScreen);
          }
        }
      } catch (err) {
        console.warn('[AppSettings] Error loading settings:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadStored();
  }, []);

  const persist = async (next: AppDisplaySettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('[AppSettings] Failed to save settings:', err);
    }
  };

  const triggerHaptic = useCallback(
    (style: 'light' | 'medium' | 'selection' | 'success' | 'warning' = 'selection') => {
      if (!settings.hapticFeedback) return;
      try {
        if (style === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else if (style === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        else Haptics.selectionAsync();
      } catch {}
    },
    [settings.hapticFeedback]
  );

  const updateSetting = useCallback(
    async <K extends keyof AppDisplaySettings>(key: K, value: AppDisplaySettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    []
  );

  const toggleTheme = useCallback(async () => {
    triggerHaptic('selection');
    setSettings((prev) => {
      const nextMode: ThemeMode = prev.themeMode === 'light' ? 'dark' : 'light';
      const next = { ...prev, themeMode: nextMode };
      persist(next);
      return next;
    });
  }, [triggerHaptic]);

  const toggleVisibleTab = useCallback(
    async (tabKey: keyof AppDisplaySettings['visibleTabs']) => {
      setSettings((prev) => {
        const currentTabs = { ...prev.visibleTabs, [tabKey]: !prev.visibleTabs[tabKey] };
        const anyEnabled = Object.values(currentTabs).some(Boolean);
        if (!anyEnabled) {
          currentTabs.home = true;
        }
        const next = { ...prev, visibleTabs: currentTabs };
        persist(next);
        return next;
      });
    },
    []
  );

  const resetToDefaults = useCallback(async () => {
    const next = { ...DEFAULT_APP_SETTINGS };
    setSettings(next);
    await persist(next);
  }, []);

  const handleSetActiveScreen = useCallback(
    (scr: AppScreenId) => {
      setInternalScreen(scr);
      onNavigateScreen?.(scr);
    },
    [onNavigateScreen]
  );

  const showDialog = useCallback((options: Omit<DialogConfig, 'visible'>) => {
    setDialogState({
      ...options,
      visible: true,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(null);
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'success') => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToastState({ visible: true, message, type });
      toastTimerRef.current = setTimeout(() => {
        setToastState((prev) => (prev ? { ...prev, visible: false } : null));
      }, 2400);
    },
    []
  );

  const colors = useMemo(
    () => (settings.themeMode === 'dark' ? DARK_WEB_COLORS : LIGHT_WEB_COLORS),
    [settings.themeMode]
  );

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        colors,
        isLoaded,
        activeScreen: internalScreen,
        setActiveScreen: handleSetActiveScreen,
        toggleTheme,
        updateSetting,
        toggleVisibleTab,
        resetToDefaults,
        triggerHaptic,
        showDialog,
        showToast,
      }}
    >
      {children}
      <CustomDialogModal
        dialog={dialogState}
        toast={toastState}
        dialogStyle={settings.dialogStyle}
        colors={colors}
        onCloseDialog={closeDialog}
        onTriggerHaptic={triggerHaptic}
      />
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used within a WalletSettingsProvider');
  }
  return ctx;
};

export const useWalletSettings = useAppSettings;
