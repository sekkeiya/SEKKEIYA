// GimmickBinder.jsx
//
// Phase C: 配置モデルの「ギミック」（クリックで開閉など）をセットアップする非表示コンポーネント。
// FurnitureItem(GLB) の内部に置き、ロードした GLB から自動的にギミックを検出して
// gimmickRegistryStore へ登録する。
//
// 検出ルール（Blender 等で設定済みのものを尊重）:
//   1. spec(明示メタデータ) があれば最優先（type:"hinge"|"clip"）
//   2. GLB に開閉系アニメ(open/close/door…)があれば clip ギミック
//   3. cloned の userData.gimmick（glTF extras 由来）があれば hinge ギミック
//   ※ idle/walk しか無いキャラは対象外（isLocomotionOnly で除外）
//
// clip:  AnimationMixer で open/close クリップ（または単一クリップを順/逆再生）
// hinge: 指定ノードを軸まわりに openDeg までトゥイーン

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useGimmickRegistryStore } from "../../store/gimmickRegistryStore";
import {
  resolveGimmickClip,
  looksLikeClipGimmick,
  isLocomotionOnly,
} from "../tools/walkthrough/gltfClipUtils";

const AXIS_VEC = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function findNodeByName(root, name) {
  if (!root || !name) return null;
  let found = null;
  root.traverse((o) => {
    if (!found && o.name && o.name.toLowerCase() === String(name).toLowerCase()) found = o;
  });
  return found;
}

export default function GimmickBinder({ cloned, animations = [], itemId, gimmickId = "g0", spec = null, label }) {
  const register = useGimmickRegistryStore((s) => s.register);
  const unregister = useGimmickRegistryStore((s) => s.unregister);

  const mixerRef = useRef(null);
  const openRef = useRef(false);
  // hinge tween 状態
  const hingeRef = useRef(null); // { node, axis(Vector3), baseQuat, openRad, t(0..1), target, speed }
  // slide tween 状態（一回再生・移動）
  const slideRef = useRef(null); // { node, axisKey, base, dist, t, target, speed }

  const names = useMemo(() => (animations || []).map((a) => a.name), [animations]);

  // ギミック種別の決定
  const gimmick = useMemo(() => {
    if (!cloned) return null;

    // 1) 明示メタデータ
    if (spec && (spec.type === "hinge" || spec.type === "clip" || spec.type === "slide")) {
      return { kind: spec.type, spec };
    }
    // 2) extras 由来の hinge（cloned.userData.gimmick）
    const ud = cloned.userData?.gimmick;
    if (ud && (ud.axis || ud.openDeg || ud.pivot)) {
      return { kind: "hinge", spec: ud };
    }
    // 3) 開閉系アニメ
    if (animations.length && looksLikeClipGimmick(names) && !isLocomotionOnly(names)) {
      return { kind: "clip", spec: null };
    }
    return null;
  }, [cloned, spec, animations, names]);

  useEffect(() => {
    if (!cloned || !gimmick || !itemId) return;

    const hudLabel = label || spec?.label || "ドア";
    let toggle = null;

    if (gimmick.kind === "clip") {
      const sp = gimmick.spec || {};
      const openName = sp.openClip || resolveGimmickClip(names, "open") || names[0];
      const closeName = sp.closeClip || resolveGimmickClip(names, "close");

      const openClip = animations.find((a) => a.name === openName) || animations[0];
      const closeClip = closeName ? animations.find((a) => a.name === closeName) : null;

      // 有効な開閉クリップが無い（アニメ未収録の GLB に clip 指定など）場合は
      // 壊れたギミックを登録しない（クリック時の playOnce で undefined.uuid 参照を防ぐ）。
      if (!openClip) return;

      const mixer = new THREE.AnimationMixer(cloned);
      mixerRef.current = mixer;

      const playOnce = (clip, timeScale = 1) => {
        if (!clip) return null;
        const act = mixer.clipAction(clip);
        act.reset();
        act.loop = THREE.LoopOnce;
        act.clampWhenFinished = true;
        act.timeScale = timeScale;
        if (timeScale < 0) act.time = clip.duration; // 逆再生は末尾から
        act.enabled = true;
        act.play();
        return act;
      };

      toggle = () => {
        if (!openRef.current) {
          // 開く
          if (closeClip) mixer.clipAction(closeClip).stop();
          playOnce(openClip, 1);
          openRef.current = true;
        } else {
          // 閉じる：close クリップがあればそれ、無ければ open を逆再生
          if (closeClip) {
            mixer.clipAction(openClip).stop();
            playOnce(closeClip, 1);
          } else {
            playOnce(openClip, -1);
          }
          openRef.current = false;
        }
      };
    } else if (gimmick.kind === "slide") {
      // slide（一回再生・移動して停止／再押下で戻る）
      const s = gimmick.spec || {};
      const node = findNodeByName(cloned, s.pivot) || cloned;
      const axisKey = (s.axis || "y").toLowerCase();
      // mm → ローカル単位換算（GLB がメートルなら ×0.001 相当）
      const box = new THREE.Box3().setFromObject(cloned);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const mmPerUnit = maxDim > 0 && maxDim < 20 ? 1000 : 1;
      const dist = (Number(s.distance) || 100) / mmPerUnit;
      slideRef.current = { node, axisKey, base: node.position[axisKey], dist, t: 0, target: 0, speed: 2.2 };
      toggle = () => {
        const sl = slideRef.current;
        if (!sl) return;
        sl.target = sl.target > 0.5 ? 0 : 1;
        openRef.current = sl.target > 0.5;
      };
    } else {
      // hinge
      const s = gimmick.spec || {};
      const node = findNodeByName(cloned, s.pivot) || cloned;
      const axis = AXIS_VEC[(s.axis || "y").toLowerCase()] || AXIS_VEC.y;
      const openRad = ((Number(s.openDeg) || 90) * Math.PI) / 180;
      hingeRef.current = {
        node,
        axis,
        baseQuat: node.quaternion.clone(),
        openRad,
        t: 0,
        target: 0,
        speed: 2.2, // 開閉スピード（1/秒）
      };
      toggle = () => {
        const h = hingeRef.current;
        if (!h) return;
        h.target = h.target > 0.5 ? 0 : 1;
        openRef.current = h.target > 0.5;
      };
    }

    register({
      itemId,
      gimmickId,
      type: gimmick.kind,
      label: hudLabel,
      toggle,
      isOpen: () => openRef.current,
    });

    return () => {
      unregister(itemId, gimmickId);
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      hingeRef.current = null;
      slideRef.current = null;
      openRef.current = false;
    };
  }, [cloned, gimmick, itemId, gimmickId, names, animations, register, unregister, label, spec]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (mixerRef.current) mixerRef.current.update(d);
    const h = hingeRef.current;
    if (h) {
      const dir = h.target - h.t;
      if (Math.abs(dir) > 1e-4) {
        h.t += Math.sign(dir) * Math.min(Math.abs(dir), h.speed * d);
        h.t = Math.max(0, Math.min(1, h.t));
        const q = new THREE.Quaternion().setFromAxisAngle(h.axis, h.openRad * h.t);
        h.node.quaternion.copy(h.baseQuat).multiply(q);
      }
    }
    const sl = slideRef.current;
    if (sl) {
      const dir = sl.target - sl.t;
      if (Math.abs(dir) > 1e-4) {
        sl.t += Math.sign(dir) * Math.min(Math.abs(dir), sl.speed * d);
        sl.t = Math.max(0, Math.min(1, sl.t));
        sl.node.position[sl.axisKey] = sl.base + sl.dist * sl.t;
      }
    }
  });

  return null;
}
