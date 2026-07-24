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
import { pinOffsetWallHeights } from "./useWallStore";

export interface FloorLevel {
  name: string;   // "1FL" / "2FL" など
  flMm: number;   // FL±0(1F床) からの相対高さ(mm)。floors[0]=1FL は常に 0。導出値。
  /** この階の階高(mm)。未設定なら既定(floorHeightMm)に従う。階ごとに変えられる。 */
  heightMm?: number;
  /** この階の天井高 CL(mm)。未設定なら既定(ceilingHeightMm)に従う。階ごとに変えられる。 */
  clMm?: number;
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

/** 建物スペックから、指定した階（既定=アクティブ階）の床レベルをワールド mm で返す。
 *  新規家具はこの高さ（FL）に載せて配置する。1F=fl0Mm、2F 以降は fl0Mm + i×階高。 */
export function getFloorBaseYmm(spec: BuildingSpec, floorIndex: number): number {
  const floors = Array.isArray(spec.floors) && spec.floors.length ? spec.floors : BUILDING_SPEC_DEFAULTS.floors;
  const i = Math.max(0, Math.min(floorIndex || 0, floors.length - 1));
  return (spec.fl0Mm || 0) + (floors[i]?.flMm || 0);
}

export const BUILDING_SPEC_DEFAULTS: BuildingSpec = {
  floorHeightMm: 3000,
  ceilingHeightMm: 2400,
  glMm: -500,                       // GL は FL±0 の 500mm 下（FL±0 = GL+500）
  fl0Mm: 0,                         // FL±0 = モデル床(Y0)
  floors: [{ name: "1FL", flMm: 0 }], // FL±0 = 1F の床（基準・固定 0=相対）
};

/** 指定階の階高(mm)。その階に個別設定があればそれを、無ければ既定を使う。 */
export function floorHeightOf(spec: BuildingSpec, index: number): number {
  const f = spec.floors?.[index];
  return f?.heightMm ?? spec.floorHeightMm;
}

/** 指定階の天井高 CL(mm)。その階に個別設定があればそれを、無ければ既定を使う。 */
export function ceilingHeightOf(spec: BuildingSpec, index: number): number {
  const f = spec.floors?.[index];
  return f?.clMm ?? spec.ceilingHeightMm;
}

// 1F=FL±0 は常に 0。2F 以降は「下の階の階高」を積み上げる（階ごとに階高が違ってよい）。
const deriveFloors = (floors: FloorLevel[], floorHeightMm: number): FloorLevel[] => {
  let acc = 0;
  return floors.map((f, i) => {
    if (i === 0) return { ...f, flMm: 0 };
    acc += floors[i - 1]?.heightMm ?? floorHeightMm;
    return { ...f, flMm: acc };
  });
};

interface BuildingSpecStore extends BuildingSpec {
  /** 配置対象のアクティブ階（0=1F）。フロアセレクタ（EditorAngleBar の 1F/2F…）で切替。
   *  新規家具はこの階の床レベル（FL）に載せて配置する。 */
  activeFloorIndex: number;
  setActiveFloorIndex: (index: number) => void;
  setFloorHeightMm: (v: number) => void;
  /** 指定した階だけの階高を設定（上の階の FL が積み上がりで追従）。 */
  setFloorHeightAt: (index: number, v: number) => void;
  /** 指定した階だけの天井高(CL)を設定。他の階には影響しない。 */
  setCeilingHeightAt: (index: number, v: number) => void;
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

