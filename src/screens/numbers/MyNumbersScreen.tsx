import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  History,
  XCircle,
  RotateCcw,
  Home,
  ShoppingCart,
  Wallet,
  PhoneCall,
  MessageSquare,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SkeletonNumberCard } from '../../components/ui/Skeleton';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 20;

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface NumberItem {
  id: string;
  phoneNumber: string;
  countryCode?: string;
  countryName?: string;
  service?: string;
  serviceName: string;
  status: string;
  type?: string;
  cost?: number;
  otps?: Array<{
    code: string;
    message?: string;
    sender?: string;
    receivedAt?: string;
  }>;
  purchasedAt?: string;
  expiresAt?: string;
  autoRenew?: boolean;
}

export interface PendingOrder {
  _id: string;
  service: string;
  country: string;
  status: string;
  createdAt: string;
}

interface MyNumbersScreenProps {
  onBack?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToRentals?: () => void;
}

// ─── Initial Fallback Orders ─────────────────────────────────────────────────

const INITIAL_FALLBACK_NUMBERS: NumberItem[] = [
  {
    id: '6a59f8c1a18eb6c6526676fd',
    phoneNumber: '+1 337 390 0564',
    countryCode: 'US',
    countryName: 'United States',
    service: '1012',
    serviceName: 'WhatsApp',
    status: 'completed',
    type: 'sms',
    cost: 2094.4,
    otps: [
      {
        code: '922703',
        sender: 'Unknown',
        message: 'Your WhatsApp code: 922-703. Do not share this code.',
        receivedAt: '2026-07-17T09:44:15.000Z',
      },
    ],
    purchasedAt: '2026-07-17T09:41:21.607Z',
    expiresAt: '2026-07-19T08:53:58.523Z',
  },
  {
    id: '6a5551ae5aef75ad5a19eefe',
    phoneNumber: '+1 423 789 8422',
    countryCode: 'US',
    countryName: 'United States',
    service: '1705',
    serviceName: 'Neon Money Talks',
    status: 'completed',
    type: 'sms',
    cost: 224.22,
    otps: [
      {
        code: '611910',
        sender: 'Unknown',
        message: 'Your Neon verification code is: 611910',
        receivedAt: '2026-07-13T21:01:30.035Z',
      },
    ],
    purchasedAt: '2026-07-13T20:59:26.340Z',
    expiresAt: '2026-07-13T21:09:26.000Z',
  },
  {
    id: '6a538c4d5aef75ad5a198e5c',
    phoneNumber: '+1 908 612 7430',
    countryCode: 'US',
    countryName: 'United States',
    service: '829',
    serviceName: 'Signal',
    status: 'completed',
    type: 'sms',
    cost: 612.48,
    otps: [
      {
        code: '994488',
        sender: 'Unknown',
        message: 'SIGNAL code: 994488. Do not share this code with anyone.',
        receivedAt: '2026-07-12T12:46:51.327Z',
      },
    ],
    purchasedAt: '2026-07-12T12:45:01.374Z',
    expiresAt: '2026-07-12T12:55:01.000Z',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getCountryFlag = (code?: string): string => {
  if (!code || code.length !== 2) return '🌐';
  const cc = code.toUpperCase();
  const first = cc.charCodeAt(0) - 65 + 0x1f1e6;
  const second = cc.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
};

const cleanMessage = (msg?: string): string => {
  if (!msg) return '';
  return msg
    .replace(/&lt;#&gt;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\n+/g, ' ')
    .trim();
};

const timeAgo = (dateStr?: string): string => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

// ─── Simple & Pretty Number Card ─────────────────────────────────────────────

const SimpleNumberCard: React.FC<{
  num: NumberItem;
  isHistory: boolean;
  isActionLoading: boolean;
  copiedKey: string | null;
  onCopyPhone: (phone: string, id: string) => void;
  onCopyOtp: (code: string, id: string) => void;
  onCheckOTP: (id: string, type?: string) => void;
  onCancel: (id: string, type?: string) => void;
  onReuse: (id: string) => void;
}> = ({
  num,
  isHistory,
  isActionLoading,
  copiedKey,
  onCopyPhone,
  onCopyOtp,
  onCheckOTP,
  onCancel,
  onReuse,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (isHistory || !num.expiresAt) return;
    const calculateTime = () => {
      const diff = new Date(num.expiresAt!).getTime() - Date.now();
      if (diff <= 0) return 'Expired';
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    setTimeLeft(calculateTime());
    const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
    return () => clearInterval(timer);
  }, [num.expiresAt, isHistory]);

  const flag = getCountryFlag(num.countryCode);
  const latestOtp = num.otps?.[num.otps.length - 1];
  const hasCode = !!latestOtp?.code;
  const clean = cleanMessage(latestOtp?.message);
  const isPhoneCopied = copiedKey === `phone-${num.id}`;
  const isOtpCopied = copiedKey === `otp-${num.id}`;

  return (
    <View style={[s.card, isHistory && s.cardHistory]}>
      {/* ── Top Header: Service + Country + Status ──────────────────── */}
      <View style={s.cardHeader}>
        <View style={s.serviceInfo}>
          <Text style={s.serviceTitle} numberOfLines={1}>
            {num.serviceName}
          </Text>
          <View style={s.countryRow}>
            <Text style={s.flagEmoji}>{flag}</Text>
            <Text style={s.countrySubtitle} numberOfLines={1}>
              {num.countryName || num.countryCode || 'Global'}
            </Text>
            {num.purchasedAt && (
              <>
                <Text style={s.dotSep}>•</Text>
                <Text style={s.timeAgo}>{timeAgo(num.purchasedAt)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Status Pill */}
        <View style={[s.statusPill, hasCode ? s.statusPillSuccess : s.statusPillNeutral]}>
          <View style={[s.statusDot, { backgroundColor: hasCode ? '#22C55E' : '#8E8E93' }]} />
          <Text style={[s.statusPillText, { color: hasCode ? '#22C55E' : '#8E8E93' }]}>
            {hasCode ? 'Received' : !isHistory ? 'Active' : num.status || 'Expired'}
          </Text>
        </View>
      </View>

      {/* ── Phone Number Row (Minimalist, Responsive) ───────────────── */}
      <TouchableOpacity
        style={s.phoneRow}
        onPress={() => onCopyPhone(num.phoneNumber, num.id)}
        activeOpacity={0.7}
      >
        <Text
          style={s.phoneNumberText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {num.phoneNumber}
        </Text>

        <View style={[s.copyBtn, isPhoneCopied && s.copyBtnSuccess]}>
          {isPhoneCopied ? (
            <Check size={14} color="#22C55E" />
          ) : (
            <Copy size={14} color="#8E8E93" />
          )}
          <Text style={[s.copyBtnText, isPhoneCopied && { color: '#22C55E' }]}>
            {isPhoneCopied ? 'Copied' : 'Copy'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── Expiry Timer (if active) ─────────────────────────────────── */}
      {!isHistory && timeLeft && timeLeft !== 'Expired' && (
        <Text style={s.expiryTimerText}>
          Expires in <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{timeLeft}</Text>
        </Text>
      )}

      {/* ── Verification Code Area (Clean, Uncluttered) ──────────────── */}
      {hasCode ? (
        <View style={s.codeBox}>
          <View style={s.codeTop}>
            <Text style={s.codeLabel}>VERIFICATION CODE</Text>
            <TouchableOpacity
              style={[s.codeCopyPill, isOtpCopied && s.codeCopyPillDone]}
              onPress={() => onCopyOtp(latestOtp.code, num.id)}
              activeOpacity={0.7}
            >
              {isOtpCopied ? (
                <>
                  <Check size={12} color="#22C55E" />
                  <Text style={[s.codeCopyText, { color: '#22C55E' }]}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={12} color="#FFFFFF" />
                  <Text style={s.codeCopyText}>Copy Code</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={s.codeDisplay}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            selectable
          >
            {latestOtp.code}
          </Text>

          {clean ? (
            <TouchableOpacity
              style={s.smsTextWrap}
              onPress={() => onCopyOtp(clean, `msg-${num.id}`)}
              activeOpacity={0.7}
            >
              <Text style={s.smsMessageText} numberOfLines={2}>
                "{clean}"
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : !isHistory ? (
        <View style={s.waitingRow}>
          <ActivityIndicator size="small" color="#8E8E93" />
          <Text style={s.waitingText}>Waiting for SMS verification code...</Text>
        </View>
      ) : null}

      {/* ── Footer Actions ───────────────────────────────────────────── */}
      <View style={s.cardActions}>
        {!isHistory ? (
          <>
            <TouchableOpacity
              style={s.actionBtnOutline}
              onPress={() => onCheckOTP(num.id, num.type)}
              disabled={isActionLoading}
              activeOpacity={0.7}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RefreshCw size={13} color="#FFFFFF" />
                  <Text style={s.actionBtnText}>Check SMS</Text>
                </>
              )}
            </TouchableOpacity>

            {!hasCode && (
              <TouchableOpacity
                style={s.actionBtnSubtle}
                onPress={() => onCancel(num.id, num.type)}
                disabled={isActionLoading}
                activeOpacity={0.7}
              >
                <XCircle size={13} color="#8E8E93" />
                <Text style={s.actionBtnSubtleText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={s.actionBtnOutline}
            onPress={() => onReuse(num.id)}
            disabled={isActionLoading}
            activeOpacity={0.7}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <RotateCcw size={13} color="#FFFFFF" />
                <Text style={s.actionBtnText}>Reuse Number</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Main Screen Component ───────────────────────────────────────────────────

export const MyNumbersScreen: React.FC<MyNumbersScreenProps> = ({
  onBack,
  onNavigateToBuy,
  onNavigateToHome,
  onNavigateToWallet,
  onNavigateToRentals,
}) => {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [numbers, setNumbers] = useState<NumberItem[]>(INITIAL_FALLBACK_NUMBERS);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ─── Fetch Numbers ─────────────────────────────────────────────────────────

  const fetchNumbers = useCallback(async () => {
    try {
      const [numbersRes, pendingRes, cheapRes] = await Promise.allSettled([
        apiClient.get('/numbers/my-numbers'),
        apiClient.get('/numbers/pending'),
        apiClient.get('/cheap/my-numbers'),
      ]);

      let allNumbers: NumberItem[] = [];

      if (numbersRes.status === 'fulfilled' && numbersRes.value.data?.data) {
        const list = Array.isArray(numbersRes.value.data.data) ? numbersRes.value.data.data : [];
        allNumbers = [...allNumbers, ...list];
      }
      if (cheapRes.status === 'fulfilled' && cheapRes.value.data?.data) {
        const list = Array.isArray(cheapRes.value.data.data) ? cheapRes.value.data.data : [];
        allNumbers = [...allNumbers, ...list];
      }

      if (allNumbers.length > 0) {
        allNumbers.sort(
          (a, b) =>
            new Date(b.purchasedAt || b.otps?.[0]?.receivedAt || 0).getTime() -
            new Date(a.purchasedAt || a.otps?.[0]?.receivedAt || 0).getTime()
        );
        setNumbers(allNumbers);
      }

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.success) {
        const list = Array.isArray(pendingRes.value.data.data) ? pendingRes.value.data.data : [];
        setPendingOrders(list);
      }
    } catch (err) {
      console.warn('[MyNumbers] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
    const interval = setInterval(fetchNumbers, 15000);
    return () => clearInterval(interval);
  }, [fetchNumbers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchNumbers();
  }, [fetchNumbers]);

  // ─── Clipboard & Actions ───────────────────────────────────────────────────

  const handleCopyPhone = async (phone: string, id: string) => {
    await Clipboard.setStringAsync(phone);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedKey(`phone-${id}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyOtp = async (code: string, id: string) => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedKey(`otp-${id}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCheckOTP = async (numberId: string, type?: string) => {
    setActionLoadingId(numberId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (type === 'cheap') {
        await apiClient.get(`/cheap/status/${numberId}`);
      } else {
        await apiClient.get(`/numbers/${numberId}/check-otp`);
      }
      await fetchNumbers();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn('[MyNumbers] check error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelNumber = (numberId: string, type?: string) => {
    Alert.alert(
      'Cancel Number',
      'Cancel this number and receive an instant refund to your wallet balance?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel & Refund',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(numberId);
            try {
              if (type === 'cheap') {
                await apiClient.post(`/cheap/cancel/${numberId}`);
              } else {
                await apiClient.post(`/numbers/${numberId}/cancel`);
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchNumbers();
            } catch (err: any) {
              Alert.alert('Notice', err.response?.data?.message || 'Could not cancel number.');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReuse = async (numberId: string) => {
    setActionLoadingId(numberId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const infoRes = await apiClient.get(`/numbers/${numberId}/reuse`);
      const info = infoRes.data?.data;
      if (!info) {
        Alert.alert('Notice', infoRes.data?.message || 'Cannot reuse this number.');
        return;
      }
      if (info.requiresReactivation) {
        Alert.alert(
          'Reactivate Number',
          `Reactivating costs ${info.currency || '$'} ${info.reactivationCost}. Proceed?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reactivate',
              onPress: async () => {
                await apiClient.post(`/numbers/${numberId}/reuse`, { payToReactivate: true });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await fetchNumbers();
                setActiveTab('active');
              },
            },
          ]
        );
      } else if (info.canResendForFree) {
        await apiClient.post(`/numbers/${numberId}/reuse`, {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchNumbers();
        setActiveTab('active');
      }
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.message || 'Cannot reuse number.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Filter numbers ────────────────────────────────────────────────────────

  const activeNumbers = numbers.filter(
    (n) =>
      ['active', 'waiting', 'pending'].includes(n.status?.toLowerCase()) ||
      (n.expiresAt && new Date(n.expiresAt).getTime() > Date.now())
  );
  const historyNumbers = numbers.filter((n) => !activeNumbers.includes(n));

  const bottomNavItems = [
    { id: 'home', label: 'Home', icon: Home, onPress: onNavigateToHome },
    { id: 'buy', label: 'Buy Number', icon: ShoppingCart, onPress: onNavigateToBuy },
    { id: 'numbers', label: 'My SMS', icon: MessageSquare, badge: activeNumbers.length, onPress: () => {} },
    { id: 'wallet', label: 'Wallet', icon: Wallet, onPress: onNavigateToWallet },
    { id: 'rentals', label: 'Rentals', icon: PhoneCall, onPress: onNavigateToRentals },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />

      {/* ── MODERN LUXURY HEADER ────────────────────────────────────────── */}
      <ModernHeader
        title="My Numbers"
        subtitle={`${activeNumbers.length} active verification lines`}
        onBack={onBack}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {/* ── Clean 2-Tab Pill Switcher ──────────────────────────────────── */}
      <View style={s.tabsRow}>
        <View style={s.tabsTrack}>
          <TouchableOpacity
            style={[s.tabItem, activeTab === 'active' && s.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('active');
            }}
            activeOpacity={0.8}
          >
            <Smartphone size={14} color={activeTab === 'active' ? '#FFFFFF' : '#8E8E93'} />
            <Text style={[s.tabItemText, activeTab === 'active' && s.tabItemTextActive]}>
              Active ({activeNumbers.length + pendingOrders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabItem, activeTab === 'history' && s.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('history');
            }}
            activeOpacity={0.8}
          >
            <History size={14} color={activeTab === 'history' ? '#FFFFFF' : '#8E8E93'} />
            <Text style={[s.tabItemText, activeTab === 'history' && s.tabItemTextActive]}>
              History ({historyNumbers.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable Card Content ───────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 110 + Math.max(insets.bottom, 12) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
      >
        {loading ? (
          <View style={s.cardsStack}>
            <SkeletonNumberCard />
            <SkeletonNumberCard />
          </View>
        ) : activeTab === 'active' ? (
          <View style={s.cardsStack}>
            {/* Pending Queued Orders */}
            {pendingOrders.map((order) => (
              <View key={order._id} style={[s.card, s.cardPending]}>
                <View style={s.cardHeader}>
                  <View style={s.serviceInfo}>
                    <Text style={s.serviceTitle}>{order.service}</Text>
                    <Text style={s.countrySubtitle}>{order.country}</Text>
                  </View>
                  <View style={[s.statusPill, s.statusPillNeutral]}>
                    <Text style={s.statusPillText}>Queued</Text>
                  </View>
                </View>
                <Text style={s.pendingNote}>Connecting to carrier line...</Text>
              </View>
            ))}

            {/* Active Numbers */}
            {activeNumbers.length === 0 && pendingOrders.length === 0 ? (
              <View style={s.emptyCard}>
                <Smartphone size={36} color="#8E8E93" style={{ opacity: 0.4 }} />
                <Text style={s.emptyTitle}>No active numbers</Text>
                <Text style={s.emptySubtitle}>
                  You don't have any numbers waiting for SMS right now.
                </Text>
                <TouchableOpacity
                  style={s.emptyBuyBtn}
                  onPress={() => onNavigateToBuy?.()}
                  activeOpacity={0.85}
                >
                  <Text style={s.emptyBuyBtnText}>Buy a Number</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeNumbers.map((num) => (
                <SimpleNumberCard
                  key={num.id}
                  num={num}
                  isHistory={false}
                  isActionLoading={actionLoadingId === num.id}
                  copiedKey={copiedKey}
                  onCopyPhone={handleCopyPhone}
                  onCopyOtp={handleCopyOtp}
                  onCheckOTP={handleCheckOTP}
                  onCancel={handleCancelNumber}
                  onReuse={handleReuse}
                />
              ))
            )}
          </View>
        ) : (
          /* History Numbers */
          <View style={s.cardsStack}>
            {historyNumbers.length === 0 ? (
              <View style={s.emptyCard}>
                <History size={36} color="#8E8E93" style={{ opacity: 0.4 }} />
                <Text style={s.emptyTitle}>No history</Text>
                <Text style={s.emptySubtitle}>Your completed numbers will appear here.</Text>
              </View>
            ) : (
              historyNumbers.map((num) => (
                <SimpleNumberCard
                  key={num.id}
                  num={num}
                  isHistory={true}
                  isActionLoading={actionLoadingId === num.id}
                  copiedKey={copiedKey}
                  onCopyPhone={handleCopyPhone}
                  onCopyOtp={handleCopyOtp}
                  onCheckOTP={handleCheckOTP}
                  onCancel={handleCancelNumber}
                  onReuse={handleReuse}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ── MODERN FLOATING DOCK BOTTOM NAVIGATION ──────────────────────── */}
      <ModernBottomNav
        activeTab="sms"
        badgeCount={activeNumbers.length}
        onSelectTab={(tabId: NavTabId) => {
          if (tabId === 'home') {
            onNavigateToHome?.();
          } else if (tabId === 'buy') {
            onNavigateToBuy?.();
          } else if (tabId === 'rentals') {
            onNavigateToRentals?.();
          } else if (tabId === 'wallet') {
            onNavigateToWallet?.();
          }
        }}
      />
    </SafeAreaView>
  );
};

// ─── Minimalist Styles (No rainbow colors, clean, Apple-like) ────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingTop: 8,
    paddingBottom: 14,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161618',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  refreshCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161618',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2-Tab Switcher
  tabsRow: {
    paddingHorizontal: PAD,
    marginBottom: 14,
  },
  tabsTrack: {
    flexDirection: 'row',
    backgroundColor: '#141416',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#222226',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 4,
  },
  cardsStack: {
    gap: 12,
  },

  // Card
  card: {
    backgroundColor: '#121214',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHistory: {
    opacity: 0.65,
  },
  cardPending: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pendingNote: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  serviceInfo: {
    flex: 1,
    gap: 3,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flagEmoji: { fontSize: 13 },
  countrySubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  dotSep: { fontSize: 10, color: '#48484A' },
  timeAgo: { fontSize: 11, color: '#8E8E93' },

  // Status Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  statusPillNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Phone Row
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  phoneNumberText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyBtnSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },

  // Expiry Timer
  expiryTimerText: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Code Box
  codeBox: {
    backgroundColor: '#161619',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  codeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#8E8E93',
  },
  codeCopyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#242428',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeCopyPillDone: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  codeCopyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  codeDisplay: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  smsTextWrap: {
    paddingTop: 2,
  },
  smsMessageText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },

  // Waiting Row
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  waitingText: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C1C20',
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionBtnSubtle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#18181A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnSubtleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#121214',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBuyBtn: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBuyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },

  // Bottom Navigation Bar
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0C0C0E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navIconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  navIconWrapperActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  navBadge: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0C0C0E',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});

export default MyNumbersScreen;
