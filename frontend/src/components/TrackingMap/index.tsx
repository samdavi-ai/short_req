import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  User, Search, TrendingUp, MapPin, Layers, 
  ZoomIn, ZoomOut, RotateCcw, WifiOff, Camera, 
  Activity, Heart, Clock, Play
} from 'lucide-react';
import { useStore, type LiveTrack, type IdentityType } from '../../stores/appStore';
import { api } from '../../hooks/api';

// Blueprint datasets traced from real CAD floor plans
import {
  GF_WALLS_ACCURATE, GF_ARCH_ACCURATE,
  AA_WALLS_ACCURATE, AA_ARCH_ACCURATE,
  FF_WALLS_ACCURATE, FF_ARCH_ACCURATE,
  type WallSegment,
  type ArchElement,
} from '../../features/layout-engine/templates/accurateBlueprintData';

import {
  getFloorBounds,
  isPointInPolygon,
} from '../../features/layout-engine/geometry';

const FLOOR_BLUEPRINT_CROP: Record<number, { x: number; y: number; w: number; h: number }> = {
  0: { x: 0.01, y: 0.08, w: 0.98, h: 0.80 },
  1: { x: 0.01, y: 0.06, w: 0.98, h: 0.84 },
  2: { x: 0.01, y: 0.12, w: 0.98, h: 0.78 },
};

const ZONE_COLORS: Record<string, string> = {
  RESTRICTED: '#ff0055',
  DWELL:      '#f59e0b',
  TRIPWIRE:   '#00f0ff',
  LOUNGE:     '#22c55e',
};

const IDENTITY_COLORS: Record<string, { fill: string; stroke: string; glow: string; text: string }> = {
  KNOWN_EMPLOYEE:  { fill: '#22c55e', stroke: '#16a34a', glow: 'rgba(34, 197, 94, 0.25)', text: 'Staff' },
  KNOWN_VISITOR:   { fill: '#3b82f6', stroke: '#2563eb', glow: 'rgba(59, 130, 246, 0.25)', text: 'Visitor' },
  WATCHLIST_MATCH: { fill: '#f59e0b', stroke: '#d97706', glow: 'rgba(245, 158, 11, 0.35)', text: 'Watchlist' },
  BLACKLISTED:     { fill: '#ef4444', stroke: '#dc2626', glow: 'rgba(239, 68, 68, 0.45)', text: 'Blacklisted' },
  UNKNOWN:         { fill: 'rgba(148, 163, 184, 0.7)', stroke: 'rgba(100, 116, 139, 0.8)', glow: 'rgba(148, 163, 184, 0.15)', text: 'Unknown' },
};

// ─── Futuristic Glowing Wall Drawing ──────────────────────────────────────────────────
function drawWallFuturistic(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment
): void {
  const { startX, startY, endX, endY, thickness } = wall;
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;
  const halfT = thickness / 2;

  ctx.beginPath();
  ctx.moveTo(startX + nx * halfT, startY + ny * halfT);
  ctx.lineTo(endX + nx * halfT, endY + ny * halfT);
  ctx.lineTo(endX - nx * halfT, endY - ny * halfT);
  ctx.lineTo(startX - nx * halfT, startY - ny * halfT);
  ctx.closePath();

  // Futuristic styling: glowing cyan outline, semi-transparent cyan fill
  ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glow effect on walls
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = thickness + 2;
  ctx.stroke();
}

