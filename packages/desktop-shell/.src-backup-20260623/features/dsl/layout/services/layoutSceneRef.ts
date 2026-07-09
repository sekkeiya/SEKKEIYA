/**
 * モジュールスコープ参照 — SingleViewportCanvas が保持する WebGL レンダラーとシーン。
 * LayoutShell でサムネイル撮影時に参照する（ref threading / store 不要）。
 */
export const layoutSceneRef: {
  gl: any | null;       // THREE.WebGLRenderer
  scene: any | null;    // THREE.Scene
  baseRoot: any | null; // THREE.Group — ベースGLBのルートグループ（カメラフレーミング用）
  getCameraState: (() => { position: [number, number, number]; target: [number, number, number]; fov: number } | null) | null;
} = { gl: null, scene: null, baseRoot: null, getCameraState: null };
