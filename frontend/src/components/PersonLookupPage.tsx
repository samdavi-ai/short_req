/**
 * PersonLookupPage — COBALT FORGE
 * Split-panel page:
 *  LEFT  — Search by name/ID, shows list of matched employees + visitors
 *  RIGHT — Full inline person detail view (authorized vs unauthorized)
 *
 * Integrated into sidebar as "Person Lookup" tab.
 */
import React, { useState, useMemo, useEffect, useRef, useReducer } from 'react';
import {
  Search, User, UserCheck, Users, ShieldCheck, ShieldAlert,
  Camera, Activity, Clock, TrendingUp, MapPin, X, Fingerprint,
  ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useStore, Employee, Visitor, Camera as CameraType } from '../stores/appStore';
import { resolveAssetUrl } from '../config/runtime';
import { api } from '../hooks/api';

/* ─── Types ─────────────────────────────────────────────── */
type PersonType = 'employee' | 'visitor';
type PersonRecord = { type: PersonType; data: Employee | Visitor };

/* ─── Helpers ───────────────────────────────────────────── */
const isVisitorAuthorized = (v: Visitor) =>
  v.status === 'WHITELISTED' || v.status === 'PENDING';

const sevColor = (s: string) => {
  if (s === 'CRITICAL') return 'var(--red)';
  if (s === 'HIGH') return '#FF6644';
  if (s === 'MEDIUM') return 'var(--amber)';
  return 'var(--text-muted)';
};

