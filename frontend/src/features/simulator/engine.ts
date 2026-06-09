import { evaluateZoneRules } from './rules/zoneRules';
import type { FloorBounds, ZoneOnCanvas } from '../layout-engine/types';
import type { SimulatorAgent, SimulatorEvent } from './types';

const TWO_PI = Math.PI * 2;
const TRAIL_MAX = 240;
const STEERING_FACTOR = 0.18;    // how quickly agents turn toward target heading
const WALL_REPULSE_DIST = 22;    // pixels — agents start steering away from walls

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cloneAgent(agent: SimulatorAgent): SimulatorAgent {
  return {
    ...agent,
    trail: [...agent.trail],
    zoneEnterTimes: { ...agent.zoneEnterTimes },
    lastZones: [...agent.lastZones],
    waypoints: agent.waypoints ? [...agent.waypoints.map(w => ({ ...w }))] : undefined,
    detectedByCameras: agent.detectedByCameras ? [...agent.detectedByCameras] : [],
  };
}

/** Smooth steer toward target heading using exponential decay */
function steerToward(currentDeg: number, targetDeg: number, factor: number): number {
  let diff = ((targetDeg - currentDeg + 540) % 360) - 180;
  return (currentDeg + diff * factor + 360) % 360;
}

function nextVelocity(
  agent: SimulatorAgent,
  rand: () => number,
  walls: WallSegment[],
  bounds: FloorBounds
): { vx: number; vy: number; headingDeg: number } {
  let targetHeading = agent.headingDeg;

  // ── Waypoint pathfinding ────────────────────────────────────────────────
  if (agent.waypoints && agent.waypoints.length > 0) {
    const wp = agent.waypoints[0];
    const dx = wp.x - agent.x;
    const dy = wp.y - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 18) {
      // arrived at waypoint — pop it
      agent.waypoints.shift();
    } else {
      targetHeading = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    }
  } else {
    // ── Behavior-based heading ─────────────────────────────────────────────
    if (agent.behavior === 'direct') {
      targetHeading = agent.headingDeg; // keep straight
    } else if (agent.behavior === 'patrol') {
      targetHeading = (agent.headingDeg + (rand() * 30 - 15) + 360) % 360;
    } else if (agent.behavior === 'loiter') {
      // slow random wander with big turns
      if (rand() < 0.08) targetHeading = rand() * 360;
    } else if (agent.behavior === 'rush') {
      targetHeading = (agent.headingDeg + (rand() * 20 - 10) + 360) % 360;
    } else {
      // roam — gentle random drift
      targetHeading = (agent.headingDeg + (rand() * 60 - 30) + 360) % 360;
    }
  }

  // ── Wall repulsion ─────────────────────────────────────────────────────
  let repulseX = 0;
  let repulseY = 0;
  for (const wall of walls) {
    const dist = distToSegment(agent.x, agent.y, wall.startX, wall.startY, wall.endX, wall.endY);
    if (dist < WALL_REPULSE_DIST && dist > 0) {
      // vector from nearest wall point to agent
      const nx = agent.x - nearestPointOnSegment(agent.x, agent.y, wall).x;
      const ny = agent.y - nearestPointOnSegment(agent.x, agent.y, wall).y;
      const strength = (WALL_REPULSE_DIST - dist) / WALL_REPULSE_DIST;
      repulseX += nx * strength;
      repulseY += ny * strength;
    }
  }

  // ── Boundary repulsion ─────────────────────────────────────────────────
  const edgePad = 40;
  if (agent.x - bounds.left < edgePad) repulseX += (edgePad - (agent.x - bounds.left)) * 0.4;
  if (bounds.right - agent.x < edgePad) repulseX -= (edgePad - (bounds.right - agent.x)) * 0.4;
  if (agent.y - bounds.top < edgePad) repulseY += (edgePad - (agent.y - bounds.top)) * 0.4;
  if (bounds.bottom - agent.y < edgePad) repulseY -= (edgePad - (bounds.bottom - agent.y)) * 0.4;

  if (Math.abs(repulseX) + Math.abs(repulseY) > 1) {
    const repulseHeading = ((Math.atan2(repulseY, repulseX) * 180) / Math.PI + 360) % 360;
    targetHeading = steerToward(targetHeading, repulseHeading, 0.6);
  }

  // ── Smooth steering toward target ─────────────────────────────────────
  const newHeading = steerToward(agent.headingDeg, targetHeading, STEERING_FACTOR);
  const speed = agent.behavior === 'loiter' ? agent.speed * 0.35 : agent.speed;
  const ang = (newHeading * Math.PI) / 180;

  return {
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    headingDeg: newHeading,
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

export interface WallSegment {
  id: number;
  startX: number; startY: number;
  endX: number;   endY: number;
  thickness: number;
}

function nearestPointOnSegment(px: number, py: number, wall: WallSegment): { x: number; y: number } {
  const dx = wall.endX - wall.startX;
  const dy = wall.endY - wall.startY;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: wall.startX, y: wall.startY };
  const t = Math.max(0, Math.min(1, ((px - wall.startX) * dx + (py - wall.startY) * dy) / lenSq));
  return { x: wall.startX + t * dx, y: wall.startY + t * dy };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2);
}

