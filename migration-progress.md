# GlobeVerify Mobile — Migration Progress & Screen Inventory

> **Status:** Phase 1 Initialization  
> **Source of Truth for Behavior & Data:** `../frontend-globeverify` (Vite + React)  
> **Target:** Native iOS & Android App via Expo (SDK 57)  
> **Design Philosophy:** Platform-native Human Interface Guidelines (Apple HIG & Material You / Jetpack Compose). Real native navigation, system typography, dynamic light/dark theming, zero web slop.

---

## 1. Information Architecture & Navigation

The 13-item web sidebar is completely redesigned into an ergonomic 5-tab native structure with native stacks and form/bottom sheets:

| Tab | Content & Hierarchy |
| :--- | :--- |
| **Home** | Live balance (NGN/USD switcher), live active numbers count, primary "Get a Number" action, quick actions, recent activity list |
| **Numbers** | Segmented Control (`Active` / `History`). Tapping an active number pushes the high-priority **Live OTP Screen** |
| **Buy** | Activation-first purchasing: Service picker bottom sheet → Country picker bottom sheet → Price & options sheet → Native confirm |
| **Wallet** | Balance breakdown (USD, NGN, Credits), quick top-up options, searchable transaction history with pull-to-refresh, spending breakdown |
| **More** | Grouped section list: Long-term Rentals, eSIM Data, Proxies, Referrals, Developer API keys, 2FA / Security Settings, AI Support Chat, About & Legal |

---

## 2. Screen Inventory & Endpoint Mapping

### Bucket A: Build Now (Core Native App)

| Screen | Web Route | Mobile Destination | Endpoints Used | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Onboarding** | `/` (Hero) | Stack: `/(onboarding)` | None (Local state / storage) | 🔨 In Progress |
| **Login** | `/auth/login` | Stack: `/(auth)/login` | `POST /auth/login`, `POST /auth/2fa/verify-login` | ⏳ Pending |
| **Register** | `/auth/register` | Stack: `/(auth)/register` | `POST /auth/register`, `POST /auth/verify-otp` | ⏳ Pending |
| **OTP Verification** | `/auth/otp` | Stack: `/(auth)/otp` | `POST /auth/verify-otp`, `POST /auth/resend-otp` | ⏳ Pending |
| **Forgot Password** | `/auth/forgot-password` | Stack: `/(auth)/forgot` | `POST /auth/forgot-password` | ⏳ Pending |
| **Reset Password** | `/auth/reset-password` | Stack: `/(auth)/reset` | `POST /auth/reset-password` | ⏳ Pending |
| **Dashboard Home** | `/dashboard` | Tab: `/(tabs)/(home)` | `GET /numbers/my-numbers?status=active`, `GET /wallet/spending-summary`, `GET /numbers/pending` | ⏳ Pending |
| **Active Numbers & History** | `/dashboard/numbers` | Tab: `/(tabs)/numbers` | `GET /numbers/my-numbers`, `GET /numbers/pending`, `GET /cheap/my-numbers` | ⏳ Pending |
| **Live OTP Screen (The Hero Screen)** | Card inside `/dashboard/numbers` | Stack: `/numbers/[id]` | `GET /numbers/:id/check-otp`, `POST /numbers/:id/cancel`, `POST /numbers/:id/reuse`, `Socket: otp_received` | ⏳ Pending |
| **Buy Number Flow** | `/dashboard/buy` | Tab: `/(tabs)/buy` (Sheets) | `GET /numbers/countries`, `GET /numbers/available?country=`, `GET /numbers/price`, `GET /numbers/pools`, `POST /numbers/purchase` | ⏳ Pending |
| **Wallet & Transactions** | `/dashboard/wallet` | Tab: `/(tabs)/wallet` | `GET /wallet/balance`, `GET /wallet/transactions`, `GET /wallet/spending-summary`, `GET /payments/methods` | ⏳ Pending |
| **Top-up Wallet** | Modal in `/dashboard/wallet` | Form Sheet: `/wallet/top-up` | `POST /payments/top-up`, `POST /payments/crypto/top-up`, `GET /payments/crypto/currencies` | ⏳ Pending |

---

