// src/features/layout/components/MainArea/components/scene/FurnitureItem.jsx
import React, { useEffect, useMemo, useRef, useCallback, Suspense, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useResolvedUrl } from "../../hooks/useResolvedUrl";
import { getGlbLocalUrlSync, resolveGlbUrl } from "../../../../../lib/glbDiskCache";

import { useToolsStore } from "../../store/toolsStore/useToolsStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useEditorModeStore, useViewportEditorMode } from "../../store/useEditorModeStore";
import { useViewportDisplayStore } from "../../store/useViewportDisplayStore";
import { useUiVisibilityStore } from "../../store/uiVisibilityStore";
import { useSelectionScopeStore, canSelectItem } from "../../store/useSelectionScopeStore";
import { useItemInfoRegistryStore } from "../../store/itemInfoRegistryStore";
import { useItemSwapRegistryStore } from "../../store/itemSwapRegistryStore";
import { useItemMaterialRegistryStore } from "../../store/itemMaterialRegistryStore";
import { useItemReplaceStore } from "../../store/useItemReplaceStore";
import { useWalkthroughGalleryStore } from "../../store/walkthroughGalleryStore";
import { readMaterialPresets, readMaterialVariants, expandVariantSelection, buildBindingsFromSelection, variantSwatchColor, variantSwatchImage } from "../../../../shared/material/materialPresets";
import GimmickBinder from "./GimmickBinder.jsx";
import { LoopAnimator } from "../../../../shared/walkthrough/LoopAnimator";
import { normalizeGimmicks } from "../../../../shared/walkthrough/gimmicks";
import { applyBindingToObject } from "../../../../shared/material/applyMaterial";
import { useAIDriveStore } from "../../../../../store/useAIDriveStore";
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
    this.props.onError?.(err);
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

