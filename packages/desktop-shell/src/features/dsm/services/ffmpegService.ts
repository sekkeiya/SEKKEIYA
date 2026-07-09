/**
 * ffmpegService.ts — Rust 側 ffmpeg.rs コマンドの薄いラッパー（docs/14 Step 0）
 *
 * FFmpeg の所在解決は Blender と同じ方針:
 *   明示パス → AppData/bundled_ffmpeg/（ランタイムDL）→ システム（PATH 等）。
 * 初回利用時に needsFfmpegSetup() → downloadFfmpeg() の導線をフロントで出す。
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  ComposeSpec,
  ComposeProgress,
  FfmpegDownloadProgress,
  FfmpegInfo,
  VideoMeta,
} from '../types';
import { buildComposeArgs } from './movieComposeArgs';

export async function needsFfmpegSetup(): Promise<boolean> {
  return invoke<boolean>('needs_ffmpeg_setup');
}

export async function checkFfmpeg(ffmpegPath?: string): Promise<FfmpegInfo> {
  return invoke<FfmpegInfo>('check_ffmpeg', { ffmpegPath: ffmpegPath ?? null });
}

export async function downloadFfmpeg(
  onProgress?: (p: FfmpegDownloadProgress) => void,
): Promise<string> {
  let unlisten: UnlistenFn | null = null;
  if (onProgress) {
    unlisten = await listen<FfmpegDownloadProgress>('ffmpeg-download-progress', (e) =>
      onProgress(e.payload),
    );
  }
  try {
    return await invoke<string>('download_ffmpeg');
  } finally {
    unlisten?.();
  }
}

export async function probeVideo(ffmpegPath: string, videoPath: string): Promise<VideoMeta> {
  return invoke<VideoMeta>('probe_video', { ffmpegPath, videoPath });
}

/**
 * 日本語テロップ用フォントファイルを解決する。
 * Windows はメイリオ → 游ゴシックの順。macOS はヒラギノ。
 * 実機での描画確認は docs/14 Step 0 の検証項目。
 */
export function resolveJpFontFile(): string | null {
  const isWindows = navigator.userAgent.includes('Windows');
  const candidates = isWindows
    ? ['C:/Windows/Fonts/meiryo.ttc', 'C:/Windows/Fonts/YuGothM.ttc', 'C:/Windows/Fonts/msgothic.ttc']
    : [
        '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      ];
  // 存在確認は ffmpeg 実行時に委ねる（フロントから任意パスの stat はできないため、
  // 先頭候補を返し、失敗時に次候補で再試行するのは呼び出し側の責務）
  return candidates[0] ?? null;
}

/**
 * 編集指示 JSON から mp4 を書き出す（S.Movie v0 のエントリポイント）。
 * エンコーダは check_ffmpeg の検出結果の先頭（HW 優先）を自動選択。
 */
export async function composeMovie(
  spec: ComposeSpec,
  onProgress?: (p: ComposeProgress) => void,
): Promise<string> {
  const info = await checkFfmpeg();
  const encoder = info.h264Encoders[0] ?? 'libx264';
  const fontFile = (spec.overlays?.length ?? 0) > 0 ? resolveJpFontFile() : null;
  const { args, totalDurationSec } = buildComposeArgs(spec, { encoder, fontFile });

  let unlisten: UnlistenFn | null = null;
  if (onProgress) {
    unlisten = await listen<ComposeProgress>('movie-compose-progress', (e) =>
      onProgress(e.payload),
    );
  }
  try {
    return await invoke<string>('compose_movie', {
      ffmpegPath: info.path,
      args,
      outputPath: spec.output.path,
      totalDurationSec,
    });
  } catch (err) {
    // HW エンコーダ初期化失敗（ドライバ/世代相性）は libx264 で 1 回だけ再試行
    const msg = String(err);
    if (encoder !== 'libx264' && /nvenc|amf|qsv|videotoolbox|InitializeEncoder|No capable devices/i.test(msg)) {
      const fallback = buildComposeArgs(spec, { encoder: 'libx264', fontFile });
      return await invoke<string>('compose_movie', {
        ffmpegPath: info.path,
        args: fallback.args,
        outputPath: spec.output.path,
        totalDurationSec: fallback.totalDurationSec,
      });
    }
    throw err;
  } finally {
    unlisten?.();
  }
}
