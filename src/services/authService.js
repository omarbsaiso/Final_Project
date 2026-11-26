import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, authPersistence, db, getSecondaryApp, isFirebaseConfigured } from '../firebase/client';
import { demoUsers } from '../data/demoData';
import { PRIVATE_ADMIN_UID } from '../constants/access';
import { listUsers } from './dataService';

const validRoles = ['Admin', 'Supervisor', 'Agent', 'Demo'];

const authMessages = {
  ar: {
    'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل بالفعل. سجّل الدخول أو استخدم بريدًا آخر.',
    'auth/invalid-email': 'يرجى إدخال عنوان بريد إلكتروني صحيح.',
    'auth/weak-password': 'يجب ألا تقل كلمة المرور عن 6 أحرف.',
    'auth/user-disabled': 'تم إيقاف هذا الحساب. يرجى التواصل مع مسؤول مساحة العمل.',
    'auth/user-not-found': 'لم يتم العثور على حساب بهذا البريد الإلكتروني.',
    'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/invalid-credential': 'بيانات تسجيل الدخول غير صحيحة. تحقق من البريد الإلكتروني وكلمة المرور.',
    'auth/invalid-login-credentials': 'بيانات تسجيل الدخول غير صحيحة. تحقق من البريد الإلكتروني وكلمة المرور.',
    'auth/too-many-requests': 'محاولات كثيرة. يرجى الانتظار قليلًا ثم المحاولة مجددًا.',
    'auth/network-request-failed': 'تعذر الاتصال بخدمة Firebase. تحقق من اتصال الإنترنت وحاول مجددًا.',
    'auth/operation-not-allowed': 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase Console.',
    'auth/requires-recent-login': 'يرجى تسجيل الدخول مجددًا لتنفيذ هذا الإجراء.',
    'auth/api-key-not-valid': 'مفتاح Firebase API غير صالح. تحقق من VITE_FIREBASE_API_KEY ومشروع Firebase.',
    'auth/invalid-api-key': 'مفتاح Firebase API غير صالح. تحقق من VITE_FIREBASE_API_KEY ومشروع Firebase.',
    'auth/app-not-authorized': 'نطاق التطبيق غير مصرح به في Firebase Authentication.',
    'permission-denied': 'ليس للحساب إذن الوصول إلى ملفه في Firestore. تحقق من قواعد Firestore.',
    'firestore/permission-denied': 'ليس للحساب إذن الوصول إلى ملفه في Firestore. تحقق من قواعد Firestore.',
    'firestore/unauthenticated': 'انتهت جلسة Firebase. سجّل الدخول مجددًا.',
    'firestore/unavailable': 'خدمة Firestore غير متاحة مؤقتًا. حاول مجددًا بعد قليل.',
    'firestore/failed-precondition': 'إعداد Firestore غير مكتمل. تحقق من إعداد قاعدة البيانات والفهارس.',
    'call-miner/profile-missing': 'ملف الحساب غير موجود في Firestore. اطلب من المسؤول إكمال إعداد users/{uid}.',
    'call-miner/profile-unavailable': 'ملف الحساب غير نشط أو يحتوي على دور غير صالح.',
    'call-miner/firebase-unconfigured': 'إعداد Firebase غير مكتمل. تحقق من متغيرات VITE_FIREBASE_* ثم أعد تشغيل التطبيق.',
  },
  en: {
    'auth/email-already-in-use': 'This email is already registered. Sign in or use another address.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'The password must be at least 6 characters.',
    'auth/user-disabled': 'This account is disabled. Contact your workspace administrator.',
    'auth/user-not-found': 'No account was found for this email address.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/invalid-credential': 'The credentials were rejected. Verify the email and password.',
    'auth/invalid-login-credentials': 'The credentials were rejected. Verify the email and password.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.',
    'auth/operation-not-allowed': 'Email/Password sign-in is not enabled in Firebase Console.',
    'auth/requires-recent-login': 'Sign in again before performing this action.',
    'auth/api-key-not-valid': 'Firebase rejected the API key. Verify VITE_FIREBASE_API_KEY and the Firebase project.',
    'auth/invalid-api-key': 'Firebase rejected the API key. Verify VITE_FIREBASE_API_KEY and the Firebase project.',
    'auth/app-not-authorized': 'This app domain is not authorized in Firebase Authentication.',
    'permission-denied': 'This account cannot read its Firestore profile. Check the Firestore rules.',
    'firestore/permission-denied': 'This account cannot read its Firestore profile. Check the Firestore rules.',
    'firestore/unauthenticated': 'The Firebase session expired. Sign in again.',
    'firestore/unavailable': 'Firestore is temporarily unavailable. Try again shortly.',
    'firestore/failed-precondition': 'Firestore setup is incomplete. Check the database and required indexes.',
    'call-miner/profile-missing': 'The Firestore user profile is missing. Ask an administrator to create users/{uid}.',
    'call-miner/profile-unavailable': 'The user profile is inactive or has an invalid role.',
    'call-miner/firebase-unconfigured': 'Firebase is not fully configured. Check VITE_FIREBASE_* values and restart the app.',
  },
};

