import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from './Icon';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  leftIcon,
  rightAccessory,
  containerStyle,
  style,
  ...props
}) => {
  const { colors, spacing, radius, typography, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            typography.subhead,
            { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: isDark ? '#141414' : '#ffffff',
            borderColor: error
              ? colors.error
              : isFocused
              ? colors.primary
              : isDark
              ? '#262626'
              : '#e2e8f0',
            borderRadius: radius.md,
            paddingHorizontal: spacing.base,
            shadowColor: error ? colors.error : colors.primary,
            shadowOpacity: isFocused ? 0.28 : 0,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
            elevation: isFocused ? 2 : 0,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}

        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={colors.textTertiary}
          style={[
            typography.body,
            styles.textInput,
            {
              color: colors.text,
            },
            style,
          ]}
        />

        {isPassword ? (
          <Pressable
            hitSlop={10}
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Icon
              iosName={showPassword ? 'eye.slash' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : (
          rightAccessory
        )}
      </View>

      {error ? (
        <Text
          style={[
            typography.caption1,
            { color: colors.error, marginTop: spacing.xs, fontWeight: '500' },
          ]}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={[
            typography.caption1,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputWrapper: {
    minHeight: 52,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIconWrapper: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
  },
  eyeButton: {
    paddingLeft: 8,
  },
});
