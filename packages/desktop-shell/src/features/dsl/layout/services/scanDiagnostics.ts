/**
 * 🔬 一時的な診断ツール（auto_material_pipeline 設計検証用）
 *
 * 目的: 自動マテリアル付与パイプラインを実装する前に、実機の GLB が
 *       指示書(auto_material_pipeline_v2.md)の前提を満たすか確認する。
 *       - メッシュ構造（壁/床/天井が別メッシュか、1メッシュか）
 *       - 法線分布（Phase 3 ラベリングの NORMAL_THRESHOLD=0.7 が妥当か）
 *       - 3軸格子レイキャスト(Phase 2)で実際に各ラベルが取れるか
 *       - 単位（mm か m か = GRID 0.5 の単位スケーリング要否）
 *
 * 起動方法（実行時）: ブラウザ DevTools コンソールで
 *     window.__SK_SCAN_DEBUG__ = true
 *   をセットしてから Base/Plan/Option を開く（GLB 再読込）。
 *   結果は console に出力される。
 *
 * ⚠️ これは検証用の使い捨て。設計確定後に削除 or 本実装へ昇格する。
 */
import * as THREE from "three";

type AnyMesh = THREE.Mesh & { geometry: THREE.BufferGeometry };

const UP_THRESHOLD = 0.7; // 指示書 NORMAL_THRESHOLD

function fmt(n: number, d = 2) {
  return Number.isFinite(n) ? n.toFixed(d) : "NaN";
}

/** 法線(ワールド)を粗いラベルへ（指示書 Phase 3 と同じ判定式） */
function classifyNormal(n: THREE.Vector3): string {
  if (n.y > UP_THRESHOLD) return "floor(up)";
  if (n.y < -UP_THRESHOLD) return "ceiling(down)";
  if (Math.abs(n.y) < 0.3) {
    if (n.z < -UP_THRESHOLD) return "wall_north";
    if (n.z > UP_THRESHOLD) return "wall_south";
    if (n.x > UP_THRESHOLD) return "wall_east";
    if (n.x < -UP_THRESHOLD) return "wall_west";
    return "wall_diagonal";
  }
  return "slanted/unknown";
}

/**
 * 診断本体。BaseGlb の onLoaded から root + baseMeshes を渡して呼ぶ。
 */
