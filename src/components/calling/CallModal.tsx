import { requestMicrophonePermission } from '../../utils/permissionUtils';
import { WebView } from 'react-native-webview';
const HeadlessWebView = WebView as any;
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Delete,
  X,
  User,
  Grid3x3,
  Shield,
  Trash2,
  Clock,
  ArrowUpRight,
} from 'lucide-react-native';
import { useCall } from '../../context/CallContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { CallLogItem } from '../../services/callLogService';

const DIALPAD_KEYS = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
];

export const CallModal: React.FC = () => {
  const {
    callState,
    currentCall,
    callDuration,
    isDialpadOpen,
    dialpadFromNumber,
    dialpadRentalId,
    dialpadInitialTab,
    isMuted,
    isSpeaker,
    callLogs,
    answerCall,
    rejectCall,
    hangupCall,
    startOutboundCall,
    closeDialpad,
    toggleMute,
    toggleSpeaker,
    clearAllCallLogs,
    deleteCallLog,
  } = useCall();

  const { colors } = useAppSettings();
  const isDark = colors.isDark;

  // Segmented tab inside dialpad modal: 'keypad' | 'recents'
  const [dialpadTab, setDialpadTab] = useState<'keypad' | 'recents'>('keypad');

  // Hidden WebRTC audio engine ref & URL
  const engineWebViewRef = useRef<any>(null);
  const [engineUrl, setEngineUrl] = useState<string | null>(null);

  // In-call keypad toggle state (for DTMF tones)
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);

  useEffect(() => {
    if (isDialpadOpen) {
      setDialpadTab(dialpadInitialTab || 'keypad');
    }
  }, [isDialpadOpen, dialpadInitialTab]);

  useEffect(() => {
    if (callState === 'idle') {
      setEngineUrl(null);
      setShowInCallKeypad(false);
    } else if (callState === 'ringing_inbound' && currentCall?.rentalId && !engineUrl) {
      // Pre-warm the headless WebRTC engine so it's connected when the user taps Answer
      apiClient
        .get(`/numbers/rentals/${currentCall.rentalId}/voice-token`)
        .then((res) => {
          const token = res.data?.token || '';
          if (token) {
            const url = `https://globeverify.com/call?token=${encodeURIComponent(token)}&from=${encodeURIComponent(currentCall.phoneNumber || '')}&rentalId=${currentCall.rentalId}&mode=engine`;
            setEngineUrl(url);
          }
        })
        .catch((e: any) => console.warn('[CallModal] Pre-warm engine token error:', e?.message));
    }
  }, [callState, currentCall?.rentalId, currentCall?.phoneNumber, engineUrl]);

  // Dialpad state
  const [dialedNumber, setDialedNumber] = useState('');

  // Subtle pulsing animation for incoming call ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callState === 'ringing_inbound' || callState === 'calling_outbound') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 850,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState, pulseAnim]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatLogDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeStr}`;
    }
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const formatLogDuration = (item: CallLogItem) => {
    if (item.status === 'missed') return 'Missed';
    if (item.status === 'rejected') return 'Declined';
    if (item.status === 'failed') return 'Unanswered';
    if (!item.duration || item.duration === 0) return '0s';
    const m = Math.floor(item.duration / 60);
    const s = item.duration % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleKeyPress = (digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDialedNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleDtmfPress = (digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (engineWebViewRef.current) {
      engineWebViewRef.current.injectJavaScript(`if (window.callEngineDTMF) { window.callEngineDTMF('${digit}'); } true;`);
    }
  };

  const handleStartCall = async (targetNumber?: string) => {
    const numToCall = targetNumber || dialedNumber;
    if (!numToCall.trim() || !dialpadRentalId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await requestMicrophonePermission().catch(() => {});
    let num = numToCall.trim();
    if (!num.startsWith('+')) {
      num = '+' + num;
    }
    const rentalId = dialpadRentalId;
    const fromNum = dialpadFromNumber || 'Leased Number';

    startOutboundCall(rentalId, fromNum, num);

    // Spin up headless WebRTC audio engine in completely hidden background WebView
    try {
      const res = await apiClient.get(`/numbers/rentals/${rentalId}/voice-token`);
      const token = res.data?.token || '';
      if (token) {
        const url = `https://globeverify.com/call?token=${encodeURIComponent(token)}&from=${encodeURIComponent(fromNum)}&rentalId=${rentalId}&to=${encodeURIComponent(num)}&mode=engine`;
        setEngineUrl(url);
      }
    } catch (e: any) {
      console.warn('[CallModal] Voice token error:', e?.message);
    }

    setDialedNumber('');
  };

  const handleAnswerCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await requestMicrophonePermission().catch(() => {});
    answerCall();
    const rentalId = currentCall?.rentalId;
    if (rentalId) {
      try {
        const res = await apiClient.get(`/numbers/rentals/${rentalId}/voice-token`);
        const token = res.data?.token || '';
        if (token) {
          const url = `https://globeverify.com/call?token=${encodeURIComponent(token)}&from=${encodeURIComponent(currentCall?.phoneNumber || '')}&rentalId=${rentalId}&mode=engine`;
          setEngineUrl(url);
        }
      } catch (e: any) {
        console.warn('[CallModal] Answer engine token error:', e?.message);
      }
    }
  };

  const handleRejectCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    rejectCall();
  };

  const handleHangup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (engineWebViewRef.current) {
      engineWebViewRef.current.injectJavaScript('if (window.callEngineHangup) { window.callEngineHangup(); } true;');
    }
    setEngineUrl(null);
    setShowInCallKeypad(false);
    hangupCall();
  };

  const handleToggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleMute();
    if (engineWebViewRef.current) {
      engineWebViewRef.current.injectJavaScript(`if (window.callEngineMute) { window.callEngineMute(${!isMuted}); } true;`);
    }
  };

  const handleToggleSpeaker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleSpeaker();
  };

  const handleClearAllLogs = () => {
    Alert.alert(
      'Clear Call History',
      'Are you sure you want to delete all call logs from local storage?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearAllCallLogs();
          },
        },
      ]
    );
  };

  const isModalVisible = callState !== 'idle' || isDialpadOpen;

  if (!isModalVisible) return null;

  // ── 1. DIALPAD & RECENTS BOTTOM SHEET ─────────────────────────────────────
  if (isDialpadOpen && callState === 'idle') {
    return (
      <Modal
        visible={isDialpadOpen}
        animationType="slide"
        transparent
        onRequestClose={closeDialpad}
      >
        <View style={[s.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)' }]}>
          <SafeAreaView
            edges={['bottom']}
            style={[
              s.dialpadSheet,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            {/* Minimal Drag Indicator */}
            <View style={[s.handleBar, { backgroundColor: colors.border }]} />

            {/* Segmented Tab Switch: Keypad | Recents */}
            <View style={s.topControlsRow}>
              <View style={[s.segmentedPill, { backgroundColor: colors.surfaceSecondary }]}>
                <TouchableOpacity
                  style={[
                    s.segmentBtn,
                    dialpadTab === 'keypad' && [s.segmentBtnActive, { backgroundColor: colors.surface }],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setDialpadTab('keypad');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.segmentText,
                      { color: dialpadTab === 'keypad' ? colors.text : colors.textMuted },
                    ]}
                  >
                    Keypad
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.segmentBtn,
                    dialpadTab === 'recents' && [s.segmentBtnActive, { backgroundColor: colors.surface }],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setDialpadTab('recents');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.segmentText,
                      { color: dialpadTab === 'recents' ? colors.text : colors.textMuted },
                    ]}
                  >
                    Recents{callLogs.length > 0 ? ` (${callLogs.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={closeDialpad}
                style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceSecondary }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {dialpadTab === 'keypad' ? (
              /* ─── KEYPAD VIEW ─────────────────────────────────────── */
              <>
                {/* Caller Line Info */}
                <Text style={[s.sheetSubtitle, { color: colors.textMuted }]}>
                  Calling as {dialpadFromNumber || 'Leased Number'}
                </Text>

                {/* Large Floating Number Display */}
                <View style={s.numberDisplayRow}>
                  <Text
                    style={[
                      s.numberText,
                      { color: dialedNumber ? colors.text : colors.textMuted },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {dialedNumber || 'Enter number'}
                  </Text>
                  {dialedNumber.length > 0 && (
                    <TouchableOpacity
                      onPress={handleBackspace}
                      style={[s.backspaceBtn, { backgroundColor: colors.surfaceSecondary }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Delete size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 3x4 Clean Circular Dialpad Keys */}
                <View style={s.keysGrid}>
                  {DIALPAD_KEYS.map((k) => (
                    <TouchableOpacity
                      key={k.digit}
                      style={[
                        s.circularKey,
                        {
                          backgroundColor: colors.surfaceSecondary,
                        },
                      ]}
                      onPress={() => handleKeyPress(k.digit)}
                      activeOpacity={0.6}
                    >
                      <Text style={[s.keyDigit, { color: colors.text }]}>{k.digit}</Text>
                      {k.sub ? <Text style={[s.keySub, { color: colors.textMuted }]}>{k.sub}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Bottom Call Button */}
                <View style={s.callActionArea}>
                  <TouchableOpacity
                    style={[
                      s.callBtn,
                      {
                        opacity: dialedNumber.trim().length >= 3 ? 1 : 0.4,
                      },
                    ]}
                    disabled={dialedNumber.trim().length < 3}
                    onPress={() => handleStartCall()}
                    activeOpacity={0.8}
                  >
                    <Phone size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ─── RECENTS VIEW ────────────────────────────────────── */
              <View style={s.recentsContainer}>
                {/* Recents Header Bar */}
                <View style={s.recentsHeaderRow}>
                  <Text style={[s.recentsTitle, { color: colors.text }]}>Call History</Text>
                  {callLogs.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClearAllLogs}
                      style={[s.clearAllBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={s.clearAllBtnText}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Call Logs List */}
                {callLogs.length === 0 ? (
                  <View style={s.emptyRecentsView}>
                    <View style={[s.emptyIconCircle, { backgroundColor: colors.surfaceSecondary }]}>
                      <Clock size={28} color={colors.textMuted} />
                    </View>
                    <Text style={[s.emptyTitle, { color: colors.text }]}>No Call History</Text>
                    <Text style={[s.emptySubtitle, { color: colors.textMuted }]}>
                      Your incoming and outgoing VoIP calls will be saved locally here.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={s.recentsList}
                    contentContainerStyle={{ paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {callLogs.map((log) => {
                      const isOutbound = log.direction === 'outbound';
                      const isMissed = log.status === 'missed' || log.status === 'rejected' || log.status === 'failed';

                      return (
                        <View
                          key={log.id}
                          style={[s.logItemRow, { borderBottomColor: colors.border }]}
                        >
                          {/* Direction Icon Badge */}
                          <View
                            style={[
                              s.logIconCircle,
                              {
                                backgroundColor: isMissed
                                  ? isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2'
                                  : isOutbound
                                  ? isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF'
                                  : isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                              },
                            ]}
                          >
                            {isMissed ? (
                              <PhoneOff size={16} color="#EF4444" />
                            ) : isOutbound ? (
                              <ArrowUpRight size={16} color={colors.primary} />
                            ) : (
                              <PhoneIncoming size={16} color="#10B981" />
                            )}
                          </View>

                          {/* Caller Details */}
                          <TouchableOpacity
                            style={s.logDetailsCol}
                            onPress={() => {
                              setDialedNumber(log.remoteNumber);
                              setDialpadTab('keypad');
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                s.logRemoteNumber,
                                { color: isMissed ? '#EF4444' : colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {log.remoteNumber}
                            </Text>
                            <Text style={[s.logMetaText, { color: colors.textMuted }]}>
                              {formatLogDate(log.timestamp)} • {formatLogDuration(log)}
                            </Text>
                          </TouchableOpacity>

                          {/* Action Buttons: Quick Call & Delete */}
                          <View style={s.logActionsRow}>
                            <TouchableOpacity
                              onPress={() => handleStartCall(log.remoteNumber)}
                              style={[s.quickCallBtn, { backgroundColor: '#10B981' }]}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              activeOpacity={0.8}
                            >
                              <Phone size={14} color="#FFFFFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => deleteCallLog(log.id)}
                              style={[s.deleteLogBtn, { backgroundColor: colors.surfaceSecondary }]}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              activeOpacity={0.7}
                            >
                              <Trash2 size={13} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  // ── 2. INCOMING CALL SCREEN ───────────────────────────────────────────────
  if (callState === 'ringing_inbound') {
    return (
      <Modal visible animationType="fade" transparent={false}>
        <SafeAreaView style={[s.fullScreenCall, { backgroundColor: colors.bg }]}>
          <StatusBar style={isDark ? 'light' : 'dark'} />

          {/* Minimalist Top Tag */}
          <View style={s.topBar}>
            <Shield size={12} color={colors.textMuted} />
            <Text style={[s.topBarText, { color: colors.textMuted }]}>
              GLOBEVERIFY ENCRYPTED CALL
            </Text>
          </View>

          {/* Caller Identity */}
          <View style={s.callerArea}>
            <View style={s.avatarWrapper}>
              <Animated.View
                style={[
                  s.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    borderColor: '#10B981',
                  },
                ]}
              />
              <View
                style={[
                  s.avatarCircle,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                  },
                ]}
              >
                <PhoneIncoming size={42} color="#10B981" />
              </View>
            </View>

            <Text style={s.callStateLabel}>Incoming Call...</Text>

            <Text
              style={[s.remoteNumberText, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currentCall?.remoteNumber || 'Unknown Caller'}
            </Text>

            <Text style={[s.myNumberSubtitle, { color: colors.textMuted }]}>
              To your line {currentCall?.phoneNumber || 'Private Rental'}
            </Text>
          </View>

          {/* Action Buttons: Decline & Answer */}
          <View style={s.incomingActionRow}>
            <View style={s.actionCol}>
              <TouchableOpacity
                onPress={handleRejectCall}
                style={[s.circleActionBtn, { backgroundColor: '#EF4444' }]}
                activeOpacity={0.8}
              >
                <PhoneOff size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[s.actionBtnLabel, { color: colors.textMuted }]}>Decline</Text>
            </View>

            <View style={s.actionCol}>
              <TouchableOpacity
                onPress={handleAnswerCall}
                style={[s.circleActionBtn, { backgroundColor: '#10B981' }]}
                activeOpacity={0.8}
              >
                <Phone size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[s.actionBtnLabel, { color: colors.textMuted }]}>Answer</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── 3. ACTIVE / OUTBOUND CALL SCREEN ──────────────────────────────────────
  const isCallingOutbound = callState === 'calling_outbound';
  const isEnded = callState === 'ended';

  return (
    <Modal visible animationType="fade" transparent={false}>
      <SafeAreaView style={[s.fullScreenCall, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Minimalist Top Tag */}
        <View style={s.topBar}>
          <View
            style={[
              s.liveDot,
              {
                backgroundColor: isCallingOutbound ? colors.primary : '#10B981',
              },
            ]}
          />
          <Text style={[s.topBarText, { color: colors.textMuted }]}>
            {isCallingOutbound ? 'OUTBOUND VOIP LINE' : isEnded ? 'CALL ENDED' : 'GLOBEVERIFY HD VOICE'}
          </Text>
        </View>

        {/* Contact Info and Duration */}
        <View style={s.callerArea}>
          <View
            style={[
              s.avatarCircle,
              {
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
              },
            ]}
          >
            <User size={42} color={colors.primary} />
          </View>

          <Text
            style={[s.remoteNumberText, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currentCall?.remoteNumber || 'GlobeVerify Contact'}
          </Text>

          <Text
            style={[
              s.callTimerText,
              {
                color: isCallingOutbound ? colors.primary : isEnded ? colors.textMuted : colors.text,
              },
            ]}
          >
            {isCallingOutbound
              ? 'Ringing...'
              : isEnded
              ? 'Call Ended'
              : formatSeconds(callDuration)}
          </Text>

          <Text style={[s.myNumberSubtitle, { color: colors.textMuted }]}>
            via {currentCall?.phoneNumber || 'Private Line'}
          </Text>
        </View>

        {/* In-Call Keypad Overlay (if opened by user during automated prompt) */}
        {showInCallKeypad ? (
          <View style={s.inCallKeypadGrid}>
            {DIALPAD_KEYS.map((k) => (
              <TouchableOpacity
                key={k.digit}
                style={[s.inCallKey, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => handleDtmfPress(k.digit)}
                activeOpacity={0.6}
              >
                <Text style={[s.inCallKeyDigit, { color: colors.text }]}>{k.digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* In-Call Controls Toolbar: Mute, Keypad, Speaker */}
        <View style={s.controlsRow}>
          {/* Mute */}
          <View style={s.ctrlItem}>
            <TouchableOpacity
              style={[
                s.ctrlCircle,
                {
                  backgroundColor: isMuted
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.22)'
                      : '#FEE2E2'
                    : colors.surfaceSecondary,
                },
              ]}
              onPress={handleToggleMute}
              activeOpacity={0.7}
            >
              {isMuted ? (
                <MicOff size={24} color="#EF4444" />
              ) : (
                <Mic size={24} color={colors.text} />
              )}
            </TouchableOpacity>
            <Text
              style={[
                s.ctrlLabel,
                { color: isMuted ? '#EF4444' : colors.textMuted },
              ]}
            >
              {isMuted ? 'Muted' : 'Mute'}
            </Text>
          </View>

          {/* Keypad */}
          <View style={s.ctrlItem}>
            <TouchableOpacity
              style={[
                s.ctrlCircle,
                {
                  backgroundColor: showInCallKeypad
                    ? isDark
                      ? 'rgba(59, 130, 246, 0.22)'
                      : '#DBEAFE'
                    : colors.surfaceSecondary,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowInCallKeypad((prev) => !prev);
              }}
              activeOpacity={0.7}
            >
              <Grid3x3 size={24} color={showInCallKeypad ? colors.primary : colors.text} />
            </TouchableOpacity>
            <Text
              style={[
                s.ctrlLabel,
                { color: showInCallKeypad ? colors.primary : colors.textMuted },
              ]}
            >
              Keypad
            </Text>
          </View>

          {/* Speaker */}
          <View style={s.ctrlItem}>
            <TouchableOpacity
              style={[
                s.ctrlCircle,
                {
                  backgroundColor: isSpeaker
                    ? isDark
                      ? 'rgba(59, 130, 246, 0.22)'
                      : '#DBEAFE'
                    : colors.surfaceSecondary,
                },
              ]}
              onPress={handleToggleSpeaker}
              activeOpacity={0.7}
            >
              {isSpeaker ? (
                <Volume2 size={24} color={colors.primary} />
              ) : (
                <VolumeX size={24} color={colors.text} />
              )}
            </TouchableOpacity>
            <Text
              style={[
                s.ctrlLabel,
                { color: isSpeaker ? colors.primary : colors.textMuted },
              ]}
            >
              Speaker
            </Text>
          </View>
        </View>

        {/* Bottom Hangup Button */}
        <View style={s.hangupArea}>
          <TouchableOpacity
            onPress={handleHangup}
            style={s.hangupBtn}
            activeOpacity={0.8}
          >
            <PhoneOff size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[s.actionBtnLabel, { color: colors.textMuted }]}>End Call</Text>
        </View>

        {/* Headless WebRTC Audio Engine with hardware acceleration and active surface */}
        {engineUrl && (
          <HeadlessWebView
            ref={engineWebViewRef}
            source={{ uri: engineUrl }}
            containerStyle={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 2,
              height: 2,
              opacity: 0.01,
              zIndex: -1,
            }}
            style={{
              width: 2,
              height: 2,
              opacity: 0.01,
            }}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            pointerEvents="none"
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            mediaCapturePermissionGrantType="grant"
            androidLayerType="hardware"
            originWhitelist={['*']}
            onPermissionRequest={(event: any) => {
              try {
                if (event?.request?.grant) {
                  event.request.grant(event.request.getResources?.() || event.resources || []);
                }
              } catch (e) {
                console.warn('[CallModal] onPermissionRequest grant error:', e);
              }
            }}
            onLoadEnd={() => {
              engineWebViewRef.current?.injectJavaScript('if (window.callEngineAnswer) { window.callEngineAnswer(); } true;');
            }}
            onMessage={(e: any) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'call_state' && msg.state === 'destroy') {
                  handleHangup();
                }
              } catch (err) {}
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  fullScreenCall: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topBarText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  callerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    opacity: 0.28,
  },
  callStateLabel: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  remoteNumberText: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 2,
  },
  myNumberSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  callTimerText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  incomingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  actionCol: {
    alignItems: 'center',
    gap: 8,
  },
  circleActionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  ctrlItem: {
    alignItems: 'center',
    gap: 8,
  },
  ctrlCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  hangupArea: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  hangupBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  inCallKeypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 260,
    gap: 12,
    marginVertical: 12,
  },
  inCallKey: {
    width: 64,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCallKeyDigit: {
    fontSize: 20,
    fontWeight: '600',
  },
  // ── Dialpad Modal Styles ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dialpadSheet: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
    maxHeight: '85%',
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  topControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  segmentedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 20,
  },
  segmentBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberDisplayRow: {
    minHeight: 58,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  numberText: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  backspaceBtn: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    rowGap: 14,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  circularKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDigit: {
    fontSize: 28,
    fontWeight: '400',
  },
  keySub: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.8,
    marginTop: 1,
  },
  callActionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  callBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  // ── Recents Tab Styles ───────────────────────────────────────────────────
  recentsContainer: {
    minHeight: 340,
    maxHeight: 460,
  },
  recentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  recentsTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  clearAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  recentsList: {
    flex: 1,
  },
  logItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  logIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDetailsCol: {
    flex: 1,
    gap: 2,
  },
  logRemoteNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  logMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  logActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLogBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentsView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
});
