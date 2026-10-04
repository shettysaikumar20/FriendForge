import React from 'react';
import { Sparkles, Brain, Target, Zap, FileText } from 'lucide-react';

export default function WelcomeSection({ onSelectMode, onSendMessage, isLocalMode }) {
  return (
    <div className="chat-empty-state">
      <div className="empty-state-icon">
        <Zap size={30} />
      </div>
      <h2 className="empty-state-title">What do you want to learn today?</h2>
      <p className="empty-state-desc">
        Upload your study notes or ask any concept question to get started.
      </p>

      <div className="empty-state-suggestions" role="group" aria-label="Suggested study actions">
        <button
          type="button"
          className="suggestion-chip"
          onClick={() => {
            if (onSelectMode) onSelectMode({ id: 'explain', title: 'Explain' });
          }}
        >
          <Sparkles size={14} className="chip-icon explain" />
          <span>Deep dive into a concept</span>
        </button>

        <button
          type="button"
          className="suggestion-chip"
          disabled={isLocalMode}
          title={isLocalMode ? 'Practice requires Online Study mode' : undefined}
          onClick={() => {
            if (onSelectMode) onSelectMode({ id: 'quiz', title: 'Quiz Me' });
          }}
        >
          <Brain size={14} className="chip-icon quiz" />
          <span>Test my understanding {isLocalMode && '(Online only)'}</span>
        </button>

        <button
          type="button"
          className="suggestion-chip"
          disabled={isLocalMode}
          title={isLocalMode ? 'Review requires Online Study mode' : undefined}
          onClick={() => {
            if (onSelectMode) onSelectMode({ id: 'revise', title: 'Revise' });
            if (onSendMessage && !isLocalMode) onSendMessage('Revise my weakest topic', 'revise');
          }}
        >
          <Target size={14} className="chip-icon revise" />
          <span>Focus on weak areas {isLocalMode && '(Online only)'}</span>
        </button>
      </div>

      <div className="empty-state-demo">
        <FileText size={14} />
        <a className="demo-link" href="/demo-notes/dbms-demo-notes.txt" download>
          Download demo DBMS notes
        </a>
        <span className="demo-hint">• Non-sensitive sample for testing RAG</span>
      </div>
    </div>
  );
}
