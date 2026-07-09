// floorScan.js
//
// 読み込んだ Base モデルを「3Dスキャン」して床面を自動検出し、
// ウォークスルー用の不可視コリジョン平面を生成する。
//
// 仕組み：
//   - モデルのバウンディングを XZ グリッドに分割し、各セルで真上から下方向へ
//     レイキャスト（断面スキャン）。
//   - 上向き（|normal.y| > 0.5）にヒットした点の Y 値をヒストグラム化し、
//     一定面積以上に広がる Y レベルを「床」とみなす（家具天面などの小面積は除外）。
//   - 各床レベルに、その検出範囲を覆う薄い不可視 Mesh（法線=上）を作る。
//
// 生成平面は baseColliders に足すだけで、既存の castFloor / 重力スナップが
// そのまま拾う（法線が壊れた Rhino 床や床メッシュ欠落でも落下しなくなる）。

import * as THREE from "three";

/**
 * @param {{ colliders: THREE.Object3D[], grid?: number, debug?: boolean }} args
 * @returns {{ levels: number[], planes: THREE.Mesh[], unitsPerMeter: number }}
 */
export function scanFloors({ colliders, grid = 24, debug = false }) {
  const result = { levels: [], planes: [], unitsPerMeter: 1 };
  if (!colliders || !colliders.length) return result;

  // 全体バウンディング
  const box = new THREE.Box3();
  colliders.forEach((c) => box.expandByObject(c));
  if (box.isEmpty()) return result;

  const minX = box.min.x, maxX = box.max.x;
  const minZ = box.min.z, maxZ = box.max.z;
  const minY = box.min.y, maxY = box.max.y;
  const spanX = maxX - minX, spanZ = maxZ - minZ, spanY = maxY - minY;
  if (spanX <= 1e-6 || spanZ <= 1e-6) return result;

  // mm スケール判定（BaseGlb と同じ: 高さ100超で mm とみなす）
  const unitsPerMeter = spanY > 100 ? 1000 : 1;
  result.unitsPerMeter = unitsPerMeter;

  const N = Math.max(8, Math.min(40, grid | 0));
  const totalCells = N * N;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const startY = maxY + Math.max(0.5 * unitsPerMeter, spanY * 0.1);
  const binSize = Math.max(1e-4, 0.12 * unitsPerMeter); // 12cm 刻み
  const UP_MIN = 0.5;

  // bin -> { count, sumY, minX, maxX, minZ, maxZ }
  const bins = new Map();

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = minX + ((i + 0.5) / N) * spanX;
      const z = minZ + ((j + 0.5) / N) * spanZ;
      ray.set(new THREE.Vector3(x, startY, z), down);
      const hits = ray.intersectObjects(colliders, true);
      for (const h of hits) {
        let ny = 1;
        if (h.face) ny = h.face.normal.clone().transformDirection(h.object.matrixWorld).y;
        if (Math.abs(ny) < UP_MIN) continue; // 壁など縦面は床ではない
        const y = h.point.y;
        const bin = Math.round(y / binSize);
        let e = bins.get(bin);
        if (!e) { e = { count: 0, sumY: 0, minX: x, maxX: x, minZ: z, maxZ: z }; bins.set(bin, e); }
        e.count++; e.sumY += y;
        if (x < e.minX) e.minX = x; if (x > e.maxX) e.maxX = x;
        if (z < e.minZ) e.minZ = z; if (z > e.maxZ) e.maxZ = z;
        // 同一セルで上向き面は1つ拾えば十分（多層は別 bin が拾う）
        break;
      }
    }
  }
  if (!bins.size) return result;

  // 隣接 bin をマージ（±1 bin はノイズとして統合）
  const sorted = [...bins.entries()].sort((a, b) => a[0] - b[0]);
  const groups = [];
  for (const [bin, e] of sorted) {
    const last = groups[groups.length - 1];
    if (last && bin - last.bin <= 1) {
      last.count += e.count; last.sumY += e.sumY; last.bin = bin;
      last.minX = Math.min(last.minX, e.minX); last.maxX = Math.max(last.maxX, e.maxX);
      last.minZ = Math.min(last.minZ, e.minZ); last.maxZ = Math.max(last.maxZ, e.maxZ);
    } else {
      groups.push({ bin, count: e.count, sumY: e.sumY, minX: e.minX, maxX: e.maxX, minZ: e.minZ, maxZ: e.maxZ });
    }
  }

  // 床判定: 一定面積以上に広がるレベルのみ（家具天面など小面積を除外）
  const minSupport = Math.max(10, Math.floor(totalCells * 0.06));
  const cell = Math.max(spanX, spanZ) / N;
  const floors = groups
    .filter((g) => g.count >= minSupport)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6); // 多層でも上限6枚

  for (const g of floors) {
    const y = g.sumY / g.count;
    // 検出範囲をセル半分ぶん広げてカバー漏れを防ぐ
    const px0 = g.minX - cell, px1 = g.maxX + cell;
    const pz0 = g.minZ - cell, pz1 = g.maxZ + cell;
    const w = Math.max(cell, px1 - px0);
    const d = Math.max(cell, pz1 - pz0);
    const geo = new THREE.PlaneGeometry(w, d);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;          // XZ 平面・法線 +Y
    plane.position.set((px0 + px1) / 2, y, (pz0 + pz1) / 2);
    plane.visible = false;                     // 不可視（レイキャストは可視に依らず当たる）
    plane.name = "ScannedFloor";
    plane.userData.isScannedFloor = true;
    plane.userData.isStructuralBase = true;
    plane.updateMatrixWorld(true);             // シーン非所属でも当たり判定できるよう手動更新
    result.planes.push(plane);
    result.levels.push(y);
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[floorScan] levels=", result.levels, "planes=", result.planes.length, "bins=", bins.size);
  }
  return result;
}
