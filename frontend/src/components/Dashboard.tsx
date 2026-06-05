import React, { useMemo, useState } from 'react';
import {
  Camera, ShieldAlert, Users, UserCheck,
  Activity, Eye, AlertTriangle, CheckCircle,
  Clock, MapPin, CheckCheck, X, Fingerprint
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

const TYPE_ICON: Record<string, string> = {
  RESTRICTED_ZONE: '🚫',
  WATCHLIST_MATCH: '👤',
  DWELL_EXCEEDED:  '⏱',
  CAMERA_OFFLINE:  '📷',
  BREAK_VIOLATION: '☕',
  TAILGATING:      '🚷',
};

const sevColor = (s: string) => {
  if (s === 'CRITICAL') return 'var(--red)';
  if (s === 'HIGH') return '#FF6644';
  if (s === 'MEDIUM') return 'var(--amber)';
  return 'var(--text-muted)';
};

export default function Dashboard() {
  const { stats, alerts, cameras, visitors, employees, token, user, addToast, acknowledgeAlert, setPage } = useStore();
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  // Core metrics
  const totalCams    = stats?.total_cameras   ?? cameras.length;
  const activeCams   = stats?.active_cameras  ?? cameras.filter((c) => c.status === 'ACTIVE').length;
  const offlineCams  = totalCams - activeCams;
  const unackAlerts  = alerts.filter((a) => !a.acknowledged);
  const unackCount   = unackAlerts.length;
  const totalVisitors= stats?.total_visitors  ?? visitors.length;
  const activeEmps   = employees.filter(e => e.is_active).length;

  const doAck = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (token && token !== 'demo-token') {
      try {
        await api.acknowledgeAlert(token, id, user?.username || 'operator');
      } catch (err) {
        console.error('Failed to acknowledge alert via API', err);
      }
    }
    acknowledgeAlert(id);
    addToast('Alert acknowledged', 'success');
    if (selectedAlertId === id) setSelectedAlertId(null);
  };

  // Activity Feed (mix of recent ack'd alerts and visitor checkins)
  const recentActivity = useMemo(() => {
    const act = [];
    const ackAlerts = alerts.filter(a => a.acknowledged).slice(0, 5);
    for (const a of ackAlerts) {
      act.push({
        id: `alt-${a.id}`, type: 'alert', time: new Date(a.timestamp),
        desc: `Alert Acknowledged: ${a.alert_type.replace(/_/g, ' ')}`,
        icon: ShieldAlert, color: 'var(--text-muted)'
      });
    }
    const recentVis = visitors.slice(0, 5);
    for (const v of recentVis) {
      act.push({
        id: `vis-${v.id}`, type: 'visitor', time: new Date(), // Mocking time for UI
        desc: `Visitor Checked In: ${v.fullname}`,
        icon: Users, color: 'var(--teal)'
      });
    }
    return act.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
  }, [alerts, visitors]);

  // Determine system state
  const isHealthy = unackCount === 0 && offlineCams === 0;

  return (
    <div className="page-content" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>

      {/* ── 1. WELCOME BANNER ── */}
      <div style={{
        padding: '24px 32px',
        borderRadius: 'var(--radius-lg)',
        background: isHealthy ? 'var(--green-dim)' : 'var(--red-dim)',
        border: `1px solid ${isHealthy ? 'var(--green-border)' : 'var(--red-border)'}`,
        display: 'flex', alignItems: 'center', gap: 20
      }}>
        {isHealthy ? (
          <CheckCircle size={48} color="var(--green)" style={{ flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={48} color="var(--red)" style={{ flexShrink: 0 }} />
        )}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: isHealthy ? 'var(--green)' : 'var(--red)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isHealthy ? 'System is operating normally' : 'Attention Required'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4, fontFamily: 'var(--font-body)', maxWidth: 600, lineHeight: 1.5 }}>
            {isHealthy
              ? 'All cameras are online and there are no active alerts. The security perimeter is secure.'
              : `${unackCount > 0 ? `${unackCount} active alerts require your review. ` : ''}${offlineCams > 0 ? `${offlineCams} cameras are currently offline.` : ''}`
            }
          </p>
        </div>
      </div>

      {/* ── 2. KEY METRICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Active Cameras', value: `${activeCams} of ${totalCams}`, sub: 'Online', icon: Camera, color: offlineCams > 0 ? 'var(--amber)' : 'var(--teal)' },
          { label: 'Pending Alerts', value: unackCount, sub: 'Requires Review', icon: ShieldAlert, color: unackCount > 0 ? 'var(--red)' : 'var(--text-muted)' },
          { label: 'Visitors Today', value: totalVisitors, sub: 'Checked In', icon: Users, color: 'var(--orange)' },
          { label: 'Staff On Duty', value: activeEmps, sub: 'Currently Active', icon: UserCheck, color: 'var(--green)' },
        ].map((m, i) => (
          <div key={i} style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            padding: 24, display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {m.label}
              </span>
              <m.icon size={20} color={m.color} />
            </div>
            <div>
              <div style={{ fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {m.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {m.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        
        {/* ── 3. ATTENTION REQUIRED (Active Alerts) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <ShieldAlert size={18} color="var(--red)" />
            <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Action Needed
            </h2>
          </div>

          {unackAlerts.length === 0 ? (
             <div style={{
              background: 'var(--bg-panel)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)',
              padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12
            }}>
              <CheckCircle size={32} color="var(--green)" opacity={0.5} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
                You're all caught up. There are no pending alerts.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {unackAlerts.map(a => (
                <div key={a.id} style={{
                  background: 'var(--bg-panel)', border: `1px solid ${sevColor(a.severity)}`, borderRadius: 'var(--radius-md)',
                  padding: 20, display: 'flex', alignItems: 'center', gap: 16,
                  boxShadow: a.severity === 'CRITICAL' ? 'var(--red-glow)' : 'none'
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: a.severity === 'CRITICAL' ? 'var(--red-dim)' : 'rgba(245, 158, 11, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: 24
                  }}>
                    {TYPE_ICON[a.alert_type] || '⚠️'}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 6px', borderRadius: 2,
                        background: a.severity === 'CRITICAL' ? 'var(--red)' : 'var(--amber)', color: '#000', letterSpacing: '0.06em'
                      }}>
                        {a.severity}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {a.alert_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {a.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => doAck(a.id)}
                      style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600 }}
                    >
                      Acknowledge
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setSelectedAlertId(a.id)}
                      style={{ padding: '8px 16px', fontSize: 12 }}
                    >
                      View Snapshot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4. RECENT ACTIVITY & QUICK ACTIONS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Quick Actions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <Activity size={18} color="var(--orange)" />
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Quick Actions
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Person Lookup', icon: Fingerprint, page: 'person-lookup' },
                { label: 'Live Feeds', icon: Eye, page: 'live' },
                { label: 'Watchlist', icon: AlertTriangle, page: 'visitors' },
                { label: 'Analytics', icon: Activity, page: 'analytics' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => setPage(action.page)}
                  style={{
                    background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer', transition: 'all var(--t-fast)', color: 'var(--text-primary)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange-border)'; e.currentTarget.style.color = 'var(--orange)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  <action.icon size={24} />
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <Clock size={18} color="var(--teal)" />
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Recent Activity
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentActivity.map(act => (
                <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ marginTop: 2 }}>
                    <act.icon size={14} color={act.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {act.desc}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {act.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div style={{ color: 'var(--text-ghost)', fontSize: 12, fontStyle: 'italic' }}>
                  No recent activity to display.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Snapshot Modal (Simplified) */}
      {(() => {
        const selectedAlert = alerts.find(a => a.id === selectedAlertId);
        if (!selectedAlert) return null;
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(7, 9, 15, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: 24, animation: 'fade-in 0.2s ease-out'
          }} onClick={() => setSelectedAlertId(null)}>
            
            <div style={{
              background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)',
              width: '100%', maxWidth: 600, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
              
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={18} color="var(--orange)" /> Alert Snapshot
                </h3>
                <button onClick={() => setSelectedAlertId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  <strong>{selectedAlert.alert_type.replace(/_/g, ' ')}:</strong> {selectedAlert.description}
                </div>

                {selectedAlert.snapshot_url ? (
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={selectedAlert.snapshot_url} alt="Alert Snapshot" style={{ width: '100%', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ height: 240, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
                    <Camera size={48} opacity={0.2} />
                    <span style={{ fontSize: 13 }}>No image available for this alert.</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={() => doAck(selectedAlert.id)}>
                    <CheckCheck size={16} style={{ marginRight: 8 }} /> Acknowledge Alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
