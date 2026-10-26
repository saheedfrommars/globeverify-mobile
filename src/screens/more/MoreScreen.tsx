import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  User as UserIcon,
  Sun,
  Moon,
  Shield,
  LogOut,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Phone,
  Globe,
  Copy,
  Check,
  Key,
  Trash2,
  AlertTriangle,
  X,
  Activity,
  Clock,
  Monitor,
  Smartphone,
  MapPin,
  Send,
  Sparkles,
  ChevronRight,
  Users,
  Headphones,
  Code2,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient from '../../api/client';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';
import { SkeletonListItem } from '../../components/ui/Skeleton';

const PAD = 16;
const LOADING_TIMEOUT_MS = 2200;

interface LoginActivity {
  _id: string;
  eventType: string;
  success: boolean;
  ipAddress: string;
  ipGeoCountry?: string;
  ipGeoCity?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  createdAt: string;
  riskFlags?: string[];
  authMethod?: string;
}

interface MoreScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToCustomization?: () => void;
}

const formatEventName = (eventType: string, authMethod?: string) => {
  let name = (eventType || 'login')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  if (authMethod) {
    const methodMap: Record<string, string> = {
      password: 'Password',
      google: 'Google',
      '2fa_email': 'Email 2FA',
      '2fa_authenticator': 'Authenticator',
      otp: 'OTP',
    };
    name += ` via ${methodMap[authMethod] || authMethod}`;
  }
  return name;
};

const formatActivityDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const MoreScreen: React.FC<MoreScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
  onNavigateToCustomization,
}) => {
  const { user, logout, refreshUser, updateUser } = useAuth();
  const {
    colors,
    updateSetting,
    setActiveScreen,
    triggerHaptic,
    showDialog,
    showToast,
  } = useAppSettings();

  const [refreshing, setRefreshing] = useState(false);

  // 1. Profile State
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 2. Password Change State
  const [showPwSection, setShowPwSection] = useState(false);
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [savingPw, setSavingPw] = useState(false);

  // 3. Security & Social Connections State
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [generatingTelegramLink, setGeneratingTelegramLink] = useState(false);
  const [telegramLinkData, setTelegramLinkData] = useState<{
    linkToken?: string;
    token?: string;
    botDeepLink?: string;
    deepLinkUrl?: string;
    botUsername?: string;
  } | null>(null);
  const [checkingTelegramStatus, setCheckingTelegramStatus] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);

  // 4. Two-Factor Auth (2FA) Modals State
  const [togglingTwoFA, setTogglingTwoFA] = useState(false);
  const [show2FAMethodModal, setShow2FAMethodModal] = useState(false);
  const [showEnableEmail2FAModal, setShowEnableEmail2FAModal] = useState(false);
  const [enable2FACode, setEnable2FACode] = useState('');
  const [showAuthSetupModal, setShowAuthSetupModal] = useState(false);
  const [authSetupData, setAuthSetupData] = useState<{
    qrCode?: string;
    manualEntryKey: string;
  } | null>(null);
  const [authVerifyCode, setAuthVerifyCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disable2FACode, setDisable2FACode] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);

  // 5. Device & Login Activities State
  const [recentActivities, setRecentActivities] = useState<LoginActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [showAllActivitiesModal, setShowAllActivitiesModal] = useState(false);
  const [allActivities, setAllActivities] = useState<LoginActivity[]>([]);
  const [loadingAllActivities, setLoadingAllActivities] = useState(false);
  const [activityPage, setActivityPage] = useState(0);
  const [activityTotal, setActivityTotal] = useState(0);

  // 6. Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cancellingDelete, setCancellingDelete] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const fetchRecentActivities = useCallback(async () => {
    const timer = setTimeout(() => setLoadingActivities(false), LOADING_TIMEOUT_MS);
    try {
      const res = await apiClient.get('/auth/login-history?limit=3', {
        timeout: LOADING_TIMEOUT_MS,
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setRecentActivities(res.data.data);
      }
    } catch {
      // Ignore if endpoint is offline
    } finally {
      clearTimeout(timer);
      setLoadingActivities(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentActivities();
  }, [fetchRecentActivities]);

  const fetchPaginatedActivities = async (pageIdx: number) => {
    setLoadingAllActivities(true);
    try {
      const res = await apiClient.get(
        `/auth/login-history?limit=15&offset=${pageIdx * 15}`,
        { timeout: LOADING_TIMEOUT_MS }
      );
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setAllActivities(res.data.data);
        setActivityTotal(res.data?.pagination?.total || res.data.data.length);
      }
    } catch {
      showToast('Unable to load full activity history right now.', 'error');
    } finally {
      setLoadingAllActivities(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await Promise.all([refreshUser(), fetchRecentActivities()]);
    setRefreshing(false);
  };

  const handleCopy = async (text: string, key: string, toastMsg: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    setCopiedKey(key);
    showToast(toastMsg, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── 1. Save Profile ────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Full name cannot be empty', 'error');
      return;
    }
    setSavingProfile(true);
    triggerHaptic('light');
    try {
      const { data } = await apiClient.put('/auth/profile', { name: name.trim() });
      await updateUser({ name: data?.name || name.trim() });
      showToast('Profile information updated!', 'success');
    } catch (err: any) {
      showDialog({
        title: 'Profile Update Failed',
        message: err?.response?.data?.message || 'Unable to update your profile right now.',
        variant: 'danger',
        confirmText: 'OK',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── 2. Currency Switch ─────────────────────────────────────────────────────
  const handleCurrencyChange = async (curr: 'NGN' | 'USD') => {
    triggerHaptic('selection');
    try {
      await apiClient.put('/auth/currency', { currency: curr });
      await refreshUser();
      showToast(`Default currency switched to ${curr}`, 'success');
    } catch {
      await updateUser({ currency: curr });
      showToast(`Display currency switched to ${curr}`, 'info');
    }
  };

  // ── 3. Google Account Link / Unlink ────────────────────────────────────────
  const isGoogleLinked = Boolean(user?.isGoogleLinked || user?.authProvider === 'google');

  const handleUnlinkGoogle = () => {
    showDialog({
      title: 'Unlink Google Account?',
      message:
        'Are you sure you want to disconnect your Google account? Make sure you have a password set for local sign-in.',
      variant: 'warning',
      confirmText: 'Unlink Google',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setUnlinkingGoogle(true);
        try {
          await apiClient.delete('/auth/google/unlink');
          await updateUser({ authProvider: 'local', isGoogleLinked: false });
          showToast('Google account unlinked!', 'success');
        } catch (err: any) {
          showDialog({
            title: 'Cannot Unlink Google',
            message:
              err?.response?.data?.message ||
              'Failed to unlink Google account. Please ensure you have set a password first.',
            variant: 'danger',
            confirmText: 'Got It',
          });
        } finally {
          setUnlinkingGoogle(false);
        }
      },
    });
  };

  const handleLinkGoogleInfo = () => {
    showDialog({
      title: 'Link Google Account',
      message:
        'To link your Google account, sign in with Google using the same email address or open the web portal.',
      variant: 'info',
      confirmText: 'Got It',
    });
  };

  // ── 4. Telegram Bot Link / Unlink ──────────────────────────────────────────
  const handleOpenTelegramModal = async () => {
    triggerHaptic('light');
    setShowTelegramModal(true);
    setGeneratingTelegramLink(true);
    try {
      const { data } = await apiClient.post('/auth/telegram/generate-link');
      if (data?.success) {
        setTelegramLinkData(data);
      } else {
        showToast(data?.message || 'Could not generate Telegram token', 'error');
      }
    } catch (err: any) {
      showToast(
        err?.response?.data?.message || 'Error generating Telegram linking code',
        'error'
      );
    } finally {
      setGeneratingTelegramLink(false);
    }
  };

  const handleCheckTelegramStatus = async () => {
    setCheckingTelegramStatus(true);
    triggerHaptic('light');
    try {
      const { data } = await apiClient.get('/auth/telegram/status');
      if (data?.success && data?.isLinked) {
        await updateUser({
          isTelegramLinked: true,
          telegramId: data.telegramId,
          telegramUsername: data.telegramUsername,
          telegramFirstName: data.telegramFirstName,
          telegramLinkedAt: data.linkedAt,
        });
        setShowTelegramModal(false);
        showToast('Telegram Bot connected!', 'success');
      } else {
        showToast(
          'Not connected yet. Tap "Open Bot" or send the /link command in Telegram first.',
          'info'
        );
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to verify status', 'error');
    } finally {
      setCheckingTelegramStatus(false);
    }
  };

  const handleUnlinkTelegram = () => {
    showDialog({
      title: 'Disconnect Telegram Bot?',
      message:
        'Are you sure you want to unlink your Telegram account? You will stop receiving instant OTP push notifications on Telegram.',
      variant: 'danger',
      confirmText: 'Unlink Telegram',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setUnlinkingTelegram(true);
        try {
          await apiClient.delete('/auth/telegram/unlink');
          await updateUser({
            isTelegramLinked: false,
            telegramId: undefined,
            telegramUsername: undefined,
            telegramFirstName: undefined,
          });
          showToast('Telegram account disconnected', 'success');
        } catch (err: any) {
          showToast(
            err?.response?.data?.message || 'Failed to unlink Telegram',
            'error'
          );
        } finally {
          setUnlinkingTelegram(false);
        }
      },
    });
  };

  // ── 5. Two-Factor Authentication (2FA) ─────────────────────────────────────
  const handleToggle2FA = () => {
    triggerHaptic('selection');
    if (user?.twoFactorEnabled) {
      setDisable2FAPassword('');
      setDisable2FACode('');
      setShowDisable2FAModal(true);
    } else {
      setShow2FAMethodModal(true);
    }
  };

  const handleSelectEmail2FA = async () => {
    setShow2FAMethodModal(false);
    setTogglingTwoFA(true);
    try {
      await apiClient.post('/auth/2fa/email/enable');
      showToast('6-digit verification code sent to your email!', 'success');
      setEnable2FACode('');
      setShowEnableEmail2FAModal(true);
    } catch (err: any) {
      showDialog({
        title: '2FA Setup Notice',
        message: err?.response?.data?.message || 'Failed to send 2FA verification email.',
        variant: 'danger',
        confirmText: 'OK',
      });
    } finally {
      setTogglingTwoFA(false);
    }
  };

  const handleVerifyEmail2FA = async () => {
    if (!enable2FACode.trim()) {
      showToast('Enter the 6-digit code from your email', 'error');
      return;
    }
    setVerifying2FA(true);
    try {
      await apiClient.post('/auth/2fa/email/verify', { code: enable2FACode.trim() });
      await updateUser({ twoFactorEnabled: true, twoFactorMethod: 'email' });
      setShowEnableEmail2FAModal(false);
      showToast('Email Two-Factor Authentication enabled!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Invalid verification code', 'error');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleSelectAuthenticator2FA = async () => {
    setShow2FAMethodModal(false);
    setTogglingTwoFA(true);
    try {
      const { data } = await apiClient.post('/auth/2fa/authenticator/setup');
      setAuthSetupData({
        qrCode: data?.data?.qrCode,
        manualEntryKey: data?.data?.manualEntryKey || '',
      });
      setAuthVerifyCode('');
      setShowAuthSetupModal(true);
    } catch (err: any) {
      showDialog({
        title: 'Authenticator Setup Failed',
        message: err?.response?.data?.message || 'Unable to initialize Authenticator setup.',
        variant: 'danger',
        confirmText: 'OK',
      });
    } finally {
      setTogglingTwoFA(false);
    }
  };

  const handleVerifyAuthenticator2FA = async () => {
    if (!authVerifyCode.trim()) {
      showToast('Please enter the 6-digit code from your Authenticator app', 'error');
      return;
    }
    setVerifying2FA(true);
    try {
      const { data } = await apiClient.post('/auth/2fa/authenticator/verify', {
        code: authVerifyCode.trim(),
      });
      await updateUser({ twoFactorEnabled: true, twoFactorMethod: 'authenticator' });
      setShowAuthSetupModal(false);
      showToast('Authenticator 2FA enabled!', 'success');
      if (Array.isArray(data?.data?.backupCodes) && data.data.backupCodes.length > 0) {
        setBackupCodes(data.data.backupCodes);
        setShowBackupCodesModal(true);
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Invalid authenticator code', 'error');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleSubmitDisable2FA = async () => {
    if (!disable2FAPassword.trim()) {
      showToast('Current password is required', 'error');
      return;
    }
    if (user?.twoFactorMethod === 'authenticator' && !disable2FACode.trim()) {
      showToast('Authenticator 6-digit code is required', 'error');
      return;
    }
    setDisabling2FA(true);
    try {
      await apiClient.post('/auth/2fa/disable', {
        password: disable2FAPassword,
        code: disable2FACode.trim(),
      });
      await updateUser({ twoFactorEnabled: false });
      setShowDisable2FAModal(false);
      showToast('Two-Factor Authentication disabled', 'info');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to disable 2FA', 'error');
    } finally {
      setDisabling2FA(false);
    }
  };

  // ── 6. Change Password ─────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      showToast('Please fill in all password fields', 'error');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    setSavingPw(true);
    triggerHaptic('medium');
    try {
      await apiClient.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      showToast('Password updated successfully!', 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPwSection(false);
    } catch (err: any) {
      showDialog({
        title: 'Password Update Failed',
        message: err?.response?.data?.message || 'Could not change password.',
        variant: 'danger',
        confirmText: 'Got It',
      });
    } finally {
      setSavingPw(false);
    }
  };

  // ── 7. Account Deletion (60-Day Schedule) ──────────────────────────────────
  const isPendingDeletion = user?.accountDeletion?.status === 'pending';

  const handleRequestDeleteAccount = async () => {
    if (!deleteReason.trim()) {
      showToast('Please tell us why you want to delete your account', 'error');
      return;
    }
    setDeletingAccount(true);
    try {
      await apiClient.post('/auth/delete-request', { reason: deleteReason.trim() });
      await updateUser({ accountDeletion: { status: 'pending' } });
      setShowDeleteModal(false);
      setDeleteReason('');
      showToast('Account scheduled for deletion in 60 days', 'info');
    } catch (err: any) {
      showToast(
        err?.response?.data?.message || 'Failed to schedule account deletion',
        'error'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleCancelDeleteAccount = async () => {
    setCancellingDelete(true);
    try {
      await apiClient.post('/auth/delete-cancel');
      await updateUser({ accountDeletion: { status: 'none' } });
      showToast('Account deletion cancelled! Welcome back.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to cancel deletion', 'error');
    } finally {
      setCancellingDelete(false);
    }
  };

  const handleOpenCustomization = () => {
    triggerHaptic('light');
    if (onNavigateToCustomization) {
      onNavigateToCustomization();
    } else {
      setActiveScreen('customization');
    }
  };

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'home') onNavigateToHome?.();
    else if (tab === 'buy') onNavigateToBuy?.();
    else if (tab === 'sms') onNavigateToNumbers?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'wallet') onNavigateToWallet?.();
  };

  const currency = (user?.currency || 'USD').toUpperCase();
  const balance =
    currency === 'NGN'
      ? user?.balances?.ngn ?? user?.balance ?? 0
      : user?.balances?.usd ?? user?.balance ?? 0;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        title="Account Settings"
        onBack={onBack}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[s.pageTitle, { color: colors.text }]}>Account Settings</Text>

        {/* ── UI CUSTOMIZATION STUDIO LAUNCH ROW (Dedicated Customization Place!) ── */}
        <TouchableOpacity
          onPress={handleOpenCustomization}
          activeOpacity={0.85}
          style={[
            s.studioBanner,
            {
              backgroundColor: colors.surface,
              borderColor: colors.isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
            },
          ]}
        >
          <View
            style={[
              s.studioIconCircle,
              {
                backgroundColor: colors.isDark
                  ? 'rgba(59, 130, 246, 0.16)'
                  : '#DBEAFE',
              },
            ]}
          >
            <Sparkles size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.studioTitle, { color: colors.text }]}>
              UI & Display Customization Studio
            </Text>
            <Text style={[s.studioSub, { color: colors.textMuted }]}>
              Navigation bar, hamburger menu, bottom modals, loading styles & layout toggles
            </Text>
          </View>
          <ChevronRight size={18} color="#2563EB" />
        </TouchableOpacity>

        {/* ── QUICK ACCESS: SUPPORT, AFFILIATE & API KEYS ── */}
        <View
          style={[
            s.settingsCard,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 6 },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              setActiveScreen('support');
            }}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
              gap: 12,
            }}
          >
            <View
              style={[
                s.studioIconCircle,
                { backgroundColor: colors.primarySoft, width: 38, height: 38, borderRadius: 10 },
              ]}
            >
              <Headphones size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.studioTitle, { color: colors.text, fontSize: 14 }]}>
                Support Tickets & Live Chat
              </Text>
              <Text style={[s.studioSub, { color: colors.textMuted }]}>
                Chat with Vera AI or live human support agents for instant order help
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              setActiveScreen('affiliate');
            }}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
              gap: 12,
            }}
          >
            <View
              style={[
                s.studioIconCircle,
                { backgroundColor: colors.successSoft, width: 38, height: 38, borderRadius: 10 },
              ]}
            >
              <Users size={18} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.studioTitle, { color: colors.text, fontSize: 14 }]}>
                Affiliate & Referral Earnings
              </Text>
              <Text style={[s.studioSub, { color: colors.textMuted }]}>
                Earn 10% lifetime commissions, transfer to wallet, or withdraw payouts
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              setActiveScreen('developer');
            }}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 14,
              gap: 12,
            }}
          >
            <View
              style={[
                s.studioIconCircle,
                { backgroundColor: colors.accentSoft, width: 38, height: 38, borderRadius: 10 },
              ]}
            >
              <Code2 size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.studioTitle, { color: colors.text, fontSize: 14 }]}>
                API Keys & Webhooks
              </Text>
              <Text style={[s.studioSub, { color: colors.textMuted }]}>
                Generate secret API keys, configure webhook callbacks & monitor usage
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── 1. PROFILE INFORMATION (Matches Web SettingsPage.tsx!) ───────── */}
        <View
          style={[
            s.settingsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
            <UserIcon size={19} color="#2563EB" />
            <Text style={[s.cardHeaderTitle, { color: colors.text }]}>
              Profile Information
            </Text>
          </View>

          <View style={s.formGroup}>
            <Text style={[s.label, { color: colors.textMuted }]}>Full Name</Text>
            <TextInput
              style={[
                s.inputField,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={s.formGroup}>
            <Text style={[s.label, { color: colors.textMuted }]}>Email Address</Text>
            <TextInput
              style={[
                s.inputField,
                s.disabledInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  color: colors.textMuted,
                },
              ]}
              value={user?.email || ''}
              editable={false}
            />
            <Text style={[s.inputHint, { color: colors.textMuted }]}>
              Email cannot be changed
            </Text>
          </View>

          {user?.phoneNumber ? (
            <View style={s.formGroup}>
              <Text style={[s.label, { color: colors.textMuted }]}>Phone Number</Text>
              <View
                style={[
                  s.iconInputRow,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Phone size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 14, color: colors.textMuted }}>
                  {user.phoneNumber}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Account Status Badges */}
          <View style={s.formGroup}>
            <Text style={[s.label, { color: colors.textMuted }]}>Account Status</Text>
            <View style={s.badgesWrap}>
              <View
                style={[
                  s.statusBadge,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              >
                <Text style={[s.roleBadgeText, { color: colors.primary }]}>
                  {(user?.role || 'user').toUpperCase()}
                </Text>
              </View>

              {user?.countryCode ? (
                <View
                  style={[
                    s.statusBadge,
                    { backgroundColor: colors.bg, borderColor: colors.border },
                  ]}
                >
                  <Globe size={13} color={colors.textSecondary} />
                  <Text style={[s.badgeText, { color: colors.text }]}>
                    {user.countryCode}
                  </Text>
                </View>
              ) : null}

              {user?.isVerified ? (
                <View style={s.verifiedBadge}>
                  <CheckCircle2 size={13} color="#10B981" />
                  <Text style={s.verifiedBadgeText}>Verified</Text>
                </View>
              ) : null}

              {isGoogleLinked ? (
                <View style={s.googleBadge}>
                  <Text style={s.googleBadgeText}>G · Google</Text>
                </View>
              ) : null}

              {user?.isTelegramLinked ? (
                <View style={s.telegramBadge}>
                  <Send size={12} color="#0088CC" />
                  <Text style={s.telegramBadgeText}>Telegram</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Referral Code */}
          {user?.referralCode ? (
            <View style={s.formGroup}>
              <Text style={[s.label, { color: colors.textMuted }]}>Referral Code</Text>
              <TouchableOpacity
                onPress={() =>
                  handleCopy(user.referralCode!, 'ref', 'Referral code copied!')
                }
                style={[
                  s.dashedCopyRow,
                  { backgroundColor: colors.bg, borderColor: colors.primary },
                ]}
                activeOpacity={0.75}
              >
                <Key size={16} color={colors.primary} />
                <Text style={[s.codeMonoText, { color: colors.primary }]}>
                  {user.referralCode}
                </Text>
                <View
                  style={[
                    s.copySmallBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {copiedKey === 'ref' ? (
                    <Check size={13} color="#10B981" />
                  ) : (
                    <Copy size={13} color={colors.textMuted} />
                  )}
                  <Text style={[s.copySmallBtnText, { color: colors.text }]}>
                    {copiedKey === 'ref' ? 'Copied' : 'Copy'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Developer API Key */}
          {user?.apiKey ? (
            <View style={s.formGroup}>
              <Text style={[s.label, { color: colors.textMuted }]}>
                Developer API Key
              </Text>
              <TouchableOpacity
                onPress={() =>
                  handleCopy(user.apiKey!, 'api', 'Developer API key copied!')
                }
                style={[
                  s.dashedCopyRow,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
                activeOpacity={0.75}
              >
                <Key size={16} color={colors.textMuted} />
                <Text
                  style={[s.codeMonoText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {user.apiKey}
                </Text>
                <View
                  style={[
                    s.copySmallBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {copiedKey === 'api' ? (
                    <Check size={13} color="#10B981" />
                  ) : (
                    <Copy size={13} color={colors.textMuted} />
                  )}
                  <Text style={[s.copySmallBtnText, { color: colors.text }]}>
                    {copiedKey === 'api' ? 'Copied' : 'Copy'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.primaryBtn, savingProfile && { opacity: 0.65 }]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            activeOpacity={0.85}
          >
            {savingProfile ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={s.primaryBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── 2. APPEARANCE & WALLET SUMMARY (Matches Web Appearance Card!) ── */}
        <View
          style={[
            s.settingsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
            {colors.isDark ? (
              <Moon size={19} color="#8B5CF6" />
            ) : (
              <Sun size={19} color="#2563EB" />
            )}
            <Text style={[s.cardHeaderTitle, { color: colors.text }]}>
              Appearance
            </Text>
          </View>

          <View style={s.infoRowBetween}>
            <Text style={[s.rowMediumText, { color: colors.text }]}>Theme Mode</Text>
            <View
              style={[
                s.segmentedSwitch,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('selection');
                  updateSetting('themeMode', 'light');
                }}
                style={[
                  s.segmentOption,
                  !colors.isDark && { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[
                    s.segmentText,
                    { color: !colors.isDark ? colors.primary : colors.textMuted },
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('selection');
                  updateSetting('themeMode', 'dark');
                }}
                style={[
                  s.segmentOption,
                  colors.isDark && { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[
                    s.segmentText,
                    { color: colors.isDark ? colors.primary : colors.textMuted },
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: colors.border }]} />

          <View style={s.infoRowBetween}>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Currency</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['NGN', 'USD'] as const).map((curr) => {
                const active = currency === curr;
                return (
                  <TouchableOpacity
                    key={curr}
                    onPress={() => handleCurrencyChange(curr)}
                    style={[
                      s.currencyPill,
                      {
                        backgroundColor: active ? colors.primarySoft : colors.bg,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '700',
                        color: active ? colors.primary : colors.textMuted,
                      }}
                    >
                      {curr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.infoRowBetween}>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Balance</Text>
            <Text
              style={{
                fontSize: 16.5,
                fontWeight: '800',
                color: colors.primary,
              }}
            >
              {currency === 'NGN' ? '₦' : '$'}
              {Number(balance || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        {/* ── 3. SECURITY & CONNECTIONS (Google, Telegram Bot, 2FA, Password!) ── */}
        <View
          style={[
            s.settingsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
            <Shield size={19} color="#2563EB" />
            <Text style={[s.cardHeaderTitle, { color: colors.text }]}>
              Security & Connections
            </Text>
          </View>

          {/* Row 1: Google Account */}
          <View style={[s.connectionItem, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={s.connTitleRow}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#4285F4' }}>
                  G
                </Text>
                <Text style={[s.connTitle, { color: colors.text }]}>
                  Google Account
                </Text>
              </View>
              <Text style={[s.connDesc, { color: colors.textMuted }]}>
                {isGoogleLinked ? 'Connected' : 'Sign in quickly with Google.'}
              </Text>
            </View>

            {isGoogleLinked ? (
              <TouchableOpacity
                style={s.unlinkBtn}
                onPress={handleUnlinkGoogle}
                disabled={unlinkingGoogle}
              >
                {unlinkingGoogle ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={s.unlinkBtnText}>Unlink</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.linkBtn}
                onPress={handleLinkGoogleInfo}
              >
                <Text style={s.linkBtnText}>Link Account</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Row 2: Telegram Bot */}
          <View style={[s.connectionItem, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={s.connTitleRow}>
                <Send size={15} color="#0088CC" />
                <Text style={[s.connTitle, { color: colors.text }]}>
                  Telegram Bot
                </Text>
              </View>
              <Text style={[s.connDesc, { color: colors.textMuted }]}>
                {user?.isTelegramLinked
                  ? `Connected${user.telegramUsername ? ` as @${user.telegramUsername}` : ''}`
                  : 'Instant OTP push, quick numbers & live balance alerts.'}
              </Text>
            </View>

            {user?.isTelegramLinked ? (
              <TouchableOpacity
                style={s.unlinkBtn}
                onPress={handleUnlinkTelegram}
                disabled={unlinkingTelegram}
              >
                {unlinkingTelegram ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={s.unlinkBtnText}>Unlink</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.linkBtn}
                onPress={handleOpenTelegramModal}
                disabled={generatingTelegramLink}
              >
                {generatingTelegramLink ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Text style={s.linkBtnText}>Connect Telegram</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Row 3: Two-Factor Auth (2FA) */}
          <View style={[s.connectionItem, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[s.connTitle, { color: colors.text }]}>
                Two-Factor Auth
              </Text>
              <Text style={[s.connDesc, { color: colors.textMuted }]}>
                {user?.twoFactorEnabled
                  ? `Active (${
                      user.twoFactorMethod === 'authenticator'
                        ? 'Authenticator App'
                        : 'Email OTP'
                    })`
                  : 'Disabled'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                s.twoFaToggleBtn,
                user?.twoFactorEnabled
                  ? s.twoFaOnBtn
                  : { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
              onPress={handleToggle2FA}
              disabled={togglingTwoFA}
            >
              {togglingTwoFA ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: user?.twoFactorEnabled ? '#10B981' : colors.textMuted,
                  }}
                >
                  {user?.twoFactorEnabled ? '● On' : '○ Off'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Row 4: Change Password */}
          <TouchableOpacity
            style={[
              s.secondaryOutlineBtn,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setShowPwSection((v) => !v);
            }}
          >
            <Lock size={15} color={colors.text} />
            <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
              {showPwSection ? 'Hide Password Form' : 'Change Password'}
            </Text>
          </TouchableOpacity>

          {showPwSection && (
            <View style={[s.pwFormWrap, { borderTopColor: colors.border }]}>
              {(
                [
                  {
                    field: 'currentPassword',
                    key: 'current',
                    label: 'Current Password',
                  },
                  { field: 'newPassword', key: 'new', label: 'New Password' },
                  {
                    field: 'confirmPassword',
                    key: 'confirm',
                    label: 'Confirm New Password',
                  },
                ] as const
              ).map((item) => (
                <View key={item.field} style={s.formGroup}>
                  <Text style={[s.label, { color: colors.textMuted }]}>
                    {item.label}
                  </Text>
                  <View
                    style={[
                      s.pwInputRow,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      style={[s.pwInput, { color: colors.text }]}
                      secureTextEntry={!showPw[item.key]}
                      value={pwForm[item.field]}
                      onChangeText={(val) =>
                        setPwForm((p) => ({ ...p, [item.field]: val }))
                      }
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowPw((p) => ({ ...p, [item.key]: !p[item.key] }))
                      }
                    >
                      {showPw[item.key] ? (
                        <EyeOff size={17} color={colors.textMuted} />
                      ) : (
                        <Eye size={17} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[s.primaryBtn, savingPw && { opacity: 0.65 }]}
                onPress={handleChangePassword}
                disabled={savingPw}
              >
                {savingPw ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 4. ACCOUNT ACTIVITY & DEVICES (Matches Web Account Activity Card!) ── */}
        <View
          style={[
            s.settingsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
            <Activity size={19} color="#2563EB" />
            <Text style={[s.cardHeaderTitle, { color: colors.text }]}>
              Account Activity & Devices
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: -4 }}>
            Recent logins, connected devices, and security events on your account.
          </Text>

          {loadingActivities ? (
            <SkeletonListItem />
          ) : recentActivities.length === 0 ? (
            <Text style={{ fontSize: 13.5, color: colors.textMuted, paddingVertical: 8 }}>
              No recent login activity recorded yet.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {recentActivities.map((act, idx) => (
                <View
                  key={act._id || idx}
                  style={[
                    s.activityRow,
                    idx > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingTop: 10,
                    },
                  ]}
                >
                  {act.deviceType === 'mobile' ? (
                    <Smartphone size={18} color={colors.primary} style={{ marginTop: 2 }} />
                  ) : (
                    <Monitor size={18} color={colors.primary} style={{ marginTop: 2 }} />
                  )}

                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={s.activityHeaderBetween}>
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: '700',
                          color: act.success === false ? '#EF4444' : colors.text,
                          flexShrink: 1,
                        }}
                        numberOfLines={1}
                      >
                        {formatEventName(act.eventType, act.authMethod)}
                        {act.success === false ? ' Failed' : ''}
                      </Text>

                      <View style={s.activityTimeWrap}>
                        <Clock size={11} color={colors.textMuted} />
                        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                          {formatActivityDate(act.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={s.activityMetaWrap}>
                      <View style={s.metaBadgeItem}>
                        <Globe size={11.5} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          {act.browser || 'App / Browser'}
                          {act.os ? ` on ${act.os}` : ''}
                        </Text>
                      </View>

                      <View style={s.metaBadgeItem}>
                        <MapPin size={11.5} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          {act.ipGeoCity && act.ipGeoCountry
                            ? `${act.ipGeoCity}, ${act.ipGeoCountry}`
                            : act.ipAddress || 'Active Session'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[
              s.secondaryOutlineBtn,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
            onPress={() => {
              triggerHaptic('light');
              setActivityPage(0);
              setShowAllActivitiesModal(true);
              fetchPaginatedActivities(0);
            }}
          >
            <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
              View All Activities
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 5. ACCOUNT ACTIONS & DANGER ZONE (Matches Web Danger Zone!) ──── */}
        <View
          style={[
            s.settingsCard,
            {
              backgroundColor: colors.surface,
              borderColor: 'rgba(239, 68, 68, 0.3)',
            },
          ]}
        >
          <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
            <LogOut size={19} color="#EF4444" />
            <Text style={[s.cardHeaderTitle, { color: colors.text }]}>
              Account Actions
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: -4 }}>
            Logging out will end your current session on this device.
          </Text>

          <TouchableOpacity
            style={[
              s.secondaryOutlineBtn,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
            onPress={() => {
              showDialog({
                title: 'Log Out of GlobeVerify?',
                message: 'Are you sure you want to end your session on this device?',
                variant: 'danger',
                confirmText: 'Log Out',
                cancelText: 'Cancel',
                onConfirm: () => logout?.(),
              });
            }}
          >
            <LogOut size={16} color={colors.text} />
            <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
              Log Out
            </Text>
          </TouchableOpacity>

          <View
            style={[
              s.divider,
              { backgroundColor: 'rgba(239, 68, 68, 0.18)', marginVertical: 4 },
            ]}
          />

          {isPendingDeletion ? (
            <View style={s.pendingDeletionBox}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <AlertTriangle size={18} color="#EF4444" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.pendingDeletionTitle}>
                    Account scheduled for deletion
                  </Text>
                  <Text style={[s.pendingDeletionDesc, { color: colors.textMuted }]}>
                    Your account will be permanently deleted in 60 days. You can cancel this at any time to restore full access.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  s.secondaryOutlineBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    marginTop: 10,
                  },
                ]}
                onPress={handleCancelDeleteAccount}
                disabled={cancellingDelete}
              >
                {cancellingDelete ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
                    Cancel Deletion Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
                Permanently delete your account and all associated data. This action cannot be undone after 60 days.
              </Text>
              <TouchableOpacity
                style={s.dangerFullBtn}
                onPress={() => {
                  triggerHaptic('warning');
                  setDeleteReason('');
                  setShowDeleteModal(true);
                }}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text style={s.dangerFullBtnText}>Request Account Deletion</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODALS FOR TELEGRAM, 2FA, ACTIVITIES & DELETE ACCOUNT
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* 1. TELEGRAM BOT CONNECT MODAL */}
      <Modal
        visible={showTelegramModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTelegramModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Send size={20} color="#0088CC" />
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  Connect Telegram Bot
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTelegramModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              Receive instant OTP push notifications, rent dedicated lines, and check your balances directly in Telegram.
            </Text>

            {generatingTelegramLink ? (
              <View style={{ paddingVertical: 32, alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="large" color="#0088CC" />
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  Generating secure linking token...
                </Text>
              </View>
            ) : telegramLinkData ? (
              (() => {
                const linkCode =
                  telegramLinkData.linkToken || telegramLinkData.token || '';
                const botName = telegramLinkData.botUsername || 'GlobeVerifyBot';
                const deepLink =
                  telegramLinkData.botDeepLink ||
                  telegramLinkData.deepLinkUrl ||
                  `https://t.me/${botName}?start=link_${linkCode}`;

                return (
                  <View style={{ gap: 14 }}>
                    <View style={s.telegramOptionBox}>
                      <Text style={[s.rowMediumText, { color: colors.text }]}>
                        Option 1: One-Click Connect (Recommended)
                      </Text>
                      <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                        Tap below to launch the bot in Telegram and connect automatically:
                      </Text>
                      <TouchableOpacity
                        style={[s.primaryBtn, { backgroundColor: '#0088CC', marginTop: 4 }]}
                        onPress={() => Linking.openURL(deepLink)}
                      >
                        <Send size={15} color="#FFFFFF" />
                        <Text style={s.primaryBtnText}>Open @{botName}</Text>
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        s.telegramManualBox,
                        { backgroundColor: colors.bg, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[s.rowMediumText, { color: colors.text }]}>
                        Option 2: Manual Code Entry
                      </Text>
                      <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                        Send this command to @{botName} in Telegram:
                      </Text>
                      <TouchableOpacity
                        style={[
                          s.dashedCopyRow,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            marginTop: 4,
                          },
                        ]}
                        onPress={() =>
                          handleCopy(
                            `/link ${linkCode}`,
                            'tg-code',
                            `Copied! Send /link ${linkCode} in Telegram`
                          )
                        }
                      >
                        <Text style={[s.codeMonoText, { color: colors.primary }]}>
                          /link {linkCode}
                        </Text>
                        <Copy size={15} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={[
                          s.secondaryOutlineBtn,
                          { flex: 1, backgroundColor: colors.bg, borderColor: colors.border },
                        ]}
                        onPress={() => setShowTelegramModal(false)}
                      >
                        <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
                          Close
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.primaryBtn, { flex: 1 }]}
                        onPress={handleCheckTelegramStatus}
                        disabled={checkingTelegramStatus}
                      >
                        {checkingTelegramStatus ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={s.primaryBtnText}>I&apos;ve Connected</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()
            ) : null}
          </View>
        </View>
      </Modal>

      {/* 2. 2FA METHOD SELECTION MODAL */}
      <Modal
        visible={show2FAMethodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShow2FAMethodModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                Enable Two-Factor Auth
              </Text>
              <TouchableOpacity onPress={() => setShow2FAMethodModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              Choose a verification method to protect your GlobeVerify account.
            </Text>

            <TouchableOpacity
              style={[
                s.methodChoiceBtn,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
              onPress={handleSelectAuthenticator2FA}
            >
              <Shield size={20} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowMediumText, { color: colors.text }]}>
                  Authenticator App (Recommended)
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  Use Google Authenticator, Authy, or 1Password
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.methodChoiceBtn,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
              onPress={handleSelectEmail2FA}
            >
              <Lock size={20} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowMediumText, { color: colors.text }]}>
                  Email OTP Verification
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  Receive a 6-digit code via email on each login
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. EMAIL 2FA VERIFY MODAL */}
      <Modal
        visible={showEnableEmail2FAModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEnableEmail2FAModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                Verify Email to Enable 2FA
              </Text>
              <TouchableOpacity onPress={() => setShowEnableEmail2FAModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              Enter the 6-digit verification code sent to {user?.email}.
            </Text>
            <TextInput
              style={[
                s.otpCenterInput,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={enable2FACode}
              onChangeText={setEnable2FACode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[s.primaryBtn, verifying2FA && { opacity: 0.65 }]}
              onPress={handleVerifyEmail2FA}
              disabled={verifying2FA}
            >
              {verifying2FA ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.primaryBtnText}>Verify & Enable 2FA</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. AUTHENTICATOR SETUP MODAL */}
      <Modal
        visible={showAuthSetupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAuthSetupModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                Setup Authenticator App
              </Text>
              <TouchableOpacity onPress={() => setShowAuthSetupModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              1. Copy this secret setup key into Google Authenticator or Authy:
            </Text>
            {authSetupData?.manualEntryKey ? (
              <TouchableOpacity
                style={[
                  s.dashedCopyRow,
                  { backgroundColor: colors.bg, borderColor: colors.primary },
                ]}
                onPress={() =>
                  handleCopy(
                    authSetupData.manualEntryKey,
                    'auth-key',
                    'Authenticator setup key copied!'
                  )
                }
              >
                <Text
                  style={[s.codeMonoText, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {authSetupData.manualEntryKey}
                </Text>
                <Copy size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : null}

            <Text style={[s.modalSub, { color: colors.textMuted, marginTop: 4 }]}>
              2. Enter the 6-digit code generated by your Authenticator app:
            </Text>
            <TextInput
              style={[
                s.otpCenterInput,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={authVerifyCode}
              onChangeText={setAuthVerifyCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[s.primaryBtn, verifying2FA && { opacity: 0.65 }]}
              onPress={handleVerifyAuthenticator2FA}
              disabled={verifying2FA}
            >
              {verifying2FA ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.primaryBtnText}>Verify & Enable</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. BACKUP CODES MODAL */}
      <Modal
        visible={showBackupCodesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBackupCodesModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Save Your Backup Codes
            </Text>
            <Text style={{ fontSize: 13, color: '#EF4444', lineHeight: 19 }}>
              Save these backup codes in a secure place. If you lose your phone, these codes are the only way to access your account.
            </Text>
            <View
              style={[
                s.backupGrid,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              {backupCodes.map((code, idx) => (
                <Text
                  key={idx}
                  style={[s.backupCodeItem, { color: colors.text }]}
                >
                  {code}
                </Text>
              ))}
            </View>
            <TouchableOpacity
              style={[
                s.secondaryOutlineBtn,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
              onPress={() =>
                handleCopy(backupCodes.join('\n'), 'bkp', 'All backup codes copied!')
              }
            >
              <Copy size={15} color={colors.text} />
              <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
                Copy All Backup Codes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => setShowBackupCodesModal(false)}
            >
              <Text style={s.primaryBtnText}>I Have Saved My Backup Codes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 6. DISABLE 2FA MODAL */}
      <Modal
        visible={showDisable2FAModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDisable2FAModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                Disable Two-Factor Auth
              </Text>
              <TouchableOpacity onPress={() => setShowDisable2FAModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              Enter your current password to disable Two-Factor Authentication.
            </Text>
            <TextInput
              style={[
                s.inputField,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              secureTextEntry
              value={disable2FAPassword}
              onChangeText={setDisable2FAPassword}
              placeholder="Current Password"
              placeholderTextColor={colors.textMuted}
            />
            {user?.twoFactorMethod === 'authenticator' && (
              <TextInput
                style={[
                  s.otpCenterInput,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={disable2FACode}
                onChangeText={setDisable2FACode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="6-Digit Authenticator Code"
                placeholderTextColor={colors.textMuted}
              />
            )}
            <TouchableOpacity
              style={[
                s.primaryBtn,
                { backgroundColor: '#EF4444' },
                disabling2FA && { opacity: 0.65 },
              ]}
              onPress={handleSubmitDisable2FA}
              disabled={disabling2FA}
            >
              {disabling2FA ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.primaryBtnText}>Disable 2FA</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. VIEW ALL DEVICE ACTIVITIES MODAL (Matches Web ActivitiesPage.tsx!) */}
      <Modal
        visible={showAllActivitiesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllActivitiesModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                maxHeight: '84%',
              },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Activity size={20} color="#2563EB" />
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  Account Activity & Devices
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAllActivitiesModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingAllActivities ? (
              <View style={{ paddingVertical: 24, gap: 10 }}>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </View>
            ) : allActivities.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.textMuted, paddingVertical: 24 }}>
                No login history found.
              </Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                showsVerticalScrollIndicator={false}
              >
                {allActivities.map((act, idx) => (
                  <View
                    key={act._id || idx}
                    style={[
                      s.activityRow,
                      idx > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: 12,
                      },
                    ]}
                  >
                    {act.deviceType === 'mobile' ? (
                      <Smartphone size={18} color={colors.primary} style={{ marginTop: 2 }} />
                    ) : (
                      <Monitor size={18} color={colors.primary} style={{ marginTop: 2 }} />
                    )}
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={s.activityHeaderBetween}>
                        <Text
                          style={{
                            fontSize: 13.5,
                            fontWeight: '700',
                            color: act.success === false ? '#EF4444' : colors.text,
                          }}
                        >
                          {formatEventName(act.eventType, act.authMethod)}
                          {act.success === false ? ' Failed' : ''}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                          {formatActivityDate(act.createdAt)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {act.browser || 'Unknown Browser'}
                        {act.os ? ` on ${act.os}` : ''} ·{' '}
                        {act.ipGeoCity && act.ipGeoCountry
                          ? `${act.ipGeoCity}, ${act.ipGeoCountry}`
                          : act.ipAddress}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {activityTotal > 15 && (
              <View style={s.paginationRow}>
                <TouchableOpacity
                  disabled={activityPage === 0}
                  onPress={() => {
                    const nextP = Math.max(0, activityPage - 1);
                    setActivityPage(nextP);
                    fetchPaginatedActivities(nextP);
                  }}
                  style={[
                    s.pageBtn,
                    { borderColor: colors.border },
                    activityPage === 0 && { opacity: 0.4 },
                  ]}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>
                    Previous
                  </Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  Page {activityPage + 1} of {Math.ceil(activityTotal / 15)}
                </Text>
                <TouchableOpacity
                  disabled={(activityPage + 1) * 15 >= activityTotal}
                  onPress={() => {
                    const nextP = activityPage + 1;
                    setActivityPage(nextP);
                    fetchPaginatedActivities(nextP);
                  }}
                  style={[
                    s.pageBtn,
                    { borderColor: colors.border },
                    (activityPage + 1) * 15 >= activityTotal && { opacity: 0.4 },
                  ]}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 8. REQUEST ACCOUNT DELETION MODAL */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.bottomModalSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="#EF4444" />
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  Delete Account
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              Your account will be permanently deleted in 60 days. During this period you can cancel at any time to restore full access.
            </Text>

            <Text style={[s.label, { color: colors.textMuted }]}>
              Why are you leaving? *
            </Text>
            <TextInput
              style={[
                s.inputField,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                  minHeight: 80,
                  textAlignVertical: 'top',
                },
              ]}
              multiline
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder="Tell us your reason..."
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.secondaryOutlineBtn,
                  { flex: 1, backgroundColor: colors.bg, borderColor: colors.border },
                ]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[s.secondaryOutlineBtnText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  { flex: 1, backgroundColor: '#EF4444' },
                  deletingAccount && { opacity: 0.65 },
                ]}
                onPress={handleRequestDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryBtnText}>Confirm Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ModernBottomNav activeTab="more" onSelectTab={handleSelectNavTab} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 8,
    gap: 18,
  },
  pageTitle: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
  },

  // Studio Launch Banner
  studioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  studioIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  studioSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },

  // Single-Layer Settings Card (Matches Web .settings-card)
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  cardHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  disabledInput: {
    opacity: 0.75,
  },
  inputHint: {
    fontSize: 11.5,
    marginTop: -2,
  },
  iconInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  // Status Badges
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badgeText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  verifiedBadgeText: {
    color: '#10B981',
    fontSize: 12.5,
    fontWeight: '700',
  },
  googleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: 'rgba(66, 133, 244, 0.08)',
    borderColor: 'rgba(66, 133, 244, 0.25)',
  },
  googleBadgeText: {
    color: '#4285F4',
    fontSize: 12.5,
    fontWeight: '700',
  },
  telegramBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 136, 204, 0.08)',
    borderColor: 'rgba(0, 136, 204, 0.25)',
  },
  telegramBadgeText: {
    color: '#0088CC',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // Referral & API Key Row
  dashedCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeMonoText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  copySmallBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 11,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryOutlineBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },

  // Appearance
  infoRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowMediumText: {
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedSwitch: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  currencyPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },

  // Security & Connections
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  connTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  connDesc: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  linkBtn: {
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderColor: 'rgba(66, 133, 244, 0.28)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  linkBtnText: {
    color: '#2563EB',
    fontSize: 12.5,
    fontWeight: '700',
  },
  unlinkBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  unlinkBtnText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '700',
  },
  twoFaToggleBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  twoFaOnBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  pwFormWrap: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 12,
  },
  pwInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    height: 44,
  },
  pwInput: {
    flex: 1,
    fontSize: 14,
  },

  // Account Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  activityHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  activityTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  metaBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Danger Zone
  dangerFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    paddingVertical: 12.5,
    borderRadius: 10,
  },
  dangerFullBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },
  pendingDeletionBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.22)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  pendingDeletionTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  pendingDeletionDesc: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 18,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'flex-end',
  },
  bottomModalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  telegramOptionBox: {
    backgroundColor: 'rgba(0, 136, 204, 0.06)',
    borderColor: 'rgba(0, 136, 204, 0.22)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  telegramManualBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  methodChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  otpCenterInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 6,
  },
  backupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  backupCodeItem: {
    width: '47%',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 4,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
