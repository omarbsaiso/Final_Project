import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createApp } from '../src/server.js';
import { PRIVATE_ADMIN_UID } from '../src/auth.js';
import { ProviderError } from '../src/errors.js';

const adminToken = 'test-admin-token';
const agentToken = 'test-agent-token';
const adminProfile = {
  uid: PRIVATE_ADMIN_UID,
  fullName: 'Private Admin',
  role: 'admin',
  isActive: true,
  isDemo: true,
  team: 'Customer Care',
};
const agentProfile = {
  uid: 'agent-test-uid',
  fullName: 'Test Agent',
  role: 'Agent',
  isActive: true,
  team: 'Customer Care',
};

class MemoryDocumentReference {
  constructor(database, collectionName, id) {
    this.database = database;
    this.collectionName = collectionName;
    this.id = id;
  }

  get collection() {
    return this.database.getCollection(this.collectionName);
  }

  async get() {
    const data = this.collection.get(this.id);
    return { exists: Boolean(data), id: this.id, ref: this, data: () => data };
  }

  create(data) {
    if (this.collection.has(this.id)) throw new Error('already-exists');
    this.collection.set(this.id, data);
  }

  async update(updates) {
    const current = this.collection.get(this.id);
    if (!current) throw new Error('not-found');
    this.collection.set(this.id, { ...current, ...updates });
  }

  async delete() {
    this.collection.delete(this.id);
  }
}

class MemoryQuery {
  constructor(collection, filter = null) {
    this.collection = collection;
    this.filter = filter;
  }

  where(field, operator, value) {
    assert.equal(operator, '==');
    return new MemoryQuery(this.collection, { field, value });
  }

  async get() {
    const entries = [...this.collection.database.getCollection(this.collection.name).entries()]
      .filter(([, data]) => !this.filter || data[this.filter.field] === this.filter.value);
    return {
      docs: entries.map(([id, data]) => ({
        id,
        ref: this.collection.doc(id),
        exists: true,
        data: () => data,
      })),
    };
  }
}

class MemoryCollection extends MemoryQuery {
  constructor(database, name) {
    super({ database, name });
    this.database = database;
    this.name = name;
  }

  doc(id = randomUUID()) {
    return new MemoryDocumentReference(this.database, this.name, id);
  }
}

class MemoryFirestore {
  constructor() {
    this.collections = new Map([
      ['users', new Map([[adminProfile.uid, adminProfile], [agentProfile.uid, agentProfile]])],
      ['calls', new Map()],
      ['feedback', new Map()],
    ]);
  }

  getCollection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  collection(name) {
    return new MemoryCollection(this, name);
  }

  async runTransaction(work) {
    return work({
      get: (reference) => reference.get(),
      create: (reference, data) => reference.create(data),
    });
  }

  batch() {
    const operations = [];
    return {
      delete: (reference) => operations.push(reference),
      commit: async () => Promise.all(operations.map((reference) => reference.delete())),
    };
  }
}

let server;
let apiBase;
let audioDir;
let firestore;
let failNextAnalysis = false;

before(async () => {
  audioDir = await fs.mkdtemp(path.join(os.tmpdir(), 'call-miner-api-'));
  firestore = new MemoryFirestore();
  const auth = {
    async verifyIdToken(token) {
      if (token === adminToken) return { uid: adminProfile.uid, email: 'admin@example.test' };
      if (token === agentToken) return { uid: agentProfile.uid, email: 'agent@example.test' };
      throw new Error('invalid-token');
    },
  };
  const app = createApp({
    auth,
    db: firestore,
    fieldValue: { serverTimestamp: () => new Date().toISOString() },
    audioDir,
    frontendOrigins: ['http://localhost:5173'],
    transcribe: async (filePath) => {
      assert.equal((await fs.readFile(filePath, 'utf8')), 'test audio bytes');
      return {
        transcript: 'مرحبًا، أحتاج مساعدة في الفاتورة.',
        segments: [{ start: 0, end: 3, speaker: 'Speaker 1', text: 'مرحبًا، أحتاج مساعدة في الفاتورة.' }],
        speakers: ['Speaker 1'],
        duration: 3,
      };
    },
    analyze: async () => {
      if (failNextAnalysis) {
        failNextAnalysis = false;
        throw new ProviderError('analysis', 'GROQ_REQUEST_FAILED');
      }
      return {
        summary: 'طلب العميل مساعدة بخصوص الفاتورة.',
        sentiment: 'neutral',
        customerSatisfaction: 55,
        qaScore: 80,
        keywords: ['الفاتورة'],
        customerIssues: ['استفسار عن الفاتورة'],
        agentPerformance: 'الأدلة المتاحة محدودة.',
        strengths: [],
        improvements: ['توضيح تفاصيل الفاتورة.'],
        recommendations: ['التأكد من فهم سؤال العميل.'],
        criticalAlerts: [],
        callOutcome: 'follow-up required',
      };
    },
    logger: { error() {} },
  });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  apiBase = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (audioDir) await fs.rm(audioDir, { recursive: true, force: true });
});

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

