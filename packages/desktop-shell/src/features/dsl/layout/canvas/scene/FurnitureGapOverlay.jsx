/**
 * FurnitureGapOverlay.jsx
 *
 * 家具間の隙間（ギャップ）を黄色の破線 + mm ラベルで表示する。
 * showFurnitureGapDimensions トグルで制御。
 * useFrame でリアルタイム更新 → ギズモドラッグ中も即座に反映される。
 *
 * 座標系: Y-up (mm スケール)
 *   X = 左右, Y = 上下（高さ）, Z = 前後（奥行き）
 * ギャップ計算は XZ 平面（床平面）で行い、Y は家具の平均高さに描画する。
 *
 * 凹み形状の考慮:
 *   AABB ではなく、重なり領域内での「実際の境界」（頂点プロファイル）を使用する。
 *   L字ソファのような凹み形状でも、実際に面している部分のギャップを計測できる。
 */

import { useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useToolsStore } from "../../store/toolsStore/useToolsStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";

// ── 定数 ────────────────────────────────────────────────────────────────────
const GAP_COLOR  = "#fbbf24";
const LABEL_BG   = "rgba(14,11,3,0.9)";
const MAX_GAP_MM = 5000;
const N_PROFILE  = 14; // 境界プロファイルのビン数

// 共有バッファ (GC 削減)
const _boxA = new THREE.Box3();
const _boxB = new THREE.Box3();
const _tmpV = new THREE.Vector3();

// ── 境界プロファイル ─────────────────────────────────────────────────────────
/**
 * 家具オブジェクトの頂点から XZ 境界プロファイルを構築する。
 * rightX[zi] = Zビン zi での最大X（右境界）
 * leftX[zi]  = Zビン zi での最小X（左境界）
 * topZ[xi]   = Xビン xi での最大Z（前境界）
 * botZ[xi]   = Xビン xi での最小Z（後境界）
 * 頂点が取れない場合は null を返す（AABB にフォールバック）。
 */
function buildProfile(obj, box) {
  const { min, max } = box;
  const sX = max.x - min.x, sZ = max.z - min.z;
  if (sX < 10 || sZ < 10) return null;

  const rightX = new Float32Array(N_PROFILE).fill(-Infinity);
  const leftX  = new Float32Array(N_PROFILE).fill(Infinity);
  const topZ   = new Float32Array(N_PROFILE).fill(-Infinity);
  const botZ   = new Float32Array(N_PROFILE).fill(Infinity);

  let count = 0;
  obj.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    const pos = child.geometry.attributes.position;
    const step = Math.max(1, Math.ceil(pos.count / 1000));
    for (let i = 0; i < pos.count; i += step) {
      _tmpV.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      const zi = Math.min(N_PROFILE - 1, Math.max(0, Math.floor((((_tmpV.z - min.z) / sZ)) * N_PROFILE)));
      const xi = Math.min(N_PROFILE - 1, Math.max(0, Math.floor((((_tmpV.x - min.x) / sX)) * N_PROFILE)));
      if (_tmpV.x > rightX[zi]) rightX[zi] = _tmpV.x;
      if (_tmpV.x < leftX[zi])  leftX[zi]  = _tmpV.x;
      if (_tmpV.z > topZ[xi])   topZ[xi]   = _tmpV.z;
      if (_tmpV.z < botZ[xi])   botZ[xi]   = _tmpV.z;
      count++;
    }
  });

  if (count < 4) return null;
  return { rightX, leftX, topZ, botZ, min, max, sX, sZ };
}

/**
 * プロファイルから、指定した範囲での境界値を取得する。
 * dir: '+x' → 右境界（rightX）, '-x' → 左境界（leftX）, '+z' → 前境界（topZ）, '-z' → 後境界（botZ）
 * rangeMin/rangeMax: 走査する他軸の世界座標範囲
 */
