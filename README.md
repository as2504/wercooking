# WeAreCooking 🍛

**Home-style meals & healthy breakfasts, pre-booked for pickup in Akurdi, Pune.**

A clickable, end-to-end **prototype** of a mobile-first Progressive Web App for a small cloud kitchen. It covers the full customer journey (sign up → order or subscribe → pay → track → pick up → rate) and a **Kitchen Admin** mode (orders board, cook sheet, pickup verification, menu, kitchen updates, reports), both in the same app.

> ⚠️ **Everything is simulated.** There is no backend. OTP, UPI, wallet and invoices are mocks; all data lives in your browser (IndexedDB). No real money moves.

Our core idea, **"Proof, not promise"**: every order shows *"Cooked at 11:40 AM, packed at 12:05 PM, by Tai"*, recorded when the kitchen taps Cooking and Packed. A daily Kitchen Update feed shows a photo, the oil used and the vegetables used.

---

## Quick start

Requirements: **Node 18+** (built and tested on Node 22).

```bash
npm install
npm run dev
```

Open http://localhost:5173. For the phone layout, use your browser's device toolbar (360–430 px wide).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (service worker disabled in dev) |
| `npm run build` | Type-check + production build with service worker → `dist/` |
| `npm run preview` | Serve the production build (use this to test install/offline) |
| `npm test` | Unit tests (Vitest): pricing, cutoffs, subscriptions, cook sheet |
| `npm run typecheck` | TypeScript only |
| `npm run icons` | Regenerate PNG app icons from `public/favicon.svg` |

### Deploy (GitHub + Vercel)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo. Vercel detects Vite automatically (build `npm run build`, output `dist`). No env vars are needed.
3. `vercel.json` already rewrites deep links (e.g. `/orders/123`) to `index.html` and sets correct caching for `sw.js`.

### Install on a phone

- **Android (Chrome):** open the site → an **Install app** banner appears on Home (or Profile → Install app, or the browser menu → *Install app*).
- **iPhone (Safari):** open the site → **Share** → **Add to Home Screen**. The app shows these steps on Home.
- Works offline after the first load (app shell + all data are local).

---

## Demo script (≈ 5 minutes)

Tip: open **two tabs**, one as the customer and one as Kitchen Admin, to watch status changes arrive live.

1. **Sign up**: open `/` → *Get started* → enter any valid mobile (e.g. `98765 43210`) → OTP: **any 4 digits** (hint shown) → name, area, Veg/Egg, spice, allergies.
2. **Build a breakfast box**: on Home tap the **Breakfast** tile → pick *Kanda Poha*, add *Boiled eggs* + *Sprouts* (price updates live: ₹45 + ₹14 + ₹15 = ₹74) → *Add to cart*.
   Optional: *Add more items* → *Poha only* ₹25 (cart ₹99).
3. **Checkout**: pick a pickup slot (shows "n left") → coupon **`WELCOME20`** (₹20 off first order, min ₹80) → *Proceed to pay ₹79*.
4. **Pay (simulated UPI)**: choose a UPI app chip, a UPI ID (e.g. `rahul@okbank` → *Verify*), or the mock QR.
   **Payment simulator:** long-press the **⚠ SIMULATION** badge (or tap the "Simulator outcome" line under the Pay button) and choose:
   - *Success*: approved after ~2.5 s
   - *Failed (insufficient balance)*: shows the reason and *Retry payment*
   - *Pending → success in 5 s*: settles automatically
   - *Timeout*: no bank response after ~8 s, with retry

   On success you get a transaction ID, UPI ref, receipt number and a printable **invoice** (watermarked *SIMULATION*).
5. **Kitchen Admin**: Profile → *Switch to Kitchen Admin* → PIN **`1234`**.
   - **Today** shows orders by meal, the **cook sheet** (thalis, boxes, rotis to roll, eggs…), revenue and slot capacity. Use ‹ › to view tomorrow.
   - **Orders** is the Kanban board: *Accept → Start cooking → Mark packed → Ready for pickup*. The customer's order screen updates live, with the proof label and in-app or system notifications.
6. **Pickup**: as the customer, open the order to see the **pickup code + QR**. In Admin → **Pickup**, type the code (or scan the QR with the camera) → *Mark picked up*. Reusing the code is rejected.
   (Breakfast orders are for tomorrow. Use **Settings → Time travel → "Tomorrow 7:00 AM"** to make them "today" at the counter.)
7. **Rate**: the customer's order now shows **Rate**. Give 1–5 stars plus an optional comment. It appears in Admin → More → **Reports**.

