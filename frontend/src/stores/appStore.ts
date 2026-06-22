// Zustand global store — mirrors backend API state
import { create } from 'zustand';
import { getWebSocketUrl } from '../config/runtime';

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
  status: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE' | 'PAUSED';
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
  building_id?: number;
  zone_type: 'RESTRICTED' | 'DWELL' | 'TRIPWIRE' | 'LOUNGE';
  is_active: boolean;
  dwell_alert_seconds: number;
  coordinates: {x: number; y: number}[];
  color?: string;
}

export interface Site {
  id: number;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
}

export type BuildingType = 'INDOOR' | 'OUTDOOR' | 'MIXED';

export interface FloorDef {
  id: number;
  building_id: number;
  level: number;
  label: string;
  sort_order: number;
  created_at: string;
  background_image?: string;
}

export interface Building {
  id: number;
  site_id: number;
  name: string;
  building_type: BuildingType;
  description?: string;
  x_position: number;
  y_position: number;
  map_width: number;
  map_height: number;
  is_active: boolean;
  created_at: string;
  floors: FloorDef[];
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
  // Accuracy metrics from detection_and_recognition logic
  detection_conf: number | null;    // YOLO detection confidence 0.0–1.0
  face_similarity: number | null;   // ArcFace cosine similarity 0.0–1.0
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

  // Sites & Buildings
  sites: Site[];
  buildings: Building[];
  activeSiteId: number | null;
  activeBuildingId: number | null;

  setCameras: (c: Camera[]) => void;
  setAlerts: (a: Alert[]) => void;
  setVisitors: (v: Visitor[]) => void;
  setEmployees: (e: Employee[]) => void;
  setZones: (z: Zone[]) => void;
  setStats: (s: AnalyticsStats) => void;
  acknowledgeAlert: (id: number) => void;

  setSites: (s: Site[]) => void;
  setBuildings: (b: Building[]) => void;
  setActiveSite: (id: number | null) => void;
  setActiveBuilding: (id: number | null) => void;

  // Toast
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // WebSockets
  tracks: Record<string, LiveTrack>;
  initWebSocket: () => void;
  closeWebSocket: () => void;
  websocket: WebSocket | null;
  reconnectTimeoutId: ReturnType<typeof setTimeout> | null;
  trackCleanupIntervalId: ReturnType<typeof setInterval> | null;
}

export const useStore = create<AppStore>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    set({ user, token });
  },
  logout: () => {
    useStore.getState().closeWebSocket();
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

  sites: [],
  buildings: [],
  activeSiteId: null,
  activeBuildingId: null,

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

  setSites: (sites) => set({ sites }),
  setBuildings: (buildings) => set({ buildings }),
  setActiveSite: (activeSiteId) => set({ activeSiteId }),
  setActiveBuilding: (activeBuildingId) => set({ activeBuildingId }),

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
  websocket: null,
  reconnectTimeoutId: null,
  trackCleanupIntervalId: null,
  closeWebSocket: () => {
    const { websocket, reconnectTimeoutId, trackCleanupIntervalId } = useStore.getState();
    if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
    if (trackCleanupIntervalId) clearInterval(trackCleanupIntervalId);
    if (websocket && websocket.readyState === WebSocket.OPEN) websocket.close();
    set({ websocket: null, reconnectTimeoutId: null, trackCleanupIntervalId: null });
  },
  initWebSocket: () => {
    const prev = useStore.getState();
    if (prev.reconnectTimeoutId) clearTimeout(prev.reconnectTimeoutId);
    if (prev.trackCleanupIntervalId) clearInterval(prev.trackCleanupIntervalId);
    if (prev.websocket && (prev.websocket.readyState === WebSocket.OPEN || prev.websocket.readyState === WebSocket.CONNECTING)) {
      prev.websocket.close();
    }

    const wsUrl = getWebSocketUrl();
    const ws = new WebSocket(wsUrl);
    set({ websocket: ws, reconnectTimeoutId: null });
    
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
            // Accuracy metrics
            detection_conf: payload.detection_conf ?? null,
            face_similarity: payload.face_similarity ?? null,
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
      const timeoutId = setTimeout(() => useStore.getState().initWebSocket(), 5000);
      set({ reconnectTimeoutId: timeoutId, websocket: null });
    };

    // Purge stale tracks every 2 seconds
    const cleanupId = setInterval(() => {
      const now = Date.now() / 1000;
      set((state) => {
        const fresh: Record<string, LiveTrack> = {};
        for (const [gid, track] of Object.entries(state.tracks)) {
          if (now - track.timestamp < 3) {
            fresh[gid] = track;
          }
        }
        return { tracks: fresh };
      });
    }, 2000);
    set({ trackCleanupIntervalId: cleanupId });
  }
}));
