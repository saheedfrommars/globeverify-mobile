import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { useAppSettings } from '../../context/WalletSettingsContext';

export type EmptyIllustrationType = 'numbers' | 'transactions' | 'spending' | 'rentals';

interface AnimatedEmptyStateProps {
  type: EmptyIllustrationType;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPressAction?: () => void;
  onAction?: () => void;
  compact?: boolean;
}

export const AnimatedEmptyState: React.FC<AnimatedEmptyStateProps> = ({
  type,
  title,
  subtitle,
  actionLabel,
  onPressAction,
  onAction,
  compact = false,
}) => {
  const handleAction = onPressAction || onAction;
  const { colors, triggerHaptic } = useAppSettings();

  // Gentle floating + pulse animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.88)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.88,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim, fadeIn]);

  const primaryStroke = colors.primary;
  const accentStroke = colors.accent;
  const cardFill = colors.isDark ? '#1A1B23' : '#EFF6FF';
  const subFill = colors.isDark ? '#252733' : '#DBEAFE';

  const renderSvgIllustration = () => {
    if (type === 'numbers') {
      return (
        <Svg width={compact ? 84 : 104} height={compact ? 84 : 104} viewBox="0 0 110 110">
          <Defs>
            <LinearGradient id="phoneGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={primaryStroke} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={accentStroke} stopOpacity="0.08" />
            </LinearGradient>
          </Defs>
          {/* Soft ambient halo */}
          <Circle cx="55" cy="56" r="42" fill="url(#phoneGrad)" />
          {/* Smartphone body */}
          <Rect
            x="35"
            y="22"
            width="40"
            height="68"
            rx="10"
            fill={cardFill}
            stroke={primaryStroke}
            strokeWidth="2.2"
          />
          {/* Speaker notch */}
          <Rect x="49" y="28" width="12" height="3" rx="1.5" fill={primaryStroke} opacity={0.5} />
          {/* Screen placeholder lines */}
          <Rect x="42" y="40" width="18" height="4" rx="2" fill={subFill} />
          <Rect x="42" y="48" width="26" height="4" rx="2" fill={subFill} />
          {/* Floating OTP Verification Badge */}
          <G transform="translate(52, 54)">
            <Rect
              x="0"
              y="0"
              width="38"
              height="22"
              rx="7"
              fill={primaryStroke}
            />
            <Circle cx="9" cy="11" r="2.2" fill="#FFFFFF" />
            <Circle cx="19" cy="11" r="2.2" fill="#FFFFFF" />
            <Circle cx="29" cy="11" r="2.2" fill="#FFFFFF" />
          </G>
          {/* Decorative sparkles */}
          <Circle cx="24" cy="36" r="3" fill={accentStroke} opacity={0.65} />
          <Circle cx="86" cy="34" r="2.5" fill={primaryStroke} opacity={0.65} />
        </Svg>
      );
    }

    if (type === 'transactions') {
      return (
        <Svg width={compact ? 84 : 104} height={compact ? 84 : 104} viewBox="0 0 110 110">
          <Defs>
            <LinearGradient id="txGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#10B981" stopOpacity="0.16" />
              <Stop offset="100%" stopColor={primaryStroke} stopOpacity="0.08" />
            </LinearGradient>
          </Defs>
          <Circle cx="55" cy="56" r="42" fill="url(#txGrad)" />
          {/* Receipt / Ledger Sheet */}
          <Rect
            x="31"
            y="25"
            width="48"
            height="60"
            rx="10"
            fill={cardFill}
            stroke={primaryStroke}
            strokeWidth="2.2"
          />
          <Rect x="40" y="38" width="20" height="4.5" rx="2.2" fill={primaryStroke} opacity={0.8} />
          <Rect x="40" y="49" width="30" height="4" rx="2" fill={subFill} />
          <Rect x="40" y="59" width="24" height="4" rx="2" fill={subFill} />
          <Rect x="40" y="69" width="16" height="4" rx="2" fill={subFill} />
          {/* Floating Emerald Coin */}
          <Circle cx="76" cy="72" r="13" fill="#10B981" />
          <Path
            d="M72 72.5L75 75.5L81 69.5"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    }

    if (type === 'spending') {
      return (
        <Svg width={compact ? 78 : 96} height={compact ? 78 : 96} viewBox="0 0 110 110">
          <Defs>
            <LinearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={accentStroke} stopOpacity="0.16" />
              <Stop offset="100%" stopColor={primaryStroke} stopOpacity="0.06" />
            </LinearGradient>
          </Defs>
          <Circle cx="55" cy="56" r="40" fill="url(#chartGrad)" />
          {/* Analytics Bars */}
          <Rect x="32" y="60" width="10" height="20" rx="4" fill={subFill} />
          <Rect x="49" y="46" width="10" height="34" rx="4" fill={primaryStroke} opacity={0.45} />
          <Rect x="66" y="34" width="10" height="46" rx="4" fill={primaryStroke} />
          {/* Trend curve */}
          <Path
            d="M32 52 Q 49 38, 72 26"
            stroke={accentStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx="72" cy="26" r="4" fill={accentStroke} />
        </Svg>
      );
    }

    // Default: 'rentals'
    return (
      <Svg width={compact ? 84 : 104} height={compact ? 84 : 104} viewBox="0 0 110 110">
        <Circle cx="55" cy="56" r="42" fill={cardFill} />
        {/* SIM Card & Clock */}
        <Rect
          x="33"
          y="28"
          width="44"
          height="54"
          rx="9"
          fill={subFill}
          stroke={primaryStroke}
          strokeWidth="2.2"
        />
        <Rect
          x="43"
          y="46"
          width="24"
          height="20"
          rx="4"
          fill="none"
          stroke={primaryStroke}
          strokeWidth="1.8"
        />
        <Circle cx="75" cy="73" r="13" fill={accentStroke} />
        <Path
          d="M75 67V73L79 75"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        compact && { paddingVertical: 20 },
        { opacity: fadeIn },
      ]}
    >
      <Animated.View
        style={{
          transform: [{ translateY: floatAnim }, { scale: pulseAnim }],
          marginBottom: compact ? 8 : 12,
        }}
      >
        {renderSvgIllustration()}
      </Animated.View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

      {actionLabel && handleAction && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            triggerHaptic('light');
            handleAction();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 22,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
