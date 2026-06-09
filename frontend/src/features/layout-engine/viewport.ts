import type { LayoutPoint } from './types';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export function getCanvasPosFromClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewport: ViewportState
): LayoutPoint {
  return {
    x: (clientX - rect.left) / viewport.zoom - viewport.panX / viewport.zoom,
    y: (clientY - rect.top) / viewport.zoom - viewport.panY / viewport.zoom,
  };
}

export function zoomAroundPoint(
  mouseX: number,
  mouseY: number,
  deltaY: number,
  viewport: ViewportState,
  minZoom = 0.15,
  maxZoom = 5
): ViewportState {
  const delta = deltaY > 0 ? -0.08 : 0.08;
  const newZoom = Math.max(minZoom, Math.min(maxZoom, viewport.zoom + delta));
  const scale = newZoom / viewport.zoom;
  return {
    zoom: newZoom,
    panX: mouseX - (mouseX - viewport.panX) * scale,
    panY: mouseY - (mouseY - viewport.panY) * scale,
  };
}
