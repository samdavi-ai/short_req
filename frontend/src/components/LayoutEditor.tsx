import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Trash2, Plus, Save, RotateCcw, ZoomIn, ZoomOut, MapPin,
  Info, X, Ruler, Move, Maximize2
} from 'lucide-react';
import { useStore, type Building, type FloorDef, type Site } from '../stores/appStore';
import { api } from '../hooks/api';
import PersonJourney from './PersonJourney';

// ─── Existing Interfaces ──────────────────────────────────────────────────────

interface CamOnCanvas {
  id: number;
  x: number;
  y: number;
  angle: number;
  fov: number;
  name: string;
  status: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE';
  rtsp_url?: string;
  location?: string;
  is_overhead?: boolean;
}

interface ZoneOnCanvas {
  id: number;
  name: string;
  points: { x: number; y: number }[];
  type: 'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE';
  color: string;
  dwell_alert_seconds?: number;
  is_active?: boolean;
}

// ─── New Architecture Interfaces ──────────────────────────────────────────────

interface WallSegment {
  id: number;
  startX: number; startY: number;
  endX: number;   endY: number;
  thickness: number;
  color: string;
  label: string;
}

type ArchElementType = 'DOOR' | 'DOUBLE_DOOR' | 'WINDOW' | 'COLUMN' | 'STAIRS' | 'ELEVATOR';

interface ArchElement {
  id: number;
  type: ArchElementType;
  x: number; y: number;
  width: number;
  rotation: number;
  label: string;
  openDirection?: 'LEFT' | 'RIGHT';
}

type MeasureUnit = 'ft' | 'm';
type EditorTool = 'select' | 'zone' | 'wall' | 'arch';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const DEMO_SITES: Site[] = [
  { id: -1, name: 'JFK Airport Complex', address: 'Queens, New York', latitude: 40.6413, longitude: -73.7781, is_active: true, created_at: '' },
];

const DEMO_BUILDINGS: Building[] = [
  { id: -1, site_id: -1, name: 'Terminal 1', building_type: 'INDOOR', is_active: true, created_at: '',
    x_position: 100, y_position: 80, map_width: 280, map_height: 200,
    floors: [
      { id: -1, building_id: -1, level: -1, label: 'Basement', sort_order: 0, created_at: '' },
      { id: -2, building_id: -1, level: 0,  label: 'Ground',   sort_order: 1, created_at: '' },
      { id: -3, building_id: -1, level: 1,  label: 'Floor 1',  sort_order: 2, created_at: '' },
      { id: -4, building_id: -1, level: 2,  label: 'Floor 2',  sort_order: 3, created_at: '' },
      { id: -5, building_id: -1, level: 3,  label: 'Roof',     sort_order: 4, created_at: '' },
    ],
  },
  { id: -2, site_id: -1, name: 'Outdoor Perimeter', building_type: 'OUTDOOR', is_active: true, created_at: '',
    x_position: 450, y_position: 80, map_width: 220, map_height: 160,
    floors: [
      { id: -6, building_id: -2, level: 0, label: 'Ground Level', sort_order: 0, created_at: '' },
    ],
  },
  { id: -3, site_id: -1, name: 'Parking Garage A', building_type: 'MIXED', is_active: true, created_at: '',
    x_position: 100, y_position: 340, map_width: 240, map_height: 160,
    floors: [
      { id: -7, building_id: -3, level: 0, label: 'Ground', sort_order: 0, created_at: '' },
      { id: -8, building_id: -3, level: 1, label: 'Level 1', sort_order: 1, created_at: '' },
      { id: -9, building_id: -3, level: 2, label: 'Level 2', sort_order: 2, created_at: '' },
    ],
  },
];

const ARCH_ELEMENT_TYPES: { type: ArchElementType; label: string; icon: string }[] = [
  { type: 'DOOR',        label: 'Single Door',  icon: '🚪' },
  { type: 'DOUBLE_DOOR', label: 'Double Door',  icon: '🚪' },
  { type: 'WINDOW',      label: 'Window',       icon: '🪟' },
  { type: 'COLUMN',      label: 'Column',       icon: '◼' },
  { type: 'STAIRS',      label: 'Stairs',       icon: '📐' },
  { type: 'ELEVATOR',    label: 'Elevator',     icon: '⬆' },
];

const WALL_COLOR = '#ffffff';

// ─── Utility Functions ────────────────────────────────────────────────────────

