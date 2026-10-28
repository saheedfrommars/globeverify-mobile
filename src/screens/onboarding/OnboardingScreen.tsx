import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ShieldCheck,
  Smartphone,
  PhoneCall,
  Wifi,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Lock,
  Zap,
  Globe,
  Copy,
  Clock,
  Sparkles,
  ChevronRight,
  Shield,
  Radio,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Logo } from '../../components/ui/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  category: string;
  categoryColor: string;
  title: string;
  titleHighlight: string;
  description: string;
  type: 'sms' | 'rentals' | 'esim' | 'wallet';
  metric: {
    label: string;
    value: string;
  };
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    category: 'VERIFICATION INFRASTRUCTURE',
    categoryColor: '#2563EB',
    title: 'Instant SMS Codes for',
    titleHighlight: '150+ Global Platforms',
    description:
      'Activate WhatsApp, Telegram, Google, OpenAI, Tinder, and banking services with carrier-grade Non-VoIP and high-speed temporary virtual numbers.',
    type: 'sms',
    metric: {
      label: 'Average SMS Arrival',
      value: '< 2.4s',
    },
  },
  {
    id: '2',
    category: 'LONG-TERM DEDICATED LINES',
    categoryColor: '#059669',
    title: 'Keep Private Dedicated',
    titleHighlight: 'Numbers & WebRTC Voice',
    description:
      'Retain dedicated lines for months. Unlike single-use numbers, rental numbers receive any OTP from any platform plus inbound & outbound voice calls.',
    type: 'rentals',
    metric: {
      label: 'Supported Line Retentions',
      value: 'Up to 365 Days',
    },
  },
  {
    id: '3',
    category: 'GLOBAL ROAMING FREEDOM',
    categoryColor: '#0284C7',
    title: 'High-Speed Mobile eSIM',
    titleHighlight: 'Across 85+ Countries',
    description:
      'Install digital cellular eSIM profiles instantly via QR code. Enjoy high-speed 5G & LTE data without roaming fees or changing your primary SIM.',
    type: 'esim',
    metric: {
      label: 'Network Speeds',
      value: '5G / LTE Uncapped',
    },
  },
  {
    id: '4',
    category: 'ENTERPRISE BILLING & APIS',
    categoryColor: '#7C3AED',
    title: 'Dual Currency Wallets',
    titleHighlight: 'Naira (₦) & Dollars ($)',
    description:
      'Fund with instant Nigerian bank transfers, cards, or crypto. Programmatically automate orders with our REST API and earn 10% affiliate rewards.',
    type: 'wallet',
    metric: {
      label: 'Automated Routing',
      value: '99.98% Uptime',
    },
  },
];

