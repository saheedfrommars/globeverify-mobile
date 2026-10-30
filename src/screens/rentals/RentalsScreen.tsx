import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Copy,
  Check,
  Clock,
  Phone,
  Globe,
  XCircle,
  Smartphone,
  Search,
  X,
  Sparkles,
  MessageSquare,
  Send,
  Plus,
  ArrowLeft,
  User,
  ShieldCheck,
  Lock,
  ChevronRight,
  CheckCircle2,
  Zap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { useCall } from '../../context/CallContext';
import apiClient from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { SkeletonNumberCard, SkeletonListItem } from '../../components/ui/Skeleton';
import { AnimatedEmptyState } from '../../components/ui/AnimatedEmptyState';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

const PAD = 16;
const LOADING_TIMEOUT_MS = 15000;

export interface ActiveRental {
  id: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  status: string;
  expiresAt: string;
  purchasedAt?: string;
  cost: number;
  currency?: string;
  provider?: string;
  lineType?: 'voip' | 'non_voip';
  isFullAccess?: boolean;
  serviceName?: string;
  service?: string;
  autoRenew?: boolean;
  otps?: Array<{
    code: string;
    message: string;
    sender: string;
    receivedAt: string;
  }>;
}

export interface AvailableRentalItem {
  phoneNumber?: string;
  region?: string;
  countryCode?: string;
  features?: string[];

  serviceId?: number;
  service?: string;
  serviceName?: string;
  isFullAccess?: boolean;
  available?: number;

  monthlyFee?: number;
  pricing?: Record<string, number>;
  lineType?: 'voip' | 'non_voip';
  currency?: string;
}

export interface RentalCountry {
  code: string;
  name: string;
  flag: string;
}

interface ChatMessage {
  id: string;
  remotePhoneNumber: string;
  direction: 'inbound' | 'outbound';
  text: string;
  timestamp: string;
  code?: string;
}

interface ChatThread {
  remoteNumber: string;
  contactName: string | null;
  latestMessage: {
    text: string;
    direction: 'inbound' | 'outbound';
    timestamp: string;
  };
}

interface RentalsScreenProps {
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToWallet?: () => void;
}

const RENTAL_COUNTRIES: RentalCountry[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
];

const NON_VOIP_CATEGORIES = [
  { id: 'all', label: 'All Services' },
  { id: 'full', label: '★ Full Access' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'cash app', label: 'Cash App' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'google', label: 'Google / Gmail' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'coinbase', label: 'Crypto & Coinbase' },
  { id: 'apple', label: 'Apple / iCloud' },
  { id: 'tinder', label: 'Tinder & Dating' },
  { id: 'instagram', label: 'Instagram' },
];

const getServiceBrand = (serviceName: string, isFullAccess?: boolean) => {
  if (isFullAccess) {
    return { color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)', label: 'Universal' };
  }
  const name = (serviceName || '').toLowerCase();
  if (name.includes('whatsapp')) return { color: '#25D366', bg: 'rgba(37, 211, 102, 0.15)', label: 'WA' };
  if (name.includes('telegram')) return { color: '#0088CC', bg: 'rgba(0, 136, 204, 0.15)', label: 'TG' };
  if (name.includes('cash')) return { color: '#00D632', bg: 'rgba(0, 214, 50, 0.15)', label: '$' };
  if (name.includes('google') || name.includes('gmail') || name.includes('youtube')) return { color: '#EA4335', bg: 'rgba(234, 67, 53, 0.15)', label: 'G' };
  if (name.includes('paypal')) return { color: '#003087', bg: 'rgba(0, 48, 135, 0.15)', label: 'PP' };
  if (name.includes('apple') || name.includes('icloud')) return { color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.15)', label: 'AP' };
  if (name.includes('coinbase') || name.includes('crypto') || name.includes('binance')) return { color: '#0052FF', bg: 'rgba(0, 82, 255, 0.15)', label: '₿' };
  if (name.includes('instagram')) return { color: '#E4405F', bg: 'rgba(228, 64, 95, 0.15)', label: 'IG' };
  if (name.includes('tiktok')) return { color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.15)', label: 'TT' };
  if (name.includes('tinder') || name.includes('bumble') || name.includes('hinge')) return { color: '#FE3C72', bg: 'rgba(254, 60, 114, 0.15)', label: 'TD' };
  return { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', label: (serviceName || 'SIM').slice(0, 2).toUpperCase() };
};

const formatPhoneNumber = (numStr?: string) => {
  if (!numStr) return '';
  const cleaned = numStr.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return numStr;
};

const daysLeft = (expiresAt: string) => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: 'Expired', isCritical: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return { label: `${hours}h left`, isCritical: true };
  return { label: `${days}d left`, isCritical: days <= 3 };
};

