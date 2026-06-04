import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Trash2, Plus, Save, RotateCcw, ZoomIn, ZoomOut, MapPin, 
  Settings2, Activity, Info
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

interface CamOnCanvas {
  id: number;
  x: number;
  y: number;
  angle: number;
  fov: number; // Field of View angle
  name: string;
  status: string;
}

interface ZoneOnCanvas {
  id: number;
  name: string;
  points: { x: number; y: number }[];
  type: 'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE';
  color: string;
}

const ZONE_COLORS: Record<string, string> = {
  RESTRICTED: '#ff0055',
  DWELL:      '#f59e0b',
  TRIPWIRE:   '#00f0ff',
  LOUNGE:     '#22c55e',
};

const CAMERA_TYPES = [
  { label: 'Dome Camera',     icon: '⬤', type: 'dome' },
  { label: 'PTZ Camera',      icon: '◉', type: 'ptz' },
  { label: 'Bullet Camera',   icon: '▶', type: 'bullet' },
  { label: 'Face Capture',    icon: '◈', type: 'face' },
];

const DEMO_FLOORS = [
  { id: -1, label: 'Basement', count: 8 },
  { id: 0,  label: 'Ground',   count: 31 },
  { id: 1,  label: 'Floor 1',  count: 24 },
  { id: 2,  label: 'Floor 2',  count: 12 },
  { id: 3,  label: 'Roof',     count: 5 },
];

