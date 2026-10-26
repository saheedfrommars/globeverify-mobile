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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Copy,
  Check,
  Clock,
  Repeat,
  Phone,
  Globe,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonNumberCard, SkeletonListItem } from '../../components/ui/Skeleton';
import { AnimatedEmptyState } from '../../components/ui/AnimatedEmptyState';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;
const LOADING_TIMEOUT_MS = 2200;

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
}

export interface AvailableRentalNumber {
  phoneNumber: string;
  region?: string;
  monthlyFee?: number;
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

  const [tab, setTab] = useState<'active' | 'catalog'>('active');
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableRentalNumber[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RentalCountry>(RENTAL_COUNTRIES[0]);

  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingPhone, setPurchasingPhone] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, tab]);

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';

  const fetchActiveRentals = useCallback(async () => {
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, LOADING_TIMEOUT_MS);

    try {
      const res = await apiClient.get('/rentals/my-rentals', {
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
    async (countryCode: string) => {
      setLoadingCatalog(true);
      const timeoutId = setTimeout(() => {
        setLoadingCatalog(false);
      }, LOADING_TIMEOUT_MS);

      try {
        const res = await apiClient.get(
          `/rentals/available?country=${countryCode}&currency=${displayCurrency}`,
          { timeout: LOADING_TIMEOUT_MS }
        );
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setAvailableNumbers(list);
      } catch {
        setAvailableNumbers([
          {
            phoneNumber: '+1 302 589 4412',
            region: 'Delaware, US',
            monthlyFee: displayCurrency === 'NGN' ? 9800 : 6.5,
          },
          {
            phoneNumber: '+1 415 890 1204',
            region: 'California, US',
            monthlyFee: displayCurrency === 'NGN' ? 9800 : 6.5,
          },
          {
            phoneNumber: '+1 646 320 9981',
            region: 'New York, US',
            monthlyFee: displayCurrency === 'NGN' ? 9800 : 6.5,
          },
        ]);
      } finally {
        clearTimeout(timeoutId);
        setLoadingCatalog(false);
      }
    },
    [displayCurrency]
  );

  useEffect(() => {
    fetchActiveRentals();
    fetchCatalog(selectedCountry.code);
  }, [fetchActiveRentals, fetchCatalog, selectedCountry.code]);

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await Promise.all([
      fetchActiveRentals(),
      fetchCatalog(selectedCountry.code),
      refreshUser(),
    ]);
    setRefreshing(false);
  };

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    setCopiedKey(key);
    showToast('Rental number copied!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRentNumber = (item: AvailableRentalNumber) => {
    const fee = item.monthlyFee || (displayCurrency === 'NGN' ? 9800 : 6.5);
    showDialog({
      title: 'Confirm 30-Day Number Rental',
      message: `Lease ${item.phoneNumber} (${selectedCountry.name}) for 30 days at ${formatCurrency(fee, displayCurrency)}?`,
      variant: 'confirm',
      confirmText: `Rent for ${formatCurrency(fee, displayCurrency)}`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        setPurchasingPhone(item.phoneNumber);
        triggerHaptic('medium');
        try {
          const res = await apiClient.post('/rentals/purchase', {
            phoneNumber: item.phoneNumber,
            countryCode: selectedCountry.code,
            durationDays: 30,
          });
          if (res.data?.success) {
            showToast(`${item.phoneNumber} is now leased to your account!`, 'success');
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
              err?.response?.data?.message || 'Unable to rent this number right now.',
            variant: 'danger',
            confirmText: 'Got It',
          });
        } finally {
          setPurchasingPhone(null);
        }
      },
    });
  };

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
        {/* ── OPEN PAGE HEADER + PILLS (Zero Outer Container!) ────────────── */}
        <View style={[s.headerBar, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pageTitle, { color: colors.text }]}>
              Rental Numbers
            </Text>
            <Text style={[s.pageSubtitle, { color: colors.textMuted }]}>
              Dedicated long-term numbers for SMS & voice
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
                Active
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
                subtitle="You haven't leased any long-term private numbers yet. Rent a dedicated number for 30 days with unlimited incoming SMS."
                actionLabel="Rent a Number"
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
                        <Text style={[s.rentalPhone, { color: colors.text }]}>
                          {rental.phoneNumber}
                        </Text>
                        <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                          {rental.countryName || rental.countryCode}
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

                      {isCopied ? (
                        <Check size={17} color="#10B981" />
                      ) : (
                        <Copy size={17} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : (
            <View style={{ gap: 14 }}>
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

              {loadingCatalog ? (
                <View style={{ gap: 10 }}>
                  <SkeletonListItem />
                  <SkeletonListItem />
                </View>
              ) : (
                <View
                  style={[
                    s.flatListSurface,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {availableNumbers.map((item, idx) => {
                    const fee =
                      item.monthlyFee ||
                      (displayCurrency === 'NGN' ? 9800 : 6.5);
                    const busy = purchasingPhone === item.phoneNumber;

                    return (
                      <View
                        key={item.phoneNumber}
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
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
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
  rentalPhone: {
    fontSize: 15.5,
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
  rentBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  rentBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
