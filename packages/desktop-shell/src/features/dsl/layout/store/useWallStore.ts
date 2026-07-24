// useWallStore — S.Layout で作図する壁（内壁／外壁）。
//   保存先は Base ドキュメントの spaceProgram.walls（ゾーンと同じ扱い＝全 Plan/Option 共通）。
//   永続化は LayoutShell が window イベント "LayoutShell:UpdateWalls" を受けて updateDoc する。
//   ここは「描画ツールの状態」＋「壁配列のメモリ上のミラー」を持つ。
import { create } from "zustand";

export type WallKind = "exterior" | "interior";

/** 壁に開ける開口部（ドア／窓）。位置は壁始点から開口「中心」までの距離(mm)。 */
export type OpeningType = "door" | "window";
export interface WallOpening {
  id: string;
  type: OpeningType;
  offsetMm: number;  // 壁始点 → 開口中心
  widthMm: number;
  heightMm: number;
  sillMm: number;    // 床からの下端（ドア=0 / 窓=腰高）
}

/** 開口部の既定寸法（mm） */
export const OPENING_DEFAULTS: Record<OpeningType, { widthMm: number; heightMm: number; sillMm: number }> = {
  door: { widthMm: 800, heightMm: 2000, sillMm: 0 },
  window: { widthMm: 1200, heightMm: 1100, sillMm: 900 },
};

export const OPENING_TYPE_LABEL: Record<OpeningType, string> = {
  door: "ドア",
  window: "窓",
};

export interface Wall {
  id: string;
  kind: WallKind;
  /** 壁芯の始点・終点（world mm / XZ 平面） */
  start: { x: number; z: number };
  end: { x: number; z: number };
  /** 壁厚(mm)。既定は 外壁200 / 内壁100。 */
  thicknessMm: number;
  /** 高さ(mm)。null = 既定（外壁=階高 / 内壁=CL）に従う。 */
  heightMm: number | null;
  /**
   * その階の床レベル(FL)からの上下オフセット(mm)。+ で上、− で下。
   * 未設定/0 なら FL に立つ（従来どおり）。浮き壁・下がり壁に使う。
   * 断面ビューのギズモを上下にドラッグするとここが変わる。
   */
  offsetYMm?: number;
  /**
   * どの階の壁か（0=1F）。未設定は 1F 扱い（既存データはそのまま使える）。
   * 作図した時点のアクティブ階が入り、以後その階の FL に建つ（階を切替えても動かない）。
   */
  floorIndex?: number;
  /** 開口部（ドア／窓）。無い場合は undefined/[]。 */
  openings?: WallOpening[];
}

/** 壁厚の既定値（mm） */
export const WALL_DEFAULT_THICKNESS: Record<WallKind, number> = {
  exterior: 200,
  interior: 100,
};

export const WALL_KIND_LABEL: Record<WallKind, string> = {
  exterior: "外壁",
  interior: "内壁",
};

/** 作図の最小長さ(mm)。これ未満のドラッグは無視する。 */
export const WALL_MIN_LENGTH = 300;

let _seq = 0;
const nextId = () => `wall_${Date.now().toString(36)}_${_seq++}`;

export function makeWall(
  kind: WallKind,
  start: { x: number; z: number },
  end: { x: number; z: number },
  floorIndex = 0,
): Wall {
  return {
    id: nextId(),
    kind,
    start: { x: Math.round(start.x), z: Math.round(start.z) },
    end: { x: Math.round(end.x), z: Math.round(end.z) },
    thicknessMm: WALL_DEFAULT_THICKNESS[kind],
    heightMm: null,
    floorIndex,
  };
}

/** 壁の長さ(mm) */
export function wallLength(w: Wall): number {
  return Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
}

/**
 * 自動レイアウトの障害物形式へ変換する。
 * autoLayoutService は「transform.position(mm) ＋ dimensionsMm.width/depth」の AABB を
 * solid 障害物として使うため、壁を ~300mm のチャンク箱に分割して渡す（斜め壁も AABB 近似できる）。
 * ドア開口のチャンクは除外し、自動レイアウトが出入口を塞がないようにする（窓は solid のまま）。
 */
export function wallsToObstacles(walls: Wall[]): any[] {
  const out: any[] = [];
  const CHUNK = 300;
  for (const w of walls) {
    const dx = w.end.x - w.start.x;
    const dz = w.end.z - w.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;
    const ux = dx / len;
    const uz = dz / len;
    const t = w.thicknessMm || 100;
    const doorSpans = (w.openings || [])
      .filter((o) => o.type === "door")
      .map((o) => [o.offsetMm - o.widthMm / 2, o.offsetMm + o.widthMm / 2] as const);

    const n = Math.max(1, Math.ceil(len / CHUNK));
    for (let i = 0; i < n; i++) {
      const a = (i * len) / n;
      const b = ((i + 1) * len) / n;
      const mid = (a + b) / 2;
      if (doorSpans.some(([da, db]) => mid >= da && mid <= db)) continue; // ドアは通行可
      const cx = w.start.x + ux * mid;
      const cz = w.start.z + uz * mid;
      const seg = b - a;
      out.push({
        id: `wallobs_${w.id}_${i}`,
        category: "wall",
        title: "壁",
        transform: { position: [cx, 0, cz] },
        dimensionsMm: {
          width: Math.abs(ux) * seg + Math.abs(uz) * t,
          depth: Math.abs(uz) * seg + Math.abs(ux) * t,
        },
      });
    }
  }
  return out;
}

