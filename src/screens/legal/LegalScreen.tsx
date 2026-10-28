import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Scale,
  Shield,
  Globe,
  UserCheck,
  CreditCard,
  RefreshCw,
  Ban,
  AlertTriangle,
  Link2,
  Mail,
  Phone,
  Database,
  Lock,
  Cookie,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Share2,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { useAppSettings } from '../../context/WalletSettingsContext';
import { ModernHeader } from '../../components/navigation/ModernHeader';
import { ModernBottomNav, NavTabId } from '../../components/navigation/ModernBottomNav';

export interface LegalScreenProps {
  initialTab?: 'terms' | 'privacy';
  onBack?: () => void;
  isModal?: boolean;
  onNavigateToHome?: () => void;
  onNavigateToBuy?: () => void;
  onNavigateToNumbers?: () => void;
  onNavigateToRentals?: () => void;
  onNavigateToWallet?: () => void;
}

interface SectionItem {
  id: string;
  num: string;
  title: string;
  icon: any;
  summary: string;
  bullets?: string[];
  content?: string[];
  highlights?: string[];
}

const TERMS_SECTIONS: SectionItem[] = [
  {
    id: 'acceptance',
    num: '1',
    title: 'Acceptance of Terms',
    icon: Scale,
    summary:
      'By creating an account, purchasing a virtual number, or using GlobeVerify, you confirm you are at least 18 years of age and agree to be legally bound by these Terms of Service.',
    content: [
      'If you are using GlobeVerify on behalf of an organisation, you confirm that you possess full legal authority to bind that organisation to these Terms.',
      'If you do not agree with any part of these terms, you must discontinue using our mobile application and web services immediately.',
    ],
  },
  {
    id: 'description',
    num: '2',
    title: 'Description of Services',
    icon: Globe,
    summary:
      'GlobeVerify delivers cutting-edge telecommunications and identity verification infrastructure globally.',
    bullets: [
      'Temporary Virtual Numbers: High-speed, one-time-use numbers for SMS verification across 150+ countries restricted to specific platforms.',
      'Long-Term Rental Numbers: Dedicated private numbers retained for days or months. Unlike temporary numbers, rental numbers can receive any kind of OTP from any service without restriction.',
      'Voice Calling: Real-time inbound and outbound crystal-clear voice calls powered by WebRTC, billed transparently per minute from your prepaid wallet balance.',
      'Global eSIM Data: Roaming-free cellular data packages through modern digital eSIM profiles across top global destinations.',
      'Developer API: Programmatic REST API access for automated number ordering, instant webhook SMS delivery, and balance management.',
      'Whitelabel Platform: Enterprise infrastructure allowing partners to white-label and resell verification services under their own brand.',
    ],
    content: [
      'All services are provided on an "as is" and "as available" basis. While we strive for maximum reliability, we do not warrant continuous, uninterrupted, or completely error-free operations.',
    ],
  },
  {
    id: 'obligations',
    num: '3',
    title: 'User Obligations & Acceptable Use',
    icon: UserCheck,
    summary:
      'You agree to use GlobeVerify strictly for lawful, legitimate purposes in full compliance with telecommunications standards.',
    bullets: [
      'Strictly prohibited: Using numbers for fraudulent activities, phishing, impersonation, harassment, or cybercrime.',
      'Prohibited: Attempting to reverse-engineer, exploit, scrape, or overwhelm our APIs, servers, or rate limit barriers.',
      'Prohibited: Reselling or redistributing numbers or platform data without an official Whitelabel Enterprise agreement.',
      'Prohibited: Operating multiple clone accounts or using botnets to bypass promotional limitations or country blocks.',
      'Prohibited: Supplying fabricated or fraudulent identity details upon account registration.',
      'Prohibited: Using the platform within jurisdictions where virtual telecom services are explicitly banned.',
    ],
    highlights: [
      'Violation consequence: Any account caught violating these rules will be permanently terminated without prior notice and without wallet refund.',
    ],
  },
  {
    id: 'payments',
    num: '4',
    title: 'Payments, Wallet & Refunds',
    icon: CreditCard,
    summary:
      'GlobeVerify operates on a transparent, prepaid digital wallet system.',
    bullets: [
      'Wallet Top-Ups: Accounts must maintain a sufficient balance in USD or NGN prior to service activation.',
      'Non-Refundable Deposits: Top-ups to your prepaid wallet balance are final and non-refundable, except where mandatory consumer protection laws dictate.',
      'Dynamic Pricing: Prices reflect real-time telecom market exchange rates and upstream carrier routing costs, subject to periodic adjustments.',
      'Instant Deductions: Number acquisitions and rental duration extensions are immediately debited from your active wallet.',
      'Voice Call Billing: Call charges accrue per minute based on the rate table. Calls auto-terminate if your wallet balance falls below the ongoing call minute rate.',
      'Service Guarantee & Discretionary Credit: If an activation fails or no SMS verification code is received within the active window due to a verified carrier failure, credits are automatically returned to your wallet.',
      'Chargeback Zero-Tolerance: Initiating payment disputes or chargebacks without prior support ticket resolution triggers instant, permanent suspension of account and API credentials.',
    ],
  },
  {
    id: 'availability',
    num: '5',
    title: 'Service Availability & Modifications',
    icon: RefreshCw,
    summary:
      'We target 99.9% platform availability, with ongoing proactive carrier route health monitoring.',
    bullets: [
      'We reserve the right to modify, adjust, or discontinue specific service routes or countries at any time.',
      'Carrier route degradation or foreign telco outages may temporarily impact specific destination country numbers.',
      'Continued platform usage following any published updates to these Terms implies full acceptance of revised terms.',
    ],
  },
  {
    id: 'prohibited',
    num: '6',
    title: 'Prohibited Jurisdictions & Platforms',
    icon: Ban,
    summary:
      'Numbers must not be used on services that specifically forbid virtual numbers or violate third-party policies.',
    bullets: [
      'Sending unsolicited bulk SMS or unauthorized automated spam.',
      'Unauthorized account takeovers, password resets on non-consenting parties, or credential stuffing.',
      'Automated account farming for immediate mass-resale.',
      'Any actions infringing national telecommunications acts or cybersecurity legislation.',
    ],
  },
  {
    id: 'liability',
    num: '7',
    title: 'Limitation of Liability',
    icon: AlertTriangle,
    summary:
      'To the fullest extent sanctioned by applicable law, GlobeVerify and its officers shall not be held liable for indirect or consequential damages.',
    content: [
      'This includes without limitation any lost profits, lost operational business revenue, data loss, or goodwill resulting from service disruptions or provider outages.',
      'In any situation, GlobeVerify’s aggregate cumulative liability for all claims shall not exceed the total fees paid by you to GlobeVerify in the preceding 30 days.',
    ],
  },
  {
    id: 'third-party',
    num: '8',
    title: 'Third-Party Telecom Providers',
    icon: Link2,
    summary:
      'GlobeVerify aggregates wholesale carriers and Tier-1 telecommunication providers worldwide.',
    content: [
      'We do not own foreign cellular base towers or upstream routing switches. While our automated route optimizer selects the highest-quality carriers, upstream outages remain beyond our direct mechanical control.',
    ],
  },
  {
    id: 'governing',
    num: '9',
    title: 'Governing Law & Disputes',
    icon: Scale,
    summary:
      'These Terms of Service are governed by relevant commercial and telecommunications laws.',
    content: [
      'Both parties commit to attempting good-faith informal resolution through GlobeVerify Live Support or executive escalation before pursuing legal or arbitral proceedings.',
    ],
  },
  {
    id: 'contact',
    num: '10',
    title: 'Legal Contact & Inquiries',
    icon: Mail,
    summary:
      'For formal legal inquiries, partnership notices, or compliance questions, reach our team directly.',
    content: [
      'Official Email: support@globeverify.com',
      'Direct Support Phone: +234 911 359 5476',
      'Registered Headquarters: GlobeVerify Telecom Systems.',
    ],
  },
];

