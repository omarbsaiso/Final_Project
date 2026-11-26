import { useEffect, useState } from 'react';
import { ArrowLeft, AudioLines, Check, Clock3, Download, Headphones, MessageSquareText, MoreHorizontal, Play, RotateCcw, Send, Sparkles, Star, Tag, ThumbsUp } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { getCallAnalysis } from '../services/analysisService';
import { getCall, listFeedback, saveFeedback } from '../services/dataService';
import { downloadCallRecording } from '../services/storageService';
import { formatDateTime } from '../utils/format';

export default function CallDetailsPage() {
  const { callId } = useParams();
  const { user } = useAuth();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioObjectUrl, setAudioObjectUrl] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [savedFeedback, setSavedFeedback] = useState('');
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    async function loadCall() {
      setLoading(true);
      setError('');
      setCall(null);
      setAudioObjectUrl('');
      try {
        const result = await getCall(callId, user);
        if (cancelled) return;
        setCall(result);
        if (!result) return;
        if (result.storagePath) {
          const audioBlob = await downloadCallRecording(result.storagePath);
          objectUrl = URL.createObjectURL(audioBlob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setAudioObjectUrl(objectUrl);
        }
        const entries = await listFeedback(callId, user);
        if (cancelled) return;
        setFeedbackEntries(entries);
        setSavedFeedback(entries.at(-1)?.message || result.feedback || '');
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not load this call.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCall();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId, user]);

  async function saveFeedback(event) {
    event.preventDefault();
    setFeedbackBusy(true);
    setError('');
    try {
      const saved = await saveFeedback(call, feedback, user);
      setFeedbackEntries((current) => [...current, saved]);
      setSavedFeedback(saved.message);
      setFeedback('');
      setCall({ ...call, status: 'Reviewed' });
    } catch (saveError) {
      setError(saveError.message || 'Could not save your feedback.');
    } finally {
      setFeedbackBusy(false);
    }
  }

  if (loading) return <div className="panel page-loading"><span className="spinner-border" /> Loading call details…</div>;
  if (!call) return <div className="page-enter"><Link to="/calls" className="back-link"><ArrowLeft size={16} />Back to calls</Link><div className="panel empty-details"><Headphones size={25} /><h2>Call not found</h2><p>This recording may have been removed or you may not have permission to view it.</p>{error && <span>{error}</span>}</div></div>;

  const analysis = getCallAnalysis(call);
  const score = analysis.score;
  const isSample = analysis.source.startsWith('sample');
  const hasDetailedSample = analysis.source === 'sample';
  const caller = call.customer || 'New customer';
  const playableAudioUrl = audioObjectUrl || call.audioUrl;
  return (
    <div className="page-enter call-detail-page">
      <div className="detail-topline"><Link to="/calls" className="back-link"><ArrowLeft size={16} />Back to calls</Link><button className="btn btn-outline-custom" onClick={() => window.print()}><Download size={16} />Export review</button></div>
      <div className="detail-heading"><div><div className="eyebrow-label">CALL REVIEW <span className="eyebrow-dot" /> {call.id}</div><h1>{call.topic || 'Customer conversation'}</h1><p>{caller} <span>·</span> {call.agent} <span>·</span> {formatDateTime(call.date || call.createdAt)}</p></div><StatusBadge>{call.status}</StatusBadge></div>
      {isSample && <div className="sample-analysis-banner"><Sparkles size={16} /><span><strong>Sample analysis</strong> — Transcript, summary, sentiment, and QA details below are illustrative demo content, not AI-generated results.</span></div>}
      {error && <div className="alert alert-warning">{error}</div>}
      <div className="call-detail-grid">
        <div className="detail-primary-column">
          <section className="panel audio-panel">
            <div className="panel-heading"><div><h2>Call recording</h2><p><span className="recording-status-dot" />{call.channel || 'Inbound'} call <span className="muted-separator">·</span> {call.duration || 'Duration unavailable'}</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
            {playableAudioUrl ? <audio className="audio-native" controls src={playableAudioUrl}>Your browser does not support audio.</audio> : <div className="audio-player">
              <button className="audio-play-button" disabled aria-label="Sample audio unavailable"><Play size={18} fill="currentColor" /></button>
              <div className="audio-progress-area"><div className="audio-time-row"><span>Sample recording</span><span>{call.duration || '08:42'}</span></div><div className="audio-track"><span style={{ width: '0%' }} /></div><div className="audio-waveform"><AudioLines size={17} /><div className="waveform-bars">{Array.from({ length: 64 }, (_, index) => <i key={index} style={{ height: `${10 + ((index * 19 + 7) % 25)}px` }} />)}</div></div></div>
              <span className="audio-volume" aria-hidden="true"><AudioLines size={18} /></span>
            </div>}
            {!playableAudioUrl && <p className="audio-unavailable">{call.storagePath && error ? error : 'No recording file is attached to this call.'}</p>}
          </section>
          <section className="panel transcript-panel">
            <div className="panel-heading"><div><h2>Transcript</h2><p>Conversation transcript with speaker labels</p></div>{analysis.transcript.length > 0 && <button className="transcript-action" onClick={() => navigator.clipboard?.writeText(analysis.transcript.map((line) => `${line.time} ${line.speaker}: ${line.text}`).join('\n'))}><Download size={15} />Copy</button>}</div>
            {analysis.transcript.length ? <><div className="transcript-list">{analysis.transcript.map((line) => <div className={`transcript-line ${line.speaker === 'Agent' ? 'transcript-agent' : ''}`} key={line.time}><time>{line.time}</time><span className={`speaker-avatar ${line.speaker === 'Agent' ? 'speaker-agent' : ''}`}>{line.speaker === 'Agent' ? 'A' : 'C'}</span><div><strong>{line.speaker === 'Agent' ? call.agent : caller}</strong><p>{line.text}</p></div></div>)}</div>{isSample && <p className="transcript-end">End of sample transcript</p>}</> : <div className="analysis-empty"><MessageSquareText size={17} />{isSample ? 'No sample transcript is available for this call.' : 'Transcript will appear here after analysis is available.'}</div>}
          </section>
          <section className="panel summary-panel">
            <div className="panel-heading"><div><h2>Call summary</h2><p>Key takeaways from this conversation</p></div><span className="summary-sparkle"><Sparkles size={16} /></span></div>
            <div className="summary-copy"><p>{analysis.summary || 'Analysis is pending. No summary is available for this recording yet.'}</p>{hasDetailedSample && <ul><li>Matched the customer’s requirements with a suitable plan option.</li><li>Explained when the plan change takes effect and how billing is handled.</li><li>Resolved the request in one interaction with a positive close.</li></ul>}</div>
            {analysis.keywords.length > 0 && <div className="keywords-block"><div><Tag size={15} /><strong>Key topics</strong></div><div className="keyword-list">{analysis.keywords.map((word) => <span key={word}>{word}</span>)}</div></div>}
          </section>
        </div>
        <aside className="detail-side-column">
          <section className="panel qa-summary-panel"><div className="panel-heading"><div><h2>Quality score</h2><p>Overall conversation rating</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>{Number.isFinite(score) ? <div className="qa-score-display"><div className="qa-score-ring" style={{ '--score': `${score * 3.6}deg` }}><div><strong>{score}</strong><span>/100</span></div></div><div><span className="score-pill"><Star size={13} fill="currentColor" />{score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : 'Needs coaching'}</span><p>{score >= 90 ? 'A standout customer experience.' : score >= 80 ? 'A positive sample rating.' : 'A sample coaching opportunity.'}</p></div></div> : <div className="analysis-empty"><Clock3 size={16} />Quality evaluation is pending.</div>}<div className="qa-mini-stats"><div><strong>{analysis.criteria.length ? `${analysis.criteria.length}/${analysis.criteria.length}` : '—'}</strong><span>Criteria met</span></div><div><strong>{hasDetailedSample ? '+8' : '—'}</strong><span>vs. team avg.</span></div><div><strong>{hasDetailedSample ? 'Top 12%' : '—'}</strong><span>Team ranking</span></div></div></section>
          <section className="panel criteria-panel"><div className="panel-heading"><div><h2>Quality criteria</h2><p>Evaluation breakdown</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>{analysis.criteria.length ? <div className="criteria-list">{analysis.criteria.map((criterion) => <div className="criterion" key={criterion.name}><div className="criterion-top"><strong>{criterion.name}</strong><span className={criterion.score >= 90 ? 'criterion-good' : 'criterion-mid'}>{criterion.score}%</span></div><div className="criterion-bar"><span style={{ width: `${criterion.score}%` }} /></div><p>{criterion.note}</p></div>)}</div> : <div className="analysis-empty">{isSample ? 'No sample evaluation criteria are available for this call.' : 'Evaluation criteria are pending.'}</div>}</section>
          <section className="panel sentiment-detail-panel"><div className="panel-heading"><div><h2>Customer sentiment</h2><p>Overall conversation tone</p></div></div><div className="sentiment-detail-row"><span className="sentiment-face"><ThumbsUp size={18} /></span><div><strong>{analysis.sentiment}</strong><span>{hasDetailedSample ? 'Sample result' : isSample ? 'Sample label' : analysis.sentimentConfidence ? 'Confident signal' : 'Awaiting analysis'}</span></div><span className="sentiment-confidence">{analysis.sentimentConfidence ? `${analysis.sentimentConfidence}%` : '—'}</span></div><div className="sentiment-callout"><span>“</span><p>{hasDetailedSample ? 'Customer ended the call feeling confident about their plan choice.' : isSample ? 'Sentiment is an illustrative sample label, not a result generated from this recording.' : 'Sentiment insights will appear when analysis is available.'}</p></div></section>
          <section className="panel feedback-panel"><div className="panel-heading"><div><h2>Supervisor feedback</h2><p>Coaching notes for this call</p></div><MessageSquareText size={17} className="feedback-icon" /></div>{feedbackEntries.length > 0 && <div className="feedback-readonly">{feedbackEntries.map((entry) => <p key={entry.id}>{entry.message}</p>)}</div>}{['Agent', 'Demo'].includes(user.role) ? !feedbackEntries.length && <div className="feedback-readonly">{savedFeedback || 'No supervisor feedback has been added yet.'}</div> : <form onSubmit={saveFeedback}><textarea className="form-control" rows="4" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Write feedback for the agent…" /><div className="feedback-footer"><span>Visible to supervisors and agents</span><button className="btn btn-primary-custom btn-sm" disabled={feedbackBusy || !feedback.trim()}>{feedbackBusy ? 'Saving…' : <><Send size={14} />Save note</>}</button></div></form>}</section>
        </aside>
      </div>
      <div className="detail-footer-note"><Clock3 size={14} />{isSample ? 'Review uses illustrative sample evaluation data' : 'Analysis status: pending'} <span>·</span> <RotateCcw size={14} />Last updated just now</div>
    </div>
  );
}
