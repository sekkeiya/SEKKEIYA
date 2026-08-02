// src/features/dsl/layout/presentation/PresentationViewer.jsx
//
// 本番プレビュー（Presentation / Phase 2）
// ------------------------------------------------------------
// 編集オーバーレイを剥がした鑑賞専用フルスクリーンビューワ。
// 下部の「シーン」ボタン＝カメラアングル＋コンテンツパネルの組。
//   - 概要   : 俯瞰アングル ＋ スペック表（寸法/面積/家具）
//   - 間取り : 真上アングル ＋ 平面図（SVG, 家具配置）
//   - ギャラリー: 3/4 アングル ＋ 画像ギャラリー（現アングルを保存して並べる）
//   - 内観   : 室内アングル（没入・パネルなし）
//
// ★ ライブシーン再利用: layoutSceneRef.scene を自前カメラで描画 → 適用済み
//    マテリアル/ライティングが完全一致。編集補助は毎フレーム継続で非表示。
//
// S.Layout のシーンは mm 単位。カメラ near/far は寸法連動（CameraTuner）。
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Button, Typography, IconButton, Chip, Divider, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddAPhotoRoundedIcon from "@mui/icons-material/AddAPhotoRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DirectionsWalkRoundedIcon from "@mui/icons-material/DirectionsWalkRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import BookmarkAddRoundedIcon from "@mui/icons-material/BookmarkAddRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";
import { Menu, MenuItem } from "@mui/material";
import { runAiPipeline } from "../services/aiOrchestrator";
import { useAutoActionStore } from "../store/useAutoActionStore";
import { useAutoLayoutStore } from "../store/useAutoLayoutStore";
import { useUiRightSidebarStore } from "../store/uiRightSidebarStore";
import { useAutoActions, AUTO_ACTION_OPTIONS, AUTO_LAYOUT_PURPOSE_OPTIONS, runAutoLayout } from "../editor/dock/useAutoActions";
import { useLayoutOptionActions } from "../hooks/useLayoutOptionActions";
import { resolveProposalPlan } from "../utils/layoutPatterns";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import { layoutSceneRef } from "../services/layoutSceneRef";
// @ts-ignore
import ParametricRoom, { normalizeRoomSpec } from "../canvas/scene/ParametricRoom.jsx";
import { useResolvedUrl } from "../hooks/useResolvedUrl";
import WalkthroughController from "../canvas/tools/walkthrough/WalkthroughController.jsx";
import { PerspectiveControlsBinder } from "../canvas/controls/controlsBinders.jsx";
import ArchitectureRoundedIcon from "@mui/icons-material/ArchitectureRounded";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import { useSectionLinesStore } from "../store/useSectionLinesStore";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";
import { useRoomElevationsStore } from "../store/useRoomElevationsStore";
import { computeRoomBoxFromRects } from "../store/useElevationMarkerStore";
import { computeElevationRooms, getElevationMarkerPos, computeElevationRoomBox } from "../utils/openElevationView";
import { OrthographicCamera } from "@react-three/drei";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { focalLengthToFov } from "../store/useViewportEnvStore";

/* ============================================================
 * 編集補助の判定（毎フレーム非表示にする対象）
 * ========================================================== */
function isEditorHelper(o) {
  if (!o) return false;
  const nm = `${o.name || ""} ${o?.userData?.kind || ""} ${o?.userData?.role || ""}`;
  return (
    o instanceof THREE.GridHelper ||
    o.type === "GridHelper" ||
    o.type === "AxesHelper" ||
    o.type === "Box3Helper" ||
    o?.userData?.isLightFootprint === true ||
    o?.userData?.isGizmo === true ||
    o?.userData?.isSectionRef === true ||
    o?.userData?.isEnvironmentBackdrop === true ||
    o?.userData?.isEditorOverlay === true ||
    /\b(grid|startpin|start_pin|walkthroughpin|helper|gizmo|dimension|zoneDraw|section)\b/i.test(nm)
  );
}

function LiveSceneHost({ sceneObj }) {
  // ★ 重要: <primitive> で取り込むと R3F が editor 管理オブジェクトを二重管理し
  //   __r3f 内部メタが衝突してクラッシュする。生の three で add/remove し、
  //   R3F の reconciler には触れさせない（描画だけ共有する読み取り専用）。
  const myScene = useThree((s) => s.scene);
  const touchedRef = useRef(new Set());

  useEffect(() => {
    if (!sceneObj || !myScene) return;
    myScene.add(sceneObj);
    const touched = touchedRef.current;
    return () => {
      try {
        myScene.remove(sceneObj);
      } catch {}
      touched.forEach((o) => {
        try {
          o.visible = true;
        } catch {}
      });
      touched.clear();
    };
  }, [sceneObj, myScene]);

  // 編集補助を毎フレーム継続で非表示（store 駆動の再生成レース対策）
  useFrame(() => {
    if (!sceneObj) return;
    sceneObj.traverse((o) => {
      if (o && o.visible && isEditorHelper(o)) {
        o.visible = false;
        touchedRef.current.add(o);
      }
    });
  });

  return null;
}

/* ============================================================
 * 自前構築シーン（Web共有など、ライブシーンが無い場合のフォールバック）
 *  base GLB / roomSpec ＋ 家具を snapshot から描画。
 *  ※ 自動マテリアル/ライティングは含まれない（簡易ライト）。
 * ========================================================== */
function SelfGlbInner({ url, onBounds }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => (gltf?.scene ? gltf.scene.clone(true) : null), [gltf?.scene]);
  const reported = useRef(false);
  useEffect(() => {
    if (!scene) return;
    const meshes = [];
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        meshes.push(o);
      }
    });
    // 共有先（ライブシーン無し）でもウォークスルーが歩けるよう躯体をコライダー登録
    useSceneObjectRegistryStore.getState().setBaseColliders(meshes);
    const box = new THREE.Box3().setFromObject(scene);
    if (!box.isEmpty()) {
      useEditorModeStore.getState().setSceneMaxY(box.max.y);
      if (!reported.current && typeof onBounds === "function") {
        reported.current = true;
        onBounds({ center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) });
      }
    }
  }, [scene, onBounds]);
  if (!scene) return null;
  return <primitive object={scene} />;
}

// gs:// / Storage パスは https へ解決してからロード（旧共有・未解決URL対策）
function SelfGlbBase({ url, onBounds }) {
  const resolved = useResolvedUrl(url);
  if (!resolved) return null;
  return <SelfGlbInner url={resolved} onBounds={onBounds} />;
}

function SelfItemInner({ url, transform }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => (gltf?.scene ? gltf.scene.clone(true) : null), [gltf?.scene]);
  useEffect(() => {
    if (!scene) return;
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);
  if (!scene) return null;
  const t = transform || {};
  return (
    <group position={t.position || [0, 0, 0]} rotation={t.rotation || [0, 0, 0]} scale={t.scale || [1, 1, 1]}>
      <primitive object={scene} />
    </group>
  );
}

function SelfItem({ item }) {
  const resolved = useResolvedUrl(item?.glbUrl);
  if (!resolved) return null;
  return <SelfItemInner url={resolved} transform={item?.transform} />;
}

