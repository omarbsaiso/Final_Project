import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, AudioLines, Check, Clock3, Download, Headphones, MessageSquareText, MoreHorizontal, RotateCcw, Send, Sparkles, Star, Tag, ThumbsUp } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { getCallAnalysis } from '../services/analysisService';
import { getCall, listFeedback, saveFeedback } from '../services/dataService';
import { downloadCallRecording, retryCallProcessing } from '../services/storageService';
import { formatDateTime, formatDuration } from '../utils/format';

const processingErrors = {
  DEEPGRAM_NOT_CONFIGURED: ['لم يتم إعداد خدمة تحويل الكلام إلى نص على الخادم.', 'Speech recognition is not configured on the server.'],
  DEEPGRAM_REQUEST_FAILED: ['فشل التفريغ الصوتي. التسجيل محفوظ ويمكن إعادة المحاولة.', 'Transcription failed. The recording is retained and can be retried.'],
  DEEPGRAM_EMPTY_TRANSCRIPT: ['لم يتم العثور على كلام واضح في التسجيل.', 'No clear speech was returned for this recording.'],
  GROQ_NOT_CONFIGURED: ['لم يتم إعداد خدمة تحليل الذكاء الاصطناعي على الخادم.', 'AI analysis is not configured on the server.'],
  GROQ_REQUEST_FAILED: ['فشل تحليل المكالمة. النص والتسجيل محفوظان لإعادة المحاولة.', 'Call analysis failed. The transcript and recording are retained for retry.'],
  GROQ_INVALID_RESPONSE: ['أعاد التحليل نتيجة غير صالحة. يمكن إعادة المحاولة.', 'The analysis response was invalid. You can retry processing.'],
  GROQ_TRANSCRIPT_TOO_LONG: ['النص أطول من الحد المسموح للتحليل.', 'The transcript exceeds the analysis limit.'],
  AUDIO_NOT_FOUND: ['ملف التسجيل غير موجود على الخادم.', 'The recording file is missing from the server.'],
  PROCESSING_FAILED: ['فشلت معالجة المكالمة. يمكن إعادة المحاولة.', 'Call processing failed. You can retry.'],
};

