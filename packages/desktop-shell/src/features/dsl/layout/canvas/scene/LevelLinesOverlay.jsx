// LevelLinesOverlay — 高さ設定モード中、GL±0 と各階 FL の「水平レベル線」を建物まわりに描く。
// 横から見た側面ビューで床レベルを実ジオメトリと見比べて設定するための視覚ガイド。
//   - ラベルを左ドラッグで上下に動かして高さを変更（ライブ反映）。
//   - 床/天井面の高さ（および他のレベル）に近づくとスナップ。
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useHeightSetupStore } from "../../store/useHeightSetupStore";
import { useLevelLinesStore } from "../../store/useLevelLinesStore";
import { useBuildingSpecStore, floorHeightOf, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useStructureLabelStore } from "../../store/useStructureLabelStore";

const GL_COLOR = "#84cc16"; // GL = 黄緑
const FL_COLOR = "#38bdf8"; // FL = 水色
const CH_COLOR = "#fb923c"; // CH(階高寸法) = オレンジ
const CL_COLOR = "#c084fc"; // CL(天井レベル) = 紫
const SNAP_TOL_MM = 120;    // スナップ許容（mm）

// 図面（断面/立面）での寸法表記。展開図（ElevationDimensionsOverlay）と同じ体裁に揃える:
// スレートの細線＋端部ティック＋白地に mm 値。色分けピルは「高さ設定モード」用に残す。
const DRAFT_INK = "#475569";    // 寸法線
const DRAFT_TEXT = "#0f172a";   // 数値
const DRAFT_ACCENT = "#0369a1"; // 編集できることを示すアクセント（展開図と同じ）
// hovered: ホバー中は枠をアクセント色にして「ダブルクリックで編集できる」ことを示す。
const draftTagStyle = (strong, hovered) => ({
  fontSize: strong ? 11 : 10,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: hovered ? DRAFT_ACCENT : DRAFT_TEXT,
  background: hovered ? "rgba(255,255,255,0.99)" : "rgba(255,255,255,0.92)",
  border: `1px solid ${hovered ? "rgba(3,105,161,0.75)" : "rgba(30,41,59,0.35)"}`,
  boxShadow: hovered ? "0 0 0 2px rgba(3,105,161,0.15)" : "none",
  borderRadius: 3,
  padding: "0px 4px",
  whiteSpace: "nowrap",
  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
  transition: "border-color 0.12s, color 0.12s, box-shadow 0.12s",
});
const SNAP_GREEN = "#16a34a";   // 端部ドラッグでレベルへ吸着中の色（展開図と同じ）
// 図面表記の数値入力（展開図の inputStyle と同じ白地）。
const draftInputStyle = {
  width: 64, fontSize: 11, fontWeight: 700, textAlign: "center",
  borderRadius: 3, border: `1px solid ${DRAFT_ACCENT}`,
  background: "rgba(255,255,255,0.98)", color: DRAFT_TEXT,
  outline: "none", pointerEvents: "auto",
};

// 縦（world Y）方向の左ドラッグを world mm に変換し、レベル候補へスナップ／50mm 丸めして
// onCommitMm(mm) へ渡す共通フック。LevelLine と CL 寸法の上下端で共有する。
function useVerticalDrag({ isMm, snapsMm, onCommitMm }) {
  const { camera, gl } = useThree();
  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const snapsRef = useRef(snapsMm);
  snapsRef.current = snapsMm;
  const commitRef = useRef(onCommitMm);
  commitRef.current = onCommitMm;

  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() < 0.01) { setDragging(false); return; }
    camDir.normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(0, 0, 0));
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      let mm = isMm ? hit.y : hit.y * 1000;
      let best = null, bestD = SNAP_TOL_MM;
      for (const s of snapsRef.current || []) { const d = Math.abs(mm - s); if (d < bestD) { bestD = d; best = s; } }
      if (best != null) { mm = best; setSnapped(true); }
      else { mm = Math.round(mm / 50) * 50; setSnapped(false); }
      commitRef.current?.(Math.round(mm));
    };
    const onUp = () => { setDragging(false); setSnapped(false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, isMm]);

  return { dragging, snapped, startDrag: () => setDragging(true) };
}

