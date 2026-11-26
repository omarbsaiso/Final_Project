
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export function initializeFirebaseAdmin() {
  if (!config.projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required.');
  }

  let serviceAccount;

  try {
    if (config.firebaseServiceAccountJson) {
      serviceAccount = JSON.parse(config.firebaseServiceAccountJson);
    } else {
      const serviceAccountPath = path.join(
        config.backendRoot,
        'serviceAccountKey.json'
      );

      const fileContent = readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(fileContent);
    }
  } catch {
    throw new Error('Could not read Firebase service account credentials.');
  }

  if (
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error('Firebase Admin credentials are missing required fields.');
  }

  if (serviceAccount.project_id !== config.projectId) {
    throw new Error('Firebase Admin credentials do not match FIREBASE_PROJECT_ID.');
  }

  const appName = 'call-miner-api';

  const app = getApps().find((item) => item.name === appName)
    || initializeApp({
      credential: cert(serviceAccount),
      projectId: config.projectId,
    }, appName);

  return {
    auth: getAuth(app),
    db: getFirestore(app),
    fieldValue: FieldValue,
  };
}
