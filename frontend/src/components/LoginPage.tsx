import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const BOOT_LINES = [
  { text: 'PERIMETER SENSORS', status: 'ONLINE [720/720]', delay: 200 },
  { text: 'CAMERA NETWORK', status: 'INITIALIZING...', delay: 600 },
  { text: 'AI THREAT MODEL', status: 'LOADED', delay: 1100 },
  { text: 'BIOMETRIC ENGINE', status: 'READY', delay: 1500 },
  { text: 'REID PIPELINE', status: 'ACTIVE', delay: 1900 },
  { text: 'DATABASE', status: 'CONNECTED', delay: 2300 },
  { text: 'WATCHLIST DB', status: 'SYNCED [2,841 ENTRIES]', delay: 2600 },
  { text: 'WEBSOCKET RELAY', status: 'ONLINE', delay: 3000 },
  { text: 'AWAITING OPERATOR AUTH', status: '■', delay: 3400 },
];

function BootTerminal() {
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisible((v) => [...v, i]), line.delay)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const doneIdx = BOOT_LINES.length - 2; // last real "done" line

  return (
    <div className="boot-log" role="log" aria-label="System boot log" aria-live="polite">
      {BOOT_LINES.map((line, i) => {
        if (!visible.includes(i)) return null;
        const isLast = i === BOOT_LINES.length - 1;
        const isDone = i <= doneIdx && !isLast;
        return (
          <div
            key={i}
            className={`boot-line ${isDone ? 'done' : 'active'}`}
            style={{ animationDelay: `${line.delay}ms` }}
          >
            <span style={{ color: 'var(--teal)', opacity: 0.5, flexShrink: 0 }}>&gt;</span>
            <span style={{ flex: 1 }}>{line.text}</span>
            <span className="boot-status">
              {isLast ? (
                <>
                  {line.status.replace('■', '')}
                  <span className="boot-cursor" aria-hidden="true" />
                </>
              ) : (
                line.status
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [progress, setProgress]   = useState(0);
  const setAuth = useStore((s) => s.setAuth);
  const setPage = useStore((s) => s.setPage);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setProgress(30);
    try {
      setProgress(60);
      const data = await api.login(username, password);
      setProgress(100);
      setAuth(
        { username: data.username, role: data.role, full_name: data.full_name || username },
        data.access_token,
      );
      setTimeout(() => setPage('dashboard'), 200);
    } catch {
      setError('Authentication failed — invalid credentials or server offline.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    setAuth({ username: 'admin', role: 'admin', full_name: 'System Administrator' }, 'demo-token');
    setPage('dashboard');
  };

  return (
    <div className="login-page" role="main">
      <div className="login-bg-grid" aria-hidden="true" />

      {/* Left: Brand + Terminal */}
      <section className="login-terminal" aria-labelledby="brand-heading">
        <div className="login-brand">
          <div className="login-wordmark" id="brand-heading">SECUREWATCH</div>
          <div className="login-tagline">
            Airport Intelligence Platform&nbsp;
            <span className="boot-cursor" aria-hidden="true" />
          </div>
        </div>

        <BootTerminal />
      </section>

      {/* Right: Auth form */}
      <section className="login-card" aria-labelledby="auth-heading">
        <div className="login-form-panel">
          <span className="login-stamp" aria-label="Authorized personnel only">AUTH·REQUIRED</span>

          {/* Icon + title */}
          <div className="login-logo">
            <div className="login-icon" aria-hidden="true">
              <ShieldCheck size={20} />
            </div>
            <div className="login-section-title" id="auth-heading">Operator Auth</div>
            <div className="login-section-sub">Restricted system access</div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="alert-banner critical"
              role="alert"
              style={{ marginBottom: 20, fontSize: 12 }}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">
                  Username
                </label>
                <input
                  id="login-username"
                  className="form-input"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  aria-required="true"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    className="form-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                    required
                    aria-required="true"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-ghost)', display: 'flex', padding: 4,
                    }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Progress bar during auth */}
              {loading && (
                <div>
                  <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--teal)', fontFamily: 'var(--font-mono)', marginTop: 4, letterSpacing: '0.1em' }}>
                    AUTHENTICATING...
                  </div>
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary btn-xl"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                disabled={loading || !username || !password}
              >
                {loading ? 'Authenticating...' : '// AUTHENTICATE //'}
              </button>
            </div>
          </form>

          {/* Demo mode */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              id="demo-login"
              type="button"
              onClick={handleDemo}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--teal)', letterSpacing: '0.1em',
                textTransform: 'uppercase', textDecoration: 'underline',
                padding: '4px 8px',
              }}
              aria-label="Launch demo mode without credentials"
            >
              DEMO MODE — No credentials required
            </button>
          </div>

          {/* Clearance */}
          <div className="clearance-badge">
            <span className="clearance-label">Clearance Level</span>
            <span className="clearance-value">RESTRICTED</span>
          </div>
        </div>
      </section>
    </div>
  );
}