// 図面表記（断面/立面）の寸法端部ハンドル。普段は透明で、ホバーすると●が現れる
// （展開図の MarkHandle と同じ流儀）。左ドラッグで上端=天井 / 下端=床のレベルを調整。
// R3F の Html なので DOM でヒットを取る＝図面を丸マークで汚さない。
function DraftEndHandle({ position, drag, title }) {
  const [hover, setHover] = useState(false);
  const visible = hover || drag.dragging;
  return (
    <Html position={position} center zIndexRange={[19, 0]}>
      <div
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); drag.startDrag(); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={title}
        style={{
          width: 14, height: 14, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "ns-resize", pointerEvents: "auto", background: "transparent",
          touchAction: "none",
        }}
      >
        <div
          style={{
            width: visible ? 11 : 0, height: visible ? 11 : 0, borderRadius: "50%",
            background: drag.snapped ? SNAP_GREEN : drag.dragging ? DRAFT_ACCENT : "rgba(255,255,255,0.95)",
            border: visible ? `1.5px solid ${drag.snapped ? SNAP_GREEN : DRAFT_ACCENT}` : "none",
            boxShadow: visible ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
            transition: "width 80ms, height 80ms",
          }}
        />
      </div>
    </Html>
  );
}

// 縦方向の寸法（高さ差）を断面に表示。ダブルクリックで数値入力して値を編集できる。
//   y1,y2: ワールド Y（線の上下端）／ z: 表示する奥行き位置／ valueMm: 表示・編集する寸法(mm)
// hAxis: 画面横方向に対応する world 軸（"x" or "z"）。pos: その軸上の固定位置（画面左端）。
function Dimension({ y1, y2, hAxis = "z", pos = 0, tickHalf = 60, color, label, valueMm, onCommitMm, readOnly = false, faint = false,
  draggableEnds = false, isMm = false, snapsMm = [], onDragTopMm, onDragBottomMm,
  // drafting: 図面（断面/立面）向けの表記。展開図と同じスレート線＋白地の mm 値にする。
  //   title は数値だけでは何の寸法か分からないため、ツールチップで補う（階高 / CL など）。
  drafting = false, title = "", strong = false }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [hovered, setHovered] = useState(false);
  const yMid = (y1 + y2) / 2;
  // 縦の寸法線とティックを、画面横方向(hAxis)に応じた world 位置に置く。
  const P = (yy) => (hAxis === "x" ? [pos, yy, 0] : [0, yy, pos]);
  const T = (yy) => (hAxis === "x"
    ? [[pos - tickHalf, yy, 0], [pos + tickHalf, yy, 0]]
    : [[0, yy, pos - tickHalf], [0, yy, pos + tickHalf]]);
  const pts = useMemo(() => [P(y1), P(y2)], [y1, y2, hAxis, pos]);
  const commit = () => {
    const v = Math.round(Number(text));
    if (isFinite(v) && v > 0) onCommitMm(v);
    setEditing(false);
  };
  // 上端(天井 y2)・下端(床 y1)の左ドラッグ（スナップ付き）。
  const topDrag = useVerticalDrag({ isMm, snapsMm, onCommitMm: onDragTopMm || (() => {}) });
  const botDrag = useVerticalDrag({ isMm, snapsMm, onCommitMm: onDragBottomMm || (() => {}) });
  // 図面表記では線・ティックをスレートに統一（色分けピルは高さ設定モード用）。
  const lineColor = drafting ? DRAFT_INK : color;
  const topColor = topDrag.snapped ? "#fff" : (drafting ? DRAFT_INK : color);
  const botColor = botDrag.snapped ? "#fff" : (drafting ? DRAFT_INK : color);
  return (
    <group renderOrder={9998}>
      {/* 図面注記なので断面/展開のクリップ対象外（userData.ignoreClipping） */}
      <Line points={pts} color={lineColor} lineWidth={drafting ? 1.4 : 1.6} transparent opacity={faint ? 0.45 : (drafting ? 0.95 : 0.9)} depthTest={false} userData={{ ignoreClipping: true }} />
      <Line points={T(y1)} color={botColor} lineWidth={1.4} transparent opacity={faint ? 0.45 : 1} depthTest={false} userData={{ ignoreClipping: true }} />
      <Line points={T(y2)} color={topColor} lineWidth={1.4} transparent opacity={faint ? 0.45 : 1} depthTest={false} userData={{ ignoreClipping: true }} />
      {/* 図面表記（断面/立面）の端部: 普段は透明・ホバーで●が出る DOM ハンドル。
          左ドラッグで上端=天井 / 下端=床のレベルを調整（他レベルへスナップ）。 */}
      {draggableEnds && !readOnly && drafting && (
        <>
          <DraftEndHandle position={P(y2)} drag={topDrag} title={`${title}の上端をドラッグで調整（レベルにスナップ）`} />
          <DraftEndHandle position={P(y1)} drag={botDrag} title={`${title}の下端をドラッグで調整（レベルにスナップ）`} />
        </>
      )}
      {/* 高さ設定モードの端部ハンドル（上=天井 / 下=床）。伸ばして他レベルにスナップできる。
          図面表記では丸が図を汚すので上の DOM ハンドルを使う。 */}
      {draggableEnds && !readOnly && !drafting && (
        <>
          <mesh position={P(y2)} userData={{ ignoreClipping: true }} onPointerDown={(e) => { e.stopPropagation(); topDrag.startDrag(); }}>
            <sphereGeometry args={[tickHalf * 1.1, 10, 10]} />
            <meshBasicMaterial color={topColor} transparent opacity={0.9} depthTest={false} />
          </mesh>
          <mesh position={P(y1)} userData={{ ignoreClipping: true }} onPointerDown={(e) => { e.stopPropagation(); botDrag.startDrag(); }}>
            <sphereGeometry args={[tickHalf * 1.1, 10, 10]} />
            <meshBasicMaterial color={botColor} transparent opacity={0.9} depthTest={false} />
          </mesh>
        </>
      )}
      <Html position={P(yMid)} center zIndexRange={[19, 0]} style={{ pointerEvents: "none" }}>
        {editing ? (
          <input
            autoFocus type="number" defaultValue={Math.round(valueMm)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            onPointerDown={(e) => e.stopPropagation()}
            // 図面表記（断面/立面）は展開図と同じ白地の入力欄。高さ設定モードは従来の暗色。
            style={drafting ? draftInputStyle : { width: 64, fontSize: 12, fontWeight: 800, textAlign: "center", borderRadius: 4,
              border: `2px solid ${color}`, background: "#0b1020", color: "#fff", pointerEvents: "auto", outline: "none" }}
          />
        ) : drafting ? (
          // 図面表記: 展開図と同じ「白地に mm 値」。ホバーで枠がアクセント色になり編集できると分かる。
          // 何の寸法かはツールチップで補う。
          <div
            onMouseEnter={readOnly ? undefined : () => setHovered(true)}
            onMouseLeave={readOnly ? undefined : () => setHovered(false)}
            onDoubleClick={readOnly ? undefined : (e) => { e.stopPropagation(); setText(String(Math.round(valueMm))); setEditing(true); }}
            title={readOnly ? title : `${title}（ダブルクリックで数値入力）`}
            style={{
              ...draftTagStyle(strong, hovered && !readOnly),
              opacity: faint ? 0.88 : 1,
              pointerEvents: readOnly ? "none" : "auto",
              cursor: readOnly ? "default" : "text",
              userSelect: "none",
            }}
          >
            {Math.round(valueMm)}
          </div>
        ) : (
          <div
            onDoubleClick={readOnly ? undefined : (e) => { e.stopPropagation(); setText(String(Math.round(valueMm))); setEditing(true); }}
            title={readOnly ? label : "ダブルクリックで数値入力"}
            style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap",
              color: "#0b1020", background: color, boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              opacity: faint ? 0.88 : 1,
              pointerEvents: readOnly ? "none" : "auto", cursor: readOnly ? "default" : "text", userSelect: "none" }}
          >
            {label}
          </div>
        )}
      </Html>
    </group>
  );
}