export interface OnboardingScreenProps {
  onComplete?: (action: 'register' | 'login') => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
        setCurrentIndex(index);
        Haptics.selectionAsync();
      }
    },
    [currentIndex]
  );

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleFinish('register');
    }
  };

  const handleFinish = (action: 'register' | 'login') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onComplete) {
      onComplete(action);
    }
  };

  /**
   * Executive Interactive Mockup Card for each slide.
   * Gives users a concrete, high-end visualization of the product features.
   */
  const renderVisualShowcase = (type: OnboardingSlide['type']) => {
    switch (type) {
      case 'sms':
        return (
          <View style={[styles.showcaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Top Bar of the Mockup */}
            <View style={styles.mockupHeader}>
              <View style={styles.mockupAppBadge}>
                <View style={[styles.appDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.mockupAppTitle, { color: colors.text }]}>WhatsApp Verification</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: isDark ? '#052E16' : '#DCFCE7' }]}>
                <Zap size={11} color="#16A34A" />
                <Text style={styles.statusChipText}>Delivered (1.4s)</Text>
              </View>
            </View>

            {/* Virtual Number info */}
            <View style={[styles.numberRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.flagNumberWrap}>
                <Text style={styles.flagEmoji}>🇺🇸</Text>
                <View>
                  <Text style={[styles.numberSub, { color: colors.textSecondary }]}>US Non-VoIP Private Line</Text>
                  <Text style={[styles.numberValue, { color: colors.text }]}>+1 (646) 885-0219</Text>
                </View>
              </View>
              <View style={[styles.badgeLive, { backgroundColor: '#2563EB15' }]}>
                <Radio size={12} color="#2563EB" />
                <Text style={styles.badgeLiveText}>ONLINE</Text>
              </View>
            </View>

            {/* Incoming OTP Bubble */}
            <View style={[styles.otpBubble, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: colors.border }]}>
              <View style={styles.otpHeader}>
                <Text style={[styles.otpSender, { color: colors.text }]}>WhatsApp Code</Text>
                <Text style={[styles.otpTime, { color: colors.textTertiary }]}>Just now</Text>
              </View>
              <View style={styles.codeRow}>
                <Text style={[styles.otpCodeNumber, { color: colors.primary }]}>849 - 120</Text>
                <View style={[styles.copyPill, { backgroundColor: colors.primary }]}>
                  <Copy size={11} color="#FFFFFF" />
                  <Text style={styles.copyPillText}>Auto-Copied</Text>
                </View>
              </View>
              <Text style={[styles.otpNotice, { color: colors.textSecondary }]}>
                Valid for 15 mins. Automatic wallet refund if not delivered.
              </Text>
            </View>
          </View>
        );

      case 'rentals':
        return (
          <View style={[styles.showcaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Dedicated Line Card */}
            <View style={styles.mockupHeader}>
              <View style={styles.mockupAppBadge}>
                <View style={[styles.appDot, { backgroundColor: '#059669' }]} />
                <Text style={[styles.mockupAppTitle, { color: colors.text }]}>Dedicated Rental Line</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                <Clock size={11} color="#059669" />
                <Text style={[styles.statusChipText, { color: '#059669' }]}>30 Days Active</Text>
              </View>
            </View>

            <View style={[styles.numberRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.flagNumberWrap}>
                <Text style={styles.flagEmoji}>🇬🇧</Text>
                <View>
                  <Text style={[styles.numberSub, { color: colors.textSecondary }]}>London Dedicated Business</Text>
                  <Text style={[styles.numberValue, { color: colors.text }]}>+44 7911 123456</Text>
                </View>
              </View>
              <View style={[styles.badgeLive, { backgroundColor: '#05966915' }]}>
                <CheckCircle2 size={12} color="#059669" />
                <Text style={[styles.badgeLiveText, { color: '#059669' }]}>RESERVED</Text>
              </View>
            </View>

            {/* Feature Pills Grid */}
            <View style={styles.featurePillsRow}>
              <View style={[styles.featurePillItem, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <ShieldCheck size={14} color="#059669" />
                <Text style={[styles.featurePillText, { color: colors.text }]}>Receives Any OTP</Text>
              </View>
              <View style={[styles.featurePillItem, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <PhoneCall size={14} color="#2563EB" />
                <Text style={[styles.featurePillText, { color: colors.text }]}>WebRTC Voice Calling</Text>
              </View>
            </View>

            <View style={[styles.rentalSubTextWrap, { borderTopColor: colors.border }]}>
              <Text style={[styles.rentalSubText, { color: colors.textSecondary }]}>
                Exclusive private ownership • Auto-renewable anytime
              </Text>
            </View>
          </View>
        );

      case 'esim':
        return (
          <View style={[styles.showcaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* eSIM Digital Profile Card */}
            <View style={styles.mockupHeader}>
              <View style={styles.mockupAppBadge}>
                <Wifi size={16} color="#0284C7" />
                <Text style={[styles.mockupAppTitle, { color: colors.text }]}>Global Roaming eSIM</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: isDark ? '#082F49' : '#E0F2FE' }]}>
                <Text style={[styles.statusChipText, { color: '#0284C7' }]}>5G / LTE Roaming</Text>
              </View>
            </View>

            {/* Plan Info */}
            <View style={[styles.planInfoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: colors.text }]}>Europe & North America 10GB</Text>
                <Text style={[styles.planValidity, { color: colors.primary }]}>30 Days</Text>
              </View>
              {/* Data bar */}
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBar, { width: '85%', backgroundColor: '#0284C7' }]} />
              </View>
              <View style={styles.planMetricsRow}>
                <Text style={[styles.planMetricText, { color: colors.textSecondary }]}>8.5 GB remaining of 10 GB</Text>
                <Text style={[styles.planMetricSub, { color: colors.textTertiary }]}>Uncapped Speed</Text>
              </View>
            </View>

            {/* Advantage Badges */}
            <View style={styles.esimTagsRow}>
              <View style={[styles.esimTag, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <CheckCircle2 size={12} color="#0284C7" />
                <Text style={[styles.esimTagText, { color: colors.text }]}>Zero Physical SIM Needed</Text>
              </View>
              <View style={[styles.esimTag, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <CheckCircle2 size={12} color="#0284C7" />
                <Text style={[styles.esimTagText, { color: colors.text }]}>Instant QR Install</Text>
              </View>
            </View>
          </View>
        );

      case 'wallet':
        return (
          <View style={[styles.showcaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Dual Wallet Display */}
            <View style={styles.mockupHeader}>
              <View style={styles.mockupAppBadge}>
                <CreditCard size={16} color="#7C3AED" />
                <Text style={[styles.mockupAppTitle, { color: colors.text }]}>Dual Currency Wallet</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }]}>
                <Text style={[styles.statusChipText, { color: '#7C3AED' }]}>Instant Settlement</Text>
              </View>
            </View>

            {/* Wallet Balances Dual Cards */}
            <View style={styles.walletSplitRow}>
              <View style={[styles.walletPillCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.walletCurrencyLabel, { color: colors.textSecondary }]}>NIGERIAN NAIRA</Text>
                <Text style={[styles.walletBalanceAmount, { color: colors.text }]}>₦150,000</Text>
                <Text style={[styles.walletFundingNote, { color: '#16A34A' }]}>Instant Virtual Account</Text>
              </View>

              <View style={[styles.walletPillCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.walletCurrencyLabel, { color: colors.textSecondary }]}>US DOLLAR (USD)</Text>
                <Text style={[styles.walletBalanceAmount, { color: colors.text }]}>$250.00</Text>
                <Text style={[styles.walletFundingNote, { color: colors.primary }]}>Cards & Crypto (USDT)</Text>
              </View>
            </View>

            {/* Developer / Affiliate Bar */}
            <View style={[styles.devAffiliateBar, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              <Sparkles size={14} color="#7C3AED" />
              <Text style={[styles.devAffiliateText, { color: colors.text }]}>
                REST API Webhooks • 10% Lifetime Affiliate Commissions
              </Text>
            </View>
          </View>
        );
    }
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    return (
      <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
        {/* Interactive Visual Showcase */}
        <View style={styles.showcaseWrapper}>
          {renderVisualShowcase(item.type)}
        </View>

        {/* Text Section */}
        <View style={styles.textContainer}>
          {/* Category Chip */}
          <View style={[styles.categoryPill, { backgroundColor: item.categoryColor + '15', borderColor: item.categoryColor + '30' }]}>
            <View style={[styles.categoryDot, { backgroundColor: item.categoryColor }]} />
            <Text style={[styles.categoryText, { color: item.categoryColor }]}>
              {item.category}
            </Text>
          </View>

          {/* Headline */}
          <Text style={[styles.headlineText, { color: colors.text }]}>
            {item.title}{' '}
            <Text style={{ color: item.categoryColor }}>{item.titleHighlight}</Text>
          </Text>

          {/* Description */}
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {item.description}
          </Text>

          {/* Performance metric badge */}
          <View style={[styles.metricPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>{item.metric.label}:</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{item.metric.value}</Text>
          </View>
        </View>
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      {/* ── Top Executive Header ── */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <Logo size={36} />
          <View style={styles.brandTextWrap}>
            <Text style={[styles.brandName, { color: colors.text }]}>GlobeVerify</Text>
            <Text style={[styles.brandTagline, { color: colors.textTertiary }]}>Telecom Infrastructure</Text>
          </View>
        </View>

        {!isLastSlide ? (
          <TouchableOpacity
            onPress={() => handleFinish('login')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.skipButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* ── Slides Carousel ── */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
        style={styles.carousel}
      />

      {/* ── Bottom Controls ── */}
      <View style={styles.bottomControls}>
        {/* Dynamic Segmented Progress Indicator */}
        <View style={styles.progressIndicatorsRow}>
          {SLIDES.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.progressIndicator,
                  {
                    backgroundColor: isActive ? colors.primary : (isDark ? '#262626' : '#E2E8F0'),
                    width: isActive ? 32 : 8,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsGroup}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.buttonPrimaryBg }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryActionBtnText, { color: colors.buttonPrimaryText }]}>
              {isLastSlide ? 'Get Started Free' : 'Continue'}
            </Text>
            <ArrowRight size={18} color={colors.buttonPrimaryText} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleFinish('login')}
            style={styles.signInLink}
            activeOpacity={0.7}
          >
            <Text style={[styles.signInText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
              <Text style={[styles.signInHighlight, { color: colors.primary }]}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Executive Trust Disclaimer */}
        <View style={styles.trustFooterRow}>
          <Shield size={12} color={colors.textTertiary} />
          <Text style={[styles.trustFooterText, { color: colors.textTertiary }]}>
            256-Bit TLS Encryption • Non-VoIP Guaranteed
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  carousel: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  showcaseWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  showcaseCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  mockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mockupAppBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockupAppTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  flagNumberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flagEmoji: {
    fontSize: 24,
  },
  numberSub: {
    fontSize: 10.5,
    fontWeight: '500',
    marginBottom: 2,
  },
  numberValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.4,
  },
  otpBubble: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  otpSender: {
    fontSize: 12,
    fontWeight: '700',
  },
  otpTime: {
    fontSize: 10.5,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  otpCodeNumber: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyPillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  otpNotice: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  featurePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  featurePillItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  featurePillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  rentalSubTextWrap: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  rentalSubText: {
    fontSize: 11,
    fontWeight: '500',
  },
  planInfoBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  planValidity: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  planMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planMetricText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  planMetricSub: {
    fontSize: 10.5,
  },
  esimTagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  esimTag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  esimTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  walletSplitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  walletPillCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  walletCurrencyLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  walletBalanceAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  walletFundingNote: {
    fontSize: 10,
    fontWeight: '600',
  },
  devAffiliateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  devAffiliateText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headlineText: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  bottomControls: {
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  progressIndicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  progressIndicator: {
    height: 6,
    borderRadius: 3,
  },
  actionsGroup: {
    width: '100%',
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signInLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  signInText: {
    fontSize: 13,
    fontWeight: '500',
  },
  signInHighlight: {
    fontWeight: '700',
  },
  trustFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  trustFooterText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
