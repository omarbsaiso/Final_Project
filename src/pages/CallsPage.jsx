import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Headphones, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import UploadDialog from '../components/UploadDialog';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { isFirebaseConfigured } from '../firebase/client';
import { demoCalls } from '../data/demoData';
import { deleteCall, listCalls } from '../services/dataService';
import { formatDateTime, formatDuration } from '../utils/format';

export default function CallsPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const demoMode = !isFirebaseConfigured;
  const sampleWorkspace = demoMode;
  const [searchParams, setSearchParams] = useSearchParams();
  const [calls, setCalls] = useState([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'All status');
  const [sentiment, setSentiment] = useState('All sentiment');
  const [sortNewest, setSortNewest] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingCallId, setDeletingCallId] = useState('');
  const [error, setError] = useState('');

  async function loadCalls() {
    setLoading(true);
    try {
      setCalls(await listCalls(user));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load calls.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCalls(); }, [user]);
  useEffect(() => {
    const value = searchParams.get('search') || '';
    setSearch(value);
  }, [searchParams]);

  async function removeCall(call) {
    if (!window.confirm(`Delete call ${call.id} and its feedback?`)) return;
    setDeletingCallId(call.id);
    setError('');
    try {
      await deleteCall(call);
      setCalls((current) => current.filter((item) => item.id !== call.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this call.');
    } finally {
      setDeletingCallId('');
    }
  }
  useEffect(() => {
    const value = searchParams.get('status');
    setStatus(['Reviewed', 'Needs review', 'Processing'].includes(value) ? value : 'All status');
  }, [searchParams]);

  const filtered = useMemo(() => calls.filter((call) => {
    const text = `${call.id} ${call.customer} ${call.agent} ${call.topic}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (status === 'All status' || call.status === status)
      && (sentiment === 'All sentiment' || call.sentiment === sentiment);
  }).sort((a, b) => sortNewest
    ? new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
    : new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0)), [calls, search, status, sentiment, sortNewest]);
  const averageScore = calls.filter((call) => Number.isFinite(call.score));
  const reviewCount = calls.filter((call) => call.status === 'Needs review').length;
  const totalCount = sampleWorkspace ? calls.length || demoCalls.length : calls.length;
  const averageDisplay = averageScore.length
    ? `${Math.round(averageScore.reduce((sum, call) => sum + call.score, 0) / averageScore.length)}%`
    : sampleWorkspace ? '89%' : '—';

  function updateSearch(value) {
    setSearch(value);
    if (value) setSearchParams({ search: value }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  function exportCalls() {
    const headers = ['Call ID', 'Customer', 'Agent', 'Date', 'Duration', 'Sentiment', 'QA score', 'Status'];
    const rows = filtered.map((call) => [call.id, call.customer, call.agent, call.date || call.createdAt, call.duration, call.sentiment, call.score ?? '', call.status]);
    const csv = [headers, ...rows].map((row) => row.map((field) => `"${String(field ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'call-miner-calls.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div><div className="eyebrow-label">CALL LIBRARY <span className="eyebrow-dot" /> QUALITY & INSIGHTS</div><h1>Calls</h1><p>Review conversations and discover what matters to your customers.</p></div>
        <div className="heading-actions"><button className="btn btn-outline-custom" onClick={exportCalls}><Download size={16} />Export</button>{demoMode || user?.role === 'Admin' ? <button className="btn btn-primary-custom" onClick={() => setUploadOpen(true)}><Plus size={17} />{t('uploadCall')}</button> : <button className="btn btn-primary-custom" disabled title="Administrator access is required to upload audio"><Plus size={17} />Audio uploads require Admin</button>}</div>
      </div>
      <div className="calls-overview-strip">
        <div><span className="overview-icon overview-icon-blue"><Headphones size={17} /></span><span><strong>{totalCount}</strong><small>Total recordings</small></span></div>
        <div><span className="overview-icon overview-icon-orange"><Filter size={17} /></span><span><strong>{sampleWorkspace ? reviewCount || 2 : reviewCount}</strong><small>Need review</small></span></div>
        <div><span className="overview-icon overview-icon-green"><SlidersHorizontal size={17} /></span><span><strong>{averageDisplay}</strong><small>Avg. QA score</small></span></div>
      </div>
      <section className="panel calls-panel">
        <div className="calls-toolbar">
          <div className="calls-toolbar-title"><h2>All calls <span>{filtered.length}</span></h2><p>Search, filter and review your recordings</p></div>
          <div className="calls-filters">
            <label className="table-search"><Search size={16} /><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search calls…" /></label>
            <select className="form-select filter-select" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All status</option><option>Reviewed</option><option>Needs review</option><option>Processing</option></select>
            <select className="form-select filter-select" aria-label="Filter by sentiment" value={sentiment} onChange={(event) => setSentiment(event.target.value)}><option>All sentiment</option><option>Positive</option><option>Neutral</option><option>Negative</option><option>Pending</option></select>
          </div>
        </div>
        {error && <div className="alert alert-warning mx-4">{error}</div>}
        <div className="table-responsive">
          <table className="table calls-table align-middle mb-0">
            <thead><tr><th>CALL ID</th><th>CUSTOMER</th><th>AGENT</th><th><button className="sort-button" onClick={() => setSortNewest(!sortNewest)}>DATE & TIME <ArrowDownUp size={13} /></button></th><th>DURATION</th><th>SENTIMENT</th><th>QA SCORE</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="9"><div className="table-state"><span className="spinner-border spinner-border-sm" /> Loading calls…</div></td></tr>
                : filtered.length ? filtered.map((call) => <tr key={call.id}>
                  <td><Link className="call-id-link" to={`/calls/${call.id}`}>{call.id}</Link></td>
                  <td><Link className="customer-cell" to={`/calls/${call.id}`}><span className="customer-avatar customer-j">{call.customerInitials || call.customer?.slice(0, 2).toUpperCase() || 'NC'}</span><strong>{call.customer || 'New customer'}</strong></Link></td>
                  <td><span className="agent-cell">{call.agent}</span></td>
                  <td><span className="date-cell">{formatDateTime(call.date || call.createdAt)}</span></td>
                  <td>{formatDuration(call.duration)}</td>
                  <td><span className={`sentiment-pill sentiment-${String(call.sentiment || 'pending').toLowerCase()}`}><i />{call.sentiment || 'Pending'}</span></td>
                  <td>{Number.isFinite(call.score) ? <span className={`qa-score ${call.score >= 90 ? 'score-high' : call.score >= 80 ? 'score-mid' : 'score-low'}`}>{call.score}%</span> : <span className="muted-cell">—</span>}</td>
                  <td><StatusBadge>{call.status}</StatusBadge></td>
                  <td><div className="d-flex align-items-center gap-2"><Link className="row-chevron" to={`/calls/${call.id}`} aria-label={`View ${call.id}`}><ChevronRight size={17} /></Link>{user?.role === 'Admin' && <button className="row-chevron" aria-label={`Delete ${call.id}`} title="Delete call" disabled={deletingCallId === call.id} onClick={() => removeCall(call)}><Trash2 size={16} /></button>}</div></td>
                </tr>) : <tr><td colSpan="9"><div className="table-empty"><div><Search size={22} /></div><strong>No calls found</strong><span>Try changing your search or filters, or upload a recording.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{filtered.length ? 1 : 0}–{filtered.length}</strong> of <strong>{filtered.length}</strong> calls</span><div><button disabled aria-label="Previous page"><ChevronLeft size={16} /></button><button className="current-page">1</button><button disabled aria-label="Next page"><ChevronDown size={16} /></button></div></div>
      </section>
      <div className="calls-footnote"><span><span className="footnote-dot" />{calls.length} calls in your workspace</span><span>Last updated just now</span></div>
      {uploadOpen && <UploadDialog kind="call" onClose={() => setUploadOpen(false)} onSaved={() => { setUploadOpen(false); loadCalls(); }} />}
    </div>
  );
}
