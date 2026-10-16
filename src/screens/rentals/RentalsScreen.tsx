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
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  Copy,
  Check,
  Phone,
  Clock,
  Send,
  Home,
  ShoppingCart,
  MessageSquare,
  Wallet,
  ShieldCheck,
  Zap,
  X,
  CreditCard,
  Plus,
  Repeat,
  Search,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonNumberCard, SkeletonListItem } from '../../components/ui/Skeleton';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 18;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ActiveRental {
  id: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  status: string;
  expiresAt: string;
  purchasedAt?: string;
  cost: number;
  currency?: string;
  autoRenew?: boolean;
  enableVoicemail?: boolean;
  forwardToNumber?: string;
  otps?: Array<{
    code: string;
    message?: string;
    sender?: string;
    receivedAt?: string;
  }>;
}

export interface AvailableRentalNumber {
  phoneNumber: string;
  region?: string;
  monthlyFee?: number;
  pricing?: Record<string, number>;
  features?: string[];
}

export interface RentalCountry {
  code: string;
  name: string;
  flag: string;
}

interface RentalsScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToWallet?: () => void;
}

// ─── Default Countries ────────────────────────────────────────────────────────

const RENTAL_COUNTRIES: RentalCountry[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
];

const daysLeft = (expiresAt: string) => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: 'Expired', isCritical: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return { label: `${hours}h left`, isCritical: true };
  return { label: `${days}d left`, isCritical: days <= 3 };
};

