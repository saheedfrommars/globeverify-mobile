import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  Smartphone,
  DollarSign,
  Activity,
  ShoppingCart,
  Copy,
  Check,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient, {
  getMemoryCache,
  getCachedData,
  setCachedData,
} from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonStatsRow } from '../../components/ui/Skeleton';
import { AnimatedEmptyState } from '../../components/ui/AnimatedEmptyState';
import { DashboardPopup } from '../../components/ui/DashboardPopup';
import { TelegramBotPopup } from '../../components/ui/TelegramBotPopup';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;

interface DashboardStats {
  activeNumbers: number;
  totalSpent: number;
  grossSpent: number;
  pendingOrders: number;
}

interface ActiveNumber {
  id: string;
  phoneNumber: string;
  countryCode?: string;
  countryName?: string;
  service?: string;
  serviceName?: string;
  status?: string;
  cost?: number;
  otps?: Array<{
    code: string;
    sender?: string;
    message?: string;
    receivedAt?: string;
  }>;
  purchasedAt?: string;
}

interface CategorySpending {
  type: string;
  total: number;
  percent: number;
  color: string;
}

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  currency?: string;
  status: string;
  description: string;
  createdAt: string;
}

interface DashboardScreenProps {
  onNavigateToBuy?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToServices?: () => void;
  onNavigateToMore?: () => void;
}

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

