import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Home,
  ShoppingCart,
  MessageSquare,
  Repeat,
  Wallet,
} from 'lucide-react-native';

export type NavTabId = 'home' | 'buy' | 'sms' | 'rentals' | 'wallet';

interface ModernBottomNavProps {
  activeTab: NavTabId;
  badgeCount?: number;
  onSelectTab: (tab: NavTabId) => void;
}

interface TabConfig {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const TABS: TabConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'buy', label: 'Buy', icon: ShoppingCart },
  { id: 'sms', label: 'My SMS', icon: MessageSquare },
  { id: 'rentals', label: 'Rentals', icon: Repeat },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

export const ModernBottomNav: React.FC<ModernBottomNavProps> = ({
  activeTab,
  badgeCount = 0,
  onSelectTab,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.floatingContainer,
        {
          bottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={styles.islandDock}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const showBadge = tab.id === 'sms' && badgeCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                isActive ? styles.tabItemActive : styles.tabItemInactive,
              ]}
              onPress={() => {
                if (!isActive) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectTab(tab.id);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrapper}>
                <Icon
                  size={isActive ? 18 : 19}
                  color={isActive ? '#000000' : '#8E8E93'}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                {showBadge && (
                  <View style={[styles.badgeDot, isActive && styles.badgeDotOnActive]}>
                    <Text style={styles.badgeText}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>

              {/* Active Tab expands into a sleek pill showing its title */}
              {isActive && (
                <Text style={styles.activeLabel} numberOfLines={1}>
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

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 999,
  },
  islandDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18, 18, 20, 0.95)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tabItemInactive: {
    paddingHorizontal: 12,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.2,
  },
  badgeDot: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#121214',
  },
  badgeDotOnActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
