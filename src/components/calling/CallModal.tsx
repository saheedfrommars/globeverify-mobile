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
  User,
  Grid3x3,
  Shield,
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

  // In-call keypad toggle state (for DTMF tones)
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);

  useEffect(() => {
    if (callState === 'idle') {
      setEngineUrl(null);
      setShowInCallKeypad(false);
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

  const isModalVisible = callState !== 'idle' || isDialpadOpen;

  if (!isModalVisible) return null;

  // ── 1. DIALPAD BOTTOM SHEET ───────────────────────────────────────────────
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

            {/* Header: Title + Subtitle & Close */}
            <View style={s.sheetHeader}>
              <View>
                <Text style={[s.sheetTitle, { color: colors.text }]}>Keypad</Text>
                <Text style={[s.sheetSubtitle, { color: colors.textMuted }]}>
                  Calling as {dialpadFromNumber || 'Leased Number'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeDialpad}
                style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceSecondary }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

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
                onPress={handleStartCall}
                activeOpacity={0.8}
              >
                <Phone size={28} color="#FFFFFF" />
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

        {/* Headless WebRTC Audio Engine - COMPLETELY OFFSCREEN & ZERO DIMENSIONS */}
        {engineUrl && (
          <HeadlessWebView
            ref={engineWebViewRef}
            source={{ uri: engineUrl }}
            containerStyle={{
              position: 'absolute',
              top: -9999,
              left: -9999,
              width: 0,
              height: 0,
              opacity: 0,
              flex: 0,
            }}
            style={{
              width: 0,
              height: 0,
              opacity: 0,
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
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberDisplayRow: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 12,
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
    marginBottom: 20,
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
    paddingTop: 4,
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
});
