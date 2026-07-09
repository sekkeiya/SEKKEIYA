/**
 * cameraPaths.ts
 *
 * 動画生成のための「共通カメラパス JSON」を組み立てる。
 *
 * 設計方針:
 *   1 つの汎用フォーマット CameraPath（fps / durationSec / keyframes[]）さえ
 *   作れば、どんなカメラの動きも表現できる。プリセット（pushIn / truck / crane /
 *   orbit / shots）は「keyframes の作り方」が違うだけ。プリセットを足したい場合は
 *   この файл に生成関数を 1 つ追加するだけでよい。
 *
 *   座標系は Three.js（Y-up）のまま。Blender 側（render_cycles.py）が
 *   threejs_to_blender() で各キーフレームを変換する。
 */
import type { ShotCamera } from '../store/useShotStore';

export type CameraPathPreset =
  | 'pushIn'
  | 'pullBack'
  | 'boomerang'
  | 'zoomIn'
  | 'zoomOut'
  | 'dollyZoom'
  | 'truck'
  | 'panRight'
  | 'panLeft'
  | 'tiltUp'
  | 'tiltDown'
  | 'crane'
  | 'craneDown'
  | 'arcRight'
  | 'arcLeft'
  | 'orbit'
  | 'orbit360'
  | 'shots';

export interface CameraKeyframe {
  /** 正規化時間 0..1（0 = 開始、1 = 終了） */
  t: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface CameraPath {
  fps: number;
  durationSec: number;
  keyframes: CameraKeyframe[];
}

export interface BuildCameraPathOptions {
  durationSec: number;
  fps?: number;
  /** プリセットごとの移動量スケール（既定 1.0）。0.4 なら控えめ、1.5 なら大きく動く。 */
  intensity?: number;
}

export const CAMERA_PATH_PRESETS: { id: CameraPathPreset; label: string; hint: string; minShots: number }[] = [
  // ── 前後 ─────────────────────────────────────────────────────────────────
  { id: 'pushIn',    label: 'プッシュイン',          hint: 'ターゲットへゆっくり前進',                minShots: 1 },
  { id: 'pullBack',  label: 'プルバック',             hint: '後退しながら全体を見せる',                minShots: 1 },
  { id: 'boomerang', label: 'ブーメラン',             hint: '前進してから元の位置へ引く往復移動',       minShots: 1 },
  // ── 光学ズーム ────────────────────────────────────────────────────────────
  { id: 'zoomIn',    label: 'ズームイン',             hint: 'カメラ固定で画角を絞って寄る',            minShots: 1 },
  { id: 'zoomOut',   label: 'ズームアウト',           hint: 'カメラ固定で画角を広げて引く',            minShots: 1 },
  { id: 'dollyZoom', label: 'ドリーズーム',           hint: '前進しつつ画角を広げる映画的演出',         minShots: 1 },
  // ── 横移動 / 首振り ───────────────────────────────────────────────────────
  { id: 'truck',     label: 'トラック',               hint: '横へ平行移動（左右スイング）',             minShots: 1 },
  { id: 'panRight',  label: 'パン右',                 hint: 'カメラ固定・視線を右へ振る',              minShots: 1 },
  { id: 'panLeft',   label: 'パン左',                 hint: 'カメラ固定・視線を左へ振る',              minShots: 1 },
  // ── 縦チルト ─────────────────────────────────────────────────────────────
  { id: 'tiltUp',    label: 'チルトアップ',           hint: 'カメラ固定・視線を上へ（天井・空を見上げる）', minShots: 1 },
  { id: 'tiltDown',  label: 'チルトダウン',           hint: 'カメラ固定・視線を下へ（床・地面を見下ろす）', minShots: 1 },
  // ── 高さ ─────────────────────────────────────────────────────────────────
  { id: 'crane',     label: 'クレーンアップ',         hint: '上昇しながら見下ろし',                    minShots: 1 },
  { id: 'craneDown', label: 'クレーンダウン',         hint: '下降しながら目線の高さへ',                minShots: 1 },
  // ── 弧 / 周回 ────────────────────────────────────────────────────────────
  { id: 'arcRight',  label: 'アーク右',               hint: 'ターゲット周りを右へ90°弧を描いて移動',    minShots: 1 },
  { id: 'arcLeft',   label: 'アーク左',               hint: 'ターゲット周りを左へ90°弧を描いて移動',    minShots: 1 },
  { id: 'orbit',     label: 'オービット',             hint: 'ターゲット周りを左右60°回り込む',         minShots: 1 },
  { id: 'orbit360',  label: 'オービット360°',         hint: 'ターゲットの周りをぐるりと一周',          minShots: 1 },
  // ── 複数Shot ─────────────────────────────────────────────────────────────
  { id: 'shots',     label: 'Shot間フライスルー',     hint: '選択した複数Shotを順に補間',              minShots: 2 },
];

// ── キーフレーム補間（Worker レンダリングとビューポートプレビューで共用） ──────

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerpNum(a[0], b[0], t), lerpNum(a[1], b[1], t), lerpNum(a[2], b[2], t)];
}

