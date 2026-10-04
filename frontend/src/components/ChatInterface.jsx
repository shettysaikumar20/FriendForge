import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Zap, Cpu, FileText } from 'lucide-react';
import ExplanationAudioPlayer from './ExplanationAudioPlayer';
import WelcomeSection from './WelcomeSection';
import StudyModes from './StudyModes';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  isLoading, 
  activeMode, 
  activeModeTitle, 
  onSelectMode, 
  aiMode,
  isLocalMode = false,
  disabled = false
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-container">
      {/* Messages Feed */}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Study conversation">
        <div className="conversation-feed-inner">
          {messages.length === 0 ? (
            <WelcomeSection 
              onSelectMode={onSelectMode} 
              onSendMessage={onSendMessage} 
              isLocalMode={isLocalMode} 
            />
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.sender}`}>
                {msg.sender === 'student' ? (
                  <div className="user-message-container">
                    <span className="message-author-label">You</span>
                    <div className="bubble-content user-bubble">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="assistant-message-container">
                    <div className="assistant-author-row">
                      <div className="assistant-avatar">
                        <Zap size={14} />
                      </div>
                      <span className="assistant-name">FriendForge</span>
                      {activeModeTitle && (
                        <span className="assistant-mode-pill">{activeModeTitle}</span>
                      )}
                    </div>

                    <div className="assistant-content-body markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children, ...props }) => {
                            const isSafe = /^https?:\/\//i.test(href || '') || /^\//.test(href || '') || /^#/.test(href || '');
                            if (!isSafe) {
                              return <span>{children}</span>;
                            }
                            return (
                              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                {children}
                              </a>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Retrieved Sources Citation Badge */}
                    {msg.retrievedFiles && msg.retrievedFiles.length > 0 && (
                      <div className="retrieved-sources-badge">
                        <FileText size={12} />
                        <span>
                          Source: {msg.retrievedFiles.join(', ')}
                          {msg.sourceContext === 'earlier' ? ' (earlier retrieval in this session)' : ''}
                        </span>
                      </div>
                    )}

                    {/* Model Metadata */}
                    {msg.modelName && (
                      <div className="bubble-meta">
                        <Cpu size={12} />
                        <span>{msg.modelName}</span>
                        {msg.usage?.totalTokens ? <span>• {msg.usage.totalTokens} tokens</span> : null}
                      </div>
                    )}

                    {/* ElevenLabs Explanation Audio Player */}
                    {msg.content && (
                      <ExplanationAudioPlayer
                        text={msg.content}
                        messageId={msg.id}
                        aiMode={aiMode}
                        isLocal={Boolean(msg.local)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading / Thinking State */}
          {isLoading && (
            <div className="message-row assistant">
              <div className="assistant-message-container">
                <div className="assistant-author-row">
                  <div className="assistant-avatar">
                    <Zap size={14} />
                  </div>
                  <span className="assistant-name">FriendForge</span>
                </div>
                <div className="typing-dots" role="status" aria-label={activeModeTitle ? `Preparing ${activeModeTitle}` : 'Thinking'}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Docked Composer Area */}
      <div className="chat-composer-dock">
        <div className="composer-inner">
          {/* Study Modes Segmented Toolbar directly above the input capsule */}
          <StudyModes 
            disabled={disabled || isLoading}
            isLocalMode={isLocalMode}
            activeMode={activeMode}
            onSelectMode={onSelectMode}
          />

          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              type="text"
              className="chat-input"
              aria-label="Study question or quiz topic"
              maxLength={6000}
              placeholder={
                activeMode === 'quiz' 
                  ? 'Type a topic to generate 5 quiz questions...' 
                  : activeMode === 'revise'
                  ? 'Ask to revise your weak topics or specify a subject...'
                  : 'Ask anything about your studies or uploaded notes...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="send-btn"
              disabled={!inputText.trim() || isLoading}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>

          <p className="composer-disclaimer">
            FriendForge can make mistakes. Verify important concepts with your uploaded study notes.
          </p>
        </div>
      </div>
    </div>
  );
}