function normalizeUser(uid, data) {
  const fullName = data.fullName || data.name || '';
  const isActive = data.isActive ?? data.active ?? false;
  const role = uid === PRIVATE_ADMIN_UID && data.role === 'admin' ? 'Admin' : data.role;
  if (!validRoles.includes(role)) return null;
  return { ...data, uid, role, fullName, name: fullName, isActive, active: isActive };
}

function getDemoUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem('call-miner-users') || 'null');
    return Array.isArray(saved) && saved.length ? saved : demoUsers;
  } catch {
    return demoUsers;
  }
}

function getDemoPasswords() {
  try {
    return JSON.parse(localStorage.getItem('call-miner-demo-passwords') || '{}');
  } catch {
    return {};
  }
}

async function hashPassword(password) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function reportAuthFailure(flow, error) {
  const code = typeof error?.code === 'string' ? error.code : error?.name || 'UnknownError';
  console.error(`[Auth] ${flow} failed`, { code });
}

function createServiceError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function getAuthErrorMessage(error, language = 'ar') {
  const locale = language === 'en' ? 'en' : 'ar';
  const code = typeof error?.code === 'string' ? error.code : '';
  const normalizedCode = code.startsWith('auth/api-key-not-valid')
    ? 'auth/api-key-not-valid'
    : code;
  return authMessages[locale][normalizedCode]
    || (error?.message && !code ? error.message : locale === 'en'
      ? 'Firebase authentication failed. Try again, and check the browser console for a safe error code.'
      : 'فشل التحقق من Firebase. حاول مجددًا، وتحقق من رمز الخطأ الآمن في وحدة تحكم المتصفح.');
}

function getArabicAuthError(error) {
  return getAuthErrorMessage(error, 'ar');
}

async function getAccountProfile(firebaseUser) {
  let profile;
  try {
    profile = await getDoc(doc(db, 'users', firebaseUser.uid));
  } catch (error) {
    reportAuthFailure('profile-read', error);
    throw error;
  }
  if (!profile.exists()) {
    throw createServiceError('call-miner/profile-missing');
  }
  const user = normalizeUser(firebaseUser.uid, profile.data());
  if (!user || !user.isActive) {
    throw createServiceError('call-miner/profile-unavailable');
  }
  return user;
}

export async function signIn(email, password, language = 'ar') {
  if (!isFirebaseConfigured) {
    throw new Error(getAuthErrorMessage(createServiceError('call-miner/firebase-unconfigured'), language));
  }

  try {
    await authPersistence;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try {
      return await getAccountProfile(credential.user);
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  } catch (error) {
    reportAuthFailure('sign-in', error);
    throw new Error(getAuthErrorMessage(error, language));
  }
}

export async function signUp(fullName, email, password, language = 'ar') {
  if (!isFirebaseConfigured) {
    throw new Error(getAuthErrorMessage(createServiceError('call-miner/firebase-unconfigured'), language));
  }

  let credential;
  try {
    await authPersistence;
    credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: fullName });
    const user = {
      uid: credential.user.uid,
      fullName,
      email: credential.user.email,
      role: 'Agent',
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    await setDoc(doc(db, 'users', credential.user.uid), user);
    return normalizeUser(credential.user.uid, user);
  } catch (error) {
    reportAuthFailure('sign-up', error);
    if (credential?.user) {
      try {
        await deleteUser(credential.user);
      } catch (cleanupError) {
        reportAuthFailure('sign-up-cleanup', cleanupError);
        throw new Error(`${getArabicAuthError(error)} تعذّر حذف الحساب غير المكتمل: ${getArabicAuthError(cleanupError)}`);
      }
    }
    throw new Error(getAuthErrorMessage(error, language));
  }
}