/** 正規化時間 t (0..1) におけるカメラ姿勢をキーフレーム列から線形補間する。 */
export function interpolateCameraPath(keyframes: CameraKeyframe[], t: number): CameraKeyframe {
  t = Math.max(0, Math.min(1, t));
  if (keyframes.length === 1) return keyframes[0];

  let a = keyframes[0];
  let b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
      a = keyframes[i];
      b = keyframes[i + 1];
      break;
    }
  }

  const span = b.t - a.t;
  const lt = span > 0 ? (t - a.t) / span : 0;
  return {
    t,
    position: lerpVec3(a.position, b.position, lt),
    target: lerpVec3(a.target, b.target, lt),
    fov: lerpNum(a.fov, b.fov, lt),
  };
}

// ── ベクトル小道具（Three.js Y-up） ─────────────────────────────────────────────
type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
};
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Y 軸（ワールド up）回りに p を center 周りで angle ラジアン回転 */
function rotateAroundY(p: V3, center: V3, angle: number): V3 {
  const d = sub(p, center);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = d[0] * c - d[2] * s;
  const z = d[0] * s + d[2] * c;
  return add(center, [x, d[1], z]);
}

// ── 各プリセットの keyframe 生成 ────────────────────────────────────────────────

function pushInKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  const fwd = sub(cam.target, cam.position); // 視線方向
  const move = scale(fwd, 0.45 * intensity); // ターゲットへ向けて距離の 45% 前進
  return [
    { t: 0, position: cam.position, target: cam.target, fov: cam.fov },
    { t: 1, position: add(cam.position, move), target: cam.target, fov: cam.fov },
  ];
}

function pullBackKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  const fwd = sub(cam.target, cam.position);
  const move = scale(fwd, -0.6 * intensity); // ターゲットから距離の 60% 後退
  return [
    { t: 0, position: cam.position, target: cam.target, fov: cam.fov },
    { t: 1, position: add(cam.position, move), target: cam.target, fov: cam.fov },
  ];
}

function zoomInKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  // カメラ位置は固定、FOV を絞って光学ズームのように寄る
  const endFov = Math.max(15, cam.fov * (1 - 0.45 * intensity));
  return [
    { t: 0, position: cam.position, target: cam.target, fov: cam.fov },
    { t: 1, position: cam.position, target: cam.target, fov: endFov },
  ];
}

function dollyZoomKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  // 前進しながら FOV を広げ、ターゲットの見かけサイズを保ったまま
  // 背景が引き伸ばされる（ヒッチコック・ズーム）。FOV は tan 補正で厳密に算出。
  const steps = 9;
  const fwd = sub(cam.target, cam.position);
  const frac = 0.45 * intensity; // 前進する距離割合
  const halfTan0 = Math.tan(((cam.fov * Math.PI) / 180) / 2);
  const kfs: CameraKeyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    const k = frac * f;
    const dScale = Math.max(0.2, 1 - k); // 残距離比（寄りすぎ防止）
    const fovDeg = Math.min(110, (2 * Math.atan(halfTan0 / dScale) * 180) / Math.PI);
    kfs.push({ t: f, position: add(cam.position, scale(fwd, k)), target: cam.target, fov: fovDeg });
  }
  return kfs;
}

function truckKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  const fwd = norm(sub(cam.target, cam.position));
  const up: V3 = [0, 1, 0];
  let right = norm(cross(fwd, up));
  if (len(right) < 1e-6) right = [1, 0, 0]; // 真上/真下視のフォールバック
  const dist = len(sub(cam.target, cam.position));
  const shift = scale(right, dist * 0.4 * intensity);
  // カメラとターゲットを同量だけ横に動かす（パン無しの純トラッキング）
  return [
    { t: 0, position: sub(cam.position, scale(shift, 0.5)), target: sub(cam.target, scale(shift, 0.5)), fov: cam.fov },
    { t: 1, position: add(cam.position, scale(shift, 0.5)), target: add(cam.target, scale(shift, 0.5)), fov: cam.fov },
  ];
}

function craneKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  const dist = len(sub(cam.target, cam.position));
  const rise: V3 = [0, dist * 0.5 * intensity, 0]; // 上昇
  // 上昇しながらターゲットを見続ける → 自然に俯瞰になる
  return [
    { t: 0, position: cam.position, target: cam.target, fov: cam.fov },
    { t: 1, position: add(cam.position, rise), target: cam.target, fov: cam.fov },
  ];
}

