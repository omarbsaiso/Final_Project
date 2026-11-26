# Call Miner

Call Miner is a bilingual (Arabic/English), role-aware call-quality workspace built with React, Vite, Bootstrap, Firebase Authentication, and Cloud Firestore. Its Node/Express API stores uploaded audio locally, transcribes Arabic recordings with Deepgram, and analyzes transcripts with Groq.

## Requirements

- Node.js 22 or newer and npm (the backend's Firebase Admin SDK requires Node 22+)
- A Firebase project with Email/Password Authentication and Cloud Firestore
- A Firebase Admin service account for the backend
- Deepgram and Groq API keys for live transcription and analysis

## Firebase setup

1. Register a Firebase web app, enable **Authentication → Email/Password**, and create a Cloud Firestore database.
2. Set the Firebase web app values in the root `.env` using `.env.example`.
3. Publish the existing Firestore rules and indexes if needed:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. Create a dedicated Firebase service account for the API, grant only the project permissions it needs to verify users and read/write Firestore, and keep its key private.
5. The designated Admin account is the existing Auth user with UID `mnLf1b3jZLUIqZlgDoAgK9QrMbp1`. Do not create a duplicate. Its existing `users/{uid}` Firestore document must have `role: "admin"` and `isActive: true`. No password or guest auto-login is configured in the frontend.

The backend uses Firebase Admin credentials and therefore bypasses Firestore Security Rules. Keep the backend private, protect its service-account key, and enforce API authorization; the frontend continues to use the existing Firestore rules for client reads and other operations. Firebase Storage is not used for call recordings.

## Environment configuration

### Frontend

```powershell
Copy-Item .env.example .env
```

Set the Firebase web configuration and `VITE_API_BASE_URL` in `.env`. Vite variables are browser-visible configuration only. Never put service-account credentials or Deepgram/Groq keys in frontend variables.

### Backend

```powershell
Copy-Item backend/.env.example backend/.env
```

Configure these values in `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port (default `3001`) |
| `FRONTEND_ORIGINS` | Comma-separated allowed frontend origins |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service-account JSON on one line; keep private |
| `STT_PROVIDER` | `deepgram` |
| `STT_API_KEY` | Deepgram API key |
| `DEEPGRAM_MODEL` | Deepgram model (default `nova-3`) |
| `STT_TIMEOUT_MS` | Transcription request timeout |
| `LLM_PROVIDER` | `groq` |
| `LLM_API_KEY` | Groq API key |
| `LLM_MODEL` | Groq model (default `llama-3.3-70b-versatile`) |
| `LLM_TIMEOUT_MS` | Analysis request timeout |

Both `.env` files and the local audio directory are excluded from Git. Restart the relevant server after changing environment values.

## Install and run locally

Install dependencies once:

```powershell
npm install
npm --prefix backend install
```

Start the backend and frontend in separate terminals:

```powershell
npm --prefix backend run dev
```

```powershell
npm run dev
```

The Vite URL is printed in the frontend terminal. The API listens on `http://localhost:3001` by default.

## Audio processing

1. An authenticated Admin selects an MP3, WAV, M4A, or WebM recording (maximum 100 MB).
2. The API validates the extension and MIME type, assigns a UUID filename, and stores the original name and metadata in the Firestore `calls` document.
3. Audio is stored privately in `backend/uploads/audio/`; it is not publicly served or stored as a Firestore binary.
4. Deepgram `nova-3` transcribes Arabic with punctuation, speaker diarization, and available timestamps. Groq `llama-3.3-70b-versatile` evaluates the transcript against a consistent customer-service QA rubric.
5. The UI refreshes processing status and displays the saved transcript and analysis. If processing fails, the recording remains available to retry from call details.

The API uses Firebase ID-token verification, an active Firestore profile, and Admin authorization for upload, retry, and deletion. Audio playback is streamed only through an authenticated, permission-checked endpoint. No public recording URL is created.

### API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API health check |
| `POST` | `/api/calls/upload` | Upload one audio file (`multipart/form-data`, field `audio`); requires a bearer token and UUID `Idempotency-Key` |
| `GET` | `/api/calls/:callId/audio` | Stream a recording after call-access authorization |
| `POST` | `/api/calls/:callId/retry` | Retry failed processing (Admin only) |
| `DELETE` | `/api/calls/:callId` | Delete a call, its feedback, and local recording (Admin only) |

## Tests and build

```powershell
npm --prefix backend test
npm run build
```

Backend tests use mocked Firebase and AI providers; they cover authentication/role checks, upload validation, idempotency, protected playback, deletion, and retry after provider failure. They do not prove that the configured Firebase project, Deepgram, or Groq credentials work. Verify those integrations with valid project credentials and real API keys before production use.

## Deployment and limitations

- The API must run as a Node service, not on the configured static-only frontend host. Set the production frontend origin in `FRONTEND_ORIGINS`, and set the API URL in the frontend's `VITE_API_BASE_URL` before building.
- Audio is stored on the API host's local disk. Use a single instance with persistent disk storage; ephemeral filesystems lose recordings on restart/redeployment, and horizontally scaled instances do not share files. A durable shared job queue is not included, so processing can be interrupted by a backend restart.
- The frontend and backend need separate environment configuration. Never expose the Firebase Admin service-account key or AI API keys.
- Firebase project setup, service-account permissions, profile provisioning, and live AI requests require manual configuration and cannot be verified by the local mocked tests.
