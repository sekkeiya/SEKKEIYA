// useRoomElevationsStore — 「部屋（ゾーン）ごとの展開図」ドキュメントデータ。
//
// 役割の分担:
//   - このストア = 何を作ったか（部屋ごとの展開 A/B/… と、展開ごとの記号位置）＝ドキュメント
//   - useElevationMarkerStore = いま何を見ているか（表示中の展開・範囲）＝ビュー状態
//
// 1展開 = 1記号。部屋には既定で 展開A（上）/B（右）/C（下）/D（左）の4本が作られ、
// 「追加」すると同じ向きの2本目が 展開A' のようにプライム付きで増える。
// 向きは名前の基底文字（A/B/C/D）で決まり、後から選び直す UI は持たない。
import { create } from "zustand";
import type { ElevationDir } from "./useElevationMarkerStore";

export interface RoomElevation {
  id: string;
  roomId: string;    // ZoneNode.id
  name: string;      // "展開A" / "展開A'" など
  dir: ElevationDir; // 見る向き（A=上 / B=右 / C=下 / D=左）。名前の基底文字と一致
  createdAtMs: number;
}

interface RoomElevationsState {
  elevations: RoomElevation[];
  /** 記号位置（world XZ）。キーは展開 id。未設定はゾーン中心からの既定位置を使う。 */
  markerPos: Record<string, { x: number; z: number }>;
  /** 既定4本を作成済みの部屋（全削除した部屋に勝手に生やし直さないためのフラグ）。 */
  initializedRooms: Record<string, true>;
  /** 平面図で展開記号をクリックして選択中の部屋（Properties の対象）。 */
  selectedRoomId: string | null;
  /** いま開いている展開。平面図の記号ハイライトに使う。 */
  activeElevationId: string | null;

  /** 部屋に既定の 展開A〜D を用意する（初回のみ。ユーザーが消したら復活させない）。 */
  ensureRoomDefaults: (roomId: string) => void;
  /** 展開を1本追加（向きは本数が最少の向き、名前は 展開A' 形式で採番）。 */
  addElevation: (roomId: string) => RoomElevation;
  removeElevation: (id: string) => void;
  renameElevation: (id: string, name: string) => void;
  setMarkerPos: (elevationId: string, pos: { x: number; z: number }) => void;
  selectRoom: (roomId: string | null) => void;
  setActiveElevation: (id: string | null) => void;
  /** 部屋が消えたときの掃除（ゾーン削除に追従）。 */
  pruneRooms: (existingRoomIds: string[]) => void;
}

let _seq = 0;
const nextId = () => `el_${Date.now().toString(36)}_${_seq++}`;

const DIR_ORDER: ElevationDir[] = ["A", "B", "C", "D"];

/** 向き dir の n 本目（0始まり）の名前: 展開A → 展開A' → 展開A'' … */
const nameFor = (dir: ElevationDir, index: number) => `展開${dir}${"'".repeat(index)}`;

const makeElevation = (roomId: string, dir: ElevationDir, sameDirCount: number): RoomElevation => ({
  id: nextId(),
  roomId,
  name: nameFor(dir, sameDirCount),
  dir,
  createdAtMs: Date.now(),
});

export const useRoomElevationsStore = create<RoomElevationsState>((set, get) => ({
  elevations: [],
  markerPos: {},
  initializedRooms: {},
  selectedRoomId: null,
  activeElevationId: null,

  ensureRoomDefaults: (roomId) => {
    const s = get();
    if (s.initializedRooms[roomId]) return;
    // 既に何か作られている部屋（旧データ等）は既定を足さず、フラグだけ立てる
    const mine = s.elevations.filter((e) => e.roomId === roomId);
    const defaults = mine.length ? [] : DIR_ORDER.map((d) => makeElevation(roomId, d, 0));
    set((st) => ({
      elevations: [...st.elevations, ...defaults],
      initializedRooms: { ...st.initializedRooms, [roomId]: true },
    }));
  },

  addElevation: (roomId) => {
    const mine = get().elevations.filter((e) => e.roomId === roomId);
    // 本数が最少の向きに足す（A→B→C→D の順で同数タイブレーク）
    const counts = DIR_ORDER.map((d) => mine.filter((e) => e.dir === d).length);
    const dir = DIR_ORDER[counts.indexOf(Math.min(...counts))];
    const el = makeElevation(roomId, dir, counts[DIR_ORDER.indexOf(dir)]);
    set((s) => ({ elevations: [...s.elevations, el] }));
    return el;
  },

  removeElevation: (id) =>
    set((s) => {
      const markerPos = { ...s.markerPos };
      delete markerPos[id];
      return {
        elevations: s.elevations.filter((e) => e.id !== id),
        markerPos,
        activeElevationId: s.activeElevationId === id ? null : s.activeElevationId,
      };
    }),

  renameElevation: (id, name) =>
    set((s) => ({ elevations: s.elevations.map((e) => (e.id === id ? { ...e, name } : e)) })),

  setMarkerPos: (elevationId, pos) =>
    set((s) => ({ markerPos: { ...s.markerPos, [elevationId]: pos } })),

  selectRoom: (selectedRoomId) => set({ selectedRoomId }),

  setActiveElevation: (activeElevationId) => set({ activeElevationId }),

  pruneRooms: (existingRoomIds) =>
    set((s) => {
      const alive = new Set(existingRoomIds);
      const removedIds = new Set(s.elevations.filter((e) => !alive.has(e.roomId)).map((e) => e.id));
      const staleInit = Object.keys(s.initializedRooms).some((k) => !alive.has(k));
      if (!removedIds.size && !staleInit && (!s.selectedRoomId || alive.has(s.selectedRoomId))) {
        return {} as any;
      }
      const markerPos: Record<string, { x: number; z: number }> = {};
      Object.entries(s.markerPos).forEach(([k, v]) => { if (!removedIds.has(k)) markerPos[k] = v; });
      const initializedRooms: Record<string, true> = {};
      Object.keys(s.initializedRooms).forEach((k) => { if (alive.has(k)) initializedRooms[k] = true; });
      return {
        elevations: s.elevations.filter((e) => !removedIds.has(e.id)),
        markerPos,
        initializedRooms,
        selectedRoomId: s.selectedRoomId && alive.has(s.selectedRoomId) ? s.selectedRoomId : null,
        activeElevationId:
          s.activeElevationId && removedIds.has(s.activeElevationId) ? null : s.activeElevationId,
      };
    }),
}));
