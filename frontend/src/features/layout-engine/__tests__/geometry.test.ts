import { clampToFloorBounds, formatLength, getFloorBounds, isPointInPolygon } from '../geometry';

function assert(name: string, condition: boolean): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${name}`);
  }
}

export function runGeometryTests(): void {
  const inside = isPointInPolygon(
    { x: 5, y: 5 },
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
  );
  assert('point in polygon', inside);

  const bounds = getFloorBounds(1000, 700);
  const clamped = clampToFloorBounds(-10, 1200, bounds, 12);
  assert('x clamped', clamped.x >= bounds.left);
  assert('y clamped', clamped.y <= bounds.bottom);

  const label = formatLength(200, 20, 'ft');
  assert('format length feet', label.includes("'"));
}

if (typeof window === 'undefined') {
  runGeometryTests();
}
