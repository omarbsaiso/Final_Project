import { useState } from 'react';
import { AlertCircle, FileAudio2, FileText, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createCall, createDocument } from '../services/dataService';
import { deleteStoredFile, uploadFile } from '../services/storageService';

const configs = {
  call: {
    title: 'Upload a call recording',
    accept: '.mp3,.wav,audio/mpeg,audio/wav,audio/x-wav',
    types: 'MP3 or WAV · Up to 100 MB',
    icon: FileAudio2,
  },
  document: {
    title: 'Add a knowledge document',
    accept: '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    types: 'PDF, DOCX or TXT · Up to 25 MB',
    icon: FileText,
  },
};

export default function UploadDialog({ kind, onClose, onSaved }) {
  const { user } = useAuth();
  const config = configs[kind];
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('Everyone');
  const [category, setCategory] = useState('Guides');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const Icon = config.icon;

  function validateFile(selected) {
    if (!selected) return;
    const valid = kind === 'call'
      ? /\.(mp3|wav)$/i.test(selected.name)
      : /\.(pdf|docx|txt)$/i.test(selected.name);
    const limit = kind === 'call' ? 100 : 25;
    if (!valid) {
      setError(kind === 'call' ? 'Choose an MP3 or WAV recording.' : 'Choose a PDF, DOCX or TXT document.');
      setFile(null);
      return;
    }
    if (selected.size > limit * 1024 * 1024) {
      setError(`Files must be smaller than ${limit} MB.`);
      setFile(null);
      return;
    }
    setError('');
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, ''));
  }

  function chooseFile(event) {
    validateFile(event.target.files?.[0]);
  }

  function dropFile(event) {
    event.preventDefault();
    validateFile(event.dataTransfer.files?.[0]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file before continuing.');
      return;
    }
    setSaving(true);
    setError('');
    let uploadedPath = '';
    try {
      const { url, path } = await uploadFile(file, kind === 'call' ? 'calls' : 'knowledge', user.uid, visibility, user.team || 'Customer Care');
      uploadedPath = path;
      if (kind === 'call') {
        await createCall({
          customer: 'New customer',
          customerInitials: 'NC',
          agent: user.name,
          agentId: user.uid,
          team: user.team || 'Customer Care',
          date: new Date().toISOString(),
          duration: '—',
          channel: 'Inbound',
          sentiment: 'Pending',
          score: null,
          status: 'Processing',
          topic: title.trim(),
          summary: 'Analysis is pending. AI analysis has not run for this recording yet.',
          audioUrl: url,
          storagePath: path,
        });
      } else {
        await createDocument({
          name: file.name,
          category,
          size: file.size,
          visibility,
          type: file.name.split('.').pop().toUpperCase(),
          uploadedBy: user.uid,
          storagePath: path,
          downloadUrl: url,
          team: user.team || 'Customer Care',
        });
      }
      onSaved();
    } catch (uploadError) {
      let message = uploadError.message || 'The upload could not be completed. Please try again.';
      if (uploadedPath) {
        try {
          await deleteStoredFile(uploadedPath);
        } catch (cleanupError) {
          message = `${message} The uploaded file could not be removed: ${cleanupError.message}`;
        }
      }
      setError(message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <div className="dialog-heading">
          <div className="dialog-icon"><Icon size={20} /></div>
          <div><h2 id="upload-title">{config.title}</h2><p>{kind === 'call' ? 'Add a recording to your call library.' : 'Share a resource with your support team.'}</p></div>
          <button className="icon-button dialog-close" aria-label="Close dialog" onClick={onClose} disabled={saving}><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="file-title">{kind === 'call' ? 'Call topic' : 'Document details'}</label>
          {kind === 'call' ? (
            <input id="file-title" className="form-control mb-3" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Plan upgrade" required />
          ) : (
            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <label className="form-label" htmlFor="doc-category">Category</label>
                <select id="doc-category" className="form-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option>Guides</option><option>Policies</option><option>FAQs</option><option>Training</option>
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label" htmlFor="doc-visibility">Visibility</label>
                <select id="doc-visibility" className="form-select" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                  <option>Everyone</option><option>Supervisors</option>
                </select>
              </div>
            </div>
          )}
          <label className={`file-dropzone ${file ? 'file-selected' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={dropFile}>
            <input type="file" accept={config.accept} onChange={chooseFile} hidden />
            <span className="file-drop-icon"><Upload size={19} /></span>
            <strong>{file ? file.name : 'Click to browse or drag a file here'}</strong>
            <span>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : config.types}</span>
          </label>
          {error && <div className="form-error mt-3"><AlertCircle size={16} />{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-light" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary-custom" disabled={saving}>{saving ? 'Uploading…' : 'Upload file'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
