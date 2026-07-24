import { create } from "zustand";
import * as THREE from "three";
import { useEditorModeStore } from "./useEditorModeStore";
import { useViewportUiStore, VIEWPORT_IDS, VIEWPORT_LAYOUT } from "./viewportUiStore";
import { useSceneObjectRegistryStore } from "./sceneObjectRegistryStore";
import { useSectionLinesStore } from "./useSectionLinesStore";
import { useLayoutTaskStore } from "./useLayoutTaskStore";
import { useBuildingSpecStore } from "./useBuildingSpecStore";
import { useUiRightSidebarStore } from "./uiRightSidebarStore";
import { useSelectionScopeStore } from "./useSelectionScopeStore";

// 展開記号（平面図に置く「どこから見た展開図か」のマーカー）。
//   中心＝視点（目）、四方＝視線方向。上(A)/右(B)/下(C)/左(D)。
//   位置は部屋ごとに動かせる（既定は建物中心）。
export type ElevationDir = "A" | "B" | "C" | "D";

// 平面図の画面方位 → 視線方向 → 一人称ピンの yawDeg（atan2(dx,dz) 規約）。
//   上=−Z→180 / 右=+X→90 / 下=+Z→0 / 左=−X→−90
export const ELEV_DIR_YAW: Record<ElevationDir, number> = { A: 180, B: 90, C: 0, D: -90 };
export const ELEV_DIR_LABEL: Record<ElevationDir, string> = { A: "展開A（上）", B: "展開B（右）", C: "展開C（下）", D: "展開D（左）" };

/** 展開図の表示範囲（部屋の内側ボックス。world 座標） */
export interface ElevationRoomBox {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  yMin: number; yMax: number;
  /** 内壁面そのものの位置（パディングを含まない実寸）。
   *  寸法オーバーレイが「箱からパディングを引いて内法を逆算」しなくて済むように持たせる。
   *  側面と対象壁でパディングが違う（隣室の映り込み対策）ため、逆算は成立しない。
   *  旧経路（openDevelopedView）では未設定＝従来どおりパディング逆算にフォールバック。 */
  innerMinX?: number; innerMaxX?: number;
  innerMinZ?: number; innerMaxZ?: number;
}

interface ElevationMarkerState {
  /** マーカー位置（world XZ）。null=未設定（建物中心を使う） */
  pos: { x: number; z: number } | null;
  activeDir: ElevationDir | null;
  /** いま展開図ビューを表示中か（1F/立面/断面へ切替えると false）。
   *  ドックの「展開 A〜D」のハイライトに使う。 */
  viewActive: boolean;
  /** 表示範囲（マーカーが入っているゾーン＋床〜天井）。ゾーン外なら null=建物全体 */
  roomBox: ElevationRoomBox | null;
  /** 部屋名（ゾーン名）。ラベル「展開A ・ LDK」に使う */
  roomName: string | null;
  setPos: (pos: { x: number; z: number } | null) => void;
  setActiveDir: (dir: ElevationDir | null) => void;
  setViewActive: (v: boolean) => void;
  setRoom: (box: ElevationRoomBox | null, name: string | null) => void;
}

export const useElevationMarkerStore = create<ElevationMarkerState>((set) => ({
  pos: null,
  activeDir: null,
  viewActive: false,
  roomBox: null,
  roomName: null,
  setPos: (pos) => set({ pos }),
  setActiveDir: (activeDir) => set({ activeDir }),
  setViewActive: (viewActive) => set({ viewActive }),
  setRoom: (roomBox, roomName) => set({ roomBox, roomName }),
}));

/** 建物（躯体コライダー）のバウンディング中心 XZ。未取得なら {0,0}。 */
export function computeBuildingCenterXZ(): { x: number; z: number } {
  const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
  if (colliders.length) {
    const box = new THREE.Box3();
    colliders.forEach((c: any) => box.expandByObject(c));
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3());
      return { x: c.x, z: c.z };
    }
  }
  return { x: 0, z: 0 };
}

/** 展開図を開く: 断面・立面と同じ 2D 正射ビューで、マーカー位置から dir の壁面を見る。
 *  仕組みは「マーカー位置で視線方向にクリップした断面ビュー」:
 *    A(上=−Z): z≤pos を残し +Z 側から見る（FRONT）        / C(下=+Z): z≥pos を残し −Z 側から（FRONT+flip）
 *    D(左=−X): x≤pos を残し +X 側から見る（RIGHT）        / B(右=+X): x≥pos を残し −X 側から（RIGHT+flip）
 */
/** 見ている壁（展開図の対象面）の側に取るパディング(mm)。壁厚ぶん外側で切って壁面を残す。
 *  クリップ面が内壁面と同一平面だと壁そのものが消える/ちらつくため余裕を持たせる。 */
export const ELEV_ROOM_PAD_MM = 400;

/** 左右（画面横）と背面側に取るパディング(mm)。
 *  ここを対象壁と同じ 400mm にすると、100〜200mm の間仕切りを越えて
 *  隣室の壁・天井まで表示範囲に入り、展開図に黒い塊として映り込む。
 *  見えるのは内壁面の断口だけなので、壁厚より小さい値で十分。 */
export const ELEV_SIDE_PAD_MM = 80;

/** ゾーン矩形の集合 → 展開図の表示範囲（合併バウンディング）。壁面を残すため壁厚ぶん外側で切る。
 *  L字部屋＝「同じ部屋に属する複数の矩形ゾーン」を1つの部屋として扱うため配列で受ける。 */
