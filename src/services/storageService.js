import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage';
import { isFirebaseConfigured, storage } from '../firebase/client';

const maxRecordingSize = 100 * 1024 * 1024;

function logStorageFailure(operation, error) {
  const code = typeof error?.code === 'string' ? error.code : error?.name || 'UnknownError';
  console.error(`[Storage] ${operation} failed`, { code });
}

function storageErrorMessage(error, operation) {
  if (error?.code === 'storage/unauthorized') {
    return 'Firebase Storage denied this request. Check the user role and deployed Storage rules.';
  }
  if (error?.code === 'storage/object-not-found') {
    return 'The audio file was not found in Firebase Storage.';
  }
  if (error?.code === 'storage/bucket-not-found') {
    return 'The Firebase Storage bucket is unavailable. Check VITE_FIREBASE_STORAGE_BUCKET.';
  }
  return `Firebase Storage could not ${operation} the audio file. Check the connection and Storage configuration.`;
}

function requireStorage() {
  if (!isFirebaseConfigured || !storage) {
    throw new Error('Firebase Storage is not configured. Check the Firebase web app settings and restart the app.');
  }
}

export async function uploadCallRecording(file, callId) {
  requireStorage();
  if (!file || !callId) throw new Error('A recording and call ID are required.');

  const safeName = file.name.replace(/[^\w.-]/g, '_') || 'recording';
  const contentType = file.name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
  if (file.size > maxRecordingSize) throw new Error('Audio files must be smaller than 100 MB.');

  const objectRef = ref(storage, `calls/${callId}/${crypto.randomUUID()}-${safeName}`);
  try {
    const result = await uploadBytes(objectRef, file, { contentType });
    return result.ref.fullPath;
  } catch (error) {
    logStorageFailure('upload', error);
    throw new Error(storageErrorMessage(error, 'upload'));
  }
}

export async function downloadCallRecording(path) {
  requireStorage();
  if (!path?.startsWith('calls/')) throw new Error('The audio file path is invalid.');
  try {
    return await getBlob(ref(storage, path), maxRecordingSize);
  } catch (error) {
    logStorageFailure('download', error);
    throw new Error(storageErrorMessage(error, 'download'));
  }
}

export async function deleteCallRecording(path) {
  requireStorage();
  if (!path?.startsWith('calls/')) throw new Error('The audio file path is invalid.');
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    logStorageFailure('delete', error);
    throw new Error(storageErrorMessage(error, 'delete'));
  }
}
