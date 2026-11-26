
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Headphones, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import UploadDialog from '../components/UploadDialog';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { deleteCall, listCalls } from '../services/dataService';
import { formatDateTime, formatDuration } from '../utils/format';

function dateMillis(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function CallsPage() {
  const { user } = useAuth();
  const { t, language } = usePreferences();
  const isArabic = language === 'ar';
  const text = (arabic, english) => isArabic ? arabic : english;
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
  const [notice, setNotice] = useState(null);
  const callStatuses = useRef(new Map());

  const loadCalls = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);

    try {
      const results = await listCalls(user);

      results.forEach((call) => {
        const previous = callStatuses.current.get(call.id);
        const current = call.processingStatus || '';

        if (previous === 'processing' && current === 'completed') {
          setNotice({
            type: 'success',
            text: language === 'ar'
              ? `اكتمل تحليل المكالمة ${call.id}.`
              : `Analysis completed for call ${call.id}.`
          });
        } else if (previous === 'processing' && current === 'failed') {
          setNotice({
            type: 'warning',
            text: language === 'ar'
              ? `تعذر تحليل المكالمة ${call.id}. يمكنك إعادة المحاولة من تفاصيل المكالمة.`
              : `Call ${call.id} could not be analyzed. Retry from its details page.`
          });
        }

        callStatuses.current.set(call.id, current);
      });

      setCalls(results);
      setError('');
    } catch (loadError) {
      console.error('[CallsPage] Calls load failed:', loadError);

      setError(text(
        'تعذر تحميل المكالمات. تحقق من صلاحيات الحساب والاتصال.',
        'Could not load calls. Check account permissions and connectivity.'
      ));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [user, language]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const hasProcessingCalls = calls.some(
    (call) => call.processingStatus === 'processing'
  );

  useEffect(() => {
    if (!hasProcessingCalls) return undefined;

    const timer = window.setInterval(
      () => loadCalls({ quiet: true }),
      3000
    );

    return () => window.clearInterval(timer);
  }, [hasProcessingCalls, loadCalls]);

  useEffect(() => {
    const value = searchParams.get('search') || '';
    setSearch(value);
  }, [searchParams]);

  async function removeCall(call) {
    const confirmation = language === 'ar'
      ? `هل تريد حذف المكالمة ${call.id} والتسجيل والملاحظات المرتبطة بها؟`
      : `Delete call ${call.id}, its recording, and its feedback?`;

    if (!window.confirm(confirmation)) return;

    setDeletingCallId(call.id);
    setError('');

    try {
      await deleteCall(call, language);
      setCalls((current) => current.filter((item) => item.id !== call.id));
    } catch (deleteError) {
      console.error('[CallsPage] Delete failed:', deleteError);
      setError(deleteError.message || text(
        'تعذر حذف المكالمة.',
        'Could not delete this call.'
      ));
    } finally {
      setDeletingCallId('');
    }
  }

  useEffect(() => {
    const value = searchParams.get('status');
    setStatus(
      ['Reviewed', 'Needs review', 'Processing'].includes(value)
        ? value
        : 'All status'
    );
  }, [searchParams]);

  const filtered = useMemo(() => calls.filter((call) => {
    const searchText = `${call.id} ${call.customer} ${call.agent} ${call.topic}`.toLowerCase();

    return (!search || searchText.includes(search.toLowerCase()))
      && (status === 'All status' || call.status === status)
      && (sentiment === 'All sentiment' || call.sentiment === sentiment);
  }).sort((a, b) => sortNewest
    ? dateMillis(b.date || b.createdAt) - dateMillis(a.date || a.createdAt)
    : dateMillis(a.date || a.createdAt) - dateMillis(b.date || b.createdAt)
  ), [calls, search, status, sentiment, sortNewest]);

  const averageScore = calls.filter((call) => Number.isFinite(call.score));
  const reviewCount = calls.filter((call) => call.status === 'Needs review').length;

  const averageDisplay = averageScore.length
    ? `${Math.round(averageScore.reduce((sum, call) => sum + call.score, 0) / averageScore.length)}%`
    : '—';

  function updateSearch(value) {
    setSearch(value);

    if (value) {
      setSearchParams({ search: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  function exportCalls() {
    const headers = isArabic
      ? ['معرّف المكالمة', 'العميل', 'الموظف', 'التاريخ', 'المدة', 'المشاعر', 'تقييم الجودة', 'الحالة']
      : ['Call ID', 'Customer', 'Agent', 'Date', 'Duration', 'Sentiment', 'QA score', 'Status'];

    const rows = filtered.map((call) => [
      call.id,
      call.customer,
      call.agent,
      call.date || call.createdAt,
      call.duration,
      call.sentiment,
      call.score ?? '',
      call.status
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((field) =>
        `"${String(field ?? '').replace(/"/g, '""')}"`
      ).join(','))
      .join('\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'call-miner-calls.csv';
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow-label">
            {text('مكتبة المكالمات', 'CALL LIBRARY')}
            <span className="eyebrow-dot" />
            {text('الجودة والرؤى', 'QUALITY & INSIGHTS')}
          </div>
          <h1>{text('المكالمات', 'Calls')}</h1>
          <p>{text(
            'راجع المحادثات واكتشف احتياجات عملائك.',
            'Review conversations and discover what matters to your customers.'
          )}</p>
        </div>

        <div className="heading-actions">
          <button className="btn btn-outline-custom" onClick={exportCalls}>
            <Download size={16} />
            {language === 'ar' ? 'تصدير' : 'Export'}
          </button>

          {user?.role === 'Admin' && (
            <button
              className="btn btn-primary-custom"
              onClick={() => setUploadOpen(true)}
            >
              <Plus size={17} />
              {t('uploadCall')}
            </button>
          )}
        </div>
      </div>

      <div className="calls-overview-strip">
        <div>
          <span className="overview-icon overview-icon-blue">
            <Headphones size={17} />
          </span>
          <span>
            <strong>{calls.length}</strong>
            <small>{text('إجمالي التسجيلات', 'Total recordings')}</small>
          </span>
        </div>

        <div>
          <span className="overview-icon overview-icon-orange">
            <Filter size={17} />
          </span>
          <span>
            <strong>{reviewCount}</strong>
            <small>{text('تحتاج إلى مراجعة', 'Need review')}</small>
          </span>
        </div>

        <div>
          <span className="overview-icon overview-icon-green">
            <SlidersHorizontal size={17} />
          </span>
          <span>
            <strong>{averageDisplay}</strong>
            <small>{text('متوسط تقييم الجودة', 'Avg. QA score')}</small>
          </span>
        </div>
      </div>

      <section className="panel calls-panel">
        <div className="calls-toolbar">
          <div className="calls-toolbar-title">
            <h2>
              {text('كل المكالمات', 'All calls')}
              <span>{filtered.length}</span>
            </h2>
            <p>{text(
              'ابحث وصفِّ المكالمات المسجلة وراجعها.',
              'Search, filter and review uploaded recordings.'
            )}</p>
          </div>

          <div className="calls-filters">
            <label className="table-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder={text('ابحث في المكالمات…', 'Search calls…')}
              />
            </label>

            <select
              className="form-select filter-select"
              aria-label={text('تصفية حسب الحالة', 'Filter by status')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="All status">{text('كل الحالات', 'All status')}</option>
              <option value="Reviewed">{text('تمت المراجعة', 'Reviewed')}</option>
              <option value="Needs review">{text('تحتاج مراجعة', 'Needs review')}</option>
              <option value="Processing">{text('قيد المعالجة', 'Processing')}</option>
            </select>

            <select
              className="form-select filter-select"
              aria-label={text('تصفية حسب المشاعر', 'Filter by sentiment')}
              value={sentiment}
              onChange={(event) => setSentiment(event.target.value)}
            >
              <option value="All sentiment">{text('كل المشاعر', 'All sentiment')}</option>
              <option value="Positive">{text('إيجابي', 'Positive')}</option>
              <option value="Neutral">{text('محايد', 'Neutral')}</option>
              <option value="Negative">{text('سلبي', 'Negative')}</option>
              <option value="Pending">{text('قيد الانتظار', 'Pending')}</option>
            </select>
          </div>
        </div>

        {notice && (
          <div className={`alert alert-${notice.type} mx-4`} role="status">
            {notice.text}
          </div>
        )}

        {error && <div className="alert alert-warning mx-4">{error}</div>}

        <div className="table-responsive">
          <table className="table calls-table align-middle mb-0">
            <thead>
              <tr>
                <th>{text('المعرّف', 'CALL ID')}</th>
                <th>{text('العميل', 'CUSTOMER')}</th>
                <th>{text('الموظف', 'AGENT')}</th>
                <th>
                  <button
                    className="sort-button"
                    onClick={() => setSortNewest(!sortNewest)}
                  >
                    {text('التاريخ والوقت', 'DATE & TIME')}
                    <ArrowDownUp size={13} />
                  </button>
                </th>
                <th>{text('المدة', 'DURATION')}</th>
                <th>{text('المشاعر', 'SENTIMENT')}</th>
                <th>{text('تقييم الجودة', 'QA SCORE')}</th>
                <th>{text('الحالة', 'STATUS')}</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">
                    <div className="table-state">
                      <span className="spinner-border spinner-border-sm" />
                      {text('جارٍ تحميل المكالمات…', 'Loading calls…')}
                    </div>
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((call) => (
                  <tr key={call.id}>
                    <td>
                      <Link className="call-id-link" to={`/calls/${call.id}`}>
                        {call.id}
                      </Link>
                    </td>

                    <td>
                      <Link className="customer-cell" to={`/calls/${call.id}`}>
                        <span className="customer-avatar customer-j">
                          {call.customerInitials || call.customer?.slice(0, 2).toUpperCase() || 'NC'}
                        </span>
                        <strong>{call.customer || text('عميل جديد', 'New customer')}</strong>
                      </Link>
                    </td>

                    <td>
                      <span className="agent-cell">{call.agent || '—'}</span>
                    </td>

                    <td>
                      <span className="date-cell">
                        {formatDateTime(call.date || call.createdAt, language)}
                      </span>
                    </td>

                    <td>{formatDuration(call.duration, language)}</td>

                    <td>
                      <span className={`sentiment-pill sentiment-${String(call.sentiment || 'pending').toLowerCase()}`}>
                        <i />
                        {({
                          Positive: text('إيجابي', 'Positive'),
                          Neutral: text('محايد', 'Neutral'),
                          Negative: text('سلبي', 'Negative'),
                          Pending: text('قيد الانتظار', 'Pending')
                        })[call.sentiment] || call.sentiment || text('قيد الانتظار', 'Pending')}
                      </span>
                    </td>

                    <td>
                      {Number.isFinite(call.score) ? (
                        <span className={`qa-score ${call.score >= 90 ? 'score-high' : call.score >= 80 ? 'score-mid' : 'score-low'}`}>
                          {call.score}%
                        </span>
                      ) : (
                        <span className="muted-cell">—</span>
                      )}
                    </td>

                    <td>
                      <StatusBadge language={language}>
                        {call.status}
                      </StatusBadge>
                    </td>

                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <Link
                          className="row-chevron"
                          to={`/calls/${call.id}`}
                          aria-label={text(`عرض ${call.id}`, `View ${call.id}`)}
                        >
                          <ChevronRight size={17} />
                        </Link>

                        {user?.role === 'Admin' && (
                          <button
                            className="row-chevron"
                            aria-label={text(`حذف ${call.id}`, `Delete ${call.id}`)}
                            title={text('حذف المكالمة', 'Delete call')}
                            disabled={deletingCallId === call.id}
                            onClick={() => removeCall(call)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9">
                    <div className="table-empty">
                      <div><Search size={22} /></div>
                      <strong>{text('لم يتم العثور على مكالمات', 'No calls found')}</strong>
                      <span>{text('غيّر البحث أو عوامل التصفية.', 'Try changing your search or filters.')}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            {text('عرض', 'Showing')}
            {' '}
            <strong>{filtered.length ? 1 : 0}–{filtered.length}</strong>
            {' '}
            {text('من', 'of')}
            {' '}
            <strong>{filtered.length}</strong>
            {' '}
            {text('مكالمة', 'calls')}
          </span>

          <div>
            <button disabled aria-label={text('الصفحة السابقة', 'Previous page')}>
              <ChevronLeft size={16} />
            </button>
            <button className="current-page">1</button>
            <button disabled aria-label={text('الصفحة التالية', 'Next page')}>
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </section>

      <div className="calls-footnote">
        <span>
          <span className="footnote-dot" />
          {calls.length} {text('مكالمة في مساحة العمل', 'calls in your workspace')}
        </span>
        <span>{text('آخر تحديث الآن', 'Last updated just now')}</span>
      </div>

      {uploadOpen && (
        <UploadDialog
          kind="call"
          onClose={() => setUploadOpen(false)}
          onSaved={(result) => {
            setUploadOpen(false);

            if (result?.callId) {
              callStatuses.current.set(result.callId, 'processing');
              setNotice({
                type: 'info',
                text: language === 'ar'
                  ? 'تم رفع التسجيل وبدأت معالجته.'
                  : 'Recording uploaded; analysis has started.'
              });
            }

            loadCalls();
          }}
        />
      )}
    </div>
  );
}
