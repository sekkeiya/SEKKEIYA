import { create } from "zustand";
import type { MapProvider } from "../services/mapImagery";

/** 作図モード：none=なし / site=敷地多角形 / line=基準線（縮尺合わせ） */
export type MapDrawMode = "none" | "site" | "line";

/**
 * S.Layout「マップ」機能の状態。
 * 住所から生成した航空写真/地図を地面に貼り、縮尺・位置・不透明度を調整する。
 * シーンに貼る本体は MapGroundPlane.jsx、作図は MapDrawController.jsx が購読する。
 *
 * ワークフロー（4ステップ）:
 *   ① 住所で生成 → ② 敷地を左クリックで作図 → ③ 敷地中心で再生成 → ④ 基準線＋実寸で縮尺合わせ
 */
export interface MapGroundState {
  /** 生成済み画像（JPEG dataURL）。null なら未生成。 */
  imageUrl: string | null;
  /** 地面プレーンを表示するか。 */
  visible: boolean;

  /** 画像が覆う実寸の一辺（mm、タイル数学で算出）。realCoverageM = baseWidthMm/1000。 */
  baseWidthMm: number;
  /** ユーザー縮尺補正（1.0 = 算出どおりの実寸）。最終寸法 = baseWidthMm * scale。 */
  scale: number;
  /** 地面の高さ（mm）。床面とのZファイト回避で既定は微小に下げる。 */
  yMm: number;
  /** 平面内オフセット（mm）。敷地中心を合わせる用。 */
  offsetXMm: number;
  offsetZMm: number;
  /** 平面の回転（度、Y軸まわり＝真北合わせ用）。 */
  rotationDeg: number;
  /** 不透明度（0〜1）。 */
  opacity: number;

  /** メタ情報。geo 逆算（敷地重心→緯度経度）にも使う。 */
  provider: MapProvider;
  centerLat: number | null;
  centerLng: number | null;
  zoom: number;
  address: string;
  attribution: string;

  /** ロケーターで選んだピン（敷地中心）の緯度経度。生成の中心に使う。 */
  pinLat: number | null;
  pinLng: number | null;

  /** 作図状態（セッション内のみ。永続化しない）。 */
  drawMode: MapDrawMode;
  /** 敷地多角形の頂点（ワールド mm の [x,z]）。 */
  sitePoints: Array<[number, number]>;
  /** 基準線の端点（ワールド mm の [x,z]、最大2点）。 */
  linePoints: Array<[number, number]>;

  /** 生成結果を取り込む。 */
  setGenerated: (p: {
    imageUrl: string;
    baseWidthMm: number;
    provider: MapProvider;
    centerLat: number;
    centerLng: number;
    zoom: number;
    address: string;
    attribution: string;
  }) => void;
  setVisible: (v: boolean) => void;
  setScale: (v: number) => void;
  setYMm: (v: number) => void;
  setOffset: (x: number, z: number) => void;
  setRotationDeg: (v: number) => void;
  setOpacity: (v: number) => void;

  setPin: (lat: number, lng: number) => void;

  setDrawMode: (m: MapDrawMode) => void;
  addSitePoint: (x: number, z: number) => void;
  updateSitePoint: (index: number, x: number, z: number) => void;
  removeSitePoint: (index: number) => void;
  clearSite: () => void;
  addLinePoint: (x: number, z: number) => void;
  clearLine: () => void;

  clear: () => void;
}

export const useMapGroundStore = create<MapGroundState>((set) => ({
  imageUrl: null,
  visible: true,

  baseWidthMm: 0,
  scale: 1,
  yMm: -2, // 床(0)のわずか下に敷いてZファイトを避ける
  offsetXMm: 0,
  offsetZMm: 0,
  rotationDeg: 0,
  opacity: 1,

  provider: "satellite",
  centerLat: null,
  centerLng: null,
  zoom: 19,
  address: "",
  attribution: "",

  pinLat: null,
  pinLng: null,

  drawMode: "none",
  sitePoints: [],
  linePoints: [],

  setPin: (lat, lng) => set({ pinLat: lat, pinLng: lng }),

  setGenerated: (p) =>
    set({
      imageUrl: p.imageUrl,
      baseWidthMm: p.baseWidthMm,
      provider: p.provider,
      centerLat: p.centerLat,
      centerLng: p.centerLng,
      zoom: p.zoom,
      address: p.address,
      attribution: p.attribution,
      visible: true,
      // 新規生成時は補正をリセット（実寸で配置）
      scale: 1,
      offsetXMm: 0,
      offsetZMm: 0,
      rotationDeg: 0,
    }),

  setVisible: (v) => set({ visible: v }),
  setScale: (v) => set({ scale: Math.max(0.02, v) }),
  setYMm: (v) => set({ yMm: v }),
  setOffset: (x, z) => set({ offsetXMm: x, offsetZMm: z }),
  setRotationDeg: (v) => set({ rotationDeg: v }),
  setOpacity: (v) => set({ opacity: Math.max(0, Math.min(1, v)) }),

  setDrawMode: (m) => set({ drawMode: m }),
  addSitePoint: (x, z) => set((s) => ({ sitePoints: [...s.sitePoints, [x, z]] })),
  updateSitePoint: (index, x, z) =>
    set((s) => {
      if (index < 0 || index >= s.sitePoints.length) return s;
      const next = s.sitePoints.slice();
      next[index] = [x, z];
      return { sitePoints: next };
    }),
  removeSitePoint: (index) =>
    set((s) => {
      if (index < 0 || index >= s.sitePoints.length) return s;
      const next = s.sitePoints.slice();
      next.splice(index, 1);
      return { sitePoints: next };
    }),
  clearSite: () => set({ sitePoints: [] }),
  addLinePoint: (x, z) =>
    set((s) => ({
      // 3点目以降は新しい線として 1 点目から引き直す。
      linePoints: s.linePoints.length >= 2 ? [[x, z]] : [...s.linePoints, [x, z]],
    })),
  clearLine: () => set({ linePoints: [] }),

  clear: () =>
    set({
      imageUrl: null,
      baseWidthMm: 0,
      centerLat: null,
      centerLng: null,
      address: "",
      attribution: "",
      drawMode: "none",
      sitePoints: [],
      linePoints: [],
    }),
}));
