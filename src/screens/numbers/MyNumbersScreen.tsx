import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  History,
  XCircle,
  RotateCcw,
} from 'lucide-react-native';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient, {
  getMemoryCache,
  getCachedData,
  setCachedData,
} from '../../api/client';
import { socketService } from '../../services/socketService';
import { SkeletonNumberCard } from '../../components/ui/Skeleton';
import { AnimatedEmptyState } from '../../components/ui/AnimatedEmptyState';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;
const LOADING_TIMEOUT_MS = 2200;

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
}

interface MyNumbersScreenProps {
  onBack?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToRentals?: () => void;
}

const CHEAP_SERVICE_NAME_MAP: Record<string, string> = {
  wa: 'WhatsApp',
  tg: 'Telegram',
  ig: 'Instagram',
  fb: 'Facebook',
  go: 'Google / YouTube',
  tw: 'Twitter / X',
  ds: 'Discord',
  vi: 'Viber',
  ti: 'TikTok',
  nf: 'Netflix',
  am: 'Amazon',
  ap: 'Apple',
  ub: 'Uber',
  wb: 'WeChat',
  mm: 'Microsoft',
  ya: 'Yandex',
  vk: 'VKontakte',
  sn: 'Snapchat',
  ts: 'PayPal',
  oi: 'Tinder',
  ot: 'Other Service',
  line: 'LINE',
  ka: 'KakaoTalk',
  kf: 'Kufar',
  bd: 'Badoo',
  re: 'Reddit',
  li: 'LinkedIn',
  sc: 'SoundCloud',
  st: 'Steam',
};

const formatServiceName = (name?: string, slug?: string): string => {
  if (name && name.length > 3 && !CHEAP_SERVICE_NAME_MAP[name.toLowerCase()]) {
    return name;
  }
  const key = (slug || name || '').toLowerCase().trim();
  if (CHEAP_SERVICE_NAME_MAP[key]) return CHEAP_SERVICE_NAME_MAP[key];
  if (name && name.length > 1) return name.charAt(0).toUpperCase() + name.slice(1);
  if (slug && slug.length > 1) return slug.charAt(0).toUpperCase() + slug.slice(1);
  return name || slug || 'Verification';
};

