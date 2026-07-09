/**
 * layoutPlanCapture.ts
 *
 * 「Topビュー・通常モード」の平面図を、用紙サイズ（A3/A4）と縮尺に合わせて
 * オフスクリーン・オルソ投影でレンダリングし PNG データURLを返す。
 *
 * - 真上からの平行投影（オルソ）。用紙いっぱいの実寸領域 = 用紙mm × 縮尺。
 * - 壁は一時的に真っ黒へ差し替え（平面図ポシェ）。床仕上げ・家具はそのまま。
 * - グリッド／ギズモ／線／ゾーン半透明ボックス等の UI は一時非表示。
 * - メインビューポートには影響しない（撮影後にすべて復元）。
 */
import * as THREE from 'three';
import { layoutSceneRef } from './layoutSceneRef';
import { useEditorModeStore } from '../store/useEditorModeStore';

const PAPER_MM: Record<string, { w: number; h: number }> = {
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
};
const PLAN_MARGIN_MM = 15;            // 用紙の余白
const STD_SCALES = [20, 30, 50, 100, 150, 200, 250, 300, 500];
const PLAN_DPI = 150;

export type PaperSize = 'A3' | 'A4';
export type PlanOrientation = 'auto' | 'portrait' | 'landscape';

export interface PlanCaptureOpts {
  paperSize?: PaperSize;
  scale?: 'auto' | number;     // 1:scale（mm/mm）。'auto' は用紙に収まる標準縮尺を自動選択
  orientation?: PlanOrientation;
}

export interface PlanCaptureResult {
  image: string;               // PNG data URL
  scale: number;
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  widthPx: number;
  heightPx: number;
}