More to try:
- **Subscribe**: Orders → *My plans* → *New plan* (or Checkout → *Subscribe & save*). Pick a meal, weekly/monthly, start date and slot, then pay. In the **calendar**, tap a day to **skip** it (credit goes to the wallet), then **pause / resume / cancel** with a refund preview.
- **Time travel** (Profile → *Settings & demo tools*) moves the clock for every tab. Jump to *8:55 AM* to see the lunch cutoff countdown turn red. Move past 9 AM and today's plan lunch becomes a kitchen order automatically.
- **Wallet**: add money (UPI simulation), pay an order from the wallet, cancel an order before cutoff and get an instant refund.
- **Admin → Menu**: change prices, mark items **sold out** (customers see it instantly), edit the weekly menu, capacities, cutoffs and plan prices.
- **Admin → More → Post kitchen update**: take a photo or pick one from the gallery (compressed and stored locally), add a note, oil and vegetables. It shows on the customer's Home and Kitchen tab, where customers can ❤️ it.
- **Reset demo data**: Settings → *Reset demo data* re-seeds a realistic week (12 customers, ~170 orders, plans, reviews, updates).

---

## Business rules

| Rule | Value (editable in Admin → Menu) |
|---|---|
| Breakfast cutoff | **9 PM the night before** · pickup 7:30–10:00 AM |
| Lunch cutoff | **9 AM same day** · pickup 12:30–2:30 PM |
| Dinner cutoff | **4 PM same day** · pickup 7:30–9:30 PM |
| Service days | Monday–Saturday (Sunday closed) |
| Slots | 30 min, default 10 orders/slot, 40/day per meal. Unpaid checkouts hold a slot for 10 min |
| Regular thali | ₹110 (₹100 on plan) · Mini thali ₹85 |
| Breakfast box | base ₹45–60 + eggs ₹14 (2), sprouts ₹15, fruit ₹20, chikki ₹10 · *Poha only* ₹25 |
| Add-ons | extra roti ₹10, egg curry ₹30, curd ₹15 |
| Plans (₹/day) | Weekly (6 days): lunch/dinner 100, breakfast 50, combo 190 · Monthly (26 days): 95 / 48 / 180 |
| Skip | before that meal's cutoff → per-meal value credited to wallet ("rollover") |
| Pause / resume | pauses all still-changeable meals; resume reschedules them onto the next free service days |
| Cancel order / plan | before cutoff → refund to wallet instantly |
| Pricing | GST-free, no packaging fee. Coupons: `WELCOME20` (first order, min ₹80), `STUDENT10` (min ₹85) |

All times are **IST** (UTC+5:30, computed independently of the device timezone), formatted Indian-style (`Fri, 9 Oct`, `9:00 PM`, `₹1,140`).

---

## Architecture

```
UI (React screens) ─► hooks (useLiveQuery, useCatalog) ─► src/api/*  (async, typed "backend")
                                                           │
                                     src/lib/* (pure rules) ┤
                                                           ▼
                                               src/db/storage.ts  (IndexedDB adapter)
```

- **`src/api/`** is the only layer that touches storage. Every function is `async` and returns the typed models, as an HTTP client would. Replacing these modules with `fetch()` calls to a real server needs **no UI changes**.
- **`src/lib/`** holds pure, unit-tested business rules: `cutoff.ts`, `pricing.ts`, `subscription.ts`, `kitchen.ts` (cook sheet / reports), `time.ts` (IST), `clock.ts` (time travel).
- **Live sync:** every write broadcasts the changed collections over a `BroadcastChannel` (falling back to `storage` events). `useLiveQuery` re-fetches, so admin and customer tabs update in real time.
- **"Server jobs"** (`src/api/engine.ts`) run every 30 s and on time travel: settle pending payments, time out abandoned ones, expire unpaid checkouts, turn plan days into kitchen orders at cutoff, and complete finished plans.
- **State:** Zustand for session, cart (persisted), toasts and the admin date. Server data is never kept in global state; it is always read through the api layer.
- **PWA:** `vite-plugin-pwa` (Workbox `generateSW`) precaches the app shell and self-hosted fonts. It includes an update prompt, an offline banner, an install banner (Android native prompt / iOS instructions), maskable icons, and notification-click routing (`public/sw-notify.js`).

```
src/
  api/          base, session, users, menu, orders, payments, wallet, subscriptions,
                kitchenUpdates, reviews, notifications, admin, engine, sync, demo
  components/   ui/ (Button, Field, Sheet, States, Icon, Toaster…), BottomNav, BarChart,
                ProofLabel, SlotPicker, QR, QRScanner, CartGuard, InstallPrompt, AppStatus…
  db/           storage (adapter), seed (deterministic demo data), illustrations
  features/     onboarding, home, menu, cart, payment, orders, subscriptions, updates,
                profile, admin, common
  hooks/        useLiveQuery, useCatalog, useNow, useReorder
  layouts/      CustomerLayout, AdminLayout
  lib/          pure business logic + formatting
  store/        session, cart, toast
  types/        models.ts
tests/          cutoff, pricing, subscription (Vitest)
```

