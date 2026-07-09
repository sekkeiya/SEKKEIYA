import { create } from 'zustand';

export type LightType = 'hemisphere' | 'directional' | 'spot' | 'rect' | 'neon';

export interface LightConfig {
  id: string;
  type: LightType;
  name: string;
  visible: boolean;
  color: string;       // hex '#rrggbb'
  intensity: number;

  // ユースケースプリセット ID (PropertiesLightPanel で適用 / 表示用)
  // 手動編集で他のフィールドが変更されると null に戻る。
  presetId?: string | null;

  // ピン留め: true のライトは「自動ライティング」実行時に保持される（削除されない）。
  // 自動生成ライトは pinned=false。ユーザーが残したいライトを明示的にピン留めする。
  pinned?: boolean;

  // hemisphere
  groundColor?: string;

  // directional
  azimuth?: number;    // 0–360°
  elevation?: number;  // 0–90°
  distance?: number;
  castShadow?: boolean;

  // spot
  position?: [number, number, number];
  targetPosition?: [number, number, number];
  angle?: number;      // radians
  penumbra?: number;   // 0–1
  decay?: number;
  spotDistance?: number;

  // rect
  rectPosition?: [number, number, number];
  rectRotationX?: number; // degrees  (typically –90 = facing down)
  width?: number;
  height?: number;

  // neon (linear LED strip — 細長い rectAreaLight)
  neonPosition?: [number, number, number]; // シーン単位 = mm
  neonRotationX?: number;  // degrees (tilt around X axis; -90 = facing down)
  neonRotationY?: number;  // degrees (yaw around Y axis; 0 = strip 沿 X 軸)
  length?: number;         // meters (strip の長辺)
  thickness?: number;      // meters (strip の短辺、典型: 0.05~0.2 m)
}

// ─── 型ごとのデフォルト値 ───────────────────────────────────────────
const TYPE_DEFAULTS: Record<LightType, Partial<LightConfig>> = {
  hemisphere: { groundColor: '#7a6a58', intensity: 0.6, color: '#ffffff' },
  directional: {
    color: '#ffffff', intensity: 1.2,
    azimuth: 45, elevation: 50, distance: 13,
    castShadow: true,
  },
  spot: {
    color: '#ffffff', intensity: 2.0,
    // 重要: シーン単位はミリメートル (mm)。SceneGrid / gridHeightMm / gridCellSizeMm 参照。
    // 位置とレンジ (spotDistance) もすべて mm で扱う。
    // 位置: 床上 3m, 中心から x/z 各 2m オフセット（ガイズモが見えやすく、室内を照らす想定）
    position: [2000, 3000, 2000], targetPosition: [0, 0, 0],
    angle: Math.PI / 6, penumbra: 0.25, decay: 2,
    // Three.js SpotLight の cutoffDistance = spotDistance (シーン単位 = mm)。
    // 8000 mm = 8 m。これを超える距離では光が完全にカットされる。
    // 旧デフォルトの 20 (= 20mm) では床にすら届かなかった。
    spotDistance: 8000,
    castShadow: true,   // シャドウを有効にして床への照射サークルを可視化
  },
  rect: {
    color: '#ffffff', intensity: 5.0,
    // rectPosition: シーン単位 = mm。天井近く 3.2m = 3200mm。
    // width / height: ユーザー側の単位は **メートル** (Properties パネル step=0.25, min=0.1)。
    // RectAreaLightRenderer 側で × 1000 して Three.js (mm シーン) に渡す。
    rectPosition: [0, 3200, 0], rectRotationX: -90,
    width: 3, height: 3,
  },
  neon: {
    color: '#ffffff', intensity: 8.0,  // 細長い → 単位面積あたり強めにしてバランスを取る
    // 天井から少し下げた位置 (LED ストリップ想定) — 床上 3m
    neonPosition: [0, 3000, 0],
    neonRotationX: -90,  // 下向き
    neonRotationY: 0,    // X 軸沿い
    length: 2,           // 2m
    thickness: 0.1,      // 10cm
  },
};

