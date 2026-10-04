import { apiFetch } from './api';
import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import Quiz from './components/Quiz';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import StudyMemory from './components/StudyMemory';
import ChatInterface from './components/ChatInterface';
import { INITIAL_CHAT_MESSAGES } from './data/studyConfig';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const chatLock = useRef(false);
  const [aiMode, setAiMode] = useState('online');
  const [localStatus, setLocalStatus] = useState({ available: false, checked: false, message: 'Checking Local AI...' });
  const [uploadBusy, setUploadBusy] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const [memoryRefresh, setMemoryRefresh] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [messages, setMessages] = useState(INITIAL_CHAT_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [activeModel, setActiveModel] = useState(null);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ connected: false, message: 'Checking API...' });

  const checkLocalStatus = () => {
    apiFetch(`${API_BASE_URL}/api/local-ai/status`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Local status unavailable');
      })
      .then((data) => {
        setLocalStatus({
          available: Boolean(data.available),
          checked: true,
          message: data.available
            ? 'Gemma 3 4B is ready locally.'
            : 'Local AI is unavailable. Start Ollama and make sure gemma3:4b is installed.'
        });
      })
      .catch(() => {
        setLocalStatus({
          available: false,
          checked: true,
          message: 'Local AI is unavailable. Start Ollama and make sure gemma3:4b is installed.'
        });
      });
  };

  // Check Backend Health & Local Status on startup
  useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/health`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Health check failed');
      })
      .then((data) => {
        setBackendStatus({
          connected: true,
          message: `${data.service} Connected (${data.status.toUpperCase()})`
        });
      })
      .catch(() => setBackendStatus({ connected: false, message: 'Study service is unavailable. Please try again shortly.' }));

    apiFetch(API_BASE_URL + '/api/config')
      .then((res) => res.json())
      .then((data) => { if (data.model) setActiveModel(data.model); })
      .catch(() => {});

    checkLocalStatus();
  }, []);

  const handleSelectAiMode = (newMode) => {
    setAiMode(newMode);
    if (newMode === 'local') {
      if (activeMode?.id === 'quiz' || activeMode?.id === 'revise') {
        setActiveMode(null);
        setQuiz(null);
      }
      checkLocalStatus();
    }
  };

  const handleDocumentSuccess = ({ document, threadId: newThreadId }) => {
    if (newThreadId) {
      setThreadId(newThreadId);
    }
    setHasDocuments(true);

    const docNotice = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      content: `📄 Uploaded **${document.name}** successfully! Your notes are now indexed on Backboard RAG. Feel free to ask any questions grounded in this study material.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, docNotice]);
  };

  const handleDocumentError = (errorMsg) => {
    const errorNotice = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      content: `⚠️ Upload Warning: ${errorMsg}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, errorNotice]);
  };

  const handleSelectMode = (mode) => {
    if (aiMode === 'local' && (mode.id === 'quiz' || mode.id === 'revise')) {
      return;
    }
    setActiveMode(mode.id === activeMode?.id ? null : mode);
    if (mode.id === 'revise' && !isLoading && aiMode === 'online') {
      handleSendMessage('Revise my weakest topic', 'revise');
    }
  };

  const handleSendMessage = async (text, requestedMode) => {
    if (chatLock.current || uploadBusy || quizBusy || memoryBusy) return;
    chatLock.current = true;
    const mode = requestedMode || activeMode?.id || 'chat';

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'student',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // MODE 2: LOCAL AI (Ollama + Gemma 3 4B)
    if (aiMode === 'local') {
      try {
        const localHistory = messages
          .filter(m => m.sender === 'student' || m.sender === 'assistant')
          .slice(-8)
          .map(m => ({
            role: m.sender === 'student' ? 'user' : 'assistant',
            content: m.content
          }));
        localHistory.push({ role: 'user', content: text });

        const response = await apiFetch(`${API_BASE_URL}/api/local-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: text,
            messages: localHistory
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Local AI is unavailable. Make sure Ollama is running and gemma3:4b is installed.');
        }

        const assistantMsg = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          content: data.content || data.message || '',
          modelName: data.model?.name || 'gemma3:4b',
          provider: 'ollama',
          local: true,
          // CRITICAL: NEVER fabricate source citations in Local AI mode
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (error) {
        console.error('[Local AI Chat Error]:', error);
        const errorMsg = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          content: `⚠️ ${error.message || 'Local AI is unavailable. Make sure Ollama is running and gemma3:4b is installed.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        chatLock.current = false;
        setIsLoading(false);
      }
      return;
    }

    // MODE 1: ONLINE STUDY (Backboard + OpenRouter + Llama 3.1)
    try {
      const route = mode === 'quiz' ? 'quiz' : mode === 'revise' ? 'revise' : 'chat';
      const targetUrl = `${API_BASE_URL}/api/${route}`;

      const response = await apiFetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          mode,
          threadId: threadId,
          hasDocuments: hasDocuments
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to get AI response from FriendForge backend');
      }

      // Update session threadId and active model metadata
      if (data.threadId) {
        setThreadId(data.threadId);
      }
      if (data.model) {
        setActiveModel(data.model);
      }

      if (data.quiz) setQuiz(data.quiz);
      const assistantMsg = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: (data.content || 'Your quiz is ready below. Choose an answer, then submit to see the explanation.') + (data.memoryWarning ? '\n\n' + data.memoryWarning : ''),
        modelName: data.model?.name,
        retrievedFiles: data.retrievedFiles,
        sourceContext: data.sourceContext,
        usage: data.usage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('[Chat Integration Error]:', error);
      const errorMsg = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: `⚠️ ${error.message || 'Unable to communicate with FriendForge AI service. Please check your backend connection.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      chatLock.current = false;
      setIsLoading(false);
      setMemoryRefresh(v => v + 1);
    }
  };

  const isLocal = aiMode === 'local';

  return (
    <div className="app-layout">
      <Header 
        activeModel={activeModel} 
        aiMode={aiMode} 
        onSelectAiMode={handleSelectAiMode} 
        localStatus={localStatus} 
      />

      <main className="main-workspace">
        {/* Left Sidebar */}
        <aside className="workspace-sidebar" aria-label="Study sidebar">
          <div className="sidebar-action-top">
            <button 
              className="new-session-btn" 
              disabled={isLoading || quizBusy || uploadBusy || memoryBusy} 
              onClick={() => {
                setThreadId(null);
                setMessages([]);
                setHasDocuments(false);
                setQuiz(null);
                setActiveMode(null);
                setSessionKey(v => v + 1);
              }}
            >
              <Plus size={16} />
              <span>New Study Session</span>
            </button>
            <p className="sidebar-session-desc">
              {isLocal 
                ? 'Start a fresh local chat. Your temporary conversation history will be reset.'
                : 'Start a fresh chat and upload notes again. Your study memory stays.'}
            </p>
          </div>
          
          <FileUpload 
            key={sessionKey}
            disabled={isLoading || quizBusy || memoryBusy}
            isLocalMode={isLocal}
            onBusyChange={setUploadBusy}
            onThreadCreated={setThreadId}
            onUploadSuccess={handleDocumentSuccess}
            onUploadError={handleDocumentError}
          />
          
          <StudyMemory 
            refreshKey={memoryRefresh} 
            disabled={isLoading || quizBusy || uploadBusy} 
            isLocalMode={isLocal}
            onBusyChange={setMemoryBusy} 
          />

          <div className="sidebar-footer">
            {isLocal ? (
              <p className="sidebar-privacy-note">
                AI responses in Local AI mode are generated by Gemma through Ollama running on this computer. Uploaded-note RAG and persistent Backboard study memory are unavailable in Local AI mode. Inference is offline-capable once installed.
              </p>
            ) : (
              <p className="sidebar-privacy-note">
                Your notes and messages are sent through the FriendForge backend to Backboard and its model provider. Study progress is saved in Backboard memory. Use non-sensitive study material. AI explanations and quiz answers can be mistaken; check your notes.
              </p>
            )}
            <div className="sidebar-built-tag">
              FriendForge — Built for Hacktoberfest 2026 "Build for a Friend" Challenge
            </div>
            <div className="sidebar-api-status" style={{ color: backendStatus.connected ? '#34d399' : '#f87171' }}>
              Backend API: {backendStatus.message}
            </div>
          </div>
        </aside>

        {/* Right Main Content */}
        <section className="workspace-content">
          {isLocal && (
            <div className="local-ai-banner" role="region" aria-label="Local AI status and information">
              <div className="local-ai-banner-header">
                <div className={`local-status-indicator ${localStatus.available ? 'available' : 'unavailable'}`}>
                  <span className="status-dot"></span>
                  <span>{localStatus.available ? 'Gemma 3 4B is ready locally.' : 'Local AI is unavailable. Start Ollama and make sure gemma3:4b is installed.'}</span>
                </div>
                <span className="local-model-pill">gemma3:4b • Ollama</span>
              </div>
              <p className="local-ai-note">Internet is not required for AI responses once Gemma is installed.</p>
              <p className="local-ai-disclaimer">Uploaded-note RAG and persistent Backboard study memory are unavailable in Local AI mode.</p>
            </div>
          )}

          {!isLocal && activeMode?.id === 'quiz' && !quiz && (
            <div className="quiz-prompt-helper">
              <p>Type a topic below to generate five questions. Upload notes first for a grounded quiz.</p>
            </div>
          )}

          {!isLocal && quiz && (
            <div className="quiz-section-wrapper">
              <Quiz 
                key={quiz.id} 
                quiz={quiz} 
                onBusyChange={setQuizBusy} 
                onMemoryChange={() => setMemoryRefresh(v => v + 1)} 
              />
            </div>
          )}

          <ChatInterface 
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading || quizBusy || uploadBusy || memoryBusy}
            activeMode={activeMode?.id}
            activeModeTitle={isLocal && activeMode?.id === 'explain' ? 'Local Explanation' : activeMode?.title}
            onSelectMode={handleSelectMode}
            aiMode={aiMode}
            isLocalMode={isLocal}
            disabled={isLoading || quizBusy || uploadBusy || memoryBusy}
          />
        </section>
      </main>
    </div>
  );
}
