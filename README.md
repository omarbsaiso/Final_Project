# Call Miner

Call Miner is a responsive call-quality workspace built with React, Vite, Bootstrap, and Firebase Authentication/Cloud Firestore. It provides role-aware call review, a knowledge library, team administration, and profile preferences. When Firebase credentials are absent, it runs as a browser-local demo with sample analytics and data.

> Sample transcripts, summaries, sentiment, and QA scores are illustrative only. The MVP does not run speech recognition or AI analysis.

## Requirements

- Node.js 20 or newer
- npm
- A Firebase project for Firebase-backed authentication and Firestore (optional for demo mode)

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. With no Firebase environment variables, the app opens in demo mode.

### Demo accounts

Use the password `Demo123!` with any account below:

| Role | Email |
| --- | --- |
| Admin | `admin@callminer.demo` |
| Supervisor | `supervisor@callminer.demo` |
| Agent | `agent@callminer.demo` |

Demo data is saved in this browser's local storage. Clearing site data resets the demo workspace. These demo credentials must not be used in a Firebase production environment.

## Firebase setup

1. Register a Firebase web app in your project. Copy the web app configuration into the ignored `.env` file (the supplied local `.env` is already configured for this project).
2. In Authentication → Sign-in method, enable **Email/Password**.
3. Create a Cloud Firestore database. Firebase Storage is not initialized or used by this version.
4. In Firebase Console → Authentication → Users, create the first administrator. Copy that user's UID and create `users/{uid}` in Firestore with the required fields:

   ```json
   {
     "uid": "AUTH_USER_UID",
     "fullName": "Workspace Administrator",
     "email": "admin@your-company.com",
     "role": "Admin",
     "team": "Customer Care",
     "createdAt": "2026-11-25T10:00:00.000Z",
     "isActive": true
   }
   ```

   Bootstrap the first Admin manually: the rules deliberately prevent a signed-in user from creating or promoting their own profile. Admins can add other users through **User management**.
5. Publish the Firestore rules and indexes:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   The included `firebase.json` connects the CLI to the Firestore rules and indexes. This requires the Firebase CLI and a project selected with `firebase use`. Alternatively, paste `firestore.rules` into Firestore → Rules and deploy `firestore.indexes.json` as Firestore indexes.
6. Sign in as the provisioned administrator. Roles and active status come from the protected `users/{uid}` profile.

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket identifier from web app config; currently unused |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |

Firebase web configuration values identify the Firebase project; they are not server credentials. Do not put service-account keys, private keys, or Admin SDK credentials in a `VITE_` variable or in this frontend. Add `.env` locally and configure the same variables in your deployment provider's environment settings.

### Data and access model

- `users/{uid}` stores `uid`, `fullName`, `email`, `role`, `createdAt`, and `isActive` (plus optional `team` and `language`).
- `calls/{callId}` stores call metadata, visibility/team assignment, and review status.
- `knowledgeBase/{documentId}` stores document metadata and role visibility. Files are not uploaded or downloadable until Storage is intentionally enabled.
- `feedback/{feedbackId}` stores supervisor notes linked to a call and its assigned agent.
- Supervisors see calls and supervisor-only knowledge resources for their team. Agents see only their own calls and feedback, plus knowledge resources visible to everyone. Admins manage users and access all workspace records.
- Admin role is granted only through trusted administrator provisioning. Rules prevent users from changing their own role or active status. Review the rules against your organization's privacy requirements before launch.
- Audio file selection is available only as a local demo placeholder; Firebase mode disables audio uploads. Knowledge document entries save metadata only. No Firebase Storage SDK or Storage rules are used.

## Project structure

```text
src/
  components/       Shared navigation, cards, badges, and upload dialog
  context/          Authentication and language preferences
  data/             Clearly labeled illustrative demo content
  firebase/         Firebase app initialization
  layouts/          Protected workspace and application shell
  pages/            Login, dashboard, calls, details, knowledge, users, settings
  services/         Authentication, Firestore, and sample analysis provider
  utils/            Date and file-size formatting
  App.jsx           Route declarations
  main.jsx          Vite entry point and providers
  styles.css        Application styles and responsive layouts
firestore.rules
firestore.indexes.json
```

## Real AI analysis backend

