import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ApiError } from './errors.js';

const audioTypesByExtension = {
  '.mp3': new Set(['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mpeg-3']),
  '.wav': new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']),
  '.m4a': new Set(['audio/mp4', 'audio/x-m4a', 'audio/m4a']),
  '.webm': new Set(['audio/webm', 'video/webm']),
};

export function createAudioUploader(audioDir) {
  fs.mkdirSync(audioDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, audioDir),
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 4, parts: 6 },
    fileFilter: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype.toLowerCase().split(';')[0];
      if (!audioTypesByExtension[extension]?.has(mimeType)) {
        callback(new ApiError(415, 'INVALID_AUDIO_FORMAT'));
        return;
      }
      callback(null, true);
    },
  });
}

export function safeOriginalFilename(value) {
  const baseName = path.posix.basename(String(value || '').replace(/\\/g, '/'));
  return baseName.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'audio recording';
}

export function resolveStoredAudio(audioDir, filename) {
  if (typeof filename !== 'string' || !/^[0-9a-f-]{36}\.(mp3|wav|m4a|webm)$/i.test(filename)) {
    return null;
  }
  const resolvedDir = path.resolve(audioDir);
  const resolvedFile = path.resolve(resolvedDir, filename);
  return resolvedFile.startsWith(`${resolvedDir}${path.sep}`) ? resolvedFile : null;
}
