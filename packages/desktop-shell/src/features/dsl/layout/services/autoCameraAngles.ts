// autoCameraAngles.ts
// 部屋の躯体＋配置された家具（位置・高さ）から、プロのカメラマンが選ぶような
// 構図のカメラアングルを自動生成する。自動パース生成(still)／自動動画生成(movie)。
// 座標系は DSL ワールド = mm（Three.js Y-up）。
//
// v2: 家具を考慮した生成。
//   - 主要家具クラスタ（体積重み付け重心）を「被写体」として狙う（部屋の幾何中心ではなく）
//   - 目線の高さは設定（座位/立位/俯瞰/家具基準auto）
//   - 構図の寄り（wide/standard/tight）で被写体が画面を占める割合を制御
//   - 家具回避: カメラを家具の内側に置かない／部屋の内側に収める
//   - 主要家具中心の寄りカットと、部屋全体のワイドカットをミックス
import * as THREE from 'three';
import { layoutSceneRef } from './layoutSceneRef';
import { useSceneObjectRegistryStore } from '../store/sceneObjectRegistryStore';
import { useAutoAngleSettingsStore, type EyeHeight, type Framing, type AngleStyle } from '../store/useAutoAngleSettingsStore';
import type { ShotCamera, ShotKind } from '../store/useShotStore';

export interface AutoAngle {
  name: string;
  camera: ShotCamera;
  // 動画モードで割り当てるカメラの動き（preset=cameraPaths の CameraPathPreset）。
  motion?: { preset: string; intensity: number; durationSec: number };
}

function getRoomBox(): THREE.Box3 | null {
  const root = layoutSceneRef.baseRoot;
  if (root) {
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) return box;
  }
  const scene = layoutSceneRef.scene;
  if (scene) {
    const box = new THREE.Box3().setFromObject(scene);
    if (!box.isEmpty()) return box;
  }
  return null;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// 2つのカメラポーズがほぼ同じか（重複排除に使用。位置/注視点の近さで判定）
export function posesClose(a: ShotCamera, b: ShotCamera): boolean {
  const dp = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
  const dt = Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]);
  return dp < 400 && dt < 700;
}

// ─── 家具の収集（世界 AABB）────────────────────────────────────────────
interface FurnitureInfo {
  union: THREE.Box3 | null;        // 全家具の合成 AABB
  centroidX: number; centroidZ: number; // 体積重み付け重心（XZ）
  radiusXZ: number;                // 重心から家具群外周までの代表半径（XZ）
  topY: number;                    // 最も高い家具の上端 Y
  count: number;
}

function gatherFurniture(roomBox: THREE.Box3): FurnitureInfo {
  const empty: FurnitureInfo = {
    union: null,
    centroidX: (roomBox.min.x + roomBox.max.x) / 2,
    centroidZ: (roomBox.min.z + roomBox.max.z) / 2,
    radiusXZ: Math.hypot(roomBox.max.x - roomBox.min.x, roomBox.max.z - roomBox.min.z) * 0.28,
    topY: -Infinity,
    count: 0,
  };
  const objs = useSceneObjectRegistryStore.getState().getAllObjects?.() || [];
  if (!objs.length) return empty;

  const roomVol =
    (roomBox.max.x - roomBox.min.x) * (roomBox.max.y - roomBox.min.y) * (roomBox.max.z - roomBox.min.z);

  const union = new THREE.Box3();
  const tmp = new THREE.Box3();
  const c = new THREE.Vector3();
  let wcx = 0, wcz = 0, wsum = 0, topY = -Infinity, n = 0;

  for (const o of objs) {
    tmp.setFromObject(o);
    if (tmp.isEmpty() || !isFinite(tmp.min.x)) continue;
    const sx = tmp.max.x - tmp.min.x, sy = tmp.max.y - tmp.min.y, sz = tmp.max.z - tmp.min.z;
    const vol = sx * sy * sz;
    // 極小ノイズと、部屋並みの巨大物（=躯体やゾーン枠の取り違え）を除外
    if (vol <= 0 || (roomVol > 0 && vol > roomVol * 0.55)) continue;
    union.union(tmp);
    tmp.getCenter(c);
    wcx += c.x * vol; wcz += c.z * vol; wsum += vol;
    topY = Math.max(topY, tmp.max.y);
    n++;
  }

  if (!n || wsum <= 0) return empty;

  const centroidX = wcx / wsum;
  const centroidZ = wcz / wsum;
  // 半径: 重心から union 各隅までの XZ 距離の最大
  const corners: Array<[number, number]> = [
    [union.min.x, union.min.z], [union.max.x, union.min.z],
    [union.min.x, union.max.z], [union.max.x, union.max.z],
  ];
  let radiusXZ = 0;
  for (const [x, z] of corners) radiusXZ = Math.max(radiusXZ, Math.hypot(x - centroidX, z - centroidZ));
  radiusXZ = Math.max(radiusXZ, 400);

  return { union, centroidX, centroidZ, radiusXZ, topY, count: n };
}

