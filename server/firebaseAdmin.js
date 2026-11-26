import admin from 'firebase-admin';
import { config } from './config.js';

function getCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json);
    return admin.credential.cert(parsed);
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: config.firebaseProjectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }
  return null;
}

export function initializeFirebaseAdmin() {
  if (!config.firebaseProjectId) {
    throw new Error('FIREBASE_PROJECT_ID is required by the AI backend.');
  }
  const credential = getCredential();
  if (!credential) {
    throw new Error('Configure FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.');
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential, projectId: config.firebaseProjectId });
  }
  return { auth: admin.auth(), db: admin.firestore() };
}

export async function verifyFirebaseUser(token) {
  const { auth } = initializeFirebaseAdmin();
  return auth.verifyIdToken(token);
}
