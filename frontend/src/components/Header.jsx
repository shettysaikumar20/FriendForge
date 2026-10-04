import React from 'react';
import { Zap, Cpu, Wifi } from 'lucide-react';

export default function Header({ activeModel, aiMode = 'online', onSelectAiMode = () => {}, localStatus = {} }) {
  const isOnline = aiMode === 'online';
  
  const onlineModelText = activeModel 
    ? `Open-weight AI • ${activeModel.name || 'meta-llama/llama-3.1-8b-instruct'} • Backboard`
    : `Open-weight AI • Powered by Backboard`;

  const localModelText = 'Local AI • Gemma 3 4B • Runs locally through Ollama';

  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-icon">
          <Zap size={20} />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">FriendForge</h1>
          <span className="brand-subtitle">An AI study companion built for a friend</span>
        </div>
      </div>

      <div className="header-controls">
        <div className="ai-mode-selector" role="group" aria-label="AI Mode">
          <button
            type="button"
            className={`mode-toggle-btn ${isOnline ? 'active' : ''}`}
            onClick={() => onSelectAiMode('online')}
            aria-pressed={isOnline}
          >
            <Wifi size={13} style={{ marginRight: '5px' }} />
            Online Study
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${!isOnline ? 'active' : ''}`}
            onClick={() => onSelectAiMode('local')}
            aria-pressed={!isOnline}
          >
            <Cpu size={13} style={{ marginRight: '5px' }} />
            Local AI
          </button>
        </div>

        <div className={`header-badge ${isOnline ? 'online-badge' : 'local-badge'}`} title={isOnline ? onlineModelText : localModelText}>
          <span 
            className="badge-dot"
            style={!isOnline ? { backgroundColor: localStatus.available ? '#34d399' : '#f87171' } : undefined}
          ></span>
          <span className="badge-text">{isOnline ? onlineModelText : localModelText}</span>
        </div>
      </div>
    </header>
  );
}
