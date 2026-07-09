// ヘッドレス・レイアウトレンダリング（docs/20 Batch 1b / docs/19 並行チャット対応）。
// ビューポート（layoutSceneRef）に依存せず、Firestore データから完全オフスクリーンで
// Three.js シーンを組み立ててレンダリングする。これにより任意 planId を「裏で」レンダーでき、
// 複数チャットの並行作業が可能になる。
//
// 設計の出典: videoRenderWorker.ts（ヘッドレス・レンダラの土台＝IBLなし・ライトのみ）と
//   BaseGlb.jsx / FurnitureItem.jsx（正規化・配置）/ Lights.jsx（ライト変換）。
// 単位: シーン座標・ライト位置は mm、回転はラジアン（Euler XYZ）、方向ライトは度。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../lib/firebase/client';
import { threeToneMapping, applyWhiteBalanceToColor, useViewportEnvStore } from '../store/useViewportEnvStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { loadLayoutState } from '../api/layoutStateApi';
import { saveRenderToLayout } from '../api/layoutRendersApi';
import { layoutSceneRef } from '../services/layoutSceneRef';
import type { ShotCamera } from '../store/useShotStore';

const WORKSPACE_ID = 'layout';
const RENDER_W = 1920;
const RENDER_H = 1080;

export interface HeadlessRenderResult {
  ok: boolean;
  planId?: string;
  renderCount?: number;
  renderIds?: string[];
  renders?: { id: string; url: string }[];
  error?: string;
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

/** gs:// URL を https のダウンロード URL に解決する（GLTFLoader/fetch は gs:// を読めない）。 */
async function resolveStorageUrl(url: string | undefined | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('gs://')) {
    try { return await getDownloadURL(storageRef(storage, url)); }
    catch (e) { console.warn('[headlessRender] gs:// の解決に失敗:', url, e); return null; }
  }
  return url;
}

function applyShadowFlags(obj: THREE.Object3D): void {
  obj.traverse((c: any) => {
    if (c?.isMesh) { c.castShadow = true; c.receiveShadow = true; }
  });
}

/** 編集用の補助ジオメトリ（線・点・スプライト・ギズモ・不可視オーバーレイ）を取り除く。
 *  layoutPerspectiveCapture の除外基準に揃える。GLB に焼き込まれていた場合の保険。 */
function pruneHelpers(root: THREE.Object3D): void {
  const toRemove: THREE.Object3D[] = [];
  root.traverse((o: any) => {
    if (o === root) return;
    if (o.userData?.isGizmo || o.userData?.isEnvironmentBackdrop || o.userData?.isSectionFill) { toRemove.push(o); return; }
    if (o.isLine || o.isLineSegments || o.isPoints || o.isSprite) { toRemove.push(o); return; }
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const allNoColor = mats.length > 0 && mats.every((m: any) => m && m.colorWrite === false);
      const anyNoDepth = mats.some((m: any) => m && m.depthTest === false);
      if (allNoColor || anyNoDepth) toRemove.push(o);
    }
  });
  toRemove.forEach(o => o.parent?.remove(o));
}

/** Base 躯体を XZ 中心・床(Y最小)=0 に正規化する（BaseGlb.jsx と同じ）。 */
function normalizeBaseGlb(group: THREE.Object3D): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
  group.updateMatrixWorld(true);
}

const dirLightPos = (azimuthDeg: number, elevationDeg: number, distance: number): THREE.Vector3 => {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new THREE.Vector3(
    distance * Math.cos(el) * Math.sin(az),
    distance * Math.sin(el),
    distance * Math.cos(el) * Math.cos(az),
  );
};

const SLIDER_INTENSITY_FACTOR = 0.5; // Lights.jsx と同じ（spot 等のスケール補正）

