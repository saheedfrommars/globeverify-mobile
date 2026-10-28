import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  useColorScheme,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Ellipse, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Logo } from '../../components/ui/Logo';
import { LegalScreen } from '../legal/LegalScreen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TYPEWRITER_PHRASES = [
  'All you need is a click away...',
  'Instant SMS & OTP verification...',
  'Virtual numbers in 150+ countries...',
  'Dedicated rental lines & voice calls...',
  'High-speed global travel eSIM data...',
];

export interface OnboardingScreenProps {
  onComplete?: (action: 'register' | 'login') => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Typewriter state
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Legal Modal State
  const [legalModal, setLegalModal] = useState<{ visible: boolean; tab: 'terms' | 'privacy' }>({
    visible: false,
    tab: 'terms',
  });

  // Entrance animations
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 900,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoScale, logoOpacity, contentFade]);

  // Cursor blink
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [cursorOpacity]);

  // Typewriter typing & deleting loop
  useEffect(() => {
    const currentPhrase = TYPEWRITER_PHRASES[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, 40);
      } else {
        // Pause at full text
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length - 1));
        }, 22);
      } else {
        // Move to next phrase
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % TYPEWRITER_PHRASES.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex]);

  const handleAction = (action: 'register' | 'login') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete?.(action);
  };

  const openLegal = (tab: 'terms' | 'privacy') => {
    Haptics.selectionAsync();
    setLegalModal({ visible: true, tab });
  };

  // Color scheme matching GlobeVerify brand:
  // In light mode: Vibrant electric royal blue (matches reference screenshot!)
  // In dark mode: Deep obsidian / navy-black (dark phone default!)
  const colors = {
    bg: isDark ? '#090D16' : '#2563EB',
    meshColor: isDark ? '#38BDF8' : '#67E8F9',
    headlineText: '#FFFFFF',
    cursorColor: isDark ? '#38BDF8' : '#A5F3FC',
    btnPrimaryBg: '#FFFFFF',
    btnPrimaryText: isDark ? '#090D16' : '#0F172A',
    btnSecondaryBg: isDark ? '#141D2E' : '#0B1C3D',
    btnSecondaryText: '#FFFFFF',
    btnSecondaryBorder: isDark ? '#23324E' : 'rgba(255, 255, 255, 0.12)',
    footerText: isDark ? '#94A3B8' : '#D0DCFF',
    footerLink: '#FFFFFF',
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />

      {/* ── Decorative Cyber Mesh Background Graphic (SVG Wave Grid) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}>
          <Defs>
            <LinearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.meshColor} stopOpacity={isDark ? "0.35" : "0.55"} />
              <Stop offset="50%" stopColor={colors.meshColor} stopOpacity={isDark ? "0.20" : "0.35"} />
              <Stop offset="100%" stopColor={colors.meshColor} stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="80%">
              <Stop offset="0%" stopColor={colors.meshColor} stopOpacity={isDark ? "0.40" : "0.50"} />
              <Stop offset="100%" stopColor={colors.meshColor} stopOpacity="0.08" />
            </LinearGradient>
          </Defs>

          {/* Top-Left Torus / Circular Wireframe Ring */}
          <G transform={`translate(${SCREEN_WIDTH * 0.25}, ${SCREEN_HEIGHT * 0.12}) rotate(-25)`}>
            <Ellipse cx="0" cy="0" rx="140" ry="65" stroke="url(#meshGradient)" strokeWidth="1.2" fill="none" />
            <Ellipse cx="0" cy="0" rx="125" ry="55" stroke="url(#meshGradient)" strokeWidth="1.1" fill="none" />
            <Ellipse cx="0" cy="0" rx="110" ry="46" stroke="url(#meshGradient)" strokeWidth="1" fill="none" />
            <Ellipse cx="0" cy="0" rx="95" ry="38" stroke="url(#meshGradient)" strokeWidth="0.9" fill="none" />
            <Ellipse cx="0" cy="0" rx="80" ry="30" stroke="url(#meshGradient)" strokeWidth="0.8" fill="none" />

            {/* Radial Cross Ribs of the Torus */}
            {[-70, -50, -30, -10, 10, 30, 50, 70].map((deg, i) => (
              <Path
                key={i}
                d={`M ${Math.cos((deg * Math.PI) / 180) * 80} ${Math.sin((deg * Math.PI) / 180) * 30} L ${Math.cos((deg * Math.PI) / 180) * 140} ${Math.sin((deg * Math.PI) / 180) * 65}`}
                stroke="url(#meshGradient)"
                strokeWidth="0.9"
              />
            ))}
          </G>

          {/* Sweeping 3D Flowing Wireframe Ribbon (Behind & Below Logo) */}
          <G>
            {/* Longitude / Longitudinal Flow Waves */}
            <Path
              d={`M ${SCREEN_WIDTH * 0.18} ${SCREEN_HEIGHT * 0.32} C ${SCREEN_WIDTH * 0.35} ${SCREEN_HEIGHT * 0.38}, ${SCREEN_WIDTH * 0.42} ${SCREEN_HEIGHT * 0.46}, ${SCREEN_WIDTH * 0.92} ${SCREEN_HEIGHT * 0.38}`}
              stroke="url(#waveGradient)"
              strokeWidth="1.2"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.28} ${SCREEN_HEIGHT * 0.35} C ${SCREEN_WIDTH * 0.42} ${SCREEN_HEIGHT * 0.43}, ${SCREEN_WIDTH * 0.50} ${SCREEN_HEIGHT * 0.52}, ${SCREEN_WIDTH * 0.96} ${SCREEN_HEIGHT * 0.44}`}
              stroke="url(#waveGradient)"
              strokeWidth="1.2"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.38} ${SCREEN_HEIGHT * 0.38} C ${SCREEN_WIDTH * 0.48} ${SCREEN_HEIGHT * 0.48}, ${SCREEN_WIDTH * 0.58} ${SCREEN_HEIGHT * 0.58}, ${SCREEN_WIDTH * 0.98} ${SCREEN_HEIGHT * 0.50}`}
              stroke="url(#waveGradient)"
              strokeWidth="1.1"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.45} ${SCREEN_HEIGHT * 0.42} C ${SCREEN_WIDTH * 0.55} ${SCREEN_HEIGHT * 0.53}, ${SCREEN_WIDTH * 0.65} ${SCREEN_HEIGHT * 0.63}, ${SCREEN_WIDTH * 0.95} ${SCREEN_HEIGHT * 0.56}`}
              stroke="url(#waveGradient)"
              strokeWidth="1"
              fill="none"
            />
            <Path
              d={`M ${SCREEN_WIDTH * 0.50} ${SCREEN_HEIGHT * 0.47} C ${SCREEN_WIDTH * 0.62} ${SCREEN_HEIGHT * 0.58}, ${SCREEN_WIDTH * 0.72} ${SCREEN_HEIGHT * 0.68}, ${SCREEN_WIDTH * 0.90} ${SCREEN_HEIGHT * 0.63}`}
              stroke="url(#waveGradient)"
              strokeWidth="0.9"
              fill="none"
            />

            {/* Transverse Cross Grid Ribs */}
            {[
              { x1: SCREEN_WIDTH * 0.28, y1: SCREEN_HEIGHT * 0.34, x2: SCREEN_WIDTH * 0.32, y2: SCREEN_HEIGHT * 0.41 },
              { x1: SCREEN_WIDTH * 0.38, y1: SCREEN_HEIGHT * 0.36, x2: SCREEN_WIDTH * 0.45, y2: SCREEN_HEIGHT * 0.48 },
              { x1: SCREEN_WIDTH * 0.48, y1: SCREEN_HEIGHT * 0.39, x2: SCREEN_WIDTH * 0.56, y2: SCREEN_HEIGHT * 0.55 },
              { x1: SCREEN_WIDTH * 0.58, y1: SCREEN_HEIGHT * 0.41, x2: SCREEN_WIDTH * 0.67, y2: SCREEN_HEIGHT * 0.60 },
              { x1: SCREEN_WIDTH * 0.68, y1: SCREEN_HEIGHT * 0.42, x2: SCREEN_WIDTH * 0.76, y2: SCREEN_HEIGHT * 0.62 },
              { x1: SCREEN_WIDTH * 0.78, y1: SCREEN_HEIGHT * 0.41, x2: SCREEN_WIDTH * 0.84, y2: SCREEN_HEIGHT * 0.60 },
              { x1: SCREEN_WIDTH * 0.88, y1: SCREEN_HEIGHT * 0.39, x2: SCREEN_WIDTH * 0.92, y2: SCREEN_HEIGHT * 0.55 },
            ].map((rib, idx) => (
              <Path
                key={idx}
                d={`M ${rib.x1} ${rib.y1} L ${rib.x2} ${rib.y2}`}
                stroke="url(#waveGradient)"
                strokeWidth="1"
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
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* Upper Hero: Prominent Official Logo */}
        <Animated.View
          style={[
            styles.heroLogoArea,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Logo size={98} />
        </Animated.View>

        {/* Lower Section: Typewriter Headline + 2 Action Buttons + Legal Footer */}
        <Animated.View style={[styles.bottomArea, { opacity: contentFade }]}>
          {/* Bold Catchy Headline with Smooth Typewriter Effect */}
          <View style={styles.headlineBox}>
            <Text style={[styles.headlineText, { color: colors.headlineText }]}>
              {displayText}
              <Animated.Text style={[styles.cursor, { color: colors.cursorColor, opacity: cursorOpacity }]}>
                |
              </Animated.Text>
            </Text>
          </View>

          {/* Action Buttons (Matches Reference Screen Exactly!) */}
          <View style={styles.buttonsGroup}>
            {/* Primary Pill Button: Create an account */}
            <TouchableOpacity
              style={[styles.pillBtn, { backgroundColor: colors.btnPrimaryBg }]}
              onPress={() => handleAction('register')}
              activeOpacity={0.88}
            >
              <Text style={[styles.pillBtnPrimaryText, { color: colors.btnPrimaryText }]}>
                Create an account
              </Text>
            </TouchableOpacity>

            {/* Secondary Pill Button: Log In */}
            <TouchableOpacity
              style={[
                styles.pillBtn,
                {
                  backgroundColor: colors.btnSecondaryBg,
                  borderColor: colors.btnSecondaryBorder,
                  borderWidth: 1,
                },
              ]}
              onPress={() => handleAction('login')}
              activeOpacity={0.88}
            >
              <Text style={[styles.pillBtnSecondaryText, { color: colors.btnSecondaryText }]}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Legal Disclaimer Footer with Clickable Links */}
          <View style={styles.disclaimerBox}>
            <Text style={[styles.disclaimerText, { color: colors.footerText }]}>
              By clicking the "Create an account", you agree to all our{' '}
              <Text style={[styles.disclaimerLink, { color: colors.footerLink }]} onPress={() => openLegal('terms')}>
                Terms
              </Text>
              {' '}and{' '}
              <Text style={[styles.disclaimerLink, { color: colors.footerLink }]} onPress={() => openLegal('privacy')}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* In-App Legal Terms & Privacy Sheet Modal */}
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
    paddingHorizontal: 28,
  },
  heroLogoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SCREEN_HEIGHT * 0.06,
  },
  bottomArea: {
    width: '100%',
    paddingBottom: 8,
  },
  headlineBox: {
    minHeight: 76,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 26,
    paddingHorizontal: 8,
  },
  headlineText: {
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 35,
    letterSpacing: -0.4,
  },
  cursor: {
    fontSize: 26,
    fontWeight: '900',
  },
  buttonsGroup: {
    width: '100%',
    gap: 14,
    marginBottom: 20,
  },
  pillBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  pillBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pillBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  disclaimerBox: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  disclaimerLink: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