/** direction: +1 = 右へ振る、-1 = 左へ振る */
function panKeyframes(cam: ShotCamera, intensity: number, direction: 1 | -1): CameraKeyframe[] {
  const totalAngle = (Math.PI / 4) * intensity * direction; // 既定 45°
  const steps = 9;
  const kfs: CameraKeyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    kfs.push({
      t: f,
      position: cam.position,
      target: rotateAroundY(cam.target, cam.position, totalAngle * f),
      fov: cam.fov,
    });
  }
  return kfs;
}

function tiltKeyframes(cam: ShotCamera, intensity: number, direction: 1 | -1): CameraKeyframe[] {
  // カメラ位置固定、水平方向を維持しながら仰角を変えて視線を上下に振る
  const fwd = sub(cam.target, cam.position);
  const fwd2d = Math.hypot(fwd[0], fwd[2]);
  const hdir: V3 = fwd2d > 1e-6 ? [fwd[0] / fwd2d, 0, fwd[2] / fwd2d] : [1, 0, 0];
  const dist = len(fwd);
  const currentPitch = Math.atan2(fwd[1], Math.max(fwd2d, 1e-6));
  const totalAngle = (Math.PI / 4) * intensity * direction; // 既定 45°
  const steps = 9;
  const kfs: CameraKeyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    const pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05,
      currentPitch + totalAngle * f));
    const newTarget: V3 = [
      cam.position[0] + hdir[0] * Math.cos(pitch) * dist,
      cam.position[1] + Math.sin(pitch) * dist,
      cam.position[2] + hdir[2] * Math.cos(pitch) * dist,
    ];
    kfs.push({ t: f, position: cam.position, target: newTarget, fov: cam.fov });
  }
  return kfs;
}

/** direction: +1 = 右弧（CCW from above）、-1 = 左弧 */
function arcKeyframes(cam: ShotCamera, intensity: number, direction: 1 | -1): CameraKeyframe[] {
  const totalAngle = (Math.PI / 2) * intensity * direction; // 既定 90°
  const steps = 13;
  const kfs: CameraKeyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    kfs.push({
      t: f,
      position: rotateAroundY(cam.position, cam.target, totalAngle * f),
      target: cam.target,
      fov: cam.fov,
    });
  }
  return kfs;
}

function zoomOutKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  // カメラ位置固定、FOV を広げて光学ズームアウト
  const endFov = Math.min(100, cam.fov * (1 + 0.5 * intensity));
  return [
    { t: 0, position: cam.position, target: cam.target, fov: cam.fov },
    { t: 1, position: cam.position, target: cam.target, fov: endFov },
  ];
}

function boomerangKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  // 前進してから元位置を少し越えて引く往復
  const fwd = sub(cam.target, cam.position);
  const inPos = add(cam.position, scale(fwd, 0.35 * intensity));
  const outPos = add(cam.position, scale(fwd, -0.15 * intensity));
  return [
    { t: 0,    position: cam.position, target: cam.target, fov: cam.fov },
    { t: 0.45, position: inPos,        target: cam.target, fov: cam.fov },
    { t: 1,    position: outPos,       target: cam.target, fov: cam.fov },
  ];
}

function craneDownKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  const dist = len(sub(cam.target, cam.position));
  // 床下に潜らないよう下降量をカメラ高さでクランプ
  const drop = Math.max(0, Math.min(cam.position[1] - 0.3, dist * 0.5 * intensity));
  return [
    { t: 0, position: cam.position, target: cam.target, fov: cam.fov },
    { t: 1, position: add(cam.position, [0, -drop, 0]), target: cam.target, fov: cam.fov },
  ];
}

function orbit360Keyframes(cam: ShotCamera): CameraKeyframe[] {
  // ターゲットの周りを一周（10°刻みで滑らかに）
  const steps = 37;
  const kfs: CameraKeyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    kfs.push({
      t: f,
      position: rotateAroundY(cam.position, cam.target, Math.PI * 2 * f),
      target: cam.target,
      fov: cam.fov,
    });
  }
  return kfs;
}

function orbitKeyframes(cam: ShotCamera, intensity: number): CameraKeyframe[] {
  const totalAngle = (Math.PI / 3) * intensity; // 既定 60°
  const steps = 9;
  const kfs: CameraKeyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    const angle = -totalAngle / 2 + totalAngle * f;
    kfs.push({
      t: f,
      position: rotateAroundY(cam.position, cam.target, angle),
      target: cam.target,
      fov: cam.fov,
    });
  }
  return kfs;
}

function shotsKeyframes(cams: ShotCamera[]): CameraKeyframe[] {
  const n = cams.length;
  return cams.map((c, i) => ({
    t: n > 1 ? i / (n - 1) : 0,
    position: c.position,
    target: c.target,
    fov: c.fov,
  }));
}

