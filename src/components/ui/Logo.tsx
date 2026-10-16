import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

export interface LogoProps {
  size?: number; // Height of the logo in points
  style?: ViewStyle;
}

/**
 * Official GlobeVerify Transparent Logo
 * Renders cleanly without circular containers, borders, or background clipping.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 46,
  style,
}) => {
  // logo-transparent.png has dimensions 564 x 629 (width/height ratio ~ 0.896)
  const width = Math.round(size * (564 / 629));

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../../assets/logo-transparent.png')}
        style={{ width, height: size }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
