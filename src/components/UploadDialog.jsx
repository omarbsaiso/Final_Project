import { useState } from 'react';
import { AlertCircle, FileAudio2, FileText, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { createDocument } from '../services/dataService';
import { uploadCallRecording } from '../services/storageService';

const configs = {
  call: {
    title: 'Upload a call recording',
    accept: '.mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm',
    types: 'MP3, WAV, M4A or WebM · Up to 100 MB',
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
  const { language } = usePreferences();
  const text = (arabic, english) => language === 'ar' ? arabic : english;
  const config = configs[kind];
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('Everyone');
  const [category, setCategory] = useState('Guides');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const Icon = config.icon;

  function validateFile(selected) {
    if (!selected) return;
    const audioMimeTypes = {
      '.mp3': ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mpeg-3'],
      '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
      '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
      '.webm': ['audio/webm', 'video/webm'],
    };
    const extension = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase();
    const valid = kind === 'call'
      ? Boolean(audioMimeTypes[extension]?.includes(selected.type.toLowerCase()))
      : /\.(pdf|docx|txt)$/i.test(selected.name);
    const limit = kind === 'call' ? 100 : 25;
    if (!valid) {
      setError(kind === 'call'
        ? text('اختر ملفًا صوتيًا بصيغة MP3 أو WAV أو M4A أو WebM ونوع MIME مطابق.', 'Choose an MP3, WAV, M4A or WebM file with a matching audio MIME type.')
        : text('اختر ملف PDF أو DOCX أو TXT.', 'Choose a PDF, DOCX or TXT document.'));
      setFile(null);
      return;
    }
    if (selected.size > limit * 1024 * 1024) {
      setError(text(`يجب ألا يتجاوز حجم الملف ${limit} ميغابايت.`, `Files must be no larger than ${limit} MB.`));
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
      setError(text('اختر ملفًا قبل المتابعة.', 'Choose a file before continuing.'));
      return;
    }
    setSaving(true);
    setError('');
    setProgress(0);
    try {
      if (kind === 'call') {
        const result = await uploadCallRecording(file, title.trim(), language, setProgress);
        onSaved(result);
        return;
      } else {
        await createDocument({
          name: file.name,
          category,
          size: file.size,
          visibility,
          type: file.name.split('.').pop().toUpperCase(),
          uploadedBy: user.uid,
          team: user.team || 'Customer Care',
          fileStored: false,
        });
      }
      onSaved();
    } catch (uploadError) {
      setError(uploadError.message || text('تعذر حفظ السجل. حاول مجددًا.', 'The record could not be saved. Please try again.'));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="dialog-heading">
          <div className="dialog-icon"><Icon size={20} /></div>
          <div><h2 id="upload-title">{kind === 'call' ? text('رفع تسجيل مكالمة', config.title) : text('إضافة مستند للمعرفة', config.title)}</h2><p>{kind === 'call' ? text('ارفع التسجيل لبدء التفريغ والتحليل تلقائيًا.', 'Upload a recording to start transcription and analysis.') : text('احفظ تفاصيل المورد لفريق الدعم.', 'Save resource details for your support team.')}</p></div>
          <button className="icon-button dialog-close" aria-label={text('إغلاق النافذة', 'Close dialog')} onClick={onClose} disabled={saving}><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="alert alert-info py-2">{kind === 'call'
          ? text('سيُحفظ التسجيل محليًا على الخادم ويبدأ تحليله تلقائيًا.', 'The recording is stored locally on the server and analyzed automatically.')
          : text('تُحفظ تفاصيل المستند فقط؛ لا يتم تخزين الملف المحدد.', 'Only document details are saved; the selected file is not stored.')}</div>
          <label className="form-label" htmlFor="file-title">{kind === 'call' ? text('موضوع المكالمة', 'Call topic') : text('تفاصيل المستند', 'Document details')}</label>
          {kind === 'call' ? (
          <input id="file-title" className="form-control mb-3" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={text('مثال: ترقية الخطة', 'e.g. Plan upgrade')} required />
          ) : (
            <div className="row g-3 mb-3">
              <div className="col-sm-6">
              <label className="form-label" htmlFor="doc-category">{text('الفئة', 'Category')}</label>
                <select id="doc-category" className="form-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="Guides">{text('أدلة', 'Guides')}</option><option value="Policies">{text('سياسات', 'Policies')}</option><option value="FAQs">{text('الأسئلة الشائعة', 'FAQs')}</option><option value="Training">{text('تدريب', 'Training')}</option>
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label" htmlFor="doc-visibility">{text('مستوى الظهور', 'Visibility')}</label>
                <select id="doc-visibility" className="form-select" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                  <option value="Everyone">{text('الجميع', 'Everyone')}</option><option value="Supervisors">{text('المشرفون', 'Supervisors')}</option>
                </select>
              </div>
            </div>
          )}
          <label className={`file-dropzone ${file ? 'file-selected' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={dropFile}>
            <input type="file" accept={config.accept} onChange={chooseFile} hidden />
            <span className="file-drop-icon"><Upload size={19} /></span>
            <strong>{file ? file.name : text('انقر لاختيار ملف أو اسحبه هنا', 'Click to browse or drag a file here')}</strong>
            <span>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : kind === 'call' ? text('MP3 أو WAV أو M4A أو WebM · حتى 100 ميغابايت', config.types) : text('PDF أو DOCX أو TXT · حتى 25 ميغابايت', config.types)}</span>
          </label>
          {saving && kind === 'call' && <div className="mt-3" role="status"><div className="d-flex justify-content-between mb-1"><small>{text('جارٍ رفع التسجيل…', 'Uploading recording…')}</small><small>{progress}%</small></div><div className="progress" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${progress}%` }} /></div></div>}
          {error && <div className="form-error mt-3"><AlertCircle size={16} />{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-light" onClick={onClose} disabled={saving}>{text('إلغاء', 'Cancel')}</button>
            <button type="submit" className="btn btn-primary-custom" disabled={saving}>{saving ? text('جارٍ الحفظ…', 'Saving…') : kind === 'call' ? text('رفع وتحليل المكالمة', 'Upload and analyze') : text('حفظ تفاصيل المستند', 'Save document details')}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
