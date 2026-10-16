import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Animated,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  Home,
  Smartphone,
  DollarSign,
  Activity,
  ShoppingCart,
  PhoneCall,
  Copy,
  Check,
  Bell,
  Clock,
  User as UserIcon,
  LogOut,
  ChevronRight,
  CreditCard,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  RefreshCw,
  MessageSquare,
  Zap,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonStatsRow, SkeletonListItem } from '../../components/ui/Skeleton';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const { width: SW } = Dimensions.get('window');
const PAD = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

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
  expiresAt?: string;
  autoRenew?: boolean;
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

// ─── Real Initial / Fallback Active Orders ─────────────────────────────────────
const INITIAL_ACTIVE_ORDERS: ActiveNumber[] = [
  {
    id: '6a59f8c1a18eb6c6526676fd',
    phoneNumber: '+1 3373900564',
    countryCode: 'US',
    countryName: 'United States',
    service: '1012',
    serviceName: 'WhatsApp',
    status: 'completed',
    cost: 2094.4,
    otps: [
      {
        code: '922703',
        sender: 'Unknown',
        message: 'Your WhatsApp code: 922-703\nDon\'t share this code with others\n4sgLq1p5sV6',
        receivedAt: '2026-07-17T09:44:15.000Z',
      },
    ],
    purchasedAt: '2026-07-17T09:41:21.607Z',
    expiresAt: '2026-07-19T08:53:58.523Z',
  },
  {
    id: '6a5551ae5aef75ad5a19eefe',
    phoneNumber: '+1 4237898422',
    countryCode: 'US',
    countryName: 'United States',
    service: '1705',
    serviceName: 'Neon Money Talks',
    status: 'completed',
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
    phoneNumber: '+1 9086127430',
    countryCode: 'US',
    countryName: 'United States',
    service: '829',
    serviceName: 'Signal',
    status: 'completed',
    cost: 612.48,
    otps: [
      {
        code: '994488',
        sender: 'Unknown',
        message: 'SIGNAL code: 994488. Do not share this code with anyone. If anyone asks it\'s a SCAM.',
        receivedAt: '2026-07-12T12:46:51.327Z',
      },
    ],
    purchasedAt: '2026-07-12T12:45:01.374Z',
    expiresAt: '2026-07-12T12:55:01.000Z',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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

const cleanSmsMessage = (msg?: string): string => {
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

const getCountryFlag = (code?: string): string => {
  if (!code || code.length !== 2) return '🌐';
  const cc = code.toUpperCase();
  const first = cc.charCodeAt(0) - 65 + 0x1f1e6;
  const second = cc.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
};

const getServiceMeta = (serviceName?: string) => {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('whatsapp')) return { color: '#25D366', bg: 'rgba(37,211,102,0.15)', icon: MessageSquare };
  if (name.includes('telegram')) return { color: '#229ED9', bg: 'rgba(34,158,217,0.15)', icon: MessageSquare };
  if (name.includes('signal')) return { color: '#3A76F0', bg: 'rgba(58,118,240,0.15)', icon: MessageSquare };
  if (name.includes('neon') || name.includes('money') || name.includes('bank') || name.includes('pay'))
    return { color: '#00E5FF', bg: 'rgba(0,229,255,0.15)', icon: Zap };
  if (name.includes('reco') || name.includes('social') || name.includes('instagram') || name.includes('facebook'))
    return { color: '#EC4899', bg: 'rgba(236,72,153,0.15)', icon: Activity };
  if (name.includes('google') || name.includes('gmail'))
    return { color: '#EA4335', bg: 'rgba(234,67,53,0.15)', icon: Globe };
  return { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Smartphone };
};

const txTypeIcon = (type: string) => {
  if (type.includes('number')) return { icon: Smartphone, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  if (type.includes('esim')) return { icon: Globe, color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (type.includes('card')) return { icon: CreditCard, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' };
  if (type.includes('fund') || type.includes('deposit') || type.includes('topup'))
    return { icon: ArrowDownLeft, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (type.includes('withdrawal')) return { icon: ArrowUpRight, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  return { icon: Activity, color: '#f97316', bg: 'rgba(249,115,22,0.12)' };
};

// ─── Component ───────────────────────────────────────────────────────────────

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToBuy,
  onNavigateToWallet,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToServices,
  onNavigateToMore,
}) => {
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState<'home' | 'buy' | 'numbers' | 'wallet' | 'rentals'>('home');
  const [displayCurrency, setDisplayCurrency] = useState<'NGN' | 'USD'>(
    user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD'
  );
  const [stats, setStats] = useState<DashboardStats>({
    activeNumbers: INITIAL_ACTIVE_ORDERS.length,
    totalSpent: 0,
    grossSpent: 0,
    pendingOrders: 0,
  });
  const [activeNumbersList, setActiveNumbersList] = useState<ActiveNumber[]>(INITIAL_ACTIVE_ORDERS);
  const [categorySpendings, setCategorySpendings] = useState<CategorySpending[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>([]);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState(false);
  const [addFundsModal, setAddFundsModal] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchDashboardData = useCallback(async () => {
    try {
      const [numbersRes, cheapRes, walletRes, pendingRes, transactionsRes] = await Promise.allSettled([
        apiClient.get('/numbers/my-numbers'),
        apiClient.get('/cheap/my-numbers'),
        apiClient.get(`/wallet/spending-summary?period=${period}`),
        apiClient.get('/numbers/pending'),
        apiClient.get('/wallet/transactions?limit=6'),
      ]);

      // Combine numbers from regular and cheap routes
      let allNumbers: ActiveNumber[] = [];
      if (numbersRes.status === 'fulfilled' && numbersRes.value.data?.data) {
        const data = Array.isArray(numbersRes.value.data.data) ? numbersRes.value.data.data : [];
        allNumbers = [...allNumbers, ...data];
      }
      if (cheapRes.status === 'fulfilled' && cheapRes.value.data?.data) {
        const data = Array.isArray(cheapRes.value.data.data) ? cheapRes.value.data.data : [];
        allNumbers = [...allNumbers, ...data];
      }

      if (allNumbers.length > 0) {
        allNumbers.sort(
          (a, b) =>
            new Date(b.purchasedAt || b.otps?.[0]?.receivedAt || 0).getTime() -
            new Date(a.purchasedAt || a.otps?.[0]?.receivedAt || 0).getTime()
        );
        // Only show 3 active orders
        setActiveNumbersList(allNumbers.slice(0, 3));
      }

      let pendingCount = 0;
      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.success) {
        pendingCount = pendingRes.value.data.data?.length || 0;
      }

      const OUTFLOW_TYPES = [
        'number_purchase', 'esim_purchase', 'esim_topup', 'whitelabel_purchase',
        'proxy_purchase', 'card_issue', 'card_fund', 'api_usage', 'kyc_fee',
        'credit_topup', 'credit_usage', 'withdrawal',
      ];
      const categoryColors: Record<string, string> = {
        Numbers: '#3b82f6', eSIM: '#10b981', Cards: '#8b5cf6',
        Proxies: '#f97316', Whitelabel: '#ec4899', API: '#06b6d4', Other: '#64748b',
      };
      const formatTypeName = (type: string) => {
        const map: Record<string, string> = {
          number_purchase: 'Numbers', esim_purchase: 'eSIM', esim_topup: 'eSIM',
          credit_topup: 'Credits', proxy_purchase: 'Proxies', card_issue: 'Cards',
          card_fund: 'Cards', api_usage: 'API', whitelabel_purchase: 'Whitelabel',
        };
        return map[type] || 'Other';
      };

      let gross = 0, refunds = 0;
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

      const netSpent = Math.max(0, gross - refunds);
      const catList: CategorySpending[] = Object.keys(categoryMap).map((key) => ({
        type: key,
        total: categoryMap[key],
        percent: gross > 0 ? Math.round((categoryMap[key] / gross) * 100) : 0,
        color: categoryColors[key] || '#3b82f6',
      }));

      setCategorySpendings(catList);
      setStats({
        activeNumbers: allNumbers.length > 0 ? allNumbers.length : INITIAL_ACTIVE_ORDERS.length,
        totalSpent: netSpent,
        grossSpent: gross,
        pendingOrders: pendingCount,
      });

      if (transactionsRes.status === 'fulfilled' && transactionsRes.value.data?.data?.transactions) {
        setRecentTransactions(transactionsRes.value.data.data.transactions);
      }
    } catch (err) {
      console.warn('[Dashboard] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refreshUser(), fetchDashboardData()]);
  }, [refreshUser, fetchDashboardData]);

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleTabPress = (tabId: 'home' | 'buy' | 'numbers' | 'wallet' | 'rentals') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tabId);
    if (tabId === 'home') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else if (tabId === 'buy') {
      onNavigateToBuy ? onNavigateToBuy() : Alert.alert('Buy Number', 'Navigate to number purchase catalog.');
    } else if (tabId === 'numbers') {
      onNavigateToNumbers ? onNavigateToNumbers() : Alert.alert('My Numbers', 'Viewing active SMS orders.');
    } else if (tabId === 'wallet') {
      onNavigateToWallet ? onNavigateToWallet() : setAddFundsModal(true);
    } else if (tabId === 'rentals') {
      onNavigateToRentals ? onNavigateToRentals() : Alert.alert('Rentals', 'Long-term number rental service.');
    }
  };

  const currentBalance =
    displayCurrency === 'NGN'
      ? user?.balances?.ngn ?? (user?.currency === 'NGN' ? user?.balance : (user?.balance || 0) * 1550)
      : user?.balances?.usd ?? (user?.currency === 'USD' ? user?.balance : (user?.balance || 0));

  // ─── Design Tokens (Dark-Only Luxury FinTech) ─────────────────────────────────
  const BG = '#080808';
  const SURFACE = '#111113';
  const SURFACE2 = '#18181b';
  const BORDER = 'rgba(255,255,255,0.07)';
  const TEXT = '#FFFFFF';
  const TEXT2 = '#A1A1AA';
  const TEXT3 = '#52525B';
  const BLUE = '#3B82F6';
  const GREEN = '#22C55E';
  const PURPLE = '#8B5CF6';
  const ORANGE = '#F97316';
  const RED = '#EF4444';

  const bottomNavItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'buy' as const, label: 'Buy Number', icon: ShoppingCart },
    { id: 'numbers' as const, label: 'My SMS', icon: MessageSquare, badge: stats.activeNumbers },
    { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
    { id: 'rentals' as const, label: 'Rentals', icon: PhoneCall },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: BG }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* ── MODERN LUXURY HEADER ────────────────────────────────────────── */}
      <ModernHeader
        showCurrencyToggle
        displayCurrency={displayCurrency}
        onToggleCurrency={() => {
          setDisplayCurrency(prev => (prev === 'NGN' ? 'USD' : 'NGN'));
        }}
        onPressNotifications={() => {
          Alert.alert('Notifications', 'No unread notifications.');
        }}
        onPressProfile={() => {
          onNavigateToMore ? onNavigateToMore() : setProfileModal(true);
        }}
      />

      {/* ── MAIN SCROLLABLE DASHBOARD ──────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 110 + Math.max(insets.bottom, 12) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── GREETING ─────────────────────────────────────────────── */}
          <View style={s.greetingSection}>
            <Text style={[s.greetLabel, { color: TEXT2 }]}>
              {getGreeting()},
            </Text>
            <Text style={[s.greetName, { color: TEXT }]}>
              {user?.name?.split(' ')[0] || 'User'} 👋
            </Text>
          </View>

          {/* ── BALANCE CARD ─────────────────────────────────────────── */}
          <View style={[s.balanceCard, { backgroundColor: SURFACE }]}>
            <View style={s.balanceCardTop}>
              <Text style={[s.balanceLabel, { color: TEXT2 }]}>Total Balance</Text>
              <View style={s.balanceActions}>
                {/* currency toggle */}
                <TouchableOpacity
                  style={[s.currencyToggle, { backgroundColor: SURFACE2 }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDisplayCurrency(prev => prev === 'NGN' ? 'USD' : 'NGN');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.currencyToggleText, { color: TEXT }]}>
                    {displayCurrency === 'NGN' ? '🇳🇬 NGN' : '🇺🇸 USD'}
                  </Text>
                  <RefreshCw size={10} color={TEXT2} />
                </TouchableOpacity>
                {/* hide balance toggle */}
                <TouchableOpacity
                  style={[s.hideBtn, { backgroundColor: SURFACE2 }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBalanceHidden(h => !h);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.hideBtnText, { color: TEXT2 }]}>{balanceHidden ? 'Show' : 'Hide'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[s.balanceAmount, { color: TEXT }]}>
              {balanceHidden ? '••••••' : formatCurrency(currentBalance || 0, displayCurrency)}
            </Text>

            {/* Add funds row */}
            <View style={[s.balanceDivider, { backgroundColor: BORDER }]} />
            <TouchableOpacity
              style={s.addFundsRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAddFundsModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[s.addFundsDot, { backgroundColor: GREEN }]} />
              <Text style={[s.addFundsText, { color: TEXT2 }]}>Add funds to wallet</Text>
              <ChevronRight size={14} color={TEXT3} />
            </TouchableOpacity>
          </View>

          {/* ── PENDING ALERT ────────────────────────────────────────── */}
          {stats.pendingOrders > 0 && (
            <TouchableOpacity
              style={[s.alertBanner, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' }]}
              onPress={() => onNavigateToNumbers?.()}
              activeOpacity={0.8}
            >
              <Zap size={15} color="#f59e0b" />
              <Text style={[s.alertText, { color: '#f59e0b' }]}>
                {stats.pendingOrders} order{stats.pendingOrders > 1 ? 's' : ''} currently being processed
              </Text>
              <ChevronRight size={13} color="#f59e0b" />
            </TouchableOpacity>
          )}

          {/* ── STATS ROW ─────────────────────────────────────────────── */}
          {loading ? (
            <SkeletonStatsRow />
          ) : (
            <View style={s.statsRow}>
              <StatCard
                label="Active Orders"
                value={String(stats.activeNumbers)}
                color={BLUE}
                bg={SURFACE}
                onPress={onNavigateToNumbers}
              />
              <StatCard
                label="Net Spent"
                value={formatCurrency(stats.totalSpent, displayCurrency)}
                color={PURPLE}
                bg={SURFACE}
              />
              <StatCard
                label="Gross Spent"
                value={formatCurrency(stats.grossSpent, displayCurrency)}
                color={ORANGE}
                bg={SURFACE}
              />
            </View>
          )}



          {/* ── SPENDING BREAKDOWN ────────────────────────────────────── */}
          {categorySpendings.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: TEXT }]}>Spending Breakdown</Text>
                {/* Period selector */}
                <View style={[s.periodGroup, { backgroundColor: SURFACE2 }]}>
                  {['7', '30', '90', 'all'].map((p) => {
                    const active = period === p;
                    const label = p === 'all' ? 'All' : `${p}d`;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[s.periodBtn, active && { backgroundColor: SURFACE }]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setPeriod(p);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.periodText, { color: active ? TEXT : TEXT3 }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[s.listCard, { backgroundColor: SURFACE }]}>
                {categorySpendings.map((cat, idx) => (
                  <View key={cat.type}>
                    <View style={s.spendItem}>
                      <View style={[s.spendDot, { backgroundColor: cat.color }]} />
                      <Text style={[s.spendName, { color: TEXT }]}>{cat.type}</Text>
                      <View style={s.spendRight}>
                        <Text style={[s.spendAmount, { color: TEXT }]}>
                          {formatCurrency(cat.total, displayCurrency)}
                        </Text>
                        <Text style={[s.spendPercent, { color: TEXT2 }]}>{cat.percent}%</Text>
                      </View>
                    </View>
                    {/* Progress bar */}
                    <View
                      style={[
                        s.progressTrack,
                        { backgroundColor: SURFACE2, marginBottom: idx < categorySpendings.length - 1 ? 12 : 0 },
                      ]}
                    >
                      <View
                        style={[
                          s.progressFill,
                          { width: `${Math.max(4, cat.percent)}%`, backgroundColor: cat.color },
                        ]}
                      />
                    </View>
                    {idx < categorySpendings.length - 1 && (
                      <View style={[s.listDivider, { backgroundColor: BORDER, marginVertical: 12 }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── RECENT TRANSACTIONS ───────────────────────────────────── */}
          {recentTransactions.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: TEXT }]}>Recent Transactions</Text>
                <TouchableOpacity onPress={onNavigateToWallet} activeOpacity={0.7}>
                  <Text style={[s.seeAll, { color: BLUE }]}>See all</Text>
                </TouchableOpacity>
              </View>

              <View style={[s.listCard, { backgroundColor: SURFACE }]}>
                {recentTransactions.map((tx, idx) => {
                  const { icon: TxIcon, color, bg } = txTypeIcon(tx.type);
                  const isDebit = [
                    'number_purchase',
                    'esim_purchase',
                    'proxy_purchase',
                    'card_issue',
                    'withdrawal',
                    'api_usage',
                  ].includes(tx.type);
                  const isLast = idx === recentTransactions.length - 1;

                  return (
                    <View key={tx.id}>
                      <View style={s.txItem}>
                        <View style={[s.txIcon, { backgroundColor: bg }]}>
                          <TxIcon size={16} color={color} />
                        </View>
                        <View style={s.txMeta}>
                          <Text style={[s.txTitle, { color: TEXT }]} numberOfLines={1}>
                            {tx.description || tx.type.replace(/_/g, ' ')}
                          </Text>
                          <Text style={[s.txTime, { color: TEXT2 }]}>{timeAgo(tx.createdAt)}</Text>
                        </View>
                        <View style={s.txRight}>
                          <Text style={[s.txAmount, { color: isDebit ? RED : GREEN }]}>
                            {isDebit ? '-' : '+'}
                            {formatCurrency(tx.amount, tx.currency || displayCurrency)}
                          </Text>
                          <View
                            style={[
                              s.txStatus,
                              {
                                backgroundColor:
                                  tx.status === 'completed' || tx.status === 'success'
                                    ? 'rgba(34,197,94,0.1)'
                                    : 'rgba(245,158,11,0.1)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.txStatusText,
                                {
                                  color:
                                    tx.status === 'completed' || tx.status === 'success' ? GREEN : '#f59e0b',
                                },
                              ]}
                            >
                              {tx.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {!isLast && <View style={[s.listDivider, { backgroundColor: BORDER }]} />}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Empty state fallback */}
          {!loading && recentTransactions.length === 0 && activeNumbersList.length === 0 && (
            <View style={[s.emptyState, { backgroundColor: SURFACE }]}>
              <Globe size={32} color={TEXT3} />
              <Text style={[s.emptyTitle, { color: TEXT }]}>Ready to verify?</Text>
              <Text style={[s.emptySubtitle, { color: TEXT2 }]}>
                Buy a number and start receiving SMS verifications instantly.
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { backgroundColor: BLUE }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onNavigateToBuy?.();
                }}
                activeOpacity={0.85}
              >
                <Text style={[s.emptyBtnText, { color: '#fff' }]}>Buy a Number</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── MODERN FLOATING DOCK BOTTOM NAVIGATION ──────────────────────── */}
      <ModernBottomNav
        activeTab="home"
        badgeCount={stats.activeNumbers}
        onSelectTab={(tabId: NavTabId) => {
          if (tabId === 'home') {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          } else if (tabId === 'buy') {
            onNavigateToBuy?.();
          } else if (tabId === 'sms') {
            onNavigateToNumbers?.();
          } else if (tabId === 'rentals') {
            onNavigateToRentals?.();
          } else if (tabId === 'wallet') {
            onNavigateToWallet ? onNavigateToWallet() : setAddFundsModal(true);
          }
        }}
      />

      {/* ── PROFILE MODAL ───────────────────────────────────────────────── */}
      <Modal visible={profileModal} transparent animationType="slide" onRequestClose={() => setProfileModal(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setProfileModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: SURFACE }]}>
            <View style={[s.modalHandle, { backgroundColor: BORDER }]} />

            {/* User info */}
            <View style={s.modalUserRow}>
              <View style={[s.modalAvatar, { backgroundColor: BLUE }]}>
                <Text style={s.modalAvatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalUserName, { color: TEXT }]}>{user?.name}</Text>
                <Text style={[s.modalUserEmail, { color: TEXT2 }]}>{user?.email}</Text>
                <Text style={[s.modalUserRole, { color: BLUE }]}>
                  {(user?.role || 'user').toUpperCase()} · {(user?.apiTier || 'standard').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Referral code */}
            {user?.referralCode && (
              <TouchableOpacity
                style={[s.refRow, { backgroundColor: SURFACE2 }]}
                onPress={() => handleCopy(user.referralCode!, 'ref')}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={[s.refLabel2, { color: TEXT2 }]}>Referral Code</Text>
                  <Text style={[s.refCode, { color: TEXT }]}>{user.referralCode}</Text>
                </View>
                {copiedText === 'ref' ? (
                  <Check size={16} color={GREEN} />
                ) : (
                  <Copy size={16} color={TEXT2} />
                )}
              </TouchableOpacity>
            )}

            {/* Sign out */}
            <TouchableOpacity
              style={[s.logoutBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                setProfileModal(false);
                logout();
              }}
              activeOpacity={0.8}
            >
              <LogOut size={16} color={RED} />
              <Text style={[s.logoutText, { color: RED }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ADD FUNDS MODAL ─────────────────────────────────────────────── */}
      <Modal visible={addFundsModal} transparent animationType="slide" onRequestClose={() => setAddFundsModal(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddFundsModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: SURFACE }]}>
            <View style={[s.modalHandle, { backgroundColor: BORDER }]} />
            <Text style={[s.modalTitle, { color: TEXT }]}>Add Funds</Text>
            <Text style={[s.modalSubtitle, { color: TEXT2 }]}>Choose your preferred payment method</Text>

            {[
              {
                icon: CreditCard,
                label: 'Bank Card / Transfer',
                sub: 'Instant via MarsPay (NGN)',
                color: BLUE,
                bg: 'rgba(59,130,246,0.12)',
              },
              {
                icon: DollarSign,
                label: 'Cryptocurrency',
                sub: 'USDT TRC20, Bitcoin, Litecoin',
                color: GREEN,
                bg: 'rgba(34,197,94,0.12)',
              },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[s.fundOption, { backgroundColor: SURFACE2 }]}
                  onPress={() => {
                    setAddFundsModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(opt.label, opt.sub);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[s.fundIcon, { backgroundColor: opt.bg }]}>
                    <Icon size={20} color={opt.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fundLabel, { color: TEXT }]}>{opt.label}</Text>
                    <Text style={[s.fundSub, { color: TEXT2 }]}>{opt.sub}</Text>
                  </View>
                  <ChevronRight size={16} color={TEXT3} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  color: string;
  bg: string;
  onPress?: () => void;
}> = ({ label, value, color, bg, onPress }) => (
  <TouchableOpacity
    style={[s.statCard, { backgroundColor: bg }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.75 : 1}
    disabled={!onPress}
  >
    <View style={[s.statAccent, { backgroundColor: color }]} />
    <Text style={[s.statLabel, { color: '#888' }]}>{label}</Text>
    <Text style={[s.statValue, { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </TouchableOpacity>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#080808',
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Scroll Content
  scrollContent: { paddingHorizontal: PAD, paddingTop: 4 },

  // Greeting
  greetingSection: { marginTop: 4, marginBottom: 18 },
  greetLabel: { fontSize: 15, fontWeight: '400' },
  greetName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },

  // Balance Card
  balanceCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  balanceCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  balanceLabel: { fontSize: 13, fontWeight: '500' },
  balanceActions: { flexDirection: 'row', gap: 8 },
  currencyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  currencyToggleText: { fontSize: 11, fontWeight: '600' },
  hideBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  hideBtnText: { fontSize: 11, fontWeight: '600' },
  balanceAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: 16 },
  balanceDivider: { height: 1, marginBottom: 12 },
  addFundsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addFundsDot: { width: 8, height: 8, borderRadius: 4 },
  addFundsText: { flex: 1, fontSize: 13, fontWeight: '500' },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600' },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  statAccent: { width: 22, height: 3, borderRadius: 2, marginBottom: 10 },
  statLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  orderCountBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  orderCountText: { color: '#3B82F6', fontSize: 11, fontWeight: '700' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, fontWeight: '600' },



  // Spending Breakdown
  listCard: { borderRadius: 18, overflow: 'hidden', paddingHorizontal: 16 },
  listDivider: { height: 1 },
  spendItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14 },
  spendDot: { width: 8, height: 8, borderRadius: 4 },
  spendName: { flex: 1, fontSize: 14, fontWeight: '600' },
  spendRight: { alignItems: 'flex-end' },
  spendAmount: { fontSize: 14, fontWeight: '700' },
  spendPercent: { fontSize: 11, fontWeight: '400' },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  // Transactions
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  txIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  txMeta: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '600' },
  txTime: { fontSize: 11, fontWeight: '400', marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  txStatusText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  // Period Selector
  periodGroup: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  periodBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  periodText: { fontSize: 11, fontWeight: '600' },

  // Empty State
  emptyState: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700' },

  // Pretty Bottom Navigation Bar
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0c0c0e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
    position: 'relative',
  },
  navIconWrapperActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
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
    borderColor: '#0c0c0e',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, marginBottom: 20 },

  // Profile Modal
  modalUserRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  modalAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  modalUserName: { fontSize: 17, fontWeight: '700' },
  modalUserEmail: { fontSize: 13, marginTop: 1 },
  modalUserRole: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  refLabel2: { fontSize: 11, fontWeight: '500', marginBottom: 3 },
  refCode: { fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },

  // Add Funds Modal
  fundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  fundIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fundLabel: { fontSize: 15, fontWeight: '600' },
  fundSub: { fontSize: 12, marginTop: 2 },
});

export default DashboardScreen;
