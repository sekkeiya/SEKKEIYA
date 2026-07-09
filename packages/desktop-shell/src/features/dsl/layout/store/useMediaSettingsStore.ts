/**
 * useMediaSettingsStore
 *
 * Media（静止画/動画生成）の設定とShot選択を保持する共有ストア。
 * ボトムの MediaPanel と右サイドバーの MediaSettingsPanel の両方から
 * 読み書きされ、常に同期する。カメラパスの組み立て・ビューポート
 * プレビューの開始/停止もここに集約する。
 */
import { create } from 'zustand';

import { buildCameraPath, buildSequencePath, type CameraPath, type CameraPathPreset } from '../services/cameraPaths';
import { computeSequenceMotions } from '../services/autoCameraAngles';
import { startCameraPathPreview, stopCameraPathPreview } from '../services/cameraPathPreview';
import { useShotStore, type Shot } from './useShotStore';

export type VideoMode = 'fast' | 'quality' | 'cycles';
export type StillQuality = 'standard' | 'cycles';

export interface SelectedPathBuild {
  targets: Shot[];
  cameraPath: CameraPath;
}

type BuildResult =
  | { ok: true; value: SelectedPathBuild }
  | { ok: false; error: string };

interface MediaSettingsStore {
  /** ボトムの Media パネルが開いているか（LayoutShell が同期）。右サイドバーの表示判定に使う */
  mediaDockOpen: boolean;

  /** Shot カードの選択状態（MediaPanel/サイドバー共用） */
  selectedShotIds: string[];

  /** 静止画の品質 */
  stillQuality: StillQuality;

  /** 動画の品質モード: fast=L1(影なし) / quality=L2(影+SSAA) / cycles=Blender */
  videoMode: VideoMode;
  /** カメラワークのプリセット */
  videoPreset: CameraPathPreset;
  /** 動画の長さ（秒） */
  videoDuration: number;
  /** カメラ移動量のスケール（0.4=控えめ 〜 1.6=ダイナミック） */
  videoIntensity: number;

  /** ビューポートでカメラパスをプレビュー再生中か */
  previewPlaying: boolean;

  setMediaDockOpen: (open: boolean) => void;
  setSelectedShotIds: (v: string[] | ((prev: string[]) => string[])) => void;
  toggleShotSelected: (id: string) => void;
  setStillQuality: (q: StillQuality) => void;
  setVideoMode: (m: VideoMode) => void;
  setVideoPreset: (p: CameraPathPreset) => void;
  setVideoDuration: (d: number) => void;
  setVideoIntensity: (i: number) => void;

  /** 選択 Shot + 現在の設定からカメラパスを組み立てる（プレビュー/生成で共用） */
  buildSelectedPath: () => BuildResult;
  /** プリセットを選択して即プレビュー再生。失敗時はエラーメッセージを返す（成功時 null） */
  selectPresetAndPreview: (p: CameraPathPreset) => string | null;
  /** プレビューをトグル。失敗時はエラーメッセージを返す（成功時 null） */
  togglePreview: () => string | null;
  /** プレビューを停止してカメラを復元 */
  stopPreview: () => void;
}