const isPointInPolygon = (point: { x: number; y: number }, vs: { x: number; y: number }[]) => {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

function getWallLengthPx(w: WallSegment): number {
  return Math.sqrt((w.endX - w.startX) ** 2 + (w.endY - w.startY) ** 2);
}

function getWallAngleDeg(w: WallSegment): number {
  const rad = Math.atan2(w.endY - w.startY, w.endX - w.startX);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function pxToUnit(px: number, pxPerFoot: number, unit: MeasureUnit): number {
  const feet = px / pxPerFoot;
  if (unit === 'ft') return feet;
  return feet * 0.3048; // meters
}

function unitToPx(value: number, pxPerFoot: number, unit: MeasureUnit): number {
  if (unit === 'ft') return value * pxPerFoot;
  return (value / 0.3048) * pxPerFoot;
}

function formatLength(px: number, pxPerFoot: number, unit: MeasureUnit): string {
  const val = pxToUnit(px, pxPerFoot, unit);
  if (unit === 'ft') {
    const wholeFeet = Math.floor(val);
    const inches = Math.round((val - wholeFeet) * 12);
    if (inches === 0) return `${wholeFeet}'`;
    if (inches === 12) return `${wholeFeet + 1}'`;
    return `${wholeFeet}'-${inches}"`;
  }
  return `${val.toFixed(2)} m`;
}

function snapAngle(angleDeg: number): number {
  const snaps = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  let closest = snaps[0];
  let minDist = Math.abs(angleDeg - snaps[0]);
  for (const s of snaps) {
    const dist = Math.abs(angleDeg - s);
    if (dist < minDist) { minDist = dist; closest = s; }
  }
  return closest === 360 ? 0 : closest;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}


// ─── Canvas Drawing Helpers ───────────────────────────────────────────────────

function drawWallOnCanvas(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment,
  isSelected: boolean,
  pxPerFoot: number,
  unit: MeasureUnit,
  showDimensions: boolean
) {
  const { startX, startY, endX, endY, thickness, color } = wall;
  const dx = endX - startX, dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len, ny = dx / len;
  const halfT = thickness / 2;

  // Wall body
  ctx.beginPath();
  ctx.moveTo(startX + nx * halfT, startY + ny * halfT);
  ctx.lineTo(endX + nx * halfT,   endY + ny * halfT);
  ctx.lineTo(endX - nx * halfT,   endY - ny * halfT);
  ctx.lineTo(startX - nx * halfT, startY - ny * halfT);
  ctx.closePath();

  ctx.fillStyle = isSelected ? (color + 'dd') : (color + '55');
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#f59e0b' : (color + '88');
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();

  // Selection handles
  if (isSelected) {
    for (const [hx, hy] of [[startX, startY], [endX, endY]] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Glow
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#f59e0b44';
    ctx.lineWidth = thickness + 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Dimension label
  if (showDimensions && len > 30) {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const angleDeg = getWallAngleDeg(wall);
    const lengthStr = formatLength(len, pxPerFoot, unit);
    const angleStr = `${angleDeg.toFixed(1)}°`;
    const label = `${lengthStr}  ∠${angleStr}`;

    ctx.save();
    ctx.translate(midX, midY);
    let textAngle = Math.atan2(dy, dx);
    // Keep text readable (not upside down)
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
      textAngle += Math.PI;
    }
    ctx.rotate(textAngle);
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(-tw / 2, -22, tw, 16);
    ctx.strokeStyle = isSelected ? '#f59e0b44' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-tw / 2, -22, tw, 16);

    ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(255,255,255,0.8)';
    ctx.fillText(label, 0, -9);
    ctx.restore();
  }
}

function drawArchElement(
  ctx: CanvasRenderingContext2D,
  el: ArchElement,
  isSelected: boolean
) {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate((el.rotation * Math.PI) / 180);

  const w = el.width;
  const accent = isSelected ? '#f59e0b' : '#00f0ff';
  const fillA = isSelected ? 'rgba(245,158,11,0.25)' : 'rgba(0,240,255,0.12)';

  switch (el.type) {
    case 'DOOR': {
      // Gap + arc sweep
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2, -4);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, -4);
      ctx.stroke();
      // Arc
      const dir = el.openDirection === 'RIGHT' ? 1 : -1;
      ctx.beginPath();
      ctx.arc(dir === 1 ? -w / 2 : w / 2, 0, w, dir === 1 ? -Math.PI / 2 : -Math.PI, dir === 1 ? 0 : -Math.PI / 2);
      ctx.strokeStyle = accent + '66';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Door leaf
      ctx.beginPath();
      ctx.moveTo(dir === 1 ? -w / 2 : w / 2, 0);
      ctx.lineTo(dir === 1 ? -w / 2 + w : w / 2 - w, 0);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'DOUBLE_DOOR': {
      // Two arcs from center
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -4);
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, -4);
      ctx.stroke();
      // Left leaf arc
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, -Math.PI, -Math.PI / 2);
      ctx.strokeStyle = accent + '55';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      // Right leaf arc
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      // Leaves
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(0, 0);
      ctx.moveTo(0, 0); ctx.lineTo(w / 2, 0);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'WINDOW': {
      // Parallel lines (glass)
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -3); ctx.lineTo(w / 2, -3);
      ctx.moveTo(-w / 2, 3);  ctx.lineTo(w / 2, 3);
      ctx.stroke();
      // Cross hatches
      ctx.strokeStyle = accent + '44';
      ctx.lineWidth = 1;
      const count = Math.max(2, Math.floor(w / 15));
      for (let i = 0; i <= count; i++) {
        const lx = -w / 2 + (w / count) * i;
        ctx.beginPath();
        ctx.moveTo(lx, -3); ctx.lineTo(lx, 3);
        ctx.stroke();
      }
      // Frame
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2, -5, w, 10);
      break;
    }
    case 'COLUMN': {
      // Filled square with crosshatch
      const s = w / 2;
      ctx.fillStyle = fillA;
      ctx.fillRect(-s, -s, w, w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, w, w);
      // Cross
      ctx.beginPath();
      ctx.moveTo(-s, -s); ctx.lineTo(s, s);
      ctx.moveTo(s, -s); ctx.lineTo(-s, s);
      ctx.strokeStyle = accent + '66';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'STAIRS': {
      // Parallel treads with arrow
      const steps = 5;
      const stepW = w / steps;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= steps; i++) {
        const sx = -w / 2 + stepW * i;
        ctx.beginPath();
        ctx.moveTo(sx, -10); ctx.lineTo(sx, 10);
        ctx.stroke();
      }
      // Border
      ctx.strokeRect(-w / 2, -10, w, 20);
      // Arrow
      ctx.beginPath();
      ctx.moveTo(-w / 4, 0); ctx.lineTo(w / 4, 0);
      ctx.moveTo(w / 4 - 5, -4); ctx.lineTo(w / 4, 0); ctx.lineTo(w / 4 - 5, 4);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'ELEVATOR': {
      // Filled box with ⬆ arrows
      const s = w / 2;
      ctx.fillStyle = fillA;
      ctx.fillRect(-s, -s, w, w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(-s, -s, w, w);
      // Up arrow
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4); ctx.lineTo(0, -s * 0.4);
      ctx.moveTo(-4, -s * 0.15); ctx.lineTo(0, -s * 0.4); ctx.lineTo(4, -s * 0.15);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Down arrow
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, s * 0.4);
      ctx.moveTo(-4, s * 0.15); ctx.lineTo(0, s * 0.4); ctx.lineTo(4, s * 0.15);
      ctx.stroke();
      break;
    }
  }

  // Selection ring
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, w / 2 + 10, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b55';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Label
  if (el.label) {
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(255,255,255,0.6)';
    // Unrotate the text so it's always readable
    ctx.rotate(-(el.rotation * Math.PI) / 180);
    ctx.fillText(el.label, 0, w / 2 + 6);
  }

  ctx.restore();
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function LayoutEditor() {
  const { cameras, zones, token, addToast, setCameras, setZones,
          sites: storeSites, buildings: storeBuildings,
          activeSiteId, activeBuildingId,
          setSites, setBuildings, setActiveSite, setActiveBuilding } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const campusCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeFloor, setActiveFloor] = useState(1);
  const [tool, setTool] = useState<EditorTool>('select');
  const [zoneType, setZoneType] = useState<'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE'>('RESTRICTED');
  const [zoom, setZoom] = useState(1);

  // Pan & Zoom state
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const spaceHeld = useRef(false);

  // View mode: 'floor' shows single building floor, 'campus' shows all buildings on site map
  const [viewMode, setViewMode] = useState<'floor' | 'campus' | 'campus-3d'>('floor');
  const [campusDragId, setCampusDragId] = useState<number | null>(null);
  const [campusSelectedId, setCampusSelectedId] = useState<number | null>(null);
  const campusDragOffset = useRef({ x: 0, y: 0 });

  // Site/Building/Floor management
  const isDemo = !token || token === 'demo-token';
  const currentSites = isDemo ? DEMO_SITES : storeSites;
  const currentSiteId = isDemo ? -1 : activeSiteId;
  const currentBuildings = isDemo ? DEMO_BUILDINGS : storeBuildings;
  const currentBuildingId = isDemo ? (activeBuildingId ?? -1) : activeBuildingId;
  const activeBuilding = currentBuildings.find(b => b.id === currentBuildingId);
  const activeFloors = activeBuilding?.floors ?? [];
  const activeFloorLabel = activeFloors.find(f => f.level === activeFloor)?.label ?? `Floor ${activeFloor}`;

  // Add Floor / Building modals
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [newFloorLabel, setNewFloorLabel] = useState('');
  const [newFloorLevel, setNewFloorLevel] = useState(0);
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingType, setNewBuildingType] = useState<'INDOOR' | 'OUTDOOR' | 'MIXED'>('INDOOR');

  // Load sites on mount
  useEffect(() => {
    if (!isDemo && token) {
      api.getSites(token).then(setSites).catch(() => {});
    }
  }, [isDemo, token, setSites]);

  // Load buildings when site changes
  useEffect(() => {
    if (!isDemo && token && currentSiteId) {
      api.getBuildings(token, currentSiteId).then(setBuildings).catch(() => {});
    }
  }, [isDemo, token, currentSiteId, setBuildings]);

  // Auto-select first site/building
  useEffect(() => {
    if (!isDemo && currentSites.length > 0 && !activeSiteId) {
      setActiveSite(currentSites[0].id);
    }
  }, [isDemo, currentSites, activeSiteId, setActiveSite]);

  useEffect(() => {
    if (currentBuildings.length > 0 && !currentBuildingId) {
      setActiveBuilding(currentBuildings[0].id);
    }
  }, [currentBuildings, currentBuildingId, setActiveBuilding]);

  // Auto-set active floor to first floor of building
  useEffect(() => {
    if (activeFloors.length > 0) {
      const sorted = [...activeFloors].sort((a, b) => a.sort_order - b.sort_order);
      if (!sorted.some(f => f.level === activeFloor)) {
        setActiveFloor(sorted[0].level);
      }
    }
  }, [activeFloors, activeFloor]);
  
  // Selection States
  const [selectedCam, setSelectedCam] = useState<number | null>(null);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [selectedWall, setSelectedWall] = useState<number | null>(null);
  const [selectedArch, setSelectedArch] = useState<number | null>(null);
  const [doubleClickedCam, setDoubleClickedCam] = useState<number | null>(null);
  
  const [drawingZone, setDrawingZone] = useState<{ x: number; y: number }[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Placed components local state
  const [placedCams, setPlacedCams] = useState<CamOnCanvas[]>([]);
  const [drawnZones, setDrawnZones] = useState<ZoneOnCanvas[]>([]);

  // Architecture state
  const [walls, setWalls] = useState<WallSegment[]>([]);
  const [archElements, setArchElements] = useState<ArchElement[]>([]);
  const [drawingWall, setDrawingWall] = useState<{ startX: number; startY: number } | null>(null);
  const [wallPreviewEnd, setWallPreviewEnd] = useState<{ x: number; y: number } | null>(null);
  const [measureUnit, setMeasureUnit] = useState<MeasureUnit>('ft');
  const [pxPerFoot, setPxPerFoot] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);

  // Camera Drag State
  const [draggedCamId, setDraggedCamId] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Arch element drag state
  const [draggedArchId, setDraggedArchId] = useState<number | null>(null);

  // Wall endpoint drag state
  const [draggingWallEndpoint, setDraggingWallEndpoint] = useState<{ wallId: number; endpoint: 'start' | 'end' } | null>(null);

  // Helper to clear all selections
  const clearSelections = useCallback(() => {
    setSelectedCam(null);
    setSelectedZone(null);
    setSelectedWall(null);
    setSelectedArch(null);
  }, []);

  // Apply grid snapping
  const snapPos = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapToGrid) return { x, y };
    const gridSize = pxPerFoot / 2; // snap to half-foot grid (6 inches)
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }, [snapToGrid, pxPerFoot]);

  // Sync with store cameras/zones on floor change or initial loading
  useEffect(() => {
    if (token && token !== 'demo-token') {
      const floorCams = cameras.filter(c => c.floor === activeFloor).map(c => ({
        id: c.id,
        x: c.x_coord,
        y: c.y_coord,
        angle: c.angle,
        fov: c.fov || 90,
        name: c.name,
        status: c.status,
        rtsp_url: c.rtsp_url,
        location: c.location,
        is_overhead: c.is_overhead,
      }));
      setPlacedCams(floorCams);

      const floorZones = zones.filter(z => z.floor === activeFloor).map(z => ({
        id: z.id,
        name: z.name,
        points: z.coordinates,
        type: z.zone_type,
        color: z.color || ZONE_COLORS[z.zone_type] || '#6366f1',
        dwell_alert_seconds: z.dwell_alert_seconds,
        is_active: z.is_active,
      }));
      setDrawnZones(floorZones);
      setIsDirty(false);
    } else {
      // Demo fallback
      setPlacedCams([
        { id: 1, x: 220, y: 150, angle: 45,  fov: 60, name: 'Gate A1', status: 'ACTIVE', rtsp_url: 'rtsp://192.168.1.10:554/stream1', location: 'Terminal 1 Entry', is_overhead: true },
        { id: 2, x: 480, y: 320, angle: 135, fov: 90, name: 'Security Main', status: 'ACTIVE', rtsp_url: 'rtsp://192.168.1.11:554/stream1', location: 'Main Security', is_overhead: false },
        { id: 3, x: 800, y: 230, angle: 270, fov: 45, name: 'Baggage Line',  status: 'ACTIVE', rtsp_url: 'rtsp://192.168.1.12:554/stream1', location: 'Arrivals Hall', is_overhead: true },
        { id: 4, x: 350, y: 580, angle: 90,  fov: 70, name: 'Retail North',   status: 'OFFLINE', rtsp_url: 'rtsp://192.168.1.13:554/stream1', location: 'Boarding Gate B3', is_overhead: true },
      ]);
      setDrawnZones([
        { id: 1, name: 'Gate A3 Zone', type: 'DWELL', color: ZONE_COLORS.DWELL, dwell_alert_seconds: 900, is_active: true,
          points: [{ x: 150, y: 250 }, { x: 350, y: 250 }, { x: 350, y: 350 }, { x: 150, y: 350 }] },
        { id: 2, name: 'Restricted Area', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
          points: [{ x: 580, y: 180 }, { x: 900, y: 180 }, { x: 900, y: 300 }, { x: 580, y: 300 }] },
      ]);
      // Demo walls
      setWalls([
        { id: 101, startX: 100, startY: 100, endX: 1100, endY: 100, thickness: 6, color: WALL_COLOR, label: 'North Wall' },
        { id: 102, startX: 100, startY: 100, endX: 100, endY: 700, thickness: 6, color: WALL_COLOR, label: 'West Wall' },
        { id: 103, startX: 1100, startY: 100, endX: 1100, endY: 700, thickness: 6, color: WALL_COLOR, label: 'East Wall' },
        { id: 104, startX: 100, startY: 700, endX: 1100, endY: 700, thickness: 6, color: WALL_COLOR, label: 'South Wall' },
        { id: 105, startX: 400, startY: 100, endX: 400, endY: 400, thickness: 4, color: WALL_COLOR, label: 'Security Wall N' },
        { id: 106, startX: 400, startY: 550, endX: 400, endY: 700, thickness: 4, color: WALL_COLOR, label: 'Security Wall S' },
        { id: 107, startX: 750, startY: 100, endX: 750, endY: 500, thickness: 4, color: WALL_COLOR, label: 'Baggage Wall' },
        { id: 108, startX: 750, startY: 500, endX: 1100, endY: 500, thickness: 4, color: WALL_COLOR, label: 'Gate Wall' },
      ]);
      setArchElements([
        { id: 201, type: 'DOOR', x: 400, y: 475, width: 40, rotation: 0, label: 'Security Gate', openDirection: 'RIGHT' },
        { id: 202, type: 'WINDOW', x: 600, y: 100, width: 50, rotation: 0, label: 'Observation' },
        { id: 203, type: 'ELEVATOR', x: 150, y: 650, width: 30, rotation: 0, label: 'Elev A' },
        { id: 204, type: 'STAIRS', x: 1050, y: 650, width: 40, rotation: 0, label: 'Stairs B' },
      ]);
      setIsDirty(false);
    }
    clearSelections();
  }, [activeFloor, token, cameras.length, zones.length, clearSelections]);

  const liveTracks = useStore((state) => state.tracks);

  // Handle Escape key to cancel drawing + Space for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawingWall) {
          setDrawingWall(null);
          setWallPreviewEnd(null);
        }
        if (drawingZone.length > 0) {
          setDrawingZone([]);
        }
        if (tool === 'wall' || tool === 'arch') {
          setTool('select');
        }
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        isPanning.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [drawingWall, drawingZone, tool]);

  // Scroll-to-zoom on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Compute zoom factor
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const newZoom = Math.max(0.15, Math.min(5, zoom + delta));
      const scale = newZoom / zoom;

      // Adjust pan so zoom centers on mouse cursor position
      const newPanX = mouseX - (mouseX - panX) * scale;
      const newPanY = mouseY - (mouseY - panY) * scale;

      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom, panX, panY]);

  // ─── Campus Canvas Draw Loop ────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'campus' && viewMode !== 'campus-3d') return;
    const canvas = campusCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    if (viewMode === 'campus-3d') {
      // Isometric transform: cos(30), sin(30), -cos(30), sin(30)
      ctx.transform(0.866, 0.5, -0.866, 0.5, 0, 0);
    }

    // Grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 3000; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2000); ctx.stroke();
    }
    for (let y = 0; y < 2000; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(3000, y); ctx.stroke();
    }

    const siteBuildings = currentBuildings.filter(b => !currentSiteId || b.site_id === currentSiteId);
    const selected = siteBuildings.find(b => b.id === campusSelectedId);

    // Distance lines from selected building to all others
    if (selected) {
      const sx = selected.x_position + selected.map_width / 2;
      const sy = selected.y_position + selected.map_height / 2;
      siteBuildings.forEach(other => {
        if (other.id === selected.id) return;
        const ox = other.x_position + other.map_width / 2;
        const oy = other.y_position + other.map_height / 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ox, oy);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const mx = (sx + ox) / 2;
        const my = (sy + oy) / 2;
        const distPx = Math.sqrt((ox - sx) ** 2 + (oy - sy) ** 2);
        const distVal = (distPx / pxPerFoot) * (measureUnit === 'm' ? 0.3048 : 1);
        const label = `${distVal.toFixed(1)} ${measureUnit}`;
        ctx.font = 'bold 10px Outfit, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
        ctx.fillRect(mx - tw / 2 - 6, my - 8, tw + 12, 16);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - tw / 2 - 6, my - 8, tw + 12, 16);
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mx, my);
      });
    }

    // Draw buildings
    // Sort buildings so those further back (smaller y in isometric space) are drawn first
    const sortedBuildings = [...siteBuildings].sort((a, b) => {
      if (viewMode === 'campus-3d') {
        return (a.x_position + a.y_position) - (b.x_position + b.y_position);
      }
      return 0;
    });

    sortedBuildings.forEach(b => {
      const isSelected = b.id === campusSelectedId;
      const isDragging = b.id === campusDragId;
      const typeColors: Record<string, { bg: string; border: string; accent: string }> = {
        INDOOR:  { bg: 'rgba(99, 102, 241, 0.12)', border: '#6366f1', accent: '#818cf8' },
        OUTDOOR: { bg: 'rgba(34, 197, 94, 0.12)',  border: '#22c55e', accent: '#4ade80' },
        MIXED:   { bg: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b', accent: '#fbbf24' },
      };
      const colors = typeColors[b.building_type] || typeColors.INDOOR;
      const typeIcon = b.building_type === 'OUTDOOR' ? '🌿' : b.building_type === 'MIXED' ? '🏗' : '🏢';

      if (viewMode === 'campus-3d') {
        const H = Math.max(20, b.floors.length * 30);
        const { x_position: x, y_position: y, map_width: w, map_height: h } = b;

        // Base shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, w, h);

        // Right wall
        ctx.fillStyle = colors.border;
        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w - H, y - H);
        ctx.lineTo(x + w - H, y + h - H);
        ctx.lineTo(x + w, y + h);
        ctx.fill(); ctx.stroke();

        // Left wall
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x - H, y + h - H);
        ctx.lineTo(x + w - H, y + h - H);
        ctx.lineTo(x + w, y + h);
        ctx.fill(); ctx.stroke();

        // Cameras inside
        const bldCameras = cameras.filter(c => b.floors.some(f => f.id === c.floor));
        bldCameras.forEach(cam => {
          const floorIndex = b.floors.findIndex(f => f.id === cam.floor);
          const camZ = floorIndex * 30 + 15;
          const cx = x + cam.x_coord * (w / 1200);
          const cy = y + cam.y_coord * (h / 800);
          
          ctx.beginPath();
          ctx.arc(cx - camZ, cy - camZ, 4, 0, Math.PI * 2);
          ctx.fillStyle = cam.status === 'ACTIVE' ? '#10b981' : '#ef4444';
          ctx.fill();
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        // Roof
        ctx.fillStyle = isSelected ? colors.bg.replace('0.12', '0.5') : colors.bg.replace('0.12', '0.35');
        ctx.fillRect(x - H, y - H, w, h);
        ctx.strokeStyle = isSelected ? '#00f0ff' : colors.border;
        ctx.lineWidth = isSelected ? 2 : 1;
        if (isDragging) { ctx.setLineDash([4, 3]); }
        ctx.strokeRect(x - H, y - H, w, h);
        ctx.setLineDash([]);

        // Labels on roof
        ctx.save();
        ctx.translate(-H, -H);
        ctx.font = 'bold 13px Outfit, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#00f0ff' : colors.accent;
        ctx.fillText(b.name, x + w / 2, y + h / 2 - 10);
        ctx.font = '10px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`${typeIcon} ${b.building_type} • ${b.floors.length} floor${b.floors.length !== 1 ? 's' : ''}`, x + w / 2, y + h / 2 + 8);
        ctx.restore();

      } else {
        if (isSelected || isDragging) {
          ctx.shadowColor = colors.border;
          ctx.shadowBlur = 20;
        }

        ctx.fillStyle = isSelected ? colors.bg.replace('0.12', '0.25') : colors.bg;
        ctx.fillRect(b.x_position, b.y_position, b.map_width, b.map_height);
        ctx.strokeStyle = isSelected ? '#00f0ff' : colors.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        if (isDragging) { ctx.setLineDash([4, 3]); }
        ctx.strokeRect(b.x_position, b.y_position, b.map_width, b.map_height);
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#00f0ff' : colors.accent;
        ctx.fillText(b.name, b.x_position + b.map_width / 2, b.y_position + b.map_height / 2 - 10);

        ctx.font = '10px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`${typeIcon} ${b.building_type} • ${b.floors.length} floor${b.floors.length !== 1 ? 's' : ''}`,
          b.x_position + b.map_width / 2, b.y_position + b.map_height / 2 + 8);

        ctx.font = '9px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`(${b.x_position}, ${b.y_position})`, b.x_position + 4, b.y_position + b.map_height - 3);

        if (isSelected) {
          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(b.x_position + b.map_width - 6, b.y_position + b.map_height - 6, 6, 6);
        }
      }
    });

    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('N ↑', 40, 24);

    ctx.restore();
  }, [viewMode, currentBuildings, currentSiteId, campusSelectedId, campusDragId, zoom, panX, panY, pxPerFoot, measureUnit]);

  // Scroll-to-zoom for campus canvas
  useEffect(() => {
    const canvas = campusCanvasRef.current;
    if (!canvas || (viewMode !== 'campus' && viewMode !== 'campus-3d')) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const newZoom = Math.max(0.15, Math.min(5, zoom + delta));
      const scale = newZoom / zoom;
      setPanX(mouseX - (mouseX - panX) * scale);
      setPanY(mouseY - (mouseY - panY) * scale);
      setZoom(newZoom);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [viewMode, zoom, panX, panY]);

  // ─── Canvas Draw Loop ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
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

    // 2. Draw walls (replaces hardcoded architectural lines)
    walls.forEach((wall) => {
      drawWallOnCanvas(ctx, wall, selectedWall === wall.id, pxPerFoot, measureUnit, showDimensions);
    });

    // Security Gates / Scanners label (if demo security walls exist)
    if (walls.some(w => w.label === 'Security Wall N') && walls.some(w => w.label === 'Security Wall S')) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.fillRect(380, 400, 40, 150); 
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '8px Outfit'; ctx.textAlign = 'center';
      ctx.fillText('X-RAY SCANNERS', 400, 475);
    }

    // Architectural Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 32px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEPARTURES', 250, 150);
    ctx.fillText('SECURITY CLEARANCE', 575, 150);
    ctx.fillText('TERMINAL GATES', 925, 150);

    // 3. Draw Architectural Elements
    archElements.forEach((el) => {
      drawArchElement(ctx, el, selectedArch === el.id);
    });

    // 4. Draw Zones
    drawnZones.forEach((zone) => {
      if (zone.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(zone.points[0].x, zone.points[0].y);
      zone.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = zone.color + '22';
      ctx.fill();

      const isSelected = selectedZone === zone.id;
      ctx.strokeStyle = isSelected ? '#ffffff' : (zone.color + 'aa');
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.setLineDash([]);
      ctx.stroke();

      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      ctx.fillStyle = isSelected ? '#ffffff' : zone.color;
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, cx, cy - 6);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.7)' : (zone.color + 'aa');
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

    // Drawing wall preview
    if (drawingWall && wallPreviewEnd) {
      ctx.beginPath();
      ctx.moveTo(drawingWall.startX, drawingWall.startY);
      ctx.lineTo(wallPreviewEnd.x, wallPreviewEnd.y);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start point marker
      ctx.beginPath();
      ctx.arc(drawingWall.startX, drawingWall.startY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Preview endpoint marker
      ctx.beginPath();
      ctx.arc(wallPreviewEnd.x, wallPreviewEnd.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0baa';
      ctx.fill();

      // Preview dimension
      const pLen = Math.sqrt((wallPreviewEnd.x - drawingWall.startX) ** 2 + (wallPreviewEnd.y - drawingWall.startY) ** 2);
      if (pLen > 20) {
        const pAngle = Math.atan2(wallPreviewEnd.y - drawingWall.startY, wallPreviewEnd.x - drawingWall.startX);
        let pAngleDeg = (pAngle * 180) / Math.PI;
        if (pAngleDeg < 0) pAngleDeg += 360;
        const midPX = (drawingWall.startX + wallPreviewEnd.x) / 2;
        const midPY = (drawingWall.startY + wallPreviewEnd.y) / 2;
        const pLabel = `${formatLength(pLen, pxPerFoot, measureUnit)}  ∠${pAngleDeg.toFixed(1)}°`;
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(pLabel, midPX, midPY - 12);
      }
    }

    // 5. Draw Cameras
    placedCams.forEach((cam) => {
      const isSelected = selectedCam === cam.id;
      const isOffline = cam.status === 'OFFLINE';
      const color = isOffline ? '#ff0055' : '#00f0ff';

      // FoV cone
      const fovRad = (cam.fov * Math.PI) / 180;
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.rotate((cam.angle * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 120, -fovRad / 2, fovRad / 2);
      ctx.closePath();
      
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
      ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.font = isSelected ? 'bold 11px Outfit' : '10px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(cam.name, cam.x, cam.y + 14);
    });

    // 6. Live person dots — color-coded by identity
    if (tool === 'select') {
      const IDENTITY_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
        KNOWN_EMPLOYEE:  { fill: '#22c55e', stroke: '#16a34a', glow: 'rgba(34, 197, 94, 0.4)' },
        KNOWN_VISITOR:   { fill: '#3b82f6', stroke: '#2563eb', glow: 'rgba(59, 130, 246, 0.4)' },
        WATCHLIST_MATCH: { fill: '#f59e0b', stroke: '#d97706', glow: 'rgba(245, 158, 11, 0.5)' },
        BLACKLISTED:     { fill: '#ef4444', stroke: '#dc2626', glow: 'rgba(239, 68, 68, 0.6)' },
        UNKNOWN:         { fill: 'rgba(148, 163, 184, 0.7)', stroke: 'rgba(100, 116, 139, 0.8)', glow: 'rgba(148, 163, 184, 0.2)' },
      };

      const activeTracks = Object.values(liveTracks).filter(
        (t) => (Date.now() / 1000 - t.timestamp) < 5.0
      );
      
      if (activeTracks.length > 0) {
        activeTracks.forEach((track) => {
          const colors = IDENTITY_COLORS[track.identity_type] || IDENTITY_COLORS.UNKNOWN;
          const isKnown = track.identity_type !== 'UNKNOWN';
          const isDangerous = track.identity_type === 'BLACKLISTED' || track.identity_type === 'WATCHLIST_MATCH';
          const dotRadius = isDangerous ? 7 : (isKnown ? 6 : 4);

          if (isKnown) {
            ctx.beginPath();
            ctx.arc(track.x, track.y, dotRadius + 6, 0, Math.PI * 2);
            ctx.fillStyle = colors.glow;
            ctx.fill();
          }

          if (isDangerous) {
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(track.x, track.y, dotRadius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = colors.fill + Math.round(pulse * 100).toString(16).padStart(2, '0');
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(track.x, track.y, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = colors.fill;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (isKnown && track.matched_name) {
            const label = track.matched_name;
            ctx.font = 'bold 9px Inter, sans-serif';
            const textWidth = ctx.measureText(label).width;
            const labelX = track.x - textWidth / 2 - 4;
            const labelY = track.y - dotRadius - 14;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(labelX, labelY, textWidth + 8, 14, 3);
            } else {
              ctx.rect(labelX, labelY, textWidth + 8, 14);
            }
            ctx.fill();
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, track.x, labelY + 7);
          }

          if (isKnown) {
            const icon = track.identity_type === 'KNOWN_EMPLOYEE' ? '👤' 
              : track.identity_type === 'KNOWN_VISITOR' ? '🎫'
              : track.identity_type === 'BLACKLISTED' ? '🚫'
              : '⚠️';
            ctx.font = '10px serif';
            ctx.textAlign = 'center';
            ctx.fillText(icon, track.x + dotRadius + 8, track.y - 2);
          }
        });

        // Track count overlay
        const knownCount = activeTracks.filter(t => t.identity_type !== 'UNKNOWN').length;
        const unknownCount = activeTracks.length - knownCount;
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(110, 680, 180, 36);
        ctx.fillStyle = '#22c55e';
        ctx.fillText(`● ${knownCount} Known`, 118, 686);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.fillText(`● ${unknownCount} Unknown`, 118, 700);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${activeTracks.length} Total`, 220, 693);
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
  }, [placedCams, drawnZones, selectedCam, selectedZone, selectedWall, selectedArch, zoom, panX, panY, drawingZone, zoneType, tool, activeFloor, liveTracks, walls, archElements, drawingWall, wallPreviewEnd, pxPerFoot, measureUnit, showDimensions]);

  // ─── Mouse Handlers ─────────────────────────────────────────────────────

  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom - panX / zoom,
      y: (e.clientY - rect.top) / zoom - panY / zoom,
    };
  }, [zoom, panX, panY]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle-click or Space+left-click starts panning
    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX - panX, y: e.clientY - panY };
      return;
    }

    const { x, y } = getCanvasPos(e);

    if (tool === 'select') {
      // Check wall endpoint handles
      if (selectedWall !== null) {
        const sw = walls.find(w => w.id === selectedWall);
        if (sw) {
          if (Math.sqrt((sw.startX - x) ** 2 + (sw.startY - y) ** 2) < 10) {
            setDraggingWallEndpoint({ wallId: sw.id, endpoint: 'start' });
            isDraggingRef.current = true;
            return;
          }
          if (Math.sqrt((sw.endX - x) ** 2 + (sw.endY - y) ** 2) < 10) {
            setDraggingWallEndpoint({ wallId: sw.id, endpoint: 'end' });
            isDraggingRef.current = true;
            return;
          }
        }
      }

      // Check arch elements
      const clickedArch = archElements.find(
        (el) => Math.sqrt((el.x - x) ** 2 + (el.y - y) ** 2) < (el.width / 2 + 8)
      );
      if (clickedArch) {
        setDraggedArchId(clickedArch.id);
        isDraggingRef.current = true;
        dragStartPos.current = { x, y };
        return;
      }

      // Check camera
      const clickedCam = placedCams.find(
        (c) => Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2) < 16
      );
      if (clickedCam) {
        setDraggedCamId(clickedCam.id);
        isDraggingRef.current = true;
        dragStartPos.current = { x, y };
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle panning
    if (isPanning.current) {
      setPanX(e.clientX - panStart.current.x);
      setPanY(e.clientY - panStart.current.y);
      return;
    }

    const { x, y } = getCanvasPos(e);

    // Wall preview while drawing
    if (tool === 'wall' && drawingWall) {
      let endPos = { x, y };
      if (e.shiftKey) {
        // Shift = snap to nearest 45° angle
        const dx = x - drawingWall.startX;
        const dy = y - drawingWall.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const snapA = (snapAngle((angle * 180) / Math.PI) * Math.PI) / 180;
        endPos = {
          x: drawingWall.startX + Math.cos(snapA) * dist,
          y: drawingWall.startY + Math.sin(snapA) * dist,
        };
      } else if (snapToGrid) {
        endPos = snapPos(x, y);
      }
      setWallPreviewEnd(endPos);
      return;
    }

    // Drag wall endpoint
    if (isDraggingRef.current && draggingWallEndpoint) {
      const pos = snapToGrid ? snapPos(x, y) : { x, y };
      setWalls(prev => prev.map(w => {
        if (w.id !== draggingWallEndpoint.wallId) return w;
        if (draggingWallEndpoint.endpoint === 'start') {
          return { ...w, startX: pos.x, startY: pos.y };
        }
        return { ...w, endX: pos.x, endY: pos.y };
      }));
      setIsDirty(true);
      return;
    }

    // Drag arch element
    if (isDraggingRef.current && draggedArchId !== null) {
      const pos = snapToGrid ? snapPos(x, y) : { x, y };
      setArchElements(prev => prev.map(el =>
        el.id === draggedArchId ? { ...el, x: pos.x, y: pos.y } : el
      ));
      setIsDirty(true);
      return;
    }

    // Drag camera
    if (isDraggingRef.current && draggedCamId !== null) {
      setPlacedCams((prev) =>
        prev.map((c) => (c.id === draggedCamId ? { ...c, x, y } : c))
      );
      setIsDirty(true);
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    isDraggingRef.current = false;
    setDraggedCamId(null);
    setDraggedArchId(null);
    setDraggingWallEndpoint(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);

    const clickedCam = placedCams.find(
      (c) => Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2) < 16
    );

    if (clickedCam) {
      setDoubleClickedCam(clickedCam.id);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);

    // Wall tool
    if (tool === 'wall') {
      if (!drawingWall) {
        // First click — set start
        const pos = snapToGrid ? snapPos(x, y) : { x, y };
        setDrawingWall({ startX: pos.x, startY: pos.y });
        setWallPreviewEnd(null);
        return;
      }

      // Second click — finalize wall
      let endPos = { x, y };
      if (e.shiftKey) {
        const dx = x - drawingWall.startX;
        const dy = y - drawingWall.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const snapA = (snapAngle((angle * 180) / Math.PI) * Math.PI) / 180;
        endPos = {
          x: drawingWall.startX + Math.cos(snapA) * dist,
          y: drawingWall.startY + Math.sin(snapA) * dist,
        };
      } else if (snapToGrid) {
        endPos = snapPos(x, y);
      }

      const len = Math.sqrt((endPos.x - drawingWall.startX) ** 2 + (endPos.y - drawingWall.startY) ** 2);
      if (len > 5) {
        const newWall: WallSegment = {
          id: Date.now(),
          startX: drawingWall.startX,
          startY: drawingWall.startY,
          endX: endPos.x,
          endY: endPos.y,
          thickness: 6,
          color: WALL_COLOR,
          label: `Wall ${walls.length + 1}`,
        };
        setWalls(prev => [...prev, newWall]);
        setSelectedWall(newWall.id);
        setSelectedCam(null);
        setSelectedZone(null);
        setSelectedArch(null);
        setIsDirty(true);
        addToast('Wall created — edit in Properties panel', 'success');
      }
      setDrawingWall(null);
      setWallPreviewEnd(null);
      return;
    }

    // Zone tool
    if (tool === 'zone') {
      if (e.detail === 2 && drawingZone.length >= 3) {
        const newZone: ZoneOnCanvas = {
          id: Date.now(),
          name: `Zone ${drawnZones.length + 1}`,
          type: zoneType,
          color: ZONE_COLORS[zoneType],
          points: drawingZone,
          dwell_alert_seconds: 300,
          is_active: true
        };
        setDrawnZones((prev) => [...prev, newZone]);
        setDrawingZone([]);
        setSelectedZone(newZone.id);
        clearSelections();
        setSelectedZone(newZone.id);
        setIsDirty(true);
        addToast(`Zone drawn — configure it in the properties panel`, 'success');
        return;
      }
      setDrawingZone((prev) => [...prev, { x, y }]);
      return;
    }

    if (tool === 'select') {
      const dist = dragStartPos.current ? Math.sqrt((dragStartPos.current.x - x) ** 2 + (dragStartPos.current.y - y) ** 2) : 0;
      if (dist > 5) return;

      // Check camera selection
      const clickedCam = placedCams.find(
        (c) => Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2) < 16
      );
      if (clickedCam) {
        clearSelections();
        setSelectedCam(clickedCam.id);
        return;
      }

      // Check arch element selection
      const clickedArch = archElements.find(
        (el) => Math.sqrt((el.x - x) ** 2 + (el.y - y) ** 2) < (el.width / 2 + 8)
      );
      if (clickedArch) {
        clearSelections();
        setSelectedArch(clickedArch.id);
        return;
      }

      // Check wall selection
      const clickedWall = walls.find(
        (w) => distToSegment(x, y, w.startX, w.startY, w.endX, w.endY) < (w.thickness / 2 + 6)
      );
      if (clickedWall) {
        clearSelections();
        setSelectedWall(clickedWall.id);
        return;
      }

      // Check zone selection
      const clickedZone = drawnZones.find((z) => isPointInPolygon({ x, y }, z.points));
      if (clickedZone) {
        clearSelections();
        setSelectedZone(clickedZone.id);
        return;
      }

      // Check passenger tracks
      const clickedTrack = Object.values(liveTracks).find((t) => {
        const isActive = (Date.now() / 1000 - t.timestamp) < 5.0;
        if (!isActive) return false;
        return Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 16;
      });
      if (clickedTrack) {
        setSelectedTrackId(clickedTrack.global_id);
        return;
      }

      // Deselect all
      clearSelections();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if dropping an arch element
    const archType = e.dataTransfer.getData('arch-type') as ArchElementType;
    if (archType) {
      const pos = snapToGrid ? snapPos(x, y) : { x, y };
      const newEl: ArchElement = {
        id: Date.now(),
        type: archType,
        x: pos.x,
        y: pos.y,
        width: archType === 'COLUMN' ? 20 : 40,
        rotation: 0,
        label: `${ARCH_ELEMENT_TYPES.find(t => t.type === archType)?.label || archType}`,
        openDirection: (archType === 'DOOR' || archType === 'DOUBLE_DOOR') ? 'RIGHT' : undefined,
      };
      setArchElements(prev => [...prev, newEl]);
      clearSelections();
      setSelectedArch(newEl.id);
      setIsDirty(true);
      addToast(`${newEl.label} placed — edit in Properties panel`, 'success');
      return;
    }

    // Camera drop
    const newCam: CamOnCanvas = {
      id: Date.now(),
      x, y,
      angle: 90,
      fov: 90,
      name: `Camera ${placedCams.length + 1}`,
      status: 'ACTIVE',
      rtsp_url: `rtsp://127.0.0.1:8554/stream_${Date.now()}`,
      location: `Floor ${activeFloor} Zone`,
      is_overhead: true,
    };
    setPlacedCams((prev) => [...prev, newCam]);
    clearSelections();
    setSelectedCam(newCam.id);
    setIsDirty(true);
    addToast('Camera placed — configure details in the properties panel', 'success');
  };

  // ─── Discard / Save / Load Demo ─────────────────────────────────────────

  const discardChanges = () => {
    if (window.confirm('Discard all unsaved changes for this floor?')) {
      if (token && token !== 'demo-token') {
        const floorCams = cameras.filter(c => c.floor === activeFloor).map(c => ({
          id: c.id,
          x: c.x_coord,
          y: c.y_coord,
          angle: c.angle,
          fov: c.fov || 90,
          name: c.name,
          status: c.status,
          rtsp_url: c.rtsp_url,
          location: c.location,
          is_overhead: c.is_overhead,
        }));
        setPlacedCams(floorCams);

        const floorZones = zones.filter(z => z.floor === activeFloor).map(z => ({
          id: z.id,
          name: z.name,
          points: z.coordinates,
          type: z.zone_type,
          color: z.color || ZONE_COLORS[z.zone_type] || '#6366f1',
          dwell_alert_seconds: z.dwell_alert_seconds,
          is_active: z.is_active,
        }));
        setDrawnZones(floorZones);
      } else {
        setPlacedCams([]);
        setDrawnZones([]);
      }
      setWalls([]);
      setArchElements([]);
      clearSelections();
      setIsDirty(false);
      addToast('Unsaved changes discarded', 'info');
    }
  };

  const loadDemoTemplate = () => {
    const DEMO_PLACED_CAMS = [
      { id: Date.now() + 1, x: 220, y: 150, angle: 45,  fov: 60, name: 'Gate A1', status: 'ACTIVE' as const, rtsp_url: 'rtsp://192.168.1.10:554/stream1', location: 'Terminal 1 Entry', is_overhead: true },
      { id: Date.now() + 2, x: 480, y: 320, angle: 135, fov: 90, name: 'Security Main', status: 'ACTIVE' as const, rtsp_url: 'rtsp://192.168.1.11:554/stream1', location: 'Main Security', is_overhead: false },
      { id: Date.now() + 3, x: 800, y: 230, angle: 270, fov: 45, name: 'Baggage Line',  status: 'ACTIVE' as const, rtsp_url: 'rtsp://192.168.1.12:554/stream1', location: 'Arrivals Hall', is_overhead: true },
      { id: Date.now() + 4, x: 350, y: 580, angle: 90,  fov: 70, name: 'Retail North',   status: 'OFFLINE' as const, rtsp_url: 'rtsp://192.168.1.13:554/stream1', location: 'Boarding Gate B3', is_overhead: true },
    ];
    const DEMO_DRAWN_ZONES = [
      { id: Date.now() + 5, name: 'Gate A3 Zone', type: 'DWELL' as const, color: ZONE_COLORS.DWELL, dwell_alert_seconds: 900, is_active: true,
        points: [{ x: 150, y: 250 }, { x: 350, y: 250 }, { x: 350, y: 350 }, { x: 150, y: 350 }] },
      { id: Date.now() + 6, name: 'Restricted Area', type: 'RESTRICTED' as const, color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
        points: [{ x: 580, y: 180 }, { x: 900, y: 180 }, { x: 900, y: 300 }, { x: 580, y: 300 }] },
    ];
    setPlacedCams(DEMO_PLACED_CAMS);
    setDrawnZones(DEMO_DRAWN_ZONES);
    setIsDirty(true);
    addToast('Demo template loaded! Click Save Layout to write to database.', 'info');
  };

  // Transactional database saving pipeline
  const saveLayout = async () => {
    if (!token || token === 'demo-token') {
      addToast('Demo Mode: Layout changes saved locally!', 'success');
      setIsDirty(false);
      return;
    }

    try {
      addToast('Saving layout to database...', 'info');

      // 1. Process Cameras
      const storeFloorCams = cameras.filter(c => c.floor === activeFloor);
      const placedIds = new Set(placedCams.map(c => c.id));

      const camsToDelete = storeFloorCams.filter(c => !placedIds.has(c.id));
      for (const cam of camsToDelete) {
        await api.deleteCamera(token, cam.id);
      }

      const camsToAdd = placedCams.filter(c => c.id > 100000000000);
      for (const cam of camsToAdd) {
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        try {
          await api.createCamera(token, {
            name: cam.name,
            rtsp_url: cam.rtsp_url && !cam.rtsp_url.includes('stream_') 
              ? cam.rtsp_url 
              : `rtsp://127.0.0.1:8554/cam_${uniqueSuffix}`,
            location: cam.location || `Floor ${activeFloor} Area`,
            floor: activeFloor,
            x_coord: cam.x,
            y_coord: cam.y,
            angle: cam.angle,
            fov: cam.fov,
            is_overhead: cam.is_overhead ?? true,
            status: cam.status
          });
        } catch (err: any) {
          if (err.message?.includes('409') || err.message?.includes('already exists')) {
            await api.createCamera(token, {
              name: cam.name,
              rtsp_url: `rtsp://127.0.0.1:8554/cam_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              location: cam.location || `Floor ${activeFloor} Area`,
              floor: activeFloor,
              x_coord: cam.x,
              y_coord: cam.y,
              angle: cam.angle,
              fov: cam.fov,
              is_overhead: cam.is_overhead ?? true,
              status: cam.status
            });
          } else {
            throw err;
          }
        }
      }

      const camsToUpdate = placedCams.filter(c => c.id <= 100000000000);
      for (const cam of camsToUpdate) {
        await api.updateCamera(token, cam.id, {
          name: cam.name,
          rtsp_url: cam.rtsp_url,
          location: cam.location,
          floor: activeFloor,
          x_coord: cam.x,
          y_coord: cam.y,
          angle: cam.angle,
          fov: cam.fov,
          is_overhead: cam.is_overhead ?? true,
          status: cam.status
        });
      }

      // 2. Process Zones
      const storeFloorZones = zones.filter(z => z.floor === activeFloor);
      const drawnIds = new Set(drawnZones.map(z => z.id));

      const zonesToDelete = storeFloorZones.filter(z => !drawnIds.has(z.id));
      for (const zone of zonesToDelete) {
        await api.deleteZone(token, zone.id);
      }

      const zonesToAdd = drawnZones.filter(z => z.id > 100000000000);
      for (const z of zonesToAdd) {
        if (z.points.length < 3) {
          addToast(`Zone "${z.name}" needs at least 3 points — skipped`, 'info');
          continue;
        }
        await api.createZone(token, {
          name: z.name,
          floor: activeFloor,
          coordinates: z.points,
          zone_type: z.type,
          dwell_alert_seconds: z.dwell_alert_seconds ?? 300,
          color: z.color,
          is_active: z.is_active !== false
        });
      }

      const zonesToUpdate = drawnZones.filter(z => z.id <= 100000000000);
      for (const z of zonesToUpdate) {
        await api.updateZone(token, z.id, {
          name: z.name,
          coordinates: z.points,
          zone_type: z.type,
          dwell_alert_seconds: z.dwell_alert_seconds ?? 300,
          color: z.color,
          is_active: z.is_active !== false
        });
      }

      // 3. Refresh Global Store data
      const updatedCams = await api.getCameras(token);
      const updatedZones = await api.getZones(token);
      setCameras(updatedCams);
      setZones(updatedZones);

      setIsDirty(false);
      addToast('Blueprint layout saved successfully to database!', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(`Error saving layout: ${err.message || err}`, 'error');
    }
  };

  // ─── Data Lookups ─────────────────────────────────────────────────────────

  const selectedCamData = placedCams.find((c) => c.id === selectedCam);
  const selectedZoneData = drawnZones.find((z) => z.id === selectedZone);
  const selectedWallData = walls.find((w) => w.id === selectedWall);
  const selectedArchData = archElements.find((el) => el.id === selectedArch);

  // ─── Render ─────────────────────────────────────────────────────────────

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
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {isDirty ? `Unsaved changes on ${activeBuilding?.name ?? 'Building'} — ${activeFloorLabel}` : `${activeBuilding?.name ?? 'Building'} — ${activeFloorLabel}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {placedCams.length === 0 && drawnZones.length === 0 && walls.length === 0 && (
            <button className="btn btn-secondary" onClick={loadDemoTemplate}>
              <Plus size={14} /> Load Demo Template
            </button>
          )}
          <button className="btn btn-secondary" onClick={discardChanges}>Discard</button>
          <button className="btn btn-primary" onClick={saveLayout}>
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
        <div className="layout-sidebar-left" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          
          {/* Site Selector */}
          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 8 }}>
              📍 Site
            </div>
            <select
              id="site-selector"
              value={currentSiteId ?? ''}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                if (!isDemo) setActiveSite(id);
                setActiveBuilding(null);
              }}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)', border: '1px solid var(--surface-3)',
                color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {currentSites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {currentSites.find(s => s.id === currentSiteId)?.address && (
              <div style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 4, fontStyle: 'italic' }}>
                {currentSites.find(s => s.id === currentSiteId)?.address}
              </div>
            )}
          </div>

          {/* Building Selector */}
          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🏢 Building</span>
              <button
                onClick={() => { setShowAddBuilding(true); setNewBuildingName(''); setNewBuildingType('INDOOR'); }}
                style={{
                  background: 'rgba(0,240,255,0.1)', border: '1px solid var(--cyan-shadow)',
                  color: 'var(--cyan)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px',
                  fontSize: 10, fontWeight: 700,
                }}
                title="Add building"
              >+ Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currentBuildings.filter(b => !currentSiteId || b.site_id === currentSiteId).map(b => {
                const typeIcon = b.building_type === 'OUTDOOR' ? '🌿' : b.building_type === 'MIXED' ? '🏗' : '🏢';
                const isActive = b.id === currentBuildingId;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (isDirty && !window.confirm('Unsaved changes. Switch building?')) return;
                      if (isDemo) setActiveBuilding(b.id);
                      else setActiveBuilding(b.id);
                    }}
                    style={{
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.2s',
                      ...(isActive ? {
                        background: 'rgba(0,240,255,0.1)', border: '1px solid var(--cyan-shadow)', color: 'var(--cyan)',
                      } : {
                        background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)',
                      }),
                    }}
                  >
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 13 }}>
                      {typeIcon} {b.name}
                    </div>
                    <div style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                      background: b.building_type === 'OUTDOOR' ? 'rgba(34,197,94,0.15)' : b.building_type === 'MIXED' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                      color: b.building_type === 'OUTDOOR' ? '#22c55e' : b.building_type === 'MIXED' ? '#f59e0b' : '#6366f1',
                    }}>
                      {b.building_type}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Building Modal (inline) */}
            {showAddBuilding && (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-3)' }}>
                <input
                  value={newBuildingName}
                  onChange={e => setNewBuildingName(e.target.value)}
                  placeholder="Building name…"
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 4,
                    background: 'var(--surface-1)', border: '1px solid var(--surface-3)',
                    color: 'var(--text-primary)', fontSize: 12, marginBottom: 6,
                  }}
                />
                <select
                  value={newBuildingType}
                  onChange={e => setNewBuildingType(e.target.value as 'INDOOR' | 'OUTDOOR' | 'MIXED')}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 4,
                    background: 'var(--surface-1)', border: '1px solid var(--surface-3)',
                    color: 'var(--text-primary)', fontSize: 12, marginBottom: 8,
                  }}
                >
                  <option value="INDOOR">🏢 Indoor</option>
                  <option value="OUTDOOR">🌿 Outdoor</option>
                  <option value="MIXED">🏗 Mixed</option>
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 11, padding: '5px 8px' }}
                    onClick={async () => {
                      if (!newBuildingName.trim()) return;
                      if (!isDemo && token && currentSiteId) {
                        try {
                          await api.createBuilding(token, { site_id: currentSiteId, name: newBuildingName, building_type: newBuildingType });
                          const bldgs = await api.getBuildings(token, currentSiteId);
                          setBuildings(bldgs);
                          addToast(`Building "${newBuildingName}" created`, 'success');
                        } catch { addToast('Failed to create building', 'error'); }
                      } else {
                        // Demo mode: append locally
                        const id = -(currentBuildings.length + 10);
                        const xOff = (currentBuildings.length % 3) * 260 + 100;
                        const yOff = Math.floor(currentBuildings.length / 3) * 220 + 100;
                        const newB: Building = {
                          id, site_id: currentSiteId ?? -1, name: newBuildingName,
                          building_type: newBuildingType, is_active: true, created_at: '',
                          x_position: xOff, y_position: yOff, map_width: 200, map_height: 150,
                          floors: [{ id: id * 10, building_id: id, level: 0, label: 'Ground', sort_order: 0, created_at: '' }],
                        };
                        setBuildings([...currentBuildings, newB]);
                        addToast(`Building "${newBuildingName}" added (demo)`, 'success');
                      }
                      setShowAddBuilding(false);
                    }}
                  >Create</button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1, fontSize: 11, padding: '5px 8px' }}
                    onClick={() => setShowAddBuilding(false)}
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Floors */}
          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Floors</span>
              <button
                onClick={() => { setShowAddFloor(true); setNewFloorLabel(''); setNewFloorLevel(activeFloors.length); }}
                style={{
                  background: 'rgba(0,240,255,0.1)', border: '1px solid var(--cyan-shadow)',
                  color: 'var(--cyan)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px',
                  fontSize: 10, fontWeight: 700,
                }}
                title="Add floor"
              >+ Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...activeFloors].sort((a, b) => b.sort_order - a.sort_order).map((f) => (
                <div
                  key={f.id}
                  className={`floor-tab${activeFloor === f.level ? ' active' : ''}`}
                  onClick={() => {
                    if (isDirty && !window.confirm('You have unsaved changes. Change floor anyway?')) return;
                    setActiveFloor(f.level);
                  }}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    ...(activeFloor === f.level ? { 
                      background: 'rgba(0,240,255,0.1)', border: '1px solid var(--cyan-shadow)', color: 'var(--cyan)' 
                    } : {
                      background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)'
                    })
                  }}
                >
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: activeFloor === f.level ? 'var(--cyan)' : 'var(--text-ghost)' }}>📷 {
                    !isDemo ? cameras.filter(c => c.floor === f.level && (c as any).building_id === currentBuildingId).length
                    : Math.floor(Math.random() * 15 + 3)
                  }</div>
                </div>
              ))}
            </div>

            {/* Add Floor (inline) */}
            {showAddFloor && (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-3)' }}>
                <input
                  value={newFloorLabel}
                  onChange={e => setNewFloorLabel(e.target.value)}
                  placeholder="Floor label (e.g., Floor 3)…"
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 4,
                    background: 'var(--surface-1)', border: '1px solid var(--surface-3)',
                    color: 'var(--text-primary)', fontSize: 12, marginBottom: 6,
                  }}
                />
                <input
                  type="number"
                  value={newFloorLevel}
                  onChange={e => setNewFloorLevel(parseInt(e.target.value) || 0)}
                  placeholder="Level number"
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 4,
                    background: 'var(--surface-1)', border: '1px solid var(--surface-3)',
                    color: 'var(--text-primary)', fontSize: 12, marginBottom: 8,
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 11, padding: '5px 8px' }}
                    onClick={async () => {
                      if (!newFloorLabel.trim()) return;
                      if (!isDemo && token && currentBuildingId) {
                        try {
                          await api.createFloor(token, currentBuildingId, { level: newFloorLevel, label: newFloorLabel, sort_order: newFloorLevel + 100 });
                          const bldgs = await api.getBuildings(token, currentSiteId!);
                          setBuildings(bldgs);
                          addToast(`Floor "${newFloorLabel}" added`, 'success');
                        } catch { addToast('Failed to add floor', 'error'); }
                      } else if (activeBuilding) {
                        // Demo mode: add locally
                        const newFloor: FloorDef = {
                          id: -(activeFloors.length + 20),
                          building_id: activeBuilding.id,
                          level: newFloorLevel,
                          label: newFloorLabel,
                          sort_order: newFloorLevel + 100,
                          created_at: '',
                        };
                        const updated = currentBuildings.map(b =>
                          b.id === activeBuilding.id ? { ...b, floors: [...b.floors, newFloor] } : b
                        );
                        setBuildings(updated);
                        addToast(`Floor "${newFloorLabel}" added (demo)`, 'success');
                      }
                      setShowAddFloor(false);
                    }}
                  >Add Floor</button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1, fontSize: 11, padding: '5px 8px' }}
                    onClick={() => setShowAddFloor(false)}
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Mode & Cameras */}
          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <button
              className={`btn ${tool === 'select' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }}
              onClick={() => { setTool('select'); setDrawingZone([]); setDrawingWall(null); setWallPreviewEnd(null); }}
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

            {/* Zone Tools */}
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
                  onClick={() => { setTool('zone'); setZoneType(zt as typeof zoneType); setDrawingWall(null); setWallPreviewEnd(null); }}
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

          {/* Architecture Tools */}
          <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 12 }}>
              Architecture Tools
            </div>

            {/* Draw Wall Button */}
            <button
              className={`arch-tool-btn${tool === 'wall' ? ' active' : ''}`}
              onClick={() => {
                setTool(tool === 'wall' ? 'select' : 'wall');
                setDrawingZone([]);
                setDrawingWall(null);
                setWallPreviewEnd(null);
              }}
              style={{ marginBottom: 10 }}
            >
              <span className="arch-icon"><Ruler size={14} /></span>
              <span>{tool === 'wall' ? 'Drawing Wall...' : 'Draw Wall'}</span>
            </button>

            {tool === 'wall' && (
              <div className="drawing-hint" style={{ marginBottom: 10 }}>
                Click to set start, click again to finish. Hold Shift for angle snap. Esc to cancel.
              </div>
            )}

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
              Drag to Place
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ARCH_ELEMENT_TYPES.map((at) => (
                <div
                  key={at.type}
                  className="arch-tool-btn"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('arch-type', at.type)}
                  title={`Drag ${at.label} onto the floor plan`}
                  style={{ cursor: 'grab' }}
                >
                  <span className="arch-icon">{at.icon}</span>
                  <span>{at.label}</span>
                </div>
              ))}
            </div>

            <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '12px 0' }} />

            {/* Scale & Units */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 8 }}>
              Scale & Units
            </div>
            <div className="scale-config">
              <div className="scale-config-row">
                <span className="scale-config-label">Unit</span>
                <div className="unit-selector">
                  <button className={measureUnit === 'ft' ? 'active' : ''} onClick={() => setMeasureUnit('ft')}>FT</button>
                  <button className={measureUnit === 'm' ? 'active' : ''} onClick={() => setMeasureUnit('m')}>M</button>
                </div>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Scale</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" min="5" max="100" value={pxPerFoot}
                    onChange={(e) => setPxPerFoot(Math.max(5, Math.min(100, +e.target.value)))}
                    style={{
                      width: 44, background: 'var(--surface-3)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '2px 6px', color: 'var(--amber)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'center', outline: 'none'
                    }}
                  />
                  <span className="scale-config-label">px/ft</span>
                </div>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Snap Grid</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Dimensions</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
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
            
            {/* View Mode Toggle */}
            <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 12, display: 'flex', gap: 4 }}>
              <button
                className={`btn btn-sm ${viewMode === 'campus' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 100, fontSize: 11, padding: '5px 14px' }}
                onClick={() => { setViewMode('campus'); setCampusSelectedId(null); setZoom(1); setPanX(0); setPanY(0); }}
              >🗺 2D Campus</button>
              <button
                className={`btn btn-sm ${viewMode === 'campus-3d' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 100, fontSize: 11, padding: '5px 14px' }}
                onClick={() => { setViewMode('campus-3d'); setCampusSelectedId(null); setZoom(1); setPanX(600); setPanY(200); }}
              >🧊 3D Campus</button>
              <button
                className={`btn btn-sm ${viewMode === 'floor' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 100, fontSize: 11, padding: '5px 14px' }}
                onClick={() => { setViewMode('floor'); setZoom(1); setPanX(0); setPanY(0); }}
              >📐 Floor</button>
            </div>

            {viewMode === 'floor' ? (
              <>
            <div style={{
              position: 'absolute', top: 20, left: 24, zIndex: 10,
              fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 800, 
              color: 'var(--white)', textShadow: '0 2px 10px rgba(0,0,0,0.8)'
            }}>
              {activeFloorLabel} Blueprint
            </div>



            <canvas
              ref={canvasRef}
              className="layout-canvas"
              width={1200}
              height={800}
              style={{
                width: '100%', height: '100%',
                cursor: isPanning.current ? 'grabbing' : spaceHeld.current ? 'grab' : tool === 'wall' ? 'crosshair' : tool === 'zone' ? 'crosshair' : (draggedCamId || draggedArchId || draggingWallEndpoint ? 'grabbing' : 'default'),
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              onClick={handleCanvasClick}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onAuxClick={(e) => e.preventDefault()}
            />

            {/* Pan/Zoom hint overlay */}
            <div style={{
              position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
              zIndex: 9, fontSize: 10, color: 'var(--text-ghost)', fontFamily: 'Outfit, sans-serif',
              letterSpacing: '0.04em', pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              Scroll to zoom • Hold Space + drag to pan • Middle-click + drag to pan
            </div>

            {/* Floating Zoom Toolbar */}
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 8, zIndex: 10, alignItems: 'center',
              background: 'rgba(15, 15, 20, 0.8)', backdropFilter: 'blur(12px)',
              border: '1px solid var(--border)', borderRadius: '100px', 
              padding: '6px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))} title="Zoom Out"><ZoomOut size={16} /></button>
              <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', width: 44, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button className="icon-btn" onClick={() => setZoom((z) => Math.min(5, z + 0.1))} title="Zoom In"><ZoomIn size={16} /></button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
              <button className="icon-btn" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} title="Fit to View"><Maximize2 size={16} /></button>
              <button className="icon-btn" onClick={() => { setDrawingZone([]); setDrawingWall(null); setWallPreviewEnd(null); clearSelections(); }} title="Reset Canvas"><RotateCcw size={16} /></button>
              {drawingZone.length > 0 && (
                <button
                  className="btn btn-sm btn-primary" style={{ marginLeft: 8, borderRadius: 100 }}
                  onClick={() => {
                    if (drawingZone.length >= 3) {
                      const newZone: ZoneOnCanvas = {
                        id: Date.now(), name: `Zone ${drawnZones.length + 1}`,
                        type: zoneType, color: ZONE_COLORS[zoneType], points: drawingZone,
                        dwell_alert_seconds: 300, is_active: true
                      };
                      setDrawnZones((prev) => [...prev, newZone]);
                      setSelectedZone(newZone.id);
                      setSelectedCam(null);
                      setSelectedWall(null);
                      setSelectedArch(null);
                      setIsDirty(true);
                      addToast('Zone created successfully', 'success');
                    }
                    setDrawingZone([]);
                  }}
                >
                  ✓ Finish Zone ({drawingZone.length} pts)
                </button>
              )}
            </div>
              </>
            ) : (
              <>
                <div style={{
                  position: 'absolute', top: 20, left: 24, zIndex: 10,
                  fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800,
                  color: 'var(--white)', textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                }}>
                  {viewMode === 'campus-3d' ? '🧊 3D Village Layout' : '🗺 Campus Map'}
                </div>

                <canvas
                  ref={campusCanvasRef}
                  className="layout-canvas"
                  width={1200}
                  height={800}
                  style={{
                    width: '100%', height: '100%',
                    cursor: isPanning.current ? 'grabbing' : spaceHeld.current ? 'grab' : campusDragId ? 'grabbing' : 'default',
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
                      e.preventDefault(); isPanning.current = true;
                      panStart.current = { x: e.clientX - panX, y: e.clientY - panY }; return;
                    }
                    const rect = campusCanvasRef.current!.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) / zoom - panX / zoom;
                    const my = (e.clientY - rect.top) / zoom - panY / zoom;
                    let tx = mx, ty = my;
                    if (viewMode === 'campus-3d') {
                      tx = my + mx / 1.732;
                      ty = my - mx / 1.732;
                    }
                    const siteBuildings = currentBuildings.filter(b => !currentSiteId || b.site_id === currentSiteId);
                    let clicked: Building | null = null;
                    // For 3D, reverse order is naturally back-to-front, so we check front-to-back by iterating normally if sorted
                    const hitCheckList = viewMode === 'campus-3d' 
                      ? [...siteBuildings].sort((a, b) => (b.x_position + b.y_position) - (a.x_position + a.y_position))
                      : [...siteBuildings].reverse();

                    for (const b of hitCheckList) {
                      if (tx >= b.x_position && tx <= b.x_position + b.map_width && ty >= b.y_position && ty <= b.y_position + b.map_height) { clicked = b; break; }
                    }
                    if (clicked) {
                      setCampusDragId(clicked.id); setCampusSelectedId(clicked.id);
                      campusDragOffset.current = { x: tx - clicked.x_position, y: ty - clicked.y_position };
                    } else { setCampusSelectedId(null); }
                  }}
                  onMouseMove={(e) => {
                    if (isPanning.current) { setPanX(e.clientX - panStart.current.x); setPanY(e.clientY - panStart.current.y); return; }
                    if (campusDragId === null) return;
                    const rect = campusCanvasRef.current!.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) / zoom - panX / zoom;
                    const my = (e.clientY - rect.top) / zoom - panY / zoom;
                    let tx = mx, ty = my;
                    if (viewMode === 'campus-3d') {
                      tx = my + mx / 1.732;
                      ty = my - mx / 1.732;
                    }
                    setBuildings(currentBuildings.map(b =>
                      b.id === campusDragId ? { ...b, x_position: Math.round(tx - campusDragOffset.current.x), y_position: Math.round(ty - campusDragOffset.current.y) } : b
                    ));
                  }}
                  onMouseUp={async () => {
                    if (isPanning.current) { isPanning.current = false; return; }
                    if (campusDragId !== null && !isDemo && token) {
                      const bld = currentBuildings.find(b => b.id === campusDragId);
                      if (bld) { try { await api.updateBuilding(token, campusDragId, { x_position: bld.x_position, y_position: bld.y_position }); } catch {} }
                    }
                    setCampusDragId(null);
                  }}
                  onDoubleClick={(e) => {
                    const rect = campusCanvasRef.current!.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) / zoom - panX / zoom;
                    const my = (e.clientY - rect.top) / zoom - panY / zoom;
                    let tx = mx, ty = my;
                    if (viewMode === 'campus-3d') {
                      tx = my + mx / 1.732;
                      ty = my - mx / 1.732;
                    }
                    for (const b of currentBuildings.filter(b => !currentSiteId || b.site_id === currentSiteId)) {
                      if (tx >= b.x_position && tx <= b.x_position + b.map_width && ty >= b.y_position && ty <= b.y_position + b.map_height) {
                        setActiveBuilding(b.id); setViewMode('floor'); setZoom(1); setPanX(0); setPanY(0); return;
                      }
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  onAuxClick={(e) => e.preventDefault()}
                />

                {campusSelectedId && (() => {
                  const sel = currentBuildings.find(b => b.id === campusSelectedId);
                  if (!sel) return null;
                  return (
                    <div style={{
                      position: 'absolute', top: 56, left: 24, zIndex: 10,
                      background: 'rgba(15,15,20,0.85)', backdropFilter: 'blur(12px)',
                      border: '1px solid var(--cyan-shadow)', borderRadius: 'var(--radius-lg)',
                      padding: '12px 16px', minWidth: 200, fontFamily: 'Outfit, sans-serif',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)', marginBottom: 4 }}>{sel.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {sel.building_type} • {sel.floors.length} floor{sel.floors.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                        <span>X: {sel.x_position}</span><span>Y: {sel.y_position}</span>
                        <span>{sel.map_width}×{sel.map_height}</span>
                      </div>
                      {currentBuildings.filter(b => b.id !== campusSelectedId && (!currentSiteId || b.site_id === currentSiteId)).map(other => {
                        const dx = (other.x_position + other.map_width / 2) - (sel.x_position + sel.map_width / 2);
                        const dy = (other.y_position + other.map_height / 2) - (sel.y_position + sel.map_height / 2);
                        const distPx = Math.sqrt(dx * dx + dy * dy);
                        const distUnit = (distPx / pxPerFoot) * (measureUnit === 'm' ? 0.3048 : 1);
                        return (
                          <div key={other.id} style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 4 }}>
                            ↔ {other.name}: <span style={{ color: 'var(--cyan)' }}>{distUnit.toFixed(1)} {measureUnit}</span>
                          </div>
                        );
                      })}
                      <button className="btn btn-primary btn-sm"
                        style={{ marginTop: 8, width: '100%', fontSize: 11, borderRadius: 100 }}
                        onClick={() => { setActiveBuilding(sel.id); setViewMode('floor'); setZoom(1); setPanX(0); setPanY(0); }}
                      >Open Floor View →</button>
                    </div>
                  );
                })()}

                <div style={{
                  position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 9, fontSize: 10, color: 'var(--text-ghost)', fontFamily: 'Outfit, sans-serif',
                  pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>
                  Drag buildings to reposition • Double-click to enter • Scroll to zoom • Space+drag to pan
                </div>

                <div style={{
                  position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: 8, zIndex: 10, alignItems: 'center',
                  background: 'rgba(15,15,20,0.8)', backdropFilter: 'blur(12px)',
                  border: '1px solid var(--border)', borderRadius: '100px',
                  padding: '6px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}>
                  <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.15, z - 0.1))}><ZoomOut size={16} /></button>
                  <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', width: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                  <button className="icon-btn" onClick={() => setZoom(z => Math.min(5, z + 0.1))}><ZoomIn size={16} /></button>
                  <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
                  <button className="icon-btn" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}><Maximize2 size={16} /></button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="layout-sidebar-right card" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div className="card-header" style={{ padding: '16px' }}>
            <div className="card-title">Properties</div>
          </div>

          {/* ──── Wall Properties ──── */}
          {selectedWallData ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)' }}>
                <Ruler size={14} style={{ color: 'var(--amber)' }} />
                <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 12, color: 'var(--amber)', letterSpacing: '0.06em' }}>WALL SEGMENT</span>
              </div>
              <div className="form-group">
                <label className="form-label">Label</label>
                <input className="form-input" value={selectedWallData.label}
                  onChange={(e) => {
                    setWalls(prev => prev.map(w => w.id === selectedWall ? { ...w, label: e.target.value } : w));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Length ({measureUnit === 'ft' ? 'feet' : 'meters'})</label>
                <div className="dimension-input-row">
                  <input
                    type="number" step="0.1" min="0" className="form-input"
                    value={parseFloat(pxToUnit(getWallLengthPx(selectedWallData), pxPerFoot, measureUnit).toFixed(2))}
                    onChange={(e) => {
                      const newLenUnit = parseFloat(e.target.value) || 0;
                      const newLenPx = unitToPx(newLenUnit, pxPerFoot, measureUnit);
                      const currentLen = getWallLengthPx(selectedWallData);
                      if (currentLen < 1) return;
                      const scale = newLenPx / currentLen;
                      const dx = selectedWallData.endX - selectedWallData.startX;
                      const dy = selectedWallData.endY - selectedWallData.startY;
                      setWalls(prev => prev.map(w => w.id === selectedWall ? {
                        ...w,
                        endX: w.startX + dx * scale,
                        endY: w.startY + dy * scale,
                      } : w));
                      setIsDirty(true);
                    }}
                  />
                  <div className="unit-selector">
                    <button className={measureUnit === 'ft' ? 'active' : ''} onClick={() => setMeasureUnit('ft')}>FT</button>
                    <button className={measureUnit === 'm' ? 'active' : ''} onClick={() => setMeasureUnit('m')}>M</button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Angle (degrees)</label>
                <input
                  type="number" step="0.5" min="0" max="360" className="form-input"
                  value={parseFloat(getWallAngleDeg(selectedWallData).toFixed(1))}
                  onChange={(e) => {
                    const newAngleDeg = parseFloat(e.target.value) || 0;
                    const newAngleRad = (newAngleDeg * Math.PI) / 180;
                    const len = getWallLengthPx(selectedWallData);
                    setWalls(prev => prev.map(w => w.id === selectedWall ? {
                      ...w,
                      endX: w.startX + Math.cos(newAngleRad) * len,
                      endY: w.startY + Math.sin(newAngleRad) * len,
                    } : w));
                    setIsDirty(true);
                  }}
                />
                <input
                  type="range" min="0" max="360" step="0.5"
                  value={getWallAngleDeg(selectedWallData)}
                  style={{ width: '100%', accentColor: 'var(--amber)', marginTop: 4 }}
                  onChange={(e) => {
                    const newAngleDeg = parseFloat(e.target.value);
                    const newAngleRad = (newAngleDeg * Math.PI) / 180;
                    const len = getWallLengthPx(selectedWallData);
                    setWalls(prev => prev.map(w => w.id === selectedWall ? {
                      ...w,
                      endX: w.startX + Math.cos(newAngleRad) * len,
                      endY: w.startY + Math.sin(newAngleRad) * len,
                    } : w));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Thickness</label>
                <input
                  type="range" min="2" max="20" value={selectedWallData.thickness}
                  style={{ width: '100%', accentColor: 'var(--amber)' }}
                  onChange={(e) => {
                    setWalls(prev => prev.map(w => w.id === selectedWall ? { ...w, thickness: +e.target.value } : w));
                    setIsDirty(true);
                  }}
                />
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--amber)', textAlign: 'right' }}>
                  {selectedWallData.thickness}px
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" className="form-input" style={{ height: 34, padding: '2px 6px' }} value={selectedWallData.color}
                  onChange={(e) => {
                    setWalls(prev => prev.map(w => w.id === selectedWall ? { ...w, color: e.target.value } : w));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>Start</span>
                <span style={{ color: 'var(--amber)' }}>{Math.round(selectedWallData.startX)}, {Math.round(selectedWallData.startY)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>End</span>
                <span style={{ color: 'var(--amber)' }}>{Math.round(selectedWallData.endX)}, {Math.round(selectedWallData.endY)}</span>
              </div>
              <button className="btn btn-ghost" style={{ color: 'var(--red)', marginTop: 4 }} onClick={() => {
                setWalls(prev => prev.filter(w => w.id !== selectedWall));
                setSelectedWall(null);
                setIsDirty(true);
                addToast('Wall removed', 'info');
              }}>
                <Trash2 size={14} /> Remove Wall
              </button>
            </div>

          /* ──── Arch Element Properties ──── */
          ) : selectedArchData ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 'var(--radius-sm)' }}>
                <Move size={14} style={{ color: 'var(--cyan)' }} />
                <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 12, color: 'var(--cyan)', letterSpacing: '0.06em' }}>{selectedArchData.type.replace('_', ' ')}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Label</label>
                <input className="form-input" value={selectedArchData.label}
                  onChange={(e) => {
                    setArchElements(prev => prev.map(el => el.id === selectedArch ? { ...el, label: e.target.value } : el));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Width ({measureUnit === 'ft' ? 'feet' : 'meters'})</label>
                <div className="dimension-input-row">
                  <input
                    type="number" step="0.1" min="0.5" className="form-input"
                    value={parseFloat(pxToUnit(selectedArchData.width, pxPerFoot, measureUnit).toFixed(2))}
                    onChange={(e) => {
                      const newWidthUnit = parseFloat(e.target.value) || 1;
                      const newWidthPx = unitToPx(newWidthUnit, pxPerFoot, measureUnit);
                      setArchElements(prev => prev.map(el => el.id === selectedArch ? { ...el, width: Math.max(10, newWidthPx) } : el));
                      setIsDirty(true);
                    }}
                  />
                  <div className="unit-selector">
                    <button className={measureUnit === 'ft' ? 'active' : ''} onClick={() => setMeasureUnit('ft')}>FT</button>
                    <button className={measureUnit === 'm' ? 'active' : ''} onClick={() => setMeasureUnit('m')}>M</button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Rotation</label>
                <input
                  type="range" min="0" max="359" value={selectedArchData.rotation}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                  onChange={(e) => {
                    setArchElements(prev => prev.map(el => el.id === selectedArch ? { ...el, rotation: +e.target.value } : el));
                    setIsDirty(true);
                  }}
                />
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--cyan)', textAlign: 'right' }}>
                  {selectedArchData.rotation}°
                </div>
              </div>
              {(selectedArchData.type === 'DOOR' || selectedArchData.type === 'DOUBLE_DOOR') && (
                <div className="form-group">
                  <label className="form-label">Open Direction</label>
                  <select className="form-select" value={selectedArchData.openDirection || 'RIGHT'}
                    onChange={(e) => {
                      setArchElements(prev => prev.map(el => el.id === selectedArch ? { ...el, openDirection: e.target.value as 'LEFT' | 'RIGHT' } : el));
                      setIsDirty(true);
                    }}
                  >
                    <option value="LEFT">Left</option>
                    <option value="RIGHT">Right</option>
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>Position</span>
                <span style={{ color: 'var(--cyan)' }}>{Math.round(selectedArchData.x)}, {Math.round(selectedArchData.y)}</span>
              </div>
              <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => {
                setArchElements(prev => prev.filter(el => el.id !== selectedArch));
                setSelectedArch(null);
                setIsDirty(true);
                addToast('Element removed', 'info');
              }}>
                <Trash2 size={14} /> Remove Element
              </button>
            </div>

          /* ──── Camera Properties (existing) ──── */
          ) : selectedCamData ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Camera Name</label>
                <input className="form-input" value={selectedCamData.name}
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, name: e.target.value } : c
                    ));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">RTSP Stream URL</label>
                <input className="form-input" value={selectedCamData.rtsp_url || ''} placeholder="rtsp://..."
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, rtsp_url: e.target.value } : c
                    ));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location Description</label>
                <input className="form-input" value={selectedCamData.location || ''} placeholder="e.g. Terminal Gate"
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, location: e.target.value } : c
                    ));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={selectedCamData.status}
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, status: e.target.value as any } : c
                    ));
                    setIsDirty(true);
                  }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mounting Type</label>
                <select className="form-select" value={selectedCamData.is_overhead ? 'overhead' : 'wall'}
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, is_overhead: e.target.value === 'overhead' } : c
                    ));
                    setIsDirty(true);
                  }}
                >
                  <option value="overhead">Overhead (Ceiling)</option>
                  <option value="wall">Wall-Mounted</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rotation Angle</label>
                <input type="range" min="0" max="359" value={selectedCamData.angle}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, angle: +e.target.value } : c
                    ));
                    setIsDirty(true);
                  }}
                />
                <div style={{ fontSize: 12, fontFamily: 'Outfit, sans-serif', color: 'var(--cyan)', textAlign: 'right', marginTop: 4 }}>
                  {selectedCamData.angle}°
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Field of View (FOV)</label>
                <input type="range" min="15" max="180" value={selectedCamData.fov}
                  style={{ width: '100%', accentColor: 'var(--magenta)' }}
                  onChange={(e) => {
                    setPlacedCams((prev) => prev.map((c) =>
                      c.id === selectedCam ? { ...c, fov: +e.target.value } : c
                    ));
                    setIsDirty(true);
                  }}
                />
                <div style={{ fontSize: 12, fontFamily: 'Outfit, sans-serif', color: 'var(--magenta)', textAlign: 'right', marginTop: 4 }}>
                  {selectedCamData.fov}°
                </div>
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
                setIsDirty(true);
                addToast('Camera removed', 'info');
              }}>
                <Trash2 size={14} /> Remove Camera
              </button>
            </div>

          /* ──── Zone Properties (existing) ──── */
          ) : selectedZoneData ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Zone Name</label>
                <input className="form-input" value={selectedZoneData.name}
                  onChange={(e) => {
                    setDrawnZones((prev) => prev.map((z) =>
                      z.id === selectedZone ? { ...z, name: e.target.value } : z
                    ));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Zone Type</label>
                <select className="form-select" value={selectedZoneData.type}
                  onChange={(e) => {
                    setDrawnZones((prev) => prev.map((z) => {
                      if (z.id === selectedZone) {
                        const type = e.target.value as any;
                        return { ...z, type, color: ZONE_COLORS[type] || z.color };
                      }
                      return z;
                    }));
                    setIsDirty(true);
                  }}
                >
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="DWELL">DWELL</option>
                  <option value="TRIPWIRE">TRIPWIRE</option>
                  <option value="LOUNGE">LOUNGE</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Zone Color</label>
                <input type="color" className="form-input" style={{ height: 38, padding: '2px 6px' }} value={selectedZoneData.color}
                  onChange={(e) => {
                    setDrawnZones((prev) => prev.map((z) =>
                      z.id === selectedZone ? { ...z, color: e.target.value } : z
                    ));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dwell Alert Threshold (seconds)</label>
                <input type="number" min="0" className="form-input" value={selectedZoneData.dwell_alert_seconds ?? 300}
                  onChange={(e) => {
                    setDrawnZones((prev) => prev.map((z) =>
                      z.id === selectedZone ? { ...z, dwell_alert_seconds: +e.target.value } : z
                    ));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedZoneData.is_active !== false}
                    onChange={(e) => {
                      setDrawnZones((prev) => prev.map((z) =>
                        z.id === selectedZone ? { ...z, is_active: e.target.checked } : z
                      ));
                      setIsDirty(true);
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>Active</span>
                </label>
              </div>
              <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => {
                setDrawnZones((prev) => prev.filter((z) => z.id !== selectedZone));
                setSelectedZone(null);
                setIsDirty(true);
                addToast('Zone removed', 'info');
              }}>
                <Trash2 size={14} /> Remove Zone
              </button>
            </div>

          /* ──── Default Instructions ──── */
          ) : (
            <div className="empty-state" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyan)', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <Info size={16} />
                <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>HOW TO USE</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>1</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Use <strong>Draw Wall</strong> to create walls. Click start → click end. Edit length and angle in Properties.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>2</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Drag <strong>Doors, Windows, Columns</strong> from Architecture Tools onto the plan.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>3</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Drag <strong>Cameras</strong> and use <strong>Zone Tools</strong> to draw security perimeters. Double-click to finish.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--white)', flexShrink: 0 }}>4</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Switch between <strong>FT</strong> and <strong>M</strong> units in Scale & Units. Set the px/ft scale for accurate measurements.
                </div>
              </div>
            </div>
          )}

          {/* Walls & Elements list */}
          {(walls.length > 0 || archElements.length > 0) && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Walls ({walls.length}) · Elements ({archElements.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {walls.map(w => (
                  <div key={w.id} className="wall-list-item" style={{ cursor: 'pointer', ...(selectedWall === w.id ? { borderColor: 'var(--amber)' } : {}) }}
                    onClick={() => { clearSelections(); setSelectedWall(w.id); }}
                  >
                    <div className="wall-icon" style={{ color: 'var(--amber)' }}>━</div>
                    <div className="wall-info">
                      <div className="wall-name">{w.label}</div>
                      <div className="wall-meta">{formatLength(getWallLengthPx(w), pxPerFoot, measureUnit)} · {getWallAngleDeg(w).toFixed(0)}°</div>
                    </div>
                    <button className="icon-btn" style={{ width: 24, height: 24, color: 'var(--text-muted)' }}
                      onClick={(e) => { e.stopPropagation(); setWalls(prev => prev.filter(ww => ww.id !== w.id)); if (selectedWall === w.id) setSelectedWall(null); setIsDirty(true); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {archElements.map(el => (
                  <div key={el.id} className="wall-list-item" style={{ cursor: 'pointer', ...(selectedArch === el.id ? { borderColor: 'var(--cyan)' } : {}) }}
                    onClick={() => { clearSelections(); setSelectedArch(el.id); }}
                  >
                    <div className="wall-icon" style={{ color: 'var(--cyan)', fontSize: 11 }}>
                      {ARCH_ELEMENT_TYPES.find(t => t.type === el.type)?.icon || '◻'}
                    </div>
                    <div className="wall-info">
                      <div className="wall-name">{el.label}</div>
                      <div className="wall-meta">{el.type.replace('_', ' ')} · {el.rotation}°</div>
                    </div>
                    <button className="icon-btn" style={{ width: 24, height: 24, color: 'var(--text-muted)' }}
                      onClick={(e) => { e.stopPropagation(); setArchElements(prev => prev.filter(ee => ee.id !== el.id)); if (selectedArch === el.id) setSelectedArch(null); setIsDirty(true); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
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
                    onClick={() => {
                      setDrawnZones((prev) => prev.filter((zz) => zz.id !== z.id));
                      if (selectedZone === z.id) setSelectedZone(null);
                      setIsDirty(true);
                      addToast('Zone removed', 'info');
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid var(--border)', background: 'var(--surface-1)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Walls</span>
              <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--amber)' }}>{walls.length} DRAWN</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Elements</span>
              <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>{archElements.length} PLACED</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
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
      {selectedTrackId && (
        <PersonJourney
          globalId={selectedTrackId}
          onClose={() => setSelectedTrackId(null)}
        />
      )}

      {/* Double click Popup Live Video Player Modal */}
      {doubleClickedCam !== null && (() => {
        const cam = placedCams.find(c => c.id === doubleClickedCam);
        if (!cam) return null;
        return (
          <div className="modal-backdrop" onClick={() => setDoubleClickedCam(null)}>
            <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">Live Feed: {cam.name}</span>
                <button className="icon-btn" onClick={() => setDoubleClickedCam(null)}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ padding: 0 }}>
                <div style={{ width: '100%', height: 360, background: '#000', position: 'relative', overflow: 'hidden' }}>
                  {/* Scan line effect */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />
                  <div style={{
                    position: 'absolute', top: 12, left: 16, zIndex: 3,
                    background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'monospace'
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cam.status === 'ACTIVE' ? 'var(--green-bright)' : 'var(--red)', display: 'inline-block' }} />
                    {cam.status === 'ACTIVE' ? 'LIVE' : cam.status}
                  </div>
                  <div style={{
                    position: 'absolute', top: 12, right: 16, zIndex: 3,
                    background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4,
                    fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)',
                    maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {cam.rtsp_url}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 8 }}>
                    <Camera size={48} color="rgba(0, 240, 255, 0.3)" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>RTSP Stream Connection Initializing...</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cam.location || 'No location set'}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '12px 16px' }}>
                <button className="btn btn-secondary" onClick={() => setDoubleClickedCam(null)}>Close Stream</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
