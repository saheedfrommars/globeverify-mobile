import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check,
  RotateCcw,
  Sun,
  Moon,
  Sparkles,
  ChevronLeft,
} from 'lucide-react-native';
import {
  useAppSettings,
  NavigationStyle,
  DialogStyle,
  GlobalLoadingStyle,
  LoadingSpeed,
  AppScreenId,
} from '../../context/WalletSettingsContext';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';
import { SkeletonListItem } from '../../components/ui/Skeleton';

const PAD = 16;

interface CustomizationScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToSettings?: () => void;
}

const NAV_STYLES: Array<{ id: NavigationStyle; label: string; desc: string }> = [
  {
    id: 'floating-pill',
    label: 'Floating Island Dock (Default)',
    desc: 'Modern floating bottom pill dock with smooth active indicator',
  },
  {
    id: 'classic-tabs',
    label: 'Classic Bottom Tabs',
    desc: 'Full-width bottom tab bar with icons & labels',
  },
  {
    id: 'top-bar',
    label: 'Top Navigation Bar',
    desc: 'Horizontal pill tabs directly under the header',
  },
  {
    id: 'compact-dock',
    label: 'Compact Icon Dock',
    desc: 'Minimal floating icon-only dock at the bottom',
  },
  {
    id: 'menu-drawer',
    label: 'Sidebar Drawer Only',
    desc: 'Hide bottom tabs and navigate exclusively via the top-left ☰ slide-out drawer',
  },
];

const DIALOG_STYLES: Array<{ id: DialogStyle; label: string; desc: string }> = [
  {
    id: 'bottom-sheet',
    label: 'Bottom Sheet Modal (Default)',
    desc: 'Smooth slide-up bottom sheet modal with swipe-down gesture & drag handle',
  },
  {
    id: 'center-modern',
    label: 'Modern Center Dialog',
    desc: 'Spring-animated floating center dialog card with soft backdrop',
  },
  {
    id: 'floating-banner',
    label: 'Floating Action Banner',
    desc: 'Compact floating action card near the bottom of the screen',
  },
  {
    id: 'minimal-compact',
    label: 'Minimal Clean Prompt',
    desc: 'Ultra-clean typographic prompt without icons or extra chrome',
  },
];

const START_SCREENS: Array<{ id: AppScreenId; label: string }> = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'buy-number', label: 'Buy Number' },
  { id: 'numbers', label: 'My Numbers' },
  { id: 'rentals', label: 'Rentals' },
  { id: 'wallet', label: 'Wallet' },
];

const LOADING_STYLES: Array<{ id: GlobalLoadingStyle; label: string }> = [
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'wave', label: 'Wave' },
  { id: 'spinner', label: 'Spinner' },
  { id: 'minimal', label: 'Minimal' },
];

