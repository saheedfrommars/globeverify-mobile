import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  useFonts,
  Poppins_300Light,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Smartphone,
  Signal,
  Wallet,
  Zap,
  ArrowRight,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Logo } from '../../components/ui/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scenes after the "Welcome → GlobeVerify" intro. One icon, one short line.
const SCENES = [
  { id: 'numbers', Icon: Smartphone, title: 'Virtual numbers', sub: '150+ countries' },
  { id: 'sms', Icon: Zap, title: 'Instant SMS codes', sub: 'Delivered in seconds' },
  { id: 'esim', Icon: Signal, title: 'eSIM data', sub: 'Stay connected anywhere' },
  { id: 'wallet', Icon: Wallet, title: 'Pay in ₦ or $', sub: 'Fast, secure wallet' },
];

const INTRO_WORD_DELAY = 650;
const SCENE_DURATION = 2300;

export interface OnboardingScreenProps {
  onComplete?: (action: 'register' | 'login') => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_800ExtraBold,
  });

  // phase -1 = intro (Welcome → to → GlobeVerify), 0..n-1 = feature scenes
  const [phase, setPhase] = useState(-1);

  // Intro animation values
  const welcomeAnim = useRef(new Animated.Value(0)).current;
  const toAnim = useRef(new Animated.Value(0)).current;
  const brandLetters = useRef('GlobeVerify'.split('').map(() => new Animated.Value(0))).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const introFade = useRef(new Animated.Value(1)).current;

  // Scene animation values
  const sceneAnim = useRef(new Animated.Value(0)).current; // 0 → 1 enter, 1 → 0 exit
  const iconPulse = useRef(new Animated.Value(0)).current;

  // CTA
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const bgGlow = useRef(new Animated.Value(0)).current;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fadeUp = (v: Animated.Value, delay = 0, duration = 600) =>
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

  // ── Intro sequence ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fontsLoaded) return;

    Animated.timing(bgGlow, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      fadeUp(welcomeAnim, 200, 700),
      Animated.delay(INTRO_WORD_DELAY),
      // "Welcome" fades while "to" appears
      Animated.parallel([
        Animated.timing(welcomeAnim, {
          toValue: 0.35,
          duration: 500,
          useNativeDriver: true,
        }),
        fadeUp(toAnim, 0, 500),
      ]),
      Animated.delay(200),
      // GlobeVerify letters stagger in
      Animated.stagger(
        55,
        brandLetters.map((v) =>
          Animated.spring(v, {
            toValue: 1,
            friction: 7,
            tension: 70,
            useNativeDriver: true,
          })
        )
      ),
      fadeUp(logoAnim, 0, 500),
      Animated.delay(900),
    ]).start(({ finished }) => {
      if (!finished) return;
      // Fade intro out, begin feature scenes
      Animated.timing(introFade, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => {
        setPhase(0);
        fadeUp(ctaAnim, 300, 700).start();
      });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  // ── Scene sequence ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase < 0) return;

    sceneAnim.setValue(0);
    iconPulse.setValue(0);
    Animated.parallel([
      Animated.timing(sceneAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(iconPulse, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.timing(sceneAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setPhase((p) => (p + 1) % SCENES.length);
      });
    }, SCENE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleFinish = useCallback(
    (action: 'register' | 'login') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onComplete?.(action);
    },
    [onComplete]
  );

  const jumpTo = (idx: number) => {
    if (idx === phase) return;
    Haptics.selectionAsync();
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase(idx);
  };

  // Keep the screen blank (correct theme colour) until fonts are ready
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const accent = colors.primary;
  const scene = phase >= 0 ? SCENES[phase] : null;
  const SceneIcon = scene?.Icon;

  const sceneTranslate = sceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });
  const sceneScale = sceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const ringScale = iconPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const ringOpacity = iconPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Soft ambient glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: accent,
            opacity: bgGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, isDark ? 0.16 : 0.1],
            }),
          },
        ]}
      />

      {/* Skip */}
      <View style={styles.topRow}>
        <View style={{ width: 60 }} />
        {phase >= 0 && (
          <Animated.View style={{ opacity: ctaAnim }}>
            <Pressable
              hitSlop={14}
              onPress={() => handleFinish('login')}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
            </Pressable>
          </Animated.View>
        )}
        {phase < 0 && <View style={{ width: 60 }} />}
      </View>

      {/* Stage */}
      <View style={styles.stage}>
        {/* INTRO */}
        {phase < 0 && (
          <Animated.View style={[styles.introWrap, { opacity: introFade }]}>
            <Animated.Text
              style={[
                styles.welcome,
                {
                  color: colors.text,
                  opacity: welcomeAnim,
                  transform: [
                    {
                      translateY: welcomeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              Welcome
            </Animated.Text>

            <Animated.Text
              style={[
                styles.to,
                {
                  color: colors.textTertiary,
                  opacity: toAnim,
                  transform: [
                    {
                      translateY: toAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              to
            </Animated.Text>

            <View style={styles.brandRow}>
              {'GlobeVerify'.split('').map((ch, i) => (
                <Animated.Text
                  key={i}
                  style={[
                    styles.brandLetter,
                    {
                      color: i >= 5 ? accent : colors.text,
                      opacity: brandLetters[i],
                      transform: [
                        {
                          translateY: brandLetters[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [26, 0],
                          }),
                        },
                        {
                          scale: brandLetters[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.6, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {ch}
                </Animated.Text>
              ))}
            </View>

            <Animated.View style={{ opacity: logoAnim, marginTop: 28 }}>
              <Logo size={46} />
            </Animated.View>
          </Animated.View>
        )}

        {/* FEATURE SCENES */}
        {scene && SceneIcon && (
          <Animated.View
            style={[
              styles.sceneWrap,
              {
                opacity: sceneAnim,
                transform: [{ translateY: sceneTranslate }, { scale: sceneScale }],
              },
            ]}
          >
            <View style={styles.iconStage}>
              <Animated.View
                style={[
                  styles.ring,
                  {
                    borderColor: accent,
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
              <View
                style={[
                  styles.iconDisc,
                  { backgroundColor: isDark ? 'rgba(59,130,246,0.14)' : '#EFF6FF' },
                ]}
              >
                <SceneIcon size={46} color={accent} strokeWidth={1.8} />
              </View>
            </View>

            <Text style={[styles.sceneTitle, { color: colors.text }]}>{scene.title}</Text>
            <Text style={[styles.sceneSub, { color: colors.textTertiary }]}>{scene.sub}</Text>
          </Animated.View>
        )}
      </View>

      {/* Bottom */}
      <Animated.View
        style={[
          styles.bottom,
          {
            opacity: ctaAnim,
            transform: [
              {
                translateY: ctaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={phase >= 0 ? 'auto' : 'none'}
      >
        <View style={styles.dotsRow}>
          {SCENES.map((s, i) => (
            <Pressable key={s.id} hitSlop={8} onPress={() => jumpTo(i)}>
              <View
                style={[
                  styles.dot,
                  {
                    width: i === phase ? 22 : 7,
                    backgroundColor: i === phase ? accent : isDark ? '#2a2a2a' : '#cbd5e1',
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleFinish('register')}
          style={[styles.cta, { backgroundColor: colors.buttonPrimaryBg }]}
        >
          <Text style={[styles.ctaText, { color: colors.buttonPrimaryText }]}>Get Started</Text>
          <ArrowRight size={18} color={colors.buttonPrimaryText} />
        </TouchableOpacity>

        <Pressable
          onPress={() => handleFinish('login')}
          style={({ pressed }) => [styles.signIn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.signInText, { color: colors.textTertiary }]}>
            Already have an account?{' '}
            <Text style={{ color: accent, fontFamily: 'Poppins_600SemiBold' }}>Sign in</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_WIDTH * 1.3,
    borderRadius: SCREEN_WIDTH,
    top: '18%',
    alignSelf: 'center',
  },
  topRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  skipText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    width: 60,
    textAlign: 'right',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    fontFamily: 'Poppins_300Light',
    fontSize: 38,
    letterSpacing: -0.5,
  },
  to: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLetter: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 44,
    letterSpacing: -1,
  },
  sceneWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconStage: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  ring: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
  },
  iconDisc: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 30,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  sceneSub: {
    fontFamily: 'Poppins_300Light',
    fontSize: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  bottom: {
    paddingHorizontal: 26,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 22,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },
  signIn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  signInText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
});
