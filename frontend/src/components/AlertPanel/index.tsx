import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

const AlertPanel: React.FC = () => {
  const [alerts, setAlerts] = useState([
    { id: 1, type: 'RESTRICTED_ZONE', desc: 'Intrusion in Airport Runway Terminal 2 Lounge', time: '12:12:04', status: 'CRITICAL', camera: 'Entrance Terminal 1' },
    { id: 2, type: 'WATCHLIST_MATCH', desc: 'Possible Watchlist/Blacklist face match: passport index #129A', time: '12:09:55', status: 'HIGH', camera: 'Duty Free Center Corridor' },
    { id: 3, type: 'BREAK_VIOLATION', desc: 'Employee E-129 exceeded break boundaries > 2 hrs limit', time: '11:45:00', status: 'WARNING', camera: 'Rest Area Main' },
  ]);

  const handleAcknowledge = (id: number) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Active Security Alerts</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Real-time warnings from intrusion lines and watchlist comparisons.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alerts.map((a) => (
          <div key={a.id} className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: a.status === 'CRITICAL' ? '4px solid var(--color-danger)' : a.status === 'HIGH' ? '4px solid var(--color-warning)' : '4px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '12px' }}>
                <AlertTriangle size={24} color={a.status === 'CRITICAL' ? 'var(--color-danger)' : a.status === 'HIGH' ? 'var(--color-warning)' : 'var(--color-primary)'} />
              </div>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '20px' }}>{a.type}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{a.time}</span>
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '6px' }}>{a.desc}</h4>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Camera Source: <strong>{a.camera}</strong></p>
              </div>
            </div>

            <button className="glow-btn" style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-success)' }} onClick={() => handleAcknowledge(a.id)}>
              <ShieldCheck size={14} /> Resolve Alert
            </button>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--color-text-muted)' }}>
            <CheckCircle2 size={48} color="var(--color-success)" />
            <h3 style={{ color: 'white' }}>System Clear</h3>
            <span>No active security threats reported at this time.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertPanel;
