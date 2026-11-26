import { config } from '../config.js';

async function deepgramTranscribe(filePath, mimeType) {
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(filePath);
  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_MODEL || 'nova-3',
    detect_language: 'true',
    diarize: 'true',
    punctuate: 'true',
    smart_format: 'true',
  });
  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${config.sttApiKey}`, 'Content-Type': mimeType },
    body: buffer,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.err_msg || payload.message || 'Deepgram transcription failed.');

  const channel = payload.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const text = alternative?.transcript?.trim();
  if (!text) throw new Error('The provider returned an empty transcript.');
  const utterances = payload.results?.utterances || payload.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
  const lines = utterances.map((item) => {
    if (item.sentences) {
      return item.sentences.map((sentence) => ({
        time: formatTime(sentence.start),
        speaker: 'متحدث',
        text: sentence.text,
      }));
    }
    return [{ time: formatTime(item.start), speaker: item.speaker ? `متحدث ${item.speaker}` : 'متحدث', text: item.text || item.transcript || '' }];
  }).flat().filter((line) => line.text);

  return {
    text,
    transcript: lines.length ? lines : [{ time: '00:00', speaker: 'المحادثة', text }],
    language: payload.results?.channels?.[0]?.detected_language || payload.metadata?.detected_language || 'ar',
    duration: payload.metadata?.duration || null,
    providerModel: process.env.DEEPGRAM_MODEL || 'nova-3',
  };
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function assemblyUpload(filePath, mimeType) {
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(filePath);
  const response = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: config.sttApiKey, 'content-type': mimeType },
    body: buffer,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'AssemblyAI audio upload failed.');
  return payload.upload_url;
}

async function assemblyTranscribe(filePath, mimeType) {
  const uploadUrl = await assemblyUpload(filePath, mimeType);
  const submit = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: config.sttApiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: uploadUrl,
      language_code: 'ar',
      punctuate: true,
      format_text: true,
      speaker_labels: true,
      speakers_expected: 2,
    }),
  });
  let result = await submit.json();
  if (!submit.ok) throw new Error(result.error || 'AssemblyAI transcription submission failed.');

  const deadline = Date.now() + Number(process.env.STT_TIMEOUT_MS || 900000);
  while (result.status === 'queued' || result.status === 'processing') {
    if (Date.now() > deadline) throw new Error('Speech-to-Text processing timed out.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${result.id}`, {
      headers: { authorization: config.sttApiKey },
    });
    result = await poll.json();
  }
  if (result.status === 'error') throw new Error(result.error || 'AssemblyAI transcription failed.');
  if (!result.text?.trim()) throw new Error('The provider returned an empty transcript.');
  const lines = (result.utterances || []).map((item) => ({
    time: formatTime(item.start / 1000),
    speaker: item.speaker ? `متحدث ${item.speaker}` : 'متحدث',
    text: item.text,
  }));
  return {
    text: result.text,
    transcript: lines.length ? lines : [{ time: '00:00', speaker: 'المحادثة', text: result.text }],
    language: result.language_code || 'ar',
    duration: result.audio_duration || null,
    providerModel: result.speech_model_used || 'assemblyai',
  };
}

export async function transcribeAudio(filePath, mimeType) {
  if (config.sttProvider === 'assemblyai') return assemblyTranscribe(filePath, mimeType);
  if (config.sttProvider === 'deepgram') return deepgramTranscribe(filePath, mimeType);
  throw new Error(`Unsupported STT_PROVIDER: ${config.sttProvider}`);
}
