# Lunelle deployment

This document is for a **controlled judging/demo environment**. It does not add product features. Firebase Hosting serves the React SPA; Cloud Run runs the Express API. Hosting cannot execute the Express server.

Do not put secrets in `VITE_*` variables. Those values are bundled into the frontend at build time.

## Architecture

| Piece | Where it runs | Role |
| --- | --- | --- |
| React/Vite client | Firebase Hosting (`client/dist`) | UI, Firebase Auth client, Firestore owner-only reads |
| Express API | Cloud Run | Insights, Coach, Reports, account, Partner Sharing |
| Firebase Auth | Firebase project | Email/password users, ID tokens |
| Firestore | Firebase project | Clinical data + `partnerLinks` (Admin SDK only for links) |
| Gemini | Server-side only | Insights and Coach — `GEMINI_API_KEY` never ships to the client |

Local development is unchanged: Vite proxies `/api` to `http://127.0.0.1:3001`. Leave `VITE_API_BASE_URL` empty locally.

`.firebaserc` currently selects project `lunelle-pmdd-ai`. Firestore is configured for location `asia-south1`.

---

## a. Firebase project selection

```bash
firebase login
firebase use lunelle-pmdd-ai
```

To use another project: `firebase use --add` and update `.firebaserc`. The Cloud Run service, Firestore, Auth, and Hosting must belong to the **same** GCP/Firebase project.

Enable (if not already): Authentication (Email/Password), Cloud Firestore, Firebase Hosting, Cloud Run, Artifact Registry, Cloud Build.

---

## b. Firestore rules and indexes

Rules and indexes are unchanged by this deployment work. Deploy them before exposing the app:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Confirm after deploy:

- `partnerLinks/{linkId}` remains `allow read, write: if false` (Express/Admin SDK only).
- `users/{userId}` and nested clinical collections remain owner-only.
- Doctor Coach is never a Firestore client path for partners.

Do not weaken these rules for Hosting or Cloud Run.

---

## c. Firebase Auth requirements

1. Enable **Email/Password** sign-in.
2. Authorized domains must include the Hosting origins, for example:
   - `lunelle-pmdd-ai.web.app`
   - `lunelle-pmdd-ai.firebaseapp.com`
   - any custom domain
   - `localhost` for local development
3. Create or keep the judging accounts (see **j** and **k**).
4. The Express API validates `Authorization: Bearer <Firebase ID token>` via Firebase Admin. Cloud Run should be **public HTTP** (`--allow-unauthenticated`); app auth is the ID token, not Cloud Run IAM.

---

## d. Required client **build-time** variables

Set these in the shell (or `client/.env`) **before** `npm run build`. Vite inlines `VITE_*` into `client/dist`.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web app key (public by design) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket (required by the web config object) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender id |
| `VITE_FIREBASE_APP_ID` | Web app id |
| `VITE_API_BASE_URL` | Cloud Run origin, **no trailing slash** (required in production) |
| `VITE_APP_URL` | Public SPA origin for partner invite links (optional; defaults to `window.location.origin`) |
| `VITE_DEMO_EMAIL` | Optional. Default: `maya@demo.lunelle.app` |
| `VITE_DEMO_PASSWORD` | Optional. Default matches `shared/constants.js` (public demo login) |

Copy `client/.env.example` to `client/.env` and fill values. Changing any `VITE_*` value requires a **rebuild and Hosting redeploy**.

---

## e. Required server **runtime** secrets

Set these on the Cloud Run service (Secret Manager recommended). They are **not** build args and must **not** appear in the Docker image or in `VITE_*`.

| Variable | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Admin SDK project |
| `FIREBASE_CLIENT_EMAIL` | Admin service account email |
| `FIREBASE_PRIVATE_KEY` | Admin private key. If stored as a single line, keep `\n` escapes; the server converts them |
| `GEMINI_API_KEY` | Gemini API (insights + coach) |
| `PORT` | Set automatically by Cloud Run (typically `8080`) |
| `NODE_ENV` | `production` |
| `CORS_ALLOWED_ORIGINS` | See **f** |
| `DEMO_ACCOUNT_EMAIL` | Optional. Must stay Maya: `maya@demo.lunelle.app` |