function SelfBuiltScene({ baseGlbUrl, roomSpec, items, onBounds, frameRadius, center }) {
  const cx = center?.x ?? 0;
  const cy = center?.y ?? 0;
  const cz = center?.z ?? 0;
  const r = frameRadius || 6;
  // 自前シーンを畳むときはコライダーを掃除（エディタ内ではこのシーンは出ない）
  useEffect(() => () => { useSceneObjectRegistryStore.getState().setBaseColliders([]); }, []);
  const onRoomLoaded = useCallback((payload) => {
    const meshes = payload?.snap?.baseMeshes || [];
    useSceneObjectRegistryStore.getState().setBaseColliders(Array.isArray(meshes) ? meshes : []);
    if (payload?.root) {
      try {
        const box = new THREE.Box3().setFromObject(payload.root);
        if (!box.isEmpty()) useEditorModeStore.getState().setSceneMaxY(box.max.y);
      } catch { /* noop */ }
    }
  }, []);
  return (
    <>
      <hemisphereLight args={["#dfe8f5", "#3a3630", 0.6]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        color="#fff4e6"
        position={[cx + r * 0.8, cy + r * 1.5, cz + r * 0.7]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={Math.max(1, r * 0.0012)}
        shadow-camera-near={r * 0.05}
        shadow-camera-far={r * 6}
        shadow-camera-left={-r * 1.6}
        shadow-camera-right={r * 1.6}
        shadow-camera-top={r * 1.6}
        shadow-camera-bottom={-r * 1.6}
      />
      <directionalLight color="#cdd9ff" position={[cx - r, cy + r * 0.7, cz - r * 0.8]} intensity={0.5} />

      {baseGlbUrl ? (
        <SelfGlbBase url={baseGlbUrl} onBounds={onBounds} />
      ) : roomSpec ? (
        <ParametricRoom spec={normalizeRoomSpec(roomSpec)} onLoaded={onRoomLoaded} isTopView={false} />
      ) : null}

      {(items || []).map((it) => (it?.glbUrl ? <SelfItem key={it.id} item={it} /> : null))}
    </>
  );
}

/* ============================================================
 * カメラ：スムーズ遷移 ＋ スケール連動 near/far
 * ========================================================== */
/* ============================================================
 * 図面ビュー（平面/天井/立面/断面/展開）— 正射の操作可能ビュー
 * ========================================================== */

/**
 * プレビュー canvas 専用のレンダラー単位クリップ。
 * PaneClipPlanes と同じ思想（renderer.clippingPlanes は canvas 単位に独立して効き、
 * 共有マテリアルを汚さない）だが、あちらが行う material.clippingPlanes の掃除は
 * しない — エディタ側の SectionClipManager と取り合いになるため。
 */
function PreviewClipPlanes({ planes }) {
  const { gl, invalidate } = useThree();
  const threePlanes = useMemo(
    () => (planes || []).map((p) => new THREE.Plane(new THREE.Vector3(...p.normal), p.constant)),
    [planes]
  );
  useEffect(() => {
    gl.clippingPlanes = threePlanes;
    invalidate();
    return () => { gl.clippingPlanes = []; };
  }, [gl, threePlanes, invalidate]);
  return null;
}

/**
 * 図面ビューのカメラ配置。makeDefault された正射カメラを、ビュー定義
 * （視線方向・上方向・フレーミング範囲）に合わせて配置しズームを合わせる。
 * 範囲はビュー側の frameBox（展開）が無ければ躯体（layoutSceneRef.baseRoot）から測る。
 */
function DrawingViewFramer({ view, controlsRef }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!view || !camera?.isOrthographicCamera) return;
    let box = null;
    if (view.frameBox) {
      const c = view.frameBox.center;
      const half = view.frameBox.maxDim / 2;
      box = new THREE.Box3(
        new THREE.Vector3(c[0] - half, c[1] - half, c[2] - half),
        new THREE.Vector3(c[0] + half, c[1] + half, c[2] + half)
      );
    } else {
      const root = layoutSceneRef.baseRoot || null;
      if (root) box = new THREE.Box3().setFromObject(root);
      if (!box || box.isEmpty()) return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const sizeV = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(...view.lookDir).normalize();
    const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z, 1);
    const dist = maxDim * 2;

    // 視線に直交する平面での必要幅/高さ（正射ズームのフィット計算）
    let w; let h;
    if (Math.abs(dir.y) > 0.5) { w = sizeV.x; h = sizeV.z; }        // 平面/天井
    else if (Math.abs(dir.z) > 0.5) { w = sizeV.x; h = sizeV.y; }   // 正面/背面
    else { w = sizeV.z; h = sizeV.y; }                               // 左右
    const zoom = Math.min(size.width / Math.max(w, 1), size.height / Math.max(h, 1)) * 0.85;

    camera.position.copy(center).addScaledVector(dir, -dist);
    camera.up.set(...view.up);
    camera.lookAt(center);
    camera.near = 1;
    camera.far = dist * 4;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    const ctrl = controlsRef.current;
    if (ctrl) { ctrl.target.copy(center); ctrl.update(); }
    invalidate();
  }, [view?.id, camera, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** axis('x'|'z') と flip から視線方向ベクトルを得る（エディタの断面/立面/展開と同じ規約）。 */
function lookDirOf(axis, flip) {
  const s = flip ? 1 : -1; // 既定は −Z / −X 方向を見る
  return axis === "x" ? [s, 0, 0] : [0, 0, s];
}

function CameraRig({ camTargetRef, controlsRef }) {
  useFrame(({ camera }) => {
    const t = camTargetRef.current;
    if (!t || !t.active) return;

    const k = 0.085;
    camera.position.lerp(t.pos, k);
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.lerp(t.look, k);
      ctrl.update();
    }

    const eps = Math.max(t.pos.length() * 0.0025, 1e-3);
    if (camera.position.distanceTo(t.pos) < eps) {
      camera.position.copy(t.pos);
      if (ctrl) {
        ctrl.target.copy(t.look);
        ctrl.update();
        ctrl.enabled = true;
      }
      t.active = false;
    }
  });
  return null;
}

function CameraTuner({ radius }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!radius || !camera) return;
    camera.near = Math.max(0.02, radius * 0.002);
    camera.far = Math.max(2000, radius * 80);
    camera.updateProjectionMatrix();
  }, [radius, camera]);
  return null;
}

/* ウォークスルー中：視点モードのレンズ長を FOV に反映（離脱時に俯瞰用へ戻す） */
function WalkthroughFovSync({ baseFov = 50 }) {
  const { camera } = useThree();
  const viewMode = useEditorModeStore((s) => s.walkthroughViewMode);
  const lens = useEditorModeStore((s) => s.walkthroughLens);
  useEffect(() => {
    camera.fov = focalLengthToFov(lens?.[viewMode] || 24);
    camera.updateProjectionMatrix();
  }, [camera, viewMode, lens]);
  useEffect(() => () => {
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }, [camera, baseFov]);
  return null;
}

/* gl レンダラーを親に渡す（ギャラリー撮影用） */
function GlGrabber({ onReady }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    onReady?.(gl);
  }, [gl, onReady]);
  return null;
}

/* ============================================================
 * ピン（家具マーカー）— クリックでフォーカス＋名称表示
 * ========================================================== */
