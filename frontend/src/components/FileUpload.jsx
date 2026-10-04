import { apiFetch } from '../api';
import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function FileUpload({ threadId, disabled, onBusyChange, onThreadCreated, onUploadSuccess, onUploadError, isLocalMode = false }) {
  const [phase, setPhase] = useState('empty');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const input = useRef(null);
  const lock = useRef(false);

  async function waitForIndex(document) {
    setPhase('indexing');
    for (let attempt = 0; attempt < 60; attempt++) {
      if (document.status === 'indexed') {
        setPhase('ready');
        setPending(null);
        onUploadSuccess({ document, threadId: document.threadId });
        return;
      }
      if (['failed', 'error'].includes(document.status)) {
        throw new Error('These notes could not be indexed. Try a text-based PDF or TXT file.');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = await apiFetch(`${API}/api/documents/${document.id}/status`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not check indexing. Retry the status check.');
      document = data.document;
    }
    throw new Error('Indexing is taking longer than expected. Check again in a moment.');
  }

  async function process(file, retry = false) {
    if (lock.current || disabled || isLocalMode) return;
    if (!retry && (!file || !/\.(pdf|txt)$/i.test(file.name) || file.size === 0 || file.size > 10 * 1024 * 1024)) {
      setError('Choose a non-empty PDF or TXT file, up to 10 MB.');
      setPhase('failed');
      return;
    }
    lock.current = true;
    onBusyChange(true);
    setError('');
    try {
      let document = pending;
      if (!retry) {
        setName(file.name);
        setPhase('uploading');
        setPending(null);
        const form = new FormData();
        form.append('document', file);
        if (threadId) form.append('threadId', threadId);
        const response = await apiFetch(`${API}/api/documents/upload`, { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Upload failed. Please try again.');
        document = { ...data.document, threadId: data.threadId };
        setPending(document);
        onThreadCreated(data.threadId);
      }
      await waitForIndex(document);
    } catch (err) {
      const message = err.message || 'Connection failed. Please try again.';
      setError(message);
      setPhase('failed');
      onUploadError(message);
    } finally {
      lock.current = false;
      onBusyChange(false);
      if (input.current) input.current.value = '';
    }
  }

  const busy = phase === 'uploading' || phase === 'indexing';

  return (
    <section 
      className={`sidebar-section upload-section ${isLocalMode ? 'mode-disabled' : ''}`} 
      aria-label="Upload study notes" 
      aria-busy={busy}
      onDragOver={e => e.preventDefault()} 
      onDrop={e => { 
        e.preventDefault(); 
        if (!isLocalMode) process(e.dataTransfer.files[0]); 
      }}
    >
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">STUDY NOTES</span>
        <span className="sidebar-section-badge">PDF / TXT</span>
      </div>

      {isLocalMode ? (
        <div className="sidebar-note-box disabled-box">
          <p role="status" className="unavailable-text">
            Uploaded-note RAG and document grounding are unavailable in Local AI mode. Switch to Online Study to upload notes.
          </p>
          <button type="button" className="browse-btn" disabled={true} title="Switch to Online Study to upload notes">
            Choose notes (Online only)
          </button>
        </div>
      ) : (
        <div className="sidebar-upload-container">
          <input 
            ref={input} 
            type="file" 
            accept=".pdf,.txt" 
            aria-label="Choose study notes" 
            hidden 
            onChange={e => process(e.target.files[0])} 
            disabled={busy || disabled} 
          />

          {name && (
            <div className="upload-active-file">
              <FileText size={14} className="file-icon" />
              <span className="upload-filename" title={name}>{name}</span>
            </div>
          )}

          <div className="upload-status-row">
            {phase === 'ready' && <CheckCircle2 size={13} className="status-icon ready" />}
            {busy && <Loader2 size={13} className="status-icon spin" />}
            {phase === 'failed' && <AlertCircle size={13} className="status-icon failed" />}
            <p role="status" className="upload-status-text">
              {({
                empty: 'No notes yet. Upload a file to ground your questions.',
                uploading: 'Uploading...',
                indexing: 'Indexing your notes...',
                ready: 'Indexed and ready',
                failed: 'Upload or indexing needs attention'
              })[phase]}
            </p>
          </div>

          {error && <p role="alert" className="upload-error-alert">{error}</p>}

          <div className="upload-actions-row">
            <button 
              type="button" 
              className="browse-btn" 
              disabled={busy || disabled} 
              onClick={() => input.current.click()}
            >
              <UploadCloud size={14} />
              <span>Choose notes</span>
            </button>

            {pending && phase === 'failed' && (
              <button type="button" className="browse-btn retry-btn" disabled={disabled} onClick={() => process(null, true)}>
                Check indexing again
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