// ─── 目線の高さ ────────────────────────────────────────────────────────
function resolveEyeY(eye: EyeHeight, floorY: number, height: number, furnTopY: number): number {
  switch (eye) {
    case 'seated': return floorY + 1150;
    case 'standing': return floorY + 1500;
    case 'overhead': return floorY + Math.min(height * 0.85, height - 200);
    case 'auto':
    default:
      // 家具基準: 最も高い家具の少し上（ただし天井寄りになり過ぎない）。家具が無ければ三脚高。
      if (isFinite(furnTopY) && furnTopY > floorY + 600) {
        return clamp(furnTopY + 250, floorY + 1100, floorY + height * 0.55);
      }
      return floorY + 1350;
  }
}

// 構図の寄り → 被写体の周囲にどれだけ余白を取るか（小さいほど画面いっぱい）
const MARGIN_BY_FRAMING: Record<Framing, number> = { wide: 1.9, standard: 1.4, tight: 1.05 };

// vfov と被写体半径から、被写体が画面に収まる距離を求める
function frameDist(vfovDeg: number, radius: number, margin: number): number {
  const half = THREE.MathUtils.degToRad(vfovDeg) / 2;
  return (radius * margin) / Math.max(Math.tan(half), 0.05);
}

/**
 * 家具・高さ・設定を考慮してプロ品質のカメラアングルを生成する。
 * 返すアングル数は設定 count。呼び出し側は重複しないものだけバッチ追加する。
 */
