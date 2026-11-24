import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Headphones, MessageCircle, MoreHorizontal, Smile, Sparkles, Star, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { isFirebaseConfigured } from '../firebase/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { chartData, demoCalls } from '../data/demoData';
import { listCalls } from '../services/dataService';
import { formatDateTime } from '../utils/format';

const topAgents = [
  { name: 'Ava Johnson', role: 'Customer Care', score: 96, calls: 148, initials: 'AJ', color: 'lavender' },
  { name: 'Sofia Patel', role: 'Customer Care', score: 94, calls: 132, initials: 'SP', color: 'peach' },
  { name: 'Ethan Brooks', role: 'Retention', score: 92, calls: 126, initials: 'EB', color: 'mint' },
];

const lastWeekChart = chartData.map((item, index) => ({
  ...item,
  calls: Math.round(item.calls * [0.84, 0.92, 0.88, 0.95, 0.9, 0.86, 0.91][index]),
  score: Math.max(70, item.score - [2, 1, 3, 1, 2, 0, 1][index]),
}));
const monthChart = [
  { day: 'Week 1', calls: 4820, score: 86 },
  { day: 'Week 2', calls: 5160, score: 88 },
  { day: 'Week 3', calls: 4930, score: 87 },
  { day: 'Week 4', calls: 5480, score: 91 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const demoMode = !isFirebaseConfigured;
  const [calls, setCalls] = useState([]);
  const [period, setPeriod] = useState('This week');
  const [error, setError] = useState('');

  useEffect(() => {
    listCalls(user).then(setCalls).catch((loadError) => setError(loadError.message || 'Could not load calls.'));
  }, [user]);

  const recent = calls.slice(0, 5);
  const average = useMemo(() => {
    const scores = calls.filter((call) => Number.isFinite(call.score)).map((call) => call.score);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  }, [calls]);
  const needsReview = calls.filter((call) => call.status === 'Needs review').length;
  const callCount = demoMode ? 2846 : calls.length;
  const recentCalls = recent.length ? recent : demoMode ? demoCalls.slice(0, 4) : [];
  const activeChart = period === 'This month' ? monthChart : period === 'Last week' ? lastWeekChart : chartData;

  return (
    <div className="dashboard-page page-enter">
      <div className="page-heading dashboard-heading">
        <div><div className="eyebrow-label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="eyebrow-dot" /> {t('overview')}</div><h1>{t('greeting')}, {user?.name?.split(' ')[0]} <span className="greeting-wave">✳</span></h1><p>Here’s what’s happening with your conversations today.</p></div>
        <div className="heading-actions"><select aria-label="Analytics period" className="form-select period-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option>This week</option><option>Last week</option><option>This month</option></select><Link to="/calls" className="btn btn-primary-custom"><Headphones size={16} />{t('uploadCall')}</Link></div>
      </div>
      {error && <div className="alert alert-warning">{error}</div>}
      <div className="stats-grid">
        <StatCard icon={Headphones} label="Total calls" value={callCount.toLocaleString()} change={demoMode ? '+12.8%' : null} tone="blue" />
        <StatCard icon={Star} label="Average QA score" value={average !== null ? `${average}%` : demoMode ? '89%' : '—'} change={demoMode ? '+4.2%' : null} tone="violet" />
        <StatCard icon={Smile} label="Customer satisfaction" value={demoMode ? '94.6%' : '—'} change={demoMode ? '+2.1%' : null} tone="green" />
        <StatCard icon={AlertTriangle} label="Critical alerts" value={demoMode ? needsReview || 12 : needsReview} change={demoMode ? '-8.4%' : null} tone="orange" />
      </div>
      <div className="dashboard-main-grid">
        <section className="panel analytics-panel">
          <div className="panel-heading">          <div><h2>Calls analytics</h2><p>Call volume and quality over time</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
          <div className="chart-legend"><span><i className="legend-dot legend-blue" />Calls handled</span><span><i className="legend-dot legend-green" />QA score</span><span className="chart-period-label">{period}</span></div>
          <div className="calls-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeChart} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
                <defs><linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4469dc" stopOpacity={0.15} /><stop offset="100%" stopColor="#4469dc" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf0f5" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} dy={10} />
                <YAxis yAxisId="volume" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} ticks={period === 'This month' ? [0, 2000, 4000, 6000] : [0, 400, 800, 1200, 1600]} />
                <YAxis yAxisId="score" orientation="right" domain={[60, 100]} hide />
                <Tooltip contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px #17243b12' }} />
                <Area yAxisId="volume" type="monotone" dataKey="calls" name="Calls handled" stroke="#4969dc" strokeWidth={2.5} fill="url(#callsFill)" activeDot={{ r: 4 }} />
                <Area yAxisId="score" type="monotone" dataKey="score" name="QA score" stroke="#53bb94" strokeWidth={2} fill="none" activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-footer"><span><span className="mini-trend"><TrendingUp size={14} /></span><strong>+12.8%</strong> <span>vs. last week</span></span><span>Peak volume <strong>1,310 calls</strong></span></div>
        </section>
        <section className="panel sentiment-panel">
          <div className="panel-heading"><div><h2>Sentiment overview</h2><p>Customer tone across calls</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
          <div className="sentiment-score"><div className="sentiment-score-icon"><Smile size={19} /></div><div><strong>Positive outlook</strong><span>Conversations are trending well</span></div><span className="sentiment-total">94%</span></div>
          <div className="sentiment-bars">
            <div className="sentiment-row"><div><span>Positive</span><strong>68%</strong></div><div className="progress"><div className="progress-bar sentiment-positive" style={{ width: '68%' }} /></div></div>
            <div className="sentiment-row"><div><span>Neutral</span><strong>24%</strong></div><div className="progress"><div className="progress-bar sentiment-neutral" style={{ width: '24%' }} /></div></div>
            <div className="sentiment-row"><div><span>Negative</span><strong>8%</strong></div><div className="progress"><div className="progress-bar sentiment-negative" style={{ width: '8%' }} /></div></div>
          </div>
          <div className="sentiment-insight"><Sparkles size={16} /><p><strong>Insight:</strong> Positive sentiment is up 6% this week, driven by faster first-call resolutions.</p></div>
          <Link className="panel-link" to="/calls">Explore call insights <ArrowRight size={15} /></Link>
        </section>
      </div>
      <div className="dashboard-lower-grid">
        <section className="panel recent-panel">
          <div className="panel-heading"><div><h2>Recent calls</h2><p>Your latest customer conversations</p></div><Link className="panel-link" to="/calls">{t('viewAll')} <ArrowRight size={15} /></Link></div>
          <div className="recent-calls-list">
            {recentCalls.slice(0, 4).map((call) => (
              <Link to={`/calls/${call.id}`} className="recent-call-row" key={call.id}>
                <span className={`customer-avatar customer-${call.customerInitials?.slice(0, 1).toLowerCase()}`}>{call.customerInitials}</span>
                <span className="recent-call-person"><strong>{call.customer}</strong><small>{call.topic || 'Customer conversation'} · {call.agent}</small></span>
                <span className="recent-call-date">{formatDateTime(call.date || call.createdAt)}</span>
                <span className="recent-call-score"><Star size={13} fill="currentColor" />{call.score || '—'}{call.score && '%'}</span>
                <StatusBadge>{call.status}</StatusBadge>
              </Link>
            ))}
            {!recentCalls.length && <div className="dashboard-empty-state">No calls are available in your workspace yet.</div>}
          </div>
        </section>
        <section className="panel agents-panel">
          <div className="panel-heading"><div><h2>Top performers</h2><p>Standout agents this week</p></div><MoreHorizontal className="subtle-menu-button" aria-hidden="true" /></div>
          <div className="top-agents-list">
            {topAgents.map((agent, index) => <div className="top-agent-row" key={agent.name}><span className="rank-number">0{index + 1}</span><span className={`user-avatar avatar-${agent.color}`}>{agent.initials}</span><span className="top-agent-info"><strong>{agent.name}</strong><small>{agent.role} · {agent.calls} calls</small></span><span className="top-agent-score"><Star size={13} fill="currentColor" />{agent.score}</span></div>)}
          </div>
          <div className="agent-team-footer"><div className="avatar-stack"><span className="user-avatar avatar-lavender">AJ</span><span className="user-avatar avatar-peach">SP</span><span className="user-avatar avatar-mint">EB</span><span className="user-avatar avatar-navy">+8</span></div><span>Top 3 of 11 agents</span><ArrowUpRight size={15} /></div>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <div className="small-insight-card"><div className="small-insight-icon insight-amber"><MessageCircle size={17} /></div><div><span>RECURRING ISSUE</span><strong>Delivery delays</strong><p>Mentioned in 18 calls this week</p></div><span className="issue-trend"><ArrowUpRight size={14} /> 8%</span></div>
        <div className="small-insight-card"><div className="small-insight-icon insight-blue"><Clock3 size={17} /></div><div><span>AVERAGE HANDLE TIME</span><strong>8m 42s</strong><p>Down 34 seconds this week</p></div><span className="issue-trend issue-down"><ArrowRight size={14} /> 6%</span></div>
        <div className="small-insight-card"><div className="small-insight-icon insight-green"><CheckCircle2 size={17} /></div><div><span>FIRST-CALL RESOLUTION</span><strong>87.3%</strong><p>Above your 85% team target</p></div><span className="issue-trend"><Activity size={14} /> 2.4%</span></div>
      </div>
      <div className="sample-note"><Sparkles size={14} /> Sample analytics are illustrative demo data and are not generated by AI.</div>
    </div>
  );
}
