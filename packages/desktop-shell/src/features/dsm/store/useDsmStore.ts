/**
 * useDsmStore — S.Movie v0 のドラフトシーケンス状態（docs/14 Step 2）
 *
 * v0 は UI なし（チャット駆動）のため、ここが事実上の「シーケンス」。
 * クリップはローカル mp4 への参照のみ持ち、書き出しは composeMovie() に委譲する。
 * Step 3 でカット（シーン参照 + カメラパス + renderJob）のフルモデルに置き換える。
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { writeTextFile, readTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ComposeClip, ComposeProgress, MovieBgm, MovieOverlay, MovieTransition } from '../types';
import { checkFfmpeg, composeMovie, probeVideo } from '../services/ffmpegService';

/** プロジェクト保存ファイル（.smovie.json）の形式 */
const DRAFT_FILE_VERSION = 1;
export interface DsmDraftFile {
  version: number;
  aspect: DsmAspect;
  fps: number;
  clips: DsmDraftClip[];
  overlays: MovieOverlay[];
  bgm: MovieBgm | null;
}

export interface DsmDraftClip extends ComposeClip {
  id: string;
  /** 表示用ラベル（チャットがカットを指す際の名前） */
  label?: string;
}

export type DsmAspect = '16:9' | '9:16';

interface DsmStoreState {
  clips: DsmDraftClip[];
  overlays: MovieOverlay[];
  bgm: MovieBgm | null;
  aspect: DsmAspect;
  fps: number;

  /** UI: インスペクタ対象のクリップ */
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;

  isExporting: boolean;
  exportProgress: ComposeProgress | null;
  lastOutputPath: string | null;
  lastError: string | null;

  /** 現在編集中プロジェクトの .smovie.json パス（未保存なら null） */
  projectPath: string | null;
  /** 最後に保存した時点からドラフトが変更されているか */
  isDirty: boolean;

  addClip: (clip: Omit<DsmDraftClip, 'id' | 'durationSec'> & { durationSec?: number }, position?: number) => string;
  removeClip: (id: string) => void;
  reorderClips: (order: string[]) => void;
  /** トリム・ラベル・尺などの部分更新 */
  updateClip: (id: string, patch: Partial<Pick<DsmDraftClip, 'trim' | 'label' | 'durationSec'>>) => void;
  setTransition: (clipId: string, transition: MovieTransition) => void;
  setBgm: (bgm: MovieBgm | null) => void;
  addOverlay: (overlay: MovieOverlay) => void;
  removeOverlay: (index: number) => void;
  setAspect: (aspect: DsmAspect) => void;
  clearDraft: () => void;

  /** ドラフトを .smovie.json に保存。path 省略時は保存ダイアログを開く。返り値=保存パス（キャンセル時 null） */
  saveDraft: (path?: string) => Promise<string | null>;
  /** .smovie.json を読み込んでドラフトに反映。path 省略時は開くダイアログ。返り値=成功可否 */
  loadDraftFromFile: (path?: string) => Promise<boolean>;

  /** ドラフトを mp4 に書き出す。outputPath 省略時は LocalAssets/Movies/ 配下 */
  exportDraft: (outputPath?: string) => Promise<string>;
}

const ASPECT_SIZE: Record<DsmAspect, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

let clipSeq = 0;
const nextClipId = () => `clip_${Date.now().toString(36)}_${++clipSeq}`;

async function defaultOutputPath(): Promise<string> {
  const root = await invoke<string>('get_ai_drive_path');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '_');
  return `${root}\\LocalAssets\\Movies\\SMovie_${stamp}.mp4`;
}

/** プロジェクト(.smovie.json)の既定保存ディレクトリ。無ければ作成する。 */
async function projectsDir(): Promise<string> {
  const root = await invoke<string>('get_ai_drive_path');
  const dir = `${root}\\LocalAssets\\Movies\\projects`;
  try { await mkdir(dir, { recursive: true }); } catch { /* 既存ならOK */ }
  return dir;
}

