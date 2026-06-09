# Noru ChatBot — Multi-Business AI Chatbot Platform

Production-ready, multi-tenant AI chatbot SaaS platform with WhatsApp, Telegram, and embeddable website widget support.

## Stack

| Layer | Technology |
|---|---|
| Admin Dashboard | React 18 + Vite + TailwindCSS |
| Backend | Node.js 20 + Express |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | OpenAI API (`gpt-4o`) |
| Channels | WhatsApp Cloud API, Telegram Bot API, Website Widget |

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Firestore, Auth, and Storage enabled
- OpenAI API key
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

Fill in Firebase Admin credentials, OpenAI API key, and WhatsApp verify token.

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

1. In Meta Developer Console, set webhook URL to:
   ```
   https://your-backend-url/webhook/whatsapp
   ```
2. Set verify token to match `WHATSAPP_VERIFY_TOKEN` in `.env`
3. Subscribe to `messages` field
4. Configure phone number ID and access token in Admin → Channels → WhatsApp

## Telegram Webhook

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Configure bot token in Admin → Channels → Telegram
3. Set webhook URL:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-backend-url/webhook/telegram/<BUSINESS_ID>
   ```

## Website Widget Embed

Add to any website:

```html
<script>
  window.BotConfig = {
    businessId: "YOUR_BUSINESS_ID",
    primaryColor: "#4F46E5",
    position: "bottom-right",
    backendUrl: "https://your-backend-url"
  };
</script>
<script src="https://your-cdn.com/widget.min.js"></script>
```

Build the widget with `cd widget && npm run build`. Output is at `widget/dist/widget.min.js`.

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

## Features

- Multi-tenant business management
- Visual flow builder with drag-and-drop steps
- OpenAI fallback when no flow matches
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

Protected endpoints require `Authorization: Bearer <Firebase ID Token>`.

## License

MIT
