import type { FloorBounds, LayoutPoint, MeasureUnit, WallSegment } from './types';

export function isPointInPolygon(point: LayoutPoint, vertices: LayoutPoint[]): boolean {
  const x = point.x;
  const y = point.y;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getWallLengthPx(wall: WallSegment): number {
  return Math.sqrt((wall.endX - wall.startX) ** 2 + (wall.endY - wall.startY) ** 2);
}

export function getWallAngleDeg(wall: WallSegment): number {
  const rad = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function pxToUnit(px: number, pxPerFoot: number, unit: MeasureUnit): number {
  const feet = px / pxPerFoot;
  if (unit === 'ft') return feet;
  return feet * 0.3048;
}

export function unitToPx(value: number, pxPerFoot: number, unit: MeasureUnit): number {
  if (unit === 'ft') return value * pxPerFoot;
  return (value / 0.3048) * pxPerFoot;
}

export function formatLength(px: number, pxPerFoot: number, unit: MeasureUnit): string {
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

export function snapAngle(angleDeg: number): number {
  const snaps = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  let closest = snaps[0];
  let minDist = Math.abs(angleDeg - snaps[0]);
  for (const s of snaps) {
    const dist = Math.abs(angleDeg - s);
    if (dist < minDist) {
      minDist = dist;
      closest = s;
    }
  }
  return closest === 360 ? 0 : closest;
}

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export function getFloorBounds(width: number, height: number): FloorBounds {
  const padX = Math.max(80, Math.floor(width * 0.08));
  const padY = Math.max(80, Math.floor(height * 0.12));
  return {
    left: padX,
    top: padY,
    right: width - padX,
    bottom: height - padY,
  };
}

export function clampToFloorBounds(
  x: number,
  y: number,
  bounds: FloorBounds,
  radius = 12
): LayoutPoint {
  return {
    x: Math.min(bounds.right - radius, Math.max(bounds.left + radius, x)),
    y: Math.min(bounds.bottom - radius, Math.max(bounds.top + radius, y)),
  };
}