// ─── Futuristic Glowing Architectural Element Drawing ────────────────────────────────
function drawArchElementFuturistic(
  ctx: CanvasRenderingContext2D,
  el: ArchElement
): void {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate((el.rotation * Math.PI) / 180);

  const w = el.width;
  const accent = '#00f0ff';
  const fillA = 'rgba(0, 240, 255, 0.12)';

  switch (el.type) {
    case 'DOOR': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2, -4);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, -4);
      ctx.stroke();

      const dir = el.openDirection === 'RIGHT' ? 1 : -1;
      ctx.beginPath();
      ctx.arc(dir === 1 ? -w / 2 : w / 2, 0, w, dir === 1 ? -Math.PI / 2 : -Math.PI, dir === 1 ? 0 : -Math.PI / 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(dir === 1 ? -w / 2 : w / 2, 0);
      ctx.lineTo(dir === 1 ? -w / 2 + w : w / 2 - w, 0);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case 'DOUBLE_DOOR': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -4);
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, -4);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, w / 2, -Math.PI, -Math.PI / 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, w / 2, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(0, 0);
      ctx.moveTo(0, 0); ctx.lineTo(w / 2, 0);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case 'WINDOW': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -3); ctx.lineTo(w / 2, -3);
      ctx.moveTo(-w / 2, 3); ctx.lineTo(w / 2, 3);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 1;
      const count = Math.max(2, Math.floor(w / 15));
      for (let i = 0; i <= count; i++) {
        const lx = -w / 2 + (w / count) * i;
        ctx.beginPath();
        ctx.moveTo(lx, -3); ctx.lineTo(lx, 3);
        ctx.stroke();
      }

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2, -5, w, 10);
      break;
    }
    case 'COLUMN': {
      const s = w / 2;
      ctx.fillStyle = fillA;
      ctx.fillRect(-s, -s, w, w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, w, w);

      ctx.beginPath();
      ctx.moveTo(-s, -s); ctx.lineTo(s, s);
      ctx.moveTo(s, -s); ctx.lineTo(-s, s);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'STAIRS': {
      const steps = 5;
      const stepW = w / steps;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= steps; i++) {
        const sx = -w / 2 + stepW * i;
        ctx.beginPath();
        ctx.moveTo(sx, -10); ctx.lineTo(sx, 10);
        ctx.stroke();
      }
      ctx.strokeRect(-w / 2, -10, w, 20);

      ctx.beginPath();
      ctx.moveTo(-w / 4, 0); ctx.lineTo(w / 4, 0);
      ctx.moveTo(w / 4 - 5, -4); ctx.lineTo(w / 4, 0); ctx.lineTo(w / 4 - 5, 4);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'ELEVATOR': {
      const s = w / 2;
      ctx.fillStyle = fillA;
      ctx.fillRect(-s, -s, w, w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, w, w);

      ctx.beginPath();
      ctx.moveTo(0, s * 0.4); ctx.lineTo(0, -s * 0.4);
      ctx.moveTo(-4, -s * 0.15); ctx.lineTo(0, -s * 0.4); ctx.lineTo(4, -s * 0.15);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, s * 0.4);
      ctx.moveTo(-4, s * 0.15); ctx.lineTo(0, s * 0.4); ctx.lineTo(4, s * 0.15);
      ctx.stroke();
      break;
    }
    case 'ACCESS_DOOR': {
      const size = 16;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-size / 2, -size / 2, size, size, 3);
      } else {
        ctx.rect(-size / 2, -size / 2, size, size);
      }
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-size / 4, -size / 4, size / 2, size / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size / 6, -size / 8, size / 3, size / 12);
      break;
    }
  }

  if (el.label) {
    ctx.font = 'bold 8px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.rotate(-(el.rotation * Math.PI) / 180);
    ctx.fillText(el.label, 0, w / 2 + 5);
  }

  ctx.restore();
}

// ─── Radial Radar Scanner Component for Offline/Glitch State ─────────────────────────────
function RadarScanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 12;

    const blips = [
      { x: cx + 45, y: cy - 25, opacity: 0, life: 90 },
      { x: cx - 40, y: cy + 30, opacity: 0, life: 60 },
    ];

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 7, 12, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Radar boundary circle
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner grid rings
      for (let r = radius / 3; r < radius; r += radius / 3) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();

      // Scanning line rotation
      angle += 0.018;
      const endX = cx + Math.cos(angle) * radius;
      const endY = cy + Math.sin(angle) * radius;

      // Scanning gradient sweep
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle - 0.3, angle);
      ctx.lineTo(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Render scanning target blips
      blips.forEach(b => {
        b.life--;
        if (b.life <= 0) {
          const rAngle = Math.random() * Math.PI * 2;
          const rDist = Math.random() * radius;
          b.x = cx + Math.cos(rAngle) * rDist;
          b.y = cy + Math.sin(rAngle) * rDist;
          b.life = Math.random() * 80 + 40;
        }

        const angleToBlip = Math.atan2(b.y - cy, b.x - cx);
        const diff = Math.abs((angleToBlip - angle) % (Math.PI * 2));
        if (diff < 0.2) {
          b.opacity = 1.0;
        } else {
          b.opacity = Math.max(0, b.opacity - 0.015);
        }

        if (b.opacity > 0) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 240, 255, ${b.opacity * 0.75})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 240, 255, ${b.opacity * 0.25})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Target search indicator
      ctx.fillStyle = '#00f0ff';
      ctx.font = '700 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RADAR SCAN ACTIVE: TARGET DISCONNECTED', cx, cy - radius + 15);

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} width={360} height={200} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Live aspect-fit CCTV Camera Stream overlay Locator ───────────────────────────────
interface CCTVFeedLocatorProps {
  cameraId: number | null;
  track: LiveTrack | null;
}

