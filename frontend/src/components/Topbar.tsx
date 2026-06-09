import React, { useEffect, useCallback, useState } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  live:      'Live Feeds',
  layout:    'Layout Editor',
  alerts:    'Alerts',
  visitors:  'Visitors',
  employees: 'Employees',
  'person-lookup': 'Person Lookup',
  analytics: 'Analytics',
  cameras:   'Cameras',
  settings:  'Settings',
};

/* Radar SVG — pure CSS animated */
function RadarOrb({ health }: { health: 'good' | 'degraded' | 'critical' }) {
  const color = health === 'good' ? '#4ADE80' : health === 'degraded' ? '#F59E0B' : '#FF2244';
  return (
    <div className="radar-orb" title={`System health: ${health}`} aria-label={`System health: ${health}`}>
      <svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Concentric circles */}
        <circle cx="15" cy="15" r="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
        <circle cx="15" cy="15" r="9"  stroke={color} strokeWidth="0.5" opacity="0.4" />
        <circle cx="15" cy="15" r="5"  stroke={color} strokeWidth="0.5" opacity="0.5" />
        {/* Crosshairs */}
        <line x1="15" y1="2"  x2="15" y2="28" stroke={color} strokeWidth="0.4" opacity="0.25" />
        <line x1="2"  y1="15" x2="28" y2="15" stroke={color} strokeWidth="0.4" opacity="0.25" />
        {/* Sweep arm — rotates via CSS */}
        <line x1="15" y1="15" x2="15" y2="2" stroke={color} strokeWidth="1" opacity="0.85" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="15" cy="15" r="1.5" fill={color} />
      </svg>
    </div>
  );
}

export default function Topbar({ onOpenPalette }: { onOpenPalette?: () => void }) {
  const { currentPage, token, alerts, setAlerts, setStats, setVisitors, setEmployees, setZones, setCameras, cameras, addToast } = useStore();
  const unackCount = alerts.filter((a) => !a.acknowledged).length;
  const offlineCams = cameras.filter((c) => c.status !== 'ACTIVE').length;
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Compute threat level
  const threatLevel =
    unackCount >= 5 || alerts.some((a) => a.severity === 'CRITICAL' && !a.acknowledged)
      ? 'high'
      : unackCount >= 1 || offlineCams > 2
      ? 'elevated'
      : 'normal';

  const threatLabel = { normal: 'NORMAL', elevated: 'ELEVATED', high: 'HIGH ALERT' }[threatLevel];
  const systemHealth = threatLevel === 'high' ? 'critical' : threatLevel === 'elevated' ? 'degraded' : 'good';

  const fetchAll = useCallback(async () => {
    if (!token || token === 'demo-token') return;
    setRefreshing(true);
    try {
      const [a, v, e, z, c, s] = await Promise.all([
        api.getAlerts(token),
        api.getVisitors(token),
        api.getEmployees(token),
        api.getZones(token),
        api.getCameras(token),
        api.getStats(token),
      ]);
      if (Array.isArray(a)) setAlerts(a);
      if (Array.isArray(v)) setVisitors(v);
      if (Array.isArray(e)) setEmployees(e);
      if (Array.isArray(z)) setZones(z);
      if (Array.isArray(c)) setCameras(c);
      if (s && typeof s === 'object') setStats(s);
    } catch {
      addToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  // Auto-refresh every 30s
  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  return (
    <header className="topbar" role="banner">
      {/* Left: breadcrumb + title */}
      <div className="topbar-left">
        <h1 className="topbar-title">{PAGE_TITLES[currentPage] || currentPage}</h1>
        <div className="topbar-breadcrumb" aria-label="Breadcrumb">
          <span>SECUREWATCH</span>
          <span aria-hidden="true">›</span>
          <span>{PAGE_TITLES[currentPage]?.toUpperCase()}</span>
        </div>
      </div>

      {/* Center: Radar orb */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <RadarOrb health={systemHealth} />
      </div>

      {/* Right: actions */}
      <div className="topbar-actions" role="toolbar" aria-label="Header actions">
        {/* Threat level pill */}
        <div
          className={`threat-badge ${threatLevel}`}
          role="status"
          aria-live="polite"
          aria-label={`Threat level: ${threatLabel}`}
        >
          <span className="threat-dot" aria-hidden="true" />
          {threatLabel}
        </div>

        {/* Clock */}
        <div className="topbar-clock" aria-label={`Current time: ${timeStr}`}>
          {timeStr}
        </div>

        {/* Cmd+K hint */}
        {onOpenPalette && (
          <button
            className="topbar-clock"
            onClick={onOpenPalette}
            title="Open command palette (Cmd+K)"
            aria-label="Open command palette"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-ghost)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            ⌘K
          </button>
        )}

        {/* Refresh */}
        <button
          id="topbar-refresh"
          className="icon-btn"
          onClick={fetchAll}
          title="Refresh all data (auto-refreshes every 30s)"
          aria-label="Refresh data"
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            style={{
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
              color: refreshing ? 'var(--orange)' : 'inherit',
            }}
          />
        </button>

        {/* Alert bell */}
        <button
          id="topbar-alerts"
          className="icon-btn"
          style={{ position: 'relative' }}
          onClick={() => useStore.getState().setPage('alerts')}
          title={unackCount > 0 ? `${unackCount} unacknowledged alerts` : 'No new alerts'}
          aria-label={`Alerts — ${unackCount} unacknowledged`}
        >
          <Bell size={14} style={{ color: unackCount > 0 ? 'var(--red)' : 'inherit' }} />
          {unackCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: -5, right: -5,
                background: 'var(--red)', color: 'white',
                fontSize: 9, fontWeight: 700,
                width: 16, height: 16,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--bg)',
                animation: 'badge-pulse 2s ease-in-out infinite',
              }}
            >
              {unackCount > 9 ? '9+' : unackCount}
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </header>
  );
}
