// useBuildingSpecStore — Base（建物）の高さ系パラメータ。
//   - floorHeightMm : 階高（床〜上階の床。スラブ厚込み）= 主たる設定。各 FL を等間隔で駆動。
//   - ceilingHeightMm: （旧 CH。場所により変わるため UI からは廃止。互換のため保持・永続のみ）
//   - glMm          : GL（地盤レベル）。FL±0 基準の相対値(mm)。負＝FL より下。
//   - floors        : 各階の FL（床レベル）。floors[0]=1F=FL±0 で**常に 0（基準・固定）**。
//                     2F 以降は階高で派生（FL(i) = i × 階高）。
// 基準は 1F の FL（=FL±0=0）。建物は床=Y0 に正規化されるので FL±0 はワールド Y0 に一致。
// 例: GL = -500 のとき「FL±0 = GL+500」（1F 床は地盤より 500mm 上）。
// Base 単位で layoutState に永続化（loadLayoutState/saveLayoutState）。
import { create } from "zustand";

export interface FloorLevel {
  name: string;   // "1FL" / "2FL" など
  flMm: number;   // FL±0(1F床) からの相対高さ(mm)。floors[0]=1FL は常に 0。
}

export interface BuildingSpec {
  floorHeightMm: number;
  ceilingHeightMm: number;
  glMm: number;
  /** FL±0(1F床) のワールド基準高さ(mm)。既定 0＝モデル正規化床(Y0)。
   *  ドラッグで動かすと GL/各FL はこの基準に相対して一緒に動く（基準＝datum の移動）。 */
  fl0Mm: number;
  floors: FloorLevel[];
}

export const BUILDING_SPEC_DEFAULTS: BuildingSpec = {
  floorHeightMm: 3000,
  ceilingHeightMm: 2400,
  glMm: -500,                       // GL は FL±0 の 500mm 下（FL±0 = GL+500）
  fl0Mm: 0,                         // FL±0 = モデル床(Y0)
  floors: [{ name: "1FL", flMm: 0 }], // FL±0 = 1F の床（基準・固定 0=相対）
};

// 1F=FL±0 は常に 0、2F 以降は階高で等間隔に派生（FL(i) = i × 階高）。
const deriveFloors = (floors: FloorLevel[], floorHeightMm: number): FloorLevel[] =>
  floors.map((f, i) => ({ ...f, flMm: i === 0 ? 0 : i * floorHeightMm }));

interface BuildingSpecStore extends BuildingSpec {
  setFloorHeightMm: (v: number) => void;
  setCeilingHeightMm: (v: number) => void;
  setGlMm: (v: number) => void;
  setFl0Mm: (v: number) => void;
  setFloorFlMm: (index: number, flMm: number) => void;
  setFloorName: (index: number, name: string) => void;
  addFloor: () => void;     // 直上に 1 階追加（前階 + 階高）
  removeFloor: (index: number) => void;
  replaceAll: (s: Partial<BuildingSpec> | null | undefined) => void;
}

const clampMm = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

export const useBuildingSpecStore = create<BuildingSpecStore>((set, get) => ({
  ...BUILDING_SPEC_DEFAULTS,

  // 階高を変更すると全 FL を等間隔に再配置する（FL(i)=i×階高）。
  setFloorHeightMm: (v) =>
    set((s) => {
      const fh = clampMm(v, 2000, 8000);
      return { floorHeightMm: fh, floors: deriveFloors(s.floors, fh) };
    }),
  setCeilingHeightMm: (v) => set({ ceilingHeightMm: clampMm(v, 1800, 6000) }),
  setGlMm: (v) => set({ glMm: clampMm(v, -5000, 5000) }),
  setFl0Mm: (v) => set({ fl0Mm: clampMm(v, -10000, 30000) }),

  // 個別 FL のドラッグ等から階高を逆算（i 階の床 = i×階高 → 階高 = flMm / i）。
  setFloorFlMm: (index, flMm) =>
    set((s) => {
      if (index <= 0) return {}; // 1FL=FL±0 は基準
      const fh = clampMm(flMm / index, 2000, 8000);
      return { floorHeightMm: fh, floors: deriveFloors(s.floors, fh) };
    }),
  setFloorName: (index, name) =>
    set((s) => ({ floors: s.floors.map((f, i) => (i === index ? { ...f, name } : f)) })),

  addFloor: () =>
    set((s) => {
      const n = s.floors.length + 1;
      return { floors: deriveFloors([...s.floors, { name: `${n}FL`, flMm: 0 }], s.floorHeightMm || 3000) };
    }),
  removeFloor: (index) =>
    set((s) => (s.floors.length <= 1 ? {} : { floors: deriveFloors(s.floors.filter((_, i) => i !== index), s.floorHeightMm) })),

  replaceAll: (s) => {
    const fh = s?.floorHeightMm ?? BUILDING_SPEC_DEFAULTS.floorHeightMm;
    const floors = Array.isArray(s?.floors) && s!.floors!.length ? s!.floors! : [...BUILDING_SPEC_DEFAULTS.floors];
    set({
      floorHeightMm: fh,
      ceilingHeightMm: s?.ceilingHeightMm ?? BUILDING_SPEC_DEFAULTS.ceilingHeightMm,
      glMm: s?.glMm ?? BUILDING_SPEC_DEFAULTS.glMm,
      fl0Mm: s?.fl0Mm ?? BUILDING_SPEC_DEFAULTS.fl0Mm,
      floors: deriveFloors(floors, fh),
    });
  },
}));
