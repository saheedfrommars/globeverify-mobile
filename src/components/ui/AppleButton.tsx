import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface AppleButtonProps {
  onPress: () => void;
  title?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const AppleButton: React.FC<AppleButtonProps> = ({
  onPress,
  title = 'Continue with Apple',
  disabled = false,
  style,
}) => {
  const { colors, spacing, radius, typography, isDark } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Apple HIG recommends a solid black button in light mode, and pure white/black in dark mode
  const bg = isDark ? '#FFFFFF' : '#000000';
  const textColor = isDark ? '#000000' : '#FFFFFF';
  const iconFill = isDark ? '#000000' : '#FFFFFF';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: isDark ? '#FFFFFF' : '#000000',
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.base,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Svg width={18} height={18} viewBox="0 0 170 170" style={styles.icon}>
        <Path
          d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.73-11.65-14.07-5.99-9.35-10.63-20.08-13.93-32.18-3.3-12.1-4.96-23.41-4.96-33.93 0-16.1 4.14-29.35 12.43-39.76 8.29-10.41 18.66-15.69 31.12-15.82 4.9 0 10.42 1.34 16.56 4.02 6.14 2.68 10.15 4.09 12.03 4.23 1.5.09 5.86-1.45 13.07-4.63 7.21-3.18 13.51-4.63 18.9-4.35 14.69.75 26.35 6.32 34.99 16.71-13.07 7.9-19.46 18.79-19.16 32.67.29 11.23 4.6 20.61 12.92 28.14 4.02 3.65 8.7 6.45 14.04 8.41-2.9 8.77-6.52 17.75-10.87 26.93zM119.22 31.84c0-7.72 2.76-15.04 8.28-21.96 5.53-6.92 12.38-11.23 20.57-12.93.43 2.12.65 4.09.65 5.91 0 7.73-2.88 15.19-8.65 22.38-5.77 7.19-12.78 11.45-21.03 12.79-.22-2.12-.33-4.18-.33-6.19z"
          fill={iconFill}
        />
      </Svg>
      <Text
        style={[
          typography.headline,
          styles.text,
          { color: textColor, fontWeight: '600' },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 50,
  },
  icon: {
    marginRight: 10,
    marginBottom: 2,
  },
  text: {
    fontSize: 15,
  },
});