// ── Camera FoV detection ──────────────────────────────────────────────────────

export interface CamOnCanvas {
  id: number;
  x: number;
  y: number;
  angle: number; // degrees
  fov: number;   // degrees
}

function isAgentInCameraFoV(agent: SimulatorAgent, cam: CamOnCanvas): boolean {
  const dx = agent.x - cam.x;
  const dy = agent.y - cam.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 140) return false; // max range
  const agentAngle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  let diff = Math.abs(agentAngle - cam.angle) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff < cam.fov / 2;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TickInput {
  nowMs: number;
  dtSec: number;
  bounds: FloorBounds;
  zones: ZoneOnCanvas[];
  agents: SimulatorAgent[];
  cameras?: CamOnCanvas[];
  walls?: WallSegment[];
  seed: number;
}

export interface TickOutput {
  agents: SimulatorAgent[];
  events: SimulatorEvent[];
  heatmapUpdates: { key: string; value: number }[];
}

export function tickSimulation(input: TickInput): TickOutput {
  const rand = seeded((input.seed ^ Math.floor(input.nowMs / 17)) >>> 0);
  const events: SimulatorEvent[] = [];
  const heatmapUpdates: { key: string; value: number }[] = [];
  const walls: WallSegment[] = input.walls ?? [];
  const cameras: CamOnCanvas[] = input.cameras ?? [];

  const agents = input.agents.map((agent) => {
    const prev = cloneAgent(agent);
    const next = cloneAgent(agent);

    const vel = nextVelocity(next, rand, walls, input.bounds);
    next.vx = vel.vx;
    next.vy = vel.vy;
    next.headingDeg = vel.headingDeg;

    next.x += next.vx * input.dtSec;
    next.y += next.vy * input.dtSec;

    // Hard clamp to bounds
    next.x = Math.min(input.bounds.right - 10, Math.max(input.bounds.left + 10, next.x));
    next.y = Math.min(input.bounds.bottom - 10, Math.max(input.bounds.top + 10, next.y));

    // Reverse heading if at boundary
    if (next.x <= input.bounds.left + 10 || next.x >= input.bounds.right - 10) {
      next.headingDeg = (180 - next.headingDeg + 360) % 360;
    }
    if (next.y <= input.bounds.top + 10 || next.y >= input.bounds.bottom - 10) {
      next.headingDeg = (360 - next.headingDeg + 360) % 360;
    }

    // Trail
    next.trail = [...next.trail, { x: next.x, y: next.y, t: input.nowMs }].slice(-TRAIL_MAX);

    // Heatmap update — grid cell 20×20 px
    const hKey = `${Math.floor(next.x / 20)},${Math.floor(next.y / 20)}`;
    heatmapUpdates.push({ key: hKey, value: 1 });

    // Zone rules
    const ruleEvents = evaluateZoneRules({
      nowMs: input.nowMs,
      prevAgent: prev,
      nextAgent: next,
      zones: input.zones,
      floorBounds: input.bounds,
    });
    // Attach agent name to events
    for (const ev of ruleEvents) {
      (ev as any).agentName = next.name;
    }
    events.push(...ruleEvents);

    // Set agent alert state
    if (ruleEvents.some(e => e.payload?.alert_type === 'RESTRICTED_ZONE')) {
      next.alertState = 'restricted';
      next.alertAt = input.nowMs;
    } else if (ruleEvents.some(e => e.payload?.alert_type === 'DWELL_EXCEEDED')) {
      next.alertState = 'dwell';
      next.alertAt = input.nowMs;
    } else if (next.alertAt && input.nowMs - next.alertAt > 3000) {
      next.alertState = 'none';
    }

    // Camera FoV detection
    const detected: number[] = [];
    for (const cam of cameras) {
      if (isAgentInCameraFoV(next, cam)) {
        detected.push(cam.id);
        const alreadyDetected = (prev.detectedByCameras ?? []).includes(cam.id);
        if (!alreadyDetected) {
          events.push({
            id: `sim-camdetect-${cam.id}-${next.id}-${input.nowMs}`,
            type: 'CAMERA_DETECT',
            ts: input.nowMs,
            agentId: next.id,
            agentName: next.name,
            cameraId: cam.id,
            payload: {
              camera_id: cam.id,
              agent_id: next.id,
              agent_name: next.name,
              timestamp: new Date(input.nowMs).toISOString(),
            },
          });
          // face-capture detection for face-type cameras
          if (!next.faceCaptured) {
            next.faceCaptured = true;
          }
        }
      }
    }
    next.detectedByCameras = detected;

    // TRACK_UPDATE event
    events.push({
      id: `sim-track-${next.id}-${input.nowMs}`,
      type: 'TRACK_UPDATE',
      ts: input.nowMs,
      agentId: next.id,
      agentName: next.name,
      payload: {
        global_id: next.id,
        track_id: Number(next.id.replace(/\D/g, '').slice(-6) || '0'),
        x: next.x,
        y: next.y,
        timestamp: Math.floor(input.nowMs / 1000),
      },
    });

    return next;
  });

  return { agents, events, heatmapUpdates };
}
