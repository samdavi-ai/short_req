import React, { useState } from 'react';
import { Users, Search, Plus, AlertTriangle, Check, Flag, X } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const DEMO_VISITORS = [
  { id: 1, fullname: 'Arjun Mehta',     passport_number: 'IN-123456', nationality: 'Indian',   status: 'WHITELISTED', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 2, fullname: 'Sarah Johnson',    passport_number: 'US-987654', nationality: 'American', status: 'WATCHLIST',   created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, fullname: 'Mohammed Al-Rashid',passport_number: 'AE-654321',nationality: 'Emirati',  status: 'WHITELISTED', created_at: new Date(Date.now() - 3600000 * 3).toISOString() },
  { id: 4, fullname: 'Unknown Subject',  passport_number: '—',         nationality: '—',        status: 'BLACKLISTED', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 5, fullname: 'Priya Sharma',     passport_number: 'IN-789012', nationality: 'Indian',   status: 'PENDING',     created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 6, fullname: 'James Okafor',     passport_number: 'NG-345678', nationality: 'Nigerian', status: 'WHITELISTED', created_at: new Date(Date.now() - 600000).toISOString() },
];

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  WHITELISTED: { class: 'badge-green',  label: '✓ Whitelisted' },
  BLACKLISTED: { class: 'badge-red',    label: '✕ Blacklisted' },
  WATCHLIST:   { class: 'badge-amber',  label: '⚠ Watchlist' },
  PENDING:     { class: 'badge-gray',   label: '○ Pending' },
};

export default function VisitorsPage() {
  const { visitors: storeVisitors, token, addToast } = useStore();
  const visitors = storeVisitors.length > 0 ? storeVisitors : DEMO_VISITORS;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fullname: '', passport_number: '', nationality: '', status: 'PENDING' });

  const filtered = visitors.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = v.fullname.toLowerCase().includes(q) || v.passport_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const watchlisted = visitors.filter((v) => v.status === 'BLACKLISTED' || v.status === 'WATCHLIST');

  const handleAdd = async () => {
    if (!form.fullname.trim()) { addToast('Name is required', 'error'); return; }
    if (token && token !== 'demo-token') {
      try { await api.createVisitor(token, form); } catch { /* demo */ }
    }
    addToast(`Visitor "${form.fullname}" registered`, 'success');
    setShowModal(false);
    setForm({ fullname: '', passport_number: '', nationality: '', status: 'PENDING' });
  };

  return (
    <div className="page-content">
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
            placeholder="Search by name or passport…"
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
          const count = visitors.filter((v) => v.status === s).length;
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
                <th>Passport</th>
                <th>Nationality</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon"><Users size={22} /></div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No visitors found</span>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((v) => (
                <tr key={v.id} id={`visitor-row-${v.id}`}>
                  <td style={{ color: 'var(--text-ghost)', fontSize: 11 }}>#{v.id}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.fullname}</td>
                  <td className="font-mono" style={{ fontSize: 11 }}>{v.passport_number || '—'}</td>
                  <td>{v.nationality || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[v.status]?.class || 'badge-gray'}`}>
                      {STATUS_BADGE[v.status]?.label || v.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {new Date(v.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Register New Visitor</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input id="visitor-name-input" className="form-input" placeholder="Full legal name" value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Passport / ID Number</label>
                <input id="visitor-passport-input" className="form-input" placeholder="Document number" value={form.passport_number}
                  onChange={(e) => setForm({ ...form, passport_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nationality</label>
                <input id="visitor-nationality-input" className="form-input" placeholder="Country of origin" value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select id="visitor-status-select" className="form-select" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="PENDING">Pending Review</option>
                  <option value="WHITELISTED">Whitelisted</option>
                  <option value="WATCHLIST">Watchlist</option>
                  <option value="BLACKLISTED">Blacklisted</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button id="submit-visitor-btn" className="btn btn-primary" onClick={handleAdd}>
                <Plus size={14} /> Register Visitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
