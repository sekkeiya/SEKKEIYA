/**
 * Base の CSG Union（1ソリッド化）
 *
 * 読み込み済み躯体（layoutSceneRef.baseRoot）の床/壁/天井メッシュをすべて Boolean Union し、
 * 1つのソリッドメッシュへ統合する。フラグメント化した CAD 躯体を整えることで、
 * 自動ラベリング・自動マテリアルの面検出精度を上げる狙い。
 *
 * 結果は **上書き**（セッション内）: 元メッシュを非表示＋raycast無効化し、結合メッシュを baseRoot に追加。
 * GLB保存はしない（Base 再読込で元に戻る）。useBaseUnionStore に結果を登録し、
 * SingleViewportCanvas がコリジョン/面ピックの対象を結合メッシュへ切り替える。
 *
 * 注意: 入力が非多様体・開エッジだと CSG が破綻/低速になりうる。前処理で頂点溶接する。
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Evaluator, Brush, ADDITION } from "three-bvh-csg";
import { layoutSceneRef } from "./layoutSceneRef";
import { useBaseUnionStore } from "../store/useBaseUnionStore";

export interface UnionResult {
  ok: boolean;
  reason?: string;
  /** 統合前メッシュ数 */
  sources?: number;
  /** Solidify（厚み付け）したサーフェス数 */
  solidified?: number;
}

/** position/normal のみの index 付きジオメトリへ正規化（CSG が要求する素直な形へ）。
 *  ※ three-bvh-csg は全ブラシの属性が一致している必要があるため、uv 等は必ず落として
 *    position+normal だけに揃える（混在すると evaluate で "reading 'array'" で落ちる）。 */
function normalizeForCsg(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  }
  g.morphAttributes = {};
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  try { g = mergeVertices(g, 1e-4); } catch { /* noop */ }
  g.computeVertexNormals();
  return g;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/** 開いた境界（1三角形しか使っていない辺）があるか＝サーフェス（非ソリッド）か。 */
function hasOpenBoundary(geo: THREE.BufferGeometry): boolean {
  const idx = geo.index;
  if (!idx) return true;
  const count = new Map<string, number>();
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const k = edgeKey(u, v);
      count.set(k, (count.get(k) || 0) + 1);
    }
  }
  for (const c of count.values()) if (c === 1) return true;
  return false;
}

/**
 * 開いたサーフェスを法線方向に厚み付けして閉じたソリッドにする（Blender の Solidify 相当）。
 * front(+t/2)/back(-t/2) の2層＋境界辺の側面を貼って閉じる。CSG Union が交差を解決できるようにする。
 */