function profileEdge(profile, dir, rangeMin, rangeMax) {
  if (!profile) return null;
  const { min, sX, sZ } = profile;

  if (dir === '+x' || dir === '-x') {
    // Z範囲 [rangeMin, rangeMax] 内で右/左の境界を返す
    const arr = dir === '+x' ? profile.rightX : profile.leftX;
    let best = dir === '+x' ? -Infinity : Infinity;
    const binW = sZ / N_PROFILE;
    for (let zi = 0; zi < N_PROFILE; zi++) {
      const zCenter = profile.min.z + (zi + 0.5) * binW;
      if (zCenter < rangeMin - binW || zCenter > rangeMax + binW) continue;
      const v = arr[zi];
      if (v === -Infinity || v === Infinity) continue;
      if (dir === '+x' && v > best) best = v;
      if (dir === '-x' && v < best) best = v;
    }
    if (best === -Infinity) best = profile.max.x;
    if (best === Infinity)  best = profile.min.x;
    return best;
  } else {
    // X範囲 [rangeMin, rangeMax] 内で前/後の境界を返す
    const arr = dir === '+z' ? profile.topZ : profile.botZ;
    let best = dir === '+z' ? -Infinity : Infinity;
    const binW = sX / N_PROFILE;
    for (let xi = 0; xi < N_PROFILE; xi++) {
      const xCenter = min.x + (xi + 0.5) * binW;
      if (xCenter < rangeMin - binW || xCenter > rangeMax + binW) continue;
      const v = arr[xi];
      if (v === -Infinity || v === Infinity) continue;
      if (dir === '+z' && v > best) best = v;
      if (dir === '-z' && v < best) best = v;
    }
    if (best === -Infinity) best = profile.max.z;
    if (best === Infinity)  best = profile.min.z;
    return best;
  }
}

// ── ギャップ計算 ─────────────────────────────────────────────────────────────
/**
 * 2つの家具間の実際のギャップを計算する。
 * プロファイルが利用可能な場合は重なり領域内の「実際の境界」を使用し、
 * L字などの凹み形状でも正確なギャップを計測する。
 */
function computeBoxGaps(idA, boxA, profA, idB, boxB, profB) {
  const ax1 = boxA.min.x, ax2 = boxA.max.x;
  const az1 = boxA.min.z, az2 = boxA.max.z;
  const bx1 = boxB.min.x, bx2 = boxB.max.x;
  const bz1 = boxB.min.z, bz2 = boxB.max.z;
  const lineY = (boxA.min.y + boxA.max.y + boxB.min.y + boxB.max.y) / 4;
  const results = [];

  // ── X 方向ギャップ（横並び） ───────────────────────────────────────
  const overlapZMin = Math.max(az1, bz1);
  const overlapZMax = Math.min(az2, bz2);
  if (overlapZMax > overlapZMin) {
    const zc = (overlapZMin + overlapZMax) / 2;

    if (bx1 > ax2 - 1) {
      // B が A の右側 → A の右境界と B の左境界
      const aEdge = profileEdge(profA, '+x', overlapZMin, overlapZMax) ?? ax2;
      const bEdge = profileEdge(profB, '-x', overlapZMin, overlapZMax) ?? bx1;
      const gap = bEdge - aEdge;
      if (gap > 0 && gap <= MAX_GAP_MM) {
        results.push({
          key: `${idA}:${idB}:x`,
          p1: new THREE.Vector3(aEdge, lineY, zc),
          p2: new THREE.Vector3(bEdge, lineY, zc),
          mid: new THREE.Vector3((aEdge + bEdge) / 2, lineY, zc),
          mm: Math.round(gap),
        });
      }
    } else if (ax1 > bx2 - 1) {
      // A が B の右側 → B の右境界と A の左境界
      const bEdge = profileEdge(profB, '+x', overlapZMin, overlapZMax) ?? bx2;
      const aEdge = profileEdge(profA, '-x', overlapZMin, overlapZMax) ?? ax1;
      const gap = aEdge - bEdge;
      if (gap > 0 && gap <= MAX_GAP_MM) {
        results.push({
          key: `${idA}:${idB}:x`,
          p1: new THREE.Vector3(bEdge, lineY, zc),
          p2: new THREE.Vector3(aEdge, lineY, zc),
          mid: new THREE.Vector3((bEdge + aEdge) / 2, lineY, zc),
          mm: Math.round(gap),
        });
      }
    }
  }

  // ── Z 方向ギャップ（前後並び） ────────────────────────────────────
  const overlapXMin = Math.max(ax1, bx1);
  const overlapXMax = Math.min(ax2, bx2);
  if (overlapXMax > overlapXMin) {
    const xc = (overlapXMin + overlapXMax) / 2;

    if (bz1 > az2 - 1) {
      // B が A の前側 → A の前境界と B の後境界
      const aEdge = profileEdge(profA, '+z', overlapXMin, overlapXMax) ?? az2;
      const bEdge = profileEdge(profB, '-z', overlapXMin, overlapXMax) ?? bz1;
      const gap = bEdge - aEdge;
      if (gap > 0 && gap <= MAX_GAP_MM) {
        results.push({
          key: `${idA}:${idB}:z`,
          p1: new THREE.Vector3(xc, lineY, aEdge),
          p2: new THREE.Vector3(xc, lineY, bEdge),
          mid: new THREE.Vector3(xc, lineY, (aEdge + bEdge) / 2),
          mm: Math.round(gap),
        });
      }
    } else if (az1 > bz2 - 1) {
      // A が B の前側 → B の前境界と A の後境界
      const bEdge = profileEdge(profB, '+z', overlapXMin, overlapXMax) ?? bz2;
      const aEdge = profileEdge(profA, '-z', overlapXMin, overlapXMax) ?? az1;
      const gap = aEdge - bEdge;
      if (gap > 0 && gap <= MAX_GAP_MM) {
        results.push({
          key: `${idA}:${idB}:z`,
          p1: new THREE.Vector3(xc, lineY, bEdge),
          p2: new THREE.Vector3(xc, lineY, aEdge),
          mid: new THREE.Vector3(xc, lineY, (bEdge + aEdge) / 2),
          mm: Math.round(gap),
        });
      }
    }
  }

  return results;
}

