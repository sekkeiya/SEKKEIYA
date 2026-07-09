import { create } from 'zustand';
import type { ZoneRect } from './useLayoutTaskStore';

export type ZoningSubMode = 'zone' | 'circulation';
export type CirculationEditMode = 'move' | 'add' | 'delete';

export interface DrawingRect {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
}

export function rectToBounds(r: DrawingRect): ZoneRect {
  return {
    x: (r.startX + r.endX) / 2,
    z: (r.startZ + r.endZ) / 2,
    width: Math.abs(r.endX - r.startX),
    depth: Math.abs(r.endZ - r.startZ),
  };
}

interface ZoningState {

  isZoningActionSelect: boolean;
  setIsZoningActionSelect: (isSelect: boolean) => void;

  /** ドラッグ中のライブプレビュー矩形 */
  drawingRect: DrawingRect | null;
  setDrawingRect: (rect: DrawingRect | null) => void;

  /** 描画完了・ダイアログ待ちの矩形 */
  pendingZoneRect: ZoneRect | null;
  setPendingZoneRect: (rect: ZoneRect | null) => void;

  zoningSubMode: ZoningSubMode;
  setZoningSubMode: (mode: ZoningSubMode) => void;

  circulationType: 'main' | 'sub';
  setCirculationType: (type: 'main' | 'sub') => void;

  circulationWidths: { main: number; sub: number };
  setCirculationWidth: (type: 'main' | 'sub', w: number) => void;

  circulationUsage: 'guest' | 'staff' | 'delivery' | 'emergency';
  setCirculationUsage: (usage: 'guest' | 'staff' | 'delivery' | 'emergency') => void;

  currentDrawingPoints: { x: number; z: number }[];
  addDrawingPoint: (p: { x: number; z: number }) => void;
  removeLastDrawingPoint: () => void;
  clearDrawingPoints: () => void;

  selectedCirculationId: string | null;
  setSelectedCirculationId: (id: string | null) => void;

  selectedCirculationNodeIndex: number | 'all' | null;
  setSelectedCirculationNodeIndex: (index: number | 'all' | null) => void;

  draggingCirculationNodeIndex: number | 'all' | null;
  setDraggingCirculationNodeIndex: (index: number | 'all' | null) => void;

  circulationEditMode: CirculationEditMode;
  setCirculationEditMode: (mode: CirculationEditMode) => void;

  hiddenZoneIds: Record<string, boolean>;
  toggleZoneVisibility: (id: string) => void;

  hiddenPatternIds: Record<string, boolean>;
  togglePatternVisibility: (id: string) => void;
}

export const useZoningStore = create<ZoningState>((set) => ({

  isZoningActionSelect: true,
  setIsZoningActionSelect: (isSelect) => set({ isZoningActionSelect: isSelect }),

  drawingRect: null,
  setDrawingRect: (drawingRect) => set({ drawingRect }),

  pendingZoneRect: null,
  setPendingZoneRect: (pendingZoneRect) => set({ pendingZoneRect }),

  zoningSubMode: 'zone',
  setZoningSubMode: (mode) => set({ zoningSubMode: mode }),

  circulationType: 'main',
  setCirculationType: (type) => set({ circulationType: type }),

  circulationWidths: { main: 900, sub: 600 },
  setCirculationWidth: (type, w) => set((s) => ({ circulationWidths: { ...s.circulationWidths, [type]: w } })),

  circulationUsage: 'guest',
  setCirculationUsage: (usage) => set({ circulationUsage: usage }),

  currentDrawingPoints: [],
  addDrawingPoint: (p) => set((s) => ({ currentDrawingPoints: [...s.currentDrawingPoints, p] })),
  removeLastDrawingPoint: () => set((s) => ({ currentDrawingPoints: s.currentDrawingPoints.slice(0, -1) })),
  clearDrawingPoints: () => set({ currentDrawingPoints: [] }),

  selectedCirculationId: null,
  setSelectedCirculationId: (id) => set({ selectedCirculationId: id }),

  selectedCirculationNodeIndex: null,
  setSelectedCirculationNodeIndex: (index) => set({ selectedCirculationNodeIndex: index }),

  draggingCirculationNodeIndex: null,
  setDraggingCirculationNodeIndex: (index) => set({ draggingCirculationNodeIndex: index }),

  circulationEditMode: 'move',
  setCirculationEditMode: (mode) => set({ circulationEditMode: mode }),

  hiddenZoneIds: {},
  toggleZoneVisibility: (id) => set((s) => ({
    hiddenZoneIds: { ...s.hiddenZoneIds, [id]: !s.hiddenZoneIds[id] }
  })),

  hiddenPatternIds: {},
  togglePatternVisibility: (id) => set((s) => ({
    hiddenPatternIds: { ...s.hiddenPatternIds, [id]: !s.hiddenPatternIds[id] }
  })),
}));
