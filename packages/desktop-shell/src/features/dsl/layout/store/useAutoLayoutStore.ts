import { create } from 'zustand';
import type { BuildingType } from '../types/layoutRules';
import { useLayoutTaskStore } from './useLayoutTaskStore';

/** 自動レイアウトの対象 ID を解決する（各起動ボタン共通）。
 *  優先: 選択ゾーン → 選択部屋（その部屋のゾーン、無ければゾーンレス部屋IDそのもの）
 *        → 全ゾーン → __full_room__。
 *  ゾーンレス部屋IDは extractZoneData が Room.rect＋部屋の用途で扱う。 */
export function resolveAutoLayoutIds(): string[] {
  const { zones, selectedZoneIds, selectedRoomId, rooms } = useLayoutTaskStore.getState();
  if (selectedZoneIds && selectedZoneIds.length > 0) return selectedZoneIds;
  if (selectedRoomId) {
    const roomZones = (zones || []).filter((z: any) => z.roomId === selectedRoomId).map((z: any) => z.id);
    if (roomZones.length) return roomZones;
    const rm = (rooms || []).find((r: any) => r.id === selectedRoomId);
    if (rm?.rect) return [selectedRoomId];
  }
  if ((zones || []).length > 0) return (zones as any[]).map((z) => z.id);
  return ['__full_room__'];
}

export interface AutoLayoutResult {
  id: string;
  label: string;
  generatedAt: number;
  items: any[];
  thumbnailDataUrl?: string;
}

interface AutoLayoutState {
  isGenerating: boolean;
  pendingZoneIds: string[];
  autoLayoutMode: 'rules-only' | 'ai';
  progressMessage: string | null;

  /** ボトムバーの Auto Layout パネルが開いているか（LayoutShell が同期） */
  autoLayoutDockOpen: boolean;
  setAutoLayoutDockOpen: (v: boolean) => void;

  /** 生成済みレイアウト候補一覧（ボトムパネルに表示） */
  results: AutoLayoutResult[];
  addResult: (r: AutoLayoutResult) => void;
  clearResults: () => void;

  // Config Dialog State
  configDialogOpen: boolean;
  selectedZoneIdsForConfig: string[];
  buildingType: BuildingType;
  zonePurpose: import('../types/layoutRules').ZonePurpose;

  // ゾーンなし時の部屋寸法 (mm)
  roomWidthMm: number;
  roomDepthMm: number;
  setRoomWidthMm: (v: number) => void;
  setRoomDepthMm: (v: number) => void;

  // 採用時に生成する平面図（Topビュー）の用紙・縮尺設定
  planPaperSize: 'A3' | 'A4';
  planScale: 'auto' | number;       // 1:scale。'auto' は用紙に収まる標準縮尺
  planOrientation: 'auto' | 'portrait' | 'landscape';
  setPlanPaperSize: (v: 'A3' | 'A4') => void;
  setPlanScale: (v: 'auto' | number) => void;
  setPlanOrientation: (v: 'auto' | 'portrait' | 'landscape') => void;

  requestAutoLayout: (zoneIds: string[]) => void;
  openConfigDialog: (zoneIds: string[]) => void;
  closeConfigDialog: () => void;
  setBuildingType: (type: BuildingType) => void;
  setZonePurpose: (purpose: import('../types/layoutRules').ZonePurpose) => void;

  clearRequest: () => void;
  setGenerating: (v: boolean) => void;
  setAutoLayoutMode: (mode: 'rules-only' | 'ai') => void;
  setProgressMessage: (msg: string | null) => void;

  swapDialogOpen: boolean;
  openSwapDialog: () => void;
  closeSwapDialog: () => void;

  rulesDialogOpen: boolean;
  openRulesDialog: () => void;
  closeRulesDialog: () => void;
}

export const useAutoLayoutStore = create<AutoLayoutState>((set) => ({
  isGenerating: false,
  pendingZoneIds: [],
  autoLayoutMode: 'rules-only',
  progressMessage: null,

  autoLayoutDockOpen: false,
  setAutoLayoutDockOpen: (v) => set({ autoLayoutDockOpen: v }),

  results: [],
  addResult: (r) => set((s) => ({ results: [...s.results, r] })),
  clearResults: () => set({ results: [] }),
  
  configDialogOpen: false,
  selectedZoneIdsForConfig: [],
  buildingType: 'residential',
  zonePurpose: 'general',
  
  roomWidthMm: 5000,
  roomDepthMm: 4000,
  setRoomWidthMm: (v) => set({ roomWidthMm: v }),
  setRoomDepthMm: (v) => set({ roomDepthMm: v }),

  planPaperSize: 'A3',
  planScale: 'auto',
  planOrientation: 'auto',
  setPlanPaperSize: (v) => set({ planPaperSize: v }),
  setPlanScale: (v) => set({ planScale: v }),
  setPlanOrientation: (v) => set({ planOrientation: v }),

  openConfigDialog: (zoneIds) => set({ configDialogOpen: true, selectedZoneIdsForConfig: zoneIds }),
  closeConfigDialog: () => set({ configDialogOpen: false }),
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

  rulesDialogOpen: false,
  openRulesDialog: () => set({ rulesDialogOpen: true }),
  closeRulesDialog: () => set({ rulesDialogOpen: false }),
}));
