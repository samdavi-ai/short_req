import React, { useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Html } from '@react-three/drei';
import * as THREE from 'three';

interface CameraModel3DProps {
  id: number;
  x: number;
  y: number;
  angle: number;
  fov: number;
  name: string;
  status: string;
  isOverhead: boolean;
  pxPerFoot: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onUpdate: (id: number, pos: { x: number; y: number }, angle: number) => void;
  editMode: boolean;
}

export default function CameraModel3D({
  id, x, y, angle, fov, name, status, isOverhead, pxPerFoot, isSelected, onSelect, onUpdate, editMode
}: CameraModel3DProps) {
  const group = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  
  // Transform pixels to 3D world space. Let's say 1 foot = 1 unit.
  // x, y in pixels -> x/pxPerFoot, y/pxPerFoot
  // We'll map Canvas X to 3D X, and Canvas Y to 3D Z.
  const worldX = x / pxPerFoot;
  const worldZ = y / pxPerFoot;
  const height = isOverhead ? 10 : 6; // height in feet

  // Transform degrees to radians
  // Angle 0 in 2D is right (+X). In 3D, that's +X. 
  // We negate the angle because Z grows downwards in 2D but in 3D we usually map it differently, 
  // but let's stick to X=X, Z=Y.
  const angleRad = -(angle * Math.PI) / 180;

  // Sync internal state if external props change (not during drag)
  useEffect(() => {
    if (group.current && (!transformRef.current || !transformRef.current.dragging)) {
      group.current.position.set(worldX, height, worldZ);
      group.current.rotation.set(0, angleRad, 0);
    }
  }, [worldX, worldZ, height, angleRad]);

  const color = status === 'ACTIVE' ? '#22c55e' : status === 'OFFLINE' ? '#ef4444' : '#f59e0b';
  const fovRad = (fov * Math.PI) / 180;
  
  const handleDrag = () => {
    if (group.current) {
      const pos = group.current.position;
      const rot = group.current.rotation;
      // Convert back to pixels
      const newX = pos.x * pxPerFoot;
      const newY = pos.z * pxPerFoot;
      let newAngle = (-rot.y * 180) / Math.PI;
      if (newAngle < 0) newAngle += 360;
      onUpdate(id, { x: newX, y: newY }, newAngle);
    }
  };

  const mesh = (
    <group ref={group} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
      {/* Camera Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 0.5, 0.5]} />
        <meshStandardMaterial color={isSelected ? '#f59e0b' : color} />
      </mesh>
      {/* FOV Cone */}
      {status === 'ACTIVE' && (
        <mesh position={[2.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[Math.tan(fovRad / 2) * 5, 5, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
      {/* Label */}
      <Html position={[0, 1.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap' }}>
          {name}
        </div>
      </Html>
    </group>
  );

  if (editMode && isSelected) {
    return (
      <TransformControls
        ref={transformRef}
        mode="translate"
        showY={false}
        onMouseUp={handleDrag}
        size={0.5}
      >
        {mesh}
      </TransformControls>
    );
  }

  return mesh;
}