function LevelLine({ y, half, color, label, draggable, faint = false, isMm, snapsMm, onCommitMm, sectionAxis = null, sectionFlip = false }) {
  const { dragging, snapped, startDrag } = useVerticalDrag({ isMm, snapsMm, onCommitMm });

  const pts = useMemo(
    () => [
      [-half, y, -half], [half, y, -half], [half, y, half], [-half, y, half], [-half, y, -half],
    ],
    [y, half]
  );

  const handleColor = snapped ? "#fff" : color;

  return (
    <group renderOrder={9997}>
      {/* 線（その高さの水平面）全体を左ドラッグで掴めるようにする透明な当たり面。
          高さ設定の側面/正面ビューはほぼ水平視線なので、線の高さ付近をクリックするとこの面に当たる。 */}
      {draggable && (
        <mesh
          position={[0, y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => { e.stopPropagation(); startDrag(); }}
        >
          <planeGeometry args={[half * 2, half * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Line points={pts} color={handleColor} lineWidth={dragging ? 2.4 : 1.4} transparent opacity={faint ? 0.5 : 0.95} depthTest={false}
        dashed dashSize={half * 0.04} gapSize={half * 0.02} userData={{ ignoreClipping: true }} />
      {/* ラベルは画面左端に固定。断面の軸と向き(flip)で「画面左」の world 位置が変わる:
          前(z軸切り): 左=−X（flip時 +X）／ 横(x軸切り): 左=+Z（flip時 −Z）。 */}
      <Html
        position={
          sectionAxis === "x" ? [0, y, sectionFlip ? -half : half]
          : sectionAxis === "z" ? [sectionFlip ? half : -half, y, 0]
          : [-half, y, -half]
        }
        center={false} zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
        <div
          onPointerDown={draggable ? (e) => { e.stopPropagation(); e.preventDefault(); startDrag(); } : undefined}
          style={{
            padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap",
            color: "#0b1020", background: handleColor, boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            transform: "translate(-100%, -50%)",
            opacity: faint ? 0.85 : 1,
            pointerEvents: draggable ? "auto" : "none",
            cursor: draggable ? "ns-resize" : "default",
            userSelect: "none", touchAction: "none",
            outline: snapped ? "2px solid #fff" : "none",
          }}
        >
          {draggable ? "⇅ " : ""}{label}
        </div>
      </Html>
    </group>
  );
}

// overviewSuppressed: 俯瞰の“表示専用”レベル線を出してはいけないビュー/モード
//   （ウォークスルー・マテリアル・マップ・Top など）で true を渡す。
//   高さ設定モード(active)中は常にフル表示（ドラッグ編集可）なので suppress は無視する。
// sectionEditable: 断面図/立面図（FRONT/RIGHT の正射ビュー）では GL/各階FL を
//   常時表示し、ドラッグで高さを設定できるようにする（俯瞰トグルの ON/OFF に依らない）。
// elevationMode: 展開図ビュー。CL（天井高）だけを表示し、GL / 各FL / 階高は出さない
//   （展開図は室内の姿図なので地盤・階高の注記は不要）。
export default function LevelLinesOverlay({ overviewSuppressed = false, sectionEditable = false, sectionAxis = null, sectionFlip = false, elevationMode = false }) {
  const active = useHeightSetupStore((s) => s.active);
  const overviewVisible = useLevelLinesStore((s) => s.overviewVisible);
  // CL / 階高 の寸法線の矢印（端部）サイズ倍率（Properties の「寸法の矢印サイズ」で調整）。
  const dimArrowScale = useLevelLinesStore((s) => s.dimArrowScale);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const glMm = useBuildingSpecStore((s) => s.glMm);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const floors = useBuildingSpecStore((s) => s.floors);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const setGlMm = useBuildingSpecStore((s) => s.setGlMm);
  const setFl0Mm = useBuildingSpecStore((s) => s.setFl0Mm);
  const setFloorFlMm = useBuildingSpecStore((s) => s.setFloorFlMm);
  const setFloorHeightMm = useBuildingSpecStore((s) => s.setFloorHeightMm);
  const setFloorHeightAt = useBuildingSpecStore((s) => s.setFloorHeightAt);
  const setCeilingHeightAt = useBuildingSpecStore((s) => s.setCeilingHeightAt);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const setCeilingHeightMm = useBuildingSpecStore((s) => s.setCeilingHeightMm);
  const labels = useStructureLabelStore((s) => s.labels);

  // buildingSpec は mm 保管。world がメートルスケールなら mm→m に変換して配置する。
  const isMm = (sceneMaxY || 0) > 100;
  const toWorldY = (mm) => (isMm ? mm : mm / 1000);
  // glMm / floors.flMm は FL±0 からの相対。ワールド mm は fl0Mm を足す。
  const base = fl0Mm || 0;
  const glWorldMm = base + glMm;
  const flWorldMm = (i) => base + (floors?.[i]?.flMm ?? 0);

  // スナップ候補（ワールド mm）: 床/天井面の中心Y ＋ 既存レベル（GL/各FL のワールド値）。
  const snapsMm = useMemo(() => {
    const set = new Set();
    Object.values(labels || {}).forEach((l) => {
      if (!l?.surface?.center) return;
      if (["floor", "outer_floor", "ceiling"].includes(l.semantic)) {
        const cy = l.surface.center[1];
        set.add(Math.round(isMm ? cy : cy * 1000));
      }
    });
    set.add(base + glMm);
    (floors || []).forEach((f) => set.add(base + f.flMm));
    // 各階の CL（天井レベル）にもスナップできるようにする（FL↔CL の合わせ込み用）。
    //   CL は階ごとに違ってよいので、その階の値を使う。
    const bs = useBuildingSpecStore.getState();
    (floors || []).forEach((f, i) => set.add(base + f.flMm + ceilingHeightOf(bs, i)));
    return Array.from(set);
  }, [labels, isMm, glMm, floors, base, ceilingHeightMm]);

  // 表示判定：
  //  - 高さ設定モード(active) → フル表示（ドラッグ編集可）
  //  - それ以外 → 俯瞰トグルON かつ suppress でないときのみ“表示専用”で重ねる
  // 断面/立面ビューは、俯瞰トグルや高さ設定モードに関わらず GL/FL を出す。
  if (!active && !sectionEditable && (!overviewVisible || overviewSuppressed)) return null;
  // 高さ設定モード(active) か 断面/立面ビュー のときはドラッグ編集可。
  const displayOnly = !active && !sectionEditable;
  const half = Math.max((sceneExtentXZ || 0) * 1.25, isMm ? 2000 : 2);
  // 寸法線の端部（矢印）サイズ。1.0 = 従来（シーン幅 × 0.03）。CL / 階高 の Dimension のみが使う。
  const tickHalf = half * 0.03 * (dimArrowScale || 1);

  // ドラッグ中の自己スナップを避けるため、その線自身の値は候補から外す。
  const snapsExcept = (selfMm) => snapsMm.filter((v) => v !== selfMm);

  const dimZ = half * 0.9;
  // 断面ビューでは、アングル(前=Z切り/横=X切り)に依らずラベル・寸法を画面左端に固定する。
  //   断面前(FRONT, sectionAxis="z"): 画面横=world X → 寸法は X 軸方向・左端(-)
  //   断面横(RIGHT, sectionAxis="x"): 画面横=world Z → 寸法は Z 軸方向・左端(+, 従来 dimZ)
  const dimHAxis = sectionAxis === "z" ? "x" : "z";
  // 画面左の world 符号: 前(z切り)=−X（flip時+X）／ 横(x切り)=+Z（flip時−Z）
  const leftSign = sectionAxis === "z" ? (sectionFlip ? 1 : -1) : (sectionFlip ? -1 : 1);
  const dimPos = sectionAxis ? leftSign * half * 0.9 : dimZ;
  // 断面図の2列チェーン:
  //   内側 = 室内の高さ（CL）
  //   外側 = 地盤・階レベル（GL→FL±0 → 階高）。GL→FL と 階高 は FL±0 を境に縦に連なり、
  //          地盤から上階の床までの通し寸法になる（断面図の作法）。
  // 高さ設定モードは従来の配置（CL を建物寄り・階高を外側）のまま。
  const posSeg = sectionEditable ? dimPos : dimPos * 0.72;
  const posTot = sectionEditable ? dimPos + leftSign * toWorldY(420) : dimPos;

  return (
    <group>
      {/* GL（FL±0 基準の相対。ワールド = fl0Mm + glMm）。展開図では非表示。 */}
      {!elevationMode && (
        <LevelLine
          y={toWorldY(glWorldMm)} half={half} color={GL_COLOR} label={`GL ${(glMm / 1000).toFixed(2)}m`}
          draggable={!displayOnly} faint={displayOnly} isMm={isMm} snapsMm={snapsExcept(glWorldMm)} onCommitMm={(mm) => setGlMm(mm - base)}
          sectionAxis={sectionAxis} sectionFlip={sectionFlip}
        />
      )}
      {/* 各階 FL。FL±0(1FL) はドラッグで「基準(datum)」を移動し GL/各FL が一緒に動く。
          2FL 以降のドラッグは階高を駆動。（表示専用時はドラッグ不可）。展開図では非表示。 */}
      {!elevationMode && (floors || []).map((f, i) => (
        <LevelLine
          key={i} y={toWorldY(flWorldMm(i))} half={half} color={FL_COLOR}
          label={i === 0 ? "FL±0 (1FL)" : `${f.name} ${(f.flMm / 1000).toFixed(2)}m`}
          draggable={!displayOnly} faint={displayOnly} isMm={isMm} snapsMm={snapsExcept(flWorldMm(i))}
          onCommitMm={i === 0
            // 1FL(=FL±0=datum) を動かしても GL のワールド位置は固定する（GL は地盤なので連動させない）。
            //   GL_world = fl0 + gl を保つよう、fl0 変更後に gl を逆補正する。
            ? (mm) => {
                const bs = useBuildingSpecStore.getState();
                const glWorld = (bs.fl0Mm || 0) + bs.glMm;
                bs.setFl0Mm(mm);
                bs.setGlMm(glWorld - mm);
              }
            : (mm) => setFloorFlMm(i, mm - base)}
          sectionAxis={sectionAxis} sectionFlip={sectionFlip}
        />
      ))}

      {/* CL（天井高）= 階高と同じ寸法線 UI（開始点=床 FL / 終点=天井 FL+CL の 2 点間）。
          断面/立面の編集ビュー（または高さ設定モード）でのみ表示。ダブルクリックで数値編集（全階共通）。 */}
      {(sectionEditable || active) && (floors || []).map((f, i) => {
        // CL は階ごとの値。ある階の CL を触っても他の階の CL は変わらない。
        const clI = ceilingHeightOf(useBuildingSpecStore.getState(), i);
        return (
        <Dimension
          key={`cl-${i}`}
          y1={toWorldY(flWorldMm(i))} y2={toWorldY(flWorldMm(i) + clI)}
          hAxis={dimHAxis} pos={posSeg} tickHalf={tickHalf}
          color={CL_COLOR}
          drafting={sectionEditable} title={`天井高（CL）${f.name || `${i + 1}FL`}`}
          label={displayOnly ? `CL ${(clI / 1000).toFixed(2)}m` : `CL ${(clI / 1000).toFixed(2)}m ✎`}
          valueMm={clI} onCommitMm={(v) => setCeilingHeightAt(i, v)} readOnly={displayOnly} faint={displayOnly}
          draggableEnds={!displayOnly} isMm={isMm} snapsMm={snapsExcept(flWorldMm(i) + clI)}
          // 上端(天井)ドラッグ → その階の天井高 = worldY - その階の床。
          onDragTopMm={(mm) => setCeilingHeightAt(i, mm - flWorldMm(i))}
          // 下端(床)ドラッグ → その階の FL を移動（1F は datum、GL は据え置き）。
          onDragBottomMm={i === 0
            ? (mm) => { const bs = useBuildingSpecStore.getState(); const glWorld = (bs.fl0Mm || 0) + bs.glMm; bs.setFl0Mm(mm); bs.setGlMm(glWorld - mm); }
            : (mm) => setFloorFlMm(i, mm - base)}
        />
        );
      })}

      {/* 寸法: GL → FL±0（地盤面から 1FL までの立上り）。階高と同じ外側列に置き、
          GL→FL±0→階高 が下から連なる通し寸法になる（断面図の作法）。展開図では非表示。
          ダブルクリックで GL の深さを編集（FL±0 基準の下がり量 mm）。 */}
      {!elevationMode && (sectionEditable || active) && Math.abs(glMm) >= 1 && (
        <Dimension
          y1={toWorldY(glWorldMm)} y2={toWorldY(base)}
          hAxis={dimHAxis} pos={posTot} tickHalf={tickHalf}
          color={GL_COLOR}
          drafting={sectionEditable} title="GL〜FL±0"
          label={displayOnly ? `GL→FL ${(-glMm / 1000).toFixed(2)}m` : `GL→FL ${(-glMm / 1000).toFixed(2)}m ✎`}
          valueMm={-glMm}
          onCommitMm={(v) => setGlMm(-Math.abs(v))}
          readOnly={displayOnly} faint={displayOnly}
          draggableEnds={!displayOnly} isMm={isMm} snapsMm={snapsExcept(glWorldMm)}
          // 上端(FL±0)ドラッグ = 基準(datum)移動。GL のワールド位置は据え置き（＝この寸法が伸縮する）。
          onDragTopMm={(mm) => {
            const bs = useBuildingSpecStore.getState();
            const glWorld = (bs.fl0Mm || 0) + bs.glMm;
            bs.setFl0Mm(mm);
            bs.setGlMm(glWorld - mm);
          }}
          // 下端(GL)ドラッグ = 地盤面の高さ。
          onDragBottomMm={(mm) => setGlMm(mm - base)}
        />
      )}

      {/* 寸法: 階高（FL±0 → 上階の床）。ダブルクリックで階高を編集（全 FL が等間隔で追従）。
          表示専用時は編集不可（readOnly）で薄く表示。展開図では非表示。 */}
      {!elevationMode && (floors || []).map((f, i) => {
        // 階高も階ごとの値。その階の FL → 次の階の FL までを1本の寸法にする。
        const hI = floorHeightOf(useBuildingSpecStore.getState(), i);
        const y0 = flWorldMm(i);
        return (
          <Dimension
            key={`fh-${i}`}
            y1={toWorldY(y0)} y2={toWorldY(y0 + hI)} hAxis={dimHAxis} pos={posTot} tickHalf={tickHalf}
            color={CH_COLOR}
            drafting={sectionEditable} title={`階高 ${f.name || `${i + 1}FL`}`} strong
            label={displayOnly ? `階高 ${(hI / 1000).toFixed(2)}m` : `階高 ${(hI / 1000).toFixed(2)}m ✎`}
            valueMm={hI} onCommitMm={(v) => setFloorHeightAt(i, v)} readOnly={displayOnly} faint={displayOnly}
            draggableEnds={!displayOnly} isMm={isMm} snapsMm={snapsExcept(y0 + hI)}
            // 上端(上階の床)ドラッグ → その階だけの階高（上の階は積み上がりで追従）。
            onDragTopMm={(mm) => { const v = mm - y0; if (v >= 1800) setFloorHeightAt(i, v); }}
            // 下端: 1F は基準(datum)移動（GL のワールド位置は据え置き）／2F 以降は下階の階高。
            onDragBottomMm={i === 0
              ? (mm) => {
                  const bs = useBuildingSpecStore.getState();
                  const glWorld = (bs.fl0Mm || 0) + bs.glMm;
                  bs.setFl0Mm(mm);
                  bs.setGlMm(glWorld - mm);
                }
              : (mm) => setFloorFlMm(i, mm - base)}
          />
        );
      })}
    </group>
  );
}
