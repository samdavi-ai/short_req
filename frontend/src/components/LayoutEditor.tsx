import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera, Trash2, Plus, Save, RotateCcw, ZoomIn, ZoomOut, MapPin,
  Info, X, Ruler, Move, Maximize2
} from 'lucide-react';
import { useStore, type Building, type FloorDef, type Site } from '../stores/appStore';
import { api } from '../hooks/api';
import PersonJourney from './PersonJourney';
import FloorScene3D from './layout3d/FloorScene3D';
import {
  clampToFloorBounds as clampToFloorBoundsShared,
  distToSegment as distToSegmentShared,
  fitLayoutTemplateToBounds as fitLayoutTemplateToBoundsShared,
  formatLength as formatLengthShared,
  getFloorBounds as getFloorBoundsShared,
  getWallAngleDeg as getWallAngleDegShared,
  getWallLengthPx as getWallLengthPxShared,
  isPointInPolygon as isPointInPolygonShared,
  pxToUnit as pxToUnitShared,
  snapAngle as snapAngleShared,
  unitToPx as unitToPxShared,
} from '../features/layout-engine/geometry';
import {
  drawArchElement as drawArchElementShared,
  drawWallOnCanvas as drawWallOnCanvasShared,
} from '../features/layout-engine/render2d';
import { getCanvasPosFromClient as getCanvasPosFromClientShared } from '../features/layout-engine/viewport';
import type { FloorBounds } from '../features/layout-engine/types';
import { useSimulatorStore } from '../stores/simulatorStore';
import { tickSimulation } from '../features/simulator/engine';
// Pixel-accurate blueprints traced from the real CAD floor plan images
import {
  GF_WALLS_ACCURATE, GF_ARCH_ACCURATE, GF_ZONES_ACCURATE, GF_CAMERAS_DEFAULT,
  AA_WALLS_ACCURATE, AA_ARCH_ACCURATE, AA_ZONES_ACCURATE, AA_CAMERAS_DEFAULT,
  FF_WALLS_ACCURATE, FF_ARCH_ACCURATE, FF_ZONES_ACCURATE, FF_CAMERAS_DEFAULT,
} from '../features/layout-engine/templates/accurateBlueprintData';
import type { AgentBehavior, SimulatorAgent } from '../features/simulator/types';
import SimulatorHUD, { KEMPEGOWDA_CAMERAS } from './SimulatorHUD';
import {
  ALPHA2_FIRST_WALLS_DXF,
  ALPHA2_FIRST_LABELS_DXF,
  ALPHA2_GROUND_WALLS_DXF,
  ALPHA2_GROUND_LABELS_DXF,
} from '../features/layout-engine/templates/alpha2DxfTemplates';

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

type ArchElementType = 'DOOR' | 'DOUBLE_DOOR' | 'WINDOW' | 'COLUMN' | 'STAIRS' | 'ELEVATOR' | 'ACCESS_DOOR';


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

const FLOOR_BLUEPRINT_IMAGES: Record<number, string> = {
  // Re-mapped to floor plan image set for better DXF/image consistency.
  0: '/floorplans/alpha2-1.png',
  1: '/floorplans/alpha2-2.png',
  2: '/floorplans/alpha2-3.png',
};

type BlueprintCropRect = { x: number; y: number; w: number; h: number };
const FLOOR_BLUEPRINT_CROP: Record<number, BlueprintCropRect> = {
  // Crop tuned per floor to trim title block / whitespace and fill canvas tightly.
  // Ground Floor (page-1): title at top, plan area below
  0: { x: 0.01, y: 0.08, w: 0.98, h: 0.80 },
  // Area A (page-2): very little top margin, wide plan
  1: { x: 0.01, y: 0.06, w: 0.98, h: 0.84 },
  // First Floor (page-3): large title at top, plan lower
  2: { x: 0.01, y: 0.12, w: 0.98, h: 0.78 },
};

// ── BIAL Alpha-2 Building — Kempegowda International Airport, Bangalore ──────
// Based on actual floor plans: Ground Floor Alpha-2, Area A (Intermediate), First Floor Alpha-2
// Building dimensions: 41 m wide × 25 m deep  |  Canvas scale: ~25 px/m
const DEMO_SITES: Site[] = [
  { id: -1, name: 'Kempegowda International Airport', address: 'Alpha-2 ATS Complex, Devanahalli, Bengaluru — BIAL', latitude: 13.1986, longitude: 77.7066, is_active: true, created_at: '' },
];

const DEMO_BUILDINGS: Building[] = [
  {
    id: -1, site_id: -1, name: 'Alpha-2 — ATS Complex', building_type: 'INDOOR', is_active: true, created_at: '',
    x_position: 80, y_position: 60, map_width: 820, map_height: 500,
    floors: [
      { id: -1, building_id: -1, level: 0, label: 'Ground Floor',          sort_order: 0, created_at: '' },
      { id: -2, building_id: -1, level: 1, label: 'Area A (Intermediate)', sort_order: 1, created_at: '' },
      { id: -3, building_id: -1, level: 2, label: 'First Floor',           sort_order: 2, created_at: '' },
    ],
  },
];

