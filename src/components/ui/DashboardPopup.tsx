import React, { useEffect, useState, useRef } from 'react';
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
import {
  X,
  ExternalLink,
  Info,
  AlertTriangle,
  Tag,
  Megaphone,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import apiClient from '../../api/client';

export interface PopupData {
  _id?: string;
  id?: string;
  title: string;
  content: string;
  link?: string;
  linkText?: string;
  type: 'info' | 'warning' | 'promo' | 'success' | 'announcement';
}

interface DashboardPopupProps {
  onNavigateToBuy?: () => void;
}

const DEFAULT_PROMO_POPUP: PopupData = {
  _id: 'default-cheap-usa-promo',
  title: 'Cheap Services Now Available (USA Only)',
  content: 'Get up to 50% to 60% discount on your usual purchases.',
  link: 'https://www.globeverify.com/dashboard/cheap',
  linkText: 'Tap to explore',
  type: 'promo',
};

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  promo: Tag,
  success: Info,
  announcement: Megaphone,
};

// Session-level cache so navigating between tabs doesn't re-show a dismissed popup
let cachedSessionPopup: PopupData | null = null;
const dismissedPopupIds = new Set<string>();

/**
 * Resolves any popup link to https://www.globeverify.com/... if relative,
 * or opens full http(s) URLs directly.
 */
