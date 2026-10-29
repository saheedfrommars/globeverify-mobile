import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Ellipse, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ArrowLeft, Shield, Moon, Sun } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { useAppSettings } from '../../context/WalletSettingsContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  onBack,
}) => {
  const { spacing, typography } = useTheme();
  const { settings, toggleTheme } = useAppSettings();
  const isDark = settings.themeMode === 'dark';
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack?.();
  };

  const themeColors = isDark
    ? {
        bg: '#0A0A0A',
        surface: '#121214',
        border: '#242730',
        text: '#FFFFFF',
        textSecondary: '#94A3B8',
        meshPrimary: '#38BDF8',
        meshOpacityHigh: 0.35,
        meshOpacityLow: 0.08,
      }
    : {
        bg: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        textSecondary: '#475569',
        meshPrimary: '#2563EB',
        meshOpacityHigh: 0.22,
        meshOpacityLow: 0.04,
      };

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Subtle Cyber Mesh Background Lines (Matches Onboarding) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}>
          <Defs>
            <LinearGradient id="authMeshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={themeColors.meshPrimary} stopOpacity={themeColors.meshOpacityHigh} />
              <Stop offset="70%" stopColor={themeColors.meshPrimary} stopOpacity={themeColors.meshOpacityLow} />
              <Stop offset="100%" stopColor={themeColors.meshPrimary} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Top-Right Wireframe Rings */}
          <G transform={`translate(${SCREEN_WIDTH * 0.85}, ${SCREEN_HEIGHT * 0.08}) rotate(-25)`}>
            <Ellipse cx="0" cy="0" rx="140" ry="60" stroke="url(#authMeshGrad)" strokeWidth="1.2" fill="none" />
            <Ellipse cx="0" cy="0" rx="115" ry="48" stroke="url(#authMeshGrad)" strokeWidth="1.0" fill="none" />
            <Ellipse cx="0" cy="0" rx="90" ry="36" stroke="url(#authMeshGrad)" strokeWidth="0.8" fill="none" />
          </G>

          {/* Sweeping subtle background wave line */}
          <Path
            d={`M -20 ${SCREEN_HEIGHT * 0.16} C ${SCREEN_WIDTH * 0.35} ${SCREEN_HEIGHT * 0.22}, ${SCREEN_WIDTH * 0.65} ${SCREEN_HEIGHT * 0.12}, ${SCREEN_WIDTH + 20} ${SCREEN_HEIGHT * 0.20}`}
            stroke="url(#authMeshGrad)"
            strokeWidth="1.2"
            fill="none"
          />
        </Svg>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 20) + 10,
              paddingBottom: Math.max(insets.bottom, 20) + 24,
              paddingHorizontal: spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top Bar: Back Button & Solid Official Logo at Top Edge ── */}
          <View style={styles.topBarRow}>
            {onBack ? (
              <TouchableOpacity
                onPress={handleBack}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[
                  styles.backBtn,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <ArrowLeft size={18} color={themeColors.text} strokeWidth={2.4} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}

            {/* Official Solid App Icon on the Top Edge */}
            <View style={[styles.solidLogoCard, { borderColor: themeColors.border }]}>
              <Image
                source={require('../../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            {/* Top-Right Theme Toggle Button */}
            <TouchableOpacity
              onPress={toggleTheme}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[
                styles.themeBtn,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              {isDark ? (
                <Sun size={17} color="#FBBF24" />
              ) : (
                <Moon size={17} color={themeColors.text} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Header Title & Subtitle ── */}
          <View style={styles.header}>
            <Text
              style={[
                styles.titleText,
                { color: themeColors.text },
              ]}
            >
              {title}
            </Text>
            {subtitle && <View style={styles.subtitleWrapper}>{subtitle}</View>}
          </View>

          {/* ── Form Fields & Content ── */}
          <View style={styles.formContent}>
            {children}
          </View>

          {/* ── Footer Trust Guarantee ── */}
          <View style={styles.footer}>
            <Shield size={13} color={themeColors.textSecondary} />
            <Text style={[typography.caption1, { color: themeColors.textSecondary, textAlign: 'center' }]}>
              GlobeVerify Telecom • 256-Bit TLS Encrypted
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  solidLogoCard: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  header: {
    marginBottom: 24,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  subtitleWrapper: {
    marginTop: 6,
  },
  formContent: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 36,
    paddingTop: 12,
  },
});
