import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  useColorScheme,
  Image,
  Modal,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Ellipse, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LegalScreen } from '../legal/LegalScreen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LOGO_FINAL_SIZE = 56;
const FINAL_LEFT = 24;

const TYPEWRITER_PHRASES = [
  'All you need is a click away...',
  'Instant SMS & OTP verification...',
  'Virtual numbers in 150+ countries...',
  'Dedicated rental lines & voice calls...',
  'High-speed global travel eSIM data...',
  'Pay seamlessly in Naira or Dollars...',
];

export interface OnboardingScreenProps {
  onComplete?: (action: 'register' | 'login') => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const finalTop = Math.max(insets.top, 24) + 6;

  // Center start positions for the logo entrance animation
  const startX = (SCREEN_WIDTH - LOGO_FINAL_SIZE) / 2;
  const startY = SCREEN_HEIGHT * 0.34 - LOGO_FINAL_SIZE / 2;
  const deltaX = startX - FINAL_LEFT;
  const deltaY = startY - finalTop;

  // Animation values
  const animProgress = useRef(new Animated.Value(0)).current; // 0 = big in center, 1 = shrunk at top left
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Typewriter states
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingActive, setTypingActive] = useState(false);

  // Legal Modal
  const [legalModal, setLegalModal] = useState<{ visible: boolean; tab: 'terms' | 'privacy' }>({
    visible: false,
    tab: 'terms',
  });

  // ── Entrance Choreography: Big in center -> shrinks & glides to top-left edge ──
  useEffect(() => {
    // 1. Fade in big centered logo
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // 2. Pause briefly in the center, then smoothly glide & shrink to top-left edge
    const glideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(animProgress, {
          toValue: 1,
          duration: 900,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // Ultra-smooth deceleration
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 800,
          delay: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTypingActive(true);
      });
    }, 550);

    return () => clearTimeout(glideTimer);
  }, [animProgress, logoOpacity, contentFade]);

  // Cursor blink loop
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [cursorOpacity]);

  // Typewriter loop (activates after logo reaches top-left edge)
  useEffect(() => {
    if (!typingActive) return;

    const currentPhrase = TYPEWRITER_PHRASES[phraseIndex];
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, 34);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length - 1));
        }, 18);
      } else {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % TYPEWRITER_PHRASES.length);
      }
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIndex, typingActive]);

  const handleAction = (action: 'register' | 'login') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete?.(action);
  };

  const openLegal = (tab: 'terms' | 'privacy') => {
    Haptics.selectionAsync();
    setLegalModal({ visible: true, tab });
  };

  // ── Color System: adapts seamlessly to phone light / dark mode ──
  const colors = isDark
    ? {
        bg: '#0A0A0A',
        meshPrimary: '#38BDF8',
        meshSecondary: '#0284C7',
        meshOpacityHigh: 0.65,
        meshOpacityLow: 0.25,
        logoBorder: '#272B35',
        headline: '#FFFFFF',
        cursor: '#38BDF8',
        btnPrimaryBg: '#FFFFFF',
        btnPrimaryText: '#0A0A0A',
        btnSecondaryBg: '#141822',
        btnSecondaryBorder: '#272F40',
        btnSecondaryText: '#FFFFFF',
        footerText: '#94A3B8',
        footerLink: '#FFFFFF',
      }
    : {
        bg: '#F8FAFC',
        meshPrimary: '#2563EB',
        meshSecondary: '#0284C7',
        meshOpacityHigh: 0.45,
        meshOpacityLow: 0.15,
        logoBorder: '#E2E8F0',
        headline: '#0F172A',
        cursor: '#2563EB',
        btnPrimaryBg: '#0F172A',
        btnPrimaryText: '#FFFFFF',
        btnSecondaryBg: '#FFFFFF',
        btnSecondaryBorder: '#E2E8F0',
        btnSecondaryText: '#0F172A',
        footerText: '#64748B',
        footerLink: '#0F172A',
      };

  // Interpolated animated transforms for the logo
  const logoTranslateX = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [deltaX, 0],
  });

  const logoTranslateY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [deltaY, 0],
  });

  const logoScale = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [2.3, 1.0], // Starts at 2.3x big in the center, shrinks to 1.0x
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Prominent Decorative Cyber Mesh Background Graphic (Visible & Sharp) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}>
          <Defs>
            <LinearGradient id="meshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.meshPrimary} stopOpacity={colors.meshOpacityHigh} />
              <Stop offset="60%" stopColor={colors.meshSecondary} stopOpacity={colors.meshOpacityLow} />
              <Stop offset="100%" stopColor={colors.meshPrimary} stopOpacity="0.06" />
            </LinearGradient>
            <LinearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="90%">
              <Stop offset="0%" stopColor={colors.meshPrimary} stopOpacity={colors.meshOpacityHigh} />
              <Stop offset="70%" stopColor={colors.meshSecondary} stopOpacity={colors.meshOpacityLow} />
              <Stop offset="100%" stopColor={colors.meshPrimary} stopOpacity="0.05" />
            </LinearGradient>
          </Defs>

          {/* Top-Right / Top-Center 3D Wireframe Torus / Concentric Ring Grid */}
          <G transform={`translate(${SCREEN_WIDTH * 0.58}, ${SCREEN_HEIGHT * 0.14}) rotate(-28)`}>
            <Ellipse cx="0" cy="0" rx="155" ry="72" stroke="url(#meshGrad)" strokeWidth="1.4" fill="none" />
            <Ellipse cx="0" cy="0" rx="138" ry="62" stroke="url(#meshGrad)" strokeWidth="1.2" fill="none" />
            <Ellipse cx="0" cy="0" rx="120" ry="52" stroke="url(#meshGrad)" strokeWidth="1.1" fill="none" />
            <Ellipse cx="0" cy="0" rx="102" ry="43" stroke="url(#meshGrad)" strokeWidth="1.0" fill="none" />
            <Ellipse cx="0" cy="0" rx="84" ry="34" stroke="url(#meshGrad)" strokeWidth="0.9" fill="none" />
            <Ellipse cx="0" cy="0" rx="66" ry="26" stroke="url(#meshGrad)" strokeWidth="0.8" fill="none" />

            {/* Radial Torus Rib Lines */}
            {[-75, -55, -35, -15, 5, 25, 45, 65, 85].map((deg, i) => (
              <Path
                key={i}
                d={`M ${Math.cos((deg * Math.PI) / 180) * 66} ${Math.sin((deg * Math.PI) / 180) * 26} L ${Math.cos((deg * Math.PI) / 180) * 155} ${Math.sin((deg * Math.PI) / 180) * 72}`}
                stroke="url(#meshGrad)"
                strokeWidth="1.1"
              />
            ))}
          </G>

          {/* Sweeping 3D Wireframe Wave Mesh (Flowing diagonally down across the screen) */}
          <G>
            {/* Longitude / Longitudinal Curved Splines */}
            <Path
              d={`M ${SCREEN_WIDTH * 0.12} ${SCREEN_HEIGHT * 0.28} C ${SCREEN_WIDTH * 0.38} ${SCREEN_HEIGHT * 0.34}, ${SCREEN_WIDTH * 0.46} ${SCREEN_HEIGHT * 0.44}, ${SCREEN_WIDTH * 0.94} ${SCREEN_HEIGHT * 0.36}`}
              stroke="url(#waveGrad)"
              strokeWidth="1.3"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.18} ${SCREEN_HEIGHT * 0.32} C ${SCREEN_WIDTH * 0.44} ${SCREEN_HEIGHT * 0.39}, ${SCREEN_WIDTH * 0.52} ${SCREEN_HEIGHT * 0.50}, ${SCREEN_WIDTH * 0.96} ${SCREEN_HEIGHT * 0.43}`}
              stroke="url(#waveGrad)"
              strokeWidth="1.3"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.26} ${SCREEN_HEIGHT * 0.36} C ${SCREEN_WIDTH * 0.50} ${SCREEN_HEIGHT * 0.44}, ${SCREEN_WIDTH * 0.58} ${SCREEN_HEIGHT * 0.57}, ${SCREEN_WIDTH * 0.98} ${SCREEN_HEIGHT * 0.50}`}
              stroke="url(#waveGrad)"
              strokeWidth="1.2"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.34} ${SCREEN_HEIGHT * 0.40} C ${SCREEN_WIDTH * 0.56} ${SCREEN_HEIGHT * 0.50}, ${SCREEN_WIDTH * 0.65} ${SCREEN_HEIGHT * 0.64}, ${SCREEN_WIDTH * 0.96} ${SCREEN_HEIGHT * 0.57}`}
              stroke="url(#waveGrad)"
              strokeWidth="1.1"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.42} ${SCREEN_HEIGHT * 0.45} C ${SCREEN_WIDTH * 0.62} ${SCREEN_HEIGHT * 0.56}, ${SCREEN_WIDTH * 0.72} ${SCREEN_HEIGHT * 0.70}, ${SCREEN_WIDTH * 0.92} ${SCREEN_HEIGHT * 0.64}`}
              stroke="url(#waveGrad)"
              strokeWidth="1.0"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.50} ${SCREEN_HEIGHT * 0.50} C ${SCREEN_WIDTH * 0.68} ${SCREEN_HEIGHT * 0.62}, ${SCREEN_WIDTH * 0.78} ${SCREEN_HEIGHT * 0.76}, ${SCREEN_WIDTH * 0.88} ${SCREEN_HEIGHT * 0.71}`}
              stroke="url(#waveGrad)"
              strokeWidth="0.9"
              fill="none"
            />

            {/* Transverse Cross Grid Ribs (Creating the 3D cyber grid effect from reference!) */}
            {[
              { x1: SCREEN_WIDTH * 0.22, y1: SCREEN_HEIGHT * 0.30, x2: SCREEN_WIDTH * 0.30, y2: SCREEN_HEIGHT * 0.38 },
              { x1: SCREEN_WIDTH * 0.32, y1: SCREEN_HEIGHT * 0.32, x2: SCREEN_WIDTH * 0.42, y2: SCREEN_HEIGHT * 0.45 },
              { x1: SCREEN_WIDTH * 0.42, y1: SCREEN_HEIGHT * 0.35, x2: SCREEN_WIDTH * 0.53, y2: SCREEN_HEIGHT * 0.53 },
              { x1: SCREEN_WIDTH * 0.52, y1: SCREEN_HEIGHT * 0.38, x2: SCREEN_WIDTH * 0.63, y2: SCREEN_HEIGHT * 0.60 },
              { x1: SCREEN_WIDTH * 0.62, y1: SCREEN_HEIGHT * 0.40, x2: SCREEN_WIDTH * 0.73, y2: SCREEN_HEIGHT * 0.65 },
              { x1: SCREEN_WIDTH * 0.72, y1: SCREEN_HEIGHT * 0.41, x2: SCREEN_WIDTH * 0.82, y2: SCREEN_HEIGHT * 0.67 },
              { x1: SCREEN_WIDTH * 0.82, y1: SCREEN_HEIGHT * 0.40, x2: SCREEN_WIDTH * 0.90, y2: SCREEN_HEIGHT * 0.64 },
              { x1: SCREEN_WIDTH * 0.90, y1: SCREEN_HEIGHT * 0.38, x2: SCREEN_WIDTH * 0.95, y2: SCREEN_HEIGHT * 0.58 },
            ].map((rib, idx) => (
              <Path
                key={idx}
                d={`M ${rib.x1} ${rib.y1} L ${rib.x2} ${rib.y2}`}
                stroke="url(#waveGrad)"
                strokeWidth="1.1"
              />
            ))}
          </G>
        </Svg>
      </View>

      {/* ── Main Single Screen Layout ── */}
      <View
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 8,
          },
        ]}
      >
        {/* Empty space for the top region (the animated logo lives absolutely anchored at top-left) */}
        <View style={{ height: finalTop + LOGO_FINAL_SIZE + 10 }} />

        {/* ── Lower Area: Typewriter Headline + 2 Pill Action Buttons + Legal Footer ── */}
        <Animated.View style={[styles.bottomArea, { opacity: contentFade }]}>
          {/* Bold Catchy Headline with Typewriter Effect */}
          <View style={styles.headlineContainer}>
            <Text style={[styles.headlineText, { color: colors.headline }]}>
              {displayText}
              <Animated.Text style={[styles.cursor, { color: colors.cursor, opacity: cursorOpacity }]}>
                |
              </Animated.Text>
            </Text>
          </View>

          {/* Two Prominent Action Buttons */}
          <View style={styles.actionsGroup}>
            {/* Primary Pill: Create an account */}
            <TouchableOpacity
              style={[styles.actionPillBtn, { backgroundColor: colors.btnPrimaryBg }]}
              onPress={() => handleAction('register')}
              activeOpacity={0.88}
            >
              <Text style={[styles.btnPrimaryText, { color: colors.btnPrimaryText }]}>
                Create an account
              </Text>
            </TouchableOpacity>

            {/* Secondary Pill: Log In */}
            <TouchableOpacity
              style={[
                styles.actionPillBtn,
                {
                  backgroundColor: colors.btnSecondaryBg,
                  borderColor: colors.btnSecondaryBorder,
                  borderWidth: 1,
                },
              ]}
              onPress={() => handleAction('login')}
              activeOpacity={0.88}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.btnSecondaryText }]}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Legal Disclaimer Footer with Interactive Links */}
          <View style={styles.footerWrap}>
            <Text style={[styles.footerText, { color: colors.footerText }]}>
              By clicking "Create an account", you agree to all our{' '}
              <Text style={[styles.footerLink, { color: colors.footerLink }]} onPress={() => openLegal('terms')}>
                Terms
              </Text>
              {' '}and{' '}
              <Text style={[styles.footerLink, { color: colors.footerLink }]} onPress={() => openLegal('privacy')}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Official Solid Logo with Entrance Animation: Big in Center -> Shrunk to Top-Left Edge ── */}
      <Animated.View
        style={[
          styles.animatedLogoContainer,
          {
            top: finalTop,
            left: FINAL_LEFT,
            opacity: logoOpacity,
            transform: [
              { translateX: logoTranslateX },
              { translateY: logoTranslateY },
              { scale: logoScale },
            ],
          },
        ]}
      >
        <View style={[styles.logoSolidCard, { borderColor: colors.logoBorder }]}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
      </Animated.View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  animatedLogoContainer: {
    position: 'absolute',
    width: LOGO_FINAL_SIZE,
    height: LOGO_FINAL_SIZE,
    zIndex: 10,
  },
  logoSolidCard: {
    width: LOGO_FINAL_SIZE,
    height: LOGO_FINAL_SIZE,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  bottomArea: {
    width: '100%',
    paddingBottom: 6,
  },
  headlineContainer: {
    minHeight: 84,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 6,
  },
  headlineText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  cursor: {
    fontSize: 28,
    fontWeight: '900',
  },
  actionsGroup: {
    width: '100%',
    gap: 14,
    marginBottom: 24,
  },
  actionPillBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerWrap: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  footerLink: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