export function generateAutoAngles(kind: ShotKind): AutoAngle[] {
  const box = getRoomBox();
  if (!box) return [];

  const s = useAutoAngleSettingsStore.getState();
  const { eyeHeight, framing, avoidFurniture, count, style } = s;

  const { min, max } = box;
  const sizeX = max.x - min.x;
  const sizeZ = max.z - min.z;
  const floorY = min.y;
  const heightRaw = max.y - min.y;
  const height = heightRaw > 500 ? heightRaw : 2700;
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;

  const furn = gatherFurniture(box);
  const eyeY = resolveEyeY(eyeHeight, floorY, height, furn.topY);

  // 被写体（主要家具クラスタ。無ければ部屋中心）
  const subX = furn.centroidX, subZ = furn.centroidZ;
  const subjRadius = furn.radiusXZ;
  const roomRadius = Math.hypot(sizeX, sizeZ) * 0.5;
  const margin = MARGIN_BY_FRAMING[framing];

  // 部屋の内側（壁から少し離す）境界。カメラはこの中に収める。
  const insetWall = Math.min(sizeX, sizeZ) * 0.05 + 200;
  const roomMinX = min.x + insetWall, roomMaxX = max.x - insetWall;
  const roomMinZ = min.z + insetWall, roomMaxZ = max.z - insetWall;

  // FOV: 部屋サイズで標準/広角を調整（狭い部屋ほど広角）
  const sizeAdj = clamp(4500 / Math.max(Math.hypot(sizeX, sizeZ), 1500), 0.85, 1.25);
  const lens = (vfov: number) => clamp(Math.round(vfov * sizeAdj), 24, 70);

  // 家具 union を少し広げた回避ボックス（XZ）。カメラがこの内側なら外へ押し出す。
  const avoidPad = 350;
  const av = furn.union && avoidFurniture
    ? { minX: furn.union.min.x - avoidPad, maxX: furn.union.max.x + avoidPad, minZ: furn.union.min.z - avoidPad, maxZ: furn.union.max.z + avoidPad }
    : null;

  // 被写体から方向 dir（単位 XZ）へ距離 dist のカメラ位置を作り、
  // 部屋内に clamp ＋ 家具回避で外へ押し出す。
  const place = (dirX: number, dirZ: number, dist: number, originX = subX, originZ = subZ): [number, number] => {
    const len = Math.hypot(dirX, dirZ) || 1;
    const ux = dirX / len, uz = dirZ / len;
    let px = originX + ux * dist;
    let pz = originZ + uz * dist;
    // 家具回避: 回避ボックス内なら、被写体から外向きにさらに押し出す
    if (av && px > av.minX && px < av.maxX && pz > av.minZ && pz < av.maxZ) {
      // 各軸で最も近い外側へ出す
      const outX = ux >= 0 ? av.maxX : av.minX;
      const outZ = uz >= 0 ? av.maxZ : av.minZ;
      px = outX + ux * 300;
      pz = outZ + uz * 300;
    }
    px = clamp(px, roomMinX, roomMaxX);
    pz = clamp(pz, roomMinZ, roomMaxZ);
    return [px, pz];
  };

  const aimSubject: [number, number, number] = [subX, eyeY, subZ];
  const aimRoom: [number, number, number] = [cx, eyeY, cz];

  // 各カット: 被写体半径＋寄りから距離を決め、方向は部屋の隅/壁から
  const dHero = (fov: number) => frameDist(lens(fov), subjRadius, margin);
  const dWide = (fov: number) => frameDist(lens(fov), roomRadius, margin * 0.95);

  // 隅・壁の方向（XZ 単位ベクトル）
  const DIR = {
    NW: [-1, -1], NE: [1, -1], SW: [-1, 1], SE: [1, 1],
    N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0],
  } as const;

  const mk = (
    name: string, dir: readonly [number, number], fov: number,
    opts?: { y?: number; aim?: [number, number, number]; dist?: number; from?: 'subject' | 'room' }
  ): AutoAngle => {
    const f = lens(fov);
    const dist = opts?.dist ?? (opts?.from === 'room' ? dWide(fov) : dHero(fov));
    const [px, pz] = place(dir[0], dir[1], dist);
    const aim = opts?.aim ?? aimSubject;
    return { name, camera: { position: [px, opts?.y ?? eyeY, pz], target: aim, fov: f } };
  };

  // ── 家具考慮のプロ構図プール（カテゴリ付き）──
  const candidates: Record<string, AutoAngle> = {
    hero1: mk('二点透視 ①（主役）', DIR.SW, 54),
    hero2: mk('二点透視 ②（主役）', DIR.NE, 54),
    hero3: mk('二点透視 ③（主役）', DIR.SE, 52),
    onepointS: { name: '正面 一点透視', camera: { position: (() => { const [x, z] = place(DIR.S[0], DIR.S[1], dWide(50)); return [x, eyeY, z] as [number, number, number]; })(), target: [subX, eyeY, min.z + insetWall], fov: lens(50) } },
    onepointW: { name: '奥行き 一点透視', camera: { position: (() => { const [x, z] = place(DIR.W[0], DIR.W[1], dWide(50)); return [x, eyeY, z] as [number, number, number]; })(), target: [max.x - insetWall, eyeY, subZ], fov: lens(50) } },
    low: mk('ローアングル', DIR.SW, 57, { y: floorY + 650, aim: [subX, floorY + Math.min(900, height * 0.35), subZ] }),
    detail: mk('ディテール（寄り）', DIR.NE, 40, { dist: dHero(40) * 0.62 }),
    wide: mk('ワイド全景', DIR.SE, 64, { from: 'room', aim: aimRoom }),
    overhead: mk('俯瞰', DIR.NE, 48, { y: floorY + height * 0.82, aim: [subX, floorY + height * 0.30, subZ] }),
  };

  // ── スタイル別の採用順（主要家具中心 × 全体のミックス）──
  const ORDER: Record<AngleStyle, string[]> = {
    // 不動産: 広さが伝わるワイド/一点透視を厚めに、立位アイレベル
    realestate: ['wide', 'hero1', 'onepointS', 'hero2', 'onepointW', 'hero3', 'overhead', 'detail', 'low'],
    // 雑誌: 主役の二点透視＋ロー＋寄りでドラマ性、全景は控えめ
    magazine: ['hero1', 'low', 'detail', 'hero2', 'onepointS', 'overhead', 'wide', 'hero3', 'onepointW'],
    // カタログ: 寄りディテール中心＋主役カット
    catalog: ['detail', 'hero1', 'low', 'hero2', 'hero3', 'onepointS', 'wide', 'overhead', 'onepointW'],
  };

  const ordered = ORDER[style].map((k) => candidates[k]).filter(Boolean);

  // 重複排除しつつ count 件まで
  const out: AutoAngle[] = [];
  for (const a of ordered) {
    if (out.some((o) => posesClose(o.camera, a.camera))) continue;
    out.push(a);
    if (out.length >= count) break;
  }

  if (kind === 'movie') {
    // 動画：周回/スライドの起点になりやすい順（hero→onepoint→wide）に寄せる
    const movieOrder = ['hero1', 'onepointS', 'hero2', 'onepointW', 'wide', 'hero3', 'overhead', 'low'];
    const mv: AutoAngle[] = [];
    for (const k of movieOrder) {
      const a = candidates[k];
      if (!a) continue;
      if (mv.some((o) => posesClose(o.camera, a.camera))) continue;
      mv.push(a);
      if (mv.length >= count) break;
    }
    const seq = mv.length ? mv : out;
    assignSequenceMotions(seq); // 各アングルに前後考慮のカメラの動きを自動割当
    return seq;
  }

  return out;
}

