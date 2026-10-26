import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Pressable,
    Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
    Key,
    Plus,
    Trash2,
    Copy,
    Check,
    Shield,
    Zap,
    Terminal,
    AlertTriangle,
    Code2,
    Globe,
    RefreshCw,
    ExternalLink,
    X,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';
import apiClient, { getCachedData, getMemoryCache, setCachedData } from '../../api/client';

interface ApiKeyItem {
    id?: string;
    _id?: string;
    name: string;
    keyPreview: string;
    lastUsed?: string;
    lastUsedAt?: string;
    createdAt: string;
}

interface UsageData {
    tier?: string;
    limit?: number;
    usageCount?: number;
    totalRequests?: number;
    remaining?: number | 'Unlimited';
}

interface ApiPlan {
    id: string;
    name: string;
    description?: string;
    price?: number;
    minSpendUSD?: number;
    minSpendNGN?: number;
    monthlyLimit?: number;
    rateLimitPerMinute?: number;
    discountPercent?: number;
    features?: string[];
}

interface DeveloperScreenProps {
    onBack?: () => void;
    onNavigateToHome?: () => void;
    onNavigateToBuy?: () => void;
    onNavigateToNumbers?: () => void;
    onNavigateToRentals?: () => void;
    onNavigateToWallet?: () => void;
}

