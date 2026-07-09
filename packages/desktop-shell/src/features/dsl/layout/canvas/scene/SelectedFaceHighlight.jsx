// SelectedFaceHighlight — Material モードで選択中の躯体面をハイライト。
// 同一平面の矩形が取れていれば「面全体」を半透明＋枠線で示す。取れなければ点リング。
// 面種別ごとに色分け（床=青 / 壁=ピンク / 天井=黄）。

import React, { useMemo } from "react";
import * as THREE from "three";
import { useMaterialFaceStore } from "../../store/useMaterialFaceStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";

const SURFACE_COLOR = {
  floor: "#4fc3f7",
  ceiling: "#facc15",
  wall: "#ec407a",
};

/** 面ローカル基底からクォータニオンを作る（+Z→normal, +X→uAxis, +Y→vAxis）。 */
function basisQuat(uAxis, vAxis, normal) {
  const m = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

export default function SelectedFaceHighlight() {
  const face = useMaterialFaceStore((s) => s.selectedFace);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);

  const data = useMemo(() => {
    if (!face) return null;
    const color = SURFACE_COLOR[face.surfaceType] || "#ec407a";
    const unitsPerMeter = sceneMaxY > 100 ? 1000 : 1;

    if (face.surface) {
      const s = face.surface;
      const u = new THREE.Vector3(...s.uAxis);
      const v = new THREE.Vector3(...s.vAxis);
      const n = new THREE.Vector3(...s.normal).normalize();
      const quat = basisQuat(u, v, n);
      // 微小に手前へ浮かせる
      const pos = new THREE.Vector3(...s.center).addScaledVector(n, unitsPerMeter * 0.003);
      return { mode: "rect", color, quat, pos, width: s.width, height: s.height };
    }

    // フォールバック: 点リング
    const n = new THREE.Vector3(...face.normal);
    if (n.lengthSq() < 1e-6) n.set(0, 1, 0);
    n.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const size = 0.3 * unitsPerMeter;
    const pos = new THREE.Vector3(...face.point).addScaledVector(n, size * 0.02);
    return { mode: "ring", color, quat, pos, size };
  }, [face, sceneMaxY]);

  if (!data) return null;

  if (data.mode === "rect") {
    const hw = data.width / 2;
    const hh = data.height / 2;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    return (
      <group position={data.pos} quaternion={data.quat} renderOrder={9999} userData={{ isEditorOverlay: true }}>
        <mesh>
          <planeGeometry args={[data.width, data.height]} />
          <meshBasicMaterial color={data.color} transparent opacity={0.18} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
        <line geometry={geom}>
          <lineBasicMaterial color={data.color} transparent opacity={0.95} depthTest={false} />
        </line>
      </group>
    );
  }

  return (
    <group position={data.pos} quaternion={data.quat} renderOrder={9999} userData={{ isEditorOverlay: true }}>
      <mesh>
        <ringGeometry args={[data.size * 0.62, data.size, 48]} />
        <meshBasicMaterial color={data.color} transparent opacity={0.95} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </group>
  );
}
