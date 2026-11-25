import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, FileText, MoreHorizontal, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import UploadDialog from '../components/UploadDialog';
import { useAuth } from '../context/AuthContext';
import { listDocuments, removeDocument } from '../services/dataService';
import { formatDateTime, formatFileSize } from '../utils/format';

const categoryIcons = { Guides: 'G', Policies: 'P', FAQs: 'F', Training: 'T' };

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [category, setCategory] = useState('All resources');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const canManage = ['Admin', 'Supervisor'].includes(user.role);
  const resourceCount = documents.length;

  async function loadDocuments() {
    setLoading(true);
    try {
      setDocuments(await listDocuments(user));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load knowledge documents.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocuments(); }, [user]);
  const filtered = useMemo(() => documents.filter((document) =>
    (category === 'All resources' || document.category === category)
    && document.name.toLowerCase().includes(search.toLowerCase())), [documents, category, search]);

  async function deleteDocument(document) {
    if (!window.confirm(`Delete “${document.name}” from the knowledge base?`)) return;
    try {
      await removeDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete the document.');
    }
  }

  return (
    <div className="page-enter">
      <div className="page-heading">
        <div><div className="eyebrow-label">TEAM RESOURCES <span className="eyebrow-dot" /> KNOWLEDGE</div><h1>Knowledge base</h1><p>A shared library of answers, policies, and guidance for your team.</p></div>
        {canManage && <button className="btn btn-primary-custom" onClick={() => setUploadOpen(true)}><Plus size={17} />Add document</button>}
      </div>
      <div className="knowledge-hero">
        <div className="knowledge-hero-icon"><BookOpen size={22} /></div><div><strong>Good answers start with shared knowledge.</strong><p>Keep your team aligned with the latest resources, policies, and product guidance.</p></div><div className="knowledge-hero-meta"><span><FileText size={16} />{resourceCount} resources</span><span><ShieldCheck size={16} />Role-based access</span></div>
      </div>
      {error && <div className="alert alert-warning">{error}</div>}
      <section className="panel knowledge-panel">
        <div className="knowledge-toolbar"><div className="knowledge-category-tabs">{['All resources', 'Guides', 'Policies', 'FAQs', 'Training'].map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}{item === 'All resources' && <span>{documents.length}</span>}</button>)}</div><label className="table-search"><Search size={16} /><input placeholder="Search resources…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className="knowledge-grid">
          {loading ? <div className="table-state"><span className="spinner-border spinner-border-sm" /> Loading documents…</div>
            : filtered.length ? filtered.map((document) => <article className="knowledge-card" key={document.id}>
              <div className="knowledge-card-top"><div className={`document-icon document-${document.type?.toLowerCase()}`}>{document.type === 'PDF' ? <FileText size={22} /> : <span>{document.type}</span>}</div><button className="subtle-menu-button" onClick={() => setSelectedDocument(document)} aria-label={`Details for ${document.name}`}><MoreHorizontal size={19} /></button></div>
              <span className="knowledge-category">{document.category || 'Resource'}</span><h2>{document.name}</h2><div className="document-meta"><span>{formatFileSize(document.size)}</span><i /><span>{formatDateTime(document.uploadedAt)}</span></div>
              <div className="document-card-footer"><StatusBadge>{document.visibility}</StatusBadge><div className="document-actions">{document.downloadUrl && <a href={document.downloadUrl} target="_blank" rel="noreferrer" aria-label={`Download ${document.name}`}><Download size={16} /></a>}{canManage && (user.role === 'Admin' || !document.team || document.team === user.team) && <button onClick={() => deleteDocument(document)} aria-label={`Delete ${document.name}`}><Trash2 size={16} /></button>}</div></div>
            </article>) : <div className="knowledge-empty"><BookOpen size={22} /><strong>No resources found</strong><span>Try a different search or category.</span></div>}
        </div>
        <div className="knowledge-footer"><span>Showing {filtered.length} of {documents.length} resources</span><span><ShieldCheck size={14} /> Shared with your role</span></div>
      </section>
      {uploadOpen && <UploadDialog kind="document" onClose={() => setUploadOpen(false)} onSaved={() => { setUploadOpen(false); loadDocuments(); }} />}
      {selectedDocument && <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedDocument(null)}><section className="upload-dialog document-details-dialog" role="dialog" aria-modal="true"><div className="dialog-heading"><div className="dialog-icon"><FileText size={20} /></div><div><h2>Resource details</h2><p>{selectedDocument.category || 'Team resource'}</p></div><button className="icon-button dialog-close" onClick={() => setSelectedDocument(null)} aria-label="Close details">×</button></div><h3>{selectedDocument.name}</h3><div className="resource-detail-list"><span>File type <strong>{selectedDocument.type}</strong></span><span>File size <strong>{formatFileSize(selectedDocument.size)}</strong></span><span>Uploaded <strong>{formatDateTime(selectedDocument.uploadedAt)}</strong></span><span>Visibility <strong>{selectedDocument.visibility}</strong></span></div>{selectedDocument.downloadUrl && <a className="btn btn-primary-custom mt-3" href={selectedDocument.downloadUrl} target="_blank" rel="noreferrer"><Download size={16} />Open file</a>}</section></div>}
    </div>
  );
}
