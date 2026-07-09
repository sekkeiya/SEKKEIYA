// controllers/ は共通して **Canvas 冁E�� useThree / useFrame を使ぁE��DOMめED世界に“副作用”を起こす層
// MaterialPickController�E�スポイト�E raycast ↁEmaterial info 抽出 ↁEstore commit
// 役割
// Material Pick モードで、クリチE��位置から raycast して “当たった面のマテリアル惁E�� Eを抽出し、storeにcommitする、E
// 責勁E
// pointerdown�E�Eapture�E�を Canvas DOM に張めE
// ※ 他�EクリチE��選択や gizmo と衝突しなぁE��めEcaptureで止める
// クリチE��位置めENDC に変換 ↁEraycaster
// raycast対象を構築！E
// baseColliders�E�EaseGlbのmesh群�E�E
// registry の全Object�E��E置家具など�E�E
// 重複uuidは排除
// 最初�E hit から material惁E��を抽出�E�E
// material / uuid / name / materialIndex�E�Eulti-material対応！E
// face normal�E�Eorld変換�E�E
// ownerItemId�E�EserData.itemId から送E��き�E�E
// point / uv など
// useMaterialPickerStore.getState().commitScenePick(info) に渡ぁE
// optionalで onPicked(info) を呼ぶ
// 機�E
// 「この面の材質は何？」を拾ぁE
// 今後「この材質を別オブジェクトに塗る」みたいなワークフローの起点になめE
// なぁEcontroller�E�E
// Canvas DOMイベンチE+ raycast + Object3D traversal の副作用塁E
// storeに結果を流すだけなので、SingleViewportCanvasから刁E��と見通しが良ぁE

import React, { useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useMaterialPickerStore } from "../../../store/materialPickerStore";

import { firstVisibleHit } from "../../../utils/sectionClipPick";

export default function MaterialPickController({
  active,
  enabled,
  baseCollidersRef,
  isBlocked,
  onPicked,
}) {
  const { gl, camera, raycaster } = useThree();
  const getAllObjects = useSceneObjectRegistryStore((s) => s.getAllObjects);

  const extractMaterialInfo = useCallback((hit) => {
    if (!hit?.object) return null;

    const obj = hit.object;

    const matRaw = obj.material;
    const mi = Number.isFinite(hit.materialIndex) ? hit.materialIndex : undefined;

    let material = matRaw;
    let materialIndex = mi;

    if (Array.isArray(matRaw)) {
      const idx = Number.isFinite(mi) ? mi : 0;
      material = matRaw[idx] || matRaw[0] || null;
      materialIndex = Number.isFinite(mi) ? mi : 0;
    }

    const normal = hit.face?.normal ? hit.face.normal.clone() : null;
    if (normal && obj?.matrixWorld) normal.transformDirection(obj.matrixWorld);

    const ownerItemId = obj?.userData?.itemId || obj?.parent?.userData?.itemId || null;

    return {
      material,
      materialUuid: material?.uuid || null,
      materialName: material?.name || "",
      materialIndex: Number.isFinite(materialIndex) ? materialIndex : null,

      objectUuid: obj.uuid,
      objectName: obj.name || obj.userData?.name || "",

      ownerItemId,

      point: hit.point ? [hit.point.x, hit.point.y, hit.point.z] : null,
      normal: normal ? [normal.x, normal.y, normal.z] : null,
      uv: hit.uv ? [hit.uv.x, hit.uv.y] : null,
    };
  }, []);

  const buildTargets = useCallback(() => {
    const targets = [];

    const base = baseCollidersRef?.current;
    if (Array.isArray(base) && base.length > 0) targets.push(...base);

    const objs = typeof getAllObjects === "function" ? getAllObjects() : [];
    if (Array.isArray(objs) && objs.length > 0) targets.push(...objs);

    const seen = new Set();
    const uniq = [];
    for (const t of targets) {
      if (!t?.uuid) continue;
      if (seen.has(t.uuid)) continue;
      seen.add(t.uuid);
      uniq.push(t);
    }
    return uniq;
  }, [baseCollidersRef, getAllObjects]);

  useEffect(() => {
    if (!active) return;
    if (!enabled) return;
    if (isBlocked) return;

    const el = gl?.domElement;
    if (!el) return;

    const stopForPick = (ev) => {
      ev.preventDefault?.();
      ev.stopPropagation?.();
      ev.stopImmediatePropagation?.();
    };

    const isEditableTag = (ev) => {
      const tag = String(ev.target?.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const getNdc = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      return { x, y };
    };

    const onPointerDownCapture = (ev) => {
      if (ev.button !== 0) return;
      if (isEditableTag(ev)) return;

      stopForPick(ev);

      const { x, y } = getNdc(ev.clientX, ev.clientY);
      if (x < -1 || x > 1 || y < -1 || y > 1) return;

      raycaster.setFromCamera({ x, y }, camera);

      const targets = buildTargets();
      if (!targets.length) return;

      const hits = raycaster.intersectObjects(targets, true);
      // 断面クリップで隠れている面は吸い取らない（表示されている最前面のみ）。
      const hit = firstVisibleHit(hits);
      if (!hit) return;

      const info = extractMaterialInfo(hit);
      if (!info) return;

      useMaterialPickerStore.getState().commitScenePick(info);
      onPicked?.(info);
    };

    el.addEventListener("pointerdown", onPointerDownCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [active, enabled, isBlocked, gl, camera, raycaster, buildTargets, extractMaterialInfo, onPicked]);

  return null;
}
