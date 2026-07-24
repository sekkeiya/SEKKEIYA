// GridAxisOverlay — 通り芯（構造グリッド）を図面に描く。寸法列の「刻み元」になる基準線。
//   平面(Top): 建物を貫く一点鎖線＋両端に丸囲みの符号（X1 / Y2 …）。
//              線をドラッグで移動（50mm 刻み）／記号クリックで選択／ダブルクリックで改名。
//   断面・立面(FRONT/RIGHT): 視線に直交する向きの通りだけを縦の一点鎖線＋上端の符号で出す。
//              図面注記なのでクリップ対象外（userData.ignoreClipping）・深度無視で最前面に描く。
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html, Line, PivotControls } from "@react-three/drei";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useGridAxisStore, GRID_AXIS_SNAP_MM } from "../../store/useGridAxisStore";
import { useWallStore } from "../../store/useWallStore";
import { useSlabStore } from "../../store/useSlabStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useViewportUiStore } from "../../store/viewportUiStore";
import LineEndHandle from "./LineEndHandle.jsx";
import { isDrawToolActive, useDrawToolActive } from "../../utils/drawToolActive";
import { isBaseEditMode, useBaseEditMode } from "../../utils/baseEditMode";

// 通り芯は「基準線」なので、断面線（濃いスレート）より一段淡い青寄りのグレーにして
// 図面の主役（躯体・寸法）を邪魔しない。選択中だけアクセント色で濃くする。
const AXIS_COLOR = "#94a3b8";
const AXIS_ACTIVE = "#0369a1";

/**
 * 通り芯の線を、建物の外形からどれだけ外へ伸ばすか(mm)。
 * 建物のすぐ外（+200mm 付近）は断面記号（A / A'）の場所。
 * 寸法列は建物外形から 1000mm の位置に1列目を置き、以降 420mm ずつ外へ並ぶ（最大3列）。
 * 記号（X0/Y0…）は寸法列よりさらに外に出したいので、3列ぶん＋ラベル分を越える長さにする。
 *   1000 + 420×2 + ラベル 150 ＝ 1990 → 余裕を見て 2400。
 * 数値は utils/planBounds の DIM_COL_OFFSET_MM / DIM_COL_GAP_MM と揃えること。
 */
const AXIS_EXTEND_MM = 2400;
/** 線の端から記号までの距離(mm)。 */
const BADGE_GAP_MM = 380;

const snap = (v) => Math.round(v / GRID_AXIS_SNAP_MM) * GRID_AXIS_SNAP_MM;

/** 通り芯を選択し、通り芯パネルを開く。他タイプ（壁/床）の選択は解除する。 */
function selectAxis(id) {
  useWallStore.getState().setSelectedWallId(null);
  useSlabStore.getState().setSelectedSlabId(null);
  const st = useGridAxisStore.getState();
  st.setSelectedId(id);
  st.setPanelOpen(true);
  useUiRightSidebarStore.getState().setRightPanel("properties", true);
}

