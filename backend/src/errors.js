export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export class ProviderError extends Error {
  constructor(stage, code) {
    super(code);
    this.stage = stage;
    this.code = code;
  }
}

const messages = {
  en: {
    AUTH_REQUIRED: 'Sign in to continue.',
    AUTH_INVALID: 'Your session is invalid or expired. Sign in again.',
    ORIGIN_NOT_ALLOWED: 'This application origin is not allowed to use the API.',
    PROFILE_INACTIVE: 'This account is inactive or has no valid workspace profile.',
    ADMIN_REQUIRED: 'Administrator access is required for this action.',
    CALL_NOT_FOUND: 'The call was not found.',
    CALL_ACCESS_DENIED: 'You do not have permission to access this recording.',
    AUDIO_NOT_FOUND: 'The recording file could not be found.',
    AUDIO_REQUIRED: 'Choose an audio file to upload.',
    INVALID_AUDIO_FORMAT: 'Use an MP3, WAV, M4A, or WebM audio file with a matching audio MIME type.',
    UPLOAD_ID_REQUIRED: 'A valid upload request ID is required.',
    DUPLICATE_UPLOAD: 'This upload request has already been processed.',
    PROCESSING_IN_PROGRESS: 'This call is already being processed.',
    UPLOAD_FAILED: 'The audio could not be saved. Check local storage permissions.',
    FILE_TOO_LARGE: 'Audio files cannot be larger than 100 MB.',
    FIRESTORE_FAILED: 'Call metadata could not be saved. The uploaded file was removed.',
    DELETE_FAILED: 'The call could not be deleted completely. Contact an administrator.',
    RETRY_FAILED: 'The recording is missing or could not be queued for processing.',
    SERVER_ERROR: 'The server could not complete the request.',
    PROCESSING_FAILED: 'Call processing failed. The recording is retained and can be retried.',
    DEEPGRAM_NOT_CONFIGURED: 'Speech recognition is not configured on the server.',
    DEEPGRAM_REQUEST_FAILED: 'Speech recognition failed. The recording is retained and can be retried.',
    DEEPGRAM_EMPTY_TRANSCRIPT: 'No transcript was returned. Check the recording and retry.',
    GROQ_NOT_CONFIGURED: 'AI analysis is not configured on the server.',
    GROQ_REQUEST_FAILED: 'AI analysis failed. The transcript and recording are retained for retry.',
    GROQ_INVALID_RESPONSE: 'AI analysis returned an invalid result. The call can be retried.',
    GROQ_TRANSCRIPT_TOO_LONG: 'The transcript exceeds the analysis limit and needs a shorter recording.',
  },
  ar: {
    AUTH_REQUIRED: 'سجّل الدخول للمتابعة.',
    AUTH_INVALID: 'جلسة الدخول غير صالحة أو منتهية. سجّل الدخول مجددًا.',
    ORIGIN_NOT_ALLOWED: 'مصدر التطبيق غير مسموح له باستخدام واجهة الخادم.',
    PROFILE_INACTIVE: 'الحساب غير نشط أو لا يحتوي على ملف صالح لمساحة العمل.',
    ADMIN_REQUIRED: 'يتطلب هذا الإجراء صلاحية مسؤول.',
    CALL_NOT_FOUND: 'لم يتم العثور على المكالمة.',
    CALL_ACCESS_DENIED: 'ليست لديك صلاحية للوصول إلى هذا التسجيل.',
    AUDIO_NOT_FOUND: 'تعذر العثور على ملف التسجيل.',
    AUDIO_REQUIRED: 'اختر ملفًا صوتيًا لرفعه.',
    INVALID_AUDIO_FORMAT: 'استخدم ملف MP3 أو WAV أو M4A أو WebM مع نوع MIME صوتي مطابق.',
    UPLOAD_ID_REQUIRED: 'معرّف طلب الرفع غير صالح أو مفقود.',
    DUPLICATE_UPLOAD: 'تمت معالجة طلب الرفع هذا مسبقًا.',
    PROCESSING_IN_PROGRESS: 'تجري معالجة هذه المكالمة بالفعل.',
    UPLOAD_FAILED: 'تعذر حفظ الملف الصوتي. تحقق من صلاحيات التخزين المحلي.',
    FILE_TOO_LARGE: 'يجب ألا يتجاوز حجم التسجيل الصوتي 100 ميغابايت.',
    FIRESTORE_FAILED: 'تعذر حفظ بيانات المكالمة. تمت إزالة الملف المرفوع.',
    DELETE_FAILED: 'تعذر حذف المكالمة بالكامل. تواصل مع المسؤول.',
    RETRY_FAILED: 'ملف التسجيل مفقود أو تعذرت إعادة معالجته.',
    SERVER_ERROR: 'تعذر على الخادم إكمال الطلب.',
    PROCESSING_FAILED: 'فشلت معالجة المكالمة. التسجيل محفوظ ويمكن إعادة المحاولة.',
    DEEPGRAM_NOT_CONFIGURED: 'لم يتم إعداد خدمة تحويل الكلام إلى نص على الخادم.',
    DEEPGRAM_REQUEST_FAILED: 'فشل تحويل التسجيل إلى نص. التسجيل محفوظ ويمكن إعادة المحاولة.',
    DEEPGRAM_EMPTY_TRANSCRIPT: 'لم يتم إرجاع نص. تحقق من التسجيل ثم أعد المحاولة.',
    GROQ_NOT_CONFIGURED: 'لم يتم إعداد خدمة تحليل الذكاء الاصطناعي على الخادم.',
    GROQ_REQUEST_FAILED: 'فشل تحليل الذكاء الاصطناعي. النص والتسجيل محفوظان لإعادة المحاولة.',
    GROQ_INVALID_RESPONSE: 'أعاد تحليل الذكاء الاصطناعي نتيجة غير صالحة. يمكن إعادة المحاولة.',
    GROQ_TRANSCRIPT_TOO_LONG: 'النص أطول من الحد المسموح للتحليل ويحتاج إلى تسجيل أقصر.',
  },
};

export function publicMessage(code, language = 'en') {
  const locale = language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  return messages[locale][code] || messages[locale].SERVER_ERROR;
}
