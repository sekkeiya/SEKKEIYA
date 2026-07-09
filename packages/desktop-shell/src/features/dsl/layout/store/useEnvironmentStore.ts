import { create } from "zustand";

export type LandscapePreset = "none" | "flat";

// drei <Environment preset=...> で使える主要プリセット
export type SkyPreset =
  | "park"
  | "sunset"
  | "dawn"
  | "night"
  | "warehouse"
  | "forest"
  | "apartment"
  | "studio"
  | "city"
  | "lobby";

// Flat (地面) のテクスチャプリセット
export type TerrainPreset =
  | "grass"
  | "dirt"
  | "concrete"
  | "stone"
  | "snow"
  | "water";

// 各 TerrainPreset の見た目デフォルト（色・粗さ）
// LandscapeBackdrop 側の procedural texture 生成と連動する
export const TERRAIN_PRESET_DEFAULTS: Record<
  TerrainPreset,
  { color: string; roughness: number }
> = {
  grass: { color: "#4f7a3a", roughness: 1 },
  dirt: { color: "#7a5a3a", roughness: 1 },
  concrete: { color: "rgb(var(--brand-fg-rgb) / 0.65)", roughness: 0.78 },
  stone: { color: "#8a8580", roughness: 0.92 },
  snow: { color: "var(--brand-fg)", roughness: 0.6 },
  water: { color: "#3f7ea0", roughness: 0.08 },
};

interface EnvironmentState {
  // どのランドスケーププリセットを適用しているか
  landscape: LandscapePreset;
  setLandscape: (preset: LandscapePreset) => void;

  // landscape === "none" のときのメインエリア背景色（単色）
  noneBackgroundColor: string;
  setNoneBackgroundColor: (c: string) => void;

  // ── Flat (地面) パラメータ ───────────────────────────────
  flatVisible: boolean;
  setFlatVisible: (v: boolean) => void;
  flatPreset: TerrainPreset;
  setFlatPreset: (preset: TerrainPreset) => void; // defaults を適用
  flatColor: string;            // 地面の基本色（テクスチャ無効時に主役、有効時は tint）
  setFlatColor: (c: string) => void;
  flatRoughness: number;        // 0-1
  setFlatRoughness: (v: number) => void;
  flatTextureEnabled: boolean;  // procedural texture を使うか
  setFlatTextureEnabled: (v: boolean) => void;
  flatTileScale: number;        // タイル繰り返し倍率（小さくすると目が大きく）
  setFlatTileScale: (v: number) => void;
  flatAntiTile: boolean;        // タイル感解消 (2-sample stochastic blend)
  setFlatAntiTile: (v: boolean) => void;

  // ── Sky (空 / 環境光) パラメータ ──────────────────────────
  skyVisible: boolean;
  setSkyVisible: (v: boolean) => void;
  skyPreset: SkyPreset;
  setSkyPreset: (p: SkyPreset) => void;
  skyBlur: number;              // 0-1
  setSkyBlur: (v: number) => void;
  skyResolution: number;        // drei Environment の cube map 解像度 (256/512/1024/2048/4096)
  setSkyResolution: (v: number) => void;
  skyBackgroundColor: string;   // skyVisible=false のときの単色フォールバック
  setSkyBackgroundColor: (c: string) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  landscape: "none",
  setLandscape: (landscape) => set({ landscape }),

  noneBackgroundColor: "#ffffff",
  setNoneBackgroundColor: (noneBackgroundColor) => set({ noneBackgroundColor }),

  // Flat defaults
  flatVisible: true,
  setFlatVisible: (flatVisible) => set({ flatVisible }),
  flatPreset: "grass",
  setFlatPreset: (flatPreset) => {
    const defaults = TERRAIN_PRESET_DEFAULTS[flatPreset];
    set({
      flatPreset,
      flatColor: defaults.color,
      flatRoughness: defaults.roughness,
    });
  },
  flatColor: TERRAIN_PRESET_DEFAULTS.grass.color,
  setFlatColor: (flatColor) => set({ flatColor }),
  flatRoughness: TERRAIN_PRESET_DEFAULTS.grass.roughness,
  setFlatRoughness: (flatRoughness) => set({ flatRoughness }),
  flatTextureEnabled: true,
  setFlatTextureEnabled: (flatTextureEnabled) => set({ flatTextureEnabled }),
  flatTileScale: 1,
  setFlatTileScale: (flatTileScale) => set({ flatTileScale }),
  flatAntiTile: true,
  setFlatAntiTile: (flatAntiTile) => set({ flatAntiTile }),

  // Sky defaults
  skyVisible: true,
  setSkyVisible: (skyVisible) => set({ skyVisible }),
  skyPreset: "park",
  setSkyPreset: (skyPreset) => set({ skyPreset }),
  skyBlur: 0,                   // 既定はクリア表示（ぼかしなし）
  setSkyBlur: (skyBlur) => set({ skyBlur }),
  skyResolution: 2048,          // 既定 2048（drei 既定 256 では低画質すぎたため引き上げ）
  setSkyResolution: (skyResolution) => set({ skyResolution }),
  skyBackgroundColor: "#9fc7ee",
  setSkyBackgroundColor: (skyBackgroundColor) => set({ skyBackgroundColor }),
}));
