import { create } from 'zustand';

export interface ShotCamera {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

// kind: 自動パース生成(still) と 自動動画生成(movie) でアングルを分けて管理する
export type ShotKind = 'still' | 'movie';

// アングルセット：部屋・外観/内観などで Shot をグルーピングする単位（still/movie 共通）。
// shotIds で所属アングルを参照する（1つのアングルを複数セットに入れられる多対多）。
export interface AngleSet {
  id: string;
  name: string;
  shotIds: string[];
  createdAt: number;
}

// 動画モードの per-アングル カメラモーション（自動アングル生成で前後考慮して自動割当）。
// preset は cameraPaths.ts の CameraPathPreset（循環回避のため string で保持）。
export interface ShotMotion {
  preset: string;       // 'orbit' | 'pushIn' | 'pullBack' | ...
  intensity: number;    // 0.4..1.6
  durationSec: number;  // このアングル(クリップ)の尺
}

// 立面/平面の断面状態（断面ビュー = 縦切り）。ビュー再現時に断面クリップへ適用する。
export interface ShotSection {
  axis: 'x' | 'z';   // x=側面(Right) / z=正面(Front) の垂直断面
  pos: number;       // 切断位置（Three.js world units）
}

export interface Shot {
  id: string;
  name: string;
  thumbnail: string | null;
  camera: ShotCamera;
  createdAt: number;
  kind?: ShotKind;
  // 整理用メタ（アングル整理ダイアログで付与）。後から「どれが良いか」を探せるように。
  category?: string;   // プリセットカテゴリ（内観/外観/俯瞰/ディテール/全景/ロー/その他/断面 等）
  tags?: string[];     // 自由タグ
  // 動画用: このアングルのカメラの動き（movie の自動アングル生成で自動設定）。
  movieMotion?: ShotMotion;
  // 断面ビュー用：縦切りの軸と位置。あればビュー切替時に断面クリップを適用する。
  section?: ShotSection | null;
}

// 整理ダイアログのカテゴリ・プリセット。これ以外に自由タグで補完する。
export const PERSPECTIVE_CATEGORIES = ['内観', '外観', '俯瞰', 'ディテール', '全景', 'ロー', 'その他'] as const;

// 自動生成アングルの構図名からカテゴリの初期値を推定する（生成時の自動プリセット）。
export function categoryFromAngleName(name: string): string {
  const s = name || '';
  if (s.includes('俯瞰')) return '俯瞰';
  if (s.includes('ディテール')) return 'ディテール';
  if (s.includes('ワイド') || s.includes('全景')) return '全景';
  if (s.includes('ロー')) return 'ロー';
  if (s.includes('外観')) return '外観';
  return '内観'; // 二点/一点透視など室内構図
}

interface ShotStore {
  shots: Shot[];
  activeShotId: string | null; // 現在フォーカス中のアングル（右サイドバーの個別設定に使用）
  sets: AngleSet[];
  activeSetId: string | null; // null = 未分類（どのセットにも属さないアングル）
  addShot: (camera: ShotCamera, thumbnail: string | null, kind?: ShotKind, meta?: { name?: string; category?: string; tags?: string[]; movieMotion?: ShotMotion; section?: ShotSection | null }) => string;
  removeShot: (id: string) => void;
  renameShot: (id: string, name: string) => void;
  updateThumbnail: (id: string, thumbnail: string) => void;
  updateShot: (id: string, patch: Partial<Pick<Shot, 'thumbnail' | 'camera' | 'name' | 'category' | 'tags' | 'section'>>) => void;
  setActiveShotId: (id: string | null) => void;
  // 整理（カテゴリ・タグ）
  setShotCategory: (id: string, category: string) => void;
  addShotTag: (id: string, tag: string) => void;
  removeShotTag: (id: string, tag: string) => void;
  // 動画モーション（per-アングル）
  setShotMotion: (id: string, motion: Partial<ShotMotion>) => void;
  // 永続化からの復元（shots / sets を丸ごと差し替え）。
  replaceAll: (data: { shots: Shot[]; sets: AngleSet[] }) => void;
  // アングルセット
  addSet: (name?: string) => string;
  renameSet: (id: string, name: string) => void;
  removeSet: (id: string) => void;
  setActiveSetId: (id: string | null) => void;
  toggleShotInSet: (setId: string, shotId: string) => void;
}

export const useShotStore = create<ShotStore>((set, get) => ({
  shots: [],
  activeShotId: null,
  sets: [],
  activeSetId: null,

  addShot: (camera, thumbnail, kind, meta) => {
    const id = crypto.randomUUID();
    const index = get().shots.filter((sh) => (sh.kind ?? 'still') === (kind ?? 'still')).length + 1;
    set((s) => {
      const activeSetId = s.activeSetId;
      const sets = activeSetId
        ? s.sets.map((g) => (g.id === activeSetId ? { ...g, shotIds: [...g.shotIds, id] } : g))
        : s.sets;
      return {
        shots: [...s.shots, {
          id,
          name: meta?.name || `Shot ${index}`,
          thumbnail, camera, createdAt: Date.now(), kind,
          category: meta?.category,
          tags: meta?.tags,
          movieMotion: meta?.movieMotion,
          section: meta?.section ?? null,
        }],
        activeShotId: id,
        sets,
      };
    });
    return id;
  },

  removeShot: (id) =>
    set((s) => ({
      shots: s.shots.filter((sh) => sh.id !== id),
      sets: s.sets.map((g) => ({ ...g, shotIds: g.shotIds.filter((x) => x !== id) })),
      activeShotId: s.activeShotId === id ? null : s.activeShotId,
    })),

  renameShot: (id, name) =>
    set((s) => ({ shots: s.shots.map((sh) => (sh.id === id ? { ...sh, name } : sh)) })),

  updateThumbnail: (id, thumbnail) =>
    set((s) => ({ shots: s.shots.map((sh) => (sh.id === id ? { ...sh, thumbnail } : sh)) })),

  updateShot: (id, patch) =>
    set((s) => ({ shots: s.shots.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)) })),

  setActiveShotId: (id) => set({ activeShotId: id }),

  // ── 整理（カテゴリ・タグ）──
  setShotCategory: (id, category) =>
    set((s) => ({ shots: s.shots.map((sh) => (sh.id === id ? { ...sh, category } : sh)) })),

  addShotTag: (id, tag) =>
    set((s) => ({
      shots: s.shots.map((sh) => {
        if (sh.id !== id) return sh;
        const t = (tag || '').trim();
        if (!t) return sh;
        const tags = sh.tags ?? [];
        return tags.includes(t) ? sh : { ...sh, tags: [...tags, t] };
      }),
    })),

  removeShotTag: (id, tag) =>
    set((s) => ({
      shots: s.shots.map((sh) => (sh.id === id ? { ...sh, tags: (sh.tags ?? []).filter((x) => x !== tag) } : sh)),
    })),

  setShotMotion: (id, motion) =>
    set((s) => ({
      shots: s.shots.map((sh) => {
        if (sh.id !== id) return sh;
        const base = sh.movieMotion ?? { preset: 'pushIn', intensity: 1.0, durationSec: 4 };
        return { ...sh, movieMotion: { ...base, ...motion } };
      }),
    })),

  replaceAll: (data) =>
    set({
      shots: Array.isArray(data?.shots) ? data.shots : [],
      sets: Array.isArray(data?.sets) ? data.sets : [],
      activeShotId: null,
      activeSetId: null,
    }),

  // ── アングルセット ──
  addSet: (name) => {
    const id = crypto.randomUUID();
    set((s) => {
      const n = s.sets.length + 1;
      const setName = (name && name.trim()) || `セット ${n}`;
      return {
        sets: [...s.sets, { id, name: setName, shotIds: [], createdAt: Date.now() }],
        activeSetId: id, // 作成したセットをアクティブにする
      };
    });
    return id;
  },

  renameSet: (id, name) =>
    set((s) => ({ sets: s.sets.map((g) => (g.id === id ? { ...g, name } : g)) })),

  // セット削除：アングル自体は pool に残す（他セットに属さなければ未分類になる）
  removeSet: (id) =>
    set((s) => ({
      sets: s.sets.filter((g) => g.id !== id),
      activeSetId: s.activeSetId === id ? null : s.activeSetId,
    })),

  setActiveSetId: (id) => set({ activeSetId: id }),

  toggleShotInSet: (setId, shotId) =>
    set((s) => ({
      sets: s.sets.map((g) =>
        g.id === setId
          ? { ...g, shotIds: g.shotIds.includes(shotId) ? g.shotIds.filter((x) => x !== shotId) : [...g.shotIds, shotId] }
          : g,
      ),
    })),
}));

// ── セレクタ補助 ──
// あるセット（null=未分類）に属する、指定 kind のアングルを順序付きで返す。
export function shotsOfSet(shots: Shot[], sets: AngleSet[], setId: string | null, kind: ShotKind): Shot[] {
  if (setId == null) {
    const assigned = new Set(sets.flatMap((g) => g.shotIds));
    return shots.filter((sh) => (sh.kind ?? 'still') === kind && !assigned.has(sh.id));
  }
  const grp = sets.find((g) => g.id === setId);
  if (!grp) return [];
  return grp.shotIds
    .map((id) => shots.find((sh) => sh.id === id))
    .filter((sh): sh is Shot => !!sh && (sh.kind ?? 'still') === kind);
}
