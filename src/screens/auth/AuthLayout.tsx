import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { Logo } from '../../components/ui/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const { colors, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bgGradient = isDark
    ? (['#080d1a', '#040711', '#020307'] as const)
    : (['#edf2f7', '#f8fafc', '#ffffff'] as const);

  const glowGradient = isDark
    ? (['rgba(59, 130, 246, 0.22)', 'rgba(139, 92, 246, 0.12)', 'transparent'] as const)
    : (['rgba(37, 99, 235, 0.10)', 'rgba(124, 58, 237, 0.05)', 'transparent'] as const);

  return (
    <View style={styles.root}>
      {/* Background Deep Gradient */}
      <LinearGradient
        colors={bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Top Ambient Brand Glow */}
      <View style={styles.glowContainer} pointerEvents="none">
        <LinearGradient
          colors={glowGradient}
          style={styles.ambientGlow}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + spacing.base, 32),
              paddingBottom: Math.max(insets.bottom + spacing.xl, 40),
              paddingHorizontal: spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section — Pure transparent logo, unboxed, no circle */}
          <View style={styles.logoRow}>
            <Logo size={56} />
          </View>

          {/* Form Header — Direct on canvas, matching website .auth-header */}
          <View style={styles.header}>
            <Text
              style={[
                typography.largeTitle,
                { color: colors.text, fontWeight: '800', letterSpacing: -0.6 },
              ]}
            >
              {title}
            </Text>
            {subtitle && <View style={styles.subtitleWrapper}>{subtitle}</View>}
          </View>

          {/* Form Fields & Interactive Controls — Direct flow with no card wrapping */}
          <View style={styles.formContent}>
            {children}
          </View>

          {/* Footer Security Guarantee */}
          <View style={styles.footer}>
            <Text style={[typography.caption1, { color: colors.textTertiary, textAlign: 'center' }]}>
              © 2025 GlobeVerify Inc. • Private & Encrypted
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
  glowContainer: {
    position: 'absolute',
    top: -60,
    left: -SCREEN_WIDTH * 0.1,
    width: SCREEN_WIDTH * 1.2,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 140,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoRow: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  subtitleWrapper: {
    marginTop: 6,
  },
  formContent: {
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
});