const extractOtpCode = (code?: string, message?: string): string => {
  if (code && code.length <= 10 && !/\s/.test(code)) return code;
  const text = message || code || '';
  const match =
    text.match(/(?:code|is|pin|verification|otp)[:\s-]*([A-Z0-9]{4,8})\b/i) ||
    text.match(/\b(\d{4,8})\b/);
  return match ? match[1] : (code || 'Code');
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

export const MyNumbersScreen: React.FC<MyNumbersScreenProps> = ({
  onBack,
  onNavigateToBuy,
  onNavigateToHome,
  onNavigateToWallet,
  onNavigateToRentals,
}) => {
  const { settings, colors, triggerHaptic, showDialog, showToast } = useAppSettings();

  const initialCachedNumbers = getMemoryCache<NumberItem[]>('my_numbers_list');

  const [numbers, setNumbers] = useState<NumberItem[]>(initialCachedNumbers || []);
  const [loading, setLoading] = useState(!initialCachedNumbers);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const fadeAnim = useRef(new Animated.Value(initialCachedNumbers ? 1 : 0)).current;

  useEffect(() => {
    if (!initialCachedNumbers) {
      getCachedData<NumberItem[]>('my_numbers_list').then((saved) => {
        if (saved && saved.length > 0) {
          setNumbers(saved);
          setLoading(false);
        }
      });
    }
  }, [initialCachedNumbers]);

  // Only tick every second when viewing active numbers that have an expiry timer
  const hasActiveExpiringNumbers =
    activeTab === 'active' &&
    settings.showExpiryTimer &&
    numbers.some(
      (n) =>
        ['active', 'waiting'].includes((n.status || '').toLowerCase()) &&
        Boolean(n.expiresAt)
    );

  useEffect(() => {
    if (!hasActiveExpiringNumbers) return;
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [hasActiveExpiringNumbers]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, activeTab]);

  const fetchNumbers = useCallback(async () => {
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, LOADING_TIMEOUT_MS);

    try {
      const [numbersRes, cheapRes] = await Promise.allSettled([
        apiClient.get('/numbers/my-numbers', { timeout: 5000 }),
        apiClient.get('/cheap/my-numbers', { timeout: 5000 }),
      ]);

      const anySuccess =
        numbersRes.status === 'fulfilled' || cheapRes.status === 'fulfilled';
      if (!anySuccess) {
        return;
      }

      let allNumbers: NumberItem[] = [];
      if (numbersRes.status === 'fulfilled' && numbersRes.value.data?.data) {
        const d = Array.isArray(numbersRes.value.data.data) ? numbersRes.value.data.data : [];
        allNumbers = [...allNumbers, ...d];
      }
      if (cheapRes.status === 'fulfilled' && cheapRes.value.data?.data) {
        const d = Array.isArray(cheapRes.value.data.data) ? cheapRes.value.data.data : [];
        allNumbers = [...allNumbers, ...d];
      }

      allNumbers.sort(
        (a, b) =>
          new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime()
      );
      setNumbers(allNumbers);
      setCachedData('my_numbers_list', allNumbers);
    } catch (err) {
      console.warn('[MyNumbers] fetch error:', err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
    const pollInterval = setInterval(fetchNumbers, 15000);

    const unsubOtp = socketService.subscribe('otp_received', (data: any) => {
      triggerHaptic('success');
      if (data && data.otp) {
        showToast(`New OTP Message: ${data.otp}`, 'success');
      } else {
        showToast('New SMS Message Received!', 'success');
      }
      fetchNumbers();
    });

    const unsubRental = socketService.subscribe('rental_extended', () => {
      showToast('A rental number was auto-extended.', 'info');
      fetchNumbers();
    });

    return () => {
      clearInterval(pollInterval);
      unsubOtp();
      unsubRental();
    };
  }, [fetchNumbers, triggerHaptic, showToast]);

  const activeList = numbers.filter((n) =>
    ['active', 'waiting'].includes((n.status || '').toLowerCase())
  );
  const historyList = numbers.filter(
    (n) => !['active', 'waiting'].includes((n.status || '').toLowerCase())
  );

  useEffect(() => {
    if (!loading && activeList.length === 0 && historyList.length > 0 && activeTab === 'active') {
      setActiveTab('history');
    }
  }, [loading, activeList.length, historyList.length, activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await fetchNumbers();
    setRefreshing(false);
  };

  const handleCopy = async (text: string, key: string, label = 'Copied to clipboard!') => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    setCopiedKey(key);
    showToast(label, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCheckOTP = async (numId: string, type?: string) => {
    setActionLoadingId(numId);
    triggerHaptic('light');
    try {
      if (type === 'cheap') {
        await apiClient.get(`/cheap/status/${numId}`);
      } else {
        await apiClient.get(`/numbers/${numId}/check-otp`);
      }
      await fetchNumbers();
      showToast('Checked for new SMS messages', 'info');
    } catch {
      showToast('No new verification SMS received yet.', 'info');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelNumber = (numId: string, type?: string) => {
    showDialog({
      title: 'Cancel Number & Refund?',
      message:
        'Are you sure you want to cancel this number? If the number has not received an SMS code, your wallet will be refunded automatically.',
      variant: 'danger',
      confirmText: 'Cancel & Refund',
      cancelText: 'Keep Number',
      onConfirm: async () => {
        setActionLoadingId(numId);
        try {
          if (type === 'cheap') {
            await apiClient.post(`/cheap/cancel/${numId}`);
          } else {
            await apiClient.post(`/numbers/${numId}/cancel`);
          }
          showToast('Number cancelled and refunded!', 'success');
          await fetchNumbers();
        } catch (err: any) {
          showDialog({
            title: 'Cancel Notice',
            message:
              err?.response?.data?.message ||
              'Unable to cancel this number right now. It may have already received an SMS or expired.',
            variant: 'warning',
            confirmText: 'Got It',
          });
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleReuseNumber = async (numId: string) => {
    setActionLoadingId(numId);
    triggerHaptic('light');
    try {
      const infoRes = await apiClient.get(`/numbers/${numId}/reuse`);
      const info = infoRes.data?.data;

      if (infoRes.data?.success === false || !info) {
        showDialog({
          title: 'Reuse Unavailable',
          message: infoRes.data?.message || 'This number cannot be reused right now.',
          variant: 'warning',
          confirmText: 'Got It',
        });
        setActionLoadingId(null);
        return;
      }

      if (info.requiresReactivation) {
        setActionLoadingId(null);
        showDialog({
          title: 'Reactivate Number?',
          message: `Reactivating this number for another SMS costs ${info.currency || ''} ${info.reactivationCost}. Would you like to proceed?`,
          variant: 'confirm',
          confirmText: 'Pay & Reactivate',
          cancelText: 'Cancel',
          onConfirm: async () => {
            setActionLoadingId(numId);
            try {
              const res = await apiClient.post(`/numbers/${numId}/reuse`, {
                payToReactivate: true,
              });
              if (res.data?.success) {
                showToast('Number reactivated successfully!', 'success');
                await fetchNumbers();
                setActiveTab('active');
              } else {
                showDialog({
                  title: 'Reuse Notice',
                  message: res.data?.message || 'Failed to reactivate number.',
                  variant: 'warning',
                  confirmText: 'OK',
                });
              }
            } catch (e: any) {
              showDialog({
                title: 'Reuse Failed',
                message: e?.response?.data?.message || 'Could not reactivate number.',
                variant: 'danger',
                confirmText: 'OK',
              });
            } finally {
              setActionLoadingId(null);
            }
          },
        });
      } else if (info.canResendForFree) {
        setActionLoadingId(null);
        showDialog({
          title: 'Receive Another SMS?',
          message: 'This number can receive another verification SMS for free. Proceed?',
          variant: 'confirm',
          confirmText: 'Activate Free SMS',
          cancelText: 'Cancel',
          onConfirm: async () => {
            setActionLoadingId(numId);
            try {
              const res = await apiClient.post(`/numbers/${numId}/reuse`, {});
              if (res.data?.success) {
                showToast('Number ready for another SMS!', 'success');
                await fetchNumbers();
                setActiveTab('active');
              } else {
                showDialog({
                  title: 'Reuse Notice',
                  message: res.data?.message || 'Cannot reuse this number right now.',
                  variant: 'warning',
                  confirmText: 'OK',
                });
              }
            } catch (e: any) {
              showDialog({
                title: 'Reuse Notice',
                message: e?.response?.data?.message || 'Failed to reuse number.',
                variant: 'danger',
                confirmText: 'OK',
              });
            } finally {
              setActionLoadingId(null);
            }
          },
        });
      } else {
        setActionLoadingId(null);
        showDialog({
          title: 'Reuse Notice',
          message: info.message || 'This number cannot be reused right now.',
          variant: 'warning',
          confirmText: 'Got It',
        });
      }
    } catch (err: any) {
      setActionLoadingId(null);
      showDialog({
        title: 'Reuse Notice',
        message:
          err?.response?.data?.message || 'This number cannot be reused right now.',
        variant: 'warning',
        confirmText: 'Got It',
      });
    }
  };

  const formatTimeRemaining = (expiresAt?: string): string => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt).getTime() - nowTick;
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'home') onNavigateToHome?.();
    else if (tab === 'buy') onNavigateToBuy?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'wallet') onNavigateToWallet?.();
  };

  const displayedList = activeTab === 'active' ? activeList : historyList;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        title="My Numbers"
        onBack={onBack}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── HEADER ROW (Matches MyNumbersPage.tsx!) ─────────────────────── */}
        <View style={[s.headerBar, { borderBottomColor: colors.border }]}>
          <Text style={[s.pageTitle, { color: colors.text }]}>My Numbers</Text>

          <View style={s.headerControls}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab('active');
              }}
              style={[
                s.tabPill,
                activeTab === 'active' && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Smartphone
                size={14}
                color={activeTab === 'active' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  s.tabPillText,
                  { color: activeTab === 'active' ? colors.primary : colors.textMuted },
                ]}
              >
                Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab('history');
              }}
              style={[
                s.tabPill,
                activeTab === 'history' && { backgroundColor: colors.primarySoft },
              ]}
            >
              <History
                size={14}
                color={activeTab === 'history' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  s.tabPillText,
                  { color: activeTab === 'history' ? colors.primary : colors.textMuted },
                ]}
              >
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onRefresh}
              style={[
                s.refreshBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <RefreshCw size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── NUMBERS LIST (Exact Match to Web NumberCard.tsx — Zero Nested Boxes!) ── */}
        {loading ? (
          <View style={{ gap: 14 }}>
            <SkeletonNumberCard />
            <SkeletonNumberCard />
          </View>
        ) : displayedList.length === 0 ? (
          <AnimatedEmptyState
            type="numbers"
            title={
              activeTab === 'active'
                ? 'No Active Numbers Yet'
                : 'No Order History Yet'
            }
            subtitle={
              activeTab === 'active'
                ? "You don't have any active numbers waiting for SMS right now. Purchase a virtual number to receive OTP codes."
                : "You haven't placed any number orders yet. Your completed and expired verifications will appear here."
            }
            actionLabel="Buy a Number"
            onAction={onNavigateToBuy}
          />
        ) : (
          <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
            {displayedList.map((num) => {
              const numId = num.id || (num as any)._id || num.phoneNumber;
              const isPhoneCopied = copiedKey === `ph-${numId}`;
              const isHistory = activeTab === 'history';
              const isBusy = actionLoadingId === numId;
              const dotColor =
                num.status === 'active' || num.status === 'completed'
                  ? '#10B981'
                  : num.status === 'waiting'
                  ? '#F59E0B'
                  : '#EF4444';
              const serviceTitle = formatServiceName(num.serviceName, num.service);
              const countryTitle = (num.countryName || num.countryCode || 'UNITED STATES').toUpperCase();

              return (
                <View
                  key={numId}
                  style={[
                    s.modernNumberCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    isHistory && { opacity: 0.85 },
                  ]}
                >
                  {/* Top Row: Status Dot + Service Name + Cheap Tag + Country Pill */}
                  <View style={s.mncTop}>
                    <View style={s.mncService}>
                      <View style={[s.mncDot, { backgroundColor: dotColor }]} />
                      <Text
                        style={[s.mncServiceName, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {serviceTitle}
                      </Text>
                      {num.type === 'cheap' && (
                        <View style={[s.cheapBadgePill, { backgroundColor: colors.isDark ? '#1E293B' : '#EFF6FF' }]}>
                          <Text style={[s.cheapBadgeText, { color: colors.primary }]}>CHEAP</Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        s.mncCountryPill,
                        { backgroundColor: colors.bg },
                      ]}
                    >
                      <Text
                        style={[s.mncCountryText, { color: colors.textMuted }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {countryTitle}
                      </Text>
                    </View>
                  </View>

                  {/* Phone Number Row */}
                  <TouchableOpacity
                    style={s.mncMain}
                    onPress={() =>
                      handleCopy(num.phoneNumber, `ph-${numId}`, 'Phone number copied!')
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[s.mncPhone, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                    >
                      {num.phoneNumber}
                    </Text>
                    {isPhoneCopied ? (
                      <Check size={20} color="#10B981" />
                    ) : (
                      <Copy size={20} color={colors.textMuted} style={{ opacity: 0.45 }} />
                    )}
                  </TouchableOpacity>

                  {/* Countdown Timer for Active Numbers (Matches Web NumberCard.tsx!) */}
                  {!isHistory && num.expiresAt ? (
                    <Text style={[s.mncTimer, { color: colors.textMuted }]}>
                      Expires in{' '}
                      <Text style={s.mncTimeValue}>
                        {formatTimeRemaining(num.expiresAt)}
                      </Text>
                    </Text>
                  ) : null}

                  {/* Messages Area: Displays 2–3 Messages at a Time, Tap Code or Tap Message to Copy! */}
                  {num.otps && num.otps.length > 0 ? (
                    <View style={s.mncMessagesWrapper}>
                      <ScrollView
                        style={s.mncMessagesScroll}
                        contentContainerStyle={{ gap: 10 }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={num.otps.length > 2}
                      >
                        {(expandedCardIds[numId]
                          ? num.otps
                          : num.otps.slice(0, 3)
                        ).map((otp, idx) => {
                          const isOtpCopied = copiedKey === `otp-${numId}-${idx}`;
                          const isMsgCopied = copiedKey === `msg-${numId}-${idx}`;
                          const clean = cleanMessage(otp.message || otp.code);
                          const safeCode = extractOtpCode(otp.code, otp.message);
                          return (
                            <View
                              key={idx}
                              style={[
                                s.mncMessageBubble,
                                {
                                  backgroundColor: colors.isDark
                                    ? 'rgba(255,255,255,0.04)'
                                    : 'rgba(15, 23, 42, 0.035)',
                                },
                              ]}
                            >
                              {/* Tap Code Header to Copy Verification Code */}
                              <TouchableOpacity
                                style={s.mncBubbleHeader}
                                onPress={() =>
                                  handleCopy(
                                    safeCode,
                                    `otp-${numId}-${idx}`,
                                    `Code ${safeCode} copied!`
                                  )
                                }
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={s.mncCode}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                >
                                  {safeCode}
                                </Text>
                                <View style={s.copyActionWrap}>
                                  {isOtpCopied ? (
                                    <Check size={15} color="#10B981" />
                                  ) : (
                                    <Copy size={15} color={colors.textMuted} />
                                  )}
                                </View>
                              </TouchableOpacity>

                              {/* Tap Message Text to Copy Full SMS Message (Matches Web NumberCard.tsx!) */}
                              {settings.showSmsMessagePreview && clean && clean !== safeCode ? (
                                <TouchableOpacity
                                  style={s.mncBubbleBody}
                                  onPress={() =>
                                    handleCopy(
                                      clean,
                                      `msg-${numId}-${idx}`,
                                      'Full SMS message copied!'
                                    )
                                  }
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      s.mncText,
                                      {
                                        color: isMsgCopied
                                          ? '#10B981'
                                          : colors.textMuted,
                                      },
                                    ]}
                                  >
                                    {clean}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          );
                        })}
                      </ScrollView>

                      {num.otps.length > 3 && (
                        <TouchableOpacity
                          onPress={() => {
                            triggerHaptic('selection');
                            setExpandedCardIds((prev) => ({
                              ...prev,
                              [numId]: !prev[numId],
                            }));
                          }}
                          style={s.moreMessagesToggle}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                            {expandedCardIds[numId]
                              ? 'Show latest 3 messages'
                              : `View all ${num.otps.length} messages (${num.otps.length - 3} more)`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={s.mncNoMessages}>
                      {!isHistory ? (
                        <>
                          <ActivityIndicator size="small" color={colors.textMuted} />
                          <Text style={{ fontSize: 13.5, color: colors.textMuted }}>
                            Waiting for SMS...
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 13.5, color: colors.textMuted }}>
                          No SMS received
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Footer Actions */}
                  <View style={s.mncFooterActions}>
                    {!isHistory ? (
                      <>
                        <TouchableOpacity
                          style={[
                            s.outlineActionBtn,
                            { borderColor: colors.border },
                          ]}
                          onPress={() => handleCheckOTP(numId, num.type)}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color={colors.text} />
                          ) : (
                            <>
                              <RefreshCw size={15} color={colors.text} />
                              <Text style={[s.outlineActionText, { color: colors.text }]}>
                                Check
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {(num.status === 'active' || num.status === 'waiting') && num.type !== 'rental' && (
                          <TouchableOpacity
                            style={s.dangerActionBtn}
                            onPress={() => handleCancelNumber(numId, num.type)}
                            disabled={isBusy}
                          >
                            <XCircle size={15} color="#EF4444" />
                            <Text style={s.dangerActionText}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      num.type !== 'rental' && num.type !== 'cheap' && (
                        <TouchableOpacity
                          style={[
                            s.outlineActionBtn,
                            { borderColor: colors.border },
                          ]}
                          onPress={() => handleReuseNumber(numId)}
                          disabled={isBusy}
                        >
                          <RotateCcw size={15} color={colors.text} />
                          <Text style={[s.outlineActionText, { color: colors.text }]}>
                            Reuse
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav
        activeTab="sms"
        badgeCount={activeList.length}
        onSelectTab={handleSelectNavTab}
      />
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  pageTitle: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
    marginTop: 4,
  },
  buyBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },

  // Modern Number Card (Matches MyNumbersPage.css — Strict Overflow Prevention)
  modernNumberCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
  },
  mncTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mncService: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  mncServiceName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cheapBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2,
  },
  cheapBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mncCountryPill: {
    maxWidth: '44%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  mncCountryText: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mncMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 10,
  },
  mncPhone: {
    flex: 1,
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.4,
  },
  mncTimer: {
    fontSize: 12.5,
    marginTop: -4,
  },
  mncTimeValue: {
    color: '#EF4444',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mncMessagesWrapper: {
    gap: 8,
  },
  mncMessagesScroll: {
    maxHeight: 215, // Shows 2-3 messages with code at a time just like web .mnc-messages-area
  },
  mncMessageBubble: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 5,
    overflow: 'hidden',
  },
  mncBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mncCode: {
    flex: 1,
    flexShrink: 1,
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyActionWrap: {
    padding: 2,
    flexShrink: 0,
  },
  mncBubbleBody: {
    width: '100%',
  },
  mncText: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  moreMessagesToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  mncNoMessages: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  mncFooterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  outlineActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  outlineActionText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  dangerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dangerActionText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