export function runScanDiagnostics(root: THREE.Object3D, baseMeshes: THREE.Object3D[]) {
  if (typeof window === "undefined" || !(window as any).__SK_SCAN_DEBUG__) return;

  /* eslint-disable no-console */
  console.groupCollapsed("%c[ScanDiag] 自動マテリアル設計検証", "color:#0a0;font-weight:bold");

  const meshes = baseMeshes.filter((o): o is AnyMesh => !!(o as any).isMesh && !!(o as any).geometry);
  const bbox = new THREE.Box3().setFromObject(root);
  const size = bbox.getSize(new THREE.Vector3());
  const maxY = bbox.max.y;
  const unitGuess = maxY > 100 ? "mm（>100）" : "m（<100）";

  // ---- 1. 全体サマリ ----
  console.log(
    `モデル全体: bbox size = (${fmt(size.x)}, ${fmt(size.y)}, ${fmt(size.z)})  maxY=${fmt(maxY)}  → 単位推定: ${unitGuess}`
  );
  console.log(`メッシュ数: ${meshes.length}`);

  // ---- 2. メッシュ別の構造 ----
  let totalTris = 0;
  let anyMissingNormals = false;
  let anyMissingUV = false;
  const perMesh: any[] = [];
  for (const m of meshes) {
    const geo = m.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const tris = (idx ? idx.count : pos ? pos.count : 0) / 3;
    totalTris += tris;
    const hasNormal = !!geo.attributes.normal;
    const hasUV = !!geo.attributes.uv;
    if (!hasNormal) anyMissingNormals = true;
    if (!hasUV) anyMissingUV = true;
    const matName = Array.isArray(m.material)
      ? `[${m.material.length} mats]`
      : (m.material as any)?.type || "none";
    perMesh.push({
      name: m.name || "(無名)",
      tris,
      normals: hasNormal,
      uv: hasUV,
      multiMaterial: Array.isArray(m.material),
      material: matName,
    });
  }
  console.table(perMesh);
  console.log(`合計トライアングル: ${totalTris}`);
  console.log(
    `⚠️ 法線なしメッシュ: ${anyMissingNormals ? "あり（要computeVertexNormals）" : "なし"} / ` +
    `UVなしメッシュ: ${anyMissingUV ? "あり（テクスチャ貼付に要BoxUV）" : "なし"}`
  );
  console.log(
    `メッシュ分割: ${meshes.length === 1 ? "🔴 1メッシュ（面別=geometry.groups 必須）" : "複数メッシュ"}`
  );

  // ---- 3. 法線分布ヒストグラム（面単位、ワールド法線） ----
  const normalHist: Record<string, number> = {};
  const tmpN = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const geo = m.geometry;
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const idx = geo.index;
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ia = idx ? idx.getX(i) : i;
      const ib = idx ? idx.getX(i + 1) : i + 1;
      const ic = idx ? idx.getX(i + 2) : i + 2;
      if (nrm) {
        tmpN.set(
          (nrm.getX(ia) + nrm.getX(ib) + nrm.getX(ic)) / 3,
          (nrm.getY(ia) + nrm.getY(ib) + nrm.getY(ic)) / 3,
          (nrm.getZ(ia) + nrm.getZ(ib) + nrm.getZ(ic)) / 3
        );
      } else {
        // 法線が無ければ面から計算
        a.fromBufferAttribute(pos, ia);
        b.fromBufferAttribute(pos, ib);
        c.fromBufferAttribute(pos, ic);
        tmpN.copy(b).sub(a).cross(c.clone().sub(a));
      }
      tmpN.normalize().transformDirection(m.matrixWorld);
      const label = classifyNormal(tmpN);
      normalHist[label] = (normalHist[label] || 0) + 1;
    }
  }
  console.log("法線分布（面数, ワールド法線 / Phase3式）:", normalHist);

  // ---- 4. 3軸格子レイキャスト（Phase 2 を実機で試走） ----
  // GRID は bbox の最長辺を ~30 分割（単位非依存）
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const GRID = longest / 30;
  const ray = new THREE.Raycaster();
  const hitTags: Record<string, number> = {
    ceiling_candidate: 0,
    floor_candidate: 0,
    wall_candidate_X: 0,
    wall_candidate_Z: 0,
    rays_no_hit: 0,
    rays_total: 0,
  };
  const min = bbox.min;

  // Y軸（上→下）: 天井=最初 / 床=最後
  for (let x = min.x; x <= bbox.max.x; x += GRID) {
    for (let z = min.z; z <= bbox.max.z; z += GRID) {
      ray.set(new THREE.Vector3(x, bbox.max.y + longest * 0.05, z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(meshes, false);
      hitTags.rays_total++;
      if (!hits.length) { hitTags.rays_no_hit++; continue; }
      hitTags.ceiling_candidate++;
      hitTags.floor_candidate++;
    }
  }
  // X軸
  for (let y = min.y; y <= bbox.max.y; y += GRID) {
    for (let z = min.z; z <= bbox.max.z; z += GRID) {
      ray.set(new THREE.Vector3(min.x - longest * 0.05, y, z), new THREE.Vector3(1, 0, 0));
      const hits = ray.intersectObjects(meshes, false);
      hitTags.rays_total++;
      if (!hits.length) { hitTags.rays_no_hit++; continue; }
      hitTags.wall_candidate_X += hits.length;
    }
  }
  // Z軸
  for (let y = min.y; y <= bbox.max.y; y += GRID) {
    for (let x = min.x; x <= bbox.max.x; x += GRID) {
      ray.set(new THREE.Vector3(x, y, min.z - longest * 0.05), new THREE.Vector3(0, 0, 1));
      const hits = ray.intersectObjects(meshes, false);
      hitTags.rays_total++;
      if (!hits.length) { hitTags.rays_no_hit++; continue; }
      hitTags.wall_candidate_Z += hits.length;
    }
  }
  console.log(`3軸格子スキャン（GRID=${fmt(GRID)} = 最長辺/30）:`, hitTags);

  // ---- 5. 結論ヒント ----
  const wallish = (normalHist["wall_north"] || 0) + (normalHist["wall_south"] || 0) +
    (normalHist["wall_east"] || 0) + (normalHist["wall_west"] || 0);
  const slanted = normalHist["slanted/unknown"] || 0;
  console.log(
    "%c判定ヒント:",
    "font-weight:bold",
    `\n - 床/天井が法線で取れている: ${(normalHist["floor(up)"] || 0) > 0 && (normalHist["ceiling(down)"] || 0) > 0 ? "YES" : "要確認"}` +
    `\n - 軸合わせの壁(N/S/E/W)比率: ${wallish} 面 / 斜め壁: ${normalHist["wall_diagonal"] || 0} 面` +
    `\n - slanted/unknown: ${slanted} 面（多いなら NORMAL_THRESHOLD 調整 or 曲面/傾斜が多い）` +
    `\n - GRID は単位非依存(最長辺/30)。本実装では unitsPerMeter ベースに固定すること`
  );
  console.groupEnd();
  /* eslint-enable no-console */
}
