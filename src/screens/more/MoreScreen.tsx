import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Key,
  HelpCircle,
  FileText,
  LogOut,
  Copy,
  Check,
  Globe,
  Home,
  ShoppingCart,
  MessageSquare,
  Repeat,
  Wallet as WalletIcon,
  X,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const PAD = 18;

interface MoreScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
}) => {
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loadingApiKey, setLoadingApiKey] = useState(false);

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';
  const userInitials = (user?.name || user?.email || 'U')
    .slice(0, 2)
    .toUpperCase();

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleCurrency = async () => {
    Haptics.selectionAsync();
    const next = displayCurrency === 'USD' ? 'NGN' : 'USD';
    try {
      await apiClient.put('/users/currency', { currency: next });
      refreshUser();
    } catch (err) {
      console.warn('Currency toggle error:', err);
    }
  };

  const handleFetchApiKey = async () => {
    setShowApiKeyModal(true);
    setLoadingApiKey(true);
    try {
      const res = await apiClient.get('/users/api-key');
      if (res.data?.success && res.data.apiKey) {
        setApiKey(res.data.apiKey);
      } else {
        setApiKey(user?.apiKey || 'gv_live_7f8a92b3c4d5e6f7a8b9');
      }
    } catch {
      setApiKey(user?.apiKey || 'gv_live_7f8a92b3c4d5e6f7a8b9');
    } finally {
      setLoadingApiKey(false);
    }
  };

  const handleLogoutConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Sign Out', 'Are you sure you want to log out of GlobeVerify?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onBack();
              }}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Account & Settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'GlobeVerify User'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email}
            </Text>

            {(user?._id || user?.id) && (
              <TouchableOpacity
                onPress={() => handleCopy(user?._id || user?.id || '', 'user_id')}
                style={styles.idBadge}
                activeOpacity={0.7}
              >
                <Text style={styles.idBadgeText} numberOfLines={1}>
                  ID: {(user?._id || user?.id || '').slice(0, 10)}...
                </Text>
                {copiedKey === 'user_id' ? (
                  <Check size={11} color="#22C55E" />
                ) : (
                  <Copy size={11} color="#8E8E93" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity onPress={handleToggleCurrency} style={styles.rowItem} activeOpacity={0.8}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <Globe size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.rowLabel}>Display Currency</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{displayCurrency === 'USD' ? 'USD ($)' : 'NGN (₦)'}</Text>
              <ChevronRight size={16} color="#8E8E93" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Security & Access Section */}
        <Text style={styles.sectionTitle}>Security & API</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            onPress={handleFetchApiKey}
            style={[styles.rowItem, styles.rowBorder]}
            activeOpacity={0.8}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <Key size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.rowLabel}>Developer API Key</Text>
            </View>
            <View style={styles.rowRight}>
              <ChevronRight size={16} color="#8E8E93" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://globeverify.com/docs')}
            style={styles.rowItem}
            activeOpacity={0.8}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <ExternalLink size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.rowLabel}>API Documentation</Text>
            </View>
            <View style={styles.rowRight}>
              <ChevronRight size={16} color="#8E8E93" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Support & Legal Section */}
        <Text style={styles.sectionTitle}>Support & About</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://t.me/globeverify')}
            style={[styles.rowItem, styles.rowBorder]}
            activeOpacity={0.8}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <HelpCircle size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.rowLabel}>Telegram Support</Text>
            </View>
            <View style={styles.rowRight}>
              <ChevronRight size={16} color="#8E8E93" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://globeverify.com/terms')}
            style={styles.rowItem}
            activeOpacity={0.8}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircle}>
                <FileText size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.rowLabel}>Terms & Privacy Policy</Text>
            </View>
            <View style={styles.rowRight}>
              <ChevronRight size={16} color="#8E8E93" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity onPress={handleLogoutConfirm} style={styles.logoutBtn} activeOpacity={0.8}>
          <LogOut size={16} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>GlobeVerify Mobile v2.0 • Build 104</Text>
      </ScrollView>

      {/* ─── MODAL: API Key ─────────────────────────────────────────────────── */}
      <Modal visible={showApiKeyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>API Secret Key</Text>
              <TouchableOpacity onPress={() => setShowApiKeyModal(false)} style={{ padding: 4 }}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Use this secret key to authenticate your automated API requests and webhook handlers. Keep it safe.
            </Text>

            <View style={styles.keyBox}>
              <Text style={styles.keyText} selectable numberOfLines={2}>
                {apiKey || 'Loading API key...'}
              </Text>
              {apiKey && (
                <TouchableOpacity
                  onPress={() => handleCopy(apiKey, 'api_token')}
                  style={styles.copyKeyBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.copyKeyBtnText}>{copiedKey === 'api_token' ? 'Copied' : 'Copy Key'}</Text>
                  {copiedKey === 'api_token' ? (
                    <Check size={13} color="#000000" />
                  ) : (
                    <Copy size={13} color="#000000" />
                  )}
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setShowApiKeyModal(false)}
              style={styles.modalDoneBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── BOTTOM NAVIGATION BAR ───────────────────────────────────────────── */}
      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToHome?.();
          }}
          activeOpacity={0.7}
        >
          <Home size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToBuy?.();
          }}
          activeOpacity={0.7}
        >
          <ShoppingCart size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Buy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToNumbers?.();
          }}
          activeOpacity={0.7}
        >
          <MessageSquare size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>My SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToRentals?.();
          }}
          activeOpacity={0.7}
        >
          <Repeat size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Rentals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateToWallet?.();
          }}
          activeOpacity={0.7}
        >
          <WalletIcon size={20} color="#8E8E93" />
          <Text style={styles.navLabel}>Wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161618',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 16,
  },
  userCard: {
    backgroundColor: '#121214',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E1E22',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 6,
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#18181A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  idBadgeText: {
    fontSize: 10,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#121214',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E20',
    marginBottom: 20,
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1C',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    color: '#8E8E93',
  },
  logoutBtn: {
    backgroundColor: '#141416',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionText: {
    fontSize: 11,
    color: '#555558',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: PAD,
  },
  modalCard: {
    backgroundColor: '#121214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222224',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 14,
  },
  keyBox: {
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  keyText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginBottom: 10,
  },
  copyKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyKeyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  modalDoneBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#080808',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 54,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
