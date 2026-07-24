/**
 * モジュールスコープ参照 — SingleViewportCanvas が保持する WebGL レンダラーとシーン。
 * LayoutShell でサムネイル撮影時に参照する（ref threading / store 不要）。
 */
export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const layoutSceneRef: {
  gl: any | null;       // THREE.WebGLRenderer
  scene: any | null;    // THREE.Scene
  baseRoot: any | null; // THREE.Group — ベースGLBのルートグループ（カメラフレーミング用）
  getCameraState: (() => CameraPose | null) | null;
  /** ビューポートカメラを直接動かす（カメラパスのプレビュー再生用） */
  setCameraPose: ((pose: CameraPose) => void) | null;
  /**
   * 平面図（Top・正射）で、中心(cx,cz)・幅width・奥行depth の矩形が収まるように
   * カメラをパン＋ズームする（部屋ラベルのダブルクリック＝フォーカス用）。単位は world(mm)。
   * 平面ビューでないときは何もしない。
   */
  focusRect: ((cx: number, cz: number, width: number, depth: number, pad?: number) => void) | null;
} = { gl: null, scene: null, baseRoot: null, getCameraState: null, setCameraPose: null, focusRect: null };
