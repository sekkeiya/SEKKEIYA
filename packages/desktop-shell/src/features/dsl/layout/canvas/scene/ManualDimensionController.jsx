// ManualDimensionController — ヘッダー「寸法」ツールの作図＋表示＋編集。
//   作図: ツールを構えて 1回目クリック=始点 → 2回目クリック=終点で寸法を確定（連続作図可）。
//         右クリック（またはEsc）でツール解除。50mm グリッドスナップ＋直交スナップ（Altで自由角度）。
//   表示: 作図したビュー（viewKey）でのみ表示。展開図/断面と同じスレート線＋白地 mm 値の図面表記。
//   編集: 端点はホバーで●が出て左ドラッグで移動。値はダブルクリックで数値入力
//         （始点は固定・終点が寸法方向に伸縮）。ホバーの × で削除。
//   座標系: world = mm。平面(hAxis=null)は XZ・y=作図面高さ / 断面・立面(hAxis="x"|"z")は
//         画面横=hAxis・縦=Y・奥行き 0 の面に置く（表示は depthTest 無効なので奥行きは見た目に影響しない）。
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useManualDimensionStore } from "../../store/useManualDimensionStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useLevelLinesStore } from "../../store/useLevelLinesStore";
import { useBaseEditMode } from "../../utils/baseEditMode";

const INK = "#475569";        // 寸法線
const INK_DARK = "#0f172a";   // 数値
const ACCENT = "#0369a1";     // ホバー/編集のアクセント
const SNAP_MM = 50;           // グリッド刻み
const ORTHO_TOL = 0.28;       // 直交スナップの許容（rad ≒ 16°）
const MIN_LEN_MM = 100;       // これ未満の寸法は作らない

const tagStyle = (hovered) => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: hovered ? ACCENT : INK_DARK,
  background: hovered ? "rgba(255,255,255,0.99)" : "rgba(255,255,255,0.92)",
  border: `1px solid ${hovered ? "rgba(3,105,161,0.75)" : "rgba(30,41,59,0.35)"}`,
  boxShadow: hovered ? "0 0 0 2px rgba(3,105,161,0.15)" : "none",
  borderRadius: 3,
  padding: "0px 4px",
  whiteSpace: "nowrap",
  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
  transition: "border-color 0.12s, color 0.12s, box-shadow 0.12s",
});

const inputStyle = {
  width: 64, fontSize: 11, fontWeight: 700, textAlign: "center",
  borderRadius: 3, border: `1px solid ${ACCENT}`,
  background: "rgba(255,255,255,0.98)", color: INK_DARK,
  outline: "none", pointerEvents: "auto",
};

/** ビューごとの作図フレーム: 面内基底 u/v とレイキャスト平面。hAxis=null は平面(Top)。 */
function makeFrame(hAxis, planY) {
  if (hAxis === "x") {
    // FRONT: 画面横=X / 縦=Y / 奥行き=Z（面 z=0）
    return {
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      toUV: (p) => ({ u: p.x, v: p.y }),
      toWorld: (u, v) => ({ x: u, y: v, z: 0 }),
    };
  }
  if (hAxis === "z") {
    // RIGHT: 画面横=Z / 縦=Y / 奥行き=X（面 x=0）
    return {
      plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      toUV: (p) => ({ u: p.z, v: p.y }),
      toWorld: (u, v) => ({ x: 0, y: v, z: u }),
    };
  }
  // TOP: 画面横=X / 縦=Z / 面 y=planY
  return {
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -(planY || 0)),
    toUV: (p) => ({ u: p.x, v: p.z }),
    toWorld: (u, v) => ({ x: u, y: planY || 0, z: v }),
  };
}

const snapMm = (v) => Math.round(v / SNAP_MM) * SNAP_MM;

