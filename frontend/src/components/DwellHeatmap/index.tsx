import React, { useState } from 'react';
import { Activity, Thermometer, Maximize, AlertCircle } from 'lucide-react';

const DwellHeatmap: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Terminal Dwell Time Heatmap</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Real-time overlay of passenger waiting locations and crowd density bottlenecks.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Heatmap overlay map */}
        <div className="glass-panel" style={{ flexGrow: 1, height: '480px', background: 'radial-gradient(circle, #101625 0%, #080b12 100%)', border: '1px solid var(--glass-border)', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          {/* Simulated heat glowing dots */}
          <div style={{ position: 'absolute', top: '30%', left: '40%', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.4) 0%, transparent 70%)', filter: 'blur(10px)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '20%', width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)', filter: 'blur(8px)' }} />

          <Thermometer size={48} color="rgba(255,255,255,0.05)" />
          <span style={{ color: 'var(--color-text-muted)', zIndex: 2, fontSize: '13px' }}>Architectural layout rendering complete. Mock heatmap overlay loaded.</span>
        </div>

        {/* Info panel */}
        <div className="glass-panel" style={{ width: '320px', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Area Congestion Metrics</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { zone: 'Duty Free Entrance', time: '14 mins average dwell', load: 'HIGH', color: 'var(--color-danger)' },
              { zone: 'Customs Desk B', time: '8 mins average dwell', load: 'MEDIUM', color: 'var(--color-warning)' },
              { zone: 'Gate 4 Boarding Lounge', time: '2 mins average dwell', load: 'LOW', color: 'var(--color-success)' }
            ].map((z, idx) => (
              <div key={idx} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{z.zone}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{z.time}</div>
                </div>
                <span style={{ fontSize: '10px', color: 'white', background: z.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{z.load}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DwellHeatmap;
