/**
 * videoRenderWorker.ts
 *
 * Web Worker: OffscreenCanvas + Three.js でフレームごとにシーンをレンダリングし、
 * PNG ArrayBuffer をメインスレッドへ転送する。
 *
 * 品質レベル（docs/13）:
 *   Level 1（速い）  — 影なし・等倍レンダリング。~0.2s/frame 目標。
 *   Level 2（高品質）— ソフトシャドウ + 2x スーパーサンプリング +
 *                      ビューポートと同じトーンマッピング/露出。~1s/frame 目標。
 *
 * メッセージプロトコル:
 *   Main → Worker:
 *     { type: 'init',   glbBuffer: ArrayBuffer, sceneConfig: CyclesSceneConfig,
 *       width: number, height: number, quality: 1 | 2 }
 *     { type: 'render', keyframes: CameraKeyframe[], fps: number, totalFrames: number }
 *     { type: 'cancel' }
 *   Worker → Main:
 *     { type: 'ready' }
 *     { type: 'frame',     index: number, total: number, data: ArrayBuffer }  // PNG バイト（transferred）
 *     { type: 'done' }
 *     { type: 'cancelled' }
 *     { type: 'error',     message: string }
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { interpolateCameraPath, type CameraKeyframe } from '../services/cameraPaths';

// ── Tone mapping（useViewportEnvStore.threeToneMapping と同じ対応表） ──────────

function toneMappingFromMode(mode: string | undefined): THREE.ToneMapping {
  switch (mode) {
    case 'aces':     return THREE.ACESFilmicToneMapping;
    case 'reinhard': return THREE.ReinhardToneMapping;
    case 'cineon':   return THREE.CineonToneMapping;
    case 'agx':      return (THREE as any).AgXToneMapping ?? THREE.ACESFilmicToneMapping;
    case 'none':
    default:         return THREE.NoToneMapping;
  }
}

// ── Lighting setup ────────────────────────────────────────────────────────────

/** ライトを構築する。Level 2 では directional に影を仕込む（シーン境界は GLB
 *  ロード後に fitShadowCameras() で確定させる）。 */
function setupLights(
  scene: THREE.Scene,
  lightsConfig: any[],
  quality: number,
): THREE.DirectionalLight[] {
  const shadowCasters: THREE.DirectionalLight[] = [];

  const addDirectional = (color: THREE.Color, intensity: number, position: THREE.Vector3, castShadow: boolean) => {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.copy(position);
    if (quality >= 2 && castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0005;
      light.shadow.normalBias = 0.02;
      shadowCasters.push(light);
    }
    scene.add(light);
  };

  if (!lightsConfig || lightsConfig.length === 0) {
    // フォールバック: ビューポートに近いデフォルト照明
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    addDirectional(new THREE.Color(0xffffff), 1.4, new THREE.Vector3(60, 120, 60), true);
    return shadowCasters;
  }

  for (const l of lightsConfig) {
    const color = new THREE.Color(l.color[0], l.color[1], l.color[2]);
    const intensity = l.intensity ?? 1;

    if (l.type === 'hemisphere') {
      const gc = l.groundColor ?? l.color;
      scene.add(new THREE.HemisphereLight(color, new THREE.Color(gc[0], gc[1], gc[2]), intensity));
    } else if (l.type === 'directional') {
      const az = ((l.azimuth ?? 45) * Math.PI) / 180;
      const el = ((l.elevation ?? 45) * Math.PI) / 180;
      const dist = l.distance ?? 200;
      const pos = new THREE.Vector3(
        dist * Math.cos(el) * Math.sin(az),
        dist * Math.sin(el),
        dist * Math.cos(el) * Math.cos(az),
      );
      addDirectional(color, intensity, pos, l.castShadow !== false);
    } else if (l.type === 'ambient') {
      scene.add(new THREE.AmbientLight(color, intensity));
    } else if (l.type === 'spot' && quality >= 2) {
      // Level 2 のみ: スポットライトも再現（Level 1 は速度優先でスキップ）
      const light = new THREE.SpotLight(
        color, intensity,
        l.spotDistance ?? 0, l.angle ?? Math.PI / 6, l.penumbra ?? 0.3, l.decay ?? 2,
      );
      if (l.position) light.position.set(l.position[0], l.position[1], l.position[2]);
      if (l.targetPosition) {
        light.target.position.set(l.targetPosition[0], l.targetPosition[1], l.targetPosition[2]);
        scene.add(light.target);
      }
      scene.add(light);
    }
    // rect / neon は Worker では未対応（Cycles のみ）
  }
  return shadowCasters;
}

