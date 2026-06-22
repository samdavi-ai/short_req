// API client — all backend calls
import { getApiBaseUrl } from '../config/runtime';

const BASE = getApiBaseUrl();

function authHeaders(token: string | null) {
  return {
    'Content-Type': 'application/json',
    ...(token && token.length > 0 ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function checkOk(res: Response) {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const body = await res.json(); detail = body.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res;
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
    await checkOk(res);
    return res.json();
  },

  changePassword: async (token: string, data: Record<string, string>) => {
    const res = await fetch(`${BASE}/auth/change-password`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  // Audit
  getAuditLogs: async (token: string, limit: number = 50, offset: number = 0) => {
    const res = await fetch(`${BASE}/audit/logs?limit=${limit}&offset=${offset}`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  // Analytics
  getStats: async (token: string) => {
    const res = await fetch(`${BASE}/analytics/stats`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  getDashboard: async (token: string) => {
    const res = await fetch(`${BASE}/analytics/`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  // Cameras
  getCameras: async (token: string) => {
    const res = await fetch(`${BASE}/cameras/`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createCamera: async (token: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/cameras/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  updateCamera: async (token: string, id: number, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/cameras/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  deleteCamera: async (token: string, id: number) => {
    const res = await fetch(`${BASE}/cameras/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    // 204 No Content — no body to parse
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  bulkUpdateCameraPositions: async (token: string, positions: any[]) => {
    const res = await fetch(`${BASE}/cameras/positions/bulk`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ positions }),
    });
    await checkOk(res);
    return res.json();
  },

  // Alerts
  getAlerts: async (token: string, ack?: boolean) => {
    const url = ack !== undefined ? `${BASE}/alerts/?acknowledged=${ack}` : `${BASE}/alerts/`;
    const res = await fetch(url, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  acknowledgeAlert: async (token: string, id: number, by: string) => {
    const res = await fetch(`${BASE}/alerts/${id}/acknowledge`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ acknowledged_by: by }),
    });
    await checkOk(res);
    return res.json();
  },

  bulkAcknowledge: async (token: string, ids: number[], by: string) => {
    const params = new URLSearchParams({ acknowledged_by: by });
    const res = await fetch(`${BASE}/alerts/bulk-acknowledge?${params.toString()}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(ids),
    });
    await checkOk(res);
    return res.json();
  },

  getUnacknowledgedCount: async (token: string) => {
    const res = await fetch(`${BASE}/alerts/unacknowledged/count`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  // Visitors
  getVisitors: async (token: string) => {
    const res = await fetch(`${BASE}/visitors/`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  getWatchlist: async (token: string) => {
    const res = await fetch(`${BASE}/visitors/watchlist`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createVisitor: async (token: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/visitors/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  setVisitorStatus: async (token: string, id: number, status: string) => {
    const res = await fetch(`${BASE}/visitors/${id}/status?status=${status}`, {
      method: 'PATCH',
      headers: authHeaders(token),
    });
    await checkOk(res);
    return res.json();
  },

  uploadVisitorPhoto: (token: string, id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/visitors/${id}/photo`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => checkOk(r)).then((r) => r.json());
  },

  deleteVisitor: async (token: string, id: number) => {
    const res = await fetch(`${BASE}/visitors/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  // Employees
  getEmployees: async (token: string) => {
    const res = await fetch(`${BASE}/employees/`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createEmployee: async (token: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/employees/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  enrollEmployeeFace: (token: string, id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/enrollment/face/employee/${id}`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => checkOk(r)).then((r) => r.json());
  },

  deleteEmployee: async (token: string, id: number) => {
    const res = await fetch(`${BASE}/employees/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  getBreakCompliance: async (token: string) => {
    const res = await fetch(`${BASE}/employees/break-compliance`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  // Zones — always fetch ALL zones (active_only=false) so the store is complete
  getZones: async (token: string) => {
    const res = await fetch(`${BASE}/zones/?active_only=false`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createZone: async (token: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/zones/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  deleteZone: async (token: string, id: number) => {
    const res = await fetch(`${BASE}/zones/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  updateZone: async (token: string, id: number, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/zones/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  // Layouts
  getLayouts: async (token: string) => {
    const res = await fetch(`${BASE}/layouts/`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  // Tracks
  getActiveTracks: async (token: string) => {
    const res = await fetch(`${BASE}/tracks/active`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  getPersonTracks: async (token: string, type: 'employee' | 'visitor', id: number) => {
    const res = await fetch(`${BASE}/tracks/person/${type}/${id}`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  // Sites
  getSites: async (token: string) => {
    const res = await fetch(`${BASE}/sites/`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  getSite: async (token: string, siteId: number) => {
    const res = await fetch(`${BASE}/sites/${siteId}`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createSite: async (token: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/sites/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  updateSite: async (token: string, id: number, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/sites/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  deleteSite: async (token: string, id: number) => {
    const res = await fetch(`${BASE}/sites/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  // Buildings
  getBuildings: async (token: string, siteId?: number) => {
    const url = siteId ? `${BASE}/buildings/?site_id=${siteId}` : `${BASE}/buildings/`;
    const res = await fetch(url, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  getBuilding: async (token: string, buildingId: number) => {
    const res = await fetch(`${BASE}/buildings/${buildingId}`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createBuilding: async (token: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/buildings/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  updateBuilding: async (token: string, id: number, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/buildings/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  deleteBuilding: async (token: string, id: number) => {
    const res = await fetch(`${BASE}/buildings/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  // Floors
  getFloors: async (token: string, buildingId: number) => {
    const res = await fetch(`${BASE}/buildings/${buildingId}/floors`, { headers: authHeaders(token) });
    await checkOk(res);
    return res.json();
  },

  createFloor: async (token: string, buildingId: number, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/buildings/${buildingId}/floors`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  updateFloor: async (token: string, buildingId: number, floorId: number, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/buildings/${buildingId}/floors/${floorId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  deleteFloor: async (token: string, buildingId: number, floorId: number) => {
    const res = await fetch(`${BASE}/buildings/${buildingId}/floors/${floorId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok && res.status !== 404) await checkOk(res);
  },

  // Simulation
  publishSimulationEvents: async (
    token: string,
    data: {
      floor: number;
      building_id?: number | null;
      site_id?: number | null;
      events: Record<string, unknown>[];
    }
  ) => {
    const res = await fetch(`${BASE}/simulation/publish`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  startSimulation: async (
    token: string,
    data: {
      floor: number;
      building_id?: number | null;
      site_id?: number | null;
      seed?: number;
      speed?: number;
    }
  ) => {
    const res = await fetch(`${BASE}/simulation/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },

  stopSimulation: async (token: string, session_id: string) => {
    const res = await fetch(`${BASE}/simulation/stop?session_id=${encodeURIComponent(session_id)}`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await checkOk(res);
    return res.json();
  },

  tickSimulation: async (
    token: string,
    data: {
      session_id: string;
      tick: number;
      events: Record<string, unknown>[];
    }
  ) => {
    const res = await fetch(`${BASE}/simulation/tick`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    await checkOk(res);
    return res.json();
  },
};
