// SectionLinesPlanOverlay — 平面図(Top)に断面線（A-A' / B-B'…）を建築図面式で描く。
//   - 落ち着いたモノクロ基調: スレートの一点鎖線＋両端に細身の視線方向矢印＋
//     白地に細枠の円形「A」「A'」バッジ（選択時のみ濃地に反転）。装飾（グロー等）はしない。
//   - 線を左ドラッグで位置移動（50mm 刻み）。ラベルクリックで選択。回転/反転ボタンで向き変更。
//   - クリップ規約: x/z ≤ pos 側が残る → 断面ビューは −X/−Z 方向を見る＝矢印は −軸向き。
import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Html, Line, PivotControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useSectionLinesStore } from "../../store/useSectionLinesStore";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";

// 落ち着いたモノクロ基調（建築図面らしい無駄のないスタイル）。
//   非選択 = ミディアムスレート / 選択 = ほぼ黒。装飾（グロー等）は入れない。
const LINE_COLOR = "#475569";
const LINE_ACTIVE = "#0f172a";
const snap50 = (v, isMm) => (isMm ? Math.round(v / 50) * 50 : Math.round(v / 0.05) * 0.05);

function SectionLineItem({ line, half, y, isMm, active, arrowStyle }) {
  const { camera, gl } = useThree();
  const [dragging, setDragging] = useState(false);
  const lineRef = useRef(line);
  lineRef.current = line;

  // ── ギズモ（家具と同じ PivotControls）: 移動（垂直方向）＋ Y 回転で軸スワップ ──
  const [gizmoKey, setGizmoKey] = useState(0);
  const gizDraggingRef = useRef(false);
  const gizBaseRef = useRef(null);   // ドラッグ中に固定する group 位置（二重移動防止）
  const dragAxisRef = useRef(line.axis);
  const yawRef = useRef(0);

  // 断面の向き（axis）と反転（flip）を更新し、クリップ面も同期する共通処理。
  const applyOrientation = (nextAxis, nextFlip) => {
    const cur = lineRef.current;
    const axisChanged = nextAxis !== undefined && nextAxis !== cur.axis;
    const patch = {};
    if (axisChanged) { patch.axis = nextAxis; patch.pos = 0; }
    if (nextFlip !== undefined) patch.flip = nextFlip;
    if (Object.keys(patch).length === 0) return;
    const st = useSectionLinesStore.getState();
    st.setActiveLine(cur.id);
    st.updateLine(cur.id, patch);
    const em = useEditorModeStore.getState();
    const ax = patch.axis ?? cur.axis;
    em.setSectionClipXEnabled(ax === "x");
    em.setSectionClipZEnabled(ax === "z");
    if (axisChanged) { if (ax === "x") em.setSectionClipX(0); else em.setSectionClipZ(0); }
  };
  // 90°回転＝前後(z) ⇄ 左右(x) の軸スワップ。
  const rotate90 = () => applyOrientation(lineRef.current.axis === "x" ? "z" : "x", undefined);
  // 反転＝視線方向（矢印の向き）を反対に。
  const toggleFlip = () => applyOrientation(undefined, !lineRef.current.flip);

  // 幾何: axis="z" → 線は X 方向（z=pos）／ axis="x" → 線は Z 方向（x=pos）。矢印は −軸向き。
  const isZ = line.axis === "z";
  const p1 = isZ ? [-half, y, line.pos] : [line.pos, y, -half];
  const p2 = isZ ? [half, y, line.pos] : [line.pos, y, half];
  // 視線方向: 通常 −Z / −X、向き反転（flip）時は +Z / +X。矢印は線に直交して視線側を向く。
  const sgn = line.flip ? 1 : -1;
  const dir = isZ ? [0, 0, sgn] : [sgn, 0, 0];
  const side = isZ ? [1, 0, 0] : [0, 0, 1];
  const arrowLen = Math.max(half * 0.07, isMm ? 550 : 0.55);
  const headW = arrowLen * 0.3; // 細身の矢じり（主張しすぎない）
  // 矢印ジオメトリ（両端）。base=線端 → tip=視線方向へ arrowLen。
  //   スタイル別に stem / tri / wing を組み合わせて描く（arrowStyle は store のドキュメント設定）。
  //   labelPos = 線端から線方向の外側へ少し出した位置（ラベルを矢印の隣に置く）。
  const makeArrow = (base, outSign) => {
    const neck = [base[0] + dir[0] * (arrowLen * 0.42), y, base[2] + dir[2] * (arrowLen * 0.42)];
    const tip = [base[0] + dir[0] * arrowLen, y, base[2] + dir[2] * arrowLen];
    const cL = [neck[0] + side[0] * headW, y, neck[2] + side[2] * headW];
    const cR = [neck[0] - side[0] * headW, y, neck[2] - side[2] * headW];
    // 線方向の単位ベクトル（isZ: X 方向 / それ以外: Z 方向）× outSign（p1=-1 / p2=+1）
    const lineDir = isZ ? [1, 0, 0] : [0, 0, 1];
    const gap = arrowLen * 0.6;
    const labelPos = [
      base[0] + lineDir[0] * outSign * gap + dir[0] * (arrowLen * 0.5),
      y,
      base[2] + lineDir[2] * outSign * gap + dir[2] * (arrowLen * 0.5),
    ];
    return {
      base, neck, tip, cL, cR, labelPos,
      tri: new Float32Array([tip[0], y, tip[2], cL[0], y, cL[2], cR[0], y, cR[2]]),
    };
  };
  const a1 = useMemo(() => makeArrow(p1, -1), [line.pos, line.axis, line.flip, half, y, isMm]);
  const a2 = useMemo(() => makeArrow(p2, +1), [line.pos, line.axis, line.flip, half, y, isMm]);

  // ラベル: name "A-A'" → 両端に "A" / "A'"
  const [n1, n2] = useMemo(() => {
    const parts = String(line.name || "").split("-");
    return [parts[0] || line.name, parts[1] || `${parts[0] || ""}'`];
  }, [line.name]);

  // 左ドラッグで pos を移動（平面 y に投影 → 50mm 刻み）
  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      let v = lineRef.current.axis === "x" ? hit.x : hit.z;
      // 50mm 刻み（m スケールは 0.05）
      v = isMm ? Math.round(v / 50) * 50 : Math.round(v / 0.05) * 0.05;
      const st = useSectionLinesStore.getState();
      st.setActiveLine(lineRef.current.id);
      st.updateActive({ pos: v });
      // クリップ位置も同期（断面ビューへ切替えたとき即反映されるように）
      const em = useEditorModeStore.getState();
      if (lineRef.current.axis === "x") em.setSectionClipX(v); else em.setSectionClipZ(v);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, isMm, y]);

  // 選択で色を濃く・線をわずかに太く。装飾はしない。
  const col = active ? LINE_ACTIVE : LINE_COLOR;
  const width = active ? 2 : 1.3;
  const opacity = active ? 0.95 : 0.6;
  // ラベル = 建築図面の断面記号らしい、白地に細枠の小さなバッジ。選択時のみ反転（濃地に白字）。
  const labelStyle = {
    display: "flex", alignItems: "center", justifyContent: "center",
    minWidth: 20, height: 20, padding: "0 5px", borderRadius: "50%",
    fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", whiteSpace: "nowrap",
    fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    color: active ? "#f8fafc" : "#1e293b",
    background: active ? "#1e293b" : "rgba(255,255,255,0.92)",
    border: `1px solid ${active ? "#1e293b" : "rgba(30,41,59,0.4)"}`,
    boxShadow: "0 1px 3px rgba(15,23,42,0.2)",
    pointerEvents: "auto", cursor: "pointer", userSelect: "none",
  };

  // ドラッグ用の透明ヒット帯（線に沿って細長く）
  const hitW = half * 0.06;

  // 選択＝Properties に断面線の設定を出す（パネルも開く）。
  const selectLine = (e) => {
    e?.stopPropagation?.();
    useSectionLinesStore.getState().setActiveLine(lineRef.current.id);
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
  };

  // 矢印の描画（スタイル別）。lw = 線の太さ。
  const arrowEl = (a, i) => {
    const key = `${i}-${line.axis}-${line.flip}-${arrowStyle}`;
    const lw = active ? 2.2 : 1.6;
    if (arrowStyle === "chevron" || arrowStyle === "half") {
      // 山形（>）/ 片翼（製図の旗矢印）: 軸は根元から先端まで通す。
      return (
        <React.Fragment key={key}>
          <Line points={[a.base, a.tip]} color={col} lineWidth={lw} transparent opacity={opacity} depthTest={false} />
          <Line points={[a.tip, a.cL]} color={col} lineWidth={lw} transparent opacity={opacity} depthTest={false} />
          {arrowStyle === "chevron" && (
            <Line points={[a.tip, a.cR]} color={col} lineWidth={lw} transparent opacity={opacity} depthTest={false} />
          )}
        </React.Fragment>
      );
    }
    if (arrowStyle === "open") {
      // 白抜き三角: 軸＋アウトラインのみの矢じり。
      return (
        <React.Fragment key={key}>
          <Line points={[a.base, a.neck]} color={col} lineWidth={lw} transparent opacity={opacity} depthTest={false} />
          <Line points={[a.tip, a.cL, a.cR, a.tip]} color={col} lineWidth={lw} transparent opacity={opacity} depthTest={false} />
        </React.Fragment>
      );
    }
    // filled（既定）: 軸＋塗りつぶし三角。
    return (
      <React.Fragment key={key}>
        <Line points={[a.base, a.neck]} color={col} lineWidth={lw} transparent opacity={opacity} depthTest={false} />
        <mesh renderOrder={9998}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[a.tri, 3]} />
          </bufferGeometry>
          <meshBasicMaterial color={col} side={THREE.DoubleSide}
            transparent opacity={active ? 0.95 : 0.7} depthTest={false} depthWrite={false} />
        </mesh>
      </React.Fragment>
    );
  };

  return (
    <group renderOrder={9996}>
      {/* 中間の切断線＋ドラッグ帯は選択中のみ（非選択時は両端の記号だけ＝図面の作法） */}
      {active && (
        <mesh
          position={isZ ? [0, y, line.pos] : [line.pos, y, 0]}
          rotation={[-Math.PI / 2, 0, isZ ? 0 : Math.PI / 2]}
          onPointerDown={(e) => { e.stopPropagation(); setDragging(true); }}
          onClick={(e) => e.stopPropagation()} // 床の onClick（選択解除）へ届かせない
        >
          <planeGeometry args={[half * 2, hitW]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {active && (
        <Line points={[p1, p2]} color={col} lineWidth={width} transparent opacity={opacity}
          depthTest={false} dashed dashSize={half * 0.06} gapSize={half * 0.014} />
      )}

      {/* 両端の視線方向矢印（スタイルは Properties で選択）＋選択用の透明ヒット円 */}
      {[a1, a2].map((a, i) => (
        <React.Fragment key={`hit-${i}-${line.axis}-${line.flip}-${arrowStyle}`}>
          {arrowEl(a, i)}
          <mesh
            position={[(a.base[0] + a.tip[0]) / 2, y, (a.base[2] + a.tip[2]) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={selectLine}
            onClick={(e) => e.stopPropagation()} // 床の onClick（選択解除）へ届かせない
          >
            <circleGeometry args={[arrowLen * 0.8, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </React.Fragment>
      ))}
      {/* ラベル（矢印の隣＝線端の外側に配置。クリックで選択＋Properties 表示） */}
      <Html position={a1.labelPos} center zIndexRange={[17, 0]} style={{ pointerEvents: "none" }}>
        <div style={labelStyle} onClick={selectLine}>{n1}</div>
      </Html>
      <Html position={a2.labelPos} center zIndexRange={[17, 0]} style={{ pointerEvents: "none" }}>
        <div style={labelStyle} onClick={selectLine}>{n2}</div>
      </Html>

      {/* ── アクティブな断面線のギズモ（移動＝垂直方向 / Y回転で90°軸スワップ）── */}
      {active && (
        <group
          key={`giz-${line.id}-${line.axis}-${gizmoKey}`}
          position={gizDraggingRef.current && gizBaseRef.current
            ? gizBaseRef.current
            : (isZ ? [0, y, line.pos] : [line.pos, y, 0])}
        >
          <PivotControls
            autoTransform
            activeAxes={isZ ? [false, false, true] : [true, false, false]}
            disableScaling
            depthTest={false}
            fixed
            scale={90}
            lineWidth={3}
            onDragStart={() => {
              gizDraggingRef.current = true;
              dragAxisRef.current = lineRef.current.axis;
              gizBaseRef.current = lineRef.current.axis === "z"
                ? [0, y, lineRef.current.pos] : [lineRef.current.pos, y, 0];
              useSectionLinesStore.getState().setActiveLine(lineRef.current.id);
              useViewportUiStore.getState().setGizmoDragging?.(true);
            }}
            onDrag={(_local, _deltaL, world) => {
              const p = new THREE.Vector3().setFromMatrixPosition(world);
              const q = new THREE.Quaternion().setFromRotationMatrix(world);
              yawRef.current = new THREE.Euler().setFromQuaternion(q, "YXZ").y * (180 / Math.PI);
              const ax = dragAxisRef.current;
              const v = snap50(ax === "x" ? p.x : p.z, isMm);
              const st = useSectionLinesStore.getState();
              st.updateLine(lineRef.current.id, { pos: v });
              const em = useEditorModeStore.getState();
              if (ax === "x") em.setSectionClipX(v); else em.setSectionClipZ(v);
            }}
            onDragEnd={() => {
              gizDraggingRef.current = false;
              gizBaseRef.current = null;
              // Y回転のクォーターターンを (axis, flip) に反映する。
              //   90°/270° → 軸スワップ（前後 ⇄ 左右） / 180°/270° → 反転（flip）。
              const turns = ((Math.round((yawRef.current || 0) / 90) % 4) + 4) % 4;
              if (turns !== 0) {
                const swap = turns === 1 || turns === 3;
                const flip = turns === 2 || turns === 3;
                const nextAxis = swap ? (dragAxisRef.current === "x" ? "z" : "x") : undefined;
                const nextFlip = flip ? !lineRef.current.flip : undefined;
                applyOrientation(nextAxis, nextFlip);
              }
              yawRef.current = 0;
              setGizmoKey((k) => k + 1);
              useViewportUiStore.getState().setGizmoDragging?.(false);
            }}
          />
        </group>
      )}

      {/* ── アクティブ断面線の操作ボタン（回転・反転）。トップビューでは回転リングが
            扱いにくいため、確実に押せる HTML ボタンとしてギズモの上に出す。 ── */}
      {active && (
        <Html
          position={isZ ? [0, y, line.pos] : [line.pos, y, 0]}
          center
          zIndexRange={[18, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              display: "flex", transform: "translateY(-64px)", pointerEvents: "auto",
              borderRadius: 6, overflow: "hidden",
              background: "rgba(15,23,42,0.85)", backdropFilter: "blur(6px)",
              border: "1px solid rgba(148,163,184,0.28)",
              boxShadow: "0 2px 8px rgba(15,23,42,0.35)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              title="90°回転（前後 ⇄ 左右）"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); rotate90(); }}
              style={sectionCtrlBtnStyle}
            >
              回転
            </button>
            <span style={{ width: 1, background: "rgba(148,163,184,0.25)" }} />
            <button
              type="button"
              title="反転（見る向きを反対に）"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); toggleFlip(); }}
              style={sectionCtrlBtnStyle}
            >
              反転
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}

// 操作ボタン = セグメント型のモノクロピル（個々のボタンは装飾なし・区切り線のみ）。
const sectionCtrlBtnStyle = {
  padding: "4px 11px",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "1px",
  whiteSpace: "nowrap",
  color: "#e2e8f0",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  userSelect: "none",
};

export default function SectionLinesPlanOverlay() {
  const lines = useSectionLinesStore((s) => s.lines);
  const activeLineId = useSectionLinesStore((s) => s.activeLineId);
  const arrowStyle = useSectionLinesStore((s) => s.arrowStyle);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);

  if (!lines.length) return null;
  const isMm = (sceneMaxY || 0) > 100;
  const half = Math.max((sceneExtentXZ || 0) * 0.85, isMm ? 2000 : 2);
  // 平面図の水平カット面の少し下に描く（クリップで消えないように）
  const y = (sectionClipHeight || (isMm ? 1500 : 1.5)) * 0.98;

  return (
    <group>
      {lines.map((l) => (
        <SectionLineItem key={l.id} line={l} half={half} y={y} isMm={isMm} active={l.id === activeLineId} arrowStyle={arrowStyle} />
      ))}
    </group>
  );
}
