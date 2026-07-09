// src/features/layout/components/MainArea/components/scene/FurnitureItem.jsx
import React, { useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useResolvedUrl } from "@desktop/features/dsl/layout/hooks/useResolvedUrl";

import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { useSceneObjectRegistryStore } from "@desktop/features/dsl/layout/store/sceneObjectRegistryStore";
import { useEditorModeStore, useViewportEditorMode } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import { useUiVisibilityStore } from "@desktop/features/dsl/layout/store/uiVisibilityStore";
import { useSelectionScopeStore, canSelectItem } from "@desktop/features/dsl/layout/store/useSelectionScopeStore";
/** 笨・霑ｽ蜉�・啌3F event 縺ｧ繧り誠縺｡縺ｪ縺・preventDefault / button 蜿門ｾ・*/
const getMouseButton = (e) => e?.nativeEvent?.button ?? e?.button ?? 0;
const safePreventDefault = (e) => {
  if (!e) return;
  try {
    if (e.nativeEvent && e.nativeEvent.cancelable === false) return;
    if (typeof e.preventDefault === "function") e.preventDefault();
    else if (typeof e?.nativeEvent?.preventDefault === "function") e.nativeEvent.preventDefault();
  } catch (err) {
    // Ignore passive event listener errors
  }
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
  if (!obj) return;
  obj.traverse?.((c) => {
    if (!c || !c.isMesh) return;

    if (selected) {
      // まだクローンしていない場合のみクローン
      if (!c.userData._origMat) {
        const orig = c.material;
        if (Array.isArray(orig)) {
          // emissive未対応マテリアル（MeshBasicMaterial等）が含まれる場合はスキップ
          // → uniforms.emissive が存在しない素材に emissive を設定すると
          //   Three.js の refreshUniformsCommon が毎フレームクラッシュする
          if (orig.some(m => m.emissive === undefined)) return;
          c.userData._origMat = orig;
          c.material = orig.map((m) => {
            const cloned = m.clone();
            cloned.emissive = new THREE.Color("#ffa726");
            cloned.emissiveIntensity = 0.45;
            cloned.needsUpdate = true;
            return cloned;
          });
        } else if (orig) {
          // MeshBasicMaterial / LineBasicMaterial など emissive uniform を持たない素材はスキップ
          if (orig.emissive === undefined) return;
          c.userData._origMat = orig;
          const cloned = orig.clone();
          cloned.emissive = new THREE.Color("#ffa726");
          cloned.emissiveIntensity = 0.45;
          cloned.needsUpdate = true;
          c.material = cloned;
        }
      }
    } else {
      // 選択解除：オリジナルに戻してクローンを破棄
      if (c.userData._origMat) {
        const cloned = c.material;
        c.material = c.userData._origMat;
        delete c.userData._origMat;
        // クローンマテリアルを dispose
        if (Array.isArray(cloned)) {
          cloned.forEach((m) => m.dispose?.());
        } else {
          cloned?.dispose?.();
        }
      }
    }
  });
}

function applyDimmer(obj, isDimmed) {
  // 共有マテリアルを直接変更すると uniforms が壊れてクラッシュするため、一旦無効化
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

function BoingWrapper({ children }) {
  const groupRef = useRef(null);
  const state = useRef({
    val: 0,
    vel: 0,
    target: 0,
    tension: 300,
    friction: 12,
    ready: false,
    frames: 0
  });

  useFrame((_, delta) => {
    const s = state.current;

    // Wait a few frames for Three.js to compile shaders & upload GPU buffers
    if (!s.ready) {
      s.frames++;
      if (s.frames > 3) {
        s.ready = true;
        s.target = 1; // Start animation after GPU is warm
      }
      return;
    }

    if (Math.abs(s.val - s.target) < 0.001 && Math.abs(s.vel) < 0.001) {
      if (s.val !== s.target && groupRef.current) {
        s.val = s.target;
        groupRef.current.scale.setScalar(s.val);
      }
      return;
    }
    const dt = Math.min(delta, 0.05); // Max delta 50ms to prevent explosion
    
    if (s.ready && s.target === 1 && delta > 0.05) {
       console.warn("[BoingWrapper] ⚠️ LONG DELTA DETECTED during animation:", delta.toFixed(3), "s. This causes a jump!");
    }

    const force = -s.tension * (s.val - s.target) - s.friction * s.vel;
    s.vel += force * dt;
    s.val += s.vel * dt;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(Math.max(0.001, s.val));
    }
  });

  return (
    <group ref={groupRef} scale={0.001}>
      {children}
    </group>
  );
}