---

## f. CORS configuration

Production must **not** use unrestricted CORS and must **never** use `*`. The browser sends Firebase ID tokens in `Authorization`; `*` is rejected even if someone puts it in the env var.

`CORS_ALLOWED_ORIGINS` is a comma-separated list of browser origins (scheme + host, no path):

```text
CORS_ALLOWED_ORIGINS=https://lunelle-pmdd-ai.web.app,https://lunelle-pmdd-ai.firebaseapp.com
```

Include every Hosting URL judges will use (and a custom domain if you add one).

Behavior:

- **Development** (`NODE_ENV` not `production`) and empty allowlist: `http://localhost:*` and `http://127.0.0.1:*` are allowed so Vite can call the API directly if needed.
- **Production** and empty allowlist: requests with an `Origin` header are denied. Health checks without `Origin` still succeed.
- Requests with no `Origin` (curl, Cloud Run probes) are allowed.

---

## g. Cloud Run deployment

The Docker **build context must be the repository root**. Express imports `shared/` from the repo root; building only `server/` will fail.

Do **not** run `gcloud run deploy --source .` without `cloudbuild.yaml`. A root-level source deploy would not use `server/Dockerfile` and could pick the wrong Node app.

### Build the image

From the repository root:

```bash
docker build -f server/Dockerfile -t lunelle-api .
```

Or with Cloud Build (no local Docker):

```bash
gcloud config set project lunelle-pmdd-ai
gcloud artifacts repositories create lunelle --repository-format=docker --location=asia-south1
gcloud builds submit --config cloudbuild.yaml
```

Default image: `asia-south1-docker.pkg.dev/$PROJECT_ID/lunelle/lunelle-api`.

### Deploy the service

Replace `PROJECT_ID`, origin values, and secret resource names.

```bash
gcloud run deploy lunelle-api \
  --image asia-south1-docker.pkg.dev/PROJECT_ID/lunelle/lunelle-api \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "^@^NODE_ENV=production@CORS_ALLOWED_ORIGINS=https://lunelle-pmdd-ai.web.app,https://lunelle-pmdd-ai.firebaseapp.com" \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest
```

`--set-env-vars` uses commas as separators, so the `^@^...@...` form is required when `CORS_ALLOWED_ORIGINS` lists multiple origins.

`--allow-unauthenticated` is required so the browser can call the API; Express still rejects missing/invalid Firebase ID tokens.

Note the service URL, for example `https://lunelle-api-xxxxx-as.a.run.app`. That value is `VITE_API_BASE_URL` (no trailing slash).

Order: deploy Cloud Run first, then build the client with that URL, then deploy Hosting.

---

## h. Firebase Hosting deployment

Hosting serves static files from `client/dist`. Unknown frontend routes rewrite to `index.html` (SPA). There is **no** Hosting rewrite that runs Express.

```bash
cd client
# PowerShell
$env:VITE_FIREBASE_API_KEY="..."
$env:VITE_FIREBASE_AUTH_DOMAIN="..."
$env:VITE_FIREBASE_PROJECT_ID="lunelle-pmdd-ai"
$env:VITE_FIREBASE_STORAGE_BUCKET="..."
$env:VITE_FIREBASE_MESSAGING_SENDER_ID="..."
$env:VITE_FIREBASE_APP_ID="..."
$env:VITE_API_BASE_URL="https://lunelle-api-xxxxx-as.a.run.app"
$env:VITE_APP_URL="https://lunelle-pmdd-ai.web.app"
npm run build
cd ..
firebase deploy --only hosting
```

`firebase.json` `hosting.public` is `client/dist`. Rebuild whenever `VITE_*` changes.

---

## i. `VITE_API_BASE_URL` configuration

| Environment | Value | Result |
| --- | --- | --- |
| Local Vite | unset / empty | `fetch('/api/...')` → Vite proxy → Express `:3001` |
| Production | Cloud Run origin, no trailing slash | `fetch('https://…run.app/api/...')` |

