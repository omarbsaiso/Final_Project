import { qaCriteria, transcript } from '../data/demoData';

const sampleKeywords = ['Plan upgrade', 'Data sharing', 'Billing date', 'Product fit', 'Positive resolution'];

export function getCallAnalysis(call) {
  if (call.analysisSource === 'sample') {
    return {
      source: 'sample',
      summary: call.summary,
      fullTranscript: '',
      transcript,
      criteria: qaCriteria,
      keywords: sampleKeywords,
      sentiment: call.sentiment,
      score: call.score,
      sentimentConfidence: 91,
      topic: call.topic,
      category: 'تعديل باقة وخدمة عملاء',
      mainIssue: 'اختيار باقة مناسبة',
      satisfactionIndicators: ['حل الطلب في تفاعل واحد'],
      agentStrengths: [],
      agentWeaknesses: [],
      compliance: '',
      recommendations: [],
    };
  }
  if (call.analysisSource === 'sample-summary') {
    return {
      source: 'sample-summary',
      summary: call.summary,
      fullTranscript: '',
      transcript: [],
      criteria: [],
      keywords: [],
      sentiment: call.sentiment,
      score: call.score,
      sentimentConfidence: null,
      topic: call.topic,
      category: '',
      mainIssue: '',
      satisfactionIndicators: [],
      agentStrengths: [],
      agentWeaknesses: [],
      compliance: '',
      recommendations: [],
    };
  }

  const analysis = call.analysis || {};
  const score = Number.isFinite(analysis.score)
    ? analysis.score
    : Number.isFinite(analysis.qualityScore)
      ? analysis.qualityScore
      : Number.isFinite(call.score) ? call.score : null;
  return {
    source: analysis.source || (call.processingStatus === 'failed' ? 'failed' : 'pending'),
    summary: analysis.summary || call.summary || '',
    fullTranscript: analysis.fullTranscript || '',
    transcript: Array.isArray(analysis.transcript) ? analysis.transcript : [],
    criteria: Array.isArray(analysis.criteria) ? analysis.criteria : [],
    keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
    sentiment: analysis.sentiment || call.sentiment || 'قيد المعالجة',
    score,
    sentimentConfidence: analysis.sentimentConfidence || null,
    topic: analysis.topic || call.topic || 'الموضوع غير متوفر',
    category: analysis.category || 'غير متوفر',
    mainIssue: analysis.mainIssue || 'لا يمكن الاستدلال من النص المتوفر',
    satisfactionIndicators: Array.isArray(analysis.satisfactionIndicators) ? analysis.satisfactionIndicators : [],
    agentStrengths: Array.isArray(analysis.agentStrengths) ? analysis.agentStrengths : [],
    agentWeaknesses: Array.isArray(analysis.agentWeaknesses) ? analysis.agentWeaknesses : [],
    compliance: analysis.compliance || 'لا يمكن الاستدلال من النص المتوفر',
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
  };
}
