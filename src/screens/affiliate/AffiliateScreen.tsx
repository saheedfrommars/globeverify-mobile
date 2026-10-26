import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Users,
  DollarSign,
  Wallet,
  TrendingUp,
  Copy,
  Check,
  Share2,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Coins,
  ArrowUpRight,
  Sparkles,
  CreditCard,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient, {
  getMemoryCache,
  getCachedData,
  setCachedData,
} from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';
import { Skeleton } from '../../components/ui/Skeleton';

interface AffiliateStatusData {
  status: 'not_applied' | 'pending' | 'approved' | 'suspended' | 'rejected';
  affiliate?: {
    status: string;
    applicationMessage?: string;
    approvedAt?: string;
    adminNote?: string;
    bankDetails?: {
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      bankCode?: string;
    };
    cryptoDetails?: {
      network?: string;
      currency?: string;
      address?: string;
    };
    stats: {
      totalReferredUsers: number;
      totalEarningsNGN: number;
      totalEarningsUSD: number;
      totalWithdrawnNGN: number;
      totalWithdrawnUSD: number;
    };
  };
  referralCode?: string;
  affiliateBalance?: { usd: number; ngn: number };
  referredUsers?: Array<{ name: string; email: string; createdAt: string }>;
  pendingWithdrawals?: Array<{ amount: number; currency: string; createdAt: string }>;
}

interface EarningRecord {
  event: string;
  referee?: { name: string; email: string };
  commissionAmount: number;
  commissionCurrency: string;
  commissionRate: string;
  sourceAmount: number;
  sourceCurrency: string;
  createdAt: string;
}

type ActiveTab = 'overview' | 'earnings' | 'withdraw';

const eventLabel = (event: string): string => {
  const map: Record<string, string> = {
    deposit: 'Deposit',
    purchase_1: '1st Purchase',
    purchase_2: '2nd Purchase',
    purchase_3: '3rd Purchase',
  };
  return map[event] || event;
};

interface AffiliateScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
}

