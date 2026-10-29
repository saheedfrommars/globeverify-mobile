import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Linking,
  Dimensions,
  Easing,
} from 'react-native';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  AlertCircle,
  Minimize2,
  Maximize2,
  Trash2,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings, AppScreenId } from '../../context/WalletSettingsContext';
import { socketService } from '../../services/socketService';

type MessageRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
  isAdmin?: boolean;
  adminName?: string;
  action?: { type?: string; label: string; url: string };
}

const QUICK_STARTERS = [
  'Check my active numbers & OTP',
  'My deposit is not reflecting yet',
  'How do I buy a virtual number?',
  'Connect me to a human agent',
];

/**
 * Lightweight inline Markdown parser for **bold**, *italic*, and `code`
 */
function renderInlineMarkdown(
  text: string,
  baseColor: string,
  codeBg: string,
  primaryColor: string
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    if (m[2]) {
      parts.push(
        <Text key={m.index} style={{ fontWeight: '800', color: baseColor }}>
          {m[2]}
        </Text>
      );
    } else if (m[3]) {
      parts.push(
        <Text key={m.index} style={{ fontStyle: 'italic', color: baseColor }}>
          {m[3]}
        </Text>
      );
    } else if (m[4]) {
      parts.push(
        <Text
          key={m.index}
          style={{
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            backgroundColor: codeBg,
            color: primaryColor,
            fontSize: 12,
          }}
        >
          {' '}
          {m[4]}{' '}
        </Text>
      );
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

const NativeMarkdownMessage: React.FC<{
  content: string;
  textColor: string;
  codeBg: string;
  primaryColor: string;
}> = ({ content, textColor, codeBg, primaryColor }) => {
  const lines = (content || '').split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd();
        if (!line.trim()) {
          return <View key={idx} style={{ height: 4 }} />;
        }

        // Heading (#, ##, ###)
        const hMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (hMatch) {
          return (
            <Text
              key={idx}
              style={{
                color: textColor,
                fontWeight: '800',
                fontSize: hMatch[1].length === 1 ? 15 : 14,
                marginTop: 4,
              }}
            >
              {renderInlineMarkdown(hMatch[2], textColor, codeBg, primaryColor)}
            </Text>
          );
        }

        // Bullet item (- or *)
        if (/^[\-\*]\s+/.test(line)) {
          const itemText = line.replace(/^[\-\*]\s+/, '');
          return (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4 }}>
              <Text style={{ color: primaryColor, fontWeight: '800', fontSize: 13, lineHeight: 19 }}>•</Text>
              <Text style={{ color: textColor, fontSize: 13.5, lineHeight: 19, flex: 1 }}>
                {renderInlineMarkdown(itemText, textColor, codeBg, primaryColor)}
              </Text>
            </View>
          );
        }

        // Numbered item (1. )
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4 }}>
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 13, lineHeight: 19 }}>
                {numMatch[1]}.
              </Text>
              <Text style={{ color: textColor, fontSize: 13.5, lineHeight: 19, flex: 1 }}>
                {renderInlineMarkdown(numMatch[2], textColor, codeBg, primaryColor)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={idx} style={{ color: textColor, fontSize: 13.5, lineHeight: 19 }}>
            {renderInlineMarkdown(line, textColor, codeBg, primaryColor)}
          </Text>
        );
      })}
    </View>
  );
};

