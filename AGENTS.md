This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---

## ── UI Design System ──────────────────────────────────────────────────────────

The GlobeVerify mobile app uses a **premium dark-only** design system inspired by Revolut, Cash App, and N26.
The goal is: **clean, spacious, confident typography, zero clutter.**

### Core Design Principles

1. **Dark only** — always use the dark palette. No light mode. Background is `#080808`, not `#000`.
2. **Breathe** — use generous spacing. Minimum 20px horizontal padding. 24px between sections.
3. **Typography hierarchy** — large bold numbers, small muted labels. Never all-caps labels except for status tags.
4. **No borders on primary cards** — use background elevation (`#111111` surface, `#181818` surface2) instead of borders. Borders only on alerts and contextual rows.
5. **Pretty Bottom Navigation Bar** — use a docked/floating bottom nav bar at the bottom with 5 tabs (Home, Buy Number, My SMS [with badge], Wallet, Rentals). Subtle top border `rgba(255,255,255,0.08)`, active tab highlighted with a translucent pill (`rgba(59,130,246,0.16)`) and brand blue icon.
6. **Active Orders Display** — show exactly the top 3 active orders on the dashboard. Each order has:
   - Service brand avatar & color + Country flag (e.g. 🇺🇸) & country name + relative time.
   - Status badge ("Received" in green or "Waiting..." in amber).
   - Phone number bar with tap-to-copy button.
   - Hero OTP Code Box: large green monospace font (e.g. `922 703`), with "Copy Code" button and "Copied!" checkmark feedback.
   - Cleaned SMS message preview without HTML entities (`&lt;#&gt;`, `&#039;`, etc.).
7. **Buy Phone Number Screen** — multi-step mobile workflow:
   - Mode switcher: High Success (Standard) vs Budget Numbers.
   - Stepper: Country -> Service -> Confirm & Activate.
   - Live pricing calculation, stock detection, carrier pool toggle (High Success vs Economy).
   - Instant activation with tactile haptics and success modal with one-tap copy and jump to SMS Inbox.
8. **My SMS (My Numbers) Screen**:
   - Tab switcher: Active (Active & Waiting numbers + Queued Pending Orders) vs History (Past completed/expired).
   - Real-time auto-polling every 15s for incoming OTPs.
   - Live countdown timer ("Expires in mm:ss").
   - Hero OTP Box with large green monospace verification code and 1-tap copy button.
   - On-demand "Check SMS" action, "Cancel Number & Refund" to wallet, and "Reuse Number".
   - Integrated bottom navigation bar with active SMS count badge.
9. **Color accents, not fills** — use `rgba(color, 0.12)` backgrounds on icon containers. Never solid color backgrounds on list items.
10. **Haptics on every interaction** — `Haptics.impactAsync(Light)` on taps, `selectionAsync()` on toggles, `notificationAsync(Success)` on copy/confirm.

---

### Color Tokens

```ts
const BG      = '#080808';          // page background
const SURFACE = '#111111';          // card/list container
const SURFACE2= '#181818';          // inner rows, pill backgrounds
const BORDER  = 'rgba(255,255,255,0.07)'; // dividers only

const TEXT    = '#FFFFFF';          // primary text
const TEXT2   = '#A0A0A0';          // secondary/muted text
const TEXT3   = '#555555';          // placeholder/disabled text

const BLUE    = '#3b82f6';          // primary brand / active numbers
const GREEN   = '#22c55e';          // success / income / received
const PURPLE  = '#8b5cf6';          // net spent / cards
const ORANGE  = '#f97316';          // gross / rentals / warnings
const RED     = '#ef4444';          // debit / errors / logout
```

---

### Typography Scale

```ts
// Greeting name / hero numbers
fontSize: 28-38, fontWeight: '800', letterSpacing: -0.5 to -1

// Section titles
fontSize: 17, fontWeight: '700', letterSpacing: -0.2

// Card value / amount
fontSize: 14-16, fontWeight: '700'

// Labels / subtitles
fontSize: 11-13, fontWeight: '500', color: TEXT2

// Status tags / micro labels
fontSize: 9-11, fontWeight: '700', textTransform: 'uppercase'
```

---

### Component Patterns

#### Balance / Hero Card
```
borderRadius: 20, backgroundColor: SURFACE, padding: 20
├─ top row: label (TEXT2, 13px) + action pills (SURFACE2 bg)
├─ amount: 38px bold white
├─ divider: 1px BORDER
└─ CTA row: dot + label + chevron
```

#### Stat Cards (3-column row)
```
flex: 1, borderRadius: 16, backgroundColor: SURFACE, padding: 14
├─ colored accent bar: width 24, height 3, borderRadius 2  ← identity color
├─ label: 11px TEXT3
└─ value: 16px bold white, adjustsFontSizeToFit
```

#### Quick Action Grid (4 items)
```
flexDirection: 'row', justifyContent: 'space-between'
Each item:
├─ Icon container: 58×58, borderRadius: 18, bg: rgba(color, 0.15)
└─ Label: 12px bold, textAlign: center
```

#### List Card Container
```
backgroundColor: SURFACE, borderRadius: 18, overflow: 'hidden', paddingHorizontal: 16
Each row: paddingVertical: 13-14, flexDirection: 'row', gap: 12
Divider between rows: height: 1, backgroundColor: BORDER
```

#### Transaction / Number Row
```
├─ Icon: 36-38px container, borderRadius: 10-11, rgba icon bg
├─ Meta: flex 1, title (14px 600) + subtitle (11-12px TEXT2)
└─ Right: amount (14px 700, colored) + status pill
```

#### Status Pills
```
paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6
Background: rgba(color, 0.12)
Text: 10px bold, color: matching accent
```

#### Modal Sheets (bottom sheet)
```
borderTopLeftRadius: 24, borderTopRightRadius: 24
backgroundColor: SURFACE, padding: 20, paddingBottom: 40
├─ handle: 36×4, borderRadius: 2, bg: BORDER, centered, mb: 20
└─ overlay: rgba(0,0,0,0.6)
```

---

### What NOT to do

- ❌ Do NOT use `borderWidth: 1` on every card — it looks cheap and cluttered
- ❌ Do NOT use a list-row style for Quick Actions — use the icon grid
- ❌ Do NOT use `backgroundColor: '#121212'` hardcoded — use the token `SURFACE`
- ❌ Do NOT mix colored text labels with gray card backgrounds — keep consistent
- ❌ Do NOT stack too many sections — prioritize: Balance → Actions → Active Numbers → Transactions
- ❌ Do NOT use small font sizes for financial numbers — balance should be 34-38px
- ❌ Do NOT forget `Haptics` on every interactive element
- ❌ Do NOT use `ScrollView` with `nestedScrollEnabled` on flat content — keep it a single `ScrollView`

---

### Spacing Reference

```ts
const PAD = 20;           // horizontal screen padding
// Between sections: 24px
// Between items in a list: handled by internal paddingVertical
// Between action items: gap: 8-12
// Card padding: 14-20px depending on content density
```
