import React, { useEffect, useCallback } from 'react';
import { Bell, RefreshCw, Wifi } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Operations Dashboard',
  live: 'Live Camera Feeds',
  layout: 'Layout & Zone Editor',
  alerts: 'Alert Management',
  visitors: 'Visitor Management',
  employees: 'Employee Monitoring',
  analytics: 'Analytics & Intelligence',
  cameras: 'Camera Management',
  settings: 'System Settings',
};

export default function Topbar() {
  const { currentPage, token, alerts, setAlerts, setStats, setVisitors, setEmployees, setZones, setCameras, addToast } = useStore();
  const unackCount = alerts.filter((a) => !a.acknowledged).length;
  const [lastRefresh, setLastRefresh] = React.useState(new Date());
  const [refreshing, setRefreshing] = React.useState(false);

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
      setAlerts(a);
      setVisitors(v);
      setEmployees(e);
      setZones(z);
      setCameras(c);
      setStats(s);
      setLastRefresh(new Date());
    } catch {
      addToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="topbar">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h1 className="topbar-title">{PAGE_TITLES[currentPage] || currentPage}</h1>
        <div className="topbar-breadcrumb">
          <span>Airport Security</span>
          <span style={{ color: 'var(--border-hover)' }}>›</span>
          <span>{PAGE_TITLES[currentPage]}</span>
        </div>
      </div>

      <div className="topbar-actions">
        {/* System clock */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12, color: 'var(--text-muted)',
          padding: '4px 10px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}>
          {formatTime(lastRefresh)}
        </div>

        {/* Status */}
        <div className="topbar-status">
          <span className="status-dot" />
          <span className="status-text">LIVE</span>
        </div>

        {/* Refresh */}
        <button
          id="topbar-refresh"
          className="icon-btn"
          onClick={fetchAll}
          title="Refresh all data"
          style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }}
        >
          <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>

        {/* Alerts bell */}
        <button
          id="topbar-alerts"
          className="icon-btn"
          style={{ position: 'relative' }}
          onClick={() => useStore.getState().setPage('alerts')}
          title="View alerts"
        >
          <Bell size={15} />
          {unackCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--red)', color: 'white',
              fontSize: 9, fontWeight: 700,
              width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--surface-1)',
            }}>
              {unackCount > 9 ? '9+' : unackCount}
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </header>
  );
}
