import React, { useState } from 'react';
import { Camera, Plus, Trash2, Edit3, Wifi, WifiOff, RefreshCw, X } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const DEMO_CAMERAS = [
  { id: 1, name: 'Gate A1 — Entrance', rtsp_url: 'rtsp://192.168.1.10:554/stream1', location: 'Terminal 1 Entry',    floor: 1, status: 'ACTIVE', is_overhead: true,  x_coord: 120, y_coord: 150, angle: 45 },
  { id: 2, name: 'Security Checkpoint', rtsp_url: 'rtsp://192.168.1.11:554/stream1', location: 'Main Security',       floor: 1, status: 'ACTIVE', is_overhead: false, x_coord: 380, y_coord: 220, angle: 135 },
  { id: 3, name: 'Baggage Claim B',     rtsp_url: 'rtsp://192.168.1.12:554/stream1', location: 'Arrivals Hall',       floor: 1, status: 'ACTIVE', is_overhead: true,  x_coord: 600, y_coord: 130, angle: 270 },
  { id: 4, name: 'Gate B3 Restricted',  rtsp_url: 'rtsp://192.168.1.13:554/stream1', location: 'Boarding Gate B3',   floor: 2, status: 'OFFLINE', is_overhead: true, x_coord: 250, y_coord: 380, angle: 90 },
  { id: 5, name: 'Retail Zone East',    rtsp_url: 'rtsp://192.168.1.14:554/stream1', location: 'Shopping Corridor',  floor: 2, status: 'ACTIVE', is_overhead: true,  x_coord: 480, y_coord: 200, angle: 0 },
  { id: 6, name: 'Elevator Lobby F1',   rtsp_url: 'rtsp://192.168.1.15:554/stream1', location: 'Elevator Bank',      floor: 1, status: 'ACTIVE', is_overhead: false, x_coord: 150, y_coord: 400, angle: 180 },
];