export const CustomizationScreen: React.FC<CustomizationScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
  onNavigateToSettings,
}) => {
  const {
    settings,
    colors,
    updateSetting,
    toggleVisibleTab,
    resetToDefaults,
    triggerHaptic,
    showDialog,
    showToast,
  } = useAppSettings();

  const [previewLoading, setPreviewLoading] = useState(false);

  const handleReset = () => {
    showDialog({
      title: 'Reset UI Customizations?',
      message:
        'Restore all navigation, theme, dialog modal, loading, and screen layout customizations to the default GlobeVerify look?',
      variant: 'warning',
      confirmText: 'Reset to Default',
      cancelText: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('warning');
        await resetToDefaults();
        showToast('All UI customizations restored to defaults!', 'success');
      },
    });
  };

  const handleTestDialog = (styleOverride?: DialogStyle) => {
    triggerHaptic('light');
    showDialog({
      title: 'Confirm Action Preview',
      message:
        'This is how confirmation prompts, number cancellations, and account actions appear across GlobeVerify.',
      variant: 'confirm',
      confirmText: 'Confirm Action',
      cancelText: 'Cancel',
      styleOverride,
      onConfirm: () => {
        showToast('Action confirmed!', 'success');
      },
    });
  };

  const handleSelectNavTab = (tab: NavTabId) => {
    if (tab === 'home') onNavigateToHome?.();
    else if (tab === 'buy') onNavigateToBuy?.();
    else if (tab === 'sms') onNavigateToNumbers?.();
    else if (tab === 'rentals') onNavigateToRentals?.();
    else if (tab === 'wallet') onNavigateToWallet?.();
    else if (tab === 'more') onNavigateToSettings?.();
  };

  const renderToggleRow = (
    label: string,
    subtitle: string,
    value: boolean,
    onToggle: (v: boolean) => void,
    isFirst = false
  ) => (
    <View
      style={[
        s.flatRowBetween,
        !isFirst && { borderTopWidth: 1, borderTopColor: colors.border },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[s.rowTitle, { color: colors.text }]}>{label}</Text>
        <Text style={[s.rowSub, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          triggerHaptic('selection');
          onToggle(v);
        }}
        trackColor={{ false: colors.borderStrong, true: '#2563EB' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        title="UI Customization"
        onBack={onBack}
        onPressProfile={onNavigateToSettings}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={s.topTitleBar}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="#2563EB" />
              <Text style={[s.pageTitle, { color: colors.text }]}>
                UI & Display Studio
              </Text>
            </View>
            <Text style={[s.pageSub, { color: colors.textMuted }]}>
              Customize navigation, bottom modals, loading animations, and screen sections
            </Text>
          </View>

          {onNavigateToSettings && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                onNavigateToSettings();
              }}
              style={[
                s.backToSettingsPill,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ChevronLeft size={15} color={colors.primary} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.primary }}>
                Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 1. THEME APPEARANCE ──────────────────────────────────────────── */}
        <View style={s.sectionGroup}>
          <Text style={[s.groupHeading, { color: colors.textMuted }]}>
            THEME APPEARANCE
          </Text>

          <View
            style={[
              s.flatSurface,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={s.flatRowBetween}
              onPress={() => {
                triggerHaptic('selection');
                updateSetting('themeMode', 'light');
              }}
            >
              <View style={s.iconLabelRow}>
                <Sun size={18} color="#2563EB" />
                <Text style={[s.rowTitle, { color: colors.text }]}>
                  Web Light Mode (Default)
                </Text>
              </View>
              {!colors.isDark && <Check size={18} color="#2563EB" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.flatRowBetween,
                { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                updateSetting('themeMode', 'dark');
              }}
            >
              <View style={s.iconLabelRow}>
                <Moon size={18} color="#8B5CF6" />
                <Text style={[s.rowTitle, { color: colors.text }]}>
                  Web Dark Mode
                </Text>
              </View>
              {colors.isDark && <Check size={18} color="#2563EB" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. NAVIGATION & SIDEBAR DRAWER ───────────────────────────────── */}
        <View style={s.sectionGroup}>
          <Text style={[s.groupHeading, { color: colors.textMuted }]}>
            NAVIGATION & SIDEBAR DRAWER
          </Text>

          <View
            style={[
              s.flatSurface,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {renderToggleRow(
              'Show Hamburger Sidebar Menu (☰)',
              'Hidden by default. Enable to show the top-left ☰ button and executive slide-out drawer',
              settings.showHamburgerMenu,
              (v) => updateSetting('showHamburgerMenu', v),
              true
            )}

            {NAV_STYLES.map((item) => {
              const active = settings.navigationStyle === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    updateSetting('navigationStyle', item.id);
                    if (item.id === 'menu-drawer' && !settings.showHamburgerMenu) {
                      updateSetting('showHamburgerMenu', true);
                    }
                  }}
                  style={[
                    s.flatRowBetween,
                    { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={[
                        s.rowTitle,
                        { color: active ? '#2563EB' : colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={[s.rowSub, { color: colors.textMuted }]}>
                      {item.desc}
                    </Text>
                  </View>
                  {active && <Check size={18} color="#2563EB" />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[s.groupHeading, { color: colors.textMuted, marginTop: 8 }]}>
            DEFAULT STARTUP SCREEN
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {START_SCREENS.map((scr) => {
              const active = settings.defaultStartScreen === scr.id;
              return (
                <TouchableOpacity
                  key={scr.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    updateSetting('defaultStartScreen', scr.id);
                  }}
                  style={[
                    s.flatChip,
                    {
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      borderColor: active ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.flatChipText,
                      { color: active ? '#2563EB' : colors.textSecondary },
                    ]}
                  >
                    {scr.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[s.groupHeading, { color: colors.textMuted, marginTop: 8 }]}>
            VISIBLE TABS (FOR BOTTOM / TOP BARS)
          </Text>
          <View style={s.wrapRow}>
            {(
              [
                { key: 'home', label: 'Overview' },
                { key: 'buy', label: 'Buy' },
                { key: 'sms', label: 'Numbers' },
                { key: 'rentals', label: 'Rentals' },
                { key: 'wallet', label: 'Wallet' },
                { key: 'settingsInNav', label: 'Settings' },
              ] as const
            ).map((t) => {
              const enabled = settings.visibleTabs[t.key];
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => {
                    triggerHaptic('selection');
                    toggleVisibleTab(t.key);
                  }}
                  style={[
                    s.flatChip,
                    {
                      backgroundColor: enabled ? colors.primarySoft : colors.surface,
                      borderColor: enabled ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.flatChipText,
                      { color: enabled ? '#2563EB' : colors.textMuted },
                    ]}
                  >
                    {enabled ? '✓ ' : '+ '}
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 3. ACTION DIALOG & BOTTOM MODAL STYLE ────────────────────────── */}
        <View style={s.sectionGroup}>
          <View style={s.headingRowBetween}>
            <Text style={[s.groupHeading, { color: colors.textMuted }]}>
              ACTION DIALOG & BOTTOM MODAL STYLE
            </Text>
            <TouchableOpacity onPress={() => handleTestDialog()}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
                Test Dialog / Modal
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              s.flatSurface,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {DIALOG_STYLES.map((item, idx) => {
              const active = settings.dialogStyle === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    updateSetting('dialogStyle', item.id);
                    handleTestDialog(item.id);
                  }}
                  style={[
                    s.flatRowBetween,
                    idx > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={[
                        s.rowTitle,
                        { color: active ? '#2563EB' : colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={[s.rowSub, { color: colors.textMuted }]}>
                      {item.desc}
                    </Text>
                  </View>
                  {active && <Check size={18} color="#2563EB" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 4. LOADING ANIMATION & SPEED ─────────────────────────────────── */}
        <View style={s.sectionGroup}>
          <View style={s.headingRowBetween}>
            <Text style={[s.groupHeading, { color: colors.textMuted }]}>
              LOADING ANIMATION & SPEED
            </Text>
            <TouchableOpacity onPress={() => setPreviewLoading((p) => !p)}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
                {previewLoading ? 'Hide Preview' : 'Preview Skeleton'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.wrapRow}>
            {LOADING_STYLES.map((ls) => {
              const active = settings.loadingStyle === ls.id;
              return (
                <TouchableOpacity
                  key={ls.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    updateSetting('loadingStyle', ls.id);
                  }}
                  style={[
                    s.flatChip,
                    {
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      borderColor: active ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.flatChipText,
                      { color: active ? '#2563EB' : colors.textSecondary },
                    ]}
                  >
                    {ls.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {(['fast', 'normal', 'calm'] as LoadingSpeed[]).map((spd) => {
              const active = settings.loadingSpeed === spd;
              return (
                <TouchableOpacity
                  key={spd}
                  onPress={() => {
                    triggerHaptic('selection');
                    updateSetting('loadingSpeed', spd);
                  }}
                  style={[
                    s.flatChip,
                    {
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      borderColor: active ? '#2563EB' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.flatChipText,
                      {
                        color: active ? '#2563EB' : colors.textSecondary,
                        textTransform: 'capitalize',
                      },
                    ]}
                  >
                    {spd} Speed
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {previewLoading && <SkeletonListItem />}
        </View>

        {/* ── 5. SCREEN SECTIONS & PRIVACY ─────────────────────────────────── */}
        <View style={s.sectionGroup}>
          <Text style={[s.groupHeading, { color: colors.textMuted }]}>
            SCREEN SECTIONS & PRIVACY
          </Text>

          <View
            style={[
              s.flatSurface,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {renderToggleRow(
              'Dashboard Announcement Popup',
              'Show the live promo / cheap services popup notification on Overview',
              settings.showPromoBanner,
              (v) => updateSetting('showPromoBanner', v),
              true
            )}
            {renderToggleRow(
              'Welcome Heading',
              'Show "Welcome back" title on Overview',
              settings.showDashboardGreeting,
              (v) => updateSetting('showDashboardGreeting', v)
            )}
            {renderToggleRow(
              'Overview Stat Cards',
              'Show Active Numbers, Balance, Net & Gross Spent',
              settings.showDashboardStats,
              (v) => updateSetting('showDashboardStats', v)
            )}
            {renderToggleRow(
              'Spending Overview',
              'Show spending breakdown on Overview',
              settings.showDashboardBreakdown,
              (v) => updateSetting('showDashboardBreakdown', v)
            )}
            {renderToggleRow(
              'SMS Message Preview',
              'Show full SMS text below the verification code',
              settings.showSmsMessagePreview,
              (v) => updateSetting('showSmsMessagePreview', v)
            )}
            {renderToggleRow(
              'Number Expiry Timer',
              'Show live countdown timer on active numbers',
              settings.showExpiryTimer,
              (v) => updateSetting('showExpiryTimer', v)
            )}
            {renderToggleRow(
              'Dual Currency (USD & NGN)',
              'Show both USD and NGN balances in Wallet',
              settings.showDualCurrency,
              (v) => updateSetting('showDualCurrency', v)
            )}
            {renderToggleRow(
              'Hide Balances (Privacy Mode)',
              'Mask wallet & spending amounts with dots',
              settings.privacyHideBalance,
              (v) => updateSetting('privacyHideBalance', v)
            )}
            {renderToggleRow(
              'Haptic Feedback',
              'Subtle tactile vibration on taps and copy actions',
              settings.hapticFeedback,
              (v) => updateSetting('hapticFeedback', v)
            )}
          </View>
        </View>

        {/* ── 6. RESET CUSTOMIZATIONS ──────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleReset}
          style={[
            s.resetCardBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <RotateCcw size={17} color="#EF4444" />
          <Text style={[s.rowTitle, { color: '#EF4444' }]}>
            Reset All Customizations to Default
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav activeTab="more" onSelectTab={handleSelectNavTab} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 8,
    gap: 22,
  },
  topTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageTitle: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  backToSettingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionGroup: {
    gap: 10,
  },
  headingRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  flatSurface: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  flatRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flatChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  flatChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resetCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
});
