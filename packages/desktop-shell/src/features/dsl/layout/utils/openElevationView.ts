// openElevationView — 「部屋ごとの展開」を開く副作用の集約（applySelectionScope と同じ React 非依存パターン）。
// ドキュメント（useRoomElevationsStore）とビュー状態（useElevationMarkerStore）を繋ぐ層。
//
// 「部屋」の単位 = Room（ZoneNode.roomId が指す useLayoutTaskStore.rooms のエントリ）。
//   - L字部屋などは「同じ roomId を持つ複数の矩形ゾーン」で表現される（autoZoning の契約）ため、
//     展開図の表示範囲は所属ゾーン rect の合併バウンディングで決める。
//   - roomId を持たないゾーンは、そのゾーン単体を1部屋とみなす（id はゾーン id をそのまま使う）。
// 記号の既定位置の計算もここに置き、平面図オーバーレイと展開図オープンで同じ位置を使う。
import {
  applyElevationView,
  computeRoomBoxFromRects,
  ELEV_ROOM_PAD_MM,
  ELEV_SIDE_PAD_MM,
} from "../store/useElevationMarkerStore";
import {
  measureRoomInteriorAt,
  measureRoomFromWalls,
  measureRoomFromSlab,
  measureCeilingUndersideAt,
} from "./baseFootprint";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import {
  useRoomElevationsStore,
  type RoomElevation,
} from "../store/useRoomElevationsStore";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";

/** 展開図の対象になる「部屋」1つぶん。 */
export interface ElevationRoom {
  /** Room.id（roomId 無しゾーンはゾーン id） */
  id: string;
  name: string;
  /** rect を持つ所属ゾーン。L字部屋は複数。 */
  zones: any[];
}

/** 部屋リスト（＋所属ゾーン） → 展開対象の部屋一覧。
 *  展開図は「部屋（室）」に紐づく（ゾーン＝室内の機能マーカーには展開を作らない）。
 *  - 部屋の範囲は Room.rect（無ければ所属ゾーンの合併 rect でフォールバック）
 *  - L字部屋＝同一 roomId の複数ゾーン。roomId 無しゾーンは展開対象にしない。 */
export function computeElevationRooms(zones: any[], rooms: any[]): ElevationRoom[] {
  const zonesByRoom = new Map<string, any[]>();
  (zones || []).forEach((z) => {
    if (!z?.rect || !z.roomId) return;
    const arr = zonesByRoom.get(z.roomId) || [];
    arr.push(z);
    zonesByRoom.set(z.roomId, arr);
  });
  const units: ElevationRoom[] = [];
  (rooms || []).forEach((rm: any) => {
    const zs = zonesByRoom.get(rm.id) || [];
    if (rm?.rect) {
      // 室の範囲は Room.rect（1ゾーン相当）。実測クランプは openRoomElevation 側で。
      units.push({ id: rm.id, name: rm.name || "", zones: [{ id: rm.id, rect: rm.rect }] });
    } else if (zs.length) {
      // Room.rect が無い旧データは所属ゾーンの rect で代用。
      units.push({ id: rm.id, name: rm.name || zs[0]?.name || "", zones: zs });
    }
  });
  return units;
}

/** ストアの現在値から部屋一覧を計算（imperative 用）。 */
export function getElevationRooms(): ElevationRoom[] {
  const st = useLayoutTaskStore.getState();
  return computeElevationRooms(st.zones || [], st.rooms || []);
}

export function getElevationRoomById(roomId: string): ElevationRoom | null {
  return getElevationRooms().find((u) => u.id === roomId) || null;
}

/** 部屋の代表ゾーン＝面積最大のゾーン（記号の既定位置の基準）。 */
function mainZoneOf(room: ElevationRoom): any | null {
  let best: any = null;
  let bestArea = -1;
  room.zones.forEach((z) => {
    const area = (z.rect?.width || 0) * (z.rect?.depth || 0);
    if (area > bestArea) { bestArea = area; best = z; }
  });
  return best;
}

/** 記号の既定位置。
 *  代表ゾーン中心から「見る壁の側」へ寄せた点（A=上を見る→部屋の上寄り / B=右→右寄り…）。
 *  4記号が中心から十字に散らばり、どの壁の展開かが一目で分かる。
 *  同じ向きの2本目（展開A'…）は中心寄りにずらして重なりを避ける。 */
