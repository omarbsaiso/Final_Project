import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client';
import { demoCalls, demoDocuments, demoUsers } from '../data/demoData';
import { PRIVATE_ADMIN_UID } from '../constants/access';
import { deleteCallRecording } from './storageService';

function localRead(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function localWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function visibleCalls(user) {
  const calls = localRead('call-miner-calls', demoCalls);
  if (user?.role === 'Admin') return calls;
  if (user?.role === 'Supervisor') return calls.filter((call) => call.team === user.team);
  return calls.filter((call) => call.agentId === user?.uid);
}

export async function listCalls(user) {
  if (!isFirebaseConfigured) return visibleCalls(user);
  const constraints = [];
  if (user.role === 'Supervisor') constraints.push(where('team', '==', user.team));
  if (user.role === 'Agent') constraints.push(where('agentId', '==', user.uid));
  if (user.role === 'Demo') constraints.push(where('isDemo', '==', true));
  constraints.push(orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(query(collection(db, 'calls'), ...constraints));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getCall(callId, user) {
  if (!isFirebaseConfigured) return visibleCalls(user).find((call) => call.id === callId) || null;
  const snapshot = await getDoc(doc(db, 'calls', callId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createCall(call, callId) {
  if (!isFirebaseConfigured) {
    const calls = localRead('call-miner-calls', demoCalls);
    const created = { ...call, id: `CM-${Math.floor(25000 + Math.random() * 74999)}` };
    localWrite('call-miner-calls', [created, ...calls]);
    return created;
  }
  const reference = callId ? doc(db, 'calls', callId) : doc(collection(db, 'calls'));
  await setDoc(reference, { ...call, createdAt: new Date().toISOString() });
  return { ...call, id: reference.id };
}

export function createCallId() {
  return isFirebaseConfigured ? doc(collection(db, 'calls')).id : null;
}

export async function deleteCall(call) {
  if (!isFirebaseConfigured) {
    localWrite('call-miner-calls', localRead('call-miner-calls', demoCalls).filter((item) => item.id !== call.id));
    localWrite('call-miner-feedback', localRead('call-miner-feedback', []).filter((item) => item.callId !== call.id));
    return;
  }

  const feedback = await getDocs(query(collection(db, 'feedback'), where('callId', '==', call.id)));
  if (feedback.size > 499) {
    throw new Error('This call has too many feedback records to delete in one operation.');
  }
  const batch = writeBatch(db);
  feedback.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(doc(db, 'calls', call.id));
  await batch.commit();

  if (call.storagePath) {
    try {
      await deleteCallRecording(call.storagePath);
    } catch (error) {
      console.error('[Calls] Call removed but audio cleanup failed', { code: error?.code || error?.name || 'StorageError' });
      throw new Error('The call and its feedback were deleted, but its audio file could not be removed. Contact an administrator.');
    }
  }
}

export async function updateCall(callId, updates) {
  if (!isFirebaseConfigured) {
    const calls = localRead('call-miner-calls', demoCalls).map((call) => call.id === callId ? { ...call, ...updates } : call);
    localWrite('call-miner-calls', calls);
    return;
  }
  await setDoc(doc(db, 'calls', callId), updates, { merge: true });
}

export async function listDocuments(user) {
  if (!isFirebaseConfigured) {
    const docs = localRead('call-miner-documents', demoDocuments);
    return user?.role === 'Agent' ? docs.filter((item) => item.visibility === 'Everyone') : docs;
  }
  const documents = collection(db, 'knowledgeBase');
  if (user.role === 'Admin') {
    const snapshot = await getDocs(query(documents, orderBy('uploadedAt', 'desc')));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }
  if (user.role === 'Demo') {
    const snapshot = await getDocs(query(documents, where('isDemo', '==', true), orderBy('uploadedAt', 'desc')));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }
  const publicQuery = query(documents, where('visibility', '==', 'Everyone'), orderBy('uploadedAt', 'desc'));
  const publicSnapshot = await getDocs(publicQuery);
  const results = publicSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  if (user.role === 'Supervisor') {
    const teamQuery = query(
      documents,
      where('visibility', '==', 'Supervisors'),
      where('team', '==', user.team),
      orderBy('uploadedAt', 'desc'),
    );
    const teamSnapshot = await getDocs(teamQuery);
    results.push(...teamSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }
  return results.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export async function createDocument(documentData) {
  if (!isFirebaseConfigured) {
    const docs = localRead('call-miner-documents', demoDocuments);
    const created = { ...documentData, id: `doc-${crypto.randomUUID()}`, uploadedAt: new Date().toISOString() };
    localWrite('call-miner-documents', [created, ...docs]);
    return created;
  }
  const reference = await addDoc(collection(db, 'knowledgeBase'), {
    ...documentData,
    uploadedAt: new Date().toISOString(),
  });
  return { ...documentData, id: reference.id };
}

export async function removeDocument(documentId) {
  if (!isFirebaseConfigured) {
    localWrite('call-miner-documents', localRead('call-miner-documents', demoDocuments).filter((item) => item.id !== documentId));
    return;
  }
  await deleteDoc(doc(db, 'knowledgeBase', documentId));
}

export async function listUsers() {
  if (!isFirebaseConfigured) return localRead('call-miner-users', demoUsers);
  const snapshot = await getDocs(query(collection(db, 'users'), orderBy('fullName')));
  return snapshot.docs.map((item) => {
    const data = item.data();
    const fullName = data.fullName || data.name || '';
    const isActive = data.isActive ?? data.active ?? false;
    const role = item.id === PRIVATE_ADMIN_UID && data.role === 'admin' ? 'Admin' : data.role;
    return { ...data, uid: item.id, role, fullName, name: fullName, isActive, active: isActive };
  });
}

export async function listFeedback(callId, user) {
  if (!isFirebaseConfigured) {
    return localRead('call-miner-feedback', []).filter((item) => item.callId === callId);
  }
  const filters = [where('callId', '==', callId)];
  if (user.role === 'Supervisor') filters.push(where('team', '==', user.team));
  if (user.role === 'Agent') filters.push(where('agentId', '==', user.uid));
  if (user.role === 'Demo') filters.push(where('isDemo', '==', true));
  const snapshot = await getDocs(query(
    collection(db, 'feedback'),
    ...filters,
    orderBy('createdAt', 'asc'),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveFeedback(call, message, user) {
  const feedback = {
    callId: call.id,
    agentId: call.agentId,
    team: call.team,
    supervisorId: user.uid,
    message,
    createdAt: new Date().toISOString(),
  };
  if (!isFirebaseConfigured) {
    const entries = localRead('call-miner-feedback', []);
    const created = { ...feedback, id: `feedback-${crypto.randomUUID()}` };
    localWrite('call-miner-feedback', [...entries, created]);
    const calls = localRead('call-miner-calls', demoCalls).map((item) => item.id === call.id ? { ...item, status: 'Reviewed' } : item);
    localWrite('call-miner-calls', calls);
    return created;
  }
  const batch = writeBatch(db);
  const feedbackRef = doc(collection(db, 'feedback'));
  batch.set(feedbackRef, feedback);
  batch.set(doc(db, 'calls', call.id), { status: 'Reviewed' }, { merge: true });
  await batch.commit();
  return { id: feedbackRef.id, ...feedback };
}
