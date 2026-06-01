import { create } from 'zustand';

interface AppState {
  activeCameraId: number | null;
  activeFloor: number;
  systemStatus: string;
  alertsCount: number;
  setActiveCamera: (id: number | null) => void;
  setActiveFloor: (floor: number) => void;
  incrementAlerts: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeCameraId: null,
  activeFloor: 1,
  systemStatus: 'ONLINE',
  alertsCount: 3,
  setActiveCamera: (id) => set({ activeCameraId: id }),
  setActiveFloor: (floor) => set({ activeFloor: floor }),
  incrementAlerts: () => set((state) => ({ alertsCount: state.alertsCount + 1 }))
}));
