import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import {
  Globe,
  Bell,
  BellOff,
  Sun,
  Moon,
  Menu,
  X,
  LayoutGrid,
  Smartphone,
  ShoppingCart,
  PhoneCall,
  Wallet,
  Settings,
  LogOut,
  Code,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  WifiOff,
  RefreshCw,
  Users,
  Headphones,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings, AppScreenId } from '../../context/WalletSettingsContext';
import { formatCurrency } from '../../utils/currency';
import { ALL_NAV_TABS } from './ModernBottomNav';
import apiClient, {
  subscribeNetworkStatus,
  getIsOffline,
  getCachedData,
  setCachedData,
} from '../../api/client';
import { socketService } from '../../services/socketService';
import {
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from '../../services/pushNotificationService';

// Module-level cache so switching screens never lags or resets the header badge!
let cachedNotifications: NotificationItem[] = [];
let cachedUnreadCount = 0;
let lastNotifFetchTimestamp = 0;

interface NotificationItem {
  _id?: string;
  id?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface ModernHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showCurrencyToggle?: boolean;
  onToggleCurrency?: () => void;
  displayCurrency?: 'USD' | 'NGN';
  rightElement?: React.ReactNode;
  onPressProfile?: () => void;
  onPressNotifications?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  notificationCount?: number;
}

interface DrawerSection {
  heading: string;
  items: Array<{
    id: string;
    label: string;
    sublabel?: string;
    screenId: AppScreenId;
    icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
    badge?: string;
    accentBlue?: boolean;
  }>;
}

const MATURE_DRAWER_SECTIONS: DrawerSection[] = [
  {
    heading: 'CORE SERVICES',
    items: [
      { id: 'overview', label: 'Overview', screenId: 'dashboard', icon: LayoutGrid },
      { id: 'my-numbers', label: 'My Numbers', screenId: 'numbers', icon: Smartphone },
      { id: 'buy-number', label: 'Buy Number', screenId: 'buy-number', icon: ShoppingCart },
      {
        id: 'cheap-numbers',
        label: 'Cheap Numbers',
        screenId: 'buy-number',
        icon: ShoppingCart,
        accentBlue: true,
        badge: 'USA 50% OFF',
      },
      { id: 'rentals', label: 'Rental Numbers', screenId: 'rentals', icon: PhoneCall },
    ],
  },
  {
    heading: 'FINANCE & DEVELOPER',
    items: [
      { id: 'wallet', label: 'Wallet & Billing', screenId: 'wallet', icon: Wallet },
      { id: 'affiliate', label: 'Affiliate & Earnings', screenId: 'affiliate', icon: Users, badge: '10%' },
      { id: 'api-keys', label: 'API Keys & Webhooks', screenId: 'developer', icon: Code },
    ],
  },
  {
    heading: 'ACCOUNT & SUPPORT',
    items: [
      { id: 'support', label: 'Support & Live Chat', screenId: 'support', icon: Headphones },
      { id: 'settings', label: 'Account Settings', screenId: 'more', icon: Settings },
      {
        id: 'customization',
        label: 'UI Customization Studio',
        screenId: 'customization',
        icon: Sparkles,
      },
      {
        id: 'legal',
        label: 'Terms & Privacy Policy',
        screenId: 'legal',
        icon: ShieldCheck,
      },
    ],
  },
];

const ModernHeaderComponent: React.FC<ModernHeaderProps> = ({
  title,
  onBack,
  rightElement,
  onPressProfile,
  onPressNotifications,
  onRefresh,
  notificationCount,
}) => {
  const { user, logout, refreshUser } = useAuth();
  const {
    settings,
    colors,
    activeScreen,
    setActiveScreen,
    toggleTheme,
    updateSetting,
    triggerHaptic,
    showToast,
  } = useAppSettings();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(cachedNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(cachedUnreadCount);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(getIsOffline());
  const [retryingNet, setRetryingNet] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((offline) => {
      setIsOffline(offline);
    });
    return unsubscribe;
  }, []);

  const fetchNotifications = async (force = false) => {
    if (!user) return;
    const now = Date.now();
    // Avoid re-fetching on every screen transition if fetched within last 25s
    if (!force && lastNotifFetchTimestamp > 0 && now - lastNotifFetchTimestamp < 25000) {
      return;
    }

    if (force && notifications.length === 0) {
      setLoadingNotifs(true);
    }

    try {
      const res = await apiClient.get('/notifications?limit=20', { timeout: 6000 });
      if (res.data?.success) {
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        const count = typeof res.data.unreadCount === 'number' ? res.data.unreadCount : 0;
        cachedNotifications = list;
        cachedUnreadCount = count;
        lastNotifFetchTimestamp = Date.now();
        setNotifications(list);
        setUnreadCount(count);
        setCachedData('header_notifs', { list, count });
      }
    } catch {
      // Load from offline storage if memory cache is empty
      if (cachedNotifications.length === 0) {
        const stored = await getCachedData<{ list: NotificationItem[]; count: number }>(
          'header_notifs'
        );
        if (stored) {
          cachedNotifications = stored.list || [];
          cachedUnreadCount = stored.count || 0;
          setNotifications(cachedNotifications);
          setUnreadCount(cachedUnreadCount);
        }
      }
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifications(false);
    const interval = setInterval(() => fetchNotifications(true), 45000);
    const unsubSocket = socketService.subscribe('new_notification', (data: any) => {
      fetchNotifications(true);
      if (data?.title && !settings.soundMuted) {
        showToast(`${data.title}${data.message ? ': ' + data.message : ''}`, 'info');
      }
    });
    return () => {
      clearInterval(interval);
      unsubSocket();
    };
  }, [user?._id, settings.soundMuted]);

  const markAsRead = async (id: string) => {
    try {
      const nextList = cachedNotifications.map((n) =>
        (n._id || n.id) === id ? { ...n, read: true } : n
      );
      const nextCount = Math.max(0, cachedUnreadCount - 1);
      cachedNotifications = nextList;
      cachedUnreadCount = nextCount;
      setNotifications(nextList);
      setUnreadCount(nextCount);
      setCachedData('header_notifs', { list: nextList, count: nextCount });
      await apiClient.patch(`/notifications/${id}/read`);
    } catch {}
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await apiClient.patch('/notifications/read-all');
      const nextList = cachedNotifications.map((n) => ({ ...n, read: true }));
      cachedNotifications = nextList;
      cachedUnreadCount = 0;
      setNotifications(nextList);
      setUnreadCount(0);
      setCachedData('header_notifs', { list: nextList, count: 0 });
      showToast('All notifications marked as read', 'success');
    } catch {} finally {
      setMarkingAll(false);
    }
  };

  const handleRetryConnection = async () => {
    triggerHaptic('light');
    setRetryingNet(true);
    try {
      await Promise.all([refreshUser(), fetchNotifications(true)]);
      if (onRefresh) onRefresh();
    } catch {} finally {
      setRetryingNet(false);
    }
  };

  const badgeNumber = notificationCount !== undefined ? notificationCount : unreadCount;

  const userInitial = (user?.name || user?.email || 'S').trim().charAt(0).toUpperCase();
  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';
  const userBalance =
    displayCurrency === 'NGN'
      ? user?.balances?.ngn ?? (user?.currency === 'NGN' ? user?.balance : (user?.balance || 0) * 1600)
      : user?.balances?.usd ?? (user?.currency === 'USD' ? user?.balance : (user?.balance || 0));

  // Hamburger is hidden by default unless enabled in Settings or Navigation Style is 'menu-drawer'
  const isHamburgerVisible =
    settings.showHamburgerMenu || settings.navigationStyle === 'menu-drawer';

  const visibleTabs = ALL_NAV_TABS.filter(
    (t) => settings.visibleTabs[t.visibilityKey]
  );

  const openDrawer = () => {
    triggerHaptic('light');
    setDrawerVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 24,
        stiffness: 220,
        mass: 0.85,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDrawerVisible(false);
      cb?.();
    });
  };

  useEffect(() => {
    if (!drawerVisible) {
      slideAnim.setValue(-300);
      fadeAnim.setValue(0);
    }
  }, [drawerVisible, slideAnim, fadeAnim]);

  const handleNavigate = (screenId: AppScreenId) => {
    triggerHaptic('light');
    closeDrawer(() => {
      setActiveScreen(screenId);
    });
  };

  const menuIconColor = colors.isDark ? '#E2E8F0' : '#2563EB';
  const themeIconColor = colors.isDark ? '#9CA3AF' : '#2563EB';
  const bellIconColor = colors.isDark ? '#9CA3AF' : '#2563EB';
  const muteIconColor = settings.soundMuted
    ? '#EF4444'
    : colors.isDark
    ? '#E2E8F0'
    : '#334155';

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.headerRow,
          settings.compactHeader && { height: 46 },
        ]}
      >
        {/* ── OPTIONAL LEFT HAMBURGER (Hidden by default; enabled in Settings!) ── */}
        {isHamburgerVisible && (
          <TouchableOpacity
            onPress={openDrawer}
            style={[
              styles.floatingMenuCircle,
              {
                backgroundColor: colors.isDark ? '#141416' : '#FFFFFF',
                borderColor: colors.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                shadowColor: colors.shadowColor,
              },
            ]}
            activeOpacity={0.75}
          >
            <Menu size={20} color={menuIconColor} strokeWidth={2.2} />
          </TouchableOpacity>
        )}

        {/* ── STRETCHED FLOATING PILL BAR ────────────────────────────────── */}
        {rightElement ? (
          <View style={styles.customRightWrap}>{rightElement}</View>
        ) : (
          <View
            style={[
              styles.floatingHeaderPill,
              {
                backgroundColor: colors.isDark ? '#141416' : '#FFFFFF',
                borderColor: colors.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                shadowColor: colors.shadowColor,
              },
            ]}
          >
            {/* Left inside Pill: Back button or Clean Brand / Page Title */}
            <View style={styles.pillLeftBrand}>
              {onBack ? (
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('selection');
                    onBack();
                  }}
                  style={styles.pillBackBtn}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={18} color={colors.primary} strokeWidth={2.4} />
                  <Text
                    style={[styles.pillBrandText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {title || 'Back'}
                  </Text>
                </TouchableOpacity>
              ) : !isHamburgerVisible ? (
                <View style={styles.pillBrandRow}>
                  <Globe size={18} color="#2563EB" strokeWidth={2.2} />
                  <Text
                    style={[styles.pillBrandText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {title || 'GlobeVerify'}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Right inside Pill: Theme, Mute, Bell, Avatar */}
            <View style={styles.pillRightIcons}>
              <TouchableOpacity
                onPress={toggleTheme}
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                {colors.isDark ? (
                  <Moon size={19} color={themeIconColor} strokeWidth={2} />
                ) : (
                  <Sun size={19} color={themeIconColor} strokeWidth={2} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('selection');
                  const nextMuted = !settings.soundMuted;
                  updateSetting('soundMuted', nextMuted);
                  if (nextMuted) {
                    unregisterPushNotificationsAsync().catch(() => {});
                  } else {
                    registerForPushNotificationsAsync().catch(() => {});
                  }
                  showToast(
                    nextMuted
                      ? 'Push notifications disabled'
                      : 'Push notifications enabled!',
                    nextMuted ? 'info' : 'success'
                  );
                }}
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                {settings.soundMuted ? (
                  <BellOff size={19} color={colors.textMuted} strokeWidth={2} />
                ) : (
                  <Bell size={19} color={colors.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  if (onPressNotifications) {
                    onPressNotifications();
                  } else {
                    setNotifOpen(true);
                    fetchNotifications(true);
                  }
                }}
                style={styles.headerBellBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Bell size={19} color={bellIconColor} strokeWidth={2} />
                {badgeNumber > 0 && (
                  <View style={styles.redBadgePill}>
                    <Text style={styles.redBadgeText}>
                      {badgeNumber > 99 ? '99+' : badgeNumber}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('selection');
                  if (onPressProfile) onPressProfile();
                  else setActiveScreen('more');
                }}
                style={styles.userAvatarCircle}
                activeOpacity={0.85}
              >
                <Text style={styles.userAvatarLetter}>{userInitial}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── OFFLINE CONNECTIVITY BANNER (Automatically appears when offline!) ── */}
      {isOffline && (
        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: colors.isDark ? '#27170A' : '#FFFBEB',
              borderColor: '#F59E0B',
            },
          ]}
        >
          <WifiOff size={14} color="#F59E0B" />
          <Text
            style={[
              styles.offlineBannerText,
              { color: colors.isDark ? '#FDE68A' : '#92400E' },
            ]}
            numberOfLines={1}
          >
            Offline mode · Showing saved data
          </Text>
          <TouchableOpacity
            onPress={handleRetryConnection}
            disabled={retryingNet}
            style={styles.offlineRetryBtn}
            activeOpacity={0.75}
          >
            <RefreshCw size={12} color="#F59E0B" />
            <Text style={styles.offlineRetryText}>
              {retryingNet ? 'Checking...' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── OPTIONAL TOP NAVIGATION BAR (When Navigation Style = 'top-bar') ── */}
      {settings.navigationStyle === 'top-bar' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topNavScroll}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeScreen === tab.screenId;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  triggerHaptic('light');
                  setActiveScreen(tab.screenId);
                }}
                style={[
                  styles.topNavPill,
                  {
                    backgroundColor: isActive ? colors.primarySoft : 'transparent',
                  },
                ]}
                activeOpacity={0.75}
              >
                <Icon
                  size={15}
                  color={isActive ? colors.primary : colors.textMuted}
                  strokeWidth={isActive ? 2.3 : 1.9}
                />
                <Text
                  style={[
                    styles.topNavText,
                    { color: isActive ? colors.primary : colors.textSecondary },
                    isActive && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── MATURE, EXECUTIVE SLIDE-OUT SIDEBAR DRAWER (Lazy-mounted for 0ms header render!) ── */}
      {drawerVisible && (
        <Modal
          visible={drawerVisible}
          transparent
          animationType="none"
          onRequestClose={() => closeDrawer()}
        >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[
              styles.backdropOverlay,
              { opacity: fadeAnim },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => closeDrawer()}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.sidebarSheet,
              {
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* 1. Executive Brand Header */}
            <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.sidebarBrandRow}>
                <Globe size={21} color="#2563EB" strokeWidth={2.2} />
                <Text style={[styles.sidebarBrandText, { color: colors.text }]}>
                  GlobeVerify
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => closeDrawer()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.sidebarCloseBtn}
              >
                <X size={19} color={colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* 2. Compact Account Summary Strip */}
            <TouchableOpacity
              style={[styles.userProfileStrip, { borderBottomColor: colors.border }]}
              onPress={() => handleNavigate('wallet')}
              activeOpacity={0.75}
            >
              <View style={styles.stripAvatar}>
                <Text style={styles.stripAvatarText}>{userInitial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.stripUserName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {user?.name || 'GlobeVerify Account'}
                </Text>
                <Text
                  style={[styles.stripUserBalance, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {settings.privacyHideBalance
                    ? 'Balance Hidden'
                    : `Balance: ${formatCurrency(userBalance || 0, displayCurrency)}`}
                </Text>
              </View>
              <ChevronRight size={15} color={colors.textMuted} />
            </TouchableOpacity>

            {/* 3. Categorized Navigation Sections */}
            <ScrollView
              style={styles.sidebarNavScroll}
              contentContainerStyle={styles.sidebarNavContent}
              showsVerticalScrollIndicator={false}
            >
              {MATURE_DRAWER_SECTIONS.map((section) => (
                <View key={section.heading} style={styles.drawerSectionBlock}>
                  <Text style={[styles.drawerSectionHeading, { color: colors.textMuted }]}>
                    {section.heading}
                  </Text>

                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      activeScreen === item.screenId &&
                      item.id !== 'cheap-numbers' &&
                      item.id !== 'api-keys';

                    const itemColor = isActive
                      ? colors.primary
                      : item.accentBlue
                      ? colors.primary
                      : colors.isDark
                      ? '#CBD5E1'
                      : '#334155';

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleNavigate(item.screenId)}
                        style={[
                          styles.sidebarNavItem,
                          isActive && {
                            backgroundColor: colors.isDark
                              ? 'rgba(59, 130, 246, 0.14)'
                              : '#EFF6FF',
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        {isActive && (
                          <View
                            style={[
                              styles.activeLeftBar,
                              { backgroundColor: colors.primary },
                            ]}
                          />
                        )}
                        <Icon
                          size={18}
                          color={itemColor}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                        <Text
                          style={[
                            styles.sidebarNavLabel,
                            { color: itemColor, flex: 1 },
                            isActive && { fontWeight: '700' },
                          ]}
                        >
                          {item.label}
                        </Text>

                        {item.badge && (
                          <View
                            style={[
                              styles.drawerBadgePill,
                              { backgroundColor: colors.primarySoft },
                            ]}
                          >
                            <Text
                              style={[
                                styles.drawerBadgeText,
                                { color: colors.primary },
                              ]}
                            >
                              {item.badge}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* 4. Refined Footer */}
            <View style={[styles.sidebarFooter, { borderTopColor: colors.border }]}>
              <View style={styles.poweredByRow}>
                <ShieldCheck size={13} color={colors.textMuted} />
                <Text style={[styles.poweredByText, { color: colors.textMuted }]}>
                  Secured by GlobeVerify
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  closeDrawer(() => logout?.());
                }}
                style={styles.logoutRow}
                activeOpacity={0.7}
              >
                <LogOut size={17} color="#EF4444" strokeWidth={2} />
                <Text style={styles.logoutText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      )}

      {/* ── NOTIFICATION DROPDOWN POPUP (Lazy-mounted for 0ms header render!) ── */}
      {notifOpen && (
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <View style={styles.notifBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setNotifOpen(false)}
          />
          <View
            style={[
              styles.notifDropdownCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.notifHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.notifHeaderTitle, { color: colors.text }]}>
                Notifications
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={markAllRead}
                    disabled={markingAll}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.markAllBtnText, { color: colors.primary }]}>
                      {markingAll ? 'Marking...' : 'Mark all read'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setNotifOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.notifListScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {loadingNotifs && notifications.length === 0 ? (
                <View style={styles.emptyNotifsWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyNotifsWrap}>
                  <Text style={[styles.emptyNotifsText, { color: colors.textMuted }]}>
                    No notifications
                  </Text>
                </View>
              ) : (
                notifications.map((n, idx) => {
                  const nid = n._id || n.id || String(idx);
                  return (
                    <TouchableOpacity
                      key={nid}
                      onPress={() => {
                        triggerHaptic('selection');
                        if (!n.read && (n._id || n.id)) {
                          markAsRead((n._id || n.id)!);
                        }
                        if (
                          n.type === 'otp_received' ||
                          n.type === 'purchase' ||
                          n.type === 'expiry_warning'
                        ) {
                          setNotifOpen(false);
                          setActiveScreen('numbers');
                        } else if (n.type === 'payment') {
                          setNotifOpen(false);
                          setActiveScreen('wallet');
                        }
                      }}
                      activeOpacity={0.75}
                      style={[
                        styles.notifItemRow,
                        {
                          borderBottomColor: colors.border,
                          backgroundColor: !n.read
                            ? 'rgba(59, 130, 246, 0.06)'
                            : 'transparent',
                        },
                      ]}
                    >
                      <View style={styles.notifContentCol}>
                        <Text style={[styles.notifTitleText, { color: colors.text }]}>
                          {n.title}
                        </Text>
                        <Text
                          style={[
                            styles.notifMessageText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {n.message}
                        </Text>
                        <Text style={[styles.notifTimeText, { color: colors.textMuted }]}>
                          {n.createdAt
                            ? new Date(n.createdAt).toLocaleDateString()
                            : ''}
                        </Text>
                      </View>
                      {!n.read && (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}
    </View>
  );
};

export const ModernHeader = React.memo(ModernHeaderComponent);

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerRow: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingMenuCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  floatingHeaderPill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 7,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  pillLeftBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 8,
  },
  pillBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBrandText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pillRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  customRightWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerIconBtn: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBellBtn: {
    position: 'relative',
    padding: 3,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redBadgePill: {
    position: 'absolute',
    top: -4,
    right: -7,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 20,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  userAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5B46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Top Bar Option
  topNavScroll: {
    paddingTop: 10,
    paddingBottom: 2,
    gap: 6,
  },
  topNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
  },
  topNavText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Mature Slide-out Sidebar Drawer
  modalRoot: {
    flex: 1,
  },
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  sidebarSheet: {
    width: 280,
    height: '100%',
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 54 : 30,
    justifyContent: 'space-between',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sidebarBrandText: {
    fontSize: 18.5,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sidebarCloseBtn: {
    padding: 4,
  },
  userProfileStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  stripAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#5B46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stripUserName: {
    fontSize: 14,
    fontWeight: '700',
  },
  stripUserBalance: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sidebarNavScroll: {
    flex: 1,
  },
  sidebarNavContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 18,
  },
  drawerSectionBlock: {
    gap: 3,
  },
  drawerSectionHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  sidebarNavItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    overflow: 'hidden',
  },
  activeLeftBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  sidebarNavLabel: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  drawerBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  drawerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  sidebarFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  poweredByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poweredByText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14.5,
    fontWeight: '600',
  },
  notifBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 104 : 68,
    paddingHorizontal: 16,
  },
  notifDropdownCard: {
    width: 320,
    maxWidth: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  notifHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifHeaderTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  markAllBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  notifListScroll: {
    maxHeight: 350,
  },
  notifItemRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  notifContentCol: {
    flex: 1,
    gap: 4,
  },
  notifTitleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notifMessageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  notifTimeText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  emptyNotifsWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNotifsText: {
    fontSize: 14,
  },
  offlineBanner: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  offlineRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  offlineRetryText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
