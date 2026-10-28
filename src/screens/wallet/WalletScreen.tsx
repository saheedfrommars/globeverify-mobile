import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Coins,
  Search,
  RotateCcw,
  Zap,
  Receipt,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient, {
  getMemoryCache,
  getCachedData,
  setCachedData,
} from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { Skeleton, SkeletonListItem } from '../../components/ui/Skeleton';
import { AnimatedEmptyState } from '../../components/ui/AnimatedEmptyState';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;
const LOADING_TIMEOUT_MS = 2200;

interface TransactionItem {
  id: string;
  _id?: string;
  type: string;
  amount: number;
  currency?: string;
  status: string;
  description: string;
  createdAt: string;
  metadata?: {
    paymentMethod?: string;
    reference?: string;
  };
}

interface WalletScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToMore?: () => void;
}

const PRESETS_NGN = [2000, 5000, 10000, 25000, 50000];
const PRESETS_USD = [5, 10, 25, 50, 100];

const formatDateShort = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const WalletScreen: React.FC<WalletScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToMore,
}) => {
  const { user, refreshUser } = useAuth();
  const { settings, colors, triggerHaptic, showDialog, showToast } = useAppSettings();

  const [displayCurrency, setDisplayCurrency] = useState<'NGN' | 'USD'>(
    user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD'
  );
  const [paymentMode, setPaymentMode] = useState<'fiat' | 'crypto'>('fiat');
  const [paymentMethods, setPaymentMethods] = useState<{
    fiat: { enabled: boolean; reason?: string };
    crypto: { enabled: boolean; reason?: string };
  }>({
    fiat: { enabled: true },
    crypto: { enabled: true },
  });
  const [depositAmount, setDepositAmount] = useState<string>(
    user?.currency?.toUpperCase() === 'NGN' ? '5000' : '10'
  );
  const [processingDeposit, setProcessingDeposit] = useState(false);

  const initialCachedTx = getMemoryCache<TransactionItem[]>('wallet_transactions');

  const [loading, setLoading] = useState(!initialCachedTx);
  const [refreshing, setRefreshing] = useState(false);

  const [transactions, setTransactions] = useState<TransactionItem[]>(initialCachedTx || []);
  const [txFilter, setTxFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Instant render without layout shifts
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!initialCachedTx) {
      getCachedData<TransactionItem[]>('wallet_transactions').then((saved) => {
        if (saved && saved.length > 0) {
          setTransactions(saved);
          setLoading(false);
        }
      });
    }
  }, [initialCachedTx]);

  const isUserNgn = displayCurrency === 'NGN';
  const userSymbol = isUserNgn ? '₦' : '$';
  const quickPresets = isUserNgn ? PRESETS_NGN : PRESETS_USD;
  const balanceHidden = settings.privacyHideBalance;

  const ngnBalance =
    user?.balances?.ngn ??
    (user?.currency === 'NGN' ? user?.balance || 0 : (user?.balance || 0) * 1600);
  const usdBalance =
    user?.balances?.usd ??
    (user?.currency === 'USD' ? user?.balance || 0 : (user?.balance || 0) / 1600);

  const primaryBalance = isUserNgn ? ngnBalance : usdBalance;
  const balanceFormattedNum = Number(primaryBalance || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const fetchWalletData = useCallback(async () => {
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, LOADING_TIMEOUT_MS);

    try {
      const [txRes, methodsRes] = await Promise.allSettled([
        apiClient.get('/wallet/transactions?limit=40', {
          timeout: LOADING_TIMEOUT_MS,
        }),
        apiClient.get('/payments/methods', {
          timeout: LOADING_TIMEOUT_MS,
        }),
      ]);

      if (txRes.status === 'fulfilled') {
        let nextTx: TransactionItem[] = [];
        if (txRes.value.data?.data?.transactions) {
          nextTx = txRes.value.data.data.transactions;
        } else if (Array.isArray(txRes.value.data?.data)) {
          nextTx = txRes.value.data.data;
        }
        setTransactions(nextTx);
        setCachedData('wallet_transactions', nextTx);
      }

      if (methodsRes.status === 'fulfilled' && methodsRes.value.data?.data) {
        const m = methodsRes.value.data.data;
        setPaymentMethods({
          fiat: m.fiat || { enabled: true },
          crypto: m.crypto || { enabled: true },
        });
        if (m.fiat?.enabled === false && m.crypto?.enabled) {
          setPaymentMode('crypto');
        }
      }
    } catch (err) {
      console.warn('[WalletScreen] fetch error:', err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Automatically refresh balance & transactions when user returns from external checkout browser
  const prevBalanceRef = useRef<number>(user?.balance || 0);
  useEffect(() => {
    prevBalanceRef.current = user?.balance || 0;
  }, [user?.balance]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const beforeBal = prevBalanceRef.current;
        await Promise.all([refreshUser(), fetchWalletData()]);
        // Second check 2.5s later in case webhook is still settling
        setTimeout(async () => {
          await Promise.all([refreshUser(), fetchWalletData()]);
        }, 2500);
        if ((user?.balance || 0) > beforeBal) {
          showToast('Wallet balance updated!', 'success');
        }
      }
    });
    return () => sub.remove();
  }, [refreshUser, fetchWalletData, showToast, user?.balance]);

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await Promise.all([fetchWalletData(), refreshUser()]);
    setRefreshing(false);
  };

  const handleDeposit = async () => {
    const numAmount = parseFloat(depositAmount);
    if (!numAmount || numAmount <= 0) {
      showDialog({
        title: 'Invalid Amount',
        message: 'Please enter a valid deposit amount greater than zero.',
        variant: 'warning',
        confirmText: 'Got It',
      });
      return;
    }

    if (paymentMode === 'fiat' && paymentMethods.fiat?.enabled === false) {
      showDialog({
        title: 'Card / Bank Unavailable',
        message:
          paymentMethods.fiat.reason ||
          'Card and bank deposits are temporarily unavailable. Please try Crypto.',
        variant: 'warning',
        confirmText: 'Switch to Crypto',
        onConfirm: () => setPaymentMode('crypto'),
      });
      return;
    }

    if (paymentMode === 'crypto' && paymentMethods.crypto?.enabled === false) {
      showDialog({
        title: 'Crypto Unavailable',
        message:
          paymentMethods.crypto.reason ||
          'Crypto deposits are not currently enabled for your account.',
        variant: 'warning',
        confirmText: 'Switch to Card / Bank',
        onConfirm: () => setPaymentMode('fiat'),
      });
      return;
    }

    setProcessingDeposit(true);
    triggerHaptic('medium');

    try {
      let res;
      if (paymentMode === 'fiat') {
        // Matches frontend-globeverify WalletPage.tsx -> POST /payments/top-up
        res = await apiClient.post('/payments/top-up', {
          amount: numAmount,
          currency: displayCurrency,
        });
      } else {
        // Matches frontend-globeverify WalletPage.tsx -> POST /payments/crypto/top-up
        res = await apiClient.post('/payments/crypto/top-up', {
          amount: numAmount,
          sourceCurrency: isUserNgn ? 'NGN' : 'USD',
          isNgnAmount: isUserNgn,
        });
      }

      const checkoutUrl =
        res.data?.authorizationUrl ||
        res.data?.checkoutUrl ||
        res.data?.data?.checkoutUrl ||
        res.data?.data?.authorizationUrl ||
        res.data?.data?.paymentUrl;

      if (checkoutUrl) {
        showToast(
          paymentMode === 'crypto'
            ? 'Opening secure crypto checkout...'
            : 'Opening secure payment checkout...',
          'success'
        );
        await Linking.openURL(checkoutUrl);
      } else {
        showDialog({
          title: 'Payment Initialized',
          message:
            res.data?.message ||
            'Your deposit request was created. Complete your payment in the browser window.',
          variant: 'success',
          confirmText: 'Done',
        });
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Payment initiation failed. Please check your connection and try again.';
      showDialog({
        title: 'Deposit Notice',
        message: errMsg,
        variant: 'danger',
        confirmText: 'Try Again',
      });
    } finally {
      setProcessingDeposit(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const t = (tx.type || '').toLowerCase();
      const isCredit = ['deposit', 'refund', 'referral_bonus', 'admin_credit'].includes(t);

      if (txFilter === 'credit' && !isCredit) return false;
      if (txFilter === 'debit' && isCredit) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (tx.description || '').toLowerCase();
        return desc.includes(q) || t.includes(q);
      }
      return true;
    });
  }, [transactions, txFilter, searchQuery]);

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'home') onNavigateToHome?.();
    else if (tab === 'buy') onNavigateToBuy?.();
    else if (tab === 'sms') onNavigateToNumbers?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'more') onNavigateToMore?.();
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        title="Wallet"
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
        <View
          style={{
            gap: 24,
          }}
        >
          {/* ── 1. WALLET & BALANCES (Single-Layer — Zero Nested Containers!) ── */}
          <View style={s.sectionBlock}>
            <Text style={[s.pageTitle, { color: colors.text }]}>
              Wallet & Balances
            </Text>
            <Text style={[s.pageSubtitle, { color: colors.textMuted }]}>
              Manage your funds, deposits, and transaction history
            </Text>

            <View
              style={[
                s.balanceStatBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  s.balanceIconSquare,
                  {
                    backgroundColor: colors.isDark
                      ? 'rgba(59, 130, 246, 0.14)'
                      : '#E0EAFF',
                  },
                ]}
              >
                <Wallet size={21} color="#2563EB" strokeWidth={2.1} />
              </View>

              <View style={s.balanceCenterCol}>
                <Text style={[s.availLabel, { color: colors.textMuted }]}>
                  AVAILABLE BALANCE
                </Text>
                {loading ? (
                  <Skeleton width={120} height={24} borderRadius={6} style={{ marginTop: 4 }} />
                ) : (
                  <View style={s.balanceValRow}>
                    <Text
                      style={[s.balanceValText, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {balanceHidden ? '••••••••' : `${userSymbol}${balanceFormattedNum}`}
                    </Text>
                    <View
                      style={[
                        s.currBadge,
                        {
                          backgroundColor: colors.isDark
                            ? 'rgba(59, 130, 246, 0.18)'
                            : '#DBEAFE',
                        },
                      ]}
                    >
                      <Text style={s.currBadgeText}>{displayCurrency}</Text>
                    </View>
                  </View>
                )}
              </View>

              {settings.showDualCurrency && (
                <View
                  style={[
                    s.dualRightCol,
                    { borderLeftColor: colors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic('selection');
                      setDisplayCurrency('USD');
                      setDepositAmount('10');
                    }}
                  >
                    <Text
                      style={[
                        s.dualLineText,
                        {
                          color:
                            displayCurrency === 'USD'
                              ? colors.primary
                              : colors.textMuted,
                        },
                      ]}
                    >
                      USD: {balanceHidden ? '•••' : `$${Number(usdBalance || 0).toFixed(2)}`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic('selection');
                      setDisplayCurrency('NGN');
                      setDepositAmount('5000');
                    }}
                  >
                    <Text
                      style={[
                        s.dualLineText,
                        {
                          color:
                            displayCurrency === 'NGN'
                              ? colors.primary
                              : colors.textMuted,
                        },
                      ]}
                    >
                      NGN:{' '}
                      {balanceHidden
                        ? '•••'
                        : `₦${Number(ngnBalance || 0).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ── 2. ADD FUNDS / TOP UP (Standalone Gateway Cards — Matches Screenshot 2!) ── */}
          <View style={s.sectionBlock}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              Add Funds / Top Up
            </Text>
            <Text style={[s.pageSubtitle, { color: colors.textMuted }]}>
              Choose your preferred payment method below to fund your account
            </Text>

            {/* Gateway Card 1: Naira (₦) Card / Bank Transfer */}
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setPaymentMode('fiat');
              }}
              style={[
                s.gatewayCard,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    paymentMode === 'fiat' ? '#3B82F6' : colors.border,
                  borderWidth: paymentMode === 'fiat' ? 1.5 : 1,
                },
              ]}
              activeOpacity={0.85}
            >
              <View style={s.gatewayTopRow}>
                <View
                  style={[
                    s.gatewayIconBox,
                    {
                      backgroundColor: colors.isDark
                        ? 'rgba(59, 130, 246, 0.14)'
                        : '#E0EAFF',
                    },
                  ]}
                >
                  <CreditCard size={18} color="#2563EB" strokeWidth={2.1} />
                </View>

                {paymentMode === 'fiat' ? (
                  <View style={s.activeGreenPill}>
                    <Text style={s.activeGreenPillText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Text style={[s.selectLabelText, { color: colors.textMuted }]}>
                    SELECT
                  </Text>
                )}
              </View>

              <Text style={[s.gatewayTitle, { color: colors.text }]}>
                {isUserNgn
                  ? 'Naira (₦) Card / Bank Transfer'
                  : 'Debit/Credit Card & Bank'}
              </Text>
              <Text style={[s.gatewayDesc, { color: colors.textMuted }]}>
                {isUserNgn
                  ? 'Pay instantly with Nigerian ATM cards, USSD, or direct bank transfer.'
                  : 'Instant local and international card payments via secure gateway.'}
              </Text>

              <View style={[s.gatewayFooter, { borderTopColor: colors.border }]}>
                <Text style={[s.gatewayFooterLeft, { color: colors.text }]}>
                  {isUserNgn ? 'NG NGN (Naira)' : `${displayCurrency} Card`}
                </Text>
                <Text style={s.instantCheckoutText}>Instant Checkout ⚡</Text>
              </View>
            </TouchableOpacity>

            {/* Gateway Card 2: Cryptocurrency Gateway */}
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setPaymentMode('crypto');
              }}
              style={[
                s.gatewayCard,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    paymentMode === 'crypto' ? '#8B5CF6' : colors.border,
                  borderWidth: paymentMode === 'crypto' ? 1.5 : 1,
                },
              ]}
              activeOpacity={0.85}
            >
              <View style={s.gatewayTopRow}>
                <View
                  style={[
                    s.gatewayIconBox,
                    {
                      backgroundColor: colors.isDark
                        ? 'rgba(139, 92, 246, 0.14)'
                        : '#F3E8FF',
                    },
                  ]}
                >
                  <Coins size={18} color="#8B5CF6" strokeWidth={2.1} />
                </View>

                {paymentMode === 'crypto' ? (
                  <View style={s.activeGreenPill}>
                    <Text style={s.activeGreenPillText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Text style={[s.selectLabelText, { color: colors.textMuted }]}>
                    SELECT
                  </Text>
                )}
              </View>

              <Text style={[s.gatewayTitle, { color: colors.text }]}>
                Cryptocurrency Gateway
              </Text>
              <Text style={[s.gatewayDesc, { color: colors.textMuted }]}>
                Pay with USDT, Bitcoin, TRON, Ethereum, Litecoin, SOL & more via secure hosted checkout.
              </Text>

              <View style={[s.gatewayFooter, { borderTopColor: colors.border }]}>
                <Text style={[s.gatewayFooterLeft, { color: colors.text }]}>
                  🌐 Multi-Chain Crypto
                </Text>
                <Text style={s.instantCheckoutText}>Instant Checkout ⚡</Text>
              </View>
            </TouchableOpacity>

            {/* Quick Select Presets */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={[s.presetsLabel, { color: colors.textMuted }]}>
                Quick select amount ({displayCurrency}):
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {quickPresets.map((preset) => {
                  const isSelected = parseFloat(depositAmount) === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => {
                        triggerHaptic('selection');
                        setDepositAmount(String(preset));
                      }}
                      style={[
                        s.presetChip,
                        {
                          backgroundColor: isSelected
                            ? colors.primarySoft
                            : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.presetChipText,
                          { color: isSelected ? colors.primary : colors.text },
                        ]}
                      >
                        {userSymbol}
                        {preset.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Amount Input & Pay Button */}
            <View style={{ gap: 10 }}>
              <View
                style={[
                  s.amountInputRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[s.inputPrefix, { color: colors.textMuted }]}>
                  {userSymbol}
                </Text>
                <TextInput
                  style={[s.amountInput, { color: colors.text }]}
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  keyboardType="numeric"
                  placeholder={`Enter amount in ${displayCurrency}`}
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[s.inputSuffix, { color: colors.textMuted }]}>
                  {displayCurrency}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  s.paySubmitBtn,
                  {
                    backgroundColor:
                      paymentMode === 'crypto' ? '#7C3AED' : '#2563EB',
                  },
                  (!depositAmount ||
                    parseFloat(depositAmount) <= 0 ||
                    processingDeposit) && { opacity: 0.6 },
                ]}
                onPress={handleDeposit}
                disabled={
                  !depositAmount ||
                  parseFloat(depositAmount) <= 0 ||
                  processingDeposit
                }
                activeOpacity={0.85}
              >
                {processingDeposit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    {paymentMode === 'crypto' ? (
                      <Coins size={16} color="#FFFFFF" />
                    ) : (
                      <Zap size={16} color="#FFFFFF" />
                    )}
                    <Text style={s.paySubmitBtnText}>
                      Pay{' '}
                      {depositAmount && parseFloat(depositAmount) > 0
                        ? `${userSymbol}${parseFloat(depositAmount).toLocaleString()}`
                        : ''}{' '}
                      with {paymentMode === 'crypto' ? 'Crypto' : 'Card / Bank'}
                    </Text>
                    <ArrowUpRight size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 3. TRANSACTION HISTORY (Clean Flat Divided List!) ─────────── */}
          <View style={s.sectionBlock}>
            <View style={s.txHeaderRow}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>
                Transaction History
              </Text>

              <View style={s.txFilterPills}>
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'credit', label: 'In' },
                    { id: 'debit', label: 'Out' },
                  ] as const
                ).map((f) => {
                  const active = txFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => {
                        triggerHaptic('selection');
                        setTxFilter(f.id);
                      }}
                      style={[
                        s.txFilterPill,
                        active && { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <Text
                        style={[
                          s.txFilterPillText,
                          { color: active ? colors.primary : colors.textMuted },
                          active && { fontWeight: '700' },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View
              style={[
                s.searchRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Search size={15} color={colors.textMuted} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search activity..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {loading ? (
              <View style={{ gap: 8 }}>
                <SkeletonListItem />
                <SkeletonListItem />
              </View>
            ) : filteredTransactions.length === 0 ? (
              <AnimatedEmptyState
                type="transactions"
                title="No Transactions Yet"
                subtitle={
                  searchQuery.trim()
                    ? 'No wallet transactions matched your search filter.'
                    : "You haven't made any deposits or purchases yet. Fund your wallet above to get started."
                }
              />
            ) : (
              <View
                style={[
                  s.txFlatList,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {filteredTransactions.map((tx, idx) => {
                  const t = (tx.type || '').toLowerCase();
                  const isCredit = [
                    'deposit',
                    'refund',
                    'referral_bonus',
                    'admin_credit',
                  ].includes(t);
                  const isRefund = t === 'refund';
                  const txCurr = (
                    tx.currency?.toUpperCase() === 'NGN' ? 'NGN' : displayCurrency
                  ) as 'NGN' | 'USD';

                  return (
                    <View
                      key={tx.id || tx._id || idx}
                      style={[
                        s.txFlatRow,
                        idx > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      {isRefund ? (
                        <RotateCcw size={17} color={colors.warning} />
                      ) : isCredit ? (
                        <ArrowDownLeft size={17} color={colors.success} />
                      ) : (
                        <ArrowUpRight size={17} color={colors.textMuted} />
                      )}

                      <View style={s.txMidCol}>
                        <Text
                          style={[s.txTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {tx.description || tx.type.replace(/_/g, ' ')}
                        </Text>
                        <Text style={[s.txSub, { color: colors.textMuted }]}>
                          {formatDateShort(tx.createdAt)}
                        </Text>
                      </View>

                      <Text
                        style={[
                          s.txAmount,
                          { color: isCredit ? colors.success : colors.text },
                        ]}
                      >
                        {balanceHidden
                          ? '••••'
                          : `${isCredit ? '+' : '-'}${formatCurrency(
                              tx.amount,
                              txCurr
                            )}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav activeTab="wallet" onSelectTab={handleSelectNavTab} />
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
  sectionBlock: {
    gap: 10,
  },
  pageTitle: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: -4,
    marginBottom: 4,
  },

  // 1. Balance Stat Box (Matches Screenshot 2)
  balanceStatBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  balanceIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCenterCol: {
    flex: 1,
    gap: 2,
  },
  availLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  balanceValText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  currBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  currBadgeText: {
    color: '#2563EB',
    fontSize: 10.5,
    fontWeight: '800',
  },
  dualRightCol: {
    borderLeftWidth: 1,
    paddingLeft: 12,
    gap: 4,
  },
  dualLineText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // 2. Gateway Cards (Matches Screenshot 2)
  gatewayCard: {
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  gatewayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gatewayIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeGreenPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeGreenPillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  selectLabelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  gatewayTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  gatewayDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  gatewayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  gatewayFooterLeft: {
    fontSize: 12,
    fontWeight: '700',
  },
  instantCheckoutText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },

  // Presets & Input
  presetsLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    height: 50,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  inputSuffix: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  paySubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  paySubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },

  // 3. Transaction History (Flat Divided List)
  txHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txFilterPills: {
    flexDirection: 'row',
    gap: 4,
  },
  txFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  txFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13.5,
  },
  txFlatList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  txFlatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  txMidCol: {
    flex: 1,
    gap: 2,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  txSub: {
    fontSize: 12,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