function Pins({ items, onSelect, selectedId }) {
  return (
    <>
      {(items || []).map((it) => {
        const p = it?.transform?.position || [0, 0, 0];
        const pinY = (p[1] || 0) + 700; // 床から ~0.7m 上に浮かせる
        const isSel = it.id === selectedId;
        const name = it?.name || it?.title || it?.snapshot?.title || "アイテム";
        return (
          <Html
            key={it.id}
            position={[p[0], pinY, p[2]]}
            center
            zIndexRange={[40, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(it);
              }}
              style={{
                pointerEvents: "auto",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: isSel ? "4px 10px 4px 4px" : 0,
                borderRadius: 999,
                background: isSel ? "rgba(11,16,32,0.92)" : "transparent",
                border: isSel ? "1px solid rgba(52,211,153,0.65)" : "none",
                boxShadow: isSel ? "0 4px 16px rgba(0,0,0,0.5)" : "none",
                transform: "translateZ(0)",
                transition: "all 0.12s ease",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isSel ? "#34d399" : "#ffffff",
                  border: `2px solid ${isSel ? "#34d399" : "rgba(0,0,0,0.25)"}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.55)",
                }}
              />
              {isSel && (
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {name}
                </span>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

/* ============================================================
 * シーン定義（カメラアングル ＋ パネル種別）
 * ========================================================== */
function buildScenes(bounds) {
  const c = bounds?.center ?? new THREE.Vector3(0, 1, 0);
  const s = bounds?.size ?? new THREE.Vector3(6, 3, 6);
  const sx = Math.max(s.x, 1);
  const sz = Math.max(s.z, 1);
  const r = Math.max(sx, sz, 1);
  const h = Math.max(s.y, 1);
  const floorY = c.y - h / 2;
  const eyeY = floorY + Math.min(1600, h * 0.55); // 目線高さ ≒ 1.6m（mm 前提・低天井は 55%）
  const v = (x, y, z) => new THREE.Vector3(x, y, z); // 絶対座標

  const ctr = c.clone();
  void eyeY;

  // 外観：建物を四隅から見る「斜め上」3/4アングル
  const extH = c.y + h * 0.4 + r * 0.5; // 見下ろせる高さ
  const D = r * 1.3; // 水平距離
  const diag = (dx, dz) => v(c.x + dx * D, extH, c.z + dz * D);

  return [
    // 外観：四方向それぞれの斜め上アングル
    { id: "ext-front", group: "exterior", label: "正面", pos: diag(0.45, 1.0), look: ctr.clone() },
    { id: "ext-right", group: "exterior", label: "右", pos: diag(1.0, -0.45), look: ctr.clone() },
    { id: "ext-back", group: "exterior", label: "背面", pos: diag(-0.45, -1.0), look: ctr.clone() },
    { id: "ext-left", group: "exterior", label: "左", pos: diag(-1.0, 0.45), look: ctr.clone() },
    // インテリア：階別の平断面パース（天井オープンのドールハウス俯瞰）。現状は単層 = 1F
    { id: "int-1f", group: "interior", label: "1F", pos: v(c.x + sx * 0.45, c.y + r * 1.0, c.z + sz * 0.62), look: ctr.clone() },
    // 内観：本物のウォークスルー（WASD＋重力。既定は三人称）
    { id: WALK_SCENE_ID, group: "interior", label: "内観（歩く）", walk: true },
  ];
}

const DEFAULT_SCENE_ID = "int-1f";
const WALK_SCENE_ID = "walk";

function readBounds(roomSpec) {
  const baseRoot = layoutSceneRef.baseRoot;
  if (baseRoot) {
    try {
      const box = new THREE.Box3().setFromObject(baseRoot);
      if (!box.isEmpty()) {
        return { center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) };
      }
    } catch {}
  }
  if (roomSpec && (roomSpec.widthMm || roomSpec.depthMm || roomSpec.heightMm)) {
    const s = normalizeRoomSpec(roomSpec);
    return {
      center: new THREE.Vector3(0, s.heightMm / 2, 0),
      size: new THREE.Vector3(s.widthMm, s.heightMm, s.depthMm),
    };
  }
  return null;
}

/* ============================================================
 * パネル：スペック表
 * ========================================================== */
function StatBlock({ value, unit, label }) {
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={0.4}>
        <Typography sx={{ fontSize: 25, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: "-0.5px" }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.5), fontWeight: 600 }}>{unit}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 10.5, color: alpha("#fff", 0.42), mt: 0.7, letterSpacing: 0.5 }}>{label}</Typography>
    </Box>
  );
}

function SpecRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.9 }}>
      <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.5), letterSpacing: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{value}</Typography>
    </Stack>
  );
}

function SpecPanel({ roomSpec, bounds, items, usage }) {
  const dims = useMemo(() => {
    if (roomSpec && (roomSpec.widthMm || roomSpec.depthMm || roomSpec.heightMm)) {
      const s = normalizeRoomSpec(roomSpec);
      return { w: s.widthMm, d: s.depthMm, h: s.heightMm };
    }
    const sz = bounds?.size;
    return { w: sz?.x ?? 0, d: sz?.z ?? 0, h: sz?.y ?? 0 };
  }, [roomSpec, bounds]);

  const m = (mm) => (mm / 1000).toFixed(2);
  const areaM2 = ((dims.w / 1000) * (dims.d / 1000)).toFixed(1);

  const furniture = useMemo(() => {
    const map = new Map();
    (items || []).forEach((it) => {
      const name = it?.name || it?.title || it?.snapshot?.title || "アイテム";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <Box>
      {/* 用途チップ */}
      <Chip
        label={usage || "住宅"}
        size="small"
        sx={{
          height: 22,
          fontSize: 11,
          fontWeight: 700,
          mb: 2,
          color: alpha("#fff", 0.85),
          bgcolor: alpha("#fff", 0.08),
          border: `1px solid ${alpha("#fff", 0.14)}`,
        }}
      />

      {/* ヒーロー数値（面積 / 天井高 / 家具） */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 0.5 }}>
        <StatBlock value={areaM2} unit="㎡" label="床面積（目安）" />
        <StatBlock value={m(dims.h)} unit="m" label="天井高" />
        <StatBlock value={items?.length ?? 0} unit="点" label="家具" />
      </Box>

      <Divider sx={{ my: 1.8, borderColor: alpha("#fff", 0.08) }} />

      {/* 詳細 */}
      <SpecRow label="間口" value={`${m(dims.w)} m`} />
      <SpecRow label="奥行" value={`${m(dims.d)} m`} />
      <SpecRow label="延床（目安）" value={`${areaM2} ㎡`} />

      {furniture.length > 0 && (
        <>
          <Divider sx={{ my: 1.6, borderColor: alpha("#fff", 0.08) }} />
          <Typography
            sx={{ fontSize: 10.5, fontWeight: 800, color: alpha("#fff", 0.5), letterSpacing: 1, mb: 1 }}
          >
            FURNITURE
          </Typography>
          <Stack spacing={0}>
            {furniture.map(([name, count], i) => (
              <Stack
                key={name}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  py: 0.9,
                  borderTop: i === 0 ? "none" : `1px solid ${alpha("#fff", 0.06)}`,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: alpha("#34d399", 0.9), flexShrink: 0 }} />
                  <Typography
                    sx={{ fontSize: 12.5, color: alpha("#fff", 0.88), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {name}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.45), fontWeight: 600, flexShrink: 0, pl: 1 }}>
                  ×{count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

/* ============================================================
 * パネル：選択した家具の情報
 * ========================================================== */
function ItemPanel({ item, onBack }) {
  const name = item?.name || item?.title || item?.snapshot?.title || "アイテム";
  const brand = item?.brand || item?.ownerHandle || "";
  const thumb = item?.thumbUrl || item?.snapshot?.thumbnailUrl || "";
  const type = item?.type || item?.group || item?.subType || "";
  const desc = item?.info?.description || "";
  const d = item?.dimensionsMm || null;

  const fmt = (mm) => (mm ? (mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`) : "—");

  return (
    <Box>
      <Button
        onClick={onBack}
        startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
        sx={{
          textTransform: "none",
          fontSize: 12,
          fontWeight: 700,
          color: alpha("#fff", 0.7),
          px: 0.5,
          mb: 1.5,
          minWidth: 0,
          "&:hover": { color: "#fff", background: "transparent" },
        }}
      >
        概要へ戻る
      </Button>

      {thumb ? (
        <Box
          sx={{
            width: "100%",
            height: 150,
            borderRadius: 2,
            overflow: "hidden",
            mb: 2,
            border: `1px solid ${alpha("#fff", 0.1)}`,
            background: alpha("#fff", 0.04),
          }}
        >
          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </Box>
      ) : null}

      <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.3px" }}>
        {name}
      </Typography>
      {brand ? (
        <Typography sx={{ fontSize: 12.5, color: alpha("#fff", 0.55), mt: 0.5 }}>{brand}</Typography>
      ) : null}
      {type ? (
        <Chip
          label={type}
          size="small"
          sx={{
            mt: 1.2,
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            color: alpha("#fff", 0.85),
            bgcolor: alpha("#fff", 0.08),
            border: `1px solid ${alpha("#fff", 0.14)}`,
          }}
        />
      ) : null}

      <Divider sx={{ my: 1.8, borderColor: alpha("#fff", 0.08) }} />

      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: alpha("#fff", 0.5), letterSpacing: 1, mb: 0.5 }}>
        DIMENSIONS
      </Typography>
      {d && (d.width || d.depth || d.height) ? (
        <>
          <SpecRow label="幅 (W)" value={fmt(d.width)} />
          <SpecRow label="奥行 (D)" value={fmt(d.depth)} />
          <SpecRow label="高さ (H)" value={fmt(d.height)} />
        </>
      ) : (
        <Typography sx={{ fontSize: 12.5, color: alpha("#fff", 0.45), py: 0.5 }}>
          寸法情報がありません
        </Typography>
      )}

      {desc ? (
        <>
          <Divider sx={{ my: 1.8, borderColor: alpha("#fff", 0.08) }} />
          <Typography sx={{ fontSize: 12.5, color: alpha("#fff", 0.78), lineHeight: 1.7 }}>{desc}</Typography>
        </>
      ) : null}
    </Box>
  );
}

/* ============================================================
 * パネル：平面図（SVG）— 部屋＋家具配置（真上から）
 * ========================================================== */
function FloorplanPanel({ roomSpec, bounds, items }) {
  const dims = useMemo(() => {
    if (roomSpec && (roomSpec.widthMm || roomSpec.depthMm)) {
      const s = normalizeRoomSpec(roomSpec);
      return { w: s.widthMm, d: s.depthMm };
    }
    const sz = bounds?.size;
    return { w: sz?.x ?? 1, d: sz?.z ?? 1 };
  }, [roomSpec, bounds]);

  const PAD = 18;
  const VBW = 320;
  const scale = (VBW - PAD * 2) / Math.max(dims.w, 1);
  const VBH = PAD * 2 + dims.d * scale;

  const mapX = (x) => PAD + (x + dims.w / 2) * scale;
  const mapZ = (z) => PAD + (z + dims.d / 2) * scale;

  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1 }}>間取り</Typography>
      <Box sx={{ borderRadius: 1.5, overflow: "hidden", border: `1px solid ${alpha("#fff", 0.12)}`, background: alpha("#0d1422", 0.6) }}>
        <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" style={{ display: "block" }}>
          {/* 部屋外形 */}
          <rect
            x={PAD}
            y={PAD}
            width={dims.w * scale}
            height={dims.d * scale}
            fill={alpha("#9fb4d8", 0.06)}
            stroke={alpha("#cdd9ff", 0.8)}
            strokeWidth={2}
          />
          {/* 家具 */}
          {(items || []).map((it) => {
            const p = it?.transform?.position || [0, 0, 0];
            const rotY = it?.transform?.rotation?.[1] || 0;
            const fw = (it?.dimensionsMm?.width || 600) * scale;
            const fd = (it?.dimensionsMm?.depth || 600) * scale;
            const cx = mapX(p[0]);
            const cz = mapZ(p[2]);
            const deg = (-rotY * 180) / Math.PI;
            return (
              <g key={it.id} transform={`translate(${cx} ${cz}) rotate(${deg})`}>
                <rect
                  x={-fw / 2}
                  y={-fd / 2}
                  width={fw}
                  height={fd}
                  rx={2}
                  fill={alpha("#34d399", 0.28)}
                  stroke={alpha("#34d399", 0.85)}
                  strokeWidth={1.2}
                />
              </g>
            );
          })}
        </svg>
      </Box>
      <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.45), mt: 0.8 }}>
        {(dims.w / 1000).toFixed(2)} × {(dims.d / 1000).toFixed(2)} m ／ 家具 {items?.length ?? 0} 点
      </Typography>
    </Box>
  );
}

