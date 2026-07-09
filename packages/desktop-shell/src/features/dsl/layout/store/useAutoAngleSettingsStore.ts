// useAutoAngleSettingsStore.ts
// 「自動アングル生成」の設定。撮影スタイルのプリセット＋詳細パラメータ。
// generateAutoAngles() がこれを読み、家具配置・高さを考慮してアングルを生成する。
import { create } from "zustand";

/** 撮影スタイル（プリセット）。選ぶと詳細値に既定を流し込む。 */
export type AngleStyle = "realestate" | "magazine" | "catalog";
/** 目線（カメラ）の高さ方針。auto は家具の高さ基準で自動。 */
export type EyeHeight = "auto" | "seated" | "standing" | "overhead";
/** 構図の寄り（被写体をどれだけ画面いっぱいにするか）。 */
export type Framing = "wide" | "standard" | "tight";

export const ANGLE_STYLE_LABEL: Record<AngleStyle, string> = {
  realestate: "不動産",
  magazine: "雑誌",
  catalog: "カタログ",
};
export const EYE_HEIGHT_LABEL: Record<EyeHeight, string> = {
  auto: "自動",
  seated: "座位 (1.15m)",
  standing: "立位 (1.5m)",
  overhead: "俯瞰",
};
export const FRAMING_LABEL: Record<Framing, string> = {
  wide: "広め",
  standard: "標準",
  tight: "寄り",
};

interface StyleDefaults {
  count: number;
  eyeHeight: EyeHeight;
  framing: Framing;
  avoidFurniture: boolean;
}

// 各スタイルの既定値。
//  - 不動産: 立位・広め・点数多めで部屋の広さが伝わる王道
//  - 雑誌  : 座位・標準で家具を主役にしたドラマ性
//  - カタログ: 座位・寄りで家具ディテール中心
const STYLE_DEFAULTS: Record<AngleStyle, StyleDefaults> = {
  realestate: { count: 6, eyeHeight: "standing", framing: "wide", avoidFurniture: true },
  magazine: { count: 5, eyeHeight: "seated", framing: "standard", avoidFurniture: true },
  catalog: { count: 6, eyeHeight: "seated", framing: "tight", avoidFurniture: true },
};

export interface AutoAngleSettingsState {
  style: AngleStyle;
  count: number; // 生成するアングル数（2..10）
  eyeHeight: EyeHeight;
  framing: Framing;
  avoidFurniture: boolean; // 家具を避けてカメラを置く / 遮蔽を減らす

  setStyle: (s: AngleStyle) => void; // プリセット適用（詳細値を上書き）
  setCount: (n: number) => void;
  setEyeHeight: (e: EyeHeight) => void;
  setFraming: (f: Framing) => void;
  setAvoidFurniture: (b: boolean) => void;
}

export const useAutoAngleSettingsStore = create<AutoAngleSettingsState>((set) => ({
  style: "realestate",
  ...STYLE_DEFAULTS.realestate,

  setStyle: (style) => set({ style, ...STYLE_DEFAULTS[style] }),
  setCount: (count) => set({ count: Math.max(2, Math.min(10, Math.round(count))) }),
  setEyeHeight: (eyeHeight) => set({ eyeHeight }),
  setFraming: (framing) => set({ framing }),
  setAvoidFurniture: (avoidFurniture) => set({ avoidFurniture }),
}));
