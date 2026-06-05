// Zustand global store — mirrors backend API state
import { create } from 'zustand';

export interface Camera {
  id: number;
  name: string;
  rtsp_url: string;
  location: string;
  floor: number;
  x_coord: number;
  y_coord: number;
  angle: number;
  fov?: number;
  status: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE';
  is_overhead: boolean;
}

export interface Alert {
  id: number;
  alert_type: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  camera_id: number | null;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  snapshot_url?: string;
}

export interface Visitor {
  id: number;
  fullname: string;
  passport_number: string;
  nationality: string;
  phone_number?: string;
  address?: string;
  purpose?: string;
  approved_by?: string;
  requires_escort: boolean;
  location?: string;
  entry_time?: string;
  exit_time?: string;
  approver_id?: string;
  department?: string;
  role?: string;
  status: 'WHITELISTED' | 'BLACKLISTED' | 'WATCHLIST' | 'PENDING';
  created_at: string;
  photo_path?: string;
  face_embedding_id?: string;
  current_location?: string;
  last_seen?: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  fullname: string;
  department: string;
  break_interval_minutes: number;
  break_duration_minutes: number;
  is_active: boolean;
  current_location?: string;
  last_seen?: string;
}

export interface Zone {
  id: number;
  name: string;
  floor: number;
  zone_type: 'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE';
  is_active: boolean;
  dwell_alert_seconds: number;
  coordinates: {x: number; y: number}[];
  color?: string;
}

export type IdentityType = 'UNKNOWN' | 'KNOWN_VISITOR' | 'KNOWN_EMPLOYEE' | 'WATCHLIST_MATCH' | 'BLACKLISTED';

export interface LiveTrack {
  global_id: string;
  track_id: number;
  camera_id: number;
  x: number;
  y: number;
  bbox: [number, number, number, number];
  has_face: boolean;
  identity_type: IdentityType;
  matched_name: string | null;
  matched_person_id: number | null;
  person_type: 'visitor' | 'employee' | null;
  matched_via: string;
  entry_exit: 'IN' | 'OUT' | null;
  timestamp: number;
}

export interface AnalyticsStats {
  total_cameras: number;
  active_cameras: number;
  offline_cameras: number;
  active_tracks: number;
  total_visitors: number;
  watchlisted: number;
  unacknowledged_alerts: number;
  total_employees: number;
  total_zones: number;
}

interface AppStore {
  // Auth
  user: { username: string; role: string; full_name: string } | null;
  token: string | null;
  setAuth: (user: AppStore['user'], token: string) => void;
  logout: () => void;

  // Navigation
  currentPage: string;
  setPage: (page: string) => void;

  // Data
  cameras: Camera[];
  alerts: Alert[];
  visitors: Visitor[];
  employees: Employee[];
  zones: Zone[];
  stats: AnalyticsStats | null;

  setCameras: (c: Camera[]) => void;
  setAlerts: (a: Alert[]) => void;
  setVisitors: (v: Visitor[]) => void;
  setEmployees: (e: Employee[]) => void;
  setZones: (z: Zone[]) => void;
  setStats: (s: AnalyticsStats) => void;
  acknowledgeAlert: (id: number) => void;

  // Toast
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // WebSockets
  tracks: Record<string, LiveTrack>;
  initWebSocket: () => void;
}

export const useStore = create<AppStore>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, currentPage: 'login' });
  },

  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),

  cameras: [],
  alerts: [],
  visitors: [],
  employees: [],
  zones: [],
  stats: null,

  setCameras: (cameras) => set({ cameras }),
  setAlerts: (alerts) => set({ alerts }),
  setVisitors: (visitors) => set({ visitors }),
  setEmployees: (employees) => set({ employees }),
  setZones: (zones) => set({ zones }),
  setStats: (stats) => set({ stats }),
  acknowledgeAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  tracks: {},
  initWebSocket: () => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "TRACK_UPDATE") {
          const track: LiveTrack = {
            global_id: payload.global_id,
            track_id: payload.track_id,
            camera_id: payload.camera_id,
            x: payload.x,
            y: payload.y,
            bbox: payload.bbox,
            has_face: payload.has_face,
            identity_type: payload.identity_type || 'UNKNOWN',
            matched_name: payload.matched_name || null,
            matched_person_id: payload.matched_person_id || null,
            person_type: payload.person_type || null,
            matched_via: payload.matched_via || 'unknown',
            entry_exit: payload.entry_exit || null,
            timestamp: payload.timestamp,
          };
          set((state) => ({
            tracks: {
              ...state.tracks,
              [payload.global_id]: track
            }
          }));
        } else if (payload.type === 'ALERT_NEW') {
          const alert = payload.data;
          const currentAlerts = useStore.getState().alerts;
          set({
            alerts: [
              {
                id: alert.id,
                alert_type: alert.alert_type,
                description: alert.description,
                severity: alert.severity,
                camera_id: payload.camera_id,
                timestamp: alert.timestamp,
                acknowledged: false,
                acknowledged_by: null
              },
              ...currentAlerts
            ]
          });
          useStore.getState().addToast(alert.description, 'error');
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };
    
    ws.onclose = () => {
      console.log("WebSocket closed, attempting reconnect in 5s...");
      setTimeout(() => useStore.getState().initWebSocket(), 5000);
    };

    // Purge stale tracks every 10 seconds
    setInterval(() => {
      const now = Date.now() / 1000;
      set((state) => {
        const fresh: Record<string, LiveTrack> = {};
        for (const [gid, track] of Object.entries(state.tracks)) {
          if (now - track.timestamp < 30) {
            fresh[gid] = track;
          }
        }
        return { tracks: fresh };
      });
    }, 10000);
  }
}));
