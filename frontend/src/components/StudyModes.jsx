import React from 'react';
import { Sparkles, Brain, RefreshCw, HelpCircle } from 'lucide-react';
import { STUDY_MODES } from '../data/studyConfig';

export default function StudyModes({ activeMode, onSelectMode, disabled, isLocalMode = false }) {
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'HelpCircle': return <Sparkles size={14} />;
      case 'Brain': return <Brain size={14} />;
      case 'RefreshCw': return <RefreshCw size={14} />;
      default: return <HelpCircle size={14} />;
    }
  };

  return (
    <div className="study-modes-bar" role="toolbar" aria-label="Study modes">
      <span className="modes-label">Study Mode:</span>
      <div className="modes-chips">
        {STUDY_MODES.map((mode) => {
          const isUnsupportedInLocal = isLocalMode && (mode.id === 'quiz' || mode.id === 'revise');
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled || isUnsupportedInLocal}
              aria-pressed={isActive}
              className={`mode-chip ${mode.accentColor} ${isActive ? 'active' : ''} ${isUnsupportedInLocal ? 'mode-disabled' : ''}`}
              onClick={() => onSelectMode(mode)}
              title={
                isUnsupportedInLocal
                  ? `${mode.title} requires Online Study mode.`
                  : mode.tagline
              }
            >
              <span className="chip-icon-wrap">{getIcon(mode.iconName)}</span>
              <span className="chip-text">{mode.title}</span>
              {isUnsupportedInLocal && <span className="mode-lock-tag">Online only</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