/** 始点からの直交スナップ（Alt で解除）＋ 50mm グリッド。UV 面内で処理する。 */
function resolveUV(uv, anchorUV, altKey) {
  let { u, v } = uv;
  if (anchorUV && !altKey) {
    const du = u - anchorUV.u;
    const dv = v - anchorUV.v;
    if (du !== 0 || dv !== 0) {
      const ang = Math.atan2(Math.abs(dv), Math.abs(du));
      if (ang < ORTHO_TOL) v = anchorUV.v;                    // 水平
      else if (ang > Math.PI / 2 - ORTHO_TOL) u = anchorUV.u; // 垂直
    }
  }
  return { u: snapMm(u), v: snapMm(v) };
}

/** 端点ハンドル。普段は透明・ホバーで●。左ドラッグで面内を移動（もう一方の端点に対し直交スナップ）。
 *  cursor: 寸法の向きに応じたリサイズカーソル（展開図の区切りハンドルと同じ流儀）。 */
function EndpointHandle({ dim, which, frame, cursor = "ew-resize" }) {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(frame.plane, hit)) return;
      const st = useManualDimensionStore.getState();
      const cur = st.dims.find((d) => d.id === dim.id);
      if (!cur) return;
      const other = which === "a" ? cur.b : cur.a;
      const uv = resolveUV(frame.toUV(hit), frame.toUV(other), ev.altKey);
      const w = frame.toWorld(uv.u, uv.v);
      // 平面ビューでは既存の y（作図時の面高さ）を保つ
      const pt = { x: w.x, y: which === "a" ? cur.a.y : cur.b.y, z: w.z };
      if (frame.plane.normal.y !== 1) pt.y = w.y;
      st.updateDimLocal(dim.id, which === "a" ? { a: pt } : { b: pt });
    };
    const onUp = () => {
      setDragging(false);
      useManualDimensionStore.getState().persistDims();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, frame, dim.id, which]);

  const p = which === "a" ? dim.a : dim.b;
  const visible = hover || dragging;
  return (
    <Html position={[p.x, p.y, p.z]} center zIndexRange={[19, 0]}>
      <div
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setDragging(true); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="ドラッグで端点を移動（Altで自由角度）"
        style={{
          width: 14, height: 14, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor, pointerEvents: "auto", background: "transparent", touchAction: "none",
        }}
      >
        <div
          style={{
            width: visible ? 11 : 0, height: visible ? 11 : 0, borderRadius: "50%",
            background: dragging ? ACCENT : "rgba(255,255,255,0.95)",
            border: visible ? `1.5px solid ${ACCENT}` : "none",
            boxShadow: visible ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
            transition: "width 80ms, height 80ms",
          }}
        />
      </div>
    </Html>
  );
}

/** 1本の寸法の描画（線＋端部ティック＋mm 値タグ）。
 *  preview=true は作図中プレビュー（破線・編集 UI なし）。
 *  readOnly=true は表示のみ（実線のまま編集 UI だけ無効。Plan/Option で使う＝寸法は Base 共通）。 */
