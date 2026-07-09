// WalkthroughViewerCanvas — 共有ビューア用のウォークスルー（操作可能）。
//
// 共有ドキュメントの viewerConfig.walkthrough（視点/レンズ/キャラ/スタートピン/躯体）と
// layout.items から、エディタと同じ WalkthroughController を使って没入操作を提供する。
// 編集ストア等には依存せず、必要な設定だけを useEditorModeStore にシードして使う。

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Canvas, useThree } from "@react-three/fiber";
import { PerspectiveCamera, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import BaseGlb from "../../canvas/scene/BaseGlb.jsx";
import ParametricRoom from "../../canvas/scene/ParametricRoom.jsx";
import WalkthroughController from "../../canvas/tools/walkthrough/WalkthroughController.jsx";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { focalLengthToFov } from "../../store/useViewportEnvStore";

// ── 家具（シンプル表示。ウォークスルー移動は躯体コライダーのみ使用） ──
function ViewerFurniture({ item }) {
  const url = item?.glbUrl;
  const gltf = useGLTF(url);
  const cloned = useMemo(() => (gltf?.scene ? gltf.scene.clone(true) : null), [gltf?.scene]);
  if (!cloned) return null;
  const pos = item?.transform?.position || [0, 0, 0];
  const rot = item?.transform?.rotation || [0, 0, 0];
  const scl = item?.transform?.scale || [1, 1, 1];
  return (
    <group position={pos} rotation={rot} scale={scl}>
      <primitive object={cloned} />
    </group>
  );
}

// ── 躯体（GLB or パラメトリックルーム）をロードしてコライダー登録 ──
function ViewerBase({ baseGlbUrl, roomSpec }) {
  const onLoaded = (payload) => {
    const meshes = payload?.snap?.baseMeshes || [];
    useSceneObjectRegistryStore.getState().setBaseColliders(Array.isArray(meshes) ? meshes : []);
    // sceneMaxY を更新（mm/m スケール判定に使用）
    if (payload?.root) {
      try {
        const box = new THREE.Box3().setFromObject(payload.root);
        if (!box.isEmpty()) useEditorModeStore.getState().setSceneMaxY(box.max.y);
      } catch { /* noop */ }
    }
  };
  if (baseGlbUrl) return <BaseGlb url={baseGlbUrl} onLoaded={onLoaded} />;
  if (roomSpec) return <ParametricRoom spec={roomSpec} onLoaded={onLoaded} />;
  return null;
}

function CameraRig({ fov }) {
  return <PerspectiveCamera makeDefault fov={fov} near={0.1} far={100000} position={[24, 18, 24]} />;
}

function FrameLockUp() {
  // 念のため up を毎マウントで初期化（他経路の up 引き継ぎ対策）
  const { camera } = useThree();
  useEffect(() => { camera.up.set(0, 1, 0); }, [camera]);
  return null;
}

export default function WalkthroughViewerCanvas({ walkthrough, layout }) {
  const wt = walkthrough || {};
  const baseGlbUrl = wt.baseGlbUrl || "";
  const roomSpec = wt.roomSpec || null;
  const items = Array.isArray(layout?.items) ? layout.items.filter((it) => it?.glbUrl) : [];

  const [viewMode, setViewMode] = useState(wt.viewMode || "third");

  // ── 共有設定を編集ストアへ「子マウント前」に同期シード ──
  //   WalkthroughController(子)の初期化 effect は親 effect より先に走るため、
  //   startPin/character/lens/viewMode は描画前に流し込んでおく。
  const seededRef = useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    const s = useEditorModeStore.getState();
    if (wt.character) s.setWalkthroughCharacter(wt.character);
    if (wt.lens) {
      (["first", "third", "fly"]).forEach((m) => {
        const v = wt.lens?.[m];
        if (Number.isFinite(v)) s.setWalkthroughLens(m, v);
      });
    }
    if (wt.startPin) s.setWalkthroughStartPin(wt.startPin);
    s.setWalkthroughViewMode(wt.viewMode || "third");
  }

  // 離脱時にコライダーをクリア
  useEffect(() => () => { useSceneObjectRegistryStore.getState().setBaseColliders([]); }, []);

  // viewMode をストアへ反映
  useEffect(() => { useEditorModeStore.getState().setWalkthroughViewMode(viewMode); }, [viewMode]);

  const lens = (wt.lens && wt.lens[viewMode]) || 24;
  const fov = focalLengthToFov(lens);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <Canvas shadows gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]}>
        <CameraRig fov={fov} />
        <FrameLockUp />
        <ambientLight intensity={0.7} />
        <directionalLight position={[8, 14, 8]} intensity={1.1} castShadow />
        <hemisphereLight args={[0xffffff, 0x444444, 0.5]} />

        <Suspense fallback={null}>
          <ViewerBase baseGlbUrl={baseGlbUrl} roomSpec={roomSpec} />
          {items.map((it) => (
            <Suspense key={it.id || it.modelId} fallback={null}>
              <ViewerFurniture item={it} />
            </Suspense>
          ))}
        </Suspense>

        <WalkthroughController active />
      </Canvas>

      {/* 視点切替（最小 HUD） */}
      <Box sx={{ position: "absolute", top: 10, right: 10, zIndex: 5, display: "flex", gap: "2px", p: "3px", borderRadius: 1.5, background: alpha("#050815", 0.72), border: `1px solid ${alpha("#fff", 0.12)}`, backdropFilter: "blur(8px)" }}>
        {[["first", "一人称"], ["third", "三人称"], ["fly", "フライ"]].map(([m, label]) => (
          <Box
            key={m}
            onClick={() => setViewMode(m)}
            sx={{ px: 1.1, py: 0.4, borderRadius: 1, cursor: "pointer", fontSize: "0.72rem", fontWeight: viewMode === m ? 700 : 400, color: viewMode === m ? "#fff" : alpha("#fff", 0.55), background: viewMode === m ? alpha("#4f8cff", 0.55) : "transparent", userSelect: "none" }}
          >
            {label}
          </Box>
        ))}
      </Box>

      {/* 操作ヒント */}
      <Box sx={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 5, px: 1.5, py: 0.5, borderRadius: 1, background: alpha("#050815", 0.66), border: `1px solid ${alpha("#fff", 0.08)}`, backdropFilter: "blur(8px)", pointerEvents: "none" }}>
        <Typography sx={{ color: alpha("#fff", 0.8), fontSize: "0.7rem", whiteSpace: "nowrap" }}>
          WASD 移動 ・ Shift 走る ・ 右ドラッグで見渡す
        </Typography>
      </Box>
    </Box>
  );
}
