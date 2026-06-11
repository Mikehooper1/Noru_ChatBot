# Noru ChatBot — Multi-Business AI Agent Platform

Production-ready, multi-tenant **AI agent** SaaS that chats with customers, takes bookings, and sends reminders across **Website**, **WhatsApp**, **Telegram**, and **Instagram** (Enterprise). Business owners upgrade plans in-app with **UPI or Card** (Razorpay).

## Stack

| Layer | Technology |
|---|---|
| Admin Dashboard | React 18 + Vite + TailwindCSS |
| Backend | Node.js 20 + Express |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | Google Gemini with automatic multi-key failover |
| Channels | WhatsApp Cloud API, Telegram Bot API, Website Widget, Instagram (Enterprise) |
| Billing | Razorpay (UPI, Cards) with mock mode for local testing |

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Firestore, Auth, and Storage enabled
- One or more **Google Gemini API keys** (free tier works — add several for higher throughput)
- Meta Developer account (WhatsApp)
- Telegram BotFather bot token (optional)

## Project Structure

```
├── admin-dashboard/    # React admin UI
├── backend/            # Express API + webhooks
├── widget/             # Embeddable chat widget
└── firebase/           # Firestore & Storage rules
```

## Setup

### 1. Firebase Project

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password + Google)
3. Enable **Firestore** and **Storage**
4. Generate a service account key (Project Settings → Service Accounts)
5. Copy web app config for the admin dashboard

### 2. Environment Variables

**Backend** — copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Fill in Firebase Admin credentials, **Gemini API keys**, WhatsApp verify token, and Razorpay keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). Without Razorpay keys, payments run in **mock mode** for testing.

### Gemini multi-key failover

The AI agent uses **Google Gemini only**. Add as many keys as you like — when one hits its rate/quota limit, the agent automatically rotates to the next key (round-robin), and then to a fallback model, with no error shown to the customer:

```bash
# Recommended: comma-separated list
GEMINI_API_KEYS=AIzaKey1,AIzaKey2,AIzaKey3
# Or a single key
GEMINI_API_KEY=AIzaKey1
# Or numbered keys
GEMINI_API_KEY_2=AIzaKey2

GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
```

Get keys at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

**Admin Dashboard** — copy `admin-dashboard/.env.example` to `admin-dashboard/.env`:

```bash
cp admin-dashboard/.env.example admin-dashboard/.env
```

Fill in Firebase web config and set `VITE_BACKEND_URL=http://localhost:3000`.

### 3. Install Dependencies

```bash
cd backend && npm install
cd ../admin-dashboard && npm install
cd ../widget && npm install && npm run build
```

### 4. Deploy Firebase Rules

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 5. Seed Sample Data

Set `SEED_OWNER_ID` in `backend/.env` to your Firebase Auth UID, then:

```bash
cd backend
npm run seed
```

This creates 4 sample businesses: HealthCare Clinic, Glow Salon, ShopMart, and TechSaaS.

## Running Locally

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 — Admin Dashboard:**

```bash
cd admin-dashboard
npm run dev
```

Open http://localhost:5173 and sign in with your Firebase account.

## WhatsApp Webhook

