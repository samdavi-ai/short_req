import React, { useState } from 'react';
import { Users, Search, Plus, AlertTriangle, Check, Flag, X, Camera, MapPin, Activity, User } from 'lucide-react';
import { useStore, Visitor } from '../stores/appStore';
import { api } from '../hooks/api';
import { PersonDetailModal, PersonDetailVisitor } from './PersonDetailModal';

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  WHITELISTED: { class: 'badge-green',  label: '✓ Whitelisted' },
  BLACKLISTED: { class: 'badge-red',    label: '✕ Blacklisted' },
  WATCHLIST:   { class: 'badge-amber',  label: '⚠ Watchlist' },
  PENDING:     { class: 'badge-gray',   label: '○ Pending' },
};

export default function VisitorsPage() {
  const { visitors, token, addToast, setVisitors } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitorId, setSelectedVisitorId] = useState<number | null>(null);
  const [form, setForm] = useState({
    fullname: '', passport_number: '', nationality: '', phone_number: '',
    address: '', purpose: '', approved_by: '', requires_escort: false, status: 'PENDING',
    location: '', entry_time: '', exit_time: '', approver_id: '', department: '', role: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const filtered = visitors.filter((v: any) => {
    const q = search.toLowerCase();
    const matchSearch = v.fullname.toLowerCase().includes(q) || v.passport_number?.toLowerCase().includes(q) || v.phone_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const watchlisted = visitors.filter((v: any) => v.status === 'BLACKLISTED' || v.status === 'WATCHLIST');

  const handleAdd = async () => {
    if (!form.fullname.trim()) { addToast('Name is required', 'error'); return; }
    
    // Format times to ISO string or null
    const formattedForm = {
      ...form,
      entry_time: form.entry_time ? new Date(form.entry_time).toISOString() : null,
      exit_time: form.exit_time ? new Date(form.exit_time).toISOString() : null,
    };

    if (token && token !== 'demo-token') {
      try {
        const newVisitor = await api.createVisitor(token, formattedForm);
        if (selectedFile) {
          await api.uploadVisitorPhoto(token, newVisitor.id, selectedFile);
        }
        // Refetch updated list
        const updated = await api.getVisitors(token);
        setVisitors(updated);
        addToast(`Visitor "${form.fullname}" registered successfully with Face ID`, 'success');
      } catch (err) {
        addToast('Failed to register visitor or upload face photo', 'error');
      }
    } else {
      // Demo Mode
      const mockId = Math.floor(Math.random() * 1000) + 100;
      const mockVisitor: Visitor = {
        id: mockId,
        fullname: form.fullname,
        passport_number: form.passport_number,
        nationality: form.nationality,
        phone_number: form.phone_number,
        address: form.address,
        purpose: form.purpose,
        approved_by: form.approved_by,
        requires_escort: form.requires_escort,
        location: form.location,
        entry_time: formattedForm.entry_time || undefined,
        exit_time: formattedForm.exit_time || undefined,
        approver_id: form.approver_id,
        department: form.department,
        role: form.role,
        status: form.status as any,
        created_at: new Date().toISOString(),
        photo_path: filePreview || undefined,
        face_embedding_id: filePreview ? `face_embed_visitor_${mockId}_demo` : undefined,
      };
      setVisitors([mockVisitor, ...visitors]);
      addToast(`Visitor "${form.fullname}" registered successfully (Demo Mode)`, 'success');
    }
    
    setShowModal(false);
    setSelectedFile(null);
    setFilePreview(null);
    setForm({
      fullname: '', passport_number: '', nationality: '', phone_number: '',
      address: '', purpose: '', approved_by: '', requires_escort: false, status: 'PENDING',
      location: '', entry_time: '', exit_time: '', approver_id: '', department: '', role: ''
    });
  };

  const handleCaptureSnapshot = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      addToast('Identity snapshot loaded. Face ID embedding generated.', 'success');
    }
  };

  const selectedVisitor = visitors.find(v => v.id === selectedVisitorId);

  const updateVisitorStatus = async (visitorId: number, status: Visitor['status']) => {
    if (token && token !== 'demo-token') {
      try {
        await api.setVisitorStatus(token, visitorId, status);
        const updated = await api.getVisitors(token);
        setVisitors(updated);
        addToast('Visitor status updated', 'success');
      } catch {
        addToast('Failed to update visitor status', 'error');
      }
      return;
    }

    setVisitors(
      visitors.map((v) => (v.id === visitorId ? { ...v, status } : v))
    );
    addToast('Visitor status updated (demo)', 'success');
  };

  return (
    <div className="page-content" style={{ position: 'relative' }}>
      {/* Alert for watchlisted */}
      {watchlisted.length > 0 && (
        <div style={{ padding: '0 20px', paddingTop: 16 }}>
          <div className="alert-banner critical">
            <AlertTriangle size={16} />
            <strong>{watchlisted.length} person{watchlisted.length > 1 ? 's' : ''}</strong> on watchlist or blacklist — verify with supervisor
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-ghost)' }} />
          <input
            id="visitor-search"
            className="form-input"
            placeholder="Search by name, passport, or phone…"
            style={{ paddingLeft: 32 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'WHITELISTED', 'WATCHLIST', 'BLACKLISTED', 'PENDING'].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : STATUS_BADGE[s]?.label || s}
            </button>
          ))}
        </div>
        <button id="add-visitor-btn" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Register Visitor
        </button>
      </div>

      {/* Stats row */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 12 }}>
        {['WHITELISTED', 'WATCHLIST', 'BLACKLISTED', 'PENDING'].map((s) => {
          const count = visitors.filter((v: any) => v.status === s).length;
          return (
            <div key={s} style={{
              padding: '10px 16px', background: 'var(--surface-1)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span className={`badge ${STATUS_BADGE[s]?.class}`}>{STATUS_BADGE[s]?.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card" style={{ margin: '0 20px', borderRadius: 'var(--radius-lg)' }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Passport</th>
                <th>Purpose</th>
                <th>Escort Req.</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-icon"><Users size={22} /></div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No visitors found</span>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((v: any) => (
                <tr 
                  key={v.id} 
                  id={`visitor-row-${v.id}`}
                  onClick={() => setSelectedVisitorId(v.id)}
                  style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ color: 'var(--text-ghost)', fontSize: 11 }}>#{v.id}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.fullname}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.phone_number || '—'}</td>
                  <td className="font-mono" style={{ fontSize: 11 }}>{v.passport_number || '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.purpose && v.purpose.length > 20 ? v.purpose.substring(0, 20) + '...' : (v.purpose || '—')}</td>
                  <td>
                    {v.requires_escort ? (
                      <span className="badge badge-amber" style={{ fontSize: 10 }}>⚠ REQUIRED</span>
                    ) : (
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>NO</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[v.status]?.class || 'badge-gray'}`}>
                      {STATUS_BADGE[v.status]?.label || v.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      {v.status !== 'WHITELISTED' && (
                        <button className="btn btn-sm" style={{ background: 'var(--green-dim)', color: 'var(--green-bright)', border: '1px solid var(--border-green)' }}
                          onClick={() => updateVisitorStatus(v.id, 'WHITELISTED')}>
                          <Check size={11} /> Clear
                        </button>
                      )}
                      {v.status !== 'BLACKLISTED' && (
                        <button className="btn btn-sm btn-danger"
                          onClick={() => updateVisitorStatus(v.id, 'BLACKLISTED')}>
                          <Flag size={11} /> Flag
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <span className="modal-title">Register New Visitor</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ghost)' }}>
                      {filePreview ? (
                        <img src={filePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Camera size={20} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Identity Snapshot</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedFile ? `${selectedFile.name} ready` : 'Required for AI face tracking.'}</div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCaptureSnapshot}>
                    <Camera size={14} /> {selectedFile ? 'Change Face' : 'Capture Face'}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="Full legal name" value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" placeholder="+1 (555) 000-0000" value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Passport / ID Number</label>
                <input className="form-input" placeholder="Document number" value={form.passport_number}
                  onChange={(e) => setForm({ ...form, passport_number: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Nationality</label>
                <input className="form-input" placeholder="Country of origin" value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Target Location</label>
                <input className="form-input" placeholder="e.g. Boardroom, Terminal 1" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" placeholder="e.g. Security, Operations" value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Role / Designation</label>
                <input className="form-input" placeholder="e.g. Contractor, Inspector" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Approver ID</label>
                <input className="form-input" placeholder="e.g. EMP12345" value={form.approver_id}
                  onChange={(e) => setForm({ ...form, approver_id: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Entry Time</label>
                <input type="datetime-local" className="form-input" value={form.entry_time}
                  onChange={(e) => setForm({ ...form, entry_time: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Exit Time</label>
                <input type="datetime-local" className="form-input" value={form.exit_time}
                  onChange={(e) => setForm({ ...form, exit_time: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <textarea className="form-input" placeholder="Physical address" rows={2} value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Purpose of Visit</label>
                <textarea className="form-input" placeholder="Brief reason for access" rows={2} value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Approved By</label>
                <input className="form-input" placeholder="Supervisor Name" value={form.approved_by}
                  onChange={(e) => setForm({ ...form, approved_by: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select className="form-select" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="PENDING">Pending Review</option>
                  <option value="WHITELISTED">Whitelisted</option>
                  <option value="WATCHLIST">Watchlist</option>
                  <option value="BLACKLISTED">Blacklisted</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={form.requires_escort} onChange={(e) => setForm({...form, requires_escort: e.target.checked})} style={{ accentColor: 'var(--red)' }} />
                  <strong>Requires Escort</strong> (Visitor must be accompanied at all times)
                </label>
              </div>

            </div>
            
            <div className="modal-footer" style={{ marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button id="submit-visitor-btn" className="btn btn-primary" onClick={handleAdd}>
                <Plus size={14} /> Complete Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVisitor && (
        <PersonDetailModal
          person={{
            type: 'visitor',
            id: selectedVisitor.id,
            fullname: selectedVisitor.fullname,
            passport_number: selectedVisitor.passport_number,
            nationality: selectedVisitor.nationality,
            phone_number: selectedVisitor.phone_number,
            department: selectedVisitor.department,
            role: selectedVisitor.role,
            location: selectedVisitor.location,
            entry_time: selectedVisitor.entry_time ? new Date(selectedVisitor.entry_time).toLocaleString('en-IN') : undefined,
            exit_time: selectedVisitor.exit_time ? new Date(selectedVisitor.exit_time).toLocaleString('en-IN') : undefined,
            status: selectedVisitor.status,
            approved_by: selectedVisitor.approved_by,
            approver_id: selectedVisitor.approver_id,
            purpose: selectedVisitor.purpose,
            requires_escort: selectedVisitor.requires_escort,
            photo_path: selectedVisitor.photo_path,
            face_embedding_id: selectedVisitor.face_embedding_id,
            current_location: selectedVisitor.current_location,
            last_seen: selectedVisitor.last_seen,
          } as PersonDetailVisitor}
          onClose={() => setSelectedVisitorId(null)}
        />
      )}
    </div>
  );
}
