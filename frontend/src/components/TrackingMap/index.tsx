import React, { useState } from 'react';
import { User, Eye, Search, TrendingUp } from 'lucide-react';

const TrackingMap: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [searchedTrack, setSearchedTrack] = useState<any | null>(null);

  const mockTrackHistory = {
    '273f': {
      id: '273f',
      status: 'Active',
      type: 'Passenger',
      origin: 'Security Lounge',
      cameras: [
        { time: '12:04:11', cam: 'Entrance Terminal 1', action: 'Entered gate' },
        { time: '12:08:43', cam: 'Duty Free Center Corridor', action: 'Stopped at shop' },
        { time: '12:15:30', cam: 'Rest Area Main', action: 'Dwell time inside Lounge' }
      ]
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = searchId.toLowerCase().trim();
    if (cleanId in mockTrackHistory) {
      setSearchedTrack((mockTrackHistory as any)[cleanId]);
    } else {
      setSearchedTrack({ error: 'ID not found. Verify global ID and retry.' });
    }
  };

  return (
    <div style={{ display: 'flex', gap: '16px', height: '100%' }}>
      {/* Left search tools */}
      <div className="glass-panel" style={{ width: '360px', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Cross-Camera Re-ID</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Track individuals across different terminal camera feeds.</p>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search Global Re-ID (e.g. 273f)"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            style={{
              flexGrow: 1,
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: 'white',
              fontSize: '13px'
            }}
          />
          <button type="submit" className="glow-btn" style={{ padding: '8px 12px', borderRadius: '8px' }}>
            <Search size={14} />
          </button>
        </form>

        {searchedTrack && !searchedTrack.error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <User size={28} color="var(--color-secondary)" />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Track ID: #{searchedTrack.id}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-success)' }}>Status: {searchedTrack.status}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>CROSS-CAM TIMELINE</div>
              <div style={{ position: 'relative', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Timeline vertical bar */}
                <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '8px', width: '2px', background: 'rgba(99,102,241,0.3)' }} />
                
                {searchedTrack.cameras.map((c: any, i: number) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '4px', left: '-20px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                    <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 'bold' }}>{c.time}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{c.cam}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{c.action}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {searchedTrack && searchedTrack.error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '12px', fontWeight: 'bold' }}>
            {searchedTrack.error}
          </div>
        )}
      </div>

      {/* Right floor overview visualization */}
      <div className="glass-panel" style={{ flexGrow: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'radial-gradient(circle, #0e1423 0%, #070a12 100%)' }}>
        <TrendingUp size={64} color="rgba(255,255,255,0.05)" />
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '16px' }}>
          Select a tracked ID to generate spatial journey mapping overlays.
        </span>
      </div>
    </div>
  );
};

export default TrackingMap;
