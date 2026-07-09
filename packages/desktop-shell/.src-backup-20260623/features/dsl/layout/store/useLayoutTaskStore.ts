import { create } from 'zustand';

export interface ZoneRect {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface Room {
  id: string;
  name: string;
  color?: string;
  createdAtMs?: number;
}

export interface ZoneLayoutVersion {
  id: string;
  name: string;
  createdAtMs: number;
  items: any[];
}

export interface ZoneCirculation {
  id: string;
  type: 'main' | 'sub';
  width: number;
  usage?: 'guest' | 'staff' | 'delivery' | 'emergency';
  points: { x: number; z: number }[];
}

export interface CirculationPattern {
  id: string;
  name: string;
  isActive?: boolean;
  circulations: ZoneCirculation[];
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface ZoneNode {
  id: string;
  roomId?: string;
  name: string;
  targetSeats: number;
  category?: string;
  color?: string;
  rect?: ZoneRect;
  createdBy?: 'user' | 'ai';
  createdAtMs?: number;
  versions?: ZoneLayoutVersion[];
}

interface ZoneActuals {
  [zoneId: string]: { actualSeats: number }
}

interface LayoutTaskState {
  rooms: Room[];
  zones: ZoneNode[];
  circulations: ZoneCirculation[]; // Legacy / Current active pattern's circulations for ease of use
  circulationPatterns: CirculationPattern[];
  activeCirculationPatternId: string | null;
  activeZoneId: string | null;
  selectedZoneIds: string[];
  zoneActuals: ZoneActuals;
  zoneClipboard: ZoneNode | null;
  setRooms: (rooms: Room[]) => void;
  setZones: (zones: ZoneNode[]) => void;
  setCirculations: (circulations: ZoneCirculation[]) => void;
  setCirculationPatterns: (patterns: CirculationPattern[]) => void;
  setActiveCirculationPatternId: (id: string | null) => void;
  setActiveZoneId: (zoneId: string | null) => void;
  setSelectedZoneIds: (ids: string[]) => void;
  toggleSelectedZoneId: (id: string) => void;
  setZoneActuals: (actuals: ZoneActuals) => void;
  setZoneClipboard: (zone: ZoneNode | null) => void;
}

export const useLayoutTaskStore = create<LayoutTaskState>((set) => ({
  rooms: [],
  zones: [],
  circulations: [],
  circulationPatterns: [],
  activeCirculationPatternId: null,
  activeZoneId: null,
  selectedZoneIds: [],
  zoneActuals: {},
  zoneClipboard: null,
  setRooms: (rooms) => set({ rooms }),
  setZones: (zones) => set({ zones }),
  setCirculations: (circulations) => set({ circulations }),
  setCirculationPatterns: (patterns) => set({ circulationPatterns: patterns }),
  setActiveCirculationPatternId: (id) => set({ activeCirculationPatternId: id }),
  setActiveZoneId: (zoneId) => set({ 
    activeZoneId: zoneId,
    selectedZoneIds: zoneId ? [zoneId] : []
  }),
  setSelectedZoneIds: (ids) => set({ selectedZoneIds: ids }),
  toggleSelectedZoneId: (id) =>
    set((s) => ({
      selectedZoneIds: s.selectedZoneIds.includes(id)
        ? s.selectedZoneIds.filter((x) => x !== id)
        : [...s.selectedZoneIds, id],
    })),
  setZoneActuals: (actuals) => set({ zoneActuals: actuals }),
  setZoneClipboard: (zone) => set({ zoneClipboard: zone }),
}));
