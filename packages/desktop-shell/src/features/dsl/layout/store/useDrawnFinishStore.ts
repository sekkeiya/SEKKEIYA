// useDrawnFinishStore — S.Layout で「作図した」壁/床（useWallStore / useSlabStore）に適用する
// 仕上げ素材。
//
// なぜ別立てか:
//   躯体（Base の GLB / ParametricRoom）の自動マテリアルは、面をジオメトリから検出して
//   面キー単位で SurfaceFinish オーバーレイを重ねる非破壊方式（useSurfaceFinishStore）。
//   一方こちらの壁/床は「外壁/内壁/床」という種別が最初から分かっているので、面検出を
//   経由せず素材スナップショットを直接持たせた方が確実かつ安価。
//   autoApplyMaterials がスタイル解決の結果をここへ流し込み、
//   WallsRenderer / FloorSlabsRenderer がそれを見て three のマテリアルを作る。
import { create } from "zustand";
import type { DsmtMaterialSnapshot } from "../../../dsmt/types";

export interface DrawnFinishState {
  /** 内壁（kind="interior"）に貼る素材 */
  interiorWall: DsmtMaterialSnapshot | null;
  /** 外壁（kind="exterior"）に貼る素材 */
  exteriorWall: DsmtMaterialSnapshot | null;
  /** 床スラブに貼る素材 */
  floor: DsmtMaterialSnapshot | null;
  /** 適用元のスタイル（表示・デバッグ用） */
  styleKey: string | null;

  setFinishes: (v: {
    interiorWall?: DsmtMaterialSnapshot | null;
    exteriorWall?: DsmtMaterialSnapshot | null;
    floor?: DsmtMaterialSnapshot | null;
    styleKey?: string | null;
  }) => void;
  clear: () => void;
}

export const useDrawnFinishStore = create<DrawnFinishState>((set) => ({
  interiorWall: null,
  exteriorWall: null,
  floor: null,
  styleKey: null,

  setFinishes: (v) => set((s) => ({ ...s, ...v })),
  clear: () => set({ interiorWall: null, exteriorWall: null, floor: null, styleKey: null }),
}));
