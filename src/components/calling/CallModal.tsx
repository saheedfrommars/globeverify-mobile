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
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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

  // Dialpad state
  const [dialedNumber, setDialedNumber] = useState('');

  // Pulsing animation for incoming call & active call rings
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callState === 'ringing_inbound' || callState === 'calling_outbound') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
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

  const handleStartCall = () => {
    if (!dialedNumber.trim() || !dialpadRentalId) return;
    let num = dialedNumber.trim();
    if (!num.startsWith('+')) {
      num = '+' + num;
    }
    startOutboundCall(
      dialpadRentalId,
      dialpadFromNumber || 'Leased Number',
      num
    );
    setDialedNumber('');
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
        <View style={s.modalOverlay}>
          <SafeAreaView style={[s.modalCard, { backgroundColor: isDark ? '#121212' : '#FFFFFF' }]}>
            {/* Header */}
            <View style={s.headerRow}>
              <View>
                <Text style={[s.headerTitle, { color: colors.text }]}>Make a Call</Text>
                <Text style={s.callerIdLabel}>
                  Calling from:{' '}
                  <Text style={{ fontWeight: '700', color: colors.primary }}>
                    {dialpadFromNumber || 'Leased Number'}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity onPress={closeDialpad} style={s.closeBtn}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Dialed Number Display */}
            <View style={s.numberDisplayArea}>
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
                <TouchableOpacity onPress={handleBackspace} style={s.backspaceBtn}>
                  <Delete size={22} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* 3x4 Dialpad Grid */}
            <View style={s.dialpadGrid}>
              {DIALPAD_KEYS.map((k) => (
                <TouchableOpacity
                  key={k.digit}
                  style={[s.dialKey, { backgroundColor: isDark ? '#1E1E1E' : '#F1F5F9' }]}
                  onPress={() => handleKeyPress(k.digit)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dialDigit, { color: colors.text }]}>{k.digit}</Text>
                  {k.sub ? <Text style={s.dialSub}>{k.sub}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>

            {/* Call Action Button */}
            <View style={s.dialActionArea}>
              <TouchableOpacity
                style={[
                  s.callBtn,
                  { opacity: dialedNumber.trim().length >= 3 ? 1 : 0.4 },
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
      <Modal visible animationType="fade" transparent>
        <SafeAreaView style={s.fullScreenCall}>
          {/* Top Secure Tag */}
          <View style={s.secureBadge}>
            <ShieldCheck size={14} color="#10B981" />
            <Text style={s.secureBadgeText}>Encrypted VoIP Line</Text>
          </View>

          {/* Caller Avatar / Pulsing Wave */}
          <View style={s.callerArea}>
            <Animated.View
              style={[
                s.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  borderColor: '#10B981',
                },
              ]}
            />
            <View style={[s.avatarCircle, { backgroundColor: '#10B981' }]}>
              <PhoneIncoming size={44} color="#FFFFFF" />
            </View>

            <Text style={s.callStateLabel}>Incoming Call...</Text>
            <Text style={s.remoteNumberText} numberOfLines={1}>
              {currentCall?.remoteNumber || 'Unknown Caller'}
            </Text>
            <Text style={s.myNumberSubtitle}>
              Leased Line: {currentCall?.phoneNumber || 'Private Rental'}
            </Text>
          </View>

          {/* Action Buttons: Decline (Red) & Answer (Green) */}
          <View style={s.incomingActionRow}>
            <View style={s.actionCol}>
              <TouchableOpacity
                onPress={rejectCall}
                style={[s.circleBtn, { backgroundColor: '#EF4444' }]}
                activeOpacity={0.8}
              >
                <PhoneOff size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={s.actionBtnLabel}>Decline</Text>
            </View>

            <View style={s.actionCol}>
              <TouchableOpacity
                onPress={answerCall}
                style={[s.circleBtn, { backgroundColor: '#10B981' }]}
                activeOpacity={0.8}
              >
                <Phone size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={s.actionBtnLabel}>Answer</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── 3. ACTIVE / OUTBOUND CALL SCREEN ──────────────────────────────────────
  return (
    <Modal visible animationType="fade" transparent>
      <SafeAreaView style={s.fullScreenCall}>
        {/* Top Header */}
        <View style={s.secureBadge}>
          <ShieldCheck size={14} color="#2563EB" />
          <Text style={s.secureBadgeText}>
            {callState === 'calling_outbound' ? 'Calling...' : 'Call in Progress'}
          </Text>
        </View>

        {/* Contact info and duration */}
        <View style={s.callerArea}>
          <View style={[s.avatarCircle, { backgroundColor: '#2563EB' }]}>
            <Phone size={38} color="#FFFFFF" />
          </View>

          <Text style={s.remoteNumberText} numberOfLines={1}>
            {currentCall?.remoteNumber || 'Unknown'}
          </Text>

          <Text style={s.callTimerText}>
            {callState === 'calling_outbound'
              ? 'Ringing...'
              : callState === 'ended'
              ? 'Call Ended'
              : formatSeconds(callDuration)}
          </Text>

          <Text style={s.myNumberSubtitle}>
            Via: {currentCall?.phoneNumber || 'GlobeVerify Private Line'}
          </Text>
        </View>

        {/* Mid Call Controls: Mute, Speaker */}
        <View style={s.controlsRow}>
          <TouchableOpacity
            style={[s.ctrlCircle, isMuted && s.ctrlCircleActive]}
            onPress={toggleMute}
          >
            {isMuted ? <MicOff size={24} color="#EF4444" /> : <Mic size={24} color="#FFFFFF" />}
            <Text style={s.ctrlLabel}>{isMuted ? 'Muted' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlCircle, isSpeaker && s.ctrlCircleActive]}
            onPress={toggleSpeaker}
          >
            {isSpeaker ? (
              <Volume2 size={24} color="#10B981" />
            ) : (
              <VolumeX size={24} color="#FFFFFF" />
            )}
            <Text style={s.ctrlLabel}>{isSpeaker ? 'Speaker On' : 'Speaker'}</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Hangup Button */}
        <View style={s.hangupArea}>
          <TouchableOpacity
            onPress={hangupCall}
            style={[s.circleBtn, { backgroundColor: '#EF4444' }]}
            activeOpacity={0.8}
          >
            <PhoneOff size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.actionBtnLabel}>End Call</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  fullScreenCall: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
  },
  secureBadgeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  callerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    opacity: 0.35,
  },
  callStateLabel: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  remoteNumberText: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  myNumberSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  callTimerText: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  incomingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 32,
  },
  actionCol: {
    alignItems: 'center',
    gap: 10,
  },
  circleBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
  },
  ctrlCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ctrlCircleActive: {
    backgroundColor: '#334155',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  ctrlLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  hangupArea: {
    alignItems: 'center',
    gap: 10,
  },
  // ── Dialpad Modal Styles ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  callerIdLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  numberDisplayArea: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  numberText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  backspaceBtn: {
    position: 'absolute',
    right: 8,
    padding: 8,
  },
  dialpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  dialKey: {
    width: '30%',
    aspectRatio: 1.25,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialDigit: {
    fontSize: 24,
    fontWeight: '700',
  },
  dialSub: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  dialActionArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
