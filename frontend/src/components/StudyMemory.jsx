import { apiFetch } from '../api';
import React, { useEffect, useState } from 'react';
import { Bookmark, Trash2, RotateCcw } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function StudyMemory({ refreshKey = 0, disabled = false, onBusyChange = () => {}, isLocalMode = false }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isLocalMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch(API + '/api/memory')
      .then(async res => {
        if (!res.ok) throw new Error('Study memory is unavailable. Please retry.');
        return res.json();
      })
      .then(data => {
        if (!cancelled) setMemories(data.memories);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey, retry, isLocalMode]);

  async function clear() {
    if (clearing || disabled || isLocalMode) return;
    setClearing(true);
    onBusyChange(true);
    setError('');
    try {
      const response = await apiFetch(API + '/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      if (!response.ok) throw new Error('Could not clear all study memory. Please retry.');
      setMemories([]);
      setConfirmClear(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
      onBusyChange(false);
    }
  }

  if (isLocalMode) {
    return (
      <section className="sidebar-section mode-disabled" aria-label="Study memory">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">STUDY MEMORY</span>
        </div>
        <div className="sidebar-note-box disabled-box">
          <p className="unavailable-text" role="status">
            Persistent Backboard study memory is unavailable in Local AI mode. Switch to Online Study to view and update saved memory.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="sidebar-section" aria-label="Study memory" aria-busy={loading}>
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">STUDY MEMORY</span>
      </div>

      {loading ? (
        <p className="sidebar-empty-text" role="status">Loading study memory...</p>
      ) : error ? (
        <div className="sidebar-error-box">
          <p role="alert" className="sidebar-error-text">{error}</p>
          <button type="button" className="browse-btn retry-btn" onClick={() => setRetry(v => v + 1)}>
            <RotateCcw size={12} />
            <span>Retry memory</span>
          </button>
        </div>
      ) : memories.length === 0 ? (
        <p className="sidebar-empty-text">No study memory yet. Tell FriendForge what you want to practice or what you now understand.</p>
      ) : (
        <div className="memory-list">
          {memories.map(item => (
            <div key={item.id} className="memory-item">
              <div className="memory-topic-wrap">
                <Bookmark size={13} className="memory-icon" />
                <span className="memory-topic">{item.subject}: {item.topic}</span>
              </div>
              <span className={'status-tag ' + ({ 'Needs practice': 'warning', Reviewing: 'info', Strong: 'success' }[item.status])}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && memories.length > 0 && !confirmClear && (
        <button 
          type="button"
          className="browse-btn clear-memory-btn" 
          disabled={disabled} 
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 size={13} style={{ marginRight: '5px' }} />
          Clear study memory
        </button>
      )}

      {confirmClear && (
        <div role="alertdialog" aria-label="Confirm clearing study memory" className="memory-confirm">
          <p className="confirm-text">Delete saved study topics and progress? This cannot be undone. Chat history and uploaded notes are not deleted.</p>
          <div className="confirm-buttons">
            <button className="browse-btn confirm-delete-btn" disabled={clearing || disabled} onClick={clear}>
              {clearing ? 'Clearing...' : 'Delete saved memory'}
            </button>
            <button className="browse-btn confirm-cancel-btn" disabled={clearing} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
