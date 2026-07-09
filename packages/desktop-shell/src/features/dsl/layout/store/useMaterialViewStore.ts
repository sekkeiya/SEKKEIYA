// Material モードの「展開図ピン視点（一人称で見渡す）」状態。
// 複数の部屋に対応するため、ピンは複数配置できる。各ピンは床上の位置と向きを持つ。
// 一人称ルックの ON/OFF、現在の対象ピン、レンズ長（焦点距離 mm）、クロスヘアが
// 狙っている面（ハイライト用）を保持する。

import { create } from "zustand";
import type { SelectedFace } from "./useMaterialFaceStore";

export interface MaterialPin {
  id: string;
  x: number;
  z: number;
  yawDeg: number;
}

/** 既定レンズ長（mm）。広角で部屋を見渡しやすい 18mm。 */
export const DEFAULT_MATERIAL_LENS_MM = 18;

interface MaterialViewState {
  /** 展開図ピン（複数配置可）。 */
  pins: MaterialPin[];
  addPin: (p: MaterialPin) => void;
  updatePin: (id: string, patch: Partial<MaterialPin>) => void;
  removePin: (id: string) => void;

  /** 一人称で見渡すモードか。 */
  firstPerson: boolean;
  /** 現在見渡しているピン ID。 */
  activePinId: string | null;
  enterFirstPerson: (pinId: string) => void;
  exitFirstPerson: () => void;

  /** レンズ長（焦点距離 mm）。一人称ビューの画角に反映。 */
  lensMm: number;
  setLensMm: (n: number) => void;

  /** クロスヘアが今狙っている面（ハイライト表示用。確定選択は selectedFace）。 */
  aimFace: SelectedFace | null;
  setAimFace: (f: SelectedFace | null) => void;
}

export const useMaterialViewStore = create<MaterialViewState>((set) => ({
  pins: [],
  addPin: (p) => set((s) => ({ pins: [...s.pins, p] })),
  updatePin: (id, patch) => set((s) => ({ pins: s.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  removePin: (id) => set((s) => ({
    pins: s.pins.filter((p) => p.id !== id),
    ...(s.activePinId === id ? { firstPerson: false, activePinId: null, aimFace: null } : {}),
  })),

  firstPerson: false,
  activePinId: null,
  enterFirstPerson: (pinId) => set({ firstPerson: true, activePinId: pinId }),
  exitFirstPerson: () => set({ firstPerson: false, activePinId: null, aimFace: null }),

  lensMm: DEFAULT_MATERIAL_LENS_MM,
  setLensMm: (n) => set({ lensMm: Math.max(8, Math.min(85, n)) }),

  aimFace: null,
  setAimFace: (f) => set({ aimFace: f }),
}));
