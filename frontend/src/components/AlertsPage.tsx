import React, { useState } from 'react';
import { ShieldAlert, Check, CheckCheck, Filter, AlertTriangle, X } from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const DEMO_ALERTS = [
  { id: 1,  alert_type: 'RESTRICTED_ZONE', severity: 'CRITICAL', description: 'Unauthorized person entered Gate B3 restricted area', camera_id: 4, timestamp: new Date(Date.now() - 120000).toISOString(), acknowledged: false, acknowledged_by: null },
  { id: 2,  alert_type: 'WATCHLIST_MATCH',  severity: 'HIGH',     description: 'Watchlisted individual ID#WL-004 spotted at Terminal 1 Entry', camera_id: 1, timestamp: new Date(Date.now() - 300000).toISOString(), acknowledged: false, acknowledged_by: null },
  { id: 3,  alert_type: 'DWELL_EXCEEDED',   severity: 'MEDIUM',   description: 'Person has been stationary at Gate A3 for 47 minutes', camera_id: 2, timestamp: new Date(Date.now() - 600000).toISOString(), acknowledged: false, acknowledged_by: null },
  { id: 4,  alert_type: 'CAMERA_OFFLINE',   severity: 'HIGH',     description: 'Camera "Gate B3" has lost signal — heartbeat timeout', camera_id: 4, timestamp: new Date(Date.now() - 900000).toISOString(), acknowledged: false, acknowledged_by: null },
  { id: 5,  alert_type: 'BREAK_VIOLATION',  severity: 'MEDIUM',   description: 'Employee E-007 (Ravi Kumar) overdue for break by 45 minutes', camera_id: null, timestamp: new Date(Date.now() - 1800000).toISOString(), acknowledged: true, acknowledged_by: 'supervisor_ali' },
  { id: 6,  alert_type: 'TAILGATING',       severity: 'HIGH',     description: 'Tailgating detected at Security Checkpoint — 2 persons, 1 badge scan', camera_id: 2, timestamp: new Date(Date.now() - 3600000).toISOString(), acknowledged: true, acknowledged_by: 'operator_1' },
];

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
  const { alerts: storeAlerts, token, acknowledgeAlert, user, addToast } = useStore();
  const alerts = storeAlerts.length > 0 ? storeAlerts : DEMO_ALERTS;

  const [filter, setFilter] = useState<'all' | 'unack' | 'ack'>('unack');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [selected, setSelected] = useState<number[]>([]);

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

  const doAck = async (id: number) => {
    if (token && token !== 'demo-token') {
      try {
        await api.acknowledgeAlert(token, id, user?.username || 'operator');
      } catch { /* demo mode */ }
    }
    acknowledgeAlert(id);
    addToast('Alert acknowledged', 'success');
    setSelected((prev) => prev.filter((s) => s !== id));
  };

  const doAckAll = () => {
    const toAck = sorted.filter((a) => !a.acknowledged).map((a) => a.id);
    toAck.forEach((id) => acknowledgeAlert(id));
    addToast(`${toAck.length} alerts acknowledged`, 'success');
    setSelected([]);
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

  return (
    <div className="page-content">
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
                      onClick={() => doAck(a.id)}
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
    </div>
  );
}