/** 保存済み LightConfig（store 形式・hex色）→ THREE.Light。Lights.jsx の対応を踏襲。 */
function lightConfigToThree(cfg: any, whiteBalanceK: number): THREE.Light | null {
  const color = applyWhiteBalanceToColor(cfg.color || '#ffffff', whiteBalanceK);
  const intensity = cfg.intensity ?? 1;
  switch (cfg.type) {
    case 'hemisphere': {
      const ground = applyWhiteBalanceToColor(cfg.groundColor || '#8a7a68', whiteBalanceK);
      return new THREE.HemisphereLight(color, ground, intensity);
    }
    case 'ambient':
      return new THREE.AmbientLight(color, intensity);
    case 'directional': {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.copy(dirLightPos(cfg.azimuth ?? 45, cfg.elevation ?? 50, cfg.distance ?? 13000));
      light.castShadow = cfg.castShadow !== false;
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0005;
      light.shadow.normalBias = 0.02;
      return light;
    }
    case 'spot': {
      const light = new THREE.SpotLight(
        color, intensity * SLIDER_INTENSITY_FACTOR,
        cfg.spotDistance ?? 0, cfg.angle ?? Math.PI / 6, cfg.penumbra ?? 0.3, cfg.decay ?? 2,
      );
      if (Array.isArray(cfg.position)) light.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
      if (Array.isArray(cfg.targetPosition)) light.target.position.set(cfg.targetPosition[0], cfg.targetPosition[1], cfg.targetPosition[2]);
      return light;
    }
    // rect / neon は v1 では未対応（worker と同様）。
    default:
      return null;
  }
}

