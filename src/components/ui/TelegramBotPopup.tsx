import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Send, X, ExternalLink, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';

const DISMISS_KEY = 'gv_telegram_popup_dismissed_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let sessionDismissedTelegramPopup = false;

export const TelegramBotPopup: React.FC = () => {
  const { user } = useAuth();
  const { settings, setActiveScreen, triggerHaptic } = useAppSettings();
  const [visible, setVisible] = useState(false);

  const translateY = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (
      !user ||
      (user as any).isTelegramLinked ||
      sessionDismissedTelegramPopup ||
      !settings.showPromoBanner
    ) {
      setVisible(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const checkAndShow = async () => {
      try {
        const lastDismissed = await AsyncStorage.getItem(DISMISS_KEY);
        if (lastDismissed) {
          const timePassed = Date.now() - parseInt(lastDismissed, 10);
          if (timePassed < SEVEN_DAYS_MS) {
            return;
          }
        }
      } catch {}

      if (!mounted) return;
      timer = setTimeout(() => {
        if (mounted) {
          setVisible(true);
        }
      }, 3500);
    };

    checkAndShow();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [user, settings.showPromoBanner]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 22,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, scale, opacity]);

  const handleDismiss = async (cb?: () => void) => {
    triggerHaptic('light');
    sessionDismissedTelegramPopup = true;
    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 30,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      cb?.();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 8 && Math.abs(gesture.dx) < 25,
      onPanResponderMove: (_, gesture) => {
        const clampedY = Math.max(0, Math.min(80, gesture.dy));
        translateY.setValue(clampedY);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 40) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 300,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  const handleOpenSettings = () => {
    handleDismiss(() => {
      setActiveScreen('more');
    });
  };

  const handleOpenBot = () => {
    handleDismiss(() => {
      Linking.openURL('https://t.me/GlobeVerifyBot').catch(() => {});
    });
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toastCard,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.badgePill}>
          <Sparkles size={12} color="#38BDF8" />
          <Text style={styles.badgeText}>NEW FEATURE</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDismiss()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
          accessibilityLabel="Close"
        >
          <X size={15} color="rgba(255, 255, 255, 0.5)" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.bodyRow}>
        <View style={styles.iconWrap}>
          <Send size={19} color="#FFFFFF" />
        </View>
        <View style={styles.contentCol}>
          <Text style={styles.titleText}>GlobeVerify is on Telegram! 🤖</Text>
          <Text style={styles.descText}>
            Get instant SMS alerts, rent lines, and check your Naira & Dollar
            balances directly in Telegram.
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleOpenSettings}
          activeOpacity={0.85}
        >
          <Send size={13} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Connect Bot</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleOpenBot}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Open Bot</Text>
          <ExternalLink size={12} color="rgba(255, 255, 255, 0.85)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 84,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 16,
    padding: 16,
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 15,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  descText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 17.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
});
