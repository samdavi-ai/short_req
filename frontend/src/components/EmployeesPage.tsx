import React, { useState } from 'react';
import { UserCheck, Clock, AlertTriangle, CheckCircle, Plus, Search, X, MapPin, Activity } from 'lucide-react';
import { useStore, Employee } from '../stores/appStore';
import { api } from '../hooks/api';

function getBreakStatus(minutesSince: number, interval: number) {
  const ratio = minutesSince / interval;
  if (ratio >= 1) return { label: 'OVERDUE', color: 'var(--red-bright)', bg: 'var(--red-dim)', icon: '🔴' };
  if (ratio >= 0.85) return { label: 'DUE SOON', color: 'var(--amber-bright)', bg: 'rgba(217,119,6,0.1)', icon: '🟡' };
  return { label: 'COMPLIANT', color: 'var(--green-bright)', bg: 'var(--green-dim)', icon: '🟢' };
}

export default function EmployeesPage() {
  const { employees, token, addToast } = useStore();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [form, setForm] = useState({
    employee_code: '', fullname: '', department: '', break_interval_minutes: 120, break_duration_minutes: 15,
  });

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
    if (token && token !== 'demo-token') {
      try { await api.createEmployee(token, form); } catch { /* demo */ }
    }
    addToast(`Employee "${form.fullname}" added`, 'success');
    setShowModal(false);
    setForm({ employee_code: '', fullname: '', department: '', break_interval_minutes: 120, break_duration_minutes: 15 });
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
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add New Employee</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={16} /></button>
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
                  <input id="emp-interval-input" className="form-input" type="number" value={form.break_interval_minutes}
                    onChange={(e) => setForm({ ...form, break_interval_minutes: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Break Duration (min)</label>
                  <input id="emp-duration-input" className="form-input" type="number" value={form.break_duration_minutes}
                    onChange={(e) => setForm({ ...form, break_duration_minutes: +e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button id="submit-employee-btn" className="btn btn-primary" onClick={handleAdd}>
                <Plus size={14} /> Add Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Person Profile Modal */}
      {selectedEmployee && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 24, animation: 'fade-in 0.2s ease-out'
        }} onClick={() => setSelectedEmployeeId(null)}>
          
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border)', background: 'var(--surface-3)' }}>
                  <img src="/assets/employee_avatar.png" alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 22, color: 'var(--white)' }}>
                    {selectedEmployee.fullname}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--cyan)', fontFamily: 'monospace', marginTop: 4 }}>
                    {selectedEmployee.employee_code} • {selectedEmployee.department}
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedEmployeeId(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Location Tracker */}
              <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-ghost)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  <MapPin size={14} /> Current Live Location
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green-bright)', boxShadow: '0 0 10px var(--green-bright)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--white)', fontFamily: 'Outfit' }}>
                      {(selectedEmployee as any).current_location || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Last seen: {(selectedEmployee as any).last_seen || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Current Status</div>
                  <span className={`badge ${selectedEmployee.is_active ? 'badge-green' : 'badge-gray'}`}>
                    <span className="badge-dot" />
                    {selectedEmployee.is_active ? 'On Duty' : 'Off Duty'}
                  </span>
                </div>
                
                {selectedEmployee.is_active && (
                  <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Break Compliance</div>
                    {(() => {
                      const bStatus = getBreakStatus((selectedEmployee as any).minutesSinceLast || 0, selectedEmployee.break_interval_minutes);
                      return (
                        <span style={{ fontSize: 11, fontWeight: 700, color: bStatus.color, background: bStatus.bg, padding: '3px 8px', borderRadius: 99 }}>
                          {bStatus.icon} {bStatus.label}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
              
              <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-ghost)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  <Activity size={14} /> Schedule Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Break Interval</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Every {selectedEmployee.break_interval_minutes} mins</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Break Duration</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmployee.break_duration_minutes} mins</div>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