export async function captureLayoutPlan(opts?: PlanCaptureOpts): Promise<PlanCaptureResult | null> {
  const ref = layoutSceneRef as any;
  const gl: THREE.WebGLRenderer = ref.gl;
  const scene: THREE.Scene = ref.scene;
  const baseRoot: THREE.Object3D | null = ref.baseRoot ?? null;
  if (!gl || !scene) {
    console.warn('[captureLayoutPlan] gl/scene が未登録です');
    return null;
  }

  const paperSize: PaperSize = opts?.paperSize ?? 'A3';
  const paper = PAPER_MM[paperSize] ?? PAPER_MM.A3;

  // ── 部屋フットプリント（XZ）を求める ──
  const box = new THREE.Box3();
  if (baseRoot) box.setFromObject(baseRoot);
  if (box.isEmpty()) {
    scene.traverse((o: any) => { if (o.isMesh && o.userData?.isStructuralBase) box.expandByObject(o); });
  }
  if (box.isEmpty()) {
    console.warn('[captureLayoutPlan] 躯体の範囲を取得できません');
    return null;
  }
  const sizeX = box.max.x - box.min.x;
  const sizeZ = box.max.z - box.min.z;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const camY = box.max.y + Math.max(sizeX, sizeZ) + 1000;

  // ── 用紙の向き ──
  let orientation: 'portrait' | 'landscape';
  if (opts?.orientation && opts.orientation !== 'auto') orientation = opts.orientation;
  else orientation = sizeX >= sizeZ ? 'landscape' : 'portrait';

  const paperW = orientation === 'landscape' ? Math.max(paper.w, paper.h) : Math.min(paper.w, paper.h);
  const paperH = orientation === 'landscape' ? Math.min(paper.w, paper.h) : Math.max(paper.w, paper.h);
  const usableW = paperW - 2 * PLAN_MARGIN_MM;
  const usableH = paperH - 2 * PLAN_MARGIN_MM;

  // ── 縮尺 ──
  let scale: number;
  if (opts?.scale && opts.scale !== 'auto') {
    scale = Number(opts.scale);
  } else {
    scale = STD_SCALES.find((S) => sizeX <= usableW * S && sizeZ <= usableH * S) ?? STD_SCALES[STD_SCALES.length - 1];
  }

  // ── オルソカメラ（用紙いっぱい = paperMM × 縮尺 の実寸領域）──
  const halfW = (paperW * scale) / 2;
  const halfH = (paperH * scale) / 2;
  const pxW = Math.round((paperW / 25.4) * PLAN_DPI);
  const pxH = Math.round((paperH / 25.4) * PLAN_DPI);

  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, camY * 4);
  cam.position.set(cx, camY, cz);
  cam.up.set(0, 0, -1);
  cam.lookAt(cx, 0, cz);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  // ── UI 非表示（グリッド／線／ギズモ／半透明ゾーン）──
  // 壁の黒塗り(ポシェ)は呼び出し側が Topビューに切替えるため、live と同じ baseFillMesh /
  // section-fills がそのまま映る。ここでは material 差替えはしない（全黒化・暗転を避ける）。
  const hidden: THREE.Object3D[] = [];
  scene.traverse((obj: any) => {
    if (!obj.visible) return;
    if (obj.userData?.isGizmo || obj.isLine || obj.isLineSegments || obj.isPoints) {
      obj.visible = false; hidden.push(obj); return;
    }
    if (obj.isMesh) {
      const mesh = obj as THREE.Mesh;
      const isFill = mesh.userData?.isSectionFill;
      const isStructural = mesh.userData?.isStructuralBase;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // ゾーン等の半透明オーバーレイは隠す（ポシェ黒塗り・仕上げ・家具は残す）
      if (!isFill && !isStructural && !mesh.userData?.isSurfaceFinish) {
        const translucent = mats.every((m: any) => m && m.transparent === true && (m.opacity ?? 1) < 0.95);
        if (translucent) { obj.visible = false; hidden.push(obj); return; }
      }
    }
  });

  // ── 状態退避 ──
  const prevBackground = scene.background;
  scene.background = new THREE.Color(0xffffff); // 用紙＝白
  const rt = new THREE.WebGLRenderTarget(pxW, pxH, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, samples: 4,
  });
  const prevRenderTarget = gl.getRenderTarget();
  const prevClear = new THREE.Color(); gl.getClearColor(prevClear);
  const prevClearAlpha = gl.getClearAlpha();
  // 図面に影は不要 → 撮影中はシャドウを無効化
  const prevShadowEnabled = gl.shadowMap.enabled;
  gl.shadowMap.enabled = false;

  try {
    gl.setRenderTarget(rt);
    gl.setClearColor(0xffffff, 1.0);
    gl.clear(true, true, false);
    gl.render(scene, cam);

    const buf = new Uint8Array(pxW * pxH * 4);
    gl.readRenderTargetPixels(rt, 0, 0, pxW, pxH, buf);

    const canvas = document.createElement('canvas');
    canvas.width = pxW; canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(pxW, pxH);
    const rowBytes = pxW * 4;
    for (let row = 0; row < pxH; row++) {
      const src = pxH - 1 - row; // WebGL は上下反転
      img.data.set(buf.subarray(src * rowBytes, (src + 1) * rowBytes), row * rowBytes);
    }
    ctx.putImageData(img, 0, 0);
    return { image: canvas.toDataURL('image/png'), scale, paperSize, orientation, widthPx: pxW, heightPx: pxH };
  } finally {
    gl.setRenderTarget(prevRenderTarget);
    gl.setClearColor(prevClear, prevClearAlpha);
    gl.shadowMap.enabled = prevShadowEnabled;
    rt.dispose();
    scene.background = prevBackground;
    hidden.forEach((o) => { o.visible = true; });
  }
}

/**
 * 一時的に Topビュー(furniture_top)へ切り替えて平面図を撮影し、元のサブモードへ戻す。
 * これにより BaseGlb/ParametricRoom の壁ポシェ（黒塗り）と天井非表示が live と同じ状態で映る。
 * 切替直後は BaseGlb の useEffect 反映＋再レンダリングを待つ必要があるため少し待機する。
 */
export async function captureTopViewPlan(opts?: PlanCaptureOpts): Promise<PlanCaptureResult | null> {
  const ms = useEditorModeStore.getState();
  const prevSub = ms.layoutSubMode;
  const prevTilt = ms.layoutCameraTilt;
  try {
    ms.setLayoutSubMode('furniture_top');
    ms.setLayoutCameraTilt('top');
    // BaseGlb がポシェ生成・天井非表示・再描画するのを待つ
    await new Promise<void>((r) => setTimeout(r, 280));
    return await captureLayoutPlan(opts);
  } finally {
    ms.setLayoutSubMode(prevSub);
    ms.setLayoutCameraTilt(prevTilt);
  }
}
