import type { ArchElement, FloorBounds, LayoutPoint, MeasureUnit, WallSegment } from './types';

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
  // Keep usable floor area stable across varied viewport sizes.
  const padX = Math.max(48, Math.floor(width * 0.06));
  const padY = Math.max(48, Math.floor(height * 0.08));
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

export function fitLayoutTemplateToBounds(
  walls: WallSegment[],
  archElements: ArchElement[],
  bounds: FloorBounds
): { walls: WallSegment[]; archElements: ArchElement[] } {
  if (walls.length === 0) return { walls, archElements };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.startX, w.endX);
    minY = Math.min(minY, w.startY, w.endY);
    maxX = Math.max(maxX, w.startX, w.endX);
    maxY = Math.max(maxY, w.startY, w.endY);
  }

  const srcW = Math.max(1, maxX - minX);
  const srcH = Math.max(1, maxY - minY);
  const targetPad = 8;
  const targetW = Math.max(1, bounds.right - bounds.left - targetPad * 2);
  const targetH = Math.max(1, bounds.bottom - bounds.top - targetPad * 2);
  const scale = Math.min(targetW / srcW, targetH / srcH);

  const fittedW = srcW * scale;
  const fittedH = srcH * scale;
  const offsetX = bounds.left + targetPad + (targetW - fittedW) / 2;
  const offsetY = bounds.top + targetPad + (targetH - fittedH) / 2;

  const mapX = (x: number) => offsetX + (x - minX) * scale;
  const mapY = (y: number) => offsetY + (y - minY) * scale;

  return {
    walls: walls.map((w) => ({
      ...w,
      startX: mapX(w.startX),
      startY: mapY(w.startY),
      endX: mapX(w.endX),
      endY: mapY(w.endY),
      thickness: Math.max(2, Math.min(10, w.thickness * Math.max(0.75, scale))),
    })),
    archElements: archElements.map((a) => ({
      ...a,
      x: mapX(a.x),
      y: mapY(a.y),
      width: Math.max(10, a.width * scale),
    })),
  };
}