### Bucket B: Build Later (Phase 2 Modules)

| Screen | Web Route | Mobile Destination | Endpoints Used | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Rentals List & Messages** | `/dashboard/rentals`, `/dashboard/rentals/:id/messages` | More → Rentals | `GET /numbers/rentals`, `GET /numbers/rentals/options`, `POST /numbers/rentals/buy`, `GET /messaging/:rentalId/messages`, `POST /messaging/:rentalId/send-sms` | 🗓️ Phase 2 |
| **eSIM Store & Profiles** | `/dashboard/esim` | More → eSIM | `GET /esim/catalog`, `POST /esim/purchase`, `GET /esim/my-esims` | 🗓️ Phase 2 |
| **Proxy Store & Active Orders** | `/dashboard/proxy`, `/dashboard/proxies` | More → Proxies | `GET /proxy/providers`, `GET /proxy/countries`, `GET /proxy/pricing`, `POST /proxy/purchase`, `GET /proxy/my-proxies`, `POST /proxy/:id/rotate` | 🗓️ Phase 2 |
| **Referrals & Rewards** | `/dashboard/referrals`, `/dashboard/quests` | More → Earn | `GET /auth/referrals`, `GET /quests`, `POST /quests/:id/claim` | 🗓️ Phase 2 |
| **Support AI Chat** | `/dashboard/support` | More → Support | `Socket /support`, `GET /support/session` | 🗓️ Phase 2 |
| **Developer API Keys** | `/dashboard/developer` | More → Developer | `GET /keys`, `POST /keys`, `DELETE /keys/:id` | 🗓️ Phase 2 |
| **Security & 2FA Settings** | `/dashboard/settings` | More → Settings | `GET /auth/profile`, `PUT /auth/profile`, `GET /auth/2fa/status`, `POST /auth/2fa/authenticator/setup` | 🗓️ Phase 2 |

---

### Bucket C: Link-Out to Web (Not Ported to Native App)

The following web-only administrative, builder, or legal pages will link out directly to `https://globeverify.com` in a native Safari/Chrome In-App Browser (`expo-web-browser`):
- **White-Label Reseller Portal & Store Builder** (`/dashboard/whitelabel`, `/dashboard/whitelabel/buy`, `/dashboard/whitelabel/mine`)
- **Affiliate Web Marketing Hub** (`/dashboard/affiliate`, `/dashboard/earnings`)
- **Public API Documentation** (`/docs`, `/api/docs`)
- **Legal & Compliance** (`/terms`, `/privacy`, `/cookie`)
- **Free Community Numbers Page** (`/free-numbers`) — Public web-only lead generator

---

## 3. Open Questions for Project Owner

1. **Payload Encryption in Production (`VITE_ENABLE_ENCRYPTION`):**  
   The web app has optional AES encryption for payloads. Is this enabled in the production backend? If enabled, note that shipping symmetric encryption keys inside client app bundles (iOS/Android) makes the key extractable by decompilation. We recommend relying on TLS 1.3 / HTTPS encryption.
2. **Cloudflare Turnstile Captcha:**  
   The web registration and login use Turnstile. Cloudflare Turnstile does not have an official native React Native SDK without using a WebView. Can the backend exempt authenticated native requests (e.g. via an internal mobile app secret header or native verification), or should we use an invisible WebView wrapper?
3. **Push Notifications Endpoint:**  
   The web uses browser VAPID push (`/push/subscribe`). Native mobile notifications require APNs (Apple) and FCM (Google). We have documented the proposed `/api/push/device-token` contract in [BACKEND_TASKS.md](file:///c:/Users/DELL/Documents/Globeverify/mobile-globeverify/BACKEND_TASKS.md).
4. **App Store & Google Play Digital Purchases Compliance:**  
   Apple and Google have strict guidelines regarding buying digital numbers and balance top-ups. If MarsPay fiat top-ups trigger App Store Review rejections, should we support opening the top-up checkout inside an in-app browser sheet pointing to `globeverify.com/dashboard/wallet`?
5. **Voice Calls & WebRTC:**  
   Telnyx WebRTC browser voice calling does not run directly in React Native without specialized native WebRTC compilation. Voice dialing is deferred to a future phase.
