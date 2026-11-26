import { auth, authPersistence } from '../firebase/client';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
async function getIdToken(language) {
  await authPersistence;
  if (!auth?.currentUser) {
    throw new Error(language === 'ar' ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا.' : 'Your session has expired. Sign in again.');
  }
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    throw new Error(language === 'ar' ? 'تعذر التحقق من جلسة الدخول. سجّل الدخول مجددًا.' : 'Could not verify your session. Sign in again.');
  }
}

async function apiFetch(url, options, language) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(language === 'ar'
      ? 'تعذر الاتصال بخادم المعالجة. تحقق من تشغيل الخادم.'
      : 'Could not reach the processing server. Check that it is running.');
  }
}

async function readApiResponse(response, language) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error?.message;
    throw new Error(message || (language === 'ar'
      ? 'تعذر إكمال الطلب. حاول مجددًا.'
      : 'The request could not be completed. Please try again.'));
  }
  return payload;
}

export async function uploadCallRecording(file, topic, language, onProgress) {
  const token = await getIdToken(language);
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('topic', topic);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${apiBaseUrl}/api/calls/upload`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Idempotency-Key', crypto.randomUUID());
    request.setRequestHeader('Accept-Language', language);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error(language === 'ar'
      ? 'تعذر الاتصال بخادم المعالجة. تحقق من تشغيل الخادم.'
      : 'Could not reach the processing server. Check that it is running.'));
    request.onload = () => {
      let payload;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error(language === 'ar' ? 'أعاد الخادم استجابة غير صالحة.' : 'The server returned an invalid response.'));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload?.error?.message || (language === 'ar'
          ? 'تعذر رفع التسجيل. حاول مجددًا.'
          : 'The recording could not be uploaded. Please try again.')));
        return;
      }
      resolve(payload);
    };
    request.send(formData);
  });
}

export async function downloadCallRecording(callId, language) {
  const token = await getIdToken(language);
  const response = await apiFetch(`${apiBaseUrl}/api/calls/${encodeURIComponent(callId)}/audio`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': language },
  }, language);
  if (!response.ok) await readApiResponse(response, language);
  return response.blob();
}

export async function deleteCallFromApi(callId, language = 'en') {
  const token = await getIdToken(language);
  const response = await apiFetch(`${apiBaseUrl}/api/calls/${encodeURIComponent(callId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': language },
  }, language);
  return readApiResponse(response, language);
}

export async function retryCallProcessing(callId, language = 'en') {
  const token = await getIdToken(language);
  const response = await apiFetch(`${apiBaseUrl}/api/calls/${encodeURIComponent(callId)}/retry`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': language },
  }, language);
  return readApiResponse(response, language);
}