export const DeveloperScreen: React.FC<DeveloperScreenProps> = ({
    onBack,
    onNavigateToHome,
    onNavigateToBuy,
    onNavigateToNumbers,
    onNavigateToRentals,
    onNavigateToWallet,
}) => {
    const { user, refreshUser } = useAuth();
    const { colors, showToast, showDialog, triggerHaptic } = useAppSettings();

    const cachedDev = getMemoryCache<any>('developer_bundle_cache');
    const [keys, setKeys] = useState<ApiKeyItem[]>(cachedDev?.keys || []);
    const [usage, setUsage] = useState<UsageData | null>(cachedDev?.usage || null);
    const [plans, setPlans] = useState<ApiPlan[]>(cachedDev?.plans || []);
    const [webhookUrl, setWebhookUrl] = useState<string>(cachedDev?.webhookUrl || '');
    const [webhookSecretPreview, setWebhookSecretPreview] = useState<string | null>(
        cachedDev?.webhookSecretPreview || null
    );
    const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

    const [loading, setLoading] = useState(!cachedDev);
    const [refreshing, setRefreshing] = useState(false);

    // Key generation & reveal modal
    const [generating, setGenerating] = useState(false);
    const [newKeyModal, setNewKeyModal] = useState<{ name: string; key: string } | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    // Access request state
    const [useCaseText, setUseCaseText] = useState((user as any)?.developerUseCase || '');
    const [requestingAccess, setRequestingAccess] = useState(false);

    // Webhook saving state
    const [savingWebhook, setSavingWebhook] = useState(false);

    const fetchAllData = useCallback(async (isRefresh = false) => {
        if (!isRefresh && !cachedDev) {
            const disk = await getCachedData<any>('developer_bundle_cache');
            if (disk) {
                setKeys(disk.keys || []);
                setUsage(disk.usage || null);
                setPlans(disk.plans || []);
                setWebhookUrl(disk.webhookUrl || '');
                setWebhookSecretPreview(disk.webhookSecretPreview || null);
                setLoading(false);
            }
        }

        try {
            const [keysRes, usageRes, settingsRes, plansRes] = await Promise.all([
                apiClient.get('/keys').catch(() => ({ data: { data: [] } })),
                apiClient.get('/keys/usage').catch(() => ({ data: { data: null } })),
                apiClient.get('/keys/settings').catch(() => ({ data: { data: null } })),
                apiClient.get('/keys/plans').catch(() => ({ data: { data: [] } })),
            ]);

            const nextKeys = keysRes.data?.data || [];
            const nextUsage = usageRes.data?.data || null;
            const nextPlans = plansRes.data?.data || [];
            const nextWebhookUrl = settingsRes.data?.data?.webhookUrl || '';
            const nextSecretPreview = settingsRes.data?.data?.webhookSecretPreview || null;

            setKeys(nextKeys);
            setUsage(nextUsage);
            setPlans(nextPlans);
            setWebhookUrl(nextWebhookUrl);
            setWebhookSecretPreview(nextSecretPreview);

            setCachedData('developer_bundle_cache', {
                keys: nextKeys,
                usage: nextUsage,
                plans: nextPlans,
                webhookUrl: nextWebhookUrl,
                webhookSecretPreview: nextSecretPreview,
            });
        } catch {
            // Keep cached values
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleRequestAccess = async () => {
        if (!useCaseText || useCaseText.trim().length < 10) {
            showToast('Please describe your use case in at least 10 characters.', 'error');
            return;
        }
        setRequestingAccess(true);
        try {
            const res = await apiClient.post('/keys/request-access', { useCase: useCaseText.trim() });
            showToast(res.data?.message || 'Use case submitted for review.', 'success');
            await refreshUser();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to submit use case.', 'error');
        } finally {
            setRequestingAccess(false);
        }
    };

    const handleGenerateKey = async () => {
        setGenerating(true);
        try {
            const keyName = `Key ${keys.length + 1} (${new Date().toLocaleDateString()})`;
            const res = await apiClient.post('/keys/generate', { name: keyName });
            const generated = res.data?.data;
            if (generated?.key) {
                setNewKeyModal({ name: generated.name || keyName, key: generated.key });
                showToast('Copy your secret key now — it is shown only once.', 'success');
            }
            fetchAllData(true);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to generate API key.', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleRevokeKey = (id: string, name: string) => {
        showDialog({
            variant: 'danger',
            title: 'Revoke API Key?',
            message: `Are you sure you want to permanently revoke "${name}"? Any applications using this key will immediately lose access.`,
            confirmText: 'Revoke Key',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await apiClient.delete(`/keys/${id}`);
                    setKeys((prev) => prev.filter((k) => (k.id || k._id) !== id));
                    showToast('API key has been permanently revoked.', 'success');
                } catch (err: any) {
                    showToast(err.response?.data?.message || 'Failed to revoke key.', 'error');
                }
            },
        });
    };

    const handleSaveWebhook = async (regenerateSecret = false) => {
        setSavingWebhook(true);
        setNewWebhookSecret(null);
        try {
            const res = await apiClient.post('/keys/settings/webhook', {
                webhookUrl: webhookUrl.trim(),
                regenerateSecret,
            });
            const data = res.data?.data;
            if (data?.webhookSecret) {
                setNewWebhookSecret(data.webhookSecret);
            }
            setWebhookSecretPreview(data?.webhookSecretPreview || null);
            showToast(
                regenerateSecret ? 'New webhook signing secret generated.' : 'Webhook configuration updated.',
                'success'
            );
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to update webhook settings.', 'error');
        } finally {
            setSavingWebhook(false);
        }
    };

    const copyText = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        triggerHaptic('success');
        setCopiedKey(true);
        showToast(`${label} copied to clipboard.`, 'success');
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleSelectNavTab = (tab: NavTabId) => {
        if (tab === 'home') onNavigateToHome?.();
        else if (tab === 'buy') onNavigateToBuy?.();
        else if (tab === 'sms') onNavigateToNumbers?.();
        else if (tab === 'rentals') onNavigateToRentals?.();
        else if (tab === 'wallet') onNavigateToWallet?.();
    };

    const devStatus = (user as any)?.developerStatus;
    const currentTier = ((user as any)?.apiTier || usage?.tier || 'free').toLowerCase();
    const totalRequests = Number(usage?.totalRequests ?? usage?.usageCount ?? 0);
    const limitNum = typeof usage?.limit === 'number' ? usage.limit : 100;
    const usagePercentage =
        limitNum > 0 ? Math.min(100, (totalRequests / limitNum) * 100) : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
            <StatusBar style={colors.statusBar} />
            <ModernHeader
                title="API & Webhooks"
                onBack={onBack}
                onRefresh={() => {
                    setRefreshing(true);
                    fetchAllData(true);
                }}
            />

            {loading ? (
                <View style={styles.centerWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchAllData(true);
                            }}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.titleLine}>
                                <Code2 size={20} color={colors.primary} />
                                <Text style={[styles.pageTitle, { color: colors.text }]}>API & Webhooks</Text>
                            </View>
                            <Text style={[styles.pageSub, { color: colors.textSecondary }]}>
                                Automate SMS verifications and webhook events via REST API.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.docsBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                            onPress={() => Linking.openURL('https://www.globeverify.com/docs')}
                        >
                            <Terminal size={14} color={colors.primary} />
                            <Text style={[styles.docsBtnText, { color: colors.text }]}>API Docs</Text>
                            <ExternalLink size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Production Access Banner */}
                    {devStatus !== 'approved' && (
                        <View
                            style={[
                                styles.bannerCard,
                                {
                                    backgroundColor:
                                        devStatus === 'pending'
                                            ? 'rgba(59,130,246,0.08)'
                                            : devStatus === 'rejected'
                                              ? 'rgba(239,68,68,0.08)'
                                              : 'rgba(245,158,11,0.08)',
                                    borderColor:
                                        devStatus === 'pending'
                                            ? 'rgba(59,130,246,0.28)'
                                            : devStatus === 'rejected'
                                              ? 'rgba(239,68,68,0.28)'
                                              : 'rgba(245,158,11,0.28)',
                                },
                            ]}
                        >
                            <View style={styles.bannerHeader}>
                                <Shield
                                    size={18}
                                    color={
                                        devStatus === 'pending'
                                            ? '#3B82F6'
                                            : devStatus === 'rejected'
                                              ? '#EF4444'
                                              : '#F59E0B'
                                    }
                                />
                                <Text style={[styles.bannerTitle, { color: colors.text }]}>
                                    {devStatus === 'pending'
                                        ? 'Production API Access Under Review'
                                        : devStatus === 'rejected'
                                          ? 'API Access Application Declined'
                                          : 'Sandbox Mode (Read-Only)'}
                                </Text>
                            </View>
                            <Text style={[styles.bannerDesc, { color: colors.textSecondary }]}>
                                {devStatus === 'pending'
                                    ? 'Your use case is being reviewed by our engineering team. You can still test read-only endpoints (/countries, /services).'
                                    : 'Your API keys can currently access read-only endpoints. To purchase numbers programmatically, submit your use case below.'}
                            </Text>

                            {devStatus !== 'pending' && (
                                <View style={styles.useCaseRow}>
                                    <TextInput
                                        value={useCaseText}
                                        onChangeText={setUseCaseText}
                                        placeholder="Describe how you plan to use the GlobeVerify API..."
                                        placeholderTextColor={colors.textMuted}
                                        style={[
                                            styles.input,
                                            {
                                                color: colors.text,
                                                borderColor: colors.border,
                                                backgroundColor: colors.bg,
                                                flex: 1,
                                            },
                                        ]}
                                    />
                                    <TouchableOpacity
                                        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                                        onPress={handleRequestAccess}
                                        disabled={requestingAccess}
                                    >
                                        {requestingAccess ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={styles.primaryBtnText}>Request Access</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Usage Card */}
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.cardTitleGroup}>
                                <Zap size={16} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Current Plan & Usage</Text>
                            </View>
                            <View style={[styles.tierPill, { backgroundColor: colors.primarySoft }]}>
                                <Text style={[styles.tierPillText, { color: colors.primary }]}>
                                    {currentTier.toUpperCase()} PLAN
                                </Text>
                            </View>
                        </View>

                        <View style={styles.usageStatsRow}>
                            <Text style={[styles.usageCountText, { color: colors.text }]}>
                                {totalRequests.toLocaleString()}
                                <Text style={[styles.usageLimitText, { color: colors.textSecondary }]}>
                                    {' '}
                                    total requests
                                </Text>
                            </Text>
                            <Text style={[styles.usageRemainText, { color: '#10B981' }]}>
                                99.9% Success Rate
                            </Text>
                        </View>

                        {limitNum !== -1 && (
                            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${usagePercentage}%`,
                                            backgroundColor: usagePercentage > 90 ? '#EF4444' : colors.primary,
                                        },
                                    ]}
                                />
                            </View>
                        )}
                    </View>

                    {/* Active API Keys */}
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.cardTitleGroup}>
                                <Key size={16} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    Secret API Keys ({keys.length}/5)
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.generateBtn,
                                    {
                                        backgroundColor: keys.length >= 5 ? colors.border : colors.primary,
                                    },
                                ]}
                                onPress={handleGenerateKey}
                                disabled={generating || keys.length >= 5}
                            >
                                {generating ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Plus size={14} color="#FFF" />
                                        <Text style={styles.generateBtnText}>Generate Key</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {keys.length === 0 ? (
                            <View style={styles.emptyKeysWrap}>
                                <Key size={28} color={colors.textSecondary} style={{ opacity: 0.4 }} />
                                <Text style={[styles.emptyKeysTitle, { color: colors.text }]}>No Active API Keys</Text>
                                <Text style={[styles.emptyKeysSub, { color: colors.textSecondary }]}>
                                    Generate your first secret key to authenticate API requests with the x-api-key header.
                                </Text>
                            </View>
                        ) : (
                            keys.map((item, idx) => {
                                const keyId = item.id || item._id || String(idx);
                                const usedDate = item.lastUsedAt || item.lastUsed;
                                return (
                                    <View
                                        key={keyId}
                                        style={[
                                            styles.keyRow,
                                            idx < keys.length - 1 && {
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                                borderBottomColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.keyName, { color: colors.text }]}>{item.name}</Text>
                                            <View style={styles.keyMetaRow}>
                                                <Text
                                                    style={[
                                                        styles.keyPreviewBadge,
                                                        { color: colors.primary, backgroundColor: colors.primarySoft },
                                                    ]}
                                                >
                                                    {item.keyPreview}
                                                </Text>
                                                <Text style={[styles.keyDate, { color: colors.textSecondary }]}>
                                                    {usedDate
                                                        ? `Used ${new Date(usedDate).toLocaleDateString()}`
                                                        : item.createdAt
                                                          ? `Created ${new Date(item.createdAt).toLocaleDateString()}`
                                                          : ''}
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.revokeBtn}
                                            onPress={() => handleRevokeKey(keyId, item.name)}
                                        >
                                            <Trash2 size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* Webhook Settings */}
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.cardTitleGroup}>
                            <Globe size={16} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Webhook Configuration</Text>
                        </View>
                        <Text style={[styles.webhookSub, { color: colors.textSecondary }]}>
                            Receive real-time POST callbacks when an SMS OTP arrives for your API orders.
                        </Text>

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Endpoint URL (HTTPS)</Text>
                        <TextInput
                            value={webhookUrl}
                            onChangeText={setWebhookUrl}
                            placeholder="https://your-server.com/webhooks/globeverify"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            keyboardType="url"
                            style={[
                                styles.input,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.bg,
                                },
                            ]}
                        />

                        <View style={styles.webhookSecretBox}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>
                                    Signing Secret (HMAC-SHA256)
                                </Text>
                                <Text style={[styles.secretPreviewText, { color: colors.text }]}>
                                    {newWebhookSecret || webhookSecretPreview || 'No secret generated yet'}
                                </Text>
                            </View>
                            {newWebhookSecret ? (
                                <TouchableOpacity
                                    style={[styles.smallBtn, { borderColor: colors.primary }]}
                                    onPress={() => copyText(newWebhookSecret, 'Webhook Secret')}
                                >
                                    <Copy size={13} color={colors.primary} />
                                    <Text style={[styles.smallBtnText, { color: colors.primary }]}>Copy</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.smallBtn, { borderColor: colors.border }]}
                                    onPress={() => handleSaveWebhook(true)}
                                    disabled={savingWebhook}
                                >
                                    <RefreshCw size={13} color={colors.textSecondary} />
                                    <Text style={[styles.smallBtnText, { color: colors.text }]}>Roll Secret</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                            onPress={() => handleSaveWebhook(false)}
                            disabled={savingWebhook}
                        >
                            {savingWebhook ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.primaryBtnText}>Save Webhook Settings</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* API Tiers Overview */}
                    {plans.length > 0 && (
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 4 }]}>
                                API Tiers & Access Levels
                            </Text>
                            <Text style={[styles.webhookSub, { color: colors.textSecondary, marginBottom: 10 }]}>
                                Your API tier upgrades automatically based on your 30-day transaction volume.
                            </Text>
                            {plans.map((plan, idx) => {
                                const isCurrent = currentTier === String(plan.id || '').toLowerCase();
                                const isNgn = user?.currency?.toUpperCase() === 'NGN';
                                const minUsd = Number(plan.minSpendUSD ?? plan.price ?? 0);
                                const minNgn = Number(plan.minSpendNGN ?? 0);
                                const priceLabel =
                                    minUsd === 0 && minNgn === 0
                                        ? 'Default / Free'
                                        : isNgn && minNgn > 0
                                          ? `₦${minNgn.toLocaleString()} vol`
                                          : `$${minUsd.toLocaleString()} vol`;

                                const metaText =
                                    plan.description ||
                                    (Array.isArray(plan.features) && plan.features.length > 0
                                        ? plan.features.slice(0, 2).join(' · ')
                                        : 'Standard API access');

                                return (
                                    <View
                                        key={plan.id || String(idx)}
                                        style={[
                                            styles.planRow,
                                            idx < plans.length - 1 && {
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                                borderBottomColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={[styles.planName, { color: colors.text }]}>
                                                    {plan.name}
                                                </Text>
                                                {isCurrent && (
                                                    <View style={[styles.currentBadge, { backgroundColor: '#10B98120' }]}>
                                                        <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '700' }}>
                                                            CURRENT TIER
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[styles.planMeta, { color: colors.textSecondary }]}>
                                                {metaText}
                                            </Text>
                                        </View>
                                        <Text style={[styles.planPrice, { color: colors.primary }]}>
                                            {priceLabel}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}

            <ModernBottomNav activeTab="more" onSelectTab={handleSelectNavTab} />

            {/* One-Time Secret Key Reveal Modal */}
            {newKeyModal && (
                <Modal visible={true} transparent animationType="fade" onRequestClose={() => setNewKeyModal(null)}>
                    <View style={styles.modalBackdrop}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setNewKeyModal(null)} />
                        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.modalHeader}>
                                <View style={styles.cardTitleGroup}>
                                    <Key size={18} color="#10B981" />
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                                        Save Your Secret API Key
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setNewKeyModal(null)}>
                                    <X size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.warningBox}>
                                <AlertTriangle size={16} color="#F59E0B" />
                                <Text style={styles.warningBoxText}>
                                    For security, this secret key will only be displayed once. Store it safely in your environment variables.
                                </Text>
                            </View>

                            <Text style={[styles.label, { color: colors.textSecondary }]}>{newKeyModal.name}</Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => copyText(newKeyModal.key, 'API Secret Key')}
                                style={[styles.secretKeyDisplay, { backgroundColor: colors.bg, borderColor: colors.primary }]}
                            >
                                <Text style={[styles.secretKeyMono, { color: colors.text }]} selectable>
                                    {newKeyModal.key}
                                </Text>
                                {copiedKey ? (
                                    <Check size={18} color="#10B981" />
                                ) : (
                                    <Copy size={18} color={colors.primary} />
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                                onPress={() => {
                                    copyText(newKeyModal.key, 'API Secret Key');
                                    setNewKeyModal(null);
                                }}
                            >
                                <Text style={styles.primaryBtnText}>Copy Key & Close</Text>
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
    centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 16, paddingBottom: 110, gap: 14 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageTitle: { fontSize: 20, fontWeight: '800' },
    pageSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
    docsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    docsBtnText: { fontSize: 12, fontWeight: '700' },
    bannerCard: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 8,
    },
    bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bannerTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
    bannerDesc: { fontSize: 12, lineHeight: 18 },
    useCaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    card: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    tierPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    tierPillText: { fontSize: 11, fontWeight: '800' },
    usageStatsRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    usageCountText: { fontSize: 20, fontWeight: '800' },
    usageLimitText: { fontSize: 13, fontWeight: '500' },
    usageRemainText: { fontSize: 12, fontWeight: '600' },
    progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
    },
    generateBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    emptyKeysWrap: { alignItems: 'center', paddingVertical: 20, gap: 6 },
    emptyKeysTitle: { fontSize: 14, fontWeight: '700' },
    emptyKeysSub: { fontSize: 12, textAlign: 'center', lineHeight: 17, paddingHorizontal: 12 },
    keyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        gap: 10,
    },
    keyName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    keyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    keyPreviewBadge: {
        fontSize: 11,
        fontWeight: '700',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 5,
        fontFamily: 'monospace',
    },
    keyDate: { fontSize: 11 },
    revokeBtn: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: 'rgba(239,68,68,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    webhookSub: { fontSize: 12, marginTop: 4, marginBottom: 12, lineHeight: 17 },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 6 },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
    },
    webhookSecretBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        gap: 10,
    },
    secretPreviewText: { fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
    smallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
    },
    smallBtnText: { fontSize: 12, fontWeight: '600' },
    primaryBtn: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
    planRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        gap: 10,
    },
    planName: { fontSize: 14, fontWeight: '700' },
    currentBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    planMeta: { fontSize: 11, marginTop: 2 },
    planPrice: { fontSize: 14, fontWeight: '800' },
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
        marginBottom: 12,
    },
    modalTitle: { fontSize: 16, fontWeight: '800' },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(245,158,11,0.12)',
        marginBottom: 10,
    },
    warningBoxText: { flex: 1, fontSize: 12, color: '#F59E0B', lineHeight: 16, fontWeight: '600' },
    secretKeyDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 10,
    },
    secretKeyMono: { flex: 1, fontSize: 12, fontFamily: 'monospace', fontWeight: '700' },
});