export async function sendPasswordReset(email, language = 'ar') {
  if (!isFirebaseConfigured) {
    throw new Error(getAuthErrorMessage(createServiceError('call-miner/firebase-unconfigured'), language));
  }
  try {
    await authPersistence;
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    reportAuthFailure('password-reset', error);
    throw new Error(getAuthErrorMessage(error, language));
  }
}

export async function logOut() {
  if (isFirebaseConfigured) await signOut(auth);
  localStorage.removeItem('call-miner-session');
}

export function subscribeToAuth(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  let cancelled = false;
  let unsubscribe = () => {};
  let unsubscribeProfile = () => {};
  authPersistence.then(() => {
    if (cancelled) return;
    unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeProfile();
      if (!firebaseUser) {
        callback(null);
        return;
      }
      unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (profile) => {
        const user = profile.exists() ? normalizeUser(firebaseUser.uid, profile.data()) : null;
        if (!profile.exists()) {
          callback(null);
          return;
        }
        if (!user || !user.isActive) {
          await signOut(auth);
          callback(null);
          return;
        }
        callback(user);
      }, (error) => {
        callback(null, error);
        if (error.code === 'permission-denied') signOut(auth);
      });
    }, (error) => callback(null, error));
  }).catch((error) => callback(null, error));
  return () => {
    cancelled = true;
    unsubscribe();
    unsubscribeProfile();
  };
}

export async function updateCurrentProfile(user, updates) {
  if (!isFirebaseConfigured) {
    const users = getDemoUsers().map((item) => item.uid === user.uid ? { ...item, ...updates } : item);
    localStorage.setItem('call-miner-users', JSON.stringify(users));
    const nextUser = { ...user, ...updates };
    localStorage.setItem('call-miner-session', JSON.stringify(nextUser));
    return nextUser;
  }
  const firestoreUpdates = { ...updates };
  if (Object.hasOwn(firestoreUpdates, 'name')) {
    firestoreUpdates.fullName = firestoreUpdates.name;
    delete firestoreUpdates.name;
  }
  await setDoc(doc(db, 'users', user.uid), firestoreUpdates, { merge: true });
  const nextUser = normalizeUser(user.uid, { ...user, ...updates, ...firestoreUpdates });
  if (updates.name) await updateProfile(auth.currentUser, { displayName: updates.name });
  return nextUser;
}

export async function createTeamMember(member) {
  if (!isFirebaseConfigured) {
    const users = getDemoUsers();
    if (users.some((user) => user.email.toLowerCase() === member.email.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }
    const user = { uid: `demo-${crypto.randomUUID()}`, ...member, active: true };
    localStorage.setItem('call-miner-users', JSON.stringify([...users, user]));
    const passwords = getDemoPasswords();
    passwords[user.uid] = await hashPassword(member.password);
    localStorage.setItem('call-miner-demo-passwords', JSON.stringify(passwords));
    return user;
  }

  const secondaryAuth = getAuth(getSecondaryApp());
  const credential = await createUserWithEmailAndPassword(secondaryAuth, member.email, member.password);
  try {
    if (member.name) await updateProfile(credential.user, { displayName: member.name });
    const user = {
      uid: credential.user.uid,
      fullName: member.name,
      name: member.name,
      email: member.email,
      role: member.role,
      team: member.team,
      isActive: true,
      active: true,
      createdAt: new Date().toISOString(),
    };
    const { name, active, ...profile } = user;
    await setDoc(doc(db, 'users', credential.user.uid), profile);
    return user;
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch (cleanupError) {
      throw new Error(`${error.message} The newly created account could not be rolled back: ${cleanupError.message}`);
    }
    throw error;
  } finally {
    if (secondaryAuth.currentUser) await signOut(secondaryAuth);
  }
}

export async function saveTeamMember(member) {
  if (!isFirebaseConfigured) {
    const users = getDemoUsers().map((user) => user.uid === member.uid ? { ...user, ...member } : user);
    localStorage.setItem('call-miner-users', JSON.stringify(users));
    return member;
  }
  const { uid, name, active, ...updates } = member;
  if (uid === PRIVATE_ADMIN_UID && updates.role === 'Admin') updates.role = 'admin';
  await setDoc(doc(db, 'users', uid), {
    ...updates,
    ...(name !== undefined ? { fullName: name } : {}),
    ...(active !== undefined ? { isActive: active } : {}),
  }, { merge: true });
  return member;
}

export async function loadTeamMembers() {
  return listUsers();
}

