import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Headphones, MessageCircle, MoreHorizontal, Smile, Sparkles, Star, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { listCalls } from '../services/dataService';
import { formatDateTime, formatDuration } from '../utils/format';

function dateValue(call) {
  const value = call.date || call.createdAt || call.uploadedAt;
  return new Date(typeof value?.toDate === 'function' ? value.toDate() : value);
}

function chartForPeriod(calls, period, language) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start;
  if (period === 'This month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === 'Last week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    end.setDate(end.getDate() - 7);
  } else start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const buckets = new Map();
  const count = Math.ceil((end - start) / 86400000);
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    buckets.set(key, {
      date,
      day: date.toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric' }),
      calls: 0,
      scores: [],
    });
  }
  calls.forEach((call) => {
    const date = dateValue(call);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.calls += 1;
    const score = Number.isFinite(call.qaScore) ? call.qaScore : call.score;
    if (Number.isFinite(score)) bucket.scores.push(score);
  });
  return [...buckets.values()].map(({ day, calls: total, scores }) => ({
    day,
    calls: total,
    score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
  }));
}

function mean(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function getAgentSummary(calls) {
  const grouped = new Map();
  calls.forEach((call) => {
    if (!call.agentId && !call.agent) return;
    const key = call.agentId || call.agent;
    const current = grouped.get(key) || { name: call.agent || '—', calls: 0, scores: [], team: call.team || '' };
    current.calls += 1;
    const score = Number.isFinite(call.qaScore) ? call.qaScore : call.score;
    if (Number.isFinite(score)) current.scores.push(score);
    grouped.set(key, current);
  });
  return [...grouped.values()]
    .map((agent) => ({ ...agent, score: mean(agent.scores) }))
    .filter((agent) => Number.isFinite(agent.score))
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);
}