// ─── 初期ライト（既存 Lights.jsx の ambientLight + directionalLight に相当）─
const INITIAL_LIGHTS: LightConfig[] = [
  {
    id: 'ambience',
    type: 'hemisphere',
    name: 'Ambience',
    visible: true,
    ...TYPE_DEFAULTS.hemisphere,
  } as LightConfig,
  {
    id: 'sun',
    type: 'directional',
    name: 'Sun',
    visible: true,
    ...TYPE_DEFAULTS.directional,
  } as LightConfig,
];

const TYPE_NAME: Record<LightType, string> = {
  hemisphere: 'Ambience', directional: 'Directional', spot: 'Spot', rect: 'Rect Area', neon: 'Neon',
};

// 型デフォルトを適用した LightConfig を生成する（ストアには挿入しない）。
// addLight と「自動ライティング」パイプラインの両方から使い、デフォルト値を一元化する。
export function createLight(type: LightType, overrides: Partial<LightConfig> = {}): LightConfig {
  return {
    id: crypto.randomUUID(),
    type,
    name: TYPE_NAME[type],
    visible: true,
    color: '#ffffff',
    intensity: 1.0,
    pinned: false,
    ...TYPE_DEFAULTS[type],
    ...overrides,
  } as LightConfig;
}

// ─── Store ─────────────────────────────────────────────────────────
interface LightingStore {
  lights: LightConfig[];
  updateLight: (id: string, patch: Partial<LightConfig>) => void;
  addLight: (type: LightType) => string;
  removeLight: (id: string) => void;
  togglePin: (id: string) => void;
  // 自動ライティング: ピン留めされていないライトを全削除し、生成ライト群で置換する。
  replaceUnpinnedLights: (generated: LightConfig[]) => void;
  // リビール演出: 複数ライトの intensity を1フレームでまとめて更新する。
  setIntensities: (entries: Array<{ id: string; intensity: number }>) => void;
  // Base 切替時などに初期ライト（環境光＋太陽）へ戻す。
  resetLights: () => void;
  // 永続化からの復元（保存済みライト配列で丸ごと差し替え）。
  setLights: (lights: LightConfig[]) => void;
}

export const useLightingStore = create<LightingStore>((set, get) => ({
  lights: INITIAL_LIGHTS,

  updateLight: (id, patch) =>
    set((s) => ({ lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

  addLight: (type) => {
    const count = get().lights.filter((l) => l.type === type).length + 1;
    const light = createLight(type, { name: `${TYPE_NAME[type]} ${count}` });
    set((s) => ({ lights: [...s.lights, light] }));
    return light.id;
  },

  removeLight: (id) =>
    set((s) => ({ lights: s.lights.filter((l) => l.id !== id) })),

  togglePin: (id) =>
    set((s) => ({ lights: s.lights.map((l) => (l.id === id ? { ...l, pinned: !l.pinned } : l)) })),

  replaceUnpinnedLights: (generated) =>
    set((s) => ({ lights: [...s.lights.filter((l) => l.pinned), ...generated] })),

  // 複数ライトの intensity を1回の set でまとめて更新する（リビール演出のフレーム駆動用）。
  // 1フレーム＝1レンダリングに抑え、updateLight を多数回呼ぶより軽い。
  setIntensities: (entries) =>
    set((s) => {
      const map = new Map(entries.map((e) => [e.id, e.intensity]));
      return { lights: s.lights.map((l) => (map.has(l.id) ? { ...l, intensity: map.get(l.id)! } : l)) };
    }),

  // 初期ライトへ戻す（フレッシュなクローンを渡し、共有参照の汚染を防ぐ）。
  resetLights: () => set({ lights: INITIAL_LIGHTS.map((l) => ({ ...l })) }),

  // 永続化からの復元。空配列なら初期ライトにフォールバック。
  setLights: (lights) =>
    set({ lights: Array.isArray(lights) && lights.length ? lights : INITIAL_LIGHTS.map((l) => ({ ...l })) }),
}));
