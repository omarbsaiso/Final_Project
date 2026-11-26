import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3001),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
  sttProvider: (process.env.STT_PROVIDER || 'deepgram').toLowerCase(),
  sttApiKey: process.env.STT_API_KEY || '',
  llmProvider: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
  maxFileBytes: Number(process.env.MAX_AUDIO_BYTES || 100 * 1024 * 1024),
};

export function getConfigStatus() {
  return {
    sttProvider: config.sttProvider,
    sttConfigured: Boolean(config.sttApiKey),
    llmProvider: config.llmProvider,
    llmModel: config.llmModel,
    llmConfigured: Boolean(config.llmApiKey),
    firebaseConfigured: Boolean(config.firebaseProjectId),
  };
}

export function validateProviderConfig() {
  const missing = [];
  if (!config.firebaseProjectId) missing.push('FIREBASE_PROJECT_ID');
  if (!config.sttApiKey) missing.push('STT_API_KEY');
  if (!config.llmApiKey) missing.push('LLM_API_KEY');
  if (missing.length) {
    const error = new Error(`Missing backend configuration: ${missing.join(', ')}`);
    error.code = 'CONFIGURATION_ERROR';
    throw error;
  }
}
