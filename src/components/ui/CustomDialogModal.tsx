import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Dimensions,
} from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  Sparkles,
  X,
} from 'lucide-react-native';
import type { ThemeColors, DialogStyle } from '../../context/WalletSettingsContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type DialogVariant = 'info' | 'confirm' | 'danger' | 'success' | 'warning';

export interface DialogConfig {
  visible: boolean;
  title: string;
  message: string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  styleOverride?: DialogStyle;
}

export interface ToastConfig {
  visible: boolean;
  message: string;
  type?: 'success' | 'info' | 'error';
}

interface CustomDialogModalProps {
  dialog: DialogConfig | null;
  toast: ToastConfig | null;
  dialogStyle: DialogStyle;
  colors: ThemeColors;
  onCloseDialog: () => void;
  onTriggerHaptic: (style?: 'light' | 'medium' | 'selection' | 'success' | 'warning') => void;
}

export const CustomDialogModal: React.FC<CustomDialogModalProps> = ({
  dialog,
  toast,
  dialogStyle,
  colors,
  onCloseDialog,
  onTriggerHaptic,
}) => {
  const effectiveStyle: DialogStyle = dialog?.styleOverride || dialogStyle || 'bottom-sheet';

  // Dialog Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.45)).current;
  const centerScale = useRef(new Animated.Value(0.88)).current;
  const centerOpacity = useRef(new Animated.Value(0)).current;

  // Toast Animations
  const toastTranslateY = useRef(new Animated.Value(-70)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (dialog?.visible) {
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT * 0.45);
      centerScale.setValue(0.88);
      centerOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 20,
          stiffness: 180,
          mass: 0.85,
          useNativeDriver: true,
        }),
        Animated.spring(centerScale, {
          toValue: 1,
          damping: 18,
          stiffness: 200,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(centerOpacity, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [dialog?.visible, effectiveStyle, backdropOpacity, sheetTranslateY, centerScale, centerOpacity]);

  useEffect(() => {
    if (toast?.visible) {
      toastTranslateY.setValue(-70);
      toastOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(toastTranslateY, {
          toValue: 0,
          damping: 17,
          stiffness: 190,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(toastTranslateY, {
          toValue: -70,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toast?.visible, toast?.message, toastTranslateY, toastOpacity]);

  const animateClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT * 0.45,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(centerOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onCloseDialog();
      callback?.();
    });
  };

  // Swipe down to dismiss for Bottom Sheet
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && gesture.dy > 0,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          sheetTranslateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 85 || gesture.vy > 0.75) {
          onTriggerHaptic('light');
          animateClose(dialog?.onCancel);
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            damping: 18,
            stiffness: 180,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const getVariantTheme = (variant: DialogVariant = 'info') => {
    switch (variant) {
      case 'danger':
        return {
          accent: '#EF4444',
          softBg: colors.isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
          icon: <Trash2 size={22} color="#EF4444" strokeWidth={2.2} />,
        };
      case 'warning':
        return {
          accent: '#F59E0B',
          softBg: colors.isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
          icon: <AlertTriangle size={22} color="#F59E0B" strokeWidth={2.2} />,
        };
      case 'success':
        return {
          accent: '#10B981',
          softBg: colors.isDark ? 'rgba(16, 185, 129, 0.16)' : '#D1FAE5',
          icon: <CheckCircle2 size={22} color="#10B981" strokeWidth={2.2} />,
        };
      case 'confirm':
        return {
          accent: '#2563EB',
          softBg: colors.isDark ? 'rgba(59, 130, 246, 0.16)' : '#DBEAFE',
          icon: <Sparkles size={22} color="#2563EB" strokeWidth={2.2} />,
        };
      default:
        return {
          accent: '#2563EB',
          softBg: colors.isDark ? 'rgba(59, 130, 246, 0.16)' : '#DBEAFE',
          icon: <Info size={22} color="#2563EB" strokeWidth={2.2} />,
        };
    }
  };

  const vTheme = getVariantTheme(dialog?.variant);
  const hasCancel = Boolean(dialog?.cancelText || dialog?.onConfirm);

  return (
    <>
      {/* ── FLOATING TOAST PILL (Like Web Sonner Toast!) ─────────────────── */}
      {toast?.visible && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toastWrap,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View
            style={[
              s.toastPill,
              {
                backgroundColor: colors.isDark ? '#1E293B' : '#0F172A',
                borderColor:
                  toast.type === 'error'
                    ? '#EF4444'
                    : toast.type === 'success'
                    ? '#10B981'
                    : '#3B82F6',
              },
            ]}
          >
            <View
              style={[
                s.toastDot,
                {
                  backgroundColor:
                    toast.type === 'error'
                      ? '#EF4444'
                      : toast.type === 'success'
                      ? '#10B981'
                      : '#3B82F6',
                },
              ]}
            />
            <Text style={s.toastText} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── CUSTOM DIALOG / BOTTOM SHEET MODAL ───────────────────────────── */}
      <Modal
        visible={Boolean(dialog?.visible)}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => animateClose(dialog?.onCancel)}
      >
        <View
          style={[
            s.overlayRoot,
            effectiveStyle === 'bottom-sheet' && { justifyContent: 'flex-end' },
            effectiveStyle === 'center-modern' && {
              justifyContent: 'center',
              paddingHorizontal: 22,
            },
            effectiveStyle === 'floating-banner' && {
              justifyContent: 'flex-end',
              paddingHorizontal: 14,
              paddingBottom: 28,
            },
            effectiveStyle === 'minimal-compact' && {
              justifyContent: 'center',
              paddingHorizontal: 28,
            },
          ]}
        >
          {/* Backdrop */}
          <Animated.View
            style={[
              s.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                onTriggerHaptic('light');
                animateClose(dialog?.onCancel);
              }}
            />
          </Animated.View>

          {/* 1. BOTTOM SHEET MODAL (Default) */}
          {effectiveStyle === 'bottom-sheet' && dialog && (
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                s.bottomSheetCard,
                {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]}
            >
              {/* Drag Handle */}
              <View style={s.dragHandleWrap}>
                <View
                  style={[
                    s.dragHandlePill,
                    { backgroundColor: colors.borderStrong },
                  ]}
                />
              </View>

              {/* Top Row: Icon Badge + Close X */}
              <View style={s.sheetHeaderRow}>
                <View style={[s.iconBadge, { backgroundColor: vTheme.softBg }]}>
                  {vTheme.icon}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    onTriggerHaptic('light');
                    animateClose(dialog.onCancel);
                  }}
                  style={[s.closeCircleBtn, { backgroundColor: colors.surfaceSecondary }]}
                >
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[s.dialogTitle, { color: colors.text }]}>
                {dialog.title}
              </Text>
              <Text style={[s.dialogMessage, { color: colors.textMuted }]}>
                {dialog.message}
              </Text>

              <View style={s.sheetActionsRow}>
                {hasCancel && (
                  <TouchableOpacity
                    style={[
                      s.secondaryBtn,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      onTriggerHaptic('selection');
                      animateClose(dialog.onCancel);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.secondaryBtnText, { color: colors.text }]}>
                      {dialog.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    { backgroundColor: vTheme.accent },
                  ]}
                  onPress={() => {
                    onTriggerHaptic('medium');
                    animateClose(() => {
                      dialog.onConfirm?.();
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.primaryBtnText}>
                    {dialog.confirmText || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* 2. MODERN CENTER DIALOG */}
          {effectiveStyle === 'center-modern' && dialog && (
            <Animated.View
              style={[
                s.centerModernCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: centerOpacity,
                  transform: [{ scale: centerScale }],
                },
              ]}
            >
              <View style={[s.iconBadgeCenter, { backgroundColor: vTheme.softBg }]}>
                {vTheme.icon}
              </View>

              <Text style={[s.dialogTitleCenter, { color: colors.text }]}>
                {dialog.title}
              </Text>
              <Text style={[s.dialogMessageCenter, { color: colors.textMuted }]}>
                {dialog.message}
              </Text>

              <View style={s.sheetActionsRow}>
                {hasCancel && (
                  <TouchableOpacity
                    style={[
                      s.secondaryBtn,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      onTriggerHaptic('selection');
                      animateClose(dialog.onCancel);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.secondaryBtnText, { color: colors.text }]}>
                      {dialog.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: vTheme.accent }]}
                  onPress={() => {
                    onTriggerHaptic('medium');
                    animateClose(() => {
                      dialog.onConfirm?.();
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.primaryBtnText}>
                    {dialog.confirmText || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* 3. FLOATING ACTION BANNER */}
          {effectiveStyle === 'floating-banner' && dialog && (
            <Animated.View
              style={[
                s.floatingBannerCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: vTheme.accent,
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]}
            >
              <View style={s.floatingTopRow}>
                <View style={[s.iconBadgeSmall, { backgroundColor: vTheme.softBg }]}>
                  {vTheme.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.floatingTitle, { color: colors.text }]}>
                    {dialog.title}
                  </Text>
                  <Text style={[s.floatingMessage, { color: colors.textMuted }]}>
                    {dialog.message}
                  </Text>
                </View>
              </View>

              <View style={s.sheetActionsRow}>
                {hasCancel && (
                  <TouchableOpacity
                    style={[
                      s.secondaryBtn,
                      {
                        paddingVertical: 10,
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      onTriggerHaptic('selection');
                      animateClose(dialog.onCancel);
                    }}
                  >
                    <Text style={[s.secondaryBtnText, { color: colors.text }]}>
                      {dialog.cancelText || 'Dismiss'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    { paddingVertical: 10, backgroundColor: vTheme.accent },
                  ]}
                  onPress={() => {
                    onTriggerHaptic('medium');
                    animateClose(() => {
                      dialog.onConfirm?.();
                    });
                  }}
                >
                  <Text style={s.primaryBtnText}>
                    {dialog.confirmText || 'Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* 4. MINIMAL COMPACT PROMPT */}
          {effectiveStyle === 'minimal-compact' && dialog && (
            <Animated.View
              style={[
                s.minimalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: centerOpacity,
                  transform: [{ scale: centerScale }],
                },
              ]}
            >
              <Text style={[s.minimalTitle, { color: colors.text }]}>
                {dialog.title}
              </Text>
              <Text style={[s.minimalMessage, { color: colors.textMuted }]}>
                {dialog.message}
              </Text>

              <View style={s.minimalActionsRow}>
                {hasCancel && (
                  <TouchableOpacity
                    onPress={() => {
                      onTriggerHaptic('selection');
                      animateClose(dialog.onCancel);
                    }}
                    style={s.minimalTextBtn}
                  >
                    <Text style={[s.minimalCancelText, { color: colors.textMuted }]}>
                      {dialog.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    onTriggerHaptic('medium');
                    animateClose(() => {
                      dialog.onConfirm?.();
                    });
                  }}
                  style={[
                    s.minimalConfirmPill,
                    { backgroundColor: vTheme.accent },
                  ]}
                >
                  <Text style={s.minimalConfirmText}>
                    {dialog.confirmText || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 42,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '94%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  overlayRoot: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },

  // 1. Bottom Sheet Modal
  bottomSheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dragHandlePill: {
    width: 40,
    height: 4.5,
    borderRadius: 999,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  dialogMessage: {
    fontSize: 14,
    lineHeight: 21,
  },
  sheetActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13.5,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 13.5,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // 2. Center Modern Card
  centerModernCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  iconBadgeCenter: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dialogTitleCenter: {
    fontSize: 18.5,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dialogMessageCenter: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },

  // 3. Floating Action Banner
  floatingBannerCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  floatingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBadgeSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  floatingMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },

  // 4. Minimal Compact Card
  minimalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  minimalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
  },
  minimalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  minimalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  minimalTextBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  minimalCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  minimalConfirmPill: {
    paddingHorizontal: 18,
    paddingVertical: 9.5,
    borderRadius: 10,
  },
  minimalConfirmText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
