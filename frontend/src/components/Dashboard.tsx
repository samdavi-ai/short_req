import React, { useMemo, useState } from 'react';
import {
  Camera, ShieldAlert, Users, UserCheck,
  Activity, Eye, AlertTriangle, CheckCircle,
  Clock, MapPin, TrendingUp, TrendingDown,
  Check, CheckCheck, X
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';

const TYPE_ICON: Record<string, string> = {
  RESTRICTED_ZONE: '🚫',
  WATCHLIST_MATCH: '👤',
  DWELL_EXCEEDED:  '⏱',
  CAMERA_OFFLINE:  '📷',
  BREAK_VIOLATION: '☕',
  TAILGATING:      '🚷',
};

/* ── Hourly mock data ── */
const mockHourly = Array.from({ length: 12 }, (_, i) => ({
  hour: `${String((new Date().getHours() - 11 + i + 24) % 24).padStart(2, '0')}:00`,
  footfall: Math.floor(Math.random() * 280 + 60),
  alerts: Math.floor(Math.random() * 7),
}));

/* ── HUD Arc Ring (SVG) ── */
function HudRing({
  value, label, color = 'var(--orange)',
}: {
  value: number; label: string; color?: string;
}) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  const dash = `${fill} ${circ}`;

  return (
    <div className="hud-ring-wrap">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${label}: ${value}%`}
        style={{ overflow: 'visible' }}
      >
        {/* Track */}
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="5"
          strokeDasharray={`${circ}`}
          strokeDashoffset="0"
          transform="rotate(-90 32 32)"
        />
        {/* Fill */}
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={dash}
          strokeDashoffset="0"
          strokeLinecap="square"
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dasharray 800ms cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Value label */}
        <text
          x="32" y="36"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="13"
          fontWeight="800"
          fontFamily="'Barlow Condensed', sans-serif"
          letterSpacing="0.04em"
        >
          {value}%
        </text>
      </svg>
      <div className="hud-ring-label">{label}</div>
    </div>
  );
}

/* ── Metric Pill (top strip) ── */
function MetricPill({
  label, value, unit = '', color = 'var(--text-primary)', icon: Icon, warn,
}: {
  label: string; value: string | number; unit?: string;
  color?: string; icon: React.ElementType; warn?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '14px 20px',
        borderRight: '1px solid var(--border)',
        background: warn ? 'rgba(255, 34, 68, 0.04)' : 'transparent',
        gap: 6,
        minWidth: 0,
        cursor: 'default',
        transition: 'background var(--t-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <Icon size={13} style={{ color, flexShrink: 0 }} aria-hidden="true" />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-ghost)',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36,
          fontWeight: 900,
          color,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
        aria-label={`${label}: ${value}${unit}`}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4, opacity: 0.6 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Severity color ── */
const sevColor = (s: string) => {
  if (s === 'CRITICAL') return 'var(--red)';
  if (s === 'HIGH') return '#FF6644';
  if (s === 'MEDIUM') return 'var(--amber)';
  return 'var(--text-muted)';
};

/* ── Zone Threat cell ── */
const zoneThreatData = [
  { id: 'A1', label: 'Gate A1', level: 'clear' },
  { id: 'A2', label: 'Gate A2', level: 'elevated' },
  { id: 'A3', label: 'Gate A3', level: 'critical' },
  { id: 'B1', label: 'Security', level: 'clear' },
  { id: 'B2', label: 'Baggage', level: 'clear' },
  { id: 'B3', label: 'Retail',  level: 'elevated' },
  { id: 'C1', label: 'Lounge',  level: 'clear' },
  { id: 'C2', label: 'Parking', level: 'clear' },
  { id: 'C3', label: 'Tarmac',  level: 'critical' },
];

const threatCellColor = (l: string) =>
  l === 'critical' ? '#FF2244' : l === 'elevated' ? '#F59E0B' : '#4ADE80';

/* ─────────────────────────────────────────────── */
export default function Dashboard() {
  const { stats, alerts, cameras, visitors, employees, token, user, addToast, acknowledgeAlert } = useStore();

  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  const totalCams    = stats?.total_cameras   ?? cameras.length;
  const activeCams   = stats?.active_cameras  ?? cameras.filter((c) => c.status === 'ACTIVE').length;
  const offlineCams  = stats?.offline_cameras ?? cameras.filter((c) => c.status !== 'ACTIVE').length;
  const unackAlerts  = stats?.unacknowledged_alerts ?? alerts.filter((a) => !a.acknowledged).length;
  const totalVisitors= stats?.total_visitors  ?? visitors.length;
  const watchlisted  = stats?.watchlisted     ?? visitors.filter((v) => v.status === 'BLACKLISTED' || v.status === 'WATCHLIST').length;
  const activeTracks = stats?.active_tracks   ?? 0;
  const totalEmps    = stats?.total_employees ?? employees.length;
  const empCompliance = totalEmps > 0 ? Math.round(((totalEmps - 2) / totalEmps) * 100) : 100;

  const doAck = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (token && token !== 'demo-token') {
      try {
        await api.acknowledgeAlert(token, id, user?.username || 'operator');
      } catch (err) {
        console.error('Failed to acknowledge alert via API', err);
      }
    }
    acknowledgeAlert(id);
    addToast('Alert acknowledged', 'success');
    if (selectedAlertId === id) setSelectedAlertId(null);
  };

  const activeCritical = useMemo(() => alerts.filter(a => !a.acknowledged && a.severity === 'CRITICAL').length, [alerts]);
  const activeHigh = useMemo(() => alerts.filter(a => !a.acknowledged && a.severity === 'HIGH').length, [alerts]);
  const activeMedium = useMemo(() => alerts.filter(a => !a.acknowledged && a.severity === 'MEDIUM').length, [alerts]);

  const recentAlerts = useMemo(() =>
    [...alerts]
      .filter((a) => !a.acknowledged)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6),
    [alerts],
  );

  // System health rings
  const camCoverage   = totalCams > 0 ? Math.round((activeCams / totalCams) * 100) : 100;
  const alertResponse = alerts.length > 0
    ? Math.round((alerts.filter((a) => a.acknowledged).length / alerts.length) * 100)
    : 100;
  const watchlistCheck = 98;
  const sysHealth = offlineCams > 0 ? Math.max(60, 100 - offlineCams * 8) : 100;

  return (
    <div className="page-content" style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── TOP METRIC STRIP ── */}
      <div
        role="region"
        aria-label="Key metrics"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)',
        }}
      >
        <MetricPill
          label="Cameras Online" icon={Camera}
          value={`${activeCams}/${totalCams}`}
          color={offlineCams > 0 ? 'var(--amber)' : 'var(--orange)'}
          warn={offlineCams > 2}
        />
        <MetricPill
          label="Active Alerts" icon={ShieldAlert}
          value={unackAlerts}
          color={unackAlerts > 0 ? 'var(--red)' : 'var(--green)'}
          warn={unackAlerts > 0}
        />
        <MetricPill
          label="Tracked Now" icon={Activity}
          value={activeTracks}
          color="var(--teal)"
        />
        <MetricPill
          label="Visitors Today" icon={Users}
          value={totalVisitors}
          unit={watchlisted > 0 ? `(${watchlisted}⚠)` : ''}
          color={watchlisted > 0 ? 'var(--amber)' : 'var(--text-primary)'}
          warn={watchlisted > 0}
        />
        <MetricPill
          label="Emp. Compliance" icon={UserCheck}
          value={`${empCompliance}%`}
          color={empCompliance < 90 ? 'var(--amber)' : 'var(--lime)'}
          warn={empCompliance < 90}
        />
      </div>

      {/* ── MAIN 3-COLUMN BODY ── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 220px 300px',
          gap: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ── COL 1: Charts ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', minWidth: 0 }}>
          {/* Footfall chart */}
          <div style={{ flex: 1, borderBottom: '1px solid var(--border)', padding: '0 0 0 0' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="card-title">Hourly Footfall</div>
                <div className="card-subtitle">Person count — last 12h</div>
              </div>
              <span className="live-badge" aria-label="Live data">
                <span className="live-dot" aria-hidden="true" />LIVE
              </span>
            </div>
            <div style={{ padding: '12px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={mockHourly}>
                  <defs>
                    <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#FF6B00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    itemStyle={{ color: 'var(--orange-bright)' }}
                    cursor={{ stroke: 'var(--border-hover)', strokeDasharray: '4 2' }}
                  />
                  <Area type="monotone" dataKey="footfall" stroke="var(--orange)" strokeWidth={1.5} fill="url(#orangeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alert frequency chart */}
          <div style={{ flex: 1 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Alert Frequency</div>
                <div className="card-subtitle">Triggered alerts — last 12h</div>
              </div>
            </div>
            <div style={{ padding: '12px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={mockHourly} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--red-border)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    itemStyle={{ color: 'var(--red)' }}
                    cursor={{ fill: 'rgba(255,34,68,0.06)' }}
                  />
                  <Bar dataKey="alerts" fill="var(--red)" radius={[1, 1, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── COL 2: HUD Rings + Zone Threat ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          {/* System Health HUD rings */}
          <div style={{ flex: 1, borderBottom: '1px solid var(--border)' }}>
            <div className="card-header">
              <div className="card-title">Sys Health</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                padding: '16px 12px',
              }}
              role="group"
              aria-label="System health metrics"
            >
              <HudRing value={camCoverage}   label="Camera Cov." color="var(--orange)" />
              <HudRing value={alertResponse} label="Alert Resp." color="var(--teal)" />
              <HudRing value={watchlistCheck} label="Watchlist"  color="var(--lime)" />
              <HudRing value={sysHealth}     label="Sys Health" color={sysHealth < 90 ? 'var(--red)' : 'var(--green)'} />
            </div>
          </div>

          {/* Zone threat matrix */}
          <div style={{ flex: 1 }}>
            <div className="card-header">
              <div className="card-title">Zone Threat</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 2,
                padding: '10px',
              }}
              role="group"
              aria-label="Zone threat levels"
            >
              {zoneThreatData.map((z) => (
                <div
                  key={z.id}
                  title={`${z.label}: ${z.level}`}
                  aria-label={`${z.label}: ${z.level}`}
                  style={{
                    background: threatCellColor(z.level),
                    opacity: z.level === 'clear' ? 0.7 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    gap: 2,
                    cursor: 'default',
                    transition: 'opacity var(--t-fast)',
                  }}
                >
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#000', opacity: 0.8, letterSpacing: '0.06em' }}>
                    {z.id}
                  </span>
                  <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(0,0,0,0.65)', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>
                    {z.label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 10px 10px', display: 'flex', gap: 8 }}>
              {[['var(--green)', 'Clear'], ['var(--amber)', 'Elevated'], ['var(--red)', 'Critical']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, background: c, display: 'block', flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL 3: Alerts + Quick Access ── */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Active alerts */}
          <div style={{ flex: 1, borderBottom: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ paddingBottom: 6 }}>
              <div>
                <div className="card-title">Alerts</div>
                <div className="card-subtitle">Pending review</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {activeCritical > 0 && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 4px', background: 'var(--red-dim)', color: 'var(--red-light)', border: '1px solid var(--border-red)', borderRadius: 2 }}>
                      {activeCritical} CRT
                    </span>
                  )}
                  {activeHigh > 0 && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 4px', background: 'rgba(255, 107, 0, 0.1)', color: '#FF8833', border: '1px solid rgba(255, 107, 0, 0.2)', borderRadius: 2 }}>
                      {activeHigh} HIG
                    </span>
                  )}
                  {activeMedium > 0 && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 4px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 2 }}>
                      {activeMedium} MED
                    </span>
                  )}
                </div>
              </div>
              {unackAlerts > 0 && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => useStore.getState().setPage('alerts')}
                  aria-label={`View all ${unackAlerts} alerts`}
                >
                  View All
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {recentAlerts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><CheckCircle size={20} aria-hidden="true" /></div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    All Clear
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                    System operating normally
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recentAlerts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0,
                        padding: '10px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        borderLeft: `3px solid ${sevColor(a.severity)}`,
                        transition: 'background var(--t-fast)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedAlertId(a.id)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          color: sevColor(a.severity), letterSpacing: '0.08em',
                          textTransform: 'uppercase', marginBottom: 2,
                          display: 'flex', alignItems: 'center', gap: 6
                        }}>
                          <span>{TYPE_ICON[a.alert_type] || '⚠️'}</span>
                          <span>{a.severity}</span>
                          <span>·</span>
                          <span>{a.alert_type.replace(/_/g, ' ')}</span>
                        </div>
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                          title={a.description}
                        >
                          {a.description || 'No description'}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 10, color: 'var(--text-ghost)',
                        fontFamily: 'var(--font-mono)', flexShrink: 0,
                        marginLeft: 8,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={9} aria-hidden="true" />
                          {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{
                            fontSize: 8,
                            padding: '1px 4px',
                            fontFamily: 'var(--font-mono)',
                            height: 16,
                            marginTop: 2,
                            borderColor: 'var(--border)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            doAck(a.id);
                          }}
                          aria-label={`Ack alert ${a.id}`}
                        >
                          ACK
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick ops */}
          <div>
            <div className="card-header">
              <div className="card-title">Quick Ops</div>
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}
              role="group"
              aria-label="Quick navigation"
            >
              {[
                { label: 'Live Feeds',  icon: Eye,           page: 'live' },
                { label: 'Watchlist',   icon: AlertTriangle, page: 'visitors' },
                { label: 'Layout Map',  icon: MapPin,        page: 'layout' },
                { label: 'Employees',   icon: UserCheck,     page: 'employees' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    onClick={() => useStore.getState().setPage(item.page)}
                    aria-label={`Go to ${item.label}`}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '16px 8px',
                      background: 'var(--bg-panel)',
                      border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)',
                      transition: 'all var(--t-fast)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'var(--orange-dim)';
                      el.style.color = 'var(--orange)';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'var(--bg-panel)';
                      el.style.color = 'var(--text-muted)';
                    }}
                    onFocus={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'var(--orange-dim)';
                      el.style.color = 'var(--orange)';
                    }}
                    onBlur={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'var(--bg-panel)';
                      el.style.color = 'var(--text-muted)';
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Modal */}
      {(() => {
        const selectedAlert = alerts.find(a => a.id === selectedAlertId);
        if (!selectedAlert) return null;
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(7, 9, 15, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: 24, animation: 'fade-in 0.2s ease-out'
          }} onClick={() => setSelectedAlertId(null)}>
            
            <div style={{
              background: 'var(--bg-panel)', border: '1px solid var(--orange-border)', borderRadius: 'var(--radius)',
              width: '100%', maxWidth: 700, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', position: 'relative'
            }} onClick={e => e.stopPropagation()}>
              
              {/* Corner brackets */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderLeft: '2px solid var(--orange)', borderTop: '2px solid var(--orange)' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRight: '2px solid var(--orange)', borderTop: '2px solid var(--orange)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 8, height: 8, borderLeft: '2px solid var(--orange)', borderBottom: '2px solid var(--orange)' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRight: '2px solid var(--orange)', borderBottom: '2px solid var(--orange)' }} />

              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{TYPE_ICON[selectedAlert.alert_type] || '⚠️'}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--orange-bright)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {selectedAlert.alert_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ID: {selectedAlert.id} · {new Date(selectedAlert.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAlertId(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    transition: 'color var(--t-fast)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.02)', padding: 12, borderLeft: '3px solid var(--orange)' }}>
                  {selectedAlert.description}
                </div>

                {selectedAlert.snapshot_url ? (
                  <div style={{ position: 'relative', overflow: 'hidden', background: '#000', border: '1px solid var(--border)', aspectRatio: '16/9' }}>
                    <img src={selectedAlert.snapshot_url} alt="Alert Snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                      <span className="live-badge" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid var(--border)' }}>
                        <Camera size={10} style={{ marginRight: 4, display: 'inline-block' }} /> 
                        CAM #{selectedAlert.camera_id || 'UNKNOWN'}
                      </span>
                      <span className="badge" style={{
                        background: selectedAlert.severity === 'CRITICAL' ? 'var(--red-dim)' : 'rgba(255, 107, 0, 0.15)',
                        color: selectedAlert.severity === 'CRITICAL' ? 'var(--red-light)' : 'var(--orange-bright)',
                        borderColor: selectedAlert.severity === 'CRITICAL' ? 'var(--border-red)' : 'var(--orange-border)'
                      }}>
                        {selectedAlert.severity}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 12, right: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {selectedAlert.timestamp}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 200, background: 'var(--bg-input)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 8 }}>
                    <Camera size={32} opacity={0.2} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>NO SNAPSHOT RECORDED IN LOGS</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1, padding: 12, fontSize: 12, justifyContent: 'center', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}
                    onClick={() => doAck(selectedAlert.id)}
                  >
                    <CheckCheck size={14} style={{ marginRight: 6 }} /> ACKNOWLEDGE ALERT
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0 16px', fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}
                    onClick={() => setSelectedAlertId(null)}
                  >
                    DISMISS
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
