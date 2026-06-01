import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useStore((s) => s.setAuth);
  const setPage = useStore((s) => s.setPage);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      setAuth({ username: data.username, role: data.role, full_name: data.full_name || username }, data.access_token);
      setPage('dashboard');
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Allow demo login when backend isn't running
  const handleDemoLogin = () => {
    setAuth({ username: 'admin', role: 'admin', full_name: 'System Administrator' }, 'demo-token');
    setPage('dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-icon">
            <Shield size={28} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--white)', marginBottom: 4 }}>
              SecureWatch
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Airport Surveillance System
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-banner critical" style={{ marginBottom: 20 }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              id="login-username"
              className="form-input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
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
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-ghost)', display: 'flex',
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ opacity: 0.8 }}>Authenticating...</span>
            ) : (
              <>
                <Lock size={16} />
                Secure Login
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-ghost)', marginBottom: 8 }}>— or —</div>
          <button
            id="demo-login"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            onClick={handleDemoLogin}
          >
            Launch Demo Mode (No backend required)
          </button>
        </div>

        <div style={{
          marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {['CRITICAL SYSTEM', 'RESTRICTED ACCESS', 'MONITORED'].map((tag) => (
            <span key={tag} style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              color: 'var(--text-ghost)', textTransform: 'uppercase',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
