import React, { useState } from 'react';
import { UserPlus, ShieldAlert, BadgeCheck, Check, Search } from 'lucide-react';

const VisitorManager: React.FC = () => {
  const [visitors, setVisitors] = useState([
    { id: 1, name: 'Vikram Singh', nationality: 'Indian', passport: 'Z92019A', status: 'WHITELISTED', seen: 'Entrance Terminal 1' },
    { id: 2, name: 'Al-Hashemi Mohammed', nationality: 'UAE', passport: 'X10292B', status: 'BLACKLISTED', seen: 'Duty Free Center Corridor' },
    { id: 3, name: 'Alice Cooper', nationality: 'USA', passport: 'T19302C', status: 'WATCHLIST', seen: 'Customs Lounge & Checkpoint' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Passenger Watchlist Registry</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Verify facial recognition matches and manage traveler whitelists.</p>
        </div>
        <button className="glow-btn">
          <UserPlus size={16} /> Enroll Visitor
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              <th style={{ padding: '12px 16px' }}>TRAVELER NAME</th>
              <th style={{ padding: '12px 16px' }}>PASSPORT</th>
              <th style={{ padding: '12px 16px' }}>NATIONALITY</th>
              <th style={{ padding: '12px 16px' }}>LAST LOCATION</th>
              <th style={{ padding: '12px 16px' }}>STATUS</th>
              <th style={{ padding: '12px 16px' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((v) => (
              <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                <td style={{ padding: '16px', fontWeight: 'bold' }}>{v.name}</td>
                <td style={{ padding: '16px', fontFamily: 'monospace' }}>{v.passport}</td>
                <td style={{ padding: '16px' }}>{v.nationality}</td>
                <td style={{ padding: '16px' }}>{v.seen}</td>
                <td style={{ padding: '16px' }}>
                  <span
                    style={{
                      background: v.status === 'WHITELISTED' ? 'rgba(16,185,129,0.1)' : v.status === 'BLACKLISTED' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)',
                      color: v.status === 'WHITELISTED' ? 'var(--color-success)' : v.status === 'BLACKLISTED' ? 'var(--color-danger)' : 'var(--color-warning)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}
                  >
                    {v.status}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    <BadgeCheck size={14} /> Review Logs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VisitorManager;
