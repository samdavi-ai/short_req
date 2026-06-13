import React, { useState } from 'react';
import { Camera, Grid, WifiOff } from 'lucide-react';
import { useStore, Camera as CameraType } from '../stores/appStore';
import PersonJourney from './PersonJourney';

// ─── CameraFeedCard ────────────────────────────────────────────────────────────

function CameraFeedCard({ cam, selected, onClick, onSelectTrack }: {
  cam: CameraType;
  selected: boolean;
  onClick: () => void;
  onSelectTrack: (globalId: string) => void;
}) {
  const tracks = useStore((state) => state.tracks);
  const isOffline = cam.status === 'OFFLINE';
  const isMaint  = cam.status === 'MAINTENANCE';

  const videoRef  = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Store video natural dimensions set by onLoadedMetadata
  const [videoSize, setVideoSize] = React.useState<{ w: number; h: number } | null>(null);

  // Force re-render every 150ms so bounding boxes track in real time
  const [, forceRender] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(forceRender, 150);
    return () => clearInterval(id);
  }, []);

  // Resolve video source — must match run_all_videos.py exactly so detections align
  const videoSrc = React.useMemo(() => {
    if (cam.rtsp_url && cam.rtsp_url.endsWith('.mp4')) {
      const parts = cam.rtsp_url.split('/');
      return `/videos/${parts[parts.length - 1]}`;
    }
    // Camera ID → video file mapping (mirrors processing/run_all_videos.py)
    const mapping: Record<number, string> = {
      1:  '/videos/SS1.mp4',
      2:  '/videos/SS2.mp4',
      3:  '/videos/SS3.mp4',
      4:  '/videos/test_video.mp4',
      13: '/videos/MS1.mp4',
      14: '/videos/MS2.mp4',
      15: '/videos/MS3.mp4',
    };
    return mapping[cam.id] || null;
  }, [cam]);

  // Start / stop video stream when selected state changes
  React.useEffect(() => {
    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = '';
      }
      setVideoSize(null);
    };

    if (!selected || isOffline || isMaint) {
      stopStream();
      return;
    }

    if (videoSrc) {
      stopStream();
      if (videoRef.current) {
        videoRef.current.src = videoSrc;
        videoRef.current.loop = true;
        videoRef.current.play().catch((err) => console.error('Video play error:', err));
      }
      return;
    }

    // Fallback: webcam
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 360 } })
      .then((s) => {
        stopStream();
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => console.error('Webcam access error:', err));

    return stopStream;
  }, [selected, isOffline, isMaint, videoSrc]);

  // ── Real-time overlay: compute pixel coords from WS track bbox ──────────────
  const activeTracks = React.useMemo(() => {
    const now = Date.now() / 1000;
    return Object.values(tracks || {}).filter(
      (t: any) => t.camera_id === cam.id && now - t.timestamp < 1.5
    );
  }, [tracks, cam.id]);

  const renderOverlayBox = (track: any) => {
    if (!videoSize || !videoRef.current) return null;
    const vid    = videoRef.current;
    const frameW = videoSize.w;
    const frameH = videoSize.h;
    const elemW  = vid.clientWidth  || 1;
    const elemH  = vid.clientHeight || 1;
    if (!frameW || !frameH) return null;

    // Compute letterbox / pillarbox offsets for objectFit:contain
    const vidAspect  = frameW / frameH;
    const elemAspect = elemW  / elemH;
    let renderW: number, renderH: number, offX: number, offY: number;
    if (vidAspect > elemAspect) {
      // wider video → letterbox (black bars top/bottom)
      renderW = elemW;
      renderH = elemW / vidAspect;
      offX    = 0;
      offY    = (elemH - renderH) / 2;
    } else {
      // taller video → pillarbox (black bars left/right)
      renderH = elemH;
      renderW = elemH * vidAspect;
      offX    = (elemW - renderW) / 2;
      offY    = 0;
    }

    const [x1, y1, x2, y2] = track.bbox;
    const left   = offX + (x1 / frameW) * renderW;
    const top    = offY + (y1 / frameH) * renderH;
    const width  = ((x2 - x1) / frameW) * renderW;
    const height = ((y2 - y1) / frameH) * renderH;

    if (width < 4 || height < 4) return null;

    const color =
      track.identity_type === 'BLACKLISTED' || track.identity_type === 'WATCHLIST_MATCH'
        ? '#ef4444'
        : track.has_face
        ? '#3b82f6'
        : '#22c55e';

    const label = track.matched_name
      ? `${track.matched_name} #${track.track_id}`
      : `#${track.track_id}`;

    return (
      <div
        key={track.global_id}
        onClick={(e) => { e.stopPropagation(); onSelectTrack(track.global_id); }}
        title={`Click to trace ${label} across all cameras`}
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          border: `2px solid ${color}`,
          borderRadius: 3,
          boxShadow: `0 0 10px ${color}55`,
          pointerEvents: 'auto',
          cursor: 'pointer',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${color}18`;
          e.currentTarget.style.borderWidth = '3px';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderWidth = '2px';
        }}
      >
        {/* Label chip above the box */}
        <span style={{
          position: 'absolute',
          top: -20,
          left: 0,
          background: color,
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 3,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {label}
        </span>
        {/* Confidence dot */}
        {track.has_face && (
          <span style={{
            position: 'absolute',
            bottom: 2,
            right: 4,
            fontSize: 8,
            color,
            fontWeight: 700,
          }}>
            FACE
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`camera-feed${selected ? ' selected' : ''}${isOffline ? ' offline' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div
        className="camera-feed-placeholder"
        style={{
          background: isOffline
            ? 'var(--black-80)'
            : `linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
          // ── Live video + real-time detection overlay ──────────────────────
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#000',
                display: 'block',
              }}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                setVideoSize({ w: v.videoWidth, h: v.videoHeight });
              }}
            />
            {/* Detection overlay — only after video dimensions are known */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
              }}
            >
              {activeTracks.map(renderOverlayBox)}
            </div>
          </div>
        ) : (
          // ── Idle thumbnail ────────────────────────────────────────────────
          <>
            <Camera size={20} color="rgba(255,255,255,0.15)" />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
              CLICK TO STREAM
            </span>
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

// ─── LiveFeeds Page ────────────────────────────────────────────────────────────

export default function LiveFeeds() {
  const { cameras } = useStore();
  const [cols, setCols]           = useState<1 | 2 | 3 | 4>(3);
  const [selectedCam, setSelectedCam]     = useState<number | null>(null);
  const [floorFilter, setFloorFilter]     = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Show nothing until cameras are loaded from the API
  const displayCams = cameras;
  const floors  = [...new Set(displayCams.map((c) => c.floor))].sort((a, b) => b - a);
  const filtered = floorFilter !== null
    ? displayCams.filter((c) => c.floor === floorFilter)
    : displayCams;

  const online  = displayCams.filter((c) => c.status === 'ACTIVE').length;
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

      {/* Camera Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 2 }}>
        <div className={`camera-grid cols-${cols}`}>
          {filtered.map((cam) => (
            <CameraFeedCard
              key={cam.id}
              cam={cam}
              selected={selectedCam === cam.id}
              onClick={() => setSelectedCam(selectedCam === cam.id ? null : cam.id)}
              onSelectTrack={setSelectedTrackId}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Camera size={28} /></div>
            <div style={{ fontWeight: 600 }}>
              {displayCams.length === 0
                ? 'No cameras in database — check backend connection'
                : 'No cameras on this floor'}
            </div>
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
        <span style={{ marginLeft: 'auto' }}>Click camera to start/stop preview</span>
      </div>

      {selectedTrackId && (
        <PersonJourney
          globalId={selectedTrackId}
          onClose={() => setSelectedTrackId(null)}
        />
      )}
    </div>
  );
}
