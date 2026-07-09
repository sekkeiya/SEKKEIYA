// src/features/layout/components/MainArea/components/scene/FurnitureItem.jsx
import React, { useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useResolvedUrl } from "@layout/features/layout/hooks/useResolvedUrl";

import { useToolsStore } from "@layout/features/layout/store/toolsStore/useToolsStore";
import { useSceneObjectRegistryStore } from "@layout/features/layout/store/sceneObjectRegistryStore";

/** 笨・霑ｽ蜉�・啌3F event 縺ｧ繧り誠縺｡縺ｪ縺・preventDefault / button 蜿門ｾ・*/
const getMouseButton = (e) => e?.nativeEvent?.button ?? e?.button ?? 0;
const safePreventDefault = (e) => {
  if (!e) return;
  if (typeof e.preventDefault === "function") e.preventDefault();
  else if (typeof e?.nativeEvent?.preventDefault === "function") e.nativeEvent.preventDefault();
};
const safeStopPropagation = (e) => {
  if (!e) return;
  if (typeof e.stopPropagation === "function") e.stopPropagation();
};

/** 笨・霑ｽ蜉�・哦LB繝ｭ繝ｼ繝牙､ｱ謨励〒 Canvas 繧定誠縺ｨ縺輔↑縺・*/
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    // 縺薙％縺ｧ繝ｭ繧ｰ縺悟叙繧後ｋ・・03遲会ｼ・
    console.warn("[FurnitureItem] GLB render failed:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

function applyShadowFlags(obj) {
  obj.traverse?.((c) => {
    if (c && c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
      if (Array.isArray(c.material)) c.material.forEach((m) => (m.needsUpdate = true));
      else if (c.material) c.material.needsUpdate = true;
    }
  });
}

function applySelectedEmissive(obj, selected) {
  obj.traverse?.((c) => {
    if (!c || !c.isMesh) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach((m) => {
      if (!m) return;
      if ("emissive" in m) {
        if (selected) {
          m.emissive = new THREE.Color(0.2, 0.4, 1.0);
          m.emissiveIntensity = 0.7;
        } else {
          m.emissive = new THREE.Color(0, 0, 0);
          m.emissiveIntensity = 0;
        }
        m.needsUpdate = true;
      }
    });
  });
}

function getItemGlbRaw(item) {
  return (
    item?.glbUrl ||
    item?.modelGlbUrl ||
    item?.asset?.glbUrl ||
    item?.files?.glb?.url ||
    item?.files?.glb?.downloadUrl ||
    item?.files?.glb?.downloadURL ||
    item?.files?.glb?.storagePath ||
    item?.files?.glb?.fullPath ||
    item?.glbStoragePath ||
    item?.viewerGlbUrl ||
    ""
  );
}

/** 笨・霑ｽ蜉�・啅RL 縺ｮ譛菴朱剞繝舌Μ繝・・繧ｷ繝ｧ繝ｳ
 * - storagePath 遲峨・ "models/xxx/yyy.glb" 縺梧擂縺滓凾縺ｫ useGLTF 縺吶ｋ縺ｨ莠区腐繧九・縺ｧ蠑ｾ縺・
 * - http(s) 縺ｮ逶ｴURL縺�縺鷹壹☆・・toragePath縺ｯuseResolvedUrl縺ｧURL蛹悶＆繧後ｋ諠ｳ螳夲ｼ・
 */
function isValidGlbUrl(u) {
  if (!u) return false;
  const s = String(u).trim();
  if (!s) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return true;
  return false;
}

function FurnitureGlbResolved({
  url,
  itemId,
  pos,
  rot,
  scl,
  selected,
  onSelect,
  freezeTransform = false,
}) {
  // 笨・縺薙％縺ｧ關ｽ縺｡繧句庄閭ｽ諤ｧ縺後≠繧九・縺ｧ荳贋ｽ阪〒 Suspense + ErrorBoundary 縺ｧ蛹・・
  const gltf = useGLTF(url);
  const groupRef = useRef(null);

  const register = useSceneObjectRegistryStore((s) => s.register);
  const materialPicking = useToolsStore((s) => s.materialPicking);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    applyShadowFlags(g);
  }, [gltf]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g || !itemId) return;

    g.traverse?.((o) => {
      if (!o) return;
      o.userData = { ...(o.userData || {}), ownerItemId: itemId, itemId };
    });
  }, [itemId, gltf]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    applySelectedEmissive(g, !!selected);
  }, [selected]);

  useEffect(() => {
    const obj = groupRef.current;
    if (!obj || !itemId) return;

    register?.(String(itemId), obj);
    return () => register?.(String(itemId), null);
  }, [itemId, register]);

  const handlePointerDown = useCallback(
    (e) => {
      const btn = getMouseButton(e);
      if (btn === 2) safePreventDefault(e);

      if (freezeTransform) {
        safeStopPropagation(e);
        safePreventDefault(e);
        return;
      }

      if (materialPicking) {
        safeStopPropagation(e);
        safePreventDefault(e);
      }
    },
    [materialPicking, freezeTransform]
  );

  const handleClick = useCallback(
    (e) => {
      const btn = getMouseButton(e);
      if (btn !== 0) return;

      if (freezeTransform) {
        safeStopPropagation(e);
        safePreventDefault(e);
        return;
      }

      if (materialPicking) {
        safePreventDefault(e);
        return;
      }

      safeStopPropagation(e);
      onSelect?.(String(itemId), e);
    },
    [itemId, onSelect, materialPicking, freezeTransform]
  );

  const handleContextMenu = useCallback((e) => {
    safePreventDefault(e);
  }, []);

  return (
    <group
      ref={groupRef}
      position={pos}
      rotation={rot}
      scale={scl}
      name={String(itemId)}
      userData={{ itemId: String(itemId), ownerItemId: String(itemId) }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {React.useMemo(() => gltf.scene ? <primitive object={gltf.scene.clone()} /> : null, [gltf.scene])}
    </group>
  );
}