const PRIVACY_SECTIONS: SectionItem[] = [
  {
    id: 'collect',
    num: '1',
    title: 'Information We Collect',
    icon: Database,
    summary:
      'We practice strict data minimization: we collect only what is strictly necessary to deliver verification and maintain security.',
    bullets: [
      'Account Data: Email address for authentication, display username, and one-way cryptographically salted bcrypt hashed password (we never store plain text passwords).',
      'Transaction Records: Wallet funding records, payment transaction references, service activation timestamps, and order history.',
      'Payment Security: Raw debit/credit card numbers and bank security credentials are encrypted directly by certified payment gateways (e.g. Flutterwave, Paystack, Monnify, Crypto gateways). GlobeVerify never stores your raw card CVV or PIN.',
      'Technical Diagnostics: IP address, device model, operating system version, and API log telemetry used exclusively for threat detection, DDOS prevention, and session verification.',
    ],
  },
  {
    id: 'use',
    num: '2',
    title: 'How We Use Your Information',
    icon: Eye,
    summary:
      'Your information is used strictly to operate the platform and deliver rapid OTP verifications.',
    bullets: [
      'Instant service delivery: Authenticating logins, routing SMS codes, and provisioning eSIM cellular profiles.',
      'Account security & fraud shield: Detecting suspicious multiple logins, automated credential attacks, and unauthorized top-up attempts.',
      'Critical updates: Sending instant push alerts when SMS arrives, receipts, and important security advisories.',
      'We NEVER sell, trade, or rent your personal information to third-party ad networks or brokers.',
    ],
  },
  {
    id: 'sharing',
    num: '3',
    title: 'Data Sharing & Third Parties',
    icon: Globe,
    summary:
      'Information is shared solely with verified infrastructure partners under strict Data Processing Agreements (DPA).',
    bullets: [
      'Upstream Telecom Carriers: Only country ISO codes and target service names are passed to purchase virtual numbers. No personal account details or email addresses are ever shared.',
      'Payment Processors: Regulated banking and card processing gateways receive necessary transaction details to settle deposits.',
      'Cloud & CDN Infrastructure: Tier-4 encrypted database and hosting providers bound by ISO/IEC 27001 data safety standards.',
      'Legal Authorities: We disclose records only if compelled by a formal subpoena or valid court warrant issued by lawful judicial authority.',
    ],
  },
  {
    id: 'security',
    num: '4',
    title: 'Data Security Measures',
    icon: Lock,
    summary:
      'Bank-grade encryption safeguards your account and confidential order history.',
    bullets: [
      'End-to-End Transport Security: All network communication is enforced using TLS 1.2/1.3 encryption protocols.',
      'Zero-Knowledge Passwords: Hashes generated with high-cost factor bcrypt salts.',
      'Session Security: Ephemeral JWT tokens with automatic expiration and biometric re-authentication support.',
      'Database Isolation: Zero public database endpoints; internal firewalling with least-privilege role boundaries.',
    ],
  },
  {
    id: 'cookies',
    num: '5',
    title: 'Storage & Tracking Policies',
    icon: Cookie,
    summary:
      'We use local device storage purely for necessary functionality and your tailored settings.',
    bullets: [
      'Secure Token Storage: Encrypted local storage holds session tokens so you remain securely signed in.',
      'Personal Preferences: Stores your dark/light theme, layout choices, and haptic feedback toggles.',
      'No Invasive Ad Trackers: GlobeVerify contains NO Facebook Pixel, TikTok pixel, or third-party behavioral advertising spyware.',
    ],
  },
  {
    id: 'rights',
    num: '6',
    title: 'Your Privacy Rights',
    icon: UserCheck,
    summary:
      'You maintain full sovereignty over your personal data under global GDPR and NDPR frameworks.',
    bullets: [
      'Right to Access: Request a copy of all personal records and account history stored on our systems.',
      'Right to Rectification: Instantly modify your name, password, or security settings in the app.',
      'Right to Erasure (Right to be Forgotten): Request complete deletion of your account and credentials within 30 days.',
      'Right to Data Portability: Export your transaction and order history in structured JSON or CSV format.',
    ],
  },
  {
    id: 'retention',
    num: '7',
    title: 'Data Retention Policies',
    icon: Trash2,
    summary:
      'Data is retained only as long as necessary to fulfill operational, accounting, and legal requirements.',
    bullets: [
      'Active accounts: Maintained until deletion is requested.',
      'Financial records: Retained for up to 7 years in compliance with standard statutory financial accounting obligations.',
      'API & Server Logs: Automatically rotated and purged after 90 days.',
      'Temporary SMS messages: Auto-purged after order expiration for privacy protection.',
    ],
  },
  {
    id: 'children',
    num: '8',
    title: "Children's Privacy Protection",
    icon: Shield,
    summary:
      'GlobeVerify strictly prohibits registration by individuals under 18 years of age. We never knowingly collect information from minors.',
  },
  {
    id: 'contact',
    num: '9',
    title: 'Data Protection Officer Contact',
    icon: Mail,
    summary:
      'To submit a data access request, delete your profile, or reach our compliance officer:',
    content: [
      'Compliance Email: support@globeverify.com',
      'Response Time: Within 24-48 business hours.',
    ],
  },
];

