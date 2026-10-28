import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import * as Haptics from 'expo-haptics';
import apiClient from '../api/client';
import { socketService } from '../services/socketService';
import { onIncomingCallReceived } from '../services/pushNotificationService';
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
  isMuted: boolean;
  isSpeaker: boolean;
  answerCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  hangupCall: () => Promise<void>;
  startOutboundCall: (
    rentalId: string,
    fromNumber: string,
    toNumber: string
  ) => Promise<boolean>;
  openDialpad: (rentalId?: string, defaultFrom?: string) => void;
  closeDialpad: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
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
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);

  const durationTimerRef = useRef<any>(null);
  const ringVibrationTimerRef = useRef<any>(null);

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
    },
    [startRingVibration]
  );

  // Subscribe to real-time telephony events
  useEffect(() => {
    const unsubSocketIncoming = socketService.subscribe('incoming_call', (data) => {
      handleIncomingCallEvent(data);
    });

    const unsubSocketAnswered = socketService.subscribe('call_answered', (data) => {
      stopRingVibration();
      setCallState('connected');
      startDurationTimer();
    });

    const unsubSocketEnded = socketService.subscribe('call_ended', () => {
      stopRingVibration();
      stopDurationTimer();
      setCallState('ended');
      setTimeout(() => {
        setCallState('idle');
        setCurrentCall(null);
        setCallDuration(0);
      }, 1800);
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
    startDurationTimer,
    stopDurationTimer,
    stopRingVibration,
  ]);

  // Answer an incoming call
  const answerCall = async () => {
    if (!currentCall?.rentalId || !currentCall?.callControlId) return;
    stopRingVibration();
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
    if (!currentCall?.rentalId || !currentCall?.callControlId) {
      stopRingVibration();
      setCallState('idle');
      setCurrentCall(null);
      return;
    }
    stopRingVibration();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    try {
      await apiClient.post(`/numbers/rentals/${currentCall.rentalId}/call-action`, {
        action: 'reject',
        callControlId: currentCall.callControlId,
      });
    } catch (err) {
      console.warn('[CallContext] Failed to reject call:', err);
    } finally {
      setCallState('idle');
      setCurrentCall(null);
    }
  };

  // Terminate an active or outbound call
  const hangupCall = async () => {
    stopRingVibration();
    stopDurationTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

    if (currentCall?.rentalId && currentCall?.callControlId) {
      try {
        await apiClient.post(`/numbers/rentals/${currentCall.rentalId}/call-action`, {
          action: 'hangup',
          callControlId: currentCall.callControlId,
        });
      } catch (err) {
        console.warn('[CallContext] Failed to hang up call:', err);
      }
    }

    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCurrentCall(null);
      setCallDuration(0);
    }, 1500);
  };

  // Make an outbound call from the mobile app
  const startOutboundCall = async (
    rentalId: string,
    fromNumber: string,
    toNumber: string
  ): Promise<boolean> => {
    try {
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
        setCallState('idle');
        setCurrentCall(null);
        return false;
      }
    } catch (err: any) {
      console.warn('[CallContext] Outbound call error:', err);
      setCallState('idle');
      setCurrentCall(null);
      return false;
    }
  };

  const openDialpad = (rentalId?: string, defaultFrom?: string) => {
    setDialpadRentalId(rentalId || null);
    setDialpadFromNumber(defaultFrom || null);
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

  return (
    <CallContext.Provider
      value={{
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
        openDialpad,
        closeDialpad,
        toggleMute,
        toggleSpeaker,
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
