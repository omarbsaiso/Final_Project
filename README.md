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