function solidifyGeometry(geo: THREE.BufferGeometry, thickness: number): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const idx = geo.index;
  if (!pos || !nrm || !idx) return geo;
  const vCount = pos.count;
  const triCount = idx.count / 3;
  const half = thickness / 2;

  const out = new Float32Array(vCount * 2 * 3);
  for (let i = 0; i < vCount; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    out[i * 3] = x + nx * half; out[i * 3 + 1] = y + ny * half; out[i * 3 + 2] = z + nz * half;
    const b = (vCount + i) * 3;
    out[b] = x - nx * half; out[b + 1] = y - ny * half; out[b + 2] = z - nz * half;
  }

  const indices: number[] = [];
  const ecount = new Map<string, number>();
  for (let t = 0; t < triCount; t++) {
    const a = idx.getX(t * 3), b = idx.getX(t * 3 + 1), c = idx.getX(t * 3 + 2);
    // front（元の向き）＋ back（反転・vCount オフセット）
    indices.push(a, b, c);
    indices.push(vCount + a, vCount + c, vCount + b);
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const k = edgeKey(u, v);
      ecount.set(k, (ecount.get(k) || 0) + 1);
    }
  }
  // 境界辺に側面（front↔back）を貼る
  for (let t = 0; t < triCount; t++) {
    const a = idx.getX(t * 3), b = idx.getX(t * 3 + 1), c = idx.getX(t * 3 + 2);
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      if (ecount.get(edgeKey(u, v)) !== 1) continue;
      const fu = u, fv = v, bu = vCount + u, bv = vCount + v;
      indices.push(fu, fv, bv);
      indices.push(fu, bv, bu);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function unionBaseMeshes(): UnionResult {
  const root = layoutSceneRef.baseRoot as THREE.Object3D | null;
  if (!root) return { ok: false, reason: "躯体モデルが読み込まれていません" };

  root.updateMatrixWorld(true);
  const targets: THREE.Mesh[] = [];
  root.traverse((o: any) => {
    if (!o?.isMesh || !o.geometry) return;
    if (o.userData?.isScannedFloor || o.userData?.isLabelCollider) return;
    if (o.userData?.isUnionedBase || o.userData?.replacedByUnion) return;
    targets.push(o);
  });
  if (targets.length < 1) return { ok: false, reason: "躯体メッシュが見つかりません" };

  // 厚み付け量：シーンスケール（mm想定が多い）に応じる。開いた壁を閉じソリッド化する標準厚 ~100mm。
  const wbox = new THREE.Box3().setFromObject(root);
  const upm = (wbox.max.y - wbox.min.y) > 100 ? 1000 : 1;
  const thickness = 0.1 * upm;

  // 各メッシュをワールド変換込みの Brush に。開いたサーフェスは Solidify で閉じてから結合。
  const rootInv = root.matrixWorld.clone().invert();
  const evaluator = new Evaluator();
  evaluator.useGroups = false; // マテリアルグループは扱わない（単一ソリッド）
  // 全ブラシで属性を揃える（position/normal のみ）。混在すると evaluate が undefined.array で落ちる。
  evaluator.attributes = ["position", "normal"];

  let solidified = 0;
  let acc: Brush | null = null;
  try {
    for (const mesh of targets) {
      let geo = normalizeForCsg(mesh.geometry as THREE.BufferGeometry);
      // 開いた面（サーフェス）なら厚み付けして閉じる。既に閉じたソリッドはそのまま。
      if (hasOpenBoundary(geo)) { geo = solidifyGeometry(geo, thickness); solidified++; }
      geo.applyMatrix4(mesh.matrixWorld); // ワールド空間へ
      const brush = new Brush(geo);
      brush.updateMatrixWorld(true);
      if (!acc) { acc = brush; continue; }
      acc = evaluator.evaluate(acc, brush, ADDITION);
    }
  } catch (e) {
    console.error("[unionBase] CSG failed", e);
    return { ok: false, reason: "CSG 結合に失敗しました（非多様体の可能性）" };
  }
  if (!acc) return { ok: false, reason: "結合できませんでした" };

  // 結果ジオメトリ（ワールド空間）→ baseRoot ローカルへ戻して配置
  const unionGeo = acc.geometry.clone();
  unionGeo.applyMatrix4(rootInv);
  unionGeo.computeVertexNormals();
  unionGeo.computeBoundingBox();
  unionGeo.computeBoundingSphere();

  // 結合ジオメトリは uv を持たないため、テクスチャ非依存のニュートラル材で表示（元の色味に寄せる）。
  let baseColor = 0xbfc3c9;
  const m0 = Array.isArray(targets[0].material) ? targets[0].material[0] : targets[0].material;
  if (m0 && m0.color && typeof m0.color.getHex === "function") baseColor = m0.color.getHex();
  const srcMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, metalness: 0 });
  const unionMesh = new THREE.Mesh(unionGeo, srcMat);
  unionMesh.name = "UnionedBase";
  unionMesh.userData.isStructuralBase = true;
  unionMesh.userData.isUnionedBase = true;
  unionMesh.castShadow = true;
  unionMesh.receiveShadow = true;

  // 元メッシュを退避（非表示＋raycast無効）し、結合メッシュを追加（=上書き）
  for (const m of targets) {
    m.visible = false;
    m.userData.replacedByUnion = true;
    m.raycast = () => {}; // ピック/床判定から除外
  }
  root.add(unionMesh);
  unionMesh.updateMatrixWorld(true);

  useBaseUnionStore.getState().setUnion(unionMesh);
  return { ok: true, sources: targets.length, solidified };
}

/** Union を取り消し、元メッシュを復帰する。 */
export function clearBaseUnion(): void {
  const union = useBaseUnionStore.getState().unionMesh as THREE.Mesh | null;
  // 結合メッシュは「実際の親」から外す（baseRoot が差し替わっていても確実に消す）。
  if (union) {
    union.parent?.remove(union);
    try { union.geometry?.dispose?.(); } catch { /* noop */ }
  }
  // 退避していた元メッシュを復帰（現 baseRoot と union の旧親の両方を走査）。
  const restore = (o: any) => {
    if (o?.userData?.replacedByUnion) {
      o.visible = true;
      delete o.userData.replacedByUnion;
      delete o.raycast; // プロトタイプの raycast を復帰
    }
  };
  const root = layoutSceneRef.baseRoot as THREE.Object3D | null;
  root?.traverse(restore);
  useBaseUnionStore.getState().clear();
}
