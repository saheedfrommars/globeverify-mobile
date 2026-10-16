import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { ShieldCheck, AlertCircle, RefreshCw, KeyRound, ArrowRight, ClipboardCopy } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

export interface OtpScreenProps {
  email: string;
  type?: 'login' | 'register' | 'forgot';
  twoFactorMethod?: string;
  onSuccess: () => void;
  onBackToLogin: () => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({
  email,
  type = 'register',
  twoFactorMethod = 'email',
  onSuccess,
  onBackToLogin,
}) => {
  const { colors, typography, isDark } = useTheme();
  const { login } = useAuth();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isAuthenticator = twoFactorMethod === 'authenticator';
  const isLogin = type === 'login';

  // Resend countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return;
      const cleanDigits = text.replace(/[^0-9]/g, '').slice(0, 6);
      if (cleanDigits.length > 0) {
        const nextOtp = ['', '', '', '', '', ''];
        for (let i = 0; i < cleanDigits.length; i++) {
          nextOtp[i] = cleanDigits[i];
        }
        setOtp(nextOtp);
        setErrorMessage('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const focusTarget = Math.min(cleanDigits.length === 6 ? 5 : cleanDigits.length, 5);
        inputRefs.current[focusTarget]?.focus();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (err) {
      console.warn('[OtpScreen] Clipboard paste error:', err);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleanDigits = text.replace(/[^0-9]/g, '');

    // Handle paste or multi-character input into any box
    if (cleanDigits.length > 1) {
      const nextOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        if (cleanDigits.length === 6) {
          nextOtp[i] = cleanDigits[i];
        } else if (i >= index && i - index < cleanDigits.length) {
          nextOtp[i] = cleanDigits[i - index];
        }
      }
      setOtp(nextOtp);
      setErrorMessage('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const focusTarget = Math.min(cleanDigits.length === 6 ? 5 : index + cleanDigits.length, 5);
      inputRefs.current[focusTarget]?.focus();
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = cleanDigits.slice(-1);
    setOtp(nextOtp);

    // Auto-advance
    if (cleanDigits && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = useBackupCode ? backupCode.trim() : otp.join('');

    if (code.length < 6) {
      setErrorMessage('Please enter the complete 6-digit code.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (isLogin) {
        // 2FA Login verification
        const res = await apiClient.post('/auth/2fa/verify-login', {
          email,
          code,
          isBackupCode: useBackupCode,
        });

        const authToken = res.data?.token || res.data?.data?.token;
        const userData = res.data?.user || res.data?.data?.user || (({ token, ...rest }) => rest)(res.data || {});

        if (authToken && typeof authToken === 'string') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await login(authToken, userData);
        }
        onSuccess();
      } else {
        // Registration email verification
        const res = await apiClient.post('/auth/verify-otp', {
          email,
          otp: code,
        });

        const authToken = res.data?.token || res.data?.data?.token;
        const userData = res.data?.user || res.data?.data?.user || (({ token, ...rest }) => rest)(res.data || {});

        if (authToken && typeof authToken === 'string') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await login(authToken, userData);
        }
        onSuccess();
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err.response?.data?.message || 'Verification failed. Code may be invalid or expired.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    setErrorMessage('');

    try {
      await apiClient.post('/auth/resend-otp', { email });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(45);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err.response?.data?.message || 'Failed to resend code. Please try again.';
      setErrorMessage(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title={
        useBackupCode
          ? 'Enter Backup Code'
          : isAuthenticator
          ? 'Authenticator App'
          : 'Verify your email'
      }
      subtitle={
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {useBackupCode ? (
            'Enter one of your 8-character recovery codes.'
          ) : isAuthenticator ? (
            'Enter the 6-digit security code generated by your app.'
          ) : (
            <>
              We sent a code to{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text>
            </>
          )}
        </Text>
      }
    >

      {/* Error Message */}
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

      {/* 6 Digit OTP Input Boxes */}
      {!useBackupCode ? (
        <View>
          <View style={styles.pasteHeaderRow}>
            <Text style={[typography.caption1, { color: colors.textSecondary }]}>
              Enter 6-digit code
            </Text>
            <TouchableOpacity
              style={[
                styles.pasteBtn,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
                },
              ]}
              onPress={handlePasteClipboard}
              activeOpacity={0.7}
            >
              <ClipboardCopy size={13} color={colors.primary} />
              <Text style={[styles.pasteBtnText, { color: colors.primary }]}>
                Paste Code
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.otpGrid}>
            {otp.map((digit, index) => {
              const isFocused = focusedIndex === index;
              return (
                <TextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  onFocus={() => setFocusedIndex(index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                  selectTextOnFocus
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: isDark ? '#141722' : '#ffffff',
                      borderColor: isFocused
                        ? colors.primary
                        : digit
                        ? isDark
                          ? '#3b82f6'
                          : '#2563eb'
                        : isDark
                        ? '#262c3e'
                        : '#e2e8f0',
                      color: colors.text,
                      shadowColor: colors.primary,
                      shadowOpacity: isFocused ? 0.35 : 0,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: isFocused ? 3 : 0,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      ) : (
        <Input
          label="8-Character Backup Code"
          value={backupCode}
          onChangeText={(text) => setBackupCode(text.toUpperCase())}
          placeholder="e.g. A1B2C3D4"
          autoCapitalize="characters"
          leftIcon={<KeyRound size={18} color={colors.primary} />}
        />
      )}

      {/* Resend Code / Timer Row */}
      {!useBackupCode && !isAuthenticator && (
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={[typography.subhead, { color: colors.textTertiary }]}>
              Resend code in{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                0:{countdown < 10 ? `0${countdown}` : countdown}
              </Text>
            </Text>
          ) : (
            <Pressable
              onPress={handleResend}
              disabled={resending}
              style={styles.resendBtn}
            >
              <RefreshCw
                size={14}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  typography.subhead,
                  { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {resending ? 'Sending...' : 'Resend code'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 2FA Backup Code Toggle */}
      {isLogin && (
        <Pressable
          onPress={() => setUseBackupCode(!useBackupCode)}
          style={styles.backupToggle}
        >
          <Text
            style={[
              typography.caption1,
              { color: colors.primary, fontWeight: '600', textAlign: 'center' },
            ]}
          >
            {useBackupCode
              ? 'Use standard verification code'
              : 'Lost access? Use a backup code'}
          </Text>
        </Pressable>
      )}

      {/* Verify Submit Button with Brand Glow */}
      <Button
        title={loading ? 'Verifying...' : 'Verify Code'}
        onPress={handleVerify}
        loading={loading}
        variant="brand"
        icon={!loading ? <ArrowRight size={18} color="#ffffff" /> : undefined}
        style={styles.verifyBtn}
      />

      {/* Back to Login Link */}
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
  pasteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backupToggle: {
    marginVertical: 8,
    alignItems: 'center',
  },
  verifyBtn: {
    marginTop: 14,
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
});
