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

// ─── Store ─────────────────────────────────────────────────────────
interface LightingStore {
  lights: LightConfig[];
  updateLight: (id: string, patch: Partial<LightConfig>) => void;
  addLight: (type: LightType) => string;
  removeLight: (id: string) => void;
}

export const useLightingStore = create<LightingStore>((set, get) => ({
  lights: INITIAL_LIGHTS,

  updateLight: (id, patch) =>
    set((s) => ({ lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

  addLight: (type) => {
    const id = crypto.randomUUID();
    const count = get().lights.filter((l) => l.type === type).length + 1;
    const NAME: Record<LightType, string> = {
      hemisphere: 'Ambience', directional: 'Directional', spot: 'Spot', rect: 'Rect Area', neon: 'Neon',
    };
    const light: LightConfig = {
      id,
      type,
      name: `${NAME[type]} ${count}`,
      visible: true,
      color: '#ffffff',
      intensity: 1.0,
      ...TYPE_DEFAULTS[type],
    };
    set((s) => ({ lights: [...s.lights, light] }));
    return id;
  },

  removeLight: (id) =>
    set((s) => ({ lights: s.lights.filter((l) => l.id !== id) })),
}));
