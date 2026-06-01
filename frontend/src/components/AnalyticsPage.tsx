import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useStore } from '../stores/appStore';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const HOURLY = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  footfall: Math.floor(Math.random() * 400 + 50),
  alerts: Math.floor(Math.random() * 10),
  employees: Math.floor(Math.random() * 40 + 20),
}));

const ZONE_DWELL = [
  { name: 'Gate A3',        avg: 22, max: 47 },
  { name: 'Security Check', avg: 8,  max: 19 },
  { name: 'Baggage Claim',  avg: 31, max: 68 },
  { name: 'Retail East',    avg: 14, max: 38 },
  { name: 'Lounge B',       avg: 45, max: 90 },
  { name: 'Gate B3',        avg: 6,  max: 12 },
];

const ALERT_TYPES = [
  { name: 'Restricted Zone', value: 14, color: '#ef4444' },
  { name: 'Watchlist Match', value: 8,  color: '#dc2626' },
  { name: 'Dwell Exceeded',  value: 23, color: '#f59e0b' },
  { name: 'Camera Offline',  value: 5,  color: '#71717a' },
  { name: 'Break Violation', value: 12, color: '#22c55e' },
  { name: 'Tailgating',      value: 4,  color: '#a1a1aa' },
];

const NATIONALITY_FLOW = [
  { name: 'Mon', indian: 320, international: 180 },
  { name: 'Tue', indian: 290, international: 210 },
  { name: 'Wed', indian: 350, international: 160 },
  { name: 'Thu', indian: 280, international: 240 },
  { name: 'Fri', indian: 420, international: 310 },
  { name: 'Sat', indian: 510, international: 380 },
  { name: 'Sun', indian: 460, international: 290 },
];

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-muted)' },
};

export default function AnalyticsPage() {
  const { stats, cameras, alerts } = useStore();
  const totalCams  = stats?.total_cameras   ?? cameras.length;
  const activeCams = stats?.active_cameras  ?? cameras.filter((c) => c.status === 'ACTIVE').length;

  return (
    <div className="page-content">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { label: 'Peak Footfall Today', value: '1,847', change: '+12%', color: 'var(--green-bright)' },
            { label: 'Avg Dwell Time',      value: '18 min', change: '-3m',  color: 'var(--amber-bright)' },
            { label: 'Alert Rate (24h)',    value: `${ALERT_TYPES.reduce((s, a) => s + a.value, 0)}`, change: '+2',  color: 'var(--red-bright)' },
            { label: 'Camera Uptime',       value: totalCams > 0 ? `${Math.round((activeCams/totalCams)*100)}%` : '97%', change: 'SLA: 99%', color: 'var(--white)' },
          ].map((kpi) => (
            <div key={kpi.label} style={{
              background: 'var(--surface-1)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '18px 20px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: kpi.color }}>
                {kpi.change}
              </div>
            </div>
          ))}
        </div>

        {/* Footfall chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">24-Hour Footfall Analysis</div>
              <div className="card-subtitle">Person detection events across all cameras</div>
            </div>
          </div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={HOURLY}>
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
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                <Area type="monotone" dataKey="footfall" name="Persons Detected" stroke="#22c55e" strokeWidth={2} fill="url(#gG)" />
                <Area type="monotone" dataKey="alerts" name="Alerts Triggered" stroke="#ef4444" strokeWidth={1.5} fill="url(#rG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Alert type breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Alert Type Distribution (7-Day)</div>
            </div>
            <div style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width="45%" height={180}>
                <PieChart>
                  <Pie
                    data={ALERT_TYPES}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {ALERT_TYPES.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ALERT_TYPES.map((t) => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{t.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dwell time per zone */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Avg Dwell Time per Zone (min)</div>
            </div>
            <div style={{ padding: '12px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ZONE_DWELL} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="avg" name="Avg (min)" fill="#22c55e" radius={[0, 4, 4, 0]} opacity={0.8} />
                  <Bar dataKey="max" name="Max (min)" fill="#ef4444" radius={[0, 4, 4, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Weekly traffic by nationality */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Weekly Passenger Flow</div>
            <div className="card-subtitle">Domestic vs International — last 7 days</div>
          </div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={NATIONALITY_FLOW}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                <Bar dataKey="indian" name="Domestic" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="international" name="International" fill="#fafafa" opacity={0.6} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
