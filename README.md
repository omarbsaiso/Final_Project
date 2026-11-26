# Call Miner

Call Miner is a responsive call-quality workspace built with React, Vite, Bootstrap, and Firebase Authentication, Cloud Firestore, and Storage. It provides role-aware call review, a knowledge library, team administration, and profile preferences. Email/password authentication is required to access the workspace.

> Sample transcripts, summaries, sentiment, and QA scores are illustrative only. The MVP does not run speech recognition or AI analysis.

## Requirements

- Node.js 20 or newer
- npm
- A Firebase project with Email/Password Authentication, Cloud Firestore, and Cloud Storage enabled

## Run locally

```powershell
npm install
Copy-Item .env.example .env
# Fill in the Firebase web app values in .env
npm run dev
```

Open the local URL printed by Vite. Firebase configuration is read from `.env`; restart Vite after changing environment variables.

### Private administrator account

The login page does not provide guest auto-login. The designated account must sign in manually using the regular email/password form; no account password is embedded in the frontend. Its existing Authentication user is mapped to the Admin role only when its Firestore profile has the designated UID and `role: "admin"`. Do not create a duplicate Authentication account. Rotate the account password before using it, and remove any old `VITE_FIREBASE_DEMO_EMAIL` or `VITE_FIREBASE_DEMO_PASSWORD` values from local and deployment environments.

## Firebase setup

1. Register a Firebase web app in your project and copy its web configuration to `.env` using `.env.example` as a template.
2. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
3. Create a Cloud Firestore database and enable the Firebase Storage bucket.
4. Publish the Firestore rules, Storage rules, and indexes (the rules permit public self-registration only as an active `Agent`):

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   This requires the Firebase CLI and a project selected with `firebase use`. Alternatively, paste `firestore.rules` into Firestore → Rules, `storage.rules` into Storage → Rules, and deploy `firestore.indexes.json` as Firestore indexes.
5. In Firebase Console → Authentication → Users, verify that the existing administrator account has UID `mnLf1b3jZLUIqZlgDoAgK9QrMbp1`. Do not add a second account. In Firestore, edit the existing `users/{uid}` document and set its role to lowercase `admin` and `isActive` to `true`. Keep the account's existing profile fields. Change its password in Authentication before enabling access; never place that password in a `VITE_` variable. The client recognizes this exact UID as Admin while the Security Rules continue to require an authenticated, active profile.
6. To bootstrap a different first administrator, create that user in Authentication and create its profile manually with `role: "Admin"` and `isActive: true`. Self-registration cannot assign administrative privileges. Admins can add other users through **User management**.

Audio playback uses authenticated Storage requests (not public download-token URLs). Configure the Storage bucket's CORS policy for the exact deployed app and local development origins, allowing the Firebase Storage methods and request headers used by the SDK and returning the `Content-Type` response header. CORS is not authorization; Storage Rules still authorize every operation. Do not use wildcard origins.

Sign-up creates an active `Agent` profile automatically. Roles and active status are read from `users/{uid}` and revalidated by Firestore security rules.

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket identifier from web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |

Firebase web configuration values identify the Firebase project; they are not server credentials. Never put account passwords, service-account keys, private keys, or Admin SDK credentials in a `VITE_` variable or in this frontend. Add `.env` locally and configure the Firebase web app values in your deployment provider's environment settings.

### Data and access model

- `users/{uid}` stores `uid`, `fullName`, `email`, `role`, `createdAt`, and `isActive` (plus optional `team` and `language`).
- `calls/{callId}` stores call metadata, visibility/team assignment, review status, and a private Storage path for an uploaded recording.
- `knowledgeBase/{documentId}` stores document metadata and role visibility. Knowledge document files are not uploaded by the current UI.
- `feedback/{feedbackId}` stores supervisor notes linked to a call and its assigned agent.
- Supervisors see calls and supervisor-only knowledge resources for their team. Agents see only their own calls and feedback, plus knowledge resources visible to everyone. Admins manage users and access all workspace records.
- Admin role is granted only through trusted administrator provisioning. Rules prevent users from changing their own role or active status. Review the rules against your organization's privacy requirements before launch.
- Admins can upload and delete audio recordings. Storage rules limit writes/deletes to active Admin profiles, and recording reads follow the call's role/team permissions. Knowledge document entries currently save metadata only; the selected knowledge file itself is not stored.

## Project structure

```text
src/
  components/       Shared navigation, cards, badges, and upload dialog
  context/          Authentication and language preferences
  constants/        UID-scoped role mapping
  data/             Clearly labeled illustrative demo content
  firebase/         Firebase app initialization
  layouts/          Protected workspace and application shell
  pages/            Login, dashboard, calls, details, knowledge, users, settings
  services/         Authentication, Firestore, Storage, and sample analysis
  utils/            Date and file-size formatting
  App.jsx           Route declarations
  main.jsx          Vite entry point and providers
  styles.css        Application styles and responsive layouts
firestore.rules
firestore.indexes.json
storage.rules
```

## Build and deployment

Run a production build locally:

```bash
npm run build
npm run preview
```

For an authentication smoke test, sign in with an authorized account, refresh the dashboard to confirm the session persists, then sign out. Verify Admin routes and audio upload/playback after updating the designated profile and deploying both rule sets. The static output is written to `dist/`. To deploy on Render, create a **Static Site** with:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Rewrite rule: source `/*`, destination `/index.html` (required for React Router deep links)
- Add the Firebase `VITE_FIREBASE_*` variables in the Render environment settings before building.

The included `render.yaml` contains the static-site build and SPA rewrite configuration. No server/API is required for this MVP.

## Collaboration

- Use feature branches and focused pull requests.
- Never commit `.env`, passwords, or Admin SDK credentials; `.env.example` documents only the public Firebase web-app configuration.
- Keep demo data clearly labeled and do not represent it as real analysis.
- Before changing data access, update and test the Firebase Security Rules alongside the service layer.