// ─── 1. THREADS LIST VIEW (LIST OF PEOPLE WHO MESSAGED) ────────────────────
const RentalThreadsListView: React.FC<{
  rental: ActiveRental;
  onBack: () => void;
  onSelectThread: (remoteNumber: string) => void;
  onNewChat: () => void;
}> = ({ rental, onBack, onSelectThread, onNewChat }) => {
  const { colors } = useAppSettings();
  const isVoip = rental.provider === 'telnyx' || rental.lineType === 'voip';

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadThreads = useCallback(async () => {
    if (!isVoip) {
      // For Non-VoIP: Group received OTPs by sender (e.g. WhatsApp, Telegram, etc.)
      // Reversed so newest message defines the thread preview and appears first
      const grouped: Record<string, ChatThread> = {};
      [...(rental.otps || [])].reverse().forEach((o) => {
        const sender = o.sender || rental.serviceName || 'Verification Service';
        if (!grouped[sender]) {
          grouped[sender] = {
            remoteNumber: sender,
            contactName: sender,
            latestMessage: {
              text: o.message,
              direction: 'inbound',
              timestamp: o.receivedAt || new Date().toISOString(),
            },
          };
        }
      });
      setThreads(Object.values(grouped));
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.get(`/messaging/${rental.id}/threads`);
      if (res.data?.success && Array.isArray(res.data.threads)) {
        setThreads(res.data.threads);
      } else {
        setThreads([]);
      }
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [rental, isVoip]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase().trim();
    return threads.filter((t) => {
      const matchName = (t.contactName || '').toLowerCase().includes(q);
      const matchNum = t.remoteNumber.toLowerCase().includes(q);
      const matchText = (t.latestMessage?.text || '').toLowerCase().includes(q);
      return matchName || matchNum || matchText;
    });
  }, [threads, searchQuery]);

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={colors.statusBar} />

      {/* Header */}
      <View style={[s.threadsHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={s.headerBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[s.threadsHeaderTitle, { color: colors.text }]}>Messages</Text>
          <Text style={[s.threadsHeaderSubtitle, { color: colors.textMuted }]}>
            via {rental.phoneNumber} · {isVoip ? 'VoIP' : 'Physical SIM'}
          </Text>
        </View>

        {/* New message button for VoIP */}
        {isVoip && (
          <TouchableOpacity
            style={[s.headerNewBtn, { backgroundColor: colors.primarySoft }]}
            onPress={onNewChat}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={[s.threadsSearchWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[s.searchBarContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Search size={15} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Threads List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : filteredThreads.length === 0 ? (
          <View style={s.emptyChatBox}>
            <View style={[s.emptyChatIconBox, { backgroundColor: colors.primarySoft }]}>
              <MessageSquare size={32} color={colors.primary} />
            </View>
            <Text style={[s.emptyChatTitle, { color: colors.text }]}>
              No conversations yet
            </Text>
            <Text style={[s.emptyChatSubtitle, { color: colors.textMuted }]}>
              {isVoip
                ? 'Tap the + button above to compose a new message or wait for incoming SMS.'
                : 'Incoming verification SMS and OTP codes will automatically appear here.'}
            </Text>
            {isVoip && (
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                onPress={onNewChat}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={s.primaryBtnText}>Start New Message</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredThreads.map((thread, idx) => {
            const displayName = thread.contactName || thread.remoteNumber;
            const timeStr = thread.latestMessage?.timestamp
              ? new Date(thread.latestMessage.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <TouchableOpacity
                key={thread.remoteNumber || idx}
                style={[
                  s.threadItemRow,
                  { borderBottomColor: colors.border },
                  idx === 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                ]}
                onPress={() => onSelectThread(thread.remoteNumber)}
                activeOpacity={0.7}
              >
                <View style={[s.threadAvatar, { backgroundColor: colors.primary }]}>
                  {isVoip ? (
                    <User size={18} color="#FFFFFF" />
                  ) : (
                    <Smartphone size={18} color="#FFFFFF" />
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[s.threadItemName, { color: colors.text }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{timeStr}</Text>
                  </View>

                  <Text style={[s.threadItemPreview, { color: colors.textMuted }]} numberOfLines={1}>
                    {thread.latestMessage?.direction === 'outbound' ? 'You: ' : ''}
                    {thread.latestMessage?.text || 'New message'}
                  </Text>
                </View>

                <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── 2. CHAT AREA VIEW (CONVERSATION SCREEN) ──────────────────────────────
const RentalConversationChatView: React.FC<{
  rental: ActiveRental;
  recipient: string | null;
  isComposingNew: boolean;
  onBack: () => void;
  openDialpad: (id: string, num: string, initialTab?: 'keypad' | 'recents') => void;
  onSelectRecipient: (num: string) => void;
}> = ({
  rental,
  recipient,
  isComposingNew,
  onBack,
  openDialpad,
  onSelectRecipient,
}) => {
  const { colors, triggerHaptic, showToast } = useAppSettings();
  const isVoip = rental.provider === 'telnyx' || rental.lineType === 'voip';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newChatNumber, setNewChatNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollViewRef = useRef<any>(null);

  const activeTargetNumber = recipient || (newChatNumber.trim() ? newChatNumber.trim() : null);

  const loadMessages = useCallback(async () => {
    if (!isVoip) {
      // Non-VoIP: filter OTPs for this sender
      const filteredOtps = (rental.otps || []).filter((o) => {
        const sender = o.sender || rental.serviceName || 'Verification Service';
        return !recipient || sender === recipient;
      });

      const list: ChatMessage[] = filteredOtps.map((o, idx) => ({
        id: `otp-${idx}-${o.receivedAt}`,
        remotePhoneNumber: o.sender || 'Service',
        direction: 'inbound',
        text: o.message,
        code: o.code,
        timestamp: o.receivedAt || new Date().toISOString(),
      }));
      setMessages(list);
      setLoading(false);
      return;
    }

    if (!recipient) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.get(
        `/messaging/${rental.id}/thread/${encodeURIComponent(recipient)}`
      );
      if (res.data?.success && Array.isArray(res.data.messages)) {
        const list: ChatMessage[] = res.data.messages.map((m: any) => ({
          id: m._id || `${m.timestamp}-${Math.random()}`,
          remotePhoneNumber: m.remotePhoneNumber,
          direction: m.direction,
          text: m.text,
          timestamp: m.timestamp,
        }));
        setMessages(list);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }, [rental, recipient, isVoip]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Live polling for incoming messages every 5 seconds
  useEffect(() => {
    if (!isVoip || !recipient) return;
    const interval = setInterval(() => {
      loadMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [isVoip, recipient, loadMessages]);

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    showToast('Code copied!', 'success');
  };

  const handleSendMessage = async () => {
    if (!isVoip) return;
    const text = messageText.trim();
    const target = activeTargetNumber;

    if (!target) {
      showToast('Enter recipient phone number', 'error');
      return;
    }
    if (!text) {
      showToast('Enter message text', 'error');
      return;
    }

    setSending(true);
    triggerHaptic('medium');

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      remotePhoneNumber: target,
      direction: 'outbound',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await apiClient.post(`/messaging/${rental.id}/send`, {
        to: target,
        text,
      });

      if (res.data?.success) {
        if (isComposingNew) {
          onSelectRecipient(target);
        }
      } else {
        showToast(res.data?.message || 'Failed to send SMS', 'error');
      }
    } catch (err: any) {
      // Fallback
      try {
        const fbRes = await apiClient.post(`/numbers/rentals/${rental.id}/send-sms`, {
          to: target,
          text,
        });
        if (fbRes.data?.success) {
          if (isComposingNew) onSelectRecipient(target);
          return;
        }
      } catch {}

      showToast(
        err?.response?.data?.message || 'Could not send SMS. Check your credit balance.',
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const headerTitle = isComposingNew
    ? newChatNumber || 'New Message'
    : recipient || 'Conversation';

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={colors.statusBar} />

      {/* ── CHAT HEADER ─────────────────────────────────────────────────── */}
      <View style={[s.chatHeaderBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={s.chatBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={[s.chatHeaderAvatar, { backgroundColor: colors.primary }]}>
          <User size={18} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[s.chatContactTitle, { color: colors.text }]} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={[s.chatSubTitle, { color: colors.textMuted }]} numberOfLines={1}>
            via {rental.phoneNumber} · {isVoip ? 'VoIP Line' : 'Physical SIM'}
          </Text>
        </View>

        {/* CALL BUTTON: ONLY SHOWN FOR VOIP NUMBERS! ─────────────────────── */}
        {isVoip && activeTargetNumber && (
          <TouchableOpacity
            style={[s.chatHeaderCallBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              triggerHaptic('medium');
              openDialpad(rental.id, activeTargetNumber);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Phone size={15} color="#FFFFFF" />
            <Text style={s.chatHeaderCallBtnText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* If Composing New Chat: "To:" Bar */}
      {isComposingNew && isVoip && (
        <View style={[s.toBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[s.toLabel, { color: colors.textMuted }]}>To:</Text>
          <TextInput
            style={[s.toInput, { color: colors.text }]}
            placeholder="Recipient phone (e.g. +1 555 123 4567)"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={newChatNumber}
            onChangeText={setNewChatNumber}
            autoFocus
          />
          {newChatNumber.length > 0 && (
            <TouchableOpacity onPress={() => setNewChatNumber('')}>
              <X size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── CHAT MESSAGES STREAM ─────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={s.chatScroll}
          contentContainerStyle={s.chatScrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={s.emptyChatBox}>
              <View style={[s.emptyChatIconBox, { backgroundColor: colors.primarySoft }]}>
                <MessageSquare size={32} color={colors.primary} />
              </View>
              <Text style={[s.emptyChatTitle, { color: colors.text }]}>
                {isVoip ? 'No messages here yet' : 'Waiting for SMS Verification'}
              </Text>
              <Text style={[s.emptyChatSubtitle, { color: colors.textMuted }]}>
                {isVoip
                  ? 'Send a message below to start this conversation.'
                  : 'Incoming OTPs from apps will appear on the left automatically.'}
              </Text>
            </View>
          ) : (
            messages.map((msg, idx) => {
              // My messages on the RIGHT, sender messages on the LEFT
              const isMyChat = msg.direction === 'outbound';

              return (
                <View
                  key={msg.id || idx}
                  style={[
                    s.chatBubbleRow,
                    isMyChat ? s.chatBubbleRowOutbound : s.chatBubbleRowInbound,
                  ]}
                >
                  <View
                    style={[
                      s.chatBubble,
                      isMyChat
                        ? [s.chatBubbleOutbound, { backgroundColor: colors.primary }]
                        : [s.chatBubbleInbound, { backgroundColor: colors.surface, borderColor: colors.border }],
                    ]}
                  >
                    {/* OTP Code Card if available */}
                    {msg.code ? (
                      <View style={s.chatOtpWrap}>
                        <Text style={s.chatOtpCode}>{msg.code}</Text>
                        <TouchableOpacity
                          onPress={() => handleCopy(msg.code!)}
                          style={s.chatOtpCopyBtn}
                        >
                          <Copy size={11} color="#FFFFFF" />
                          <Text style={s.chatOtpCopyText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <Text
                      style={[
                        s.chatBubbleText,
                        { color: isMyChat ? '#FFFFFF' : colors.text },
                      ]}
                      selectable
                    >
                      {msg.text}
                    </Text>

                    <View style={s.chatBubbleMeta}>
                      <Text
                        style={[
                          s.chatBubbleTime,
                          { color: isMyChat ? 'rgba(255, 255, 255, 0.7)' : colors.textMuted },
                        ]}
                      >
                        {msg.timestamp
                          ? new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </Text>
                      {isMyChat && (
                        <Check size={12} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 3 }} />
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ── BOTTOM MESSAGE INPUT / DISABLED FOR NON-VOIP ───────────────── */}
        {isVoip ? (
          <View style={[s.bottomInputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[s.inputContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <TextInput
                style={[s.chatTextInput, { color: colors.text }]}
                placeholder="Text message..."
                placeholderTextColor={colors.textMuted}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1000}
              />

              <TouchableOpacity
                style={[
                  s.chatSendBtn,
                  {
                    backgroundColor: messageText.trim() ? colors.primary : colors.border,
                  },
                ]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={15} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* DISABLED INPUT FOR NON-VOIP NUMBERS ───────────────────────────── */
          <View style={[s.bottomDisabledBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[s.disabledInputBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Lock size={14} color={colors.textMuted} />
              <Text style={[s.disabledInputText, { color: colors.textMuted }]}>
                Non-VoIP SIMs cannot send outbound SMS (Receive-only)
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── 3. MAIN RENTALS SCREEN COMPONENT ──────────────────────────────────────
export const RentalsScreen: React.FC<RentalsScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToWallet,
}) => {
  const { user, refreshUser } = useAuth();
  const { colors, triggerHaptic, showDialog, showToast } = useAppSettings();
  const { openDialpad } = useCall();

  const [tab, setTab] = useState<'active' | 'catalog'>('active');
  const [lineType, setLineType] = useState<'non_voip' | 'voip'>('non_voip');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [nonVoipCatalog, setNonVoipCatalog] = useState<AvailableRentalItem[]>([]);
  const [voipCatalog, setVoipCatalog] = useState<AvailableRentalItem[]>([]);
  const currentCatalog = lineType === 'non_voip' ? nonVoipCatalog : voipCatalog;
  const [selectedCountry, setSelectedCountry] = useState<RentalCountry>(RENTAL_COUNTRIES[0]);

  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingKey, setPurchasingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Two-Step Messaging State ─────────────────────────────────────────────
  const [activeRentalForMessages, setActiveRentalForMessages] = useState<ActiveRental | null>(null);
  const [activeChatRecipient, setActiveChatRecipient] = useState<string | null>(null);
  const [isComposingNew, setIsComposingNew] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, tab, lineType]);

  const displayCurrency = user?.currency?.toUpperCase() === 'NGN' ? 'NGN' : 'USD';

  const [catalogError, setCatalogError] = useState<string | null>(null);

  const fetchActiveRentals = useCallback(async () => {
    try {
      const res = await apiClient.get('/numbers/my-numbers?type=rental', {
        timeout: 10000,
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setActiveRentals(list);
    } catch {
      setActiveRentals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(
    async (currentLineType: 'non_voip' | 'voip', countryCode: string, isManual = false) => {
      setLoadingCatalog(true);
      setCatalogError(null);

      const cacheKey = `gv_catalog_cache_${currentLineType}_${currentLineType === 'voip' ? countryCode : 'US'}_${displayCurrency}`;

      // 1. Immediately hydrate with cached data if available and not a manual refresh
      if (!isManual) {
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (currentLineType === 'non_voip') {
                setNonVoipCatalog(parsed);
              } else {
                setVoipCatalog(parsed);
              }
            }
          }
        } catch {}
      }

      // 2. Fetch live real-time inventory from backend
      try {
        const res = await apiClient.get('/numbers/rentals/options', {
          params: {
            countryCode: currentLineType === 'non_voip' ? 'US' : countryCode,
            currency: displayCurrency,
            lineType: currentLineType,
          },
          timeout: 15000,
        });

        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        if (Array.isArray(data) && data.length > 0) {
          const normalized: AvailableRentalItem[] = data.map((item: any) => ({
            ...item,
            lineType: currentLineType,
            monthlyFee:
              item.pricing?.[30] ||
              item.monthlyFee ||
              (displayCurrency === 'NGN'
                ? currentLineType === 'non_voip' ? 15000 : 9800
                : currentLineType === 'non_voip' ? 10.0 : 6.5),
          }));

          if (currentLineType === 'non_voip') {
            setNonVoipCatalog(normalized);
          } else {
            setVoipCatalog(normalized);
          }

          // Save to local offline cache
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify(normalized));
          } catch {}
        } else {
          if (currentLineType === 'non_voip') {
            setNonVoipCatalog([]);
          } else {
            setVoipCatalog([]);
          }
        }
      } catch (err: any) {
        console.warn('[Rentals Catalog] Live fetch error:', err?.message);
        if (currentLineType === 'non_voip') {
          setNonVoipCatalog((prev) => {
            if (prev.length === 0) {
              setCatalogError('Could not load physical SIM services. Tap to retry.');
            }
            return prev;
          });
        } else {
          setVoipCatalog((prev) => {
            if (prev.length === 0) {
              setCatalogError('Could not load virtual numbers. Tap to retry.');
            }
            return prev;
          });
        }
      } finally {
        setLoadingCatalog(false);
      }
    },
    [displayCurrency]
  );

  useEffect(() => {
    fetchActiveRentals();
  }, [fetchActiveRentals]);

  useEffect(() => {
    if (tab === 'catalog') {
      fetchCatalog(lineType, selectedCountry.code);
    }
  }, [tab, lineType, selectedCountry.code, fetchCatalog]);

  const onRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await Promise.all([
      fetchActiveRentals(),
      fetchCatalog(lineType, selectedCountry.code, true),
      refreshUser(),
    ]);
    setRefreshing(false);
  };

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    triggerHaptic('success');
    setCopiedKey(key);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRentNumber = (item: AvailableRentalItem) => {
    const isNonVoip = lineType === 'non_voip';
    const fee =
      item.monthlyFee ||
      (displayCurrency === 'NGN'
        ? isNonVoip
          ? 12000
          : 9800
        : isNonVoip
        ? 8.5
        : 6.5);
    const displayName = isNonVoip
      ? item.serviceName || item.service || 'Service'
      : item.phoneNumber || 'Number';

    const itemKey = isNonVoip ? String(item.serviceId) : String(item.phoneNumber);

    showDialog({
      title: isNonVoip ? 'Confirm Physical SIM Rental' : 'Confirm 30-Day Number Rental',
      message: isNonVoip
        ? `Rent a dedicated Non-VoIP Physical SIM for ${displayName} (30 days) at ${formatCurrency(fee, displayCurrency)}?`
        : `Lease ${displayName} (${selectedCountry.name}) for 30 days at ${formatCurrency(fee, displayCurrency)}?`,
      variant: 'confirm',
      confirmText: `Rent for ${formatCurrency(fee, displayCurrency)}`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        setPurchasingKey(itemKey);
        triggerHaptic('medium');
        try {
          let res;
          if (isNonVoip) {
            res = await apiClient.post('/numbers/rentals/purchase', {
              serviceId: item.serviceId,
              rentalId: item.serviceId,
              days: 30,
              country: 'US',
              lineType: 'non_voip',
            });
          } else {
            res = await apiClient.post('/numbers/rentals/purchase', {
              phoneNumber: item.phoneNumber,
              rentalId: item.phoneNumber,
              countryCode: selectedCountry.code,
              country: selectedCountry.code,
              days: 30,
              lineType: 'voip',
            });
          }

          if (res.data?.success) {
            showToast(`${displayName} is now active in your rentals!`, 'success');
            await Promise.all([fetchActiveRentals(), refreshUser()]);
            setTab('active');
          } else {
            showDialog({
              title: 'Rental Notice',
              message: res.data?.message || 'Could not complete rental.',
              variant: 'warning',
              confirmText: 'Got It',
            });
          }
        } catch (err: any) {
          showDialog({
            title: 'Rental Notice',
            message:
              err?.response?.data?.message || 'Unable to complete rental right now.',
            variant: 'danger',
            confirmText: 'Got It',
          });
        } finally {
          setPurchasingKey(null);
        }
      },
    });
  };

  const handleCancelRental = (rentalId: string, phone: string) => {
    showDialog({
      title: 'Cancel Rental Number?',
      message: `Are you sure you want to cancel and release ${phone}? This number will be immediately released from your account.`,
      variant: 'danger',
      confirmText: 'Release Number',
      cancelText: 'Keep Rental',
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/numbers/rentals/${rentalId}/cancel`);
          if (res.data?.success) {
            showToast('Rental released successfully', 'success');
            await fetchActiveRentals();
          } else {
            showToast(res.data?.message || 'Failed to cancel rental', 'error');
          }
        } catch (err: any) {
          showToast(err?.response?.data?.message || 'Failed to cancel rental', 'error');
        }
      },
    });
  };

  const TOP_POPULAR_KEYWORDS = useMemo(
    () => [
      'full', 'whatsapp', 'cash', 'telegram', 'google', 'gmail', 'paypal',
      'coinbase', 'apple', 'instagram', 'tiktok', 'tinder', 'facebook',
      'twitter', 'amazon', 'netflix', 'uber', 'chime', 'venmo', 'discord',
      'snapchat', 'linkedin', 'steam', 'openai', 'chatgpt',
    ],
    []
  );

  const filteredCatalog = useMemo(() => {
    if (lineType === 'voip') {
      return voipCatalog;
    }

    let items = nonVoipCatalog;

    if (selectedCategory === 'full') {
      return items.filter((i) => i.isFullAccess);
    } else if (selectedCategory === 'whatsapp') {
      items = items.filter((i) => (i.serviceName || i.service || '').toLowerCase().includes('whatsapp'));
    } else if (selectedCategory === 'cash app') {
      items = items.filter((i) => (i.serviceName || i.service || '').toLowerCase().includes('cash'));
    } else if (selectedCategory === 'telegram') {
      items = items.filter((i) => (i.serviceName || i.service || '').toLowerCase().includes('telegram'));
    } else if (selectedCategory === 'google') {
      items = items.filter((i) => {
        const text = (i.serviceName || i.service || '').toLowerCase();
        return text.includes('google') || text.includes('gmail') || text.includes('youtube');
      });
    } else if (selectedCategory === 'paypal') {
      items = items.filter((i) => (i.serviceName || i.service || '').toLowerCase().includes('paypal'));
    } else if (selectedCategory === 'coinbase') {
      items = items.filter((i) => {
        const text = (i.serviceName || i.service || '').toLowerCase();
        return text.includes('coinbase') || text.includes('crypto') || text.includes('binance');
      });
    } else if (selectedCategory === 'apple') {
      items = items.filter((i) => {
        const text = (i.serviceName || i.service || '').toLowerCase();
        return text.includes('apple') || text.includes('icloud');
      });
    } else if (selectedCategory === 'tinder') {
      items = items.filter((i) => {
        const text = (i.serviceName || i.service || '').toLowerCase();
        return text.includes('tinder') || text.includes('bumble') || text.includes('hinge');
      });
    } else if (selectedCategory === 'instagram') {
      items = items.filter((i) => (i.serviceName || i.service || '').toLowerCase().includes('instagram'));
    } else if (selectedCategory !== 'all') {
      items = items.filter((i) =>
        (i.serviceName || i.service || '').toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // If searching, search across all 2,000+ items and return up to 30 matches
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase().trim();
      return items
        .filter((i) => {
          const text = (i.serviceName || i.service || '').toLowerCase();
          return text.includes(q);
        })
        .slice(0, 30);
    }

    // Default "All Services" view: Show top 25 popular services to prevent freeze/lag/crash
    if (selectedCategory === 'all') {
      const popularMatches: AvailableRentalItem[] = [];
      const fullItem = items.find((i) => i.isFullAccess);
      if (fullItem) popularMatches.push(fullItem);

      for (const kw of TOP_POPULAR_KEYWORDS) {
        if (kw === 'full') continue;
        const found = items.find((i) => {
          if (i.isFullAccess) return false;
          const name = (i.serviceName || i.service || '').toLowerCase();
          return name.includes(kw);
        });
        if (found && !popularMatches.some((m) => m.serviceId === found.serviceId)) {
          popularMatches.push(found);
        }
      }

      return popularMatches.length > 0 ? popularMatches.slice(0, 25) : items.slice(0, 25);
    }

    return items.slice(0, 30);
  }, [lineType, voipCatalog, nonVoipCatalog, selectedCategory, serviceSearch, TOP_POPULAR_KEYWORDS]);

  const handleSelectNavTab = (nav: NavTabId) => {
    if (nav === 'home') onNavigateToHome?.();
    else if (nav === 'buy') onNavigateToBuy?.();
    else if (nav === 'sms') onNavigateToNumbers?.();
    else if (nav === 'wallet') onNavigateToWallet?.();
  };

  // ─── TWO-STEP MESSAGING NAVIGATION ────────────────────────────────────────
  // Step 2: Conversation View
  if (activeRentalForMessages && (activeChatRecipient || isComposingNew)) {
    return (
      <RentalConversationChatView
        rental={activeRentalForMessages}
        recipient={activeChatRecipient}
        isComposingNew={isComposingNew}
        onBack={() => {
          setActiveChatRecipient(null);
          setIsComposingNew(false);
        }}
        openDialpad={openDialpad}
        onSelectRecipient={(num) => {
          setIsComposingNew(false);
          setActiveChatRecipient(num);
        }}
      />
    );
  }

  // Step 1: Threads List (List of people who messaged)
  if (activeRentalForMessages) {
    return (
      <RentalThreadsListView
        rental={activeRentalForMessages}
        onBack={() => setActiveRentalForMessages(null)}
        onSelectThread={(remoteNumber) => setActiveChatRecipient(remoteNumber)}
        onNewChat={() => setIsComposingNew(true)}
      />
    );
  }

  // ─── MAIN RENTALS SCREEN ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar style={colors.statusBar} />

      <ModernHeader
        title="Rental Numbers"
        onBack={onBack}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── PAGE HEADER & TABS ────────────────────────────────────────── */}
        <View style={[s.headerBar, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pageTitle, { color: colors.text }]}>
              Rental Numbers
            </Text>
            <Text style={[s.pageSubtitle, { color: colors.textMuted }]}>
              Dedicated 30-day lines for SMS & voice calls
            </Text>
          </View>

          <View style={s.tabsRow}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setTab('active');
              }}
              style={[
                s.tabPill,
                tab === 'active' && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Clock
                size={14}
                color={tab === 'active' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  s.tabPillText,
                  { color: tab === 'active' ? colors.primary : colors.textMuted },
                ]}
              >
                Active ({activeRentals.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                triggerHaptic('selection');
                setTab('catalog');
              }}
              style={[
                s.tabPill,
                tab === 'catalog' && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Globe
                size={14}
                color={tab === 'catalog' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  s.tabPillText,
                  { color: tab === 'catalog' ? colors.primary : colors.textMuted },
                ]}
              >
                Rent New
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
          {tab === 'active' ? (
            loading ? (
              <SkeletonNumberCard />
            ) : activeRentals.length === 0 ? (
              <AnimatedEmptyState
                type="rentals"
                title="No Active Rental Numbers"
                subtitle="You haven't leased any private numbers yet. Rent a dedicated Non-VoIP SIM or VoIP line for 30 days."
                actionLabel="Browse Available Lines"
                onAction={() => setTab('catalog')}
              />
            ) : (
              <View
                style={[
                  s.flatListSurface,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {activeRentals.map((rental, idx) => {
                  const exp = daysLeft(rental.expiresAt);
                  const isCopied = copiedKey === rental.id;
                  const isVoip = rental.provider === 'telnyx' || rental.lineType === 'voip';
                  const serviceDisplayName = !isVoip
                    ? rental.serviceName || (rental.isFullAccess ? 'Full Rent (Any Service)' : 'Physical SIM')
                    : rental.countryName || rental.countryCode || 'VoIP Line';

                  return (
                    <View
                      key={rental.id}
                      style={[
                        s.activeRentalCard,
                        idx > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      {/* Top Info Header */}
                      <View style={s.activeCardTop}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[s.rentalPhone, { color: colors.text }]}>
                              {rental.phoneNumber}
                            </Text>

                            {/* Copy / Clipboard Button right beside number */}
                            <TouchableOpacity
                              onPress={() => handleCopy(rental.phoneNumber, rental.id)}
                              style={[s.inlineActionIconBtn, { borderColor: colors.border }]}
                              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                              activeOpacity={0.7}
                            >
                              {isCopied ? (
                                <Check size={13} color={colors.primary} />
                              ) : (
                                <Copy size={13} color={colors.textSecondary} />
                              )}
                            </TouchableOpacity>

                            {/* Call Logs button right beside number (VoIP only) */}
                            {isVoip && (
                              <TouchableOpacity
                                style={[s.inlineLogsBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                                onPress={() => {
                                  triggerHaptic('selection');
                                  openDialpad(rental.id, rental.phoneNumber, 'recents');
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                activeOpacity={0.7}
                              >
                                <Clock size={11} color={colors.textSecondary} />
                                <Text style={[s.inlineLogsBtnText, { color: colors.textSecondary }]}>Logs</Text>
                              </TouchableOpacity>
                            )}

                            <View
                              style={[
                                s.lineTypeBadge,
                                { backgroundColor: colors.primarySoft },
                              ]}
                            >
                              <Text
                                style={[
                                  s.lineTypeBadgeText,
                                  { color: colors.primary },
                                ]}
                              >
                                {isVoip ? 'VoIP Leased' : 'Physical SIM'}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
                            {serviceDisplayName} {rental.countryName ? `· ${rental.countryName}` : ''}
                          </Text>
                        </View>

                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '700',
                            color: exp.isCritical ? '#EF4444' : colors.primary,
                          }}
                        >
                          {exp.label}
                        </Text>
                      </View>

                      {/* Action Buttons Row - Clean, balanced, and no horizontal overflow */}
                      <View style={s.activeCardActions}>
                        {/* Call button: ONLY FOR VOIP NUMBERS! */}
                        {isVoip && (
                          <TouchableOpacity
                            style={s.blueActionBtn}
                            onPress={() => {
                              triggerHaptic('medium');
                              openDialpad(rental.id, rental.phoneNumber, 'keypad');
                            }}
                            activeOpacity={0.8}
                          >
                            <Phone size={13} color="#FFFFFF" />
                            <Text style={s.blueActionBtnText}>Call</Text>
                          </TouchableOpacity>
                        )}

                        {/* Messages Button: Opens list of people who messaged */}
                        <TouchableOpacity
                          style={[s.outlineActionBtn, { borderColor: colors.border }]}
                          onPress={() => {
                            triggerHaptic('selection');
                            setActiveRentalForMessages(rental);
                          }}
                          activeOpacity={0.8}
                        >
                          <MessageSquare size={13} color={colors.primary} />
                          <Text style={[s.outlineActionBtnText, { color: colors.primary }]}>
                            {isVoip ? 'Messages' : 'View SMS'}
                          </Text>
                        </TouchableOpacity>

                        {/* Cancel / Release Number */}
                        <TouchableOpacity
                          onPress={() => handleCancelRental(rental.id, rental.phoneNumber)}
                          style={[s.iconActionBtn, { borderColor: 'rgba(239, 68, 68, 0.25)', marginLeft: 'auto' }]}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                          <XCircle size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )
          ) : (
            <View style={{ gap: 16 }}>
              {/* ── LINE TYPE SELECTOR: STACKED (NON-VOIP ON TOP, VOIP BELOW) ── */}
              <View style={s.lineTypeStack}>
                {/* 1. NON-VOIP PHYSICAL SIM (TOP) */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    triggerHaptic('selection');
                    setLineType('non_voip');
                    setServiceSearch('');
                    setSelectedCategory('all');
                  }}
                  style={[
                    s.stackedLineCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: lineType === 'non_voip' ? colors.primary : colors.border,
                      borderWidth: lineType === 'non_voip' ? 1.5 : 1,
                    },
                    lineType === 'non_voip' && s.stackedLineCardActive,
                  ]}
                >
                  <View style={s.stackedCardInner}>
                    <View
                      style={[
                        s.stackedCardIconBox,
                        {
                          backgroundColor:
                            lineType === 'non_voip'
                              ? colors.primarySoft
                              : (colors.isDark ? '#27272A' : '#F4F4F5'),
                        },
                      ]}
                    >
                      <Smartphone
                        size={22}
                        color={lineType === 'non_voip' ? colors.primary : colors.textMuted}
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[s.stackedCardTitle, { color: colors.text }]}>
                          Non-VoIP Physical SIMs
                        </Text>
                        <View
                          style={[
                            s.pillBadge,
                            {
                              backgroundColor: colors.primarySoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.pillBadgeText,
                              { color: colors.primary },
                            ]}
                          >
                            Carrier SIM
                          </Text>
                        </View>
                      </View>

                      <Text style={[s.stackedCardDesc, { color: colors.textSecondary }]}>
                        Real mobile carrier SIM cards (AT&T, T-Mobile). Guaranteed for WhatsApp, Cash App, Telegram & Banking OTPs.
                      </Text>

                      <View style={s.stackedCardTagsRow}>
                        <View style={[s.tagBubble, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                          <ShieldCheck size={11} color={colors.primary} />
                          <Text style={[s.tagBubbleText, { color: colors.textSecondary }]}>Physical Lines</Text>
                        </View>
                        <View style={[s.tagBubble, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                          <Zap size={11} color={colors.primary} />
                          <Text style={[s.tagBubbleText, { color: colors.textSecondary }]}>Instant OTP</Text>
                        </View>
                        <View style={[s.tagBubble, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                          <Clock size={11} color={colors.primary} />
                          <Text style={[s.tagBubbleText, { color: colors.textSecondary }]}>30-Day Lease</Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.stackedRadioWrap}>
                      <View
                        style={[
                          s.radioCircle,
                          {
                            borderColor: lineType === 'non_voip' ? colors.primary : colors.border,
                            backgroundColor: lineType === 'non_voip' ? colors.primary : 'transparent',
                          },
                        ]}
                      >
                        {lineType === 'non_voip' && (
                          <Check size={13} color="#FFFFFF" strokeWidth={3} />
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 2. VOIP VIRTUAL NUMBERS (BELOW) */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    triggerHaptic('selection');
                    setLineType('voip');
                    setServiceSearch('');
                  }}
                  style={[
                    s.stackedLineCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: lineType === 'voip' ? colors.primary : colors.border,
                      borderWidth: lineType === 'voip' ? 1.5 : 1,
                    },
                    lineType === 'voip' && s.stackedLineCardActive,
                  ]}
                >
                  <View style={s.stackedCardInner}>
                    <View
                      style={[
                        s.stackedCardIconBox,
                        {
                          backgroundColor:
                            lineType === 'voip'
                              ? colors.primarySoft
                              : (colors.isDark ? '#27272A' : '#F4F4F5'),
                        },
                      ]}
                    >
                      <Phone
                        size={22}
                        color={lineType === 'voip' ? colors.primary : colors.textMuted}
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[s.stackedCardTitle, { color: colors.text }]}>
                          VoIP Virtual Numbers
                        </Text>
                        <View
                          style={[
                            s.pillBadge,
                            {
                              backgroundColor: colors.primarySoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.pillBadgeText,
                              { color: colors.primary },
                            ]}
                          >
                            Calls + SMS
                          </Text>
                        </View>
                      </View>

                      <Text style={[s.stackedCardDesc, { color: colors.textSecondary }]}>
                        Dedicated private virtual phone number with crystal-clear voice calls, in-app dialpad & 2-way SMS.
                      </Text>

                      <View style={s.stackedCardTagsRow}>
                        <View style={[s.tagBubble, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                          <Phone size={11} color={colors.primary} />
                          <Text style={[s.tagBubbleText, { color: colors.textSecondary }]}>Voice Calling</Text>
                        </View>
                        <View style={[s.tagBubble, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                          <MessageSquare size={11} color={colors.primary} />
                          <Text style={[s.tagBubbleText, { color: colors.textSecondary }]}>2-Way SMS</Text>
                        </View>
                        <View style={[s.tagBubble, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                          <Globe size={11} color={colors.primary} />
                          <Text style={[s.tagBubbleText, { color: colors.textSecondary }]}>Dialpad Ready</Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.stackedRadioWrap}>
                      <View
                        style={[
                          s.radioCircle,
                          {
                            borderColor: lineType === 'voip' ? colors.primary : colors.border,
                            backgroundColor: lineType === 'voip' ? colors.primary : 'transparent',
                          },
                        ]}
                      >
                        {lineType === 'voip' && (
                          <Check size={13} color="#FFFFFF" strokeWidth={3} />
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── SUB-FILTERS (SEARCH & CATEGORIES FOR NON-VOIP / COUNTRY FOR VOIP) ── */}
              {lineType === 'non_voip' ? (
                <View style={{ gap: 10 }}>
                  {/* Search Bar */}
                  <View
                    style={[
                      s.searchBarContainer,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Search size={17} color={colors.textMuted} />
                    <TextInput
                      style={[s.searchInput, { color: colors.text }]}
                      placeholder="Search 2,000+ services (WhatsApp, Cash App, Full)..."
                      placeholderTextColor={colors.textMuted}
                      value={serviceSearch}
                      onChangeText={setServiceSearch}
                      autoCapitalize="none"
                    />
                    {serviceSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setServiceSearch('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={15} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Horizontal Categories */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 7 }}
                  >
                    {NON_VOIP_CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => {
                            triggerHaptic('selection');
                            setSelectedCategory(cat.id);
                          }}
                          style={[
                            s.categoryChip,
                            {
                              backgroundColor: isActive ? colors.primary : colors.surface,
                              borderColor: isActive ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.categoryChipText,
                              { color: isActive ? '#FFFFFF' : colors.textSecondary },
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                /* Country Chips for VoIP */
                <View style={{ gap: 8 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {RENTAL_COUNTRIES.map((c) => {
                      const active = selectedCountry.code === c.code;
                      return (
                        <TouchableOpacity
                          key={c.code}
                          onPress={() => {
                            triggerHaptic('selection');
                            setSelectedCountry(c);
                          }}
                          style={[
                            s.countryChip,
                            {
                              backgroundColor: active ? colors.primary : colors.surface,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                          <Text
                            style={[
                              s.countryChipText,
                              { color: active ? '#FFFFFF' : colors.textSecondary },
                            ]}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ── HEADER SUMMARY ROW: COUNT & REFRESH ── */}
              <View style={s.catalogHeaderRow}>
                <Text style={[s.catalogCountText, { color: colors.textSecondary }]}>
                  {lineType === 'non_voip'
                    ? (serviceSearch
                        ? `${filteredCatalog.length} Matching Services`
                        : `Top Popular Physical Services (${filteredCatalog.length})`)
                    : `${filteredCatalog.length} Virtual Numbers in ${selectedCountry.name}`}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => fetchCatalog(lineType, selectedCountry.code, true)}
                  disabled={loadingCatalog}
                  style={s.catalogRefreshBtn}
                >
                  <RefreshCw
                    size={13}
                    color={colors.primary}
                    style={loadingCatalog ? { transform: [{ rotate: '45deg' }] } : {}}
                  />
                  <Text style={[s.catalogRefreshText, { color: colors.primary }]}>
                    {loadingCatalog ? 'Updating...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── CATALOG ITEMS ── */}
              {loadingCatalog && currentCatalog.length === 0 ? (
                <View style={{ gap: 12 }}>
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                </View>
              ) : catalogError && currentCatalog.length === 0 ? (
                <View style={[s.errorCardWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <AlertCircle size={28} color="#EF4444" />
                  <Text style={[s.errorCardTitle, { color: colors.text }]}>Could not load live inventory</Text>
                  <Text style={[s.errorCardSubtitle, { color: colors.textMuted }]}>{catalogError}</Text>
                  <TouchableOpacity
                    style={[s.retryButton, { backgroundColor: colors.primary }]}
                    onPress={() => fetchCatalog(lineType, selectedCountry.code, true)}
                  >
                    <RefreshCw size={14} color="#FFFFFF" />
                    <Text style={s.retryButtonText}>Tap to Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredCatalog.length === 0 ? (
                <View style={s.emptyCatalogWrap}>
                  <Text style={[s.emptyCatalogTitle, { color: colors.text }]}>
                    {lineType === 'non_voip'
                      ? 'No services matching your search'
                      : 'No VoIP numbers available in this region'}
                  </Text>
                  <Text style={[s.emptyCatalogSubtitle, { color: colors.textMuted }]}>
                    {lineType === 'non_voip'
                      ? 'Try searching for another service name or switch category to "All Services".'
                      : 'Try switching to another country or check back shortly.'}
                  </Text>
                  {serviceSearch.length > 0 && (
                    <TouchableOpacity
                      style={[s.clearSearchBtn, { borderColor: colors.border }]}
                      onPress={() => setServiceSearch('')}
                    >
                      <Text style={[s.clearSearchBtnText, { color: colors.primary }]}>Clear Search</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {lineType === 'non_voip'
                    ? filteredCatalog.map((item, idx) => {
                        const fee = item.monthlyFee || (displayCurrency === 'NGN' ? 15000 : 10.0);
                        const busy = purchasingKey === String(item.serviceId);

                        return (
                          <View
                            key={item.serviceId ?? idx}
                            style={[
                              s.premiumCard,
                              {
                                backgroundColor: colors.surface,
                                borderColor: item.isFullAccess ? colors.primary : colors.border,
                                borderWidth: item.isFullAccess ? 1.5 : 1,
                              },
                            ]}
                          >
                            <View style={s.cardTopRow}>
                              <View style={s.cardBrandBox}>
                                <View
                                  style={[
                                    s.brandIconBadge,
                                    {
                                      backgroundColor: colors.primarySoft,
                                    },
                                  ]}
                                >
                                  {item.isFullAccess ? (
                                    <Sparkles size={18} color={colors.primary} />
                                  ) : (
                                    <Smartphone size={18} color={colors.primary} />
                                  )}
                                </View>

                                <View style={{ flex: 1, gap: 2 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={[s.serviceTitleText, { color: colors.text }]}>
                                      {item.serviceName || item.service}
                                    </Text>
                                    {item.isFullAccess ? (
                                      <View
                                        style={[
                                          s.goldBadge,
                                          {
                                            backgroundColor: colors.primarySoft,
                                            borderColor: colors.primary,
                                          },
                                        ]}
                                      >
                                        <Text style={[s.goldBadgeText, { color: colors.primary }]}>
                                          ★ Universal Access
                                        </Text>
                                      </View>
                                    ) : (
                                      <View
                                        style={[
                                          s.stockBadge,
                                          {
                                            backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5',
                                          },
                                        ]}
                                      >
                                        <Text style={[s.stockBadgeText, { color: colors.textSecondary }]}>
                                          {item.available !== undefined ? `${item.available} in stock` : 'Active'}
                                        </Text>
                                      </View>
                                    )}
                                  </View>

                                  <Text style={[s.serviceDescText, { color: colors.textSecondary }]}>
                                    {item.isFullAccess
                                      ? 'Universal SIM · Works for WhatsApp, Cash App, PayPal & ANY app'
                                      : 'Dedicated physical mobile carrier SIM for this specific service'}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Tags Row */}
                            <View style={s.chipsRow}>
                              <View style={[s.featurePill, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                                <ShieldCheck size={11} color={colors.primary} />
                                <Text style={[s.featurePillText, { color: colors.textSecondary }]}>Physical SIM</Text>
                              </View>
                              <View style={[s.featurePill, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                                <MessageSquare size={11} color={colors.primary} />
                                <Text style={[s.featurePillText, { color: colors.textSecondary }]}>SMS Verification</Text>
                              </View>
                              <View style={[s.featurePill, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                                <Clock size={11} color={colors.primary} />
                                <Text style={[s.featurePillText, { color: colors.textSecondary }]}>30-Day Lease</Text>
                              </View>
                            </View>

                            {/* Bottom Row */}
                            <View style={[s.serviceBottomRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                              <View>
                                <Text style={[s.priceMain, { color: colors.text }]}>
                                  {formatCurrency(fee, displayCurrency)}
                                </Text>
                                <Text style={[s.priceSub, { color: colors.textMuted }]}>for 30 days</Text>
                              </View>

                              <TouchableOpacity
                                style={[
                                  s.rentBtn,
                                  { backgroundColor: colors.primary },
                                  busy && { opacity: 0.7 },
                                ]}
                                onPress={() => handleRentNumber(item)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={s.rentBtnText}>
                                      {item.isFullAccess ? 'Rent Universal SIM' : 'Rent Service'}
                                    </Text>
                                    <ChevronRight size={14} color="#FFFFFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    : filteredCatalog.map((item, idx) => {
                        const fee = item.monthlyFee || (displayCurrency === 'NGN' ? 9800 : 6.5);
                        const busy = purchasingKey === String(item.phoneNumber);
                        const formattedPhone = formatPhoneNumber(item.phoneNumber);

                        return (
                          <View
                            key={item.phoneNumber ?? idx}
                            style={[
                              s.premiumCard,
                              { backgroundColor: colors.surface, borderColor: colors.border },
                            ]}
                          >
                            <View style={s.cardTopRow}>
                              <View style={s.cardBrandBox}>
                                <View style={[s.brandIconBadge, { backgroundColor: colors.primarySoft }]}>
                                  <Phone size={18} color={colors.primary} />
                                </View>

                                <View style={{ flex: 1, gap: 2 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={[s.phoneTitleText, { color: colors.text }]}>
                                      {formattedPhone || item.phoneNumber}
                                    </Text>
                                    <View
                                      style={[
                                        s.stockBadge,
                                        { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' },
                                      ]}
                                    >
                                      <Text style={[s.stockBadgeText, { color: colors.textSecondary }]}>
                                        {selectedCountry.flag} {item.region || selectedCountry.name}
                                      </Text>
                                    </View>
                                  </View>

                                  <Text style={[s.serviceDescText, { color: colors.textSecondary }]}>
                                    Private leased virtual number with in-app keypad & crystal-clear voice
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Features row */}
                            <View style={s.chipsRow}>
                              <View style={[s.featurePill, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                                <Phone size={11} color={colors.primary} />
                                <Text style={[s.featurePillText, { color: colors.textSecondary }]}>HD Voice Calling</Text>
                              </View>
                              <View style={[s.featurePill, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                                <MessageSquare size={11} color={colors.primary} />
                                <Text style={[s.featurePillText, { color: colors.textSecondary }]}>2-Way SMS</Text>
                              </View>
                              <View style={[s.featurePill, { backgroundColor: colors.isDark ? '#27272A' : '#F4F4F5' }]}>
                                <Globe size={11} color={colors.primary} />
                                <Text style={[s.featurePillText, { color: colors.textSecondary }]}>Dialpad Ready</Text>
                              </View>
                            </View>

                            {/* Bottom Row */}
                            <View style={[s.serviceBottomRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                              <View>
                                <Text style={[s.priceMain, { color: colors.text }]}>
                                  {formatCurrency(fee, displayCurrency)}
                                </Text>
                                <Text style={[s.priceSub, { color: colors.textMuted }]}>for 30 days</Text>
                              </View>

                              <TouchableOpacity
                                style={[s.rentBtn, { backgroundColor: colors.primary }, busy && { opacity: 0.7 }]}
                                onPress={() => handleRentNumber(item)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={s.rentBtnText}>Lease Number</Text>
                                    <ChevronRight size={14} color="#FFFFFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                  {lineType === 'non_voip' && !serviceSearch && (
                    <View style={[s.moreServicesNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[s.moreServicesNoteText, { color: colors.textMuted }]}>
                        Showing top 25 popular services · Search above to find any of 2,000+ available apps
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav activeTab="rentals" onSelectTab={handleSelectNavTab} />
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
    gap: 18,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  // ─── STACKED LINE TYPE SELECTOR STYLES ───
  lineTypeStack: {
    flexDirection: 'column',
    gap: 12,
  },
  stackedLineCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  stackedLineCardActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  stackedCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stackedCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  pillBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  stackedCardDesc: {
    fontSize: 12,
    lineHeight: 16.5,
  },
  stackedCardTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
  },
  tagBubbleText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  stackedRadioWrap: {
    paddingTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  catalogCountText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  catalogRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  catalogRefreshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorCardWrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
  },
  errorCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorCardSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clearSearchBtn: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 4,
  },
  clearSearchBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  premiumCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  fullAccessCardGlow: {
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardBrandBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  brandIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInitials: {
    fontSize: 14,
    fontWeight: '900',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  phoneTitleText: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  serviceDescText: {
    fontSize: 12,
    lineHeight: 16,
  },
  moreServicesNote: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  moreServicesNoteText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  lineTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  lineTypeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    padding: 0,
  },
  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  countryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  flatListSurface: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  activeRentalCard: {
    padding: 16,
    gap: 12,
  },
  activeCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  activeCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blueActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  blueActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  outlineActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionIconBtn: {
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  inlineLogsBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  serviceRow: {
    padding: 16,
    gap: 12,
  },
  serviceRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  serviceRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  serviceTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  goldBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  goldBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EAB308',
  },
  stockBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  featurePillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
  },
  featurePillTextMuted: {
    fontSize: 11,
    fontWeight: '600',
  },
  serviceBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  priceMain: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  priceSub: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  rentalPhone: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  rentBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  rentBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  emptyCatalogWrap: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyCatalogTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCatalogSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── THREADS LIST STYLES ──────────────────────────────────────────────────
  threadsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    padding: 6,
  },
  threadsHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  threadsHeaderSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerNewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadsSearchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  threadItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  threadAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadItemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  threadItemPreview: {
    fontSize: 12.5,
    marginTop: 2,
  },

  // ─── CHAT AREA STYLES ─────────────────────────────────────────────────────
  chatHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatBackBtn: {
    padding: 6,
    marginRight: 6,
  },
  chatHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContactTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  chatSubTitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  chatHeaderCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chatHeaderCallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  toBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 8,
  },
  toLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  toInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  emptyChatBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 30,
  },
  emptyChatIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChatTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyChatSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    width: '100%',
  },
  chatBubbleRowOutbound: {
    justifyContent: 'flex-end',
  },
  chatBubbleRowInbound: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 4,
  },
  chatBubbleOutbound: {
    borderBottomRightRadius: 4,
  },
  chatBubbleInbound: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  chatBubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  chatBubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  chatBubbleTime: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  chatOtpWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  chatOtpCode: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  chatOtpCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  chatOtpCopyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomInputBar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 7 : 4,
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 90,
    padding: 0,
  },
  chatSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDisabledBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  disabledInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  disabledInputText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
