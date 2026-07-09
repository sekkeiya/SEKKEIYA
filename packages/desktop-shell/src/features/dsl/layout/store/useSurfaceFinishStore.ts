import { create } from "zustand";
import type { SurfaceRect } from "./useMaterialFaceStore";
import type { DsmtMaterialSnapshot } from "../../../dsmt/types";

/**
 * 面ローカルの部分領域（展開図で指定した矩形）。surface 中心を原点に、
 * uAxis/vAxis 方向のワールド単位で範囲を表す。未指定なら面全体。
 */
export interface FinishRegion {
  u0: number; u1: number; v0: number; v1: number;
}

/** 躯体面（壁/床/天井）に貼った仕上げ（オーバーレイ板）1枚分。 */
export interface SurfaceFinish {
  /** 面署名＋region署名（面全体は面署名のみ）。同キーは上書き。 */
  key: string;
  surface: SurfaceRect;
  /** 部分領域（単一矩形・旧データ互換）。未指定（null）なら面全体。 */
  region?: FinishRegion | null;
  /**
   * 部分領域グループ（複数矩形）。同素材の重なり/隣接を自動マージした結果を
   * 1つの仕上げとして保持する（L字/十字など）。存在すれば region より優先。
   */
  regions?: FinishRegion[] | null;
  materialId: string;
  material: DsmtMaterialSnapshot;
  /** テクスチャの拡大縮小（既定1.0=約1mタイル）。大きいほどタイルが大きい。 */
  scale?: number;
  /** テクスチャ回転（度）。ランダム化や向き調整に使う。 */
  rotation?: number;
}

/** 仕上げが持つ矩形リスト（regions 優先・なければ region・面全体は空）。 */
export function finishRects(f: SurfaceFinish): FinishRegion[] {
  if (f.regions && f.regions.length) return f.regions;
  if (f.region) return [f.region];
  return [];
}

/** 矩形が重なる/隣接する（tol 許容）か。 */
export function rectsTouch(a: FinishRegion, b: FinishRegion, tol = 0): boolean {
  return a.u0 <= b.u1 + tol && b.u0 <= a.u1 + tol && a.v0 <= b.v1 + tol && b.v0 <= a.v1 + tol;
}

/** 矩形群の和集合面積（重複を二重計上しない）。座標グリッド分割で算出。 */
export function unionArea(rects: FinishRegion[]): number {
  if (!rects.length) return 0;
  const xs = Array.from(new Set(rects.flatMap((r) => [r.u0, r.u1]))).sort((a, b) => a - b);
  const ys = Array.from(new Set(rects.flatMap((r) => [r.v0, r.v1]))).sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (rects.some((r) => cx >= r.u0 && cx <= r.u1 && cy >= r.v0 && cy <= r.v1)) {
        area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }
  return area;
}

interface SurfaceFinishState {
  finishes: Record<string, SurfaceFinish>;
  setFinish: (f: SurfaceFinish) => void;
  updateFinish: (key: string, patch: Partial<SurfaceFinish>) => void;
  removeFinish: (key: string) => void;
  clearAll: () => void;
  /** 永続層から一括ロードする際に丸ごと置換 */
  replaceAll: (list: SurfaceFinish[]) => void;
}

/** 躯体面の仕上げ（オーバーレイ板）の集合。Phase 1 はセッション内ライブ表示。 */
export const useSurfaceFinishStore = create<SurfaceFinishState>((set) => ({
  finishes: {},
  setFinish: (f) => set((s) => ({ finishes: { ...s.finishes, [f.key]: f } })),
  updateFinish: (key, patch) => set((s) => (
    s.finishes[key] ? { finishes: { ...s.finishes, [key]: { ...s.finishes[key], ...patch } } } : s
  )),
  removeFinish: (key) => set((s) => {
    const next = { ...s.finishes };
    delete next[key];
    return { finishes: next };
  }),
  clearAll: () => set({ finishes: {} }),
  replaceAll: (list) => set({ finishes: Object.fromEntries(list.map((f) => [f.key, f])) }),
}));
