import type { ArchElement, MeasureUnit, WallSegment } from './types';
import { formatLength, getWallAngleDeg } from './geometry';

export function drawWallOnCanvas(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment,
  isSelected: boolean,
  pxPerFoot: number,
  unit: MeasureUnit,
  showDimensions: boolean
): void {
  const { startX, startY, endX, endY, thickness, color } = wall;
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;
  const halfT = thickness / 2;

  // Draw wall as a solid filled polygon — CAD blueprint style
  ctx.beginPath();
  ctx.moveTo(startX + nx * halfT, startY + ny * halfT);
  ctx.lineTo(endX + nx * halfT, endY + ny * halfT);
  ctx.lineTo(endX - nx * halfT, endY - ny * halfT);
  ctx.lineTo(startX - nx * halfT, startY - ny * halfT);
  ctx.closePath();

  if (isSelected) {
    // Selected: amber glow fill
    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  } else {
    // Outer / thick walls → solid black; partitions → dark slate
    ctx.fillStyle = thickness >= 6 ? '#111111' : (color || '#2d3748');
  }
  ctx.fill();

  // Thin outline to crisp up edges
  ctx.strokeStyle = isSelected ? '#f59e0b' : 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Endpoint handles when selected
  if (isSelected) {
    for (const [hx, hy] of [[startX, startY], [endX, endY]] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#f59e0b44';
    ctx.lineWidth = thickness + 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }


  if (showDimensions && len > 30) {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const angleDeg = getWallAngleDeg(wall);
    const label = `${formatLength(len, pxPerFoot, unit)}  ∠${angleDeg.toFixed(1)}°`;

    ctx.save();
    ctx.translate(midX, midY);
    let textAngle = Math.atan2(dy, dx);
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
      textAngle += Math.PI;
    }
    ctx.rotate(textAngle);
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(-tw / 2, -22, tw, 16);
    ctx.strokeStyle = isSelected ? '#f59e0b44' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-tw / 2, -22, tw, 16);
    ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(255,255,255,0.95)';
    ctx.fillText(label, 0, -9);
    ctx.restore();
  }
}

export function drawArchElement(
  ctx: CanvasRenderingContext2D,
  el: ArchElement,
  isSelected: boolean
): void {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate((el.rotation * Math.PI) / 180);

  const w = el.width;
  const accent = isSelected ? '#f59e0b' : '#1e293b';
  const fillA = isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.05)';

  switch (el.type) {
    case 'DOOR': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2, -4);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, -4);
      ctx.stroke();
      const dir = el.openDirection === 'RIGHT' ? 1 : -1;
      ctx.beginPath();
      ctx.arc(dir === 1 ? -w / 2 : w / 2, 0, w, dir === 1 ? -Math.PI / 2 : -Math.PI, dir === 1 ? 0 : -Math.PI / 2);
      ctx.strokeStyle = accent + '66';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(dir === 1 ? -w / 2 : w / 2, 0);
      ctx.lineTo(dir === 1 ? -w / 2 + w : w / 2 - w, 0);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'DOUBLE_DOOR': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -4);
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, -Math.PI, -Math.PI / 2);
      ctx.strokeStyle = accent + '55';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(0, 0);
      ctx.moveTo(0, 0); ctx.lineTo(w / 2, 0);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'WINDOW': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -3); ctx.lineTo(w / 2, -3);
      ctx.moveTo(-w / 2, 3); ctx.lineTo(w / 2, 3);
      ctx.stroke();
      ctx.strokeStyle = accent + '44';
      ctx.lineWidth = 1;
      const count = Math.max(2, Math.floor(w / 15));
      for (let i = 0; i <= count; i++) {
        const lx = -w / 2 + (w / count) * i;
        ctx.beginPath();
        ctx.moveTo(lx, -3); ctx.lineTo(lx, 3);
        ctx.stroke();
      }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2, -5, w, 10);
      break;
    }
    case 'COLUMN': {
      const s = w / 2;
      ctx.fillStyle = fillA;
      ctx.fillRect(-s, -s, w, w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, w, w);
      ctx.beginPath();
      ctx.moveTo(-s, -s); ctx.lineTo(s, s);
      ctx.moveTo(s, -s); ctx.lineTo(-s, s);
      ctx.strokeStyle = accent + '66';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'STAIRS': {
      const steps = 5;
      const stepW = w / steps;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= steps; i++) {
        const sx = -w / 2 + stepW * i;
        ctx.beginPath();
        ctx.moveTo(sx, -10); ctx.lineTo(sx, 10);
        ctx.stroke();
      }
      ctx.strokeRect(-w / 2, -10, w, 20);
      ctx.beginPath();
      ctx.moveTo(-w / 4, 0); ctx.lineTo(w / 4, 0);
      ctx.moveTo(w / 4 - 5, -4); ctx.lineTo(w / 4, 0); ctx.lineTo(w / 4 - 5, 4);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'ELEVATOR': {
      const s = w / 2;
      ctx.fillStyle = fillA;
      ctx.fillRect(-s, -s, w, w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(-s, -s, w, w);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4); ctx.lineTo(0, -s * 0.4);
      ctx.moveTo(-4, -s * 0.15); ctx.lineTo(0, -s * 0.4); ctx.lineTo(4, -s * 0.15);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, s * 0.4);
      ctx.moveTo(-4, s * 0.15); ctx.lineTo(0, s * 0.4); ctx.lineTo(4, s * 0.15);
      ctx.stroke();
      break;
    }
    case 'ACCESS_DOOR': {
      const size = 16;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-size / 2, -size / 2, size, size, 3);
      } else {
        ctx.rect(-size / 2, -size / 2, size, size);
      }
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw RFID symbol or lock slot
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-size / 4, -size / 4, size / 2, size / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size / 6, -size / 8, size / 3, size / 12);
      break;
    }
  }

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(0, 0, w / 2 + 10, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b55';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (el.label) {
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(255,255,255,0.6)';
    ctx.rotate(-(el.rotation * Math.PI) / 180);
    ctx.fillText(el.label, 0, w / 2 + 6);
  }

  ctx.restore();
}
