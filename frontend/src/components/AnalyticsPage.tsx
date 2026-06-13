import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { getApiBaseUrl } from '../config/runtime';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--surface-2)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--text-muted)' },
};

const ALERT_COLORS: Record<string, string> = {
  RESTRICTED_ZONE: '#ef4444',
  WATCHLIST_MATCH:  '#dc2626',
  DWELL_EXCEEDED:   '#f59e0b',
  CAMERA_OFFLINE:   '#71717a',
  BREAK_VIOLATION:  '#22c55e',
  TAILGATING:       '#a78bfa',
};

function prettyAlertType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnalyticsPage() {
  const { cameras, alerts } = useStore();

  const [dashboard, setDashboard]     = React.useState<any>(null);
  const [loading, setLoading]         = React.useState(false);
  const [error, setError]             = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);

  const BASE = getApiBaseUrl();

  const fetch_data = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No auth required — analytics routes are public
      const res = await fetch(`${BASE}/analytics/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDashboard(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [BASE]);

  // Initial load
  React.useEffect(() => { fetch_data(); }, [fetch_data]);

  // Auto-refresh every 30s
  React.useEffect(() => {
    const id = setInterval(fetch_data, 30_000);
    return () => clearInterval(id);
  }, [fetch_data]);

  // ── Derived values from live store ─────────────────────────────────────────
  const totalCams  = cameras.length;
  const activeCams = cameras.filter((c) => c.status === 'ACTIVE').length;
  const uptimePct  = totalCams > 0 ? Math.round((activeCams / totalCams) * 100) : 0;
  const todayAlerts = alerts.length;

  // ── Stats from dashboard payload ────────────────────────────────────────────
  const stats  = dashboard?.stats ?? {};
  const hourly: any[] = (dashboard?.hourly_traffic ?? []).map((h: any) => ({
    hour:    h.hour,
    persons: h.passenger_count,
    alerts:  h.alert_count,
  }));

  // Alert type breakdown from live alerts store (7-day grouping)
  const alertCounts: Record<string, number> = {};
  alerts.forEach((a: any) => {
    const t = a.alert_type || 'OTHER';
    alertCounts[t] = (alertCounts[t] || 0) + 1;
  });
  const alertPie = Object.entries(alertCounts).map(([name, value]) => ({
    name:  prettyAlertType(name),
    value,
    color: ALERT_COLORS[name] ?? '#a1a1aa',
  }));

  // Top alert zones from API
  const topZones: any[] = dashboard?.top_alert_zones ?? [];

  // Camera health from API
  const camHealth: any[] = dashboard?.camera_fps ?? [];

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading analytics from database…
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--red-bright)' }}>
        <AlertTriangle size={28} />
        <div style={{ fontWeight: 600 }}>{error}</div>
        <button className="btn btn-secondary" onClick={fetch_data}>Retry</button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Refresh header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetch_data}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>

        {/* ── KPI cards ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            {
              label: 'Active Tracks Now',
              value: stats.active_tracks ?? '—',
              sub:   `${stats.total_visitors ?? 0} registered visitors`,
              color: 'var(--green-bright)',
            },
            {
              label: 'Alerts Today',
              value: stats.total_alerts_today ?? todayAlerts,
              sub:   `${stats.unacknowledged_alerts ?? 0} unacknowledged`,
              color: stats.critical_alerts > 0 ? 'var(--red-bright)' : 'var(--amber-bright)',
            },
            {
              label: 'Critical Alerts',
              value: stats.critical_alerts ?? 0,
              sub:   'Unacknowledged critical',
              color: 'var(--red-bright)',
            },
            {
              label: 'Camera Uptime',
              value: `${uptimePct}%`,
              sub:   `${activeCams} / ${totalCams} cameras active`,
              color: uptimePct >= 90 ? 'var(--green-bright)' : 'var(--amber-bright)',
            },
          ].map((kpi) => (
            <div key={kpi.label} style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: kpi.color }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── 12-Hour footfall chart (real DB data) ──────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">12-Hour Footfall Analysis</div>
              <div className="card-subtitle">Person detection events across all cameras (from DB)</div>
            </div>
          </div>
          <div style={{ padding: '16px 8px 8px' }}>
            {hourly.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                No track data yet — pipeline is processing…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={hourly}>
                  <defs>
                    <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                  <Area type="monotone" dataKey="persons" name="Persons Detected" stroke="#22c55e" strokeWidth={2} fill="url(#gG)" />
                  <Area type="monotone" dataKey="alerts"  name="Alerts Triggered" stroke="#ef4444" strokeWidth={1.5} fill="url(#rG)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ── Alert type breakdown (live from store) ──────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Alert Type Breakdown</div>
              <div className="card-subtitle">Live from alert log</div>
            </div>
            <div style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: 20 }}>
              {alertPie.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13, width: '100%' }}>
                  No alerts recorded yet
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="45%" height={180}>
                    <PieChart>
                      <Pie
                        data={alertPie}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={80}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {alertPie.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {alertPie.map((t) => (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{t.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Top alert zones (from DB) ─────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top Alert Zones (24h)</div>
              <div className="card-subtitle">Ranked by alert count from DB</div>
            </div>
            <div style={{ padding: '12px 8px 8px' }}>
              {topZones.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No zone alerts in last 24 hours
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={topZones} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="zone" type="category" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="alert_count" name="Alerts" fill="#ef4444" radius={[0, 4, 4, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* ── Camera health table (from API) ───────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Camera Status</div>
            <div className="card-subtitle">{activeCams} active · {totalCams - activeCams} offline</div>
          </div>
          <div style={{ padding: '0 4px 8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, padding: 12 }}>
              {camHealth.map((cam: any) => (
                <div key={cam.camera_id} style={{
                  background: 'var(--surface-2)',
                  border: `1px solid ${cam.status === 'ACTIVE' ? 'var(--border-green)' : 'var(--border-red)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{cam.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: cam.status === 'ACTIVE' ? 'var(--green-bright)' : 'var(--red-bright)',
                      display: 'inline-block',
                    }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {cam.status === 'ACTIVE' ? `${cam.fps} fps` : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
