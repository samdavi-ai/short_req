import React, { useMemo } from 'react';
import { Play, Pause, RotateCcw, Zap, Download, Upload, Users, AlertTriangle, Camera, Activity } from 'lucide-react';
import { useSimulatorStore } from '../stores/simulatorStore';
import type { AgentBehavior, SimulatorAgent } from '../features/simulator/types';
import { useStore } from '../stores/appStore';

// ── Alpha-2 Ground Floor — Kempegowda International Airport (BIAL) ────────────
// Source: Location Maps.pdf — Ground Floor Alpha-2 plan
// Scale: 41 m × 25 m building → ~25 px/m on 1040×640 canvas (offset 80,80)
export const KEMPEGOWDA_CAMERAS = [
  { id: 9001, name: 'CAM-GF-01 · Main Entry',           location: 'Main Entry Gate (North)',        x: 600, y:  95, angle: 180, fov:  90, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9002, name: 'CAM-GF-02 · Canteen Hall',         location: 'BIAL Canteen — Dining',          x: 200, y: 400, angle: 270, fov: 110, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: true  },
  { id: 9003, name: 'CAM-GF-03 · Canteen Kitchen',      location: 'BIAL Canteen — Kitchen',         x: 200, y: 580, angle:   0, fov:  90, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: true  },
  { id: 9004, name: 'CAM-GF-04 · Lobby/Lift Area',      location: 'Building Lobby — Lift Area',     x: 230, y: 230, angle:  90, fov:  80, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9005, name: 'CAM-GF-05 · Electrical Room',      location: 'LT MCC HV Electrical Room',     x: 400, y: 160, angle: 180, fov:  60, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9006, name: 'CAM-GF-06 · Gents Toilet',         location: 'Gents Toilet Corridor',         x: 445, y: 360, angle:   0, fov:  70, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9007, name: 'CAM-GF-07 · Ladies Toilet',        location: 'Ladies Toilet Corridor',        x: 580, y: 360, angle: 180, fov:  70, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9008, name: 'CAM-GF-08 · Area of Stay',         location: 'Area of Stay — Waiting',        x: 595, y: 440, angle: 270, fov: 100, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: true  },
  { id: 9009, name: 'CAM-GF-09 · Reception Desk',       location: 'Main Reception Counter',        x: 730, y: 160, angle: 180, fov: 100, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9010, name: 'CAM-GF-10 · Reception Entry',      location: 'Reception — North Entry',       x: 688, y:  95, angle: 180, fov:  80, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9011, name: 'CAM-GF-11 · Storage/Legal',        location: 'Storage / Legal Room',          x: 680, y: 490, angle:   0, fov:  60, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9012, name: 'CAM-GF-12 · Monitor Room',         location: 'Monitor / Policy Room',         x: 842, y: 390, angle:  90, fov:  70, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9013, name: 'CAM-GF-13 · Director Entry',       location: 'Airport Director — Entry',      x: 950, y:  95, angle: 180, fov:  80, status: 'ACTIVE'      as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: false },
  { id: 9014, name: 'CAM-GF-14 · Director Corridor',    location: 'Director Offices — Corridor',   x: 990, y: 400, angle: 270, fov:  90, status: 'MAINTENANCE' as const, model: 'CP-UNC-TB21ZL65-VMDS-V2', make: 'CP PLUS', is_overhead: true  },
];

// Preset agent names (synthetic airport personas)
const AGENT_NAMES = [
  'Rahul Sharma', 'Priya Nair', 'Amit Patel', 'Sunita Reddy', 'Mohammed Khan',
  'Divya Menon', 'Ravi Kumar', 'Anjali Singh', 'Suresh Rao', 'Neha Gupta',
  'Arjun Verma', 'Kavitha Iyer', 'Vijay Thomas', 'Meena Pillai', 'Rohan Das',
  'Swati Joshi', 'Kiran Bhat', 'Lakshmi Naidu', 'Arun Krishnan', 'Pooja Saxena',
];

