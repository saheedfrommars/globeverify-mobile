import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
const CallWebView = WebView as any;
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Trash2,
  Clock,
  ArrowUpRight,
  X,
} from 'lucide-react-native';
import { useCall } from '../../context/CallContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { CallLogItem } from '../../services/callLogService';
import { requestMicrophonePermission } from '../../utils/permissionUtils';

export const CallModal: React.FC = () => {
  const {
    callState,
    currentCall,
    isDialpadOpen,
    dialpadFromNumber,
    dialpadRentalId,
    dialpadInitialTab,
    callLogs,
    closeDialpad,
    hangupCall,
    clearAllCallLogs,
    deleteCallLog,
  } = useCall();

  const { colors } = useAppSettings();
  const isDark = colors.isDark;

  const [dialpadTab, setDialpadTab] = useState<'keypad' | 'recents'>('keypad');
  const [engineUrl, setEngineUrl] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    if (isDialpadOpen) {
      setDialpadTab(dialpadInitialTab || 'keypad');
    }
  }, [isDialpadOpen, dialpadInitialTab]);

  const activeRentalId = currentCall?.rentalId || dialpadRentalId;
  const activeFromNumber = currentCall?.phoneNumber || dialpadFromNumber || '';
  const targetDestination = currentCall?.direction === 'outbound' ? currentCall.remoteNumber : '';

  useEffect(() => {
    if (callState === 'idle' && !isDialpadOpen) {
      setEngineUrl(null);
      return;
    }

    if (dialpadTab === 'recents' && callState === 'idle') {
      return;
    }

    if (!activeRentalId) return;

    requestMicrophonePermission().catch(() => {});

    setIsLoadingToken(true);
    apiClient
      .get(`/numbers/rentals/${activeRentalId}/voice-token`)
      .then((res) => {
        const token = res.data?.token || '';
        if (token) {
          let url = `https://www.globeverify.com/call?token=${encodeURIComponent(token)}&from=${encodeURIComponent(activeFromNumber)}&rentalId=${activeRentalId}&mode=mobile`;
          if (targetDestination) {
            url += `&to=${encodeURIComponent(targetDestination)}`;
          }
          setEngineUrl(url);
        }
      })
      .catch((e: any) => console.warn('[CallModal] Token error:', e?.message))
      .finally(() => setIsLoadingToken(false));
  }, [activeRentalId, activeFromNumber, targetDestination, callState, isDialpadOpen, dialpadTab]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEngineUrl(null);
    closeDialpad();
    if (callState !== 'idle') {
      hangupCall();
    }
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

  const formatLogDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
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

  const isModalVisible = callState !== 'idle' || isDialpadOpen;
  if (!isModalVisible) return null;

  // 1. Recents Tab (Native Bottom Sheet)
  if (isDialpadOpen && callState === 'idle' && dialpadTab === 'recents') {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={closeDialpad}>
        <View style={[s.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)' }]}>
          <SafeAreaView edges={['bottom']} style={[s.dialpadSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.handleBar, { backgroundColor: colors.border }]} />

            <View style={s.topControlsRow}>
              <View style={[s.segmentedPill, { backgroundColor: colors.surfaceSecondary }]}>
                <TouchableOpacity
                  style={s.segmentBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setDialpadTab('keypad');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.segmentText, { color: colors.textMuted }]}>Keypad</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.segmentBtn, s.segmentBtnActive, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.segmentText, { color: colors.text }]}>Recents</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={closeDialpad} style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceSecondary }]}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={s.recentsContainer}>
              <View style={s.recentsHeaderRow}>
                <Text style={[s.recentsTitle, { color: colors.text }]}>Call History</Text>
                {callLogs.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClearAllLogs}
                    style={[s.clearAllBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}
                  >
                    <Trash2 size={13} color="#EF4444" />
                    <Text style={s.clearAllBtnText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {callLogs.length === 0 ? (
                <View style={s.emptyRecentsView}>
                  <View style={[s.emptyIconCircle, { backgroundColor: colors.surfaceSecondary }]}>
                    <Clock size={28} color={colors.textMuted} />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>No Recent Calls</Text>
                  <Text style={[s.emptySubtitle, { color: colors.textMuted }]}>
                    Incoming and outgoing voice calls for this line will appear here.
                  </Text>
                </View>
              ) : (
                <ScrollView style={s.recentsList} showsVerticalScrollIndicator={false}>
                  {callLogs.map((log) => {
                    const isMissed = log.status === 'missed';
                    const isOutbound = log.direction === 'outbound';
                    return (
                      <View key={log.id} style={[s.logItemRow, { borderBottomColor: colors.border }]}>
                        <View
                          style={[
                            s.logIconCircle,
                            {
                              backgroundColor: isMissed
                                ? isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'
                                : isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
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

                        <TouchableOpacity
                          style={s.logDetailsCol}
                          onPress={() => {
                            setDialpadTab('keypad');
                            if (activeRentalId) {
                              setEngineUrl(
                                `https://www.globeverify.com/call?from=${encodeURIComponent(activeFromNumber)}&rentalId=${activeRentalId}&to=${encodeURIComponent(log.remoteNumber)}&mode=mobile`
                              );
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.logRemoteNumber, { color: isMissed ? '#EF4444' : colors.text }]} numberOfLines={1}>
                            {log.remoteNumber}
                          </Text>
                          <Text style={[s.logMetaText, { color: colors.textMuted }]}>
                            {formatLogDate(log.timestamp)} • {formatLogDuration(log)}
                          </Text>
                        </TouchableOpacity>

                        <View style={s.logActionsRow}>
                          <TouchableOpacity
                            onPress={() => {
                              setDialpadTab('keypad');
                              if (activeRentalId) {
                                setEngineUrl(
                                  `https://www.globeverify.com/call?from=${encodeURIComponent(activeFromNumber)}&rentalId=${activeRentalId}&to=${encodeURIComponent(log.remoteNumber)}&mode=mobile`
                                );
                              }
                            }}
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
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  // 2. Full-Screen WebRTC Voice Call Screen
  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={s.fullScreenContainer} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {isLoadingToken || !engineUrl ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={s.loadingText}>Connecting to GlobeVerify Voice...</Text>
          </View>
        ) : (
          <CallWebView
            ref={webViewRef}
            source={{ uri: engineUrl }}
            style={s.webView}
            containerStyle={s.webViewContainer}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            mediaCapturePermissionGrantType="grant"
            androidLayerType="hardware"
            originWhitelist={['*']}
            onPermissionRequest={(event: any) => {
              try {
                event.request?.grant?.(event.request?.getResources?.() || event.resources || []);
              } catch (e) {
                console.warn('[CallModal] onPermissionRequest error:', e);
              }
            }}
            onMessage={(e: any) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'close') {
                  handleClose();
                } else if (msg.type === 'call_state' && msg.state === 'destroy') {
                  handleClose();
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dialpadSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.6,
  },
  topControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  segmentedPill: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 17,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
