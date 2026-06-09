import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import CameraModel3D from './CameraModel3D';
import Zone3D from './Zone3D';
import Wall3D from './Wall3D';

interface FloorScene3DProps {
  cameras: any[];
  zones: any[];
  walls: any[];
  pxPerFoot: number;
  editMode: boolean;
  selectedCamId: number | null;
  onSelectCam: (id: number | null) => void;
  onUpdateCam: (id: number, pos: { x: number; y: number }, angle: number) => void;
}

export default function FloorScene3D({
  cameras, zones, walls, pxPerFoot, editMode, selectedCamId, onSelectCam, onUpdateCam
}: FloorScene3DProps) {
  
  return (
    <div style={{ width: '100%', height: '100%', background: '#0f0f14' }} onClick={() => onSelectCam(null)}>
      <Canvas camera={{ position: [0, 40, 40], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
          
          {/* Ground */}
          <Grid infiniteGrid fadeDistance={200} sectionColor="#00f0ff" cellColor="#00f0ff" sectionThickness={1} cellThickness={0.5} position={[0, -0.01, 0]} />

          {/* Walls */}
          {walls.map(w => (
            <Wall3D 
              key={`wall-${w.id}`}
              {...w}
              pxPerFoot={pxPerFoot}
              isSelected={false}
              onSelect={() => {}}
            />
          ))}

          {/* Zones */}
          {zones.map(z => (
            <Zone3D
              key={`zone-${z.id}`}
              {...z}
              pxPerFoot={pxPerFoot}
              isSelected={false}
              onSelect={() => {}}
            />
          ))}

          {/* Cameras */}
          {cameras.map(c => (
            <CameraModel3D
              key={`cam-${c.id}`}
              id={c.id}
              x={c.x}
              y={c.y}
              angle={c.angle}
              fov={c.fov}
              name={c.name}
              status={c.status}
              isOverhead={c.is_overhead}
              pxPerFoot={pxPerFoot}
              isSelected={selectedCamId === c.id}
              onSelect={onSelectCam}
              onUpdate={onUpdateCam}
              editMode={editMode}
            />
          ))}

          <OrbitControls 
            makeDefault 
            maxPolarAngle={Math.PI / 2 - 0.05} // don't go below ground
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
