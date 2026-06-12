import React, { useState } from 'react';
import { Camera, Grid, WifiOff } from 'lucide-react';
import { useStore } from '../stores/appStore';

const DEMO_CAMERAS = [
  { id: 1, name: 'Gate A1 — Entrance', floor: 1, status: 'ACTIVE', location: 'Terminal 1 Entry' },
  { id: 2, name: 'Security Checkpoint', floor: 1, status: 'ACTIVE', location: 'Main Security' },
  { id: 3, name: 'Baggage Claim B', floor: 1, status: 'ACTIVE', location: 'Arrivals Hall' },
  { id: 4, name: 'Gate B3 — Restricted', floor: 2, status: 'OFFLINE', location: 'Boarding Gate B3' },
  { id: 5, name: 'Retail Zone East', floor: 2, status: 'ACTIVE', location: 'Shopping Corridor' },
  { id: 6, name: 'Elevator Lobby F1', floor: 1, status: 'ACTIVE', location: 'Elevator Bank' },
  { id: 7, name: 'Tarmac Camera 1', floor: 0, status: 'ACTIVE', location: 'Tarmac North' },
  { id: 8, name: 'Parking Level 2', floor: -1, status: 'MAINTENANCE', location: 'Multi-Storey Parking' },
];

const TRACK_DOTS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 80 + 10,
  y: Math.random() * 80 + 10,
  color: Math.random() > 0.9 ? '#ef4444' : '#22c55e',
}));

