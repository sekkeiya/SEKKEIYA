// enumerateStructureFaces — 躯体コライダー（床・壁・天井）から「内側に面した」
// 選択可能な面をすべて列挙する。Ctrl+A の全選択に使用する。
//
// 各メッシュの三角形を走査し、同一平面ごとにまとめる。法線がルーム中心を向く面
// （＝内側から見える面）だけを残し、外面・厚みの側面・床裏などは除外する。
// クリック選択と同じ extractSurfaceRect / surfaceKeyOf を使うので、生成される
// surfaceKey はクリック時と一致する（ハイライト／ラベル付与が整合）。

import * as THREE from "three";
import { extractSurfaceRect, extractConnectedFaceRect } from "../../viewports/controllers/FacePickController";
import { structureFaceKeyOf, classifySurface } from "../../../store/useMaterialFaceStore";
import { defaultSemantic, type PickedFace } from "../../../store/useStructureLabelStore";

export function enumerateStructureFaces(colliders: any[]): PickedFace[] {
  const meshes = (Array.isArray(colliders) ? colliders : []).filter(
    (o: any) =>
      o?.isMesh &&
      o.geometry?.attributes?.position &&
      !o.userData?.isScannedFloor &&
      !o.userData?.isLabelCollider &&
      !o.userData?.isSectionFill
  );
  if (!meshes.length) return [];

  // 全体の中心（内向き面の判定に使用）
  const bbox = new THREE.Box3();
  meshes.forEach((m) => bbox.expandByObject(m));
  if (bbox.isEmpty()) return [];
  const center = bbox.getCenter(new THREE.Vector3());
  const upm = bbox.getSize(new THREE.Vector3()).y > 100 ? 1000 : 1;

  const out: PickedFace[] = [];
  const seenKeys = new Set<string>();

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tcenter = new THREE.Vector3();
  const toCenter = new THREE.Vector3();

  for (const obj of meshes) {
    obj.updateMatrixWorld(true);
    const geom = obj.geometry;
    const pos = geom.attributes.position;
    const index = geom.index;
    const triCount = index ? index.count / 3 : pos.count / 3;

    // 平面キー -> 代表 { 法線, 平面上の一点, seed三角形index }
    const groups = new Map<string, { n: THREE.Vector3; point: THREE.Vector3; tri: number }>();

    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(obj.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(obj.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(obj.matrixWorld);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      n.crossVectors(ab, ac);
      const len = n.length();
      if (len < 1e-8) continue;
      n.multiplyScalar(1 / len); // ワールド法線（正規化）

      tcenter.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      toCenter.copy(center).sub(tcenter);
      if (toCenter.dot(n) <= 0) continue; // 外向き／中心から離れる面 → 除外

      const d = n.dot(a);
      const pk = `${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}|${d.toFixed(1)}`;
      if (!groups.has(pk)) groups.set(pk, { n: n.clone(), point: tcenter.clone(), tri: t });
    }

    for (const { n: gn, point, tri } of groups.values()) {
      // クリック選択と同じ「連結面ポリゴン」を使う（矩形のはみ出し＝壁貫通を防ぐ）。
      const surface = extractConnectedFaceRect(obj, tri, gn) || extractSurfaceRect(obj, gn, point);
      if (!surface) continue;
      const key = structureFaceKeyOf(surface.normal, surface.center, upm);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const autoSemantic = defaultSemantic(classifySurface(gn.y));
      out.push({ key, surface, normalY: gn.y, autoSemantic });
    }
  }

  return out;
}

/**
 * 躯体メッシュから「連結成分（地続きの同一平面）」面を全列挙する（内向き限定なし＝外壁も含む）。
 * ラベルの有無に依存しないので、同一平面の面をまとめて選択する用途に使う。
 */
export function enumerateConnectedFaces(colliders: any[], upm = 1): PickedFace[] {
  const meshes = (Array.isArray(colliders) ? colliders : []).filter(
    (o: any) =>
      o?.isMesh &&
      o.geometry?.attributes?.position &&
      !o.userData?.isScannedFloor &&
      !o.userData?.isLabelCollider &&
      !o.userData?.isSectionFill &&
      !o.userData?.isSurfaceFinish &&
      !o.userData?.replacedByUnion
  );
  if (!meshes.length) return [];

  const out: PickedFace[] = [];
  const seen = new Set<string>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
  const faceN = new THREE.Vector3(), centroid = new THREE.Vector3();

  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!pos) continue;
    const nrm = geo.attributes.normal;
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const used = new Set<number>();

    for (let t = 0; t < triCount; t++) {
      if (used.has(t)) continue;
      const ia = idx ? idx.getX(t * 3) : t * 3;
      const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
      centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      if (nrm) {
        nA.fromBufferAttribute(nrm, ia);
        nB.fromBufferAttribute(nrm, ib);
        nC.fromBufferAttribute(nrm, ic);
        faceN.copy(nA).add(nB).add(nC).multiplyScalar(1 / 3).normalize().transformDirection(mesh.matrixWorld);
      } else {
        faceN.copy(b).sub(a).cross(nC.copy(c).sub(a)).normalize();
      }
      if (!isFinite(faceN.x) || faceN.lengthSq() < 0.5) { used.add(t); continue; }

      const surface =
        extractConnectedFaceRect(mesh, t, faceN.clone()) ||
        extractSurfaceRect(mesh, faceN.clone(), centroid.clone());
      if (!surface) { used.add(t); continue; }
      const tIdx = (surface as any).triIndices;
      if (Array.isArray(tIdx) && tIdx.length) { for (const vt of tIdx) used.add(vt); } else { used.add(t); }

      const key = structureFaceKeyOf(surface.normal, surface.center, upm);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, surface, normalY: surface.normal[1], autoSemantic: defaultSemantic(classifySurface(surface.normal[1])) });
    }
  }
  return out;
}

/** surface から平面（正規化法線 n とオフセット d=n·center）を得る。 */
function planeOf(surf: any): { n: THREE.Vector3; d: number } | null {
  if (!surf) return null;
  const n = new THREE.Vector3(surf.normal[0], surf.normal[1], surf.normal[2]);
  if (n.lengthSq() < 1e-9) return null;
  n.normalize();
  return { n, d: n.x * surf.center[0] + n.y * surf.center[1] + n.z * surf.center[2] };
}

/**
 * refSurfaces のいずれかと「同一平面（法線一致＋オフセット一致）」の連結面をすべて返す。
 * 同一平面まとめ選択（ボタン／ダブルクリック）で共用する。
 */
export function coplanarFacesOf(colliders: any[], refSurfaces: any[], upm = 1): PickedFace[] {
  const targets = (refSurfaces || []).map(planeOf).filter(Boolean) as { n: THREE.Vector3; d: number }[];
  if (!targets.length) return [];
  const tol = Math.max(1, 0.02 * upm);
  const all = enumerateConnectedFaces(colliders, upm);
  return all.filter((f) => {
    const pl = planeOf(f.surface);
    return pl && targets.some((t) => t.n.dot(pl.n) > 0.999 && Math.abs(pl.d - t.d) < tol);
  });
}
