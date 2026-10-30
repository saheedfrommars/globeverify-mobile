import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  User,
  Mail,
  Lock,
  ChevronDown,
  Gift,
  AlertCircle,
  ArrowRight,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleButton } from '../../components/ui/GoogleButton';
import { AppleButton } from '../../components/ui/AppleButton';
import { signInWithApple } from '../../services/appleAuth';
import {
  CountryPickerModal,
  CountryItem,
  COUNTRIES,
} from '../../components/ui/CountryPickerModal';
import { LegalScreen } from '../legal/LegalScreen';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogle } from '../../services/googleAuth';
import { getPendingReferral, clearPendingReferral } from '../../services/deepLinkService';

export interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onNavigateToOtp: (params: { email: string; type: 'register' }) => void;
  onBack?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
  onNavigateToOtp,
  onBack,
}) => {
  const { colors, spacing, typography, isDark } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(COUNTRIES[0]); // Nigeria default
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [legalModal, setLegalModal] = useState<{ visible: boolean; tab: 'terms' | 'privacy' }>({
    visible: false,
    tab: 'terms',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();

  // Prefill referral code from a referral link (e.g. globeverify.com/auth/register?ref=CODE)
  useEffect(() => {
    getPendingReferral().then((code) => {
      if (code) {
        setReferralCode(code);
        setShowReferralInput(true);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in your name, email, and password.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const fullPhone = phoneNumber.trim()
        ? `${selectedCountry.dial}${phoneNumber.trim()}`
        : '';

      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        countryCode: selectedCountry.code,
        dialCode: selectedCountry.dial,
        phoneNumber: fullPhone,
        referralCode: referralCode.trim() || undefined,
        // Mobile bypass or client signature:
        cfTurnstileResponse: 'mobile-app-client',
      };

      await apiClient.post('/auth/register', payload);
      await clearPendingReferral();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onNavigateToOtp({
        email: email.trim().toLowerCase(),
        type: 'register',
      });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err.response?.data?.message || 'Registration failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setErrorMessage('');
    const result = await signInWithApple();
    if (result.type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(result.token, result.user);
      await clearPendingReferral();
    } else if (result.type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(result.message);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage('');
    const result = await signInWithGoogle();
    if (result.type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(result.token, result.user);
      await clearPendingReferral();
    } else if (result.type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(result.message);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      onBack={onBack}
      subtitle={
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Already have an account?{' '}
          <Text
            onPress={onNavigateToLogin}
            style={{ color: colors.primary, fontWeight: '700' }}
          >
            Log in
          </Text>
        </Text>
      }
    >
      {/* Social Authentication: Google on all devices, Apple on iOS only */}
      <View style={{ gap: 10 }}>
        <GoogleButton
          onPress={handleGoogleAuth}
          title="Sign up with Google"
          style={styles.googleBtn}
        />
        {Platform.OS === 'ios' && (
          <AppleButton
            onPress={handleAppleAuth}
            title="Sign up with Apple"
          />
        )}
      </View>

      {/* Divider */}
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

      {/* Error Banner */}
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

      {/* Full Name */}
      <Input
        label="Full Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (errorMessage) setErrorMessage('');
        }}
        placeholder="e.g. Alex Johnson"
        autoCapitalize="words"
        leftIcon={<User size={18} color={colors.textTertiary} />}
      />

      {/* Email */}
      <Input
        label="Email address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (errorMessage) setErrorMessage('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="name@example.com"
        leftIcon={<Mail size={18} color={colors.textTertiary} />}
      />

      {/* Country Selector */}
      <View style={styles.fieldGroup}>
        <Text
          style={[
            typography.subhead,
            { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
          ]}
        >
          Country
        </Text>
        <Pressable
          onPress={() => setIsCountryModalVisible(true)}
          style={({ pressed }) => [
            styles.countryButton,
            {
              backgroundColor: isDark ? '#141414' : '#ffffff',
              borderColor: isDark ? '#262626' : '#e2e8f0',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.countryContent}>
            <Text style={styles.flagText}>{selectedCountry.flag}</Text>
            <Text
              style={[
                typography.body,
                { color: colors.text, fontWeight: '600', flex: 1 },
              ]}
              numberOfLines={1}
            >
              {selectedCountry.name} ({selectedCountry.dial})
            </Text>
          </View>
          <ChevronDown size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Phone Number (Optional) */}
      <Input
        label="Phone Number (Optional)"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        placeholder="801 234 5678"
        helperText={`Prefix: ${selectedCountry.dial}`}
      />

      {/* Password */}
      <Input
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errorMessage) setErrorMessage('');
        }}
        isPassword
        placeholder="At least 6 characters"
        leftIcon={<Lock size={18} color={colors.textTertiary} />}
      />

      {/* Optional Referral Code Toggle */}
      {!showReferralInput ? (
        <Pressable
          onPress={() => setShowReferralInput(true)}
          style={styles.referralToggleRow}
        >
          <Gift size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text
            style={[
              typography.caption1,
              { color: colors.primary, fontWeight: '700' },
            ]}
          >
            Have a referral code?
          </Text>
        </Pressable>
      ) : (
        <Input
          label="Referral Code (Optional)"
          value={referralCode}
          onChangeText={setReferralCode}
          placeholder="e.g. GLOBE2025"
          autoCapitalize="characters"
          leftIcon={<Gift size={18} color={colors.primary} />}
        />
      )}

      {/* Primary Submit Button with Brand Glow */}
      <Button
        title={loading ? 'Creating account...' : 'Create Account'}
        onPress={handleSubmit}
        loading={loading}
        variant="brand"
        icon={!loading ? <ArrowRight size={18} color="#ffffff" /> : undefined}
        style={styles.submitBtn}
      />

      {/* Legal Agreement Footer */}
      <View style={styles.termsAgreementWrap}>
        <Text style={[styles.termsAgreementText, { color: colors.textSecondary }]}>
          By creating an account, you agree to our
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
          <Text style={[styles.termsAgreementText, { color: colors.textSecondary }]}> and </Text>
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

      {/* Country Picker Modal */}
      <CountryPickerModal
        visible={isCountryModalVisible}
        onClose={() => setIsCountryModalVisible(false)}
        selectedCode={selectedCountry.code}
        onSelectCountry={(country) => setSelectedCountry(country)}
      />

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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    letterSpacing: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  countryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flagText: {
    fontSize: 22,
    marginRight: 10,
  },
  referralToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
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
  termsAgreementWrap: {
    marginTop: 14,
    marginBottom: 6,
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
