/**
 * layoutThumbnailCapture.ts
 *
 * 保存時サムネイル用：シーン全体を真上（トップビュー）から
 * WebGLRenderTarget へオフスクリーンレンダリングし、JPEG データ URL を返す。
 *
 * - メインビューポートのカメラ・描画には一切影響しない
 * - Y 軸反転を行い、正立した間取図画像を生成する
 *
 * フィルタ戦略（サイズ閾値は使わない）
 * ─────────────────────────────────────
 * ① colorWrite=false → 不可視コリジョンメッシュ（背景クリックキャッチャー等）
 *    これだけで 100km 背景プレーンを除外できる。
 * ② depthTest=false  → UI オーバーレイ（ゾーン box、動線ノード、ガイド等）
 *    ZoneVisualizer / CirculationVisualizer 全メッシュが depthTest=false を使用。
 * サイズ閾値は使用しない（mm スケールの base GLB が誤って除外されるため）。
 */
import * as THREE from 'three';
import { layoutSceneRef } from './layoutSceneRef';

const THUMB_SIZE = 800; // px（正方形）

// ─────────────────────────────────────────────────────────────────────────────
// サムネイルから除外すべき Mesh か判定
// ─────────────────────────────────────────────────────────────────────────────
function isThumbnailExcluded(mesh: THREE.Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  // ① colorWrite=false → 不可視コリジョンメッシュ（背景クリックキャッチャー等）
  if (mats.length > 0 && mats.every((m) => (m as THREE.Material).colorWrite === false)) {
    return true;
  }

  // ② depthTest=false → UI オーバーレイ（ゾーンボックス・動線ノード等）
  if (mats.some((m) => (m as THREE.Material).depthTest === false)) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 表示中コンテンツのワールド空間バウンディングボックスを計算
// （isThumbnailExcluded で非表示にした後に呼ぶ → visible=false は自動スキップ）
// ─────────────────────────────────────────────────────────────────────────────
function computeContentBox(scene: THREE.Scene): THREE.Box3 {
  const box = new THREE.Box3();

  scene.traverse((obj: THREE.Object3D) => {
    if (!obj.visible) return;
    if (!(obj as THREE.Mesh).isMesh) return;

    const b = new THREE.Box3().setFromObject(obj as THREE.Mesh);
    if (b.isEmpty() || !Number.isFinite(b.min.x) || !Number.isFinite(b.max.x)) return;

    box.union(b);
  });

  return box;
}

// ─────────────────────────────────────────────────────────────────────────────
// メイン：トップビューサムネイルを撮影し JPEG データ URL を返す
// ─────────────────────────────────────────────────────────────────────────────
export async function captureLayoutTopView(): Promise<string | null> {
  const { gl, scene } = layoutSceneRef as {
    gl: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
  };

  if (!gl || !scene) {
    console.warn('[captureLayoutTopView] gl または scene が未登録です');
    return null;
  }

  // ── STEP 1: UI オーバーレイ・不可視コリジョン・グリッドを一時非表示 ────────
  const hiddenObjects: THREE.Object3D[] = [];

  scene.traverse((obj: THREE.Object3D) => {
    if (!obj.visible) return;

    // Line / LineSegments（GridHelper 含む）はサムネイルでは視覚ノイズになるため非表示
    // ※ Drei の Line2 は内部的に Mesh なので isMesh=true → 下の Mesh フィルターで処理
    if ((obj as any).isLine === true || (obj as any).isLineSegments === true) {
      obj.visible = false;
      hiddenObjects.push(obj);
      return;
    }

    if (!(obj as THREE.Mesh).isMesh) return;
    if (isThumbnailExcluded(obj as THREE.Mesh)) {
      obj.visible = false;
      hiddenObjects.push(obj);
    }
  });

  // ── STEP 2: カメラフレーミング用バウンディングボックスを計算 ──────────
  //
  // 優先順位:
  //   ① layoutSceneRef.baseRoot（ベースGLBのルート）→ 建物の正確なフットプリント
  //   ② computeContentBox（フォールバック）           → 全可視メッシュのBbox
  //
  // baseRoot を使う理由：
  //   - 床面・グリッドなど建物より大きい平面オブジェクトが bounding box に
  //     混入するとカメラが過剰にズームアウトし、建物が小さく見えてしまう。
  //   - ベースGLB（建物のみ）で framing することで常に建物がフレームを埋める。
  const baseRoot = (layoutSceneRef as any).baseRoot as THREE.Object3D | null;
  let box: THREE.Box3;

  if (baseRoot) {
    box = new THREE.Box3().setFromObject(baseRoot);
    if (box.isEmpty() || !Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) {
      box = computeContentBox(scene); // GLB未ロード時はフォールバック
    }
  } else {
    box = computeContentBox(scene);
  }

  if (box.isEmpty()) {
    console.warn('[captureLayoutTopView] 表示可能なコンテンツが見つかりません');
    hiddenObjects.forEach((o) => { o.visible = true; });
    return null;
  }

  const center = new THREE.Vector3();
  const size   = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  // ── STEP 3: トップビュー用 OrthographicCamera を生成 ─────────────────────
  //
  // カメラ高さはシーン単位に依存しないよう、コンテンツ XZ 幅の 1.5 倍 + 高さ で決定。
  // mm スケール・m スケール両方に対応できる。
  const pad      = 1.06; // 余白を最小限にし、レイアウトを大きく表示
  const halfX    = (size.x / 2) * pad;
  const halfZ    = (size.z / 2) * pad;
  const halfSize = Math.max(halfX, halfZ, 1.0); // ±1 unit 最低保証

  // カメラ Y = コンテンツ最上部 + (XZ 幅の 1.5 倍) + コンテンツ高さ
  // → mm でも m でも「十分上方から見下ろす」高さが確保される
  const heightAbove = halfSize * 1.5 + size.y;
  const camY        = box.max.y + heightAbove;

  // far 平面 = カメラから床（box.min.y）までの距離 + 余裕
  const farDist = (camY - box.min.y) + halfSize;

  const topCam = new THREE.OrthographicCamera(
    -halfSize,  // left
     halfSize,  // right
     halfSize,  // top
    -halfSize,  // bottom
    0.01,
    farDist
  );
  topCam.position.set(center.x, camY, center.z);
  // up = (0,0,-1) → 間取図の「上」 = 世界 -Z 方向
  topCam.up.set(0, 0, -1);
  topCam.lookAt(new THREE.Vector3(center.x, center.y, center.z));
  topCam.updateMatrixWorld(true);
  topCam.updateProjectionMatrix();

  // ── STEP 4: 一時ライト追加（暗い GLB マテリアル対策）────────────────────
  // 既存: ambient 0.6 + directional 1.2。追加 1.5 で合計 ambient 2.1。
  // 白マテリアルは変化なし（上限 1.0）、暗いマテリアルも明るいグレーに浮かび上がる。
  const tempLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(tempLight);

  // ── STEP 5: scene.background を白に（一時退避）──────────────────────────
  // 白背景 → 暗い壁・家具が最大コントラストで見える
  const prevBackground = scene.background;
  scene.background = new THREE.Color(0xffffff);

  // ── STEP 6: WebGLRenderTarget を生成 ─────────────────────────────────────
  const rt = new THREE.WebGLRenderTarget(THUMB_SIZE, THUMB_SIZE, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });

  // ── STEP 7: 現在の WebGL 状態を退避 ──────────────────────────────────────
  const prevRenderTarget = gl.getRenderTarget();
  const prevClearColor   = new THREE.Color();
  gl.getClearColor(prevClearColor);
  const prevClearAlpha = gl.getClearAlpha();

  try {
    // ── STEP 8: オフスクリーンレンダリング ───────────────────────────────
    gl.setRenderTarget(rt);
    gl.setClearColor(0xffffff, 1.0);
    gl.clear(true, true, false);
    gl.render(scene, topCam);

    // ── STEP 9: ピクセル読み取り（WebGL は上下反転） ─────────────────────
    const pixelBuffer = new Uint8Array(THUMB_SIZE * THUMB_SIZE * 4);
    gl.readRenderTargetPixels(rt, 0, 0, THUMB_SIZE, THUMB_SIZE, pixelBuffer);

    // ── STEP 10: 全ピクセルが背景色（EEEEEEまたはほぼ白）か確認 ───────────
    // コンテンツが全く描画されていないケースをデバッグ用に検出
    let nonBgCount = 0;
    for (let i = 0; i < pixelBuffer.length; i += 4) {
      const r = pixelBuffer[i];
      const g = pixelBuffer[i + 1];
      const b = pixelBuffer[i + 2];
      // 0xFF = 255（白背景）; 背景色と 12 以上離れていれば「コンテンツあり」とみなす
      if (Math.abs(r - 255) > 12 || Math.abs(g - 255) > 12 || Math.abs(b - 255) > 12) {
        nonBgCount++;
      }
    }
    if (nonBgCount < 100) {
      // コンテンツがほぼ描画されていない → デバッグ情報を出力して null を返す
      console.warn(
        '[captureLayoutTopView] レンダリング結果がほぼ空白です。',
        `box=${JSON.stringify({ min: box.min, max: box.max, size })}`,
        `camera: pos=(${center.x.toFixed(1)},${camY.toFixed(1)},${center.z.toFixed(1)}) halfSize=${halfSize.toFixed(1)} far=${farDist.toFixed(1)}`,
      );
      return null;
    }

    // ── STEP 11: オフスクリーン Canvas に Y 反転して描画 → JPEG 出力 ──────
    const offscreen = document.createElement('canvas');
    offscreen.width  = THUMB_SIZE;
    offscreen.height = THUMB_SIZE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.createImageData(THUMB_SIZE, THUMB_SIZE);
    const rowBytes  = THUMB_SIZE * 4;
    for (let row = 0; row < THUMB_SIZE; row++) {
      const srcRow = THUMB_SIZE - 1 - row; // 上下反転
      imageData.data.set(
        pixelBuffer.subarray(srcRow * rowBytes, (srcRow + 1) * rowBytes),
        row * rowBytes,
      );
    }
    ctx.putImageData(imageData, 0, 0);

    console.log(`[captureLayoutTopView] ✅ ${nonBgCount} コンテンツピクセルを検出`);
    return offscreen.toDataURL('image/jpeg', 0.82);

  } finally {
    // ── STEP 12: すべての状態を復元 ──────────────────────────────────────
    gl.setRenderTarget(prevRenderTarget);
    gl.setClearColor(prevClearColor, prevClearAlpha);
    rt.dispose();

    scene.remove(tempLight);
    scene.background = prevBackground;

    hiddenObjects.forEach((o) => { o.visible = true; });
  }
}