const resolvePopupRedirectUrl = (rawLink?: string): string => {
  const trimmed = (rawLink || '').trim();
  if (!trimmed) {
    return 'https://www.globeverify.com/';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `https://www.globeverify.com${normalizedPath}`;
};

export const DashboardPopup: React.FC<DashboardPopupProps> = () => {
  const { user } = useAuth();
  const { settings, colors, triggerHaptic } = useAppSettings();

  const [popup, setPopup] = useState<PopupData | null>(
    cachedSessionPopup || DEFAULT_PROMO_POPUP
  );
  const [dismissed, setDismissed] = useState<boolean>(() => {
    const active = cachedSessionPopup || DEFAULT_PROMO_POPUP;
    const id = active?._id || active?.id || active?.title;
    return id ? dismissedPopupIds.has(id) : false;
  });

  // Use a single consistent native driver for all transforms
  const translateY = useRef(new Animated.Value(cachedSessionPopup ? 0 : -20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(cachedSessionPopup ? 1 : 0.97)).current;
  const opacity = useRef(new Animated.Value(cachedSessionPopup ? 1 : 0)).current;

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const fetchPopup = async () => {
      try {
        const res = await apiClient.get('/notifications/popup');
        if (!mounted) return;
        // Backend may return raw Mongoose doc where real fields are inside ._doc
        const raw = res.data?.popup;
        const doc: PopupData | null = raw ? (raw._doc ?? raw) : null;

        if (doc && doc.title) {
          cachedSessionPopup = doc;
          const popupKey = doc._id || doc.id || doc.title;
          setDismissed(dismissedPopupIds.has(popupKey));
          setPopup(doc);
        } else {
          cachedSessionPopup = DEFAULT_PROMO_POPUP;
          const fallbackKey =
            DEFAULT_PROMO_POPUP._id || DEFAULT_PROMO_POPUP.title;
          setDismissed(dismissedPopupIds.has(fallbackKey));
          setPopup(DEFAULT_PROMO_POPUP);
        }
      } catch {
        if (!mounted) return;
        cachedSessionPopup = DEFAULT_PROMO_POPUP;
        const fallbackKey =
          DEFAULT_PROMO_POPUP._id || DEFAULT_PROMO_POPUP.title;
        setDismissed(dismissedPopupIds.has(fallbackKey));
        setPopup(DEFAULT_PROMO_POPUP);
      }
    };

    fetchPopup();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (popup && !dismissed) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 280,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 20,
          stiffness: 280,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [popup, dismissed, translateY, scale, opacity]);

  const handleDismiss = () => {
    triggerHaptic('light');
    const popupKey = popup?._id || popup?.id || popup?.title;
    if (popupKey) {
      dismissedPopupIds.add(popupKey);
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDismissed(true);
    });
  };

  // Horizontal drag to dismiss — matches web `drag="x"` with `Math.abs(info.offset.x) > 50`
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 20,
      onPanResponderMove: (_, gesture) => {
        const clampedX = Math.max(-60, Math.min(60, gesture.dx));
        translateX.setValue(clampedX);
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > 50) {
          handleDismiss();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            damping: 20,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          damping: 20,
          stiffness: 280,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!settings.showPromoBanner || !popup || dismissed) {
    return null;
  }

  // Exact type colors & subtle 6% tinted surface matching frontend-globeverify/src/components/DashboardPopup.css
  const getTypeStyle = (type: PopupData['type']) => {
    const primaryColor = colors.isDark ? '#3B82F6' : '#2563EB';
    const accentColor = colors.isDark ? '#8B5CF6' : '#7C3AED';

    switch (type) {
      case 'warning':
        return {
          borderLeftColor: '#F59E0B',
          backgroundColor: colors.isDark ? '#1C160C' : '#FFFBEB',
          iconColor: '#F59E0B',
        };
      case 'promo':
        return {
          borderLeftColor: accentColor,
          backgroundColor: colors.isDark ? '#171326' : '#F3F1FE',
          iconColor: accentColor,
        };
      case 'success':
        return {
          borderLeftColor: '#10B981',
          backgroundColor: colors.isDark ? '#0D1C17' : '#ECFDF5',
          iconColor: '#10B981',
        };
      case 'announcement':
        return {
          borderLeftColor: '#EC4899',
          backgroundColor: colors.isDark ? '#21111B' : '#FDF2F8',
          iconColor: '#EC4899',
        };
      case 'info':
      default:
        return {
          borderLeftColor: primaryColor,
          backgroundColor: colors.isDark ? '#101827' : '#EFF6FF',
          iconColor: primaryColor,
        };
    }
  };

  const typeStyle = getTypeStyle(popup.type);
  const Icon = ICON_MAP[popup.type] || Info;
  const cleanLink = popup.link ? popup.link.trim() : '';
  const hasLink = cleanLink.length > 0;

  const handleOpenLink = async () => {
    if (!hasLink) return;
    triggerHaptic('light');
    const targetUrl = resolvePopupRedirectUrl(cleanLink);
    try {
      await Linking.openURL(targetUrl);
    } catch {}
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.dashboardPopup,
        {
          backgroundColor: typeStyle.backgroundColor,
          borderColor: colors.border,
          borderLeftColor: typeStyle.borderLeftColor,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      {/* .popup-icon */}
      <View style={styles.popupIcon}>
        <Icon size={18} color={typeStyle.iconColor} strokeWidth={2} />
      </View>

      {/* .popup-body */}
      <TouchableOpacity
        style={styles.popupBody}
        onPress={handleOpenLink}
        disabled={!hasLink}
        activeOpacity={hasLink ? 0.78 : 1}
      >
        <Text style={[styles.popupTitle, { color: colors.text }]}>
          {popup.title}
        </Text>
        <Text
          style={[
            styles.popupContent,
            { color: colors.isDark ? '#CBD5E1' : '#334155' },
          ]}
        >
          {popup.content}
        </Text>

        {hasLink && (
          <View style={styles.popupLink}>
            <Text style={[styles.popupLinkText, { color: colors.primary }]}>
              {popup.linkText || 'Learn more'}
            </Text>
            <ExternalLink size={12} color={colors.primary} strokeWidth={2.2} />
          </View>
        )}
      </TouchableOpacity>

      {/* .popup-close */}
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.popupClose}
        accessibilityLabel="Dismiss"
      >
        <X size={16} color={colors.textMuted} strokeWidth={2} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  dashboardPopup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  popupIcon: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBody: {
    flex: 1,
    minWidth: 0,
  },
  popupTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  popupContent: {
    fontSize: 13,
    lineHeight: 18.2,
  },
  popupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 5,
  },
  popupLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  popupClose: {
    padding: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