function FurnitureGlbResolvedInner({
  url,
  itemId,
  selected,
  dimensionsMm = null,
}) {
  const gltf = useGLTF(url);
  const innerRef = useRef(null);

  useEffect(() => {
    const g = innerRef.current;
    if (!g) return;
    applyShadowFlags(g);
  }, [gltf]);

  useEffect(() => {
    const g = innerRef.current;
    if (!g || !itemId) return;

    g.traverse?.((o) => {
      if (!o) return;
      o.userData = { ...(o.userData || {}), ownerItemId: itemId, itemId };
    });
  }, [itemId, gltf]);

  useEffect(() => {
    const g = innerRef.current;
    if (!g) return;
    applySelectedEmissive(g, !!selected);
    // アンマウント時にクローンマテリアルを必ず解放
    return () => {
      applySelectedEmissive(g, false);
    };
  }, [selected]);

  // Handle Ceiling Mode Dimming
  const { layoutSubMode } = useViewportEditorMode();
  useEffect(() => {
    const g = innerRef.current;
    if (!g) return;
    
    // Check if this item is a ceiling light (heuristic based on name/category)
    const isCeilingLight = 
      url?.toLowerCase().includes("light") || 
      url?.toLowerCase().includes("ceiling") ||
      (itemId && itemId.toLowerCase().includes("light"));

    const isDimmed = layoutSubMode === "ceiling_top" && !isCeilingLight;
    applyDimmer(g, isDimmed);
  }, [layoutSubMode, url, itemId, gltf]);

  const cloned = React.useMemo(() => {
    if (!gltf?.scene) return null;
    const clonedScene = gltf.scene.clone();
    clonedScene.name = "gltf-scene";
    return clonedScene;
  }, [gltf.scene]);

  const { offsetX, offsetY, offsetZ, autoScale } = React.useMemo(() => {
    if (!cloned) return { offsetX: 0, offsetY: 0, offsetZ: 0, autoScale: 1 };
    const box = new THREE.Box3().setFromObject(cloned);
    let ox = 0, oy = 0, oz = 0, scale = 1;
    
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // We want the parent's [0,0,0] to be at the object's bottom-center.
      ox = -center.x;
      oy = -box.min.y;
      oz = -center.z;

      let targetWidth = 0;
      if (dimensionsMm) {
         targetWidth = Number(dimensionsMm.width ?? dimensionsMm.x) || 0;
      }
      if (targetWidth > 0 && size.x > 0) {
          scale = targetWidth / size.x;
      }
      if (scale === 1 && size.x > 0 && size.x < 50) {
         scale = 600 / size.x;
      }
    }
    return { offsetX: ox, offsetY: oy, offsetZ: oz, autoScale: scale };
  }, [cloned, dimensionsMm]);

  if (!cloned) return null;

  return (
    <BoingWrapper>
      <group ref={innerRef}>
        <group scale={[autoScale, autoScale, autoScale]}>
          <group position={[offsetX, offsetY, offsetZ]}>
            <primitive object={cloned} />
          </group>
        </group>
        {selected && useEditorModeStore.getState().editorMode === "layout" && (
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.7, 32]} />
            <meshBasicMaterial color="#ffa726" transparent opacity={0.4} depthWrite={false} />
            {/* A ring for border */}
            <mesh position={[0, 0, 0]}>
              <ringGeometry args={[0.65, 0.7, 32]} />
              <meshBasicMaterial color="#ffa726" transparent opacity={0.8} depthWrite={false} />
            </mesh>
          </mesh>
        )}
      </group>
    </BoingWrapper>
  );
}

function FurnitureBoxInner({
  dimensionsMm = null,
  selected = false
}) {
  const dimW = dimensionsMm ? (Number(dimensionsMm.width ?? dimensionsMm.x) || 0) : 0;
  const dimH = dimensionsMm ? (Number(dimensionsMm.height ?? dimensionsMm.z) || 0) : 0;
  const dimD = dimensionsMm ? (Number(dimensionsMm.depth ?? dimensionsMm.y) || 0) : 0;

  const w = dimW > 0 ? dimW : 600;
  const h = dimH > 0 ? dimH : 600;
  const d = dimD > 0 ? dimD : 600;

  return (
    <BoingWrapper>
      <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          emissive={selected ? "#ffa726" : "#000000"}
          emissiveIntensity={selected ? 0.45 : 0}
        />
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {selected && useEditorModeStore.getState().editorMode === "layout" && (
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.7, 32]} />
          <meshBasicMaterial color="#ffa726" transparent opacity={0.4} depthWrite={false} />
          {/* A ring for border */}
          <mesh position={[0, 0, 0]}>
            <ringGeometry args={[0.65, 0.7, 32]} />
            <meshBasicMaterial color="#ffa726" transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </mesh>
      )}
      </group>
    </BoingWrapper>
  );
}

