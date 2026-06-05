import React from 'react';
import './index.css';
import { useStore } from './stores/appStore';

import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastContainer from './components/ToastContainer';

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

const PAGE_MAP: Record<string, React.ReactElement> = {
  dashboard: <Dashboard />,
  live:      <LiveFeeds />,
  layout:    <LayoutEditor />,
  alerts:    <AlertsPage />,
  visitors:  <VisitorsPage />,
  employees: <EmployeesPage />,
  analytics: <AnalyticsPage />,
  cameras:   <CameraManager />,
  settings:  <SettingsPage />,
};

export default function App() {
  const { token, currentPage } = useStore();

  // Initialize WebSocket once logged in — MUST be before any early return
  React.useEffect(() => {
    if (token && token !== 'demo-token') {
      useStore.getState().initWebSocket();
      // Load initial data
      const { setCameras, setAlerts, setVisitors, setEmployees, setZones } = useStore.getState();
      const headers = { Authorization: `Bearer ${token}` };
      const base = 'http://localhost:8000';
      Promise.all([
        fetch(`${base}/cameras/`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/alerts/?limit=50`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/visitors/?limit=100`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/employees/?limit=100`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${base}/zones/`, { headers }).then(r => r.ok ? r.json() : []),
      ]).then(([cameras, alerts, visitors, employees, zones]) => {
        if (Array.isArray(cameras))  setCameras(cameras);
        if (Array.isArray(alerts))   setAlerts(alerts);
        if (Array.isArray(visitors)) setVisitors(visitors);
        if (Array.isArray(employees)) setEmployees(employees);
        if (Array.isArray(zones))    setZones(zones);
      }).catch(console.error);
    }
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
        <Topbar />
        {PAGE_MAP[currentPage] || <Dashboard />}
      </div>
      <ToastContainer />
    </div>
  );
}