function audioForm(filename = 'call.mp3', mimeType = 'audio/mpeg') {
  const form = new FormData();
  form.append('audio', new Blob(['test audio bytes'], { type: mimeType }), filename);
  form.append('topic', 'فاتورة العميل');
  return form;
}

async function waitForCall(callId, predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const snapshot = await firestore.collection('calls').doc(callId).get();
    if (snapshot.exists && predicate(snapshot.data())) return snapshot.data();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('Call processing did not reach the expected state.');
}

test('requires a valid Firebase token and Admin profile before upload', async () => {
  const missingToken = await fetch(`${apiBase}/api/calls/upload`, { method: 'POST' });
  assert.equal(missingToken.status, 401);

  const nonAdmin = await fetch(`${apiBase}/api/calls/upload`, {
    method: 'POST',
    headers: authHeaders(agentToken, { 'Idempotency-Key': randomUUID() }),
    body: audioForm(),
  });
  assert.equal(nonAdmin.status, 403);
  assert.equal((await fs.readdir(audioDir)).length, 0);
});

test('uploads once, persists real-shaped processing data, and serves audio only to authorized users', async () => {
  const callId = randomUUID();
  const response = await fetch(`${apiBase}/api/calls/upload`, {
    method: 'POST',
    headers: authHeaders(adminToken, { 'Idempotency-Key': callId, 'Accept-Language': 'ar' }),
    body: audioForm('../recording.mp3'),
  });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { callId, processingStatus: 'processing' });

  const call = await waitForCall(callId, (value) => value.processingStatus === 'completed');
  assert.equal(call.originalFilename, 'recording.mp3');
  assert.match(call.localFilename, /^[0-9a-f-]{36}\.mp3$/i);
  assert.equal(call.transcript, 'مرحبًا، أحتاج مساعدة في الفاتورة.');
  assert.equal(call.analysis.qaScore, 80);
  assert.equal(call.fileSize, Buffer.byteLength('test audio bytes'));
  assert.equal((await fs.readFile(path.join(audioDir, call.localFilename), 'utf8')), 'test audio bytes');

  const duplicate = await fetch(`${apiBase}/api/calls/upload`, {
    method: 'POST',
    headers: authHeaders(adminToken, { 'Idempotency-Key': callId }),
    body: audioForm(),
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await fs.readdir(audioDir)).length, 1);

  const forbiddenAudio = await fetch(`${apiBase}/api/calls/${callId}/audio`, {
    headers: authHeaders(agentToken),
  });
  assert.equal(forbiddenAudio.status, 403);
  assert.equal((await forbiddenAudio.json()).error.code, 'CALL_ACCESS_DENIED');

  const permittedAudio = await fetch(`${apiBase}/api/calls/${callId}/audio`, {
    headers: authHeaders(adminToken),
  });
  assert.equal(permittedAudio.status, 200);
  assert.equal(await permittedAudio.text(), 'test audio bytes');
});

test('rejects mismatched MIME types and removes audio and metadata on Admin deletion', async () => {
  const invalid = await fetch(`${apiBase}/api/calls/upload`, {
    method: 'POST',
    headers: authHeaders(adminToken, { 'Idempotency-Key': randomUUID() }),
    body: audioForm('bad.mp3', 'text/plain'),
  });
  assert.equal(invalid.status, 415);

  const callId = [...firestore.getCollection('calls').keys()][0];
  const deleted = await fetch(`${apiBase}/api/calls/${callId}`, {
    method: 'DELETE',
    headers: authHeaders(adminToken),
  });
  assert.equal(deleted.status, 200);
  assert.equal((await firestore.collection('calls').doc(callId).get()).exists, false);
  assert.equal((await fs.readdir(audioDir)).length, 0);
});

test('preserves audio after analysis failure and retries processing without another upload', async () => {
  const callId = randomUUID();
  failNextAnalysis = true;
  const response = await fetch(`${apiBase}/api/calls/upload`, {
    method: 'POST',
    headers: authHeaders(adminToken, { 'Idempotency-Key': callId }),
    body: audioForm(),
  });
  assert.equal(response.status, 202);

  const failedCall = await waitForCall(callId, (value) => value.processingStatus === 'failed');
  assert.equal(failedCall.transcriptionStatus, 'completed');
  assert.equal(failedCall.analysisStatus, 'failed');
  assert.equal(failedCall.processingError.code, 'GROQ_REQUEST_FAILED');
  assert.equal((await fs.readFile(path.join(audioDir, failedCall.localFilename), 'utf8')), 'test audio bytes');

  const retryResponse = await fetch(`${apiBase}/api/calls/${callId}/retry`, {
    method: 'POST',
    headers: authHeaders(adminToken),
  });
  assert.equal(retryResponse.status, 202);
  const completedCall = await waitForCall(callId, (value) => value.processingStatus === 'completed');
  assert.equal(completedCall.transcript, 'مرحبًا، أحتاج مساعدة في الفاتورة.');

  const deleted = await fetch(`${apiBase}/api/calls/${callId}`, {
    method: 'DELETE',
    headers: authHeaders(adminToken),
  });
  assert.equal(deleted.status, 200);
  assert.equal((await fs.readdir(audioDir)).length, 0);
});