See **[WhatsApp — Auto AI Replies](#whatsapp--auto-ai-replies)** above for the full setup guide.

Quick reference:

1. Webhook URL: `https://your-backend-url/webhook/whatsapp`
2. Verify token: match `WHATSAPP_VERIFY_TOKEN` in backend `.env`
3. Subscribe to `messages` field
4. Configure phone number ID and access token in Admin → Channels → WhatsApp

## Telegram Webhook

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the **bot token**
2. In **Admin → Channels → Telegram → Configure**:
   - Paste **Bot Token** and **Bot Username**
   - Click **Save**
   - Click **Register webhook with Telegram**
3. Webhook URL (one per chatbot):

   ```
   https://YOUR-RAILWAY-BACKEND-URL/webhook/telegram/YOUR_BUSINESS_ID
   ```

   The URL is shown inside the Telegram configure modal. Your backend must have `BACKEND_URL` set to the same public URL (e.g. `https://noruchatbot-production.up.railway.app`).

4. **Manual setup** (alternative): open in browser (replace `<TOKEN>` and `<BUSINESS_ID>`):

   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-BACKEND-URL/webhook/telegram/<BUSINESS_ID>
   ```

5. Toggle **Telegram ON** in Channels after saving

## Website Widget Embed

### 1. Get your embed code

In **Admin → Channels → Website → Configure**, copy the embed code. It looks like:

```html
<script>
  window.BotConfig = {
    businessId: "YOUR_BUSINESS_ID",
    primaryColor: "#4F46E5",
    position: "bottom-right",
    backendUrl: "https://your-backend.up.railway.app"
  };
</script>
<script src="https://your-backend.up.railway.app/widget.min.js" defer></script>
```

Paste both `<script>` tags before `</body>` on your website.

### 2. Important URLs

| URL | Works? |
|-----|--------|
| `https://YOUR-BACKEND/widget.min.js` | ✅ Correct |
| `https://YOUR-BACKEND/widget.js` | ✅ Also works (alias) |
| `https://YOUR-ADMIN/widget.min.js` | ❌ 404 — widget is served by **backend**, not admin |
| `widget.js` on your own site without hosting | ❌ 404 — must load from backend URL |

### 3. Fix 404 errors

The widget file is served by your **Express backend** (Railway), not Netlify admin.

1. Set `backendUrl` in `BotConfig` to your live Railway URL (no trailing slash)
2. Use `https://YOUR-RAILWAY-URL/widget.min.js` as the script `src`
3. Redeploy backend after updates — `npm start` runs `copy-widget` automatically
4. Test in browser: open `https://YOUR-RAILWAY-URL/widget.min.js` — you should see JavaScript, not 404

Build locally:

```bash
cd widget && npm install && npm run build
cd ../backend && npm run copy-widget
```

## WhatsApp — Auto AI Replies

WhatsApp requires a **Pro plan** (or higher). Once configured, every incoming WhatsApp message is handled automatically: flows run first, then AI replies.

### Step 1 — Meta Developer setup

1. Go to [developers.facebook.com](https://developers.facebook.com) → **Create App** → type **Business**
2. Add product **WhatsApp** → **API Setup**
3. Copy **Phone number ID** and generate a **Permanent access token**
4. Note your test phone number (or add a production number)

### Step 2 — Backend webhook (Railway)

In Railway → your backend service → **Variables**, set:

```env
WHATSAPP_VERIFY_TOKEN=any_random_string_you_choose
BACKEND_URL=https://your-backend.up.railway.app
```

Redeploy the backend.

### Step 3 — Meta webhook URL

In Meta → WhatsApp → **Configuration** → **Webhook**:

| Field | Value |
|-------|-------|
| Callback URL | `https://your-backend.up.railway.app/webhook/whatsapp` |
| Verify token | Same string as `WHATSAPP_VERIFY_TOKEN` |
| Subscribe | ✅ **messages** |

Click **Verify and Save**. Meta sends a GET request; the backend must respond with the challenge.

### Step 4 — Admin dashboard

1. **Upgrade to Pro** (Plans page) if on Free
2. Go to **Channels → WhatsApp → Configure**
3. Enter **Phone Number ID** and **Access Token** from Meta
4. Enter your **Admin WhatsApp number** (country code + number, e.g. `919876543210`) to receive a WhatsApp message whenever someone books
5. Save, then **toggle WhatsApp ON**
6. Send **Hi** once from your admin phone to your business WhatsApp number (Meta requires this before outbound alerts)
7. Ensure **AI is enabled** (AI Settings) and you have flows or AI fallback configured

### Step 5 — Test

Send a WhatsApp message to your business number from a phone added as a test recipient (Meta sandbox) or your connected number.

**Flow:**
```
Customer WhatsApp message
  → Meta sends POST to /webhook/whatsapp
  → Backend finds business by phoneNumberId
  → Flow engine + AI generates reply
  → Reply sent back via WhatsApp Cloud API
```

### WhatsApp troubleshooting

| Problem | Fix |
|---------|-----|
| Webhook verify fails | `WHATSAPP_VERIFY_TOKEN` must match Meta exactly |
| Messages not received | Subscribe to **messages** field in Meta |
| No AI reply | Check Phone Number ID matches Meta; channel toggled ON; Pro plan active |
| Upgrade message instead | Business is on Free plan — upgrade to Pro |
| No admin booking alert | Set admin number in Channels → WhatsApp; send Hi to business number once; WhatsApp channel must be ON |

The webhook URL is also shown inside **Channels → WhatsApp → Configure** in the admin dashboard.

### Legacy embed (manual)

```html
<script>
  window.BotConfig = {
    businessId: "YOUR_BUSINESS_ID",
    primaryColor: "#4F46E5",
    position: "bottom-right",
    backendUrl: "https://your-backend-url"
  };
</script>
<script src="https://your-backend-url/widget.min.js"></script>
```

Build the widget with `cd widget && npm run build && cd ../backend && npm run copy-widget`.

## Deployment

### Admin Dashboard → Firebase Hosting

```bash
cd admin-dashboard
npm run build
firebase deploy --only hosting
```

### Backend → Railway or Render

1. Connect your repo
2. Set root directory to `backend`
3. Add all environment variables from `.env.example`
4. Start command: `npm start`

## Plans & Limits

| Plan | Channels | Chat memory | Reminders | Price |
|---|---|---|---|---|
| **Free** | Website only | 24 hours | No | ₹0 |
| **Pro** | Website + WhatsApp + Telegram | 30 days | Yes | ₹999/mo |
| **Enterprise** | + Instagram | 30 days | Yes | ₹2,999/mo |

- **Free** — website widget, 24-hour conversation memory, 200 messages/month
- **Pro** — WhatsApp & Telegram, 30-day memory, appointment reminders, agent inbox
- **Enterprise** — Instagram + unlimited agents

Upgrade in **Admin → Plans** (UPI / Card via Razorpay). When limits are hit, the AI agent sends **inline checkout links** on WhatsApp/Telegram — tap to pay with UPI or Card without opening the admin dashboard.

## How the AI Agent Works

1. Customer messages on **website**, **WhatsApp**, or **Telegram** (channel gated by plan)
2. **Flow engine** runs booking flows first (appointments, FAQs, handoff)
3. **AI** (Gemini, multi-key failover) answers questions the flow does not cover
4. **Appointments** are saved to Firestore; admins see them in real time
5. **Reminders** cron (every 15 min, Pro+): customer morning reminder at **8 AM** local, **1 hour before** appointment, and **admin daily digest** on WhatsApp at 8 AM

## Features

- Multi-tenant business management
- Visual flow builder with drag-and-drop steps
- Gemini AI with automatic multi-key round-robin + model failover on rate limits
- AI fallback when no flow matches
- WhatsApp, Telegram, and website widget channels
- Appointment booking with Google Calendar sync
- Broadcast messaging
- Analytics dashboard
- Human handoff queue
- Appointment reminders (15-min cron)
- AES-256 encrypted API tokens in Firestore
- Rate limiting on webhooks (100 req/min)

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET/POST | `/webhook/whatsapp` | WhatsApp webhook |
| POST | `/webhook/telegram/:businessId` | Telegram webhook |
| POST | `/api/widget/message` | Widget chat message |
| GET | `/api/widget/config/:businessId` | Widget config |
| GET | `/api/appointments` | List appointments |
| POST | `/api/appointments` | Create appointment |
| POST | `/api/broadcasts` | Send broadcast |
| GET | `/api/analytics/daily` | Daily analytics |
| GET | `/api/plans` | List plan definitions |
| GET | `/checkout` | Public mobile checkout page (UPI / Card) |
| GET | `/api/payments/checkout-info` | Checkout session info (signed token) |
| POST | `/api/payments/public-verify` | Verify payment from chat checkout link |
| POST | `/api/payments/create-order` | Create Razorpay order (auth) |
| POST | `/api/payments/verify` | Verify payment & activate plan (auth) |

Protected endpoints require `Authorization: Bearer <Firebase ID Token>`.

## License

MIT