export function computeRoomBoxFromRects(rects: any[]): ElevationRoomBox | null {
  const valid = (rects || []).filter((r) => r && Number.isFinite(r.x) && Number.isFinite(r.z));
  if (!valid.length) return null;
  const emAny: any = useEditorModeStore.getState();
  const isMm = (emAny.sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);
  const bs: any = useBuildingSpecStore.getState();
  const pad = toWorld(ELEV_ROOM_PAD_MM); // 壁厚ぶん外側で切って壁面を残す
  const yPad = toWorld(80);
  const flWorld = toWorld(bs.fl0Mm || 0);
  const clWorld = toWorld((bs.fl0Mm || 0) + (bs.ceilingHeightMm || 2400));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  valid.forEach((r) => {
    minX = Math.min(minX, r.x - (r.width || 0) / 2);
    maxX = Math.max(maxX, r.x + (r.width || 0) / 2);
    minZ = Math.min(minZ, r.z - (r.depth || 0) / 2);
    maxZ = Math.max(maxZ, r.z + (r.depth || 0) / 2);
  });
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minZ: minZ - pad,
    maxZ: maxZ + pad,
    yMin: flWorld - yPad,
    yMax: clWorld + yPad,
    innerMinX: minX,
    innerMaxX: maxX,
    innerMinZ: minZ,
    innerMaxZ: maxZ,
  };
}

/** ゾーン矩形 → 展開図の表示範囲（単一ゾーン版。旧経路 openDevelopedView 用）。 */
export function computeZoneRoomBox(zone: any): ElevationRoomBox | null {
  return computeRoomBoxFromRects(zone?.rect ? [zone.rect] : []);
}

/** マーカー位置を含むゾーンを「部屋」とみなす（部屋を明示できない旧経路用）。 */
export function findZoneAtXZ(pos: { x: number; z: number }): any | null {
  const zones = (useLayoutTaskStore.getState().zones || []) as any[];
  return (
    zones.find((zn) => {
      const r = zn?.rect;
      if (!r) return false;
      return (
        Math.abs(pos.x - r.x) <= (r.width || 0) / 2 &&
        Math.abs(pos.z - r.z) <= (r.depth || 0) / 2
      );
    }) || null
  );
}

/** 展開図を開く本体（部屋・位置・向きが確定している前提）。
 *  部屋ごとの展開（useRoomElevationsStore）からも、旧経路の openDevelopedView からも呼ぶ。 */
export function applyElevationView(opts: {
  pos: { x: number; z: number };
  dir: ElevationDir;
  roomBox: ElevationRoomBox | null;
  roomName: string | null;
}) {
  const { pos, dir, roomBox, roomName } = opts;
  // 切替の起点でディゾルブを開始（中間フレームを覆い隠す）。
  useViewportUiStore.getState().beginViewTransition?.();
  const st = useElevationMarkerStore.getState();
  st.setPos(pos);
  st.setActiveDir(dir);
  st.setViewActive(true);
  st.setRoom(roomBox, roomName);
  // 断面ラインの選択を解除（断面 Properties のミニマップ同期が
  // 展開図のクリップ位置で A-A' を上書きしないように）。
  useSectionLinesStore.getState().setActiveLine(null);

  const axis: "x" | "z" = dir === "A" || dir === "C" ? "z" : "x";
  const flip = dir === "C" || dir === "B"; // ＋軸方向を見る＝反転側
  const cut = axis === "z" ? pos.z : pos.x;

  const em: any = useEditorModeStore.getState();
  // Material スコープ（面仕上げ）に居るときは維持したまま展開図を表示する（面ピック可能）。
  // それ以外（旧・一人称材質モード等）は通常の 2D 図面ビューへ戻す。
  const matScope = useSelectionScopeStore.getState().scope === "material";
  if (em.editorMode === "material" && !matScope) em.setEditorMode("layout");
  em.setLayoutCameraTilt?.("default");
  em.setIsSectionClipEnabled(true);
  em.setSectionClipYEnabled(false);
  em.setSectionClipXEnabled(axis === "x");
  em.setSectionClipZEnabled(axis === "z");
  if (axis === "x") em.setSectionClipX(cut); else em.setSectionClipZ(cut);
  em.setSectionViewFlip?.(flip);

  // 2画面表示中はそのまま維持し、右ペインを展開図に差し替える（左は平面図のまま）。
  const vp: any = useViewportUiStore.getState();
  const targetId = axis === "x" ? VIEWPORT_IDS.RIGHT : VIEWPORT_IDS.FRONT;
  if (vp.layoutMode === VIEWPORT_LAYOUT.SPLIT) {
    vp.setSplitRightViewId?.(targetId);
  } else {
    vp.setLayoutMode(VIEWPORT_LAYOUT.SINGLE);
  }
  vp.setActiveViewportId(targetId);
  // リフレームはディゾルブカバーの不透明保持中に済ませる（中間フレームを見せない）。
  setTimeout(() => vp.requestFrameAll?.(), 40);

  // 右サイドバーに展開図専用 Properties を出す。
  const rs: any = useUiRightSidebarStore.getState();
  rs.setRightPanel?.("properties", true);
}

/** 旧経路: 部屋を指定せず「いまのマーカー位置」で展開図を開く（ドックの展開A〜D）。
 *  部屋はマーカー位置のゾーンから推定する。部屋を明示できる場合は
 *  utils/openElevationView.ts の openRoomElevation を使う。 */
export function openDevelopedView(dir: ElevationDir = "A") {
  const st = useElevationMarkerStore.getState();
  const pos = st.pos ?? computeBuildingCenterXZ();
  const zone = findZoneAtXZ(pos);
  applyElevationView({
    pos,
    dir,
    roomBox: zone ? computeZoneRoomBox(zone) : null,
    roomName: zone?.name || null,
  });
}