function DimAnnotation({ dim, frame, tickW, preview = false, readOnly = false }) {
  // 編集 UI（ホバー・ダブルクリック・×・端点ハンドル）を出さない状態
  const inert = preview || readOnly;
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);

  const a = dim.a, b = dim.b;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1) return null;
  // 面内の垂直方向（ティック向き）: 進行方向を面法線まわりに 90° 回した向き
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const perp = new THREE.Vector3().crossVectors(frame.plane.normal, dir).normalize();
  const t = tickW;
  const P = (p) => [p.x, p.y, p.z];
  const T = (p) => [
    [p.x - perp.x * t, p.y - perp.y * t, p.z - perp.z * t],
    [p.x + perp.x * t, p.y + perp.y * t, p.z + perp.z * t],
  ];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  // 端点ハンドルのカーソル。画面横に伸びる寸法なら ew-resize、縦なら ns-resize
  // （展開図の区切りハンドルと同じ。十字の移動カーソルは使わない）。
  const uvA = frame.toUV(a), uvB = frame.toUV(b);
  const endCursor = Math.abs(uvB.u - uvA.u) >= Math.abs(uvB.v - uvA.v) ? "ew-resize" : "ns-resize";

  const commit = (raw) => {
    setEditing(false);
    const v = Math.round(Number(raw));
    if (!Number.isFinite(v) || v < MIN_LEN_MM) return;
    // 始点固定・終点を寸法方向へ伸縮
    const nb = {
      x: Math.round(a.x + dir.x * v),
      y: Math.round(a.y + dir.y * v),
      z: Math.round(a.z + dir.z * v),
    };
    useManualDimensionStore.getState().updateDim(dim.id, { b: nb });
  };

  const lineCommon = { color: INK, lineWidth: 1.4, transparent: true, opacity: 0.95, depthTest: false, userData: { ignoreClipping: true } };

  return (
    <group renderOrder={9000}>
      <Line points={[P(a), P(b)]} {...lineCommon} dashed={preview} dashSize={120} gapSize={80} />
      <Line points={T(a)} {...lineCommon} />
      <Line points={T(b)} {...lineCommon} />
      <Html position={[mid.x, mid.y, mid.z]} center zIndexRange={[18, 0]} style={inert ? { pointerEvents: "none" } : undefined}>
        {editing ? (
          <input
            autoFocus type="number" defaultValue={Math.round(len)} step={50}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(e.currentTarget.value);
              if (e.key === "Escape") setEditing(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={inputStyle}
          />
        ) : (
          <div
            onMouseEnter={inert ? undefined : () => setHover(true)}
            onMouseLeave={inert ? undefined : () => setHover(false)}
            style={{ position: "relative", display: "inline-block" }}
          >
            <div
              onDoubleClick={inert ? undefined : (e) => { e.stopPropagation(); setEditing(true); }}
              title={inert ? undefined : "手動寸法（ダブルクリックで数値入力）"}
              style={{
                ...tagStyle(hover && !inert),
                pointerEvents: inert ? "none" : "auto",
                cursor: inert ? "default" : "text",
                userSelect: "none",
              }}
            >
              {Math.round(len)}
            </div>
            {!inert && hover && (
              <div
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); useManualDimensionStore.getState().removeDim(dim.id); }}
                title="この寸法を削除"
                style={{
                  position: "absolute", top: -8, right: -8,
                  width: 15, height: 15, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 900,
                  lineHeight: 1, cursor: "pointer", pointerEvents: "auto",
                  border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              >
                ×
              </div>
            )}
          </div>
        )}
      </Html>
      {!inert && (
        <>
          <EndpointHandle dim={dim} which="a" frame={frame} cursor={endCursor} />
          <EndpointHandle dim={dim} which="b" frame={frame} cursor={endCursor} />
        </>
      )}
    </group>
  );
}

/**
 * viewKey: このビューを一意に識別するキー（null = 手動寸法の対象外ビュー＝何も出さない）。
 * hAxis: 画面横の world 軸。null=平面(Top) / "x"=FRONT / "z"=RIGHT。
 */
