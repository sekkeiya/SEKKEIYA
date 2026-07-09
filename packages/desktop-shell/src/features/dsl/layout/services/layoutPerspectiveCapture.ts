/**
 * layoutPerspectiveCapture.ts
 *
 * 透視投影カメラの現在アングル（またはShotのカメラ状態）で
 * シーンをオフスクリーンレンダリングし、JPEG データ URL を返す。
 *
 * - captureLayoutTopView と同様に gl/scene を layoutSceneRef から取得
 * - メインビューポートのカメラ・描画には一切影響しない
 * - UIオーバーレイ（ゾーンボックス・グリッド等）を一時非表示にして撮影
 * - シーン本来のライティング（IBL/EnvironmentMap/既存ライト）を維持してレンダリング
 */
import * as THREE from 'three';
import { layoutSceneRef } from './layoutSceneRef';
import type { ShotCamera } from '../store/useShotStore';
import { useViewportEnvStore, threeToneMapping } from '../store/useViewportEnvStore';

const RENDER_W = 1920;
const RENDER_H = 1080;

function isUiOverlay(mesh: THREE.Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (mats.length > 0 && mats.every((m) => (m as THREE.Material).colorWrite === false)) return true;
  if (mats.some((m) => (m as THREE.Material).depthTest === false)) return true;
  return false;
}

/**
 * @param cameraOverride 指定した場合そのカメラ状態で撮影（Shot再レンダリング用）
 *                       省略した場合は現在のビューポートカメラ状態を使用
 * @param opts.forceShadows 省略時 true（高品質出力用に全メッシュへ影を強制）。
 *   false にするとビューポートと同じ影設定のまま撮影＝「見えているビュー」をそのまま撮る
 *   （サムネ用。影未設定の部屋で全体が暗くなるのを防ぐ）。
 */