function statusBadge(authorized: boolean, label: string) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
      fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      background: authorized ? 'var(--green-dim)' : 'rgba(255,34,68,0.12)',
      color: authorized ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${authorized ? 'var(--green-border)' : 'var(--red-border)'}`,
    }}>
      {authorized
        ? <ShieldCheck size={9} aria-hidden="true" />
        : <ShieldAlert size={9} aria-hidden="true" />}
      {label}
    </span>
  );
}

function getPhotoSrc(p: Employee | Visitor): string | undefined {
  const path = (p as any).photo_path;
  if (!path) return undefined;
  return resolveAssetUrl(path);
}

/* ─── Sub-components ────────────────────────────────────── */

function InfoRow({ label, value, valueColor }: { label: string; value?: string | null; valueColor?: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'baseline',
      gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)',
        color: 'var(--text-ghost)', letterSpacing: '0.06em',
        textTransform: 'uppercase', lineHeight: 1.5,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-body)',
        color: valueColor || 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5,
      }}>
        {value || <span style={{ color: 'var(--text-ghost)', fontStyle: 'italic' }}>N/A</span>}
      </span>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800,
      letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--orange)',
      paddingBottom: 6, marginBottom: 2,
      borderBottom: '1px solid var(--orange-border)',
    }}>
      <Icon size={10} aria-hidden="true" />
      {label}
    </div>
  );
}

function MovChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '6px 10px', border: '1px solid var(--border)',
      background: 'var(--bg-elevated)', minWidth: 80,
    }}>
      <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 800, color: color || 'var(--text-primary)', letterSpacing: '0.04em' }}>
        {value}
      </span>
    </div>
  );
}

/* ── Live Camera Image Panel ── */
function LiveImagePanel({
  record,
  authorized,
  borderColor,
  cameraLabel,
  isCurrentlyActive,
  activeTrack,
  matchedCamera,
}: {
  record: PersonRecord;
  authorized: boolean;
  borderColor: string;
  cameraLabel: string;
  isCurrentlyActive: boolean;
  activeTrack?: any;
  matchedCamera?: CameraType;
}) {
  const photoSrc = getPhotoSrc(record.data);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  // Force re-render every 150ms so bounding boxes track in real time
  const [, forceRender] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(forceRender, 150);
    return () => clearInterval(id);
  }, []);

  const videoSrc = useMemo(() => {
    if (!matchedCamera) return null;
    if (matchedCamera.rtsp_url === '0' || matchedCamera.rtsp_url === '1' || (matchedCamera.rtsp_url && /^\d+$/.test(matchedCamera.rtsp_url))) {
      return null;
    }
    if (matchedCamera.rtsp_url && matchedCamera.rtsp_url.includes('uploads/')) {
      const parts = matchedCamera.rtsp_url.split('/');
      const filename = parts[parts.length - 1];
      return resolveAssetUrl(`/uploads/${filename}`) || null;
    }
    if (matchedCamera.rtsp_url && matchedCamera.rtsp_url.endsWith('.mp4')) {
      const parts = matchedCamera.rtsp_url.split('/');
      return `/videos/${parts[parts.length - 1]}`;
    }
    const mapping: Record<number, string> = {
      1:  '/videos/SS1.mp4',
      2:  '/videos/SS2.mp4',
      3:  '/videos/SS3.mp4',
      4:  '/videos/test_video.mp4',
      13: '/videos/MS1.mp4',
      14: '/videos/MS2.mp4',
      15: '/videos/MS3.mp4',
    };
    return mapping[matchedCamera.id] || null;
  }, [matchedCamera]);

  useEffect(() => {
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

    if (!isCurrentlyActive || !matchedCamera) {
      stopStream();
      return;
    }

    const isOffline = matchedCamera.status === 'OFFLINE';
    const isMaint = matchedCamera.status === 'MAINTENANCE';

    if (isOffline || isMaint) {
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
  }, [isCurrentlyActive, matchedCamera, videoSrc]);

  const renderOverlayBox = (track: any) => {
    if (!videoSize || !videoRef.current) return null;
    const vid    = videoRef.current;
    const frameW = videoSize.w;
    const frameH = videoSize.h;
    const elemW  = vid.clientWidth  || 1;
    const elemH  = vid.clientHeight || 1;
    if (!frameW || !frameH) return null;

    const vidAspect  = frameW / frameH;
    const elemAspect = elemW  / elemH;
    let renderW: number, renderH: number, offX: number, offY: number;
    if (vidAspect > elemAspect) {
      renderW = elemW;
      renderH = elemW / vidAspect;
      offX    = 0;
      offY    = (elemH - renderH) / 2;
    } else {
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

    const isAuthorized = track.identity_type === 'KNOWN_EMPLOYEE' || track.identity_type === 'KNOWN_VISITOR';
    const isDangerous  = track.identity_type === 'BLACKLISTED' || track.identity_type === 'WATCHLIST_MATCH';
    const color = isAuthorized ? '#22c55e' : isDangerous ? '#ef4444' : '#ef4444';
    const glow  = isAuthorized ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';

    const label = isAuthorized
      ? (track.matched_name || `Person #${track.track_id}`)
      : `UNKNOWN #${track.track_id}`;

    const statusTag = isAuthorized ? 'AUTHORIZED' : isDangerous ? track.identity_type.replace('_', ' ') : 'UNAUTHORIZED';
    const cornerSz  = Math.min(width, height) * 0.22;
    const cornerThk = 2;

    const cornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => ({
      position: 'absolute',
      width: cornerSz, height: cornerSz,
      ...(pos === 'tl' ? { top: -1, left: -1, borderTop: `${cornerThk}px solid ${color}`, borderLeft: `${cornerThk}px solid ${color}` } : {}),
      ...(pos === 'tr' ? { top: -1, right: -1, borderTop: `${cornerThk}px solid ${color}`, borderRight: `${cornerThk}px solid ${color}` } : {}),
      ...(pos === 'bl' ? { bottom: -1, left: -1, borderBottom: `${cornerThk}px solid ${color}`, borderLeft: `${cornerThk}px solid ${color}` } : {}),
      ...(pos === 'br' ? { bottom: -1, right: -1, borderBottom: `${cornerThk}px solid ${color}`, borderRight: `${cornerThk}px solid ${color}` } : {}),
    });

    return (
      <div
        style={{
          position: 'absolute',
          left, top, width, height,
          border: `1px solid ${color}55`,
          background: isAuthorized ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.05)',
          borderRadius: 2,
          boxShadow: `0 0 14px ${glow}, inset 0 0 20px ${glow}22`,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div style={cornerStyle('tl')} />
        <div style={cornerStyle('tr')} />
        <div style={cornerStyle('bl')} />
        <div style={cornerStyle('br')} />

        <div style={{
          position: 'absolute',
          top: -22,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{
            background: color,
            color: '#000',
            fontSize: 9,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            letterSpacing: '0.05em',
          }}>
            {label}
          </span>
        </div>

        <div style={{
          position: 'absolute',
          bottom: -20,
          left: 0,
        }}>
          <span style={{
            background: isAuthorized ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${color}55`,
            color: color,
            fontSize: 8,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            letterSpacing: '0.08em',
          }}>
            {statusTag}
          </span>
        </div>

        {track.has_face && (
          <div style={{
            position: 'absolute',
            top: -22,
            right: 0,
          }}>
            <span style={{
              background: 'rgba(56,189,248,0.2)',
              border: '1px solid rgba(56,189,248,0.5)',
              color: '#38bdf8',
              fontSize: 8,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              letterSpacing: '0.06em',
            }}>
              FACE ✓
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: 180, flexShrink: 0 }}>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        LIVE PERSON IMAGE
      </div>

      {/* Image frame */}
      <div style={{
        border: `2px solid ${borderColor}`, position: 'relative',
        overflow: 'hidden', background: '#000', height: 220,
      }}>
        {/* Corners */}
        {['top-left','top-right','bottom-left','bottom-right'].map(pos => {
          const [v, h] = pos.split('-');
          return (
            <div key={pos} style={{
              position: 'absolute', width: 10, height: 10, zIndex: 3,
              [v]: 0, [h]: 0,
              [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]: `3px solid ${borderColor}`,
              [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]: `3px solid ${borderColor}`,
            }} />
          );
        })}

        {/* LIVE / OFFLINE badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 3,
          background: isCurrentlyActive ? 'var(--red)' : '#4b5563', color: '#fff', fontFamily: 'var(--font-mono)',
          fontSize: 8, fontWeight: 700, padding: '2px 5px', letterSpacing: '0.12em',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {isCurrentlyActive && (
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', flexShrink: 0, animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
          )}
          {isCurrentlyActive ? 'LIVE' : 'OFFLINE'}
        </div>

        {isCurrentlyActive ? (
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
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
              }}
            >
              {activeTrack && renderOverlayBox(activeTrack)}
            </div>
          </div>
        ) : photoSrc ? (
          <img src={photoSrc} alt={record.data.fullname}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--text-ghost)', background: 'rgba(255,255,255,0.02)',
          }}>
            <User size={40} opacity={0.3} />
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>NO IMAGE</span>
          </div>
        )}

        {/* Camera badge */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 3,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 5px',
        }}>
          <Camera size={8} color="var(--text-ghost)" />
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', letterSpacing: '0.06em' }}>
            {cameraLabel}
          </span>
        </div>
      </div>

      {/* Annotation labels below image */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'Live Status', value: isCurrentlyActive ? 'LIVE' : 'OFFLINE', valueColor: isCurrentlyActive ? 'var(--red)' : 'var(--text-ghost)' },
          { label: 'Camera', value: cameraLabel, valueColor: 'var(--text-secondary)' },
        ].map(({ label, value, valueColor }) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 64, flexShrink: 0, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.5 }}>
              {label}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: valueColor, fontWeight: 700 }}>
              {value}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ width: 64, flexShrink: 0, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.5 }}>
            Live Person Image
          </span>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Real-time image of the {authorized ? 'authorized' : 'unauthorized'} person captured by the camera.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Inline Detail View ── */
function InlineDetailView({ record }: { record: PersonRecord }) {
  const emp = record.type === 'employee' ? record.data as Employee : null;
  const vis = record.type === 'visitor' ? record.data as Visitor : null;
  const authorized = emp ? emp.is_active : isVisitorAuthorized(vis!);
  const borderColor = authorized ? 'var(--green)' : vis?.status === 'PENDING' ? 'var(--amber)' : 'var(--red)';

  const statusLabel = emp
    ? emp.is_active ? 'AUTHORIZED PERSON' : 'INACTIVE'
    : vis?.status === 'WHITELISTED' ? 'AUTHORIZED VISITOR'
    : vis?.status === 'PENDING' ? 'PENDING REVIEW'
    : vis?.status === 'WATCHLIST' ? 'WATCHLIST ALERT'
    : 'UNAUTHORIZED PERSON';

  const statusColor = authorized ? 'var(--green)' : vis?.status === 'PENDING' ? 'var(--amber)' : 'var(--red)';

  const { token, tracks, cameras } = useStore();
  const [history, setHistory] = useState<any[]>([]);

  // Fetch track history from backend DB when person selected changes
  useEffect(() => {
    if (token && token !== 'demo-token') {
      api.getPersonTracks(token, record.type, record.data.id)
        .then(setHistory)
        .catch(() => setHistory([]));
    } else {
      setHistory([]);
    }
  }, [record, token]);

  // Find active live track in the real-time store
  const activeTrack = useMemo(() => {
    return Object.values(tracks).find(
      (t) => t.matched_person_id === record.data.id && t.person_type === record.type
    );
  }, [tracks, record]);

  const isCurrentlyActive = !!activeTrack;

  // Resolve camera details
  const targetCameraId = activeTrack ? activeTrack.camera_id : (history.length > 0 ? history[0].camera_id : null);
  const matchedCamera = cameras.find(c => c.id === targetCameraId);
  const cameraLabel = matchedCamera ? matchedCamera.name : (targetCameraId ? `CAM_${String(targetCameraId).padStart(2, '0')}` : 'N/A');
  const cameraLocation = matchedCamera ? matchedCamera.location : (targetCameraId ? `Zone ${targetCameraId}` : 'N/A');

  // Resolve location label
  const locationStr = isCurrentlyActive
    ? `${cameraLocation} (Live)`
    : (history.length > 0 ? `${cameraLocation} (Last Seen)` : 'Not in view');

  // Parse movement status
  const movement = isCurrentlyActive ? {
    direction: activeTrack.entry_exit || 'Tracking',
    speed: activeTrack.detection_conf ? `${Math.round(activeTrack.detection_conf * 100)}% Conf` : 'Active',
    pose: 'Standing / Walking',
    activity: 'In View',
  } : {
    direction: 'Static',
    speed: '0 Px/S',
    pose: 'N/A',
    activity: 'Offline',
  };

  // Calculate stats from track segments
  const visitCount = history.length;
  const frequency = visitCount > 5 ? 'Frequent' : visitCount > 1 ? 'Occasional' : visitCount === 1 ? 'New' : 'Never Seen';

  const dwellTimeStr = useMemo(() => {
    if (isCurrentlyActive) return 'In Progress';
    if (history.length === 0) return '0s';
    let totalSeconds = 0;
    history.forEach(segment => {
      const start = new Date(segment.first_seen).getTime();
      const end = new Date(segment.last_seen).getTime();
      totalSeconds += Math.max(0, Math.round((end - start) / 1000));
    });
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
  }, [history, isCurrentlyActive]);

  const entryTimeStr = useMemo(() => {
    if (history.length === 0) return 'Never';
    const oldest = history[history.length - 1]; // sorted desc, so oldest is at the end
    return new Date(oldest.first_seen).toLocaleString();
  }, [history]);

  const lastSeenStr = useMemo(() => {
    if (isCurrentlyActive) return 'Just now (Live)';
    if (history.length === 0) return 'Never';
    const newest = history[0]; // sorted desc, so newest is at the index 0
    return new Date(newest.last_seen).toLocaleString();
  }, [history, isCurrentlyActive]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Identity header strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px',
        background: authorized ? 'rgba(74,222,128,0.04)' : 'rgba(255,34,68,0.04)',
        borderBottom: `1px solid ${borderColor}33`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {authorized
            ? <ShieldCheck size={16} color="var(--green)" />
            : <ShieldAlert size={16} color="var(--red)" />
          }
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: statusColor,
          }}>
            {emp ? 'Authorized Person' : authorized ? 'Authorized Visitor' : 'Unauthorized Person'}
          </span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>
            {emp ? emp.employee_code : `VIS-${String(vis!.id).padStart(4, '0')}`}
          </span>
        </div>
        {statusBadge(authorized, statusLabel)}
      </div>

      {/* ── Three-column body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* COL 1 — Live image + movement */}
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <LiveImagePanel
            record={record}
            authorized={authorized}
            borderColor={borderColor}
            cameraLabel={cameraLabel}
            isCurrentlyActive={isCurrentlyActive}
            activeTrack={activeTrack}
            matchedCamera={matchedCamera}
          />

          {/* Movement Analysis */}
          <div>
            <SectionTitle icon={Activity} label="Movement Analysis" />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              <MovChip label="Direction" value={movement.direction} color={isCurrentlyActive ? 'var(--orange-bright)' : 'var(--text-ghost)'} />
              <MovChip label="Speed" value={movement.speed} color={isCurrentlyActive ? 'var(--teal)' : 'var(--text-ghost)'} />
              <MovChip label="Pose" value={movement.pose} />
              <MovChip label="Activity" value={movement.activity} color={isCurrentlyActive ? 'var(--lime)' : 'var(--text-ghost)'} />
            </div>
          </div>

          {/* Unauthorized warning */}
          {!authorized && (
            <div style={{
              background: 'rgba(255,34,68,0.07)', border: '1px solid var(--red-border)',
              padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <ShieldAlert size={13} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--red)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 3 }}>
                  UNAUTHORIZED
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  This person is not authorized to access this area. Please take appropriate action.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COL 2 — Person Details + Presence */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: 16, overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Person Details */}
          <div>
            <SectionTitle icon={User} label="Person Details" />
            <div style={{ marginTop: 8 }}>
              {emp ? (
                <>
                  <InfoRow label="Employee ID" value={emp.employee_code} />
                  <InfoRow label="Name" value={emp.fullname} />
                  <InfoRow label="Gender" value="—" />
                  <InfoRow label="Camera ID" value={cameraLabel} />
                  <InfoRow label="Nationality" value="—" />
                  <InfoRow label="Department" value={emp.department} />
                  <InfoRow label="Role" value="Staff" />
                  <InfoRow label="Access Level" value={emp.is_active ? 'Level 2' : 'Suspended'} valueColor={emp.is_active ? 'var(--teal)' : 'var(--red)'} />
                  <InfoRow label="Location" value={locationStr} />
                  <InfoRow label="Notes" value={`${emp.department} employee. Break interval every ${emp.break_interval_minutes} min.`} />
                </>
              ) : (
                <>
                  <InfoRow label="Employee ID" value="N/A" />
                  <InfoRow label="Name" value={vis!.status === 'BLACKLISTED' || vis!.status === 'WATCHLIST' ? 'Unknown Person' : vis!.fullname} />
                  <InfoRow label="Gender" value="Unknown" />
                  <InfoRow label="Age Range" value="Approx. 30–40" />
                  <InfoRow label="Nationality" value={vis!.nationality || 'Unknown'} />
                  <InfoRow label="Department" value={vis!.department || 'Unknown'} />
                  <InfoRow label="Role" value={vis!.role || 'Visitor'} />
                  <InfoRow label="Access Level"
                    value={
                      vis!.status === 'WHITELISTED' ? 'Level 1 — Visitor'
                      : vis!.status === 'PENDING' ? 'Pending Review'
                      : 'No Access'
                    }
                    valueColor={authorized ? 'var(--teal)' : 'var(--red)'}
                  />
                  <InfoRow label="Location" value={locationStr} />
                  <InfoRow label="Notes"
                    value={
                      authorized
                        ? `Registered visitor. Purpose: ${vis!.purpose || 'Not specified'}`
                        : 'Unrecognized individual. No valid access authorization.'
                    }
                  />
                </>
              )}
            </div>
          </div>

          {/* Presence & Frequency */}
          <div>
            <SectionTitle icon={Clock} label="Presence & Frequency" />
            <div style={{ marginTop: 8 }}>
              <InfoRow label="Dwell Time" value={dwellTimeStr} />
              <InfoRow label="Visits" value={String(visitCount)} />
              <InfoRow label="Frequency" value={frequency} />
              <InfoRow label="Entry Time" value={entryTimeStr} />
              <InfoRow label="Last Seen" value={lastSeenStr} />
            </div>
          </div>

        </div>

        {/* COL 3 — Live stat tiles + alerts + presence summary */}
        <div style={{ width: 210, flexShrink: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Movement stat tiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Direction', value: movement.direction, color: isCurrentlyActive ? 'var(--orange-bright)' : 'var(--text-ghost)' },
              { label: 'Speed',     value: movement.speed,     color: isCurrentlyActive ? 'var(--teal)' : 'var(--text-ghost)' },
              { label: 'Pose',      value: movement.pose,      color: isCurrentlyActive ? 'var(--text-primary)' : 'var(--text-ghost)' },
              { label: 'Activity',  value: movement.activity,  color: isCurrentlyActive ? 'var(--lime)' : 'var(--text-ghost)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '7px 10px',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 3, letterSpacing: '0.08em' }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800, color, letterSpacing: '0.04em' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div>
            <SectionTitle icon={ShieldAlert} label="Alerts" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.08em' }}>
                  Alert Status
                </div>
                <div style={{
                  padding: '4px 8px',
                  background: authorized ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${authorized ? 'var(--green-border)' : 'var(--red-border)'}`,
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: authorized ? 'var(--green)' : 'var(--red)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {statusLabel}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.08em' }}>
                  Alert Message
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {authorized ? 'No alerts for this person' : 'No valid access authorization detected.'}
                </div>
              </div>
            </div>
          </div>

          {/* Presence summary mini */}
          <div>
            <SectionTitle icon={TrendingUp} label="Presence & Frequency" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {[
                { label: 'Dwell Time', value: dwellTimeStr },
                { label: 'Visits', value: String(visitCount) },
                { label: 'Frequency', value: frequency },
                { label: 'Entry Time', value: entryTimeStr.split(',')[0] },
                { label: 'Last Seen', value: lastSeenStr.split(',')[0] },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid var(--border)',
        padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', letterSpacing: '0.08em' }}>
          Confidential — Aknesys AI Solution
        </span>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--orange)', letterSpacing: '0.08em' }}>
          OpenVisionGuard · SecureWatch v3
        </span>
      </div>
    </div>
  );
}

/* ── Result List Item ── */
function ResultItem({ record, selected, onClick }: { record: PersonRecord; selected: boolean; onClick: () => void }) {
  const emp = record.type === 'employee' ? record.data as Employee : null;
  const vis = record.type === 'visitor' ? record.data as Visitor : null;
  const authorized = emp ? emp.is_active : isVisitorAuthorized(vis!);
  const borderColor = authorized ? 'var(--green)' : vis?.status === 'PENDING' ? 'var(--amber)' : 'var(--red)';
  const photo = getPhotoSrc(record.data);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 14px', background: selected ? 'rgba(255,107,0,0.06)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border)',
        borderLeft: selected ? `3px solid var(--orange)` : '3px solid transparent',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background var(--t-fast)',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, flexShrink: 0,
        background: 'var(--bg-elevated)', border: `1px solid ${borderColor}55`,
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-ghost)',
      }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <User size={16} opacity={0.5} />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4,
        }}>
          {emp ? emp.fullname : (vis!.status === 'BLACKLISTED' || vis!.status === 'WATCHLIST' ? 'Unknown Person' : vis!.fullname)}
        </div>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {emp ? `${emp.employee_code} · ${emp.department}` : `VIS-${String(vis!.id).padStart(4, '0')} · ${vis!.nationality || 'Unknown'}`}
        </div>
      </div>

      {/* Auth badge */}
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3,
      }}>
        {authorized
          ? <ShieldCheck size={12} color="var(--green)" />
          : <ShieldAlert size={12} color="var(--red)" />
        }
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>
          {record.type === 'employee' ? 'EMP' : 'VIS'}
        </span>
      </div>

      <ChevronRight size={12} color={selected ? 'var(--orange)' : 'var(--text-ghost)'} />
    </button>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function PersonLookupPage() {
  const { employees, visitors } = useStore();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'employee' | 'visitor'>('all');
  const [selectedRecord, setSelectedRecord] = useState<PersonRecord | null>(null);

  // Build combined list
  const allRecords: PersonRecord[] = useMemo(() => {
    const emps: PersonRecord[] = employees.map(e => ({ type: 'employee', data: e }));
    const vis: PersonRecord[] = visitors.map(v => ({ type: 'visitor', data: v }));
    return [...emps, ...vis];
  }, [employees, visitors]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return allRecords.filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (!q) return true;
      const emp = r.type === 'employee' ? r.data as Employee : null;
      const vis = r.type === 'visitor' ? r.data as Visitor : null;
      if (emp) {
        return emp.fullname.toLowerCase().includes(q) || emp.employee_code.toLowerCase().includes(q) || emp.department.toLowerCase().includes(q);
      }
      if (vis) {
        return vis.fullname.toLowerCase().includes(q)
          || String(vis.id).includes(q)
          || (vis.passport_number?.toLowerCase().includes(q) ?? false)
          || (vis.nationality?.toLowerCase().includes(q) ?? false);
      }
      return false;
    });
  }, [allRecords, query, typeFilter]);

  // Auto-select first when filter changes
  useEffect(() => {
    if (filtered.length > 0 && !filtered.includes(selectedRecord!)) {
      setSelectedRecord(filtered[0]);
    } else if (filtered.length === 0) {
      setSelectedRecord(null);
    }
  }, [filtered]);

  const unauth = allRecords.filter(r => {
    if (r.type === 'employee') return !(r.data as Employee).is_active;
    return !isVisitorAuthorized(r.data as Visitor);
  }).length;

  return (
    <div
      className="page-content"
      style={{ padding: 0, display: 'flex', flexDirection: 'row', minHeight: 0, overflow: 'hidden' }}
    >
      {/* ══════════════════════════════════════════════════ */}
      {/* LEFT PANEL — Search + Results                      */}
      {/* ══════════════════════════════════════════════════ */}
      <div style={{
        width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 14px 10px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)', flexShrink: 0,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--orange)',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Fingerprint size={14} />
            Person Lookup
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-ghost)' }} />
            <input
              id="person-search-input"
              autoFocus
              className="form-input"
              placeholder="Search name, ID, passport…"
              style={{ paddingLeft: 28, fontSize: 11 }}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-ghost)', display: 'flex', padding: 0,
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'employee', 'visitor'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 9, fontFamily: 'var(--font-mono)',
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: typeFilter === t ? 'var(--orange)' : 'var(--bg-elevated)',
                  color: typeFilter === t ? '#000' : 'var(--text-ghost)',
                  border: `1px solid ${typeFilter === t ? 'var(--orange)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all var(--t-fast)',
                }}
              >
                {t === 'all' ? 'All' : t === 'employee' ? 'Staff' : 'Visitors'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)', flexShrink: 0,
        }}>
          {[
            { label: 'Total', value: allRecords.length, color: 'var(--text-primary)' },
            { label: 'Staff', value: employees.length, color: 'var(--teal)' },
            { label: 'Visitors', value: visitors.length, color: 'var(--orange)' },
            { label: 'Unauth', value: unauth, color: 'var(--red)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center', padding: '8px 4px',
              borderRight: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 900, color, letterSpacing: '-0.01em' }}>
                {value}
              </div>
              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Results count */}
        <div style={{
          padding: '6px 14px', borderBottom: '1px solid var(--border)',
          fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)',
          letterSpacing: '0.08em', background: 'var(--bg-panel)', flexShrink: 0,
        }}>
          {filtered.length} RESULT{filtered.length !== 1 ? 'S' : ''} FOUND
        </div>

        {/* Scrollable result list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: 32, color: 'var(--text-ghost)',
            }}>
              <Users size={28} opacity={0.3} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                No persons found
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-ghost)', textAlign: 'center' }}>
                Try adjusting your search or filters
              </span>
            </div>
          ) : (
            filtered.map((r, i) => (
              <ResultItem
                key={`${r.type}-${r.data.id}`}
                record={r}
                selected={selectedRecord?.type === r.type && selectedRecord?.data.id === r.data.id}
                onClick={() => setSelectedRecord(r)}
              />
            ))
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Detail View                          */}
      {/* ══════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedRecord ? (
          <InlineDetailView record={selectedRecord} />
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            color: 'var(--text-ghost)',
          }}>
            {/* Blueprint grid decoration */}
            <div style={{
              position: 'relative', width: 120, height: 120,
              border: '1px solid rgba(78,205,196,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, borderTop: '2px solid var(--orange-border)', borderLeft: '2px solid var(--orange-border)' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderTop: '2px solid var(--orange-border)', borderRight: '2px solid var(--orange-border)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, borderBottom: '2px solid var(--orange-border)', borderLeft: '2px solid var(--orange-border)' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderBottom: '2px solid var(--orange-border)', borderRight: '2px solid var(--orange-border)' }} />
              <Fingerprint size={44} opacity={0.15} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Select a Person
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--text-ghost)', lineHeight: 1.5, maxWidth: 280 }}>
                Search by name, ID, or passport number and select a result from the list to view full details.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