## Data model (`src/types/models.ts`)

| Model | Notes |
|---|---|
| `User` | phone, name, area, diet (veg/egg), spice, allergies, `walletBalance`, `hasOrdered` (first-order coupon) |
| `MenuItem` | category `thali / meal_addon / breakfast_base / breakfast_addon / breakfast_item`, price, optional `subPrice`, diet, meals served, `soldOut` |
| `WeeklyMenu` → `DayMenu` | Mon–Sat lunch sabji, dal, dinner sabji, breakfast special (a base item id) |
| `Cart` / `CartLine` | one cart = one pickup (meal + date). A line is an item or a Build-a-Box (`BoxConfig {baseId, addonIds}`) |
| `Order` / `OrderItem` | prices **snapshotted** at order time; `status` + `statusHistory`; `cookedAt`, `packedAt`, `cookedBy` (proof label); `pickupCode`; `paymentState` (`unpaid / paid / refunded / prepaid_plan`); `source` single or subscription |
| `Payment` | purpose (`order / subscription / wallet_topup`), method (`upi_app / upi_id / upi_qr / wallet`), status (`processing / pending / success / failed / timeout`), `attempt`, txnId, UPI ref, receipt and invoice numbers |
| `Subscription` / `SubDay` | plan (weekly/monthly) × meal (breakfast/lunch/dinner/combo), `pricePerDay`, `days[]` with state `upcoming / ordered / delivered / skipped / paused / cancelled`, `creditedBack` |
| `WalletTxn` | signed amount, `balanceAfter`, type `topup / payment / refund / rollover` |
| `KitchenUpdate` | photo (data URL), note, oil used, vegetables, freshness tag, `heartedBy[]` |
| `Review` | 1–5 stars + comment, one per picked-up order |
| `AppNotification` | audience = user id or `"admin"`, title, body, deep link |
| `KitchenSettings` | per-meal windows (cutoff, pickup window, slot and daily capacity), plan prices, cook name, FSSAI no., admin PIN |

---

## What changes for production

| Area | Prototype | Production |
|---|---|---|
| **Backend & data** | IndexedDB in each browser; "jobs" run in the tab | Real API (e.g. Node/NestJS or Supabase/Firebase) + Postgres. Re-implement `src/api/*` as HTTP calls. Move cutoff/capacity/coupon checks **server-side** (never trust the client), run jobs via cron/queues, add audit logs |
| **Real-time** | BroadcastChannel between tabs | WebSockets / SSE / Firestore listeners for order status and the admin board |
| **Auth / OTP** | Any 4 digits | SMS OTP via MSG91 / Twilio / Firebase Auth with DLT-registered templates (TRAI), rate limiting, JWT/refresh tokens. Admin via real staff accounts + roles, not a PIN |
| **Payments** | Simulator | Razorpay / Cashfree / PhonePe PG: create the order server-side, UPI intent / collect / QR, **verify signatures + webhooks** before marking paid, idempotency keys, refunds API, reconciliation. Wallet balances need RBI PPI rules or should be "store credit" only |
| **Invoices & tax** | Simulated receipt | GST registration once over threshold (5% on restaurant service), compliant invoice numbering, PDF generation, email/WhatsApp delivery |
| **Push notifications** | Notifications API while the app is open + in-app toasts | Web Push (VAPID) via FCM, sent from the server. iOS needs the PWA installed (16.4+). Add WhatsApp/SMS for critical updates |
| **FSSAI & compliance** | Demo number | Real FSSAI registration/licence displayed in app and at the counter; allergen labelling; privacy policy, terms, refund policy (Consumer Protection E-Commerce Rules 2020); DPDP Act 2023 consent and data handling |
| **Photos** | Data URLs in IndexedDB | Upload to object storage (S3 / Cloudinary) with CDN + moderation |
| **Delivery** | "Coming soon" | Address book + geofence, delivery fee and slots, rider assignment or Dunzo/Porter/Shadowfax integration, live tracking |
| **Ops** | – | Monitoring (Sentry), analytics, backups, rate limits, staging environment, E2E tests (Playwright) |

---

## Testing & quality

- `npm test`: 29 unit tests covering cutoffs (IST, Sundays, edge minutes), slots and capacity, box/cart pricing and coupons, plan quotes, skip/unskip credit, pause/resume rescheduling, cancel refunds, plan-order materialisation, and the cook sheet.
- Lighthouse (mobile, production build): **Performance 95 · Accessibility 100 · Best Practices 100 · PWA 100**.
- Accessibility: labelled form fields with inline errors (`aria-invalid`, `role="alert"`), 44 px+ touch targets, visible focus rings, focus-trapped dialogs with Esc, `prefers-reduced-motion`, and chart table views.

Dev-only extras: `/dev/ui` (design-system gallery) and Settings → **Time travel**.
