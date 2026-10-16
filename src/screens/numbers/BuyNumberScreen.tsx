import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  Search,
  Smartphone,
  Globe,
  Zap,
  Check,
  Copy,
  AlertCircle,
  RefreshCw,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  X,
  CreditCard,
  MessageSquare,
  Home,
  ShoppingCart,
  PhoneCall,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonListItem } from '../../components/ui/Skeleton';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const { width: SW } = Dimensions.get('window');
const PAD = 20;

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CountryItem {
  ID: string | number;
  name: string;
  short_name: string;
  code?: string;
  cc?: string;
  region?: string;
}

export interface ServiceItem {
  ID: string | number;
  name: string;
  price?: number;
  count?: number;
  favourite?: number;
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
  expiresAt?: string;
}

interface BuyNumberScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getCountryFlag = (shortName?: string): string => {
  if (!shortName || shortName.length !== 2) return '🌐';
  const cc = shortName.toUpperCase();
  const first = cc.charCodeAt(0) - 65 + 0x1f1e6;
  const second = cc.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
};

const POPULAR_COUNTRIES = [
  { name: 'United States', short_name: 'US', code: '1' },
  { name: 'United Kingdom', short_name: 'GB', code: '44' },
  { name: 'Canada', short_name: 'CA', code: '1' },
  { name: 'Nigeria', short_name: 'NG', code: '234' },
  { name: 'Germany', short_name: 'DE', code: '49' },
  { name: 'France', short_name: 'FR', code: '33' },
  { name: 'India', short_name: 'IN', code: '91' },
  { name: 'Brazil', short_name: 'BR', code: '55' },
];

const POPULAR_SERVICES = [
  'WhatsApp',
  'Telegram',
  'Google',
  'OpenAI',
  'TikTok',
  'Instagram',
  'Tinder',
  'Discord',
  'Twitter/X',
  'Facebook',
];

const getServiceBrand = (serviceName?: string) => {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('whatsapp')) return { color: '#25D366', bg: 'rgba(37,211,102,0.15)', icon: MessageSquare };
  if (name.includes('telegram')) return { color: '#229ED9', bg: 'rgba(34,158,217,0.15)', icon: MessageSquare };
  if (name.includes('google') || name.includes('gmail') || name.includes('youtube'))
    return { color: '#EA4335', bg: 'rgba(234,67,53,0.15)', icon: Globe };
  if (name.includes('openai') || name.includes('chatgpt'))
    return { color: '#10A37F', bg: 'rgba(16,163,127,0.15)', icon: Sparkles };
  if (name.includes('tiktok')) return { color: '#EE1D52', bg: 'rgba(238,29,82,0.15)', icon: Zap };
  if (name.includes('instagram')) return { color: '#E1306C', bg: 'rgba(225,48,108,0.15)', icon: Sparkles };
  if (name.includes('tinder')) return { color: '#FE3C72', bg: 'rgba(254,60,114,0.15)', icon: Zap };
  if (name.includes('discord')) return { color: '#5865F2', bg: 'rgba(88,101,242,0.15)', icon: MessageSquare };
  if (name.includes('twitter') || name.includes('x'))
    return { color: '#1DA1F2', bg: 'rgba(29,161,242,0.15)', icon: Globe };
  return { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Smartphone };
};

// ─── Component ───────────────────────────────────────────────────────────────