/** 丸囲みの符号バッジ（建築図面の通り芯記号）。クリックで選択・ダブルクリックで改名・ホバーで×削除。 */
function AxisBadge({ axis, active, position }) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  // 作図中は DOM の記号がクリックを吸ってしまうので、当たり判定を無効化する。
  // Plan/Option（家具サイド）でも同様に無効化（通り芯は Base 共通＝編集は Base で）。
  const drawing = useDrawToolActive();
  const baseEdit = useBaseEditMode();
  const interactive = !drawing && baseEdit;
  const select = (e) => {
    e?.stopPropagation?.();
    selectAxis(axis.id);
  };
  const commit = (raw) => {
    setEditing(false);
    const name = String(raw || "").trim();
    if (!name || name === axis.name) return;
    // 手動で付けた名前は自動採番から守る（renamed）。
    useGridAxisStore.getState().updateAxis(axis.id, { name, renamed: true });
  };
  return (
    <Html position={position} center zIndexRange={[17, 0]} style={{ pointerEvents: "none" }}>
      {editing ? (
        <input
          autoFocus defaultValue={axis.name}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 46, height: 20, textAlign: "center", borderRadius: 10,
            fontSize: 10.5, fontWeight: 700, outline: "none",
            border: `1px solid ${AXIS_ACTIVE}`, background: "rgba(255,255,255,0.98)", color: "#0f172a",
            pointerEvents: "auto",
          }}
        />
      ) : (
        <div
          onMouseEnter={interactive ? () => setHover(true) : undefined}
          onMouseLeave={interactive ? () => setHover(false) : undefined}
          style={{ position: "relative", display: "inline-block", pointerEvents: interactive ? "auto" : "none" }}
        >
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={select}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={`通り芯 ${axis.name}（クリックで選択 / ダブルクリックで改名）`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minWidth: 21, height: 21, padding: "0 5px", borderRadius: "50%",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.3px", whiteSpace: "nowrap",
              fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
              color: active ? "#f8fafc" : "#334155",
              background: active ? AXIS_ACTIVE : "rgba(255,255,255,0.94)",
              border: `1px solid ${active ? AXIS_ACTIVE : "rgba(71,85,105,0.45)"}`,
              boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
              cursor: "pointer", userSelect: "none",
            }}
          >
            {axis.name}
          </div>
          {/* ホバー中だけ出す×。この通り芯を削除する（寸法列の×と同じ流儀）。
              削除後は符号が自動採番で詰め直される（renumberAxes）。 */}
          {hover && (
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                useGridAxisStore.getState().removeAxis(axis.id);
              }}
              title={`通り芯 ${axis.name} を削除`}
              style={{
                position: "absolute", top: -7, right: -7,
                width: 14, height: 14, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 900,
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
  );
}

