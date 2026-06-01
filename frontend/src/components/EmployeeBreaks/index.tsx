import React, { useState } from 'react';
import { Coffee, ShieldCheck, CheckSquare, Clock } from 'lucide-react';

const EmployeeBreaks: React.FC = () => {
  const [employees] = useState([
    { id: 1, code: 'E-421', name: 'Rohan Sharma', dept: 'Ground Staff', breakTimer: '45 mins remaining', status: 'IN LOUNGE' },
    { id: 2, code: 'E-809', name: 'Zara Khan', dept: 'Security Checkpoint', breakTimer: '2 hrs continuous work', status: 'ACTIVE DUTY' },
    { id: 3, code: 'E-112', name: 'John Doe', dept: 'Luggage Desk', breakTimer: 'Break Exceeded! (40 mins elapsed)', status: 'OVER-LIMIT' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Airport Staff Relaxation Board</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Automatic compliance tracking for personnel. Employees require a 15 min rest break every 2 hours.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {employees.map((e) => (
          <div key={e.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {e.code}
              </div>
              <span
                style={{
                  background: e.status === 'IN LOUNGE' ? 'rgba(16,185,129,0.1)' : e.status === 'OVER-LIMIT' ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.05)',
                  color: e.status === 'IN LOUNGE' ? 'var(--color-success)' : e.status === 'OVER-LIMIT' ? 'var(--color-danger)' : 'white',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '11px'
                }}
              >
                {e.status}
              </span>
            </div>

            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>{e.name}</h4>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{e.dept}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
              <Clock size={14} color={e.status === 'OVER-LIMIT' ? 'var(--color-danger)' : 'var(--color-text-muted)'} />
              <span style={{ fontWeight: '600', color: e.status === 'OVER-LIMIT' ? 'var(--color-danger)' : 'var(--color-text-main)' }}>{e.breakTimer}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeBreaks;