const AGENT_COLORS: Record<string, string> = {
  UNKNOWN:         '#94a3b8',
  KNOWN_VISITOR:   '#3b82f6',
  KNOWN_EMPLOYEE:  '#22c55e',
  WATCHLIST:       '#f59e0b',
};

const EVENT_ICON: Record<string, string> = {
  ALERT_NEW:      '⚠️',
  CAMERA_DETECT:  '📷',
  ZONE_ENTER:     '▶',
  ZONE_EXIT:      '◀',
  TRACK_UPDATE:   '·',
  ENTRY:          '🚪',
  EXIT:           '🏁',
};

const EVENT_COLOR: Record<string, string> = {
  ALERT_NEW:      '#ef4444',
  CAMERA_DETECT:  '#00f0ff',
  ZONE_ENTER:     '#22c55e',
  ZONE_EXIT:      '#f59e0b',
  TRACK_UPDATE:   '#64748b',
  ENTRY:          '#6366f1',
  EXIT:           '#8b5cf6',
};

// ── Scenario Presets ───────────────────────────────────────────────────────────
interface ScenarioPreset {
  name: string;
  icon: string;
  description: string;
  agentCount: number;
  behaviors: AgentBehavior[];
  speed: number;
  identityMix: { type: string; weight: number }[];
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    name: 'Morning Rush',
    icon: '🌅',
    description: '45 passengers, mixed behavior, high traffic',
    agentCount: 45,
    behaviors: ['roam', 'direct', 'direct'],
    speed: 1.5,
    identityMix: [
      { type: 'KNOWN_VISITOR', weight: 0.5 },
      { type: 'UNKNOWN', weight: 0.4 },
      { type: 'KNOWN_EMPLOYEE', weight: 0.1 },
    ],
  },
  {
    name: 'Security Incident',
    icon: '🚨',
    description: '12 agents, 2 watchlist intruders near restricted zone',
    agentCount: 12,
    behaviors: ['roam', 'patrol'],
    speed: 1.0,
    identityMix: [
      { type: 'WATCHLIST', weight: 0.17 },
      { type: 'KNOWN_VISITOR', weight: 0.33 },
      { type: 'UNKNOWN', weight: 0.5 },
    ],
  },
  {
    name: 'VIP Arrival',
    icon: '🌟',
    description: '8 agents, 1 VIP employee escort, 3 security patrol',
    agentCount: 8,
    behaviors: ['direct', 'patrol'],
    speed: 0.8,
    identityMix: [
      { type: 'KNOWN_EMPLOYEE', weight: 0.5 },
      { type: 'KNOWN_VISITOR', weight: 0.38 },
      { type: 'UNKNOWN', weight: 0.12 },
    ],
  },
  {
    name: 'Night Patrol',
    icon: '🌙',
    description: '6 security staff patrolling all zones',
    agentCount: 6,
    behaviors: ['patrol'],
    speed: 0.7,
    identityMix: [
      { type: 'KNOWN_EMPLOYEE', weight: 1.0 },
    ],
  },
  {
    name: 'Stress Test',
    icon: '⚡',
    description: '64 agents, maximum load simulation',
    agentCount: 64,
    behaviors: ['roam', 'direct', 'loiter'],
    speed: 2.5,
    identityMix: [
      { type: 'UNKNOWN', weight: 0.6 },
      { type: 'KNOWN_VISITOR', weight: 0.3 },
      { type: 'WATCHLIST', weight: 0.05 },
      { type: 'KNOWN_EMPLOYEE', weight: 0.05 },
    ],
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onSpawn: (agents: SimulatorAgent[]) => void;
  onExport: () => void;
  onImport: (file?: File) => void;
  floorBounds: { left: number; right: number; top: number; bottom: number };
  runTick: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SimulatorHUD({ onSpawn, onExport, onImport, floorBounds, runTick }: Props) {
  const running        = useSimulatorStore(s => s.running);
  const tick           = useSimulatorStore(s => s.tick);
  const agents         = useSimulatorStore(s => s.agents);
  const timeline       = useSimulatorStore(s => s.timeline);
  const speed          = useSimulatorStore(s => s.speed);
  const stats          = useSimulatorStore(s => s.stats);
  const overlays       = useSimulatorStore(s => s.overlays);
  const setRunning     = useSimulatorStore(s => s.setRunning);
  const setSpeed       = useSimulatorStore(s => s.setSpeed);
  const resetSim       = useSimulatorStore(s => s.reset);
  const setOverlay     = useSimulatorStore(s => s.setOverlay);
  const { visitors, employees } = useStore();

  // Visible event log (exclude noisy TRACK_UPDATE)
  const visibleEvents = useMemo(() =>
    timeline.filter(e => e.type !== 'TRACK_UPDATE').slice(-60).reverse(),
    [timeline]
  );

  // Build agents from a preset
  function applyPreset(preset: ScenarioPreset) {
    resetSim();
    const { left, right, top, bottom } = floorBounds;
    const w = right - left;
    const h = bottom - top;

    // Identity pool from enrolled users
    const enrolledVisitors = visitors.map(v => ({ name: v.fullname, type: 'KNOWN_VISITOR' }));
    const enrolledEmployees = employees.map(e => ({ name: e.fullname, type: 'KNOWN_EMPLOYEE' }));
    const allIdentities = [...enrolledEmployees, ...enrolledVisitors];

    const newAgents: SimulatorAgent[] = Array.from({ length: preset.agentCount }).map((_, i) => {
      // Weighted identity selection
      const rand = Math.random();
      let cumWeight = 0;
      let identityType: string = 'UNKNOWN';
      for (const mix of preset.identityMix) {
        cumWeight += mix.weight;
        if (rand < cumWeight) { identityType = mix.type; break; }
      }

      // Pick a name
      let name: string | undefined;
      if (identityType === 'KNOWN_VISITOR' || identityType === 'KNOWN_EMPLOYEE') {
        const pool = identityType === 'KNOWN_EMPLOYEE' ? enrolledEmployees : enrolledVisitors;
        const src = pool.length > 0 ? pool : [{ name: AGENT_NAMES[i % AGENT_NAMES.length], type: identityType }];
        name = src[i % src.length].name;
      } else if (identityType === 'WATCHLIST') {
        name = `WATCHLIST-${String(i + 1).padStart(3, '0')}`;
      }

      const behavior = preset.behaviors[i % preset.behaviors.length];
      const spawnX = left + 60 + Math.random() * (w - 120);
      const spawnY = top + 60 + Math.random() * (h - 120);

      return {
        id: `sim-agent-${Date.now()}-${i}`,
        name,
        identityType: identityType as SimulatorAgent['identityType'],
        color: AGENT_COLORS[identityType] ?? '#94a3b8',
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        speed: (30 + Math.random() * 30) * (preset.speed),
        behavior,
        headingDeg: Math.random() * 360,
        trail: [],
        zoneEnterTimes: {},
        lastZones: [],
        detectedByCameras: [],
        alertState: 'none',
      };
    });

    setSpeed(preset.speed);
    onSpawn(newAgents);
  }

  const gridCell = { padding: '6px 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 11 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minHeight: 0 }}>

      {/* ── Play Controls ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 10 }}>
          🎬 Simulation Controls
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
          <button
            id="sim-play-pause-btn"
            className="btn btn-primary"
            style={{ padding: '8px 4px', fontSize: 12, justifyContent: 'center', gap: 4 }}
            onClick={() => setRunning(!running)}
          >
            {running ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Play</>}
          </button>
          <button
            id="sim-step-btn"
            className="btn btn-secondary"
            style={{ padding: '8px 4px', fontSize: 12, justifyContent: 'center', gap: 4 }}
            onClick={runTick}
            disabled={running}
          >
            <Zap size={12} /> Step
          </button>
          <button
            id="sim-reset-btn"
            className="btn btn-ghost"
            style={{ padding: '8px 4px', fontSize: 12, justifyContent: 'center', gap: 4 }}
            onClick={resetSim}
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        {/* Speed slider */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>Simulation Speed</span>
            <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{speed.toFixed(1)}×</span>
          </div>
          <input
            id="sim-speed-slider"
            type="range" min="0.25" max="5" step="0.25"
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--cyan)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-ghost)' }}>
            <span>0.25×</span><span>5×</span>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          Tick #{tick} · {agents.length} agents
        </div>
      </div>

      {/* ── Live Stats ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 10 }}>
          📊 Live Stats
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { icon: <Users size={11} />, label: 'On Floor', value: agents.length, color: 'var(--cyan)' },
            { icon: <AlertTriangle size={11} />, label: 'Alerts', value: stats.totalAlerts, color: '#ef4444' },
            { icon: <Camera size={11} />, label: 'Detections', value: stats.cameraDetections, color: '#22c55e' },
            { icon: <Activity size={11} />, label: 'Events', value: timeline.filter(e => e.type !== 'TRACK_UPDATE').length, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ ...gridCell, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'var(--text-ghost)', marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Preset Scenarios ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 10 }}>
          🎯 Preset Scenarios
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SCENARIO_PRESETS.map(preset => (
            <button
              key={preset.name}
              id={`sim-preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', padding: '8px 10px', gap: 8, textAlign: 'left' }}
              onClick={() => applyPreset(preset)}
            >
              <span style={{ fontSize: 16 }}>{preset.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.2 }}>{preset.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-ghost)', marginTop: 2 }}>{preset.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Overlay Toggles ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 10 }}>
          👁️ Overlays
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.entries(overlays) as [string, boolean][]).map(([key, val]) => {
            const labels: Record<string, string> = {
              heatmap: '🔥 Dwell Heatmap',
              trails: '🔵 Agent Trails',
              fovCones: '📷 FoV Cones',
              zoneOccupancy: '🟦 Zone Count Badges',
              cameraDetectionFlash: '⚡ Camera Flash',
              agentLabels: '🏷️ Name Labels',
            };
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: val ? 'var(--text-primary)' : 'var(--text-ghost)' }}>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => setOverlay(key as any, e.target.checked)}
                  style={{ accentColor: 'var(--cyan)' }}
                />
                {labels[key] ?? key}
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Event Log ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 12, borderRadius: 'var(--radius-lg)', flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 8 }}>
          📋 Event Log
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
          {visibleEvents.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-ghost)', textAlign: 'center', padding: '12px 0' }}>
              No events yet — press Play to start
            </div>
          )}
          {visibleEvents.map(ev => (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '4px 6px', borderRadius: 6,
              background: ev.type === 'ALERT_NEW' ? 'rgba(239,68,68,0.08)' : 'transparent',
              borderLeft: `2px solid ${EVENT_COLOR[ev.type] ?? '#334155'}`,
              fontSize: 10,
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>{EVENT_ICON[ev.type] ?? '·'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: EVENT_COLOR[ev.type] ?? 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.3 }}>
                  {ev.type === 'ALERT_NEW' ? String(ev.payload?.alert_type ?? 'ALERT') : ev.type}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.agentName ?? ev.agentId.replace('sim-agent-', 'A-').slice(0, 20)}
                  {ev.payload?.zone_name ? ` · ${String(ev.payload.zone_name)}` : ''}
                  {ev.cameraId ? ` · Cam ${ev.cameraId}` : ''}
                </div>
                <div style={{ color: 'var(--text-ghost)', fontSize: 8, marginTop: 1 }}>
                  {new Date(ev.ts).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Export / Import ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button id="sim-export-btn" className="btn btn-ghost" style={{ flex: 1, fontSize: 11, gap: 4 }} onClick={onExport}>
          <Download size={11} /> Export
        </button>
        <label id="sim-import-label" className="btn btn-ghost" style={{ flex: 1, fontSize: 11, gap: 4, cursor: 'pointer' }}>
          <Upload size={11} /> Import
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => onImport(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