function CCTVFeedLocator({ cameraId, track }: CCTVFeedLocatorProps) {
  const { cameras } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const [, forceRender] = React.useReducer((n) => n + 1, 0);

  useEffect(() => {
    const id = setInterval(forceRender, 120);
    return () => clearInterval(id);
  }, []);

  const camera = useMemo(() => {
    if (!cameraId) return null;
    return cameras.find(c => c.id === cameraId);
  }, [cameraId, cameras]);

  const videoSrc = useMemo(() => {
    if (!camera) return null;
    if (camera.rtsp_url && camera.rtsp_url.endsWith('.mp4')) {
      const parts = camera.rtsp_url.split('/');
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
    return mapping[camera.id] || null;
  }, [camera]);

  const isOffline = !camera || camera.status === 'OFFLINE';

  useEffect(() => {
    if (videoRef.current) {
      if (videoSrc && !isOffline) {
        videoRef.current.src = videoSrc;
        videoRef.current.loop = true;
        videoRef.current.play().catch(e => console.error('Video playing failure', e));
      } else {
        videoRef.current.src = '';
      }
    }
  }, [videoSrc, isOffline]);

  const renderBBox = () => {
    if (!track || !videoSize || !videoRef.current) return null;
    const vid = videoRef.current;
    const frameW = videoSize.w;
    const frameH = videoSize.h;
    const elemW = vid.clientWidth || 1;
    const elemH = vid.clientHeight || 1;
    if (!frameW || !frameH) return null;

    const vidAspect = frameW / frameH;
    const elemAspect = elemW / elemH;
    let renderW: number, renderH: number, offX: number, offY: number;

    if (vidAspect > elemAspect) {
      renderW = elemW;
      renderH = elemW / vidAspect;
      offX = 0;
      offY = (elemH - renderH) / 2;
    } else {
      renderH = elemH;
      renderW = elemH * vidAspect;
      offX = (elemW - renderW) / 2;
      offY = 0;
    }

    const [x1, y1, x2, y2] = track.bbox;
    const left = offX + (x1 / frameW) * renderW;
    const top = offY + (y1 / frameH) * renderH;
    const width = ((x2 - x1) / frameW) * renderW;
    const height = ((y2 - y1) / frameH) * renderH;

    if (width < 4 || height < 4) return null;

    const isDangerous = track.identity_type === 'BLACKLISTED' || track.identity_type === 'WATCHLIST_MATCH';
    const color = isDangerous ? '#ef4444' : '#00f0ff';

    return (
      <div style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: `2px solid ${color}`,
        borderRadius: 2,
        boxShadow: `0 0 10px ${color}66`,
        pointerEvents: 'none',
        zIndex: 5,
      }}>
        {/* Corners */}
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => {
          const [v, h] = pos.split('-');
          return (
            <div key={pos} style={{
              position: 'absolute', width: 6, height: 6,
              [v]: -2, [h]: -2,
              [`border${v.charAt(0).toUpperCase() + v.slice(1)}`]: `3px solid ${color}`,
              [`border${h.charAt(0).toUpperCase() + h.slice(1)}`]: `3px solid ${color}`,
            }} />
          );
        })}

        {/* HUD box label */}
        <span style={{
          position: 'absolute',
          top: -16,
          left: 0,
          background: color,
          color: '#000',
          fontSize: 8,
          fontWeight: 800,
          padding: '1px 5px',
          borderRadius: 1,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}>
          {track.matched_name ? `ID: ${track.matched_name.toUpperCase()}` : `TRACK: #${track.track_id}`}
        </span>
      </div>
    );
  };

  if (isOffline) {
    return (
      <div style={{
        height: 200, background: '#05070c', borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(255, 34, 68, 0.15)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <RadarScanner />
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(239, 68, 68, 0.85)', color: '#fff',
          fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 6px',
          fontWeight: 'bold', letterSpacing: '0.06em', borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ef4444'
        }}>
          <WifiOff size={10} /> TARGET OFFLINE
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: 200, background: '#000', borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(0, 240, 255, 0.15)', position: 'relative', overflow: 'hidden'
    }}>
      {/* CCTV HUD overlays */}
      <div style={{
        position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'monospace', fontSize: 8, color: '#00f0ff',
        textShadow: '0 0 3px rgba(0, 240, 255, 0.6)', pointerEvents: 'none'
      }}>
        <span>CCTV: {camera?.name?.toUpperCase()}</span>
        <span>REC ◉ VERIFIED FEED</span>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        onLoadedMetadata={e => {
          const v = e.currentTarget;
          setVideoSize({ w: v.videoWidth, h: v.videoHeight });
        }}
      />

      {renderBBox()}

      {/* Futuristic Scanline Layer */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 240, 255, 0.12) 50%)',
        backgroundSize: '100% 4px',
        pointerEvents: 'none', opacity: 0.6, zIndex: 4
      }} />

      {/* Sweeping targeting bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
        background: '#00f0ff', boxShadow: '0 0 8px #00f0ff',
        animation: 'scan-down 2.5s linear infinite', pointerEvents: 'none', zIndex: 4
      }} />
    </div>
  );
}

// ─── Main TrackingMap Component ───────────────────────────────────────────────────────
export default function TrackingMap() {
  const { 
    cameras, zones, tracks, sites, buildings, 
    activeSiteId, activeBuildingId, setActiveSite, setActiveBuilding,
    setSites, setBuildings, token 
  } = useStore();

  const [activeFloor, setActiveFloor] = useState(1);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveTracksHistory, setLiveTracksHistory] = useState<Record<string, { x: number; y: number; floor: number; timestamp: number }[]>>({});
  const [liveHeatmap, setLiveHeatmap] = useState<Record<number, Record<string, number>>>({});

  // Canvas Viewport State
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Overlay Toggles
  const [showLiveHeatmap, setShowLiveHeatmap] = useState(false);
  const [showZoneOccupancy, setShowZoneOccupancy] = useState(true);
  const [showCamerasLayer, setShowCamerasLayer] = useState(true);
  const [showZonesLayer, setShowZonesLayer] = useState(true);
  const [showWallsLayer, setShowWallsLayer] = useState(true);

  // Journey details state from backend
  const [journeyTimeline, setJourneyTimeline] = useState<any | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  // Ref hooks
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Get building structure mapping
  const currentSites = sites;
  const currentSiteId = typeof activeSiteId === 'number' ? activeSiteId : null;
  const currentBuildings = buildings;
  const currentBuildingId = typeof activeBuildingId === 'number' ? activeBuildingId : null;
  const activeBuilding = currentBuildings.find(b => b.id === currentBuildingId);
  const activeFloors = activeBuilding?.floors ?? [];
  const activeFloorLabel = activeFloors.find(f => f.level === activeFloor)?.label ?? `Floor ${activeFloor}`;

  // Fetch Sites & Buildings on load
  useEffect(() => {
    api.getSites(token || '').then(setSites).catch(() => {});
  }, [token, setSites]);

  useEffect(() => {
    if (currentSiteId) {
      api.getBuildings(token || '', currentSiteId).then(setBuildings).catch(() => {});
    }
  }, [token, currentSiteId, setBuildings]);

  useEffect(() => {
    if (currentSites.length > 0 && typeof activeSiteId !== 'number') {
      setActiveSite(currentSites[0].id);
    }
  }, [currentSites, activeSiteId, setActiveSite]);

  useEffect(() => {
    if (currentBuildings.length > 0 && typeof activeBuildingId !== 'number') {
      setActiveBuilding(currentBuildings[0].id);
    }
  }, [currentBuildings, activeBuildingId, setActiveBuilding]);


  // Track coordinates resizing
  useEffect(() => {
    const handleResize = () => {
      const container = canvasAreaRef.current;
      if (!container || !canvasRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      setCanvasSize({ width: w, height: h });
      canvasRef.current.width = w;
      canvasRef.current.height = h;
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 150);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Accumulate live tracks coordinates history
  useEffect(() => {
    const now = Date.now() / 1000;
    const freshTracks = Object.values(tracks).filter((t) => (now - t.timestamp) < 5.0);
    if (freshTracks.length === 0) return;

    setLiveTracksHistory((prev) => {
      const updated = { ...prev };
      freshTracks.forEach((track) => {
        const cam = cameras.find((c) => c.id === track.camera_id);
        const floor = cam ? cam.floor : activeFloor;
        const history = updated[track.global_id] || [];
        const last = history[history.length - 1];
        if (!last || last.x !== track.x || last.y !== track.y || last.floor !== floor) {
          const newHistory = [...history, { x: track.x, y: track.y, floor, timestamp: Date.now() }];
          if (newHistory.length > 30) newHistory.shift();
          updated[track.global_id] = newHistory;
        }
      });
      return updated;
    });

    // Grid tracking heatmap overlay accumulation
    if (showLiveHeatmap) {
      setLiveHeatmap((prev) => {
        const updated = { ...prev };
        const floorHeat = { ...(updated[activeFloor] || {}) };
        freshTracks.forEach((track) => {
          const cam = cameras.find((c) => c.id === track.camera_id);
          const floor = cam ? cam.floor : activeFloor;
          if (floor === activeFloor) {
            const gx = Math.floor(track.x / 20);
            const gy = Math.floor(track.y / 20);
            const key = `${gx},${gy}`;
            floorHeat[key] = (floorHeat[key] || 0) + 1;
          }
        });
        updated[activeFloor] = floorHeat;
        return updated;
      });
    }
  }, [tracks, showLiveHeatmap, activeFloor, cameras]);

  // Fetch selected individual's trajectory history
  useEffect(() => {
    if (!selectedTrackId) {
      setJourneyTimeline(null);
      return;
    }

    setJourneyLoading(true);
    const BASE = `http://${window.location.hostname}:8000`;
    fetch(`${BASE}/tracks/global/${selectedTrackId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setJourneyTimeline(data);
        setJourneyLoading(false);
      })
      .catch(() => {
        setJourneyTimeline(null);
        setJourneyLoading(false);
      });
  }, [selectedTrackId, token]);

  // Canvas mouse event listeners
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      x: (x - panX) / zoom,
      y: (y - panY) / zoom,
    };
  }, [panX, panY, zoom]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - panX, y: e.clientY - panY };

      // Check for dot click
      const { x, y } = getCanvasPos(e.clientX, e.clientY);
      const clickedTrack = Object.values(tracks).find((t) => {
        const isActive = (Date.now() / 1000 - t.timestamp) < 5.0;
        if (!isActive) return false;
        return Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 16;
      });

      if (clickedTrack) {
        setSelectedTrackId(clickedTrack.global_id);
      } else {
        setSelectedTrackId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      setPanX(e.clientX - panStart.current.x);
      setPanY(e.clientY - panStart.current.y);
    }
  };

  const handleMouseUp = () => { isPanning.current = false; };
  const handleMouseLeave = () => { isPanning.current = false; };

  // Main rendering draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear board
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const bounds = getFloorBounds(canvas.width, canvas.height);

    // 1. Draw dynamic glowing grid background matching viewport scale/pan
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;

    // Convert visible screen bounds to world coordinates
    const startGridX = Math.floor((-panX) / (zoom * gridSpacing)) * gridSpacing - gridSpacing;
    const endGridX = startGridX + (canvas.width / zoom) + gridSpacing * 2;
    const startGridY = Math.floor((-panY) / (zoom * gridSpacing)) * gridSpacing - gridSpacing;
    const endGridY = startGridY + (canvas.height / zoom) + gridSpacing * 2;

    for (let x = startGridX; x <= endGridX; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, startGridY);
      ctx.lineTo(x, endGridY);
      ctx.stroke();
    }
    for (let y = startGridY; y <= endGridY; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(startGridX, y);
      ctx.lineTo(endGridX, y);
      ctx.stroke();
    }

    // 2. Draw blueprint walls & doors overlay with glowing neon cyan vector segments
    const activeWalls = activeFloor === 0 ? GF_WALLS_ACCURATE : activeFloor === 1 ? AA_WALLS_ACCURATE : FF_WALLS_ACCURATE;
    const activeArch = activeFloor === 0 ? GF_ARCH_ACCURATE : activeFloor === 1 ? AA_ARCH_ACCURATE : FF_ARCH_ACCURATE;

    if (showWallsLayer && activeWalls) {
      activeWalls.forEach(w => drawWallFuturistic(ctx, w));
    }
    if (showWallsLayer && activeArch) {
      activeArch.forEach(el => drawArchElementFuturistic(ctx, el));
    }

    // 3. Draw monitoring zones
    if (showZonesLayer) {
      const floorZones = zones.filter(z => z.floor === activeFloor);
      floorZones.forEach((z) => {
        if (!z.coordinates || z.coordinates.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(z.coordinates[0].x, z.coordinates[0].y);
        for (let i = 1; i < z.coordinates.length; i++) {
          ctx.lineTo(z.coordinates[i].x, z.coordinates[i].y);
        }
        ctx.closePath();
        const color = z.color || ZONE_COLORS[z.zone_type] || '#94a3b8';
        ctx.fillStyle = color + '15';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Zone occupancy label badge
        if (showZoneOccupancy) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          z.coordinates.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          });
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.beginPath();
          ctx.roundRect(cx - 32, cy - 9, 64, 18, 4);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`ZONE: ${z.name.split(' ')[0]}`, cx, cy);
        }
      });
    }

    // 4. Draw Dwell Heatmap
    if (showLiveHeatmap) {
      const floorHeatmap = liveHeatmap[activeFloor] || {};
      const heatvals = Object.values(floorHeatmap);
      if (heatvals.length > 0) {
        const maxVal = Math.max(...heatvals);
        for (const [key, val] of Object.entries(floorHeatmap)) {
          const [gx, gy] = key.split(',').map(Number);
          const t = Math.min(1, val / (maxVal * 0.5));
          const alpha = t * 0.45;
          const r = Math.round(t > 0.5 ? 255 : t * 2 * 255);
          const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - (t - 0.5) * 2) * 200);
          const b = Math.round(t < 0.5 ? 255 : 0);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(gx * 20, gy * 20, 20, 20);
        }
      }
    }

    // 5. Draw active cameras
    if (showCamerasLayer) {
      const activeCams = cameras.filter(c => c.floor === activeFloor);
      activeCams.forEach((c) => {
        const isOffline = c.status === 'OFFLINE';
        const isMaint = c.status === 'MAINTENANCE';

        // Draw Field-Of-View cone
        ctx.save();
        ctx.translate(c.x_coord, c.y_coord);
        ctx.rotate((c.angle * Math.PI) / 180);
        const fovRad = ((c.fov || 90) * Math.PI) / 180;
        const range = 80;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, range, -fovRad / 2, fovRad / 2);
        ctx.closePath();
        ctx.fillStyle = isOffline ? 'rgba(239, 68, 68, 0.04)' : isMaint ? 'rgba(245, 158, 11, 0.04)' : 'rgba(0, 240, 255, 0.05)';
        ctx.fill();
        ctx.strokeStyle = isOffline ? 'rgba(239, 68, 68, 0.12)' : isMaint ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Camera dot
        ctx.beginPath();
        ctx.arc(c.x_coord, c.y_coord, 6, 0, Math.PI * 2);
        ctx.fillStyle = isOffline ? '#ef4444' : isMaint ? '#f59e0b' : '#00f0ff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    }

    // 6. Draw selected passenger neon trail history
    if (selectedTrackId) {
      const history = liveTracksHistory[selectedTrackId] || [];
      const floorHistory = history.filter(pt => pt.floor === activeFloor);
      if (floorHistory.length > 1) {
        ctx.beginPath();
        ctx.moveTo(floorHistory[0].x, floorHistory[0].y);
        for (let i = 1; i < floorHistory.length; i++) {
          ctx.lineTo(floorHistory[i].x, floorHistory[i].y);
        }
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Path trail nodes
        floorHistory.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#00f0ff';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
    }

    // 7. Draw live person dots with animated targets
    const now = Date.now() / 1000;
    const activeTracks = Object.values(tracks).filter(t => (now - t.timestamp) < 5.0);
    activeTracks.forEach((track) => {
      const cam = cameras.find(c => c.id === track.camera_id);
      const floor = cam ? cam.floor : activeFloor;
      if (floor !== activeFloor) return;

      const colors = IDENTITY_COLORS[track.identity_type] || IDENTITY_COLORS.UNKNOWN;
      const isKnown = track.identity_type !== 'UNKNOWN';
      const isDangerous = track.identity_type === 'BLACKLISTED' || track.identity_type === 'WATCHLIST_MATCH';
      const dotRadius = isDangerous ? 7 : (isKnown ? 6 : 4);

      // Known entity glow pulse
      if (isKnown) {
        ctx.beginPath();
        ctx.arc(track.x, track.y, dotRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = colors.glow;
        ctx.fill();
      }

      // Dangerous target alert pulsing ring
      if (isDangerous) {
        const pulse = Math.sin(Date.now() / 150) * 0.35 + 0.65;
        ctx.beginPath();
        ctx.arc(track.x, track.y, dotRadius + 9, 0, Math.PI * 2);
        ctx.strokeStyle = colors.fill + Math.round(pulse * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Animated lock targeting bracket on the dot
      if (track.global_id === selectedTrackId) {
        ctx.save();
        ctx.translate(track.x, track.y);
        ctx.rotate((Date.now() / 800) * Math.PI); // rotation speed
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        const size = dotRadius + 9;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-size, -size + 5);
          ctx.lineTo(-size, -size);
          ctx.lineTo(-size + 5, -size);
          ctx.stroke();
          ctx.rotate(Math.PI / 2);
        }
        ctx.restore();
      }

      // Central dot
      ctx.beginPath();
      ctx.arc(track.x, track.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Display name badge
      if (isKnown && track.matched_name) {
        const label = track.matched_name;
        ctx.font = 'bold 9px Outfit, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const labelX = track.x - textWidth / 2 - 4;
        const labelY = track.y - dotRadius - 15;

        ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, textWidth + 8, 13, 3);
        ctx.fill();
        ctx.strokeStyle = colors.fill;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, track.x, labelY + 9);
      }
    });

    ctx.restore();
  }, [
    activeFloor, zoom, panX, panY, cameras, zones, 
    tracks, liveTracksHistory, selectedTrackId, showLiveHeatmap, 
    showZoneOccupancy, showCamerasLayer, showZonesLayer, showWallsLayer,
    liveHeatmap
  ]);

  // Sidebar target selections
  const activeTrackData = useMemo(() => {
    if (!selectedTrackId) return null;
    return tracks[selectedTrackId] || null;
  }, [selectedTrackId, tracks]);

  // Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    // Search active websocket tracks first
    const match = Object.values(tracks).find(t => 
      t.global_id.toLowerCase().includes(query) ||
      (t.matched_name && t.matched_name.toLowerCase().includes(query))
    );

    if (match) {
      setSelectedTrackId(match.global_id);
    } else {
      // Offline fallback: sets ID directly to load journey from DB
      setSelectedTrackId(query);
    }
  };

  return (
    <div style={{ display: 'flex', flexGrow: 1, height: '100%', overflow: 'hidden', background: '#07090e' }}>
      
      {/* ─── STYLE OVERLAYS ─── */}
      <style>{`
        @keyframes scan-down {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes pulse-gait {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
        .hud-metric-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .hud-metric-label {
          font-size: 8px;
          font-family: var(--font-mono);
          color: var(--text-ghost);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .hud-metric-value {
          font-size: 13px;
          font-family: var(--font-display);
          font-weight: 800;
          color: var(--text-primary);
        }
        .timeline-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .timeline-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .timeline-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
      `}</style>

      {/* ══════════════════════════════════════════════════ */}
      {/* LEFT SIDEBAR: FUTURISTIC RADAR & BIOMETRICS HUD    */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="glass-panel" style={{
        width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', overflow: 'hidden', padding: '20px 16px', gap: 16
      }}>
        
        {/* Title */}
        <div>
          <h2 style={{ fontSize: 16, fontFamily: 'Outfit', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cyan)' }}>
            In-Person Tracking
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            Real-time cross-camera person localization mapping.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-ghost)' }} />
            <input
              type="text"
              placeholder="Search target ID or Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px 8px 32px',
                color: 'white',
                fontSize: 12,
                outline: 'none',
                fontFamily: 'Outfit, sans-serif'
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0 14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
            Lock
          </button>
        </form>

        {/* CCTV Feed Overlay / Locator */}
        <CCTVFeedLocator 
          cameraId={activeTrackData ? activeTrackData.camera_id : null}
          track={activeTrackData}
        />

        {/* Biometrics HUD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
            🎯 Target Biometrics HUD
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            
            {/* Target ID */}
            <div className="hud-metric-box">
              <span className="hud-metric-label">Target status</span>
              <span className="hud-metric-value" style={{ color: activeTrackData ? 'var(--green-bright)' : '#ef4444', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeTrackData ? 'var(--green-bright)' : '#ef4444', animation: activeTrackData ? 'scan-pulse 1.2s infinite' : 'none' }} />
                {activeTrackData ? 'LOCKED' : 'RADAR SWEEP'}
              </span>
            </div>

            {/* Verification */}
            <div className="hud-metric-box">
              <span className="hud-metric-label">Verification</span>
              <span className="hud-metric-value" style={{ color: activeTrackData?.identity_type !== 'UNKNOWN' ? 'var(--cyan)' : 'var(--text-ghost)', fontSize: 11 }}>
                {activeTrackData ? (activeTrackData.identity_type === 'UNKNOWN' ? 'UNVERIFIED' : 'SECURE MATCH') : 'SEARCHING...'}
              </span>
            </div>

            {/* Target ID */}
            <div className="hud-metric-box">
              <span className="hud-metric-label">Global ID</span>
              <span className="hud-metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {selectedTrackId ? `#${selectedTrackId.slice(0, 8)}` : '—'}
              </span>
            </div>

            {/* Match Rate */}
            <div className="hud-metric-box">
              <span className="hud-metric-label">Gait confidence</span>
              <span className="hud-metric-value" style={{ color: 'var(--cyan)', fontSize: 11 }}>
                {activeTrackData ? (activeTrackData.identity_type === 'UNKNOWN' ? 'ANALYZING...' : '94.2%') : '—'}
              </span>
            </div>

            {/* Height */}
            <div className="hud-metric-box">
              <span className="hud-metric-label">Est. Height</span>
              <span className="hud-metric-value" style={{ fontSize: 11 }}>
                {activeTrackData ? '1.78 m' : '—'}
              </span>
            </div>

            {/* Speed */}
            <div className="hud-metric-box">
              <span className="hud-metric-label">Walking Speed</span>
              <span className="hud-metric-value" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Activity size={10} color="var(--text-muted)" />
                {activeTrackData ? '1.4 m/s' : '—'}
              </span>
            </div>

          </div>
        </div>

        {/* Timeline Log */}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, gap: 10 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
            🕒 Re-ID Camera Timeline
          </div>

          <div className="timeline-scroll" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {journeyLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, padding: '20px 0' }}>
                Fetching trajectory logs...
              </div>
            ) : journeyTimeline && journeyTimeline.segments ? (
              journeyTimeline.segments.map((seg: any, idx: number) => {
                const cam = cameras.find(c => c.id === seg.camera_id);
                return (
                  <div key={idx} style={{
                    display: 'flex', gap: 12, background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.04)', padding: 10, borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11 }}>📷</span>
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                        {cam?.name || `Camera ${seg.camera_id}`}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                        Seen: {new Date(seg.first_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : selectedTrackId ? (
              <div style={{ textAlign: 'center', color: 'var(--text-ghost)', fontSize: 10, padding: '20px 0', fontStyle: 'italic' }}>
                Trajectory logs currently compiling.
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-ghost)', fontSize: 10, padding: '30px 10px', lineHeight: 1.4 }}>
                Lock onto a passenger dot or search ID to extract their spatio-temporal logs.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* CENTER MAP CANVAS & TOP NAVIGATION BAR OVERLAYS    */}
      {/* ══════════════════════════════════════════════════ */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        
        {/* Floating Top Nav Options */}
        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10,
          display: 'flex', justifyContent: 'space-between', pointerEvents: 'none'
        }}>
          
          {/* Site Selectors */}
          <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
            <select
              value={currentSiteId ?? ''}
              onChange={e => setActiveSite(parseInt(e.target.value))}
              style={{
                background: 'rgba(10, 13, 20, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 11,
                padding: '6px 10px',
                fontWeight: 600,
                outline: 'none',
                backdropFilter: 'blur(8px)'
              }}
            >
              {currentSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select
              value={currentBuildingId ?? ''}
              onChange={e => setActiveBuilding(parseInt(e.target.value))}
              style={{
                background: 'rgba(10, 13, 20, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 11,
                padding: '6px 10px',
                fontWeight: 600,
                outline: 'none',
                backdropFilter: 'blur(8px)'
              }}
            >
              {currentBuildings.filter(b => !currentSiteId || b.site_id === currentSiteId).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Layer Controls */}
          <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
            
            {/* Layer visibility buttons */}
            {[
              { label: 'Cams', active: showCamerasLayer, onClick: () => setShowCamerasLayer(!showCamerasLayer) },
              { label: 'Zones', active: showZonesLayer, onClick: () => setShowZonesLayer(!showZonesLayer) },
              { label: 'Walls', active: showWallsLayer, onClick: () => setShowWallsLayer(!showWallsLayer) },
              { label: 'Heatmap', active: showLiveHeatmap, onClick: () => setShowLiveHeatmap(!showLiveHeatmap) },
              { label: 'Occupancy', active: showZoneOccupancy, onClick: () => setShowZoneOccupancy(!showZoneOccupancy) },
            ].map(layer => (
              <button
                key={layer.label}
                onClick={layer.onClick}
                style={{
                  background: layer.active ? 'rgba(0, 240, 255, 0.15)' : 'rgba(10, 13, 20, 0.85)',
                  border: `1px solid ${layer.active ? '#00f0ff' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: layer.active ? '#00f0ff' : 'var(--text-ghost)',
                  borderRadius: 100,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)'
                }}
              >
                {layer.label}
              </button>
            ))}
          </div>

        </div>

        {/* Floor Selection tab overlay on left side */}
        <div style={{
          position: 'absolute', top: 64, left: 16, zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto'
        }}>
          {[...activeFloors].sort((a, b) => b.sort_order - a.sort_order).map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFloor(f.level)}
              style={{
                background: activeFloor === f.level ? 'rgba(0, 240, 255, 0.15)' : 'rgba(10, 13, 20, 0.85)',
                border: `1px solid ${activeFloor === f.level ? '#00f0ff' : 'rgba(255, 255, 255, 0.1)'}`,
                color: activeFloor === f.level ? '#00f0ff' : '#fff',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 700,
                fontSize: 11,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12
              }}
            >
              <span>{f.label}</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>
                📷 {cameras.filter(c => c.floor === f.level).length}
              </span>
            </button>
          ))}
        </div>

        {/* Interactive Canvas */}
        <div 
          ref={canvasAreaRef}
          style={{ flexGrow: 1, position: 'relative', overflow: 'hidden', cursor: 'grab' }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>

        {/* Floating Bottom Overlay Controls */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 10,
          display: 'flex', gap: 6, pointerEvents: 'auto'
        }}>
          <button
            className="icon-btn"
            title="Zoom In"
            onClick={() => setZoom(z => Math.min(5, z + 0.15))}
            style={{ background: 'rgba(10, 13, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="icon-btn"
            title="Zoom Out"
            onClick={() => setZoom(z => Math.max(0.15, z - 0.15))}
            style={{ background: 'rgba(10, 13, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            className="icon-btn"
            title="Reset Panning/Zoom"
            onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
            style={{ background: 'rgba(10, 13, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Bottom Details Status Strip */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 10,
          background: 'rgba(10, 13, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '6px 14px', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(8px)',
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-ghost)',
          display: 'flex', gap: 12, alignItems: 'center', pointerEvents: 'none'
        }}>
          <span>BUILDING: {activeBuilding?.name.toUpperCase()}</span>
          <span>·</span>
          <span>LEVEL: {activeFloorLabel.toUpperCase()}</span>
          <span>·</span>
          <span>ACTIVE TARGETS: {Object.values(tracks).filter(t => (Date.now() / 1000 - t.timestamp) < 5.0).length}</span>
        </div>

      </div>

    </div>
  );
}
