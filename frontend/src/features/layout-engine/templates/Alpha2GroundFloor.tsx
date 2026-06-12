import type { WallSegment } from '../types';
import { ALPHA2_GROUND_WALLS_DXF } from './alpha2DxfTemplates';

type RawDxfWall = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  color: string;
  label: string;
};

const WALL_COLOR = '#111111';

const dxfToWallSegment = (wall: RawDxfWall): WallSegment => ({
  id: wall.id,
  startX: wall.startX,
  startY: wall.startY,
  endX: wall.endX,
  endY: wall.endY,
  thickness: Math.max(3, wall.thickness),
  color: wall.color || WALL_COLOR,
  label: `GF ${wall.label}`,
});

export const ALPHA2_GROUND_FLOOR_WALLS: WallSegment[] =
  ALPHA2_GROUND_WALLS_DXF.map((wall) => dxfToWallSegment(wall as RawDxfWall));

export function getAlpha2GroundFloorWalls(): WallSegment[] {
  return ALPHA2_GROUND_FLOOR_WALLS.map((wall) => ({ ...wall }));
}

export default ALPHA2_GROUND_FLOOR_WALLS;