export function defaultElevationPos(elev: RoomElevation): { x: number; z: number } | null {
  const room = getElevationRoomById(elev.roomId);
  const r = room ? mainZoneOf(room)?.rect : null;
  if (!r) return null;
  const store = useRoomElevationsStore.getState();
  const sameDir = store.elevations.filter((e) => e.roomId === elev.roomId && e.dir === elev.dir);
  const i = Math.max(0, sameDir.findIndex((e) => e.id === elev.id));
  // 中心と壁の中間あたり（短辺の 1/5 ≒ 半径の約40%）。2本目以降は中心側へ。
  const d = (Math.min(r.width || 0, r.depth || 0) / 5) * Math.max(0.25, 1 - 0.5 * i);
  // dir A=−Z（上）を見る → 記号も −Z 側へ / B=+X → +X 側 / C=+Z → +Z 側 / D=−X → −X 側
  const off = { A: [0, -d], B: [d, 0], C: [0, d], D: [-d, 0] }[elev.dir];
  return { x: r.x + off[0], z: r.z + off[1] };
}

/** 記号位置＝ユーザーが動かした位置、無ければ既定位置。 */
export function getElevationMarkerPos(elev: RoomElevation): { x: number; z: number } | null {
  const saved = useRoomElevationsStore.getState().markerPos[elev.id];
  return saved ?? defaultElevationPos(elev);
}

/** 展開（id 指定）を開く。表示範囲は部屋の全ゾーン rect の合併で決まる。 */
export function openRoomElevation(elevationId: string): void {
  const store = useRoomElevationsStore.getState();
  const elev = store.elevations.find((e) => e.id === elevationId);
  if (!elev) return;

  const room = getElevationRoomById(elev.roomId);
  const pos = getElevationMarkerPos(elev);
  if (!room || !pos) return; // 部屋（ゾーン）が消えている等

  store.selectRoom(elev.roomId);
  store.setActiveElevation(elev.id);

  applyElevationView({
    pos,
    dir: elev.dir,
    roomBox: computeElevationRoomBox(room, pos, elev.dir),
    roomName: room.name || null,
  });
}

/** 展開図の表示範囲（クリップ用の箱）を決める。
 *
 *  基本方針（ユーザーの定義）: 展開図＝「その部屋の各面を見たときの断面図」。
 *  記号位置＝切断位置。範囲は“その部屋の輪郭”そのものであるべき。
 *
 *  部屋の輪郭は確定データだけで決める（どれも「縮める」方向にしか効かない）:
 *    A. 床スラブの多角形 … 部屋ごとに描かれた輪郭。最優先。L字も辺まで正しく取れる
 *    B. ゾーン矩形       … 壁で囲われた範囲の内接矩形（自動部屋作成が作る）。常に在る
 *    C. 作図した壁       … 芯線＋壁厚の確定データ
 *  GLB のレイキャスト（measureRoomInteriorAt）は XZ の絞りには使わない
 *  ——片面ポリゴンで測り損ね、対象壁ごと切って真っ暗にする事故が起きたため。
 *  高さ（床・天井）取得にだけ使う。
 *
 *  パディングは方向で変える。見ている壁だけ 400mm 外へ出して壁体を残し、
 *  左右・背面は 80mm に留める（400mm だと間仕切りを越えて隣室が映り込む）。 */