export async function captureLayoutPerspective(
  cameraOverride?: ShotCamera,
  opts?: { forceShadows?: boolean }
): Promise<string | null> {
  const forceShadows = opts?.forceShadows ?? true;
  const { gl, scene, getCameraState } = layoutSceneRef as typeof layoutSceneRef;

  if (!gl || !scene) {
    console.warn('[captureLayoutPerspective] gl または scene が未登録です');
    return null;
  }

  const state = cameraOverride ?? getCameraState?.();
  if (!state) {
    console.warn('[captureLayoutPerspective] カメラ状態を取得できません');
    return null;
  }

  // ── STEP 1: UIオーバーレイ・グリッドを一時非表示 ──────────────────────────
  const hiddenObjects: THREE.Object3D[] = [];
  scene.traverse((obj: THREE.Object3D) => {
    if (!obj.visible) return;
    // hide light gizmo spheres
    if ((obj as any).userData?.isGizmo === true) {
      obj.visible = false;
      hiddenObjects.push(obj);
      return;
    }
    if ((obj as any).isLine === true || (obj as any).isLineSegments === true) {
      obj.visible = false;
      hiddenObjects.push(obj);
      return;
    }
    if ((obj as THREE.Mesh).isMesh && isUiOverlay(obj as THREE.Mesh)) {
      obj.visible = false;
      hiddenObjects.push(obj);
    }
  });

  // ── STEP 2: Shot カメラを生成 ──────────────────────────────────────────────
  const pos = new THREE.Vector3(...state.position);
  const tgt = new THREE.Vector3(...state.target);
  const dir = new THREE.Vector3().subVectors(tgt, pos).normalize();

  // 真上/真下を向いているとき lookAt が unstable になるため、若干オフセット
  const isNearVertical = Math.abs(dir.y) > 0.9998;
  if (isNearVertical) {
    pos.x += 0.01;
  }

  const captureCam = new THREE.PerspectiveCamera(state.fov, RENDER_W / RENDER_H, 0.01, 1_000_000);
  captureCam.position.copy(pos);
  captureCam.up.set(0, 1, 0);
  captureCam.lookAt(tgt);
  captureCam.updateMatrixWorld(true);
  captureCam.updateProjectionMatrix();

  // ── STEP 3: 背景はエディタの Environment 設定（空 / 単色）をそのまま使う ──────
  // ライトは useLightingStore → Lights.jsx → シーン常駐のものをそのまま使用する。
  // 環境（drei <Environment background> / <color attach="background">）が設定する
  // scene.background をそのまま使い、未設定（null）のときだけ中立色でフォールバック。
  // scene.environment（IBL）はここでは触れない＝ライティングに反映され続ける。
  const prevBackground = scene.background;
  if (!scene.background) {
    scene.background = new THREE.Color(0x111118);
  }

  // ── STEP 4: WebGLRenderTarget 生成（MSAA×4）─────────────────────────────
  const rt = new THREE.WebGLRenderTarget(RENDER_W, RENDER_H, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    samples: 4,
  });

  // ── STEP 5: 現在の WebGL 状態を退避 ──────────────────────────────────────
  const prevRenderTarget = gl.getRenderTarget();
  const prevClearColor = new THREE.Color();
  gl.getClearColor(prevClearColor);
  const prevClearAlpha = gl.getClearAlpha();
  const prevToneMapping = gl.toneMapping;
  const prevToneMappingExposure = gl.toneMappingExposure;
  const prevShadowMapEnabled = gl.shadowMap.enabled;
  const prevShadowMapType = gl.shadowMap.type;

  // forceShadows=true のときだけシャドウを強制（高品質出力用）。
  // false（サムネ用）はビューポートと同じ設定のまま＝見えているビューをそのまま撮る。
  type ShadowState = { mesh: THREE.Mesh; cast: boolean; receive: boolean };
  const shadowStates: ShadowState[] = [];
  if (forceShadows) {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        shadowStates.push({ mesh, cast: mesh.castShadow, receive: mesh.receiveShadow });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  try {
    // ── STEP 6: エディタの Ambience > Render/Camera 設定（toneMapping / exposure）を
    //            適用してオフスクリーンレンダリング ──────────────────────────────
    //   ビューポート (ViewportDisplayController) と同じ見た目になるよう、
    //   useViewportEnvStore の値を反映する。
    const env = useViewportEnvStore.getState();
    gl.toneMapping = threeToneMapping(env.toneMapping);
    gl.toneMappingExposure = env.exposure;
    gl.setRenderTarget(rt);
    gl.setClearColor(0x111118, 1.0);
    gl.clear(true, true, false);
    gl.render(scene, captureCam);

    // ── STEP 7: ピクセル読み取り（WebGLは上下反転） ──────────────────────────
    const pixelBuffer = new Uint8Array(RENDER_W * RENDER_H * 4);
    gl.readRenderTargetPixels(rt, 0, 0, RENDER_W, RENDER_H, pixelBuffer);

    // ── STEP 8: 上下反転して Canvas に書き出し → JPEG ─────────────────────────
    const offscreen = document.createElement('canvas');
    offscreen.width = RENDER_W;
    offscreen.height = RENDER_H;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.createImageData(RENDER_W, RENDER_H);
    const rowBytes = RENDER_W * 4;
    for (let row = 0; row < RENDER_H; row++) {
      const srcRow = RENDER_H - 1 - row;
      imageData.data.set(
        pixelBuffer.subarray(srcRow * rowBytes, (srcRow + 1) * rowBytes),
        row * rowBytes,
      );
    }
    ctx.putImageData(imageData, 0, 0);

    return offscreen.toDataURL('image/jpeg', 0.95);
  } finally {
    // ── STEP 9: すべての状態を復元 ────────────────────────────────────────────
    gl.toneMapping = prevToneMapping;
    gl.toneMappingExposure = prevToneMappingExposure;
    gl.shadowMap.enabled = prevShadowMapEnabled;
    gl.shadowMap.type = prevShadowMapType;
    gl.setRenderTarget(prevRenderTarget);
    gl.setClearColor(prevClearColor, prevClearAlpha);
    rt.dispose();

    scene.background = prevBackground;

    // メッシュの shadow 設定を元に戻す
    shadowStates.forEach(({ mesh, cast, receive }) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    });

    hiddenObjects.forEach((o) => { o.visible = true; });
  }
}