interface DashboardCacheSnapshot {
  stats: DashboardStats;
  activeNumbersList: ActiveNumber[];
  categorySpendings: CategorySpending[];
  recentTransactions: TransactionItem[];
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToBuy,
  onNavigateToWallet,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToMore,
}) => {
  const { user, refreshUser } = useAuth();
  const { settings, colors, triggerHaptic, showToast } = useAppSettings();

  const initialCache = getMemoryCache<DashboardCacheSnapshot>('dashboard_snapshot');

  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'all'>('30');
  const [stats, setStats] = useState<DashboardStats>(
    initialCache?.stats || {
      activeNumbers: 0,
      totalSpent: 0,
      grossSpent: 0,
      pendingOrders: 0,
    }
  );
  const [activeNumbersList, setActiveNumbersList] = useState<ActiveNumber[]>(
    initialCache?.activeNumbersList || []
  );
  const [categorySpendings, setCategorySpendings] = useState<CategorySpending[]>(
    initialCache?.categorySpendings || []
  );
  const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>(
    initialCache?.recentTransactions || []
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(initialCache ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(initialCache ? 0 : 8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (stats.pendingOrders > 0) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [stats.pendingOrders, pulseAnim]);

  useEffect(() => {
    if (!initialCache) {
      // Restore offline cache from AsyncStorage on cold boot
      getCachedData<DashboardCacheSnapshot>('dashboard_snapshot').then((saved) => {
        if (saved) {
          setStats(saved.stats);
          setActiveNumbersList(saved.activeNumbersList || []);
          setCategorySpendings(saved.categorySpendings || []);
          setRecentTransactions(saved.recentTransactions || []);
          setLoading(false);
        }
      });

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, initialCache]);

  const firstName = (user?.name || user?.email || 'User').split(' ')[0].split('@')[0];
  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';

  const currentBalance =
    displayCurrency === 'NGN'
      ? user?.balances?.ngn ?? (user?.currency === 'NGN' ? user?.balance : (user?.balance || 0) * 1600)
      : user?.balances?.usd ?? (user?.currency === 'USD' ? user?.balance : (user?.balance || 0));

  const formatWebAmount = (val: number) =>
    `${displayCurrency} ${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // ─── Data Fetching with Hard Loading Limit (Max 2.2s) ──────────────────────

  const fetchDashboardData = useCallback(async () => {
    const loadLimitTimer = setTimeout(() => {
      setLoading(false);
    }, 2200);

    try {
      const [numbersRes, cheapRes, walletRes, pendingRes, transactionsRes] =
        await Promise.allSettled([
          apiClient.get('/numbers/my-numbers', { timeout: 5000 }),
          apiClient.get('/cheap/my-numbers', { timeout: 5000 }),
          apiClient.get(`/wallet/spending-summary?period=${period}`, { timeout: 5000 }),
          apiClient.get('/numbers/pending', { timeout: 5000 }),
          apiClient.get('/wallet/transactions?limit=5', { timeout: 5000 }),
        ]);

      const anySuccess = [
        numbersRes,
        cheapRes,
        walletRes,
        pendingRes,
        transactionsRes,
      ].some((r) => r.status === 'fulfilled');

      // If completely offline (all requests failed), preserve cached state!
      if (!anySuccess) {
        return;
      }

      let allNumbers: ActiveNumber[] = [];
      if (numbersRes.status === 'fulfilled' && numbersRes.value.data?.data) {
        const data = Array.isArray(numbersRes.value.data.data) ? numbersRes.value.data.data : [];
        allNumbers = [...allNumbers, ...data];
      }
      if (cheapRes.status === 'fulfilled' && cheapRes.value.data?.data) {
        const data = Array.isArray(cheapRes.value.data.data) ? cheapRes.value.data.data : [];
        allNumbers = [...allNumbers, ...data];
      }

      const activeCount = allNumbers.filter((n) =>
        ['active', 'waiting'].includes((n.status || '').toLowerCase())
      ).length;

      allNumbers.sort(
        (a, b) =>
          new Date(b.purchasedAt || b.otps?.[0]?.receivedAt || 0).getTime() -
          new Date(a.purchasedAt || a.otps?.[0]?.receivedAt || 0).getTime()
      );
      const topNumbers = allNumbers.slice(0, 3);
      setActiveNumbersList(topNumbers);

      let pendingCount = 0;
      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.success) {
        pendingCount = pendingRes.value.data.data?.length || 0;
      }

      const OUTFLOW_TYPES = [
        'number_purchase',
        'esim_purchase',
        'esim_topup',
        'whitelabel_purchase',
        'proxy_purchase',
        'card_issue',
        'card_fund',
        'api_usage',
        'kyc_fee',
        'credit_topup',
        'credit_usage',
        'withdrawal',
      ];
      const categoryColors: Record<string, string> = {
        Numbers: '#3B82F6',
        eSIM: '#10B981',
        Cards: '#8B5CF6',
        Proxies: '#F97316',
        Other: '#64748B',
      };
      const formatTypeName = (type: string) => {
        const map: Record<string, string> = {
          number_purchase: 'Numbers',
          esim_purchase: 'eSIM',
          esim_topup: 'eSIM',
          card_issue: 'Cards',
          card_fund: 'Cards',
        };
        return map[type] || 'Other';
      };

      let gross = 0;
      let refunds = 0;
      const categoryMap: Record<string, number> = {};
      if (walletRes.status === 'fulfilled' && walletRes.value.data?.data?.summary) {
        walletRes.value.data.data.summary.forEach((curr: any) => {
          if (OUTFLOW_TYPES.includes(curr.type)) {
            gross += curr.total || 0;
            const label = formatTypeName(curr.type);
            categoryMap[label] = (categoryMap[label] || 0) + (curr.total || 0);
          } else if (curr.type === 'refund') {
            refunds += curr.total || 0;
          }
        });
      }

      const net = Math.max(0, gross - refunds);
      const breakdown: CategorySpending[] = Object.entries(categoryMap)
        .map(([type, total]) => ({
          type,
          total,
          percent: gross > 0 ? Math.round((total / gross) * 100) : 0,
          color: categoryColors[type] || '#64748B',
        }))
        .sort((a, b) => b.total - a.total);

      const nextStats: DashboardStats = {
        activeNumbers: activeCount,
        totalSpent: net,
        grossSpent: gross,
        pendingOrders: pendingCount,
      };

      setCategorySpendings(breakdown);
      setStats(nextStats);

      let nextTx: TransactionItem[] = [];
      if (
        transactionsRes.status === 'fulfilled' &&
        transactionsRes.value.data?.data?.transactions
      ) {
        nextTx = transactionsRes.value.data.data.transactions.slice(0, 4);
        setRecentTransactions(nextTx);
      }

      setCachedData<DashboardCacheSnapshot>('dashboard_snapshot', {
        stats: nextStats,
        activeNumbersList: topNumbers,
        categorySpendings: breakdown,
        recentTransactions: nextTx,
      });
    } catch (err) {
      console.warn('[Dashboard] fetch error:', err);
    } finally {
      clearTimeout(loadLimitTimer);
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([fetchDashboardData(), refreshUser()]);
    setRefreshing(false);
  };

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    setCopiedKey(key);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'buy') onNavigateToBuy?.();
    else if (tab === 'sms') onNavigateToNumbers?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'wallet') onNavigateToWallet?.();
    else if (tab === 'more') onNavigateToMore?.();
  };

  const periodLabel = period === 'all' ? 'All Time' : `${period}d`;
  const balanceHidden = settings.privacyHideBalance;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        onRefresh={onRefresh}
        isRefreshing={refreshing}
        onPressProfile={onNavigateToMore}
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
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            gap: 20,
          }}
        >
          {/* ── 1. DYNAMIC WEB POPUP (Matches frontend-globeverify DashboardPopup.tsx!) ── */}
          <DashboardPopup onNavigateToBuy={onNavigateToBuy} />

          {/* ── PENDING ORDERS PROCESSING POPUP / ALERT (Matches web DashboardHome.tsx) ── */}
          {stats.pendingOrders > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                triggerHaptic('light');
                onNavigateToNumbers?.();
              }}
              style={[
                s.processingAlert,
                {
                  backgroundColor: colors.isDark ? '#1C160C' : '#FFFBEB',
                  borderColor: colors.isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.4)',
                },
              ]}
            >
              <View style={s.pulseDotWrapper}>
                <Animated.View
                  style={[
                    s.pulsingHalo,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.4],
                        outputRange: [0.6, 0],
                      }),
                    },
                  ]}
                />
                <View style={s.pulsingDot} />
              </View>

              <View style={s.processingContent}>
                <Text style={s.processingTitle}>Processing Orders</Text>
                <Text style={[s.processingDesc, { color: colors.textSecondary }]}>
                  You have{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {stats.pendingOrders}
                  </Text>{' '}
                  order{stats.pendingOrders > 1 ? 's' : ''} currently being processed.
                </Text>
              </View>

              <View
                style={[
                  s.viewStatusBtn,
                  {
                    backgroundColor: colors.isDark
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(245, 158, 11, 0.12)',
                  },
                ]}
              >
                <Text style={s.viewStatusText}>View Status</Text>
                <ChevronRight size={13} color="#F59E0B" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── 2. WELCOME HEADING ──────────────────────────────────────────── */}
          {settings.showDashboardGreeting && (
            <View style={s.welcomeSection}>
              <Text style={[s.welcomeTitle, { color: colors.text }]}>
                Welcome back, {firstName}!
              </Text>
              <Text style={[s.welcomeSubtitle, { color: colors.textMuted }]}>
                Here's what's happening with your account today.
              </Text>
            </View>
          )}

          {/* ── 3. THE 4 STAT CARDS ─────────────────────────────────────────── */}
          {settings.showDashboardStats && (
            <>
              {loading ? (
                <SkeletonStatsRow />
              ) : (
                <View style={s.statsStack}>
                  <TouchableOpacity
                    style={[
                      s.statCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={onNavigateToNumbers}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        s.statIconBox,
                        {
                          backgroundColor: colors.isDark
                            ? 'rgba(59, 130, 246, 0.12)'
                            : '#E0EAFF',
                        },
                      ]}
                    >
                      <Smartphone size={22} color="#3B82F6" strokeWidth={2} />
                    </View>
                    <View style={s.statInfo}>
                      <Text style={[s.statLabel, { color: colors.textMuted }]}>
                        Active Numbers
                      </Text>
                      <Text style={[s.statValue, { color: colors.text }]}>
                        {stats.activeNumbers}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.statCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={onNavigateToWallet}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        s.statIconBox,
                        {
                          backgroundColor: colors.isDark
                            ? 'rgba(16, 185, 129, 0.12)'
                            : '#DCFCE7',
                        },
                      ]}
                    >
                      <DollarSign size={22} color="#10B981" strokeWidth={2.2} />
                    </View>
                    <View style={s.statInfo}>
                      <Text style={[s.statLabel, { color: colors.textMuted }]}>
                        Wallet Balance
                      </Text>
                      <Text
                        style={[s.statValue, { color: colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {balanceHidden
                          ? '••••••••'
                          : formatWebAmount(currentBalance || 0)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View
                    style={[
                      s.statCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.statIconBox,
                        {
                          backgroundColor: colors.isDark
                            ? 'rgba(139, 92, 246, 0.12)'
                            : '#F3E8FF',
                        },
                      ]}
                    >
                      <Activity size={22} color="#8B5CF6" strokeWidth={2} />
                    </View>
                    <View style={s.statInfo}>
                      <Text style={[s.statLabel, { color: colors.textMuted }]}>
                        Net Spent ({periodLabel})
                      </Text>
                      <Text
                        style={[s.statValue, { color: colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {balanceHidden
                          ? '••••••••'
                          : formatWebAmount(stats.totalSpent)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      s.statCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.statIconBox,
                        {
                          backgroundColor: colors.isDark
                            ? 'rgba(249, 115, 22, 0.12)'
                            : '#FFEDD5',
                        },
                      ]}
                    >
                      <Activity size={22} color="#F97316" strokeWidth={2} />
                    </View>
                    <View style={s.statInfo}>
                      <Text style={[s.statLabel, { color: colors.textMuted }]}>
                        Gross Spent ({periodLabel})
                      </Text>
                      <Text
                        style={[s.statValue, { color: colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {balanceHidden
                          ? '••••••••'
                          : formatWebAmount(stats.grossSpent)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ── 4. SPENDING OVERVIEW (With Animated SVG Empty State for New Users!) ── */}
          {settings.showDashboardBreakdown && (
            <View
              style={[
                s.flatSectionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={s.sectionHeaderRow}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>
                  Spending Overview
                </Text>

                <View style={s.periodLinksRow}>
                  {(
                    [
                      { key: '7', label: '7d' },
                      { key: '30', label: '30d' },
                      { key: '90', label: '90d' },
                      { key: 'all', label: 'All' },
                    ] as const
                  ).map((item) => {
                    const active = period === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => {
                          triggerHaptic('selection');
                          setPeriod(item.key);
                        }}
                        style={[
                          s.periodPill,
                          active && { backgroundColor: colors.primarySoft },
                        ]}
                      >
                        <Text
                          style={[
                            s.periodPillText,
                            { color: active ? colors.primary : colors.textMuted },
                            active && { fontWeight: '700' },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {categorySpendings.length === 0 ? (
                <AnimatedEmptyState
                  type="spending"
                  compact
                  title="No Spending Activity Yet"
                  subtitle="You haven't made any purchases in this period. Buy a number to see your spending analytics."
                />
              ) : (
                <View style={{ gap: 14 }}>
                  {categorySpendings.map((cat) => (
                    <View key={cat.type} style={{ gap: 6 }}>
                      <View style={s.barLabelRow}>
                        <Text style={[s.barLabelText, { color: colors.text }]}>
                          {cat.type}
                        </Text>
                        <Text style={[s.barValText, { color: colors.textMuted }]}>
                          {balanceHidden
                            ? '••••'
                            : formatCurrency(cat.total, displayCurrency)}{' '}
                          ({cat.percent}%)
                        </Text>
                      </View>
                      <View
                        style={[
                          s.barTrack,
                          { backgroundColor: colors.surfaceSecondary },
                        ]}
                      >
                        <View
                          style={[
                            s.barFill,
                            {
                              width: `${Math.max(cat.percent, 6)}%`,
                              backgroundColor: cat.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── 5. QUICK ACTIONS ────────────────────────────────────────────── */}
          <View style={s.openSection}>
            <Text style={[s.openSectionTitle, { color: colors.text }]}>
              Quick Actions
            </Text>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.webActionRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  onNavigateToBuy?.();
                }}
                activeOpacity={0.75}
              >
                <ShoppingCart size={20} color={colors.primary} strokeWidth={2} />
                <Text style={[s.webActionText, { color: colors.text }]}>
                  Buy New Number
                </Text>
                <ChevronRight size={17} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.webActionRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  onNavigateToWallet?.();
                }}
                activeOpacity={0.75}
              >
                <DollarSign size={20} color="#10B981" strokeWidth={2.1} />
                <Text style={[s.webActionText, { color: colors.text }]}>
                  Add Funds
                </Text>
                <ChevronRight size={17} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.webActionRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  onNavigateToNumbers?.();
                }}
                activeOpacity={0.75}
              >
                <Smartphone size={20} color="#8B5CF6" strokeWidth={2} />
                <Text style={[s.webActionText, { color: colors.text }]}>
                  Check SMS
                </Text>
                <ChevronRight size={17} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 6. RECENT NUMBERS (Animated SVG Empty State if User is New!) ── */}
          {settings.showDashboardActiveOrders && (
            <View style={s.openSection}>
              <View style={s.openSectionHeader}>
                <Text style={[s.openSectionTitle, { color: colors.text }]}>
                  Recent Numbers
                </Text>
                <TouchableOpacity onPress={onNavigateToNumbers}>
                  <Text style={[s.linkText, { color: colors.primary }]}>
                    View All
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  s.flatListSurface,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {activeNumbersList.length === 0 ? (
                  <AnimatedEmptyState
                    type="numbers"
                    compact
                    title="No Orders Yet"
                    subtitle="You haven't ordered any numbers yet. Buy your first virtual number to receive instant SMS codes."
                    actionLabel="Buy First Number"
                    onPressAction={onNavigateToBuy}
                  />
                ) : (
                  activeNumbersList.map((item, idx) => {
                    const otp = item.otps?.[item.otps.length - 1]?.code;
                    const isCopied = copiedKey === `otp-${item.id}`;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          s.flatLineRow,
                          idx > 0 && {
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          handleCopy(otp || item.phoneNumber, `otp-${item.id}`)
                        }
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.flatRowTitle, { color: colors.text }]}>
                            {item.serviceName || 'Verification'} · {item.phoneNumber}
                          </Text>
                          <Text style={[s.flatRowSub, { color: colors.textMuted }]}>
                            {timeAgo(item.purchasedAt)}
                          </Text>
                        </View>

                        {otp ? (
                          <View style={s.otpInlineWrap}>
                            <Text
                              style={[
                                s.otpInlineCode,
                                { color: isCopied ? colors.success : colors.primary },
                              ]}
                            >
                              {otp}
                            </Text>
                            {isCopied ? (
                              <Check size={14} color={colors.success} />
                            ) : (
                              <Copy size={14} color={colors.primary} />
                            )}
                          </View>
                        ) : (
                          <Text style={[s.flatRowSub, { color: colors.primary }]}>
                            Active
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ── 7. RECENT TRANSACTIONS (Animated SVG Empty State if User is New!) ── */}
          {settings.showDashboardTransactions && (
            <View style={s.openSection}>
              <View style={s.openSectionHeader}>
                <Text style={[s.openSectionTitle, { color: colors.text }]}>
                  Recent Activity
                </Text>
                <TouchableOpacity onPress={onNavigateToWallet}>
                  <Text style={[s.linkText, { color: colors.primary }]}>
                    Wallet
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  s.flatListSurface,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {recentTransactions.length === 0 ? (
                  <AnimatedEmptyState
                    type="transactions"
                    compact
                    title="No Transactions Yet"
                    subtitle="Your account has no wallet activity yet. Fund your wallet to start ordering numbers."
                    actionLabel="Fund Wallet"
                    onPressAction={onNavigateToWallet}
                  />
                ) : (
                  recentTransactions.map((tx, idx) => {
                    const isCredit = ['deposit', 'refund', 'referral_bonus'].includes(
                      tx.type
                    );
                    return (
                      <View
                        key={tx.id || idx}
                        style={[
                          s.flatLineRow,
                          idx > 0 && {
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        {isCredit ? (
                          <ArrowDownLeft size={17} color={colors.success} />
                        ) : (
                          <ArrowUpRight size={17} color={colors.textMuted} />
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            style={[s.flatRowTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {tx.description || tx.type.replace(/_/g, ' ')}
                          </Text>
                          <Text style={[s.flatRowSub, { color: colors.textMuted }]}>
                            {timeAgo(tx.createdAt)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            s.flatRowAmount,
                            { color: isCredit ? colors.success : colors.text },
                          ]}
                        >
                          {balanceHidden
                            ? '••••'
                            : `${isCredit ? '+' : '-'}${formatCurrency(
                                tx.amount,
                                (tx.currency as any) || displayCurrency
                              )}`}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TelegramBotPopup />

      <ModernBottomNav
        activeTab="home"
        badgeCount={stats.activeNumbers}
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
  },
  welcomeSection: {
    gap: 5,
    marginTop: 2,
  },
  welcomeTitle: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  welcomeSubtitle: {
    fontSize: 14.5,
    fontWeight: '400',
  },
  statsStack: {
    gap: 14,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
    gap: 3,
  },
  statLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  flatSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  periodLinksRow: {
    flexDirection: 'row',
    gap: 4,
  },
  periodPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabelText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  barValText: {
    fontSize: 12.5,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  openSection: {
    gap: 10,
  },
  openSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  webActionText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
  },
  flatListSurface: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  flatLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  flatRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  flatRowSub: {
    fontSize: 12,
  },
  flatRowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  otpInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otpInlineCode: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  processingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  pulseDotWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingHalo: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(245, 158, 11, 0.6)',
  },
  pulsingDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F59E0B',
  },
  processingContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  processingTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  processingDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  viewStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  viewStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