function FurnitureBox({
  itemId,
  pos,
  rot,
  scl,
  selected,
  onSelect,
  freezeTransform = false,
}) {
  const meshRef = useRef(null);
  const register = useSceneObjectRegistryStore((s) => s.register);
  const materialPicking = useToolsStore((s) => s.materialPicking);

  useEffect(() => {
    const mat = meshRef.current?.material;
    if (!mat) return;
    if (selected) {
      mat.emissive = new THREE.Color(0.2, 0.4, 1.0);
      mat.emissiveIntensity = 0.7;
    } else {
      mat.emissive = new THREE.Color(0, 0, 0);
      mat.emissiveIntensity = 0;
    }
    mat.needsUpdate = true;
  }, [selected]);

  useEffect(() => {
    const obj = meshRef.current;
    if (!obj || !itemId) return;

    register?.(String(itemId), obj);
    return () => register?.(String(itemId), null);
  }, [itemId, register]);

  const handlePointerDown = useCallback(
    (e) => {
      const btn = getMouseButton(e);
      if (btn === 2) safePreventDefault(e);

      if (freezeTransform) {
        safeStopPropagation(e);
        safePreventDefault(e);
        return;
      }

      if (materialPicking) {
        safeStopPropagation(e);
        safePreventDefault(e);
      }
    },
    [materialPicking, freezeTransform]
  );

  const handleClick = useCallback(
    (e) => {
      const btn = getMouseButton(e);
      if (btn !== 0) return;

      if (freezeTransform) {
        safeStopPropagation(e);
        safePreventDefault(e);
        return;
      }

      if (materialPicking) {
        safeStopPropagation(e);
        safePreventDefault(e);
        return;
      }

      safeStopPropagation(e);
      onSelect?.(String(itemId), e);
    },
    [itemId, onSelect, materialPicking, freezeTransform]
  );

  const handleContextMenu = useCallback((e) => {
    safePreventDefault(e);
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={pos}
      rotation={rot}
      scale={scl}
      castShadow
      receiveShadow
      name={String(itemId)}
      userData={{ itemId: String(itemId), ownerItemId: String(itemId) }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial />
    </mesh>
  );
}

export default function FurnitureItem({
  item,
  selected,
  onSelect,
  version = 0,
  freezeTransform = false,
}) {
  const t = item?.transform || {};
  const pos = Array.isArray(t.position) ? t.position : [0, 0.3, 0];
  const rot = Array.isArray(t.rotation) ? t.rotation : [0, 0, 0];
  const scl = Array.isArray(t.scale) ? t.scale : [1, 1, 1];

  const itemId = useMemo(() => String(item?.id || ""), [item?.id]);

  const raw = useMemo(() => getItemGlbRaw(item), [item]);
  const resolved = useResolvedUrl(raw, version);
  const url = useMemo(() => (isValidGlbUrl(resolved) ? resolved : ""), [resolved]);

  if (!itemId) {
    console.warn("[FurnitureItem] item.id is missing:", item);
  }

  // 笨・url 縺梧怏蜉ｹ縺倥ｃ縺ｪ縺・↑繧・GLB 縺ｯ謠上°縺ｪ縺・ｼ・ox・・
  if (!url) {
    return (
      <FurnitureBox
        itemId={itemId}
        pos={pos}
        rot={rot}
        scl={scl}
        selected={selected}
        onSelect={onSelect}
        freezeTransform={freezeTransform}
      />
    );
  }

  // 笨・preload 縺ｯ莉ｻ諢擾ｼ医◆縺�縺玲怏蜉ｹURL縺�縺托ｼ・
  // useEffect(() => { try { useGLTF.preload(url); } catch {} }, [url]);

  // 笨・縺薙％縺檎區逕ｻ髱｢髦ｲ豁｢縺ｮ譬ｸ蠢・ｼ售uspense + ErrorBoundary
  return (
    <ModelErrorBoundary
      fallback={
        <FurnitureBox
          itemId={itemId}
          pos={pos}
          rot={rot}
          scl={scl}
          selected={selected}
          onSelect={onSelect}
          freezeTransform={freezeTransform}
        />
      }
    >
      <Suspense
        fallback={
          <FurnitureBox
            itemId={itemId}
            pos={pos}
            rot={rot}
            scl={scl}
            selected={selected}
            onSelect={onSelect}
            freezeTransform={freezeTransform}
          />
        }
      >
        <FurnitureGlbResolved
          url={url}
          itemId={itemId}
          pos={pos}
          rot={rot}
          scl={scl}
          selected={selected}
          onSelect={onSelect}
          freezeTransform={freezeTransform}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}