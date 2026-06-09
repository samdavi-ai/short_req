import React from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface Zone3DProps {
  id: number;
  points: { x: number; y: number }[];
  color: string;
  name: string;
  pxPerFoot: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export default function Zone3D({ id, points, color, name, pxPerFoot, isSelected, onSelect }: Zone3DProps) {
  if (points.length < 3) return null;

  // Convert points to 2D shape
  const shape = new THREE.Shape();
  points.forEach((p, i) => {
    const wx = p.x / pxPerFoot;
    const wz = p.y / pxPerFoot;
    if (i === 0) shape.moveTo(wx, wz);
    else shape.lineTo(wx, wz);
  });
  shape.closePath();

  // We rotate the shape to lie flat on XZ plane
  // A standard shape is on XY. To put on XZ, rotate around X by -PI/2.
  // Wait, if shape uses wx, wz, and we render it, XY becomes XZ.
  
  // Calculate center for label
  let cx = 0, cy = 0;
  points.forEach(p => { cx += p.x; cy += p.y; });
  cx /= points.length;
  cy /= points.length;

  return (
    <group 
      position={[0, 0.1, 0]} 
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(id); }}
    >
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.6 : 0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={isSelected ? '#ffffff' : color} linewidth={isSelected ? 3 : 1} />
      </mesh>
      <Html position={[cx / pxPerFoot, cy / pxPerFoot, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fff', fontSize: '10px', textShadow: '0 0 2px black', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {name}
        </div>
      </Html>
    </group>
  );
}