Call Miner can process real recordings through a separate Express backend. Firebase Storage is intentionally not used: the browser sends the audio only to the backend, the backend uses a temporary OS directory for processing, and the file is deleted immediately after transcription/analysis. No permanent audio copy is stored.

### Provider selection

- **Deepgram** is the default Speech-to-Text provider. Its documented free starting credit, local-file API, Arabic support, MP3/WAV/M4A handling, speaker diarization, and documented file limits suit a university prototype. Quotas and account terms can change.
- **Groq** is the default LLM provider. It provides a developer API and structured JSON generation with a free/development tier, subject to changing quotas and rate limits. The default model is `llama-3.3-70b-versatile`.
- **AssemblyAI** and **Gemini** are supported alternatives by setting `STT_PROVIDER=assemblyai` or `LLM_PROVIDER=gemini`.

### Backend setup

1. Copy `.env.example` to `.env` and add the Firebase web values for the React app.
2. Add a private Firebase Admin credential method: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS`.
3. Add `STT_API_KEY` and `LLM_API_KEY`. Do not place them in `VITE_` variables.
4. Install and start both processes:

```bash
npm install
npm run dev:all
```

This starts Vite on its printed local port and the API on `http://localhost:3001`. The Vite `/api` proxy forwards uploads to Express. The backend can also be started alone with `npm run server`.

When Firebase configuration is absent, the app remains in Demo Mode and the upload dialog creates clearly labeled sample metadata instead of calling the AI backend.

### API authentication and Firestore

The upload request sends the signed-in Firebase user's ID token. The backend verifies it with Firebase Admin, checks `users/{uid}.isActive`, and authorizes the call's team/agent ownership before creating `calls/{callId}`. It writes `pending`, `processing`, `completed`, or `failed` status data and provider metadata.

No Firebase Storage dependency is introduced. This is suitable for local demonstrations, but temporary local disk storage means a serverless or scaled deployment needs a shared ephemeral upload approach or a separately evaluated object-storage provider.

### Manual provider testing

Because API credentials are not bundled, real calls require manual configuration. Test missing keys, invalid formats, provider failures, successful transcription, successful JSON analysis, Firestore persistence, and retrieval separately. The app reports provider/LLM/Firestore failures and marks the call `Failed`; it never substitutes sample analysis.

## Example real analysis JSON

```json
{
  "summary": "طلب العميل تغيير باقة الإنترنت وشرح الموظف تكلفة التحويل ومواعيد تطبيقها.",
  "topic": "تغيير باقة الإنترنت",
  "category": "خدمة الاشتراكات",
  "customerSentimentCode": "Neutral",
  "customerSentiment": "محايد",
  "mainIssue": "استفسار العميل عن باقة أسرع وتكلفة التحويل",
  "satisfactionIndicators": ["السؤال طُرح مباشرة ولا تتوفر مؤشرات رضا إضافية"],
  "qualityScore": 82,
  "agentStrengths": ["شرح الخيارات بوضوح"],
  "agentWeaknesses": ["لم يؤكد الموظف الخطوات التالية بشكل واضح"],
  "compliance": "تم الالتزام بشرح الخدمة، ولا تتوفر بيانات للتحقق من جميع سياسات الامتثال",
  "recommendations": ["تأكيد التاريخ النهائي لتطبيق الباقة"],
  "criteria": [{ "name": "وضوح الشرح", "score": 85, "note": "الشرح واضح ومتسق" }],
  "keywords": ["تغيير الباقة", "تكلفة التحويل"]
}
```

## Build and deployment

Run a production build locally:

```bash
npm run build
npm run preview
```

The static output is written to `dist/`. To deploy on Render, create a **Static Site** with:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Rewrite rule: source `/*`, destination `/index.html` (required for React Router deep links)
- Add the Firebase `VITE_FIREBASE_*` variables in the Render environment settings before building.

The included `render.yaml` contains the static-site build and SPA rewrite configuration. No server/API is required for this MVP.

## Collaboration

- Use feature branches and focused pull requests.
- Never commit `.env` or private credentials; `.env.example` documents the required public Firebase web-app configuration.
- Keep demo data clearly labeled and do not represent it as real analysis.
- Before changing data access, update and test the Firebase Security Rules alongside the service layer.
