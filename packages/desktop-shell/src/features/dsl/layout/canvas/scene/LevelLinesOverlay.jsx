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
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useStructureLabelStore } from "../../store/useStructureLabelStore";

const GL_COLOR = "#84cc16"; // GL = 黄緑
const FL_COLOR = "#38bdf8"; // FL = 水色
const CH_COLOR = "#fb923c"; // CH(階高寸法) = オレンジ
const CL_COLOR = "#c084fc"; // CL(天井レベル) = 紫
const SNAP_TOL_MM = 120;    // スナップ許容（mm）

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

// 縦方向の寸法（高さ差）を断面に表示。ダブルクリックで数値入力して値を編集できる。
//   y1,y2: ワールド Y（線の上下端）／ z: 表示する奥行き位置／ valueMm: 表示・編集する寸法(mm)
// hAxis: 画面横方向に対応する world 軸（"x" or "z"）。pos: その軸上の固定位置（画面左端）。
function Dimension({ y1, y2, hAxis = "z", pos = 0, tickHalf = 60, color, label, valueMm, onCommitMm, readOnly = false, faint = false,
  draggableEnds = false, isMm = false, snapsMm = [], onDragTopMm, onDragBottomMm }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
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
  const topColor = topDrag.snapped ? "#fff" : color;
  const botColor = botDrag.snapped ? "#fff" : color;
  return (
    <group renderOrder={9998}>
      {/* 図面注記なので断面/展開のクリップ対象外（userData.ignoreClipping） */}
      <Line points={pts} color={color} lineWidth={1.6} transparent opacity={faint ? 0.45 : 0.9} depthTest={false} userData={{ ignoreClipping: true }} />
      <Line points={T(y1)} color={botColor} lineWidth={1.4} transparent opacity={faint ? 0.45 : 1} depthTest={false} userData={{ ignoreClipping: true }} />
      <Line points={T(y2)} color={topColor} lineWidth={1.4} transparent opacity={faint ? 0.45 : 1} depthTest={false} userData={{ ignoreClipping: true }} />
      {/* 端点の左ドラッグハンドル（上=天井 / 下=床）。伸ばして他レベルにスナップできる。 */}
      {draggableEnds && !readOnly && (
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
            style={{ width: 64, fontSize: 12, fontWeight: 800, textAlign: "center", borderRadius: 4,
              border: `2px solid ${color}`, background: "#0b1020", color: "#fff", pointerEvents: "auto", outline: "none" }}
          />
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
    (floors || []).forEach((f) => set.add(base + f.flMm + ceilingHeightMm));
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
      {(sectionEditable || active) && (floors || []).map((f, i) => (
        <Dimension
          key={`cl-${i}`}
          y1={toWorldY(flWorldMm(i))} y2={toWorldY(flWorldMm(i) + ceilingHeightMm)}
          hAxis={dimHAxis} pos={dimPos * 0.72} tickHalf={tickHalf}
          color={CL_COLOR}
          label={displayOnly ? `CL ${(ceilingHeightMm / 1000).toFixed(2)}m` : `CL ${(ceilingHeightMm / 1000).toFixed(2)}m ✎`}
          valueMm={ceilingHeightMm} onCommitMm={setCeilingHeightMm} readOnly={displayOnly} faint={displayOnly}
          draggableEnds={!displayOnly} isMm={isMm} snapsMm={snapsExcept(flWorldMm(i) + ceilingHeightMm)}
          // 上端(天井)ドラッグ → 天井高 = worldY - その階の床。
          onDragTopMm={(mm) => setCeilingHeightMm(mm - flWorldMm(i))}
          // 下端(床)ドラッグ → その階の FL を移動（1F は datum、GL は据え置き）。
          onDragBottomMm={i === 0
            ? (mm) => { const bs = useBuildingSpecStore.getState(); const glWorld = (bs.fl0Mm || 0) + bs.glMm; bs.setFl0Mm(mm); bs.setGlMm(glWorld - mm); }
            : (mm) => setFloorFlMm(i, mm - base)}
        />
      ))}

      {/* 寸法: 階高（FL±0 → 上階の床）。ダブルクリックで階高を編集（全 FL が等間隔で追従）。
          表示専用時は編集不可（readOnly）で薄く表示。展開図では非表示。 */}
      {!elevationMode && (
        <Dimension
          y1={toWorldY(base)} y2={toWorldY(base + floorHeightMm)} hAxis={dimHAxis} pos={dimPos} tickHalf={tickHalf}
          color={CH_COLOR} label={displayOnly ? `階高 ${(floorHeightMm / 1000).toFixed(2)}m` : `階高 ${(floorHeightMm / 1000).toFixed(2)}m ✎`}
          valueMm={floorHeightMm} onCommitMm={setFloorHeightMm} readOnly={displayOnly} faint={displayOnly}
        />
      )}
    </group>
  );
}
