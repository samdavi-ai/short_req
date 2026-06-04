import React from 'react';
import {
  LayoutDashboard, Camera, MapPin, ShieldAlert, Users,
  UserCheck, BarChart3, Settings, LogOut, Bell
} from 'lucide-react';
import { useStore } from '../stores/appStore';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',       icon: LayoutDashboard, section: 'MONITORING' },
  { id: 'live',       label: 'Live Feeds',       icon: Camera,          section: 'MONITORING' },
  { id: 'layout',     label: 'Layout Editor',    icon: MapPin,          section: 'MONITORING' },
  { id: 'alerts',     label: 'Alerts',           icon: ShieldAlert,     section: 'OPERATIONS', badge: true },
  { id: 'visitors',   label: 'Visitors',         icon: Users,           section: 'OPERATIONS' },
  { id: 'employees',  label: 'Employees',        icon: UserCheck,       section: 'OPERATIONS' },
  { id: 'analytics',  label: 'Analytics',        icon: BarChart3,       section: 'INTELLIGENCE' },
  { id: 'cameras',    label: 'Camera Manager',   icon: Camera,          section: 'INTELLIGENCE' },
  { id: 'settings',   label: 'Settings',         icon: Settings,        section: 'SYSTEM' },
];

export default function Sidebar() {
  const { currentPage, setPage, user, logout, alerts } = useStore();
  const unackCount = alerts.filter((a) => !a.acknowledged).length;

  const sections = [...new Set(NAV.map((n) => n.section))];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
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
            <span className="nav-section-label">{section}</span>
            {NAV.filter((n) => n.section === section).map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  <Icon size={16} className="nav-icon" />
                  {item.label}
                  {item.badge && unackCount > 0 && (
                    <span className="nav-item-badge">{unackCount > 99 ? '99+' : unackCount}</span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-card" onClick={() => setPage('settings')}>
          <div className="user-avatar">
            {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.full_name || user?.username}</div>
            <div className="user-role">{user?.role || 'operator'}</div>
          </div>
          <button
            id="logout-btn"
            onClick={(e) => { e.stopPropagation(); logout(); }}
            style={{
              background: 'rgba(255,0,85,0.1)', border: '1px solid rgba(255,0,85,0.3)', cursor: 'pointer',
              color: 'var(--red)', display: 'flex', padding: '6px',
              borderRadius: '8px', transition: 'all 0.2s',
            }}
            title="Logout"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--red)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,0,85,0.1)';
              e.currentTarget.style.color = 'var(--red)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