// ─── 動画：前後を考慮した per-アングル カメラモーションの自動割当 ──────────────
// プロの編集パターン: 導入=引き/見渡し → 主役=弧/周回 → ディテール=ドリーズーム →
// 締め=寄り。同じ動きの連続を避け、弧/パンは方向を交互にする。
// カテゴリ（整理ダイアログ／生成時に付与）優先、無ければ名前キーワードから基準モーションを決める。
function presetForAngle(name?: string, category?: string): string {
  const c = category || '';
  if (c === '俯瞰') return 'craneDown';
  if (c === '全景') return 'pullBack';
  if (c === 'ディテール') return 'dollyZoom';
  if (c === 'ロー') return 'tiltUp';
  if (c === '内観' || c === '外観') return 'orbit';
  const s = name || '';
  if (s.includes('俯瞰')) return 'craneDown';
  if (s.includes('ワイド') || s.includes('全景')) return 'pullBack';
  if (s.includes('ディテール')) return 'dollyZoom';
  if (s.includes('ロー')) return 'tiltUp';
  if (s.includes('一点透視')) return 'pushIn';
  return 'orbit'; // 二点透視 / 主役 / 内観
}
const MOTION_ALT: Record<string, string> = {
  pushIn: 'truck', truck: 'pushIn', pullBack: 'craneDown', craneDown: 'pullBack',
  arcRight: 'arcLeft', arcLeft: 'arcRight', dollyZoom: 'pushIn', tiltUp: 'crane', orbit: 'arcRight',
};
function baseDurationForPreset(p: string): number {
  if (p === 'pullBack' || p === 'craneDown' || p === 'crane') return 5;
  if (p === 'dollyZoom') return 3.5;
  return 4; // pushIn / truck / arc / tilt / orbit
}

export interface SequenceMotion { preset: string; intensity: number; durationSec: number }

/**
 * アングル列（前後の順序）から、プロの編集パターンで per-アングルのカメラの動きを算出する。
 * 導入=引き/見渡し → 主役=弧(方向交互) → ディテール=ドリーズーム → 締め=寄り。
 * 同じ動きの連続を避け、強さは後半へ向けてランプ。生成時と動画ビルド時の両方で使う。
 */
export function computeSequenceMotions(items: Array<{ name?: string; category?: string }>): SequenceMotion[] {
  const n = items.length;
  let arcFlip = 1;
  let prev = '';
  const out: SequenceMotion[] = [];
  for (let i = 0; i < n; i++) {
    let preset = presetForAngle(items[i].name, items[i].category);
    // 周回は弧（方向交互）に置き換え（室内の周回は弧の方が破綻しにくい）
    if (preset === 'orbit') { preset = arcFlip > 0 ? 'arcRight' : 'arcLeft'; arcFlip *= -1; }
    // 先頭=導入は「引き/見渡し」寄りに
    if (i === 0 && (preset === 'pushIn' || preset === 'dollyZoom')) preset = 'pullBack';
    // 末尾=締めは「寄り」に
    if (i === n - 1 && (preset === 'pullBack' || preset === 'craneDown')) preset = 'pushIn';
    // 直前と同じ動きは避ける
    if (preset === prev) preset = MOTION_ALT[preset] || 'pushIn';
    const intensity = clamp(0.9 + (n > 1 ? i / (n - 1) : 0) * 0.25 + (preset === 'dollyZoom' ? 0.1 : 0), 0.6, 1.5);
    out.push({ preset, intensity, durationSec: baseDurationForPreset(preset) });
    prev = preset;
  }
  return out;
}

function assignSequenceMotions(angles: AutoAngle[]): void {
  const motions = computeSequenceMotions(angles.map((a) => ({ name: a.name })));
  angles.forEach((a, i) => { a.motion = motions[i]; });
}
