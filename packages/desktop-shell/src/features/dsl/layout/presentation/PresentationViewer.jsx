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
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import { layoutSceneRef } from "../services/layoutSceneRef";
// @ts-ignore
import ParametricRoom, { normalizeRoomSpec } from "../canvas/scene/ParametricRoom.jsx";
import { useResolvedUrl } from "../hooks/useResolvedUrl";

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
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    if (!reported.current && typeof onBounds === "function") {
      const box = new THREE.Box3().setFromObject(scene);
      if (!box.isEmpty()) {
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
        <ParametricRoom spec={normalizeRoomSpec(roomSpec)} onLoaded={() => {}} isTopView={false} />
      ) : null}

      {(items || []).map((it) => (it?.glbUrl ? <SelfItem key={it.id} item={it} /> : null))}
    </>
  );
}

/* ============================================================
 * カメラ：スムーズ遷移 ＋ スケール連動 near/far
 * ========================================================== */
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
  ];
}

const DEFAULT_SCENE_ID = "int-1f";

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
}) {
  const camTargetRef = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), active: false });
  const controlsRef = useRef(null);
  const glRef = useRef(null);

  const [sceneObj, setSceneObj] = useState(null);
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
  const selectedItem = useMemo(
    () => (selectedPinId ? items.find((it) => it.id === selectedPinId) || null : null),
    [selectedPinId, items]
  );
  const frameRadius = useMemo(() => {
    const s = bounds?.size;
    return s ? Math.max(s.x, s.z, s.y, 1) : 6;
  }, [bounds]);

  const goToScene = useCallback((sc) => {
    if (!sc) return;
    camTargetRef.current = { pos: sc.pos.clone(), look: sc.look.clone(), active: true };
    if (controlsRef.current) controlsRef.current.enabled = false;
    setActiveSceneId(sc.id);
    setSelectedPinId(null);
  }, []);

  // ピン → そのアイテムにカメラフォーカス
  // 部屋の内側・上方から見下ろす構図にして壁の遮蔽を避ける（天井はオープン）
  const focusItem = useCallback(
    (it) => {
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
    if (!open || selectedPinId) return;
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
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minDistance={frameRadius * 0.02}
            maxDistance={frameRadius * 80}
          />

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

          {activeScene?.group === "interior" && (
            <Pins items={items} onSelect={focusItem} selectedId={selectedPinId} />
          )}
        </Canvas>
      </Box>

      {/* ===== 左：情報カード（常時表示） ===== */}
      <Box
        sx={{
          position: "absolute",
          top: 86,
          left: 28,
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
                    onClick={() => goToScene(sc)}
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
                    onClick={() => goToScene(sc)}
                  />
                ))}
            </Stack>
          </Box>

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
    </Box>
  );
}
