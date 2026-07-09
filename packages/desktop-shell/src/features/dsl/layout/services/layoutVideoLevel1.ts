/**
 * layoutVideoLevel1.ts
 *
 * Level 1 動画レンダリング（Three.js Worker + ffmpeg）。
 *
 * フロー:
 *   1. GLB エクスポート
 *   2. AppData にフレームディレクトリ作成（Rust）
 *   3. Worker 起動 → フレームごとに PNG を受け取り Rust 経由で保存
 *   4. compose_movie で PNG 連番 → mp4 エンコード
 *   5. mp4 を base64 で読み込んで data URL を返す
 *   6. フレームディレクトリをクリーンアップ
 */

import { invoke } from '@tauri-apps/api/core';
import { exportSceneToGlb, buildSceneConfig } from './layoutCyclesCapture';
import type { CameraPath } from './cameraPaths';

// ── Helpers ───────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface Level1Progress {
  frame: number;
  total: number;
  phase: 'rendering' | 'encoding';
}

export interface Level1Options {
  size?: { width: number; height: number };
  /** 1 = 速い（影なし） / 2 = 高品質（ソフトシャドウ + 2x SSAA + トーンマッピング） */
  quality?: 1 | 2;
  onProgress?: (p: Level1Progress) => void;
  signal?: AbortSignal;
}

/**
 * Level 1/2 でカメラパスを動画（mp4 data URL）にレンダリングして返す。
 *
 * @param cameraPath  カメラキーフレーム・fps・durationSec
 * @param ffmpegPath  ffmpeg 実行ファイルのパス（check_ffmpeg で取得済みのもの）
 * @param opts        解像度・品質レベル・進捗コールバック・AbortSignal
 */
export async function renderVideoLevel1(
  cameraPath: CameraPath,
  ffmpegPath: string,
  opts: Level1Options = {},
): Promise<string> {
  const size = opts.size ?? { width: 1280, height: 720 };
  const quality = opts.quality ?? 1;
  const onProgress = opts.onProgress;
  const signal = opts.signal;
  const fps = cameraPath.fps || 30;
  const totalFrames = Math.max(1, Math.round(cameraPath.durationSec * fps));

  // 1. GLB エクスポート & シーン設定
  const glbBuffer = await exportSceneToGlb();
  const sceneConfig = buildSceneConfig();

  // 2. フレームディレクトリを AppData 配下に作成
  const frameDir = await invoke<string>('create_render_frame_dir');

  const worker = new Worker(
    new URL('../workers/videoRenderWorker.ts', import.meta.url),
    { type: 'module' },
  );

  const abort = () => {
    worker.postMessage({ type: 'cancel' });
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    // 3a. Worker 初期化
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (ev) => {
        if (ev.data.type === 'ready') resolve();
        else if (ev.data.type === 'error') reject(new Error(ev.data.message));
      };
      worker.onerror = (e) => reject(new Error(String(e.message)));
      worker.postMessage(
        { type: 'init', glbBuffer, sceneConfig, width: size.width, height: size.height, quality },
        [glbBuffer],
      );
    });

    if (signal?.aborted) throw new Error('CANCELLED');

    // 3b. フレームレンダリング & 保存
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = async (ev) => {
        const msg = ev.data;
        if (msg.type === 'frame') {
          if (signal?.aborted) return;
          const b64 = arrayBufferToBase64(msg.data as ArrayBuffer);
          try {
            await invoke('save_frame_png', { dir: frameDir, index: msg.index as number, b64Data: b64 });
            onProgress?.({ frame: (msg.index as number) + 1, total: totalFrames, phase: 'rendering' });
          } catch (e) {
            reject(e);
          }
        } else if (msg.type === 'done') {
          resolve();
        } else if (msg.type === 'cancelled') {
          reject(new Error('CANCELLED'));
        } else if (msg.type === 'error') {
          reject(new Error(msg.message as string));
        }
      };
      worker.onerror = (e) => reject(new Error(String(e.message)));
      worker.postMessage({ type: 'render', keyframes: cameraPath.keyframes, fps, totalFrames });
    });

    if (signal?.aborted) throw new Error('CANCELLED');

    // 4. PNG 連番 → mp4 エンコード（ffmpeg）
    onProgress?.({ frame: 0, total: totalFrames, phase: 'encoding' });

    // Windows のバックスラッシュを ffmpeg に渡せるよう正規化
    const dir = frameDir.replace(/\\/g, '/');
    const outputPath = `${frameDir.replace(/\\/g, '/')}/output.mp4`;

    await invoke('compose_movie', {
      ffmpegPath,
      args: [
        '-framerate', String(fps),
        '-i', `${dir}/frame_%06d.png`,
        '-c:v', 'libx264',
        '-crf', '22',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-s', `${size.width}x${size.height}`,
        outputPath,
      ],
      outputPath,
      totalDurationSec: cameraPath.durationSec,
    });

    if (signal?.aborted) throw new Error('CANCELLED');

    // 5. mp4 → base64 data URL
    const b64 = await invoke<string>('read_file_as_base64', { path: outputPath });
    return `data:video/mp4;base64,${b64}`;

  } finally {
    signal?.removeEventListener('abort', abort);
    worker.terminate();
    // バックグラウンドでクリーンアップ（await しない）
    invoke('cleanup_render_frame_dir', { dir: frameDir }).catch(() => {});
  }
}
