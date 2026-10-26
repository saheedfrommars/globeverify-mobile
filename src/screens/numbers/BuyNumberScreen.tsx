import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  Search,
  Smartphone,
  Globe,
  Zap,
  Check,
  Copy,
  ShoppingCart,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient, {
  getMemoryCache,
  getCachedData,
  setCachedData,
} from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonListItem } from '../../components/ui/Skeleton';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;
const LOADING_TIMEOUT_MS = 2200;

const FALLBACK_COUNTRIES: CountryItem[] = [
  { ID: 187, name: 'United States', short_name: 'US' },
  { ID: 16, name: 'United Kingdom', short_name: 'GB' },
  { ID: 36, name: 'Canada', short_name: 'CA' },
  { ID: 19, name: 'Nigeria', short_name: 'NG' },
  { ID: 43, name: 'Germany', short_name: 'DE' },
  { ID: 78, name: 'France', short_name: 'FR' },
  { ID: 48, name: 'Netherlands', short_name: 'NL' },
  { ID: 175, name: 'Australia', short_name: 'AU' },
];

export interface CountryItem {
  ID: string | number;
  name: string;
  short_name: string;
  code?: string;
}

export interface ServiceItem {
  ID: string | number;
  name: string;
  price?: number;
  count?: number;
}

interface PriceInfo {
  price: number;
  formatted: string;
}

interface PurchaseSuccessData {
  id?: string;
  phoneNumber: string;
  serviceName: string;
  countryName: string;
  cost: number;
}

interface BuyNumberScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
}

const getCountryFlag = (shortName?: string): string => {
  if (!shortName || shortName.length < 2) return '🌐';
  const clean = shortName.replace(/_v$/i, '').slice(0, 2).toUpperCase();
  if (clean.length !== 2) return '🌐';
  const first = clean.charCodeAt(0) - 65 + 0x1f1e6;
  const second = clean.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
};

