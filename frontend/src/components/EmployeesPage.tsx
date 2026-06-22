import React, { useState } from 'react';
import { UserCheck, Clock, AlertTriangle, CheckCircle, Plus, Search, X, MapPin, Activity, Camera } from 'lucide-react';
import { useStore, Employee } from '../stores/appStore';
import { api } from '../hooks/api';
import { PersonDetailModal, PersonDetailEmployee } from './PersonDetailModal';

function getBreakStatus(minutesSince: number, interval: number) {
  const ratio = minutesSince / interval;
  if (ratio >= 1) return { label: 'OVERDUE', color: 'var(--red-bright)', bg: 'var(--red-dim)', icon: '🔴' };
  if (ratio >= 0.85) return { label: 'DUE SOON', color: 'var(--amber-bright)', bg: 'rgba(217,119,6,0.1)', icon: '🟡' };
  return { label: 'COMPLIANT', color: 'var(--green-bright)', bg: 'var(--green-dim)', icon: '🟢' };
}

export default function EmployeesPage() {
  const { employees, token, addToast, setEmployees } = useStore();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [form, setForm] = useState({
    employee_code: '', fullname: '', department: '', break_interval_minutes: 120, break_duration_minutes: 15,
  });
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setWebcamStream(stream);
      setWebcamActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      addToast('Could not access webcam. Ensure permissions are granted.', 'error');
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setWebcamActive(false);
  };

  const takeSnapshot = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg');
        setFacePreview(dataUrl);
        
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
            setFaceFile(file);
            addToast('Face snapshot captured successfully!', 'success');
          });
      }
      stopWebcam();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFacePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      addToast('Face photo loaded successfully.', 'success');
    }
  };

  const depts = [...new Set(employees.map((e) => e.department))];

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = e.fullname.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q);
    const matchDept = deptFilter === 'all' || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const overdueCount = employees.filter((e) => e.is_active && (e as any).minutesSinceLast >= e.break_interval_minutes).length;
  const dueSoonCount = employees.filter((e) => {
    const r = (e as any).minutesSinceLast / e.break_interval_minutes;
    return e.is_active && r >= 0.85 && r < 1;
  }).length;

  const handleAdd = async () => {
    if (!form.fullname || !form.employee_code) { addToast('Name and code required', 'error'); return; }
    if (form.break_interval_minutes <= 0 || form.break_duration_minutes <= 0) {
      addToast('Break interval and duration must be positive', 'error');
      return;
    }
    let newEmpId = null;
    if (token && token !== 'demo-token') {
      try {
        const created = await api.createEmployee(token, form);
        newEmpId = created.id;
      } catch {
        addToast('Failed to create employee', 'error');
        return;
      }
      
      if (newEmpId && faceFile) {
        try {
          addToast('Uploading face photo...', 'info');
          await api.enrollEmployeeFace(token, newEmpId, faceFile);
          addToast('Face photo enrolled successfully', 'success');
        } catch (err: any) {
          addToast(`Employee created, but face upload failed: ${err.message}`, 'error');
        }
      }

      try {
        const updated = await api.getEmployees(token);
        setEmployees(updated);
      } catch {
        addToast('Employee created but refresh failed', 'info');
      }
    }
    addToast(`Employee "${form.fullname}" added`, 'success');
    setShowModal(false);
    setForm({ employee_code: '', fullname: '', department: '', break_interval_minutes: 120, break_duration_minutes: 15 });
    setFaceFile(null);
    setFacePreview(null);
    stopWebcam();
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <div className="page-content" style={{ position: 'relative' }}>
      {overdueCount > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div className="alert-banner critical">
            <AlertTriangle size={16} />
            <strong>{overdueCount} employee{overdueCount > 1 ? 's' : ''} overdue for mandatory break</strong>
            {' — '}Notify supervisor immediately
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 12 }}>
        {[
          { label: 'Total Staff', value: employees.length, color: 'var(--white)' },
          { label: 'On Duty', value: employees.filter((e) => e.is_active).length, color: 'var(--green-bright)' },
          { label: 'Break Overdue', value: overdueCount, color: 'var(--red-bright)' },
          { label: 'Due Soon', value: dueSoonCount, color: 'var(--amber-bright)' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '12px 20px', background: 'var(--surface-1)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120,
          }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-ghost)' }} />
          <input id="emp-search" className="form-input" placeholder="Search by name or code…"
            style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm ${deptFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDeptFilter('all')}>All</button>
          {depts.map((d) => (
            <button key={d} className={`btn btn-sm ${deptFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDeptFilter(d)}>{d}</button>
          ))}
        </div>
        <button id="add-employee-btn" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Add Employee
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ margin: '0 20px', borderRadius: 'var(--radius-lg)' }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Break Interval</th>
                <th>Time Since Last Break</th>
                <th>Compliance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const minutesSince = (e as any).minutesSinceLast || 0;
                const bStatus = getBreakStatus(minutesSince, e.break_interval_minutes);
                const pct = Math.min(100, Math.round((minutesSince / e.break_interval_minutes) * 100));
                return (
                  <tr 
                    key={e.id} 
                    id={`emp-row-${e.id}`}
                    onClick={() => setSelectedEmployeeId(e.id)}
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                  >
                    <td className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.employee_code}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.fullname}</td>
                    <td>
                      <span className="badge badge-gray">{e.department}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>Every {e.break_interval_minutes} min</td>
                    <td>
                      {e.is_active ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 11 }}>{minutesSince}m</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.break_interval_minutes}m</span>
                            </div>
                            <div className="progress-bar">
                              <div
                                className={`progress-fill${pct >= 100 ? ' red' : pct >= 85 ? ' amber' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>Off duty</span>
                      )}
                    </td>
                    <td>
                      {e.is_active ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: bStatus.color, background: bStatus.bg,
                          padding: '3px 8px', borderRadius: 99,
                        }}>
                          {bStatus.icon} {bStatus.label}
                        </span>
                      ) : (
                        <span className="badge badge-gray">INACTIVE</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${e.is_active ? 'badge-green' : 'badge-gray'}`}>
                        <span className="badge-dot" />
                        {e.is_active ? 'On Duty' : 'Off Duty'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => { setShowModal(false); setFaceFile(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add New Employee</span>
              <button className="icon-btn" onClick={() => { setShowModal(false); setFaceFile(null); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Employee Code *</label>
                  <input id="emp-code-input" className="form-input" placeholder="E-XXX" value={form.employee_code}
                    onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input id="emp-dept-input" className="form-input" placeholder="Department" value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input id="emp-name-input" className="form-input" placeholder="Full name" value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Break Interval (min)</label>
                  <input id="emp-interval-input" className="form-input" type="number" min={1} value={form.break_interval_minutes}
                    onChange={(e) => setForm({ ...form, break_interval_minutes: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Break Duration (min)</label>
                  <input id="emp-duration-input" className="form-input" type="number" min={1} value={form.break_duration_minutes}
                    onChange={(e) => setForm({ ...form, break_duration_minutes: +e.target.value })} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 14 }}>
                {webcamActive ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ width: '100%', maxWidth: 320, aspectRatio: '4/3', overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#000', transform: 'scaleX(-1)' }}>
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-primary btn-sm" onClick={takeSnapshot}>Capture Snapshot</button>
                      <button className="btn btn-secondary btn-sm" onClick={stopWebcam}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ghost)', flexShrink: 0 }}>
                        {facePreview ? (
                          <img src={facePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Camera size={20} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Face ID Photo</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{faceFile ? 'Snapshot ready' : 'Upload photo or capture face via webcam.'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                        Upload File
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={startWebcam}>
                        <Camera size={14} style={{ marginRight: 4 }} /> Use Webcam
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); setFaceFile(null); setFacePreview(null); stopWebcam(); }}>Cancel</button>
              <button id="submit-employee-btn" className="btn btn-primary" onClick={handleAdd}>
                <Plus size={14} /> Add Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <PersonDetailModal
          person={{
            type: 'employee',
            id: selectedEmployee.id,
            employee_code: selectedEmployee.employee_code,
            fullname: selectedEmployee.fullname,
            department: selectedEmployee.department,
            is_active: selectedEmployee.is_active,
            current_location: selectedEmployee.current_location,
            last_seen: selectedEmployee.last_seen,
            break_interval_minutes: selectedEmployee.break_interval_minutes,
            break_duration_minutes: selectedEmployee.break_duration_minutes,
          } as PersonDetailEmployee}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  );
}
