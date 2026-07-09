// WalkthroughInteractionController.jsx
//
// Phase C: ウォークスルー中のアイテム操作（近接ベース）。
//
//  ・プレイヤー（三人称=アバター、一人称/フライ=カメラ足元）が一定距離内に
//    近づいた「操作 or 情報」を持つアイテムを hoverItemId にセット。
//    → カーソル不要・クリック不要で、近づくと頭上に情報/操作アイコンボタンが直接出る
//      （ボタン表示は WalkthroughItemInfoBadge が hoverItemId を見て行う）。
//  ・ボタン自体（DOM）のクリックで情報パネル表示 / アニメ起動を行う。
//
//  近接判定は walkthroughShared.playerPos（WalkthroughController が毎フレーム更新）を基準に行う。

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useGimmickRegistryStore } from "../../../store/gimmickRegistryStore";
import { useItemInfoRegistryStore } from "../../../store/itemInfoRegistryStore";
import { useItemSwapRegistryStore } from "../../../store/itemSwapRegistryStore";
import { useItemMaterialRegistryStore } from "../../../store/itemMaterialRegistryStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { walkthroughShared } from "./walkthroughShared";

// 操作/情報アイコンが出る最大距離（メートル）。少し遠く（3〜5m想定）からでも出るように。
const INTERACT_RANGE_M = 4;

export default function WalkthroughInteractionController({ active = false }) {
  const { camera } = useThree();

  // ── 近接ホバー判定（throttle） ──
  const accum = useRef(0);
  const tmpC = useRef(new THREE.Vector3());
  const tmpFwd = useRef(new THREE.Vector3());
  const tmpBox = useRef(new THREE.Box3());

  useFrame((_, dt) => {
    if (!active) return;
    accum.current += dt;
    if (accum.current < 0.1) return; // 10Hz
    accum.current = 0;

    const g = useGimmickRegistryStore.getState();
    const info = useItemInfoRegistryStore.getState();
    const swap = useItemSwapRegistryStore.getState();
    const mat = useItemMaterialRegistryStore.getState();
    const ids = new Set([...g.map.keys(), ...info.map.keys(), ...swap.map.keys(), ...mat.map.keys()]);
    if (!ids.size) { g.setHoverItemId(null); g.setHoverLabel(null); info.setHoverInfoId(null); return; }

    const sceneMaxY = useEditorModeStore.getState().sceneMaxY;
    const u = sceneMaxY > 100 ? 1000 : 1;
    const maxDist = INTERACT_RANGE_M * u;

    // 近接の基準点：プレイヤー足元（三人称=アバター）。未設定ならカメラ。
    const ref = walkthroughShared.active ? walkthroughShared.playerPos : camera.position;
    const fwd = camera.getWorldDirection(tmpFwd.current);

    let bestId = null;
    let bestD = Infinity;
    for (const id of ids) {
      const obj = useSceneObjectRegistryStore.getState().getObject(id);
      if (!obj) continue;
      tmpBox.current.setFromObject(obj);
      if (tmpBox.current.isEmpty()) continue;
      tmpBox.current.getCenter(tmpC.current);

      const dx = tmpC.current.x - ref.x;
      const dz = tmpC.current.z - ref.z;
      const d = Math.hypot(dx, dz); // 水平距離（床上の近さ）
      if (d > maxDist || d >= bestD) continue;

      // カメラ背後（画面に映らない）アイテムは除外
      const vx = tmpC.current.x - camera.position.x;
      const vz = tmpC.current.z - camera.position.z;
      if (vx * fwd.x + vz * fwd.z < 0) continue;

      bestD = d;
      bestId = id;
    }

    g.setHoverItemId(bestId);
    g.setHoverLabel(bestId && g.has(bestId) ? (g.get(bestId)?.label || "操作") : null);
    info.setHoverInfoId(bestId && info.has(bestId) ? bestId : null);
  });

  // 退場時にホバー/フォーカス解除
  useEffect(() => {
    return () => {
      const g = useGimmickRegistryStore.getState();
      g.setHoverLabel(null);
      g.setHoverItemId(null);
      g.setActiveItemId(null);
      useItemInfoRegistryStore.getState().setHoverInfoId(null);
    };
  }, []);

  return null;
}