function FurnitureItemComponent({
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

  const itemId = React.useMemo(() => String(item?.id || ""), [item?.id]);

  const raw = React.useMemo(() => getItemGlbRaw(item), [item]);
  const resolved = useResolvedUrl(raw, version);
  const url = React.useMemo(() => (isValidGlbUrl(resolved) ? resolved : ""), [resolved]);

  const rootGroupRef = useRef(null);
  const register = useSceneObjectRegistryStore((s) => s.register);
  const materialPicking = useToolsStore((s) => s.materialPicking);
  const editorMode = useEditorModeStore((s) => s.editorMode);

  // Outliner の 👁 トグルと連動した可視状態
  const isHidden = useUiVisibilityStore((s) => !!s.hiddenNodeIds[`item:${itemId}`]);

  useEffect(() => {
    const obj = rootGroupRef.current;
    if (!obj || !itemId) return;

    register?.(String(itemId), obj);
    return () => {
      register?.(String(itemId), null);
    };
  }, [itemId, register]);

  const handlePointerDown = useCallback(
    (e) => {
      // onPointerDown は R3F により passive: true で登録されるため
      // preventDefault() は無効（警告が出るだけ）。stopPropagation のみ使用する。
      // コンテキストメニューの抑制は handleContextMenu (non-passive) で行う。
      if (freezeTransform) {
        safeStopPropagation(e);
        return;
      }

      if (materialPicking) {
        safeStopPropagation(e);
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

      // Selection scope: stop propagation always so background plane never fires,
      // then bail out without selecting if this kind is restricted.
      safeStopPropagation(e);
      if (!canSelectItem(useSelectionScopeStore.getState().scope)) return;
      onSelect?.(String(itemId), e);
    },
    [itemId, onSelect, materialPicking, freezeTransform]
  );

  const handleContextMenu = useCallback((e) => {
    safePreventDefault(e);
  }, []);

  return (
    <group
      ref={rootGroupRef}
      position={freezeTransform ? undefined : pos}
      rotation={freezeTransform ? undefined : rot}
      scale={freezeTransform ? undefined : scl}
      visible={!isHidden}
      name={String(itemId)}
      userData={{ itemId: String(itemId), ownerItemId: String(itemId) }}
      onPointerDown={editorMode === "zoning" ? undefined : handlePointerDown}
      onClick={editorMode === "zoning" ? undefined : handleClick}
      onContextMenu={handleContextMenu}
    >
        {!url ? (
          <FurnitureBoxInner dimensionsMm={item?.dimensionsMm || null} selected={selected} />
        ) : (
          <ModelErrorBoundary fallback={<FurnitureBoxInner dimensionsMm={item?.dimensionsMm || null} selected={selected} />}>
            <Suspense fallback={null}>
              <FurnitureGlbResolvedInner
                url={url}
                itemId={itemId}
                selected={selected}
                dimensionsMm={item?.dimensionsMm || null}
              />
            </Suspense>
          </ModelErrorBoundary>
        )}
    </group>
  );
}

// Optimization: Prevent heavy re-renders when layoutDraft updates unrelated items or selection state changes
const itemPropsEqual = (prev, next) => {
  if (prev.selected !== next.selected) return false;
  if (prev.version !== next.version) return false;
  if (prev.freezeTransform !== next.freezeTransform) return false;
  
  const pI = prev.item || {};
  const nI = next.item || {};
  if (pI.id !== nI.id) return false;
  
  const pUrl = getItemGlbRaw(pI);
  const nUrl = getItemGlbRaw(nI);
  if (pUrl !== nUrl) return false;

  if (pI.transform !== nI.transform) return false;

  return true;
};

const FurnitureItem = React.memo(FurnitureItemComponent, itemPropsEqual);
export default FurnitureItem;