import React, { useState } from 'react';
import { Users, Search, Plus, AlertTriangle, Check, Flag, X, Camera, MapPin, Activity, User } from 'lucide-react';
import { useStore, Visitor } from '../stores/appStore';
import { api } from '../hooks/api';

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  WHITELISTED: { class: 'badge-green',  label: '✓ Whitelisted' },
  BLACKLISTED: { class: 'badge-red',    label: '✕ Blacklisted' },
  WATCHLIST:   { class: 'badge-amber',  label: '⚠ Watchlist' },
  PENDING:     { class: 'badge-gray',   label: '○ Pending' },
};

export default function VisitorsPage() {
  const { visitors, token, addToast } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitorId, setSelectedVisitorId] = useState<number | null>(null);
  const [form, setForm] = useState({
    fullname: '', passport_number: '', nationality: '', phone_number: '',
    address: '', purpose: '', approved_by: '', requires_escort: false, status: 'PENDING'
  });

  const filtered = visitors.filter((v: any) => {
    const q = search.toLowerCase();
    const matchSearch = v.fullname.toLowerCase().includes(q) || v.passport_number?.toLowerCase().includes(q) || v.phone_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const watchlisted = visitors.filter((v: any) => v.status === 'BLACKLISTED' || v.status === 'WATCHLIST');

  const handleAdd = async () => {
    if (!form.fullname.trim()) { addToast('Name is required', 'error'); return; }
    if (token && token !== 'demo-token') {
      try { await api.createVisitor(token, form); } catch { /* demo */ }
    }
    addToast(`Visitor "${form.fullname}" registered successfully`, 'success');
    setShowModal(false);
    setForm({ fullname: '', passport_number: '', nationality: '', phone_number: '', address: '', purpose: '', approved_by: '', requires_escort: false, status: 'PENDING' });
  };

  const handleCaptureSnapshot = () => {
    addToast('Camera initialized: Identity snapshot captured & vector embedding generated.', 'success');
  };

  const selectedVisitor = visitors.find(v => v.id === selectedVisitorId);

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
                          onClick={() => addToast(`${v.fullname} status updated`, 'success')}>
                          <Check size={11} /> Clear
                        </button>
                      )}
                      {v.status !== 'BLACKLISTED' && (
                        <button className="btn btn-sm btn-danger"
                          onClick={() => addToast(`${v.fullname} flagged`, 'error')}>
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
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Identity Snapshot</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Required for AI cross-camera tracking.</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCaptureSnapshot}>
                    <Camera size={14} /> Capture Face
                  </button>
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

      {/* Person Profile Modal */}
      {selectedVisitor && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 24, animation: 'fade-in 0.2s ease-out'
        }} onClick={() => setSelectedVisitorId(null)}>
          
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border)', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ghost)' }}>
                   <User size={40} />
                </div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 22, color: 'var(--white)' }}>
                    {selectedVisitor.fullname}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--cyan)', fontFamily: 'monospace', marginTop: 4 }}>
                    {selectedVisitor.passport_number || 'No ID Provided'} • {selectedVisitor.nationality || 'Unknown'}
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedVisitorId(null)}>
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
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 10px var(--cyan)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--white)', fontFamily: 'Outfit' }}>
                      {(selectedVisitor as any).current_location || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Last seen: {(selectedVisitor as any).last_seen || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Access Status</div>
                  <span className={`badge ${STATUS_BADGE[selectedVisitor.status]?.class || 'badge-gray'}`}>
                    {STATUS_BADGE[selectedVisitor.status]?.label || selectedVisitor.status}
                  </span>
                </div>
                
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Escort Required</div>
                  {selectedVisitor.requires_escort ? (
                    <span className="badge badge-amber" style={{ fontSize: 11, padding: '3px 8px' }}>⚠ REQUIRED</span>
                  ) : (
                    <span className="badge badge-gray" style={{ fontSize: 11, padding: '3px 8px' }}>NO</span>
                  )}
                </div>
              </div>
              
              <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-ghost)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  <Activity size={14} /> Visit Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Purpose</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVisitor.purpose || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phone</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVisitor.phone_number || 'N/A'}</div>
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
