import React, { useState } from 'react';
import { Camera, RefreshCw, Play, Volume2, ShieldAlert } from 'lucide-react';

const LiveView: React.FC = () => {
  const [streams] = useState([
    { id: 1, name: 'Entrance Terminal 1', fps: '30.2 FPS', state: 'ONLINE', resolution: '1920x1080', people: 12 },
    { id: 2, name: 'Duty Free Center Corridor', fps: '29.8 FPS', state: 'ONLINE', resolution: '1920x1080', people: 25 },
    { id: 3, name: 'Customs Lounge & Checkpoint', fps: '30.0 FPS', state: 'ONLINE', resolution: '1920x1080', people: 8 },
    { id: 4, name: 'Baggage Claim Zone B', fps: '15.5 FPS', state: 'WARNING', resolution: '1280x720', people: 4 },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Live Video Monitoring</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Real-time camera matrix with head detection overlays.</p>
        </div>
        <button className="glow-btn">
          <RefreshCw size={16} /> Sync Cameras
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', flexGrow: 1 }}>
        {streams.map((stream) => (
          <div key={stream.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '320px' }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="var(--color-primary)" />
                <span style={{ fontWeight: '600', fontSize: '14px' }}>{stream.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{stream.resolution}</span>
                <span style={{ color: stream.state === 'ONLINE' ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 'bold' }}>{stream.fps}</span>
              </div>
            </div>

            {/* Video container mock */}
            <div style={{ flexGrow: 1, background: '#05070c', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              {/* Outer detection box overlay simulation */}
              <div style={{ position: 'absolute', top: '25%', left: '30%', border: '2px solid var(--color-primary)', borderRadius: '4px', padding: '2px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ background: 'var(--color-primary)', color: 'white', fontSize: '8px', fontWeight: 'bold' }}>REID-729B</span>
              </div>
              <div style={{ position: 'absolute', top: '40%', left: '60%', border: '2px solid var(--color-success)', borderRadius: '4px', padding: '2px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ background: 'var(--color-success)', color: 'white', fontSize: '8px', fontWeight: 'bold' }}>STAFF-103</span>
              </div>

              {/* Security incident flash if warning */}
              {stream.state === 'WARNING' && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(244, 63, 94, 0.9)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', animation: 'pulseGlow 1s infinite' }}>
                  <ShieldAlert size={12} /> Low Framerate
                </div>
              )}

              <Play size={48} color="rgba(255, 255, 255, 0.15)" />
            </div>

            {/* Footer controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Tracked Entities: <strong>{stream.people}</strong></span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Volume2 size={14} style={{ cursor: 'pointer' }} color="var(--color-text-muted)" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveView;
