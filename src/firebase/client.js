import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.appId,
);

export const firebaseApp = isFirebaseConfigured
  ? (getApps().find((app) => app.name === '[DEFAULT]') || initializeApp(firebaseConfig))
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const authPersistence = auth
  ? setPersistence(auth, browserLocalPersistence)
  : Promise.resolve();

export function getSecondaryApp() {
  if (!firebaseApp) throw new Error('Firebase is not configured.');
  const appName = 'call-miner-user-provisioning';
  return getApps().some((app) => app.name === appName)
    ? getApp(appName)
    : initializeApp(firebaseConfig, appName);
}
