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
import type { AgentBehavior, SimulatorAgent } from '../features/simulator/types';
import SimulatorHUD, { KEMPEGOWDA_CAMERAS } from './SimulatorHUD';

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
// ACC Rooms (4 bays), STM Room, WSO, APP Room, Training, Recreation
const ALPHA2_FF_CAMERAS = [
  { id: 9201, name: 'CAM-FF-01 · ACC Bay 1',         location: 'Access Control Center — Bay 1',  x: 195, y: 710, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9202, name: 'CAM-FF-02 · ACC Bay 2',         location: 'Access Control Center — Bay 2',  x: 375, y: 710, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9203, name: 'CAM-FF-03 · ACC Bay 3',         location: 'Access Control Center — Bay 3',  x: 555, y: 710, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9204, name: 'CAM-FF-04 · ACC Bay 4 (WSO)',   location: 'Access Control Center — Bay 4',  x: 735, y: 710, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9205, name: 'CAM-FF-05 · STM Room',          location: 'STM Telecom Room',               x:  90, y: 710, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9206, name: 'CAM-FF-06 · APP Room',          location: 'APP / WSO Operations Room',      x: 1110, y: 710, angle: 135, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9207, name: 'CAM-FF-07 · Training Corridor', location: 'Training Room Corridor',         x: 450, y: 370, angle: 225, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9208, name: 'CAM-FF-08 · Staircase',         location: 'First Floor — Staircase',        x:  90, y:  90, angle:  45, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
  { id: 9209, name: 'CAM-FF-09 · Recreation Room',   location: 'Recreation Room',                x: 915, y: 370, angle: 225, fov: 120, status: 'ACTIVE' as const, is_overhead: true  },
  { id: 9210, name: 'CAM-FF-10 · First Floor Entry', location: 'First Floor — Main Entry',       x: 270, y:  90, angle: 135, fov: 120, status: 'ACTIVE' as const, is_overhead: false },
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

const CAMERA_RANGE = 200;

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
  const [showDimensions, setShowDimensions] = useState(true);
  const [showCoverageHeatmap, setShowCoverageHeatmap] = useState(true);
  const [hoveredCamId, setHoveredCamId] = useState<number | null>(null);

  const coveragePercentage = useMemo(() => {
    if (placedCams.length === 0) return 0;
    const activeCams = placedCams.filter(c => c.status !== 'OFFLINE');
    if (activeCams.length === 0) return 0;

    const startX = 80;
    const endX = 1120;
    const startY = 80;
    const endY = 720;
    const stepX = 26; // 40 steps across 1040px
    const stepY = 25.6; // 25 steps across 640px

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
  }, [placedCams]);

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

  // Helper to clear all selections
  const clearSelections = useCallback(() => {
    setSelectedCam(null);
    setSelectedZone(null);
    setSelectedWall(null);
    setSelectedArch(null);
  }, []);

  const getFloorBounds = useCallback((width: number, height: number): FloorBounds => {
    return getFloorBoundsShared(width, height);
  }, []);

  const clampToFloorBounds = useCallback((x: number, y: number, radius = 12) => {
    const b = getFloorBounds(canvasSize.width, canvasSize.height);
    return clampToFloorBoundsShared(x, y, b, radius);
  }, [canvasSize.width, canvasSize.height, getFloorBounds]);

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
      // ── Demo fallback: Alpha-2 ATS Complex, Kempegowda International Airport (BIAL) ────
      // Floor plan source: Location Maps.pdf  |  Scale: 41 m × 25 m → ~25 px/m
      // Canvas origin (80,80), right edge 1120, bottom edge 720

      if (activeFloor === 0) {
        // ════════════════════════════════════════════════════════════════
        //  GROUND FLOOR ALPHA-2
        //  Key areas: Canteen, Lobby/Lift, Electrical Room, Toilets,
        //  Reception, Area of Stay, Storage/Legal, Monitor Room, Director Offices
        // ════════════════════════════════════════════════════════════════
        setPlacedCams(KEMPEGOWDA_CAMERAS.map(c => ({
          id: c.id, x: c.x, y: c.y, angle: c.angle, fov: c.fov,
          name: c.name, status: c.status,
          rtsp_url: `rtsp://10.0.1.${c.id - 9000}:554/stream1`,
          location: c.location, is_overhead: c.is_overhead,
        })));
        setDrawnZones([
          { id: 101, name: 'LT MCC HV Electrical Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 340, y:  80 }, { x: 555, y:  80 }, { x: 555, y: 280 }, { x: 340, y: 280 }] },
          { id: 102, name: 'BIAL Canteen — Dining Area', type: 'DWELL', color: ZONE_COLORS.DWELL, dwell_alert_seconds: 3600, is_active: true,
            points: [{ x:  80, y: 340 }, { x: 340, y: 340 }, { x: 340, y: 720 }, { x:  80, y: 720 }] },
          { id: 103, name: 'Reception Lobby', type: 'LOUNGE', color: ZONE_COLORS.LOUNGE, dwell_alert_seconds: 900, is_active: true,
            points: [{ x: 635, y:  80 }, { x: 855, y:  80 }, { x: 855, y: 280 }, { x: 635, y: 280 }] },
          { id: 104, name: 'Storage / Legal Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 635, y: 440 }, { x: 760, y: 440 }, { x: 760, y: 560 }, { x: 635, y: 560 }] },
          { id: 105, name: 'Data Office', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 890, y:  80 }, { x: 1010, y:  80 }, { x: 1010, y: 400 }, { x: 890, y: 400 }] },
          { id: 106, name: 'Area of Stay — Waiting', type: 'DWELL', color: ZONE_COLORS.DWELL, dwell_alert_seconds: 1800, is_active: true,
            points: [{ x: 555, y: 280 }, { x: 635, y: 280 }, { x: 635, y: 440 }, { x: 555, y: 440 }] },
          { id: 107, name: 'Main Entry Tripwire', type: 'TRIPWIRE', color: ZONE_COLORS.TRIPWIRE, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y:  80 }, { x: 200, y:  80 }, { x: 200, y: 140 }, { x:  80, y: 140 }] },
          { id: 108, name: 'South Exit Tripwire', type: 'TRIPWIRE', color: ZONE_COLORS.TRIPWIRE, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y: 660 }, { x: 200, y: 660 }, { x: 200, y: 720 }, { x:  80, y: 720 }] },
          { id: 109, name: 'Airport Director Offices', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 1010, y:  80 }, { x: 1120, y:  80 }, { x: 1120, y: 400 }, { x: 1010, y: 400 }] },
          { id: 110, name: 'AFSB Misc Office', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 890, y: 400 }, { x: 1010, y: 400 }, { x: 1010, y: 560 }, { x: 890, y: 560 }] },
          { id: 111, name: 'Right Toilets block', type: 'DWELL', color: ZONE_COLORS.DWELL, dwell_alert_seconds: 600, is_active: true,
            points: [{ x: 1010, y: 400 }, { x: 1120, y: 400 }, { x: 1120, y: 560 }, { x: 1010, y: 560 }] },
          { id: 112, name: 'Director Entry & Corridor', type: 'DWELL', color: ZONE_COLORS.DWELL, dwell_alert_seconds: 900, is_active: true,
            points: [{ x: 890, y: 560 }, { x: 1120, y: 560 }, { x: 1120, y: 720 }, { x: 890, y: 720 }] }
        ]);
        setWalls([
          // ── Outer perimeter (41 m × 25 m @ 25 px/m, offset 80,80)
          { id: 101, startX:   80, startY:  80, endX: 1120, endY:  80, thickness: 8, color: WALL_COLOR, label: 'North Perimeter Wall' },
          { id: 102, startX:   80, startY:  80, endX:   80, endY: 720, thickness: 8, color: WALL_COLOR, label: 'West Perimeter Wall'  },
          { id: 103, startX: 1120, startY:  80, endX: 1120, endY: 720, thickness: 8, color: WALL_COLOR, label: 'East Perimeter Wall'  },
          { id: 104, startX:   80, startY: 720, endX: 1120, endY: 720, thickness: 8, color: WALL_COLOR, label: 'South Perimeter Wall' },
          // ── Canteen east partition (~10.4 m from west)
          { id: 105, startX: 340, startY:  80, endX: 340, endY: 720, thickness: 6, color: WALL_COLOR, label: 'Canteen East Wall' },
          // ── Canteen internal — upper locker/rest rooms above dining
          { id: 106, startX:  80, startY: 340, endX: 340, endY: 340, thickness: 5, color: WALL_COLOR, label: 'Canteen Upper Divider' },
          { id: 107, startX: 175, startY:  80, endX: 175, endY: 340, thickness: 4, color: WALL_COLOR, label: 'Locker Room Wall'      },
          { id: 108, startX: 175, startY: 200, endX: 340, endY: 200, thickness: 4, color: WALL_COLOR, label: 'Rest Room Divider'    },
          // ── LT MCC HV Electrical Room
          { id: 109, startX: 340, startY: 280, endX: 555, endY: 280, thickness: 5, color: WALL_COLOR, label: 'Electrical Room South Wall' },
          { id: 110, startX: 555, startY:  80, endX: 555, endY: 280, thickness: 5, color: WALL_COLOR, label: 'Electrical Room East Wall'  },
          // ── Toilet block (Gents + Ladies back-to-back)
          { id: 111, startX: 340, startY: 440, endX: 635, endY: 440, thickness: 5, color: WALL_COLOR, label: 'Toilet Block North Wall'   },
          { id: 112, startX: 340, startY: 560, endX: 635, endY: 560, thickness: 5, color: WALL_COLOR, label: 'Toilet Block South Wall'   },
          { id: 113, startX: 480, startY: 280, endX: 480, endY: 440, thickness: 4, color: WALL_COLOR, label: 'Gents/Ladies Divider'      },
          { id: 114, startX: 635, startY: 280, endX: 635, endY: 440, thickness: 4, color: WALL_COLOR, label: 'Toilet Block East Wall'    },
          // ── Reception area
          { id: 115, startX: 635, startY:  80, endX: 635, endY: 280, thickness: 5, color: WALL_COLOR, label: 'Reception West Wall'  },
          { id: 116, startX: 635, startY: 280, endX: 855, endY: 280, thickness: 4, color: WALL_COLOR, label: 'Reception South Wall' },
          { id: 117, startX: 855, startY:  80, endX: 855, endY: 280, thickness: 4, color: WALL_COLOR, label: 'Reception East Wall'  },
          // ── Area of Stay / Storage / Legal
          { id: 118, startX: 635, startY: 440, endX: 760, endY: 440, thickness: 4, color: WALL_COLOR, label: 'Area of Stay North Wall'  },
          { id: 119, startX: 635, startY: 560, endX: 760, endY: 560, thickness: 4, color: WALL_COLOR, label: 'Storage Room South Wall'  },
          { id: 120, startX: 760, startY: 280, endX: 760, endY: 560, thickness: 4, color: WALL_COLOR, label: 'Storage/Stay East Wall'   },
          // ── Monitor / Policy Room
          { id: 121, startX: 855, startY: 280, endX: 890, endY: 280, thickness: 4, color: WALL_COLOR, label: 'Monitor Room North Wall' },
          { id: 122, startX: 890, startY:  80, endX: 890, endY: 560, thickness: 4, color: WALL_COLOR, label: 'Monitor Room East Wall'  },
          { id: 123, startX: 855, startY: 560, endX: 890, endY: 560, thickness: 4, color: WALL_COLOR, label: 'Monitor Room South Wall' },
          // ── Director Offices west partition
          { id: 124, startX: 890, startY:  80, endX:  890, endY: 720, thickness: 6, color: WALL_COLOR, label: 'Director Offices West Wall'       },
          { id: 125, startX: 890, startY: 400, endX: 1120, endY: 400, thickness: 4, color: WALL_COLOR, label: 'Director Office Internal Division' },
          { id: 126, startX: 1010, startY: 80, endX: 1010, endY: 400, thickness: 4, color: WALL_COLOR, label: 'Data Office West Wall'            },
          { id: 127, startX: 890, startY: 560, endX: 1120, endY: 560, thickness: 4, color: WALL_COLOR, label: 'Right Toilet Block divider'       },
          { id: 128, startX: 1010, startY: 400, endX: 1010, endY: 560, thickness: 4, color: WALL_COLOR, label: 'AFSB / Toilet Divider'          },
        ]);
        setArchElements([
          { id: 201, type: 'DOOR',        x: 600, y:  80, width: 50, rotation:  90, label: 'Main Entry Gate',       openDirection: 'RIGHT' },
          { id: 202, type: 'DOOR',        x: 120, y: 340, width: 44, rotation:   0, label: 'Canteen Side Entry',    openDirection: 'RIGHT' },
          { id: 203, type: 'DOOR',        x: 340, y: 200, width: 44, rotation:   0, label: 'Canteen-Lobby Door',    openDirection: 'LEFT'  },
          { id: 204, type: 'DOOR',        x: 430, y: 280, width: 44, rotation:  90, label: 'Electrical Room Door',  openDirection: 'RIGHT' },
          { id: 205, type: 'DOOR',        x: 635, y: 160, width: 44, rotation:   0, label: 'Reception Entry Door',  openDirection: 'RIGHT' },
          { id: 206, type: 'DOOR',        x: 855, y: 400, width: 44, rotation:   0, label: 'Monitor Room Door',     openDirection: 'LEFT'  },
          { id: 207, type: 'DOUBLE_DOOR', x: 890, y: 400, width: 60, rotation:   0, label: 'Director Entry Gate',   openDirection: 'RIGHT' },
          { id: 208, type: 'ELEVATOR',    x: 130, y: 150, width: 32, rotation:   0, label: 'Lift A'                                        },
          { id: 209, type: 'STAIRS',      x: 130, y: 240, width: 40, rotation:   0, label: 'Staircase GF'                                  },
          { id: 210, type: 'COLUMN',      x: 480, y:  80, width: 16, rotation:   0, label: 'Column-GF-1'                                   },
          { id: 211, type: 'COLUMN',      x: 760, y:  80, width: 16, rotation:   0, label: 'Column-GF-2'                                   },
          { id: 212, type: 'WINDOW',      x: 420, y:  80, width: 80, rotation:   0, label: 'Window North A'                                },
          { id: 213, type: 'WINDOW',      x: 770, y:  80, width: 80, rotation:   0, label: 'Window North B'                                },
          { id: 214, type: 'WINDOW',      x: 960, y:  80, width: 80, rotation:   0, label: 'Window North C'                                },
          { id: 215, type: 'DOOR',        x: 890, y: 460, width: 44, rotation:   0, label: 'AFSB Office Door',      openDirection: 'RIGHT' },
          { id: 216, type: 'DOOR',        x: 1010, y: 460, width: 44, rotation:   0, label: 'Right Restrooms Door',  openDirection: 'LEFT'  },
          { id: 217, type: 'DOOR',        x: 890, y: 220, width: 44, rotation:   0, label: 'Data Office Door',      openDirection: 'RIGHT' },
        ]);

      } else if (activeFloor === 1) {
        // ════════════════════════════════════════════════════════════════
        //  AREA A — INTERMEDIATE FLOOR
        //  Key areas: CMS Room, CMS Maintenance, CHS Executives, Radio
        //  Interface, Automation Servers, Cyber TAC, UHF/VCS, Battery,
        //  Fallback Servers, Commercial
        // ════════════════════════════════════════════════════════════════
        setPlacedCams(ALPHA2_AREA_A_CAMERAS.map(c => ({
          id: c.id, x: c.x, y: c.y, angle: c.angle, fov: c.fov,
          name: c.name, status: c.status,
          rtsp_url: `rtsp://10.0.2.${c.id - 9100}:554/stream1`,
          location: c.location, is_overhead: c.is_overhead,
        })));
        setDrawnZones([
          { id: 301, name: 'CMS Server Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y: 300 }, { x: 340, y: 300 }, { x: 340, y: 490 }, { x:  80, y: 490 }] },
          { id: 302, name: 'Automation Server Room (AMS)', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y: 490 }, { x: 255, y: 490 }, { x: 255, y: 720 }, { x:  80, y: 720 }] },
          { id: 303, name: 'Cyber Security & AMS TAC Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 255, y: 490 }, { x: 440, y: 490 }, { x: 440, y: 720 }, { x: 255, y: 720 }] },
          { id: 304, name: 'UHF/VCS/Data/GTR Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 440, y: 490 }, { x: 590, y: 490 }, { x: 590, y: 720 }, { x: 440, y: 720 }] },
          { id: 305, name: 'Battery Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 590, y: 490 }, { x: 740, y: 490 }, { x: 740, y: 720 }, { x: 590, y: 720 }] },
          { id: 306, name: 'Fallback Servers Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 890, y: 490 }, { x: 1120, y: 490 }, { x: 1120, y: 720 }, { x: 890, y: 720 }] },
          { id: 307, name: 'CHS Executives Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 620, y:  80 }, { x: 860, y:  80 }, { x: 860, y: 300 }, { x: 620, y: 300 }] },
          { id: 308, name: 'Commercial Zone', type: 'LOUNGE', color: ZONE_COLORS.LOUNGE, dwell_alert_seconds: 1200, is_active: true,
            points: [{ x:  80, y:  80 }, { x: 340, y:  80 }, { x: 340, y: 170 }, { x:  80, y: 170 }] },
          { id: 309, name: 'Area A Entry Tripwire', type: 'TRIPWIRE', color: ZONE_COLORS.TRIPWIRE, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y:  80 }, { x: 200, y:  80 }, { x: 200, y: 140 }, { x:  80, y: 140 }] },
        ]);
        setWalls([
          // ── Outer perimeter
          { id: 401, startX:   80, startY:  80, endX: 1120, endY:  80, thickness: 8, color: WALL_COLOR, label: 'North Perimeter Wall' },
          { id: 402, startX:   80, startY:  80, endX:   80, endY: 720, thickness: 8, color: WALL_COLOR, label: 'West Perimeter Wall'  },
          { id: 403, startX: 1120, startY:  80, endX: 1120, endY: 720, thickness: 8, color: WALL_COLOR, label: 'East Perimeter Wall'  },
          { id: 404, startX:   80, startY: 720, endX: 1120, endY: 720, thickness: 8, color: WALL_COLOR, label: 'South Perimeter Wall' },
          // ── Server room row partition (lower third)
          { id: 405, startX:   80, startY: 490, endX: 1120, endY: 490, thickness: 6, color: WALL_COLOR, label: 'Server Room North Wall'      },
          // ── CMS Room block
          { id: 406, startX:   80, startY: 300, endX:  340, endY: 300, thickness: 5, color: WALL_COLOR, label: 'CMS Room South Wall'         },
          { id: 407, startX:  340, startY:  80, endX:  340, endY: 490, thickness: 5, color: WALL_COLOR, label: 'CMS Block East Wall'         },
          { id: 408, startX:  210, startY: 300, endX:  210, endY: 490, thickness: 4, color: WALL_COLOR, label: 'CMS Server Rack Divider'     },
          // ── CMS Maintenance Room (upper left)
          { id: 409, startX:   80, startY: 170, endX:  340, endY: 170, thickness: 4, color: WALL_COLOR, label: 'CMS Maintenance South Wall'  },
          // ── Central comms / radio / locker area
          { id: 410, startX:  340, startY: 300, endX:  620, endY: 300, thickness: 5, color: WALL_COLOR, label: 'Comms Room South Wall'       },
          { id: 411, startX:  480, startY: 300, endX:  480, endY: 490, thickness: 4, color: WALL_COLOR, label: 'Radio Room East Wall'        },
          // ── CHS Executive zone
          { id: 412, startX:  620, startY:  80, endX:  620, endY: 490, thickness: 5, color: WALL_COLOR, label: 'CHS Executive West Wall'     },
          { id: 413, startX:  620, startY: 300, endX:  860, endY: 300, thickness: 4, color: WALL_COLOR, label: 'Executive Room South Wall'   },
          { id: 414, startX:  860, startY:  80, endX:  860, endY: 490, thickness: 5, color: WALL_COLOR, label: 'Director East Partition'     },
          { id: 415, startX:  860, startY: 300, endX:  940, endY: 300, thickness: 4, color: WALL_COLOR, label: 'Director Office South Wall'  },
          { id: 416, startX:  940, startY:  80, endX:  940, endY: 490, thickness: 4, color: WALL_COLOR, label: 'Inner Office East Wall'      },
          // ── Server sub-partitions (lower section)
          { id: 417, startX:  255, startY: 490, endX:  255, endY: 720, thickness: 4, color: WALL_COLOR, label: 'Server Divider 1'            },
          { id: 418, startX:  440, startY: 490, endX:  440, endY: 720, thickness: 4, color: WALL_COLOR, label: 'Cyber TAC East Wall'         },
          { id: 419, startX:  590, startY: 490, endX:  590, endY: 720, thickness: 4, color: WALL_COLOR, label: 'UHF Room East Wall'          },
          { id: 420, startX:  740, startY: 490, endX:  740, endY: 720, thickness: 4, color: WALL_COLOR, label: 'Battery Room East Wall'      },
          { id: 421, startX:  890, startY: 490, endX:  890, endY: 720, thickness: 4, color: WALL_COLOR, label: 'Fallback Server Room W Wall' },
        ]);
        setArchElements([
          { id: 501, type: 'DOOR',     x: 210, y: 300, width: 44, rotation:  0, label: 'CMS Room Entry',          openDirection: 'RIGHT' },
          { id: 502, type: 'DOOR',     x: 340, y: 200, width: 44, rotation:  0, label: 'CMS Maintenance Entry',   openDirection: 'LEFT'  },
          { id: 503, type: 'DOOR',     x: 480, y: 390, width: 44, rotation:  0, label: 'Radio Room Entry',        openDirection: 'RIGHT' },
          { id: 504, type: 'DOOR',     x: 720, y: 390, width: 44, rotation:  0, label: 'Executive Room Entry',    openDirection: 'LEFT'  },
          { id: 505, type: 'DOOR',     x: 860, y: 200, width: 44, rotation:  0, label: 'Director Area Entry',     openDirection: 'RIGHT' },
          { id: 506, type: 'DOOR',     x: 350, y: 560, width: 44, rotation:  0, label: 'Cyber TAC Room Entry',    openDirection: 'RIGHT' },
          { id: 507, type: 'ELEVATOR', x: 130, y: 150, width: 32, rotation:  0, label: 'Lift A (Area A)'                                  },
          { id: 508, type: 'STAIRS',   x: 130, y: 240, width: 40, rotation:  0, label: 'Staircase Area A'                                 },
          { id: 509, type: 'COLUMN',   x: 480, y:  80, width: 16, rotation:  0, label: 'Column-AA-1'                                      },
          { id: 510, type: 'COLUMN',   x: 760, y:  80, width: 16, rotation:  0, label: 'Column-AA-2'                                      },
        ]);

      } else if (activeFloor === 2) {
        // ════════════════════════════════════════════════════════════════
        //  FIRST FLOOR ALPHA-2
        //  Key areas: ACC Rooms (4 bays), STM Room, WSO, APP Room,
        //  Training In-Charge, Training Support, Gents Rest Rooms (×3),
        //  Recreation Room, UPS Battery Room, Shower Cubicles
        // ════════════════════════════════════════════════════════════════
        setPlacedCams(ALPHA2_FF_CAMERAS.map(c => ({
          id: c.id, x: c.x, y: c.y, angle: c.angle, fov: c.fov,
          name: c.name, status: c.status,
          rtsp_url: `rtsp://10.0.3.${c.id - 9200}:554/stream1`,
          location: c.location, is_overhead: c.is_overhead,
        })));
        setDrawnZones([
          { id: 401, name: 'ACC Room — Bay 1', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 190, y: 380 }, { x: 370, y: 380 }, { x: 370, y: 720 }, { x: 190, y: 720 }] },
          { id: 402, name: 'ACC Room — Bay 2', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 370, y: 380 }, { x: 550, y: 380 }, { x: 550, y: 720 }, { x: 370, y: 720 }] },
          { id: 403, name: 'ACC Room — Bay 3', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 550, y: 380 }, { x: 730, y: 380 }, { x: 730, y: 720 }, { x: 550, y: 720 }] },
          { id: 404, name: 'ACC Room — Bay 4 (WSO)', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 730, y: 380 }, { x: 890, y: 380 }, { x: 890, y: 720 }, { x: 730, y: 720 }] },
          { id: 405, name: 'STM Telecom Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y: 380 }, { x: 190, y: 380 }, { x: 190, y: 720 }, { x:  80, y: 720 }] },
          { id: 406, name: 'APP Room', type: 'RESTRICTED', color: ZONE_COLORS.RESTRICTED, dwell_alert_seconds: 0, is_active: true,
            points: [{ x: 890, y: 380 }, { x: 1120, y: 380 }, { x: 1120, y: 720 }, { x: 890, y: 720 }] },
          { id: 407, name: 'Training Area', type: 'DWELL', color: ZONE_COLORS.DWELL, dwell_alert_seconds: 3600, is_active: true,
            points: [{ x: 260, y:  80 }, { x: 460, y:  80 }, { x: 460, y: 380 }, { x: 260, y: 380 }] },
          { id: 408, name: 'Recreation Room', type: 'LOUNGE', color: ZONE_COLORS.LOUNGE, dwell_alert_seconds: 1200, is_active: true,
            points: [{ x: 750, y:  80 }, { x: 925, y:  80 }, { x: 925, y: 380 }, { x: 750, y: 380 }] },
          { id: 409, name: 'First Floor Entry Tripwire', type: 'TRIPWIRE', color: ZONE_COLORS.TRIPWIRE, dwell_alert_seconds: 0, is_active: true,
            points: [{ x:  80, y:  80 }, { x: 200, y:  80 }, { x: 200, y: 140 }, { x:  80, y: 140 }] },
        ]);
        setWalls([
          // ── Outer perimeter
          { id: 601, startX:   80, startY:  80, endX: 1120, endY:  80, thickness: 8, color: WALL_COLOR, label: 'North Perimeter Wall' },
          { id: 602, startX:   80, startY:  80, endX:   80, endY: 720, thickness: 8, color: WALL_COLOR, label: 'West Perimeter Wall'  },
          { id: 603, startX: 1120, startY:  80, endX: 1120, endY: 720, thickness: 8, color: WALL_COLOR, label: 'East Perimeter Wall'  },
          { id: 604, startX:   80, startY: 720, endX: 1120, endY: 720, thickness: 8, color: WALL_COLOR, label: 'South Perimeter Wall' },
          // ── Upper/Lower split — ACC rooms occupy lower section
          { id: 605, startX:   80, startY: 380, endX: 1120, endY: 380, thickness: 6, color: WALL_COLOR, label: 'ACC Room North Wall'          },
          // ── Upper section (training, rest rooms, recreation)
          { id: 606, startX:   80, startY: 250, endX:  260, endY: 250, thickness: 4, color: WALL_COLOR, label: 'Shower Room South Wall'       },
          { id: 607, startX:  260, startY:  80, endX:  260, endY: 380, thickness: 5, color: WALL_COLOR, label: 'Shower/Staircase East Wall'   },
          { id: 608, startX:  260, startY: 180, endX:  460, endY: 180, thickness: 4, color: WALL_COLOR, label: 'Training In-Charge South Wall'},
          { id: 609, startX:  460, startY:  80, endX:  460, endY: 380, thickness: 5, color: WALL_COLOR, label: 'Training Room East Wall'      },
          { id: 610, startX:  550, startY:  80, endX:  550, endY: 380, thickness: 4, color: WALL_COLOR, label: 'Gents Rest Room 1 East Wall'  },
          { id: 611, startX:  650, startY:  80, endX:  650, endY: 380, thickness: 4, color: WALL_COLOR, label: 'Gents Rest Room 2 East Wall'  },
          { id: 612, startX:  750, startY:  80, endX:  750, endY: 380, thickness: 4, color: WALL_COLOR, label: 'Gents Rest Room 3 East Wall'  },
          { id: 613, startX:  925, startY:  80, endX:  925, endY: 380, thickness: 5, color: WALL_COLOR, label: 'Recreation Room East Wall'    },
          { id: 614, startX:  925, startY: 200, endX: 1120, endY: 200, thickness: 4, color: WALL_COLOR, label: 'UPS Battery Room South Wall'  },
          // ── ACC Room dividers (lower section)
          { id: 615, startX:  190, startY: 380, endX:  190, endY: 720, thickness: 5, color: WALL_COLOR, label: 'STM Room East Wall'            },
          { id: 616, startX:  370, startY: 380, endX:  370, endY: 720, thickness: 5, color: WALL_COLOR, label: 'ACC Bay 1 East Wall'           },
          { id: 617, startX:  550, startY: 380, endX:  550, endY: 720, thickness: 5, color: WALL_COLOR, label: 'ACC Bay 2 East Wall'           },
          { id: 618, startX:  730, startY: 380, endX:  730, endY: 720, thickness: 5, color: WALL_COLOR, label: 'ACC Bay 3 East Wall'           },
          { id: 619, startX:  890, startY: 380, endX:  890, endY: 720, thickness: 5, color: WALL_COLOR, label: 'APP/WSO Room West Wall'        },
        ]);
        setArchElements([
          { id: 701, type: 'DOOR',        x: 260, y: 155, width: 44, rotation:  0, label: 'Shower Room Entry',        openDirection: 'RIGHT' },
          { id: 702, type: 'DOOR',        x: 360, y: 180, width: 44, rotation: 90, label: 'Training In-Charge Entry', openDirection: 'LEFT'  },
          { id: 703, type: 'DOOR',        x: 460, y: 220, width: 44, rotation:  0, label: 'Training Support Entry',   openDirection: 'RIGHT' },
          { id: 704, type: 'DOUBLE_DOOR', x: 280, y: 380, width: 60, rotation: 90, label: 'ACC Bay 1 Entry',          openDirection: 'RIGHT' },
          { id: 705, type: 'DOOR',        x: 460, y: 380, width: 44, rotation: 90, label: 'ACC Bay 2 Entry',          openDirection: 'LEFT'  },
          { id: 706, type: 'DOOR',        x: 640, y: 380, width: 44, rotation: 90, label: 'ACC Bay 3 Entry',          openDirection: 'RIGHT' },
          { id: 707, type: 'DOOR',        x: 810, y: 380, width: 44, rotation: 90, label: 'ACC Bay 4/WSO Entry',      openDirection: 'LEFT'  },
          { id: 708, type: 'DOOR',        x: 135, y: 380, width: 44, rotation: 90, label: 'STM Room Entry',           openDirection: 'RIGHT' },
          { id: 709, type: 'DOOR',        x: 990, y: 380, width: 44, rotation: 90, label: 'APP Room Entry',           openDirection: 'LEFT'  },
          { id: 710, type: 'ELEVATOR',    x: 130, y: 200, width: 32, rotation:  0, label: 'Lift A (First Floor)'                             },
          { id: 711, type: 'STAIRS',      x: 130, y: 300, width: 40, rotation:  0, label: 'Staircase First Floor'                            },
          { id: 712, type: 'COLUMN',      x: 460, y:  80, width: 16, rotation:  0, label: 'Column-FF-1'                                      },
          { id: 713, type: 'COLUMN',      x: 750, y:  80, width: 16, rotation:  0, label: 'Column-FF-2'                                      },
        ]);
      }
      setIsDirty(false);
    }
    clearSelections();
  }, [activeFloor, token, cameras, zones, clearSelections, currentBuildingId]);

  const liveTracks = useStore((state) => state.tracks);

  // spawnAgents now accepts either inline (from HUD presets) or spawns default agents
  const spawnAgents = useCallback((freshAgents?: SimulatorAgent[]) => {
    const floorBounds = getFloorBounds(canvasSize.width, canvasSize.height);
    const width = floorBounds.right - floorBounds.left;
    const height = floorBounds.bottom - floorBounds.top;
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
      const x = floorBounds.left + ((i + 1) / (count + 1)) * width;
      const y = floorBounds.top + ((i * 73) % Math.max(60, Math.floor(height))) + 20;
      return {
        id: `sim-agent-${base + i}`,
        x,
        y: Math.min(floorBounds.bottom - 20, y),
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
  }, [addToast, canvasSize.height, canvasSize.width, getFloorBounds, setSimulatorAgents, setSimulatorTick, spawnBehavior, spawnCount]);

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // 0. Coverage Heatmap (Blind Spot Detection)
    if (showCoverageHeatmap) {
      // Draw semi-transparent red over the entire building footprint (representing blind spots by default)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)'; // nice soft red for blind spots
      ctx.fillRect(80, 80, 1040, 640);

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
        grad.addColorStop(0, 'rgba(34, 197, 94, 0.28)'); // bright green near camera
        grad.addColorStop(1, 'rgba(34, 197, 94, 0.02)'); // fades out
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();
      });
    }

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

    const floorBounds = getFloorBounds(canvas.width, canvas.height);
    const floorWidth = floorBounds.right - floorBounds.left;
    const floorHeight = floorBounds.bottom - floorBounds.top;
    const floorCenterX = floorBounds.left + floorWidth / 2;
    const floorCenterY = floorBounds.top + floorHeight / 2;

    // Security Gates / Scanners label (if demo security walls exist)
    if (walls.some(w => w.label === 'Security Wall N') && walls.some(w => w.label === 'Security Wall S')) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      const gateW = Math.max(24, Math.floor(floorWidth * 0.04));
      const gateH = Math.max(80, Math.floor(floorHeight * 0.26));
      const gateX = floorBounds.left + floorWidth * 0.3;
      const gateY = floorCenterY - gateH / 2;
      ctx.fillRect(gateX, gateY, gateW, gateH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '8px Outfit'; ctx.textAlign = 'center';
      ctx.fillText('X-RAY SCANNERS', gateX + gateW / 2, gateY + gateH / 2);
    }

    // Architectural Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const titleSize = Math.max(18, Math.min(32, Math.floor(floorWidth * 0.04)));
    ctx.font = `bold ${titleSize}px Outfit`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleY = floorBounds.top + Math.max(24, Math.floor(floorHeight * 0.08));
    ctx.fillText('DEPARTURES', floorBounds.left + floorWidth * 0.18, titleY);
    ctx.fillText('SECURITY CLEARANCE', floorCenterX, titleY);
    ctx.fillText('TERMINAL GATES', floorBounds.left + floorWidth * 0.82, titleY);

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
      ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.font = isSelected ? 'bold 11px Outfit' : '10px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(cam.name, cam.x, cam.y + 14);
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

    // 7. Live person dots — color-coded by identity
    if (tool === 'select' && !isSimulatorActive) {
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

  }, [placedCams, drawnZones, selectedCam, selectedZone, selectedWall, selectedArch, zoom, panX, panY, drawingZone, zoneType, tool, activeFloor, liveTracks, walls, archElements, drawingWall, wallPreviewEnd, pxPerFoot, measureUnit, showDimensions, getFloorBounds, isSimulatorActive, simulatorAgents, showCoverageHeatmap]);



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
            </div>
          </div>
          </>)}
        </div>

        {/* Center: Canvas Area */}
        <div className="layout-canvas-area" style={{ position: 'relative', minHeight: 0 }} ref={canvasAreaRef}>
          
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
              color: 'var(--white)', textShadow: '0 2px 10px rgba(0,0,0,0.8)'
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
