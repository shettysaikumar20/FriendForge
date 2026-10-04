import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// In-memory session cache so replaying within the browser session never re-fetches from ElevenLabs
const sessionAudioCache = new Map();

export default function ExplanationAudioPlayer({ text, messageId, aiMode, isLocal }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'generating' | 'ready' | 'error'
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const audioRef = useRef(null);
  const isGeneratingRef = useRef(false);

  // If already in session cache, initialize as ready
  useEffect(() => {
    if (sessionAudioCache.has(messageId)) {
      setStatus('ready');
    }
  }, [messageId]);

  // Clean up audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Strict Local AI Privacy Boundary:
  // If Local AI is active or the message was generated locally, disable ElevenLabs TTS
  const isOfflineOrLocal = aiMode === 'local' || isLocal;

  if (isOfflineOrLocal) {
    return (
      <div className="tts-privacy-container" title="Voice playback requires Online Study because ElevenLabs is a cloud service.">
        <button
          type="button"
          className="tts-btn tts-btn-disabled"
          disabled
          aria-label="Cloud voice playback disabled for offline study"
        >
          <Volume2 size={13} aria-hidden="true" />
          <span>Listen (Cloud only)</span>
        </button>
        <span className="tts-notice-text">
          Voice playback requires Online Study because ElevenLabs is a cloud service.
        </span>
      </div>
    );
  }

  const handleGenerate = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent duplicate requests while generation is pending
    if (isGeneratingRef.current || status === 'generating') return;

    // Check session cache first to prevent redundant API calls
    if (sessionAudioCache.has(messageId)) {
      playAudio(sessionAudioCache.get(messageId));
      return;
    }

    isGeneratingRef.current = true;
    setStatus('generating');
    setErrorMessage('');

    try {
      // Send only the clean explanation text to the backend endpoint
      const response = await apiFetch(`${API_BASE_URL}/api/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: (text || '').slice(0, 3000)
        })
      });

      if (!response.ok) {
        throw new Error('Audio generation is temporarily unavailable.');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      sessionAudioCache.set(messageId, audioUrl);
      setStatus('ready');
      playAudio(audioUrl);
    } catch (err) {
      console.error('[TTS Player Error]:', err);
      setStatus('error');
      setErrorMessage('Audio generation is temporarily unavailable.');
    } finally {
      isGeneratingRef.current = false;
    }
  };

  const playAudio = (url) => {
    if (!audioRef.current) {
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      audioRef.current = audio;
    } else if (audioRef.current.src !== url) {
      audioRef.current.pause();
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      audioRef.current = audio;
    }

    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((playErr) => {
        console.warn('[Audio Playback Blocked/Failed]:', playErr);
        setIsPlaying(false);
      });
  };

  const handleTogglePlayPause = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) {
      const cachedUrl = sessionAudioCache.get(messageId);
      if (cachedUrl) playAudio(cachedUrl);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleReplay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      const cachedUrl = sessionAudioCache.get(messageId);
      if (cachedUrl) playAudio(cachedUrl);
    }
  };

  return (
    <div className="tts-container">
      {status === 'idle' && (
        <button
          type="button"
          className="tts-btn"
          onClick={handleGenerate}
          aria-label="Listen to Explanation"
          title="Listen to this explanation spoken aloud via ElevenLabs"
        >
          <Volume2 size={14} aria-hidden="true" />
          <span>Listen to Explanation</span>
        </button>
      )}

      {status === 'generating' && (
        <button
          type="button"
          className="tts-btn tts-btn-loading"
          disabled
          aria-label="Generating audio..."
          aria-busy="true"
        >
          <Loader2 size={14} className="spin" aria-hidden="true" />
          <span>Generating audio...</span>
        </button>
      )}

      {status === 'ready' && (
        <div className="tts-controls-bar" role="region" aria-label="Audio playback controls">
          <button
            type="button"
            className="tts-control-btn"
            onClick={handleTogglePlayPause}
            aria-label={isPlaying ? 'Pause explanation' : 'Play explanation'}
          >
            {isPlaying ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            className="tts-control-btn"
            onClick={handleReplay}
            aria-label="Replay explanation from start"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Replay</span>
          </button>

          <span className="tts-voice-badge" role="status">
            {isPlaying ? '🔊 Speaking...' : 'Voice ready'}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="tts-error-wrapper">
          <button
            type="button"
            className="tts-btn tts-btn-error"
            onClick={handleGenerate}
            aria-label="Retry audio generation"
          >
            <Volume2 size={13} aria-hidden="true" />
            <span>Retry Audio</span>
          </button>
          <span className="tts-error-text" role="alert">
            {errorMessage}
          </span>
        </div>
      )}
    </div>
  );
}
