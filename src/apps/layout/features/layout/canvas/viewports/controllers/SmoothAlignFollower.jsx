// controllers/ は共通して **Canvas 内で useThree / useFrame を使い、DOMや3D世界に“副作用”を起こす層
// SmoothAlignFollower：Align時の 追従エンジン（raycast + snap + wall clamp + 補間 + 複数移動）
// 役割
// Align中に、毎フレーム raycast して “target位置” を更新し、表示は補間（ぬるぬる）させる追従エンジン。
// さらに Snap / wall clamp / 複数選択のグループ移動まで担当している「Alignの心臓部」です。
// 責務（大きい）
// lastNdcRef（AlignPointerControllerが更新）を読み取る
// そのNDCで raycaster.setFromCamera()
// Align用 plane（床/正面/右）に intersectPlane して hit を得る
// Align軸（x/y/z）に投影して targetAnchor を作る
// SnapがONなら：
// snapEngine.snap(raw, axis) でスナップ候補に吸着
// lock（ヒステリシス）を考慮して最終アンカーを安定化
// wall候補（dynamicWalls）も注入
// 壁めり込み防止：
// base の colliders を raycast して “内側壁” を推定
// その位置を上限/下限として clamp
// 選択オブジェクトに対して：
// 複数選択なら 同じdelta を全選択に適用（グループ移動）
// dampingで補間移動（見た目ぬるぬる）
// UI用：
// SnapGuide 表示の点位置やガイド値を refs に書く（snapDotRef / snapGuideValueRef）
// 確定用：
// snapFinalAnchorRef に最終アンカーと targetsById を保存
// （commitAlign がクリック時に“一発確定”するための材料）
// 機能
// Align時の追従の“気持ちよさ”を作る（補間）
// Snapの吸着・ロック・壁制約・ガイド表示を統合
// 複数選択の整列移動にも対応
// なぜ controller？
// useFrame（毎フレーム実行）の副作用塊
// Object3D の position を直接書き換える（React stateは更新しない）
// Canvas内で完結して動くべき、実質エンジン部品だから

/* =========================================================
 * SmoothAlignFollower（毎フレーム raycast→target更新、表示は補間）
 * - 見た目：毎フレーム “ぬるぬる”
 * - React(items)更新：❌しない（確定時 commit のみ）
 *
 * ✅ 複数選択対応：
 * - primaryObject が pointer 追従で target を決める
 * - delta（移動量）を全 selectedObjects に同じだけ適用（グループ移動）
 * ======================================================= */