interface WallState {
  /** 壁一覧（Base の spaceProgram.walls のミラー） */
  walls: Wall[];
  /** 作図中のツール。null = 通常（選択）モード。 */
  drawKind: WallKind | null;
  /** ドラッグ中のプレビュー線分（world mm）。null = 非ドラッグ。 */
  draftLine: { start: { x: number; z: number }; end: { x: number; z: number } } | null;
  /** 主選択（最後にクリックした壁）。Properties の単体編集対象。 */
  selectedWallId: string | null;
  /** 複数選択（Ctrl/Shift+クリックで追加）。Delete・種別一括変更の対象。 */
  selectedWallIds: string[];

  setWalls: (walls: Wall[]) => void;
  setDrawKind: (kind: WallKind | null) => void;
  toggleDrawKind: (kind: WallKind) => void;
  setDraftLine: (line: WallState["draftLine"]) => void;
  setSelectedWallId: (id: string | null) => void;
  /** 範囲選択（マーキー）用: 選択セットをまとめて置換。主選択は先頭。 */
  setSelectedWallIds: (ids: string[]) => void;
  /** Ctrl/Shift+クリック用: 選択セットへトグル追加/除去。 */
  toggleWallSelection: (id: string) => void;
  /** 複数の壁をまとめて削除（保存は1回）。 */
  removeWalls: (ids: string[]) => void;
  /** 複数の壁の種別を一括変更（既定厚のままの壁は新種別の既定厚へ追従）。 */
  setWallsKind: (ids: string[], kind: WallKind) => void;

  addWall: (wall: Wall) => void;
  /** 複数の壁をまとめて追加（保存は1回）。既存壁と同一端点の壁はスキップする。 */
  addWalls: (walls: Wall[]) => void;
  updateWall: (id: string, patch: Partial<Omit<Wall, "id">>) => void;
  /** ドラッグ中の高频度更新用（永続化しない）。確定時に persistWalls() を呼ぶ。 */
  updateWallLocal: (id: string, patch: Partial<Omit<Wall, "id">>) => void;
  /** 現在の walls を Base へ永続化（updateWallLocal の確定用）。 */
  persistWalls: () => void;
  removeWall: (id: string) => void;

  addOpening: (wallId: string, type: OpeningType) => void;
  updateOpening: (wallId: string, openingId: string, patch: Partial<Omit<WallOpening, "id">>) => void;
  removeOpening: (wallId: string, openingId: string) => void;
}

/**
 * 階高 / CL を変える「直前」に呼ぶ。上下オフセットが付いた壁（＝床から立ち上がっていない
 * 浮き壁・下がり壁）は「その階の全高」ではないので、既定（外壁=階高 / 内壁=CL）への追従から
 * 外し、変更前の高さを実値として焼き付ける。
 *   断面ビューで階高の寸法をドラッグすると、部分壁まで一緒に伸び縮みしてしまうため。
 *   床に立つ通常の壁（オフセット無し）は建物の階高と一体なので、従来どおり追従させる。
 * 追従に戻したいときは、壁プロパティの「高さ」を既定に戻す（⟲）と null に戻る。
 * @param prev 変更前の既定値（外壁に使う階高 / 内壁に使う CL）
 */
export function pinOffsetWallHeights(prev: { floorHeightMm: number; ceilingHeightMm: number }) {
  const st = useWallStore.getState();
  let changed = false;
  const walls = st.walls.map((w) => {
    if (w.heightMm != null) return w;  // 既に実値なら影響を受けない
    if (!w.offsetYMm) return w;        // 床に立つ壁は階高/CL に追従したまま
    changed = true;
    return { ...w, heightMm: w.kind === "exterior" ? prev.floorHeightMm : prev.ceilingHeightMm };
  });
  if (!changed) return;
  useWallStore.setState({ walls });
  persist(walls);
}

/** 壁配列の変更を Base へ永続化（LayoutShell が購読）。 */
function persist(walls: Wall[]) {
  try {
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateWalls", { detail: { walls } }));
  } catch {
    /* noop */
  }
}