export default function CameraManager() {
  const { cameras: storeCams, token, addToast } = useStore();
  const cameras = storeCams.length > 0 ? storeCams : DEMO_CAMERAS;

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', rtsp_url: '', location: '', floor: 1, is_overhead: true, angle: 0, x_coord: 0, y_coord: 0,
  });

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this camera?')) return;
    if (token && token !== 'demo-token') {
      try { await api.deleteCamera(token, id); } catch { /* demo */ }
    }
    addToast('Camera deleted', 'info');
  };

  const handleSave = async () => {
    if (!form.name || !form.rtsp_url) { addToast('Name and RTSP URL required', 'error'); return; }
    if (token && token !== 'demo-token') {
      try {
        if (editId) await api.updateCamera(token, editId, form);
        else await api.createCamera(token, form);
      } catch { /* demo */ }
    }
    addToast(`Camera ${editId ? 'updated' : 'added'} successfully`, 'success');
    setShowModal(false);
    setEditId(null);
    setForm({ name: '', rtsp_url: '', location: '', floor: 1, is_overhead: true, angle: 0, x_coord: 0, y_coord: 0 });
  };

  const openEdit = (cam: typeof DEMO_CAMERAS[0]) => {
    setForm({
      name: cam.name, rtsp_url: cam.rtsp_url, location: cam.location,
      floor: cam.floor, is_overhead: cam.is_overhead,
      angle: cam.angle, x_coord: cam.x_coord, y_coord: cam.y_coord,
    });
    setEditId(cam.id);
    setShowModal(true);
  };

  const online  = cameras.filter((c) => c.status === 'ACTIVE').length;
  const offline = cameras.filter((c) => c.status === 'OFFLINE').length;
  const maint   = cameras.filter((c) => c.status === 'MAINTENANCE').length;

  return (
    <div className="page-content">
      {/* Header stats */}
      <div style={{
        padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center',
        background: 'var(--surface-1)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          <div style={{ padding: '8px 16px', background: 'var(--green-dim)', border: '1px solid var(--border-green)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--green-bright)' }}>{online}</span>
            <span style={{ fontSize: 11, color: 'var(--green-bright)', marginLeft: 6 }}>Online</span>
          </div>
          <div style={{ padding: '8px 16px', background: 'var(--red-dim)', border: '1px solid var(--border-red)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--red-bright)' }}>{offline}</span>
            <span style={{ fontSize: 11, color: 'var(--red-bright)', marginLeft: 6 }}>Offline</span>
          </div>
          <div style={{ padding: '8px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{cameras.length}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>Total</span>
          </div>
        </div>
        <button id="add-camera-btn" className="btn btn-primary" onClick={() => { setEditId(null); setShowModal(true); }}>
          <Plus size={15} /> Add Camera
        </button>
      </div>

      {/* Camera table */}
      <div style={{ padding: 20 }}>
        <div className="card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Camera Name</th>
                  <th>RTSP URL</th>
                  <th>Location</th>
                  <th>Floor</th>
                  <th>Type</th>
                  <th>Angle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((cam) => (
                  <tr key={cam.id} id={`camera-row-${cam.id}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {cam.status === 'ACTIVE' ? (
                          <><Wifi size={13} color="var(--green-bright)" /><span className="badge badge-green"><span className="badge-dot" />Online</span></>
                        ) : cam.status === 'OFFLINE' ? (
                          <><WifiOff size={13} color="var(--red-bright)" /><span className="badge badge-red"><span className="badge-dot" />Offline</span></>
                        ) : (
                          <span className="badge badge-amber">Maintenance</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cam.name}</td>
                    <td>
                      <code style={{
                        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--text-muted)', background: 'var(--surface-2)',
                        padding: '2px 6px', borderRadius: 4,
                        maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {cam.rtsp_url}
                      </code>
                    </td>
                    <td style={{ fontSize: 12 }}>{cam.location}</td>
                    <td>
                      <span className="badge badge-gray">
                        {cam.floor < 0 ? 'B' : cam.floor === 0 ? 'G' : `F${cam.floor}`}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{cam.is_overhead ? '⬆ Overhead' : '↔ Wall'}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{cam.angle}°</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(cam as typeof DEMO_CAMERAS[0])}>
                          <Edit3 size={13} />
                        </button>
                        <button className="icon-btn" title="Delete"
                          style={{ color: 'var(--red-bright)', borderColor: 'var(--border-red)' }}
                          onClick={() => handleDelete(cam.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Edit Camera' : 'Add New Camera'}</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Camera Name *</label>
                <input id="cam-name-input" className="form-input" placeholder="e.g. Gate A3 — Overhead" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">RTSP Stream URL *</label>
                <input id="cam-rtsp-input" className="form-input" placeholder="rtsp://192.168.x.x:554/stream" value={form.rtsp_url}
                  onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Location Description</label>
                  <input id="cam-loc-input" className="form-input" placeholder="Terminal 1 Entry" value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <select id="cam-floor-select" className="form-select" value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: +e.target.value })}>
                    <option value={-1}>Basement</option>
                    <option value={0}>Ground</option>
                    <option value={1}>Floor 1</option>
                    <option value={2}>Floor 2</option>
                    <option value={3}>Floor 3</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Camera Type</label>
                  <select id="cam-type-select" className="form-select" value={form.is_overhead ? 'overhead' : 'wall'}
                    onChange={(e) => setForm({ ...form, is_overhead: e.target.value === 'overhead' })}>
                    <option value="overhead">Overhead (Ceiling)</option>
                    <option value="wall">Wall-Mounted</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rotation Angle (°)</label>
                  <input id="cam-angle-input" className="form-input" type="number" min={0} max={359} value={form.angle}
                    onChange={(e) => setForm({ ...form, angle: +e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button id="submit-camera-btn" className="btn btn-primary" onClick={handleSave}>
                <Camera size={14} /> {editId ? 'Update Camera' : 'Add Camera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