function recomputeGaps() {
  const { map: objectsById } = useSceneObjectRegistryStore.getState();
  if (!objectsById || objectsById.size < 2) return [];

  const entries = [];
  for (const [id, obj] of objectsById.entries()) {
    if (!obj || obj.visible === false) continue;
    obj.updateWorldMatrix(true, true);
    _boxA.setFromObject(obj);
    if (_boxA.isEmpty()) continue;
    const box = _boxA.clone();
    const prof = buildProfile(obj, box);
    entries.push({ id, box, prof });
  }

  const next = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      next.push(...computeBoxGaps(
        entries[i].id, entries[i].box, entries[i].prof,
        entries[j].id, entries[j].box, entries[j].prof,
      ));
    }
  }
  return next;
}

// ── コンポーネント ──────────────────────────────────────────────────────────

export default function FurnitureGapOverlay() {
  const show = useToolsStore((s) => s.showFurnitureGapDimensions);
  const [gaps, setGaps] = useState([]);
  const frameCountRef = useRef(0);

  // useFrame: 4フレームに1回（約15fps）更新
  useFrame(() => {
    if (!show) return;
    frameCountRef.current += 1;
    if (frameCountRef.current % 4 !== 0) return;
    setGaps(recomputeGaps());
  });

  if (!show || gaps.length === 0) return null;

  return (
    <group>
      {gaps.map((g) => (
        <group key={g.key}>
          <Line
            points={[g.p1, g.p2]}
            color={GAP_COLOR}
            lineWidth={1.3}
            dashed
            dashSize={80}
            gapSize={50}
            transparent
            opacity={0.9}
            depthTest={false}
            renderOrder={9997}
          />
          <Html
            position={[g.mid.x, g.mid.y, g.mid.z]}
            center
            zIndexRange={[100, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div style={{
              background: LABEL_BG,
              color: GAP_COLOR,
              font: "600 10px/1 ui-monospace, SFMono-Regular, monospace",
              padding: "2px 5px",
              borderRadius: 3,
              whiteSpace: "nowrap",
              border: `1px solid ${GAP_COLOR}55`,
            }}>
              {g.mm}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