/** 平面図の通り芯1本（一点鎖線＋両端バッジ＋ドラッグ帯）。 */
function PlanAxis({ axis, half, y, active, autoSpan, badgeGapWorld }) {
  const axisRef = useRef(axis);
  axisRef.current = axis;

  const isX = axis.axis === "x";
  // 線の伸びる向き: X通り(縦線) は Z 方向 / Y通り(横線) は X 方向。
  // span 未設定なら建物幅に合わせた自動長さ（±half）。
  const dirAxis = isX ? "z" : "x";
  // 既定の長さ = 建物の外形＋寸法列を越える余白（記号が寸法の外に出るように）。
  const auto = autoSpan(axis.axis);
  const from = axis.span?.from ?? auto.from;
  const to = axis.span?.to ?? auto.to;
  const p1 = isX ? [axis.pos, y, from] : [from, y, axis.pos];
  const p2 = isX ? [axis.pos, y, to] : [to, y, axis.pos];
  const mid = (from + to) / 2;

  // 端部ドラッグ = 線の長さの伸縮（span をライブ更新 → 離したら保存）。
  const setEnd = (which) => (v) => {
    const cur = useGridAxisStore.getState().axes.find((a) => a.id === axisRef.current.id);
    if (!cur) return;
    const f = cur.span?.from ?? auto.from;
    const t = cur.span?.to ?? auto.to;
    const next = which === "from" ? { from: v, to: t } : { from: f, to: v };
    // 反転しないよう最低 500mm は残す
    if (Math.abs(next.to - next.from) < 500) return;
    useGridAxisStore.getState().updateAxisLocal(cur.id, { span: next });
  };
  const commitEnd = () => useGridAxisStore.getState().persistAxes();

  const col = active ? AXIS_ACTIVE : AXIS_COLOR;
  const hitW = half * 0.035;
  const badgeOut = badgeGapWorld;
  const b1 = isX ? [axis.pos, y, from - badgeOut] : [from - badgeOut, y, axis.pos];
  const b2 = isX ? [axis.pos, y, to + badgeOut] : [to + badgeOut, y, axis.pos];

  return (
    <group renderOrder={9994}>
      {/* 掴んで動かすための透明な帯（線に沿って細長く） */}
      <mesh
        position={isX ? [axis.pos, y, mid] : [mid, y, axis.pos]}
        rotation={[-Math.PI / 2, 0, isX ? Math.PI / 2 : 0]}
        userData={{ ignoreClipping: true }}
        // クリックは「選択」だけ。位置の変更は選択後に出るギズモで行う
        // （線を掴むとすぐ動いてしまい、意図せず通りがずれるため）。
        onPointerDown={(e) => {
          // 左クリックのみ（右/中ボタンでは選択しない）。
          if (e.button !== 0) return;
          // 作図中は通り芯を選ばず、奥の作図プレーンへイベントを通す。
          if (isDrawToolActive()) return;
          // Plan/Option（家具サイド）では通り芯は「見えるだけ」（編集は Base で）。
          if (!isBaseEditMode()) return;
          e.stopPropagation();
          selectAxis(axis.id);
        }}
        onClick={(e) => { if (!isDrawToolActive() && isBaseEditMode()) e.stopPropagation(); }} // 床/躯体の onClick（選択解除）へ届かせない
      >
        <planeGeometry args={[Math.abs(to - from), hitW]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* 一点鎖線（製図の基準線）。drei の dashed は等間隔なので、長短の交互は
          dashSize/gapSize の比で「一点鎖線らしい」見え方に寄せる。 */}
      <Line
        points={[p1, p2]} color={col} lineWidth={active ? 1.6 : 1.1}
        transparent opacity={active ? 0.95 : 0.65} depthTest={false}
        dashed dashSize={half * 0.05} gapSize={half * 0.012}
        userData={{ ignoreClipping: true }}
      />
      <AxisBadge axis={axis} active={active} position={b1} />
      <AxisBadge axis={axis} active={active} position={b2} />

      {/* 選択中: 端部ハンドルで線の長さを伸縮＋中央に移動ギズモ（断面線と同じ操作感）。 */}
      {active && (
        <>
          <LineEndHandle
            position={p1} dirAxis={dirAxis} planeY={y}
            onChange={setEnd("from")} onCommit={commitEnd}
            title={`通り芯 ${axis.name} の長さを調整`}
          />
          <LineEndHandle
            position={p2} dirAxis={dirAxis} planeY={y}
            onChange={setEnd("to")} onCommit={commitEnd}
            title={`通り芯 ${axis.name} の長さを調整`}
          />
          <group position={isX ? [axis.pos, y, mid] : [mid, y, axis.pos]}>
            <PivotControls
              autoTransform
              activeAxes={isX ? [true, false, false] : [false, false, true]}
              disableScaling
              disableRotations
              depthTest={false}
              fixed
              scale={90}
              lineWidth={3}
              onDragStart={() => {
                useGridAxisStore.getState().setSelectedId(axisRef.current.id);
                useViewportUiStore.getState().setGizmoDragging?.(true);
              }}
              onDrag={(_local, _deltaL, world) => {
                const p = new THREE.Vector3().setFromMatrixPosition(world);
                const v = snap(axisRef.current.axis === "x" ? p.x : p.z);
                useGridAxisStore.getState().updateAxisLocal(axisRef.current.id, { pos: v });
              }}
              onDragEnd={() => {
                useGridAxisStore.getState().persistAxes();
                useViewportUiStore.getState().setGizmoDragging?.(false);
              }}
            />
          </group>
        </>
      )}
    </group>
  );
}

/** 断面・立面での通り芯1本（縦の一点鎖線＋上端バッジ）。編集は平面で行う。 */
function SideAxis({ axis, active, hAxis, topY, botY }) {
  // hAxis="x": 画面横=world X → 線は (pos, y, 0) の縦線 / "z": (0, y, pos)
  const p = (yy) => (hAxis === "x" ? [axis.pos, yy, 0] : [0, yy, axis.pos]);
  const col = active ? AXIS_ACTIVE : AXIS_COLOR;
  const span = Math.abs(topY - botY);
  return (
    <group renderOrder={9994}>
      <Line
        points={[p(botY), p(topY)]} color={col} lineWidth={active ? 1.6 : 1.1}
        transparent opacity={active ? 0.95 : 0.6} depthTest={false}
        dashed dashSize={span * 0.06} gapSize={span * 0.015}
        userData={{ ignoreClipping: true }}
      />
      <AxisBadge axis={axis} active={active} position={p(topY + span * 0.03)} />
    </group>
  );
}

