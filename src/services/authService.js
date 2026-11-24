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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, getSecondaryApp, isFirebaseConfigured } from '../firebase/client';
import { demoUsers } from '../data/demoData';
import { listUsers } from './dataService';

const DEMO_PASSWORD = 'Demo123!';

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

export async function signIn(email, password) {
  if (!isFirebaseConfigured) {
    const user = getDemoUsers().find((item) => item.email.toLowerCase() === email.toLowerCase());
    const savedHash = user && getDemoPasswords()[user.uid];
    const validPassword = savedHash ? await hashPassword(password) === savedHash : password === DEMO_PASSWORD;
    if (!user || !validPassword) {
      throw new Error('Email or password is incorrect. Demo accounts use Demo123!.');
    }
    if (!user.active) throw new Error('This account is disabled. Contact an administrator.');
    const sessionUser = { ...user };
    localStorage.setItem('call-miner-session', JSON.stringify(sessionUser));
    return sessionUser;
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getDoc(doc(db, 'users', credential.user.uid));
  if (!profile.exists()) {
    await signOut(auth);
    throw new Error('Your account profile is missing. Ask an administrator to finish setting it up.');
  }
  const user = { uid: credential.user.uid, ...profile.data() };
  if (!user.active) {
    await signOut(auth);
    throw new Error('This account is disabled. Contact an administrator.');
  }
  return user;
}

export async function sendPasswordReset(email) {
  if (!isFirebaseConfigured) {
    const exists = getDemoUsers().some((user) => user.email.toLowerCase() === email.toLowerCase());
    if (!exists) throw new Error('No demo account uses that email address.');
    return;
  }
  await sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  if (isFirebaseConfigured) await signOut(auth);
  localStorage.removeItem('call-miner-session');
}

export function subscribeToAuth(callback) {
  if (!isFirebaseConfigured) {
    const session = localStorage.getItem('call-miner-session');
    const storedUser = session ? JSON.parse(session) : null;
    const latestUser = storedUser && getDemoUsers().find((user) => user.uid === storedUser.uid);
    callback(latestUser?.active ? latestUser : null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }
    try {
      const profile = await getDoc(doc(db, 'users', firebaseUser.uid));
      const data = profile.exists() ? profile.data() : null;
      if (!data || !data.active) {
        await signOut(auth);
        callback(null);
        return;
      }
      callback({ uid: firebaseUser.uid, ...data });
    } catch (error) {
      callback(null, error);
    }
  });
}

export async function updateCurrentProfile(user, updates) {
  if (!isFirebaseConfigured) {
    const users = getDemoUsers().map((item) => item.uid === user.uid ? { ...item, ...updates } : item);
    localStorage.setItem('call-miner-users', JSON.stringify(users));
    const nextUser = { ...user, ...updates };
    localStorage.setItem('call-miner-session', JSON.stringify(nextUser));
    return nextUser;
  }
  await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
  if (updates.name) await updateProfile(auth.currentUser, { displayName: updates.name });
  return { ...user, ...updates };
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
      name: member.name,
      email: member.email,
      role: member.role,
      team: member.team,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', credential.user.uid), user);
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
  const { uid, ...updates } = member;
  await setDoc(doc(db, 'users', uid), updates, { merge: true });
  return member;
}

export async function loadTeamMembers() {
  return listUsers();
}