export const useMediaSettingsStore = create<MediaSettingsStore>((set, get) => ({
  mediaDockOpen: false,
  selectedShotIds: [],
  stillQuality: 'standard',
  videoMode: 'fast',
  videoPreset: 'pushIn' as CameraPathPreset,
  videoDuration: 6,
  videoIntensity: 1.0,
  previewPlaying: false,

  setMediaDockOpen: (open) => set({ mediaDockOpen: open }),

  setSelectedShotIds: (v) =>
    set((s) => ({
      selectedShotIds: typeof v === 'function' ? v(s.selectedShotIds) : v,
    })),

  toggleShotSelected: (id) =>
    set((s) => ({
      selectedShotIds: s.selectedShotIds.includes(id)
        ? s.selectedShotIds.filter((x) => x !== id)
        : [...s.selectedShotIds, id],
    })),

  setStillQuality: (q) => set({ stillQuality: q }),
  setVideoMode: (m) => set({ videoMode: m }),
  setVideoPreset: (p) => set({ videoPreset: p }),
  setVideoDuration: (d) => set({ videoDuration: d }),
  setVideoIntensity: (i) => set({ videoIntensity: i }),

  selectPresetAndPreview: (p) => {
    const s = get();
    // 現在再生中なら一旦停止
    if (s.previewPlaying) {
      stopCameraPathPreview();
      set({ previewPlaying: false });
    }
    set({ videoPreset: p });
    // 新しいプリセットでパスを組み立てて即再生
    const { selectedShotIds, videoDuration, videoIntensity } = get();
    const shots = useShotStore.getState().shots;
    const targets = shots.filter((sh) => selectedShotIds.includes(sh.id));
    if (targets.length === 0) return null; // Shot未選択は黙って選択だけ
    if (p === 'shots' && targets.length < 2) return null; // 条件不足も黙って選択だけ
    try {
      const cameraPath = buildCameraPath(p, targets.map((sh) => sh.camera), {
        durationSec: videoDuration,
        fps: 30,
        intensity: videoIntensity,
      });
      const ok = startCameraPathPreview(cameraPath, () => set({ previewPlaying: false }));
      if (!ok) return 'ビューポートが未初期化のためプレビューできません。';
      set({ previewPlaying: true });
      return null;
    } catch (e: any) {
      return String(e?.message ?? e);
    }
  },

  buildSelectedPath: () => {
    const { selectedShotIds, videoPreset, videoDuration, videoIntensity } = get();
    const shots = useShotStore.getState().shots;
    const targets = shots.filter((s) => selectedShotIds.includes(s.id));
    if (targets.length === 0) {
      return { ok: false, error: 'Shotを選択してください（カードをクリックで選択）。' };
    }
    try {
      // 自動アングル（カテゴリ付き or モーション割当済み）を含む場合は、選択した順序＝
      // 動画の前後関係として per-アングル モーションを毎回算出し、各カットを前後トランジション
      // で繋いだ1本のシーケンス（プロのプロモ動画）を組む。保存済み movieMotion は上書き優先。
      const isAuto = (s: Shot) => !!s.movieMotion || !!s.category;
      if (targets.some(isAuto)) {
        const motions = computeSequenceMotions(targets.map((s) => ({ name: s.name, category: s.category })));
        const fallback = { preset: videoPreset, intensity: videoIntensity, durationSec: Math.max(2, videoDuration / Math.max(1, targets.length)) };
        const cameraPath = buildSequencePath(
          targets.map((s, i) => ({
            camera: s.camera,
            motion: s.movieMotion ?? (isAuto(s) ? motions[i] : fallback),
          })),
          fallback,
          30,
        );
        return { ok: true, value: { targets, cameraPath } };
      }
      // 手動アングルのみはグローバル設定の単一プリセットで従来どおり
      if (videoPreset === 'shots' && targets.length < 2) {
        return { ok: false, error: '「Shot間フライスルー」には2つ以上のShotを選択してください。' };
      }
      const cameraPath = buildCameraPath(
        videoPreset,
        targets.map((s) => s.camera),
        { durationSec: videoDuration, fps: 30, intensity: videoIntensity },
      );
      return { ok: true, value: { targets, cameraPath } };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  },

  togglePreview: () => {
    const s = get();
    if (s.previewPlaying) {
      stopCameraPathPreview();
      set({ previewPlaying: false });
      return null;
    }
    const built = s.buildSelectedPath();
    if (!built.ok) return built.error;
    const ok = startCameraPathPreview(built.value.cameraPath, () => set({ previewPlaying: false }));
    if (!ok) return 'ビューポートが未初期化のためプレビューできません。';
    set({ previewPlaying: true });
    return null;
  },

  stopPreview: () => {
    stopCameraPathPreview();
    set({ previewPlaying: false });
  },
}));
