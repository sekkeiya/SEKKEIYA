import { create } from "zustand";

// ボトムバーのホバー実行と右サイドバーの専用パネルを橋渡しする共有ストア。
// - activeSide: クリックで右サイドバー Properties に出す「自動○○」専用パネルの種別
// - lastResults: 各自動アクションの最後の実行結果（右サイドバーが詳細表示に使う）
// - toast: ホバー実行などからの即時フィードバック（LayoutShell が Snackbar で表示）
export type AutoActionKind =
  | "autoMaterial"
  | "autoFurMat"
  | "autoLabel"
  | "autoLighting";

export interface AutoActionResult {
  severity: "success" | "warning" | "info" | "error";
  msg: string;
  at: number; // タイムスタンプ（表示用、相対時刻計算は呼び出し側で）
}

interface AutoActionState {
  activeSide: AutoActionKind | null;
  setActiveSide: (kind: AutoActionKind | null) => void;

  // 左ドック★メニューで現在「選択中」のボタン（全7種。ハイライト＋他ボタンの減光に使う）。
  selectedAuto: string | null;
  setSelectedAuto: (key: string | null) => void;

  lastResults: Partial<Record<AutoActionKind, AutoActionResult>>;
  setResult: (kind: AutoActionKind, result: Omit<AutoActionResult, "at"> & { at?: number }) => void;

  toast: { severity: AutoActionResult["severity"]; msg: string; tick: number } | null;
  pushToast: (severity: AutoActionResult["severity"], msg: string) => void;
  clearToast: () => void;
}

export const useAutoActionStore = create<AutoActionState>((set, get) => ({
  activeSide: null,
  setActiveSide: (kind) => set({ activeSide: kind }),

  selectedAuto: null,
  setSelectedAuto: (key) => set({ selectedAuto: key }),

  lastResults: {},
  setResult: (kind, result) =>
    set((s) => ({
      lastResults: { ...s.lastResults, [kind]: { at: Date.now(), ...result } },
    })),

  toast: null,
  pushToast: (severity, msg) =>
    set((s) => ({ toast: { severity, msg, tick: (s.toast?.tick ?? 0) + 1 } })),
  clearToast: () => set({ toast: null }),
}));
