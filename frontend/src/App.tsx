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

  // Not authenticated
  if (!token) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  // Initialize WebSocket once logged in
  React.useEffect(() => {
    if (token && token !== 'demo-token') {
      useStore.getState().initWebSocket();
    }
  }, [token]);

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
