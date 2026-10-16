import React from 'react';
import { Platform, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SymbolView, SFSymbol } from 'expo-symbols';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export interface IconProps {
  iosName: SFSymbol;
  androidName?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Cross-platform native symbol component.
 * Uses real Apple SF Symbols via `expo-symbols` on iOS.
 * On Android, renders crisp native SVG icons conforming to Material guidelines.
 * NO Lucide, NO emojis.
 */
export const Icon: React.FC<IconProps> = ({
  iosName,
  size = 24,
  color = '#000000',
  style,
}) => {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={iosName}
        size={size}
        tintColor={color}
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  // Android crisp SVG icon fallbacks mapped from common SF symbol names
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {renderAndroidSvg(iosName, size, color)}
    </View>
  );
};

function renderAndroidSvg(name: string, size: number, color: string) {
  switch (name) {
    case 'shield.fill':
    case 'checkmark.shield.fill':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
            fill={color}
          />
          <Path
            d="M10 15.5l-3.5-3.5 1.41-1.41L10 12.67l6.09-6.09L17.5 8l-7.5 7.5z"
            fill="#ffffff"
          />
        </Svg>
      );
    case 'phone.badge.checkmark':
    case 'phone.fill':
    case 'message.fill':
    case 'bubble.left.and.bubble.right.fill':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
        </Svg>
      );
    case 'creditcard.fill':
    case 'banknote.fill':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
        </Svg>
      );
    case 'clock.arrow.circlepath':
    case 'clock.fill':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
        </Svg>
      );
    case 'chevron.right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 18l6-6-6-6"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'arrow.right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14M12 5l7 7-7 7"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Circle cx="12" cy="12" r="10" />
        </Svg>
      );
  }
}
