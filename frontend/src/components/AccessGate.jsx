import React, { useEffect, useState } from 'react';
import { Zap, Lock, Eye, EyeOff, Sun, Moon, AlertCircle, KeyRound } from 'lucide-react';
import { useTheme } from '../useTheme';

const API = import.meta.env.VITE_API_BASE_URL || '';
const DEFAULT_GATE_PASSWORD = 'HACKTOBERFEST2026!';

export default function AccessGate({ children }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  async function check() {
    setError('');
    try {
      const response = await fetch(API + '/api/session', { credentials: 'include' });
      if (!response.ok) throw new Error();
      setSession(await response.json());
    } catch {
      setError('Cannot connect to FriendForge. Please retry.');
    }
  }

  useEffect(() => {
    check();
    const expired = () => setSession({ authenticated: false, passwordRequired: true });
    window.addEventListener('friendforge:signin', expired);
    return () => window.removeEventListener('friendforge:signin', expired);
  }, []);

  async function signIn(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(API + '/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Sign-in failed.');
      setPassword('');
      await check();
    } catch (err) {
      setError(err.message || 'Could not connect. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  const handleAutofillDefault = () => {
    setPassword(DEFAULT_GATE_PASSWORD);
  };

  if (session?.authenticated) {
    return (
      <>
        {session.passwordRequired && (
          <div className="access-toolbar">
            <button
              type="button"
              className="browse-btn lock-btn"
              onClick={async () => {
                try {
                  const response = await fetch(API + '/api/session', { method: 'DELETE', credentials: 'include' });
                  if (response.ok) setSession({ authenticated: false, passwordRequired: true });
                  else setError('Could not sign out. Please retry.');
                } catch {
                  setError('Could not sign out. Please retry.');
                }
              }}
            >
              <Lock size={13} style={{ marginRight: '5px' }} />
              Lock study space
            </button>
            {error && <p role="alert" className="access-toolbar-error">{error}</p>}
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="access-page-wrapper">
      <main className="access-card" aria-label="FriendForge Access Gate">
        <div className="access-card-header">
          <div className="access-brand-row">
            <div className="brand-icon">
              <Zap size={22} />
            </div>
            <div>
              <h1 className="access-title">FriendForge</h1>
              <p className="access-subtitle">A private study space for a friend.</p>
            </div>
          </div>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Password Helper Pill for Reviewers & Users */}
        <div className="access-hint-pill" onClick={handleAutofillDefault} title="Click to autofill this password">
          <KeyRound size={13} className="hint-icon" />
          <span>Password: <strong>{DEFAULT_GATE_PASSWORD}</strong></span>
          <span className="hint-action">Auto-fill</span>
        </div>

        {session ? (
          <form onSubmit={signIn} className="access-form">
            <div className="access-field-group">
              <label htmlFor="study-password" className="access-label">
                Shared study password
              </label>

              <div className="access-input-wrapper">
                <Lock size={16} className="access-input-icon" />
                <input
                  id="study-password"
                  className="access-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={256}
                  required
                  placeholder="Enter study password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-reveal-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="access-submit-btn" disabled={busy}>
              {busy ? 'Signing in...' : 'Open study space'}
            </button>
          </form>
        ) : (
          !error && <p role="status" className="access-status-text">Connecting...</p>
        )}

        {error && (
          <div role="alert" className="access-error-badge">
            <AlertCircle size={15} className="error-icon" />
            <span>{error}</span>
          </div>
        )}

        {!session && error && (
          <button type="button" className="browse-btn retry-access-btn" onClick={check}>
            Retry connection
          </button>
        )}
      </main>
    </div>
  );
}
