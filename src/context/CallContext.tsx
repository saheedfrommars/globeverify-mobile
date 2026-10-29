import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import apiClient from '../api/client';
import { socketService } from '../services/socketService';
import { onIncomingCallReceived } from '../services/pushNotificationService';
import { requestMicrophonePermission } from '../utils/permissionUtils';
import { callLogService, CallLogItem } from '../services/callLogService';
import { useAuth } from './AuthContext';

export type CallState =
  | 'idle'
  | 'ringing_inbound'
  | 'calling_outbound'
  | 'connected'
  | 'ended';

export interface ActiveCallData {
  callControlId: string;
  callLegId?: string;
  callSessionId?: string;
  rentalId: string;
  phoneNumber: string; // My leased number
  remoteNumber: string; // The caller or callee
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'connected' | 'ended';
  startedAt?: number;
}

interface CallContextType {
  callState: CallState;
  currentCall: ActiveCallData | null;
  callDuration: number;
  isDialpadOpen: boolean;
  dialpadFromNumber: string | null;
  dialpadRentalId: string | null;
  dialpadInitialTab: 'keypad' | 'recents';
  isMuted: boolean;
  isSpeaker: boolean;
  callLogs: CallLogItem[];
  answerCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  hangupCall: () => Promise<void>;
  startOutboundCall: (
    rentalId: string,
    fromNumber: string,
    toNumber: string
  ) => Promise<boolean>;
  openDialpad: (rentalId?: string, defaultFrom?: string, initialTab?: 'keypad' | 'recents') => void;
  closeDialpad: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  clearAllCallLogs: () => Promise<void>;
  deleteCallLog: (id: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<ActiveCallData | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isDialpadOpen, setIsDialpadOpen] = useState<boolean>(false);
  const [dialpadFromNumber, setDialpadFromNumber] = useState<string | null>(null);
  const [dialpadRentalId, setDialpadRentalId] = useState<string | null>(null);
  const [dialpadInitialTab, setDialpadInitialTab] = useState<'keypad' | 'recents'>('keypad');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);

  const durationTimerRef = useRef<any>(null);
  const ringVibrationTimerRef = useRef<any>(null);

  const currentCallRef = useRef<ActiveCallData | null>(null);
  const callDurationRef = useRef<number>(0);
  const callStateRef = useRef<CallState>('idle');
  const loggedCallControls = useRef<Set<string>>(new Set());

  currentCallRef.current = currentCall;
  callDurationRef.current = callDuration;
  callStateRef.current = callState;

  // Load call logs from AsyncStorage and listen to updates
  useEffect(() => {
    callLogService.getLogs().then(setCallLogs);
    const unsubLogs = callLogService.subscribe(setCallLogs);
    return () => {
      unsubLogs();
    };
  }, []);

  const recordCallLog = useCallback(
    (statusOverride?: 'completed' | 'missed' | 'rejected' | 'failed') => {
      const c = currentCallRef.current;
      if (!c) return;

      const dedupeKey = `${c.callControlId || ''}_${c.phoneNumber}_${c.remoteNumber}_${c.direction}_${Math.floor(Date.now() / 15000)}`;
      if (loggedCallControls.current.has(dedupeKey)) return;
      loggedCallControls.current.add(dedupeKey);

      const duration = callDurationRef.current;
      const state = callStateRef.current;

      let status: 'completed' | 'missed' | 'rejected' | 'failed' = 'completed';
      if (statusOverride) {
        status = statusOverride;
      } else if (state === 'ringing_inbound') {
        status = 'missed';
      } else if (state === 'calling_outbound' && duration === 0) {
        status = 'failed';
      } else if (duration > 0 || state === 'connected') {
        status = 'completed';
      }

      callLogService.saveLog({
        callControlId: c.callControlId,
        phoneNumber: c.phoneNumber,
        remoteNumber: c.remoteNumber,
        direction: c.direction,
        status,
        duration,
        rentalId: c.rentalId,
      });
    },
    []
  );

  // ── Clean up call duration timer ─────────────────────────────────────────
  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, [stopDurationTimer]);

  // ── Repeating haptic vibration while phone is ringing ────────────────────
  const stopRingVibration = useCallback(() => {
    if (ringVibrationTimerRef.current) {
      clearInterval(ringVibrationTimerRef.current);
      ringVibrationTimerRef.current = null;
    }
  }, []);

  const startRingVibration = useCallback(() => {
    stopRingVibration();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    ringVibrationTimerRef.current = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 1400);
  }, [stopRingVibration]);

  // Handle incoming call payload from Socket or Push Notification
  const handleIncomingCallEvent = useCallback(
    (data: any) => {
      if (!data || !data.callControlId) return;

      const newCall: ActiveCallData = {
        callControlId: data.callControlId,
        callLegId: data.callLegId,
        callSessionId: data.callSessionId,
        rentalId: data.rentalId || '',
        phoneNumber: data.phoneNumber || data.to || '',
        remoteNumber: data.caller || data.from || 'Unknown Caller',
        direction: 'inbound',
        status: 'ringing',
      };

      setCurrentCall(newCall);
      setCallState('ringing_inbound');
      startRingVibration();

      // If user tapped "🟢 Answer Call" directly on the background push notification
      if (data.autoAnswer && newCall.rentalId && newCall.callControlId) {
        setTimeout(async () => {
          try {
            await apiClient.post(`/numbers/rentals/${newCall.rentalId}/call-action`, {
              action: 'answer',
              callControlId: newCall.callControlId,
            });
            stopRingVibration();
            setCallState('connected');
            startDurationTimer();
          } catch (e) {
            console.warn('[CallContext] Auto-answer error:', e);
          }
        }, 400);
      }
    },
    [startDurationTimer, startRingVibration, stopRingVibration]
  );

  // Subscribe to real-time telephony events
  useEffect(() => {
    const unsubSocketIncoming = socketService.subscribe('incoming_call', (data) => {
      handleIncomingCallEvent(data);
    });

    const unsubSocketAnswered = socketService.subscribe('call_answered', (data) => {
      stopRingVibration();
      setCallState((prev) => {
        if (prev === 'ended' || prev === 'idle') return prev;
        startDurationTimer();
        return 'connected';
      });
    });

    const unsubSocketEnded = socketService.subscribe('call_ended', () => {
      setCallState((prev) => {
        // Prevent duplicate trigger if already idle or ended
        if (prev === 'idle' || prev === 'ended') return prev;
        stopRingVibration();
        stopDurationTimer();
        recordCallLog();
        setTimeout(() => {
          setCallState('idle');
          setCurrentCall(null);
          setCallDuration(0);
        }, 500);
        return 'ended';
      });
    });

    const unsubPush = onIncomingCallReceived((data) => {
      handleIncomingCallEvent(data);
    });

    return () => {
      unsubSocketIncoming();
      unsubSocketAnswered();
      unsubSocketEnded();
      unsubPush();
      stopRingVibration();
      stopDurationTimer();
    };
  }, [
    handleIncomingCallEvent,
    recordCallLog,
    startDurationTimer,
    stopDurationTimer,
    stopRingVibration,
  ]);

  // Answer an incoming call
  const answerCall = async () => {
    if (!currentCall?.rentalId || !currentCall?.callControlId) return;
    stopRingVibration();
    await requestMicrophonePermission().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      await apiClient.post(`/numbers/rentals/${currentCall.rentalId}/call-action`, {
        action: 'answer',
        callControlId: currentCall.callControlId,
      });
      setCallState('connected');
      startDurationTimer();
    } catch (err: any) {
      console.warn('[CallContext] Failed to answer call:', err);
      setCallState('idle');
      setCurrentCall(null);
    }
  };

  // Reject an incoming call
  const rejectCall = async () => {
    stopRingVibration();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    recordCallLog('rejected');
    const rId = currentCall?.rentalId;
    const cId = currentCall?.callControlId;

    setCallState('idle');
    setCurrentCall(null);

    if (rId && cId) {
      apiClient.post(`/numbers/rentals/${rId}/call-action`, {
        action: 'reject',
        callControlId: cId,
      }).catch((err) => {
        console.warn('[CallContext] Failed to reject call:', err?.message);
      });
    }
  };

  // Terminate an active or outbound call (Immediate UI response + background API)
  const hangupCall = async () => {
    if (callState === 'idle' || callState === 'ended') return;
    stopRingVibration();
    stopDurationTimer();
    recordCallLog();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

    const rId = currentCall?.rentalId;
    const cId = currentCall?.callControlId;

    // Immediately reflect ended state so user sees instant response
    setCallState('ended');

    // Fire API call asynchronously in background without blocking UI
    if (rId && cId) {
      apiClient.post(`/numbers/rentals/${rId}/call-action`, {
        action: 'hangup',
        callControlId: cId,
      }).catch((err) => {
        console.warn('[CallContext] Failed to hang up call:', err?.message);
      });
    }

    setTimeout(() => {
      setCallState('idle');
      setCurrentCall(null);
      setCallDuration(0);
    }, 500);
  };

  // Make an outbound call from the mobile app
  const startOutboundCall = async (
    rentalId: string,
    fromNumber: string,
    toNumber: string
  ): Promise<boolean> => {
    try {
      await requestMicrophonePermission().catch(() => {});
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsDialpadOpen(false);

      const newCall: ActiveCallData = {
        callControlId: '',
        rentalId,
        phoneNumber: fromNumber,
        remoteNumber: toNumber,
        direction: 'outbound',
        status: 'ringing',
      };
      setCurrentCall(newCall);
      setCallState('calling_outbound');

      const res = await apiClient.post(`/numbers/rentals/${rentalId}/call`, {
        to: toNumber,
      });

      if (res.data?.success && res.data?.callControlId) {
        setCurrentCall((prev) =>
          prev ? { ...prev, callControlId: res.data.callControlId } : null
        );
        return true;
      } else {
        recordCallLog('failed');
        setCallState('idle');
        setCurrentCall(null);
        return false;
      }
    } catch (err: any) {
      recordCallLog('failed');
      const errMsg = err?.response?.data?.message || err?.message || 'Outbound call failed';
      Alert.alert('Call Failed', errMsg);
      console.warn('[CallContext] Outbound call error:', errMsg);
      setCallState('idle');
      setCurrentCall(null);
      return false;
    }
  };

  const openDialpad = (
    rentalId?: string,
    defaultFrom?: string,
    initialTab: 'keypad' | 'recents' = 'keypad'
  ) => {
    setDialpadRentalId(rentalId || null);
    setDialpadFromNumber(defaultFrom || null);
    setDialpadInitialTab(initialTab);
    setIsDialpadOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const closeDialpad = () => {
    setIsDialpadOpen(false);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const toggleSpeaker = () => {
    setIsSpeaker((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const clearAllCallLogs = async () => {
    await callLogService.clearAllLogs();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const deleteCallLog = async (id: string) => {
    await callLogService.deleteLog(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  return (
    <CallContext.Provider
      value={{
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
        openDialpad,
        closeDialpad,
        toggleMute,
        toggleSpeaker,
        clearAllCallLogs,
        deleteCallLog,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
