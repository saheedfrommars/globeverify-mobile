import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleButton } from '../../components/ui/GoogleButton';
import { LegalScreen } from '../legal/LegalScreen';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { signInWithGoogle } from '../../services/googleAuth';
import { clearPendingReferral } from '../../services/deepLinkService';

export interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onNavigateToForgot: () => void;
  onNavigateToOtp: (params: { email: string; type: 'login'; twoFactorMethod?: string }) => void;
  onLoginSuccess: () => void;
  onBack?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
  onNavigateToForgot,
  onNavigateToOtp,
  onLoginSuccess,
  onBack,
}) => {
  const { colors, spacing, typography, isDark } = useTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [legalModal, setLegalModal] = useState<{ visible: boolean; tab: 'terms' | 'privacy' }>({
    visible: false,
    tab: 'terms',
  });

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const data = response.data;

      if (data.requiresOTP) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onNavigateToOtp({
          email: email.trim().toLowerCase(),
          type: 'login',
          twoFactorMethod: data.twoFactorMethod,
        });
      } else {
        const authToken = data.token || data.data?.token;
        const userData = data.user || data.data?.user || (({ token, ...rest }) => rest)(data);

        if (authToken && typeof authToken === 'string') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await login(authToken, userData);
          onLoginSuccess();
        } else {
          throw new Error('No valid authentication token returned by the server.');
        }
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err.response?.data?.message || 'Login failed. Please check your credentials.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage('');
    const result = await signInWithGoogle();
    if (result.type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(result.token, result.user);
      if (result.isNew) await clearPendingReferral();
      onLoginSuccess();
    } else if (result.type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(result.message);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      onBack={onBack}
      subtitle={
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          New to GlobeVerify?{' '}
          <Text
            onPress={onNavigateToRegister}
            style={{ color: colors.primary, fontWeight: '700' }}
          >
            Create an account
          </Text>
        </Text>
      }
    >
      {/* Error Message Banner */}
      {errorMessage ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
            },
          ]}
        >
          <AlertCircle size={18} color={colors.error} style={{ marginRight: 8 }} />
          <Text
            style={[
              typography.subhead,
              { color: colors.error, fontWeight: '600', flex: 1 },
            ]}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Email Input */}
      <Input
        label="Email address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (errorMessage) setErrorMessage('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="name@example.com"
        leftIcon={<Mail size={18} color={colors.textTertiary} />}
      />

      {/* Password Input with Forgot Password Link */}
      <View style={styles.passwordHeaderRow}>
        <Text
          style={[
            typography.subhead,
            { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
          ]}
        >
          Password
        </Text>
        <Pressable onPress={onNavigateToForgot} hitSlop={10}>
          <Text
            style={[
              typography.caption1,
              { color: colors.primary, fontWeight: '700' },
            ]}
          >
            Forgot password?
          </Text>
        </Pressable>
      </View>

      <Input
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errorMessage) setErrorMessage('');
        }}
        isPassword
        placeholder="••••••••"
        leftIcon={<Lock size={18} color={colors.textTertiary} />}
      />

      {/* Primary Submit Button with Brand Electric Blue Glow */}
      <Button
        title={loading ? 'Signing in...' : 'Sign In'}
        onPress={handleSubmit}
        loading={loading}
        variant="brand"
        icon={!loading ? <ArrowRight size={18} color="#ffffff" /> : undefined}
        style={styles.submitBtn}
      />

      {/* Divider Matching Website: Line - OR - Line */}
      <View style={styles.dividerRow}>
        <View
          style={[
            styles.dividerLine,
            { backgroundColor: isDark ? '#232838' : '#e2e8f0' },
          ]}
        />
        <Text
          style={[
            typography.caption1,
            styles.dividerText,
            { color: colors.textTertiary, fontWeight: '600' },
          ]}
        >
          OR
        </Text>
        <View
          style={[
            styles.dividerLine,
            { backgroundColor: isDark ? '#232838' : '#e2e8f0' },
          ]}
        />
      </View>

      {/* Google Authentication */}
      <GoogleButton onPress={handleGoogleAuth} style={styles.googleBtn} />

      {/* Legal Agreement / Compliance Notice */}
      <View style={styles.termsAgreementWrap}>
        <Text style={[styles.termsAgreementText, { color: colors.textSecondary }]}>
          Protected by GlobeVerify Security. View
        </Text>
        <View style={styles.termsLinksRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setLegalModal({ visible: true, tab: 'terms' });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.termsLink, { color: colors.primary }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
          <Text style={[styles.termsAgreementText, { color: colors.textSecondary }]}> & </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setLegalModal({ visible: true, tab: 'privacy' });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.termsLink, { color: colors.primary }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* In-App Legal Terms & Privacy Modal */}
      <Modal
        visible={legalModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalModal((prev) => ({ ...prev, visible: false }))}
      >
        <LegalScreen
          isModal
          initialTab={legalModal.tab}
          onBack={() => setLegalModal((prev) => ({ ...prev, visible: false }))}
        />
      </Modal>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitBtn: {
    marginTop: 12,
    borderRadius: 27,
    minHeight: 54,
  },
  googleBtn: {
    borderRadius: 27,
    minHeight: 52,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    letterSpacing: 1,
  },
  termsAgreementWrap: {
    marginTop: 20,
    marginBottom: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  termsLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  termsAgreementText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