function CameraFeedCard({ cam, selected, onClick }: {
  cam: typeof DEMO_CAMERAS[0];
  selected: boolean;
  onClick: () => void;
}) {
  const tracks = useStore((state) => state.tracks);
  const token = useStore((state) => state.token);
  const isDemoMode = !token || token === 'demo-token';
  const isOffline = cam.status === 'OFFLINE';
  const isMaint = cam.status === 'MAINTENANCE';
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    const stopCurrentStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    if (!selected || isOffline || isMaint) {
      stopCurrentStream();
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } })
      .then((s) => {
        stopCurrentStream();
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => {
        console.error("Webcam access error:", err);
      });

    return () => {
      stopCurrentStream();
    };
  }, [selected, isOffline, isMaint]);

  return (
    <div
      className={`camera-feed${selected ? ' selected' : ''}${isOffline ? ' offline' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="camera-feed-placeholder" style={{
        background: isOffline ? 'var(--black-80)' :
          `linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)`,
        position: 'relative',
      }}>
        {isOffline ? (
          <>
            <WifiOff size={28} color="var(--red-bright)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-bright)' }}>SIGNAL LOST</span>
          </>
        ) : isMaint ? (
          <>
            <Camera size={28} color="var(--amber-bright)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber-bright)' }}>MAINTENANCE</span>
          </>
        ) : selected ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            {/* Real-time Bounding Boxes Overlay */}
            {Object.values(tracks || {})
              .filter((t: any) => t.camera_id === cam.id && (Date.now() / 1000 - t.timestamp) < 2.0)
              .map((track: any) => {
                // Approximate coordinate mapping to the video element bounds (assuming 640x360 standard)
                const left = (track.bbox[0] / 640) * 100;
                const top = (track.bbox[1] / 360) * 100;
                const width = ((track.bbox[2] - track.bbox[0]) / 640) * 100;
                const height = ((track.bbox[3] - track.bbox[1]) / 360) * 100;
                return (
                  <div
                    key={track.global_id}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      border: `2px solid ${track.has_face ? '#3b82f6' : '#22c55e'}`,
                      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                      pointerEvents: 'none'
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: -18, left: -2, background: track.has_face ? '#3b82f6' : '#22c55e', 
                      color: '#fff', fontSize: 10, padding: '2px 4px', fontWeight: 'bold'
                    }}>
                      ID: {track.track_id}
                    </span>
                  </div>
                );
            })}
          </div>
        ) : (
          <>
            {/* Animated scan lines for "live" feel */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
              pointerEvents: 'none',
            }} />
            {/* Real movement dots via Websocket Tracks (Wait, this is LiveFeeds... We just show a dummy stream if not active.) */}
            {isDemoMode && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {TRACK_DOTS.slice(0, cam.id * 3 % 12).map((dot) => (
                  <circle key={dot.id} cx={`${dot.x}%`} cy={`${dot.y}%`} r="3" fill={dot.color} opacity={0.8} />
                ))}
              </svg>
            )}
            <Camera size={20} color="rgba(255,255,255,0.15)" />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>CLICK TO STREAM WEBCAM</span>
          </>
        )}
      </div>

      <div className="camera-feed-overlay">
        <div>
          <div className="camera-label">{cam.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {cam.location} · Floor {cam.floor < 0 ? 'B' : cam.floor === 0 ? 'G' : cam.floor}
          </div>
        </div>
        <div className="camera-status-indicator">
          <span className={`camera-dot ${isOffline ? 'offline' : 'online'}`} />
          {isOffline ? 'OFFLINE' : isMaint ? 'MAINT' : 'LIVE'}
        </div>
      </div>
    </div>
  );
}

export default function LiveFeeds() {
  const { cameras } = useStore();
  const displayCams = cameras.length > 0 ? cameras : DEMO_CAMERAS;
  const [cols, setCols] = useState<1 | 2 | 3 | 4>(3);
  const [selectedCam, setSelectedCam] = useState<number | null>(null);
  const [floorFilter, setFloorFilter] = useState<number | null>(null);

  const floors = [...new Set(displayCams.map((c) => c.floor))].sort((a, b) => b - a);
  const filtered = floorFilter !== null ? displayCams.filter((c) => c.floor === floorFilter) : displayCams;

  const online = displayCams.filter((c) => c.status === 'ACTIVE').length;
  const offline = displayCams.filter((c) => c.status !== 'ACTIVE').length;

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Controls bar */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginRight: 8 }}>
          <span className="badge badge-green"><span className="badge-dot" />{online} Online</span>
          {offline > 0 && <span className="badge badge-red"><span className="badge-dot" />{offline} Offline</span>}
        </div>

        <div style={{ height: 20, width: 1, background: 'var(--border)' }} />

        {/* Floor filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-sm ${floorFilter === null ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFloorFilter(null)}
          >All</button>
          {floors.map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${floorFilter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFloorFilter(f)}
            >
              {f < 0 ? 'B' : f === 0 ? 'G' : `F${f}`}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {/* Grid size */}
          {([1, 2, 3, 4] as const).map((c) => (
            <button
              key={c}
              id={`grid-${c}col`}
              className={`icon-btn ${cols === c ? 'active' : ''}`}
              style={cols === c ? { background: 'var(--green-dim)', borderColor: 'var(--border-green)', color: 'var(--green-bright)' } : {}}
              onClick={() => setCols(c)}
              title={`${c} column${c > 1 ? 's' : ''}`}
            >
              <Grid size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 2 }}>
        <div className={`camera-grid cols-${cols}`}>
          {filtered.map((cam) => (
            <CameraFeedCard
              key={cam.id}
              cam={cam as typeof DEMO_CAMERAS[0]}
              selected={selectedCam === cam.id}
              onClick={() => setSelectedCam(selectedCam === cam.id ? null : cam.id)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Camera size={28} /></div>
            <div style={{ fontWeight: 600 }}>No cameras on this floor</div>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 11,
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <span>📷 {filtered.length} cameras displayed</span>
        <span>·</span>
        <span style={{ color: 'var(--green-bright)' }}>● {online} streaming</span>
        {offline > 0 && <><span>·</span><span style={{ color: 'var(--red-bright)' }}>● {offline} offline</span></>}
        <span style={{ marginLeft: 'auto' }}>
          Click camera to start/stop preview
        </span>
      </div>
    </div>
  );
}
