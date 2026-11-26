import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { initializeFirebaseAdmin } from './firebaseAdmin.js';
import { createAuthenticate, canReadCall, requireAdmin } from './auth.js';
import { createAudioUploader, resolveStoredAudio, safeOriginalFilename } from './audio.js';
import { ApiError, ProviderError, publicMessage } from './errors.js';
import { transcribeAudio } from './providers/deepgram.js';
import { analyzeTranscript } from './providers/groq.js';

const serverFile = fileURLToPath(import.meta.url);
const audioMimeTypes = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mpeg-3',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/webm', 'video/webm',
]);

function requestLanguage(req) {
  return (req.get('accept-language') || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function sendError(req, res, status, code) {
  return res.status(status).json({
    error: { code, message: publicMessage(code, requestLanguage(req)) },
  });
}

function sanitizeTopic(value, originalFilename) {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
  return path.parse(originalFilename).name.slice(0, 160) || 'مكالمة جديدة';
}

function toSentimentLabel(sentiment) {
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}

function timestamp(fieldValue) {
  return fieldValue.serverTimestamp();
}

function errorCode(error) {
  return error?.code || error?.name || 'UnknownError';
}

function processingError(error, stage) {
  if (error instanceof ProviderError) {
    return { code: error.code, stage: error.stage };
  }
  return { code: 'PROCESSING_FAILED', stage };
}

async function removeFile(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function deleteCallAndFeedback(db, callRef) {
  const feedback = await db.collection('feedback').where('callId', '==', callRef.id).get();
  const references = [...feedback.docs.map((document) => document.ref), callRef];
  for (let offset = 0; offset < references.length; offset += 450) {
    const batch = db.batch();
    references.slice(offset, offset + 450).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export function createApp({
  auth,
  db,
  fieldValue,
  audioDir = config.audioDir,
  frontendOrigins = config.frontendOrigins,
  transcribe = transcribeAudio,
  analyze = analyzeTranscript,
  logger = console,
}) {
  if (!auth || !db || !fieldValue) throw new Error('Firebase Admin dependencies are required.');

  fs.mkdirSync(audioDir, { recursive: true });
  const app = express();
  const authenticate = createAuthenticate(auth, db);
  const upload = createAudioUploader(audioDir);
  const allowedOrigins = new Set(frontendOrigins);
  console.log('[CORS] Allowed origins:', [...allowedOrigins]);

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, Accept-Language');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    } else if (origin) {
      return sendError(req, res, 403, 'ORIGIN_NOT_ALLOWED');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  async function runAnalysis(callId) {
    const callRef = db.collection('calls').doc(callId);
    let stage = 'transcription';
    try {
      const current = await callRef.get();
      if (!current.exists) return;
      const call = current.data();
      const filePath = resolveStoredAudio(audioDir, call.localFilename);
      if (!filePath || !fs.existsSync(filePath)) {
        throw new ProviderError('transcription', 'AUDIO_NOT_FOUND');
      }

      const transcription = await transcribe(filePath, call.mimeType);
      await callRef.update({
        transcript: transcription.transcript,
        transcriptSegments: transcription.segments,
        speakerInformation: transcription.speakers,
        duration: transcription.duration,
        transcriptionStatus: 'completed',
        analysisStatus: 'processing',
        updatedAt: timestamp(fieldValue),
      });

      stage = 'analysis';
      const analysis = await analyze(transcription.transcript, transcription.segments);
      await callRef.update({
        analysis,
        summary: analysis.summary,
        sentiment: toSentimentLabel(analysis.sentiment),
        score: analysis.qaScore,
        qaScore: analysis.qaScore,
        customerSatisfaction: analysis.customerSatisfaction,
        keywords: analysis.keywords,
        customerIssues: analysis.customerIssues,
        agentPerformance: analysis.agentPerformance,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        recommendations: analysis.recommendations,
        criticalAlerts: analysis.criticalAlerts,
        callOutcome: analysis.callOutcome,
        analysisStatus: 'completed',
        processingStatus: 'completed',
        processingError: null,
        status: 'Needs review',
        updatedAt: timestamp(fieldValue),
      });
    } catch (error) {
      const failure = processingError(error, stage);
      logger.error('[Processing] Call analysis failed', { callId, code: failure.code, stage: failure.stage });
      try {
        const current = await callRef.get();
        if (!current.exists) return;
        const currentCall = current.data();
        await callRef.update({
          processingStatus: 'failed',
          transcriptionStatus: stage === 'transcription' ? 'failed' : currentCall.transcriptionStatus,
          analysisStatus: stage === 'analysis' ? 'failed' : currentCall.analysisStatus,
          processingError: failure,
          status: 'Needs review',
          updatedAt: timestamp(fieldValue),
        });
      } catch (updateError) {
        logger.error('[Processing] Could not persist failure state', { callId, code: errorCode(updateError) });
      }
    }
  }

  app.post(
    '/api/calls/upload',
    authenticate,
    requireAdmin,
    (req, res, next) => {
      const requestId = req.get('idempotency-key') || '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        return next(new ApiError(400, 'UPLOAD_ID_REQUIRED'));
      }
      req.uploadId = requestId;
      return next();
    },
    upload.single('audio'),
    async (req, res, next) => {
      if (!req.file) return next(new ApiError(400, 'AUDIO_REQUIRED'));

      const originalFilename = safeOriginalFilename(req.file.originalname);
      const callRef = db.collection('calls').doc(req.uploadId);
      const topic = sanitizeTopic(req.body?.topic, originalFilename);
      const call = {
        id: req.uploadId,
        originalFilename,
        localFilename: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: timestamp(fieldValue),
        uploadedBy: req.user.uid,
        uploadedByName: req.user.fullName,
        createdAt: timestamp(fieldValue),
        date: timestamp(fieldValue),
        customer: 'Unknown customer',
        customerInitials: '??',
        agent: req.user.fullName || req.user.email,
        agentId: req.user.uid,
        team: req.user.team,
        topic,
        duration: null,
        channel: 'Inbound',
        sentiment: 'Pending',
        score: null,
        qaScore: null,
        customerSatisfaction: null,
        status: 'Processing',
        processingStatus: 'processing',
        transcriptionStatus: 'queued',
        analysisStatus: 'queued',
        processingError: null,
        transcript: '',
        transcriptSegments: [],
        speakerInformation: [],
        analysis: null,
        summary: '',
        keywords: [],
        customerIssues: [],
        agentPerformance: '',
        strengths: [],
        improvements: [],
        recommendations: [],
        criticalAlerts: [],
        callOutcome: 'pending',
        recordingAvailable: true,
      };

      try {
        await db.runTransaction(async (transaction) => {
          const existing = await transaction.get(callRef);
          if (existing.exists) throw new ApiError(409, 'DUPLICATE_UPLOAD');
          transaction.create(callRef, call);
        });
      } catch (error) {
        try {
          await removeFile(req.file.path);
        } catch (cleanupError) {
          logger.error('[Upload] Could not remove an unlinked file', { code: errorCode(cleanupError) });
        }
        return next(error instanceof ApiError ? error : new ApiError(500, 'FIRESTORE_FAILED'));
      }

      setImmediate(() => { void runAnalysis(req.uploadId); });
      return res.status(202).json({ callId: req.uploadId, processingStatus: 'processing' });
    },
  );

  app.get('/api/calls/:callId/audio', authenticate, async (req, res, next) => {
    try {
      const callRef = db.collection('calls').doc(req.params.callId);
      const snapshot = await callRef.get();
      if (!snapshot.exists) throw new ApiError(404, 'CALL_NOT_FOUND');
      const call = snapshot.data();
      if (!canReadCall(req.user, call)) throw new ApiError(403, 'CALL_ACCESS_DENIED');
      const filePath = resolveStoredAudio(audioDir, call.localFilename);
      if (!filePath || !fs.existsSync(filePath)) throw new ApiError(404, 'AUDIO_NOT_FOUND');

      const originalName = encodeURIComponent(call.originalFilename || 'recording');
      res.set({
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename*=UTF-8''${originalName}`,
        'Content-Type': audioMimeTypes.has(call.mimeType) ? call.mimeType : 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) next(new ApiError(404, 'AUDIO_NOT_FOUND'));
      });
    } catch (error) {
      return next(error instanceof ApiError ? error : new ApiError(500, 'SERVER_ERROR'));
    }
  });

  app.post('/api/calls/:callId/retry', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const callRef = db.collection('calls').doc(req.params.callId);
      const snapshot = await callRef.get();
      if (!snapshot.exists) throw new ApiError(404, 'CALL_NOT_FOUND');
      const call = snapshot.data();
      if (call.processingStatus === 'processing') throw new ApiError(409, 'PROCESSING_IN_PROGRESS');
      const filePath = resolveStoredAudio(audioDir, call.localFilename);
      if (!filePath || !fs.existsSync(filePath)) throw new ApiError(404, 'RETRY_FAILED');

      await callRef.update({
        processingStatus: 'processing',
        transcriptionStatus: 'queued',
        analysisStatus: 'queued',
        processingError: null,
        status: 'Processing',
        updatedAt: timestamp(fieldValue),
      });
      setImmediate(() => { void runAnalysis(req.params.callId); });
      return res.status(202).json({ callId: req.params.callId, processingStatus: 'processing' });
    } catch (error) {
      return next(error instanceof ApiError ? error : new ApiError(500, 'RETRY_FAILED'));
    }
  });

  app.delete('/api/calls/:callId', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const callRef = db.collection('calls').doc(req.params.callId);
      const snapshot = await callRef.get();
      if (!snapshot.exists) throw new ApiError(404, 'CALL_NOT_FOUND');
      const call = snapshot.data();
      await deleteCallAndFeedback(db, callRef);
      const filePath = resolveStoredAudio(audioDir, call.localFilename);
      if (filePath) await removeFile(filePath);
      return res.json({ callId: req.params.callId, deleted: true });
    } catch (error) {
      return next(error instanceof ApiError ? error : new ApiError(500, 'DELETE_FAILED'));
    }
  });

  app.use((req, res, next) => next(new ApiError(404, 'CALL_NOT_FOUND')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ApiError) return sendError(req, res, error.status, error.code);
    if (error?.code === 'LIMIT_FILE_SIZE') return sendError(req, res, 413, 'FILE_TOO_LARGE');
    if (error?.code === 'LIMIT_UNEXPECTED_FILE' || error?.code === 'LIMIT_FILE_COUNT') {
      return sendError(req, res, 400, 'AUDIO_REQUIRED');
    }
    if (['EACCES', 'ENOSPC', 'EROFS', 'EIO'].includes(error?.code)) {
      logger.error('[API] Local audio storage failed', { code: error.code });
      return sendError(req, res, 500, 'UPLOAD_FAILED');
    }
    logger.error('[API] Request failed', { code: errorCode(error) });
    return sendError(req, res, 500, 'SERVER_ERROR');
  });

  return app;
}

export function startServer() {
  const firebase = initializeFirebaseAdmin();
  const app = createApp(firebase);
  return app.listen(config.port, () => {
    console.info(`[API] Listening on port ${config.port}`);
  });
}

if (path.resolve(process.argv[1] || '') === serverFile) {
  try {
    startServer();
  } catch (error) {
    console.error('[Startup] Backend could not start', { code: errorCode(error) });
    process.exitCode = 1;
  }
}