Wrong or missing production value: the SPA will call `/api` on the Hosting origin and receive `index.html` instead of JSON.

Do not hardcode a production API URL in source control.

---

## j. Demo Maya account

Protected demo user (not the partner):

- Email: `maya@demo.lunelle.app` (`DEMO_ACCOUNT_EMAIL` / `VITE_DEMO_EMAIL`)
- Password: `LunelleDemo123!` unless overridden

Protections (unchanged):

- **Cannot** delete the account
- **Cannot** change password
- **Can** invite a partner, change partner permissions, and revoke partner access

Seed/repair (from `server/`, with Admin credentials):

```bash
npm run seed
```

Do not remove existing demo data. Do not add the Demo Partner email to `DEMO_ACCOUNT_EMAIL` or `VITE_DEMO_EMAIL`.

---

## k. Demo Partner account

`partner@demo.lunelle.app` is a **normal Firebase Auth user**. It must **not** appear in `DEMO_ACCOUNT_EMAIL` or `VITE_DEMO_EMAIL`. It is not blocked from password change or account deletion by the Maya demo guard.

Create it in Firebase Auth (console or Admin SDK) if it does not exist. Use it only as the partner in Partner Sharing — never as the protected Maya account.

---

## l. Post-deployment smoke tests

1. `GET https://<cloud-run>/api/health` → `{ ok: true, geminiConfigured: true, firebaseConfigured: true }`.
2. Open the Hosting URL. Sign in as Maya. Dashboard, Track, Insights, Coach, Reports load.
3. Generate an insight (Gemini). Confirm it is not the Hosting `index.html`.
4. Open Doctor Coach and send a starter. Confirm a coach reply. Confirm Partner Support never shows Coach content.
5. As Maya: invite / adjust permissions / revoke still works.
6. As Demo Partner: accept/view curated partner data only; no `partnerLinks` client reads (network tab should hit `/api/partner/*` on Cloud Run).
7. As Maya: Profile shows demo blocks for delete-account and change-password.
8. As Demo Partner: those profile actions are **not** treated as demo-mode forbidden.
9. Deep link a client route (e.g. `/insights`) and refresh — Hosting SPA fallback should work.
10. From a browser origin **not** on the CORS allowlist, API calls should fail CORS (optional negative test).

---

## m. Rollback and troubleshooting

**Rollback Hosting:** `firebase hosting:clone SOURCE_SITE:SOURCE_CHANNEL TARGET_SITE:live` or redeploy the previous `client/dist`. Fastest: `firebase hosting:rollback` if the Firebase CLI/project supports it, or deploy the last known good build artifact.

**Rollback Cloud Run:** route traffic to the previous revision:

```bash
gcloud run services update-traffic lunelle-api --region asia-south1 --to-revisions PREVIOUS_REVISION=100
```

**API calls return HTML / JSON parse errors:** `VITE_API_BASE_URL` missing or pointing at Hosting. Rebuild client and redeploy Hosting.

**CORS errors in the browser:** Hosting origin not listed in `CORS_ALLOWED_ORIGINS`, or trailing slash/path in the origin. Update Cloud Run env and wait for a new revision.

**401 on API:** Auth domain mismatch, expired token, or Admin credentials wrong/missing (`firebaseConfigured: false` on `/api/health`).

**503 `FIREBASE_ADMIN_MISSING`:** Cloud Run missing `FIREBASE_*` secrets.

**Gemini failures:** `GEMINI_API_KEY` missing (`geminiConfigured: false`). Increase Cloud Run `--timeout` if generation hits 300s.

**Partner invite links go to localhost:** set `VITE_APP_URL` to the public Hosting origin and rebuild.

**Docker build cannot find `shared/`:** you built from `server/` instead of the repository root.

---

## Local verification (no cloud deploy)

```bash
cd server
npm run verify:deployment-config
npm run verify:demo-account-guard
npm run verify:partner-hardening
npm run verify:partner-lifecycle
npm run verify:partner-view
npm run verify:partner-connect-client
cd ../client
npm run build
```

These checks do **not** mean production was deployed.
