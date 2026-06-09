import type { ZoneOnCanvas } from '../layout-engine/types';

export type AgentBehavior = 'patrol' | 'roam' | 'direct' | 'loiter' | 'rush';

export interface SimulatorAgent {
  id: string;
  name?: string;                              // real enrolled name (visitor/employee)
  identityType?: 'UNKNOWN' | 'KNOWN_VISITOR' | 'KNOWN_EMPLOYEE' | 'WATCHLIST';
  color?: string;                             // per-agent color override
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  behavior: AgentBehavior;
  headingDeg: number;
  trail: { x: number; y: number; t: number }[];
  zoneEnterTimes: Record<number, number>;
  lastZones: number[];
  waypoints?: { x: number; y: number }[];    // ordered path agent follows
  faceCaptured?: boolean;                     // seen by face-capture camera
  detectedByCameras?: number[];              // camera ids that have detected this agent
  alertState?: 'none' | 'dwell' | 'restricted'; // visual pulse state
  alertAt?: number;                          // timestamp when alert started (for pulse animation)
}

export type SimulatorAlertKind =
  | 'RESTRICTED_ZONE'
  | 'DWELL_EXCEEDED'
  | 'TRIPWIRE_IN'
  | 'TRIPWIRE_OUT'
  | 'CAMERA_DETECT'
  | 'FACE_CAPTURE';

export interface SimulatorEvent {
  id: string;
  type: 'TRACK_UPDATE' | 'ALERT_NEW' | 'CAMERA_DETECT' | 'ZONE_ENTER' | 'ZONE_EXIT' | 'ENTRY' | 'EXIT';
  ts: number;
  agentId: string;
  agentName?: string;
  zoneId?: number;
  cameraId?: number;
  payload: Record<string, unknown>;
}

export interface ScenarioSnapshot {
  version: 1;
  floor: number;
  buildingId: number | null;
  siteId: number | null;
  seed: number;
  tick: number;
  speed: number;
  agents: SimulatorAgent[];
  zones: ZoneOnCanvas[];
}

export interface SimStats {
  totalOnFloor: number;
  totalAlerts: number;
  totalEntries: number;
  totalExits: number;
  avgDwellSec: number;
  cameraDetections: number;
}