export function computeElevationRoomBox(
  room: ElevationRoom,
  pos: { x: number; z: number },
  dir: "A" | "B" | "C" | "D",
) {
  const base = computeRoomBoxFromRects(room.zones.map((z) => z.rect));
  if (!base) return null;

  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);
  const facePad = toWorld(ELEV_ROOM_PAD_MM);
  const sidePad = toWorld(ELEV_SIDE_PAD_MM);

  // B) ゾーン矩形（computeRoomBoxFromRects が内法として持っている）＝基準
  const zoneMinX = base.innerMinX ?? base.minX + facePad;
  const zoneMaxX = base.innerMaxX ?? base.maxX - facePad;
  const zoneMinZ = base.innerMinZ ?? base.minZ + facePad;
  const zoneMaxZ = base.innerMaxZ ?? base.maxZ - facePad;
  let innerMinX = zoneMinX;
  let innerMaxX = zoneMaxX;
  let innerMinZ = zoneMinZ;
  let innerMaxZ = zoneMaxZ;

  // A) 記号が乗っている床スラブの輪郭＝「その部屋」そのもの。最も確か。
  const bySlab = measureRoomFromSlab(pos);
  if (bySlab) {
    innerMinX = Math.max(innerMinX, bySlab.minX);
    innerMaxX = Math.min(innerMaxX, bySlab.maxX);
    innerMinZ = Math.max(innerMinZ, bySlab.minZ);
    innerMaxZ = Math.min(innerMaxZ, bySlab.maxZ);
  }

  // C) 作図した壁（芯線＋壁厚の確定データ）
  const bs: any = useBuildingSpecStore.getState();
  const flSpec = toWorld(bs.fl0Mm || 0);
  const byWalls = measureRoomFromWalls(pos, flSpec);
  if (byWalls.minX) innerMinX = Math.max(innerMinX, byWalls.minX.face);
  if (byWalls.maxX) innerMaxX = Math.min(innerMaxX, byWalls.maxX.face);
  if (byWalls.minZ) innerMinZ = Math.max(innerMinZ, byWalls.minZ.face);
  if (byWalls.maxZ) innerMaxZ = Math.min(innerMaxZ, byWalls.maxZ.face);

  // GLB レイキャスト（床/天井の高さ取得＋横方向の壁実測）
  const probe = measureRoomInteriorAt(pos, flSpec);

  // 横方向（図面の左右）だけ GLB レイの壁で詰める。
  //   展開図は「その部屋の各面を見た断面」なので、横は部屋幅で切りたい。
  //   この躯体は GLB で床スラブも作図壁も無く、スラブ/ゾーン/作図壁のどれも
  //   効かない → ゾーン矩形のまま隣室まで映る。横方向は詰めすぎても図面が
  //   狭くなるだけで、対象壁（＝奥行き方向）を詰める真っ暗事故は起きない
  //   ので、ここは GLB レイを積極的に使ってよい。
  const lateralAxis: "x" | "z" = dir === "A" || dir === "C" ? "x" : "z";
  if (lateralAxis === "x") {
    if (probe.minX != null) innerMinX = Math.max(innerMinX, probe.minX);
    if (probe.maxX != null) innerMaxX = Math.min(innerMaxX, probe.maxX);
  } else {
    if (probe.minZ != null) innerMinZ = Math.max(innerMinZ, probe.minZ);
    if (probe.maxZ != null) innerMaxZ = Math.min(innerMaxZ, probe.maxZ);
  }

  // 絞りすぎ（測定失敗）のときはゾーン矩形へ戻す
  if (innerMaxX - innerMinX < toWorld(300) || innerMaxZ - innerMinZ < toWorld(300)) {
    innerMinX = zoneMinX;
    innerMaxX = zoneMaxX;
    innerMinZ = zoneMinZ;
    innerMaxZ = zoneMaxZ;
  }

  // 高さは実測の床上端〜天井下端を優先（spec の CL と躯体がずれていると
  // 上端クリップが天井に届かず、上階の床・壁が映り込む）。
  const floorW =
    probe.floorY != null && Math.abs(probe.floorY - flSpec) < toWorld(600)
      ? probe.floorY
      : flSpec;
  let ceilW =
    probe.ceilY != null && probe.ceilY > flSpec + toWorld(1500) && probe.ceilY < flSpec + toWorld(6500)
      ? probe.ceilY
      : flSpec + toWorld((bs.ceilingHeightMm as number) || 2400);
  // 作図した天井スラブは「上面＝CL・厚みは下向き」＝下面が実際の天井面。
  const ceilUnder = measureCeilingUndersideAt(pos);
  if (ceilUnder != null && ceilUnder > floorW + toWorld(1500)) ceilW = Math.min(ceilW, ceilUnder);
  // 床・天井の「実体（スラブ厚ぶん）」を範囲に含める——断面と同じく、
  // 記号位置の切断で床・天井の断口（黒ポシェ）が図面の上下に出るようにする。
  // 200mm ＝ スラブ厚（既定150〜200）ぶん。上は 2F 床の下面には届かない値。
  // 内法（寸法・フレーミング基準）は floorW/ceilW のまま。
  const slabAllow = toWorld(200);
  const yMin = floorW - slabAllow;
  const yMax = ceilW + slabAllow;

  // 見ている壁だけ厚めのパディング（A=−Z / B=+X / C=+Z / D=−X）。
  // その壁の厚みが分かる場合（作図壁 or GLB の逆向きレイ実測）は「外面＋20mm」で止める。
  // 固定 400mm だと厚100の間仕切りを 300mm も突き抜け、奥の部屋の
  // 間仕切りの断口（黒い縦帯）や天井スラブが展開図に映り込む。
  const facing = ({ A: "minZ", B: "maxX", C: "maxZ", D: "minX" } as const)[dir];
  const faceMargin = toWorld(20);
  const p = (side: "minX" | "maxX" | "minZ" | "maxZ") => {
    if (side !== facing) return sidePad;
    // 詰めるのは「内面の位置と厚みが確定している作図壁」のときだけ。
    // レイキャスト由来やゾーン推定で詰めると、内面の位置自体が不確かなため
    // 対象壁ごとクリップされ、展開図が真っ暗になる（実機で発生）。
    const th = byWalls[side]?.thicknessW ?? null;
    return th != null ? Math.min(facePad, th + faceMargin) : facePad;
  };

  return {
    minX: innerMinX - p("minX"),
    maxX: innerMaxX + p("maxX"),
    minZ: innerMinZ - p("minZ"),
    maxZ: innerMaxZ + p("maxZ"),
    yMin,
    yMax,
    innerMinX, innerMaxX, innerMinZ, innerMaxZ,
  };
}