const TypingDotsIndicator: React.FC<{ dotColor: string }> = ({ dotColor }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -5,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(560 - delay),
        ])
      );
    };

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 180);
    const a3 = animateDot(dot3, 360);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={s.typingDotsRow}>
      <Animated.View style={[s.typingDot, { backgroundColor: dotColor, transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[s.typingDot, { backgroundColor: dotColor, transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[s.typingDot, { backgroundColor: dotColor, transform: [{ translateY: dot3 }] }]} />
    </View>
  );
};

export const VeraSupportChat: React.FC = () => {
  const { user } = useAuth();
  const { colors, activeScreen, setActiveScreen, triggerHaptic } = useAppSettings();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isEscalated, setIsEscalated] = useState(false);
  const [adminJoined, setAdminJoined] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<any>(null);
  const isOpenRef = useRef(false);
  const isMinimizedRef = useRef(false);

  // Draggable FAB position
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setTimeout(() => {
          isDragging.current = false;
        }, 50);
      },
    })
  ).current;

  useEffect(() => {
    isOpenRef.current = isOpen;
    isMinimizedRef.current = isMinimized;
    if (isOpen && !isMinimized) {
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized]);

  const addMessage = useCallback(
    (
      role: MessageRole,
      content: string,
      isAdminMsg = false,
      displayName = '',
      action?: { type?: string; label: string; url: string }
    ) => {
      setMessages((prev) => [
        ...prev,
        {
          role,
          content,
          timestamp: new Date(),
          isAdmin: isAdminMsg,
          adminName: displayName,
          action,
        },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 120);
    },
    []
  );

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    const token =
      (await SecureStore.getItemAsync('gv_auth_token')) ||
      (await SecureStore.getItemAsync('accessToken'));
    if (!token) return;

    const backendUrl = socketService.getBackendUrl();
    const socket = io(`${backendUrl}/support`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      socket.emit('support:join');
    });

    socket.on('connect_error', (err: Error) => {
      setIsConnected(false);
      setConnectionError(err.message || 'Unable to reach support server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on(
      'support:session',
      ({ sessionId: sid, status, messages: history, adminJoined: aj }: any) => {
        if (sid) setSessionId(sid);
        if (Array.isArray(history) && history.length > 0) {
          setMessages(
            history.map((m: any) => ({
              role: (m.role === 'admin' ? 'assistant' : m.role) as MessageRole,
              content: m.content,
              action: m.action,
              isAdmin:
                m.role === 'admin' ||
                (typeof m.content === 'string' && m.content.startsWith('[Agent ')),
              adminName: m.senderName,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            }))
          );
          setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 150);
        }
        if (status === 'escalated' || status === 'admin_joined' || status === 'human_active') {
          setIsEscalated(true);
        }
        if (aj) setAdminJoined(true);
      }
    );

    socket.on('support:ai_response', ({ message, action }: any) => {
      setIsTyping(false);
      addMessage('assistant', message, false, '', action);
      if (!isOpenRef.current || isMinimizedRef.current) {
        setUnreadCount((c) => c + 1);
      }
    });

    socket.on('support:typing', ({ typing }: any) => {
      setIsTyping(Boolean(typing));
    });

    socket.on('support:escalated', ({ message }: any) => {
      setIsEscalated(true);
      addMessage('system', message);
    });

    socket.on('support:admin_joined', ({ admin, message }: any) => {
      setAdminJoined(true);
      const name = typeof admin === 'string' ? admin : admin?.name || 'Support Agent';
      setAdminName(name);
      addMessage('system', message || `${name} joined the chat.`);
      if (!isOpenRef.current || isMinimizedRef.current) {
        setUnreadCount((c) => c + 1);
      }
    });

    socket.on('support:hand_to_ai', ({ message }: any) => {
      setAdminJoined(false);
      setIsEscalated(false);
      addMessage('system', message || 'Transferred back to Vera AI.');
    });

    socket.on('support:message_relay', ({ from, adminName: aName, userName, message }: any) => {
      if (from === 'admin') {
        addMessage('assistant', message, true, aName || 'Support Agent');
        if (!isOpenRef.current || isMinimizedRef.current) {
          setUnreadCount((c) => c + 1);
        }
      } else if (from === 'user' && userName) {
        // Ignore echo if already appended locally
      }
    });

    socket.on('support:closed', () => {
      addMessage('system', 'This support session has been closed. Thank you!');
      setIsEscalated(false);
      setAdminJoined(false);
    });

    socket.on('support:error', ({ message }: any) => {
      setIsTyping(false);
      addMessage('system', `⚠️ ${message}`);
    });
  }, [addMessage]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleOpen = () => {
    if (isDragging.current) return;
    triggerHaptic('light');
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
    if (!socketRef.current?.connected) {
      setConnectionError(null);
      connect();
    }
  };

  const handleRetry = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionError(null);
    connect();
  };

  const handleClearChat = () => {
    triggerHaptic('medium');
    socketRef.current?.emit('support:close');
    setMessages([]);
    setIsEscalated(false);
    setAdminJoined(false);
    setAdminName('');
    setSessionId(null);
    setTimeout(() => {
      socketRef.current?.emit('support:join');
    }, 300);
  };

  const sendMessage = (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || !socketRef.current?.connected) return;
    triggerHaptic('selection');
    addMessage('user', text);
    socketRef.current.emit('support:message', { message: text, sessionId });
    if (!overrideText) setInputValue('');
    if (!adminJoined) setIsTyping(true);
  };

  const handleActionPress = (url: string) => {
    if (!url) return;
    triggerHaptic('selection');
    // Map web dashboard routes to mobile screens
    const normalized = url.toLowerCase();
    let targetScreen: AppScreenId | null = null;
    if (normalized.includes('/buy') || normalized.includes('/cheap')) targetScreen = 'buy-number';
    else if (normalized.includes('/numbers')) targetScreen = 'numbers';
    else if (normalized.includes('/rentals')) targetScreen = 'rentals';
    else if (normalized.includes('/wallet')) targetScreen = 'wallet';
    else if (normalized.includes('/affiliate') || normalized.includes('/referrals'))
      targetScreen = 'affiliate';
    else if (normalized.includes('/developer')) targetScreen = 'developer';
    else if (normalized.includes('/support')) targetScreen = 'support';
    else if (normalized.includes('/settings')) targetScreen = 'more';

    if (targetScreen) {
      setIsOpen(false);
      setActiveScreen(targetScreen);
      return;
    }

    const fullUrl = url.startsWith('http')
      ? url
      : `https://www.globeverify.com${url.startsWith('/') ? '' : '/'}${url}`;
    Linking.openURL(fullUrl).catch(() => {});
  };

  // Hide the floating button only when the user is already inside the dedicated Support screen
  if (!user || activeScreen === 'support') return null;

  const firstName = user.name?.split(' ')[0] || 'there';

  return (
    <>
      {/* ── Floating Vera Chat Button (Matches Web .support-fab) ── */}
      {!isOpen && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            s.fabContainer,
            {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleOpen}
            style={[s.fabButton, { backgroundColor: colors.primary }]}
          >
            <MessageCircle size={25} color="#FFFFFF" strokeWidth={2.2} />
            {unreadCount > 0 && (
              <View style={[s.fabBadge, { borderColor: colors.bg }]}>
                <Text style={s.fabBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Vera Floating Chat Panel Modal ── */}
      {isOpen && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <KeyboardAvoidingView
            style={s.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} />

            <View
              style={[
                s.panel,
                isMinimized && s.panelMinimized,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Header */}
              <View
                style={[
                  s.header,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: isEscalated
                      ? 'rgba(239, 68, 68, 0.06)'
                      : colors.surface,
                  },
                ]}
              >
                <View style={s.headerInfo}>
                  <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                    {adminJoined ? (
                      <User size={16} color="#FFFFFF" />
                    ) : (
                      <Bot size={17} color="#FFFFFF" />
                    )}
                  </View>
                  <View>
                    <Text style={[s.agentName, { color: colors.text }]}>
                      {adminJoined ? adminName || 'Support Agent' : 'Vera — AI Support'}
                    </Text>
                    <View style={s.statusRow}>
                      <View
                        style={[
                          s.statusDot,
                          { backgroundColor: isConnected ? '#10B981' : '#6B7280' },
                        ]}
                      />
                      <Text style={[s.statusText, { color: colors.textMuted }]}>
                        {isConnected
                          ? adminJoined
                            ? 'Human agent active'
                            : 'Online'
                          : connectionError
                            ? 'Connection failed'
                            : 'Connecting...'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={s.headerActions}>
                  <TouchableOpacity
                    style={[s.headerIconBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => {
                      setIsOpen(false);
                      setActiveScreen('support');
                    }}
                  >
                    <ExternalLink size={14} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.headerIconBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => setIsMinimized((v) => !v)}
                  >
                    {isMinimized ? (
                      <Maximize2 size={14} color={colors.textSecondary} />
                    ) : (
                      <Minimize2 size={14} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {isConnected && (
                    <TouchableOpacity
                      style={[s.headerIconBtn, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={handleClearChat}
                    >
                      <Trash2 size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[s.headerIconBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                    onPress={() => setIsOpen(false)}
                  >
                    <X size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Body when expanded */}
              {!isMinimized && (
                <>
                  <ScrollView
                    ref={scrollRef}
                    style={s.messagesArea}
                    contentContainerStyle={s.messagesContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={() =>
                      scrollRef.current?.scrollToEnd?.({ animated: true })
                    }
                  >
                    {/* Welcome State */}
                    {messages.length === 0 && !connectionError && (
                      <View style={s.emptyWrap}>
                        <View
                          style={[
                            s.emptyBotCircle,
                            { backgroundColor: colors.primarySoft },
                          ]}
                        >
                          <Bot size={34} color={colors.primary} />
                        </View>
                        <Text style={[s.emptyGreeting, { color: colors.text }]}>
                          Hi {firstName}! I'm <Text style={{ fontWeight: '800', color: colors.primary }}>Vera</Text>, your GlobeVerify AI assistant.
                        </Text>
                        <Text style={[s.emptySub, { color: colors.textMuted }]}>
                          Ask me about your numbers, OTPs, balance, rentals — anything!
                        </Text>

                        {isConnected && (
                          <View style={s.starterChipsWrap}>
                            {QUICK_STARTERS.map((prompt) => (
                              <TouchableOpacity
                                key={prompt}
                                activeOpacity={0.78}
                                onPress={() => sendMessage(prompt)}
                                style={[
                                  s.starterChip,
                                  {
                                    backgroundColor: colors.bg,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Sparkles size={12} color={colors.primary} />
                                <Text style={[s.starterChipText, { color: colors.text }]}>
                                  {prompt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Connection Error State */}
                    {connectionError && (
                      <View style={s.errorWrap}>
                        <AlertCircle size={24} color="#EF4444" />
                        <Text style={s.errorTitle}>Could not connect</Text>
                        <Text style={[s.errorSub, { color: colors.textMuted }]}>
                          {connectionError}
                        </Text>
                        <TouchableOpacity
                          style={[s.retryBtn, { backgroundColor: colors.primary }]}
                          onPress={handleRetry}
                        >
                          <Text style={s.retryBtnText}>↻ Retry</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Messages */}
                    {messages.map((msg, i) => {
                      if (msg.role === 'system') {
                        return (
                          <View key={i} style={s.systemMsg}>
                            <AlertCircle size={13} color={colors.primary} />
                            <Text style={[s.systemMsgText, { color: colors.textSecondary }]}>
                              {msg.content}
                            </Text>
                          </View>
                        );
                      }

                      const isUser = msg.role === 'user';
                      return (
                        <View
                          key={i}
                          style={[
                            s.bubbleRow,
                            isUser ? s.bubbleRowUser : s.bubbleRowAssistant,
                          ]}
                        >
                          {!isUser && (
                            <View style={[s.bubbleAvatar, { backgroundColor: colors.primary }]}>
                              {msg.isAdmin ? (
                                <User size={12} color="#FFFFFF" />
                              ) : (
                                <Bot size={12} color="#FFFFFF" />
                              )}
                            </View>
                          )}

                          <View style={s.bubbleCol}>
                            <View
                              style={[
                                s.bubbleBody,
                                isUser
                                  ? {
                                      backgroundColor: colors.primary,
                                      borderBottomRightRadius: 4,
                                    }
                                  : {
                                      backgroundColor: colors.bg,
                                      borderColor: colors.border,
                                      borderWidth: 1,
                                      borderBottomLeftRadius: 4,
                                    },
                              ]}
                            >
                              {msg.isAdmin && msg.adminName ? (
                                <Text style={[s.senderLabel, { color: colors.accent }]}>
                                  {msg.adminName}
                                </Text>
                              ) : null}

                              {isUser ? (
                                <Text style={s.userMsgText}>{msg.content}</Text>
                              ) : (
                                <NativeMarkdownMessage
                                  content={msg.content}
                                  textColor={colors.text}
                                  codeBg={colors.surfaceSecondary}
                                  primaryColor={colors.primary}
                                />
                              )}

                              <Text
                                style={[
                                  s.timeText,
                                  {
                                    color: isUser
                                      ? 'rgba(255,255,255,0.68)'
                                      : colors.textMuted,
                                  },
                                ]}
                              >
                                {msg.timestamp.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>

                            {msg.action && (
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => handleActionPress(msg.action!.url)}
                                style={[
                                  s.actionBtn,
                                  {
                                    backgroundColor: colors.primarySoft,
                                    borderColor: colors.primaryBorder,
                                  },
                                ]}
                              >
                                <Text style={[s.actionBtnText, { color: colors.primary }]}>
                                  {msg.action.label}
                                </Text>
                                <ExternalLink size={12} color={colors.primary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Typing Indicator */}
                    {isTyping && (
                      <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
                        <View style={[s.bubbleAvatar, { backgroundColor: colors.primary }]}>
                          <Bot size={13} color="#FFFFFF" />
                        </View>
                        <View
                          style={[
                            s.typingBubble,
                            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                          ]}
                        >
                          <TypingDotsIndicator dotColor={colors.primary} />
                          <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>
                            Vera is typing…
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  {/* Input Bar */}
                  <View
                    style={[
                      s.inputArea,
                      {
                        borderTopColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        s.input,
                        {
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={isConnected ? 'Type a message…' : 'Connecting…'}
                      placeholderTextColor={colors.textMuted}
                      value={inputValue}
                      onChangeText={setInputValue}
                      editable={isConnected}
                      multiline
                    />
                    <TouchableOpacity
                      style={[
                        s.sendBtn,
                        {
                          backgroundColor:
                            inputValue.trim() && isConnected
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                      onPress={() => sendMessage()}
                      disabled={!inputValue.trim() || !isConnected}
                    >
                      <Send size={17} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[
                      s.footerNote,
                      {
                        color: colors.textMuted,
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    Powered by Vera · GlobeVerify AI Support
                  </Text>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const s = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 92,
    right: 18,
    zIndex: 999,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.42,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  fabBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  panel: {
    width: '100%',
    height: Math.min(560, SCREEN_HEIGHT * 0.76),
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  panelMinimized: {
    height: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    gap: 10,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 8,
  },
  emptyBotCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyGreeting: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  starterChipsWrap: {
    width: '100%',
    gap: 7,
    marginTop: 10,
  },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  starterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  errorSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  systemMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
    maxWidth: '92%',
  },
  systemMsgText: {
    fontSize: 11.5,
    flexShrink: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '88%',
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubbleRowAssistant: {
    alignSelf: 'flex-start',
  },
  bubbleAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCol: {
    gap: 6,
    flexShrink: 1,
  },
  bubbleBody: {
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  userMsgText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    lineHeight: 19,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    height: 16,
    paddingRight: 2,
  },
  typingDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    maxHeight: 90,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 10.5,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