export const RentalsScreen: React.FC<RentalsScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToWallet,
}) => {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'my-rentals' | 'browse'>('my-rentals');
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableRentalNumber[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [areaCodeFilter, setAreaCodeFilter] = useState('');
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [browsingLoading, setBrowsingLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('5');
  const [toppingUp, setToppingUp] = useState(false);

  const [rentModalNumber, setRentModalNumber] = useState<AvailableRentalNumber | null>(null);
  const [rentingNumber, setRentingNumber] = useState(false);

  const [sendSmsRental, setSendSmsRental] = useState<ActiveRental | null>(null);
  const [smsRecipient, setSmsRecipient] = useState('');
  const [smsText, setSmsText] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  const [forwardRental, setForwardRental] = useState<ActiveRental | null>(null);
  const [forwardNumberInput, setForwardNumberInput] = useState('');
  const [savingForward, setSavingForward] = useState(false);

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchMyRentals = useCallback(async () => {
    try {
      const res = await apiClient.get('/numbers/my-numbers?type=rental');
      if (res.data?.success && Array.isArray(res.data.data)) {
        const rentalList = res.data.data.filter((n: ActiveRental) => n.status !== 'cancelled');
        setRentals(rentalList);
      }
    } catch (err) {
      console.warn('[Rentals] fetch rentals error:', err);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await apiClient.get('/numbers/credits/balance');
      if (res.data?.success) {
        setCredits(res.data.credits || 0);
      }
    } catch (err) {
      console.warn('[Rentals] fetch credits error:', err);
    }
  }, []);

  const fetchAvailable = useCallback(
    async (country: string, areaCode?: string) => {
      setBrowsingLoading(true);
      try {
        const params: Record<string, string> = {
          countryCode: country,
          currency: user?.currency || 'USD',
        };
        if (areaCode && areaCode.trim()) {
          params.areaCode = areaCode.trim();
        }
        const res = await apiClient.get('/numbers/rentals/options', { params });
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setAvailableNumbers(data);
      } catch (err) {
        console.warn('[Rentals] fetch available error:', err);
      } finally {
        setBrowsingLoading(false);
      }
    },
    [user?.currency]
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMyRentals(), fetchCredits()]);
    setLoading(false);
  }, [fetchMyRentals, fetchCredits]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (activeTab === 'browse') {
      fetchAvailable(selectedCountry, areaCodeFilter);
    }
  }, [activeTab, selectedCountry, fetchAvailable]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      fetchMyRentals(),
      fetchCredits(),
      activeTab === 'browse' ? fetchAvailable(selectedCountry, areaCodeFilter) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [fetchMyRentals, fetchCredits, activeTab, selectedCountry, areaCodeFilter, fetchAvailable]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleAutoRenew = async (rentalId: string, currentStatus: boolean) => {
    Haptics.selectionAsync();
    try {
      const { data } = await apiClient.post(`/numbers/rentals/${rentalId}/auto-renew`, {
        autoRenew: !currentStatus,
      });
      setRentals((prev) =>
        prev.map((r) => (r.id === rentalId ? { ...r, autoRenew: data.autoRenew ?? !currentStatus } : r))
      );
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.message || 'Could not update auto-renew setting.');
    }
  };

  const handleToggleVoicemail = async (rentalId: string, currentStatus: boolean) => {
    Haptics.selectionAsync();
    try {
      const { data } = await apiClient.post(`/numbers/rentals/${rentalId}/voicemail`, {
        enableVoicemail: !currentStatus,
      });
      setRentals((prev) =>
        prev.map((r) => (r.id === rentalId ? { ...r, enableVoicemail: data.enableVoicemail ?? !currentStatus } : r))
      );
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.message || 'Could not update voicemail setting.');
    }
  };

  const handleSaveForwarding = async () => {
    if (!forwardRental) return;
    setSavingForward(true);
    try {
      const { data } = await apiClient.post(`/numbers/rentals/${forwardRental.id}/forwarding`, {
        forwardToNumber: forwardNumberInput.trim(),
      });
      setRentals((prev) =>
        prev.map((r) =>
          r.id === forwardRental.id ? { ...r, forwardToNumber: data.forwardToNumber ?? forwardNumberInput.trim() } : r
        )
      );
      setForwardRental(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.message || 'Could not update call forwarding number.');
    } finally {
      setSavingForward(false);
    }
  };

  const handleTopupCredits = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setToppingUp(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post('/numbers/credits/topup', { amount });
      if (res.data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCredits(res.data.credits);
        setShowTopupModal(false);
        setTopupAmount('5');
        await refreshUser();
      } else {
        Alert.alert('Notice', res.data?.message || 'Top-up could not be completed.');
      }
    } catch (err: any) {
      Alert.alert('Top-Up Notice', err.response?.data?.message || 'Insufficient wallet balance to top up telecom credits.');
    } finally {
      setToppingUp(false);
    }
  };

  const handleRentConfirm = async () => {
    if (!rentModalNumber) return;
    setRentingNumber(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post('/numbers/rentals/purchase', {
        rentalId: rentModalNumber.phoneNumber,
        days: 30,
        country: selectedCountry,
      });
      if (res.data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRentModalNumber(null);
        await refreshUser();
        await fetchMyRentals();
        setActiveTab('my-rentals');
        Alert.alert('Success', 'Your rental number is now active for 30 days.');
      } else {
        Alert.alert('Notice', res.data?.message || 'Could not complete rental purchase.');
      }
    } catch (err: any) {
      Alert.alert('Purchase Error', err.response?.data?.message || 'Insufficient funds or number no longer available.');
    } finally {
      setRentingNumber(false);
    }
  };

  const handleSendSms = async () => {
    if (!sendSmsRental || !smsRecipient.trim() || !smsText.trim()) {
      Alert.alert('Missing Fields', 'Please enter both the recipient phone number and SMS message.');
      return;
    }
    setSendingSms(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post(`/numbers/rentals/${sendSmsRental.id}/send-sms`, {
        to: smsRecipient.trim(),
        message: smsText.trim(),
      });
      if (res.data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSendSmsRental(null);
        setSmsRecipient('');
        setSmsText('');
        fetchCredits();
        Alert.alert('SMS Sent', 'Your outbound SMS was successfully dispatched.');
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to send SMS.');
      }
    } catch (err: any) {
      Alert.alert('SMS Notice', err.response?.data?.message || 'Failed to send outbound SMS. Ensure you have telecom credits.');
    } finally {
      setSendingSms(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── MODERN LUXURY HEADER ────────────────────────────────────────── */}
      <ModernHeader
        title="Rentals"
        subtitle={`${rentals.length} dedicated line${rentals.length === 1 ? '' : 's'}`}
        onBack={onBack}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
        rightElement={
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setShowTopupModal(true);
            }}
            style={styles.creditsPill}
            activeOpacity={0.8}
          >
            <Zap size={13} color="#FFFFFF" />
            <Text style={styles.creditsText} numberOfLines={1}>
              Credits: ${credits.toFixed(2)}
            </Text>
            <Plus size={12} color="#8E8E93" />
          </TouchableOpacity>
        }
      />

      {/* Segmented Tab Bar */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'my-rentals' && styles.tabButtonActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('my-rentals');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'my-rentals' && styles.tabTextActive]} numberOfLines={1}>
              Active ({rentals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'browse' && styles.tabButtonActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('browse');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]} numberOfLines={1}>
              Rent New Number
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'my-rentals' ? (
          /* TAB 1: MY ACTIVE RENTALS */
          loading ? (
            <View style={{ gap: 12 }}>
              <SkeletonNumberCard />
              <SkeletonNumberCard />
            </View>
          ) : rentals.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Repeat size={26} color="#8E8E93" />
              </View>
              <Text style={styles.emptyTitle}>No Active Rental Numbers</Text>
              <Text style={styles.emptySubtitle}>
                Rent long-term dedicated numbers for 30+ days with full SMS receiving, outbound SMS, and call forwarding.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab('browse');
                }}
                style={styles.emptyActionBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionBtnText}>Browse Available Numbers</Text>
              </TouchableOpacity>
            </View>
          ) : (
            rentals.map((rental) => {
              const expiry = daysLeft(rental.expiresAt);
              const latestOtp = rental.otps && rental.otps.length > 0 ? rental.otps[0] : null;

              return (
                <View key={rental.id} style={styles.rentalCard}>
                  {/* Card Header */}
                  <View style={styles.rentalHeader}>
                    <View style={styles.rentalPhoneRow}>
                      <Text style={styles.rentalFlag}>{rental.countryCode === 'US' ? '🇺🇸' : '🌐'}</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy(rental.phoneNumber, `phone_${rental.id}`)}
                        style={styles.rentalPhoneCopyBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.rentalPhoneNumber} numberOfLines={1} adjustsFontSizeToFit>
                          {rental.phoneNumber}
                        </Text>
                        {copiedKey === `phone_${rental.id}` ? (
                          <Check size={14} color="#22C55E" />
                        ) : (
                          <Copy size={14} color="#8E8E93" />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Expiry Pill */}
                    <View style={[styles.expiryBadge, expiry.isCritical && styles.expiryBadgeCritical]}>
                      <Clock size={11} color={expiry.isCritical ? '#EF4444' : '#8E8E93'} />
                      <Text style={[styles.expiryText, expiry.isCritical && styles.expiryTextCritical]} numberOfLines={1}>
                        {expiry.label}
                      </Text>
                    </View>
                  </View>

                  {/* Latest SMS Box */}
                  {latestOtp ? (
                    <View style={styles.otpBox}>
                      <View style={styles.otpHeader}>
                        <Text style={styles.otpLabel} numberOfLines={1}>
                          Latest Verification Code
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleCopy(latestOtp.code, `otp_${rental.id}`)}
                          style={styles.copyOtpBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.copyOtpBtnText}>
                            {copiedKey === `otp_${rental.id}` ? 'Copied' : 'Copy Code'}
                          </Text>
                          {copiedKey === `otp_${rental.id}` ? (
                            <Check size={12} color="#000000" />
                          ) : (
                            <Copy size={12} color="#000000" />
                          )}
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.otpValue} selectable numberOfLines={1} adjustsFontSizeToFit>
                        {latestOtp.code}
                      </Text>
                      {latestOtp.message && (
                        <Text style={styles.otpMessage} numberOfLines={2}>
                          {latestOtp.message}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.otpEmptyBox}>
                      <Text style={styles.otpEmptyText}>Waiting for incoming SMS / OTP...</Text>
                    </View>
                  )}

                  {/* Settings toggles */}
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLabelGroup}>
                      <Text style={styles.toggleTitle}>Auto-Renew (30 Days)</Text>
                      <Text style={styles.toggleSub}>Renews from balance before expiry</Text>
                    </View>
                    <Switch
                      value={!!rental.autoRenew}
                      onValueChange={(val) => handleToggleAutoRenew(rental.id, !!rental.autoRenew)}
                      trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                      thumbColor={rental.autoRenew ? '#000000' : '#8E8E93'}
                    />
                  </View>

                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLabelGroup}>
                      <Text style={styles.toggleTitle}>Voicemail</Text>
                      <Text style={styles.toggleSub}>Record callers when offline</Text>
                    </View>
                    <Switch
                      value={!!rental.enableVoicemail}
                      onValueChange={(val) => handleToggleVoicemail(rental.id, !!rental.enableVoicemail)}
                      trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                      thumbColor={rental.enableVoicemail ? '#000000' : '#8E8E93'}
                    />
                  </View>

                  {/* Call Forwarding Info */}
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setForwardRental(rental);
                      setForwardNumberInput(rental.forwardToNumber || '');
                    }}
                    style={styles.forwardingRow}
                    activeOpacity={0.7}
                  >
                    <View style={styles.forwardingLeft}>
                      <Phone size={14} color="#8E8E93" />
                      <Text style={styles.forwardingText} numberOfLines={1}>
                        Forwarding:{' '}
                        <Text style={{ color: '#FFFFFF' }}>{rental.forwardToNumber || 'Disabled'}</Text>
                      </Text>
                    </View>
                    <Text style={styles.forwardingEdit}>Edit</Text>
                  </TouchableOpacity>

                  {/* Action Buttons */}
                  <View style={styles.rentalActions}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSendSmsRental(rental);
                        setSmsRecipient('');
                        setSmsText('');
                      }}
                      style={styles.sendSmsBtn}
                      activeOpacity={0.8}
                    >
                      <Send size={13} color="#FFFFFF" />
                      <Text style={styles.sendSmsBtnText}>Send SMS</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        ) : (
          /* TAB 2: BROWSE & RENT NEW NUMBERS */
          <View>
            {/* Country Selector Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryPickerScroll}>
              {RENTAL_COUNTRIES.map((c) => {
                const isSelected = selectedCountry === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedCountry(c.code);
                    }}
                    style={[styles.countryChip, isSelected && styles.countryChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.countryChipFlag}>{c.flag}</Text>
                    <Text style={[styles.countryChipText, isSelected && styles.countryChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Area Code Search Input */}
            <View style={styles.searchRow}>
              <Search size={16} color="#8E8E93" style={{ marginLeft: 12 }} />
              <TextInput
                value={areaCodeFilter}
                onChangeText={setAreaCodeFilter}
                onSubmitEditing={() => fetchAvailable(selectedCountry, areaCodeFilter)}
                placeholder="Filter by Area Code (e.g. 917, 312)"
                placeholderTextColor="#666668"
                style={styles.searchInput}
                keyboardType="numeric"
                returnKeyType="search"
              />
              {areaCodeFilter.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setAreaCodeFilter('');
                    fetchAvailable(selectedCountry, '');
                  }}
                  style={{ padding: 8 }}
                >
                  <X size={14} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Numbers List */}
            {browsingLoading ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </View>
            ) : availableNumbers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Numbers Found</Text>
                <Text style={styles.emptySubtitle}>
                  No numbers currently available for {selectedCountry} with area code "{areaCodeFilter}". Try clearing
                  the filter.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                {availableNumbers.map((item, idx) => (
                  <View key={item.phoneNumber || idx} style={styles.availableCard}>
                    <View style={styles.availableInfo}>
                      <Text style={styles.availablePhone} numberOfLines={1} adjustsFontSizeToFit>
                        {item.phoneNumber}
                      </Text>
                      <Text style={styles.availableRegion} numberOfLines={1}>
                        {item.region || 'Standard Dedicated Line'}
                      </Text>
                    </View>

                    <View style={styles.availableRight}>
                      <Text style={styles.availableFee} numberOfLines={1}>
                        {displayCurrency === 'NGN' ? '₦7,500' : '$5.00'}
                        <Text style={styles.availableFeeTerm}>/mo</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRentModalNumber(item);
                        }}
                        style={styles.rentButton}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rentButtonText}>Rent</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL: Rent Confirmation ────────────────────────────────────────── */}
      <Modal visible={!!rentModalNumber} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Rental</Text>
              <TouchableOpacity onPress={() => setRentModalNumber(null)} style={{ padding: 4 }}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {rentModalNumber && (
              <View style={{ gap: 14 }}>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Number</Text>
                  <Text style={styles.modalVal}>{rentModalNumber.phoneNumber}</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Term</Text>
                  <Text style={styles.modalVal}>30 Days (Renewable)</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Monthly Cost</Text>
                  <Text style={styles.modalValHighlight}>
                    {displayCurrency === 'NGN' ? '₦7,500.00' : '$5.00'}
                  </Text>
                </View>

                <View style={styles.modalNotice}>
                  <ShieldCheck size={14} color="#8E8E93" />
                  <Text style={styles.modalNoticeText}>
                    Amount will be debited from your GlobeVerify wallet balance immediately.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleRentConfirm}
                  disabled={rentingNumber}
                  style={[styles.modalActionBtn, rentingNumber && { opacity: 0.6 }]}
                  activeOpacity={0.85}
                >
                  {rentingNumber ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.modalActionBtnText}>Confirm & Activate Line</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: Top Up Telecom Credits ───────────────────────────────────── */}
      <Modal visible={showTopupModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Up Telecom Credits</Text>
              <TouchableOpacity onPress={() => setShowTopupModal(false)} style={{ padding: 4 }}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Credits are used to power outbound SMS messaging and call forwarding on your dedicated rentals.
            </Text>

            <View style={styles.topupInputWrap}>
              <Text style={styles.topupCurrency}>$</Text>
              <TextInput
                value={topupAmount}
                onChangeText={setTopupAmount}
                keyboardType="decimal-pad"
                style={styles.topupInput}
                placeholder="5"
                placeholderTextColor="#666668"
              />
            </View>

            <View style={styles.quickPillsRow}>
              {['2', '5', '10', '25'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTopupAmount(amt);
                  }}
                  style={[styles.quickPill, topupAmount === amt && styles.quickPillActive]}
                >
                  <Text style={[styles.quickPillText, topupAmount === amt && styles.quickPillTextActive]}>
                    +${amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleTopupCredits}
              disabled={toppingUp}
              style={[styles.modalActionBtn, toppingUp && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {toppingUp ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.modalActionBtnText}>Pay with Wallet Balance</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: Send Outbound SMS ────────────────────────────────────────── */}
      <Modal visible={!!sendSmsRental} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Outbound SMS</Text>
              <TouchableOpacity onPress={() => setSendSmsRental(null)} style={{ padding: 4 }}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              From: <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{sendSmsRental?.phoneNumber}</Text>
            </Text>

            <View style={{ gap: 10, marginTop: 10 }}>
              <TextInput
                value={smsRecipient}
                onChangeText={setSmsRecipient}
                placeholder="Recipient Number (e.g. +14155552671)"
                placeholderTextColor="#666668"
                keyboardType="phone-pad"
                style={styles.smsInput}
              />

              <TextInput
                value={smsText}
                onChangeText={setSmsText}
                placeholder="Write your text message here..."
                placeholderTextColor="#666668"
                multiline
                numberOfLines={3}
                maxLength={160}
                style={[styles.smsInput, { height: 90, textAlignVertical: 'top' }]}
              />
              <Text style={styles.charCount}>{smsText.length}/160 characters</Text>
            </View>

            <TouchableOpacity
              onPress={handleSendSms}
              disabled={sendingSms}
              style={[styles.modalActionBtn, sendingSms && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {sendingSms ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.modalActionBtnText}>Dispatch Outbound SMS</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: Call Forwarding Number ───────────────────────────────────── */}
      <Modal visible={!!forwardRental} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Call Forwarding</Text>
              <TouchableOpacity onPress={() => setForwardRental(null)} style={{ padding: 4 }}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Incoming voice calls to this rental will be seamlessly bridged to this external number. Leave empty to
              disable.
            </Text>

            <TextInput
              value={forwardNumberInput}
              onChangeText={setForwardNumberInput}
              placeholder="+1234567890"
              placeholderTextColor="#666668"
              keyboardType="phone-pad"
              style={[styles.smsInput, { marginTop: 12 }]}
            />

            <TouchableOpacity
              onPress={handleSaveForwarding}
              disabled={savingForward}
              style={[styles.modalActionBtn, savingForward && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {savingForward ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.modalActionBtnText}>Save Forwarding</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODERN FLOATING DOCK BOTTOM NAVIGATION ──────────────────────── */}
      <ModernBottomNav
        activeTab="rentals"
        onSelectTab={(tabId: NavTabId) => {
          if (tabId === 'home') {
            onNavigateToHome?.();
          } else if (tabId === 'buy') {
            onNavigateToBuy?.();
          } else if (tabId === 'sms') {
            onNavigateToNumbers?.();
          } else if (tabId === 'wallet') {
            onNavigateToWallet?.();
          }
        }}
      />
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
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#242426',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  creditsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabBarWrapper: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121214',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#222224',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  rentalCard: {
    backgroundColor: '#121214',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 16,
    marginBottom: 14,
  },
  rentalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rentalPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  rentalFlag: {
    fontSize: 18,
  },
  rentalPhoneCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  rentalPhoneNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#18181A',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#242426',
  },
  expiryBadgeCritical: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  expiryTextCritical: {
    color: '#EF4444',
  },
  otpBox: {
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    padding: 14,
    marginBottom: 14,
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  copyOtpBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
  },
  otpValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 4,
  },
  otpMessage: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  otpEmptyBox: {
    backgroundColor: '#161618',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  otpEmptyText: {
    fontSize: 12,
    color: '#666668',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  toggleLabelGroup: {
    flex: 1,
    marginRight: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 11,
    color: '#8E8E93',
  },
  forwardingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  forwardingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  forwardingText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  forwardingEdit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rentalActions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  sendSmsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E22',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  sendSmsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countryPickerScroll: {
    marginBottom: 12,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E20',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    gap: 6,
  },
  countryChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  countryChipFlag: {
    fontSize: 14,
  },
  countryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  countryChipTextActive: {
    color: '#000000',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121214',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E20',
    height: 42,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#FFFFFF',
  },
  availableCard: {
    backgroundColor: '#121214',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  availableInfo: {
    flex: 1,
    marginRight: 10,
  },
  availablePhone: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  availableRegion: {
    fontSize: 11,
    color: '#8E8E93',
  },
  availableRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  availableFee: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  availableFeeTerm: {
    fontSize: 11,
    fontWeight: '400',
    color: '#8E8E93',
  },
  rentButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rentButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
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
    marginBottom: 14,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1C',
  },
  modalLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  modalVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalValHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181A',
    borderRadius: 10,
    padding: 10,
    marginVertical: 4,
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
  topupInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 12,
  },
  topupCurrency: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  topupInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickPill: {
    flex: 1,
    backgroundColor: '#18181A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242426',
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  quickPillTextActive: {
    color: '#000000',
  },
  smsInput: {
    backgroundColor: '#18181A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242426',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#FFFFFF',
  },
  charCount: {
    fontSize: 11,
    color: '#666668',
    textAlign: 'right',
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
