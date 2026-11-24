# Call Miner

Call Miner is a responsive call-quality workspace built with React, Vite, Bootstrap, and Firebase. It provides role-aware call review, a knowledge library, team administration, and profile preferences. When Firebase credentials are absent, it runs as a browser-local demo with sample analytics and data.

> Sample transcripts, summaries, sentiment, and QA scores are illustrative only. The MVP does not run speech recognition or AI analysis.

## Requirements

- Node.js 20 or newer
- npm
- A Firebase project for Firebase-backed authentication, Firestore, and Storage (optional for demo mode)

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

1. Create a Firebase project and register a web app.
2. Enable **Email/Password** in Authentication.
3. Create a Cloud Firestore database and a Storage bucket.
4. Copy `.env.example` to `.env` and set each `VITE_FIREBASE_*` value from the Firebase web app configuration.
5. In Firebase Console, create the first user in Authentication. Copy that user's UID and create `users/{uid}` in Firestore with fields such as:

   ```json
   {
     "uid": "AUTH_USER_UID",
     "name": "Workspace Administrator",
     "email": "admin@your-company.com",
     "role": "Admin",
     "team": "Customer Care",
     "active": true,
     "language": "en"
   }
   ```

   The first administrator must be provisioned in the Firebase Console because client-side rules intentionally do not allow an unprivileged user to grant themselves a role. Add subsequent users from **User management**.
6. Publish the provided rules and indexes:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   The included `firebase.json` connects the CLI to the rules and indexes in this project. This requires the Firebase CLI and a project selected with `firebase use`. Alternatively, paste `firestore.rules` and `storage.rules` into their respective Firebase Console rule editors and deploy them; deploy `firestore.indexes.json` as Firestore indexes.
7. Verify an initial administrator can sign in. The Admin role is read from the protected `users/{uid}` profile document and checked by both Firestore and Storage rules.

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |

Firebase web configuration values identify the Firebase project; they are not server credentials. Do not put service-account keys, private keys, or Admin SDK credentials in a `VITE_` variable or in this frontend. Add `.env` locally and configure the same variables in your deployment provider's environment settings.

### Data and access model

- `users/{uid}` stores the role, team, active state, profile name, and language.
- `calls/{callId}` stores recording metadata, review status, supervisor notes, and Storage path/URL.
- `documents/{documentId}` stores knowledge document metadata, team, visibility, and Storage path/URL.
- Call recordings are placed under `calls/{team}/{uid}/...`; knowledge files are placed under `knowledge/{visibility}/{team}/{uid}/...`.
- Supervisors see calls and supervisor-only resources for their team. Agents see their own calls and resources visible to everyone. Admins can manage users and access all workspace records.
- Admin role is granted only through trusted administrator provisioning. For production, review the rules against your organization’s data retention, audit, and privacy requirements before launch.
- Deleting a knowledge resource deletes its Storage object and Firestore metadata. Demo mode stores metadata only; it does not persist uploaded file bytes.

## Project structure

```text
src/
  components/       Shared navigation, cards, badges, and upload dialog
  context/          Authentication and language preferences
  data/             Clearly labeled illustrative demo content
  firebase/         Firebase app initialization
  layouts/          Protected workspace and application shell
  pages/            Login, dashboard, calls, details, knowledge, users, settings
  services/         Authentication, Firestore, Storage, and sample analysis provider
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