// ── マテリアル切替フェード用ヘルパー ──
function collectMaterials(obj) {
  const mats = [];
  obj?.traverse?.((c) => {
    if (c?.isMesh && c.material) {
      (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (m) mats.push(m); });
    }
  });
  return mats;
}
// 元の transparent/opacity を 1 度だけ控える（中断されても真の元値を保持）
function fadeMark(m) {
  if (m.userData.__matFade === undefined) m.userData.__matFade = { t: m.transparent, o: m.opacity };
}
function fadeRestore(m) {
  const f = m.userData.__matFade;
  if (f) { m.transparent = f.t; m.opacity = f.o; delete m.userData.__matFade; }
}
// rAF タイムスタンプベースの簡易トゥイーン（Date.now 不使用）
function rafTween(durationMs, onUpdate) {
  return new Promise((resolve) => {
    let start = -1;
    const step = (now) => {
      if (start < 0) start = now;
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      onUpdate(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
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
    item?.modelUrl ||
    item?.storageUrl ||
    item?.metadata?.glbUrl ||
    item?.metadata?.downloadUrl ||
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
  gimmickSpecs = null,
  gimmickLabel,
  animSpec = null,
  materialBindings = null,
}) {
  const gltf = useGLTF(url);
  const { gl } = useThree();
  const innerRef = useRef(null);
  const animRef = useRef(null);
  // マテリアル切替フェード用（初回適用はフェードなし / 連打時の中断トークン）
  const matFirstRef = useRef(true);
  const matTokenRef = useRef(0);
  // クリッピングによる縦ワイプを使うため localClipping を有効化
  useEffect(() => { if (gl) gl.localClippingEnabled = true; }, [gl]);
  // 常時アニメ（展示ループ）はウォークスルー中のみ動かす。編集モードでは静止させる。
  const isWalkthroughMode = useEditorModeStore((s) => s.editorMode === "walkthrough");
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const structureTagging = useEditorModeStore((s) => s.structureTagging);
  // 家具の半透明（ゴースト）はモードではなくビューポート設定で制御（統一）。
  const ghostFurniture = useViewportDisplayStore((s) => s.ghostFurniture);

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

  // Material モードでは家具を非表示にせず半透明（ゴースト）にして、躯体面を選択しやすくする。
  useEffect(() => {
    const g = innerRef.current;
    if (!g) return;
    const ghost = ghostFurniture || structureTagging;
    // ビューポート設定の「家具を半透明」または躯体タグ付け中は、床/壁/天井を選びやすくゴースト化。
    const ghostOpacity = 0.2;
    g.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => {
        if (!m) return;
        if (ghost) {
          if (m.userData.__preGhost === undefined) {
            m.userData.__preGhost = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
          }
          m.transparent = true;
          m.opacity = ghostOpacity;
          m.depthWrite = false;
          m.needsUpdate = true;
        } else if (m.userData.__preGhost !== undefined) {
          const b = m.userData.__preGhost;
          m.transparent = b.transparent;
          m.opacity = b.opacity;
          m.depthWrite = b.depthWrite;
          delete m.userData.__preGhost;
          m.needsUpdate = true;
        }
      });
    });
  }, [ghostFurniture, structureTagging, gltf]);

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

  // この配置インスタンス固有のマテリアル上書き（S.Layout の「アイテムを編集」で保存した内容）を適用。
  // materialBindings = [{ meshName, materialIndex, material(snapshot) }]
  useEffect(() => {
    if (!cloned) return;
    const slots = Array.isArray(materialBindings) ? materialBindings.filter((b) => b && b.material) : [];
    if (!slots.length) return;

    const apply = () => applyBindingToObject(cloned, { id: "", targetType: "model", modelId: "", slots });

    // 初回（マウント直後の初期適用）はフェードなしで即適用
    if (matFirstRef.current) {
      matFirstRef.current = false;
      apply().catch(() => {});
      return;
    }

    // マテリアル切替：上から下へ「貼り替わる」縦ワイプ
    //   旧素材のスナップショット・クローンを重ね、本体に新素材を適用。
    //   水平クリッピング面 h を上端→下端へ動かし、上=新素材 / 下=旧素材 を分割表示する。
    const token = ++matTokenRef.current;
    let cancelled = false;
    const stale = () => cancelled || token !== matTokenRef.current;

    let overlay = null;
    let newMats = [];

    const cleanup = () => {
      // 本体のクリッピングを解除
      newMats.forEach((m) => { if (m) { m.clippingPlanes = null; m.clipShadows = false; m.needsUpdate = true; } });
      // オーバーレイ撤去（geometry は共有なので material のみ dispose）
      if (overlay) {
        collectMaterials(overlay).forEach((m) => m.dispose?.());
        overlay.parent?.remove(overlay);
        overlay = null;
      }
    };

    (async () => {
      try {
        const box = new THREE.Box3().setFromObject(cloned);
        if (box.isEmpty()) { await apply().catch(() => {}); return; }
        const topY = box.max.y;
        const botY = box.min.y;
        const margin = Math.max(1e-3, (topY - botY) * 0.02);
        const startH = topY + margin;
        const endH = botY - margin;

        // 1) 旧素材のスナップショット・クローン（独立マテリアル）を本体と同じ場所へ重ねる
        overlay = cloned.clone(true);
        overlay.traverse((c) => {
          if (c.isMesh && c.material) {
            c.material = Array.isArray(c.material) ? c.material.map((m) => m.clone()) : c.material.clone();
          }
        });
        cloned.parent?.add(overlay);
        overlay.renderOrder = (cloned.renderOrder || 0) - 1;

        // 2) 新素材を本体へ適用
        await apply().catch(() => {});
        if (stale()) { cleanup(); return; }

        // 3) クリッピング面（world 空間 Y）。本体(新)=上を表示 / オーバーレイ(旧)=下を表示
        const planeNew = new THREE.Plane(new THREE.Vector3(0, 1, 0), -startH);  // y >= h
        const planeOld = new THREE.Plane(new THREE.Vector3(0, -1, 0), startH);  // y <= h
        newMats = collectMaterials(cloned);
        const oldMats = collectMaterials(overlay);
        newMats.forEach((m) => { m.clippingPlanes = [planeNew]; m.clipShadows = true; m.needsUpdate = true; });
        oldMats.forEach((m) => { m.clippingPlanes = [planeOld]; m.needsUpdate = true; });

        // 4) しきい値 h を上→下へアニメ
        await rafTween(650, (t) => {
          if (stale()) return;
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
          const h = startH + (endH - startH) * e;
          planeNew.constant = -h;
          planeOld.constant = h;
        });
        if (stale()) { cleanup(); return; }

        cleanup();
      } catch (e) {
        // 失敗時は通常適用にフォールバック
        cleanup();
        if (!stale()) await apply().catch(() => {});
      }
    })();

    return () => { cancelled = true; cleanup(); };
  }, [cloned, materialBindings]);

  // 寸法 (mm) を軸ごとに取り出す。
  // CADの {x,y,z}（z=高さ/y=奥行き）と {width,depth,height} の両表記に対応。
  // Three.js は Y-up なので X=幅(width), Y=高さ(height), Z=奥行き(depth)。
  const targetW = Number(dimensionsMm?.width ?? dimensionsMm?.x) || 0;
  const targetH = Number(dimensionsMm?.height ?? dimensionsMm?.z) || 0;
  const targetD = Number(dimensionsMm?.depth ?? dimensionsMm?.y) || 0;

  const { offsetX, offsetY, offsetZ, scaleVec } = React.useMemo(() => {
    if (!cloned) return { offsetX: 0, offsetY: 0, offsetZ: 0, scaleVec: [1, 1, 1] };
    const box = new THREE.Box3().setFromObject(cloned);
    if (box.isEmpty()) return { offsetX: 0, offsetY: 0, offsetZ: 0, scaleVec: [1, 1, 1] };

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // 親の [0,0,0] がモデルの底面中心になるようオフセット（GLB のネイティブ座標系で指定）
    const ox = -center.x;
    const oy = -box.min.y;
    const oz = -center.z;

    // 各軸の目標寸法が指定されていればその寸法に厳密にスケール（W/D/H すべて反映）。
    // 指定の無い軸は「幅基準の均等スケール」へフォールバックし、
    //   - 寸法が幅だけの旧データは従来どおりプロポーションを保ったまま表示
    //   - 寸法ゼロのデータは極小モデル救済 (600mm) を維持
    // という後方互換を保つ。
    const primary =
      targetW > 0 && size.x > 0
        ? targetW / size.x
        : (size.x > 0 && size.x < 50 ? 600 / size.x : 1);

    const sx = targetW > 0 && size.x > 0 ? targetW / size.x : primary;
    const sy = targetH > 0 && size.y > 0 ? targetH / size.y : primary;
    const sz = targetD > 0 && size.z > 0 ? targetD / size.z : primary;

    return { offsetX: ox, offsetY: oy, offsetZ: oz, scaleVec: [sx, sy, sz] };
  }, [cloned, targetW, targetH, targetD]);

  if (!cloned) return null;

  return (
    <BoingWrapper>
      <group ref={innerRef}>
        <group ref={animRef}>
          <group scale={scaleVec}>
            <group position={[offsetX, offsetY, offsetZ]}>
              <primitive object={cloned} />
              {(Array.isArray(gimmickSpecs) ? gimmickSpecs : []).map((g) => (
                <GimmickBinder
                  key={g.id}
                  cloned={cloned}
                  animations={gltf.animations || []}
                  itemId={itemId}
                  gimmickId={g.id}
                  spec={g}
                  label={g.label || gimmickLabel}
                />
              ))}
            </group>
          </group>
        </group>
        <LoopAnimator targetRef={animRef} anim={animSpec} unit={1} enabled={isWalkthroughMode} />
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

  // 家具置き換え：候補（元モデル＋同カテゴリ登録分）。swapIndex 0 = 元モデル。
  // 配置 item / ストアに無ければ、アセット本体を Firestore から取得して補完（鮮度保証）。
  const baseModelId = item?.modelId ? String(item.modelId) : undefined;
  const [fetchedAsset, setFetchedAsset] = useState(null);
  useEffect(() => {
    if (!baseModelId) { setFetchedAsset(null); return; }
    let alive = true;
    (async () => {
      try {
        const { db } = await import("../../../../../lib/firebase/client");
        const { doc, getDoc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db, "assets", baseModelId));
        if (alive && snap.exists()) setFetchedAsset({ id: snap.id, ...snap.data() });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [baseModelId]);
  const swapList = React.useMemo(() => {
    const raw = Array.isArray(item?.swapModels) && item.swapModels.length
      ? item.swapModels
      : (Array.isArray(fetchedAsset?.extendedMetadata?.swapModels) ? fetchedAsset.extendedMetadata.swapModels : []);
    return raw.filter((m) => m && (m.glbUrl || m.id));
  }, [item?.swapModels, fetchedAsset]);
  const [swapIndex, setSwapIndex] = useState(0);
  useEffect(() => { setSwapIndex(0); }, [itemId]);
  // 「似た商品」からの置換（CLIP類似 or 画像→3D生成）。override があれば最優先で表示モデルを差し替える。
  const replaceOverride = useItemReplaceStore((s) => s.overrides[itemId] || null);
  const swapActive = replaceOverride || (swapIndex > 0 ? (swapList[swapIndex - 1] || null) : null);

  // 差し替え中は「差し替え先アセット本体」を取得し、寸法・情報・マテリアルにそれを使う。
  const [swapAsset, setSwapAsset] = useState(null);
  useEffect(() => {
    if (!swapActive?.id) { setSwapAsset(null); return; }
    let alive = true;
    (async () => {
      try {
        const { db } = await import("../../../../../lib/firebase/client");
        const { doc, getDoc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db, "assets", String(swapActive.id)));
        if (alive && snap.exists()) setSwapAsset({ id: snap.id, ...snap.data() });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [swapActive]);
  // 有効な寸法（少なくとも1軸が正）かを判定。0/未設定なら採用しない（スケール破綻＝消失を防ぐ）。
  const validDims = (dd) => !!dd && (
    (Number(dd.width ?? dd.x) > 0) || (Number(dd.height ?? dd.z) > 0) || (Number(dd.depth ?? dd.y) > 0)
  );
  const swapDims = validDims(swapActive?.dimensions) ? swapActive.dimensions
    : (validDims(swapAsset?.dimensions) ? swapAsset.dimensions : null);
  const effectiveDimensions = swapActive
    ? (swapDims || item?.dimensionsMm || null)
    : (item?.dimensionsMm || null);

  const modelId = swapActive
    ? (swapActive.id ? String(swapActive.id) : undefined)
    : (item?.modelId ? String(item.modelId) : undefined);

  // ディスクキャッシュは「元モデル」のみ対象。差し替え中は候補の glbUrl を直接使う
  // （差し替えモデルは配置アイテムの modelId キャッシュと一致しないため、キャッシュ経由だと壊れる）。
  const cacheModelId = swapActive ? undefined : (item?.modelId ? String(item.modelId) : undefined);
  const [localUrl, setLocalUrl] = useState(() => getGlbLocalUrlSync(cacheModelId) || "");
  // ローカル asset:// URL のロードに失敗したら以後ネットワーク URL に切り替える
  const localUrlFailedRef = useRef(false);
  useEffect(() => { localUrlFailedRef.current = false; setLocalUrl(getGlbLocalUrlSync(cacheModelId) || ""); }, [cacheModelId]);
  useEffect(() => {
    if (!cacheModelId || localUrl || localUrlFailedRef.current) return;
    resolveGlbUrl(cacheModelId).then((url) => {
      if (url && !localUrlFailedRef.current) setLocalUrl(url);
    });
  }, [cacheModelId, localUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGlbError = useCallback(() => {
    if (localUrl) {
      console.warn(
        "[FurnitureItem] local GLB cache failed, falling back to network URL:",
        localUrl
      );
      localUrlFailedRef.current = true;
      setLocalUrl("");
    }
  }, [localUrl]);

  // 差し替え中は候補の glbUrl を直接解決。元モデルは localUrl（キャッシュ）優先。
  const raw = React.useMemo(() => {
    if (swapActive) return swapActive.glbUrl || "";
    return localUrl ? "" : getItemGlbRaw(item);
  }, [item, localUrl, swapActive]);
  const resolved = useResolvedUrl(raw, version);
  const url = React.useMemo(() => {
    if (swapActive) return isValidGlbUrl(resolved) ? resolved : "";
    if (localUrl) return localUrl;
    return isValidGlbUrl(resolved) ? resolved : "";
  }, [localUrl, resolved, swapActive]);

  const rootGroupRef = useRef(null);
  const register = useSceneObjectRegistryStore((s) => s.register);
  const materialPicking = useToolsStore((s) => s.materialPicking);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const structureTagging = useEditorModeStore((s) => s.structureTagging);

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

  // ── ウォークスルーのメタデータ解決 ──
  // ビルダー修正前に配置されたアイテムには info/anim/gimmicks が無い場合があるため、
  // 無ければモデル（アセット）の extendedMetadata から補完する。
  const storeAsset = useAIDriveStore((s) =>
    modelId ? (s.assets.find((a) => a.id === modelId) || null) : null
  );
  const storeMeta = storeAsset?.extendedMetadata || null;
  // 差し替え中は差し替え先アセットのメタを最優先。次にストア、最後に元アセット（非差し替え時のみ）。
  const assetMeta = swapActive
    ? (swapAsset?.extendedMetadata || storeMeta || null)
    : (storeMeta || fetchedAsset?.extendedMetadata || null);
  const hasItemGimmicks = !!(item?.gimmick || (Array.isArray(item?.gimmicks) && item.gimmicks.length));
  const gimmickMetaSource = hasItemGimmicks ? item : (assetMeta || item);
  const resolvedGimmickSpecs = useMemo(() => normalizeGimmicks(gimmickMetaSource), [gimmickMetaSource]);
  const resolvedAnimSpec = item?.anim || assetMeta?.anim || null;

  // マテリアル・パターン切替（ウォークスルー）。matIndex 0 = デフォルト（保存済みオーバーライド or 元素材）。
  // 差し替え中は差し替え先アセットの presets / variants を使う（その家具に登録された素材を表示・変更）。
  const matPresets = useMemo(
    () => readMaterialPresets({
      materialPresets: swapActive
        ? (Array.isArray(swapAsset?.materialPresets) ? swapAsset.materialPresets : undefined)
        : (Array.isArray(item?.materialPresets) ? item.materialPresets : fetchedAsset?.materialPresets),
    }),
    [swapActive, swapAsset, item?.materialPresets, fetchedAsset]
  );
  const matVariants = useMemo(
    () => readMaterialVariants({
      materialVariants: swapActive
        ? (Array.isArray(swapAsset?.materialVariants) ? swapAsset.materialVariants : undefined)
        : (Array.isArray(item?.materialVariants) ? item.materialVariants : fetchedAsset?.materialVariants),
    }),
    [swapActive, swapAsset, item?.materialVariants, fetchedAsset]
  );
  const [matIndex, setMatIndex] = useState(0);
  useEffect(() => { setMatIndex(0); }, [itemId]);
  // 家具を差し替えたらマテリアル選択をリセット（差し替え先のデフォルト素材から開始）。
  useEffect(() => { setMatIndex(0); }, [swapActive]);
  const liveMaterialBindings = useMemo(() => {
    if (matIndex > 0 && matVariants[matIndex - 1]) {
      return buildBindingsFromSelection(matPresets, expandVariantSelection(matPresets, matVariants[matIndex - 1]));
    }
    // 差し替え中はデフォルト時に元アイテムの materialBindings を流用しない（別モデルのため）。
    return swapActive ? null : (Array.isArray(item?.materialBindings) ? item.materialBindings : null);
  }, [matIndex, matVariants, matPresets, item?.materialBindings, swapActive]);
  useEffect(() => {
    if (!itemId) return;
    const { register: regMat, unregister: unregMat } = useItemMaterialRegistryStore.getState();
    if (matVariants.length >= 1) {
      const options = [
        // デフォルト=元のGLB素材。家具自身のサムネを見せて「素のままの見た目」を示す。
        { id: "default", label: "デフォルト", swatchColor: undefined, thumbUrl: infoThumb, apply: () => setMatIndex(0) },
        ...matVariants.map((v, i) => ({
          id: v.id || `v${i}`,
          label: v.title || `パターン${i + 1}`,
          swatchColor: variantSwatchColor(matPresets, v),
          thumbUrl: variantSwatchImage(matPresets, v),
          apply: () => setMatIndex(i + 1),
        })),
      ];
      const currentId = options[Math.min(matIndex, options.length - 1)]?.id;
      regMat({ itemId: String(itemId), options, currentId, cycle: () => setMatIndex((i) => (i + 1) % options.length) });
      useWalkthroughGalleryStore.getState().bump();
    } else {
      unregMat(String(itemId));
    }
    return () => unregMat(String(itemId));
  }, [itemId, matVariants, matIndex]);

  // ウォークスルーのアイテム情報（ⓘ）を登録。
  // 差し替え中は差し替え先モデルの情報（タイトル/サムネ/寸法/説明/リンク）を表示する。
  const itemInfo = swapActive ? (assetMeta?.info || null) : (item?.info || assetMeta?.info || null);
  const infoTitle = swapActive
    ? (swapAsset?.title || swapActive?.title || "アイテム")
    : (item?.title || item?.name || item?.label || "アイテム");
  const infoThumb = swapActive
    ? (swapActive?.thumbUrl || swapAsset?.thumbUrl || swapAsset?.thumbnailUrl || null)
    : (item?.thumbUrl || item?.thumbnailUrl || null);
  const infoGlb = swapActive ? (swapActive?.glbUrl || swapAsset?.glbUrl || null) : (item?.glbUrl || null);
  const infoDims = effectiveDimensions || item?.dimensionsMm || null;

  // S.Models 相当のリッチ情報のソース（カテゴリ/寸法/価格/素材/タグ/関連リンク）。
  // 差し替え中は差し替え先アセットを優先。通常はストア→Firestore→配置アイテムの順。
  // カタログ/関連リンクは「ストアに無くても Firestore には有る」ことがあるため、
  // 単一ソースに固定せず、各ソースから値が在るものをフィールド単位で拾う。
  const infoSources = swapActive
    ? [swapAsset, swapActive]
    : [storeAsset, fetchedAsset, item];
  const infoAsset = useMemo(() => {
    // フィールド単位で「最初に値が在るソース」を採用（空配列/未定義はスキップ）。
    const srcs = infoSources.filter(Boolean);
    const pick = (k) => {
      for (const s of srcs) {
        const v = s?.[k];
        if (Array.isArray(v) ? v.length : (v !== undefined && v !== null && v !== "")) return v;
      }
      return undefined;
    };
    return {
      macroCategory: pick("macroCategory"),
      mainCategory: pick("mainCategory"),
      subCategory: pick("subCategory"),
      userCategory: pick("userCategory"),
      dimensions: pick("dimensions"),
      price: pick("price"),
      materials: pick("materials"),
      tags: pick("tags"),
      relatedLinks: pick("relatedLinks"),
      catalogLinks: pick("catalogLinks"),
      sourceUrl: pick("sourceUrl"),
      extendedMetadata: pick("extendedMetadata"),
    };
  }, [swapActive, swapAsset, storeAsset, fetchedAsset, item]); // eslint-disable-line react-hooks/exhaustive-deps
  const infoExtras = useMemo(() => {
    const a = infoAsset || {};
    const categoryPath = [a.macroCategory, a.mainCategory, a.subCategory || a.userCategory]
      .filter((s) => typeof s === "string" && s.trim())
      .join(" / ") || null;
    const dm = a.dimensions || infoDims || {};
    const w = dm.width ?? dm.x;
    const d = dm.depth ?? dm.y;
    const h = dm.height ?? dm.z;
    const dimsLabel = (w || d || h)
      ? `W ${w ?? "—"} × D ${d ?? "—"} × H ${h ?? "—"} mm`
      : null;
    const priceLabel = a.price ? `¥${Number(a.price).toLocaleString()}` : null;
    const materials = Array.isArray(a.materials)
      ? a.materials.filter((m) => typeof m === "string" && m.trim())
      : [];
    const tags = Array.isArray(a.tags)
      ? a.tags.filter((t) => typeof t === "string" && t.trim())
      : [];
    // 説明/リンクは itemInfo（配置時に焼き込まれた info）を最優先、無ければアセット側から補完。
    const description = (itemInfo?.description || a.extendedMetadata?.info?.description || "").trim();
    // アセットの relatedLinks（Lens 由来＝商品サムネ thumbnail 付き）を最優先。
    // 無ければ配置時に焼き込まれた info.links、最後に sourceUrl。
    const baseLinks = (Array.isArray(a.relatedLinks) && a.relatedLinks.length)
      ? a.relatedLinks
      : (Array.isArray(itemInfo?.links) && itemInfo.links.length
        ? itemInfo.links
        : (a.sourceUrl ? [{ title: "関連リンク", url: a.sourceUrl }] : []));
    const links = baseLinks.filter((l) => l && l.url);
    const catalogLinks = Array.isArray(a.catalogLinks) ? a.catalogLinks.filter((l) => l && l.url) : [];
    return { categoryPath, dimsLabel, priceLabel, materials, tags, description, links, catalogLinks };
  }, [infoAsset, infoDims, itemInfo]);

  useEffect(() => {
    if (!itemId) return;
    const { categoryPath, dimsLabel, priceLabel, materials, tags, description, links, catalogLinks } = infoExtras;
    // モデル（modelId）を持つアイテムは、説明/リンクが無くても仕様（カテゴリ/寸法/素材/タグ）を表示する。
    const hasInfo = !!(
      modelId || description || links.length || materials.length || tags.length ||
      categoryPath || dimsLabel || priceLabel || infoThumb
    );
    const { register: regInfo, unregister: unregInfo } = useItemInfoRegistryStore.getState();
    if (hasInfo) {
      regInfo({
        itemId: String(itemId),
        title: infoTitle,
        description,
        links,
        thumbUrl: infoThumb,
        modelId: modelId || null,
        categoryPath,
        dimsLabel,
        priceLabel,
        materials,
        tags,
        catalogLinks,
        // S.Models 詳細を開くためのモデルオブジェクト（アセット情報を含める）
        model: modelId ? {
          id: modelId,
          title: infoTitle,
          name: infoTitle,
          glbUrl: infoGlb,
          thumbUrl: infoThumb,
          thumbnailUrl: infoThumb,
          dimensionsMm: infoDims,
          macroCategory: infoAsset?.macroCategory,
          mainCategory: infoAsset?.mainCategory,
          subCategory: infoAsset?.subCategory,
          userCategory: infoAsset?.userCategory,
          dimensions: infoAsset?.dimensions,
          price: infoAsset?.price,
          materials,
          tags,
          relatedLinks: infoAsset?.relatedLinks,
          catalogLinks: infoAsset?.catalogLinks,
          sourceUrl: infoAsset?.sourceUrl,
          extendedMetadata: assetMeta || { info: itemInfo },
        } : null,
      });
    } else {
      unregInfo(String(itemId));
    }
    return () => unregInfo(String(itemId));
  }, [itemId, infoExtras, infoTitle, infoThumb, infoGlb, modelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 家具置き換えコントローラを登録（候補が2件以上＝元＋1のときボタン表示）
  useEffect(() => {
    if (!itemId) return;
    const { register: regSwap, unregister: unregSwap } = useItemSwapRegistryStore.getState();
    if (swapList.length >= 1) {
      const options = [
        { id: "base", label: "元のモデル", thumbUrl: item?.thumbUrl || item?.thumbnailUrl || null, apply: () => setSwapIndex(0) },
        ...swapList.map((m, i) => ({ id: m.id || `s${i}`, label: m.title || `候補${i + 1}`, thumbUrl: m.thumbUrl || null, apply: () => setSwapIndex(i + 1) })),
      ];
      const currentId = options[Math.min(swapIndex, options.length - 1)]?.id;
      regSwap({ itemId: String(itemId), options, currentId, cycle: () => setSwapIndex((i) => (i + 1) % options.length) });
      useWalkthroughGalleryStore.getState().bump();
    } else {
      unregSwap(String(itemId));
    }
    return () => unregSwap(String(itemId));
  }, [itemId, swapList, swapIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onPointerDown={editorMode === "zoning" || editorMode === "material" || structureTagging ? undefined : handlePointerDown}
      onClick={editorMode === "zoning" || editorMode === "material" || structureTagging ? undefined : handleClick}
      onContextMenu={handleContextMenu}
    >
        {!url ? (
          <FurnitureBoxInner dimensionsMm={item?.dimensionsMm || null} selected={selected} />
        ) : (
          <ModelErrorBoundary
            key={url}
            onError={handleGlbError}
            fallback={<FurnitureBoxInner dimensionsMm={item?.dimensionsMm || null} selected={selected} />}
          >
            <Suspense fallback={null}>
              <FurnitureGlbResolvedInner
                url={url}
                itemId={itemId}
                selected={selected}
                dimensionsMm={effectiveDimensions}
                gimmickSpecs={resolvedGimmickSpecs}
                gimmickLabel={item?.title || item?.name || item?.label}
                animSpec={resolvedAnimSpec}
                materialBindings={liveMaterialBindings}
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