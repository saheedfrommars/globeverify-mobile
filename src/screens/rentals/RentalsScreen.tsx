import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Copy,
  Check,
  Clock,
  Phone,
  Globe,
  XCircle,
  Smartphone,
  Search,
  X,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { useCall } from '../../context/CallContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonNumberCard, SkeletonListItem } from '../../components/ui/Skeleton';
import { AnimatedEmptyState } from '../../components/ui/AnimatedEmptyState';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;
const LOADING_TIMEOUT_MS = 2500;

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
  lineType?: 'voip' | 'non_voip';
  isFullAccess?: boolean;
  serviceName?: string;
  service?: string;
  autoRenew?: boolean;
  otps?: Array<{
    code: string;
    message: string;
    sender: string;
    receivedAt: string;
  }>;
}

export interface AvailableRentalItem {
  // VoIP fields
  phoneNumber?: string;
  region?: string;
  countryCode?: string;
  features?: string[];

  // Non-VoIP fields
  serviceId?: number;
  service?: string;
  serviceName?: string;
  isFullAccess?: boolean;
  available?: number;

  // Shared
  monthlyFee?: number;
  pricing?: Record<string, number>;
  lineType?: 'voip' | 'non_voip';
  currency?: string;
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

const RENTAL_COUNTRIES: RentalCountry[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
];

const NON_VOIP_CATEGORIES = [
  { id: 'all', label: 'All Services' },
  { id: 'full', label: '★ Full Access' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'google', label: 'Google' },
  { id: 'cash app', label: 'Cash App' },
  { id: 'tinder', label: 'Tinder' },
  { id: 'instagram', label: 'Instagram' },
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
  const { colors, triggerHaptic, showDialog, showToast } = useAppSettings();
  const { openDialpad } = useCall();

  const [tab, setTab] = useState<'active' | 'catalog'>('active');
  const [lineType, setLineType] = useState<'non_voip' | 'voip'>('non_voip');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableRentalItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RentalCountry>(RENTAL_COUNTRIES[0]);

  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingKey, setPurchasingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, tab, lineType]);

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';

  const fetchActiveRentals = useCallback(async () => {
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, LOADING_TIMEOUT_MS);

    try {
      const res = await apiClient.get('/numbers/my-numbers?type=rental', {
        timeout: LOADING_TIMEOUT_MS,
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setActiveRentals(list);
    } catch {
      setActiveRentals([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(
    async (currentLineType: 'non_voip' | 'voip', countryCode: string) => {
      setLoadingCatalog(true);
      const timeoutId = setTimeout(() => {
        setLoadingCatalog(false);
      }, LOADING_TIMEOUT_MS);

      try {
        const res = await apiClient.get('/numbers/rentals/options', {
          params: {
            countryCode: currentLineType === 'non_voip' ? 'US' : countryCode,
            currency: displayCurrency,
            lineType: currentLineType,
          },
          timeout: LOADING_TIMEOUT_MS,
        });
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        const normalized: AvailableRentalItem[] = data.map((item: any) => ({
          ...item,
          lineType: currentLineType,
          monthlyFee:
            item.pricing?.[30] ||
            item.monthlyFee ||
            (displayCurrency === 'NGN'
              ? currentLineType === 'non_voip'
                ? 12000
                : 9800
              : currentLineType === 'non_voip'
              ? 8.5
              : 6.5),
        }));
        setAvailableNumbers(normalized);
      } catch {
        if (currentLineType === 'non_voip') {
          setAvailableNumbers([
            {
              serviceId: 0,
              service: 'full',
              serviceName: 'Full Rent (Any Service)',
              isFullAccess: true,
              lineType: 'non_voip',
              available: 30,
              monthlyFee: displayCurrency === 'NGN' ? 18000 : 12.0,
            },
            {
              serviceId: 1,
              service: 'wa',
              serviceName: 'WhatsApp',
              isFullAccess: false,
              lineType: 'non_voip',
              available: 45,
              monthlyFee: displayCurrency === 'NGN' ? 13000 : 8.5,
            },
            {
              serviceId: 2,
              service: 'tg',
              serviceName: 'Telegram',
              isFullAccess: false,
              lineType: 'non_voip',
              available: 35,
              monthlyFee: displayCurrency === 'NGN' ? 13000 : 8.5,
            },
            {
              serviceId: 3,
              service: 'go',
              serviceName: 'Google / YouTube',
              isFullAccess: false,
              lineType: 'non_voip',
              available: 50,
              monthlyFee: displayCurrency === 'NGN' ? 13000 : 8.5,
            },
            {
              serviceId: 4,
              service: 'ca',
              serviceName: 'Cash App',
              isFullAccess: false,
              lineType: 'non_voip',
              available: 20,
              monthlyFee: displayCurrency === 'NGN' ? 14000 : 9.0,
            },
          ]);
        } else {
          setAvailableNumbers([
            {
              phoneNumber: '+1 302 589 4412',
              region: 'Delaware, US',
              lineType: 'voip',
              monthlyFee: displayCurrency === 'NGN' ? 9800 : 6.5,
            },
            {
              phoneNumber: '+1 415 890 1204',
              region: 'California, US',
              lineType: 'voip',
              monthlyFee: displayCurrency === 'NGN' ? 9800 : 6.5,
            },
            {
              phoneNumber: '+1 646 320 9981',
              region: 'New York, US',
              lineType: 'voip',
              monthlyFee: displayCurrency === 'NGN' ? 9800 : 6.5,
            },
          ]);
        }
      } finally {
        clearTimeout(timeoutId);
        setLoadingCatalog(false);
      }
    },
    [displayCurrency]
  );

  useEffect(() => {
    fetchActiveRentals();
  }, [fetchActiveRentals]);

  useEffect(() => {
    if (tab === 'catalog') {
      fetchCatalog(lineType, selectedCountry.code);
    }
  }, [tab, lineType, selectedCountry.code, fetchCatalog]);

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await Promise.all([
      fetchActiveRentals(),
      fetchCatalog(lineType, selectedCountry.code),
      refreshUser(),
    ]);
    setRefreshing(false);
  };

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    setCopiedKey(key);
    showToast('Number copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRentNumber = (item: AvailableRentalItem) => {
    const isNonVoip = lineType === 'non_voip';
    const fee =
      item.monthlyFee ||
      (displayCurrency === 'NGN'
        ? isNonVoip
          ? 12000
          : 9800
        : isNonVoip
        ? 8.5
        : 6.5);
    const displayName = isNonVoip
      ? item.serviceName || item.service || 'Service'
      : item.phoneNumber || 'Number';

    const itemKey = isNonVoip ? String(item.serviceId) : String(item.phoneNumber);

    showDialog({
      title: isNonVoip ? 'Confirm Physical SIM Rental' : 'Confirm 30-Day Number Rental',
      message: isNonVoip
        ? `Rent a dedicated Non-VoIP Physical SIM for ${displayName} (30 days) at ${formatCurrency(fee, displayCurrency)}?`
        : `Lease ${displayName} (${selectedCountry.name}) for 30 days at ${formatCurrency(fee, displayCurrency)}?`,
      variant: 'confirm',
      confirmText: `Rent for ${formatCurrency(fee, displayCurrency)}`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        setPurchasingKey(itemKey);
        triggerHaptic('medium');
        try {
          let res;
          if (isNonVoip) {
            res = await apiClient.post('/numbers/rentals/purchase', {
              serviceId: item.serviceId,
              rentalId: item.serviceId,
              days: 30,
              country: 'US',
              lineType: 'non_voip',
            });
          } else {
            res = await apiClient.post('/numbers/rentals/purchase', {
              phoneNumber: item.phoneNumber,
              rentalId: item.phoneNumber,
              countryCode: selectedCountry.code,
              country: selectedCountry.code,
              days: 30,
              lineType: 'voip',
            });
          }

          if (res.data?.success) {
            showToast(`${displayName} is now active in your rentals!`, 'success');
            await Promise.all([fetchActiveRentals(), refreshUser()]);
            setTab('active');
          } else {
            showDialog({
              title: 'Rental Notice',
              message: res.data?.message || 'Could not complete rental.',
              variant: 'warning',
              confirmText: 'Got It',
            });
          }
        } catch (err: any) {
          showDialog({
            title: 'Rental Notice',
            message:
              err?.response?.data?.message || 'Unable to complete rental right now.',
            variant: 'danger',
            confirmText: 'Got It',
          });
        } finally {
          setPurchasingKey(null);
        }
      },
    });
  };

  const handleCancelRental = (rentalId: string, phone: string) => {
    showDialog({
      title: 'Cancel Rental Number?',
      message: `Are you sure you want to cancel and release ${phone}? This number will be immediately released from your account.`,
      variant: 'danger',
      confirmText: 'Release Number',
      cancelText: 'Keep Rental',
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/numbers/rentals/${rentalId}/cancel`);
          if (res.data?.success) {
            showToast('Rental released successfully', 'success');
            await fetchActiveRentals();
          } else {
            showToast(res.data?.message || 'Failed to cancel rental', 'error');
          }
        } catch (err: any) {
          showToast(err?.response?.data?.message || 'Failed to cancel rental', 'error');
        }
      },
    });
  };

  const filteredCatalog = useMemo(() => {
    if (lineType !== 'non_voip') return availableNumbers;

    let items = availableNumbers;

    // Category filter
    if (selectedCategory === 'full') {
      items = items.filter((i) => i.isFullAccess);
    } else if (selectedCategory !== 'all') {
      items = items.filter((i) =>
        (i.serviceName || i.service || '').toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Search query
    if (!serviceSearch.trim()) return items;
    const q = serviceSearch.toLowerCase().trim();
    return items.filter((i) => {
      const text = (i.serviceName || i.service || '').toLowerCase();
      return text.includes(q);
    });
  }, [availableNumbers, lineType, selectedCategory, serviceSearch]);

  const handleSelectNavTab = (nav: NavTabId) => {
    if (nav === 'home') onNavigateToHome?.();
    else if (nav === 'buy') onNavigateToBuy?.();
    else if (nav === 'sms') onNavigateToNumbers?.();
    else if (nav === 'wallet') onNavigateToWallet?.();
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        title="Rental Numbers"
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
        {/* ── PAGE HEADER & TABS ────────────────────────────────────────── */}
        <View style={[s.headerBar, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pageTitle, { color: colors.text }]}>
              Rental Numbers
            </Text>
            <Text style={[s.pageSubtitle, { color: colors.textMuted }]}>
              Dedicated 30-day lines for SMS & voice
            </Text>
          </View>

          <View style={s.tabsRow}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setTab('active');
              }}
              style={[
                s.tabPill,
                tab === 'active' && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Clock
                size={14}
                color={tab === 'active' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  s.tabPillText,
                  { color: tab === 'active' ? colors.primary : colors.textMuted },
                ]}
              >
                Active ({activeRentals.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setTab('catalog');
              }}
              style={[
                s.tabPill,
                tab === 'catalog' && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Globe
                size={14}
                color={tab === 'catalog' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  s.tabPillText,
                  { color: tab === 'catalog' ? colors.primary : colors.textMuted },
                ]}
              >
                Rent New
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
          {tab === 'active' ? (
            loading ? (
              <SkeletonNumberCard />
            ) : activeRentals.length === 0 ? (
              <AnimatedEmptyState
                type="rentals"
                title="No Active Rental Numbers"
                subtitle="You haven't leased any private numbers yet. Rent a dedicated Physical SIM or Virtual VoIP number for 30 days."
                actionLabel="Browse Available Lines"
                onAction={() => setTab('catalog')}
              />
            ) : (
              <View
                style={[
                  s.flatListSurface,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {activeRentals.map((rental, idx) => {
                  const exp = daysLeft(rental.expiresAt);
                  const isCopied = copiedKey === rental.id;
                  const isNonVoip = rental.lineType === 'non_voip';
                  const serviceDisplayName = isNonVoip
                    ? rental.serviceName || (rental.isFullAccess ? 'Full Rent (Any Service)' : 'Physical SIM')
                    : rental.countryName || rental.countryCode || 'Virtual VoIP Line';

                  return (
                    <TouchableOpacity
                      key={rental.id}
                      style={[
                        s.flatRow,
                        idx > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                      onPress={() => handleCopy(rental.phoneNumber, rental.id)}
                    >
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[s.rentalPhone, { color: colors.text }]}>
                            {rental.phoneNumber}
                          </Text>
                          <View
                            style={[
                              s.lineTypeBadge,
                              {
                                backgroundColor: isNonVoip
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(37, 99, 235, 0.15)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.lineTypeBadgeText,
                                { color: isNonVoip ? '#10B981' : '#2563EB' },
                              ]}
                            >
                              {isNonVoip ? 'Physical SIM' : 'VoIP'}
                            </Text>
                          </View>
                        </View>

                        <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                          {serviceDisplayName} {rental.countryName ? `· ${rental.countryName}` : ''}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '700',
                          color: exp.isCritical ? '#EF4444' : '#10B981',
                          marginRight: 10,
                        }}
                      >
                        {exp.label}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!isNonVoip && (
                          <TouchableOpacity
                            style={s.callActionButton}
                            onPress={() => {
                              triggerHaptic('medium');
                              openDialpad(rental.id, rental.phoneNumber);
                            }}
                            activeOpacity={0.8}
                          >
                            <Phone size={13} color="#FFFFFF" />
                            <Text style={s.callBtnText}>Call</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={() => handleCopy(rental.phoneNumber, rental.id)}
                          style={{ padding: 4 }}
                        >
                          {isCopied ? (
                            <Check size={17} color="#10B981" />
                          ) : (
                            <Copy size={17} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleCancelRental(rental.id, rental.phoneNumber)}
                          style={{ padding: 4 }}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                          <XCircle size={17} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : (
            <View style={{ gap: 14 }}>
              {/* ── LINE TYPE SELECTOR (NON-VOIP VS VOIP) ───────────────────── */}
              <View style={s.lineTypeRow}>
                {/* Non-VoIP Card */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic('selection');
                    setLineType('non_voip');
                    setServiceSearch('');
                    setSelectedCategory('all');
                  }}
                  style={[
                    s.lineTypeCard,
                    lineType === 'non_voip' && s.lineTypeCardActive,
                    {
                      backgroundColor:
                        lineType === 'non_voip'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : colors.surface,
                      borderColor:
                        lineType === 'non_voip' ? '#10B981' : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.lineTypeIconWrap,
                      {
                        backgroundColor:
                          lineType === 'non_voip' ? '#10B981' : colors.border,
                      },
                    ]}
                  >
                    <Smartphone size={17} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[s.lineTypeTitle, { color: colors.text }]}>
                        Non-VoIP
                      </Text>
                      <View style={[s.miniBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                        <Text style={[s.miniBadgeText, { color: '#10B981' }]}>
                          Physical SIM
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[s.lineTypeSubtitle, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      Real mobile carrier SIMs
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* VoIP Card */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic('selection');
                    setLineType('voip');
                    setServiceSearch('');
                  }}
                  style={[
                    s.lineTypeCard,
                    lineType === 'voip' && s.lineTypeCardActive,
                    {
                      backgroundColor:
                        lineType === 'voip'
                          ? 'rgba(37, 99, 235, 0.1)'
                          : colors.surface,
                      borderColor:
                        lineType === 'voip' ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.lineTypeIconWrap,
                      {
                        backgroundColor:
                          lineType === 'voip' ? '#2563EB' : colors.border,
                      },
                    ]}
                  >
                    <Phone size={17} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[s.lineTypeTitle, { color: colors.text }]}>
                        VoIP
                      </Text>
                      <View style={[s.miniBadge, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
                        <Text style={[s.miniBadgeText, { color: '#2563EB' }]}>
                          Calls + SMS
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[s.lineTypeSubtitle, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      Full virtual leased lines
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── CONDITIONAL SUB-FILTERS ─────────────────────────────────── */}
              {lineType === 'non_voip' ? (
                <View style={{ gap: 10 }}>
                  {/* Search Bar */}
                  <View
                    style={[
                      s.searchBarContainer,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Search size={16} color={colors.textMuted} />
                    <TextInput
                      style={[s.searchInput, { color: colors.text }]}
                      placeholder="Search physical SIM service (e.g. WhatsApp, Full)..."
                      placeholderTextColor={colors.textMuted}
                      value={serviceSearch}
                      onChangeText={setServiceSearch}
                      autoCapitalize="none"
                    />
                    {serviceSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setServiceSearch('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={15} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Categories Chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 7 }}
                  >
                    {NON_VOIP_CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => {
                            triggerHaptic('selection');
                            setSelectedCategory(cat.id);
                          }}
                          style={[
                            s.categoryChip,
                            {
                              backgroundColor: isActive
                                ? 'rgba(16, 185, 129, 0.15)'
                                : colors.surface,
                              borderColor: isActive ? '#10B981' : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.categoryChipText,
                              { color: isActive ? '#10B981' : colors.textSecondary },
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                /* Country Chips for VoIP */
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {RENTAL_COUNTRIES.map((c) => {
                    const active = selectedCountry.code === c.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => {
                          triggerHaptic('selection');
                          setSelectedCountry(c);
                        }}
                        style={[
                          s.countryChip,
                          {
                            backgroundColor: active
                              ? colors.primarySoft
                              : colors.surface,
                            borderColor: active ? '#2563EB' : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 15 }}>{c.flag}</Text>
                        <Text
                          style={[
                            s.countryChipText,
                            { color: active ? '#2563EB' : colors.textSecondary },
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* ── CATALOG ITEMS ────────────────────────────────────────────── */}
              {loadingCatalog ? (
                <View style={{ gap: 10 }}>
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                </View>
              ) : filteredCatalog.length === 0 ? (
                <View style={s.emptyCatalogWrap}>
                  <Text style={[s.emptyCatalogTitle, { color: colors.text }]}>
                    {lineType === 'non_voip'
                      ? 'No physical SIM services found'
                      : 'No VoIP numbers available'}
                  </Text>
                  <Text style={[s.emptyCatalogSubtitle, { color: colors.textMuted }]}>
                    {lineType === 'non_voip'
                      ? 'Try searching for another service name or tap All Services.'
                      : 'Try switching to another country or refresh the list.'}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    s.flatListSurface,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {lineType === 'non_voip'
                    ? filteredCatalog.map((item, idx) => {
                        const fee =
                          item.monthlyFee ||
                          (displayCurrency === 'NGN' ? 13000 : 8.5);
                        const busy = purchasingKey === String(item.serviceId);

                        return (
                          <View
                            key={item.serviceId ?? idx}
                            style={[
                              s.serviceRow,
                              idx > 0 && {
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                              },
                            ]}
                          >
                            <View style={s.serviceRowTop}>
                              <View style={s.serviceRowLeft}>
                                <View
                                  style={[
                                    s.serviceIconBox,
                                    {
                                      backgroundColor: item.isFullAccess
                                        ? 'rgba(234, 179, 8, 0.15)'
                                        : 'rgba(16, 185, 129, 0.15)',
                                    },
                                  ]}
                                >
                                  {item.isFullAccess ? (
                                    <Sparkles size={16} color="#EAB308" />
                                  ) : (
                                    <Smartphone size={16} color="#10B981" />
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text
                                      style={[s.serviceTitleText, { color: colors.text }]}
                                    >
                                      {item.serviceName || item.service}
                                    </Text>
                                    {item.isFullAccess ? (
                                      <View style={s.goldBadge}>
                                        <Text style={s.goldBadgeText}>★ Full Access</Text>
                                      </View>
                                    ) : item.available !== undefined ? (
                                      <View style={s.stockBadge}>
                                        <Text style={s.stockBadgeText}>
                                          {item.available} in stock
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.textMuted,
                                      marginTop: 2,
                                    }}
                                  >
                                    {item.isFullAccess
                                      ? 'Works for ANY service or verification app'
                                      : 'Dedicated Physical SIM for this specific service'}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Badges Row */}
                            <View style={s.chipsRow}>
                              <View
                                style={[
                                  s.featurePill,
                                  { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                                ]}
                              >
                                <ShieldCheck size={11} color="#10B981" />
                                <Text
                                  style={[s.featurePillText, { color: '#10B981' }]}
                                >
                                  Physical SIM
                                </Text>
                              </View>

                              <View style={s.featurePillMuted}>
                                <MessageSquare size={11} color={colors.textMuted} />
                                <Text
                                  style={[
                                    s.featurePillTextMuted,
                                    { color: colors.textMuted },
                                  ]}
                                >
                                  SMS Verification
                                </Text>
                              </View>

                              <View style={s.featurePillMuted}>
                                <Clock size={11} color={colors.textMuted} />
                                <Text
                                  style={[
                                    s.featurePillTextMuted,
                                    { color: colors.textMuted },
                                  ]}
                                >
                                  30-Day Rolling
                                </Text>
                              </View>
                            </View>

                            {/* Bottom Price & Rent Button */}
                            <View style={s.serviceBottomRow}>
                              <View>
                                <Text style={[s.priceMain, { color: colors.text }]}>
                                  {formatCurrency(fee, displayCurrency)}
                                </Text>
                                <Text style={[s.priceSub, { color: colors.textMuted }]}>
                                  for 30 days
                                </Text>
                              </View>

                              <TouchableOpacity
                                style={[
                                  s.rentBtnGreen,
                                  busy && { opacity: 0.7 },
                                ]}
                                onPress={() => handleRentNumber(item)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={s.rentBtnText}>Rent Service</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    : filteredCatalog.map((item, idx) => {
                        const fee =
                          item.monthlyFee ||
                          (displayCurrency === 'NGN' ? 9800 : 6.5);
                        const busy = purchasingKey === String(item.phoneNumber);

                        return (
                          <View
                            key={item.phoneNumber ?? idx}
                            style={[
                              s.flatRow,
                              idx > 0 && {
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                              },
                            ]}
                          >
                            <Phone size={17} color="#2563EB" />
                            <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
                              <Text style={[s.rentalPhone, { color: colors.text }]}>
                                {item.phoneNumber}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                {item.region || `${selectedCountry.name} · 30 Days`}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={s.rentBtn}
                              onPress={() => handleRentNumber(item)}
                              disabled={busy}
                            >
                              {busy ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={s.rentBtnText}>
                                  Rent · {formatCurrency(fee, displayCurrency)}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                </View>
              )}
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav activeTab="rentals" onSelectTab={handleSelectNavTab} />
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
    gap: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
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
    fontSize: 12.5,
    fontWeight: '700',
  },
  lineTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  lineTypeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  lineTypeCardActive: {
    transform: [{ scale: 1.01 }],
  },
  lineTypeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineTypeTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  lineTypeSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  lineTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  lineTypeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    padding: 0,
  },
  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  countryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  flatListSurface: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  serviceRow: {
    padding: 16,
    gap: 12,
  },
  serviceRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  serviceRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  serviceTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  goldBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  goldBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EAB308',
  },
  stockBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#10B981',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  featurePillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  featurePillTextMuted: {
    fontSize: 11,
    fontWeight: '600',
  },
  serviceBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  priceMain: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  priceSub: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  rentalPhone: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  rentBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  rentBtnGreen: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  rentBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  callActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyCatalogWrap: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyCatalogTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCatalogSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
