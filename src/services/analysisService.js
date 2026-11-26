function formatTranscriptTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function getCallAnalysis(call) {
  const analysis = call.analysis && typeof call.analysis === 'object' ? call.analysis : {};
  const sourceSegments = Array.isArray(call.transcriptSegments)
    ? call.transcriptSegments
    : Array.isArray(analysis.transcriptSegments) ? analysis.transcriptSegments : [];
  const transcript = sourceSegments.map((segment, index) => ({
    id: `${segment.start ?? 'time'}-${index}`,
    time: formatTranscriptTime(segment.start),
    speaker: segment.speaker || '',
    text: typeof segment.text === 'string' ? segment.text : '',
  })).filter((segment) => segment.text);

  if (!transcript.length && typeof call.transcript === 'string' && call.transcript.trim()) {
    transcript.push({ id: 'full-transcript', time: '—', speaker: '', text: call.transcript });
  }

  return {
    summary: analysis.summary || call.summary || '',
    transcript,
    keywords: Array.isArray(analysis.keywords) ? analysis.keywords : call.keywords || [],
    sentiment: analysis.sentiment || call.sentiment || '',
    score: Number.isFinite(analysis.qaScore)
      ? analysis.qaScore
      : Number.isFinite(call.qaScore) ? call.qaScore
        : Number.isFinite(call.score) ? call.score : null,
    customerSatisfaction: Number.isFinite(analysis.customerSatisfaction)
      ? analysis.customerSatisfaction
      : Number.isFinite(call.customerSatisfaction) ? call.customerSatisfaction : null,
    customerIssues: analysis.customerIssues || call.customerIssues || [],
    agentPerformance: analysis.agentPerformance || call.agentPerformance || '',
    strengths: analysis.strengths || call.strengths || [],
    improvements: analysis.improvements || call.improvements || [],
    recommendations: analysis.recommendations || call.recommendations || [],
    criticalAlerts: analysis.criticalAlerts || call.criticalAlerts || [],
    callOutcome: analysis.callOutcome || call.callOutcome || '',
  };
}
