import React from 'react';
import {
  Camera, ShieldAlert, Users, UserCheck,
  TrendingUp, TrendingDown, Activity, Eye,
  AlertTriangle, CheckCircle, Clock, MapPin
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

// Mock hourly traffic for demo
const mockHourly = Array.from({ length: 12 }, (_, i) => ({
  hour: `${(new Date().getHours() - 11 + i + 24) % 24}:00`,
  count: Math.floor(Math.random() * 300 + 80),
  alerts: Math.floor(Math.random() * 8),
}));

function StatCard({
  label, value, icon: Icon, color, change, changeDir,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: 'green' | 'red' | 'amber' | 'white'; change?: string; changeDir?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <div className={`stat-icon ${color}`}>
          <Icon size={18} />
        </div>
        {change && (
          <span className={`stat-change ${changeDir || 'flat'}`}>{change}</span>
        )}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { stats, alerts, cameras, visitors, employees } = useStore();

  // Computed from real or demo data
  const totalCams   = stats?.total_cameras   ?? cameras.length;
  const activeCams  = stats?.active_cameras  ?? cameras.filter((c) => c.status === 'ACTIVE').length;
  const offlineCams = stats?.offline_cameras ?? cameras.filter((c) => c.status !== 'ACTIVE').length;
  const unackAlerts = stats?.unacknowledged_alerts ?? alerts.filter((a) => !a.acknowledged).length;
  const totalVisitors = stats?.total_visitors ?? visitors.length;
  const watchlisted = stats?.watchlisted ?? visitors.filter((v) => v.status === 'BLACKLISTED' || v.status === 'WATCHLIST').length;
  const activeTracks = stats?.active_tracks ?? 0;
  const totalEmps = stats?.total_employees ?? employees.length;

  const recentAlerts = [...alerts]
    .filter((a) => !a.acknowledged)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const sevColor = (s: string) => {
    if (s === 'CRITICAL') return 'var(--red-bright)';
    if (s === 'HIGH') return 'var(--red-light)';
    if (s === 'MEDIUM') return 'var(--amber-bright)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="page-content">
      <div style={{ padding: '20px' }}>

        {/* Unacknowledged alert banner */}
        {unackAlerts > 0 && (
          <div className="alert-banner critical" style={{ marginBottom: 20 }}>
            <AlertTriangle size={16} />
            <strong>{unackAlerts} unacknowledged alert{unackAlerts > 1 ? 's' : ''}</strong>
            {' — '}Immediate supervisor review required.
            <button
              className="btn btn-sm btn-danger"
              style={{ marginLeft: 'auto' }}
              onClick={() => useStore.getState().setPage('alerts')}
            >
              View Alerts
            </button>
          </div>
        )}

        {/* Stat Grid */}
        <div className="grid grid-4 grid-gap" style={{ marginBottom: 20 }}>
          <StatCard label="Cameras Online" value={`${activeCams}/${totalCams}`} icon={Camera}
            color={offlineCams > 0 ? 'amber' : 'green'}
            change={offlineCams > 0 ? `${offlineCams} offline` : 'All online'} changeDir={offlineCams > 0 ? 'down' : 'up'} />
          <StatCard label="Active Alerts" value={unackAlerts} icon={ShieldAlert}
            color={unackAlerts > 0 ? 'red' : 'green'}
            change={unackAlerts > 0 ? 'ACTION NEEDED' : 'All clear'} changeDir={unackAlerts > 0 ? 'down' : 'up'} />
          <StatCard label="Tracked Persons" value={activeTracks} icon={Activity}
            color="white" change="Real-time" changeDir="flat" />
          <StatCard label="Visitors Today" value={totalVisitors} icon={Users}
            color={watchlisted > 0 ? 'amber' : 'green'}
            change={watchlisted > 0 ? `${watchlisted} watchlisted` : 'No threats'} changeDir={watchlisted > 0 ? 'down' : 'up'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Traffic chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Hourly Footfall</div>
                <div className="card-subtitle">Person count — last 12 hours</div>
              </div>
              <span className="live-badge"><span className="live-dot" />LIVE</span>
            </div>
            <div style={{ padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={mockHourly}>
                  <defs>
                    <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    itemStyle={{ color: 'var(--green-bright)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} fill="url(#greenGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alerts by hour */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Alert Frequency</div>
                <div className="card-subtitle">Alerts triggered — last 12 hours</div>
              </div>
            </div>
            <div style={{ padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={mockHourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    itemStyle={{ color: 'var(--red-bright)' }}
                  />
                  <Bar dataKey="alerts" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>

          {/* Recent Alerts */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Unacknowledged Alerts</div>
                <div className="card-subtitle">Pending operator review</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => useStore.getState().setPage('alerts')}>
                View All
              </button>
            </div>
            {recentAlerts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><CheckCircle size={28} /></div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No pending alerts</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All clear — system operating normally</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Description</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {a.alert_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sevColor(a.severity) }}>
                          ● {a.severity}
                        </span>
                      </td>
                      <td className="truncate" style={{ maxWidth: 240 }}>
                        {a.description || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick stats side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">System Status</div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Camera Coverage', val: totalCams > 0 ? Math.round((activeCams / totalCams) * 100) : 100, color: 'green' },
                  { label: 'Alert Response Rate', val: alerts.length > 0 ? Math.round((alerts.filter(a => a.acknowledged).length / alerts.length) * 100) : 100, color: 'green' },
                  { label: 'Watchlist Checks', val: 98, color: 'green' },
                  { label: 'System Health', val: offlineCams > 0 ? 80 : 100, color: offlineCams > 0 ? 'amber' : 'green' },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.color === 'amber' ? 'var(--amber-bright)' : 'var(--green-bright)' }}>
                        {item.val}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${item.color === 'amber' ? 'amber' : ''}`}
                        style={{ width: `${item.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Quick Access</div>
              </div>
              <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Live Feeds',  icon: Eye,       page: 'live' },
                  { label: 'Watchlist',   icon: AlertTriangle, page: 'visitors' },
                  { label: 'Layout Map',  icon: MapPin,    page: 'layout' },
                  { label: 'Employees',   icon: UserCheck, page: 'employees' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.page}
                      className="btn btn-secondary"
                      style={{ justifyContent: 'center', flexDirection: 'column', height: 56, gap: 4 }}
                      onClick={() => useStore.getState().setPage(item.page)}
                    >
                      <Icon size={16} />
                      <span style={{ fontSize: 11 }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