export default function ManualDimensionController({ enabled = true, viewKey = null, hAxis = null }) {
  const dims = useManualDimensionStore((s) => s.dims);
  const drawActive = useManualDimensionStore((s) => s.drawActive);
  const draft = useManualDimensionStore((s) => s.draft);
  const setDraft = useManualDimensionStore((s) => s.setDraft);
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const dimArrowScale = useLevelLinesStore((s) => s.dimArrowScale);
  // Plan/Option（家具サイド）では手動寸法は表示のみ（寸法は Base 共通データ）。
  const baseEdit = useBaseEditMode();

  const { gl } = useThree();
  const anchorRef = useRef(null); // 作図中の始点（world）。null = 未開始。

  const active = enabled && drawActive && !!viewKey;
  // ビューが変わったら基底も変わる（平面は作図面の高さも含む）
  const frame = React.useMemo(() => makeFrame(hAxis, gridHeightMm), [hAxis, gridHeightMm]);
  const tickW = Math.max((sceneExtentXZ || 0) * 0.025, 40) * (dimArrowScale || 1);

  const finishTool = useCallback(() => {
    anchorRef.current = null;
    setDraft(null);
    useManualDimensionStore.getState().setDrawActive(false);
  }, [setDraft]);

  // Escape = ツール解除（始点だけ置いた状態なら始点の取消）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (!useManualDimensionStore.getState().drawActive) return;
      e.stopPropagation();
      if (anchorRef.current) {
        anchorRef.current = null;
        setDraft(null);
      } else {
        finishTool();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishTool, setDraft]);

  // ツール解除／ビュー切替で作図中断
  useEffect(() => {
    if (active) return;
    anchorRef.current = null;
    setDraft(null);
  }, [active, viewKey, setDraft]);

  // 右クリック＝ツール解除のコンテキストメニュー抑止（WallDrawController と同じ流儀）
  const suppressCtxRef = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const onCtx = (e) => {
      if (!suppressCtxRef.current) return;
      suppressCtxRef.current = false;
      e.preventDefault();
    };
    el.addEventListener("contextmenu", onCtx);
    return () => el.removeEventListener("contextmenu", onCtx);
  }, [gl]);

  const resolvePoint = useCallback((e, anchor) => {
    const uv = resolveUV(frame.toUV(e.point), anchor ? frame.toUV(anchor) : null, e.altKey);
    return frame.toWorld(uv.u, uv.v);
  }, [frame]);

  const handlePointerDown = useCallback((e) => {
    if (!active) return;
    if (e.button === 2) {
      e.stopPropagation();
      suppressCtxRef.current = true;
      finishTool();
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();

    const anchor = anchorRef.current;
    const pt = resolvePoint(e, anchor);
    if (!anchor) {
      anchorRef.current = pt;
      setDraft({ a: pt, b: pt });
      return;
    }
    const len = Math.hypot(pt.x - anchor.x, pt.y - anchor.y, pt.z - anchor.z);
    if (len < MIN_LEN_MM) return;
    useManualDimensionStore.getState().addDim(viewKey, anchor, pt);
    // 連続作図: 次の寸法は新しい 2 点で（終点をつなげたければその点をクリックし直す）
    anchorRef.current = null;
    setDraft(null);
  }, [active, viewKey, resolvePoint, setDraft, finishTool]);

  const handlePointerMove = useCallback((e) => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    e.stopPropagation();
    setDraft({ a: anchor, b: resolvePoint(e, anchor) });
  }, [resolvePoint, setDraft]);

  if (!viewKey) return null;
  const visibleDims = dims.filter((d) => d.viewKey === viewKey);

  // 作図用の透明プレーン: 平面は水平（y=作図面）、断面/立面は正対する垂直面
  const planeMesh = active && (
    <mesh
      position={hAxis ? [0, 0, 0] : [0, gridHeightMm, 0]}
      rotation={hAxis === "x" ? [0, 0, 0] : hAxis === "z" ? [0, Math.PI / 2, 0] : [-Math.PI / 2, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      renderOrder={-1}
      userData={{ ignoreClipping: true }}
    >
      <planeGeometry args={[400000, 400000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );

  return (
    <group userData={{ ignoreClipping: true }}>
      {planeMesh}
      {visibleDims.map((d) => (
        <DimAnnotation key={d.id} dim={d} frame={frame} tickW={tickW} readOnly={!baseEdit} />
      ))}
      {draft && active && (
        <DimAnnotation dim={{ id: "__draft__", viewKey, a: draft.a, b: draft.b }} frame={frame} tickW={tickW} preview />
      )}
    </group>
  );
}
