// structureColliders — 面ラベル（collision=true）から不可視のコリジョン板を生成する。
// 面矩形(SurfaceRect)の基底で板を向ける（床=水平/壁=鉛直/天井=水平）。
// シーン非所属でも当たり判定できるよう updateMatrixWorld(true) 済みで返す。
// ウォークスルーの castFloor / 壁スライドは法線で床/壁を判別するため、向きさえ合えばそのまま機能する。

import * as THREE from "three";
import type { StructureLabel } from "../../../store/useStructureLabelStore";

export function buildLabelColliders(labels: Record<string, StructureLabel>): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const key of Object.keys(labels || {})) {
    const l = labels[key];
    if (!l?.collision || !l.surface) continue;
    const s = l.surface;
    const w = Math.max(1e-3, s.width);
    const h = Math.max(1e-3, s.height);
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    const u = new THREE.Vector3(...s.uAxis);
    const v = new THREE.Vector3(...s.vAxis);
    const n = new THREE.Vector3(...s.normal).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    mesh.position.set(s.center[0], s.center[1], s.center[2]);
    mesh.visible = false;
    mesh.name = "LabelCollider";
    mesh.userData.isLabelCollider = true;
    mesh.userData.isStructuralBase = true;
    mesh.userData.structureSemantic = l.semantic;
    mesh.updateMatrixWorld(true);
    out.push(mesh);
  }
  return out;
}
