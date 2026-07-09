// AimFaceHighlight — 一人称ルックでクロスヘアが狙っている面を薄くハイライトする。
// 確定選択（SelectedFaceHighlight）より控えめな白枠で「今ここを選べる」を示す。

import React, { useMemo } from "react";
import * as THREE from "three";
import { useMaterialViewStore } from "../../../store/useMaterialViewStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";

export default function AimFaceHighlight() {
  const face = useMaterialViewStore((s) => s.aimFace);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);

  const data = useMemo(() => {
    if (!face?.surface) return null;
    const s = face.surface;
    const u = new THREE.Vector3(...s.uAxis);
    const v = new THREE.Vector3(...s.vAxis);
    const n = new THREE.Vector3(...s.normal).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    const unitsPerMeter = sceneMaxY > 100 ? 1000 : 1;
    const pos = new THREE.Vector3(...s.center).addScaledVector(n, unitsPerMeter * 0.004);
    const hw = s.width / 2, hh = s.height / 2;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    return { quat, pos, width: s.width, height: s.height, geom: new THREE.BufferGeometry().setFromPoints(pts) };
  }, [face, sceneMaxY]);

  if (!data) return null;
  return (
    <group position={data.pos} quaternion={data.quat} renderOrder={9998}>
      <mesh>
        <planeGeometry args={[data.width, data.height]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      <line geometry={data.geom}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.85} depthTest={false} />
      </line>
    </group>
  );
}
