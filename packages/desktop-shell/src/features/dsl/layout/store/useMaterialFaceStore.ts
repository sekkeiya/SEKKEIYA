import { create } from "zustand";

export type SurfaceType = "floor" | "ceiling" | "wall";

/** 同一平面領域（壁/床1面）のワールド空間矩形。オーバーレイ板の配置に使う。 */
export interface SurfaceRect {
  /** 矩形中心（ワールド） */
  center: [number, number, number];
  /** 面法線（ワールド） */
  normal: [number, number, number];
  /** 面ローカルの横軸 */
  uAxis: [number, number, number];
  /** 面ローカルの縦軸 */
  vAxis: [number, number, number];
  /** 幅（uAxis 方向, ワールド単位） */
  width: number;
  /** 高さ（vAxis 方向, ワールド単位） */
  height: number;
  /** 連結領域の実三角形（ワールド座標, x,y,z×3×N）。ハイライトを矩形でなく実ポリゴンで描く用。任意。 */
  tris?: number[];
}

export interface SelectedFace {
  /** ヒットした躯体メッシュの uuid */
  objectUuid: string;
  /** ワールド座標のヒット点 */
  point: [number, number, number];
  /** ワールド法線 */
  normal: [number, number, number];
  /** 法線から分類した面種別 */
  surfaceType: SurfaceType;
  /** ヒットした三角形 index（任意） */
  faceIndex: number | null;
  /** 同一平面領域の矩形（抽出できた場合）。面全体への材適用に使う。 */
  surface?: SurfaceRect | null;
}

/** 面の署名（法線+オフセットの丸め）。同じ壁への再適用を1つに束ねる。 */
export function surfaceKeyOf(normal: [number, number, number], center: [number, number, number]): string {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const d = normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2];
  return `${r(normal[0])}_${r(normal[1])}_${r(normal[2])}_${Math.round(d)}`;
}

/**
 * 躯体面ラベル用の署名（法線＋重心を 0.1m グリッドで量子化）。
 * surfaceKeyOf は法線＋平面オフセットのみ＝「同一平面上の別々の面」が同一キーになり区別できない。
 * こちらは重心位置も含めるので、同一平面でも離れた面は別キーになる（複数選択・個別ラベルが可能）。
 * グリッドは 0.1m と粗いので、同じ面を再クリックしたときの微小ジッタでは同一キーに収束する。
 * @param upm units-per-meter（mm スケールなら 1000、m スケールなら 1）
 */
export function structureFaceKeyOf(
  normal: [number, number, number],
  center: [number, number, number],
  upm = 1
): string {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const cell = Math.max(1e-3, 0.1 * upm);
  const q = (v: number) => Math.round(v / cell);
  return `${r(normal[0])}_${r(normal[1])}_${r(normal[2])}_${q(center[0])}_${q(center[1])}_${q(center[2])}`;
}

interface MaterialFaceState {
  selectedFace: SelectedFace | null;
  setSelectedFace: (f: SelectedFace | null) => void;
}

/** Material モードで選択中の躯体面（床/壁/天井）。 */
export const useMaterialFaceStore = create<MaterialFaceState>((set) => ({
  selectedFace: null,
  setSelectedFace: (selectedFace) => set({ selectedFace }),
}));

/** ワールド法線の Y 成分から面種別を分類する。 */
export const classifySurface = (normalY: number): SurfaceType =>
  normalY > 0.5 ? "floor" : normalY < -0.5 ? "ceiling" : "wall";

export const SURFACE_LABEL: Record<SurfaceType, string> = {
  floor: "床",
  ceiling: "天井",
  wall: "壁",
};
