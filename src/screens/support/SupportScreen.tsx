import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import {
    Headphones,
    Plus,
    Send,
    ChevronLeft,
    Clock,
    CheckCircle2,
    Bot,
    UserCheck,
    MessageSquare,
    Sparkles,
    X,
} from 'lucide-react-native';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';
import { getCachedData, getMemoryCache, setCachedData } from '../../api/client';
import { socketService } from '../../services/socketService';

interface ChatMessage {
    role: 'user' | 'assistant' | 'admin' | 'system';
    content: string;
    timestamp: Date | string;
    adminName?: string;
}

interface TicketSummary {
    sessionId: string;
    ticketId: string;
    subject: string;
    status: string;
    updatedAt: string;
    lastMessage: string;
}

interface SupportScreenProps {
    onBack?: () => void;
    onNavigateToHome?: () => void;
    onNavigateToBuy?: () => void;
    onNavigateToNumbers?: () => void;
    onNavigateToRentals?: () => void;
    onNavigateToWallet?: () => void;
}

const QUICK_PROMPTS = [
    'Wait for OTP expired — need refund check',
    'Deposit completed but wallet not credited',
    'Need help with a virtual number order',
    'Speak to a human support agent',
];

export const SupportScreen: React.FC<SupportScreenProps> = ({
    onBack,
    onNavigateToHome,
    onNavigateToBuy,
    onNavigateToNumbers,
    onNavigateToRentals,
    onNavigateToWallet,
}) => {
    const { colors, showToast } = useAppSettings();

    const cachedTickets = getMemoryCache<TicketSummary[]>('support_tickets_cache');
    const [tickets, setTickets] = useState<TicketSummary[]>(cachedTickets || []);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [activeSubject, setActiveSubject] = useState<string>('');
    const [sessionStatus, setSessionStatus] = useState<string>('active');
    const [assignedAdmin, setAssignedAdmin] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [connected, setConnected] = useState(false);
    const [typing, setTyping] = useState(false);
    const [inputMessage, setInputMessage] = useState('');

    // New Ticket Modal
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newInitialMessage, setNewInitialMessage] = useState('');
    const [creating, setCreating] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const activeSessionRef = useRef<string | null>(null);
    const scrollRef = useRef<any>(null);

    useEffect(() => {
        activeSessionRef.current = activeSessionId;
    }, [activeSessionId]);

    useEffect(() => {
        if (!cachedTickets) {
            getCachedData<TicketSummary[]>('support_tickets_cache').then((disk) => {
                if (disk) setTickets(disk);
            });
        }

        let mounted = true;
        let sock: Socket | null = null;

        const connectSupportSocket = async () => {
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token || !mounted) return;

            sock = io(`${socketService.getBackendUrl()}/support`, {
                auth: { token },
                transports: ['polling', 'websocket'],
                reconnection: true,
                reconnectionDelay: 2000,
            });
            socketRef.current = sock;

            sock.on('connect', () => {
                if (!mounted) return;
                setConnected(true);
                sock?.emit('support:list_tickets');
                if (activeSessionRef.current) {
                    sock?.emit('support:join_ticket', { sessionId: activeSessionRef.current });
                }
            });

            sock.on('disconnect', () => {
                if (mounted) setConnected(false);
            });

            sock.on('support:tickets_list', (data: { tickets: TicketSummary[] }) => {
                if (!mounted) return;
                const list = data?.tickets || [];
                setTickets(list);
                setCachedData('support_tickets_cache', list);
            });

            sock.on(
                'support:session',
                (data: {
                    sessionId: string;
                    ticketId: string;
                    subject: string;
                    status: string;
                    messages: ChatMessage[];
                }) => {
                    if (!mounted) return;
                    setActiveSessionId(data.sessionId);
                    setActiveTicketId(data.ticketId);
                    setActiveSubject(data.subject || 'Support Ticket');
                    setSessionStatus(data.status || 'active');
                    setMessages(data.messages || []);
                    setCreating(false);
                    setCreateModalVisible(false);
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                }
            );

            sock.on('support:ticket_created', () => {
                sock?.emit('support:list_tickets');
            });

            sock.on('support:ai_response', (data: { message: string }) => {
                if (!mounted) return;
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: data.message,
                        timestamp: new Date(),
                    },
                ]);
                sock?.emit('support:list_tickets');
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
            });

            sock.on(
                'support:admin_joined',
                (data: { sessionId: string; admin: string; message: string; timestamp?: string }) => {
                    if (!mounted) return;
                    setAssignedAdmin(data.admin);
                    setSessionStatus('human_active');
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: 'system',
                            content: data.message || `${data.admin} joined the chat.`,
                            timestamp: data.timestamp || new Date(),
                        },
                    ]);
                }
            );

            sock.on('support:hand_to_ai', (data: { sessionId: string; message: string }) => {
                if (!mounted) return;
                setAssignedAdmin(null);
                setSessionStatus('active');
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'system',
                        content: data.message,
                        timestamp: new Date(),
                    },
                ]);
            });

            sock.on(
                'support:message_relay',
                (data: {
                    from: 'user' | 'admin' | 'assistant';
                    adminName?: string;
                    message: string;
                    timestamp?: string;
                }) => {
                    if (!mounted) return;
                    if (data.from === 'admin') {
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: 'admin',
                                content: data.message,
                                timestamp: data.timestamp || new Date(),
                                adminName: data.adminName || 'Support Agent',
                            },
                        ]);
                        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                    }
                    sock?.emit('support:list_tickets');
                }
            );

            sock.on('support:typing', (data: { typing: boolean }) => {
                if (mounted) setTyping(Boolean(data?.typing));
            });

            sock.on('support:escalated', (data: { sessionId: string; message: string }) => {
                if (!mounted) return;
                setSessionStatus('escalated');
                setMessages((prev) => [
                    ...prev,
                    { role: 'system', content: data.message, timestamp: new Date() },
                ]);
                sock?.emit('support:list_tickets');
            });

            sock.on('support:closed', (data: { sessionId: string; message: string }) => {
                if (!mounted) return;
                setSessionStatus('closed');
                setMessages((prev) => [
                    ...prev,
                    { role: 'system', content: data.message, timestamp: new Date() },
                ]);
                sock?.emit('support:list_tickets');
            });

            sock.on('support:error', (data: { message: string }) => {
                if (!mounted) return;
                setCreating(false);
                showToast(data?.message || 'Unable to process support request.', 'error');
            });
        };

        connectSupportSocket();

        return () => {
            mounted = false;
            sock?.disconnect();
        };
    }, []);

    const handleSelectTicket = (ticket: TicketSummary) => {
        setActiveSessionId(ticket.sessionId);
        setActiveTicketId(ticket.ticketId);
        setActiveSubject(ticket.subject);
        setSessionStatus(ticket.status);
        socketRef.current?.emit('support:join_ticket', { sessionId: ticket.sessionId });
    };

    const handleCreateTicket = () => {
        if (!newSubject.trim() || !newInitialMessage.trim()) {
            showToast('Please enter both a subject and message.', 'error');
            return;
        }
        if (!socketRef.current?.connected) {
            showToast('Reconnecting to live support server...', 'info');
            return;
        }
        setCreating(true);
        setMessages([
            {
                role: 'user',
                content: newInitialMessage.trim(),
                timestamp: new Date(),
            },
        ]);
        socketRef.current.emit('support:create_ticket', {
            subject: newSubject.trim(),
            message: newInitialMessage.trim(),
        });
        setNewSubject('');
        setNewInitialMessage('');
    };

    const handleSendMessage = (overrideText?: string) => {
        const text = (overrideText ?? inputMessage).trim();
        if (!text || !activeSessionId || sessionStatus === 'closed') return;
        if (!socketRef.current?.connected) {
            showToast('Waiting for live support connection...', 'info');
            return;
        }

        setMessages((prev) => [
            ...prev,
            {
                role: 'user',
                content: text,
                timestamp: new Date(),
            },
        ]);
        if (!overrideText) setInputMessage('');
        socketRef.current.emit('support:message', {
            sessionId: activeSessionId,
            message: text,
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleSelectNavTab = (tab: NavTabId) => {
        if (tab === 'home') onNavigateToHome?.();
        else if (tab === 'buy') onNavigateToBuy?.();
        else if (tab === 'sms') onNavigateToNumbers?.();
        else if (tab === 'rentals') onNavigateToRentals?.();
        else if (tab === 'wallet') onNavigateToWallet?.();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'human_active':
                return { label: 'Live Agent', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
            case 'escalated':
                return { label: 'Escalated', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
            case 'closed':
                return { label: 'Closed', color: '#64748B', bg: 'rgba(100,116,139,0.14)' };
            default:
                return { label: 'Open', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' };
        }
    };

    // Active Chat View
    if (activeSessionId) {
        const badge = getStatusBadge(sessionStatus);
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
                <StatusBar style={colors.statusBar} />
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Chat Top Bar */}
                    <View
                        style={[
                            styles.chatHeader,
                            { backgroundColor: colors.surface, borderBottomColor: colors.border },
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => {
                                setActiveSessionId(null);
                                socketRef.current?.emit('support:list_tickets');
                            }}
                        >
                            <ChevronLeft size={20} color={colors.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.chatSubject, { color: colors.text }]} numberOfLines={1}>
                                    {activeSubject || 'Support Chat'}
                                </Text>
                                {activeTicketId && (
                                    <Text style={[styles.ticketIdTag, { color: colors.textSecondary }]}>
                                        #{activeTicketId}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <View
                                    style={[
                                        styles.onlineDot,
                                        { backgroundColor: connected ? '#10B981' : '#F59E0B' },
                                    ]}
                                />
                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                    {assignedAdmin
                                        ? `Connected with ${assignedAdmin}`
                                        : 'Vera AI + Human Support Team'}
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                    </View>

                    {/* Messages */}
                    <ScrollView
                        ref={scrollRef}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                    >
                        {messages.map((msg, idx) => {
                            if (msg.role === 'system') {
                                return (
                                    <View key={idx} style={styles.systemMsgWrap}>
                                        <Text
                                            style={[
                                                styles.systemMsgText,
                                                { color: colors.textSecondary, backgroundColor: colors.surface },
                                            ]}
                                        >
                                            {msg.content}
                                        </Text>
                                    </View>
                                );
                            }

                            const isUser = msg.role === 'user';
                            return (
                                <View
                                    key={idx}
                                    style={[
                                        styles.msgBubbleWrap,
                                        isUser ? styles.msgRight : styles.msgLeft,
                                    ]}
                                >
                                    {!isUser && (
                                        <View style={styles.senderHeader}>
                                            {msg.role === 'admin' ? (
                                                <UserCheck size={12} color="#10B981" />
                                            ) : (
                                                <Bot size={12} color={colors.primary} />
                                            )}
                                            <Text style={[styles.senderName, { color: colors.textSecondary }]}>
                                                {msg.role === 'admin'
                                                    ? msg.adminName || 'Support Agent'
                                                    : 'Vera (Support AI)'}
                                            </Text>
                                        </View>
                                    )}
                                    <View
                                        style={[
                                            styles.msgBubble,
                                            isUser
                                                ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                                                : {
                                                      backgroundColor: colors.surface,
                                                      borderColor: colors.border,
                                                      borderWidth: 1,
                                                      borderBottomLeftRadius: 4,
                                                  },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.msgText,
                                                { color: isUser ? '#FFFFFF' : colors.text },
                                            ]}
                                        >
                                            {msg.content}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}

                        {typing && (
                            <View style={[styles.msgBubbleWrap, styles.msgLeft]}>
                                <View
                                    style={[
                                        styles.typingBubble,
                                        { backgroundColor: colors.surface, borderColor: colors.border },
                                    ]}
                                >
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                        Support is typing...
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Quick Actions if few messages */}
                    {messages.length <= 2 && sessionStatus !== 'closed' && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.quickPromptsBar}
                        >
                            {QUICK_PROMPTS.map((prompt) => (
                                <TouchableOpacity
                                    key={prompt}
                                    style={[
                                        styles.quickPromptChip,
                                        { backgroundColor: colors.surface, borderColor: colors.border },
                                    ]}
                                    onPress={() => handleSendMessage(prompt)}
                                >
                                    <Sparkles size={11} color={colors.primary} />
                                    <Text style={[styles.quickPromptText, { color: colors.text }]}>
                                        {prompt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Input Bar */}
                    {sessionStatus === 'closed' ? (
                        <View
                            style={[
                                styles.closedBar,
                                { backgroundColor: colors.surface, borderTopColor: colors.border },
                            ]}
                        >
                            <CheckCircle2 size={16} color={colors.textSecondary} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                                This support ticket is closed. Create a new ticket if you need further assistance.
                            </Text>
                        </View>
                    ) : (
                        <View
                            style={[
                                styles.inputBar,
                                { backgroundColor: colors.surface, borderTopColor: colors.border },
                            ]}
                        >
                            <TextInput
                                value={inputMessage}
                                onChangeText={setInputMessage}
                                placeholder="Write a message..."
                                placeholderTextColor={colors.textMuted}
                                style={[
                                    styles.chatInput,
                                    {
                                        color: colors.text,
                                        backgroundColor: colors.bg,
                                        borderColor: colors.border,
                                    },
                                ]}
                                multiline
                            />
                            <TouchableOpacity
                                style={[
                                    styles.sendBtn,
                                    {
                                        backgroundColor: inputMessage.trim() ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => handleSendMessage()}
                                disabled={!inputMessage.trim()}
                            >
                                <Send size={16} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // Ticket List View
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
            <StatusBar style={colors.statusBar} />
            <ModernHeader
                title="Support & Live Chat"
                onBack={onBack}
                onRefresh={() => socketRef.current?.emit('support:list_tickets')}
            />

            <ScrollView contentContainerStyle={styles.listScrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.titleLine}>
                            <Headphones size={20} color={colors.primary} />
                            <Text style={[styles.pageTitle, { color: colors.text }]}>
                                Support & Live Chat
                            </Text>
                        </View>
                        <Text style={[styles.pageSub, { color: colors.textSecondary }]}>
                            Instant order checks, refunds, and live human support tickets.
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.newTicketBtn, { backgroundColor: colors.primary }]}
                        onPress={() => setCreateModalVisible(true)}
                    >
                        <Plus size={15} color="#FFF" />
                        <Text style={styles.newTicketBtnText}>New Ticket</Text>
                    </TouchableOpacity>
                </View>

                {/* Connection Status Strip */}
                <View
                    style={[
                        styles.statusStrip,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View
                            style={[
                                styles.onlineDot,
                                { backgroundColor: connected ? '#10B981' : '#F59E0B' },
                            ]}
                        />
                        <Text style={[styles.statusStripText, { color: colors.text }]}>
                            {connected
                                ? 'Live Support Online · AI & Human Agents Ready'
                                : 'Connecting to Live Support Server...'}
                        </Text>
                    </View>
                </View>

                {/* Tickets List */}
                {tickets.length === 0 ? (
                    <View
                        style={[
                            styles.emptyCard,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <MessageSquare size={34} color={colors.primary} style={{ opacity: 0.75 }} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            No Support Tickets Yet
                        </Text>
                        <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                            Have an issue with an SMS code, rental number, or deposit? Open a live support ticket and our system will assist you right away.
                        </Text>
                        <TouchableOpacity
                            style={[styles.newTicketBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
                            onPress={() => setCreateModalVisible(true)}
                        >
                            <Plus size={15} color="#FFF" />
                            <Text style={styles.newTicketBtnText}>Open First Support Ticket</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    tickets.map((t) => {
                        const badge = getStatusBadge(t.status);
                        return (
                            <TouchableOpacity
                                key={t.sessionId}
                                activeOpacity={0.75}
                                onPress={() => handleSelectTicket(t)}
                                style={[
                                    styles.ticketCard,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                ]}
                            >
                                <View style={styles.ticketTopRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                        <Text
                                            style={[styles.ticketSubject, { color: colors.text }]}
                                            numberOfLines={1}
                                        >
                                            {t.subject}
                                        </Text>
                                        {t.ticketId && (
                                            <Text style={[styles.ticketIdTag, { color: colors.textSecondary }]}>
                                                #{t.ticketId}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                                        <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>

                                <Text
                                    style={[styles.ticketPreview, { color: colors.textSecondary }]}
                                    numberOfLines={2}
                                >
                                    {t.lastMessage || 'Tap to view conversation'}
                                </Text>

                                <View style={styles.ticketFooter}>
                                    <Clock size={11} color={colors.textSecondary} />
                                    <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                                        Updated {new Date(t.updatedAt).toLocaleString()}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            <ModernBottomNav activeTab="more" onSelectTab={handleSelectNavTab} />

            {/* Create Support Ticket Modal */}
            {createModalVisible && (
                <Modal
                    visible={true}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setCreateModalVisible(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateModalVisible(false)} />
                        <View
                            style={[
                                styles.modalCard,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                            ]}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Create Support Ticket
                                </Text>
                                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                                    <X size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.label, { color: colors.textSecondary }]}>Subject</Text>
                            <TextInput
                                value={newSubject}
                                onChangeText={setNewSubject}
                                placeholder="e.g. Deposit not credited / Order refund"
                                placeholderTextColor={colors.textMuted}
                                style={[
                                    styles.modalInput,
                                    {
                                        color: colors.text,
                                        borderColor: colors.border,
                                        backgroundColor: colors.bg,
                                    },
                                ]}
                            />

                            <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Describe Your Issue
                            </Text>
                            <TextInput
                                value={newInitialMessage}
                                onChangeText={setNewInitialMessage}
                                placeholder="Include your phone number order or transaction reference if applicable..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={4}
                                style={[
                                    styles.modalInput,
                                    {
                                        color: colors.text,
                                        borderColor: colors.border,
                                        backgroundColor: colors.bg,
                                        minHeight: 92,
                                        textAlignVertical: 'top',
                                    },
                                ]}
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                                onPress={handleCreateTicket}
                                disabled={creating}
                            >
                                {creating ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Start Support Chat</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    listScrollContent: { padding: 16, paddingBottom: 110, gap: 12 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageTitle: { fontSize: 20, fontWeight: '800' },
    pageSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
    newTicketBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 10,
    },
    newTicketBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    statusStrip: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 11,
        borderWidth: 1,
    },
    onlineDot: { width: 8, height: 8, borderRadius: 4 },
    statusStripText: { fontSize: 12, fontWeight: '600' },
    emptyCard: {
        padding: 24,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
    emptyDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
    ticketCard: {
        padding: 14,
        borderRadius: 13,
        borderWidth: 1,
        gap: 6,
    },
    ticketTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    ticketSubject: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
    ticketIdTag: { fontSize: 11, fontFamily: 'monospace', fontWeight: '600' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 10, fontWeight: '800' },
    ticketPreview: { fontSize: 12, lineHeight: 17 },
    ticketFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    ticketTime: { fontSize: 11 },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderBottomWidth: 1,
        gap: 10,
    },
    backBtn: { padding: 4 },
    chatSubject: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
    messagesContent: { padding: 14, paddingBottom: 24, gap: 10 },
    systemMsgWrap: { alignItems: 'center', marginVertical: 4 },
    systemMsgText: {
        fontSize: 11,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        textAlign: 'center',
    },
    msgBubbleWrap: { maxWidth: '84%', gap: 3 },
    msgRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    msgLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    senderHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
    senderName: { fontSize: 10, fontWeight: '700' },
    msgBubble: {
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 14,
    },
    msgText: { fontSize: 13, lineHeight: 19 },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    quickPromptsBar: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    quickPromptChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    quickPromptText: { fontSize: 11, fontWeight: '600' },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 10,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        borderTopWidth: 1,
        gap: 8,
    },
    chatInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        maxHeight: 100,
        fontSize: 13,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closedBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderTopWidth: 1,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    modalTitle: { fontSize: 16, fontWeight: '800' },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
    modalInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
    },
    submitBtn: {
        marginTop: 14,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    submitBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
