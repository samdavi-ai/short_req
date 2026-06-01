import React, { useState } from 'react';
import { Layout, Plus, Check, Trash2, Layers, Move } from 'lucide-react';

interface CameraMarker {
  id: number;
  name: string;
  x: number;
  y: number;
  floor: number;
  angle: number;
}

const LayoutEditor: React.FC = () => {
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [markers, setMarkers] = useState<CameraMarker[]>([
    { id: 1, name: 'Gate 1 Camera', x: 250, y: 350, floor: 1, angle: 45 },
    { id: 2, name: 'Duty Free Left', x: 600, y: 180, floor: 1, angle: 120 },
    { id: 3, name: 'Staff Entrance A', x: 920, y: 510, floor: 1, angle: 270 },
  ]);

  const [draggedCamName, setDraggedCamName] = useState<string | null>(null);

  const handleDragStart = (name: string) => {
    setDraggedCamName(name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCamName) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newMarker: CameraMarker = {
      id: Date.now(),
      name: draggedCamName,
      x: Math.round(x),
      y: Math.round(y),
      floor: activeFloor,
      angle: 0
    };

    setMarkers([...markers, newMarker]);
    setDraggedCamName(null);
  };

  const removeMarker = (id: number) => {
    setMarkers(markers.filter(m => m.id !== id));
  };

  return (
    <div style={{ display: 'flex', gap: '16px', height: '100%' }}>
      {/* Blueprint Map Container */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Building Layout Configurator</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Drag cameras from the right list directly onto the architectural terminal plan.</p>
          </div>
          
          {/* Floor Toggles */}
          <div className="glass-panel" style={{ padding: '4px', display: 'flex', gap: '4px' }}>
            {[1, 2, 3].map((floor) => (
              <button
                key={floor}
                onClick={() => setActiveFloor(floor)}
                style={{
                  background: activeFloor === floor ? 'var(--color-primary)' : 'transparent',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Floor {floor}
              </button>
            ))}
          </div>
        </div>

        {/* Droppable Interactive Canvas */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="glass-panel"
          style={{
            height: '550px',
            position: 'relative',
            background: 'radial-gradient(circle, #101625 0%, #080b12 100%)',
            border: '2px dashed var(--glass-border)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}
        >
          {/* Simulated architectural layout grid lines */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          {/* Blueprint Terminal Labels */}
          <div style={{ position: 'absolute', top: '24px', left: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.4)', fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
            TERMINAL 1 DEPARTURES - FLOOR {activeFloor}
          </div>

          {/* Render markers */}
          {markers.filter(m => m.floor === activeFloor).map((m) => (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                top: `${m.y}px`,
                left: `${m.x}px`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                zIndex: 5
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                  border: '2px solid white',
                  borderRadius: '50%',
                  padding: '8px',
                  boxShadow: '0 0 10px rgba(99,102,241,0.5)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Layout size={14} color="white" />
              </div>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.85)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '10px', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 'bold' }}>{m.name}</span>
                <Trash2 size={10} color="var(--color-danger)" style={{ cursor: 'pointer' }} onClick={() => removeMarker(m.id)} />
              </div>
            </div>
          ))}

          {markers.filter(m => m.floor === activeFloor).length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Move size={48} color="rgba(255,255,255,0.1)" />
              <span>Canvas is Empty. Drag camera items here.</span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Inventory Panel */}
      <div className="glass-panel" style={{ width: '320px', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Camera Catalog</h3>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Drag nodes onto terminal map workspace:</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            'Focal Dome Entry',
            'Corridor High-Res 4',
            'Queue Counter Tri',
            'Rest lounge Wide',
            'Customs Exit Overhead',
          ].map((cam, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(cam)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                cursor: 'grab',
                alignItems: 'center',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={14} color="var(--color-secondary)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>{cam}</span>
              </div>
              <Plus size={14} color="var(--color-text-muted)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LayoutEditor;
