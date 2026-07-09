import { create } from "zustand";
import type { SurfaceFinish } from "./useSurfaceFinishStore";

/** 1つの面に対する「仕上げパターン」（その時点の全仕上げのスナップショット）。 */
export interface SurfacePattern {
  id: string;
  name: string;            // "パターン1" 等
  finishes: SurfaceFinish[];
  thumbColors: string[];   // プレビュー用の代表色（最大3）
}

interface SurfacePatternState {
  /** surfaceKey → パターン配列 */
  patterns: Record<string, SurfacePattern[]>;
  /** surfaceKey → 現在適用中のパターンID（未適用は null/未設定） */
  activePatterns: Record<string, string | null>;
  addPattern: (surfaceKey: string, p: SurfacePattern) => void;
  removePattern: (surfaceKey: string, id: string) => void;
  setActivePattern: (surfaceKey: string, id: string | null) => void;
  replaceAll: (map: Record<string, SurfacePattern[]>) => void;
  replaceActive: (map: Record<string, string | null>) => void;
}

/** 面ごとの保存済みパターン（パターン1,2,3…）。 */
export const useSurfacePatternStore = create<SurfacePatternState>((set) => ({
  patterns: {},
  activePatterns: {},
  addPattern: (k, p) => set((s) => ({ patterns: { ...s.patterns, [k]: [...(s.patterns[k] || []), p] } })),
  removePattern: (k, id) => set((s) => ({
    patterns: { ...s.patterns, [k]: (s.patterns[k] || []).filter((p) => p.id !== id) },
    activePatterns: s.activePatterns[k] === id ? { ...s.activePatterns, [k]: null } : s.activePatterns,
  })),
  setActivePattern: (k, id) => set((s) => ({ activePatterns: { ...s.activePatterns, [k]: id } })),
  replaceAll: (patterns) => set({ patterns: patterns || {} }),
  replaceActive: (activePatterns) => set({ activePatterns: activePatterns || {} }),
}));
