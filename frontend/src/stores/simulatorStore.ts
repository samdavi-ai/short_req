import { create } from 'zustand';
import type { ScenarioSnapshot, SimulatorAgent, SimulatorEvent, SimStats } from '../features/simulator/types';

// ── Overlay toggles ──────────────────────────────────────────────────────────
export interface SimulatorOverlays {
  heatmap: boolean;
  trails: boolean;
  fovCones: boolean;
  zoneOccupancy: boolean;
  cameraDetectionFlash: boolean;
  agentLabels: boolean;
}

interface SimulatorStore {
  enabled: boolean;
  mode: 'editor' | 'simulator';
  running: boolean;
  seed: number;
  speed: number;
  tick: number;
  pointer: number;
  agents: SimulatorAgent[];
  timeline: SimulatorEvent[];
  heatmap: Record<string, number>;           // grid-cell key → accumulated count
  stats: SimStats;
  overlays: SimulatorOverlays;
  // actions
  setMode: (mode: 'editor' | 'simulator') => void;
  setEnabled: (enabled: boolean) => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speed: number) => void;
  setTick: (tick: number) => void;
  setAgents: (agents: SimulatorAgent[]) => void;
  pushEvents: (events: SimulatorEvent[], heatUpdates?: {key: string; value: number}[]) => void;
  setPointer: (pointer: number) => void;
  setOverlay: (key: keyof SimulatorOverlays, val: boolean) => void;
  reset: () => void;
  exportSnapshot: (floor: number, buildingId: number | null, siteId: number | null, zones: any[]) => ScenarioSnapshot;
  importSnapshot: (snapshot: ScenarioSnapshot) => void;
}

const initialStats: SimStats = {
  totalOnFloor: 0,
  totalAlerts: 0,
  totalEntries: 0,
  totalExits: 0,
  avgDwellSec: 0,
  cameraDetections: 0,
};

const initialOverlays: SimulatorOverlays = {
  heatmap: true,
  trails: true,
  fovCones: true,
  zoneOccupancy: true,
  cameraDetectionFlash: true,
  agentLabels: true,
};

const initial = {
  enabled: true,
  mode: 'editor' as const,
  running: false,
  seed: 42,
  speed: 1,
  tick: 0,
  pointer: 0,
  agents: [] as SimulatorAgent[],
  timeline: [] as SimulatorEvent[],
  heatmap: {} as Record<string, number>,
  stats: initialStats,
  overlays: initialOverlays,
};

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  ...initial,
  setMode: (mode) => set({ mode, running: mode === 'simulator' ? get().running : false }),
  setEnabled: (enabled) => set({ enabled }),
  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  setTick: (tick) => set({ tick }),
  setAgents: (agents) => set({ agents }),
  setOverlay: (key, val) => set((s) => ({ overlays: { ...s.overlays, [key]: val } })),
  pushEvents: (events, heatUpdates) =>
    set((state) => {
      const allEvents = [...state.timeline, ...events].slice(-3000);
      // Update heatmap
      const newHeat = { ...state.heatmap };
      for (const u of (heatUpdates ?? [])) {
        newHeat[u.key] = (newHeat[u.key] ?? 0) + u.value;
      }
      // Update stats
      const alerts = allEvents.filter(e => e.type === 'ALERT_NEW').length;
      const camDetects = allEvents.filter(e => e.type === 'CAMERA_DETECT').length;
      const entries = allEvents.filter(e => e.type === 'ENTRY').length;
      const exits = allEvents.filter(e => e.type === 'EXIT').length;
      return {
        timeline: allEvents,
        pointer: Math.max(0, allEvents.length - 1),
        heatmap: newHeat,
        stats: {
          totalOnFloor: state.agents.length,
          totalAlerts: alerts,
          totalEntries: entries,
          totalExits: exits,
          avgDwellSec: 0,
          cameraDetections: camDetects,
        },
      };
    }),
  setPointer: (pointer) => set({ pointer }),
  reset: () =>
    set({
      running: false,
      tick: 0,
      pointer: 0,
      agents: [],
      timeline: [],
      heatmap: {},
      stats: initialStats,
    }),
  exportSnapshot: (floor, buildingId, siteId, zones) => {
    const s = get();
    return {
      version: 1,
      floor,
      buildingId,
      siteId,
      seed: s.seed,
      tick: s.tick,
      speed: s.speed,
      agents: s.agents,
      zones,
    };
  },
  importSnapshot: (snapshot) =>
    set({
      seed: snapshot.seed,
      tick: snapshot.tick,
      speed: snapshot.speed,
      agents: snapshot.agents,
      running: false,
      timeline: [],
      pointer: 0,
      heatmap: {},
      stats: initialStats,
    }),
}));
