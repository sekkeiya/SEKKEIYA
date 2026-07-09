import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { renderVideoWithCycles } from '../services/layoutCyclesCapture';
import { renderVideoLevel1 } from '../services/layoutVideoLevel1';
import { captureLayoutPerspective } from '../services/layoutPerspectiveCapture';
import { makeHistoryThumbnail } from '../services/imageThumbnail';
import { useRenderHistoryStore } from './useRenderHistoryStore';
import type { CameraPath } from '../services/cameraPaths';
import type { ShotCamera } from './useShotStore';

/**
 * 動画レンダリングのライフサイクルを保持するグローバルストア。
 *
 * engine: 'threejs' → Level 1（Three.js Worker + ffmpeg）
 * engine: 'cycles'  → Level 3（Blender Cycles）
 */

export interface VideoRenderResult {
  id: string;
  name: string;
  thumbnail: string | null;
  media: string;
  mediaType: 'video';
  format: 'mp4';
  durationSec: number;
  quality: 'cycles' | 'threejs';
  width: number;
  height: number;
}

export interface StartVideoRenderParams {
  engine: 'threejs' | 'cycles';
  cameraPath: CameraPath;
  blenderPath?: string;   // cycles 時必須
  ffmpegPath?: string;    // threejs 時必須
  /** threejs 時の品質。1 = 速い（影なし）、2 = 高品質（影 + SSAA）。既定 1 */
  threejsQuality?: 1 | 2;
  samples?: number;
  durationSec: number;
  resultName: string;
  posterCamera: ShotCamera;
  posterFallback: string | null;
  historyShotId: string;
  historyShotName: string;
}

type RenderStatus = 'idle' | 'rendering' | 'done' | 'error';

interface VideoRenderStore {
  status: RenderStatus;
  frame: number;
  totalFrames: number;
  sample: number;
  sampleTotal: number;
  durationSec: number;
  shotName: string;
  startedAt: number | null;
  result: VideoRenderResult | null;
  error: string | null;

  startVideoRender: (p: StartVideoRenderParams) => Promise<void>;
  cancelVideoRender: () => Promise<void>;
  clearResult: () => void;
  dismissError: () => void;
  reset: () => void;
}

const FRAME_RE = /Fra:(\d+)/;

// Level 1 キャンセル用 AbortController（Zustand state 外に保持）
let _level1AbortController: AbortController | null = null;

export const useVideoRenderStore = create<VideoRenderStore>((set, get) => ({
  status: 'idle',
  frame: 0,
  totalFrames: 0,
  sample: 0,
  sampleTotal: 0,
  durationSec: 0,
  shotName: '',
  startedAt: null,
  result: null,
  error: null,

  startVideoRender: async (p) => {
    if (get().status === 'rendering') {
      console.warn('[VideoRender] すでにレンダリング中のため新規ジョブを拒否');
      return;
    }

    const fps = p.cameraPath.fps || 30;
    const totalFrames = Math.max(1, Math.round(p.durationSec * fps));

    set({
      status: 'rendering',
      frame: 0,
      totalFrames,
      sample: 0,
      sampleTotal: 0,
      durationSec: p.durationSec,
      shotName: p.resultName,
      startedAt: Date.now(),
      result: null,
      error: null,
    });

    let videoUrl: string;

    // ── Level 1: Three.js Worker + ffmpeg ──────────────────────────────────
    if (p.engine === 'threejs') {
      _level1AbortController = new AbortController();
      const signal = _level1AbortController.signal;

      try {
        videoUrl = await renderVideoLevel1(p.cameraPath, p.ffmpegPath!, {
          size: { width: 1280, height: 720 },
          quality: p.threejsQuality ?? 1,
          onProgress: ({ frame }) => set({ frame }),
          signal,
        });
      } catch (e: any) {
        const errStr = String(e?.message ?? e ?? '');
        if (errStr === 'CANCELLED' || get().status === 'idle') return;
        console.error('[VideoRender] Level1 動画生成失敗:', e);
        set({ status: 'error', error: errStr });
        return;
      } finally {
        _level1AbortController = null;
      }

    // ── Level 3: Blender Cycles ─────────────────────────────────────────────
    } else {
      const unlistenProgress = await listen<{ current: number; total: number; pct: number }>(
        'cycles-progress',
        (ev) => {
          const pl = ev.payload;
          if (pl && typeof pl.total === 'number' && pl.total > 0) {
            set({ sample: pl.current, sampleTotal: pl.total });
          }
        },
      );

      const unlistenLog = await listen<string>('cycles-log', (ev) => {
        const line = ev.payload;
        console.log('[Blender]', line);
        const m = typeof line === 'string' ? line.match(FRAME_RE) : null;
        if (m) {
          const f = parseInt(m[1], 10);
          if (Number.isFinite(f) && f >= 1) set({ frame: f });
        }
      });

      try {
        videoUrl = await renderVideoWithCycles(
          p.cameraPath,
          p.blenderPath!,
          p.samples ?? 64,
        );
      } catch (e: any) {
        const errStr = String(e?.message ?? e ?? '');
        if (errStr === 'CANCELLED' || get().status === 'idle') return;
        console.error('[VideoRender] Cycles 動画生成失敗:', e);
        set({ status: 'error', error: errStr });
        return;
      } finally {
        unlistenProgress();
        unlistenLog();
      }
    }

    // ── 共通: ポスター撮影 → 履歴登録 → done ──────────────────────────────
    let poster: string | null = p.posterFallback;
    try {
      poster = await captureLayoutPerspective(p.posterCamera);
    } catch (e) {
      console.warn('[VideoRender] ポスター撮影失敗（フォールバックを使用）:', e);
    }

    try {
      const histThumb = poster ? await makeHistoryThumbnail(poster) : null;
      useRenderHistoryStore.getState().addEntry({
        shotId: p.historyShotId,
        shotName: `${p.historyShotName} (動画)`,
        thumbnail: histThumb ?? '',
        quality: p.engine === 'threejs' ? 'standard' : 'cycles',
      });
    } catch (e) {
      console.warn('[VideoRender] 履歴サムネイル生成失敗:', e);
    }

    set({
      status: 'done',
      frame: totalFrames,
      result: {
        id: p.historyShotId,
        name: p.resultName,
        thumbnail: poster,
        media: videoUrl!,
        mediaType: 'video',
        format: 'mp4',
        durationSec: p.durationSec,
        quality: p.engine === 'threejs' ? 'threejs' : 'cycles',
        width: 1280,
        height: 720,
      },
    });
  },

  cancelVideoRender: async () => {
    set({ status: 'idle', frame: 0, sample: 0, sampleTotal: 0 });

    // Level 1 キャンセル
    if (_level1AbortController) {
      _level1AbortController.abort();
      _level1AbortController = null;
    }

    // Cycles（Blender）キャンセル
    try {
      await invoke('cancel_video_render');
    } catch (e) {
      console.warn('[VideoRender] cancel_video_render コマンド失敗:', e);
    }
  },

  clearResult: () => set({ status: 'idle', result: null, frame: 0, sample: 0, sampleTotal: 0 }),

  dismissError: () => set({ status: 'idle', error: null }),

  reset: () =>
    set({
      status: 'idle',
      frame: 0,
      totalFrames: 0,
      sample: 0,
      sampleTotal: 0,
      result: null,
      error: null,
      startedAt: null,
    }),
}));