  activeFloorIndex: 0,
  setActiveFloorIndex: (index) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(Math.round(Number(index) || 0), s.floors.length - 1));
      return clamped === s.activeFloorIndex ? {} : { activeFloorIndex: clamped };
    }),

  // 階高を変更すると全 FL を等間隔に再配置する（FL(i)=i×階高）。
  //   変更前に、上下オフセット付きの壁（＝床から立ち上がっていない部分壁）は今の高さで
  //   固定して追従から外す（断面で階高をドラッグすると浮き壁まで伸びてしまうため）。
  setFloorHeightMm: (v) => {
    const s = get();
    const fh = clampMm(v, 2000, 8000);
    if (fh === s.floorHeightMm) return;
    pinOffsetWallHeights({ floorHeightMm: s.floorHeightMm, ceilingHeightMm: s.ceilingHeightMm });
    set({ floorHeightMm: fh, floors: deriveFloors(s.floors, fh) });
  },
  // 指定階だけの階高。1F を変えれば 2F 以降の FL が積み上がりで動く。
  setFloorHeightAt: (index, v) => {
    const s = get();
    const fh = clampMm(v, 2000, 8000);
    if (floorHeightOf(s, index) === fh) return;
    pinOffsetWallHeights({ floorHeightMm: s.floorHeightMm, ceilingHeightMm: s.ceilingHeightMm });
    const floors = s.floors.map((f, i) => (i === index ? { ...f, heightMm: fh } : f));
    set({ floors: deriveFloors(floors, s.floorHeightMm) });
  },

  // 指定階だけの天井高(CL)。他の階の CL は変わらない。
  setCeilingHeightAt: (index, v) => {
    const s = get();
    const ch = clampMm(v, 1800, 6000);
    if (ceilingHeightOf(s, index) === ch) return;
    pinOffsetWallHeights({ floorHeightMm: s.floorHeightMm, ceilingHeightMm: s.ceilingHeightMm });
    set({ floors: s.floors.map((f, i) => (i === index ? { ...f, clMm: ch } : f)) });
  },

  // CL も同様（内壁の既定高さなので、部分壁は追従から外してから変更する）。
  setCeilingHeightMm: (v) => {
    const s = get();
    const ch = clampMm(v, 1800, 6000);
    if (ch === s.ceilingHeightMm) return;
    pinOffsetWallHeights({ floorHeightMm: s.floorHeightMm, ceilingHeightMm: s.ceilingHeightMm });
    set({ ceilingHeightMm: ch });
  },
  setGlMm: (v) => set({ glMm: clampMm(v, -5000, 5000) }),
  setFl0Mm: (v) => set({ fl0Mm: clampMm(v, -10000, 30000) }),

  // 個別 FL のドラッグ → 「その1つ下の階の階高」を変えて実現する（他の階は動かさない）。
  setFloorFlMm: (index, flMm) => {
    if (index <= 0) return; // 1FL=FL±0 は基準
    const s = get();
    const below = s.floors[index - 1]?.flMm || 0;
    const fh = clampMm(flMm - below, 2000, 8000);
    if (floorHeightOf(s, index - 1) === fh) return;
    pinOffsetWallHeights({ floorHeightMm: s.floorHeightMm, ceilingHeightMm: s.ceilingHeightMm });
    const floors = s.floors.map((f, i) => (i === index - 1 ? { ...f, heightMm: fh } : f));
    set({ floors: deriveFloors(floors, s.floorHeightMm) });
  },
  setFloorName: (index, name) =>
    set((s) => ({ floors: s.floors.map((f, i) => (i === index ? { ...f, name } : f)) })),

  addFloor: () =>
    set((s) => {
      const n = s.floors.length + 1;
      return { floors: deriveFloors([...s.floors, { name: `${n}FL`, flMm: 0 }], s.floorHeightMm || 3000) };
    }),
  removeFloor: (index) =>
    set((s) => {
      if (s.floors.length <= 1) return {};
      const nextFloors = deriveFloors(s.floors.filter((_, i) => i !== index), s.floorHeightMm);
      const activeFloorIndex = Math.max(0, Math.min(s.activeFloorIndex, nextFloors.length - 1));
      return { floors: nextFloors, activeFloorIndex };
    }),

  replaceAll: (s) => {
    const fh = s?.floorHeightMm ?? BUILDING_SPEC_DEFAULTS.floorHeightMm;
    const floors = Array.isArray(s?.floors) && s!.floors!.length ? s!.floors! : [...BUILDING_SPEC_DEFAULTS.floors];
    set({
      floorHeightMm: fh,
      ceilingHeightMm: s?.ceilingHeightMm ?? BUILDING_SPEC_DEFAULTS.ceilingHeightMm,
      glMm: s?.glMm ?? BUILDING_SPEC_DEFAULTS.glMm,
      fl0Mm: s?.fl0Mm ?? BUILDING_SPEC_DEFAULTS.fl0Mm,
      floors: deriveFloors(floors, fh),
      activeFloorIndex: 0, // 新しい Base をロードしたら 1F に戻す
    });
  },
}));
