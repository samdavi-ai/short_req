import React, { useState } from 'react';
import {
  LayoutDashboard, Camera, MapPin, ShieldAlert, Users,
  UserCheck, BarChart3, Settings, LogOut, Pin, PinOff, Fingerprint,
} from 'lucide-react';
import { useStore } from '../stores/appStore';

const NAV = [
  { id: 'dashboard',     label: 'Dashboard',       icon: LayoutDashboard, section: 'MONITOR' },
  { id: 'live',          label: 'Live Feeds',       icon: Camera,          section: 'MONITOR' },
  { id: 'layout',        label: 'Layout Editor',    icon: MapPin,          section: 'MONITOR' },
  { id: 'alerts',        label: 'Alerts',           icon: ShieldAlert,     section: 'OPS',    badge: true },
  { id: 'visitors',      label: 'Visitors',         icon: Users,           section: 'OPS' },
  { id: 'employees',     label: 'Employees',        icon: UserCheck,       section: 'OPS' },
  { id: 'person-lookup', label: 'Person Lookup',    icon: Fingerprint,     section: 'OPS' },
  { id: 'analytics',     label: 'Analytics',        icon: BarChart3,       section: 'INTEL' },
  { id: 'cameras',       label: 'Cameras',          icon: Camera,          section: 'INTEL' },
  { id: 'settings',      label: 'Settings',         icon: Settings,        section: 'SYS' },
];

export default function Sidebar() {
  const { currentPage, setPage, user, logout, alerts } = useStore();
  const [pinned, setPinned] = useState(false);
  const unackCount = alerts.filter((a) => !a.acknowledged).length;
  const sections = [...new Set(NAV.map((n) => n.section))];

  return (
    <aside
      className="sidebar"
      data-pinned={pinned ? 'true' : 'false'}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-title">SecureWatch</span>
            <span className="logo-sub">v3.0 · Airport</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <React.Fragment key={section}>
            <span className="nav-section-label" aria-hidden="true">{section}</span>
            {NAV.filter((n) => n.section === section).map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setPage(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  data-label={item.label}
                  title={item.label}
                >
                  <span className="nav-icon-wrap">
                    <Icon size={17} className="nav-icon" aria-hidden="true" />
                  </span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && unackCount > 0 && (
                    <span
                      className="nav-item-badge"
                      aria-label={`${unackCount} unacknowledged alerts`}
                    >
                      {unackCount > 99 ? '99+' : unackCount}
                    </span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* Pin button — keep sidebar expanded */}
      <button
        className="sidebar-pin-btn"
        onClick={() => setPinned((p) => !p)}
        title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
        aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
        aria-pressed={pinned}
      >
        {pinned ? <PinOff size={12} /> : <Pin size={12} />}
      </button>

      {/* User footer */}
      <div className="sidebar-footer">
        <div
          className="user-card"
          onClick={() => setPage('settings')}
          role="button"
          tabIndex={0}
          aria-label="Open settings"
          onKeyDown={(e) => e.key === 'Enter' && setPage('settings')}
        >
          <div className="user-avatar">
            <div className="user-avatar-inner" aria-hidden="true">
              {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
            </div>
          </div>
          <div className="user-info">
            <div className="user-name">{user?.full_name || user?.username || 'Operator'}</div>
            <div className="user-role">{user?.role || 'operator'}</div>
          </div>
        </div>

        {/* Logout — shown as separate row at very bottom when expanded */}
        <button
          id="logout-btn"
          onClick={logout}
          className="nav-item"
          style={{ marginTop: 2 }}
          data-label="Logout"
          title="Logout"
          aria-label="Logout"
        >
          <span className="nav-icon-wrap">
            <LogOut size={16} style={{ color: 'var(--red)' }} aria-hidden="true" />
          </span>
          <span className="nav-label" style={{ color: 'var(--red)' }}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
