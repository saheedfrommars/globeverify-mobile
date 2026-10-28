import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mail, AlertCircle, ArrowRight, KeyRound } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import apiClient from '../../api/client';

export interface ForgotPasswordScreenProps {
  onNavigateToReset: (email: string) => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onNavigateToReset,
  onBackToLogin,
}) => {
  const { colors, typography, isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await apiClient.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onNavigateToReset(email.trim().toLowerCase());
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(
        err.response?.data?.message || 'Could not send reset code. Please check your email.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      onBack={onBackToLogin}
      subtitle={
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Enter your email to receive a password recovery code.
        </Text>
      }
    >

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

      <Button
        title={loading ? 'Sending Code...' : 'Send Reset Code'}
        onPress={handleSubmit}
        loading={loading}
        variant="brand"
        icon={!loading ? <ArrowRight size={18} color="#ffffff" /> : undefined}
        style={styles.submitBtn}
      />

      <Pressable onPress={onBackToLogin} style={styles.backBtn}>
        <Text
          style={[
            typography.subhead,
            { color: colors.textSecondary, fontWeight: '600' },
          ]}
        >
          Back to Login
        </Text>
      </Pressable>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  iconCenter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  submitBtn: {
    marginTop: 14,
    borderRadius: 27,
    minHeight: 54,
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
});
