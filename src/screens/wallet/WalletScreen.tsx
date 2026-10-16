import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Plus,
  Copy,
  Check,
  X,
  CreditCard,
  Zap,
  Home,
  ShoppingCart,
  MessageSquare,
  Repeat,
  Wallet as WalletIcon,
  ShieldCheck,
  QrCode,
  DollarSign,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonListItem } from '../../components/ui/Skeleton';

const PAD = 18;

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  balanceAfter?: number;
  createdAt: string;
}

interface WalletScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
}) => {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [hideBalance, setHideBalance] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'NGN'>(
    user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD'
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'deposits' | 'purchases' | 'refunds'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'fiat' | 'crypto'>('fiat');
  const [depositAmount, setDepositAmount] = useState('10');
  const [initiatingDeposit, setInitiatingDeposit] = useState(false);
  const [cryptoAddressData, setCryptoAddressData] = useState<{
    address: string;
    currency: string;
    network: string;
    checkoutUrl?: string;
  } | null>(null);

  // Telecom credits modal
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [creditsAmount, setCreditsAmount] = useState('5');
  const [toppingUpCredits, setToppingUpCredits] = useState(false);

  // ─── Balance Calculations ───────────────────────────────────────────────────

  const usdBalance =
    user?.balances?.usd ?? (user?.currency === 'USD' ? user?.balance || 0 : (user?.balance || 0) / 1550);
  const ngnBalance =
    user?.balances?.ngn ?? (user?.currency === 'NGN' ? user?.balance || 0 : (user?.balance || 0) * 1550);

  const primaryBalanceFormatted =
    currency === 'NGN'
      ? formatCurrency(ngnBalance, 'NGN')
      : formatCurrency(usdBalance, 'USD');

  const secondaryBalanceFormatted =
    currency === 'NGN'
      ? `≈ ${formatCurrency(usdBalance, 'USD')}`
      : `≈ ${formatCurrency(ngnBalance, 'NGN')}`;

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await apiClient.get('/wallet/transactions?limit=40');
      if (res.data?.success && res.data.data?.transactions) {
        setTransactions(res.data.data.transactions);
      }
    } catch (err) {
      console.warn('[Wallet] fetch transactions error:', err);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await apiClient.get('/numbers/credits/balance');
      if (res.data?.success) {
        setCredits(res.data.credits || 0);
      }
    } catch (err) {
      console.warn('[Wallet] fetch credits error:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([refreshUser(), fetchTransactions(), fetchCredits()]);
    setLoading(false);
  }, [refreshUser, fetchTransactions, fetchCredits]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refreshUser(), fetchTransactions(), fetchCredits()]);
    setRefreshing(false);
  }, [refreshUser, fetchTransactions, fetchCredits]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleCurrency = async () => {
    Haptics.selectionAsync();
    const newCurr = currency === 'USD' ? 'NGN' : 'USD';
    setCurrency(newCurr);
    try {
      await apiClient.put('/users/currency', { currency: newCurr });
      refreshUser();
    } catch (err) {
      console.warn('Currency preference sync error:', err);
    }
  };

  const handleInitiateDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please specify a valid top-up amount.');
      return;
    }
    setInitiatingDeposit(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (depositMethod === 'fiat') {
        // Initiate Fiat deposit via MarsPay checkout link
        const res = await apiClient.post('/payments/top-up', {
          amount: amt,
          currency: currency,
        });

        if (res.data?.success && res.data.paymentLink) {
          setShowDepositModal(false);
          Linking.openURL(res.data.paymentLink);
        } else {
          Alert.alert('Notice', res.data?.message || 'Failed to initialize payment gateway.');
        }
      } else {
        // Initiate Crypto top-up
        const res = await apiClient.post('/payments/crypto/top-up', {
          amount: amt,
          cryptoCurrency: 'USDT-TRC20',
        });

        if (res.data?.success && res.data.address) {
          setCryptoAddressData({
            address: res.data.address,
            currency: 'USDT',
            network: 'TRC20',
            checkoutUrl: res.data.checkoutUrl,
          });
        } else if (res.data?.checkoutUrl) {
          setShowDepositModal(false);
          Linking.openURL(res.data.checkoutUrl);
        } else {
          Alert.alert('Notice', res.data?.message || 'Could not generate crypto address.');
        }
      }
    } catch (err: any) {
      Alert.alert('Deposit Error', err.response?.data?.message || 'Failed to initiate deposit request.');
    } finally {
      setInitiatingDeposit(false);
    }
  };

  const handleTopupCredits = async () => {
    const amt = parseFloat(creditsAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please specify a valid amount.');
      return;
    }
    setToppingUpCredits(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post('/numbers/credits/topup', { amount: amt });
      if (res.data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCredits(res.data.credits);
        setShowCreditsModal(false);
        setCreditsAmount('5');
        await refreshUser();
      } else {
        Alert.alert('Notice', res.data?.message || 'Top-up could not be processed.');
      }
    } catch (err: any) {
      Alert.alert('Top-Up Notice', err.response?.data?.message || 'Insufficient wallet balance for credit top-up.');
    } finally {
      setToppingUpCredits(false);
    }
  };

  // ─── Filtered Transactions ──────────────────────────────────────────────────

  const filteredTransactions = transactions.filter((tx) => {
    if (filterTab === 'deposits') return tx.type === 'deposit' || tx.type === 'topup';
    if (filterTab === 'purchases') return tx.type === 'purchase' || tx.type === 'number_purchase';
    if (filterTab === 'refunds') return tx.type === 'refund';
    return true;
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onBack();
              }}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Currency Switcher */}
        <TouchableOpacity onPress={handleToggleCurrency} style={styles.currencyToggleBtn} activeOpacity={0.8}>
          <Text style={styles.currencyToggleText}>{currency === 'USD' ? '$ USD' : '₦ NGN'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setHideBalance(!hideBalance);
              }}
              style={styles.eyeBtn}
            >
              {hideBalance ? <EyeOff size={16} color="#8E8E93" /> : <Eye size={16} color="#8E8E93" />}
            </TouchableOpacity>
          </View>

          <Text style={styles.primaryBalance} numberOfLines={1} adjustsFontSizeToFit>
            {hideBalance ? '••••••••' : primaryBalanceFormatted}
          </Text>

          <Text style={styles.secondaryBalance}>
            {hideBalance ? '••••••' : secondaryBalanceFormatted}
          </Text>

          {/* Action Buttons */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setShowDepositModal(true);
              }}
              style={styles.primaryDepositBtn}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#000000" />
              <Text style={styles.primaryDepositBtnText}>Deposit Funds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setShowCreditsModal(true);
              }}
              style={styles.secondaryCreditsBtn}
              activeOpacity={0.8}
            >
              <Zap size={14} color="#FFFFFF" />
              <Text style={styles.secondaryCreditsBtnText}>Credits: ${credits.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History Section */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Activity</Text>
          </View>

          {/* Filter Segmented Track */}
          <View style={styles.filterTrack}>
            {(['all', 'deposits', 'purchases', 'refunds'] as const).map((tab) => {
              const isActive = filterTab === tab;
              const labels = {
                all: 'All',
                deposits: 'Deposits',
                purchases: 'Purchases',
                refunds: 'Refunds',
              };
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFilterTab(tab);
                  }}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {labels[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* List or Skeleton */}
          {loading ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Transactions Yet</Text>
              <Text style={styles.emptySubtitle}>
                Your deposits, number purchases, and automatic refunds will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {filteredTransactions.map((tx) => {
                const isDeposit = tx.type === 'deposit' || tx.type === 'topup';
                const isRefund = tx.type === 'refund';
                const isPositive = isDeposit || isRefund;

                const dateStr = tx.createdAt
                  ? new Date(tx.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recent';

                return (
                  <View key={tx.id || Math.random().toString()} style={styles.txItem}>
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIconCircle,
                          isPositive ? styles.txIconPositive : styles.txIconNegative,
                        ]}
                      >
                        {isDeposit ? (
                          <ArrowDownLeft size={16} color="#22C55E" />
                        ) : isRefund ? (
                          <RotateCcw size={14} color="#22C55E" />
                        ) : (
                          <ArrowUpRight size={16} color="#FFFFFF" />
                        )}
                      </View>

                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.txDescription} numberOfLines={1}>
                          {tx.description || (isDeposit ? 'Deposit' : isRefund ? 'Refund' : 'Number Purchase')}
                        </Text>
                        <Text style={styles.txDate}>{dateStr}</Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.txAmount,
                          isPositive ? styles.txAmountPositive : styles.txAmountNegative,
                        ]}
                        numberOfLines={1}
                      >
                        {isPositive ? '+' : '-'}
                        {formatCurrency(Math.abs(tx.amount), currency)}
                      </Text>
                      {tx.status && tx.status !== 'completed' && (
                        <Text style={styles.txStatusBadge}>{tx.status}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── MODAL: Deposit Funds ────────────────────────────────────────────── */}
      <Modal visible={showDepositModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Funds</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDepositModal(false);
                  setCryptoAddressData(null);
                }}
                style={{ padding: 4 }}
              >
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {cryptoAddressData ? (
              /* Crypto Address Generated View */
              <View style={{ gap: 14 }}>
                <Text style={styles.modalDesc}>
                  Send precisely the required amount of{' '}
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                    {cryptoAddressData.currency} ({cryptoAddressData.network})
                  </Text>{' '}
                  to the address below:
                </Text>

                <View style={styles.cryptoBox}>
                  <Text style={styles.cryptoAddressText} numberOfLines={2} selectable>
                    {cryptoAddressData.address}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleCopy(cryptoAddressData.address, 'crypto_addr')}
                    style={styles.copyCryptoBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.copyCryptoBtnText}>
                      {copiedKey === 'crypto_addr' ? 'Copied' : 'Copy Address'}
                    </Text>
                    {copiedKey === 'crypto_addr' ? (
                      <Check size={14} color="#000000" />
                    ) : (
                      <Copy size={14} color="#000000" />
                    )}
                  </TouchableOpacity>
                </View>

                {cryptoAddressData.checkoutUrl && (
                  <TouchableOpacity
                    onPress={() => {
                      if (cryptoAddressData.checkoutUrl) {
                        Linking.openURL(cryptoAddressData.checkoutUrl);
                      }
                    }}
                    style={styles.hostedCheckoutBtn}
                  >
                    <Text style={styles.hostedCheckoutBtnText}>Open Web Checkout Page</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowDepositModal(false);
                    setCryptoAddressData(null);
                    refreshUser();
                  }}
                  style={styles.modalActionBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalActionBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Select Method & Amount View */
              <View style={{ gap: 14 }}>
                {/* Method Switcher */}
                <View style={styles.methodSwitcher}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDepositMethod('fiat');
                    }}
                    style={[styles.methodBtn, depositMethod === 'fiat' && styles.methodBtnActive]}
                  >
                    <Text
                      style={[styles.methodBtnText, depositMethod === 'fiat' && styles.methodBtnTextActive]}
                    >
                      {currency === 'NGN' ? 'MarsPay / Bank Transfer' : 'Card / Bank'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDepositMethod('crypto');
                    }}
                    style={[styles.methodBtn, depositMethod === 'crypto' && styles.methodBtnActive]}
                  >
                    <Text
                      style={[
                        styles.methodBtnText,
                        depositMethod === 'crypto' && styles.methodBtnTextActive,
                      ]}
                    >
                      Crypto (USDT / BTC)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Amount Input */}
                <View style={styles.amountInputWrap}>
                  <Text style={styles.amountSymbol}>{currency === 'NGN' ? '₦' : '$'}</Text>
                  <TextInput
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    keyboardType="numeric"
                    style={styles.amountInput}
                    placeholder="10"
                    placeholderTextColor="#666668"
                  />
                </View>

                {/* Quick amount chips */}
                <View style={styles.quickChipsRow}>
                  {(currency === 'NGN' ? ['2000', '5000', '10000', '25000'] : ['10', '25', '50', '100']).map(
                    (val) => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDepositAmount(val);
                        }}
                        style={[styles.quickChip, depositAmount === val && styles.quickChipActive]}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            depositAmount === val && styles.quickChipTextActive,
                          ]}
                        >
                          {currency === 'NGN' ? `₦${val}` : `$${val}`}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>

                <View style={styles.modalNotice}>
                  <ShieldCheck size={14} color="#8E8E93" />
                  <Text style={styles.modalNoticeText}>
                    Funds are credited automatically upon blockchain/bank confirmation.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleInitiateDeposit}
                  disabled={initiatingDeposit}
                  style={[styles.modalActionBtn, initiatingDeposit && { opacity: 0.6 }]}
                  activeOpacity={0.85}
                >
                  {initiatingDeposit ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.modalActionBtnText}>Proceed to Deposit</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: Telecom Credits ─────────────────────────────────────────── */}
      <Modal visible={showCreditsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Up Telecom Credits</Text>
              <TouchableOpacity onPress={() => setShowCreditsModal(false)} style={{ padding: 4 }}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Telecom credits power outbound SMS and phone forwarding on dedicated rental numbers.
            </Text>

            <View style={styles.amountInputWrap}>
              <Text style={styles.amountSymbol}>$</Text>
              <TextInput
                value={creditsAmount}
                onChangeText={setCreditsAmount}
                keyboardType="numeric"
                style={styles.amountInput}
                placeholder="5"
                placeholderTextColor="#666668"
              />
            </View>

            <TouchableOpacity
              onPress={handleTopupCredits}
              disabled={toppingUpCredits}
              style={[styles.modalActionBtn, toppingUpCredits && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {toppingUpCredits ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.modalActionBtnText}>Pay with Wallet Balance</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── BOTTOM NAVIGATION BAR ───────────────────────────────────────────── */}
      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToHome?.();
          }}
          activeOpacity={0.7}
        >
          <Home size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToBuy?.();
          }}
          activeOpacity={0.7}
        >
          <ShoppingCart size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Buy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToNumbers?.();
          }}
          activeOpacity={0.7}
        >
          <MessageSquare size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>My SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToRentals?.();
          }}
          activeOpacity={0.7}
        >
          <Repeat size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Rentals</Text>
        </TouchableOpacity>

        {/* Active: Wallet */}
        <TouchableOpacity style={styles.navItem} activeOpacity={1}>
          <WalletIcon size={20} color="#FFFFFF" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161618',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  currencyToggleBtn: {
    backgroundColor: '#161618',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242426',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currencyToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 16,
  },
  balanceCard: {
    backgroundColor: '#121214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 20,
    marginBottom: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },
  eyeBtn: {
    padding: 4,
  },
  primaryBalance: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  secondaryBalance: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 18,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryDepositBtn: {
    flex: 1.2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  primaryDepositBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryCreditsBtn: {
    flex: 1,
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  secondaryCreditsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historySection: {
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  filterTrack: {
    flexDirection: 'row',
    backgroundColor: '#121214',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 3,
    marginBottom: 12,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterChipTextActive: {
    color: '#000000',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  transactionsList: {
    gap: 8,
  },
  txItem: {
    backgroundColor: '#121214',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconPositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  txIconNegative: {
    backgroundColor: '#1E1E22',
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: '#8E8E93',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountPositive: {
    color: '#22C55E',
  },
  txAmountNegative: {
    color: '#FFFFFF',
  },
  txStatusBadge: {
    fontSize: 10,
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: PAD,
  },
  modalCard: {
    backgroundColor: '#121214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222224',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  methodSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#18181A',
    borderRadius: 10,
    padding: 3,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  methodBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  methodBtnTextActive: {
    color: '#000000',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    paddingHorizontal: 16,
    height: 52,
  },
  amountSymbol: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#18181A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242426',
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  quickChipTextActive: {
    color: '#000000',
  },
  modalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181A',
    borderRadius: 10,
    padding: 10,
  },
  modalNoticeText: {
    fontSize: 11,
    color: '#8E8E93',
    flex: 1,
    lineHeight: 15,
  },
  modalActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  cryptoBox: {
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    padding: 14,
    alignItems: 'center',
  },
  cryptoAddressText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginBottom: 10,
  },
  copyCryptoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyCryptoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  hostedCheckoutBtn: {
    backgroundColor: '#18181A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242426',
    paddingVertical: 12,
    alignItems: 'center',
  },
  hostedCheckoutBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#080808',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 54,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
