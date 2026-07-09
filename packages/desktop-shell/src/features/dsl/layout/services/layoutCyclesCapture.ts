/**
 * layoutCyclesCapture.ts
 *
 * Three.js シーンを GLB にエクスポートし、Blender の Cycles エンジンで
 * バックグラウンドレンダリングして PNG data URL を返す。
 *
 * ファイルシステム操作はすべて Rust 側で行うため、
 * Tauri の fs プラグイン権限は不要。
 */
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { layoutSceneRef } from './layoutSceneRef';
import type { ShotCamera } from '../store/useShotStore';
import type { CameraPath } from './cameraPaths';
import { useLightingStore } from '../store/useLightingStore';
import { useViewportEnvStore, applyWhiteBalanceToColor } from '../store/useViewportEnvStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';

export interface BlenderInfo {
  path: string;
  version: string;
}

export async function checkBlender(blenderPath?: string): Promise<BlenderInfo> {
  return invoke<BlenderInfo>('check_blender', {
    blenderPath: blenderPath ?? null,
  });
}

/** Blender ポータブル版を AppData にダウンロード・展開する。blender 実行ファイルのパスを返す。 */
export async function downloadBlender(): Promise<string> {
  return invoke<string>('download_blender');
}

/**
 * GLB に含めるべきでないオブジェクトか判定する。
 * captureLayoutPerspective（実績のあるオフスクリーン撮影）と同じ除外基準に揃える。
 * これらは「建築でない」UI/補助オブジェクトで、Cycles では描画すべきでないうえ、
 * GLTFExporter が出力するとライン/ポイント/スプライト/透明オーバーレイの
 * プリミティブが Blender の GLTF インポータをクラッシュさせる原因にもなる。
 */
function shouldExcludeFromGlb(obj: THREE.Object3D): boolean {
  const o = obj as any;
  // ライト本体（KHR_lights_punctual）。Cycles 側では scene-config（または
  // ハードコードのフォールバック）からライトを再構築するため、GLB には含めない。
  // 重要: three.js の directionalLight intensity(lux 想定) は Blender GLTF インポータが
  // lux→W に変換（÷683）するため、intensity=1.2 が ≈0.0018 W となり実質ゼロになる。
  // これを残すとフラットな環境光のみのレンダリングになってしまう。
  if (o.isLight === true) return true;
  // 環境バックドロップ（巨大な空ドーム半径800m・地面円盤）。
  // 空ドームはバウンディングを破壊しフレーミングを壊す。Cycles 側で world/地面を再構築。
  if (o.userData?.isEnvironmentBackdrop === true) return true;
  // ライトギズモ球など
  if (o.userData?.isGizmo === true) return true;
  // ライン / ライン分割 / 点群（グリッド・ゾーン枠・補助線）
  if (o.isLine === true || o.isLineSegments === true || o.isPoints === true) return true;
  // スプライト（ラベル・ギズモ）
  if (o.isSprite === true) return true;
  // UI オーバーレイメッシュ（colorWrite=false で不可視、または depthTest=false の常時前面表示）
  if ((obj as THREE.Mesh).isMesh) {
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.length > 0 && mats.every((m) => (m as THREE.Material)?.colorWrite === false)) return true;
    if (mats.some((m) => (m as THREE.Material)?.depthTest === false)) return true;
  }
  return false;
}

export async function exportSceneToGlb(): Promise<ArrayBuffer> {
  const { scene } = layoutSceneRef;
  if (!scene) throw new Error('Scene が未初期化です');

  const { GLTFExporter } = await import(
    'three/examples/jsm/exporters/GLTFExporter.js'
  );

  // 建築以外（環境バックドロップ・ギズモ・ライン/ポイント/スプライト・UIオーバーレイ）を除外する。
  // onlyVisible:true なので、エクスポート中だけ visible=false にして除外し、後で戻す。
  const hidden: THREE.Object3D[] = [];
  scene.traverse((obj: THREE.Object3D) => {
    if (obj.visible && shouldExcludeFromGlb(obj)) {
      obj.visible = false;
      hidden.push(obj);
    }
  });

  try {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const bytes = new TextEncoder().encode(JSON.stringify(result));
            resolve(bytes.buffer as ArrayBuffer);
          }
        },
        (err) => reject(err),
        { binary: true, onlyVisible: true },
      );
    });
  } finally {
    hidden.forEach((o) => { o.visible = true; });
  }
}