export const LegalScreen: React.FC<LegalScreenProps> = ({
  initialTab = 'terms',
  onBack,
  isModal = false,
  onNavigateToHome,
  onNavigateToBuy,
  onNavigateToNumbers,
  onNavigateToRentals,
  onNavigateToWallet,
}) => {
  const { colors, triggerHaptic, setActiveScreen } = useAppSettings();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    acceptance: true,
    description: true,
    collect: true,
    use: true,
  });

  const toggleSection = (id: string) => {
    triggerHaptic('selection');
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShare = async () => {
    try {
      triggerHaptic('light');
      const url =
        activeTab === 'terms'
          ? 'https://globeverify.com/terms'
          : 'https://globeverify.com/privacy';
      await Share.share({
        title: activeTab === 'terms' ? 'GlobeVerify Terms of Service' : 'GlobeVerify Privacy Policy',
        message: `Read the official GlobeVerify ${activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}: ${url}`,
        url,
      });
    } catch {}
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@globeverify.com?subject=Legal%20Inquiry%20-%20GlobeVerify');
  };

  const handleCall = () => {
    Linking.openURL('tel:+2349113595476');
  };

  const sections = activeTab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style="auto" />

      {/* Top Header */}
      {!isModal ? (
        <ModernHeader />
      ) : (
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </Text>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Share2 size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Card */}
        <View
          style={[
            styles.heroBanner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: colors.primarySoft, borderColor: colors.primary + '30' },
              ]}
            >
              <Sparkles size={12} color={colors.primary} />
              <Text style={[styles.badgePillText, { color: colors.primary }]}>
                Official Legal Documentation
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleShare}
              style={[styles.sharePill, { backgroundColor: colors.bg, borderColor: colors.border }]}
            >
              <Share2 size={13} color={colors.textMuted} />
              <Text style={[styles.sharePillText, { color: colors.textMuted }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.heroHeading, { color: colors.text }]}>
            {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy & Trust'}
          </Text>

          <Text style={[styles.heroSub, { color: colors.textMuted }]}>
            {activeTab === 'terms'
              ? 'Please read these Terms of Service carefully before utilizing GlobeVerify virtual numbers, SMS routing, and global eSIM connectivity.'
              : 'Your privacy and trust are paramount. Learn how we safeguard your identity, encrypt transactions, and enforce zero data reselling.'}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaDate, { color: colors.textMuted }]}>
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={[styles.dot, { backgroundColor: colors.border }]} />
            <Text style={[styles.metaVersion, { color: colors.primary }]}>Version 2.4</Text>
          </View>

          {/* Segmented Control Tabs */}
          <View
            style={[
              styles.tabBar,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'terms' && [
                  styles.tabBtnActive,
                  { backgroundColor: colors.surface },
                ],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab('terms');
              }}
              activeOpacity={0.8}
            >
              <Scale
                size={16}
                color={activeTab === 'terms' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: activeTab === 'terms' ? colors.primary : colors.textMuted,
                    fontWeight: activeTab === 'terms' ? '700' : '500',
                  },
                ]}
              >
                Terms of Service
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'privacy' && [
                  styles.tabBtnActive,
                  { backgroundColor: colors.surface },
                ],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab('privacy');
              }}
              activeOpacity={0.8}
            >
              <Shield
                size={16}
                color={activeTab === 'privacy' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: activeTab === 'privacy' ? colors.primary : colors.textMuted,
                    fontWeight: activeTab === 'privacy' ? '700' : '500',
                  },
                ]}
              >
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Trust Strip (when Privacy is selected) */}
        {activeTab === 'privacy' && (
          <View style={styles.trustGrid}>
            {[
              { icon: Lock, label: 'Zero Data Selling', desc: 'Never sold or monetized' },
              { icon: Shield, label: 'TLS 1.3 Encryption', desc: 'Bank-grade channel security' },
              { icon: Eye, label: 'Full Transparency', desc: 'Explicit consent & logs' },
              { icon: Trash2, label: 'Right to Deletion', desc: 'Purged within 30 days' },
            ].map((t, idx) => {
              const IconComp = t.icon;
              return (
                <View
                  key={idx}
                  style={[
                    styles.trustCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.trustIconCircle,
                      { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <IconComp size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.trustLabel, { color: colors.text }]}>{t.label}</Text>
                  <Text style={[styles.trustDesc, { color: colors.textMuted }]}>{t.desc}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Section Cards */}
        <View style={styles.sectionsList}>
          {sections.map((sec) => {
            const isExpanded = !!expandedSections[sec.id];
            const IconComp = sec.icon;

            return (
              <View
                key={sec.id}
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isExpanded ? colors.primary + '50' : colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(sec.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.sectionIconWrap,
                      {
                        backgroundColor: isExpanded
                          ? colors.primarySoft
                          : colors.bg,
                      },
                    ]}
                  >
                    <IconComp
                      size={18}
                      color={isExpanded ? colors.primary : colors.textMuted}
                    />
                  </View>

                  <View style={styles.sectionHeaderText}>
                    <Text style={[styles.sectionNum, { color: colors.primary }]}>
                      SECTION {sec.num}
                    </Text>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {sec.title}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.chevronWrap,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  >
                    {isExpanded ? (
                      <ChevronUp size={16} color={colors.primary} />
                    ) : (
                      <ChevronDown size={16} color={colors.textMuted} />
                    )}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.sectionBody, { borderTopColor: colors.border }]}>
                    <Text style={[styles.summaryText, { color: colors.text }]}>
                      {sec.summary}
                    </Text>

                    {sec.bullets && sec.bullets.length > 0 && (
                      <View style={styles.bulletsWrap}>
                        {sec.bullets.map((b, i) => (
                          <View key={i} style={styles.bulletRow}>
                            <View
                              style={[
                                styles.bulletDot,
                                { backgroundColor: colors.primary },
                              ]}
                            />
                            <Text
                              style={[
                                styles.bulletText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {b}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {sec.content && sec.content.length > 0 && (
                      <View style={styles.paragraphsWrap}>
                        {sec.content.map((p, i) => (
                          <Text
                            key={i}
                            style={[
                              styles.paragraphText,
                              { color: colors.textMuted },
                            ]}
                          >
                            {p}
                          </Text>
                        ))}
                      </View>
                    )}

                    {sec.highlights && sec.highlights.length > 0 && (
                      <View
                        style={[
                          styles.highlightBox,
                          {
                            backgroundColor: colors.dangerSoft || '#FEE2E2',
                            borderColor: colors.danger || '#EF4444',
                          },
                        ]}
                      >
                        <AlertTriangle
                          size={15}
                          color={colors.danger || '#DC2626'}
                        />
                        <Text
                          style={[
                            styles.highlightText,
                            { color: colors.danger || '#DC2626' },
                          ]}
                        >
                          {sec.highlights.join(' ')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Contact Support Card */}
        <View
          style={[
            styles.contactCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.contactHeader}>
            <View
              style={[
                styles.contactIconWrap,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <Mail size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactTitle, { color: colors.text }]}>
                Questions or Legal Inquiries?
              </Text>
              <Text style={[styles.contactSub, { color: colors.textMuted }]}>
                Our compliance and support team is available 24/7 to answer legal or privacy inquiries.
              </Text>
            </View>
          </View>

          <View style={styles.contactActions}>
            <TouchableOpacity
              style={[
                styles.contactBtn,
                { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={handleEmail}
              activeOpacity={0.8}
            >
              <Mail size={16} color="#FFFFFF" />
              <Text style={styles.contactBtnText}>support@globeverify.com</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.contactBtnOutline,
                { borderColor: colors.border, backgroundColor: colors.bg },
              ]}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Phone size={16} color={colors.primary} />
              <Text style={[styles.contactBtnOutlineText, { color: colors.text }]}>
                +234 911 359 5476
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modern Bottom Nav (when rendered inside authenticated shell) */}
      {!isModal && (
        <ModernBottomNav
          activeTab={'more' as NavTabId}
          onSelectTab={(tab: NavTabId) => {
            if (tab === 'home' && onNavigateToHome) onNavigateToHome();
            else if (tab === 'buy' && onNavigateToBuy) onNavigateToBuy();
            else if (tab === 'sms' && onNavigateToNumbers) onNavigateToNumbers();
            else if (tab === 'rentals' && onNavigateToRentals) onNavigateToRentals();
            else if (tab === 'wallet' && onNavigateToWallet) onNavigateToWallet();
            else if (tab === 'more') {
              if (onBack) onBack();
              else setActiveScreen('more');
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  sharePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaDate: {
    fontSize: 11,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  metaVersion: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 8,
  },
  tabBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  trustCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  trustIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trustLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  trustDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  sectionsList: {
    gap: 12,
    marginBottom: 16,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionNum: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 12,
  },
  bulletsWrap: {
    gap: 8,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  paragraphsWrap: {
    gap: 8,
    marginTop: 6,
  },
  paragraphText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  highlightText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  contactCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  contactIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  contactSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  contactActions: {
    gap: 10,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  contactBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  contactBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  contactBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
