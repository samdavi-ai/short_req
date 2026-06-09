import { isPointInPolygon } from '../../layout-engine/geometry';
import type { FloorBounds, ZoneOnCanvas } from '../../layout-engine/types';
import type { SimulatorAgent, SimulatorEvent } from '../types';

function makeAlertEvent(
  kind: string,
  nowMs: number,
  agent: SimulatorAgent,
  zone: ZoneOnCanvas
): SimulatorEvent {
  return {
    id: `sim-alert-${kind}-${agent.id}-${zone.id}-${nowMs}`,
    type: 'ALERT_NEW',
    ts: nowMs,
    agentId: agent.id,
    zoneId: zone.id,
    payload: {
      alert_type: kind,
      severity: zone.type === 'RESTRICTED' ? 'HIGH' : 'MEDIUM',
      description: `${kind} for ${agent.id} in zone ${zone.name}`,
      zone_id: zone.id,
      zone_name: zone.name,
      timestamp: new Date(nowMs).toISOString(),
    },
  };
}

export function getAgentZones(agent: SimulatorAgent, zones: ZoneOnCanvas[]): number[] {
  return zones
    .filter((z) => z.is_active !== false && z.points.length >= 3 && isPointInPolygon({ x: agent.x, y: agent.y }, z.points))
    .map((z) => z.id);
}

export function evaluateZoneRules(params: {
  nowMs: number;
  prevAgent: SimulatorAgent;
  nextAgent: SimulatorAgent;
  zones: ZoneOnCanvas[];
  floorBounds: FloorBounds;
}): SimulatorEvent[] {
  const { nowMs, prevAgent, nextAgent, zones, floorBounds } = params;
  const events: SimulatorEvent[] = [];

  const prevZones = new Set(prevAgent.lastZones);
  const nextZones = new Set(getAgentZones(nextAgent, zones));
  nextAgent.lastZones = [...nextZones];

  for (const zone of zones) {
    if (zone.is_active === false) continue;

    const wasIn = prevZones.has(zone.id);
    const isIn = nextZones.has(zone.id);

    if (!wasIn && isIn) {
      nextAgent.zoneEnterTimes[zone.id] = nowMs;

      if (zone.type === 'RESTRICTED') {
        events.push(makeAlertEvent('RESTRICTED_ZONE', nowMs, nextAgent, zone));
      }
      if (zone.type === 'TRIPWIRE') {
        events.push(makeAlertEvent('TRIPWIRE_IN', nowMs, nextAgent, zone));
      }
    }

    if (wasIn && !isIn) {
      delete nextAgent.zoneEnterTimes[zone.id];
      if (zone.type === 'TRIPWIRE') {
        events.push(makeAlertEvent('TRIPWIRE_OUT', nowMs, nextAgent, zone));
      }
    }

    if (zone.type === 'DWELL' && isIn) {
      const entered = nextAgent.zoneEnterTimes[zone.id] ?? nowMs;
      const dwellMs = nowMs - entered;
      const dwellLimitMs = (zone.dwell_alert_seconds ?? 300) * 1000;
      const bucketPrev = Math.floor((nowMs - 50) / dwellLimitMs);
      const bucketNow = Math.floor(nowMs / dwellLimitMs);
      if (dwellMs >= dwellLimitMs && bucketNow > bucketPrev) {
        events.push(makeAlertEvent('DWELL_EXCEEDED', nowMs, nextAgent, zone));
      }
    }
  }

  nextAgent.x = Math.min(floorBounds.right, Math.max(floorBounds.left, nextAgent.x));
  nextAgent.y = Math.min(floorBounds.bottom, Math.max(floorBounds.top, nextAgent.y));
  return events;
}
