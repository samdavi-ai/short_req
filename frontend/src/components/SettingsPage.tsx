import React, { useState } from 'react';
import { Settings, Shield, Bell, Database, Save, RefreshCw } from 'lucide-react';
import { useStore } from '../stores/appStore';

export default function SettingsPage() {
  const { addToast, user } = useStore();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    alertRetentionDays: 30,
    breakIntervalDefault: 120,
    breakDurationDefault: 15,
    dwellAlertSeconds: 900,
    cameraHeartbeatInterval: 30,
    maxOccupancyPerZone: 50,
    enableEmailAlerts: true,
    enableWatchlistAutoAlert: true,
    enableBreakCompliance: true,
    theme: 'dark',
  });

  const handleSave = () => {
    setSaved(true);
    addToast('Settings saved successfully', 'success');
    setTimeout(() => setSaved(false), 3000);
  };

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={14} color="var(--green-bright)" />
          </div>
          <span className="card-title">{title}</span>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );

  const Toggle = ({ label, desc, value, onChange }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
          background: value ? 'var(--green)' : 'var(--surface-4)',
          position: 'relative', transition: 'all 0.2s ease', flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3, left: value ? 23 : 3,
          transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ padding: 20, maxWidth: 720 }}>

        <Section title="Operator Profile" icon={Shield}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" defaultValue={user?.full_name || 'System Administrator'} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <input className="form-input" defaultValue={user?.role || 'admin'} readOnly style={{ opacity: 0.7 }} />
            </div>
          </div>
        </Section>

        <Section title="Alert Configuration" icon={Bell}>
          <Toggle label="Watchlist Auto-Alert" desc="Immediately trigger alert when watchlisted person detected"
            value={settings.enableWatchlistAutoAlert}
            onChange={(v: boolean) => setSettings({ ...settings, enableWatchlistAutoAlert: v })} />
          <Toggle label="Email Notifications" desc="Send alert summaries to supervisor email"
            value={settings.enableEmailAlerts}
            onChange={(v: boolean) => setSettings({ ...settings, enableEmailAlerts: v })} />
          <Toggle label="Break Compliance Monitoring" desc="Track employee break schedules and generate violations"
            value={settings.enableBreakCompliance}
            onChange={(v: boolean) => setSettings({ ...settings, enableBreakCompliance: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <div className="form-group">
              <label className="form-label">Alert Retention (days)</label>
              <input className="form-input" type="number" value={settings.alertRetentionDays}
                onChange={(e) => setSettings({ ...settings, alertRetentionDays: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Dwell Alert Threshold (sec)</label>
              <input className="form-input" type="number" value={settings.dwellAlertSeconds}
                onChange={(e) => setSettings({ ...settings, dwellAlertSeconds: +e.target.value })} />
            </div>
          </div>
        </Section>

        <Section title="Employee Break Defaults" icon={RefreshCw}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Default Break Interval (min)</label>
              <input className="form-input" type="number" value={settings.breakIntervalDefault}
                onChange={(e) => setSettings({ ...settings, breakIntervalDefault: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Break Duration (min)</label>
              <input className="form-input" type="number" value={settings.breakDurationDefault}
                onChange={(e) => setSettings({ ...settings, breakDurationDefault: +e.target.value })} />
            </div>
          </div>
        </Section>

        <Section title="System & Infrastructure" icon={Database}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Camera Heartbeat Interval (sec)</label>
              <input className="form-input" type="number" value={settings.cameraHeartbeatInterval}
                onChange={(e) => setSettings({ ...settings, cameraHeartbeatInterval: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Occupancy Per Zone</label>
              <input className="form-input" type="number" value={settings.maxOccupancyPerZone}
                onChange={(e) => setSettings({ ...settings, maxOccupancyPerZone: +e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Backend API', value: 'http://localhost:8000', ok: true },
                { label: 'Redis', value: 'localhost:6379', ok: true },
                { label: 'PostgreSQL', value: 'localhost:5432', ok: true },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.ok ? 'var(--green-bright)' : 'var(--red-bright)', animation: 'status-pulse 2s infinite' }} />
                    <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => addToast('Settings reset to defaults', 'info')}>
            <RefreshCw size={14} /> Reset Defaults
          </button>
          <button id="save-settings-btn" className="btn btn-primary" onClick={handleSave}>
            <Save size={14} />
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
