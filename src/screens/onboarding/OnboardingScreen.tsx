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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  iosIcon: 'shield.fill' | 'phone.badge.checkmark' | 'creditcard.fill';
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    badge: 'THE MODERN VERIFICATION LAYER',
    title: 'Instant SMS Codes\nfor Any Service',
    subtitle:
      'Buy premium Non-VoIP and standard VoIP phone numbers from 150+ countries. Get instant SMS verification codes for WhatsApp, Telegram, Google, and more.',
    iosIcon: 'shield.fill',
  },
  {
    id: '2',
    badge: 'DEDICATED RENTALS',
    title: 'Keep Your Dedicated\nNumber for Months',
    subtitle:
      'Dedicated private lines for ongoing business and personal accounts. Full inbound and outbound SMS messaging with auto-renewal support.',
    iosIcon: 'phone.badge.checkmark',
  },
  {
    id: '3',
    badge: 'DUAL WALLET SYSTEM',
    title: 'Naira & Dollar\nWallets Built In',
    subtitle:
      'Seamless checkout for both Nigerian Naira (₦) and US Dollars ($). Fund your account effortlessly with instant bank transfers, cards, or crypto.',
    iosIcon: 'creditcard.fill',
  },
];

export interface OnboardingScreenProps {
  onComplete?: (action: 'register' | 'login') => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
        setCurrentIndex(index);
        if (Platform.OS === 'ios') {
          Haptics.selectionAsync();
        }
      }
    },
    [currentIndex]
  );

  const handleNext = () => {
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

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    return (
      <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
        {/* Visual Icon Card */}
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.primary,
              },
            ]}
          >
            <View
              style={[
                styles.iconInnerGlow,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Icon iosName={item.iosIcon} size={44} color={colors.primary} />
            </View>
          </View>
        </View>

        {/* Text Section matching Website Layout */}
        <View style={styles.textContainer}>
          {/* Pill Badge matching website's .pill-badge */}
          <View
            style={[
              styles.pillBadge,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.pillDot,
                { backgroundColor: colors.primary },
              ]}
            />
            <Text
              style={[
                typography.caption1,
                { color: colors.text, fontWeight: '700', letterSpacing: 0.6 },
              ]}
            >
              {item.badge}
            </Text>
          </View>

          {/* Main Title matching website's .hero-title */}
          <Text
            style={[
              typography.largeTitle,
              {
                color: colors.text,
                textAlign: 'center',
                marginTop: spacing.base,
                fontWeight: '800',
                letterSpacing: -0.6,
                lineHeight: 40,
              },
            ]}
          >
            {item.title}
          </Text>

          {/* Subtitle matching website's .hero-subtitle */}
          <Text
            style={[
              typography.callout,
              {
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: spacing.md,
                lineHeight: 24,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            {item.subtitle}
          </Text>
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
          paddingTop: Math.max(insets.top, spacing.base),
          paddingBottom: Math.max(insets.bottom, spacing.base),
        },
      ]}
    >
      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingHorizontal: spacing.xl }]}>
        <Logo size={36} />

        {!isLastSlide ? (
          <Pressable
            hitSlop={12}
            onPress={() => handleFinish('login')}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text
              style={[
                typography.subhead,
                { color: colors.textSecondary, fontWeight: '600' },
              ]}
            >
              Skip
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Paged Content */}
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
        style={styles.flatList}
      />

      {/* Bottom Controls */}
      <View style={[styles.bottomContainer, { paddingHorizontal: spacing.xl }]}>
        {/* Pagination Dots (Black in Light, White in Dark) */}
        <View style={styles.paginationRow}>
          {SLIDES.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? colors.dotActive : colors.dotInactive,
                    width: isActive ? 24 : 7,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Buttons (Black in Light Mode, White in Dark Mode) */}
        <View style={[styles.actionsColumn, { marginTop: spacing.xl }]}>
          <Button
            title={isLastSlide ? 'Get Started' : 'Continue'}
            onPress={handleNext}
            variant="brand"
            size="lg"
          />

          <Pressable
            onPress={() => handleFinish('login')}
            style={({ pressed }) => [
              styles.secondaryLink,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[
                typography.subhead,
                { color: colors.textSecondary, fontWeight: '500' },
              ]}
            >
              Already have an account?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                Sign In
              </Text>
            </Text>
          </Pressable>
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
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flatList: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconContainer: {
    marginBottom: 38,
  },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  iconInnerGlow: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    borderWidth: 1,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  bottomContainer: {
    width: '100%',
    paddingBottom: 12,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  actionsColumn: {
    width: '100%',
  },
  secondaryLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
});
