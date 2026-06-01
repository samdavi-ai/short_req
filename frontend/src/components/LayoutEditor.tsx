import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Trash2, Plus, ChevronUp, ChevronDown,
  Save, RotateCcw, ZoomIn, ZoomOut, Square, Pentagon, MapPin
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

interface CamOnCanvas {
  id: number;
  x: number;
  y: number;
  angle: number;
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
  RESTRICTED: '#ef4444',
  DWELL:      '#f59e0b',
  TRIPWIRE:   '#3b82f6',
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
  const [zoneType, setZoneType] = useState<'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE'>('DWELL');
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<number | null>(null);
  const [selectedCam, setSelectedCam] = useState<number | null>(null);
  const [drawingZone, setDrawingZone] = useState<{ x: number; y: number }[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  // Demo cameras placed on canvas
  const [placedCams, setPlacedCams] = useState<CamOnCanvas[]>([
    { id: 1, x: 120, y: 150, angle: 45,  name: 'Gate A1', status: 'ACTIVE' },
    { id: 2, x: 380, y: 220, angle: 135, name: 'Security', status: 'ACTIVE' },
    { id: 3, x: 600, y: 130, angle: 270, name: 'Baggage',  status: 'ACTIVE' },
    { id: 4, x: 250, y: 380, angle: 90,  name: 'Retail',   status: 'OFFLINE' },
  ]);

  // Demo zones
  const [drawnZones, setDrawnZones] = useState<ZoneOnCanvas[]>([
    { id: 1, name: 'Gate A3 Zone', type: 'DWELL', color: ZONE_COLORS.DWELL,
      points: [{ x: 150, y: 250 }, { x: 350, y: 250 }, { x: 350, y: 350 }, { x: 150, y: 350 }] },
    { id: 2, name: 'Restricted Area', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED,
      points: [{ x: 480, y: 180 }, { x: 700, y: 180 }, { x: 700, y: 300 }, { x: 480, y: 300 }] },
  ]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw zones
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

      // Zone label
      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      ctx.fillStyle = zone.color;
      ctx.font = 'bold 11px Inter, sans-serif';
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
    }

    // Draw cameras
    placedCams.forEach((cam) => {
      const isSelected = selectedCam === cam.id;
      const isOffline = cam.status === 'OFFLINE';
      const color = isOffline ? '#ef4444' : '#22c55e';

      // FoV cone
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.rotate((cam.angle * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 70, -Math.PI / 4, Math.PI / 4);
      ctx.closePath();
      ctx.fillStyle = color + '18';
      ctx.fill();
      ctx.strokeStyle = color + '44';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Camera icon circle
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, isSelected ? 14 : 12, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? color : '#1a1a1d';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cam.x, cam.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = color + '66';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Camera icon
      ctx.fillStyle = isSelected ? 'white' : color;
      ctx.font = `${isSelected ? 11 : 10}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📷', cam.x, cam.y);

      // Name
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(cam.name, cam.x, cam.y + 16);
    });

    // Live person dots
    if (tool === 'select') {
      for (let i = 0; i < 18; i++) {
        const seed = (i * 137 + activeFloor * 31) % 1000;
        const x = (seed % 700) + 50;
        const y = ((seed * 3) % 400) + 50;
        const isAlert = i % 11 === 0;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isAlert ? '#ef4444' : '#22c55e';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [placedCams, drawnZones, selectedCam, zoom, drawingZone, zoneType, tool, activeFloor]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (tool === 'zone') {
      // Double-click to finish zone
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

    // Select camera
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
      angle: 0,
      name: `Camera ${placedCams.length + 1}`,
      status: 'ACTIVE',
    };
    setPlacedCams((prev) => [...prev, newCam]);
    addToast('Camera placed — click to configure', 'success');
  };

  const selectedCamData = placedCams.find((c) => c.id === selectedCam);

  return (
    <div className="layout-editor" style={{ height: '100%' }}>

      {/* Left: Tools */}
      <div className="layout-sidebar-left">
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-ghost)', textTransform: 'uppercase', padding: '4px 0 6px' }}>
          Floors
        </div>
        {[...DEMO_FLOORS].reverse().map((f) => (
          <div
            key={f.id}
            className={`floor-tab${activeFloor === f.id ? ' active' : ''}`}
            onClick={() => setActiveFloor(f.id)}
          >
            <div>{f.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 2 }}>📷 ×{f.count}</div>
          </div>
        ))}

        <div className="sep" />

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-ghost)', textTransform: 'uppercase', padding: '4px 0 6px' }}>
          Drag to Place
        </div>
        {CAMERA_TYPES.map((ct) => (
          <div
            key={ct.type}
            className="camera-tool-btn"
            draggable
            onDragStart={(e) => e.dataTransfer.setData('camera-type', ct.type)}
            title={`Drag ${ct.label} onto the floor plan`}
          >
            <span style={{ fontSize: 18 }}>{ct.icon}</span>
            <span>{ct.label}</span>
          </div>
        ))}

        <div className="sep" />

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-ghost)', textTransform: 'uppercase', padding: '4px 0 6px' }}>
          Zone Tools
        </div>
        {(Object.keys(ZONE_COLORS) as (keyof typeof ZONE_COLORS)[]).map((zt) => (
          <button
            key={zt}
            className={`camera-tool-btn${tool === 'zone' && zoneType === zt ? ' active' : ''}`}
            style={tool === 'zone' && zoneType === zt ? {
              borderColor: ZONE_COLORS[zt],
              color: ZONE_COLORS[zt],
              background: ZONE_COLORS[zt] + '15',
            } : {}}
            onClick={() => { setTool('zone'); setZoneType(zt as typeof zoneType); }}
          >
            <span style={{
              width: 12, height: 12, borderRadius: 3,
              background: ZONE_COLORS[zt], flexShrink: 0,
            }} />
            {zt}
          </button>
        ))}

        <div className="sep" />

        <button
          className="camera-tool-btn"
          style={tool === 'select' ? { borderColor: 'var(--green)', color: 'var(--green-bright)' } : {}}
          onClick={() => { setTool('select'); setDrawingZone([]); }}
        >
          <MapPin size={14} />Select Mode
        </button>
      </div>

      {/* Center: Canvas */}
      <div className="layout-canvas-area">
        {/* Toolbar */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, zIndex: 10,
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '8px 12px',
          boxShadow: 'var(--shadow-md)',
        }}>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Zoom In"><ZoomIn size={14} /></button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '36px', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Zoom Out"><ZoomOut size={14} /></button>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <button className="icon-btn" onClick={() => { setDrawingZone([]); setSelectedCam(null); }} title="Reset"><RotateCcw size={14} /></button>
          {drawingZone.length > 0 && (
            <button
              className="btn btn-sm btn-primary"
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

        {/* Floor label */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '6px 12px',
          fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
        }}>
          {DEMO_FLOORS.find((f) => f.id === activeFloor)?.label}
        </div>

        {/* Live indicator */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
        }}>
          <span className="live-badge"><span className="live-dot" />18 PERSONS TRACKED</span>
        </div>

        <canvas
          ref={canvasRef}
          className="layout-canvas"
          width={900}
          height={600}
          style={{
            width: '100%', height: '100%',
            cursor: tool === 'zone' ? 'crosshair' : 'default',
          }}
          onClick={handleCanvasClick}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        />
      </div>

      {/* Right: Properties */}
      <div className="layout-sidebar-right">
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
              <label className="form-label">Rotation (°)</label>
              <input type="range" min="0" max="359" value={selectedCamData.angle}
                style={{ width: '100%', accentColor: 'var(--green)' }}
                onChange={(e) => setPlacedCams((prev) => prev.map((c) =>
                  c.id === selectedCam ? { ...c, angle: +e.target.value } : c
                ))}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{selectedCamData.angle}°</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status</span>
              <span className={`badge ${selectedCamData.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>
                <span className="badge-dot" />
                {selectedCamData.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Position</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {Math.round(selectedCamData.x)}, {Math.round(selectedCamData.y)}
              </span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => {
              setPlacedCams((prev) => prev.filter((c) => c.id !== selectedCam));
              setSelectedCam(null);
              addToast('Camera removed', 'info');
            }}>
              <Trash2 size={13} /> Remove Camera
            </button>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon"><Camera size={22} /></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Click a camera to view and edit its properties
            </div>
          </div>
        )}

        {/* Zone list */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Zones ({drawnZones.length})
          </div>
          {drawnZones.map((z) => (
            <div key={z.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: z.color, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{z.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{z.type}</div>
              </div>
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={() => setDrawnZones((prev) => prev.filter((zz) => zz.id !== z.id))}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ padding: '12px 16px', marginTop: 'auto', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📷 Cameras placed</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{placedCams.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🟩 Zones defined</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{drawnZones.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
