import { useColorScheme, Platform, TextStyle } from 'react-native';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  accent: string;
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceSecondary: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSubtle: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonSecondaryBorder: string;
  dotActive: string;
  dotInactive: string;
  success: string;
  successBackground: string;
  warning: string;
  warningBackground: string;
  error: string;
  errorBackground: string;
  tint: string;
  tabBar: string;
  tabBarBorder: string;
}

/**
 * Matching the exact GlobeVerify website design tokens:
 * Light: --color-bg: #f8fafc, --color-surface: #ffffff, --color-text-main: #0f172a, --color-text-muted: #1e293b, --color-primary: #2563eb
 * Dark:  --color-bg: #0a0a0a, --color-surface: #121212, --color-text-main: #ffffff, --color-text-muted: #e2e8f0, --color-primary: #3b82f6
 * Buttons: Black in Light mode, Light/White in Dark mode
 */
export const lightColors: ThemeColors = {
  primary: '#2563eb', // GlobeVerify blue
  primaryLight: '#eff6ff',
  accent: '#7c3aed',
  background: '#f8fafc', // Website light bg
  backgroundElevated: '#ffffff',
  surface: '#ffffff', // Website light surface
  surfaceSecondary: '#f1f5f9', // Website light hover
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a', // Website light --color-text-main
  textSecondary: '#1e293b', // Website light --color-text-muted
  textTertiary: '#64748b',
  border: '#e2e8f0', // Website light --color-border
  borderSubtle: '#f1f5f9',
  buttonPrimaryBg: '#0a0a0a', // Solid Black button in light mode
  buttonPrimaryText: '#ffffff', // Crisp white text
  buttonSecondaryBg: '#ffffff',
  buttonSecondaryText: '#0f172a',
  buttonSecondaryBorder: '#e2e8f0',
  dotActive: '#0a0a0a',
  dotInactive: '#cbd5e1',
  success: '#16a34a',
  successBackground: '#f0fdf4',
  warning: '#d97706',
  warningBackground: '#fffbeb',
  error: '#dc2626',
  errorBackground: '#fef2f2',
  tint: '#2563eb',
  tabBar: '#ffffff',
  tabBarBorder: '#e2e8f0',
};

export const darkColors: ThemeColors = {
  primary: '#3b82f6', // GlobeVerify blue
  primaryLight: 'rgba(59, 130, 246, 0.14)',
  accent: '#8b5cf6',
  background: '#0a0a0a', // Website dark --color-bg
  backgroundElevated: '#121212',
  surface: '#121212', // Website dark --color-surface
  surfaceSecondary: '#1e1e1e', // Website dark --color-surface-hover
  cardBg: 'rgba(255, 255, 255, 0.03)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#ffffff', // Website dark --color-text-main
  textSecondary: '#e2e8f0', // Website dark --color-text-muted
  textTertiary: '#94a3b8',
  border: '#2a2a2a', // Website dark --color-border
  borderSubtle: '#18181b',
  buttonPrimaryBg: '#ffffff', // Solid Light/White button in dark mode
  buttonPrimaryText: '#0a0a0a', // Crisp black text
  buttonSecondaryBg: '#121212',
  buttonSecondaryText: '#ffffff',
  buttonSecondaryBorder: '#2a2a2a',
  dotActive: '#ffffff',
  dotInactive: '#2a2a2a',
  success: '#22c55e',
  successBackground: '#052e16',
  warning: '#f59e0b',
  warningBackground: '#451a03',
  error: '#ef4444',
  errorBackground: '#450a0a',
  tint: '#3b82f6',
  tabBar: '#0a0a0a',
  tabBarBorder: '#2a2a2a',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 10, // Match website button radius (10px)
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
} as const;

export const typography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '800',
    letterSpacing: Platform.select({ ios: 0.37, default: -0.5 }),
  } as TextStyle,
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: Platform.select({ ios: 0.36, default: -0.4 }),
  } as TextStyle,
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: Platform.select({ ios: 0.35, default: -0.3 }),
  } as TextStyle,
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: Platform.select({ ios: 0.38, default: 0 }),
  } as TextStyle,
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: Platform.select({ ios: -0.41, default: 0 }),
  } as TextStyle,
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: Platform.select({ ios: -0.41, default: 0 }),
  } as TextStyle,
  callout: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
    letterSpacing: Platform.select({ ios: -0.32, default: 0 }),
  } as TextStyle,
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: Platform.select({ ios: -0.24, default: 0 }),
  } as TextStyle,
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: Platform.select({ ios: -0.08, default: 0 }),
  } as TextStyle,
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  } as TextStyle,
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: Platform.select({ ios: 0.07, default: 0 }),
  } as TextStyle,
};

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return {
    isDark,
    colors,
    spacing,
    radius,
    typography,
  };
}
