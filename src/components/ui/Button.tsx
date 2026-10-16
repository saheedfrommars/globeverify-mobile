import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
}

/**
 * Platform-compliant native button control.
 * In Light Mode: Primary button is solid Black with White text.
 * In Dark Mode: Primary button is solid Light/White with Black text.
 * 'brand' variant: GlobeVerify vibrant electric blue with glowing shadow.
 */
export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'brand',
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  hapticFeedback = true,
}) => {
  const { colors, spacing, radius, typography } = useTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    if (hapticFeedback) {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.selectionAsync();
      }
    }
    onPress();
  };

  const getContainerStyles = (pressed: boolean): ViewStyle => {
    let bg = colors.primary;
    let border = 'transparent';
    let borderWidth = 0;
    let shadowStyle: ViewStyle = {};

    if (variant === 'brand') {
      bg = colors.primary;
      shadowStyle = {
        shadowColor: colors.primary,
        shadowOpacity: 0.38,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      };
    } else if (variant === 'primary') {
      bg = colors.buttonPrimaryBg;
    } else if (variant === 'secondary') {
      bg = colors.buttonSecondaryBg;
      border = colors.buttonSecondaryBorder;
      borderWidth = 1;
    } else if (variant === 'plain') {
      bg = 'transparent';
    } else if (variant === 'destructive') {
      bg = colors.error;
    }

    let minHeight: number = 52;
    let padH: number = spacing.base;

    if (size === 'sm') {
      minHeight = 36;
      padH = spacing.md;
    } else if (size === 'md') {
      minHeight = 44;
      padH = spacing.base;
    }

    return {
      backgroundColor: bg,
      minHeight,
      paddingHorizontal: padH,
      borderRadius: radius.md,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth,
      borderColor: border,
      opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
      transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
      ...shadowStyle,
    };
  };

  const getTextColor = (): string => {
    if (variant === 'brand') {
      return '#ffffff';
    }
    if (variant === 'primary') {
      return colors.buttonPrimaryText;
    }
    if (variant === 'secondary') {
      return colors.buttonSecondaryText;
    }
    if (variant === 'plain') {
      return colors.textSecondary;
    }
    if (variant === 'destructive') {
      return '#ffffff';
    }
    return colors.text;
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [getContainerStyles(pressed), style]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text
            style={[
              typography.headline,
              { color: getTextColor(), fontWeight: '700', textAlign: 'center' },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};
