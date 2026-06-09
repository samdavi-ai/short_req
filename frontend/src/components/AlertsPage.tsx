import React, { useState } from 'react';
import { ShieldAlert, Check, CheckCheck, AlertTriangle, X, Camera } from 'lucide-react';
import { useStore, Alert } from '../stores/appStore';
import { api } from '../hooks/api';

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const SEV_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'var(--red-dim)',                  text: 'var(--red-light)',    border: 'var(--border-red)' },
  HIGH:     { bg: 'rgba(220,38,38,0.06)',            text: 'var(--red-bright)',   border: 'rgba(220,38,38,0.2)' },
  MEDIUM:   { bg: 'rgba(217,119,6,0.08)',            text: 'var(--amber-bright)', border: 'rgba(217,119,6,0.2)' },
  LOW:      { bg: 'var(--surface-3)',                text: 'var(--text-secondary)', border: 'var(--border)' },
};

const TYPE_ICON: Record<string, string> = {
  RESTRICTED_ZONE: '🚫',
  WATCHLIST_MATCH: '👤',
  DWELL_EXCEEDED:  '⏱',
  CAMERA_OFFLINE:  '📷',
  BREAK_VIOLATION: '☕',
  TAILGATING:      '🚷',
};

export default function AlertsPage() {
  const { alerts, token, acknowledgeAlert, user, addToast } = useStore();

  const [filter, setFilter] = useState<'all' | 'unack' | 'ack'>('unack');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  const sorted = [...alerts]
    .filter((a) => {
      if (filter === 'unack' && a.acknowledged) return false;
      if (filter === 'ack' && !a.acknowledged) return false;
      if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!a.acknowledged && b.acknowledged) return -1;
      if (a.acknowledged && !b.acknowledged) return 1;
      return SEV_ORDER[a.severity as keyof typeof SEV_ORDER] - SEV_ORDER[b.severity as keyof typeof SEV_ORDER];
    });

  const unackCount = alerts.filter((a) => !a.acknowledged).length;

  const doAck = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (token && token !== 'demo-token') {
      try {
        await api.acknowledgeAlert(token, id, user?.username || 'operator');
      } catch { /* demo mode */ }
    }
    acknowledgeAlert(id);
    addToast('Alert acknowledged', 'success');
    if (selectedAlertId === id) setSelectedAlertId(null);
  };

  const doAckAll = () => {
    const toAck = sorted.filter((a) => !a.acknowledged).map((a) => a.id);
    if (token && token !== 'demo-token' && toAck.length > 0) {
      api.bulkAcknowledge(token, toAck, user?.username || 'operator').catch(() => {
        addToast('Some alerts could not be acknowledged on server', 'error');
      });
    }
    toAck.forEach((id) => acknowledgeAlert(id));
    addToast(`${toAck.length} alerts acknowledged`, 'success');
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const selectedAlert = alerts.find(a => a.id === selectedAlertId);

  return (
    <div className="page-content" style={{ position: 'relative' }}>
      <div style={{ padding: '0' }}>
        {/* Header summary */}
        <div style={{
          padding: '16px 20px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {unackCount > 0 && (
            <div className="alert-banner critical" style={{ flex: 1 }}>
              <AlertTriangle size={16} />
              <strong>{unackCount} alert{unackCount > 1 ? 's' : ''} require immediate attention</strong>
            </div>
          )}
          {unackCount === 0 && (
            <div className="alert-banner success" style={{ flex: 1 }}>
              <Check size={16} />All alerts acknowledged — system clear
            </div>
          )}
          {unackCount > 0 && (
            <button className="btn btn-primary" onClick={doAckAll}>
              <CheckCheck size={15} />
              Acknowledge All ({unackCount})
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'unack', 'ack'] as const).map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'unack' ? 'Unacknowledged' : 'Acknowledged'}
              </button>
            ))}
          </div>
          <div style={{ height: 20, width: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${sevFilter === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSevFilter(s)}
                style={sevFilter === s && s !== 'all' ? {
                  background: SEV_STYLE[s]?.bg,
                  color: SEV_STYLE[s]?.text,
                  borderColor: SEV_STYLE[s]?.border,
                } : {}}
              >
                {s === 'all' ? 'All Severity' : s}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {sorted.length} alerts
          </span>
        </div>

        {/* Alert rows */}
        <div style={{ padding: '0' }}>
          {sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ShieldAlert size={28} /></div>
              <div style={{ fontWeight: 600 }}>No alerts match filters</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Try changing filter options above</div>
            </div>
          ) : (
            sorted.map((a) => {
              const sev = SEV_STYLE[a.severity] || SEV_STYLE.LOW;
              return (
                <div
                  key={a.id}
                  id={`alert-row-${a.id}`}
                  onClick={() => setSelectedAlertId(a.id)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    opacity: a.acknowledged ? 0.55 : 1,
                    transition: 'all 0.2s ease',
                    background: !a.acknowledged && a.severity === 'CRITICAL'
                      ? 'rgba(239,68,68,0.03)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = !a.acknowledged && a.severity === 'CRITICAL'
                      ? 'rgba(239,68,68,0.03)' : 'transparent';
                  }}
                >
                  {/* Severity indicator */}
                  <div style={{
                    width: 40, flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2,
                  }}>
                    <span style={{ fontSize: 20 }}>{TYPE_ICON[a.alert_type] || '⚠️'}</span>
                    {!a.acknowledged && a.severity === 'CRITICAL' && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--red-bright)',
                        animation: 'alert-ring 1.5s ease-in-out infinite',
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                        textTransform: 'uppercase', color: sev.text,
                      }}>
                        {a.alert_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`badge badge-${a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'red' : a.severity === 'MEDIUM' ? 'amber' : 'gray'}`}>
                        {a.severity}
                      </span>
                      {a.camera_id && (
                        <span className="badge badge-gray">CAM #{a.camera_id}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
                      {a.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                      <span>{formatTime(a.timestamp)}</span>
                      {a.acknowledged && a.acknowledged_by && (
                        <span style={{ color: 'var(--green-bright)' }}>
                          ✓ Acknowledged by {a.acknowledged_by}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!a.acknowledged && (
                    <button
                      id={`ack-alert-${a.id}`}
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => doAck(a.id, e)}
                      style={{ flexShrink: 0 }}
                    >
                      <Check size={13} /> Acknowledge
                    </button>
                  )}
                  {a.acknowledged && (
                    <span className="badge badge-green" style={{ flexShrink: 0 }}>
                      <Check size={10} /> Done
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Snapshot Modal */}
      {selectedAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 24, animation: 'fade-in 0.2s ease-out'
        }} onClick={() => setSelectedAlertId(null)}>
          
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 800, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{TYPE_ICON[selectedAlert.alert_type] || '⚠️'}</span>
                <div>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: 'var(--white)' }}>
                    {selectedAlert.alert_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {new Date(selectedAlert.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedAlertId(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedAlert.description}
              </div>

              {selectedAlert.snapshot_url ? (
                <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', border: '1px solid var(--border)', aspectRatio: '16/9' }}>
                  <img src={selectedAlert.snapshot_url} alt="Alert Snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                    <span className="live-badge" style={{ background: 'rgba(0,0,0,0.6)', padding: '6px 12px' }}>
                      <Camera size={12} style={{ marginRight: 6, display: 'inline-block' }} /> 
                      CAM #{selectedAlert.camera_id || 'UNKNOWN'}
                    </span>
                    <span className={`badge badge-${selectedAlert.severity === 'CRITICAL' || selectedAlert.severity === 'HIGH' ? 'red' : 'amber'}`} style={{ backdropFilter: 'blur(8px)' }}>
                      {selectedAlert.severity}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 12, right: 12, color: 'white', fontFamily: 'monospace', fontSize: 11, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4 }}>
                    {selectedAlert.timestamp}
                  </div>
                </div>
              ) : (
                <div style={{ height: 300, background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Camera size={48} opacity={0.2} />
                  <span style={{ marginLeft: 16 }}>No Snapshot Available</span>
                </div>
              )}

              {!selectedAlert.acknowledged && (
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '16px', fontSize: 14, justifyContent: 'center' }}
                  onClick={() => doAck(selectedAlert.id)}
                >
                  <CheckCheck size={18} /> ACKNOWLEDGE ALERT
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