/** directional のシャドウカメラをジオメトリ境界にフィット（videoRenderWorker.fitShadowCameras）。 */
function fitShadowCameras(box: THREE.Box3, casters: THREE.DirectionalLight[]): void {
  if (!casters.length || box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = sphere.radius * 1.2;
  for (const light of casters) {
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 0.1; cam.far = sphere.radius * 6 + light.position.length();
    cam.updateProjectionMatrix();
    light.target.position.copy(sphere.center);
    light.target.updateMatrixWorld();
  }
}

/** 保存済みカメラが無い場合に、躯体 bbox から内観アングルを生成する。 */
function computeDefaultCameras(box: THREE.Box3, count: number): ShotCamera[] {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const eyeY = box.min.y + Math.min(1500, size.y * 0.5);
  const radius = Math.max(size.x, size.z) * 0.42; // 室内（壁の少し内側）
  const cams: ShotCamera[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / 6;
    cams.push({
      position: [center.x + Math.cos(a) * radius, eyeY, center.z + Math.sin(a) * radius],
      target: [center.x, box.min.y + Math.min(1200, size.y * 0.4), center.z],
      fov: 55,
    });
  }
  return cams;
}

/**
 * 部屋の幅・奥行(mm)をジオメトリから自動導出する（自動ゾーニングの簡易版＝全体フットプリント）。
 * 開いているシーン(layoutSceneRef.baseRoot)があれば即座に、無ければ base GLB を読み込んで bbox。
 * 取得できなければ null（呼び出し側が既定値にフォールバック）。
 */
export async function deriveRoomSizeMm(
  projectId: string,
  baseOrPlanId: string,
): Promise<{ widthMm: number; depthMm: number } | null> {
  // 1) 開いているシーン（速い・ネットワーク不要）
  try {
    const root = layoutSceneRef.baseRoot as THREE.Object3D | null;
    if (root) {
      const box = new THREE.Box3().setFromObject(root);
      if (!box.isEmpty()) {
        const s = box.getSize(new THREE.Vector3());
        if (s.x > 1 && s.z > 1) return { widthMm: Math.round(s.x), depthMm: Math.round(s.z) };
      }
    }
  } catch { /* fallthrough */ }

  // 2) base GLB を読み込んで bbox
  try {
    const ref0 = doc(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', baseOrPlanId);
    const snap0 = await getDoc(ref0);
    const d0 = snap0.exists() ? (snap0.data() as any) : null;
    const baseId = d0?.rootBaseId || baseOrPlanId;
    const baseSnap = baseId === baseOrPlanId ? snap0 : await getDoc(doc(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', baseId));
    const bd = baseSnap?.exists() ? (baseSnap.data() as any) : null;
    const url = await resolveStorageUrl(bd?.glbUrl || bd?.asset?.glbUrl);
    if (!url) return null;
    const g = await new GLTFLoader().loadAsync(url);
    const box = new THREE.Box3().setFromObject(g.scene);
    if (box.isEmpty()) return null;
    const s = box.getSize(new THREE.Vector3());
    if (s.x > 1 && s.z > 1) return { widthMm: Math.round(s.x), depthMm: Math.round(s.z) };
    return null;
  } catch (e) {
    console.warn('[deriveRoomSizeMm] failed:', e);
    return null;
  }
}

// ── メイン ────────────────────────────────────────────────────────────────────

export async function renderLayoutHeadless(
  projectId: string,
  planId: string,   // 描画対象リーフ（Plan / Option）。家具とレンダー保存先。
  baseId: string,   // 躯体・ライティング・カメラ状態の取得元（rootBaseId）。
  count: number,
  createdBy: string,
): Promise<HeadlessRenderResult> {
  const max = Math.min(6, Math.max(1, count || 3));

  // 1. リーフ doc（家具）。対象は resolveRenderTarget で Plan/Option に解決済み。
  const planRef = doc(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', planId);
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) return { ok: false, error: `planId "${planId}" が見つかりません` };
  const planData = planSnap.data() as any;
  const items: any[] = Array.isArray(planData.layout?.items) ? planData.layout.items : [];

  // 2. base doc（躯体 GLB）→ gs:// は https ダウンロードURLへ解決。
  const baseRef = doc(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', baseId);
  const baseSnap = await getDoc(baseRef);
  const baseData = baseSnap.exists() ? (baseSnap.data() as any) : null;
  const baseGlbUrl = await resolveStorageUrl(baseData?.glbUrl || baseData?.asset?.glbUrl);
  if (!baseGlbUrl) return { ok: false, error: '躯体（base）の GLB がありません。S.Layout で躯体を作成してください。' };

  // 3. 保存済み状態（ライト・カメラ）
  const state = await loadLayoutState(projectId, WORKSPACE_ID, baseId);
  const lightsCfg: any[] = state?.lights ?? [];
  const savedShots: ShotCamera[] = (state?.shots ?? [])
    .filter((s: any) => s.kind !== 'movie' && s.camera)
    .map((s: any) => s.camera);

  // 4. レンダラ（オフスクリーン）
  const env = useViewportEnvStore.getState();
  const canvas = document.createElement('canvas');
  canvas.width = RENDER_W; canvas.height = RENDER_H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(RENDER_W, RENDER_H, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // フォトリアル既定: ビューポートが NoToneMapping のときは ACES にする（フィルミック）。
  renderer.toneMapping = env.toneMapping && env.toneMapping !== 'none'
    ? threeToneMapping(env.toneMapping)
    : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = env.exposure ?? 1;

  const scene = new THREE.Scene();
  const bgHex = useEnvironmentStore.getState().noneBackgroundColor || '#dfe5ec';
  scene.background = new THREE.Color(bgHex);

  // IBL（環境マップ）: RoomEnvironment を PMREM 化して scene.environment に設定。
  // 外部 HDRI 不要で、PBR マテリアルに柔らかな環境反射・アンビエントを与え一気にフォトリアルになる。
  let envMap: THREE.Texture | null = null;
  let pmrem: THREE.PMREMGenerator | null = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
  } catch (e) {
    console.warn('[headlessRender] IBL 構築に失敗（ライトのみで継続）:', e);
  }

  const loader = new GLTFLoader();
  const disposables: THREE.Object3D[] = [];

  try {
    // 5. 躯体
    const baseGltf = await loader.loadAsync(baseGlbUrl);
    const baseRoot = baseGltf.scene;
    pruneHelpers(baseRoot);     // 編集用ジオメトリ（線・ギズモ等）を除去
    normalizeBaseGlb(baseRoot);
    applyShadowFlags(baseRoot);
    scene.add(baseRoot);
    disposables.push(baseRoot);

    // 6. 家具アイテム
    for (const item of items) {
      const rawUrl: string | undefined = item.glbUrl || item.swapModels?.[0]?.glbUrl;
      const url = await resolveStorageUrl(rawUrl);
      if (!url) continue; // glbUrl 無し（modelId のみ）/解決失敗は v1 ではスキップ
      try {
        const g = await loader.loadAsync(url);
        const model = g.scene;
        pruneHelpers(model);

        // 底面中心へオフセット（FurnitureItem.jsx）
        const ibox = new THREE.Box3().setFromObject(model);
        const icenter = ibox.getCenter(new THREE.Vector3());
        const offset = new THREE.Group();
        offset.position.set(-icenter.x, -ibox.min.y, -icenter.z);
        offset.add(model);

        // 寸法フィット scale（dimensionsMm があれば）
        const scaleGrp = new THREE.Group();
        const dim = item.dimensionsMm;
        if (dim) {
          const isize = ibox.getSize(new THREE.Vector3());
          const sx = dim.width && isize.x ? dim.width / isize.x : 1;
          const sy = dim.height && isize.y ? dim.height / isize.y : 1;
          const sz = dim.depth && isize.z ? dim.depth / isize.z : 1;
          scaleGrp.scale.set(sx, sy, sz);
        }
        scaleGrp.add(offset);

        // item.transform（position mm / rotation rad / scale）
        const t = item.transform || {};
        const grp = new THREE.Group();
        if (Array.isArray(t.position)) grp.position.set(t.position[0], t.position[1], t.position[2]);
        if (Array.isArray(t.rotation)) grp.rotation.set(t.rotation[0] || 0, t.rotation[1] || 0, t.rotation[2] || 0);
        if (Array.isArray(t.scale)) grp.scale.set(t.scale[0] ?? 1, t.scale[1] ?? 1, t.scale[2] ?? 1);
        grp.add(scaleGrp);

        applyShadowFlags(grp);
        scene.add(grp);
        disposables.push(grp);
      } catch (e) {
        console.warn('[headlessRender] item load failed (skip):', url, e);
      }
    }

    // 躯体＋家具のジオメトリ境界（ライトを含めない＝カメラ/影のフレーミング用）。
    // ※ ライトを含めると directional(13000mm先)で境界が巨大化し、カメラが部屋外に置かれ
    //   背景だけの真っ白レンダーになる。必ずライト追加「前」に確定させる。
    const geomBox = new THREE.Box3().setFromObject(scene);
    if (geomBox.isEmpty()) {
      return { ok: false, error: 'ジオメトリを読み込めませんでした（GLB が空、または家具・躯体が見つかりません）。' };
    }

    // 7. ライト
    const casters: THREE.DirectionalLight[] = [];
    if (lightsCfg.length === 0) {
      // フォールバック（videoRenderWorker と同じ既定照明）
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.copy(dirLightPos(45, 50, 13000));
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
      scene.add(sun); casters.push(sun);
    } else {
      const wb = env.whiteBalance ?? 6500;
      for (const cfg of lightsCfg) {
        if (cfg.visible === false) continue;
        const light = lightConfigToThree(cfg, wb);
        if (!light) continue;
        scene.add(light);
        if ((light as any).isDirectionalLight) casters.push(light as THREE.DirectionalLight);
        if ((light as THREE.SpotLight).isSpotLight && (light as THREE.SpotLight).target) {
          scene.add((light as THREE.SpotLight).target);
        }
      }
    }
    fitShadowCameras(geomBox, casters);

    // 8. カメラ決定（保存アングル優先、無ければジオメトリ境界から内観アングル生成）
    let cameras = savedShots.slice(0, max);
    if (cameras.length === 0) cameras = computeDefaultCameras(geomBox, max);
    if (cameras.length === 0) return { ok: false, error: 'カメラアングルを決定できませんでした。' };

    // 9. 各カメラでレンダー → 保存
    const cam = new THREE.PerspectiveCamera(50, RENDER_W / RENDER_H, 0.01, 1_000_000);
    const renderIds: string[] = [];
    for (let i = 0; i < cameras.length; i++) {
      const s = cameras[i];
      cam.fov = s.fov || 50;
      cam.position.set(s.position[0], s.position[1], s.position[2]);
      cam.up.set(0, 1, 0);
      cam.lookAt(s.target[0], s.target[1], s.target[2]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);

      renderer.render(scene, cam);
      const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.92);

      const renderId = await saveRenderToLayout(
        dataUrl,
        { projectId, workspaceId: WORKSPACE_ID, planId, createdBy },
        { quality: 'standard', shotName: `レンダー ${i + 1}`, width: RENDER_W, height: RENDER_H, setAsHero: i === 0, mediaType: 'image' },
      );
      renderIds.push(renderId);
    }

    if (renderIds.length === 0) return { ok: false, error: 'レンダリングに失敗しました。' };

    // 10. 表示用 URL を取得
    let renders: { id: string; url: string }[] = [];
    try {
      const { getLayoutOutputs } = await import('../services/chatLayoutBridge');
      const out = await getLayoutOutputs(projectId, planId);
      const idSet = new Set(renderIds);
      renders = out.renders.filter(r => idSet.has(r.id));
    } catch { /* 非致命 */ }

    return { ok: true, planId, renderCount: renderIds.length, renderIds, renders };
  } finally {
    // 後始末（GPU リソース解放）
    disposables.forEach(o => o.traverse((c: any) => {
      if (c.geometry) c.geometry.dispose?.();
      const m = c.material;
      if (Array.isArray(m)) m.forEach((x: any) => x.dispose?.());
      else if (m) m.dispose?.();
    }));
    envMap?.dispose?.();
    pmrem?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}
