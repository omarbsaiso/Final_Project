import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../firebase/client';

export async function uploadFile(file, folder, userId, visibility = 'Everyone', team = 'Customer Care') {
  if (!isFirebaseConfigured) {
    return { url: '', path: `demo/${folder}/${userId}/${file.name}` };
  }
  const path = folder === 'knowledge'
    ? `${folder}/${visibility}/${team}/${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    : `${folder}/${team}/${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const reference = ref(storage, path);
  await uploadBytes(reference, file, { contentType: file.type });
  return { url: await getDownloadURL(reference), path };
}

export async function deleteStoredFile(path) {
  if (isFirebaseConfigured && path && !path.startsWith('demo/')) {
    await deleteObject(ref(storage, path));
  }
}
