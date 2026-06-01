import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Download, TrendingUp, Users, Radio, AlertTriangle } from 'lucide-react';

const Analytics: React.FC = () => {
  const [data] = useState([
    { time: '08:00', passengers: 120, alerts: 1, staff: 20 },
    { time: '10:00', passengers: 340, alerts: 4, staff: 24 },
    { time: '12:00', passengers: 512, alerts: 2, staff: 28 },
    { time: '14:00', passengers: 420, alerts: 5, staff: 25 },
    { time: '16:00', passengers: 480, alerts: 0, staff: 22 },
    { time: '18:00', passengers: 390, alerts: 1, staff: 19 },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Surveillance Summary Reports</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Analyze hourly passenger loads and terminal efficiency parameters.</p>
        </div>
        <button className="glow-btn">
          <Download size={16} /> Export CSV Summary
        </button>
      </div>

      {/* Aggregate metrics widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total Tracked Visitors', count: '1,842', desc: '+12% from yesterday', icon: Users, color: 'var(--color-primary)' },
          { label: 'Active Camera Nodes', count: '32/32', desc: '100% network status', icon: Radio, color: 'var(--color-success)' },
          { label: 'Security Alerts (24h)', count: '14', desc: '-40% than last week', icon: AlertTriangle, color: 'var(--color-warning)' },
          { label: 'Avg Passenger Dwell', count: '11 mins', desc: 'Optimal waiting times', icon: TrendingUp, color: 'var(--color-secondary)' },
        ].map((w, idx) => {
          const Icon = w.icon;
          return (
            <div key={idx} className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{w.label}</span>
                <h3 style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px' }}>{w.count}</h3>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>{w.desc}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                <Icon size={24} color={w.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts container */}
      <div className="glass-panel" style={{ padding: '24px', flexGrow: 1, minHeight: '320px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Hourly Traffic & Density Flow</h3>
        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'white' }} />
              <Area type="monotone" dataKey="passengers" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPass)" name="Travelers Count" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
