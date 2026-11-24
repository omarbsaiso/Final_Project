import { qaCriteria, transcript } from '../data/demoData';

const sampleKeywords = ['Plan upgrade', 'Data sharing', 'Billing date', 'Product fit', 'Positive resolution'];

export function getCallAnalysis(call) {
  if (call.analysisSource === 'sample') {
    return {
      source: 'sample',
      summary: call.summary,
      transcript,
      criteria: qaCriteria,
      keywords: sampleKeywords,
      sentiment: call.sentiment,
      score: call.score,
      sentimentConfidence: 91,
    };
  }
  if (call.analysisSource === 'sample-summary') {
    return {
      source: 'sample-summary',
      summary: call.summary,
      transcript: [],
      criteria: [],
      keywords: [],
      sentiment: call.sentiment,
      score: call.score,
      sentimentConfidence: null,
    };
  }

  const analysis = call.analysis || {};
  return {
    source: analysis.source || 'pending',
    summary: analysis.summary || call.summary || '',
    transcript: analysis.transcript || [],
    criteria: analysis.criteria || [],
    keywords: analysis.keywords || [],
    sentiment: analysis.sentiment || call.sentiment || 'Pending',
    score: Number.isFinite(analysis.score) ? analysis.score : Number.isFinite(call.score) ? call.score : null,
    sentimentConfidence: analysis.sentimentConfidence || null,
  };
}
