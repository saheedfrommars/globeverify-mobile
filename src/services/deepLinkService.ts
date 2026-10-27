import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import type { AppScreenId } from '../context/WalletSettingsContext';

/**
 * Deep-link handling for GlobeVerify.
 *
 * Supported links (both https App Links / Universal Links and the custom scheme):
 *   https://globeverify.com/dashboard/numbers          → My Numbers
 *   https://www.globeverify.com/dashboard/wallet       → Wallet
 *   https://globeverify.com/auth/register?ref=JOHN1234 → Register with referral prefilled
 *   globeverify://dashboard/buy                        → Buy Number
 *   globeverify://auth/callback?token=...              → Google OAuth return (handled by googleAuth.ts)
 */

const PENDING_REFERRAL_KEY = 'gv_pending_referral_code';

export type DeepLinkAuthTarget = 'login' | 'register';

export interface ParsedDeepLink {
  screen?: AppScreenId;
  authTarget?: DeepLinkAuthTarget;
  referralCode?: string;
  isOAuthCallback?: boolean;
  token?: string;
  isNew?: boolean;
  error?: string;
}

// Web dashboard routes → mobile screens
const ROUTE_MAP: Array<[RegExp, AppScreenId]> = [
  [/^dashboard\/?$/, 'dashboard'],
  [/^dashboard\/numbers/, 'numbers'],
  [/^dashboard\/(buy|cheap)/, 'buy-number'],
  [/^dashboard\/rentals/, 'rentals'],
  [/^dashboard\/wallet/, 'wallet'],
  [/^dashboard\/(affiliate|referrals|earnings)/, 'affiliate'],
  [/^dashboard\/developer/, 'developer'],
  [/^dashboard\/support/, 'support'],
  [/^dashboard\/(settings|activities)/, 'more'],
  [/^(terms|tos)/, 'terms'],
  [/^(privacy|policy)/, 'privacy'],
  [/^legal/, 'legal'],
];

const normalizePath = (url: string): { path: string; params: Record<string, string> } => {
  const parsed = Linking.parse(url);
  let path = (parsed.path || '').replace(/^\/+|\/+$/g, '');

  // Expo Go URLs look like exp://host:8081/--/dashboard/wallet
  path = path.replace(/^--\/?/, '');

  // For custom scheme links (globeverify://dashboard/x) "dashboard" can land in hostname
  if (parsed.scheme && !parsed.scheme.startsWith('http') && parsed.hostname && parsed.hostname !== 'expo-development-client') {
    if (!/^\d|localhost/.test(parsed.hostname)) {
      path = [parsed.hostname, path].filter(Boolean).join('/');
    }
  }

  const params: Record<string, string> = {};
  Object.entries(parsed.queryParams || {}).forEach(([k, v]) => {
    if (typeof v === 'string') params[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') params[k] = v[0];
  });

  return { path: path.toLowerCase(), params };
};

export const parseDeepLink = (url: string | null | undefined): ParsedDeepLink | null => {
  if (!url) return null;
  try {
    const { path, params } = normalizePath(url);
    const result: ParsedDeepLink = {};

    const ref = (params.ref || params.referral || '').trim();
    if (ref) result.referralCode = ref.slice(0, 40);

    if (path.startsWith('auth/callback')) {
      result.isOAuthCallback = true;
      if (params.token) result.token = params.token;
      if (params.new === 'true') result.isNew = true;
      if (params.error) result.error = params.error;
      return result;
    }
    if (path.startsWith('auth/register')) result.authTarget = 'register';
    else if (path.startsWith('auth/login')) result.authTarget = 'login';

    for (const [pattern, screen] of ROUTE_MAP) {
      if (pattern.test(path)) {
        result.screen = screen;
        break;
      }
    }

    // Root link with ?ref= → treat as a sign-up invite
    if (!result.screen && !result.authTarget && result.referralCode) {
      result.authTarget = 'register';
    }

    return result.screen || result.authTarget || result.referralCode ? result : null;
  } catch {
    return null;
  }
};

// ─── Pending referral (survives app restarts until registration) ─────────────

export const savePendingReferral = async (code: string) => {
  try {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
  } catch {}
};

export const getPendingReferral = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
};

export const clearPendingReferral = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {}
};

// ─── Launch flag so the "default start screen" setting doesn't override a deep link ──

let launchedFromDeepLinkScreen = false;

export const markDeepLinkScreenLaunch = () => {
  launchedFromDeepLinkScreen = true;
};

export const hasDeepLinkScreenLaunch = () => launchedFromDeepLinkScreen;