export const AffiliateScreen: React.FC<AffiliateScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
}) => {
  const { user, refreshUser } = useAuth();
  const { colors, triggerHaptic, showToast } = useAppSettings();

  const defaultCurr = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';
  const initialCache = getMemoryCache<AffiliateStatusData>('affiliate_status');

  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AffiliateStatusData | null>(initialCache);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Application form
  const [applyMsg, setApplyMsg] = useState('');
  const [applying, setApplying] = useState(false);

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCurrency, setWithdrawCurrency] = useState<'NGN' | 'USD'>(defaultCurr);
  const [withdrawMethod, setWithdrawMethod] = useState<'wallet' | 'external'>('wallet');
  const [withdrawing, setWithdrawing] = useState(false);

  // Payout details form
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [cryptoNetwork, setCryptoNetwork] = useState('TRON');
  const [cryptoCurrency, setCryptoCurrency] = useState('USDT');
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    if (!initialCache) {
      getCachedData<AffiliateStatusData>('affiliate_status').then((saved) => {
        if (saved) {
          setData(saved);
          setLoading(false);
        }
      });
    }
  }, [initialCache]);

  const populatePayoutFields = (affData: AffiliateStatusData) => {
    if (affData.affiliate?.bankDetails) {
      setBankName(affData.affiliate.bankDetails.bankName || '');
      setAccountNumber(affData.affiliate.bankDetails.accountNumber || '');
      setAccountName(affData.affiliate.bankDetails.accountName || '');
      setBankCode(affData.affiliate.bankDetails.bankCode || '');
    }
    if (affData.affiliate?.cryptoDetails) {
      setCryptoNetwork(affData.affiliate.cryptoDetails.network || 'TRON');
      setCryptoCurrency(affData.affiliate.cryptoDetails.currency || 'USDT');
      setCryptoAddress(affData.affiliate.cryptoDetails.address || '');
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/affiliate/status');
      if (res.data?.status === 'not_applied') {
        const next: AffiliateStatusData = { status: 'not_applied' };
        setData(next);
        setCachedData('affiliate_status', next);
        return;
      }

      if (res.data?.affiliate?.status === 'approved') {
        const dash = await apiClient.get('/affiliate/dashboard');
        const affData: AffiliateStatusData = { status: 'approved', ...dash.data };
        setData(affData);
        setCachedData('affiliate_status', affData);
        populatePayoutFields(affData);
      } else {
        const next: AffiliateStatusData = {
          status: res.data?.affiliate?.status || 'pending',
          affiliate: res.data?.affiliate,
        };
        setData(next);
        setCachedData('affiliate_status', next);
      }
    } catch {
      // Keep cached data if offline
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try {
      const res = await apiClient.get('/affiliate/earnings?limit=50');
      setEarnings(Array.isArray(res.data?.earnings) ? res.data.earnings : []);
    } catch {
      showToast('Failed to load commission history', 'error');
    } finally {
      setEarningsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === 'earnings' && data?.status === 'approved') {
      fetchEarnings();
    }
  }, [activeTab, data?.status, fetchEarnings]);

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await fetchStatus();
    if (activeTab === 'earnings') {
      await fetchEarnings();
    }
    setRefreshing(false);
  };

  const handleApply = async () => {
    setApplying(true);
    triggerHaptic('medium');
    try {
      await apiClient.post('/affiliate/apply', { message: applyMsg });
      showToast('Application submitted! We will review it shortly.', 'success');
      await fetchStatus();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Application failed', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    setWithdrawing(true);
    triggerHaptic('medium');
    try {
      if (withdrawMethod === 'wallet') {
        await apiClient.post('/affiliate/transfer-to-wallet', {
          amount,
          currency: withdrawCurrency,
        });
        showToast(
          `${formatCurrency(amount, withdrawCurrency)} transferred to your main wallet!`,
          'success'
        );
        refreshUser();
      } else {
        await apiClient.post('/affiliate/withdraw', {
          amount,
          currency: withdrawCurrency,
        });
        showToast('Payout request submitted! Processing takes 24–48 hours.', 'success');
      }
      setWithdrawAmount('');
      await fetchStatus();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Withdrawal failed', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleSavePayoutDetails = async () => {
    setSavingPayout(true);
    triggerHaptic('light');
    try {
      if (withdrawCurrency === 'NGN') {
        await apiClient.put('/affiliate/payout-details', {
          type: 'bank',
          bankName,
          accountNumber,
          accountName,
          bankCode,
        });
      } else {
        await apiClient.put('/affiliate/payout-details', {
          type: 'crypto',
          network: cryptoNetwork,
          cryptoCurrency,
          address: cryptoAddress,
        });
      }
      showToast('Payout details saved!', 'success');
      setShowPayoutForm(false);
      await fetchStatus();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to save payout details', 'error');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleCopy = async (text: string, type: 'link' | 'code') => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast('Affiliate link copied!', 'success');
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showToast('Referral code copied!', 'success');
    }
  };

  const affiliateLink = data?.referralCode
    ? `https://www.globeverify.com/auth/register?ref=${data.referralCode}`
    : '';

  const handleShareLink = async () => {
    if (!affiliateLink) return;
    triggerHaptic('light');
    try {
      await Share.share({
        message: `Verify any online service worldwide with GlobeVerify! Get started here: ${affiliateLink}`,
      });
    } catch {}
  };

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'home') onNavigateToHome?.();
    else if (tab === 'buy') onNavigateToBuy?.();
    else if (tab === 'sms') onNavigateToNumbers?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'wallet') onNavigateToWallet?.();
  };

  const aff = data?.affiliate;
  const balance = data?.affiliateBalance || { usd: 0, ngn: 0 };
  const stats = aff?.stats || {
    totalReferredUsers: 0,
    totalEarningsNGN: 0,
    totalEarningsUSD: 0,
    totalWithdrawnNGN: 0,
    totalWithdrawnUSD: 0,
  };
  const currentAvailable = withdrawCurrency === 'NGN' ? balance.ngn : balance.usd;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />
      <ModernHeader title="Affiliate Program" onBack={onBack} onRefresh={onRefresh} />

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
        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={130} borderRadius={16} />
            <Skeleton height={110} borderRadius={16} />
            <Skeleton height={180} borderRadius={16} />
          </View>
        ) : data?.status === 'not_applied' ? (
          /* ── 1. NOT APPLIED STATE ──────────────────────────────────────── */
          <View style={{ gap: 18 }}>
            <View
              style={[
                s.flatCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[s.badgePill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Sparkles size={13} color="#10B981" />
                <Text style={[s.badgePillText, { color: '#10B981' }]}>
                  Partner Program
                </Text>
              </View>
              <Text style={[s.heroTitle, { color: colors.text }]}>
                Become a GlobeVerify Affiliate
              </Text>
              <Text style={[s.heroSubtitle, { color: colors.textSecondary }]}>
                Earn recurring commissions on every deposit and the first three
                purchases made by users you introduce to GlobeVerify.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <View
                style={[
                  s.benefitCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Coins size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.benefitTitle, { color: colors.text }]}>
                    Recurring Deposits
                  </Text>
                  <Text style={[s.benefitDesc, { color: colors.textMuted }]}>
                    Receive a commission percentage every time your referred users
                    top up their balance.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  s.benefitCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <CreditCard size={20} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.benefitTitle, { color: colors.text }]}>
                    Purchase Rewards
                  </Text>
                  <Text style={[s.benefitDesc, { color: colors.textMuted }]}>
                    Earn bonuses on your referrals' first 3 purchases across
                    temporary numbers, eSIMs, and proxies.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  s.benefitCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Wallet size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.benefitTitle, { color: colors.text }]}>
                    Flexible Payouts
                  </Text>
                  <Text style={[s.benefitDesc, { color: colors.textMuted }]}>
                    Transfer instantly to your main account wallet or request direct
                    bank (NGN) or crypto (USD) payouts.
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                s.flatCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[s.cardTitle, { color: colors.text }]}>
                Submit Partner Application
              </Text>
              <Text style={[s.cardSub, { color: colors.textMuted }]}>
                Tell us briefly how you plan to share GlobeVerify (social media,
                blog, developer community, or direct referrals).
              </Text>
              <TextInput
                style={[
                  s.textArea,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g., I create developer tutorials on YouTube / I manage an agency community..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={applyMsg}
                onChangeText={setApplyMsg}
              />
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleApply}
                disabled={applying}
                activeOpacity={0.85}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={s.primaryBtnText}>Submit Application</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : data?.status === 'pending' ? (
          /* ── 2. PENDING REVIEW STATE ───────────────────────────────────── */
          <View
            style={[
              s.statusBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Clock size={34} color="#F59E0B" />
            <Text style={[s.statusBoxTitle, { color: colors.text }]}>
              Application Under Review
            </Text>
            <Text style={[s.statusBoxDesc, { color: colors.textSecondary }]}>
              Your affiliate application has been received and is currently being
              reviewed by our team. Applications are processed within 24 to 48 hours.
            </Text>
            <View style={[s.badgePill, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
              <Clock size={12} color="#F59E0B" />
              <Text style={[s.badgePillText, { color: '#F59E0B' }]}>
                Status: Pending Review
              </Text>
            </View>
          </View>
        ) : data?.status === 'suspended' || data?.status === 'rejected' ? (
          /* ── 3. SUSPENDED / REJECTED STATE ─────────────────────────────── */
          <View
            style={[
              s.statusBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AlertCircle size={34} color="#EF4444" />
            <Text style={[s.statusBoxTitle, { color: colors.text }]}>
              Affiliate Account {data.status === 'suspended' ? 'Suspended' : 'Declined'}
            </Text>
            {aff?.adminNote ? (
              <Text style={[s.statusBoxDesc, { color: colors.text, fontWeight: '600' }]}>
                Reason: {aff.adminNote}
              </Text>
            ) : null}
            <Text style={[s.statusBoxDesc, { color: colors.textSecondary }]}>
              If you believe this is in error or wish to request a re-evaluation,
              please contact our support team.
            </Text>
          </View>
        ) : (
          /* ── 4. APPROVED PARTNER DASHBOARD ─────────────────────────────── */
          <View style={{ gap: 16 }}>
            <View style={s.headerRowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroTitle, { color: colors.text }]}>
                  Affiliate Dashboard
                </Text>
                <Text style={[s.cardSub, { color: colors.textMuted, marginBottom: 0 }]}>
                  Track referrals, monitor commissions, and request payouts.
                </Text>
              </View>
              <View style={[s.badgePill, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                <CheckCircle2 size={13} color="#10B981" />
                <Text style={[s.badgePillText, { color: '#10B981' }]}>
                  Active Partner
                </Text>
              </View>
            </View>

            {/* Partner Link Card */}
            <View
              style={[
                s.flatCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={s.cardHeaderInline}>
                <Share2 size={16} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                  Partner Referral Link
                </Text>
              </View>
              <Text style={[s.cardSub, { color: colors.textMuted }]}>
                Anyone who registers through your link is permanently credited to your
                partner account.
              </Text>

              <View
                style={[
                  s.linkRowBox,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[s.linkTextVal, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {affiliateLink}
                </Text>
                <TouchableOpacity
                  onPress={() => handleCopy(affiliateLink, 'link')}
                  style={s.iconBtnSmall}
                >
                  {copiedLink ? (
                    <Check size={16} color="#10B981" />
                  ) : (
                    <Copy size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareLink} style={s.iconBtnSmall}>
                  <Share2 size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={s.codeFooterRow}>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                  Partner Referral Code:
                </Text>
                <TouchableOpacity
                  onPress={() => handleCopy(data?.referralCode || '', 'code')}
                  style={[
                    s.codeChip,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text style={[s.codeChipText, { color: colors.primary }]}>
                    {data?.referralCode}
                  </Text>
                  {copiedCode ? (
                    <Check size={12} color="#10B981" />
                  ) : (
                    <Copy size={12} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Affiliate Wallet Balance Card */}
            <View
              style={[
                s.flatCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={s.cardHeaderInline}>
                <Wallet size={16} color="#10B981" />
                <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                  Affiliate Earnings Wallet
                </Text>
              </View>

              <View style={s.dualBalRow}>
                <View style={s.dualBalCol}>
                  <Text style={[s.dualBalLabel, { color: colors.textMuted }]}>
                    NGN Balance
                  </Text>
                  <Text style={[s.dualBalVal, { color: colors.text }]}>
                    {formatCurrency(balance.ngn, 'NGN')}
                  </Text>
                </View>
                <View style={s.dualBalCol}>
                  <Text style={[s.dualBalLabel, { color: colors.textMuted }]}>
                    USD Balance
                  </Text>
                  <Text style={[s.dualBalVal, { color: colors.text }]}>
                    {formatCurrency(balance.usd, 'USD')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setActiveTab('withdraw')}
                style={[
                  s.secondaryActionBtn,
                  {
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <Text style={[s.secondaryActionText, { color: colors.primary }]}>
                  Manage Payouts
                </Text>
                <ArrowRight size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* 4 Key Metrics Grid */}
            <View style={s.metricsGrid}>
              <View
                style={[
                  s.metricBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Users size={18} color={colors.primary} />
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>
                  Total Referrals
                </Text>
                <Text style={[s.metricVal, { color: colors.text }]}>
                  {stats.totalReferredUsers}
                </Text>
              </View>

              <View
                style={[
                  s.metricBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Coins size={18} color="#10B981" />
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>
                  Earned (NGN)
                </Text>
                <Text style={[s.metricVal, { color: colors.text }]} numberOfLines={1}>
                  {formatCurrency(stats.totalEarningsNGN, 'NGN')}
                </Text>
              </View>

              <View
                style={[
                  s.metricBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <DollarSign size={18} color="#8B5CF6" />
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>
                  Earned (USD)
                </Text>
                <Text style={[s.metricVal, { color: colors.text }]} numberOfLines={1}>
                  {formatCurrency(stats.totalEarningsUSD, 'USD')}
                </Text>
              </View>

              <View
                style={[
                  s.metricBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <ArrowUpRight size={18} color="#F59E0B" />
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>
                  Total Withdrawn
                </Text>
                <Text style={[s.metricVal, { color: colors.text }]} numberOfLines={1}>
                  {formatCurrency(stats.totalWithdrawnNGN, 'NGN')}
                </Text>
              </View>
            </View>

            {/* Tabs Navigation */}
            <View
              style={[
                s.tabsBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {(
                [
                  { id: 'overview', label: 'Overview', Icon: TrendingUp },
                  { id: 'earnings', label: 'Commissions', Icon: DollarSign },
                  { id: 'withdraw', label: 'Withdraw', Icon: Wallet },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                const Icon = tab.Icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => {
                      triggerHaptic('selection');
                      setActiveTab(tab.id);
                    }}
                    style={[
                      s.tabBtn,
                      active && { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Icon
                      size={14}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        s.tabBtnText,
                        { color: active ? colors.primary : colors.textSecondary },
                        active && { fontWeight: '700' },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <View
                style={[
                  s.flatCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={s.headerRowBetween}>
                  <View style={s.cardHeaderInline}>
                    <Users size={16} color={colors.primary} />
                    <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                      Referred Users
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {stats.totalReferredUsers} total
                  </Text>
                </View>

                {data?.referredUsers && data.referredUsers.length > 0 ? (
                  <View style={{ marginTop: 10 }}>
                    {data.referredUsers.map((u, i) => (
                      <View
                        key={i}
                        style={[
                          s.listRow,
                          i > 0 && {
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.avatarCircle,
                            { backgroundColor: colors.primarySoft },
                          ]}
                        >
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.rowTitle, { color: colors.text }]}>
                            {u.name || 'User'}
                          </Text>
                          <Text style={[s.rowSub, { color: colors.textMuted }]}>
                            {u.email
                              ? u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
                              : ''}
                          </Text>
                        </View>
                        <Text style={[s.rowSub, { color: colors.textMuted }]}>
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={[
                      s.cardSub,
                      { color: colors.textMuted, textAlign: 'center', marginTop: 16 },
                    ]}
                  >
                    No referred users yet. Share your partner link to start earning!
                  </Text>
                )}
              </View>
            )}

            {/* TAB 2: COMMISSION HISTORY */}
            {activeTab === 'earnings' && (
              <View
                style={[
                  s.flatCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={s.headerRowBetween}>
                  <View style={s.cardHeaderInline}>
                    <DollarSign size={16} color="#10B981" />
                    <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                      Recent Commissions
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {earnings.length} records
                  </Text>
                </View>

                {earningsLoading ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : earnings.length > 0 ? (
                  <View style={{ marginTop: 10 }}>
                    {earnings.map((e, i) => (
                      <View
                        key={i}
                        style={[
                          s.listRow,
                          i > 0 && {
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.rowTitle, { color: colors.text }]}>
                            {eventLabel(e.event)} · {e.referee?.name || 'Customer'}
                          </Text>
                          <Text style={[s.rowSub, { color: colors.textMuted }]}>
                            Source: {formatCurrency(e.sourceAmount, e.sourceCurrency as any)} ({e.commissionRate})
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}>
                            +{formatCurrency(e.commissionAmount, e.commissionCurrency as any)}
                          </Text>
                          <Text style={[s.rowSub, { color: colors.textMuted }]}>
                            {new Date(e.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={[
                      s.cardSub,
                      { color: colors.textMuted, textAlign: 'center', marginTop: 16 },
                    ]}
                  >
                    No commissions recorded yet. Commissions appear here as your
                    referrals deposit and purchase.
                  </Text>
                )}
              </View>
            )}

            {/* TAB 3: WITHDRAW FUNDS */}
            {activeTab === 'withdraw' && (
              <View style={{ gap: 14 }}>
                <View
                  style={[
                    s.flatCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[s.cardTitle, { color: colors.text }]}>
                    Withdraw Affiliate Earnings
                  </Text>
                  <Text style={[s.cardSub, { color: colors.textMuted }]}>
                    Transfer earnings directly to your GlobeVerify wallet, or request
                    an external bank / crypto payout.
                  </Text>

                  {/* Destination Method */}
                  <View style={s.segRow}>
                    <TouchableOpacity
                      onPress={() => setWithdrawMethod('wallet')}
                      style={[
                        s.segBtn,
                        {
                          borderColor:
                            withdrawMethod === 'wallet'
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            withdrawMethod === 'wallet'
                              ? colors.primarySoft
                              : 'transparent',
                        },
                      ]}
                    >
                      <Wallet
                        size={15}
                        color={
                          withdrawMethod === 'wallet'
                            ? colors.primary
                            : colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          s.segBtnText,
                          {
                            color:
                              withdrawMethod === 'wallet'
                                ? colors.primary
                                : colors.text,
                          },
                        ]}
                      >
                        Main Wallet
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setWithdrawMethod('external')}
                      style={[
                        s.segBtn,
                        {
                          borderColor:
                            withdrawMethod === 'external'
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            withdrawMethod === 'external'
                              ? colors.primarySoft
                              : 'transparent',
                        },
                      ]}
                    >
                      <Building2
                        size={15}
                        color={
                          withdrawMethod === 'external'
                            ? colors.primary
                            : colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          s.segBtnText,
                          {
                            color:
                              withdrawMethod === 'external'
                                ? colors.primary
                                : colors.text,
                          },
                        ]}
                      >
                        External Payout
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Currency Segment */}
                  <View style={[s.segRow, { marginTop: 10 }]}>
                    <TouchableOpacity
                      onPress={() => setWithdrawCurrency('NGN')}
                      style={[
                        s.segBtn,
                        {
                          borderColor:
                            withdrawCurrency === 'NGN'
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            withdrawCurrency === 'NGN'
                              ? colors.primarySoft
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.segBtnText,
                          {
                            color:
                              withdrawCurrency === 'NGN'
                                ? colors.primary
                                : colors.text,
                          },
                        ]}
                      >
                        NGN ({formatCurrency(balance.ngn, 'NGN')})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setWithdrawCurrency('USD')}
                      style={[
                        s.segBtn,
                        {
                          borderColor:
                            withdrawCurrency === 'USD'
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            withdrawCurrency === 'USD'
                              ? colors.primarySoft
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.segBtnText,
                          {
                            color:
                              withdrawCurrency === 'USD'
                                ? colors.primary
                                : colors.text,
                          },
                        ]}
                      >
                        USD ({formatCurrency(balance.usd, 'USD')})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Amount Input */}
                  <View style={[s.headerRowBetween, { marginTop: 14, marginBottom: 6 }]}>
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                      Withdraw Amount
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Available: {formatCurrency(currentAvailable, withdrawCurrency)}
                    </Text>
                  </View>

                  <View
                    style={[
                      s.linkRowBox,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                        marginBottom: 14,
                      },
                    ]}
                  >
                    <TextInput
                      style={[s.amountInput, { color: colors.text }]}
                      keyboardType="decimal-pad"
                      placeholder={`Enter amount in ${withdrawCurrency}`}
                      placeholderTextColor={colors.textMuted}
                      value={withdrawAmount}
                      onChangeText={setWithdrawAmount}
                    />
                    <TouchableOpacity
                      onPress={() => setWithdrawAmount(String(currentAvailable))}
                      style={[s.codeChip, { backgroundColor: colors.primarySoft }]}
                    >
                      <Text style={[s.codeChipText, { color: colors.primary }]}>
                        MAX
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      s.primaryBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity:
                          withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0
                            ? 0.6
                            : 1,
                      },
                    ]}
                    onPress={handleWithdraw}
                    disabled={
                      withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0
                    }
                  >
                    {withdrawing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={s.primaryBtnText}>
                          {withdrawMethod === 'wallet'
                            ? 'Transfer to Main Wallet'
                            : `Request ${withdrawCurrency === 'NGN' ? 'Bank' : 'Crypto'} Payout`}
                        </Text>
                        <ArrowRight size={16} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Payout Details Card */}
                <View
                  style={[
                    s.flatCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={s.headerRowBetween}>
                    <View style={s.cardHeaderInline}>
                      {withdrawCurrency === 'NGN' ? (
                        <Building2 size={16} color={colors.primary} />
                      ) : (
                        <Coins size={16} color={colors.primary} />
                      )}
                      <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                        {withdrawCurrency === 'NGN'
                          ? 'Bank Account Details'
                          : 'Crypto Payout Wallet'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowPayoutForm(!showPayoutForm)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                        {showPayoutForm ? 'Cancel' : 'Edit'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!showPayoutForm ? (
                    <View style={{ marginTop: 10, gap: 6 }}>
                      {withdrawCurrency === 'NGN' ? (
                        aff?.bankDetails?.accountNumber ? (
                          <>
                            <Text style={{ fontSize: 13, color: colors.text }}>
                              Bank: <Text style={{ fontWeight: '700' }}>{aff.bankDetails.bankName || '—'}</Text>
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text }}>
                              Account: <Text style={{ fontWeight: '700' }}>{aff.bankDetails.accountNumber}</Text>
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text }}>
                              Name: <Text style={{ fontWeight: '700' }}>{aff.bankDetails.accountName || '—'}</Text>
                            </Text>
                          </>
                        ) : (
                          <Text style={{ fontSize: 13, color: colors.textMuted }}>
                            No bank account configured yet. Tap "Edit" to configure your bank details.
                          </Text>
                        )
                      ) : aff?.cryptoDetails?.address ? (
                        <>
                          <Text style={{ fontSize: 13, color: colors.text }}>
                            Network: <Text style={{ fontWeight: '700' }}>{aff.cryptoDetails.network}</Text>
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.text }}>
                            Currency: <Text style={{ fontWeight: '700' }}>{aff.cryptoDetails.currency}</Text>
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.text }}>
                            Address: <Text style={{ fontWeight: '700' }}>{aff.cryptoDetails.address}</Text>
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>
                          No crypto address configured yet. Tap "Edit" to save your USDT/USDC wallet.
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {withdrawCurrency === 'NGN' ? (
                        <>
                          <TextInput
                            style={[
                              s.singleInput,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Bank Name (e.g. GTBank, Kuda)"
                            placeholderTextColor={colors.textMuted}
                            value={bankName}
                            onChangeText={setBankName}
                          />
                          <TextInput
                            style={[
                              s.singleInput,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="10-digit Account Number"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            maxLength={10}
                            value={accountNumber}
                            onChangeText={setAccountNumber}
                          />
                          <TextInput
                            style={[
                              s.singleInput,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Account Holder Name"
                            placeholderTextColor={colors.textMuted}
                            value={accountName}
                            onChangeText={setAccountName}
                          />
                        </>
                      ) : (
                        <>
                          <TextInput
                            style={[
                              s.singleInput,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Network (TRON, BSC, Solana, Ethereum)"
                            placeholderTextColor={colors.textMuted}
                            value={cryptoNetwork}
                            onChangeText={setCryptoNetwork}
                          />
                          <TextInput
                            style={[
                              s.singleInput,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Currency (USDT or USDC)"
                            placeholderTextColor={colors.textMuted}
                            value={cryptoCurrency}
                            onChangeText={setCryptoCurrency}
                          />
                          <TextInput
                            style={[
                              s.singleInput,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Wallet Address"
                            placeholderTextColor={colors.textMuted}
                            value={cryptoAddress}
                            onChangeText={setCryptoAddress}
                          />
                        </>
                      )}
                      <TouchableOpacity
                        style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                        onPress={handleSavePayoutDetails}
                        disabled={savingPayout}
                      >
                        {savingPayout ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={s.primaryBtnText}>Save Details</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav activeTab="more" onSelectTab={handleSelectNavTab} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 6 },
  flatCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  benefitCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitTitle: { fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  benefitDesc: { fontSize: 13, lineHeight: 18 },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgePillText: { fontSize: 11.5, fontWeight: '700' },
  heroTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  heroSubtitle: { fontSize: 13.5, lineHeight: 19.5 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', marginBottom: 6 },
  cardSub: { fontSize: 13, lineHeight: 18.5, marginBottom: 12 },
  cardHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  singleInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  statusBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  statusBoxTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  statusBoxDesc: { fontSize: 13.5, lineHeight: 19.5, textAlign: 'center' },
  linkRowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  linkTextVal: { flex: 1, fontSize: 13, fontWeight: '500' },
  iconBtnSmall: { padding: 4 },
  codeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  codeChipText: { fontSize: 12.5, fontWeight: '700' },
  dualBalRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  dualBalCol: { flex: 1 },
  dualBalLabel: { fontSize: 12, marginBottom: 2 },
  dualBalVal: { fontSize: 18, fontWeight: '800' },
  secondaryActionBtn: {
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  secondaryActionText: { fontSize: 13.5, fontWeight: '700' },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  metricLabel: { fontSize: 12 },
  metricVal: { fontSize: 16, fontWeight: '800' },
  tabsBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnText: { fontSize: 12.5, fontWeight: '600' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  segRow: { flexDirection: 'row', gap: 10 },
  segBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBtnText: { fontSize: 13, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 14.5 },
});
