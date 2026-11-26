import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, validateProviderConfig, getConfigStatus } from './config.js';
import { initializeFirebaseAdmin, verifyFirebaseUser } from './firebaseAdmin.js';
import { transcribeAudio } from './providers/sttProvider.js';
import { analyzeTranscript } from './providers/llmProvider.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const uploadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'call-miner-'));
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: config.maxFileBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowedMime = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'application/octet-stream'];
const allowedExt = /\.(mp3|wav|m4a)$/i;    if (!allowedExt.test(file.originalname) || !allowedMime.includes(file.mimetype)) {
      return callback(new Error('Unsupported audio format. Choose MP3, WAV, or M4A.'));
    }
    callback(null, true);
  },
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, ...getConfigStatus() });
});

app.get('/api/config', (_request, response) => {
  response.json(getConfigStatus());
});

async function authenticate(request, response, next) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return response.status(401).json({ error: 'Authentication required.' });
  try {
    const decoded = await verifyFirebaseUser(token);
    const { db } = initializeFirebaseAdmin();
    const profile = await db.collection('users').doc(decoded.uid).get();
    if (!profile.exists || profile.data().isActive !== true) {
      return response.status(403).json({ error: 'The authenticated user profile is inactive or unavailable.' });
    }
    request.auth = { uid: decoded.uid, ...profile.data() };
    next();
  } catch (error) {
    response.status(401).json({ error: 'The authentication token is invalid or expired.' });
  }
}

function canCreateCall(user, body) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Supervisor') return body.team === user.team;
  if (user.role === 'Agent') return body.agentId === user.uid;
  return false;
}

app.post('/api/calls/analyze', authenticate, upload.single('audio'), async (request, response) => {
  let tempPath = request.file?.path;
  try {
    validateProviderConfig();
    if (!request.file) return response.status(400).json({ error: 'No audio file was uploaded.' });
    if (request.file.size < 1024) return response.status(400).json({ error: 'The uploaded audio file is empty or corrupted.' });

    let body;
    try { body = JSON.parse(request.body.metadata || '{}'); } catch { body = {}; }
    const agentId = request.auth.uid;
    const team = request.auth.role === 'Agent' ? (body.team || request.auth.team || 'Customer Care') : (body.team || request.auth.team || 'Customer Care');
    const metadata = {
      topic: String(body.topic || 'مكالمة عملاء').trim().slice(0, 180),
      agentId,
      agent: String(body.agent || request.auth.fullName || request.auth.name || 'وكيل').slice(0, 120),
      team,
      customer: 'عميل جديد',
      customerInitials: 'عج',
      date: new Date().toISOString(),
      duration: '—',
      channel: 'Inbound',
      sentiment: 'قيد المعالجة',
      score: null,
    };

    if (!canCreateCall(request.auth, metadata)) {
      return response.status(403).json({ error: 'You are not authorized to create a call for this agent or team.' });
    }

    const { db } = initializeFirebaseAdmin();
    const callRef = db.collection('calls').doc();
    const now = new Date().toISOString();
    const callId = callRef.id;
    await callRef.set({
      ...metadata,
      status: 'Processing',
      processingStatus: 'processing',
      summary: 'المكالمة قيد المعالجة بالذكاء الاصطناعي.',
      recordingAvailable: false,
      analysisSource: 'real',
      aiProviders: { stt: config.sttProvider, llm: config.llmProvider, llmModel: config.llmModel },
      createdAt: now,
      updatedAt: now,
    });

    try {
      const transcription = await transcribeAudio(tempPath, request.file.mimetype);
      const analysis = await analyzeTranscript(transcription.text);
      const sentimentMap = { Positive: 'إيجابي', Neutral: 'محايد', Negative: 'سلبي' };
      const completedAt = new Date().toISOString();
      const duration = transcription.duration ? formatDuration(transcription.duration) : '—';
      const storedAnalysis = {
        source: 'real',
        fullTranscript: transcription.text,
        transcript: transcription.transcript,
        summary: analysis.summary,
        topic: analysis.topic,
        category: analysis.category,
        sentiment: analysis.customerSentiment,
        sentimentCode: analysis.customerSentimentCode,
        sentimentConfidence: null,
        mainIssue: analysis.mainIssue,
        satisfactionIndicators: analysis.satisfactionIndicators,
        qualityScore: analysis.qualityScore,
        score: analysis.qualityScore,
        agentStrengths: analysis.agentStrengths,
        agentWeaknesses: analysis.agentWeaknesses,
        compliance: analysis.compliance,
        recommendations: analysis.recommendations,
        criteria: analysis.criteria,
        keywords: analysis.keywords,
      };
      await callRef.set({
        status: 'Needs review',
        processingStatus: 'completed',
        sentiment: analysis.customerSentiment,
        score: analysis.qualityScore,
        topic: analysis.topic,
        summary: analysis.summary,
        duration,
        analysis: storedAnalysis,
        analysisSource: 'real',
        sttProvider: config.sttProvider,
        sttModel: transcription.providerModel,
        sttLanguage: transcription.language,
        llmProvider: config.llmProvider,
        llmModel: config.llmModel,
        completedAt,
        updatedAt: completedAt,
      }, { merge: true });

      return response.json({ ok: true, callId, status: 'completed', call: { id: callId, ...metadata, status: 'Needs review', processingStatus: 'completed', sentiment: analysis.customerSentiment, score: analysis.qualityScore, topic: analysis.topic, summary: analysis.summary, duration, analysis: storedAnalysis } });
    } catch (processingError) {
      const completedAt = new Date().toISOString();
      const safeMessage = sanitizeError(processingError);
      await callRef.set({
        status: 'Failed',
        processingStatus: 'failed',
        sentiment: 'غير متوفر',
        error: safeMessage,
        completedAt,
        updatedAt: completedAt,
      }, { merge: true }).catch(() => {});
      return response.status(502).json({ error: safeMessage, callId, status: 'failed' });
    }
  } catch (error) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    response.status(status).json({ error: sanitizeError(error) });
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => {});
  }
});

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function sanitizeError(error) {
  if (error?.code === 'CONFIGURATION_ERROR') return 'AI integration is not configured. Add the required server API keys.';
  const message = String(error?.message || 'Processing failed.');
  if (/api[_ -]?key|authorization|credential|secret|token/i.test(message)) return 'The AI provider rejected the server credentials.';
  if (/429|rate limit/i.test(message)) return 'تم تجاوز حد استخدام مزود الذكاء الاصطناعي. يرجى المحاولة لاحقًا.';
  if (/timeout|timed out/i.test(message)) return 'استغرق معالجة الملف وقتًا أطول من الحد المسموح.';
  return message.slice(0, 500);
}

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'حجم الملف يتجاوز الحد الأقصى 100 ميجابايت.' });
  }
  response.status(400).json({ error: sanitizeError(error) });
});

app.listen(config.port, () => {
  console.log(`Call Miner AI backend listening on port ${config.port}`);
});