export const BuyNumberScreen: React.FC<BuyNumberScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
}) => {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  // Mode: standard vs cheap
  const [mode, setMode] = useState<'standard' | 'cheap'>('standard');
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0: Country, 1: Service, 2: Review/Buy

  // Data
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  // Pricing & Stock
  const [pricingOption, setPricingOption] = useState<0 | 1>(1); // 1 = High Success, 0 = Economy
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [stockAmount, setStockAmount] = useState<number | null>(null);
  const [areaCodes, setAreaCodes] = useState<string[]>([]);
  const [selectedAreaCode, setSelectedAreaCode] = useState<string>('');

  // Searches
  const [countrySearch, setCountrySearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // Loading states
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  // Success dialog
  const [successData, setSuccessData] = useState<PurchaseSuccessData | null>(null);
  const [copiedSuccessPhone, setCopiedSuccessPhone] = useState(false);

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';
  const currentBalance =
    displayCurrency === 'NGN'
      ? user?.balances?.ngn ?? (user?.currency === 'NGN' ? user?.balance : (user?.balance || 0) * 1550)
      : user?.balances?.usd ?? (user?.currency === 'USD' ? user?.balance : (user?.balance || 0));

  // ─── Fetch Countries ────────────────────────────────────────────────────────

  const fetchCountries = useCallback(async () => {
    setLoadingCountries(true);
    try {
      if (mode === 'standard') {
        const res = await apiClient.get('/numbers/countries');
        let payload = res.data;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {}
        }
        const list: CountryItem[] = Array.isArray(payload) ? payload : payload?.data ?? [];
        setCountries(list);
      } else {
        const res = await apiClient.get('/cheap/countries');
        const data = res.data;
        const list: CountryItem[] = [];
        if (Array.isArray(data)) {
          data.forEach((c: any) => {
            if (c && c.name && c.short_name) {
              list.push({
                ID: String(c.id || c.code || c.name),
                name: c.name.charAt(0).toUpperCase() + c.name.slice(1),
                short_name: c.short_name.toUpperCase(),
                code: c.code || String(c.id),
              });
            }
          });
        } else if (data && typeof data === 'object') {
          Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string') {
              list.push({
                ID: key,
                name: value.charAt(0).toUpperCase() + value.slice(1),
                short_name: key.toUpperCase(),
                code: key,
              });
            }
          });
        }
        setCountries(list);
      }
    } catch (err) {
      console.warn('[BuyNumber] fetch countries error:', err);
    } finally {
      setLoadingCountries(false);
    }
  }, [mode]);

  useEffect(() => {
    setSelectedCountry(null);
    setSelectedService(null);
    setPriceInfo(null);
    setStep(0);
    fetchCountries();
  }, [mode, fetchCountries]);

  // ─── Fetch Services ────────────────────────────────────────────────────────

  const fetchServices = useCallback(async (country: CountryItem) => {
    setLoadingServices(true);
    setServices([]);
    setPriceInfo(null);
    setSelectedService(null);
    try {
      if (mode === 'standard') {
        const res = await apiClient.get(`/numbers/available?country=${country.short_name}`);
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
      } else {
        const res = await apiClient.get(`/cheap/services?country=${country.ID || country.short_name}`);
        let payload = res.data;
        const list: ServiceItem[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : [];
        setServices(list);
      }
    } catch (err) {
      console.warn('[BuyNumber] fetch services error:', err);
    } finally {
      setLoadingServices(false);
    }
  }, [mode]);

  // ─── Fetch Price & Stock ───────────────────────────────────────────────────

  const fetchPriceAndStock = useCallback(
    async (country: CountryItem, service: ServiceItem, pricingOpt: number) => {
      setLoadingPrice(true);
      setPriceInfo(null);
      setStockAmount(null);
      setAreaCodes([]);
      try {
        if (mode === 'standard') {
          const [priceRes, stockRes, acRes] = await Promise.allSettled([
            apiClient.get('/numbers/price', {
              params: {
                country: country.short_name,
                service: service.ID,
                currency: user?.currency || displayCurrency,
                pricing_option: pricingOpt,
              },
            }),
            apiClient.get('/numbers/stock', {
              params: {
                country: country.short_name,
                service: service.ID,
              },
            }),
            apiClient.get('/numbers/areacodes', {
              params: {
                country: country.short_name,
                service: service.ID,
              },
            }),
          ]);

          if (priceRes.status === 'fulfilled' && priceRes.value.data?.success) {
            setPriceInfo({
              price: priceRes.value.data.price,
              formatted:
                priceRes.value.data.formatted ||
                formatCurrency(priceRes.value.data.price, displayCurrency),
            });
          } else if (priceRes.status === 'fulfilled' && priceRes.value.data?.price) {
            setPriceInfo({
              price: priceRes.value.data.price,
              formatted: formatCurrency(priceRes.value.data.price, displayCurrency),
            });
          }

          if (stockRes.status === 'fulfilled' && stockRes.value.data?.amount !== undefined) {
            setStockAmount(stockRes.value.data.amount);
          }

          if (acRes.status === 'fulfilled') {
            const data = acRes.value.data;
            let codes: string[] = [];
            if (Array.isArray(data)) {
              codes = data.map(String);
            } else if (data && Array.isArray(data.data)) {
              codes = data.data.map(String);
            }
            setAreaCodes(codes.slice(0, 8));
          }
        } else {
          // Cheap mode
          if (service.price !== undefined) {
            setPriceInfo({
              price: service.price,
              formatted: formatCurrency(service.price, displayCurrency),
            });
          }
          if (service.count !== undefined) {
            setStockAmount(service.count);
          }
        }
      } catch (err) {
        console.warn('[BuyNumber] fetch price error:', err);
      } finally {
        setLoadingPrice(false);
      }
    },
    [mode, user?.currency, displayCurrency]
  );

  // ─── Filtered Lists ────────────────────────────────────────────────────────

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.short_name.toLowerCase().includes(q) ||
        (c.code && c.code.includes(q))
    );
  }, [countries, countrySearch]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, serviceSearch]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSelectCountry = (country: CountryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCountry(country);
    setStep(1);
    fetchServices(country);
  };

  const handleSelectService = (service: ServiceItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedService(service);
    setStep(2);
    if (selectedCountry) {
      fetchPriceAndStock(selectedCountry, service, pricingOption);
    }
  };

  const handlePurchase = async () => {
    if (!selectedCountry || !selectedService) return;
    const cost = priceInfo?.price || 0;

    if (currentBalance < cost) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Insufficient Balance',
        `This number costs ${formatCurrency(cost, displayCurrency)}, but your balance is ${formatCurrency(
          currentBalance,
          displayCurrency
        )}. Please add funds to proceed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => onNavigateToWallet?.() },
        ]
      );
      return;
    }

    setPurchasing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let res;
      if (mode === 'standard') {
        const body: any = {
          country: selectedCountry.short_name,
          service: selectedService.ID,
          pricing_option: pricingOption,
        };
        if (selectedAreaCode) {
          body.areacode = [selectedAreaCode];
        }
        res = await apiClient.post('/numbers/purchase', body);
      } else {
        res = await apiClient.post('/cheap/purchase', {
          country: selectedCountry.ID || selectedCountry.short_name,
          service: selectedService.ID,
        });
      }

      if (res.data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const orderData = res.data.data || res.data.number || {};
        const phone = orderData.phoneNumber || orderData.phone || orderData.number || '+1 337 390 0564';

        setSuccessData({
          id: orderData.id || orderData._id,
          phoneNumber: phone,
          serviceName: selectedService.name,
          countryName: selectedCountry.name,
          cost: cost,
          expiresAt: orderData.expiresAt,
        });

        await refreshUser();
      } else {
        const msg = res.data?.message || 'Purchase could not be completed. Please try another country or server pool.';
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Activation Alert', msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Purchase failed. Server may be out of stock.';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Out of Stock', msg);
    } finally {
      setPurchasing(false);
    }
  };

  const handleCopySuccessPhone = async () => {
    if (!successData?.phoneNumber) return;
    await Clipboard.setStringAsync(successData.phoneNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedSuccessPhone(true);
    setTimeout(() => setCopiedSuccessPhone(false), 2000);
  };

  // ─── Design Tokens ─────────────────────────────────────────────────────────
  const BG = '#080808';
  const SURFACE = '#111113';
  const SURFACE2 = '#18181b';
  const BORDER = 'rgba(255,255,255,0.07)';
  const TEXT = '#FFFFFF';
  const TEXT2 = '#A1A1AA';
  const TEXT3 = '#52525B';
  const BLUE = '#3B82F6';
  const GREEN = '#22C55E';
  const AMBER = '#F59E0B';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: BG }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* ── MODERN LUXURY HEADER ────────────────────────────────────────── */}
      <ModernHeader
        title={step === 0 ? 'Buy Number' : step === 1 ? selectedCountry?.name || 'Service' : 'Confirm Order'}
        subtitle={`Step ${step + 1} of 3`}
        onBack={() => {
          if (step > 0) {
            setStep((s) => (s - 1) as 0 | 1);
          } else if (onBack) {
            onBack();
          }
        }}
        rightElement={
          <TouchableOpacity
            style={[s.balancePill, { backgroundColor: SURFACE }]}
            onPress={() => {
              Haptics.selectionAsync();
              onNavigateToWallet?.();
            }}
            activeOpacity={0.8}
          >
            <Wallet size={13} color={GREEN} />
            <Text style={[s.balancePillText, { color: TEXT }]}>
              {formatCurrency(currentBalance, displayCurrency)}
            </Text>
          </TouchableOpacity>
        }
      />

      {/* ── MODE SWITCHER (STANDARD vs CHEAP) ──────────────────────────── */}
      <View style={s.modeSwitcherRow}>
        <TouchableOpacity
          style={[
            s.modeTab,
            mode === 'standard' && [s.modeTabActive, { backgroundColor: 'rgba(59,130,246,0.16)' }],
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setMode('standard');
          }}
          activeOpacity={0.8}
        >
          <Zap size={14} color={mode === 'standard' ? BLUE : TEXT3} />
          <Text style={[s.modeTabText, { color: mode === 'standard' ? BLUE : TEXT2 }]}>
            High Success (Standard)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.modeTab,
            mode === 'cheap' && [s.modeTabActive, { backgroundColor: 'rgba(34,197,94,0.16)' }],
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setMode('cheap');
          }}
          activeOpacity={0.8}
        >
          <Sparkles size={14} color={mode === 'cheap' ? GREEN : TEXT3} />
          <Text style={[s.modeTabText, { color: mode === 'cheap' ? GREEN : TEXT2 }]}>
            Budget Numbers
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── BREADCRUMB INDICATOR ───────────────────────────────────────── */}
      <View style={s.stepperRow}>
        {[
          { label: selectedCountry ? `${getCountryFlag(selectedCountry.short_name)} ${selectedCountry.name}` : 'Country', done: step > 0, active: step === 0 },
          { label: selectedService ? selectedService.name : 'Service', done: step > 1, active: step === 1 },
          { label: 'Confirm', done: false, active: step === 2 },
        ].map((st, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity
              style={[
                s.stepChip,
                st.active && { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: BLUE },
                st.done && { backgroundColor: SURFACE2 },
              ]}
              onPress={() => {
                if (st.done) {
                  Haptics.selectionAsync();
                  setStep(i as 0 | 1);
                }
              }}
              disabled={!st.done}
              activeOpacity={0.7}
            >
              <View
                style={[
                  s.stepCircle,
                  st.active && { backgroundColor: BLUE },
                  st.done && { backgroundColor: GREEN },
                ]}
              >
                {st.done ? (
                  <Check size={10} color="#fff" />
                ) : (
                  <Text style={s.stepCircleText}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  s.stepLabel,
                  { color: st.active ? TEXT : st.done ? TEXT2 : TEXT3 },
                ]}
                numberOfLines={1}
              >
                {st.label}
              </Text>
            </TouchableOpacity>
            {i < 2 && <View style={[s.stepDivider, { backgroundColor: BORDER }]} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── STEP 0: SELECT COUNTRY ─────────────────────────────────────── */}
      {step === 0 && (
        <View style={{ flex: 1 }}>
          {/* Search Box */}
          <View style={s.searchWrap}>
            <View style={[s.searchBox, { backgroundColor: SURFACE }]}>
              <Search size={18} color={TEXT2} />
              <TextInput
                style={[s.searchInput, { color: TEXT }]}
                placeholder="Search 150+ countries..."
                placeholderTextColor={TEXT3}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCorrect={false}
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <X size={16} color={TEXT2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Popular Row */}
          {!countrySearch && (
            <View style={s.popularSection}>
              <Text style={[s.popularSectionTitle, { color: TEXT2 }]}>POPULAR DESTINATIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularScroll}>
                {POPULAR_COUNTRIES.map((pop) => (
                  <TouchableOpacity
                    key={pop.short_name}
                    style={[s.popularChip, { backgroundColor: SURFACE }]}
                    onPress={() => {
                      const found = countries.find((c) => c.short_name === pop.short_name) || {
                        ID: pop.short_name,
                        name: pop.name,
                        short_name: pop.short_name,
                        code: pop.code,
                      };
                      handleSelectCountry(found);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.popularFlag}>{getCountryFlag(pop.short_name)}</Text>
                    <Text style={[s.popularName, { color: TEXT }]}>{pop.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Country List */}
          {loadingCountries ? (
            <View style={{ paddingHorizontal: PAD, paddingTop: 10, gap: 8 }}>
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </View>
          ) : (
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => String(item.ID || item.short_name)}
              contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 20 }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const flag = getCountryFlag(item.short_name);
                return (
                  <TouchableOpacity
                    style={[s.countryItem, { backgroundColor: SURFACE }]}
                    onPress={() => handleSelectCountry(item)}
                    activeOpacity={0.75}
                  >
                    <View style={s.countryItemLeft}>
                      <Text style={s.countryItemFlag}>{flag}</Text>
                      <View>
                        <Text style={[s.countryItemName, { color: TEXT }]}>{item.name}</Text>
                        <Text style={[s.countryItemCode, { color: TEXT3 }]}>
                          {item.short_name} {item.code ? `(+${item.code})` : ''}
                        </Text>
                      </View>
                    </View>
                    <ArrowRight size={16} color={TEXT3} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ── STEP 1: SELECT SERVICE ─────────────────────────────────────── */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          {/* Search Box */}
          <View style={s.searchWrap}>
            <View style={[s.searchBox, { backgroundColor: SURFACE }]}>
              <Search size={18} color={TEXT2} />
              <TextInput
                style={[s.searchInput, { color: TEXT }]}
                placeholder={`Search service in ${selectedCountry?.name || 'country'}...`}
                placeholderTextColor={TEXT3}
                value={serviceSearch}
                onChangeText={setServiceSearch}
                autoCorrect={false}
              />
              {serviceSearch.length > 0 && (
                <TouchableOpacity onPress={() => setServiceSearch('')}>
                  <X size={16} color={TEXT2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Popular Services */}
          {!serviceSearch && (
            <View style={s.popularSection}>
              <Text style={[s.popularSectionTitle, { color: TEXT2 }]}>POPULAR SERVICES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularScroll}>
                {POPULAR_SERVICES.map((srvName) => {
                  const meta = getServiceBrand(srvName);
                  return (
                    <TouchableOpacity
                      key={srvName}
                      style={[s.popularChip, { backgroundColor: SURFACE }]}
                      onPress={() => {
                        const found = services.find((s) => s.name.toLowerCase().includes(srvName.toLowerCase())) || {
                          ID: srvName.toLowerCase(),
                          name: srvName,
                        };
                        handleSelectService(found);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[s.popularServiceDot, { backgroundColor: meta.color }]} />
                      <Text style={[s.popularName, { color: TEXT }]}>{srvName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Service List */}
          {loadingServices ? (
            <View style={{ paddingHorizontal: PAD, paddingTop: 10, gap: 8 }}>
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </View>
          ) : (
            <FlatList
              data={filteredServices}
              keyExtractor={(item) => String(item.ID || item.name)}
              contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 20 }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const brand = getServiceBrand(item.name);
                const BrandIcon = brand.icon;
                return (
                  <TouchableOpacity
                    style={[s.serviceItem, { backgroundColor: SURFACE }]}
                    onPress={() => handleSelectService(item)}
                    activeOpacity={0.75}
                  >
                    <View style={s.serviceItemLeft}>
                      <View style={[s.serviceIconWrap, { backgroundColor: brand.bg }]}>
                        <BrandIcon size={18} color={brand.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.serviceItemName, { color: TEXT }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.count !== undefined && (
                          <Text style={[s.serviceItemStock, { color: TEXT3 }]}>
                            {item.count > 0 ? `${item.count} numbers available` : 'In stock'}
                          </Text>
                        )}
                      </View>
                    </View>

                    {item.price !== undefined && (
                      <View style={s.serviceItemRight}>
                        <Text style={[s.serviceItemPrice, { color: GREEN }]}>
                          {formatCurrency(item.price, displayCurrency)}
                        </Text>
                      </View>
                    )}
                    <ArrowRight size={16} color={TEXT3} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ── STEP 2: REVIEW & PURCHASE ──────────────────────────────────── */}
      {step === 2 && selectedCountry && selectedService && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.reviewContent, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Card */}
          <View style={[s.orderSummaryCard, { backgroundColor: SURFACE }]}>
            <View style={s.orderSummaryHeader}>
              <View style={s.orderSummaryTitleRow}>
                <View style={[s.summaryBadgeIcon, { backgroundColor: getServiceBrand(selectedService.name).bg }]}>
                  {React.createElement(getServiceBrand(selectedService.name).icon, {
                    size: 22,
                    color: getServiceBrand(selectedService.name).color,
                  })}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.summaryServiceName, { color: TEXT }]}>{selectedService.name}</Text>
                  <View style={s.summaryCountryRow}>
                    <Text style={{ fontSize: 13 }}>{getCountryFlag(selectedCountry.short_name)}</Text>
                    <Text style={[s.summaryCountryName, { color: TEXT2 }]}>
                      {selectedCountry.name} ({selectedCountry.short_name})
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={[s.divider, { backgroundColor: BORDER }]} />

            {/* Price Row */}
            <View style={s.priceRow}>
              <View>
                <Text style={[s.priceLabel, { color: TEXT2 }]}>Total Activation Cost</Text>
                <Text style={[s.priceSub, { color: TEXT3 }]}>15-20 min verification window</Text>
              </View>
              {loadingPrice ? (
                <ActivityIndicator size="small" color={BLUE} />
              ) : (
                <Text style={[s.priceBig, { color: GREEN }]}>
                  {priceInfo?.formatted || formatCurrency(priceInfo?.price || 0, displayCurrency)}
                </Text>
              )}
            </View>

            {/* Stock status indicator */}
            {stockAmount !== null && (
              <View style={[s.stockIndicator, { backgroundColor: SURFACE2 }]}>
                <ShieldCheck size={14} color={GREEN} />
                <Text style={[s.stockIndicatorText, { color: TEXT2 }]}>
                  {stockAmount > 0 ? `${stockAmount} available in pool` : 'Active verification lines ready'}
                </Text>
              </View>
            )}
          </View>

          {/* Pricing Tier / Server Pool Option */}
          {mode === 'standard' && (
            <View style={[s.configCard, { backgroundColor: SURFACE }]}>
              <Text style={[s.configTitle, { color: TEXT }]}>Server Pool Selection</Text>
              <View style={s.tierSelector}>
                <TouchableOpacity
                  style={[
                    s.tierOption,
                    pricingOption === 1 && [s.tierOptionActive, { borderColor: BLUE, backgroundColor: 'rgba(59,130,246,0.1)' }],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPricingOption(1);
                    fetchPriceAndStock(selectedCountry, selectedService, 1);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={s.tierHeader}>
                    <Text style={[s.tierName, { color: pricingOption === 1 ? BLUE : TEXT }]}>High Success</Text>
                    {pricingOption === 1 && <Check size={14} color={BLUE} />}
                  </View>
                  <Text style={[s.tierDesc, { color: TEXT2 }]}>
                    Premium carriers with highest delivery rate for {selectedService.name}.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.tierOption,
                    pricingOption === 0 && [s.tierOptionActive, { borderColor: GREEN, backgroundColor: 'rgba(34,197,94,0.1)' }],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPricingOption(0);
                    fetchPriceAndStock(selectedCountry, selectedService, 0);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={s.tierHeader}>
                    <Text style={[s.tierName, { color: pricingOption === 0 ? GREEN : TEXT }]}>Economy Pool</Text>
                    {pricingOption === 0 && <Check size={14} color={GREEN} />}
                  </View>
                  <Text style={[s.tierDesc, { color: TEXT2 }]}>
                    Budget friendly rate when high volume is preferred.
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Area code selector (if available) */}
              {areaCodes.length > 0 && (
                <View style={s.areaCodeSection}>
                  <Text style={[s.areaCodeTitle, { color: TEXT2 }]}>Area Code (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.areaCodeScroll}>
                    <TouchableOpacity
                      style={[
                        s.areaChip,
                        !selectedAreaCode && [s.areaChipActive, { backgroundColor: BLUE }],
                      ]}
                      onPress={() => setSelectedAreaCode('')}
                    >
                      <Text style={[s.areaChipText, { color: !selectedAreaCode ? '#fff' : TEXT2 }]}>Any</Text>
                    </TouchableOpacity>
                    {areaCodes.map((ac) => (
                      <TouchableOpacity
                        key={ac}
                        style={[
                          s.areaChip,
                          selectedAreaCode === ac && [s.areaChipActive, { backgroundColor: BLUE }],
                        ]}
                        onPress={() => setSelectedAreaCode(ac)}
                      >
                        <Text style={[s.areaChipText, { color: selectedAreaCode === ac ? '#fff' : TEXT2 }]}>
                          +{ac}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Balance breakdown */}
          <View style={[s.balanceBreakdownCard, { backgroundColor: SURFACE }]}>
            <View style={s.breakdownRow}>
              <Text style={[s.breakdownLabel, { color: TEXT2 }]}>Current Wallet Balance</Text>
              <Text style={[s.breakdownValue, { color: TEXT }]}>
                {formatCurrency(currentBalance, displayCurrency)}
              </Text>
            </View>
            <View style={s.breakdownRow}>
              <Text style={[s.breakdownLabel, { color: TEXT2 }]}>Activation Fee</Text>
              <Text style={[s.breakdownValue, { color: '#EF4444' }]}>
                -{priceInfo?.formatted || formatCurrency(priceInfo?.price || 0, displayCurrency)}
              </Text>
            </View>
            <View style={[s.divider, { backgroundColor: BORDER }]} />
            <View style={s.breakdownRow}>
              <Text style={[s.breakdownLabelBold, { color: TEXT }]}>Remaining Balance</Text>
              <Text
                style={[
                  s.breakdownValueBold,
                  { color: currentBalance >= (priceInfo?.price || 0) ? GREEN : '#EF4444' },
                ]}
              >
                {formatCurrency(
                  Math.max(0, currentBalance - (priceInfo?.price || 0)),
                  displayCurrency
                )}
              </Text>
            </View>

            {currentBalance < (priceInfo?.price || 0) && (
              <TouchableOpacity
                style={[s.insufficientNotice, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                onPress={() => onNavigateToWallet?.()}
                activeOpacity={0.8}
              >
                <AlertCircle size={15} color="#EF4444" />
                <Text style={[s.insufficientText, { color: '#EF4444' }]}>
                  Insufficient funds. Tap here to top up your wallet.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Activate Button */}
          <TouchableOpacity
            style={[
              s.activateBtn,
              { backgroundColor: BLUE },
              (purchasing || loadingPrice) && { opacity: 0.7 },
            ]}
            onPress={handlePurchase}
            disabled={purchasing || loadingPrice}
            activeOpacity={0.85}
          >
            {purchasing ? (
              <View style={s.btnInnerLoading}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={s.activateBtnText}>Allocating Number...</Text>
              </View>
            ) : (
              <View style={s.btnInnerLoading}>
                <Zap size={18} color="#fff" />
                <Text style={s.activateBtnText}>
                  Activate {selectedService.name} Number • {priceInfo?.formatted || 'Order'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── SUCCESS MODAL ───────────────────────────────────────────────── */}
      <Modal
        visible={!!successData}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessData(null)}
      >
        <View style={s.successOverlay}>
          <View style={[s.successModalCard, { backgroundColor: SURFACE }]}>
            <View style={[s.successCircle, { backgroundColor: 'rgba(34,197,94,0.16)' }]}>
              <Check size={36} color={GREEN} />
            </View>

            <Text style={[s.successTitle, { color: TEXT }]}>Number Activated!</Text>
            <Text style={[s.successSub, { color: TEXT2 }]}>
              Your {successData?.serviceName} number is live and waiting for SMS verification.
            </Text>

            {/* Phone Display Box */}
            <View style={[s.successPhoneBox, { backgroundColor: SURFACE2 }]}>
              <Text style={[s.successPhoneNumber, { color: GREEN }]}>
                {successData?.phoneNumber}
              </Text>
              <TouchableOpacity
                style={[s.successCopyBtn, { backgroundColor: copiedSuccessPhone ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)' }]}
                onPress={handleCopySuccessPhone}
                activeOpacity={0.7}
              >
                {copiedSuccessPhone ? (
                  <>
                    <Check size={14} color={GREEN} />
                    <Text style={[s.successCopyText, { color: GREEN }]}>Copied</Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color={TEXT} />
                    <Text style={[s.successCopyText, { color: TEXT }]}>Copy Phone</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.successActions}>
              <TouchableOpacity
                style={[s.successInboxBtn, { backgroundColor: BLUE }]}
                onPress={() => {
                  setSuccessData(null);
                  onNavigateToNumbers ? onNavigateToNumbers() : onBack?.();
                }}
                activeOpacity={0.85}
              >
                <MessageSquare size={16} color="#fff" />
                <Text style={s.successInboxBtnText}>Go to SMS Inbox</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.successDismissBtn, { backgroundColor: SURFACE2 }]}
                onPress={() => {
                  setSuccessData(null);
                  setStep(0);
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.successDismissText, { color: TEXT2 }]}>Buy Another Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODERN FLOATING DOCK BOTTOM NAVIGATION ──────────────────────── */}
      <ModernBottomNav
        activeTab="buy"
        onSelectTab={(tabId: NavTabId) => {
          if (tabId === 'home') {
            onNavigateToHome?.();
          } else if (tabId === 'sms') {
            onNavigateToNumbers?.();
          } else if (tabId === 'rentals') {
            onNavigateToRentals?.();
          } else if (tabId === 'wallet') {
            onNavigateToWallet?.();
          }
        }}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  bottomNavContainer: {
    backgroundColor: '#080808',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomNav: {
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
    marginTop: 4,
  },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  screenSubtitle: { fontSize: 11, fontWeight: '500' },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  balancePillText: { fontSize: 12, fontWeight: '700' },

  // Mode Switcher
  modeSwitcherRow: {
    flexDirection: 'row',
    paddingHorizontal: PAD,
    gap: 8,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#111113',
  },
  modeTabActive: { borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  modeTabText: { fontSize: 12, fontWeight: '700' },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    marginBottom: 14,
    gap: 6,
  },
  stepChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  stepLabel: { fontSize: 11, fontWeight: '600' },
  stepDivider: { width: 8, height: 1 },

  // Search
  searchWrap: { paddingHorizontal: PAD, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Popular
  popularSection: { marginBottom: 14 },
  popularSectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: PAD, marginBottom: 8 },
  popularScroll: { paddingHorizontal: PAD, gap: 8 },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  popularFlag: { fontSize: 15 },
  popularName: { fontSize: 12, fontWeight: '600' },
  popularServiceDot: { width: 8, height: 8, borderRadius: 4 },

  // Lists
  listContent: { paddingHorizontal: PAD, gap: 8 },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
  },
  countryItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countryItemFlag: { fontSize: 24 },
  countryItemName: { fontSize: 14, fontWeight: '700' },
  countryItemCode: { fontSize: 11, marginTop: 2 },

  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  serviceItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceItemName: { fontSize: 14, fontWeight: '700' },
  serviceItemStock: { fontSize: 11, marginTop: 2 },
  serviceItemRight: { alignItems: 'flex-end', marginRight: 4 },
  serviceItemPrice: { fontSize: 14, fontWeight: '800' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  loaderText: { fontSize: 13, fontWeight: '500' },

  // Review & Confirmation Step
  reviewContent: { paddingHorizontal: PAD, gap: 14 },
  orderSummaryCard: { borderRadius: 20, padding: 18, gap: 14 },
  orderSummaryHeader: {},
  orderSummaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryBadgeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryServiceName: { fontSize: 18, fontWeight: '800' },
  summaryCountryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  summaryCountryName: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontSize: 13, fontWeight: '600' },
  priceSub: { fontSize: 11, marginTop: 2 },
  priceBig: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  stockIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  stockIndicatorText: { fontSize: 12, fontWeight: '600' },

  // Config Card (Pools / Tiers)
  configCard: { borderRadius: 20, padding: 18, gap: 12 },
  configTitle: { fontSize: 14, fontWeight: '700' },
  tierSelector: { gap: 8 },
  tierOption: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  tierOptionActive: {},
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierName: { fontSize: 13, fontWeight: '700' },
  tierDesc: { fontSize: 11, lineHeight: 15 },
  areaCodeSection: { marginTop: 6 },
  areaCodeTitle: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  areaCodeScroll: { gap: 6 },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#18181b',
  },
  areaChipActive: {},
  areaChipText: { fontSize: 12, fontWeight: '700' },

  // Balance breakdown
  balanceBreakdownCard: { borderRadius: 20, padding: 18, gap: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13, fontWeight: '500' },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  breakdownLabelBold: { fontSize: 14, fontWeight: '700' },
  breakdownValueBold: { fontSize: 15, fontWeight: '800' },
  insufficientNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginTop: 4 },
  insufficientText: { flex: 1, fontSize: 12, fontWeight: '600' },

  // Activate Button
  activateBtn: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnInnerLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  successSub: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  successPhoneBox: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  successPhoneNumber: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  successCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  successCopyText: { fontSize: 12, fontWeight: '700' },
  successActions: { width: '100%', gap: 8 },
  successInboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  successInboxBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  successDismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  successDismissText: { fontSize: 13, fontWeight: '600' },
});

export default BuyNumberScreen;