function getTopIssue(calls) {
  const counts = new Map();
  calls.forEach((call) => (Array.isArray(call.customerIssues) ? call.customerIssues : []).forEach((issue) => {
    if (typeof issue === 'string' && issue.trim()) counts.set(issue, (counts.get(issue) || 0) + 1);
  }));
  return [...counts.entries()].sort((first, second) => second[1] - first[1])[0] || null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { language, t } = usePreferences();
  const isArabic = language === 'ar';
  const text = (arabic, english) => isArabic ? arabic : english;
  const [calls, setCalls] = useState([]);
  const [period, setPeriod] = useState('This week');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listCalls(user).then((results) => {
      if (!cancelled) setCalls(results);
    }).catch((loadError) => {
      const code = typeof loadError?.code === 'string' ? loadError.code : loadError?.name || 'UnknownError';
      console.error('[Dashboard] Calls load failed', { code });
      if (!cancelled) setError(text('تعذر تحميل بيانات لوحة التحكم. تحقق من اتصال Firebase.', 'Dashboard data could not be loaded. Check the Firebase connection.'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user, language]);

  const scores = calls.map((call) => Number.isFinite(call.qaScore) ? call.qaScore : call.score).filter(Number.isFinite);
  const satisfactions = calls.map((call) => call.customerSatisfaction).filter(Number.isFinite);
  const average = mean(scores);
  const satisfaction = mean(satisfactions);
  const needsReview = calls.filter((call) => call.status === 'Needs review').length;
  const criticalAlerts = calls.reduce((total, call) => total + (Array.isArray(call.criticalAlerts) ? call.criticalAlerts.length : 0), 0);
  const recentCalls = calls.slice(0, 4);
  const topAgents = getAgentSummary(calls);
  const topIssue = getTopIssue(calls);
  const durations = calls.map((call) => call.duration).filter(Number.isFinite);
  const averageDuration = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  const resolvedCalls = calls.filter((call) => call.callOutcome === 'resolved').length;
  const resolutionRate = calls.length ? Math.round((resolvedCalls / calls.length) * 100) : null;
  const sentimentCounts = {
    positive: calls.filter((call) => String(call.sentiment || call.analysis?.sentiment).toLowerCase() === 'positive').length,
    neutral: calls.filter((call) => String(call.sentiment || call.analysis?.sentiment).toLowerCase() === 'neutral').length,
    negative: calls.filter((call) => String(call.sentiment || call.analysis?.sentiment).toLowerCase() === 'negative').length,
  };
  const chartData = useMemo(() => chartForPeriod(calls, period, language), [calls, period, language]);
  const sentimentTotal = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
  const percent = (count) => sentimentTotal ? Math.round((count / sentimentTotal) * 100) : 0;

  return (
    <div className="dashboard-page page-enter" lang={language} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="page-heading dashboard-heading">
        <div><div className="eyebrow-label">{new Date().toLocaleDateString(isArabic ? 'ar' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="eyebrow-dot" /> {t('overview')}</div><h1>{t('greeting')}, {user?.name?.split(' ')[0]}</h1><p>{text('إليك ملخص المحادثات المسجلة ونتائج تحليلها.', 'Here is an overview of uploaded calls and their analysis.')}</p></div>
        <div className="heading-actions"><select aria-label={text('الفترة التحليلية', 'Analytics period')} className="form-select period-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="This week">{text('هذا الأسبوع', 'This week')}</option><option value="Last week">{text('الأسبوع الماضي', 'Last week')}</option><option value="This month">{text('هذا الشهر', 'This month')}</option></select><Link to="/calls" className="btn btn-primary-custom"><Headphones size={16} />{t('uploadCall')}</Link></div>
      </div>
      {error && <div className="alert alert-warning">{error}</div>}
      {loading && <div className="alert alert-info" role="status">{text('جارٍ تحميل المكالمات…', 'Loading calls…')}</div>}
      <div className="stats-grid">
        <StatCard icon={Headphones} label={text('إجمالي المكالمات', 'Total calls')} value={calls.length.toLocaleString(isArabic ? 'ar' : 'en-US')} tone="blue" />
        <StatCard icon={Star} label={text('متوسط تقييم الجودة', 'Average QA score')} value={average !== null ? `${average}%` : '—'} tone="violet" />
        <StatCard icon={Smile} label={text('رضا العملاء التقديري', 'Estimated satisfaction')} value={satisfaction !== null ? `${satisfaction}%` : '—'} tone="green" />
        <StatCard icon={AlertTriangle} label={text('التنبيهات المهمة', 'Critical alerts')} value={criticalAlerts.toLocaleString(isArabic ? 'ar' : 'en-US')} note={needsReview ? text(`${needsReview} تحتاج إلى مراجعة`, `${needsReview} need review`) : undefined} tone="orange" />
      </div>
      <div className="dashboard-main-grid">
        <section className="panel analytics-panel">
          <div className="panel-heading"><div><h2>{text('تحليلات المكالمات', 'Calls analytics')}</h2><p>{text('حجم المكالمات ومتوسط الجودة من البيانات المسجلة', 'Recorded call volume and average QA scores')}</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
          <div className="chart-legend"><span><i className="legend-dot legend-blue" />{text('المكالمات', 'Calls handled')}</span><span><i className="legend-dot legend-green" />{text('تقييم الجودة', 'QA score')}</span><span className="chart-period-label">{text(period === 'This month' ? 'هذا الشهر' : period === 'Last week' ? 'الأسبوع الماضي' : 'هذا الأسبوع', period)}</span></div>
          <div className="calls-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
                <defs><linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4469dc" stopOpacity={0.15} /><stop offset="100%" stopColor="#4469dc" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf0f5" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} dy={10} />
                <YAxis yAxisId="volume" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="score" orientation="right" domain={[0, 100]} hide />
                <Tooltip contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px #17243b12' }} />
                <Area yAxisId="volume" type="monotone" dataKey="calls" name={text('المكالمات', 'Calls handled')} stroke="#4969dc" strokeWidth={2.5} fill="url(#callsFill)" activeDot={{ r: 4 }} />
                <Area yAxisId="score" type="monotone" dataKey="score" name={text('تقييم الجودة', 'QA score')} stroke="#53bb94" strokeWidth={2} fill="none" activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-footer"><span><span className="mini-trend"><TrendingUp size={14} /></span><strong>{average !== null ? `${average}%` : '—'}</strong> <span>{text('متوسط تقييم الجودة', 'Average QA score')}</span></span><span>{text('مكالمات تحتاج مراجعة', 'Calls needing review')} <strong>{needsReview}</strong></span></div>
        </section>
        <section className="panel sentiment-panel">
          <div className="panel-heading"><div><h2>{text('ملخص المشاعر', 'Sentiment overview')}</h2><p>{text('نبرة العملاء في المكالمات المحللة', 'Customer tone in analyzed calls')}</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
          <div className="sentiment-score"><div className="sentiment-score-icon"><Smile size={19} /></div><div><strong>{sentimentTotal ? text('نتائج التحليل', 'Analyzed calls') : text('لا توجد نتائج بعد', 'No results yet')}</strong><span>{text('تظهر النسب بعد اكتمال تحليل المكالمات', 'Percentages appear as call analysis completes')}</span></div><span className="sentiment-total">{sentimentTotal || '—'}</span></div>
          <div className="sentiment-bars">
            {[
              ['positive', text('إيجابي', 'Positive'), 'sentiment-positive'],
              ['neutral', text('محايد', 'Neutral'), 'sentiment-neutral'],
              ['negative', text('سلبي', 'Negative'), 'sentiment-negative'],
            ].map(([key, label, className]) => <div className="sentiment-row" key={key}><div><span>{label}</span><strong>{percent(sentimentCounts[key])}%</strong></div><div className="progress"><div className={`progress-bar ${className}`} style={{ width: `${percent(sentimentCounts[key])}%` }} /></div></div>)}
          </div>
          <div className="sentiment-insight"><Sparkles size={16} /><p>{text('تُحتسب مؤشرات المشاعر من نتائج تحليل المكالمات المحفوظة فقط.', 'Sentiment metrics use only saved call-analysis results.')}</p></div>
          <Link className="panel-link" to="/calls">{text('استعراض المكالمات', 'Explore calls')} <ArrowRight size={15} /></Link>
        </section>
      </div>
      <div className="dashboard-lower-grid">
        <section className="panel recent-panel">
          <div className="panel-heading"><div><h2>{text('المكالمات الأخيرة', 'Recent calls')}</h2><p>{text('أحدث محادثات العملاء المسجلة', 'Most recently uploaded customer conversations')}</p></div><Link className="panel-link" to="/calls">{t('viewAll')} <ArrowRight size={15} /></Link></div>
          <div className="recent-calls-list">
            {recentCalls.map((call) => (
              <Link to={`/calls/${call.id}`} className="recent-call-row" key={call.id}>
                <span className={`customer-avatar customer-${call.customerInitials?.slice(0, 1).toLowerCase() || 'n'}`}>{call.customerInitials || call.customer?.slice(0, 2).toUpperCase() || '—'}</span>
                <span className="recent-call-person"><strong>{call.customer || call.originalFilename}</strong><small>{call.topic || text('مكالمة خدمة عملاء', 'Customer service call')} · {call.agent || '—'}</small></span>
                <span className="recent-call-date">{formatDateTime(call.date || call.createdAt, language)}</span>
                <span className="recent-call-score"><Star size={13} fill="currentColor" />{Number.isFinite(call.qaScore) ? `${call.qaScore}%` : Number.isFinite(call.score) ? `${call.score}%` : '—'}</span>
                <StatusBadge language={language}>{call.status}</StatusBadge>
              </Link>
            ))}
            {!recentCalls.length && <div className="dashboard-empty-state">{text('لا توجد مكالمات مسجلة بعد.', 'No calls have been uploaded yet.')}</div>}
          </div>
        </section>
        <section className="panel agents-panel">
          <div className="panel-heading"><div><h2>{text('أعلى أداء', 'Top performers')}</h2><p>{text('حسب متوسط تقييم الجودة المسجل', 'Ranked by recorded average QA score')}</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
          <div className="top-agents-list">
            {topAgents.map((agent, index) => {
              const initials = agent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
              return <div className="top-agent-row" key={agent.name}><span className="rank-number">0{index + 1}</span><span className="user-avatar avatar-lavender">{initials}</span><span className="top-agent-info"><strong>{agent.name}</strong><small>{agent.team || text('الفريق', 'Team')} · {agent.calls} {text('مكالمة', 'calls')}</small></span><span className="top-agent-score"><Star size={13} fill="currentColor" />{agent.score}</span></div>;
            })}
            {!topAgents.length && <div className="dashboard-empty-state">{text('ستظهر النتائج بعد تحليل المكالمات.', 'Rankings appear after calls are analyzed.')}</div>}
          </div>
          {topAgents.length > 0 && <div className="agent-team-footer"><span>{text('أفضل الموظفين حسب التقييم المحفوظ', 'Top agents by saved QA score')}</span><ArrowUpRight size={15} /></div>}
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <div className="small-insight-card"><div className="small-insight-icon insight-amber"><MessageCircle size={17} /></div><div><span>{text('المشكلة الأكثر تكرارًا', 'MOST REPORTED ISSUE')}</span><strong>{topIssue?.[0] || '—'}</strong><p>{topIssue ? text(`ذُكرت في ${topIssue[1]} مكالمة`, `Mentioned in ${topIssue[1]} calls`) : text('لا توجد مشكلات مسجلة بعد', 'No customer issues recorded')}</p></div></div>
        <div className="small-insight-card"><div className="small-insight-icon insight-blue"><Clock3 size={17} /></div><div><span>{text('متوسط مدة المكالمة', 'AVERAGE CALL DURATION')}</span><strong>{averageDuration === null ? '—' : formatDuration(averageDuration, language)}</strong><p>{text('محسوبة من مدد التسجيلات المفروغة', 'Calculated from transcribed recordings')}</p></div></div>
        <div className="small-insight-card"><div className="small-insight-icon insight-green"><CheckCircle2 size={17} /></div><div><span>{text('المكالمات التي تم حلها', 'CALLS RESOLVED')}</span><strong>{resolutionRate === null ? '—' : `${resolutionRate}%`}</strong><p>{text('بناءً على نتائج التحليل المحفوظة', 'Based on saved analysis outcomes')}</p></div></div>
      </div>
    </div>
  );
}