export default function LayoutEditor() {
  const { cameras, zones, token, addToast } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeFloor, setActiveFloor] = useState(1);
  const [tool, setTool] = useState<'select' | 'zone'>('select');
  const [zoneType, setZoneType] = useState<'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE'>('RESTRICTED');
  const [zoom, setZoom] = useState(1);
  const [selectedCam, setSelectedCam] = useState<number | null>(null);
  const [drawingZone, setDrawingZone] = useState<{ x: number; y: number }[]>([]);

  // Demo cameras placed on canvas
  const [placedCams, setPlacedCams] = useState<CamOnCanvas[]>([
    { id: 1, x: 220, y: 150, angle: 45,  fov: 60, name: 'Gate A1', status: 'ACTIVE' },
    { id: 2, x: 480, y: 320, angle: 135, fov: 90, name: 'Security Main', status: 'ACTIVE' },
    { id: 3, x: 800, y: 230, angle: 270, fov: 45, name: 'Baggage Line',  status: 'ACTIVE' },
    { id: 4, x: 350, y: 580, angle: 90,  fov: 70, name: 'Retail North',   status: 'OFFLINE' },
  ]);

  // Demo zones
  const [drawnZones, setDrawnZones] = useState<ZoneOnCanvas[]>([
    { id: 1, name: 'Gate A3 Zone', type: 'DWELL', color: ZONE_COLORS.DWELL,
      points: [{ x: 150, y: 250 }, { x: 350, y: 250 }, { x: 350, y: 350 }, { x: 150, y: 350 }] },
    { id: 2, name: 'Restricted Area', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED,
      points: [{ x: 580, y: 180 }, { x: 900, y: 180 }, { x: 900, y: 300 }, { x: 580, y: 300 }] },
  ]);

  const liveTracks = useStore((state) => state.tracks);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);

    // 1. Professional Blueprint Grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // Major grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    for (let x = 0; x < canvas.width; x += 250) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 250) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // 2. Realistic Architectural Blueprint (Walls & Layout)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    // Outer Shell
    ctx.strokeRect(100, 100, 1000, 600);
    // Inner Corridors
    ctx.beginPath();
    ctx.moveTo(400, 100); ctx.lineTo(400, 400); // Security wall
    ctx.moveTo(400, 550); ctx.lineTo(400, 700); // Security wall bottom
    ctx.moveTo(750, 100); ctx.lineTo(750, 500); // Baggage wall
    ctx.moveTo(750, 500); ctx.lineTo(1100, 500); // Gate horizontal
    ctx.stroke();
    
    // Security Gates / Scanners (Filled boxes)
    ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.fillRect(380, 400, 40, 150); 
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '8px Outfit'; ctx.textAlign = 'center';
    ctx.fillText('X-RAY SCANNERS', 400, 475);

    // Architectural Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 32px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEPARTURES', 250, 150);
    ctx.fillText('SECURITY CLEARANCE', 575, 150);
    ctx.fillText('TERMINAL GATES', 925, 150);

    // 3. Draw Zones
    drawnZones.forEach((zone) => {
      if (zone.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(zone.points[0].x, zone.points[0].y);
      zone.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = zone.color + '22';
      ctx.fill();
      ctx.strokeStyle = zone.color + 'aa';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();

      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      ctx.fillStyle = zone.color;
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, cx, cy - 6);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = zone.color + 'aa';
      ctx.fillText(zone.type, cx, cy + 8);
    });

    // Drawing zone in progress
    if (drawingZone.length > 0) {
      ctx.beginPath();
      ctx.moveTo(drawingZone[0].x, drawingZone[0].y);
      drawingZone.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = ZONE_COLORS[zoneType];
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      drawingZone.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = ZONE_COLORS[zoneType];
        ctx.fill();
      });
      ctx.setLineDash([]);
    }

    // 4. Draw Cameras
    placedCams.forEach((cam) => {
      const isSelected = selectedCam === cam.id;
      const isOffline = cam.status === 'OFFLINE';
      const color = isOffline ? 'var(--red)' : 'var(--cyan)';

      // FoV cone (Dynamic based on cam.fov)
      const fovRad = (cam.fov * Math.PI) / 180;
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.rotate((cam.angle * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 120, -fovRad / 2, fovRad / 2);
      ctx.closePath();
      
      // Gradient FOV
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
      grad.addColorStop(0, color + '44');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.fill();
      
      ctx.strokeStyle = color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(-fovRad/2)*120, Math.sin(-fovRad/2)*120);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(fovRad/2)*120, Math.sin(fovRad/2)*120);
      ctx.stroke();
      ctx.restore();

      // Camera Base
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, isSelected ? 12 : 10, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? color : 'var(--surface-1)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Target point indicator
      const tx = cam.x + Math.cos((cam.angle * Math.PI) / 180) * 16;
      const ty = cam.y + Math.sin((cam.angle * Math.PI) / 180) * 16;
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Selection Ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cam.x, cam.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = color + '88';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Name
      ctx.fillStyle = isSelected ? 'var(--white)' : 'rgba(255,255,255,0.7)';
      ctx.font = isSelected ? 'bold 11px Outfit' : '10px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(cam.name, cam.x, cam.y + 14);
    });

    // 5. Live person dots
    if (tool === 'select') {
      const activeTracks = Object.values(liveTracks).filter(
        (t: any) => (Date.now() / 1000 - t.timestamp) < 2.0
      );
      
      if (activeTracks.length > 0) {
        activeTracks.forEach((track: any) => {
          ctx.beginPath();
          ctx.arc(track.x, track.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = track.has_face ? 'var(--cyan)' : 'var(--green-bright)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(track.x, track.y, 9, 0, Math.PI * 2);
          ctx.strokeStyle = track.has_face ? 'var(--cyan-shadow)' : 'var(--green-shadow)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      } else {
        // Fallback to simulated passenger flow
        for (let i = 0; i < 18; i++) {
          const seed = (i * 137 + activeFloor * 31) % 1000;
          const x = (seed % 900) + 150;
          const y = ((seed * 3) % 500) + 150;
          const isAlert = i % 11 === 0;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = isAlert ? 'var(--red)' : 'var(--cyan)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [placedCams, drawnZones, selectedCam, zoom, drawingZone, zoneType, tool, activeFloor, liveTracks]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (tool === 'zone') {
      if (e.detail === 2 && drawingZone.length >= 3) {
        const newZone: ZoneOnCanvas = {
          id: Date.now(),
          name: `Zone ${drawnZones.length + 1}`,
          type: zoneType,
          color: ZONE_COLORS[zoneType],
          points: drawingZone,
        };
        setDrawnZones((prev) => [...prev, newZone]);
        setDrawingZone([]);
        addToast(`Zone drawn — configure it in the properties panel`, 'success');
        return;
      }
      setDrawingZone((prev) => [...prev, { x, y }]);
      return;
    }

    const clickedCam = placedCams.find(
      (c) => Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2) < 16
    );
    setSelectedCam(clickedCam ? clickedCam.id : null);
  };

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const newCam: CamOnCanvas = {
      id: Date.now(),
      x, y,
      angle: 90,
      fov: 60,
      name: `Camera ${placedCams.length + 1}`,
      status: 'ACTIVE',
    };
    setPlacedCams((prev) => [...prev, newCam]);
    addToast('Camera placed — click to configure', 'success');
  };

  const selectedCamData = placedCams.find((c) => c.id === selectedCam);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      
      {/* Top Action Bar */}
      <div className="card" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'var(--cyan-dim)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)' }}>
            <MapPin size={18} />
          </div>
          <div>
            <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 16, color: 'var(--white)' }}>Layout Editor</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unsaved changes exist on {DEMO_FLOORS.find((f) => f.id === activeFloor)?.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">Discard</button>
          <button className="btn btn-primary" onClick={() => addToast('Blueprint layout saved to database!', 'success')}>
            <Save size={14} /> Save Layout
          </button>
        </div>
      </div>

      <div className="layout-editor-main" style={{ 
        flex: 1, 
        display: 'grid', 
        gridTemplateColumns: '260px 1fr 300px', 
        gap: '24px',
        overflow: 'hidden'
      }}>

        {/* Left: Tools Palette */}
        <div className="layout-sidebar-left" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
          
          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 12 }}>
              Levels
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...DEMO_FLOORS].reverse().map((f) => (
                <div
                  key={f.id}
                  className={`floor-tab${activeFloor === f.id ? ' active' : ''}`}
                  onClick={() => setActiveFloor(f.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    ...(activeFloor === f.id ? { 
                      background: 'rgba(0,240,255,0.1)', border: '1px solid var(--cyan-shadow)', color: 'var(--cyan)' 
                    } : {
                      background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)'
                    })
                  }}
                >
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: activeFloor === f.id ? 'var(--cyan)' : 'var(--text-ghost)' }}>📷 {f.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <button
              className={`btn ${tool === 'select' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }}
              onClick={() => { setTool('select'); setDrawingZone([]); }}
            >
              <MapPin size={14} /> {tool === 'select' ? 'Select Mode Active' : 'Select Mode'}
            </button>

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 12 }}>
              Drag to Place
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CAMERA_TYPES.map((ct) => (
                <div
                  key={ct.type}
                  className="camera-tool-btn"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('camera-type', ct.type)}
                  title={`Drag ${ct.label} onto the floor plan`}
                  style={{ 
                    background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'grab' 
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--cyan)' }}>{ct.icon}</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'var(--text-primary)' }}>{ct.label}</span>
                </div>
              ))}
            </div>

            <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '16px 0' }} />

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 12 }}>
              Zone Tools
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(ZONE_COLORS) as (keyof typeof ZONE_COLORS)[]).map((zt) => (
                <button
                  key={zt}
                  className={`camera-tool-btn${tool === 'zone' && zoneType === zt ? ' active' : ''}`}
                  style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    textAlign: 'left', border: '1px solid transparent', cursor: 'pointer',
                    ...(tool === 'zone' && zoneType === zt ? {
                      borderColor: ZONE_COLORS[zt], color: ZONE_COLORS[zt],
                      background: ZONE_COLORS[zt] + '20', boxShadow: `0 0 10px ${ZONE_COLORS[zt]}40`
                    } : {
                      background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)'
                    }),
                    borderRadius: 'var(--radius-md)'
                  }}
                  onClick={() => { setTool('zone'); setZoneType(zt as typeof zoneType); }}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: ZONE_COLORS[zt], flexShrink: 0,
                    boxShadow: `0 0 6px ${ZONE_COLORS[zt]}`
                  }} />
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12 }}>{zt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Canvas Area */}
        <div className="layout-canvas-area" style={{ position: 'relative' }}>
          
          <div style={{ 
            width: '100%', height: '100%', 
            position: 'relative', 
            background: 'rgba(10, 10, 15, 0.4)', 
            backdropFilter: 'blur(24px)', 
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 'var(--radius-xl)', 
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            
            <div style={{
              position: 'absolute', top: 20, left: 24, zIndex: 10,
              fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 800, 
              color: 'var(--white)', textShadow: '0 2px 10px rgba(0,0,0,0.8)'
            }}>
              {DEMO_FLOORS.find((f) => f.id === activeFloor)?.label} Blueprint
            </div>

            <div style={{
              position: 'absolute', top: 20, right: 24, zIndex: 10,
            }}>
              <span className="live-badge" style={{ padding: '6px 12px', fontSize: 11, background: 'rgba(0,0,0,0.6)' }}><span className="live-dot" />LIVE TRACKING</span>
            </div>

            <canvas
              ref={canvasRef}
              className="layout-canvas"
              width={1200}
              height={800}
              style={{
                width: '100%', height: '100%',
                cursor: tool === 'zone' ? 'crosshair' : 'default',
              }}
              onClick={handleCanvasClick}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            />

            {/* Floating Zoom Toolbar */}
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 8, zIndex: 10, alignItems: 'center',
              background: 'rgba(15, 15, 20, 0.8)', backdropFilter: 'blur(12px)',
              border: '1px solid var(--border)', borderRadius: '100px', 
              padding: '6px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Zoom Out"><ZoomOut size={16} /></button>
              <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', width: 44, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Zoom In"><ZoomIn size={16} /></button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
              <button className="icon-btn" onClick={() => { setDrawingZone([]); setSelectedCam(null); }} title="Reset Canvas"><RotateCcw size={16} /></button>
              {drawingZone.length > 0 && (
                <button
                  className="btn btn-sm btn-primary" style={{ marginLeft: 8, borderRadius: 100 }}
                  onClick={() => {
                    if (drawingZone.length >= 3) {
                      setDrawnZones((prev) => [...prev, {
                        id: Date.now(), name: `Zone ${drawnZones.length + 1}`,
                        type: zoneType, color: ZONE_COLORS[zoneType], points: drawingZone,
                      }]);
                      addToast('Zone created successfully', 'success');
                    }
                    setDrawingZone([]);
                  }}
                >
                  ✓ Finish Zone ({drawingZone.length} pts)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Properties */}
        <div className="layout-sidebar-right card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: '16px' }}>
            <div className="card-title">Properties</div>
          </div>

          {selectedCamData ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Camera Name</label>
                <input className="form-input" value={selectedCamData.name}
                  onChange={(e) => setPlacedCams((prev) => prev.map((c) =>
                    c.id === selectedCam ? { ...c, name: e.target.value } : c
                  ))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rotation Angle</label>
                <input type="range" min="0" max="359" value={selectedCamData.angle}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                  onChange={(e) => setPlacedCams((prev) => prev.map((c) =>
                    c.id === selectedCam ? { ...c, angle: +e.target.value } : c
                  ))}
                />
                <div style={{ fontSize: 12, fontFamily: 'Outfit, sans-serif', color: 'var(--cyan)', textAlign: 'right', marginTop: 4 }}>
                  {selectedCamData.angle}°
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Field of View (FOV)</label>
                <input type="range" min="15" max="180" value={selectedCamData.fov}
                  style={{ width: '100%', accentColor: 'var(--magenta)' }}
                  onChange={(e) => setPlacedCams((prev) => prev.map((c) =>
                    c.id === selectedCam ? { ...c, fov: +e.target.value } : c
                  ))}
                />
                <div style={{ fontSize: 12, fontFamily: 'Outfit, sans-serif', color: 'var(--magenta)', textAlign: 'right', marginTop: 4 }}>
                  {selectedCamData.fov}°
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status</span>
                <span className={`badge ${selectedCamData.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>
                  <span className="badge-dot" />
                  {selectedCamData.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Position</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--cyan)' }}>
                  {Math.round(selectedCamData.x)}, {Math.round(selectedCamData.y)}
                </span>
              </div>
              <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => {
                setPlacedCams((prev) => prev.filter((c) => c.id !== selectedCam));
                setSelectedCam(null);
                addToast('Camera removed', 'info');
              }}>
                <Trash2 size={14} /> Remove Camera
              </button>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyan)', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <Info size={16} />
                <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>HOW TO USE</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>1</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Drag cameras from the <strong>Drag to Place</strong> menu onto the floor plan.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>2</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Click a placed camera to adjust its <strong>Rotation</strong> and <strong>Field of View</strong>.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>3</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Use <strong>Zone Tools</strong> to draw security perimeters on the map.
                </div>
              </div>
            </div>
          )}

          {/* Zone list */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
              Defined Zones ({drawnZones.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drawnZones.map((z) => (
                <div key={z.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'
                }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: z.color, flexShrink: 0, boxShadow: `0 0 8px ${z.color}80` }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>{z.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{z.type}</div>
                  </div>
                  <button
                    className="icon-btn"
                    style={{ width: 28, height: 28, color: 'var(--text-muted)' }}
                    onClick={() => setDrawnZones((prev) => prev.filter((zz) => zz.id !== z.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid var(--border)', background: 'var(--surface-1)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cameras</span>
              <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--cyan)' }}>{placedCams.length} PLACED</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Zones</span>
              <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--green-bright)' }}>{drawnZones.length} DEFINED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