// ─── Scene config (lighting / environment) → Cycles ──────────────────────────
// GLB エクスポートでは欠落する情報（IBL 環境光・hemisphere/rectArea ライト・
// 地面・トーンマッピング等）を JSON にまとめて Python(render_cycles.py) に渡す。
// 色はすべて Linear RGB(0..1) に変換して渡す（Cycles のノード入力は線形空間）。

// 各 skyPreset の代表的な空の色（sRGB hex）。LandscapeBackdrop の FOG_COLOR_BY_SKY と揃える。
const SKY_COLOR_BY_PRESET: Record<string, string> = {
  park: '#b8c8d4',
  sunset: '#dca080',
  dawn: '#d4c4a8',
  night: '#1a2030',
  forest: '#9cae84',
  city: '#b0b4b8',
  apartment: '#a8a39c',
  studio: '#bcbcbc',
  warehouse: '#a4a4a0',
  lobby: '#b0aca0',
};

/** sRGB hex / THREE.Color → Cycles 用 Linear RGB [r,g,b] (0..1) */
function toLinearRGB(input: string | THREE.Color): [number, number, number] {
  const c = (input instanceof THREE.Color ? input.clone() : new THREE.Color(input)).convertSRGBToLinear();
  return [c.r, c.g, c.b];
}

export interface CyclesSceneConfig {
  lights: any[];
  environment: {
    sky: { visible: boolean; preset: string; color: [number, number, number]; backgroundColor: [number, number, number] };
    ground: { visible: boolean; color: [number, number, number]; roughness: number; radiusMm: number };
  };
  camera: { exposure: number; toneMapping: string };
}

/** 現在のエディタ状態（useLightingStore / useViewportEnvStore / useEnvironmentStore）から
 *  Cycles レンダリング用のシーン設定を組み立てる。 */
export function buildSceneConfig(): CyclesSceneConfig {
  const wb = useViewportEnvStore.getState().whiteBalance;
  const exposure = useViewportEnvStore.getState().exposure;
  const toneMapping = useViewportEnvStore.getState().toneMapping;

  const lights = useLightingStore
    .getState()
    .lights.filter((l) => l.visible)
    .map((l) => ({
      type: l.type,
      color: toLinearRGB(applyWhiteBalanceToColor(l.color ?? '#ffffff', wb)),
      intensity: l.intensity,
      // hemisphere
      groundColor: l.groundColor
        ? toLinearRGB(applyWhiteBalanceToColor(l.groundColor, wb))
        : undefined,
      // directional
      azimuth: l.azimuth,
      elevation: l.elevation,
      distance: l.distance,
      castShadow: l.castShadow,
      // spot
      position: l.position,
      targetPosition: l.targetPosition,
      angle: l.angle,
      penumbra: l.penumbra,
      decay: l.decay,
      spotDistance: l.spotDistance,
      // rect
      rectPosition: l.rectPosition,
      rectRotationX: l.rectRotationX,
      width: l.width,
      height: l.height,
      // neon
      neonPosition: l.neonPosition,
      neonRotationX: l.neonRotationX,
      neonRotationY: l.neonRotationY,
      length: l.length,
      thickness: l.thickness,
    }));

  const env = useEnvironmentStore.getState();
  const skyColorHex = SKY_COLOR_BY_PRESET[env.skyPreset] ?? '#9fc7ee';

  return {
    lights,
    environment: {
      sky: {
        visible: env.skyVisible,
        preset: env.skyPreset,
        color: toLinearRGB(skyColorHex),
        backgroundColor: toLinearRGB(env.skyBackgroundColor),
      },
      ground: {
        visible: env.landscape === 'flat' && env.flatVisible,
        color: toLinearRGB(env.flatColor),
        roughness: env.flatRoughness,
        radiusMm: 200000,
      },
    },
    camera: { exposure, toneMapping },
  };
}

/** ArrayBuffer を base64 文字列に変換（スタックオーバーフロー対策のチャンク処理）*/
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

