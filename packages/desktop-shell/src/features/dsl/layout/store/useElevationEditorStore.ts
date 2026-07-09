import { create } from "zustand";
import type { SurfaceRect } from "./useMaterialFaceStore";

/** 展開図カラムの固定幅（px）。フローティングドックの右オフセットにも使う。 */
export const ELEVATION_WIDTH = 520;

interface ElevationEditorState {
  open: boolean;
  surface: SurfaceRect | null;
  surfaceType: "floor" | "ceiling" | "wall";
  openFor: (surface: SurfaceRect, surfaceType: "floor" | "ceiling" | "wall") => void;
  close: () => void;
}

/** 展開図エディタ（壁/床の正対2Dビューで範囲指定）の開閉状態。 */
export const useElevationEditorStore = create<ElevationEditorState>((set) => ({
  open: false,
  surface: null,
  surfaceType: "wall",
  openFor: (surface, surfaceType) => set({ open: true, surface, surfaceType }),
  close: () => set({ open: false }),
}));