/** GLB ロード後、シーン境界に合わせて directional shadow camera を設定する。 */
function fitShadowCameras(root: THREE.Object3D, casters: THREE.DirectionalLight[]): void {
  if (casters.length === 0) return;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = sphere.radius * 1.2;

  for (const light of casters) {
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.1;
    cam.far = sphere.radius * 6 + light.position.length();
    cam.updateProjectionMatrix();
    // 影カメラはシーン中心を向ける
    light.target.position.copy(sphere.center);
    light.target.updateMatrixWorld();
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let outputCanvas: OffscreenCanvas | null = null; // 出力解像度（Level 2 はダウンサンプル先）
let outputCtx: OffscreenCanvasRenderingContext2D | null = null;
let canvasWidth = 1280;
let canvasHeight = 720;
let renderScale = 1; // Level 2 = 2（スーパーサンプリング）
let cancelled = false;

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleInit(msg: any): Promise<void> {
  canvasWidth = msg.width;
  canvasHeight = msg.height;
  const quality: number = msg.quality ?? 1;
  renderScale = quality >= 2 ? 2 : 1;

  // レンダリング用キャンバス（Level 2 は 2x で描いて出力時に縮小 = SSAA）
  const offscreen = new OffscreenCanvas(canvasWidth * renderScale, canvasHeight * renderScale);

  renderer = new THREE.WebGLRenderer({
    canvas: offscreen as unknown as HTMLCanvasElement,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(canvasWidth * renderScale, canvasHeight * renderScale, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cfg = msg.sceneConfig;

  if (quality >= 2) {
    // Level 2: ソフトシャドウ + ビューポートと同じトーンマッピング/露出
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = toneMappingFromMode(cfg?.camera?.toneMapping);
    renderer.toneMappingExposure = cfg?.camera?.exposure ?? 1;
    // ダウンサンプル先（出力解像度の 2D キャンバス）
    outputCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    outputCtx = outputCanvas.getContext('2d', { alpha: false });
    if (outputCtx) {
      outputCtx.imageSmoothingEnabled = true;
      outputCtx.imageSmoothingQuality = 'high';
    }
  } else {
    renderer.shadowMap.enabled = false;
    outputCanvas = null;
    outputCtx = null;
  }

  scene = new THREE.Scene();

  // 背景色
  if (cfg?.environment?.sky?.backgroundColor) {
    const [r, g, b] = cfg.environment.sky.backgroundColor;
    scene.background = new THREE.Color(r, g, b);
  } else {
    scene.background = new THREE.Color(0.55, 0.65, 0.78);
  }

  // ライト
  const shadowCasters = setupLights(scene, cfg?.lights ?? [], quality);

  // GLB をパース
  const loader = new GLTFLoader();
  const gltf = await new Promise<any>((resolve, reject) => {
    loader.parse(msg.glbBuffer as ArrayBuffer, '', resolve, reject);
  });

  if (quality >= 2) {
    // メッシュに影の送受信を付与し、シーン境界へ影カメラをフィット
    gltf.scene.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    fitShadowCameras(gltf.scene, shadowCasters);
  }

  scene.add(gltf.scene);

  camera = new THREE.PerspectiveCamera(60, canvasWidth / canvasHeight, 0.05, 200000);

  (self as any).postMessage({ type: 'ready' });
}

async function handleRender(msg: any): Promise<void> {
  if (!renderer || !scene || !camera) {
    (self as any).postMessage({ type: 'error', message: 'レンダラーが初期化されていません' });
    return;
  }

  cancelled = false;
  const keyframes: CameraKeyframe[] = msg.keyframes;
  const totalFrames: number = msg.totalFrames;
  const renderCanvas = renderer.domElement as unknown as OffscreenCanvas;

  for (let i = 0; i < totalFrames; i++) {
    if (cancelled) {
      (self as any).postMessage({ type: 'cancelled' });
      return;
    }

    const t = totalFrames > 1 ? i / (totalFrames - 1) : 0;
    const kf = interpolateCameraPath(keyframes, t);

    camera.fov = kf.fov;
    camera.aspect = canvasWidth / canvasHeight;
    camera.updateProjectionMatrix();
    camera.position.set(kf.position[0], kf.position[1], kf.position[2]);
    camera.lookAt(new THREE.Vector3(kf.target[0], kf.target[1], kf.target[2]));

    renderer.render(scene, camera);

    // Level 2: 2x → 等倍へダウンサンプル（SSAA）。Level 1: そのまま。
    let pngSource: OffscreenCanvas = renderCanvas;
    if (outputCanvas && outputCtx) {
      outputCtx.drawImage(renderCanvas, 0, 0, canvasWidth, canvasHeight);
      pngSource = outputCanvas;
    }

    const blob = await pngSource.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await blob.arrayBuffer();

    (self as any).postMessage(
      { type: 'frame', index: i, total: totalFrames, data: arrayBuffer },
      [arrayBuffer],
    );
  }

  (self as any).postMessage({ type: 'done' });
}

// ── Message dispatcher ────────────────────────────────────────────────────────

(self as any).onmessage = async (ev: MessageEvent) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      await handleInit(msg);
    } else if (msg.type === 'render') {
      await handleRender(msg);
    } else if (msg.type === 'cancel') {
      cancelled = true;
    }
  } catch (e: any) {
    (self as any).postMessage({ type: 'error', message: String(e?.message ?? e) });
  }
};