export const useDsmStore = create<DsmStoreState>((set, get) => ({
  clips: [],
  overlays: [],
  bgm: null,
  aspect: '16:9',
  fps: 30,

  isExporting: false,
  exportProgress: null,
  lastOutputPath: null,
  lastError: null,

  projectPath: null,
  isDirty: false,

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  addClip: (clip, position) => {
    const id = nextClipId();
    const draft: DsmDraftClip = { durationSec: 0, ...clip, id };
    set((s) => {
      const clips = [...s.clips];
      const idx = position == null ? clips.length : Math.max(0, Math.min(position, clips.length));
      clips.splice(idx, 0, draft);
      return { clips, selectedClipId: id, isDirty: true };
    });
    return id;
  },

  removeClip: (id) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      isDirty: true,
    })),

  updateClip: (id, patch) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)), isDirty: true })),

  reorderClips: (order) =>
    set((s) => {
      const byId = new Map(s.clips.map((c) => [c.id, c]));
      const reordered = order.map((id) => byId.get(id)).filter((c): c is DsmDraftClip => !!c);
      // order に含まれないクリップは末尾に残す（チャットの部分指定を許容）
      const rest = s.clips.filter((c) => !order.includes(c.id));
      return { clips: [...reordered, ...rest], isDirty: true };
    }),

  setTransition: (clipId, transition) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === clipId ? { ...c, transitionAfter: transition } : c)),
      isDirty: true,
    })),

  setBgm: (bgm) => set({ bgm, isDirty: true }),
  addOverlay: (overlay) => set((s) => ({ overlays: [...s.overlays, overlay], isDirty: true })),
  removeOverlay: (index) =>
    set((s) => ({ overlays: s.overlays.filter((_, i) => i !== index), isDirty: true })),
  setAspect: (aspect) => set({ aspect, isDirty: true }),

  clearDraft: () =>
    set({ clips: [], overlays: [], bgm: null, selectedClipId: null, exportProgress: null, lastError: null,
      projectPath: null, isDirty: false }),

  saveDraft: async (path) => {
    const { clips, overlays, bgm, aspect, fps, projectPath } = get();
    if (clips.length === 0) throw new Error('保存するシーケンスがありません');
    let target = path ?? projectPath ?? null;
    if (!target) {
      const dir = await projectsDir();
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '_');
      target = await saveDialog({
        title: 'S.Movie プロジェクトを保存',
        defaultPath: `${dir}\\SMovie_${stamp}.smovie.json`,
        filters: [{ name: 'S.Movie Project', extensions: ['smovie.json', 'json'] }],
      });
      if (!target) return null; // キャンセル
    }
    const data: DsmDraftFile = { version: DRAFT_FILE_VERSION, aspect, fps, clips, overlays, bgm };
    await writeTextFile(target, JSON.stringify(data, null, 2));
    set({ projectPath: target, isDirty: false });
    return target;
  },

  loadDraftFromFile: async (path) => {
    let target = path ?? null;
    if (!target) {
      const dir = await projectsDir();
      const picked = await openDialog({
        title: 'S.Movie プロジェクトを開く',
        defaultPath: dir,
        multiple: false,
        directory: false,
        filters: [{ name: 'S.Movie Project', extensions: ['smovie.json', 'json'] }],
      });
      if (!picked || Array.isArray(picked)) return false;
      target = picked;
    }
    try {
      const raw = await readTextFile(target);
      const data = JSON.parse(raw) as DsmDraftFile;
      if (!data || !Array.isArray(data.clips)) throw new Error('不正なプロジェクトファイルです');
      set({
        clips: data.clips,
        overlays: Array.isArray(data.overlays) ? data.overlays : [],
        bgm: data.bgm ?? null,
        aspect: data.aspect === '9:16' ? '9:16' : '16:9',
        fps: typeof data.fps === 'number' && data.fps > 0 ? data.fps : 30,
        selectedClipId: null,
        projectPath: target,
        isDirty: false,
        lastError: null,
        exportProgress: null,
      });
      return true;
    } catch (err) {
      set({ lastError: `プロジェクト読み込み失敗: ${String(err)}` });
      return false;
    }
  },

  exportDraft: async (outputPath) => {
    const { clips, overlays, bgm, aspect, fps } = get();
    if (clips.length === 0) throw new Error('シーケンスにクリップがありません');
    set({ isExporting: true, exportProgress: null, lastError: null });
    try {
      const info = await checkFfmpeg();
      // 尺未取得のクリップを probe で解決
      const resolved = await Promise.all(
        clips.map(async (c) =>
          c.durationSec > 0
            ? c
            : { ...c, durationSec: (await probeVideo(info.path, c.path)).durationSec },
        ),
      );
      set({ clips: resolved });

      const out = outputPath ?? (await defaultOutputPath());
      const { width, height } = ASPECT_SIZE[aspect];
      const result = await composeMovie(
        {
          clips: resolved,
          overlays,
          bgm: bgm ?? undefined,
          output: { path: out, width, height, fps },
        },
        (p) => set({ exportProgress: p }),
      );
      set({ lastOutputPath: result, isExporting: false });
      return result;
    } catch (err) {
      set({ lastError: String(err), isExporting: false });
      throw err;
    }
  },
}));