export const useWallStore = create<WallState>((set, get) => ({
  walls: [],
  drawKind: null,
  draftLine: null,
  selectedWallId: null,
  selectedWallIds: [],

  // Base からのロード（永続化は起こさない）
  setWalls: (walls) => set({ walls: Array.isArray(walls) ? walls : [] }),

  setDrawKind: (drawKind) => set({ drawKind, draftLine: null }),
  toggleDrawKind: (kind) =>
    set((s) => ({ drawKind: s.drawKind === kind ? null : kind, draftLine: null })),
  setDraftLine: (draftLine) => set({ draftLine }),
  setSelectedWallId: (selectedWallId) =>
    set({ selectedWallId, selectedWallIds: selectedWallId ? [selectedWallId] : [] }),

  setSelectedWallIds: (ids) =>
    set({
      selectedWallIds: Array.isArray(ids) ? ids : [],
      selectedWallId: (Array.isArray(ids) && ids[0]) || null,
    }),

  toggleWallSelection: (id) =>
    set((s) => {
      const has = s.selectedWallIds.includes(id);
      const selectedWallIds = has
        ? s.selectedWallIds.filter((x) => x !== id)
        : [...s.selectedWallIds, id];
      return {
        selectedWallIds,
        selectedWallId: has
          ? (s.selectedWallId === id ? selectedWallIds[selectedWallIds.length - 1] ?? null : s.selectedWallId)
          : id,
      };
    }),

  removeWalls: (ids) =>
    set((s) => {
      if (!ids.length) return {};
      const idSet = new Set(ids);
      const walls = s.walls.filter((w) => !idSet.has(w.id));
      persist(walls);
      return {
        walls,
        selectedWallId: s.selectedWallId && idSet.has(s.selectedWallId) ? null : s.selectedWallId,
        selectedWallIds: s.selectedWallIds.filter((x) => !idSet.has(x)),
      };
    }),

  setWallsKind: (ids, kind) =>
    set((s) => {
      const idSet = new Set(ids);
      const walls = s.walls.map((w) => {
        if (!idSet.has(w.id) || w.kind === kind) return w;
        const patch: Partial<Wall> = { kind };
        if (w.thicknessMm === WALL_DEFAULT_THICKNESS[w.kind]) patch.thicknessMm = WALL_DEFAULT_THICKNESS[kind];
        return { ...w, ...patch };
      });
      persist(walls);
      return { walls };
    }),

  // 追加そのものは選択を変えない。ポリライン作図は1区間ごとに addWall を呼ぶため、
  // ここで選択すると「確定した区間が次々と選択色になる」ちらつきが出る。
  // 作図の終了時（右クリック＝Enter）に WallDrawController が最後の壁を選択する。
  addWall: (wall) =>
    set((s) => {
      const walls = [...s.walls, wall];
      persist(walls);
      return { walls };
    }),

  addWalls: (newWalls) =>
    set((s) => {
      // 同一端点（向き違いも同一とみなす）の既存壁はスキップ（二度押し対策）
      const samePt = (a: { x: number; z: number }, b: { x: number; z: number }) =>
        Math.abs(a.x - b.x) <= 1 && Math.abs(a.z - b.z) <= 1;
      const exists = (w: Wall) =>
        s.walls.some(
          (o) =>
            (samePt(o.start, w.start) && samePt(o.end, w.end)) ||
            (samePt(o.start, w.end) && samePt(o.end, w.start)),
        );
      const added = newWalls.filter((w) => !exists(w));
      if (!added.length) return {};
      const walls = [...s.walls, ...added];
      persist(walls);
      return { walls };
    }),

  updateWall: (id, patch) =>
    set((s) => {
      const walls = s.walls.map((w) => (w.id === id ? { ...w, ...patch } : w));
      persist(walls);
      return { walls };
    }),

  updateWallLocal: (id, patch) =>
    set((s) => ({ walls: s.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),

  persistWalls: () => persist(get().walls),

  removeWall: (id) =>
    set((s) => {
      const walls = s.walls.filter((w) => w.id !== id);
      persist(walls);
      return {
        walls,
        selectedWallId: s.selectedWallId === id ? null : s.selectedWallId,
        selectedWallIds: s.selectedWallIds.filter((x) => x !== id),
      };
    }),

  addOpening: (wallId, type) =>
    set((s) => {
      const walls = s.walls.map((w) => {
        if (w.id !== wallId) return w;
        const len = wallLength(w);
        const d = OPENING_DEFAULTS[type];
        const width = Math.min(d.widthMm, Math.max(100, len - 100));
        const opening: WallOpening = {
          id: `op_${Date.now().toString(36)}_${_seq++}`,
          type,
          offsetMm: Math.round(len / 2),
          widthMm: width,
          heightMm: d.heightMm,
          sillMm: d.sillMm,
        };
        return { ...w, openings: [...(w.openings || []), opening] };
      });
      persist(walls);
      return { walls };
    }),

  updateOpening: (wallId, openingId, patch) =>
    set((s) => {
      const walls = s.walls.map((w) =>
        w.id !== wallId
          ? w
          : { ...w, openings: (w.openings || []).map((o) => (o.id === openingId ? { ...o, ...patch } : o)) },
      );
      persist(walls);
      return { walls };
    }),

  removeOpening: (wallId, openingId) =>
    set((s) => {
      const walls = s.walls.map((w) =>
        w.id !== wallId ? w : { ...w, openings: (w.openings || []).filter((o) => o.id !== openingId) },
      );
      persist(walls);
      return { walls };
    }),
}));