// ── Alpha-2 Area A (Intermediate Floor) Cameras ──────────────────────────────
// CMS Room, CHS Executives, Radio Interface, Automation Servers, Cyber TAC, etc.
const ALPHA2_AREA_A_CAMERAS = [
  { id: 9101, name: 'CAM-AA-01 · CMS Room A',          location: 'CMS Room — Server Rack A',            x:  90, y: 310, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9102, name: 'CAM-AA-02 · CMS Room B',          location: 'CMS Room — Server Rack B',            x: 330, y: 480, angle: 225, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9103, name: 'CAM-AA-03 · Commercial Entry',    location: 'Commercial Zone — Entry',             x:  90, y:  90, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9104, name: 'CAM-AA-04 · CHS Exec Corridor',   location: 'CHS Executive Room — Corridor',       x: 630, y:  90, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9105, name: 'CAM-AA-05 · CHS Exec Interior',   location: 'CHS Executive — Interior',            x: 850, y: 290, angle: 225, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9106, name: 'CAM-AA-06 · Radio Interface',     location: 'Radio/ACO Interface Room',            x: 350, y: 310, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9107, name: 'CAM-AA-07 · Automation Svr W',    location: 'Automation Server Room (AMS) — West', x:  90, y: 710, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9108, name: 'CAM-AA-08 · Automation Svr E',    location: 'Automation Server Room (AMS) — East', x: 580, y: 710, angle: 315, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9109, name: 'CAM-AA-09 · Cyber Security TAC',  location: 'Cyber Security & AMS TAC Room',       x: 260, y: 500, angle:  90, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9110, name: 'CAM-AA-10 · UHF/VCS Room',        location: 'UHF/VCS/Data/GTR Room',               x: 580, y: 500, angle:  90, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9111, name: 'CAM-AA-11 · Battery Room',        location: 'UPS Battery Room (Area A)',           x: 730, y: 710, angle: 315, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9112, name: 'CAM-AA-12 · Fallback Servers',    location: 'Fallback Servers Room',               x: 1110, y: 710, angle: 135, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
];

// ── Alpha-2 First Floor Cameras ──────────────────────────────────────────────
// Aligned with the symmetric 11-room grid
const ALPHA2_FF_CAMERAS = [
  { id: 9201, name: 'CAM-FF-01 · Security NW',      location: 'Security Check Area — Northwest Corner', x: 240, y: 240, angle: 45,  fov: 110, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9202, name: 'CAM-FF-02 · Corridor West',     location: 'Central Corridor — West End',          x: 240, y: 400, angle: 0,   fov: 100, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9203, name: 'CAM-FF-03 · Telecom SW',        location: 'STM Telecom Room — Southwest Corner',   x: 240, y: 560, angle: 315, fov: 110, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9204, name: 'CAM-FF-04 · Recreation NE',     location: 'Recreation Room — Northeast Corner',    x: 816, y: 240, angle: 135, fov: 110, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9205, name: 'CAM-FF-05 · Corridor East',     location: 'Central Corridor — East End',          x: 960, y: 400, angle: 180, fov: 100, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9206, name: 'CAM-FF-06 · APP SE',            location: 'APP Room — Southeast Corner',           x: 960, y: 560, angle: 225, fov: 110, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9207, name: 'CAM-FF-07 · Training Center',   location: 'Training Area — Center Desk',          x: 456, y: 240, angle: 90,  fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9208, name: 'CAM-FF-08 · Control Desk',      location: 'Control Office — Console Area',        x: 600, y: 240, angle: 90,  fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9209, name: 'CAM-FF-09 · Utility Room',      location: 'Utility Room — Main Rack',             x: 888, y: 240, angle: 90,  fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9210, name: 'CAM-FF-10 · ACC Bay 1-2',       location: 'ACC Rooms — Bay 1 & 2 Corridor',       x: 420, y: 560, angle: 270, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9211, name: 'CAM-FF-11 · ACC Bay 3-4',       location: 'ACC Rooms — Bay 3 & 4 Corridor',       x: 660, y: 560, angle: 270, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9212, name: 'CAM-FF-12 · ACC WSO Desk',      location: 'ACC Room — Bay 4 (WSO) Interior',       x: 780, y: 560, angle: 270, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
];

const WALL_COLOR = '#111111';

type DxfLabel = { text: string; x: number; y: number; height: number };
type Extents = { minX: number; minY: number; maxX: number; maxY: number };

const getWallExtents = (
  wallSet: readonly { startX: number; startY: number; endX: number; endY: number }[],
): Extents => {
  const xs: number[] = [];
  const ys: number[] = [];
  wallSet.forEach((wall) => {
    xs.push(wall.startX, wall.endX);
    ys.push(wall.startY, wall.endY);
  });
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

const mapDxfLabelsToFittedWalls = (
  rawWalls: readonly { startX: number; startY: number; endX: number; endY: number }[],
  fittedWalls: readonly WallSegment[],
  labels: readonly DxfLabel[],
): DxfLabel[] => {
  if (!rawWalls.length || !fittedWalls.length || !labels.length) return [];
  const raw = getWallExtents(rawWalls);
  const fitted = getWallExtents(fittedWalls);
  const rawW = Math.max(1, raw.maxX - raw.minX);
  const rawH = Math.max(1, raw.maxY - raw.minY);
  const fitW = Math.max(1, fitted.maxX - fitted.minX);
  const fitH = Math.max(1, fitted.maxY - fitted.minY);
  const sx = fitW / rawW;
  const sy = fitH / rawH;
  const scale = Math.min(sx, sy);

  // DXF uses Y-up (origin at bottom-left), canvas uses Y-down (origin at top-left).
  // We must invert the Y axis so labels appear in the correct position on screen.
  return labels.map((label) => ({
    text: label.text,
    x: fitted.minX + (label.x - raw.minX) * sx,
    y: fitted.minY + (raw.maxY - label.y) * sy,
    height: Math.max(9, label.height * scale * 0.08),
  }));
};

const ARCH_ELEMENT_TYPES: { type: ArchElementType; label: string; icon: string }[] = [
  { type: 'DOOR',        label: 'Single Door',  icon: '🚪' },
  { type: 'DOUBLE_DOOR', label: 'Double Door',  icon: '🚪' },
  { type: 'WINDOW',      label: 'Window',       icon: '🪟' },
  { type: 'COLUMN',      label: 'Column',       icon: '◼' },
  { type: 'STAIRS',      label: 'Stairs',       icon: '📐' },
  { type: 'ELEVATOR',    label: 'Elevator',     icon: '⬆' },
  { type: 'ACCESS_DOOR',  label: 'Access Door',  icon: '🟢' },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

const isPointInPolygon = isPointInPolygonShared;
const getWallLengthPx = getWallLengthPxShared;
const getWallAngleDeg = getWallAngleDegShared;
const pxToUnit = pxToUnitShared;
const unitToPx = unitToPxShared;
const formatLength = formatLengthShared;
const snapAngle = snapAngleShared;
const distToSegment = distToSegmentShared;
const drawWallOnCanvas = drawWallOnCanvasShared;
const drawArchElement = drawArchElementShared;

const CAMERA_RANGE = 100;

interface SurveillanceStreamProps {
  cameraId: number;
  cameraName: string;
  location: string;
  width?: number;
  height?: number;
}

export function SurveillanceCCTVStream({ cameraId, cameraName, location, width = 640, height = 360 }: SurveillanceStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frameCount = 0;

    const targets = [
      { id: Math.floor(Math.random() * 50) + 10, x: 50 + Math.random() * 50, y: 50 + Math.random() * 50, vx: 1.0 + Math.random() * 0.5, vy: 0.8 + Math.random() * 0.5, w: 40, h: 90, name: 'PERSON', conf: 0.95 + Math.random() * 0.04 },
      { id: Math.floor(Math.random() * 50) + 60, x: 180 + Math.random() * 50, y: 70 + Math.random() * 50, vx: -0.8 - Math.random() * 0.5, vy: 1.0 + Math.random() * 0.5, w: 45, h: 95, name: 'PERSON', conf: 0.94 + Math.random() * 0.05 }
    ];

    const draw = () => {
      frameCount++;
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 4) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      for (let i = 0; i < 15; i++) {
        const nx = Math.random() * width;
        const ny = Math.random() * height;
        const nw = Math.random() * 60 + 10;
        ctx.fillRect(nx, ny, nw, 1);
      }

      targets.forEach(t => {
        t.x += t.vx;
        t.y += t.vy;
        if (t.x < 10 || t.x + t.w > width - 10) t.vx *= -1;
        if (t.y < 15 || t.y + t.h > height - 10) t.vy *= -1;

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(t.x, t.y, t.w, t.h);

        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.fillRect(t.x, t.y - 14, t.w, 14);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`ID:${t.id} ${Math.round(t.conf * 100)}%`, t.x + 2, t.y - 4);
      });

      const isRedBlink = Math.floor(frameCount / 30) % 2 === 0;
      ctx.fillStyle = isRedBlink ? '#ef4444' : 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath(); ctx.arc(20, 20, 5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('REC', 32, 24);

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.fillText(cameraName, 20, 42);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(location, 20, 56);

      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const dy = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mn = String(now.getMinutes()).padStart(2, '0');
      const sc = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`${yr}-${mo}-${dy} ${hr}:${mn}:${sc}.${ms}`, width - 20, 24);

      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(`CCTV_ANALYTICS_V2`, width - 20, height - 10);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const cx = width / 2;
      const cy = height / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
      ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [cameraId, cameraName, location, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LayoutEditor() {
  const { cameras, zones, token, addToast, setCameras, setZones,
          sites: storeSites, buildings: storeBuildings,
          activeSiteId, activeBuildingId,
          setSites, setBuildings, setActiveSite, setActiveBuilding } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const campusCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const blueprintImageCacheRef = useRef<Record<number, HTMLImageElement>>({});
  const [blueprintVersion, setBlueprintVersion] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
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
  const [viewMode, setViewMode] = useState<'floor' | 'floor-3d' | 'campus' | 'campus-3d'>('floor');
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
  const [isSaving, setIsSaving] = useState(false);

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
  const [showDimensions, setShowDimensions] = useState(false);
  const [showCoverageHeatmap, setShowCoverageHeatmap] = useState(false);
  const [showCameraLabels, setShowCameraLabels] = useState(false);
  const [showZoneLabels, setShowZoneLabels] = useState(false);
  const [showDxfLabels, setShowDxfLabels] = useState(true);
  const [showWallsLayer, setShowWallsLayer] = useState(true);
  const [showDoorsLayer, setShowDoorsLayer] = useState(true);
  const [showWindowsLayer, setShowWindowsLayer] = useState(true);
  const [showStairsLayer, setShowStairsLayer] = useState(true);
  const [showLiftsLayer, setShowLiftsLayer] = useState(true);
  const [showZonesLayer, setShowZonesLayer] = useState(true);
  const [showCamerasLayer, setShowCamerasLayer] = useState(true);
  const [showLiveHeatmap, setShowLiveHeatmap] = useState(false);
  const [showZoneOccupancy, setShowZoneOccupancy] = useState(false);
  const [liveHeatmap, setLiveHeatmap] = useState<Record<number, Record<string, number>>>({ 0: {}, 1: {}, 2: {} });
  const [liveTracksHistory, setLiveTracksHistory] = useState<Record<string, { x: number; y: number; floor: number; timestamp: number }[]>>({});
  // Default to programmatic blueprint (accurate walls from CAD trace).
  // Toggle to Plan Image for the raw CAD photo, or enable both for overlay.
  const [showPlanOverlay, setShowPlanOverlay] = useState(false);
  const [showStructureOverlay, setShowStructureOverlay] = useState(true);

  useEffect(() => {
    const src = FLOOR_BLUEPRINT_IMAGES[activeFloor];
    if (!src) return;
    if (blueprintImageCacheRef.current[activeFloor]?.src.endsWith(src)) return;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      blueprintImageCacheRef.current[activeFloor] = img;
      setBlueprintVersion((v) => v + 1);
    };
  }, [activeFloor]);



  const [hoveredCamId, setHoveredCamId] = useState<number | null>(null);

  const coveragePercentage = useMemo(() => {
    if (placedCams.length === 0) return 0;
    const activeCams = placedCams.filter(c => c.status !== 'OFFLINE');
    if (activeCams.length === 0) return 0;

    const bounds = getFloorBoundsShared(canvasSize.width, canvasSize.height);
    const startX = bounds.left;
    const endX = bounds.right;
    const startY = bounds.top;
    const endY = bounds.bottom;
    const step = Math.max(8, pxPerFoot);
    const stepX = step;
    const stepY = step;

    let totalPoints = 0;
    let coveredPoints = 0;

    const cams = activeCams.map(cam => {
      const angleRad = (cam.angle * Math.PI) / 180;
      const fovRad = (cam.fov * Math.PI) / 180;
      return {
        x: cam.x,
        y: cam.y,
        angle: angleRad,
        halfFov: fovRad / 2,
        rangeSq: CAMERA_RANGE * CAMERA_RANGE
      };
    });

    for (let x = startX + stepX / 2; x < endX; x += stepX) {
      for (let y = startY + stepY / 2; y < endY; y += stepY) {
        totalPoints++;
        let covered = false;

        for (let i = 0; i < cams.length; i++) {
          const c = cams[i];
          const dx = x - c.x;
          const dy = y - c.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= c.rangeSq) {
            let angleToPoint = Math.atan2(dy, dx);
            let diff = angleToPoint - c.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            if (Math.abs(diff) <= c.halfFov) {
              covered = true;
              break;
            }
          }
        }

        if (covered) {
          coveredPoints++;
        }
      }
    }

    return totalPoints > 0 ? (coveredPoints / totalPoints) * 100 : 0;
  }, [placedCams, canvasSize.width, canvasSize.height, pxPerFoot]);

  // Camera Drag State
  const [draggedCamId, setDraggedCamId] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Arch element drag state
  const [draggedArchId, setDraggedArchId] = useState<number | null>(null);

  // Wall endpoint drag state
  const [draggingWallEndpoint, setDraggingWallEndpoint] = useState<{ wallId: number; endpoint: 'start' | 'end' } | null>(null);
  const simulatorEnabled = useSimulatorStore((s) => s.enabled);
  const simulatorMode = useSimulatorStore((s) => s.mode);
  const simulatorRunning = useSimulatorStore((s) => s.running);
  const simulatorSeed = useSimulatorStore((s) => s.seed);
  const simulatorSpeed = useSimulatorStore((s) => s.speed);
  const simulatorTick = useSimulatorStore((s) => s.tick);
  const simulatorAgents = useSimulatorStore((s) => s.agents);
  const simulatorTimeline = useSimulatorStore((s) => s.timeline);
  const simulatorPointer = useSimulatorStore((s) => s.pointer);
  const setSimulatorMode = useSimulatorStore((s) => s.setMode);
  const setSimulatorEnabled = useSimulatorStore((s) => s.setEnabled);
  const setSimulatorRunning = useSimulatorStore((s) => s.setRunning);
  const setSimulatorSpeed = useSimulatorStore((s) => s.setSpeed);
  const setSimulatorTick = useSimulatorStore((s) => s.setTick);
  const setSimulatorAgents = useSimulatorStore((s) => s.setAgents);
  const pushSimulatorEvents = useSimulatorStore((s) => s.pushEvents);
  const setSimulatorPointer = useSimulatorStore((s) => s.setPointer);
  const resetSimulator = useSimulatorStore((s) => s.reset);
  const exportSimulatorSnapshot = useSimulatorStore((s) => s.exportSnapshot);
  const importSimulatorSnapshot = useSimulatorStore((s) => s.importSnapshot);

  const [spawnCount, setSpawnCount] = useState(3);
  const [spawnBehavior, setSpawnBehavior] = useState<AgentBehavior>('roam');
  const [simPushBackend, setSimPushBackend] = useState(false);
  const [simSessionId, setSimSessionId] = useState<string | null>(null);
  const isSimulatorActive = simulatorEnabled && simulatorMode === 'simulator';

  const getFloorBounds = useCallback((width: number, height: number): FloorBounds => {
    return getFloorBoundsShared(width, height);
  }, []);

  const fittedDxfLabels = useMemo<DxfLabel[]>(() => {
    // Level 0 = Ground Floor, Level 1 = Area A (no DXF source), Level 2 = First Floor
    if (activeFloor === 0) {
      return mapDxfLabelsToFittedWalls(ALPHA2_GROUND_WALLS_DXF, walls, ALPHA2_GROUND_LABELS_DXF);
    }
    if (activeFloor === 1) {
      // Area A has no DXF source — hand-coded walls only, no overlay labels
      return [];
    }
    // Level 2 = First Floor
    return mapDxfLabelsToFittedWalls(ALPHA2_FIRST_WALLS_DXF, walls, ALPHA2_FIRST_LABELS_DXF);
  }, [activeFloor, walls]);

  const clampToFloorBounds = useCallback((x: number, y: number, radius = 12) => {
    const b = getFloorBounds(canvasSize.width, canvasSize.height);
    return clampToFloorBoundsShared(x, y, b, radius);
  }, [canvasSize.height, canvasSize.width, getFloorBounds]);

  const optimizeCameraDirections = useCallback((
    cams: CamOnCanvas[],
    zonesInput: ZoneOnCanvas[],
    bounds: FloorBounds
  ): CamOnCanvas[] => {
    if (cams.length === 0) return cams;
    const zones = zonesInput.filter((z) => z.points.length >= 3 && z.is_active !== false);
    const zoneCentroid = (z: ZoneOnCanvas) => ({
      x: z.points.reduce((s, p) => s + p.x, 0) / z.points.length,
      y: z.points.reduce((s, p) => s + p.y, 0) / z.points.length,
    });
    const normalizeDeg = (d: number) => ((d % 360) + 360) % 360;
    const angleTo = (x1: number, y1: number, x2: number, y2: number) =>
      normalizeDeg((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI);

    const sampleStep = Math.max(8, pxPerFoot);
    const samples: { x: number; y: number }[] = [];
    for (let x = bounds.left + sampleStep / 2; x < bounds.right; x += sampleStep) {
      for (let y = bounds.top + sampleStep / 2; y < bounds.bottom; y += sampleStep) {
        samples.push({ x, y });
      }
    }
    const camCovers = (cam: CamOnCanvas, px: number, py: number) => {
      if (cam.status === 'OFFLINE') return false;
      const dx = px - cam.x;
      const dy = py - cam.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > CAMERA_RANGE * CAMERA_RANGE) return false;
      const angleToPoint = Math.atan2(dy, dx);
      let diff = angleToPoint - (cam.angle * Math.PI) / 180;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return Math.abs(diff) <= ((cam.fov * Math.PI) / 180) / 2;
    };

    const adjusted = cams.map((cam) => {
      const clamped = clampToFloorBoundsShared(cam.x, cam.y, bounds, 14);
      return { ...cam, x: clamped.x, y: clamped.y };
    });

    for (let i = 0; i < adjusted.length; i++) {
      const cam = adjusted[i];
      if (cam.status === 'OFFLINE') continue;
      const containing = zones.find((z) => isPointInPolygonShared({ x: cam.x, y: cam.y }, z.points));
      let target = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
      if (containing) {
        target = zoneCentroid(containing);
      } else if (zones.length > 0) {
        const nearest = [...zones].sort((a, b) => {
          const ca = zoneCentroid(a);
          const cb = zoneCentroid(b);
          return ((ca.x - cam.x) ** 2 + (ca.y - cam.y) ** 2) - ((cb.x - cam.x) ** 2 + (cb.y - cam.y) ** 2);
        })[0];
        target = zoneCentroid(nearest);
      }

      const base = angleTo(cam.x, cam.y, target.x, target.y);
      const candidateAngles = Array.from(new Set([
        normalizeDeg(cam.angle),
        base,
        normalizeDeg(base - 25),
        normalizeDeg(base + 25),
        normalizeDeg(base - 50),
        normalizeDeg(base + 50),
        normalizeDeg(base - 75),
        normalizeDeg(base + 75),
      ]));

      const others = adjusted.filter((_, idx) => idx !== i);
      let bestAngle = cam.angle;
      let bestScore = -1;
      for (const cand of candidateAngles) {
        const candidateCam = { ...cam, angle: cand };
        let score = 0;
        for (const s of samples) {
          const coveredByOthers = others.some((o) => camCovers(o, s.x, s.y));
          if (!coveredByOthers && camCovers(candidateCam, s.x, s.y)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestAngle = cand;
        }
      }
      adjusted[i] = { ...cam, angle: bestAngle };
    }

    return adjusted;
  }, [pxPerFoot]);

  const autoAlignCameras = useCallback((silent = false) => {
    if (placedCams.length === 0) return;
    const bounds = getFloorBounds(canvasSize.width, canvasSize.height);
    const optimized = optimizeCameraDirections(placedCams, drawnZones, bounds);
    const changed = optimized.some((c, i) => {
      const p = placedCams[i];
      if (!p) return true;
      return Math.abs(c.x - p.x) > 0.5 || Math.abs(c.y - p.y) > 0.5 || Math.abs(c.angle - p.angle) > 0.5;
    });
    if (changed) {
      setPlacedCams(optimized);
      setIsDirty(true);
      if (!silent) {
        addToast('Cameras aligned inward and optimized for blind-spot reduction', 'success');
      }
    } else if (!silent) {
      addToast('Camera directions already optimized', 'info');
    }
  }, [addToast, canvasSize.height, canvasSize.width, drawnZones, getFloorBounds, optimizeCameraDirections, placedCams]);

  const autoPlaceCamerasNoBlindSpots = useCallback(() => {
    const bounds = getFloorBounds(canvasSize.width, canvasSize.height);
    const sampleStep = Math.max(20, pxPerFoot * 1.2);
    const margin = 20;
    const fov = 110;
    const coverageTarget = 0.995; // 99.5%
    const maxCams = 40;

    const samples: { x: number; y: number }[] = [];
    for (let x = bounds.left + sampleStep / 2; x < bounds.right; x += sampleStep) {
      for (let y = bounds.top + sampleStep / 2; y < bounds.bottom; y += sampleStep) {
        samples.push({ x, y });
      }
    }
    if (samples.length === 0) {
      addToast('Unable to sample floor for camera optimization', 'error');
      return;
    }

    const candidateStep = Math.max(80, CAMERA_RANGE * 0.65);
    const xs = [];
    const ys = [];
    for (let x = bounds.left + margin; x <= bounds.right - margin; x += candidateStep) xs.push(x);
    for (let y = bounds.top + margin; y <= bounds.bottom - margin; y += candidateStep) ys.push(y);
    if (xs.length === 0) xs.push((bounds.left + bounds.right) / 2);
    if (ys.length === 0) ys.push((bounds.top + bounds.bottom) / 2);

    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const candidateAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    const cameraCoversPoint = (camX: number, camY: number, camAngle: number, px: number, py: number) => {
      const dx = px - camX;
      const dy = py - camY;
      const distSq = dx * dx + dy * dy;
      if (distSq > CAMERA_RANGE * CAMERA_RANGE) return false;
      const angleToPoint = Math.atan2(dy, dx);
      let diff = angleToPoint - (camAngle * Math.PI) / 180;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return Math.abs(diff) <= ((fov * Math.PI) / 180) / 2;
    };

    const candidates: { x: number; y: number; angle: number; covered: number[] }[] = [];
    for (const x of xs) {
      for (const y of ys) {
        for (const angle of candidateAngles) {
          const covered: number[] = [];
          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            if (cameraCoversPoint(x, y, angle, s.x, s.y)) covered.push(i);
          }
          if (covered.length > 0) {
            candidates.push({ x, y, angle, covered });
          }
        }
      }
    }

    if (candidates.length === 0) {
      addToast('No valid camera candidates for optimization', 'error');
      return;
    }

    // Greedy set cover
    const uncovered = new Uint8Array(samples.length);
    uncovered.fill(1);
    let remaining = samples.length;
    const selected: { x: number; y: number; angle: number }[] = [];
    const used = new Uint8Array(candidates.length);

    while (remaining / samples.length > (1 - coverageTarget) && selected.length < maxCams) {
      let bestIdx = -1;
      let bestScore = 0;
      for (let i = 0; i < candidates.length; i++) {
        if (used[i]) continue;
        const cand = candidates[i];
        let gain = 0;
        for (const idx of cand.covered) {
          if (uncovered[idx]) gain++;
        }
        // Prefer inward-facing tie-breaks
        if (gain > bestScore) {
          bestScore = gain;
          bestIdx = i;
        } else if (gain === bestScore && gain > 0 && bestIdx >= 0) {
          const a = candidates[i];
          const b = candidates[bestIdx];
          const inwardA = Math.abs(Math.cos(((Math.atan2(centerY - a.y, centerX - a.x) * 180 / Math.PI - a.angle) * Math.PI) / 180));
          const inwardB = Math.abs(Math.cos(((Math.atan2(centerY - b.y, centerX - b.x) * 180 / Math.PI - b.angle) * Math.PI) / 180));
          if (inwardA > inwardB) bestIdx = i;
        }
      }
      if (bestIdx < 0 || bestScore === 0) break;
      used[bestIdx] = 1;
      const best = candidates[bestIdx];
      selected.push({ x: best.x, y: best.y, angle: best.angle });
      for (const idx of best.covered) {
        if (uncovered[idx]) {
          uncovered[idx] = 0;
          remaining--;
        }
      }
    }

    const autoCams: CamOnCanvas[] = selected.map((c, i) => ({
      id: Date.now() + i,
      x: c.x,
      y: c.y,
      angle: c.angle,
      fov,
      name: `AUTO-CAM-${String(i + 1).padStart(2, '0')}`,
      status: 'ACTIVE',
      rtsp_url: `rtsp://127.0.0.1:8554/auto_${Date.now()}_${i + 1}`,
      location: `Auto placement ${i + 1}`,
      is_overhead: true,
    }));

    const aligned = optimizeCameraDirections(autoCams, drawnZones, bounds);
    setPlacedCams(aligned);
    setSelectedCam(null);
    setIsDirty(true);

    const finalCoverage = ((samples.length - remaining) / samples.length) * 100;
    addToast(`Auto placed ${aligned.length} cameras • Coverage ${finalCoverage.toFixed(1)}%`, finalCoverage >= 99 ? 'success' : 'info');
  }, [addToast, canvasSize.height, canvasSize.width, drawnZones, getFloorBounds, optimizeCameraDirections, pxPerFoot]);

  // Apply grid snapping
  const snapPos = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapToGrid) return { x, y };
    const gridSize = pxPerFoot / 2; // snap to half-foot grid (6 inches)
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }, [snapToGrid, pxPerFoot]);

  // Helper to clear all selections
  const clearSelections = useCallback(() => {
    setSelectedCam(null);
    setSelectedZone(null);
    setSelectedWall(null);
    setSelectedArch(null);
  }, []);

  // Sync with store cameras/zones on floor change or initial loading
  useEffect(() => {
    // Always reset to CAD-first view on floor switch so DXF conversion is clearly visible.
    setShowPlanOverlay(false);
    setShowStructureOverlay(true);
    setShowDxfLabels(true);
    setShowDimensions(false);
    setShowWallsLayer(true);
    setShowDoorsLayer(true);
    setShowWindowsLayer(true);
    setShowStairsLayer(true);
    setShowLiftsLayer(true);
    setShowZonesLayer(true);
    setShowCamerasLayer(true);

    // Populate walls and archElements — use pixel-accurate blueprint data traced from CAD images.
    // Level mapping: 0 = Ground Floor, 1 = Area A (Intermediate), 2 = First Floor
    if (activeFloor === 0) {
      setWalls(GF_WALLS_ACCURATE.map((wall) => ({ ...wall })));
      setArchElements(GF_ARCH_ACCURATE.map((el) => ({ ...el })));
    } else if (activeFloor === 1) {
      setWalls(AA_WALLS_ACCURATE.map((wall) => ({ ...wall })));
      setArchElements(AA_ARCH_ACCURATE.map((el) => ({ ...el })));
    } else if (activeFloor === 2) {
      setWalls(FF_WALLS_ACCURATE.map((wall) => ({ ...wall })));
      setArchElements(FF_ARCH_ACCURATE.map((el) => ({ ...el })));
    } else {
      setWalls(GF_WALLS_ACCURATE.map((wall) => ({ ...wall })));
      setArchElements(GF_ARCH_ACCURATE.map((el) => ({ ...el })));
    }

    if (token && token !== 'demo-token') {
      const floorCams = cameras
        .filter(c => c.floor === activeFloor && ((c as any).building_id ?? null) === (currentBuildingId ?? null))
        .map(c => ({
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

      const floorZones = zones
        .filter(z => z.floor === activeFloor && (z.building_id ?? null) === (currentBuildingId ?? null))
        .map(z => ({
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
      // Demo mode — seed accurate room zones and default CCTV cameras.
      if (activeFloor === 0) {
        setPlacedCams(GF_CAMERAS_DEFAULT.map(c => ({ ...c })));
        setDrawnZones(GF_ZONES_ACCURATE.map(z => ({ ...z })));
      } else if (activeFloor === 1) {
        setPlacedCams(AA_CAMERAS_DEFAULT.map(c => ({ ...c })));
        setDrawnZones(AA_ZONES_ACCURATE.map(z => ({ ...z })));
      } else if (activeFloor === 2) {
        setPlacedCams(FF_CAMERAS_DEFAULT.map(c => ({ ...c })));
        setDrawnZones(FF_ZONES_ACCURATE.map(z => ({ ...z })));
      } else {
        setPlacedCams(GF_CAMERAS_DEFAULT.map(c => ({ ...c })));
        setDrawnZones(GF_ZONES_ACCURATE.map(z => ({ ...z })));
      }
      setIsDirty(false);
    }
    clearSelections();
  }, [activeFloor, token, cameras, zones, clearSelections, currentBuildingId]);

  // Keep built-in plan templates fitted accurately to the dynamic floor bounds.
  // NOTE: The accurate blueprint data (GF/AA/FF_WALLS_ACCURATE) is already positioned
  // in the correct canvas coordinate space, so the fit function must NOT be applied —
  // it would rescale/shift the walls to wrong positions.
  useEffect(() => {
    // Accurate data has walls from ~(80,80) to ~(1120,720) matching canvas bounds already.
    // Detect accurate data: our perimeter walls always have id >= 1001.
    const isAccurateData = walls.length > 0 && walls[0].id >= 1001;
    if (isAccurateData) return; // Skip rescaling — already correct

    const bounds = getFloorBounds(canvasSize.width, canvasSize.height);
    const fitted = fitLayoutTemplateToBoundsShared(walls, archElements, bounds);

    const wallShift =
      fitted.walls.length !== walls.length ||
      fitted.walls.some((w, i) => {
        const cur = walls[i];
        return !cur || Math.abs(w.startX - cur.startX) > 0.5 || Math.abs(w.endX - cur.endX) > 0.5 || Math.abs(w.startY - cur.startY) > 0.5 || Math.abs(w.endY - cur.endY) > 0.5;
      });
    if (wallShift) setWalls(fitted.walls);

    const archShift =
      fitted.archElements.length !== archElements.length ||
      fitted.archElements.some((a, i) => {
        const cur = archElements[i];
        return !cur || Math.abs(a.x - cur.x) > 0.5 || Math.abs(a.y - cur.y) > 0.5 || Math.abs(a.width - cur.width) > 0.5;
      });
    if (archShift) setArchElements(fitted.archElements);
  }, [activeFloor, archElements, canvasSize.height, canvasSize.width, getFloorBounds, walls]);

  const liveTracks = useStore((state) => state.tracks);

  // Accumulate live heatmap positions
  useEffect(() => {
    if (!showLiveHeatmap || isSimulatorActive) return;

    const freshTracks = Object.values(liveTracks).filter(
      (t) => (Date.now() / 1000 - t.timestamp) < 5.0
    );
    if (freshTracks.length === 0) return;

    setLiveHeatmap((prev) => {
      const floorHeatmap = { ...(prev[activeFloor] || {}) };
      freshTracks.forEach((track) => {
        const cam = cameras.find((c) => c.id === track.camera_id);
        if (cam && cam.floor === activeFloor) {
          const gx = Math.floor(track.x / 20);
          const gy = Math.floor(track.y / 20);
          const key = `${gx},${gy}`;
          floorHeatmap[key] = (floorHeatmap[key] || 0) + 1;
        }
      });
      return {
        ...prev,
        [activeFloor]: floorHeatmap
      };
    });
  }, [liveTracks, showLiveHeatmap, activeFloor, isSimulatorActive, cameras]);

  // Accumulate live tracks history
  useEffect(() => {
    if (isSimulatorActive) return;

    const freshTracks = Object.values(liveTracks).filter(
      (t) => (Date.now() / 1000 - t.timestamp) < 5.0
    );

    setLiveTracksHistory((prev) => {
      const updated = { ...prev };
      freshTracks.forEach((track) => {
        const cam = cameras.find((c) => c.id === track.camera_id);
        const floor = cam ? cam.floor : activeFloor;
        const history = updated[track.global_id] || [];
        
        const last = history[history.length - 1];
        if (!last || last.x !== track.x || last.y !== track.y || last.floor !== floor) {
          const newHistory = [...history, { x: track.x, y: track.y, floor, timestamp: Date.now() }];
          if (newHistory.length > 50) {
            newHistory.shift();
          }
          updated[track.global_id] = newHistory;
        }
      });
      return updated;
    });
  }, [liveTracks, isSimulatorActive, activeFloor, cameras]);

  // spawnAgents now accepts either inline (from HUD presets) or spawns default agents
  const spawnAgents = useCallback((freshAgents?: SimulatorAgent[]) => {
    let minX = canvasSize.width * 0.1;
    let maxX = canvasSize.width * 0.9;
    let minY = canvasSize.height * 0.1;
    let maxY = canvasSize.height * 0.9;

    const floorBounds = getFloorBounds(canvasSize.width, canvasSize.height);
    if (floorBounds) {
      minX = floorBounds.left;
      maxX = floorBounds.right;
      minY = floorBounds.top;
      maxY = floorBounds.bottom;
    }

    if (walls.length > 0) {
      minX = Math.min(...walls.map(w => Math.min(w.startX, w.endX)));
      maxX = Math.max(...walls.map(w => Math.max(w.startX, w.endX)));
      minY = Math.min(...walls.map(w => Math.min(w.startY, w.endY)));
      maxY = Math.max(...walls.map(w => Math.max(w.startY, w.endY)));
    }

    const width = maxX - minX;
    const height = maxY - minY;
    if (freshAgents) {
      // From HUD preset — just load them
      setSimulatorAgents(freshAgents);
      setSimulatorTick(0);
      addToast(`Scenario loaded — ${freshAgents.length} agents spawned`, 'success');
      return;
    }
    const base = Date.now();
    const count = Math.max(1, Math.min(64, spawnCount));
    const fresh: SimulatorAgent[] = Array.from({ length: count }).map((_, i) => {
      // Spawn inside the bounding box of the walls (plus a slight inset so they are inside)
      const x = minX + 20 + ((i + 1) / (count + 1)) * Math.max(20, width - 40);
      const y = minY + 20 + ((i * 73) % Math.max(40, Math.floor(height - 40)));
      return {
        id: `sim-agent-${base + i}`,
        x,
        y: Math.min(maxY - 20, y),
        vx: 0, vy: 0,
        speed: 40 + (i % 5) * 8,
        behavior: spawnBehavior,
        headingDeg: (i * 47) % 360,
        trail: [], zoneEnterTimes: {}, lastZones: [],
        detectedByCameras: [], alertState: 'none' as const,
      };
    });
    setSimulatorAgents(fresh);
    setSimulatorTick(0);
    addToast(`Spawned ${fresh.length} simulation agents`, 'success');
  }, [addToast, canvasSize.height, canvasSize.width, getFloorBounds, setSimulatorAgents, setSimulatorTick, spawnBehavior, spawnCount, walls]);



  const runSimulationTick = useCallback(async () => {
    if (!isSimulatorActive) return;
    const floorBounds = getFloorBounds(canvasSize.width, canvasSize.height);
    const nowMs = Date.now();
    const dtSec = 0.1 * simulatorSpeed;
    // Pass real camera FoV data and walls to engine for detection events
    const engineCams = placedCams.map(c => ({ id: c.id, x: c.x, y: c.y, angle: c.angle, fov: c.fov }));
    const engineWalls = walls.map(w => ({ id: w.id, startX: w.startX, startY: w.startY, endX: w.endX, endY: w.endY, thickness: w.thickness }));
    const { agents: nextAgents, events, heatmapUpdates } = tickSimulation({
      nowMs,
      dtSec,
      bounds: floorBounds,
      zones: drawnZones,
      agents: simulatorAgents,
      cameras: engineCams,
      walls: engineWalls,
      seed: simulatorSeed,
    });
    setSimulatorAgents(nextAgents);
    setSimulatorTick(simulatorTick + 1);
    pushSimulatorEvents(events, heatmapUpdates);

    if (simPushBackend && token && token !== 'demo-token') {
      try {
        if (!simSessionId) {
          const started = await api.startSimulation(token, {
            floor: activeFloor,
            building_id: currentBuildingId ?? null,
            site_id: currentSiteId ?? null,
            seed: simulatorSeed,
            speed: simulatorSpeed,
          });
          setSimSessionId(started.session_id);
        }
        if (simSessionId) {
          await api.tickSimulation(token, {
            session_id: simSessionId,
            tick: simulatorTick + 1,
            events: events.map((e) => ({
              type: e.type,
              ...e.payload,
            })),
          });
        }
      } catch {
        // non-blocking in frontend-only mode
      }
    }
  }, [
    activeFloor,
    canvasSize.height,
    canvasSize.width,
    currentBuildingId,
    currentSiteId,
    drawnZones,
    getFloorBounds,
    isSimulatorActive,
    pushSimulatorEvents,
    setSimulatorAgents,
    setSimulatorTick,
    simPushBackend,
    simulatorAgents,
    simulatorSeed,
    simSessionId,
    setSimSessionId,
    simulatorSpeed,
    simulatorTick,
    token,
  ]);

  useEffect(() => {
    if (!isSimulatorActive || !simulatorRunning) return;
    const interval = setInterval(() => {
      void runSimulationTick();
    }, 100);
    return () => clearInterval(interval);
  }, [isSimulatorActive, simulatorRunning, runSimulationTick]);

  useEffect(() => {
    if (isSimulatorActive) return;
    if (!simSessionId || !token || token === 'demo-token') return;
    void api.stopSimulation(token, simSessionId).catch(() => {});
    setSimSessionId(null);
  }, [isSimulatorActive, simSessionId, token]);

  const exportScenario = useCallback(() => {
    const snapshot = exportSimulatorSnapshot(activeFloor, currentBuildingId ?? null, currentSiteId ?? null, drawnZones);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-sim-${currentBuildingId ?? 'na'}-${activeFloor}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Scenario exported', 'success');
  }, [activeFloor, addToast, currentBuildingId, currentSiteId, drawnZones, exportSimulatorSnapshot]);

  const importScenario = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '{}'));
        importSimulatorSnapshot(parsed);
        setSimulatorMode('simulator');
        addToast('Scenario imported', 'success');
      } catch {
        addToast('Invalid scenario file', 'error');
      }
    };
    reader.readAsText(file);
  }, [addToast, importSimulatorSnapshot, setSimulatorMode]);

  // Keep floor/campus canvases responsive to actual viewport size.
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;

    const updateSize = () => {
      const nextWidth = Math.max(640, Math.floor(el.clientWidth));
      const nextHeight = Math.max(420, Math.floor(el.clientHeight));
      setCanvasSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

      // Slow down and smooth out zoom (proportional to current zoom level)
      const zoomFactor = 0.001;
      const delta = -e.deltaY * zoomFactor * zoom;
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
        INDOOR:  { bg: 'rgba(255, 107, 0, 0.15)',  border: '#FF6B00', accent: '#FF8C33' },
        OUTDOOR: { bg: 'rgba(78, 205, 196, 0.15)', border: '#4ECDC4', accent: '#8cece5' },
        MIXED:   { bg: 'rgba(200, 255, 0, 0.12)',  border: '#C8FF00', accent: '#d4ff33' },
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
      // Slow down and smooth out zoom (proportional to current zoom level)
      const zoomFactor = 0.001;
      const delta = -e.deltaY * zoomFactor * zoom;
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const floorBounds = getFloorBounds(canvas.width, canvas.height);

    // 0.3. Floor blueprint image — the real CAD floor plan (primary accurate source).
    const floorPlanImg = blueprintImageCacheRef.current[activeFloor];
    if (showPlanOverlay && floorPlanImg && floorPlanImg.complete) {
      const crop = FLOOR_BLUEPRINT_CROP[activeFloor] ?? { x: 0, y: 0, w: 1, h: 1 };
      const sx = Math.floor(floorPlanImg.width * crop.x);
      const sy = Math.floor(floorPlanImg.height * crop.y);
      const sw = Math.floor(floorPlanImg.width * crop.w);
      const sh = Math.floor(floorPlanImg.height * crop.h);

      // Stretch-fill to the entire floor bounds rectangle so the plan fills
      // the workspace without any letterbox gaps.
      const drawX = floorBounds.left;
      const drawY = floorBounds.top;
      const drawW = floorBounds.right - floorBounds.left;
      const drawH = floorBounds.bottom - floorBounds.top;

      ctx.save();
      // White foundation so image whites are crisp
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.drawImage(floorPlanImg, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // 0.5. Coverage Heatmap (Blind Spot Detection)
    if (showCoverageHeatmap) {
      // Draw semi-transparent red over the entire building footprint (representing blind spots by default)
      let minX = floorBounds.left;
      let maxX = floorBounds.right;
      let minY = floorBounds.top;
      let maxY = floorBounds.bottom;
      if (walls.length > 0) {
        minX = Math.min(...walls.map(w => Math.min(w.startX, w.endX)));
        maxX = Math.max(...walls.map(w => Math.max(w.startX, w.endX)));
        minY = Math.min(...walls.map(w => Math.min(w.startY, w.endY)));
        maxY = Math.max(...walls.map(w => Math.max(w.startY, w.endY)));
      }

      ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
      ctx.fillRect(
        minX,
        minY,
        maxX - minX,
        maxY - minY
      );

      // Draw semi-transparent green cones for each active camera's FOV
      placedCams.forEach((cam) => {
        if (cam.status === 'OFFLINE') return;
        const fovRad = (cam.fov * Math.PI) / 180;
        ctx.save();
        ctx.translate(cam.x, cam.y);
        ctx.rotate((cam.angle * Math.PI) / 180);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, CAMERA_RANGE, -fovRad / 2, fovRad / 2);
        ctx.closePath();

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, CAMERA_RANGE);
        grad.addColorStop(0, 'rgba(34, 197, 94, 0.22)');
        grad.addColorStop(1, 'rgba(34, 197, 94, 0.01)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();
      });
    }

    // Engineering grid removed from layout to keep layout clean

    // Floor boundary border removed to keep the layout clean

    // 2) Draw structure overlay — only when plan image is hidden.
    // When the real CAD image is the backdrop, suppress all vector walls/arch/labels
    // so only ONE blueprint is ever visible at a time.
    if (!showPlanOverlay && showStructureOverlay && showWallsLayer) {
      walls.forEach((wall) => {
        drawWallOnCanvas(ctx, wall, selectedWall === wall.id, pxPerFoot, measureUnit, showDimensions);
      });
    }

    // 3. Draw Architectural Elements (only in structure-overlay mode)
    if (!showPlanOverlay && showStructureOverlay) {
      archElements.forEach((el) => {
        if (el.type === 'DOOR' || el.type === 'DOUBLE_DOOR' || el.type === 'ACCESS_DOOR') {
          if (!showDoorsLayer) return;
        }
        if (el.type === 'WINDOW') {
          if (!showWindowsLayer) return;
        }
        if (el.type === 'STAIRS') {
          if (!showStairsLayer) return;
        }
        if (el.type === 'ELEVATOR') {
          if (!showLiftsLayer) return;
        }
        drawArchElement(ctx, el, selectedArch === el.id);
      });
    }

    // 3.5 Draw DXF labels (only in structure-overlay mode)
    if (!showPlanOverlay && showStructureOverlay && showDxfLabels && zoom >= 0.85) {
      ctx.textAlign = 'left';
      fittedDxfLabels.forEach((label) => {
        ctx.font = `600 ${Math.min(12, Math.max(9, label.height * 0.85))}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(31, 41, 55, 0.62)';
        ctx.fillText(label.text, label.x, label.y);
      });
    }

    // 4. Draw Zones — very light tint + dashed border so walls are the primary visual.
    // Zone fills intentionally near-transparent so the programmatic wall geometry
    // reads as the true floor plan — zones are just coloured room identifiers.
    if (showZonesLayer) drawnZones.forEach((zone) => {
      if (zone.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(zone.points[0].x, zone.points[0].y);
      zone.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();

      // Nearly invisible fill — only a subtle room tint
      ctx.fillStyle = zone.color + '14';   // ~8 % opacity
      ctx.fill();

      const isSelected = selectedZone === zone.id;
      if (isSelected) {
        // Solid orange highlight for selected zone
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      } else {
        // Thin dashed coloured border so room boundaries are clear
        ctx.strokeStyle = zone.color + 'bb';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Always show room name label so each area is identifiable
      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      // Measure available width to pick font size
      const xs = zone.points.map(p => p.x);
      const ys = zone.points.map(p => p.y);
      const roomW = Math.max(...xs) - Math.min(...xs);
      const roomH = Math.max(...ys) - Math.min(...ys);
      const fontSize = Math.min(11, Math.max(7, Math.min(roomW, roomH) * 0.11));

      // Background chip for readability
      ctx.font = `600 ${fontSize}px Outfit, sans-serif`;
      const labelW = ctx.measureText(zone.name).width;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(cx - labelW / 2 - 3, cy - fontSize - 2, labelW + 6, fontSize + 5);

      // Room name in zone colour
      ctx.fillStyle = isSelected ? '#f59e0b' : zone.color;
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, cx, cy);

      // Zone type sub-label (dimmed)
      if (showZoneLabels || isSelected) {
        ctx.font = `${Math.max(6, fontSize - 2)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(60,60,60,0.55)';
        ctx.fillText(zone.type, cx, cy + fontSize + 2);
      }
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
    if (showCamerasLayer) placedCams.forEach((cam) => {
      const isSelected = selectedCam === cam.id;
      const isOffline = cam.status === 'OFFLINE';
      const color = isOffline ? '#dc2626' : '#0ea5e9';

      // FoV cone
      const fovRad = (cam.fov * Math.PI) / 180;
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.rotate((cam.angle * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, CAMERA_RANGE, -fovRad / 2, fovRad / 2);
      ctx.closePath();
      
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, CAMERA_RANGE);
      grad.addColorStop(0, color + '44');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.fill();
      
      ctx.strokeStyle = color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(-fovRad/2)*CAMERA_RANGE, Math.sin(-fovRad/2)*CAMERA_RANGE);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(fovRad/2)*CAMERA_RANGE, Math.sin(fovRad/2)*CAMERA_RANGE);
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
      if (showCameraLabels || isSelected || hoveredCamId === cam.id) {
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 10px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(cam.name, cam.x, cam.y + 14);
      }
    });

    // 6. Simulator overlays
    if (isSimulatorActive) {
      const simOverlays = useSimulatorStore.getState().overlays;
      const simHeatmap = useSimulatorStore.getState().heatmap;
      const nowMs = Date.now();

      // ── Heatmap layer ────────────────────────────────────────────────────────
      if (simOverlays.heatmap && Object.keys(simHeatmap).length > 0) {
        const maxVal = Math.max(...Object.values(simHeatmap));
        for (const [key, val] of Object.entries(simHeatmap)) {
          const [gx, gy] = key.split(',').map(Number);
          const t = Math.min(1, val / (maxVal * 0.5));
          const alpha = t * 0.45;
          // Color: blue → yellow → red
          const r = Math.round(t > 0.5 ? 255 : t * 2 * 255);
          const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - (t - 0.5) * 2) * 200);
          const b = Math.round(t < 0.5 ? 255 : 0);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(gx * 20, gy * 20, 20, 20);
        }
      }

      const occupancy: Record<number, number> = {};
      drawnZones.forEach((z) => { occupancy[z.id] = 0; });

      // ── Agent trails ─────────────────────────────────────────────────────────
      simulatorAgents.forEach((agent) => {
        drawnZones.forEach((zone) => {
          if (zone.points.length >= 3 && isPointInPolygon({ x: agent.x, y: agent.y }, zone.points)) {
            occupancy[zone.id] = (occupancy[zone.id] ?? 0) + 1;
          }
        });

        if (simOverlays.trails && agent.trail.length > 1) {
          const trailColor = agent.color ?? '#00f0ff';
          ctx.beginPath();
          ctx.moveTo(agent.trail[0].x, agent.trail[0].y);
          for (let i = 1; i < agent.trail.length; i++) {
            const alpha = (i / agent.trail.length) * 0.35;
            ctx.lineTo(agent.trail[i].x, agent.trail[i].y);
          }
          ctx.strokeStyle = trailColor + '44';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // ── Agents (drawn after trails so dots are on top) ───────────────────────
      simulatorAgents.forEach((agent) => {
        const agentColor = agent.color ?? '#00f0ff';
        const isWatchlist = agent.identityType === 'WATCHLIST';
        const isKnown = agent.identityType && agent.identityType !== 'UNKNOWN';
        const dotRadius = isWatchlist ? 8 : (isKnown ? 7 : 5);
        const alertAge = agent.alertAt ? nowMs - agent.alertAt : Infinity;

        // Alert pulse ring (fades out after 2.5s)
        if (agent.alertState && agent.alertState !== 'none' && alertAge < 2500) {
          const pulseProgress = alertAge / 2500;
          const pulseRadius = dotRadius + 8 + pulseProgress * 22;
          const pulseAlpha = (1 - pulseProgress) * 0.7;
          const pulseColor = agent.alertState === 'restricted' ? `rgba(239,68,68,${pulseAlpha})` : `rgba(245,158,11,${pulseAlpha})`;
          ctx.beginPath();
          ctx.arc(agent.x, agent.y, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = pulseColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Watchlist danger pulse (continuous)
        if (isWatchlist) {
          const pulse = Math.sin(nowMs / 220) * 0.35 + 0.65;
          ctx.beginPath();
          ctx.arc(agent.x, agent.y, dotRadius + 12, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245,158,11,${pulse * 0.6})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Glow ring for known agents
        if (isKnown) {
          ctx.beginPath();
          ctx.arc(agent.x, agent.y, dotRadius + 5, 0, Math.PI * 2);
          ctx.fillStyle = agentColor + '22';
          ctx.fill();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = agentColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Camera-detected indicator (small dot on side)
        if (agent.detectedByCameras && agent.detectedByCameras.length > 0) {
          ctx.beginPath();
          ctx.arc(agent.x + dotRadius + 3, agent.y - dotRadius - 3, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#00f0ff';
          ctx.fill();
        }

        // Name / ID label
        if (simOverlays.agentLabels) {
          const label = agent.name
            ? agent.name.split(' ')[0] // first name only
            : agent.id.replace(/sim-agent-\d+-/, 'A-').slice(0, 8);
          ctx.font = isKnown ? 'bold 9px Inter, sans-serif' : '8px Inter, sans-serif';
          const textWidth = ctx.measureText(label).width;
          const labelX = agent.x - textWidth / 2 - 3;
          const labelY = agent.y - dotRadius - 15;
          // pill background
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.beginPath();
          if (ctx.roundRect) { ctx.roundRect(labelX, labelY, textWidth + 6, 13, 3); }
          else { ctx.rect(labelX, labelY, textWidth + 6, 13); }
          ctx.fill();
          ctx.strokeStyle = agentColor + '88';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = isKnown ? '#ffffff' : 'rgba(255,255,255,0.7)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, agent.x, labelY + 6.5);
        }
      });

      // ── Camera detection flash ─────────────────────────────────────────────
      if (simOverlays.cameraDetectionFlash) {
        const detectedCamIds = new Set(simulatorAgents.flatMap(a => a.detectedByCameras ?? []));
        placedCams.forEach(cam => {
          if (detectedCamIds.has(cam.id)) {
            ctx.beginPath();
            ctx.arc(cam.x, cam.y, 16, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,240,255,0.6)';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,240,255,0.12)';
            ctx.fill();
          }
        });
      }

      // ── Zone occupancy badges ──────────────────────────────────────────────
      if (simOverlays.zoneOccupancy) {
        drawnZones.forEach((zone) => {
          if (zone.points.length < 3) return;
          const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
          const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
          const occ = occupancy[zone.id] ?? 0;
          // Color based on occupancy level
          const badgeColor = occ === 0 ? 'rgba(100,116,139,0.9)' : occ <= 5 ? 'rgba(34,197,94,0.9)' : occ <= 10 ? 'rgba(245,158,11,0.9)' : 'rgba(239,68,68,0.9)';
          const bgColor = occ === 0 ? 'rgba(0,0,0,0.5)' : occ <= 5 ? 'rgba(34,197,94,0.15)' : occ <= 10 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.2)';
          const badgeW = 64;
          const badgeH = 20;
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          if (ctx.roundRect) { ctx.roundRect(cx - badgeW / 2, cy + 12, badgeW, badgeH, 4); }
          else { ctx.rect(cx - badgeW / 2, cy + 12, badgeW, badgeH); }
          ctx.fill();
          ctx.strokeStyle = badgeColor;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = badgeColor;
          ctx.font = 'bold 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`👥 ${occ}${occ === 0 ? ' empty' : ''}`, cx, cy + 22);
        });
      }

      // Sim mode watermark
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,240,255,0.25)';
      ctx.fillText('⚡ SIMULATION MODE', 115, 110);
    }

    // 6.5 Live Dwell Heatmap (non-simulation mode)
    if (!isSimulatorActive && showLiveHeatmap) {
      const floorHeatmap = liveHeatmap[activeFloor] || {};
      const heatvals = Object.values(floorHeatmap);
      if (heatvals.length > 0) {
        const maxVal = Math.max(...heatvals);
        for (const [key, val] of Object.entries(floorHeatmap)) {
          const [gx, gy] = key.split(',').map(Number);
          const t = Math.min(1, val / (maxVal * 0.5));
          const alpha = t * 0.45;
          // Color: blue → yellow → red
          const r = Math.round(t > 0.5 ? 255 : t * 2 * 255);
          const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - (t - 0.5) * 2) * 200);
          const b = Math.round(t < 0.5 ? 255 : 0);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(gx * 20, gy * 20, 20, 20);
        }
      }
    }

    // 6.6 Live Zone Occupancy Badges (non-simulation mode)
    if (!isSimulatorActive && showZoneOccupancy) {
      const liveOccupancy: Record<number, number> = {};
      drawnZones.forEach((z) => { liveOccupancy[z.id] = 0; });

      const activeTracksForOccupancy = Object.values(liveTracks).filter((t) => {
        const isActive = (Date.now() / 1000 - t.timestamp) < 5.0;
        if (!isActive) return false;
        const cam = cameras.find((c) => c.id === t.camera_id);
        const floor = cam ? cam.floor : activeFloor;
        return floor === activeFloor;
      });

      activeTracksForOccupancy.forEach((track) => {
        drawnZones.forEach((zone) => {
          if (zone.points.length >= 3 && isPointInPolygon({ x: track.x, y: track.y }, zone.points)) {
            liveOccupancy[zone.id] = (liveOccupancy[zone.id] ?? 0) + 1;
          }
        });
      });

      drawnZones.forEach((zone) => {
        if (zone.points.length < 3) return;
        const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
        const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
        const occ = liveOccupancy[zone.id] ?? 0;
        // Color based on occupancy level
        const badgeColor = occ === 0 ? 'rgba(100,116,139,0.9)' : occ <= 5 ? 'rgba(34,197,94,0.9)' : occ <= 10 ? 'rgba(245,158,11,0.9)' : 'rgba(239,68,68,0.9)';
        const bgColor = occ === 0 ? 'rgba(0,0,0,0.5)' : occ <= 5 ? 'rgba(34,197,94,0.15)' : occ <= 10 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.2)';
        const badgeW = 64;
        const badgeH = 20;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(cx - badgeW / 2, cy + 12, badgeW, badgeH, 4); }
        else { ctx.rect(cx - badgeW / 2, cy + 12, badgeW, badgeH); }
        ctx.fill();
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = badgeColor;
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`👥 ${occ}${occ === 0 ? ' empty' : ''}`, cx, cy + 22);
      });
    }

    // 7. Live person dots — color-coded by identity
    if (tool === 'select' && !isSimulatorActive) {
      const IDENTITY_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
        KNOWN_EMPLOYEE:  { fill: '#22c55e', stroke: '#16a34a', glow: 'rgba(34, 197, 94, 0.4)' },
        KNOWN_VISITOR:   { fill: '#3b82f6', stroke: '#2563eb', glow: 'rgba(59, 130, 246, 0.4)' },
        WATCHLIST_MATCH: { fill: '#f59e0b', stroke: '#d97706', glow: 'rgba(245, 158, 11, 0.5)' },
        BLACKLISTED:     { fill: '#ef4444', stroke: '#dc2626', glow: 'rgba(239, 68, 68, 0.6)' },
        UNKNOWN:         { fill: 'rgba(148, 163, 184, 0.7)', stroke: 'rgba(100, 116, 139, 0.8)', glow: 'rgba(148, 163, 184, 0.2)' },
      };

      const activeTracks = Object.values(liveTracks).filter((t) => {
        const isActive = (Date.now() / 1000 - t.timestamp) < 5.0;
        if (!isActive) return false;
        const cam = cameras.find((c) => c.id === t.camera_id);
        const floor = cam ? cam.floor : activeFloor;
        return floor === activeFloor;
      });
      
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

          // Highlight selection ring if this live track is currently selected
          if (track.global_id === selectedTrackId) {
            ctx.beginPath();
            ctx.arc(track.x, track.y, dotRadius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
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

        // 8. Draw clicked passenger historic path
        if (selectedTrackId) {
          const history = liveTracksHistory[selectedTrackId] || [];
          const floorHistory = history.filter((p) => p.floor === activeFloor);
          if (floorHistory.length > 1) {
            ctx.beginPath();
            ctx.moveTo(floorHistory[0].x, floorHistory[0].y);
            for (let i = 1; i < floorHistory.length; i++) {
              ctx.lineTo(floorHistory[i].x, floorHistory[i].y);
            }
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw trailing smaller dots
            floorHistory.forEach((pt) => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.stroke();
            });
          }
        }

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
      } else if (isDemo) {
        // Fallback to simulated passenger flow only in Demo Mode
        // Determine building layout bounding box from walls to prevent dots landing outside the building structure
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        walls.forEach(w => {
          minX = Math.min(minX, w.startX, w.endX);
          minY = Math.min(minY, w.startY, w.endY);
          maxX = Math.max(maxX, w.startX, w.endX);
          maxY = Math.max(maxY, w.startY, w.endY);
        });

        const hasValidWalls = minX !== Infinity && minY !== Infinity && maxX !== -Infinity && maxY !== -Infinity;
        const bboxLeft = hasValidWalls ? minX : 150;
        const bboxTop = hasValidWalls ? minY : 150;
        const bboxWidth = hasValidWalls ? (maxX - minX) : 800;
        const bboxHeight = hasValidWalls ? (maxY - minY) : 450;
        const padding = 20;

        for (let i = 0; i < 18; i++) {
          const seed = (i * 137 + activeFloor * 31) % 1000;
          // Generate within the building bounding box with padding
          const x = bboxLeft + padding + (seed % Math.max(1, bboxWidth - padding * 2));
          const y = bboxTop + padding + ((seed * 3) % Math.max(1, bboxHeight - padding * 2));
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

  }, [placedCams, drawnZones, selectedCam, selectedZone, selectedWall, selectedArch, zoom, panX, panY, drawingZone, zoneType, tool, activeFloor, liveTracks, walls, archElements, drawingWall, wallPreviewEnd, pxPerFoot, measureUnit, showDimensions, getFloorBounds, isSimulatorActive, simulatorAgents, showCoverageHeatmap, showCameraLabels, showZoneLabels, hoveredCamId, blueprintVersion, showPlanOverlay, showStructureOverlay, showDxfLabels, fittedDxfLabels, showWallsLayer, showDoorsLayer, showWindowsLayer, showStairsLayer, showLiftsLayer, showZonesLayer, showCamerasLayer, isDemo, liveHeatmap, showLiveHeatmap, showZoneOccupancy, cameras, selectedTrackId, liveTracksHistory]);



  // ─── Mouse Handlers ─────────────────────────────────────────────────────

  const getCanvasPosFromClient = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return getCanvasPosFromClientShared(clientX, clientY, rect, { zoom, panX, panY });
  }, [zoom, panX, panY]);

  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    return getCanvasPosFromClient(e.clientX, e.clientY);
  }, [getCanvasPosFromClient]);

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

      // Left click on empty space in select mode starts panning!
      if (e.button === 0) {
        isPanning.current = true;
        panStart.current = { x: e.clientX - panX, y: e.clientY - panY };
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
      const nextPosRaw = snapToGrid ? snapPos(x, y) : { x, y };
      const nextPos = clampToFloorBounds(nextPosRaw.x, nextPosRaw.y);
      setPlacedCams((prev) =>
        prev.map((c) => (c.id === draggedCamId ? { ...c, x: nextPos.x, y: nextPos.y } : c))
      );
      setIsDirty(true);
    } else {
      // Hover check for floating preview
      const hoveredCam = placedCams.find(
        (c) => Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2) < 16
      );
      if (hoveredCam) {
        if (hoveredCamId !== hoveredCam.id) {
          setHoveredCamId(hoveredCam.id);
        }
      } else {
        if (hoveredCamId !== null) {
          setHoveredCamId(null);
        }
      }
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    isDraggingRef.current = false;
    setDraggedCamId(null);
    setDraggedArchId(null);
    setDraggingWallEndpoint(null);
    setHoveredCamId(null);
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
    const posFromClient = getCanvasPosFromClient(e.clientX, e.clientY);
    const snapped = snapToGrid ? snapPos(posFromClient.x, posFromClient.y) : posFromClient;
    const { x, y } = clampToFloorBounds(snapped.x, snapped.y);

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

  const clearLayout = () => {
    if (window.confirm("Are you sure you want to clear the entire layout? This will delete all cameras, zones, walls, and architectural elements from this floor. This action cannot be undone unless you Discard changes.")) {
      setPlacedCams([]);
      setDrawnZones([]);
      setWalls([]);
      setArchElements([]);
      clearSelections();
      setIsDirty(true);
      addToast("Layout cleared! Click 'Save Layout' to persist changes to the database.", "info");
    }
  };

  // Transactional database saving pipeline
  const saveLayout = async (silentParam?: any) => {
    const silent = silentParam === true;
    if (!token || token === 'demo-token') {
      if (!silent) addToast('Demo Mode: Layout changes saved locally!', 'success');
      setIsDirty(false);
      return;
    }

    try {
      setIsSaving(true);
      if (!silent) addToast('Saving layout to database...', 'info');

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
            building_id: currentBuildingId ?? undefined,
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
              building_id: currentBuildingId ?? undefined,
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
          building_id: currentBuildingId ?? undefined,
          x_coord: cam.x,
          y_coord: cam.y,
          angle: cam.angle,
          fov: cam.fov,
          is_overhead: cam.is_overhead ?? true,
          status: cam.status
        });
      }

      // 2. Process Zones
      const storeFloorZones = zones.filter(z => z.floor === activeFloor && (z.building_id ?? null) === (currentBuildingId ?? null));
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
          building_id: currentBuildingId ?? undefined,
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
          building_id: currentBuildingId ?? undefined,
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
      if (!silent) addToast('Blueprint layout saved successfully to database!', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(`Error saving layout: ${err.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirty || isSaving) return;

    const timer = setTimeout(() => {
      void saveLayout(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isDirty, placedCams, drawnZones, walls, archElements, isSaving]);

  // ─── Data Lookups ─────────────────────────────────────────────────────────

  const selectedCamData = placedCams.find((c) => c.id === selectedCam);
  const selectedZoneData = drawnZones.find((z) => z.id === selectedZone);
  const selectedWallData = walls.find((w) => w.id === selectedWall);
  const selectedArchData = archElements.find((el) => el.id === selectedArch);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      
      {/* Top Action Bar */}
      <div className="card" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'var(--cyan-dim)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)' }}>
            <MapPin size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 16, color: 'var(--white)' }}>Layout Editor</div>
              {isSaving ? (
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 100,
                  background: 'rgba(255, 107, 0, 0.15)', color: 'var(--orange)', border: '1px solid var(--orange-border)',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span className="status-dot" style={{ background: 'var(--orange)', width: 6, height: 6, borderRadius: '50%' }} />
                  SAVING...
                </span>
              ) : isDirty ? (
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 100,
                  background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber)', border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
                  UNSAVED CHANGES
                </span>
              ) : (
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 100,
                  background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)', border: '1px solid rgba(74, 222, 128, 0.3)',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                  SAVED ✓
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {activeBuilding?.name ?? 'Building'} — {activeFloorLabel}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={simulatorEnabled}
              onChange={(e) => {
                setSimulatorEnabled(e.target.checked);
                if (!e.target.checked) setSimulatorMode('editor');
              }}
            />
            SIMULATOR_ENABLED
          </label>
          {simulatorEnabled && (
            <div className="unit-selector" style={{ marginRight: 8 }}>
              <button className={simulatorMode === 'editor' ? 'active' : ''} onClick={() => setSimulatorMode('editor')}>Edit</button>
              <button className={simulatorMode === 'simulator' ? 'active' : ''} onClick={() => setSimulatorMode('simulator')}>Simulate</button>
            </div>
          )}
          {placedCams.length === 0 && drawnZones.length === 0 && walls.length === 0 && (
            <button className="btn btn-secondary" onClick={loadDemoTemplate}>
              <Plus size={14} /> Load Demo Template
            </button>
          )}
          {(placedCams.length > 0 || drawnZones.length > 0 || walls.length > 0 || archElements.length > 0) && (
            <button className="btn btn-danger" onClick={clearLayout}>
              <Trash2 size={14} /> Clear Full Layout
            </button>
          )}
          <button className="btn btn-secondary" onClick={discardChanges}>Discard</button>
          <button className="btn btn-primary" onClick={() => saveLayout(false)}>
            <Save size={14} /> Save Layout
          </button>
        </div>
      </div>

      <div className="layout-editor-main" style={{ 
        height: 'calc(100vh - 220px)',
        minHeight: 0,
        display: 'grid', 
        gridTemplateColumns: '260px 1fr 300px', 
        gap: '24px',
        overflow: 'hidden'
      }}>

        {/* Left: Tools Palette / Simulator HUD */}
        <div className="layout-sidebar-left" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minHeight: 0, maxHeight: '100%' }}>
          {/* Show SimulatorHUD when simulator mode is active */}
          {isSimulatorActive && (
            <SimulatorHUD
              onSpawn={spawnAgents}
              onExport={exportScenario}
              onImport={(file) => importScenario(file)}
              floorBounds={getFloorBounds(canvasSize.width, canvasSize.height)}
              runTick={() => { void runSimulationTick(); }}
            />
          )}
          {!isSimulatorActive && (<>
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
                      background: b.building_type === 'OUTDOOR' ? 'rgba(78,205,196,0.15)' : b.building_type === 'MIXED' ? 'rgba(200,255,0,0.12)' : 'rgba(255,107,0,0.15)',
                      color: b.building_type === 'OUTDOOR' ? '#4ECDC4' : b.building_type === 'MIXED' ? '#C8FF00' : '#FF6B00',
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
            {isSimulatorActive && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-shadow)', background: 'var(--cyan-dim)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Simulator Controls
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setSimulatorRunning(!simulatorRunning)}>
                    {simulatorRunning ? 'Pause' : 'Play'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { void runSimulationTick(); }}>Step</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <button className="btn btn-ghost" onClick={() => resetSimulator()}>Reset</button>
                  <button className="btn btn-ghost" onClick={() => spawnAgents()}>Spawn</button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Speed: {simulatorSpeed.toFixed(1)}x</div>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={simulatorSpeed}
                    onChange={(e) => setSimulatorSpeed(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={spawnCount}
                    onChange={(e) => setSpawnCount(Math.max(1, Math.min(64, parseInt(e.target.value || '1'))))}
                    className="form-input"
                  />
                  <select className="form-select" value={spawnBehavior} onChange={(e) => setSpawnBehavior(e.target.value as AgentBehavior)}>
                    <option value="roam">Roam</option>
                    <option value="patrol">Patrol</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={exportScenario}>Export</button>
                  <label className="btn btn-ghost" style={{ flex: 1 }}>
                    Import
                    <input
                      type="file"
                      accept="application/json"
                      style={{ display: 'none' }}
                      onChange={(e) => importScenario(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={simPushBackend} onChange={(e) => setSimPushBackend(e.target.checked)} />
                  Push events to backend WS path
                </label>
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                  Tick #{simulatorTick} · Agents {simulatorAgents.length} · Events {simulatorTimeline.length}
                </div>
              </div>
            )}
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

              <div className="scale-config-row">
                <span className="scale-config-label">Plan Image</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showPlanOverlay} onChange={(e) => setShowPlanOverlay(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Structure Overlay</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showStructureOverlay} onChange={(e) => setShowStructureOverlay(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -2 }}>
                Plan Image = accurate CAD blueprint. Structure Overlay = editable vector walls.
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Camera Labels</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showCameraLabels} onChange={(e) => setShowCameraLabels(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Zone Labels</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showZoneLabels} onChange={(e) => setShowZoneLabels(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">DXF Labels</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showDxfLabels} onChange={(e) => setShowDxfLabels(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Walls</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showWallsLayer} onChange={(e) => setShowWallsLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Doors</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showDoorsLayer} onChange={(e) => setShowDoorsLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Windows</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showWindowsLayer} onChange={(e) => setShowWindowsLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Stairs</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showStairsLayer} onChange={(e) => setShowStairsLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Lifts</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showLiftsLayer} onChange={(e) => setShowLiftsLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Cameras</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showCamerasLayer} onChange={(e) => setShowCamerasLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Layer Zones</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showZonesLayer} onChange={(e) => setShowZonesLayer(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Live Heatmap</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showLiveHeatmap} onChange={(e) => setShowLiveHeatmap(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Zone Occupancy</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showZoneOccupancy} onChange={(e) => setShowZoneOccupancy(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Auto Align Cameras</span>
                <button className="btn btn-ghost btn-sm" onClick={() => autoAlignCameras(false)}>
                  Align
                </button>
              </div>
              <div className="scale-config-row">
                <span className="scale-config-label">Auto Place (No Blind Spot)</span>
                <button className="btn btn-primary btn-sm" onClick={autoPlaceCamerasNoBlindSpots}>
                  Generate
                </button>
              </div>

              <div className="scale-config-row" style={{ borderTop: '1px solid rgba(0,240,255,0.1)', paddingTop: 8, marginTop: 4 }}>
                <span className="scale-config-label">Coverage Heatmap</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showCoverageHeatmap} onChange={(e) => setShowCoverageHeatmap(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {showCoverageHeatmap && (
                <div className="scale-config-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, borderTop: '1px solid rgba(0,240,255,0.05)', paddingTop: 6, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</span>
                    <span className={`badge ${coveragePercentage >= 99 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                      <span className="badge-dot" style={{ background: coveragePercentage >= 99 ? 'var(--green-bright)' : 'var(--red-bright)', width: 5, height: 5 }} />
                      {coveragePercentage >= 99 ? 'NO BLIND SPOTS' : 'BLIND SPOTS DETECTED'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Coverage</span>
                    <span style={{ fontSize: 12, color: '#00f0ff', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {coveragePercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                    <div style={{ width: `${coveragePercentage}%`, height: '100%', background: coveragePercentage >= 99 ? 'var(--green-bright)' : 'var(--amber-bright)', borderRadius: 2, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
              {!showCoverageHeatmap && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-ghost)' }}>
                  Coverage overlay hidden for clean view.
                </div>
              )}
            </div>
          </div>
          </>)}
        </div>

        {/* Center: Canvas Area */}
        <div className="layout-canvas-area" style={{ position: 'relative', minHeight: 0 }} ref={canvasAreaRef}>
          
          <div style={{ 
            width: '100%', height: '100%', 
            position: 'relative', 
            background: '#ffffff', 
            borderRadius: 'var(--radius-xl)', 
            border: '1px solid #e2e8f0',
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
              >📐 2D Floor</button>
              <button
                className={`btn btn-sm ${viewMode === 'floor-3d' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 100, fontSize: 11, padding: '5px 14px' }}
                onClick={() => { setViewMode('floor-3d'); setZoom(1); setPanX(0); setPanY(0); }}
              >🧊 3D Floor</button>
            </div>

            {viewMode === 'floor-3d' ? (
               <FloorScene3D 
                 cameras={placedCams}
                 zones={drawnZones}
                 walls={walls}
                 pxPerFoot={pxPerFoot}
                editMode={tool === 'select' && !isSimulatorActive}
                 selectedCamId={selectedCam}
                 onSelectCam={setSelectedCam}
                 onUpdateCam={(id, pos, angle) => {
                   setPlacedCams(prev => prev.map(c => c.id === id ? { ...c, x: pos.x, y: pos.y, angle } : c));
                   setIsDirty(true);
                 }}
               />
            ) : viewMode === 'floor' ? (
              <>
            <div style={{
              position: 'absolute', top: 20, left: 24, zIndex: 10,
              fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 800, 
              color: '#0f172a'
            }}>
              {activeFloorLabel} Blueprint
            </div>



            <canvas
              ref={canvasRef}
              className="layout-canvas"
              width={canvasSize.width}
              height={canvasSize.height}
              style={{
                width: '100%', height: '100%',
                cursor: isSimulatorActive
                  ? 'default'
                  : isPanning.current
                    ? 'grabbing'
                    : spaceHeld.current
                      ? 'grab'
                      : tool === 'wall'
                        ? 'crosshair'
                        : tool === 'zone'
                          ? 'crosshair'
                          : (draggedCamId || draggedArchId || draggingWallEndpoint ? 'grabbing' : 'default'),
              }}
              onMouseDown={isSimulatorActive ? undefined : handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={isSimulatorActive ? undefined : handleMouseUp}
              onDoubleClick={handleDoubleClick}
              onClick={isSimulatorActive ? undefined : handleCanvasClick}
              onDrop={isSimulatorActive ? undefined : handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onMouseLeave={isSimulatorActive ? undefined : handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              onAuxClick={(e) => e.preventDefault()}
            />

            {isSimulatorActive && (
              <div style={{
                position: 'absolute',
                top: 64,
                left: 24,
                zIndex: 10,
                background: 'rgba(15,15,20,0.82)',
                border: '1px solid var(--cyan-shadow)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                minWidth: 220,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Timeline {Math.min(simulatorPointer + 1, simulatorTimeline.length)} / {simulatorTimeline.length}
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, simulatorTimeline.length - 1)}
                  value={Math.min(simulatorPointer, Math.max(0, simulatorTimeline.length - 1))}
                  onChange={(e) => setSimulatorPointer(parseInt(e.target.value || '0'))}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--cyan)', marginTop: 6 }}>
                  {simulatorTimeline[Math.min(simulatorPointer, Math.max(0, simulatorTimeline.length - 1))]?.type ?? 'No events yet'}
                </div>
              </div>
            )}

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
                  width={canvasSize.width}
                  height={canvasSize.height}
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
        <div className="layout-sidebar-right card" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0, maxHeight: '100%' }}>
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

          {isSimulatorActive && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                Simulator Event Log
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {simulatorTimeline.slice(-24).reverse().map((evt) => (
                  <div key={evt.id} style={{ padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 11, color: evt.type === 'ALERT_NEW' ? 'var(--red)' : 'var(--cyan)', fontWeight: 700 }}>{evt.type}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{evt.agentId} · {new Date(evt.ts).toLocaleTimeString()}</div>
                  </div>
                ))}
                {simulatorTimeline.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No simulation events yet.</div>
                )}
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

          {/* Map Legend */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px', marginTop: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
              Map Legend
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12 }}>🟢</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Access Door</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#6b7280' }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Utility Area</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface-1)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
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
                  <SurveillanceCCTVStream 
                    cameraId={cam.id}
                    cameraName={cam.name}
                    location={cam.location || ''}
                    width={640}
                    height={360}
                  />
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
