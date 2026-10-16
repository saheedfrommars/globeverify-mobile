import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Lock, KeyRound, AlertCircle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import apiClient from '../../api/client';

export interface ResetPasswordScreenProps {
  email: string;
  onResetSuccess: () => void;
  onBackToLogin: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  email,
  onResetSuccess,
  onBackToLogin,
}) => {
  const { colors, typography, isDark } = useTheme();

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    if (!otp.trim() || !newPassword) {
      setErrorMessage('Please enter the OTP code and your new password.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await apiClient.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResetSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(
        err.response?.data?.message || 'Password reset failed. Please check the code.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set new password"
      subtitle={
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Enter the code sent to <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text> and your new password.
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
        label="OTP Code"
        value={otp}
        onChangeText={(text) => {
          setOtp(text);
          if (errorMessage) setErrorMessage('');
        }}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="Enter 6-digit code"
        leftIcon={<KeyRound size={18} color={colors.textTertiary} />}
      />

      <Input
        label="New Password"
        value={newPassword}
        onChangeText={(text) => {
          setNewPassword(text);
          if (errorMessage) setErrorMessage('');
        }}
        isPassword
        placeholder="At least 6 characters"
        leftIcon={<Lock size={18} color={colors.textTertiary} />}
      />

      <Button
        title={loading ? 'Resetting Password...' : 'Reset Password'}
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
    marginTop: 10,
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
});