export const BuyNumberScreen: React.FC<BuyNumberScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
}) => {
  const { user, refreshUser } = useAuth();
  const { colors, triggerHaptic, showDialog, showToast } = useAppSettings();

  const initialCountries = getMemoryCache<CountryItem[]>('buy_countries');

  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 = Country, 1 = Service, 2 = Confirm

  const [countries, setCountries] = useState<CountryItem[]>(initialCountries || []);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const [pricingOption, setPricingOption] = useState<0 | 1>(1);
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [stockAmount, setStockAmount] = useState<number | null>(null);

  const [countrySearch, setCountrySearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const [loadingCountries, setLoadingCountries] = useState(!initialCountries);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [successData, setSuccessData] = useState<PurchaseSuccessData | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Soft step transition animation
  const stepAnim = useRef(new Animated.Value(1)).current;

  const animateStepChange = (nextStep: 0 | 1 | 2) => {
    stepAnim.setValue(0);
    setStep(nextStep);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';
  const currentBalance =
    displayCurrency === 'NGN'
      ? user?.balances?.ngn ?? (user?.currency === 'NGN' ? user?.balance : (user?.balance || 0) * 1600)
      : user?.balances?.usd ?? (user?.currency === 'USD' ? user?.balance : (user?.balance || 0));

  const fetchCountries = useCallback(async () => {
    if (!getMemoryCache<CountryItem[]>('buy_countries')) {
      setLoadingCountries(true);
      const saved = await getCachedData<CountryItem[]>('buy_countries');
      if (saved && saved.length > 0) {
        setCountries(saved);
        setLoadingCountries(false);
      }
    }
    const timeoutId = setTimeout(() => {
      setLoadingCountries(false);
    }, LOADING_TIMEOUT_MS);

    try {
      const res = await apiClient.get('/numbers/countries', {
        timeout: 5000,
      });
      let payload = res.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {}
      }
      const list: CountryItem[] = Array.isArray(payload) ? payload : payload?.data ?? [];
      if (list.length > 0) {
        setCountries(list);
        setCachedData('buy_countries', list);
      } else {
        setCountries((prev) => (prev.length > 0 ? prev : FALLBACK_COUNTRIES));
      }
    } catch (err) {
      console.warn('[BuyNumber] fetch countries error:', err);
      setCountries((prev) => (prev.length > 0 ? prev : FALLBACK_COUNTRIES));
    } finally {
      clearTimeout(timeoutId);
      setLoadingCountries(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const fetchServices = useCallback(async (country: CountryItem) => {
    setLoadingServices(true);
    setServices([]);
    setPriceInfo(null);
    setSelectedService(null);
    const timeoutId = setTimeout(() => {
      setLoadingServices(false);
    }, LOADING_TIMEOUT_MS);

    try {
      const res = await apiClient.get(`/numbers/available?country=${country.short_name}`, {
        timeout: LOADING_TIMEOUT_MS,
      });
      let payload = res.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {}
      }
      const list: ServiceItem[] = Array.isArray(payload)
        ? payload
        : payload?.[country.short_name] ?? payload?.[country.ID] ?? [];
      setServices(list);
    } catch (err) {
      console.warn('[BuyNumber] fetch services error:', err);
    } finally {
      clearTimeout(timeoutId);
      setLoadingServices(false);
    }
  }, []);

  const fetchPriceAndStock = useCallback(
    async (country: CountryItem, service: ServiceItem, pricingOpt: number) => {
      setLoadingPrice(true);
      setPriceInfo(null);
      setStockAmount(null);
      const timeoutId = setTimeout(() => {
        setLoadingPrice(false);
      }, LOADING_TIMEOUT_MS);

      try {
        const [priceRes, stockRes] = await Promise.allSettled([
          apiClient.get('/numbers/price', {
            timeout: LOADING_TIMEOUT_MS,
            params: {
              country: country.short_name,
              service: service.ID,
              currency: user?.currency || displayCurrency,
              pricing_option: pricingOpt,
            },
          }),
          apiClient.get('/numbers/stock', {
            timeout: LOADING_TIMEOUT_MS,
            params: {
              country: country.short_name,
              service: service.ID,
            },
          }),
        ]);

        if (priceRes.status === 'fulfilled' && priceRes.value.data?.price !== undefined) {
          setPriceInfo({
            price: priceRes.value.data.price,
            formatted:
              priceRes.value.data.formatted ||
              formatCurrency(priceRes.value.data.price, displayCurrency),
          });
        }

        if (stockRes.status === 'fulfilled' && stockRes.value.data?.amount !== undefined) {
          setStockAmount(stockRes.value.data.amount);
        }
      } catch (err) {
        console.warn('[BuyNumber] fetch price error:', err);
      } finally {
        clearTimeout(timeoutId);
        setLoadingPrice(false);
      }
    },
    [user?.currency, displayCurrency]
  );

  const filteredCountries = useMemo(() => {
    const base = !countrySearch.trim()
      ? countries
      : countries.filter(
          (c) =>
            c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
            c.short_name.toLowerCase().includes(countrySearch.toLowerCase())
        );
    return base.slice(0, 80);
  }, [countries, countrySearch]);

  const filteredServices = useMemo(() => {
    const base = !serviceSearch.trim()
      ? services
      : services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()));
    return base.slice(0, 80);
  }, [services, serviceSearch]);

  const handleSelectCountry = (country: CountryItem) => {
    triggerHaptic('light');
    setSelectedCountry(country);
    animateStepChange(1);
    fetchServices(country);
  };

  const handleSelectService = (service: ServiceItem) => {
    if (!selectedCountry) return;
    triggerHaptic('light');
    setSelectedService(service);
    animateStepChange(2);
    fetchPriceAndStock(selectedCountry, service, pricingOption);
  };

  const handleSwitchPricingOption = (opt: 0 | 1) => {
    if (!selectedCountry || !selectedService) return;
    triggerHaptic('selection');
    setPricingOption(opt);
    fetchPriceAndStock(selectedCountry, selectedService, opt);
  };

  const handlePurchase = async () => {
    if (!selectedCountry || !selectedService || !priceInfo) return;
    if ((currentBalance || 0) < priceInfo.price) {
      showDialog({
        title: 'Insufficient Wallet Balance',
        message:
          'Your wallet balance is lower than the number activation price. Would you like to top up your wallet now?',
        variant: 'warning',
        confirmText: 'Add Funds',
        cancelText: 'Cancel',
        onConfirm: () => onNavigateToWallet?.(),
      });
      return;
    }

    setPurchasing(true);
    triggerHaptic('medium');

    try {
      const res = await apiClient.post('/numbers/purchase', {
        country: selectedCountry.short_name,
        service: selectedService.ID,
        pricing_option: pricingOption,
      });

      if (res.data?.success || res.data?.phoneNumber || res.data?.data?.phoneNumber) {
        const d = res.data?.data || res.data;
        triggerHaptic('success');
        await refreshUser();
        showToast('Virtual number activated!', 'success');
        setSuccessData({
          id: d._id || d.id,
          phoneNumber: d.phoneNumber || d.number || 'Assigned',
          serviceName: selectedService.name,
          countryName: selectedCountry.name,
          cost: priceInfo.price,
        });
      } else {
        showDialog({
          title: 'Order Notice',
          message: res.data?.message || 'Could not allocate number right now.',
          variant: 'warning',
          confirmText: 'Got It',
        });
      }
    } catch (err: any) {
      showDialog({
        title: 'Purchase Failed',
        message:
          err?.response?.data?.message ||
          'Numbers for this service are currently out of stock. Please try another country or route.',
        variant: 'danger',
        confirmText: 'Got It',
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'home') onNavigateToHome?.();
    else if (tab === 'sms') onNavigateToNumbers?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'wallet') onNavigateToWallet?.();
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader title="Buy Number" onBack={onBack} />

      <View style={s.mainContainer}>
        {/* ── 1. BUY A NUMBER HEADER CARD (Exact Match to Screenshot 4!) ──── */}
        <View
          style={[
            s.headerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ShoppingCart
            size={24}
            color="#2563EB"
            strokeWidth={2}
            style={{ marginTop: 4 }}
          />

          <View style={s.headerTextCol}>
            <Text style={[s.headerTitle, { color: colors.text }]}>
              Buy a Number
            </Text>
            <Text style={[s.headerDesc, { color: colors.textMuted }]}>
              Select a country and service to get started.{' '}
              <Text style={s.headerNoteBlue}>
                Note: All numbers are for one-time use only.
              </Text>
            </Text>
          </View>
        </View>

        {/* ── 2. SELECTION PANEL (Matches Screenshot 4 — Zero Nested Containers!) ── */}
        <Animated.View
          style={[
            s.selectionPanel,
            step !== 2 && { flex: 1 },
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: stepAnim,
              transform: [
                {
                  translateY: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* STEP 0: SELECT COUNTRY (Exact Match to Screenshot 4!) */}
          {step === 0 && (
            <>
              <View style={s.panelHeaderRow}>
                <Globe size={19} color="#2563EB" strokeWidth={2.1} />
                <Text style={[s.panelTitle, { color: colors.text }]}>
                  Select Country
                </Text>
              </View>

              {/* Soft Blue-Bordered Search Input (Matches Screenshot 4!) */}
              <View
                style={[
                  s.searchBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.isDark
                      ? 'rgba(59, 130, 246, 0.45)'
                      : '#BFDBFE',
                  },
                ]}
              >
                <Search size={17} color={colors.textMuted} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Search..."
                  placeholderTextColor={colors.textMuted}
                />
                {countrySearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCountrySearch('')}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {loadingCountries ? (
                <View style={{ gap: 10 }}>
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                </View>
              ) : filteredCountries.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.textMuted }]}>
                  No countries found.
                </Text>
              ) : (
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(country, idx) =>
                    String(country.ID || country.short_name || idx)
                  }
                  style={s.virtualizedList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={16}
                  maxToRenderPerBatch={16}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  renderItem={({ item: country }) => (
                    <TouchableOpacity
                      style={s.countryItemRow}
                      onPress={() => handleSelectCountry(country)}
                      activeOpacity={0.65}
                    >
                      <Text style={s.flagEmoji}>
                        {getCountryFlag(country.short_name)}
                      </Text>
                      <Text style={[s.countryNameText, { color: colors.text }]}>
                        {country.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}

          {/* STEP 1: SELECT SERVICE */}
          {step === 1 && selectedCountry && (
            <>
              <View style={s.panelHeaderBetween}>
                <View style={s.panelHeaderRow}>
                  <Smartphone size={19} color="#2563EB" strokeWidth={2.1} />
                  <Text style={[s.panelTitle, { color: colors.text }]}>
                    Select Service ({selectedCountry.name})
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => animateStepChange(0)}
                  style={s.backLinkRow}
                >
                  <ChevronLeft size={16} color="#2563EB" />
                  <Text style={s.backLinkText}>Country</Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  s.searchBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.isDark
                      ? 'rgba(59, 130, 246, 0.45)'
                      : '#BFDBFE',
                  },
                ]}
              >
                <Search size={17} color={colors.textMuted} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                  placeholder="Search service (WhatsApp, Telegram, Google)..."
                  placeholderTextColor={colors.textMuted}
                />
                {serviceSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setServiceSearch('')}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {loadingServices ? (
                <View style={{ gap: 10 }}>
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                </View>
              ) : filteredServices.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.textMuted }]}>
                  No services found.
                </Text>
              ) : (
                <FlatList
                  data={filteredServices}
                  keyExtractor={(srv, idx) => String(srv.ID || srv.name || idx)}
                  style={s.virtualizedList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={16}
                  maxToRenderPerBatch={16}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  renderItem={({ item: srv }) => (
                    <TouchableOpacity
                      style={s.countryItemRow}
                      onPress={() => handleSelectService(srv)}
                      activeOpacity={0.65}
                    >
                      <Smartphone size={17} color="#2563EB" strokeWidth={1.9} />
                      <Text
                        style={[
                          s.countryNameText,
                          { color: colors.text, flex: 1 },
                        ]}
                      >
                        {srv.name}
                      </Text>
                      {srv.price !== undefined && (
                        <Text style={s.servicePriceText}>
                          {formatCurrency(srv.price, displayCurrency)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}

          {/* STEP 2: CONFIRM & BUY NUMBER */}
          {step === 2 && selectedCountry && selectedService && (
            <View style={{ gap: 18 }}>
              <View style={s.panelHeaderBetween}>
                <View style={s.panelHeaderRow}>
                  <Text style={s.flagEmoji}>
                    {getCountryFlag(selectedCountry.short_name)}
                  </Text>
                  <View>
                    <Text style={[s.panelTitle, { color: colors.text }]}>
                      {selectedService.name}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                      {selectedCountry.name}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => animateStepChange(1)}
                  style={s.backLinkRow}
                >
                  <ChevronLeft size={16} color="#2563EB" />
                  <Text style={s.backLinkText}>Services</Text>
                </TouchableOpacity>
              </View>

              {/* Priority Toggle Pills */}
              <View style={s.priorityRow}>
                <TouchableOpacity
                  onPress={() => handleSwitchPricingOption(1)}
                  style={[
                    s.priorityPill,
                    {
                      backgroundColor:
                        pricingOption === 1 ? colors.primarySoft : 'transparent',
                      borderColor:
                        pricingOption === 1 ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <ShieldCheck
                    size={16}
                    color={pricingOption === 1 ? '#2563EB' : colors.textMuted}
                  />
                  <Text
                    style={[
                      s.priorityPillText,
                      {
                        color:
                          pricingOption === 1 ? '#2563EB' : colors.textSecondary,
                      },
                    ]}
                  >
                    High Success Rate
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleSwitchPricingOption(0)}
                  style={[
                    s.priorityPill,
                    {
                      backgroundColor:
                        pricingOption === 0 ? colors.primarySoft : 'transparent',
                      borderColor:
                        pricingOption === 0 ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <Zap
                    size={16}
                    color={pricingOption === 0 ? '#2563EB' : colors.textMuted}
                  />
                  <Text
                    style={[
                      s.priorityPillText,
                      {
                        color:
                          pricingOption === 0 ? '#2563EB' : colors.textSecondary,
                      },
                    ]}
                  >
                    Economy Route
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Price Display */}
              <View
                style={[
                  s.priceRow,
                  { borderTopColor: colors.border, borderBottomColor: colors.border },
                ]}
              >
                <View>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    One-Time Activation Price
                  </Text>
                  {loadingPrice ? (
                    <ActivityIndicator
                      size="small"
                      color="#2563EB"
                      style={{ marginTop: 6, alignSelf: 'flex-start' }}
                    />
                  ) : (
                    <Text style={[s.priceBigVal, { color: colors.text }]}>
                      {priceInfo ? priceInfo.formatted : 'Out of Stock'}
                    </Text>
                  )}
                </View>

                {stockAmount !== null && (
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#10B981' }}>
                    {stockAmount.toLocaleString()} in stock
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  s.buyNowBtn,
                  (!priceInfo || loadingPrice || purchasing) && { opacity: 0.55 },
                ]}
                onPress={handlePurchase}
                disabled={!priceInfo || loadingPrice || purchasing}
                activeOpacity={0.85}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <ShoppingCart size={17} color="#FFFFFF" />
                    <Text style={s.buyNowBtnText}>
                      {priceInfo
                        ? `Buy Number · ${priceInfo.formatted}`
                        : 'Currently Unavailable'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>

      {/* ── PURCHASE SUCCESS MODAL ────────────────────────────────────────── */}
      <Modal
        visible={!!successData}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessData(null)}
      >
        <View style={s.modalOverlay}>
          <View
            style={[
              s.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Check size={34} color="#10B981" strokeWidth={2.5} />
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Number Activated!
            </Text>
            <Text style={[s.modalSub, { color: colors.textMuted }]}>
              {successData?.serviceName} ({successData?.countryName})
            </Text>

            <TouchableOpacity
              style={[s.modalPhoneRow, { borderColor: colors.border }]}
              onPress={async () => {
                if (!successData?.phoneNumber) return;
                await Clipboard.setStringAsync(successData.phoneNumber);
                setCopiedPhone(true);
                setTimeout(() => setCopiedPhone(false), 2000);
              }}
            >
              <Text style={[s.modalPhoneText, { color: colors.text }]}>
                {successData?.phoneNumber}
              </Text>
              {copiedPhone ? (
                <Check size={18} color="#10B981" />
              ) : (
                <Copy size={18} color="#2563EB" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.buyNowBtn, { width: '100%' }]}
              onPress={() => {
                setSuccessData(null);
                onNavigateToNumbers?.();
              }}
            >
              <Text style={s.buyNowBtnText}>View OTP in My Numbers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ModernBottomNav activeTab="buy" onSelectTab={handleSelectNavTab} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: PAD,
    paddingTop: 8,
    paddingBottom: 92,
    gap: 14,
  },

  // 1. Header Card (Exact Match to Screenshot 4)
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  headerTextCol: {
    flex: 1,
    gap: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerDesc: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  headerNoteBlue: {
    color: '#2563EB',
    fontWeight: '700',
  },

  // 2. Selection Panel (Exact Match to Screenshot 4)
  selectionPanel: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  panelHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLinkText: {
    color: '#2563EB',
    fontSize: 13.5,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
  },
  flatItemsList: {
    gap: 2,
  },
  virtualizedList: {
    flex: 1,
  },
  countryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  flagEmoji: {
    fontSize: 22,
  },
  countryNameText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  servicePriceText: {
    color: '#2563EB',
    fontSize: 13.5,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13.5,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Step 2: Confirm
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  priorityPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  priceBigVal: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  buyNowBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  buyNowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  modalSub: {
    fontSize: 13.5,
    marginBottom: 8,
  },
  modalPhoneRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  modalPhoneText: {
    fontSize: 19,
    fontWeight: '800',
  },
});