/**
 * プリセットと選択カメラから共通カメラパスを組み立てる。
 * 単一Shot系プリセット（pushIn/truck/crane/orbit）は cameras[0] を起点に使う。
 * shots プリセットは cameras 全体を順に補間する。
 */
export function buildCameraPath(
  preset: CameraPathPreset,
  cameras: ShotCamera[],
  opts: BuildCameraPathOptions,
): CameraPath {
  if (cameras.length === 0) {
    throw new Error('カメラパス生成にはShotが1つ以上必要です');
  }
  const fps = opts.fps ?? 30;
  const durationSec = Math.max(1, opts.durationSec);
  const intensity = opts.intensity ?? 1.0;
  const base = cameras[0];

  let keyframes: CameraKeyframe[];
  switch (preset) {
    case 'pushIn':    keyframes = pushInKeyframes(base, intensity);    break;
    case 'pullBack':  keyframes = pullBackKeyframes(base, intensity);  break;
    case 'boomerang': keyframes = boomerangKeyframes(base, intensity); break;
    case 'zoomIn':    keyframes = zoomInKeyframes(base, intensity);    break;
    case 'zoomOut':   keyframes = zoomOutKeyframes(base, intensity);   break;
    case 'dollyZoom': keyframes = dollyZoomKeyframes(base, intensity); break;
    case 'truck':     keyframes = truckKeyframes(base, intensity);     break;
    case 'panRight':  keyframes = panKeyframes(base, intensity,  1);   break;
    case 'panLeft':   keyframes = panKeyframes(base, intensity, -1);   break;
    case 'tiltUp':    keyframes = tiltKeyframes(base, intensity,  1);  break;
    case 'tiltDown':  keyframes = tiltKeyframes(base, intensity, -1);  break;
    case 'crane':     keyframes = craneKeyframes(base, intensity);     break;
    case 'craneDown': keyframes = craneDownKeyframes(base, intensity); break;
    case 'arcRight':  keyframes = arcKeyframes(base, intensity,  1);   break;
    case 'arcLeft':   keyframes = arcKeyframes(base, intensity, -1);   break;
    case 'orbit':     keyframes = orbitKeyframes(base, intensity);     break;
    case 'orbit360':  keyframes = orbit360Keyframes(base);             break;
    case 'shots':
      if (cameras.length < 2) throw new Error('Shot間フライスルーには2つ以上のShotが必要です');
      keyframes = shotsKeyframes(cameras);
      break;
    default: keyframes = pushInKeyframes(base, intensity);
  }

  return { fps, durationSec, keyframes };
}

/** per-アングルのモーション指定（cameraPaths の preset 名）。 */
export interface SegmentMotion {
  preset: CameraPathPreset | string;
  intensity: number;
  durationSec: number;
}

/**
 * 複数アングルを、各アングル固有のカメラの動き（motion）で連結した1本のカメラパスにする。
 * 各クリップの間に短いトランジション時間を挟み、前のクリップ終端 → 次のクリップ始端へ
 * カメラが滑らかに飛んで繋がる（レンダラのキーフレーム補間に委ねる）。
 * motion が無いアングルは fallback（グローバル設定）を使う。
 */
export function buildSequencePath(
  segments: { camera: ShotCamera; motion?: SegmentMotion }[],
  fallback: SegmentMotion,
  fps = 30,
  transitionSec = 0.6,
): CameraPath {
  if (segments.length === 0) throw new Error('カメラパス生成にはShotが1つ以上必要です');

  // 各セグメントのクリップ（ローカル t 0..1）と尺を作る
  const clips = segments.map((seg) => {
    const m = seg.motion ?? fallback;
    const dur = Math.max(1, m.durationSec || fallback.durationSec || 4);
    const clip = buildCameraPath((m.preset as CameraPathPreset) || 'pushIn', [seg.camera], {
      durationSec: dur, fps, intensity: m.intensity ?? 1.0,
    });
    return { clip, dur };
  });

  const total = clips.reduce((a, c) => a + c.dur, 0) + transitionSec * Math.max(0, clips.length - 1);

  // グローバル時間軸（秒）へ展開 → 最後に t = time/total へ正規化
  const timed: Array<{ time: number; kf: CameraKeyframe }> = [];
  let cursor = 0;
  clips.forEach(({ clip, dur }, i) => {
    for (const kf of clip.keyframes) {
      timed.push({ time: cursor + kf.t * dur, kf });
    }
    cursor += dur;
    if (i < clips.length - 1) cursor += transitionSec; // 次クリップとの間（飛び移りトランジション）
  });

  const keyframes: CameraKeyframe[] = timed
    .sort((a, b) => a.time - b.time)
    .map(({ time, kf }) => ({ t: total > 0 ? time / total : 0, position: kf.position, target: kf.target, fov: kf.fov }));

  return { fps, durationSec: total, keyframes };
}
