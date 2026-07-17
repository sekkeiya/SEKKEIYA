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
} from "../store/useElevationMarkerStore";
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

/** ゾーン＋部屋リスト → 展開対象の部屋一覧。
 *  roomId でゾーンを束ね、roomId 無しのゾーンは単体で1部屋にする。 */
export function computeElevationRooms(zones: any[], rooms: any[]): ElevationRoom[] {
  const withRect = (zones || []).filter((z) => z?.rect);
  const roomNameById = new Map((rooms || []).map((r: any) => [r.id, r.name]));
  const grouped = new Map<string, any[]>();
  const singles: ElevationRoom[] = [];
  withRect.forEach((z) => {
    if (z.roomId) {
      const arr = grouped.get(z.roomId) || [];
      arr.push(z);
      grouped.set(z.roomId, arr);
    } else {
      singles.push({ id: z.id, name: z.name || "", zones: [z] });
    }
  });
  const units: ElevationRoom[] = [];
  grouped.forEach((zs, roomId) => {
    units.push({ id: roomId, name: roomNameById.get(roomId) || zs[0]?.name || "", zones: zs });
  });
  return [...units, ...singles];
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
 *  代表ゾーン中心から「見る向きと反対側」へ少し引いた点（壁から離れて立って見る格好）。
 *  同じ向きの2本目（展開A'…）はさらに引いて重なりを避ける。 */
export function defaultElevationPos(elev: RoomElevation): { x: number; z: number } | null {
  const room = getElevationRoomById(elev.roomId);
  const r = room ? mainZoneOf(room)?.rect : null;
  if (!r) return null;
  const store = useRoomElevationsStore.getState();
  const sameDir = store.elevations.filter((e) => e.roomId === elev.roomId && e.dir === elev.dir);
  const i = Math.max(0, sameDir.findIndex((e) => e.id === elev.id));
  const d = (Math.min(r.width || 0, r.depth || 0) / 6) * (1 + 0.6 * i);
  // dir A=−Z を見る → 記号は +Z 側へ / B=+X → −X 側 / C=+Z → −Z 側 / D=−X → +X 側
  const off = { A: [0, d], B: [-d, 0], C: [0, -d], D: [d, 0] }[elev.dir];
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
    roomBox: computeRoomBoxFromRects(room.zones.map((z) => z.rect)),
    roomName: room.name || null,
  });
}
