import React from 'react';

interface Wall3DProps {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  color: string;
  pxPerFoot: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export default function Wall3D({ startX, startY, endX, endY, thickness, color, pxPerFoot, isSelected, onSelect, id }: Wall3DProps) {
  const wx1 = startX / pxPerFoot;
  const wz1 = startY / pxPerFoot;
  const wx2 = endX / pxPerFoot;
  const wz2 = endY / pxPerFoot;
  
  const dx = wx2 - wx1;
  const dz = wz2 - wz1;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length === 0) return null;
  
  const angle = Math.atan2(-dz, dx); // Note: 3D coordinates map Z inverted compared to 2D
  
  const cx = (wx1 + wx2) / 2;
  const cz = (wz1 + wz2) / 2;
  
  const height = 10; // 10 ft walls
  const t = thickness / pxPerFoot;

  return (
    <mesh 
      position={[cx, height / 2, cz]} 
      rotation={[0, angle, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(id); }}
    >
      <boxGeometry args={[length, height, t]} />
      <meshStandardMaterial 
        color={isSelected ? '#FF6B00' : (color === '#111111' ? '#4ECDC4' : color)} 
        transparent 
        opacity={isSelected ? 0.95 : (color === '#111111' ? 0.4 : 0.85)} 
      />
    </mesh>
  );
}