/**
 * mode="plan"  … 平面図(Top)。両方向の通り芯を編集可能で描く。
 * mode="side"  … 断面/立面。hAxis（画面横の world 軸）に一致する向きの通りだけ表示。
 */
export default function GridAxisOverlay({ mode = "plan", hAxis = null }) {
  const axes = useGridAxisStore((s) => s.axes);
  const selectedId = useGridAxisStore((s) => s.selectedId);
  const visible = useGridAxisStore((s) => s.visible);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders);
  const walls = useWallStore((s) => s.walls);

  const isMm = (sceneMaxY || 0) > 100;
  const w = (mm) => (isMm ? mm : mm / 1000);
  const half = Math.max((sceneExtentXZ || 0) * 0.8, isMm ? 2000 : 2);
  const badgeGapWorld = w(BADGE_GAP_MM);

  // 建物の外形（world XZ）。寸法列と同じ基準にして、通り芯がその外まで伸びるようにする。
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    let has = false;
    (baseColliders || []).forEach((o) => {
      if (!o) return;
      const b = new THREE.Box3();
      try { b.setFromObject(o); } catch { return; }
      if (b.isEmpty()) return;
      if (!has) { box.copy(b); has = true; } else box.union(b);
    });
    (walls || []).forEach((wl) => {
      [wl.start, wl.end].forEach((pt) => {
        const v = new THREE.Vector3(w(pt.x), 0, w(pt.z));
        if (!has) { box.setFromPoints([v]); has = true; } else box.expandByPoint(v);
      });
    });
    if (!has) return { minX: -half, maxX: half, minZ: -half, maxZ: half };
    return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
  }, [baseColliders, walls, half, isMm]);

  /** 通り芯の既定の長さ。建物外形＋寸法列を越える余白まで伸ばす（記号は寸法の外に出る）。 */
  const autoSpan = useMemo(() => {
    const ext = w(AXIS_EXTEND_MM);
    return (dir) => (dir === "x"
      // X通り（平面で縦線）は Z 方向に伸びる
      ? { from: bounds.minZ - ext, to: bounds.maxZ + ext }
      // Y通り（横線）は X 方向に伸びる
      : { from: bounds.minX - ext, to: bounds.maxX + ext });
  }, [bounds, isMm]);

  const shown = useMemo(() => {
    if (!visible) return [];
    if (mode === "plan") return axes;
    // 断面/立面では、画面横方向に位置を持つ通りだけが縦線として意味を持つ。
    return axes.filter((a) => a.axis === hAxis);
  }, [axes, visible, mode, hAxis]);

  if (!shown.length) return null;

  if (mode === "plan") {
    // 平面図の水平カット面のわずかに下（クリップで消えない高さ）に敷く。
    const y = (sectionClipHeight || (isMm ? 1500 : 1.5)) * 0.96;
    return (
      // isDrawnStructure: 躯体(BaseGlb)の「クリックで選択解除」から守る印。
      <group userData={{ ignoreClipping: true, isDrawnStructure: true }}>
        {shown.map((a) => (
          <PlanAxis
            key={a.id} axis={a} half={half} y={y} active={a.id === selectedId}
            autoSpan={autoSpan} badgeGapWorld={badgeGapWorld}
          />
        ))}
      </group>
    );
  }

  // 断面/立面: 建物の高さいっぱい＋寸法列を越える余白まで伸ばし、上端に符号を置く。
  const topY = Math.max(sceneMaxY || 0, w(3000)) + w(AXIS_EXTEND_MM);
  const botY = -w(1200);
  return (
    <group userData={{ ignoreClipping: true, isDrawnStructure: true }}>
      {shown.map((a) => (
        <SideAxis key={a.id} axis={a} active={a.id === selectedId} hAxis={hAxis} topY={topY} botY={botY} />
      ))}
    </group>
  );
}
