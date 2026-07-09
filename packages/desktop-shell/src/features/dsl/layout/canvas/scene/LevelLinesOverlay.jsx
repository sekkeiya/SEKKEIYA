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
const CH_COLOR = "#fb923c"; // CH(天井) = オレンジ
const SNAP_TOL_MM = 120;    // スナップ許容（mm）

// 縦方向の寸法（高さ差）を断面に表示。ダブルクリックで数値入力して値を編集できる。
//   y1,y2: ワールド Y（線の上下端）／ z: 表示する奥行き位置／ valueMm: 表示・編集する寸法(mm)
function Dimension({ y1, y2, z, tickHalf = 60, color, label, valueMm, onCommitMm, readOnly = false, faint = false }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const yMid = (y1 + y2) / 2;
  const pts = useMemo(() => [[0, y1, z], [0, y2, z]], [y1, y2, z]);
  const commit = () => {
    const v = Math.round(Number(text));
    if (isFinite(v) && v > 0) onCommitMm(v);
    setEditing(false);
  };
  return (
    <group renderOrder={9998}>
      <Line points={pts} color={color} lineWidth={1.6} transparent opacity={faint ? 0.45 : 0.9} depthTest={false} />
      <Line points={[[0, y1, z - tickHalf], [0, y1, z + tickHalf]]} color={color} lineWidth={1.4} transparent opacity={faint ? 0.45 : 1} depthTest={false} />
      <Line points={[[0, y2, z - tickHalf], [0, y2, z + tickHalf]]} color={color} lineWidth={1.4} transparent opacity={faint ? 0.45 : 1} depthTest={false} />
      <Html position={[0, yMid, z]} center zIndexRange={[19, 0]} style={{ pointerEvents: "none" }}>
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

function LevelLine({ y, half, color, label, draggable, faint = false, isMm, snapsMm, onCommitMm }) {
  const { camera, gl } = useThree();
  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const snapsRef = useRef(snapsMm);
  snapsRef.current = snapsMm;

  const pts = useMemo(
    () => [
      [-half, y, -half], [half, y, -half], [half, y, half], [-half, y, half], [-half, y, -half],
    ],
    [y, half]
  );

  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    // カメラの水平視線方向を法線にした鉛直面（原点通過）にレイを当てて world Y を得る。
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
      // スナップ（床/天井面・他レベル）
      let best = null, bestD = SNAP_TOL_MM;
      for (const s of snapsRef.current || []) {
        const d = Math.abs(mm - s);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best != null) { mm = best; setSnapped(true); } else setSnapped(false);
      onCommitMm(Math.round(mm));
    };
    const onUp = () => { setDragging(false); setSnapped(false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, isMm, onCommitMm]);

  const handleColor = snapped ? "#fff" : color;

  return (
    <group renderOrder={9997}>
      {/* 線（その高さの水平面）全体を左ドラッグで掴めるようにする透明な当たり面。
          高さ設定の側面/正面ビューはほぼ水平視線なので、線の高さ付近をクリックするとこの面に当たる。 */}
      {draggable && (
        <mesh
          position={[0, y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => { e.stopPropagation(); setDragging(true); }}
        >
          <planeGeometry args={[half * 2, half * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Line points={pts} color={handleColor} lineWidth={dragging ? 2.4 : 1.4} transparent opacity={faint ? 0.5 : 0.95} depthTest={false}
        dashed dashSize={half * 0.04} gapSize={half * 0.02} />
      <Html position={[-half, y, -half]} center={false} zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
        <div
          onPointerDown={draggable ? (e) => { e.stopPropagation(); e.preventDefault(); setDragging(true); } : undefined}
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
export default function LevelLinesOverlay({ overviewSuppressed = false }) {
  const active = useHeightSetupStore((s) => s.active);
  const overviewVisible = useLevelLinesStore((s) => s.overviewVisible);
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
    return Array.from(set);
  }, [labels, isMm, glMm, floors, base]);

  // 表示判定：
  //  - 高さ設定モード(active) → フル表示（ドラッグ編集可）
  //  - それ以外 → 俯瞰トグルON かつ suppress でないときのみ“表示専用”で重ねる
  if (!active && (!overviewVisible || overviewSuppressed)) return null;
  const displayOnly = !active; // active 以外は表示専用（ドラッグ不可・薄め）
  const half = Math.max((sceneExtentXZ || 0) * 1.25, isMm ? 2000 : 2);
  const tickHalf = half * 0.03;

  // ドラッグ中の自己スナップを避けるため、その線自身の値は候補から外す。
  const snapsExcept = (selfMm) => snapsMm.filter((v) => v !== selfMm);

  const dimZ = half * 0.9;

  return (
    <group>
      {/* GL（FL±0 基準の相対。ワールド = fl0Mm + glMm） */}
      <LevelLine
        y={toWorldY(glWorldMm)} half={half} color={GL_COLOR} label={`GL ${(glMm / 1000).toFixed(2)}m`}
        draggable={!displayOnly} faint={displayOnly} isMm={isMm} snapsMm={snapsExcept(glWorldMm)} onCommitMm={(mm) => setGlMm(mm - base)}
      />
      {/* 各階 FL。FL±0(1FL) はドラッグで「基準(datum)」を移動し GL/各FL が一緒に動く。
          2FL 以降のドラッグは階高を駆動。（表示専用時はドラッグ不可） */}
      {(floors || []).map((f, i) => (
        <LevelLine
          key={i} y={toWorldY(flWorldMm(i))} half={half} color={FL_COLOR}
          label={i === 0 ? "FL±0 (1FL)" : `${f.name} ${(f.flMm / 1000).toFixed(2)}m`}
          draggable={!displayOnly} faint={displayOnly} isMm={isMm} snapsMm={snapsExcept(flWorldMm(i))}
          onCommitMm={i === 0 ? (mm) => setFl0Mm(mm) : (mm) => setFloorFlMm(i, mm - base)}
        />
      ))}

      {/* 寸法: 階高（FL±0 → 上階の床）。ダブルクリックで階高を編集（全 FL が等間隔で追従）。
          表示専用時は編集不可（readOnly）で薄く表示。 */}
      <Dimension
        y1={toWorldY(base)} y2={toWorldY(base + floorHeightMm)} z={dimZ} tickHalf={tickHalf}
        color={CH_COLOR} label={displayOnly ? `階高 ${(floorHeightMm / 1000).toFixed(2)}m` : `階高 ${(floorHeightMm / 1000).toFixed(2)}m ✎`}
        valueMm={floorHeightMm} onCommitMm={setFloorHeightMm} readOnly={displayOnly} faint={displayOnly}
      />
    </group>
  );
}
