/**
 * cameraPathPreview.ts
 *
 * カメラパスをビューポートのカメラで実時間再生するプレビュー。
 * 動画生成（数分〜数十分）の前に動きを確認して手戻りを防ぐ。
 *
 * 仕組み: layoutSceneRef.setCameraPose で OrbitControls のカメラを
 * requestAnimationFrame ごとに補間ポーズへ動かし、終了/停止時に
 * 再生前のカメラ位置へ復元する。レンダリングとは完全に独立。
 */

import { layoutSceneRef } from './layoutSceneRef';
import { interpolateCameraPath, type CameraPath } from './cameraPaths';

interface ActivePreview {
  raf: number;
  restore: () => void;
}

let active: ActivePreview | null = null;

/** プレビュー再生中か */
export function isCameraPathPreviewPlaying(): boolean {
  return active !== null;
}

/** プレビューを停止してカメラを元の位置へ戻す */
export function stopCameraPathPreview(): void {
  if (!active) return;
  cancelAnimationFrame(active.raf);
  const { restore } = active;
  active = null;
  restore();
}

/**
 * カメラパスのプレビュー再生を開始する。
 * 再生終了（または stop）でカメラは自動的に元の位置へ戻る。
 *
 * @returns 開始できたか（ビューポート未初期化なら false）
 */
export function startCameraPathPreview(
  path: CameraPath,
  onEnd?: () => void,
): boolean {
  if (!layoutSceneRef.setCameraPose || !layoutSceneRef.getCameraState) return false;
  if (!path.keyframes || path.keyframes.length === 0) return false;

  stopCameraPathPreview();

  const original = layoutSceneRef.getCameraState();
  const restore = () => {
    if (original) layoutSceneRef.setCameraPose?.(original);
    onEnd?.();
  };

  const durMs = Math.max(500, path.durationSec * 1000);
  const t0 = performance.now();

  const tick = () => {
    if (!active) return; // stop 済み
    const t = (performance.now() - t0) / durMs;
    if (t >= 1) {
      // 最終ポーズを一瞬見せてから復元
      layoutSceneRef.setCameraPose?.(interpolateCameraPath(path.keyframes, 1));
      active = null;
      setTimeout(restore, 300);
      return;
    }
    layoutSceneRef.setCameraPose?.(interpolateCameraPath(path.keyframes, t));
    active.raf = requestAnimationFrame(tick);
  };

  active = { raf: requestAnimationFrame(tick), restore };
  return true;
}
