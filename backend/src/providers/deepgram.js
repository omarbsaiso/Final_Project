import fs from 'node:fs';
import { config } from '../config.js';
import { ProviderError } from '../errors.js';

function speakerLabel(value) {
  return Number.isInteger(value) ? `Speaker ${value + 1}` : null;
}

function formatSegments(utterances, words, transcript) {
  if (Array.isArray(utterances) && utterances.length) {
    return utterances.map((utterance) => ({
      start: Number.isFinite(utterance.start) ? utterance.start : null,
      end: Number.isFinite(utterance.end) ? utterance.end : null,
      speaker: speakerLabel(utterance.speaker),
      text: typeof utterance.transcript === 'string' ? utterance.transcript : '',
    })).filter((segment) => segment.text);
  }

  if (Array.isArray(words) && words.length) {
    const segments = [];
    for (const word of words) {
      if (typeof word.punctuated_word !== 'string' && typeof word.word !== 'string') continue;
      const speaker = speakerLabel(word.speaker);
      const text = word.punctuated_word || word.word;
      const current = segments.at(-1);
      if (current && current.speaker === speaker) {
        current.text += ` ${text}`;
        if (Number.isFinite(word.end)) current.end = word.end;
      } else {
        segments.push({
          start: Number.isFinite(word.start) ? word.start : null,
          end: Number.isFinite(word.end) ? word.end : null,
          speaker,
          text,
        });
      }
    }
    return segments;
  }
  return transcript ? [{ start: null, end: null, speaker: null, text: transcript }] : [];
}

export async function transcribeAudio(filePath, mimeType) {
  if (config.sttProvider !== 'deepgram' || !config.sttApiKey) {
    throw new ProviderError('transcription', 'DEEPGRAM_NOT_CONFIGURED');
  }

  const query = new URLSearchParams({
    model: config.deepgramModel,
    language: 'ar',
    punctuate: 'true',
    diarize: 'true',
    utterances: 'true',
    smart_format: 'true',
  });
  let response;
  try {
    response = await fetch(`https://api.deepgram.com/v1/listen?${query}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.sttApiKey}`,
        'Content-Type': mimeType,
      },
      body: fs.createReadStream(filePath),
      duplex: 'half',
      signal: AbortSignal.timeout(config.sttTimeoutMs),
    });
  } catch {
    throw new ProviderError('transcription', 'DEEPGRAM_REQUEST_FAILED');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new ProviderError('transcription', 'DEEPGRAM_REQUEST_FAILED');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderError('transcription', 'DEEPGRAM_REQUEST_FAILED');
  }
  const channel = payload?.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const transcript = typeof alternative?.transcript === 'string' ? alternative.transcript.trim() : '';
  if (!transcript) throw new ProviderError('transcription', 'DEEPGRAM_EMPTY_TRANSCRIPT');

  const utterances = payload.results.utterances;
  const segments = formatSegments(utterances, alternative.words, transcript);
  const speakers = [...new Set(segments.map((segment) => segment.speaker).filter(Boolean))];
  return {
    transcript,
    segments,
    speakers,
    duration: Number.isFinite(payload.metadata?.duration) ? payload.metadata.duration : null,
  };
}
