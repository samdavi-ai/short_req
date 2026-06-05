// API client — all backend calls
const BASE = 'http://localhost:8000';

function authHeaders(token: string | null) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },

  // Analytics
  getStats: (token: string) =>
    fetch(`${BASE}/analytics/stats`, { headers: authHeaders(token) }).then((r) => r.json()),

  getDashboard: (token: string) =>
    fetch(`${BASE}/analytics/`, { headers: authHeaders(token) }).then((r) => r.json()),

  // Cameras
  getCameras: (token: string) =>
    fetch(`${BASE}/cameras/`, { headers: authHeaders(token) }).then((r) => r.json()),

  createCamera: (token: string, data: Record<string, unknown>) =>
    fetch(`${BASE}/cameras/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateCamera: (token: string, id: number, data: Record<string, unknown>) =>
    fetch(`${BASE}/cameras/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteCamera: (token: string, id: number) =>
    fetch(`${BASE}/cameras/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),

  bulkUpdateCameraPositions: (token: string, positions: any[]) =>
    fetch(`${BASE}/cameras/positions/bulk`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ positions }),
    }).then((r) => r.json()),

  // Alerts
  getAlerts: (token: string, ack?: boolean) =>
    fetch(`${BASE}/alerts/${ack !== undefined ? `?acknowledged=${ack}` : ''}`, {
      headers: authHeaders(token),
    }).then((r) => r.json()),

  acknowledgeAlert: (token: string, id: number, by: string) =>
    fetch(`${BASE}/alerts/${id}/acknowledge`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ acknowledged_by: by }),
    }).then((r) => r.json()),

  bulkAcknowledge: (token: string, ids: number[], by: string) =>
    fetch(`${BASE}/alerts/bulk-acknowledge`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ alert_ids: ids, acknowledged_by: by }),
    }).then((r) => r.json()),

  getUnacknowledgedCount: (token: string) =>
    fetch(`${BASE}/alerts/unacknowledged/count`, { headers: authHeaders(token) }).then((r) =>
      r.json()
    ),

  // Visitors
  getVisitors: (token: string) =>
    fetch(`${BASE}/visitors/`, { headers: authHeaders(token) }).then((r) => r.json()),

  getWatchlist: (token: string) =>
    fetch(`${BASE}/visitors/watchlist`, { headers: authHeaders(token) }).then((r) => r.json()),

  createVisitor: (token: string, data: Record<string, unknown>) =>
    fetch(`${BASE}/visitors/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  setVisitorStatus: (token: string, id: number, status: string) =>
    fetch(`${BASE}/visitors/${id}/status?status=${status}`, {
      method: 'PATCH',
      headers: authHeaders(token),
    }).then((r) => r.json()),

  uploadVisitorPhoto: (token: string, id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/visitors/${id}/photo`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then((r) => r.json());
  },

  // Employees
  getEmployees: (token: string) =>
    fetch(`${BASE}/employees/`, { headers: authHeaders(token) }).then((r) => r.json()),

  createEmployee: (token: string, data: Record<string, unknown>) =>
    fetch(`${BASE}/employees/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  getBreakCompliance: (token: string) =>
    fetch(`${BASE}/employees/break-compliance`, { headers: authHeaders(token) }).then((r) =>
      r.json()
    ),

  // Zones
  getZones: (token: string) =>
    fetch(`${BASE}/zones/`, { headers: authHeaders(token) }).then((r) => r.json()),

  createZone: (token: string, data: Record<string, unknown>) =>
    fetch(`${BASE}/zones/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteZone: (token: string, id: number) =>
    fetch(`${BASE}/zones/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),

  updateZone: (token: string, id: number, data: Record<string, unknown>) =>
    fetch(`${BASE}/zones/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Layouts
  getLayouts: (token: string) =>
    fetch(`${BASE}/layouts/`, { headers: authHeaders(token) }).then((r) => r.json()),

  // Tracks
  getActiveTracks: (token: string) =>
    fetch(`${BASE}/tracks/active`, { headers: authHeaders(token) }).then((r) => r.json()),
};
