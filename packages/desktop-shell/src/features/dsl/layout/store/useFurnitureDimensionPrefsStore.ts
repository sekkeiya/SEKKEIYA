import { create } from "zustand";

// 家具1点ごとの寸法表示設定。
// - adopted: 採用する方向キー（"+x" | "-x" | "+z" | "-z"）の配列。
//   未設定(undefined)なら「既定＝近い側の水平1＋垂直1」を自動表示する。
//   空配列なら「採用なし（非選択時は何も表示しない）」を意味する。
// - hidden: その家具の寸法を完全に隠す。
export type DimDirKey = "+x" | "-x" | "+z" | "-z";

export interface FurnitureDimensionPref {
  adopted?: DimDirKey[];
  hidden?: boolean;
}

interface FurnitureDimensionPrefsState {
  prefs: Record<string, FurnitureDimensionPref>;
  setAdopted: (itemId: string, dirs: DimDirKey[]) => void;
  toggleHidden: (itemId: string) => void;
  setHidden: (itemId: string, hidden: boolean) => void;
  clearItem: (itemId: string) => void;
  clearAll: () => void;
}

export const useFurnitureDimensionPrefsStore = create<FurnitureDimensionPrefsState>((set) => ({
  prefs: {},

  setAdopted: (itemId, dirs) =>
    set((s) => ({
      prefs: {
        ...s.prefs,
        [itemId]: { ...s.prefs[itemId], adopted: dirs },
      },
    })),

  toggleHidden: (itemId) =>
    set((s) => ({
      prefs: {
        ...s.prefs,
        [itemId]: { ...s.prefs[itemId], hidden: !s.prefs[itemId]?.hidden },
      },
    })),

  setHidden: (itemId, hidden) =>
    set((s) => ({
      prefs: {
        ...s.prefs,
        [itemId]: { ...s.prefs[itemId], hidden },
      },
    })),

  clearItem: (itemId) =>
    set((s) => {
      const next = { ...s.prefs };
      delete next[itemId];
      return { prefs: next };
    }),

  clearAll: () => set({ prefs: {} }),
}));
