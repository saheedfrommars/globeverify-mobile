import { WebView } from 'react-native-webview';
const HeadlessWebView = WebView as any;
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
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
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { useCall } from '../../context/CallContext';
import { useAppSettings } from '../../context/WalletSettingsContext';

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
    isMuted,
    isSpeaker,
    answerCall,
    rejectCall,
    hangupCall,
    startOutboundCall,
    closeDialpad,
    toggleMute,
    toggleSpeaker,
  } = useCall();

  const { colors } = useAppSettings();
  const isDark = colors.isDark;

  // Hidden WebRTC audio engine ref & URL
  const engineWebViewRef = useRef<any>(null);
  const [engineUrl, setEngineUrl] = useState<string | null>(null);

  useEffect(() => {
    if (callState === 'idle') {
      setEngineUrl(null);
    }
  }, [callState]);

  // Dialpad state
  const [dialedNumber, setDialedNumber] = useState('');

  // Subtle pulsing animation for incoming call ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callState === 'ringing_inbound' || callState === 'calling_outbound') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
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

  const handleKeyPress = (digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDialedNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleStartCall = async () => {
    if (!dialedNumber.trim() || !dialpadRentalId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    let num = dialedNumber.trim();
    if (!num.startsWith('+')) {
      num = '+' + num;
    }
    const rentalId = dialpadRentalId;
    const fromNum = dialpadFromNumber || 'Leased Number';

    startOutboundCall(rentalId, fromNum, num);

    // Spin up headless WebRTC audio engine in background WebView
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

  const isModalVisible = callState !== 'idle' || isDialpadOpen;

  if (!isModalVisible) return null;

  // ── 1. DIALPAD MODAL ──────────────────────────────────────────────────────
  if (isDialpadOpen && callState === 'idle') {
    return (
      <Modal
        visible={isDialpadOpen}
        animationType="slide"
        transparent
        onRequestClose={closeDialpad}
      >
        <View style={[s.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.45)' }]}>
          <SafeAreaView
            edges={['bottom']}
            style={[
              s.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Handle Bar */}
            <View style={[s.handleBar, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={s.dialpadHeader}>
              <View style={s.dialpadHeaderLeft}>
                <Text style={[s.dialpadTitle, { color: colors.text }]}>Make a Call</Text>
                <View style={[s.lineBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <ShieldCheck size={12} color={colors.primary} />
                  <Text style={[s.lineBadgeText, { color: colors.textSecondary }]}>
                    From: <Text style={{ fontWeight: '700', color: colors.primary }}>{dialpadFromNumber || 'Leased Number'}</Text>
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={closeDialpad}
                style={[s.closeBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Dialed Number Display Area */}
            <View style={[s.numberDisplayArea, { borderBottomColor: colors.border }]}>
              <Text
                style={[
                  s.numberText,
                  { color: dialedNumber ? colors.text : colors.textMuted },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {dialedNumber || 'Enter phone number'}
              </Text>
              {dialedNumber.length > 0 && (
                <TouchableOpacity
                  onPress={handleBackspace}
                  style={[s.backspaceBtn, { backgroundColor: colors.surfaceSecondary }]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Delete size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* 3x4 Dialpad Grid */}
            <View style={s.dialpadGrid}>
              {DIALPAD_KEYS.map((k) => (
                <TouchableOpacity
                  key={k.digit}
                  style={[
                    s.dialKey,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleKeyPress(k.digit)}
                  activeOpacity={0.65}
                >
                  <Text style={[s.dialDigit, { color: colors.text }]}>{k.digit}</Text>
                  {k.sub ? <Text style={[s.dialSub, { color: colors.textMuted }]}>{k.sub}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>

            {/* Call Action Button */}
            <View style={s.dialActionArea}>
              <TouchableOpacity
                style={[
                  s.callBtn,
                  {
                    opacity: dialedNumber.trim().length >= 3 ? 1 : 0.4,
                  },
                ]}
                disabled={dialedNumber.trim().length < 3}
                onPress={handleStartCall}
                activeOpacity={0.8}
              >
                <Phone size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
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

          {/* Top Encrypted Security Tag */}
          <View
            style={[
              s.secureBadge,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <ShieldCheck size={14} color="#10B981" />
            <Text style={[s.secureBadgeText, { color: colors.textSecondary }]}>
              Encrypted VoIP Line
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
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <PhoneIncoming size={38} color="#10B981" />
              </View>
            </View>

            <Text style={s.callStateLabel}>Incoming Call</Text>

            <Text
              style={[s.remoteNumberText, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currentCall?.remoteNumber || 'Unknown Caller'}
            </Text>

            <View
              style={[
                s.lineSubPill,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.myNumberSubtitle, { color: colors.textMuted }]}>
                Line:{' '}
                <Text style={{ fontWeight: '600', color: colors.textSecondary }}>
                  {currentCall?.phoneNumber || 'Private Rental'}
                </Text>
              </Text>
            </View>
          </View>

          {/* Action Buttons: Decline & Answer */}
          <View style={s.incomingActionRow}>
            <View style={s.actionCol}>
              <TouchableOpacity
                onPress={handleRejectCall}
                style={[s.circleBtn, { backgroundColor: '#EF4444' }]}
                activeOpacity={0.8}
              >
                <PhoneOff size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[s.actionBtnLabel, { color: colors.textMuted }]}>Decline</Text>
            </View>

            <View style={s.actionCol}>
              <TouchableOpacity
                onPress={handleAnswerCall}
                style={[s.circleBtn, { backgroundColor: '#10B981' }]}
                activeOpacity={0.8}
              >
                <Phone size={28} color="#FFFFFF" />
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

        {/* Top Header Pill */}
        <View
          style={[
            s.secureBadge,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              s.statusDot,
              {
                backgroundColor: isCallingOutbound ? colors.primary : '#10B981',
              },
            ]}
          />
          <Text style={[s.secureBadgeText, { color: colors.textSecondary }]}>
            {isCallingOutbound ? 'Calling...' : isEnded ? 'Call Finished' : 'Call in Progress'}
          </Text>
        </View>

        {/* Contact Info and Duration */}
        <View style={s.callerArea}>
          <View
            style={[
              s.avatarCircle,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <User size={38} color={colors.primary} />
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

          <View
            style={[
              s.lineSubPill,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[s.myNumberSubtitle, { color: colors.textMuted }]}>
              Via:{' '}
              <Text style={{ fontWeight: '600', color: colors.textSecondary }}>
                {currentCall?.phoneNumber || 'Private Line'}
              </Text>
            </Text>
          </View>
        </View>

        {/* Mid-Call Controls: Mute & Speaker */}
        <View style={s.controlsRow}>
          <View style={s.ctrlItem}>
            <TouchableOpacity
              style={[
                s.ctrlCircle,
                {
                  backgroundColor: isMuted
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.16)'
                      : '#FEF2F2'
                    : colors.surfaceSecondary,
                  borderColor: isMuted ? '#EF4444' : colors.border,
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

          <View style={s.ctrlItem}>
            <TouchableOpacity
              style={[
                s.ctrlCircle,
                {
                  backgroundColor: isSpeaker
                    ? isDark
                      ? 'rgba(37, 99, 235, 0.16)'
                      : '#EFF6FF'
                    : colors.surfaceSecondary,
                  borderColor: isSpeaker ? colors.primary : colors.border,
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
              {isSpeaker ? 'Speaker On' : 'Speaker'}
            </Text>
          </View>
        </View>

        {/* Bottom Hangup Area */}
        <View style={s.hangupArea}>
          <TouchableOpacity
            onPress={handleHangup}
            style={[s.circleBtn, { backgroundColor: '#EF4444' }]}
            activeOpacity={0.8}
          >
            <PhoneOff size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[s.actionBtnLabel, { color: colors.textMuted }]}>End Call</Text>
        </View>

        {/* Headless WebRTC Audio Engine (Full 2-way microphone & audio playback) */}
        {engineUrl && (
          <HeadlessWebView
            ref={engineWebViewRef}
            source={{ uri: engineUrl }}
            style={{ width: 1, height: 1, opacity: 0.01, position: 'absolute', bottom: 0, right: 0 }}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            originWhitelist={['*']}
            onPermissionRequest={(event: any) => {
              event.request.grant(event.request.getResources());
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
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  secureBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  callerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    opacity: 0.25,
  },
  callStateLabel: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  remoteNumberText: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  lineSubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
  },
  myNumberSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  callTimerText: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  incomingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 36,
  },
  actionCol: {
    alignItems: 'center',
    gap: 10,
  },
  circleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
  },
  ctrlItem: {
    alignItems: 'center',
    gap: 8,
  },
  ctrlCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  hangupArea: {
    alignItems: 'center',
    gap: 10,
  },
  // ── Dialpad Modal Styles ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  dialpadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dialpadHeaderLeft: {
    gap: 4,
  },
  dialpadTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  lineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  lineBadgeText: {
    fontSize: 11.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberDisplayArea: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  numberText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  backspaceBtn: {
    position: 'absolute',
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  dialKey: {
    width: '30%',
    aspectRatio: 1.25,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialDigit: {
    fontSize: 24,
    fontWeight: '600',
  },
  dialSub: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  dialActionArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
