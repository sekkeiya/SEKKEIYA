import { create } from 'zustand';
import type { BuildingType } from '../types/layoutRules';

interface AutoLayoutState {
  isGenerating: boolean;
  pendingZoneIds: string[];
  autoLayoutMode: 'rules-only' | 'ai';
  progressMessage: string | null;
  
  // Config Dialog State
  configDialogOpen: boolean;
  selectedZoneIdsForConfig: string[];
  furnitureSource: 'project' | 'following' | 'public';
  buildingType: BuildingType;
  zonePurpose: import('../types/layoutRules').ZonePurpose;
  
  requestAutoLayout: (zoneIds: string[]) => void;
  openConfigDialog: (zoneIds: string[]) => void;
  closeConfigDialog: () => void;
  setFurnitureSource: (source: 'project' | 'following' | 'public') => void;
  setBuildingType: (type: BuildingType) => void;
  setZonePurpose: (purpose: import('../types/layoutRules').ZonePurpose) => void;
  
  clearRequest: () => void;
  setGenerating: (v: boolean) => void;
  setAutoLayoutMode: (mode: 'rules-only' | 'ai') => void;
  setProgressMessage: (msg: string | null) => void;
  
  swapDialogOpen: boolean;
  openSwapDialog: () => void;
  closeSwapDialog: () => void;
}

export const useAutoLayoutStore = create<AutoLayoutState>((set) => ({
  isGenerating: false,
  pendingZoneIds: [],
  autoLayoutMode: 'ai',
  progressMessage: null,
  
  configDialogOpen: false,
  selectedZoneIdsForConfig: [],
  furnitureSource: 'project',
  buildingType: 'residential',
  zonePurpose: 'general',
  
  openConfigDialog: (zoneIds) => set({ configDialogOpen: true, selectedZoneIdsForConfig: zoneIds }),
  closeConfigDialog: () => set({ configDialogOpen: false }),
  setFurnitureSource: (source) => set({ furnitureSource: source }),
  setBuildingType: (type) => set({ buildingType: type }),
  setZonePurpose: (purpose) => set({ zonePurpose: purpose }),
  
  requestAutoLayout: (zoneIds) => set({ pendingZoneIds: zoneIds, configDialogOpen: false }),
  clearRequest: () => set({ pendingZoneIds: [] }),
  setGenerating: (v) => set({ isGenerating: v }),
  setAutoLayoutMode: (mode) => set({ autoLayoutMode: mode }),
  setProgressMessage: (msg) => set({ progressMessage: msg }),
  swapDialogOpen: false,
  openSwapDialog: () => set({ swapDialogOpen: true }),
  closeSwapDialog: () => set({ swapDialogOpen: false }),
}));