/**
 * 指定カメラで Cycles レンダリングを実行し、結果を PNG data URL で返す。
 * GLB エクスポート・temp ファイル操作はすべて Rust 側で処理される。
 * @param camera   Shot のカメラ状態（Three.js Y-up 座標系）
 * @param blenderPath  Blender 実行ファイルのパス
 * @param samples  レンダリングサンプル数（デフォルト 128）
 */
export async function renderWithCycles(
  camera: ShotCamera,
  blenderPath: string,
  samples = 128,
): Promise<string> {
  // 1. シーンを GLB にエクスポート
  const glbBuffer = await exportSceneToGlb();

  // 2. base64 エンコード（Rust IPC 経由で渡す）
  const glbB64 = arrayBufferToBase64(glbBuffer);

  // 3. ライティング・環境設定を JSON にまとめる（GLB では欠落する情報を補完）
  const sceneConfigObj = buildSceneConfig();
  const sceneConfig = JSON.stringify(sceneConfigObj);
  // 診断: 実際に Cycles へ渡すライティング/環境設定をコンソールに出力する。
  // これが空（lights:[]）なら Lighting が反映されない原因が特定できる。
  console.log(
    '[cycles] sceneConfig →',
    `lights=${sceneConfigObj.lights.length}`,
    `types=[${sceneConfigObj.lights.map((l: any) => l.type).join(',')}]`,
    `sky.visible=${sceneConfigObj.environment.sky.visible}`,
    `ground.visible=${sceneConfigObj.environment.ground.visible}`,
    `tone=${sceneConfigObj.camera.toneMapping}`,
    `exposure=${sceneConfigObj.camera.exposure}`,
    sceneConfigObj,
  );

  // 4. Rust コマンドで Blender を起動してレンダリング（PNG base64 が返る）
  const pngB64 = await invoke<string>('render_with_cycles', {
    glbB64,
    blenderPath,
    samples,
    camPos:    camera.position,
    camTarget: camera.target,
    fov:       camera.fov,
    width:     1920,
    height:    1080,
    sceneConfig,
  });

  return `data:image/png;base64,${pngB64}`;
}

/**
 * 共通カメラパスに沿って Blender Cycles で動画（mp4）をレンダリングし、
 * 結果を mp4 data URL で返す。
 *
 * 静止画パイプライン（renderWithCycles）と構造は同じで、出力が PNG → MP4 に
 * 変わるだけ。Blender 内蔵 FFmpeg が H.264 mp4 を直接書き出すため、外部 FFmpeg
 * バイナリや PNG 連番結合は不要。
 *
 * @param path        共通カメラパス（fps / durationSec / keyframes）
 * @param blenderPath Blender 実行ファイルのパス
 * @param samples     1 フレームあたりのサンプル数（動画は軽めの既定 64）
 * @param size        出力解像度（既定 1280x720）
 */
export async function renderVideoWithCycles(
  path: CameraPath,
  blenderPath: string,
  samples = 64,
  size: { width: number; height: number } = { width: 1280, height: 720 },
): Promise<string> {
  if (!path.keyframes || path.keyframes.length === 0) {
    throw new Error('カメラパスにキーフレームがありません');
  }

  // 1. シーンを GLB にエクスポート（静止画と同じ）
  const glbBuffer = await exportSceneToGlb();
  const glbB64 = arrayBufferToBase64(glbBuffer);

  // 2. ライティング・環境設定（静止画と同じ）
  const sceneConfig = JSON.stringify(buildSceneConfig());

  // 3. 先頭キーフレームを「初期カメラ」として渡す（Python 側のフレーミング/天井隠し
  //    判定に使われる）。動き自体は cameraPath のキーフレームで決まる。
  const first = path.keyframes[0];

  // 4. Rust コマンドで Blender を起動して動画レンダリング（mp4 base64 が返る）
  const mp4B64 = await invoke<string>('render_video_with_cycles', {
    glbB64,
    blenderPath,
    samples,
    camPos:     first.position,
    camTarget:  first.target,
    fov:        first.fov,
    width:      size.width,
    height:     size.height,
    sceneConfig,
    cameraPath: JSON.stringify(path),
  });

  return `data:video/mp4;base64,${mp4B64}`;
}
