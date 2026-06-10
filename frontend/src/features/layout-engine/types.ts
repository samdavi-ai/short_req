export type MeasureUnit = 'ft' | 'm';

export type EditorTool = 'select' | 'zone' | 'wall' | 'arch';

export type ArchElementType =
  | 'DOOR'
  | 'DOUBLE_DOOR'
  | 'WINDOW'
  | 'COLUMN'
  | 'STAIRS'
  | 'ELEVATOR'
  | 'ACCESS_DOOR';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface CamOnCanvas {
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

export interface ZoneOnCanvas {
  id: number;
  name: string;
  points: LayoutPoint[];
  type: 'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE';
  color: string;
  dwell_alert_seconds?: number;
  is_active?: boolean;
}

export interface WallSegment {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  color: string;
  label: string;
}

export interface ArchElement {
  id: number;
  type: ArchElementType;
  x: number;
  y: number;
  width: number;
  rotation: number;
  label: string;
  openDirection?: 'LEFT' | 'RIGHT';
}

export interface FloorBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
