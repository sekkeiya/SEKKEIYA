import { create } from 'zustand';
import type { FurnitureSlot, SlotScopeLevel } from '../types/furnitureSlot';
import type { ZoneSelection } from '../services/furnitureSelectionService';

/**
 * ①自動家具選定の結果を保持するストア。
 *
 * generateSlots の出力（ゾーン別 FurnitureSlot）を inspectable に持ち、
 * ②自動レイアウト（placeSlots）が後段でこれを参照して「選定済みの家具だけ」を
 * 配置できるようにするための受け皿。配置(transform)はここには含まれない。
 */
interface FurnitureSelectionState {
  /** 最後に選定したスコープ */
  lastScope: SlotScopeLevel | null;
  /** zoneId → 選定結果 */
  selections: Record<string, ZoneSelection>;
  setSelections: (scope: SlotScopeLevel, list: ZoneSelection[]) => void;
  /** 指定ゾーンのスロットを差し替える。空配列なら当該ゾーンを削除（レビューパネルの編集用） */
  updateZoneSlots: (zoneId: string, slots: FurnitureSlot[]) => void;
  /** 指定ゾーンの選定だけを消す（配置で消費したとき用） */
  clearZone: (zoneId: string) => void;
  clear: () => void;
}

export const useFurnitureSelectionStore = create<FurnitureSelectionState>((set) => ({
  lastScope: null,
  selections: {},
  setSelections: (scope, list) =>
    set(() => ({
      lastScope: scope,
      selections: Object.fromEntries(list.map((sel) => [sel.zoneId, sel])),
    })),
  updateZoneSlots: (zoneId, slots) =>
    set((s) => {
      const existing = s.selections[zoneId];
      if (!existing) return s;
      if (slots.length === 0) {
        const next = { ...s.selections };
        delete next[zoneId];
        return { selections: next };
      }
      return { selections: { ...s.selections, [zoneId]: { ...existing, slots } } };
    }),
  clearZone: (zoneId) =>
    set((s) => {
      if (!(zoneId in s.selections)) return s;
      const next = { ...s.selections };
      delete next[zoneId];
      return { selections: next };
    }),
  clear: () => set({ lastScope: null, selections: {} }),
}));
