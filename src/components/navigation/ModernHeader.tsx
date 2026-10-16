import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Globe,
  Bell,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

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
}

export const ModernHeader: React.FC<ModernHeaderProps> = ({
  title,
  subtitle,
  onBack,
  showCurrencyToggle,
  onToggleCurrency,
  displayCurrency = 'USD',
  rightElement,
  onPressProfile,
  onPressNotifications,
  onRefresh,
  isRefreshing,
}) => {
  const { user } = useAuth();
  const userInitials = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <View style={styles.container}>
      {/* ── LEFT SECTION ────────────────────────────────────────────── */}
      <View style={styles.leftSection}>
        {onBack ? (
          <View style={styles.backTitleRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onBack();
              }}
              style={styles.frostedBackBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.titleCol}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.brandBadge}>
            <View style={styles.brandIconWrap}>
              <Globe size={14} color="#3B82F6" strokeWidth={2.5} />
            </View>
            <Text style={styles.brandTitle}>GlobeVerify</Text>
            <View style={styles.livePulseDot} />
          </View>
        )}
      </View>

      {/* ── RIGHT SECTION ───────────────────────────────────────────── */}
      <View style={styles.rightSection}>
        {rightElement ? (
          rightElement
        ) : (
          <>
            {/* Currency switcher pill */}
            {showCurrencyToggle && onToggleCurrency && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  onToggleCurrency();
                }}
                style={styles.currencyPill}
                activeOpacity={0.8}
              >
                <Text style={styles.currencyPillText}>
                  {displayCurrency === 'NGN' ? '🇳🇬 NGN' : '🇺🇸 USD'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Refresh button if provided */}
            {onRefresh && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onRefresh();
                }}
                style={styles.frostedIconBtn}
                activeOpacity={0.7}
              >
                <RefreshCw
                  size={15}
                  color={isRefreshing ? '#3B82F6' : '#8E8E93'}
                  style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
                />
              </TouchableOpacity>
            )}

            {/* Notification button */}
            {onPressNotifications && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  onPressNotifications();
                }}
                style={styles.frostedIconBtn}
                activeOpacity={0.7}
              >
                <Bell size={16} color="#8E8E93" />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
            )}

            {/* Profile Avatar with Verified Ring */}
            {onPressProfile && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  onPressProfile();
                }}
                style={styles.avatarBtn}
                activeOpacity={0.8}
              >
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarText}>{userInitials}</Text>
                </View>
                <View style={styles.onlineBadge} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#080808',
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  backTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  frostedBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 7,
  },
  brandIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPill: {
    backgroundColor: '#141416',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currencyPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  frostedIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  avatarBtn: {
    position: 'relative',
    marginLeft: 2,
  },
  avatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E22',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#080808',
  },
});