import React, { useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";

export default function SmoothAlignFollower({
  active,
  primaryObject,
  selectedObjects, // [{ itemId, object }]
  alignMode,
  groundY,
  snapAxisValue,
  baseCollidersRef,
  baseBoundsRef,
  wallEps = 0.02,
  wallMaxDist = 200,
  lastNdcRef,
  damping = 34,
  getSnapActive,
  getAbortAlign,
  onPreviewTransform,
  onPreviewTransforms,
  previewItemId,
  previewThrottleMs = 33,
  snapEngineRef,
  snapDotRef,
  snapGuideValueRef,
  snapFinalAnchorRef,
}) {
  const { camera, raycaster } = useThree();

  const planeRef = useRef(new THREE.Plane());
  const hitRef = useRef(new THREE.Vector3());
  const nRef = useRef(new THREE.Vector3());

  const wallRcRef = useRef(new THREE.Raycaster());
  const originRef = useRef(new THREE.Vector3());
  const dirRef = useRef(new THREE.Vector3());

  const lastPreviewAtRef = useRef(0);

  // =========================================================
  // ✅ 壁判定（法線ベース / ワールド法線）
  // =========================================================
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpN = useRef(new THREE.Vector3());

  const isWallHit = useCallback(
    (hit) => {
      if (!hit) return false;
      const faceN = hit.face?.normal;
      if (!faceN) return true; // faceが無い形状は一旦通す
      const obj = hit.object;
      if (!obj?.matrixWorld) return true;

      tmpN.current.copy(faceN).transformDirection(obj.matrixWorld).normalize();
      const dot = Math.abs(tmpN.current.dot(UP));
      return dot < 0.25;
    },
    [UP]
  );

  // =========================================================
  // ✅ Ray origin を baseBox の内側に押し込む（超重要）
  // =========================================================
  const clampOriginIntoBaseBox = useCallback(
    (origin, axis) => {
      const baseBox = baseBoundsRef?.current?.box;
      if (!baseBox || !baseBox.isBox3) return origin;

      if (baseBox.containsPoint(origin)) return origin;

      const inset = 0.01;

      if (axis === "x") {
        origin.x = THREE.MathUtils.clamp(origin.x, baseBox.min.x + inset, baseBox.max.x - inset);
        origin.z = THREE.MathUtils.clamp(origin.z, baseBox.min.z + inset, baseBox.max.z - inset);
      } else if (axis === "z") {
        origin.z = THREE.MathUtils.clamp(origin.z, baseBox.min.z + inset, baseBox.max.z - inset);
        origin.x = THREE.MathUtils.clamp(origin.x, baseBox.min.x + inset, baseBox.max.x - inset);
      } else {
        origin.y = THREE.MathUtils.clamp(origin.y, baseBox.min.y + inset, baseBox.max.y - inset);
      }
      return origin;
    },
    [baseBoundsRef]
  );

  // =========================================================
  // ✅ 「内側面」を安定して選ぶ
  // =========================================================
  const pickInsideWallHit = useCallback(
    (hits, rayDirWorld /* THREE.Vector3 | null */) => {
      if (!hits?.length) return null;

      const baseBox = baseBoundsRef?.current?.box;
      const hasBaseBox = !!baseBox && baseBox.isBox3;

      const wallHits = hits.filter(isWallHit);
      if (!wallHits.length) return null;

      let best = null;
      let bestScore = -Infinity;

      for (const h of wallHits) {
        const faceN = h.face?.normal;
        const obj = h.object;

        if (!faceN || !obj?.matrixWorld) {
          const score = -h.distance;
          if (score > bestScore) {
            bestScore = score;
            best = h;
          }
          continue;
        }

        tmpN.current.copy(faceN).transformDirection(obj.matrixWorld).normalize();

        let score = 0;

        // baseBox があるなら「壁っぽさ」を少し優先（任意）
        if (hasBaseBox) score += 1;

        // rayDir と逆向き（内壁っぽい）を軽く優先（任意）
        if (rayDirWorld && rayDirWorld.isVector3) {
          const d = tmpN.current.dot(rayDirWorld);
          if (d < -0.2) score += 0.5;
        }

        // 距離は短いほど少し有利
        score += Math.max(0, 10 - h.distance);

        if (score > bestScore) {
          bestScore = score;
          best = h;
        }
      }

      return best;
    },
    [baseBoundsRef, isWallHit]
  );

  // =========================================================
  // ✅ 壁 “スナップ候補(anchor)” を Raycast で作る
  // ★ここが「内側へ押す」本体
  // - 内側 = ray origin（室内側）に向かう方向
  // =========================================================
  const toOriginRef = useRef(new THREE.Vector3());
  const interiorDirRef = useRef(new THREE.Vector3());

  const findWallAnchorCandidate = useCallback(
    (rawAnchor, axis, offset, isFloorPlane, alignKey) => {
      if (!isFloorPlane) return null;
      if (axis !== "x" && axis !== "z") return null;

      const anchorKind =
        alignKey === "left" || alignKey === "top"
          ? "min"
          : alignKey === "right" || alignKey === "bottom"
            ? "max"
            : "center";

      if (anchorKind === "center") return null;

      // 複数選択は一旦OFF
      const selCount = selectedObjects?.length ?? 0;
      if (selCount > 1) return null;

      const colliders = baseCollidersRef?.current || [];
      if (!Array.isArray(colliders) || colliders.length === 0) return null;

      const baseBox = baseBoundsRef?.current?.box;
      if (!baseBox || !baseBox.isBox3) return null;

      const p = primaryObject?.position;
      if (!p) return null;

      // 現在アンカー
      const currPosAxis = axis === "x" ? p.x : p.z;
      const currAnchor = currPosAxis - (offset || 0);

      const dirSign = Math.sign(rawAnchor - currAnchor);
      if (dirSign === 0) return null;

      primaryObject.updateMatrixWorld?.(true);
      const box = new THREE.Box3().setFromObject(primaryObject);

      const edgeAxis =
        axis === "x"
          ? (anchorKind === "max" ? box.max.x : box.min.x)
          : (anchorKind === "max" ? box.max.z : box.min.z);

      // ✅ origin：エッジに寄せ + 高さは baseBox 内の中間へ
      const origin = originRef.current.set(p.x, p.y, p.z);
      if (axis === "x") origin.x = edgeAxis;
      else origin.z = edgeAxis;

      const midY = (baseBox.min.y + baseBox.max.y) * 0.5;
      origin.y = THREE.MathUtils.clamp(midY, baseBox.min.y + 0.05, baseBox.max.y - 0.05);

      clampOriginIntoBaseBox(origin, axis);

      // ✅ rayDirWorld
      const dir = dirRef.current.set(0, 0, 0);
      if (axis === "x") dir.set(dirSign, 0, 0);
      else dir.set(0, 0, dirSign);
      dir.normalize();

      const rc = wallRcRef.current;
      rc.set(origin, dir);
      rc.near = 0;
      rc.far = wallMaxDist;

      const hits = rc.intersectObjects(colliders, true);
      const hit = pickInsideWallHit(hits, dir);
      if (!hit) return null;

      // ==========================================
      // ✅ 内側方向 = (ray origin - hit.point)
      // → これで「室内側」へ押せる（法線に依存しない）
      // ==========================================
      const interiorDir = interiorDirRef.current
        .copy(toOriginRef.current.subVectors(origin, hit.point))
        .normalize();

      // 壁に当たった点を「内側へ wallEps」進めた点を anchor にする
      const pInside = hit.point.clone().addScaledVector(interiorDir, wallEps);

      const wallAnchor = axis === "x" ? pInside.x : pInside.z;
      return Number.isFinite(wallAnchor) ? wallAnchor : null;
    },
    [
      baseCollidersRef,
      baseBoundsRef,
      primaryObject,
      selectedObjects?.length,
      wallEps,
      wallMaxDist,
      pickInsideWallHit,
      clampOriginIntoBaseBox,
    ]
  );

  // =========================================================
  // ✅ ここから下が「Alignが動く本体」
  // =========================================================
  useFrame((_, dt) => {
    if (!active) return;
    if (getAbortAlign?.()) return;
    if (!primaryObject) return;
    if (!alignMode) return;

    const snapActive = typeof getSnapActive === "function" ? !!getSnapActive() : false;

    const axis = alignMode.axis;
    if (axis !== "x" && axis !== "y" && axis !== "z") return;

    const ndc = lastNdcRef?.current;
    if (!ndc) return;

    raycaster.setFromCamera({ x: ndc.x, y: ndc.y }, camera);

    const n =
      alignMode.planeNormal instanceof THREE.Vector3
        ? nRef.current.copy(alignMode.planeNormal)
        : nRef.current.set(0, 1, 0);

    const c = Number.isFinite(alignMode.planeConstant) ? alignMode.planeConstant : -groundY;
    planeRef.current.set(n, c);

    const hit = hitRef.current;
    const ok = raycaster.ray.intersectPlane(planeRef.current, hit);
    if (!ok) return;

    const offset = alignMode.offset || 0;
    const hitAxis = axis === "x" ? hit.x : axis === "y" ? hit.y : hit.z;

    const isFloorPlane = Math.abs((n.y ?? 0) - 1) < 1e-6 || Math.abs((n.y ?? 0) + 1) < 1e-6;

    const targetAnchorRaw = hitAxis;
    let targetAnchor = hitAxis;
    let guideAnchor = null;

    // ✅ dynamic wall candidates を engine に注入（snap中のみ）
    if (snapActive && snapEngineRef?.current?.setDynamicWalls) {
      const wallAnchor = findWallAnchorCandidate(
        targetAnchorRaw,
        axis,
        offset,
        isFloorPlane,
        alignMode?.key
      );
      if (Number.isFinite(wallAnchor)) snapEngineRef.current.setDynamicWalls({ [axis]: [wallAnchor] });
      else snapEngineRef.current.setDynamicWalls({ [axis]: [] });
    } else {
      snapEngineRef?.current?.clearDynamicWalls?.();
    }

    if (snapActive) {
      const snapped = snapAxisValue(targetAnchorRaw, axis, offset);

      const lock = snapEngineRef.current?.getLock?.(axis);
      const finalAnchor = Number.isFinite(lock) ? lock : snapped;

      targetAnchor = finalAnchor;
      guideAnchor = Number.isFinite(finalAnchor) ? finalAnchor : null;

      if (snapEngineRef?.current) {
        snapEngineRef.current._lastFinalAnchor = { axis, value: finalAnchor };
      }
    } else {
      targetAnchor = targetAnchorRaw;
      guideAnchor = null;
    }

    // ✅ Guideは「アンカー」に出す
    if (snapDotRef) {
      if (Number.isFinite(guideAnchor)) {
        const dot = snapDotRef.current || { x: hit.x, y: hit.y, z: hit.z };

        if (axis === "x") {
          dot.x = guideAnchor;
          dot.y = hit.y;
          dot.z = hit.z;
        } else if (axis === "y") {
          dot.x = hit.x;
          dot.y = guideAnchor;
          dot.z = hit.z;
        } else {
          dot.x = hit.x;
          dot.y = hit.y;
          dot.z = guideAnchor;
        }

        snapDotRef.current = dot;
      } else {
        snapDotRef.current = null;
      }
    }

    if (snapGuideValueRef) {
      snapGuideValueRef.current = Number.isFinite(guideAnchor) ? guideAnchor : null;
    }

    // =========================================================
    // ✅ 壁めり込み防止（ハードクランプ）
    // =========================================================
    const key = alignMode?.key;
    const isEdgeAlign = key === "left" || key === "right" || key === "top" || key === "bottom";

    if (isEdgeAlign && isFloorPlane && (axis === "x" || axis === "z")) {
      const wallLimit = findWallAnchorCandidate(targetAnchorRaw, axis, offset, isFloorPlane, key);

      if (Number.isFinite(wallLimit)) {
        const p = primaryObject.position;
        const currPosAxis = axis === "x" ? p.x : p.z;
        const currAnchor2 = currPosAxis - (offset || 0);
        const dirSign2 = Math.sign(targetAnchorRaw - currAnchor2);

        if (dirSign2 > 0) targetAnchor = Math.min(targetAnchor, wallLimit);
        if (dirSign2 < 0) targetAnchor = Math.max(targetAnchor, wallLimit);
      }
    }

    // ✅ 確定用：毎フレーム「最終アンカー＆各アイテムの最終pos」を保存
    if (snapFinalAnchorRef) {
      const offsets = alignMode?.itemOffsets || {};

      const list = Array.isArray(selectedObjects) ? selectedObjects : [];
      const targetsById = {};

      for (const it of list) {
        const id = it?.itemId;
        const obj = it?.object;
        if (!id || !obj) continue;

        const off = Number.isFinite(offsets[id])
          ? offsets[id]
          : Number.isFinite(alignMode?.offset)
            ? alignMode.offset
            : 0;

        const targetPosAxis = (Number.isFinite(targetAnchor) ? targetAnchor : null);
        if (targetPosAxis == null) continue;

        // 現在の他軸はそのまま、対象軸だけ「ターゲット値」で確定させる
        const tx = obj.position.x;
        const ty = obj.position.y;
        const tz = obj.position.z;

        if (axis === "x") targetsById[id] = [targetPosAxis + off, ty, tz];
        if (axis === "y") targetsById[id] = [tx, targetPosAxis + off, tz];
        if (axis === "z") targetsById[id] = [tx, ty, targetPosAxis + off];
      }

      snapFinalAnchorRef.current = {
        axis,
        anchor: Number.isFinite(targetAnchor) ? targetAnchor : null,
        snapActive,
        targetsById,        // ✅ 追加：確定用の最終ターゲット
        t: performance.now(),
      };
    }

    const t = 1 - Math.exp(-damping * dt);

    const list = Array.isArray(selectedObjects) ? selectedObjects : [];
    for (const it of list) {
      const obj = it?.object;
      if (!obj) continue;

      const offsets = alignMode?.itemOffsets || {};
      const off = Number.isFinite(offsets[it.itemId])
        ? offsets[it.itemId]
        : Number.isFinite(alignMode?.offset)
          ? alignMode.offset
          : 0;

      const targetPosAxis = targetAnchor + off;

      if (axis === "x") obj.position.x += (targetPosAxis - obj.position.x) * t;
      if (axis === "y") obj.position.y += (targetPosAxis - obj.position.y) * t;
      if (axis === "z") obj.position.z += (targetPosAxis - obj.position.z) * t;

      obj.updateMatrixWorld?.(true);
    }

    // ✅ Snap OFF では preview を一切打たない
    if (!snapActive) return;

    const now = performance.now();
    if (now - lastPreviewAtRef.current < previewThrottleMs) return;
    lastPreviewAtRef.current = now;

    if (typeof onPreviewTransforms === "function" && list.length > 0) {
      const updates = list.map((it) => {
        const obj = it.object;
        return {
          itemId: it.itemId,
          transform: {
            position: [obj.position.x, obj.position.y, obj.position.z],
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          },
        };
      });
      onPreviewTransforms(updates);
      return;
    }

    if (typeof onPreviewTransform === "function" && previewItemId) {
      onPreviewTransform({
        itemId: previewItemId,
        transform: {
          position: [primaryObject.position.x, primaryObject.position.y, primaryObject.position.z],
          rotation: [primaryObject.rotation.x, primaryObject.rotation.y, primaryObject.rotation.z],
          scale: [primaryObject.scale.x, primaryObject.scale.y, primaryObject.scale.z],
        },
      });
    }
  });

  return null;
}