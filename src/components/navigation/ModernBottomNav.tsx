import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  ShoppingCart,
  Smartphone,
  Clock,
  Wallet,
  Settings,
} from 'lucide-react-native';
import { useAppSettings, AppScreenId } from '../../context/WalletSettingsContext';

export type NavTabId = 'home' | 'buy' | 'sms' | 'rentals' | 'wallet' | 'more';

interface ModernBottomNavProps {
  activeTab: NavTabId;
  badgeCount?: number;
  onSelectTab: (tab: NavTabId) => void;
}

interface TabConfig {
  id: NavTabId;
  screenId: AppScreenId;
  visibilityKey: 'home' | 'buy' | 'sms' | 'rentals' | 'wallet' | 'settingsInNav';
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export const ALL_NAV_TABS: TabConfig[] = [
  { id: 'home', screenId: 'dashboard', visibilityKey: 'home', label: 'Overview', icon: Home },
  { id: 'buy', screenId: 'buy-number', visibilityKey: 'buy', label: 'Buy', icon: ShoppingCart },
  { id: 'sms', screenId: 'numbers', visibilityKey: 'sms', label: 'Numbers', icon: Smartphone },
  { id: 'rentals', screenId: 'rentals', visibilityKey: 'rentals', label: 'Rentals', icon: Clock },
  { id: 'wallet', screenId: 'wallet', visibilityKey: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'more', screenId: 'more', visibilityKey: 'settingsInNav', label: 'Settings', icon: Settings },
];

const ModernBottomNavComponent: React.FC<ModernBottomNavProps> = ({
  activeTab,
  badgeCount = 0,
  onSelectTab,
}) => {
  const insets = useSafeAreaInsets();
  const { settings, colors, setActiveScreen, triggerHaptic } = useAppSettings();

  // If user selected Top Bar or Menu Drawer only navigation, hide the bottom bar
  if (settings.navigationStyle === 'top-bar' || settings.navigationStyle === 'menu-drawer') {
    return null;
  }

  const visibleTabs = ALL_NAV_TABS.filter(
    (t) => settings.visibleTabs[t.visibilityKey]
  );

  const handlePress = (tab: TabConfig) => {
    triggerHaptic('light');
    if (tab.id === 'more') {
      setActiveScreen('more');
    } else {
      setActiveScreen(tab.screenId);
      onSelectTab(tab.id);
    }
  };

  // ── STYLE 2: CLASSIC DOCKED BOTTOM TAB BAR ──────────────────────────────────
  if (settings.navigationStyle === 'classic-tabs') {
    return (
      <View
        style={[
          styles.classicBarContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const showBadge = tab.id === 'sms' && badgeCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.classicTabItem}
              onPress={() => handlePress(tab)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.classicIconPill,
                  isActive && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Icon
                  size={19}
                  color={isActive ? colors.primary : colors.textMuted}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                {showBadge && (
                  <View style={[styles.badgeDot, { borderColor: colors.surface }]}>
                    <Text style={styles.badgeText}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.classicTabLabel,
                  { color: isActive ? colors.primary : colors.textMuted },
                  isActive && { fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ── STYLE 3: COMPACT ICON-ONLY FLOATING DOCK ────────────────────────────────
  if (settings.navigationStyle === 'compact-dock') {
    return (
      <View
        style={[
          styles.compactFloatingWrap,
          { bottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View
          style={[
            styles.compactDock,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.shadowColor,
            },
          ]}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const showBadge = tab.id === 'sms' && badgeCount > 0;

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.compactIconBtn,
                  isActive && { backgroundColor: colors.primary },
                ]}
                onPress={() => handlePress(tab)}
                activeOpacity={0.75}
              >
                <Icon
                  size={19}
                  color={isActive ? '#FFFFFF' : colors.textMuted}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                {showBadge && (
                  <View style={[styles.badgeDot, { borderColor: colors.surface }]}>
                    <Text style={styles.badgeText}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // ── STYLE 1 (DEFAULT): WEB-MATCHED FLOATING PILL DOCK ───────────────────────
  return (
    <View
      style={[
        styles.floatingContainer,
        {
          bottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View
        style={[
          styles.islandDock,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const showBadge = tab.id === 'sms' && badgeCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                isActive
                  ? [styles.tabItemActive, { backgroundColor: colors.primarySoft }]
                  : styles.tabItemInactive,
              ]}
              onPress={() => handlePress(tab)}
              activeOpacity={0.75}
            >
              <View style={styles.iconWrapper}>
                <Icon
                  size={isActive ? 18 : 19}
                  color={isActive ? colors.primary : colors.textMuted}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                {showBadge && (
                  <View style={[styles.badgeDot, { borderColor: colors.surface }]}>
                    <Text style={styles.badgeText}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>

              {isActive && (
                <Text
                  style={[styles.activeLabel, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const ModernBottomNav = React.memo(ModernBottomNavComponent);

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  islandDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tabItemInactive: {
    paddingHorizontal: 12,
  },
  tabItemActive: {
    paddingHorizontal: 15,
    gap: 6,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badgeDot: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Classic Bottom Bar
  classicBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    zIndex: 999,
  },
  classicTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  classicIconPill: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 3,
  },
  classicTabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },

  // Compact Icon Dock
  compactFloatingWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  compactDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  compactIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});
