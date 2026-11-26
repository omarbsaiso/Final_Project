import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  backendRoot,
  port: positiveNumber(process.env.PORT, 3001),
  projectId: process.env.FIREBASE_PROJECT_ID?.trim() || '',
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  frontendOrigins: (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  sttProvider: (process.env.STT_PROVIDER || 'deepgram').toLowerCase(),
  sttApiKey: process.env.STT_API_KEY || '',
  deepgramModel: process.env.DEEPGRAM_MODEL || 'nova-3',
  sttTimeoutMs: positiveNumber(process.env.STT_TIMEOUT_MS, 180000),
  llmProvider: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
  llmTimeoutMs: positiveNumber(process.env.LLM_TIMEOUT_MS, 120000),
  audioDir: path.join(backendRoot, 'uploads', 'audio'),
};
