import React, { useEffect, useState } from 'react';
import './index.css';
import { useStore } from './stores/appStore';

import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastContainer from './components/ToastContainer';
import AlertTicker from './components/AlertTicker';
import CommandPalette from './components/CommandPalette';

// Pages
import Dashboard from './components/Dashboard';
import LiveFeeds from './components/LiveFeeds';
import LayoutEditor from './components/LayoutEditor';
import AlertsPage from './components/AlertsPage';
import VisitorsPage from './components/VisitorsPage';
import EmployeesPage from './components/EmployeesPage';
import AnalyticsPage from './components/AnalyticsPage';
import CameraManager from './components/CameraManager';
import SettingsPage from './components/SettingsPage';
import PersonLookupPage from './components/PersonLookupPage';
import { getApiBaseUrl } from './config/runtime';

function renderPage(page: string): React.ReactElement {
  switch (page) {
    case 'dashboard':      return <Dashboard />;
    case 'live':           return <LiveFeeds />;
    case 'layout':         return <LayoutEditor />;
    case 'alerts':         return <AlertsPage />;
    case 'visitors':       return <VisitorsPage />;
    case 'employees':      return <EmployeesPage />;
    case 'analytics':      return <AnalyticsPage />;
    case 'cameras':        return <CameraManager />;
    case 'settings':       return <SettingsPage />;
    case 'person-lookup':  return <PersonLookupPage />;
    default:               return <Dashboard />;
  }
}

export default function App() {
  const { token, currentPage } = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Initialize data on login
  useEffect(() => {
    if (token) {
      useStore.getState().initWebSocket();
      const { setCameras, setAlerts, setVisitors, setEmployees, setZones } = useStore.getState();
      const headers = token !== 'demo-token' ? { Authorization: `Bearer ${token}` } : {};
      const base = getApiBaseUrl();
      Promise.all([
        fetch(`${base}/cameras/`,             { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/alerts/?limit=50`,     { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/visitors/?limit=100`,  { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/employees/?limit=100`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/zones/?active_only=false`, { headers }).then(r => r.ok ? r.json() : []),
      ]).then(([cameras, alerts, visitors, employees, zones]) => {
        if (Array.isArray(cameras))   setCameras(cameras);
        if (Array.isArray(alerts))    setAlerts(alerts);
        if (Array.isArray(visitors))  setVisitors(visitors);
        if (Array.isArray(employees)) setEmployees(employees);
        if (Array.isArray(zones))     setZones(zones);
      }).catch(console.error);
    }
  }, [token]);

  // Global Cmd+K handler
  useEffect(() => {
    if (!token) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [token]);

  // Not authenticated
  if (!token) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main-area">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <div key={currentPage} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {renderPage(currentPage)}
        </div>
      </div>

      {/* Global overlays */}
      <AlertTicker />
      <ToastContainer />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