/* ============================================================
 * パネル：ギャラリー（現アングルを保存して並べる）
 * ========================================================== */
function GalleryPanel({ shots, onCapture, onRemove, onAutoGenerate, generating, onOpen }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1 }}>ギャラリー</Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Button
          onClick={onAutoGenerate}
          disabled={generating}
          size="small"
          startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            flex: 1,
            textTransform: "none",
            fontSize: 12,
            fontWeight: 700,
            color: "#06210f",
            background: `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)`,
            borderRadius: 999,
            "&:hover": { background: `linear-gradient(180deg, ${alpha("#34d399", 1)} 0%, ${alpha("#059669", 0.95)} 100%)` },
            "&.Mui-disabled": { color: alpha("#06210f", 0.6), background: alpha("#34d399", 0.4) },
          }}
        >
          {generating ? "生成中…" : "自動生成"}
        </Button>
        <Button
          onClick={onCapture}
          size="small"
          startIcon={<AddAPhotoRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            flex: 1,
            textTransform: "none",
            fontSize: 12,
            fontWeight: 700,
            color: alpha("#fff", 0.9),
            background: alpha("#fff", 0.08),
            border: `1px solid ${alpha("#fff", 0.14)}`,
            borderRadius: 999,
            "&:hover": { background: alpha("#fff", 0.14) },
          }}
        >
          現在を保存
        </Button>
      </Stack>

      {shots.length === 0 ? (
        <Box
          sx={{
            py: 4,
            textAlign: "center",
            color: alpha("#fff", 0.45),
            fontSize: 12,
            border: `1px dashed ${alpha("#fff", 0.16)}`,
            borderRadius: 1.5,
          }}
        >
          「自動生成」で複数アングルを<br />一括キャプチャできます
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          {shots.map((s, i) => (
            <Box
              key={s.id}
              onClick={() => onOpen(i)}
              sx={{
                position: "relative",
                borderRadius: 1.5,
                overflow: "hidden",
                cursor: "pointer",
                border: `1px solid ${alpha("#fff", 0.12)}`,
                "&:hover .rm": { opacity: 1 },
                "&:hover img": { transform: "scale(1.04)" },
              }}
            >
              <img src={s.url} alt="" style={{ width: "100%", display: "block", transition: "transform 0.2s" }} />
              <IconButton
                className="rm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(s.id);
                }}
                size="small"
                sx={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  opacity: 0,
                  transition: "opacity 0.15s",
                  color: "#fff",
                  bgcolor: alpha("#000", 0.5),
                  "&:hover": { bgcolor: alpha("#000", 0.7) },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
      <Typography sx={{ fontSize: 10.5, color: alpha("#fff", 0.4), mt: 1.2 }}>
        ※ 現状はリアルタイム描画のキャプチャです。フォトリアル（Cycles）焼き込みは今後対応。
      </Typography>
    </Box>
  );
}

/* ============================================================
 * フィルムストリップのタイル
 * ========================================================== */
function StripTile({ thumb, label, active, onClick, onRemove, icon, busy }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.6, flexShrink: 0 }}>
      <Box
        onClick={onClick}
        sx={{
          position: "relative",
          width: 104,
          height: 68,
          borderRadius: 1.5,
          overflow: "hidden",
          cursor: "pointer",
          border: `2px solid ${active ? "#fff" : alpha("#fff", 0.16)}`,
          background: alpha("#0b0f18", 0.7),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.15s",
          "&:hover": { borderColor: active ? "#fff" : alpha("#fff", 0.4) },
          "&:hover .rm": { opacity: 1 },
          "&:hover img": { transform: "scale(1.06)" },
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.2s" }}
          />
        ) : busy ? (
          <CircularProgress size={18} sx={{ color: alpha("#fff", 0.6) }} />
        ) : (
          icon || null
        )}
        {onRemove && (
          <IconButton
            className="rm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            size="small"
            sx={{
              position: "absolute",
              top: 1,
              right: 1,
              opacity: 0,
              transition: "opacity 0.15s",
              color: "#fff",
              bgcolor: alpha("#000", 0.5),
              p: 0.3,
              "&:hover": { bgcolor: alpha("#000", 0.7) },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.3,
          color: active ? "#fff" : alpha("#fff", 0.6),
          maxWidth: 104,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/* 本番プレビューから実行できる自動アクション（エディタの★メニューと同じ並び・同じ配色）。
   kind は useAutoActions / useAutoActionStore と共通のキー。
   media: true = 一回きりの実行ではなく「カメラアングルを並べて選ぶ」エディタ側の作業なので、
   プレビューを閉じてエディタのギャラリー＋設定パネルを開く（プレビュー内では完結しない）。
   ※ 色はエディタ（AutoActionStarMenu）のダークテーマ値を直書きする — プレビューは常に
     暗背景なので light-dark() だと OS ライトテーマ時に沈んだ色が選ばれてしまう。 */
const PREVIEW_AUTO_ACTIONS = [
  { kind: "autoAI",       label: "AI実行",             color: "#a855f7", icon: <AutoAwesomeRoundedIcon /> },
  { kind: "autoZone",     label: "自動ゾーニング",     color: "#2dd4bf", icon: <DashboardRoundedIcon /> },
  { kind: "autoSelect",   label: "自動家具選定",       color: "#38bdf8", icon: <ChecklistRoundedIcon /> },
  { kind: "autoLayout",   label: "自動レイアウト",     color: "#c084fc", icon: <AutoFixHighRoundedIcon /> },
  { kind: "autoReplace",  label: "自動家具差し替え",   color: "#fb923c", icon: <SwapHorizRoundedIcon /> },
  { kind: "autoMaterial", label: "自動マテリアル",     color: "#34d399", icon: <AutoFixHighRoundedIcon /> },
  { kind: "autoFurMat",   label: "自動家具マテリアル", color: "#a78bfa", icon: <StyleRoundedIcon /> },
  { kind: "autoLabel",    label: "自動ラベル",         color: "#22d3ee", icon: <CategoryRoundedIcon /> },
  { kind: "autoLighting", label: "自動ライティング",   color: "#fbbf24", icon: <LightbulbRoundedIcon /> },
  { kind: "autoRender",   label: "自動パース生成",     color: "#60a5fa", icon: <PhotoCameraRoundedIcon />,    media: true },
  { kind: "autoMovie",    label: "自動動画生成",       color: "#f472b6", icon: <MovieCreationRoundedIcon />, media: true },
];

/* ============================================================
 * メイン
 * ========================================================== */
export default function PresentationViewer({
  open,
  onClose,
  roomSpec,
  layout,
  baseGlbUrl = "",
  usage = "住宅 (Residential)",
  title = "Untitled Layout",
  subtitle = "",
  // 見た目パターン（エディタから開いたときだけ渡る。公開共有では undefined のまま）
  projectId = null,
  workspaceId = null,
  baseId = null,
  planId = null,
}) {
  const camTargetRef = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), active: false });
  const controlsRef = useRef(null);
  const glRef = useRef(null);

  const [sceneObj, setSceneObj] = useState(null);

  // ── 提案（＝この Plan での見た目の組み合わせ: 面仕上げ+照明+家具素材+家具置き換え）。
  //     ツリー/パンくず/トップバーと同じ実体を useLayoutOptionActions 経由で操作する。
  //     selectOption は Plan 切替込み（参照先 Plan が削除済みならガードされる）。
  const {
    ready,
    options: patterns,
    activeOptionId: activePatternId,
    busy: patternBusy,
    plans: proposalPlans,
    selectOption: selectPattern,
    createOption,
    removeOption: removePattern,
  } = useLayoutOptionActions();
  // hook の ready は「エディタ内で選択中の Base」があれば true になる（useWorkspaceStructureStore
  // 基準）。これだけだと、エディタのライブシーンを間借りしているだけの閲覧ビューワ
  // （LayoutViewerShell / PublicPresentationShare。projectId/workspaceId/baseId props 無しでマウント）でも
  // 裏でエディタの状態を拾って提案・自動アクション UI が出てしまう。
  // props はエディタから開いたとき「だけ」渡るので、これも揃って初めて編集可能とする。
  const canEditPatterns = ready && !!projectId && !!workspaceId && !!baseId;


  // ── 自動アクション（エディタの★メニューと実行ロジックを共有）──
  // プレビューはエディタのライブシーンを借りているので、ここで実行した結果はそのまま
  // エディタにも残る（提案と同じ考え方）。v2 は自動保存なので、明示的な登録操作は不要 —
  // 実行した結果はデバウンスで自動的にアクティブ提案へ書き込まれる。
  const autoRunners = useAutoActions();
  const autoBuildingType = useAutoLayoutStore((s) => s.buildingType);
  const [autoMenu, setAutoMenu] = useState(null); // { anchorEl, kind } | null

  // kind → スタイル/スコープの選択肢。null = 選択肢なし（クリックで即実行）。
  const autoOptionsFor = useCallback((kind) => {
    if (kind === "autoLayout") {
      const opts = AUTO_LAYOUT_PURPOSE_OPTIONS[autoBuildingType] || AUTO_LAYOUT_PURPOSE_OPTIONS.residential;
      return opts.map((o) => ({ key: o.value, label: o.label }));
    }
    if (kind === "autoAI") {
      // AI実行（おまかせ）: テイスト（内装の基調スタイル）を選んで一括生成。
      // エディタの下部ギャラリー（AutoActionGalleryBar）と同じ選択肢を出す。
      const styles = AUTO_ACTION_OPTIONS.autoMaterial || [];
      return [{ key: styles[0]?.key, label: "おまかせ" }, ...styles];
    }
    return AUTO_ACTION_OPTIONS[kind] || null;
  }, [autoBuildingType]);

  const runAutoAction = useCallback((kind, optionKey) => {
    if (kind === "autoLayout") { runAutoLayout(optionKey); return; }
    if (kind === "autoAI") { void runAiPipeline(optionKey, autoRunners); return; }
    autoRunners.runByKind[kind]?.(optionKey);
  }, [autoRunners]);

  // 自動パース生成 / 自動動画生成はカメラアングルを並べて選ぶエディタ側の作業なので、
  // プレビューを閉じてエディタのギャラリー（MediaGalleryBar）と設定パネルを開く。
  const openMediaWorkflow = useCallback((kind) => {
    useAutoActionStore.getState().setSelectedAuto(kind);
    useAutoActionStore.getState().setActiveSide(null);
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
    onClose?.();
  }, [onClose]);

  const handleAutoTileClick = useCallback((e, a) => {
    if (a.media) { openMediaWorkflow(a.kind); return; }
    const opts = autoOptionsFor(a.kind);
    if (!opts || opts.length === 0) { runAutoAction(a.kind); return; }
    setAutoMenu({ anchorEl: e.currentTarget, kind: a.kind });
  }, [autoOptionsFor, runAutoAction, openMediaWorkflow]);

  // 右ドラッグ / WASDQE で自分で動き始めたら、シーン切替のカメラ寄せ（CameraRig）を
  // 即座に手放す — リグが目標へ lerp し続けると手動操作と取り合いになるため。
  // （OrbitControls 経由の左ドラッグは selectPattern 等の active=false で既に手放している）
  useEffect(() => {
    const releaseRig = (e) => {
      if (e.type === "pointerdown") {
        if (e.button !== 2) return;
      } else {
        const k = typeof e.key === "string" ? e.key.toLowerCase() : "";
        if (!["w", "a", "s", "d", "q", "e"].includes(k)) return;
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      }
      camTargetRef.current.active = false;
    };
    window.addEventListener("pointerdown", releaseRig, true);
    window.addEventListener("keydown", releaseRig, true);
    return () => {
      window.removeEventListener("pointerdown", releaseRig, true);
      window.removeEventListener("keydown", releaseRig, true);
    };
  }, []);

  const [bounds, setBounds] = useState(null);
  const [activeSceneId, setActiveSceneId] = useState(DEFAULT_SCENE_ID);
  const [shots, setShots] = useState([]);
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [sceneThumbs, setSceneThumbs] = useState({});
  const framedRef = useRef(false);
  const idRef = useRef(0);
  const stripRef = useRef(null);
  const nextId = useCallback(() => `g${idRef.current++}`, []);
  const scrollStrip = useCallback((d) => {
    stripRef.current?.scrollBy({ left: d * 340, behavior: "smooth" });
  }, []);

  const items = useMemo(() => (Array.isArray(layout?.items) ? layout.items : []), [layout]);

  useEffect(() => {
    if (!open) {
      framedRef.current = false;
      setSceneObj(null);
      setBounds(null);
      setShots([]);
      setActiveSceneId(DEFAULT_SCENE_ID);
      setSelectedPinId(null);
      setLightboxIndex(-1);
      setGenerating(false);
      setSceneThumbs({});
      return;
    }
    setSceneObj(layoutSceneRef.scene || null);
    setBounds(readBounds(roomSpec));
  }, [open, roomSpec]);

  const scenes = useMemo(() => buildScenes(bounds), [bounds]);
  const activeScene = useMemo(() => scenes.find((s) => s.id === activeSceneId) || scenes[0], [scenes, activeSceneId]);
  const walkActive = activeSceneId === WALK_SCENE_ID;
  const walkthroughViewMode = useEditorModeStore((s) => s.walkthroughViewMode);
  const setWalkthroughViewMode = useEditorModeStore((s) => s.setWalkthroughViewMode);
  const selectedItem = useMemo(
    () => (selectedPinId ? items.find((it) => it.id === selectedPinId) || null : null),
    [selectedPinId, items]
  );
  const frameRadius = useMemo(() => {
    const s = bounds?.size;
    return s ? Math.max(s.x, s.z, s.y, 1) : 6;
  }, [bounds]);

  // ── 図面ビュー（平面/天井/立面/断面/展開）──
  // Base/Plan で定義済みのもの（階・断面線・部屋の展開）をそのままチップにする。
  // 表示は正射投影＋レンダラー単位クリップで、エディタの状態は一切変更しない（読み取り専用）。
  const [drawingView, setDrawingView] = useState(null);
  const bsFloors = useBuildingSpecStore((s) => s.floors);
  const bsFl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const sceneMaxYForDrawing = useEditorModeStore((s) => s.sceneMaxY);
  const sectionLines = useSectionLinesStore((s) => s.lines);
  const zonesForDrawing = useLayoutTaskStore((s) => s.zones);
  const roomsForDrawing = useLayoutTaskStore((s) => s.rooms);
  const roomElevations = useRoomElevationsStore((s) => s.elevations);

  const drawingViews = useMemo(() => {
    const isMm = (sceneMaxYForDrawing || 0) > 100;
    const toWorld = (mm) => (isMm ? mm : mm / 1000);
    const out = [];
    const floors = Array.isArray(bsFloors) && bsFloors.length ? bsFloors : [{ flMm: 0 }];
    // 平面 / 天井: エディタと同じ「FL+1500mm」で水平に切る（平面=見下ろし / 天井=見上げ）
    floors.forEach((f, i) => {
      const cutY = toWorld((bsFl0Mm || 0) + (f?.flMm || 0) + 1500);
      out.push({ id: `plan-${i}`, label: `平面 ${i + 1}F`, planes: [{ normal: [0, -1, 0], constant: cutY }], lookDir: [0, -1, 0], up: [0, 0, -1] });
    });
    floors.forEach((f, i) => {
      const cutY = toWorld((bsFl0Mm || 0) + (f?.flMm || 0) + 1500);
      out.push({ id: `ceil-${i}`, label: `天井 ${i + 1}F`, planes: [{ normal: [0, 1, 0], constant: -cutY }], lookDir: [0, 1, 0], up: [0, 0, -1] });
    });
    // 立面: 4方向（エディタの図面グリッドと同じ axis/flip の組）
    [["北", "z", true], ["東", "x", false], ["南", "z", false], ["西", "x", true]].forEach(([name, axis, flip]) => {
      out.push({ id: `elev-${name}`, label: `立面 ${name}`, planes: [], lookDir: lookDirOf(axis, flip), up: [0, 1, 0] });
    });
    // 断面: 断面線（A-A' / B-B'…）ごと。クリップ式はエディタの断面グリッドと同一
    (sectionLines || []).forEach((line) => {
      const planes = [
        line.axis === "x"
          ? { normal: [line.flip ? 1 : -1, 0, 0], constant: line.flip ? -line.pos : line.pos }
          : { normal: [0, 0, line.flip ? 1 : -1], constant: line.flip ? -line.pos : line.pos },
      ];
      out.push({ id: `sect-${line.id}`, label: `断面 ${line.name}`, planes, lookDir: lookDirOf(line.axis, !!line.flip), up: [0, 1, 0] });
    });
    // 展開: 既存の展開ドキュメントのみ（プレビューからは作成しない＝読み取り専用）。
    // クリップ式・フレーミングはエディタの展開グリッドと同一
    try {
      const rooms = computeElevationRooms(zonesForDrawing || [], roomsForDrawing || []);
      rooms.forEach((room) => {
        const roomBox = computeRoomBoxFromRects((room.zones || []).map((z) => z.rect));
        (roomElevations || []).filter((e) => e.roomId === room.id).forEach((el) => {
          const pos = getElevationMarkerPos(el);
          if (!pos) return;
          const rb = computeElevationRoomBox(room, pos, el.dir) || roomBox;
          if (!rb) return;
          const axis = el.dir === "A" || el.dir === "C" ? "z" : "x";
          const flip = el.dir === "C" || el.dir === "B";
          const s = flip ? 1 : -1;
          const m = axis === "x" ? pos.x : pos.z;
          const ax = axis === "x" ? [1, 0, 0] : [0, 0, 1];
          const o = axis === "x" ? [0, 0, 1] : [1, 0, 0];
          const oMin = axis === "x" ? rb.minZ : rb.minX;
          const oMax = axis === "x" ? rb.maxZ : rb.maxX;
          const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
          out.push({
            id: `roomelev-${el.id}`,
            label: `${room.name || "部屋"} ${el.name || "展開"}`,
            planes: [
              { normal: mul(ax, s), constant: -s * m },
              { normal: o, constant: -oMin },
              { normal: mul(o, -1), constant: oMax },
              { normal: [0, 1, 0], constant: -rb.yMin },
              { normal: [0, -1, 0], constant: rb.yMax },
            ],
            lookDir: mul(ax, s),
            up: [0, 1, 0],
            frameBox: {
              center: [(rb.minX + rb.maxX) / 2, (rb.yMin + rb.yMax) / 2, (rb.minZ + rb.maxZ) / 2],
              maxDim: Math.max(rb.maxX - rb.minX, rb.maxZ - rb.minZ, rb.yMax - rb.yMin),
            },
          });
        });
      });
    } catch (e) {
      console.warn("[PresentationViewer] 展開ビューの構築に失敗:", e);
    }
    return out;
  }, [bsFloors, bsFl0Mm, sceneMaxYForDrawing, sectionLines, zonesForDrawing, roomsForDrawing, roomElevations]);

  const openDrawingView = useCallback((v) => {
    camTargetRef.current.active = false; // シーン切替のカメラ寄せを止める
    if (controlsRef.current) controlsRef.current.enabled = true;
    setSelectedPinId(null);
    setDrawingView(v);
  }, []);

  const goToScene = useCallback((sc) => {
    if (!sc) return;
    setDrawingView(null); // 図面ビューを抜けてパースへ戻る
    camTargetRef.current = { pos: sc.pos.clone(), look: sc.look.clone(), active: true };
    if (controlsRef.current) controlsRef.current.enabled = false;
    setActiveSceneId(sc.id);
    setSelectedPinId(null);
  }, []);

  // 内観（歩く）：ウォークスルーへ入場。既定は三人称（アバターでスケール感が伝わる）
  const enterWalkScene = useCallback(() => {
    setDrawingView(null);
    useEditorModeStore.getState().setWalkthroughViewMode("third");
    camTargetRef.current.active = false;
    if (controlsRef.current) controlsRef.current.enabled = false;
    setActiveSceneId(WALK_SCENE_ID);
    setSelectedPinId(null);
  }, []);

  const selectScene = useCallback(
    (sc) => {
      if (!sc) return;
      if (sc.walk) enterWalkScene();
      else goToScene(sc);
    },
    [enterWalkScene, goToScene]
  );

  // ピン → そのアイテムにカメラフォーカス
  // 部屋の内側・上方から見下ろす構図にして壁の遮蔽を避ける（天井はオープン）
  const focusItem = useCallback(
    (it) => {
      setDrawingView(null);
      const p = it?.transform?.position || [0, 0, 0];
      const c = bounds?.center;
      const look = new THREE.Vector3(p[0], (p[1] || 0) + 350, p[2]);
      const horiz = Math.max(1600, frameRadius * 0.3);
      const toC = c ? new THREE.Vector3(c.x - p[0], 0, c.z - p[2]) : new THREE.Vector3(0, 0, 1);
      if (toC.lengthSq() < 1) toC.set(0, 0, 1);
      else toC.normalize();
      // アイテムから部屋中心側へ寄り、かつ上空へ。見下ろし角で壁を回避。
      const pos = look.clone().addScaledVector(toC, horiz).add(new THREE.Vector3(0, horiz * 1.15, 0));
      camTargetRef.current = { pos, look, active: true };
      if (controlsRef.current) controlsRef.current.enabled = false;
      setSelectedPinId(it.id);
    },
    [frameRadius, bounds]
  );

  const backToOverview = useCallback(() => {
    const ov = scenes.find((s) => s.id === DEFAULT_SCENE_ID) || scenes[0];
    if (ov) goToScene(ov);
  }, [scenes, goToScene]);

  // 各シーンのサムネを遅延キャプチャ（カメラ静定後・ピン未選択時のみ、一度だけ）
  useEffect(() => {
    if (!open || selectedPinId || walkActive) return;
    if (sceneThumbs[activeSceneId]) return;
    const t = setTimeout(() => {
      const gl = glRef.current;
      if (!gl) return;
      try {
        const url = gl.domElement.toDataURL("image/jpeg", 0.72);
        setSceneThumbs((prev) => (prev[activeSceneId] ? prev : { ...prev, [activeSceneId]: url }));
      } catch {}
    }, 1100);
    return () => clearTimeout(t);
  }, [open, activeSceneId, selectedPinId, sceneThumbs]);

  useEffect(() => {
    if (!open || !bounds || framedRef.current) return;
    framedRef.current = true;
    const built = buildScenes(bounds);
    const sc = built.find((s) => s.id === DEFAULT_SCENE_ID) || built[0];
    requestAnimationFrame(() => goToScene(sc));
  }, [open, bounds, goToScene]);

  const captureShot = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;
    try {
      const url = gl.domElement.toDataURL("image/jpeg", 0.92);
      setShots((prev) => [{ id: nextId(), url }, ...prev]);
    } catch {}
  }, [nextId]);

  const removeShot = useCallback((id) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ギャラリー自動生成用のアングル（バウンディング由来）
  const galleryAngles = useMemo(() => {
    if (!bounds) return [];
    const c = bounds.center;
    const s = bounds.size;
    const sx = Math.max(s.x, 1);
    const sz = Math.max(s.z, 1);
    const r = Math.max(sx, sz, 1);
    const h = Math.max(s.y, 1);
    const floorY = c.y - h / 2;
    const eyeY = floorY + Math.min(1600, h * 0.55);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    return [
      { pos: v(c.x + sx * 0.45, c.y + r * 1.0, c.z + sz * 0.62), look: c.clone() }, // 俯瞰
      { pos: v(c.x + sx * 0.6, eyeY + h * 0.2, c.z + sz * 0.85), look: v(c.x, eyeY, c.z) }, // ヒーロー
      { pos: v(c.x - sx * 0.55, eyeY + h * 0.15, c.z + sz * 0.6), look: v(c.x, eyeY, c.z) }, // 逆サイド
      { pos: v(c.x - sx * 0.34, eyeY, c.z - sz * 0.34), look: v(c.x + sx * 0.1, eyeY * 0.98, c.z + sz * 0.1) }, // 内観
    ];
  }, [bounds]);

  // 複数アングルを一括キャプチャ（カメラを瞬間移動 → 描画待ち → 取得）
  const autoGenerate = useCallback(async () => {
    const ctrl = controlsRef.current;
    const gl = glRef.current;
    if (!ctrl || !gl || !galleryAngles.length) return;
    const cam = ctrl.object;
    if (!cam) return;

    setGenerating(true);
    camTargetRef.current.active = false; // CameraRig を止める
    const saved = { pos: cam.position.clone(), tgt: ctrl.target.clone() };
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const out = [];
    try {
      for (const a of galleryAngles) {
        cam.position.copy(a.pos);
        ctrl.target.copy(a.look);
        ctrl.update();
        await raf();
        await raf(); // R3F が現アングルで描画するのを待つ
        try {
          out.push({ id: nextId(), url: gl.domElement.toDataURL("image/jpeg", 0.92) });
        } catch {}
      }
    } finally {
      // カメラを元のシーンへ戻す
      cam.position.copy(saved.pos);
      ctrl.target.copy(saved.tgt);
      ctrl.update();
      setShots((prev) => [...out, ...prev]);
      setGenerating(false);
    }
  }, [galleryAngles, nextId]);

  const openLightbox = useCallback((i) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(-1), []);
  const stepLightbox = useCallback(
    (d) => setLightboxIndex((i) => (i < 0 ? i : (i + d + shots.length) % shots.length)),
    [shots.length]
  );

  if (!open) return null;

  const initialScene = scenes.find((s) => s.id === DEFAULT_SCENE_ID) || scenes[0];
  const initialPos = initialScene?.pos ?? new THREE.Vector3(8, 6, 8);

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "radial-gradient(120% 120% at 50% 0%, #10151f 0%, #060810 70%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===== トップバー ===== */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          pointerEvents: "none",
          background: `linear-gradient(180deg, ${alpha("#05070d", 0.55)} 0%, transparent 100%)`,
        }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ pointerEvents: "auto" }}>
          <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: 16, letterSpacing: 1.5 }}>
            SEKKEIYA
          </Typography>
          <Box sx={{ width: "1px", height: 16, bgcolor: alpha("#fff", 0.25) }} />
          <Typography sx={{ color: alpha("#fff", 0.7), fontSize: 12, letterSpacing: 0.5 }}>
            本番プレビュー
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ pointerEvents: "auto" }}>
          <Button
            disableElevation
            sx={{
              textTransform: "none",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              borderRadius: 999,
              px: 2.2,
              height: 36,
              bgcolor: alpha("#fff", 0.1),
              border: `1px solid ${alpha("#fff", 0.18)}`,
              "&:hover": { bgcolor: alpha("#fff", 0.18) },
            }}
          >
            お問い合わせ
          </Button>
          <IconButton
            onClick={onClose}
            sx={{
              color: "#fff",
              bgcolor: alpha("#fff", 0.1),
              "&:hover": { bgcolor: alpha("#fff", 0.2) },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* ===== 3D キャンバス（ライブシーン再利用） ===== */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Canvas
          dpr={[1, 2]}
          shadows
          camera={{ fov: 50, near: 0.05, far: 2_000_000, position: [initialPos.x, initialPos.y, initialPos.z] }}
          gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.25; // 客先向けに少し明るく（プレゼン階調）
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <color attach="background" args={["#0a0e16"]} />

          <GlGrabber onReady={(gl) => (glRef.current = gl)} />
          <CameraTuner radius={frameRadius} />
          <CameraRig camTargetRef={camTargetRef} controlsRef={controlsRef} />
          {/* カメラ操作はエディタの 3D 演出モードと同一にする:
              左ドラッグ=回転 / 中ドラッグ=パン / 右ドラッグ=見渡し（FPS ルック）＋
              右ドラッグ中 WASD 移動・Q/E 上下・Shift 加速・ホイールで速度調整。
              ホイールズームはカーソル位置基準（zoomToCursor）。 */}
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enabled={!walkActive}
            enableDamping
            dampingFactor={0.08}
            enablePan
            // 図面ビュー中は回転禁止（図面はパン・ズームのみ。左ドラッグ=パンに切替）
            enableRotate={!drawingView}
            zoomToCursor
            zoomSpeed={2.0}
            minDistance={frameRadius * 0.02}
            maxDistance={frameRadius * 80}
            mouseButtons={{
              LEFT: drawingView ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: drawingView ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, // 通常時の右ドラッグは binder が横取りして FPS ルック
            }}
          />
          {/* 図面ビュー: 正射カメラ＋レンダラー単位クリップ（エディタ状態には触れない） */}
          {drawingView && (
            <>
              <OrthographicCamera makeDefault />
              <DrawingViewFramer view={drawingView} controlsRef={controlsRef} />
              <PreviewClipPlanes planes={drawingView.planes} />
            </>
          )}
          {/* エディタと同じ WASD/QE ナビゲーション（useViewportControls）。
              内観（歩く）中は WalkthroughController が担当するので外す。
              moveSpeed はエディタ walk プリセット（1200）の2倍 — プレビューは建物全体を
              見渡す移動が多く、実機確認で「倍くらいが快適」とのフィードバックによる。 */}
          {!walkActive && !drawingView && (
            <PerspectiveControlsBinder
              enabled
              mouseEnabled
              keyboardEnabled
              orbitRef={controlsRef}
              selectedObject={null}
              moveSpeed={2400}
              verticalSpeed={2400}
              panMultiplier={1.0}
            />
          )}

          {/* 内観（歩く）：エディタと同一の WalkthroughController を再利用 */}
          {walkActive && (
            <>
              <WalkthroughFovSync baseFov={50} />
              <WalkthroughController active />
            </>
          )}

          <Suspense fallback={null}>
            {sceneObj ? (
              <LiveSceneHost sceneObj={sceneObj} />
            ) : (
              <SelfBuiltScene
                baseGlbUrl={baseGlbUrl}
                roomSpec={roomSpec}
                items={items}
                onBounds={setBounds}
                frameRadius={frameRadius}
                center={bounds?.center}
              />
            )}
          </Suspense>

          {activeScene?.group === "interior" && !walkActive && (
            <Pins items={items} onSelect={focusItem} selectedId={selectedPinId} />
          )}
        </Canvas>
      </Box>

      {/* ===== ウォークスルー HUD（視点切替＋操作ヒント） ===== */}
      {walkActive && (
        <>
          <Box
            sx={{
              position: "absolute",
              top: 86,
              right: 28,
              zIndex: 11,
              display: "flex",
              gap: "2px",
              p: "3px",
              borderRadius: 1.5,
              background: alpha("#0b0f18", 0.82),
              border: `1px solid ${alpha("#fff", 0.12)}`,
              backdropFilter: "blur(12px)",
            }}
          >
            {[["first", "一人称"], ["third", "三人称"], ["fly", "フライ"]].map(([m, label]) => (
              <Box
                key={m}
                onClick={() => setWalkthroughViewMode(m)}
                sx={{
                  px: 1.2,
                  py: 0.5,
                  borderRadius: 1,
                  cursor: "pointer",
                  fontSize: "0.74rem",
                  fontWeight: walkthroughViewMode === m ? 700 : 400,
                  color: walkthroughViewMode === m ? "#fff" : alpha("#fff", 0.55),
                  background: walkthroughViewMode === m ? alpha("#4f8cff", 0.55) : "transparent",
                  transition: "all 0.15s",
                  userSelect: "none",
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              position: "absolute",
              bottom: 158,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 11,
              px: 1.5,
              py: 0.55,
              borderRadius: 999,
              background: alpha("#0b0f18", 0.72),
              border: `1px solid ${alpha("#fff", 0.1)}`,
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
            }}
          >
            <Typography sx={{ color: alpha("#fff", 0.82), fontSize: "0.72rem", whiteSpace: "nowrap" }}>
              {walkthroughViewMode === "fly"
                ? "WASD 飛行 ・ Space/Q 上昇 ・ C/E 下降 ・ Shift 加速 ・ 右ドラッグで見渡す"
                : "WASD 移動 ・ Shift 走る ・ Space ジャンプ ・ 右ドラッグで見渡す ・ 下のビューで俯瞰へ戻る"}
            </Typography>
          </Box>
        </>
      )}

      {/* ===== 右：情報カード（ウォークスルー中は没入のため非表示） =====
           ウォークスルー中だけ出る視点切替 HUD も右上に置いているが、この2つは
           walkActive で排他表示なので重ならない。 */}
      {!walkActive && (
      <Box
        sx={{
          position: "absolute",
          top: 86,
          right: 28,
          bottom: 172,
          width: 366,
          maxHeight: "calc(100vh - 258px)",
          zIndex: 11,
          display: "flex",
          flexDirection: "column",
          borderRadius: 3,
          overflow: "hidden",
          background: alpha("#0b0f18", 0.82),
          border: `1px solid ${alpha("#fff", 0.1)}`,
          backdropFilter: "blur(18px)",
          boxShadow: `0 24px 70px ${alpha("#000", 0.55)}`,
        }}
      >
        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {selectedItem ? (
            <ItemPanel item={selectedItem} onBack={backToOverview} />
          ) : (
            <>
              {subtitle ? (
                <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.5), letterSpacing: 1.2, mb: 0.6 }}>
                  {subtitle}
                </Typography>
              ) : null}
              <Typography sx={{ fontSize: 30, fontWeight: 800, color: "#fff", lineHeight: 1.05, letterSpacing: "-0.5px", mb: 2.2 }}>
                {title}
              </Typography>

              <SpecPanel roomSpec={roomSpec} bounds={bounds} items={items} usage={usage} />

              {activeScene?.group === "interior" && (
                <Box sx={{ mt: 2.4 }}>
                  <Divider sx={{ mb: 2, borderColor: alpha("#fff", 0.08) }} />
                  <FloorplanPanel roomSpec={roomSpec} bounds={bounds} items={items} />
                </Box>
              )}
            </>
          )}
        </Box>

        {/* CTA */}
        <Box sx={{ p: 2, borderTop: `1px solid ${alpha("#fff", 0.08)}` }}>
          <Button
            fullWidth
            disableElevation
            sx={{
              textTransform: "none",
              fontSize: 14,
              fontWeight: 800,
              height: 46,
              borderRadius: 2,
              color: "#06210f",
              background: `linear-gradient(180deg, ${alpha("#34d399", 0.98)} 0%, ${alpha("#059669", 0.95)} 100%)`,
              "&:hover": { background: `linear-gradient(180deg, ${alpha("#34d399", 1)} 0%, ${alpha("#047857", 1)} 100%)` },
            }}
          >
            この間取りについて相談する
          </Button>
        </Box>
      </Box>
      )}

      {/* ===== 下部：フィルムストリップ（ビュー＋ギャラリー） ===== */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 11,
          pt: 5,
          pb: 2.5,
          px: 2,
          display: "flex",
          alignItems: "flex-end",
          gap: 1.2,
          pointerEvents: "none",
          background: `linear-gradient(0deg, ${alpha("#05070d", 0.82)} 0%, ${alpha("#05070d", 0)} 100%)`,
        }}
      >
        <IconButton
          onClick={() => scrollStrip(-1)}
          sx={{
            pointerEvents: "auto",
            flexShrink: 0,
            mb: 2.6,
            color: "#fff",
            bgcolor: alpha("#0b0f18", 0.7),
            border: `1px solid ${alpha("#fff", 0.14)}`,
            "&:hover": { bgcolor: alpha("#0b0f18", 0.95) },
          }}
        >
          <ChevronLeftRoundedIcon />
        </IconButton>

        <Box
          ref={stripRef}
          sx={{
            pointerEvents: "auto",
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: 4,
            overflowX: "auto",
            px: 1,
            pb: 0.5,
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {/* 外観 */}
          <Box sx={{ flexShrink: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1, letterSpacing: 0.5 }}>
              外観
            </Typography>
            <Stack direction="row" spacing={1}>
              {scenes
                .filter((sc) => sc.group === "exterior")
                .map((sc) => (
                  <StripTile
                    key={sc.id}
                    thumb={sceneThumbs[sc.id]}
                    label={sc.label}
                    active={sc.id === activeSceneId && !selectedPinId}
                    onClick={() => selectScene(sc)}
                  />
                ))}
            </Stack>
          </Box>

          {/* インテリア（階別） */}
          <Box sx={{ flexShrink: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1, letterSpacing: 0.5 }}>
              インテリア
            </Typography>
            <Stack direction="row" spacing={1}>
              {scenes
                .filter((sc) => sc.group === "interior")
                .map((sc) => (
                  <StripTile
                    key={sc.id}
                    thumb={sceneThumbs[sc.id]}
                    label={sc.label}
                    active={sc.id === activeSceneId && !selectedPinId}
                    onClick={() => selectScene(sc)}
                    icon={sc.walk ? <DirectionsWalkRoundedIcon sx={{ color: alpha("#fff", 0.6), fontSize: 26 }} /> : null}
                  />
                ))}
            </Stack>
          </Box>

          {/* 図面（平面/天井/立面/断面/展開）— Base/Plan で定義済みのビューを正射で表示。
              クリップはこの canvas 限定（エディタ状態は変更しない）。外観/インテリアで復帰 */}
          {drawingViews.length > 0 && (
            <Box sx={{ flexShrink: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1, letterSpacing: 0.5 }}>
                図面
              </Typography>
              <Stack direction="row" spacing={1}>
                {drawingViews.map((v) => (
                  <StripTile
                    key={v.id}
                    label={v.label}
                    active={drawingView?.id === v.id}
                    icon={<ArchitectureRoundedIcon sx={{ color: alpha("#fff", 0.55) }} />}
                    onClick={() => openDrawingView(v)}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* 提案（Plan 込みの完全な最終形）。お客様に見せる画面はこれだけで完結する */}
          {canEditPatterns && (
            <Box sx={{ flexShrink: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1, letterSpacing: 0.5 }}>
                提案
              </Typography>
              <Stack direction="row" spacing={1}>
                {patterns.map((p) => {
                  const ref = resolveProposalPlan(p.planId ?? null, proposalPlans);
                  const broken = ref.kind === "missing";
                  return (
                    <StripTile
                      key={p.id}
                      label={broken ? `${p.name}（Plan なし）` : p.name}
                      active={activePatternId === p.id}
                      busy={patternBusy}
                      icon={<PaletteRoundedIcon sx={{ color: alpha("#fff", broken ? 0.25 : 0.5) }} />}
                      onClick={broken ? undefined : () => { void selectPattern(p.id); }}
                      onRemove={() => { void removePattern(p.id); }}
                    />
                  );
                })}
                <StripTile
                  label="＋ 新しい提案"
                  busy={patternBusy}
                  icon={<BookmarkAddRoundedIcon sx={{ color: alpha("#fff", 0.5) }} />}
                  onClick={patternBusy ? undefined : () => { void createOption(); }}
                />
              </Stack>
            </Box>
          )}

          {/* ギャラリー */}
          <Box sx={{ flexShrink: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1, letterSpacing: 0.5 }}>
              ギャラリー
            </Typography>
            <Stack direction="row" spacing={1}>
              {shots.map((s, i) => (
                <StripTile
                  key={s.id}
                  thumb={s.url}
                  label={`#${i + 1}`}
                  onClick={() => openLightbox(i)}
                  onRemove={() => removeShot(s.id)}
                />
              ))}
              <StripTile
                label={generating ? "生成中…" : "自動生成"}
                busy={generating}
                onClick={generating ? undefined : autoGenerate}
                icon={<AutoAwesomeRoundedIcon sx={{ color: alpha("#fff", 0.55) }} />}
              />
              <StripTile
                label="保存"
                onClick={captureShot}
                icon={<AddAPhotoRoundedIcon sx={{ color: alpha("#fff", 0.55) }} />}
              />
            </Stack>
          </Box>
        </Box>

        <IconButton
          onClick={() => scrollStrip(1)}
          sx={{
            pointerEvents: "auto",
            flexShrink: 0,
            mb: 2.6,
            color: "#fff",
            bgcolor: alpha("#0b0f18", 0.7),
            border: `1px solid ${alpha("#fff", 0.14)}`,
            "&:hover": { bgcolor: alpha("#0b0f18", 0.95) },
          }}
        >
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      {/* ===== 自動アクション（左サイドの縦スタック。エディタの★メニューと同じ並び・配色） =====
          提案の見え方を見ながらその場で試せるようにする。結果はデバウンスで自動的に
          アクティブ提案へ保存される。別の見た目を試したいときは「＋ 新しい提案」で切り分ける。 */}
      {canEditPatterns && (
        <Box
          sx={{
            position: "absolute",
            left: 20,
            top: 84,
            bottom: 210, // 下部フィルムストリップと重ならない範囲でスクロール
            zIndex: 12,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            alignItems: "flex-start",
            overflowY: "auto",
            pr: 1,
            // スクロールバーは目立たせない（提案画面のため）
            "&::-webkit-scrollbar": { width: 0 },
          }}
        >
          {PREVIEW_AUTO_ACTIONS.map((a) => {
            const busy = autoRunners.busyKind === a.kind;
            return (
              <Box
                key={a.kind}
                onClick={busy ? undefined : (e) => handleAutoTileClick(e, a)}
                title={a.media ? `${a.label}（エディタで開く）` : a.label}
                sx={{
                  display: "flex", alignItems: "center", gap: 1, flexShrink: 0,
                  pl: 0.6, pr: 1.4, py: 0.6, borderRadius: 999,
                  cursor: busy ? "default" : "pointer", whiteSpace: "nowrap",
                  color: "#fff",
                  background: alpha("#0b1020", 0.9),
                  border: `1px solid ${alpha(a.color, 0.5)}`,
                  boxShadow: `0 6px 20px ${alpha("#000", 0.45)}`,
                  backdropFilter: "blur(8px)",
                  opacity: busy ? 0.7 : 1,
                  transition: "transform 0.12s, filter 0.15s",
                  "&:hover": busy ? undefined : { filter: "brightness(1.15)", transform: "translateX(2px)" },
                }}
              >
                <Box
                  sx={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: alpha(a.color, 0.22), color: a.color,
                    "& svg": { fontSize: 18 },
                  }}
                >
                  {busy ? <CircularProgress size={14} sx={{ color: a.color }} /> : a.icon}
                </Box>
                <Typography sx={{ fontSize: "0.74rem", fontWeight: 700 }}>{a.label}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ===== ライトボックス ===== */}
      {lightboxIndex >= 0 && shots[lightboxIndex] && (
        <Box
          onClick={closeLightbox}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            background: alpha("#000", 0.86),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <IconButton
            onClick={closeLightbox}
            sx={{ position: "absolute", top: 16, right: 16, color: "#fff", bgcolor: alpha("#fff", 0.1), "&:hover": { bgcolor: alpha("#fff", 0.2) } }}
          >
            <CloseRoundedIcon />
          </IconButton>

          {shots.length > 1 && (
            <>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  stepLightbox(-1);
                }}
                sx={{ position: "absolute", left: 20, color: "#fff", bgcolor: alpha("#fff", 0.1), "&:hover": { bgcolor: alpha("#fff", 0.2) } }}
              >
                <ChevronLeftRoundedIcon fontSize="large" />
              </IconButton>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  stepLightbox(1);
                }}
                sx={{ position: "absolute", right: 20, color: "#fff", bgcolor: alpha("#fff", 0.1), "&:hover": { bgcolor: alpha("#fff", 0.2) } }}
              >
                <ChevronRightRoundedIcon fontSize="large" />
              </IconButton>
            </>
          )}

          <img
            src={shots[lightboxIndex].url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "88%", maxHeight: "86%", borderRadius: 10, boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
          />
          <Typography sx={{ position: "absolute", bottom: 24, color: alpha("#fff", 0.6), fontSize: 12 }}>
            {lightboxIndex + 1} / {shots.length}
          </Typography>
        </Box>
      )}
      {/* 自動アクションのスタイル選択。
          zIndex: Menu も Dialog と同じく document.body へポータルされるため、
          プレビュー（zIndex 2000）より上に出す指定が要る。 */}
      <Menu
        open={!!autoMenu}
        anchorEl={autoMenu?.anchorEl || null}
        onClose={() => setAutoMenu(null)}
        sx={{ zIndex: 2600 }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { sx: { bgcolor: "#0f1622", color: "#fff", border: `1px solid ${alpha("#fff", 0.12)}`, minWidth: 180 } } }}
      >
        {(autoOptionsFor(autoMenu?.kind) || []).map((o) => (
          <MenuItem
            key={o.key}
            onClick={() => { const k = autoMenu?.kind; setAutoMenu(null); runAutoAction(k, o.key); }}
            sx={{ fontSize: 12.5 }}
          >
            {o.label}
          </MenuItem>
        ))}
      </Menu>

    </Box>
  );
}
