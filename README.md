# Lunelle — PMDD AI Companion

Lunelle is a cycle-phase companion for women with PMDD (premenstrual dysphoric disorder). Generic period apps treat PMDD like “bad PMS.” Lunelle is built around cycle day and phase, because those patterns only make sense in that frame.

It helps you log how you feel in about two minutes, see luteal-phase patterns in your own data, and take clear, non-diagnostic language to a clinical appointment.

**Lunelle does not diagnose, prescribe, or replace care.**

## Features

- **Daily tracking** — 11 DRSP-adapted symptoms, 1–6 severity, Impact (productivity, activities, relationships), and optional notes
- **Dashboard** — cycle day, phase, and charts that contrast luteal weeks with the rest of the cycle
- **AI insights** — Gemini summaries grounded in your logged data (server-side only; never a diagnosis)
- **Doctor Coach** — turns what you tracked into appointment wording; blocks medication and diagnosis questions
- **Reports** — a personal summary and a clinician-ready PDF
- **Partner sharing** — invite someone you trust to a curated view; you control permissions. Doctor Coach is never shared

## How to use

Open **https://lunelle-pmdd-ai.web.app**. Sign in, or tap **Try Demo Account** on the login screen.

1. **Track** — daily check-in (symptoms + Impact)
2. **Home** — cycle position and trends
3. **Insights** — generate or open a pattern summary
4. **Doctor Coach** — ask for wording for a doctor visit
5. **Reports** — download a personal or clinician PDF
6. **Profile** — cycle settings and partner invite

## Temporary test credentials

| | |
|---|---|
| Email | `maya@demo.lunelle.app` |
| Password | `LunelleDemo123!` |

Maya is seeded with about 90 days of cyclical data so patterns show immediately. This account cannot change password or delete itself. You can also create your own account.

**Demo Partner** (`partner@demo.lunelle.app`) is a separate Firebase Auth user for the partner-sharing flow. Do not use it as the Maya demo account.

## Setup and run

### Prerequisites

- Node.js 20+
- npm
- A Firebase project with **Email/Password** authentication and **Cloud Firestore**
- A Google Gemini API key

### Environment

```bash
# Windows
copy server\.env.example server\.env
copy client\.env.example client\.env

# macOS / Linux
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In `client/.env`, set the Firebase web config (`VITE_FIREBASE_*`). Leave `VITE_API_BASE_URL` empty for local development (Vite proxies `/api` to port 3001).

In `server/.env`, set `GEMINI_API_KEY` and Firebase Admin credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`). Never put secrets in `VITE_*` variables.

### Run

Terminal 1 — API:

```bash
cd server
npm install
npm run seed
npm run dev
```

`npm run seed` creates/updates Maya and writes demo symptom logs. It needs Firebase Admin credentials.

Terminal 2 — UI:

```bash
cd client
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`), go to **Log in**, and use the demo account above.

Production Hosting + Cloud Run: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Product spec: [docs/SPEC.md](docs/SPEC.md).

## Architecture

```
React 19 + Vite (client/)  →  Firebase Auth + owner-only Firestore
        ↓ /api (Bearer ID token)
Express 5 (server/)        →  Gemini (server-side only)
                           →  Firestore Admin (insights, coach evidence, partner view)
```

Gemini and Admin credentials live in `server/.env` only. Partner access goes through `GET /api/partner/view` — partners never read owner clinical collections in Firestore. Doctor Coach is never shared with a partner.