function InsightList({ title, items, emptyText, icon: Icon }) {
  return (
    <section className="panel summary-panel">
      <div className="panel-heading"><div><h2>{title}</h2></div>{Icon && <Icon size={17} className="feedback-icon" />}</div>
      {items.length
        ? <ul className="analysis-insight-list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        : <div className="analysis-empty">{emptyText}</div>}
    </section>
  );
}

export default function CallDetailsPage() {
  const { callId } = useParams();
  const { user } = useAuth();
  const { language } = usePreferences();
  const isArabic = language === 'ar';
  const text = (arabic, english) => isArabic ? arabic : english;
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioObjectUrl, setAudioObjectUrl] = useState('');
  const [audioError, setAudioError] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [savedFeedback, setSavedFeedback] = useState('');
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    async function loadCall() {
      setLoading(true);
      setError('');
      setAudioError('');
      setCall(null);
      setAudioObjectUrl('');
      setFeedbackEntries([]);
      setSavedFeedback('');
      try {
        const result = await getCall(callId, user);
        if (cancelled) return;
        setCall(result);
        if (result) {
          const entries = await listFeedback(callId, user);
          if (cancelled) return;
          setFeedbackEntries(entries);
          setSavedFeedback(entries.at(-1)?.message || result.feedback || '');
        }
      } catch (loadError) {
        console.error('[CallDetails] Call load failed', { code: loadError?.code || loadError?.name || 'UnknownError' });
        if (!cancelled) setError(text('تعذر تحميل المكالمة أو الملاحظات. تحقق من صلاحيات الحساب والاتصال.', 'Could not load the call or its feedback. Check account permissions and connectivity.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCall();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId, user, language]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    if (!call?.localFilename) {
      setAudioLoading(false);
      setAudioObjectUrl('');
      return undefined;
    }
    async function loadRecording() {
      setAudioLoading(true);
      setAudioError('');
      try {
        const audioBlob = await downloadCallRecording(callId, language);
        objectUrl = URL.createObjectURL(audioBlob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setAudioObjectUrl(objectUrl);
      } catch (downloadError) {
        if (!cancelled) setAudioError(downloadError.message || text('تعذر تحميل التسجيل.', 'Could not load the recording.'));
      } finally {
        if (!cancelled) setAudioLoading(false);
      }
    }
    loadRecording();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId, call?.localFilename, language]);

  useEffect(() => {
    if (!call || call.processingStatus !== 'processing') return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const updated = await getCall(callId, user);
        if (!cancelled && updated) setCall(updated);
      } catch (pollError) {
        console.error('[CallDetails] Processing status refresh failed', { code: pollError?.code || pollError?.name || 'UnknownError' });
        if (!cancelled) setError(text('تعذر تحديث حالة المعالجة. تحقق من الاتصال.', 'Could not refresh processing status. Check connectivity.'));
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [call?.processingStatus, callId, user, language]);

  async function saveFeedback(event) {
    event.preventDefault();
    setFeedbackBusy(true);
    setError('');
    try {
      const saved = await saveFeedback(call, feedback, user);
      setFeedbackEntries((current) => [...current, saved]);
      setSavedFeedback(saved.message);
      setFeedback('');
      setCall((current) => ({ ...current, status: 'Reviewed' }));
    } catch (saveError) {
      console.error('[CallDetails] Feedback save failed', { code: saveError?.code || saveError?.name || 'UnknownError' });
      setError(text('تعذر حفظ الملاحظة. تحقق من صلاحيات الحساب والاتصال.', 'Could not save feedback. Check account permissions and connectivity.'));
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function retryProcessing() {
    setRetryBusy(true);
    setError('');
    try {
      await retryCallProcessing(callId, language);
      setCall((current) => ({
        ...current,
        processingStatus: 'processing',
        transcriptionStatus: 'queued',
        analysisStatus: 'queued',
        processingError: null,
        status: 'Processing',
      }));
    } catch (retryError) {
      setError(retryError.message || text('تعذرت إعادة المعالجة.', 'Could not retry processing.'));
    } finally {
      setRetryBusy(false);
    }
  }

  if (loading) return <div className="panel page-loading" lang={language} dir={isArabic ? 'rtl' : 'ltr'}><span className="spinner-border" /> {text('جارٍ تحميل تفاصيل المكالمة…', 'Loading call details…')}</div>;
  if (!call) return (
    <div className="page-enter" lang={language} dir={isArabic ? 'rtl' : 'ltr'}>
      <Link to="/calls" className="back-link"><ArrowLeft size={16} />{text('العودة إلى المكالمات', 'Back to calls')}</Link>
      <div className="panel empty-details"><Headphones size={25} /><h2>{text('المكالمة غير موجودة', 'Call not found')}</h2><p>{text('قد يكون التسجيل محذوفًا أو لا تملك صلاحية عرضه.', 'This recording may have been removed or you may not have permission to view it.')}</p>{error && <span>{error}</span>}</div>
    </div>
  );

  const analysis = getCallAnalysis(call);
  const hasAnalysis = call.analysisStatus === 'completed' && Boolean(call.analysis);
  const score = analysis.score;
  const displayedSentiment = analysis.sentiment.toLowerCase();
  const sentimentLabel = {
    positive: text('إيجابي', 'Positive'),
    neutral: text('محايد', 'Neutral'),
    negative: text('سلبي', 'Negative'),
  }[displayedSentiment] || text('قيد الانتظار', 'Pending');
  const outcomeLabel = {
    resolved: text('تم الحل', 'Resolved'),
    unresolved: text('لم يتم الحل', 'Unresolved'),
    'follow-up required': text('يتطلب متابعة', 'Follow-up required'),
  }[analysis.callOutcome] || text('غير متاح', 'Not available');
  const processingErrorText = processingErrors[call.processingError?.code]?.[isArabic ? 0 : 1];
  const emptyAnalysis = hasAnalysis
    ? text('لا توجد عناصر مسجلة.', 'No items were identified.')
    : text('ستظهر النتائج بعد اكتمال التحليل.', 'Results will appear after analysis completes.');
  const caller = call.customer || text('عميل غير معروف', 'Unknown customer');
  const speakerFallback = text('متحدث غير محدد', 'Speaker not identified');

  return (
    <div className="page-enter call-detail-page" lang={language} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="detail-topline">
        <Link to="/calls" className="back-link"><ArrowLeft size={16} />{text('العودة إلى المكالمات', 'Back to calls')}</Link>
        <button className="btn btn-outline-custom" onClick={() => window.print()}><Download size={16} />{text('تصدير المراجعة', 'Export review')}</button>
      </div>
      <div className="detail-heading">
        <div><div className="eyebrow-label">{text('مراجعة المكالمة', 'CALL REVIEW')} <span className="eyebrow-dot" /> {call.id}</div><h1>{call.topic || call.originalFilename || text('مكالمة خدمة عملاء', 'Customer service call')}</h1><p>{caller} <span>·</span> {call.agent} <span>·</span> {formatDateTime(call.date || call.createdAt, language)}</p></div>
        <StatusBadge language={language}>{call.status}</StatusBadge>
      </div>

      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {call.processingStatus === 'processing' && <div className="alert alert-info d-flex align-items-center gap-2" role="status"><span className="spinner-border spinner-border-sm" />{text('جارٍ تحويل التسجيل إلى نص وتحليل المكالمة…', 'Transcribing the recording and analyzing the call…')}</div>}
      {call.processingStatus === 'failed' && <div className="alert alert-warning d-flex align-items-center justify-content-between gap-3" role="alert"><span><AlertCircle size={16} className="me-2" />{processingErrorText || text('فشلت المعالجة. التسجيل محفوظ ويمكن إعادة المحاولة.', 'Processing failed. The recording is retained and can be retried.')}</span>{user.role === 'Admin' && <button className="btn btn-outline-custom btn-sm" onClick={retryProcessing} disabled={retryBusy}>{retryBusy ? text('جارٍ إعادة المحاولة…', 'Retrying…') : <><RotateCcw size={14} />{text('إعادة المحاولة', 'Retry')}</>}</button>}</div>}

      <div className="call-detail-grid">
        <div className="detail-primary-column">
          <section className="panel audio-panel">
            <div className="panel-heading"><div><h2>{text('تسجيل المكالمة', 'Call recording')}</h2><p><span className="recording-status-dot" />{call.channel || text('مكالمة واردة', 'Inbound call')} <span className="muted-separator">·</span> {formatDuration(call.duration, language)}</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
            {audioObjectUrl
              ? <audio className="audio-native" controls src={audioObjectUrl}>{text('المتصفح لا يدعم تشغيل الصوت.', 'Your browser does not support audio.')}</audio>
              : <div className="analysis-empty">{audioLoading ? <><span className="spinner-border spinner-border-sm" /> {text('جارٍ تحميل التسجيل…', 'Loading recording…')}</> : audioError || text('لا يوجد ملف تسجيل متاح.', 'No recording file is available.')}</div>}
            {call.originalFilename && <p className="muted-cell mt-2">{text('الملف الأصلي:', 'Original file:')} {call.originalFilename}</p>}
          </section>

          <section className="panel transcript-panel">
            <div className="panel-heading"><div><h2>{text('النص الكامل', 'Full transcript')}</h2><p>{text('التفريغ الصوتي مع المتحدثين والتوقيتات المتاحة', 'Transcription with available speakers and timestamps')}</p></div>{analysis.transcript.length > 0 && <button className="transcript-action" onClick={() => navigator.clipboard?.writeText(analysis.transcript.map((line) => `${line.time} ${line.speaker || speakerFallback}: ${line.text}`).join('\n'))}><Download size={15} />{text('نسخ', 'Copy')}</button>}</div>
            {analysis.transcript.length
              ? <div className="transcript-list">{analysis.transcript.map((line) => <div className="transcript-line" key={line.id}><time>{line.time}</time><span className="speaker-avatar">{line.speaker ? line.speaker.replace('Speaker ', 'S') : '?'}</span><div><strong>{line.speaker || speakerFallback}</strong><p>{line.text}</p></div></div>)}</div>
              : <div className="analysis-empty"><MessageSquareText size={17} />{call.transcriptionStatus === 'failed' ? text('تعذر إنشاء النص. أعد المعالجة بعد التحقق من إعداد الخدمة.', 'Transcription failed. Retry after checking service configuration.') : text('لا يوجد نص بعد.', 'No transcript is available yet.')}</div>}
          </section>

          <section className="panel summary-panel">
            <div className="panel-heading"><div><h2>{text('ملخص المكالمة', 'Call summary')}</h2><p>{text('ملخص مولّد من نص المحادثة', 'Summary generated from the conversation transcript')}</p></div><span className="summary-sparkle"><Sparkles size={16} /></span></div>
            <div className="summary-copy"><p>{analysis.summary || emptyAnalysis}</p></div>
            {analysis.keywords.length > 0 && <div className="keywords-block"><div><Tag size={15} /><strong>{text('الموضوعات الرئيسية', 'Key topics')}</strong></div><div className="keyword-list">{analysis.keywords.map((word) => <span key={word}>{word}</span>)}</div></div>}
          </section>

          <InsightList title={text('مشكلات العميل', 'Customer issues')} items={analysis.customerIssues} emptyText={emptyAnalysis} icon={AlertCircle} />
          <InsightList title={text('نقاط القوة', 'Strengths')} items={analysis.strengths} emptyText={emptyAnalysis} icon={Check} />
          <InsightList title={text('مجالات التحسين', 'Areas to improve')} items={analysis.improvements} emptyText={emptyAnalysis} icon={RotateCcw} />
          <InsightList title={text('توصيات التدريب', 'Coaching recommendations')} items={analysis.recommendations} emptyText={emptyAnalysis} icon={Sparkles} />
          <InsightList title={text('التنبيهات المهمة', 'Critical alerts')} items={analysis.criticalAlerts} emptyText={text('لا توجد تنبيهات مدعومة بالنص.', 'No transcript-supported alerts were identified.')} icon={AlertCircle} />
        </div>

        <aside className="detail-side-column">
          <section className="panel qa-summary-panel">
            <div className="panel-heading"><div><h2>{text('درجة الجودة', 'QA score')}</h2><p>{text('وفق مقياس جودة خدمة العملاء', 'Based on the customer-service QA rubric')}</p></div></div>
            {Number.isFinite(score)
              ? <div className="qa-score-display"><div className="qa-score-ring" style={{ '--score': `${score * 3.6}deg` }}><div><strong>{score}</strong><span>/100</span></div></div><div><span className="score-pill"><Star size={13} fill="currentColor" />{text('نتيجة التحليل', 'Analysis result')}</span><p>{analysis.agentPerformance}</p></div></div>
              : <div className="analysis-empty"><Clock3 size={16} />{emptyAnalysis}</div>}
            <div className="qa-mini-stats"><div><strong>{Number.isFinite(analysis.customerSatisfaction) ? `${analysis.customerSatisfaction}%` : '—'}</strong><span>{text('رضا العميل التقديري', 'Estimated satisfaction')}</span></div><div><strong>{sentimentLabel}</strong><span>{text('المشاعر', 'Sentiment')}</span></div><div><strong>{outcomeLabel}</strong><span>{text('نتيجة المكالمة', 'Call outcome')}</span></div></div>
          </section>

          <section className="panel sentiment-detail-panel"><div className="panel-heading"><div><h2>{text('أداء الموظف', 'Agent performance')}</h2><p>{text('تقييم يستند إلى أدلة النص', 'Assessment based on transcript evidence')}</p></div><ThumbsUp size={17} /></div><div className="summary-copy"><p>{analysis.agentPerformance || emptyAnalysis}</p></div></section>

          <section className="panel feedback-panel">
            <div className="panel-heading"><div><h2>{text('ملاحظات المشرف', 'Supervisor feedback')}</h2><p>{text('ملاحظات تدريبية للمكالمة', 'Coaching notes for this call')}</p></div><MessageSquareText size={17} className="feedback-icon" /></div>
            {feedbackEntries.length > 0 && <div className="feedback-readonly">{feedbackEntries.map((entry) => <p key={entry.id}>{entry.message}</p>)}</div>}
            {['Agent', 'Demo'].includes(user.role)
              ? !feedbackEntries.length && <div className="feedback-readonly">{savedFeedback || text('لم تتم إضافة ملاحظات بعد.', 'No supervisor feedback has been added yet.')}</div>
              : <form onSubmit={saveFeedback}><textarea className="form-control" rows="4" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder={text('اكتب ملاحظة للموظف…', 'Write feedback for the agent…')} /><div className="feedback-footer"><span>{text('مرئية للمشرفين والموظفين', 'Visible to supervisors and agents')}</span><button className="btn btn-primary-custom btn-sm" disabled={feedbackBusy || !feedback.trim()}>{feedbackBusy ? text('جارٍ الحفظ…', 'Saving…') : <><Send size={14} />{text('حفظ الملاحظة', 'Save note')}</>}</button></div></form>}
          </section>
        </aside>
      </div>
      <div className="detail-footer-note"><Clock3 size={14} />{text('حالة المعالجة:', 'Processing status:')} {call.processingStatus || '—'} <span>·</span> <RotateCcw size={14} />{formatDateTime(call.updatedAt || call.createdAt, language)}</div>
    </div>
  );
}
