// StructureTagOverlay — 面ラベルツール中、確定ラベル面と一時選択面をハイライト＋面上にラベル表示。
//   - 一時選択（未確定）: 黄色の枠＋塗り（はっきり見えるよう高めの不透明度）
//   - 確定ラベル: コリジョンON=青 / コリジョンOFF=緑。面上に「床/内壁/外壁/天井」チップを表示。

import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import {
  useStructureLabelStore,
  STRUCTURE_LABEL_JP,
} from "../../../store/useStructureLabelStore";
import { useUiRightSidebarStore } from "../../../store/uiRightSidebarStore";
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { useMaterialFaceStore, structureFaceKeyOf, classifySurface } from "../../../store/useMaterialFaceStore";

const SELECT_COLOR = "#facc15";   // 選択中 = 黄
const COLLISION_COLOR = "#3b82f6"; // コリジョンON = 青
const LABELED_COLOR = "#34d399";   // ラベル済(コリジョンなし) = 緑

function basisQuat(uAxis, vAxis, normal) {
  const m = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function FaceQuad({ surface, color, fillOpacity, lineOpacity, lift }) {
  const { quat, pos, width, height, lineGeom } = useMemo(() => {
    const u = new THREE.Vector3(...surface.uAxis);
    const v = new THREE.Vector3(...surface.vAxis);
    const n = new THREE.Vector3(...surface.normal).normalize();
    const q = basisQuat(u, v, n);
    const p = new THREE.Vector3(...surface.center).addScaledVector(n, lift);
    const hw = surface.width / 2, hh = surface.height / 2;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    return { quat: q, pos: p, width: surface.width, height: surface.height, lineGeom: new THREE.BufferGeometry().setFromPoints(pts) };
  }, [surface, lift]);

  return (
    <group position={pos} quaternion={quat} renderOrder={9998}>
      {fillOpacity > 0 && (
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={fillOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        </mesh>
      )}
      <line geometry={lineGeom}>
        <lineBasicMaterial color={color} transparent opacity={lineOpacity} />
      </line>
    </group>
  );
}

/** 連結面の実ポリゴン（連結三角形そのもの）でハイライト。矩形のはみ出し＝壁貫通を防ぐ。 */
function FacePolygon({ tris, normal, color, fillOpacity, lineOpacity, lift }) {
  const { geom, edges, pos } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tris), 3));
    g.computeVertexNormals();
    const e = new THREE.EdgesGeometry(g, 1); // 同一平面の内部辺は除外＝外周だけ
    const n = new THREE.Vector3(...normal).normalize().multiplyScalar(lift);
    return { geom: g, edges: e, pos: n };
  }, [tris, normal, lift]);
  useEffect(() => () => { geom.dispose(); edges.dispose(); }, [geom, edges]);

  return (
    <group position={pos} renderOrder={9998}>
      {fillOpacity > 0 && (
        <mesh geometry={geom}>
          {/* depthTest=true で手前の壁に隠れる（透け＝貫通を防ぐ）。polygonOffset で自分の面の
              直前にだけ描いて z-fight を回避。 */}
          <meshBasicMaterial
            color={color}
            transparent
            opacity={fillOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        </mesh>
      )}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={lineOpacity} />
      </lineSegments>
    </group>
  );
}

/** tris があれば実ポリゴン、無ければ従来の矩形でハイライト。 */
function FaceShape({ surface, color, fillOpacity, lineOpacity, lift }) {
  if (surface?.tris && surface.tris.length >= 9) {
    return <FacePolygon tris={surface.tris} normal={surface.normal} color={color} fillOpacity={fillOpacity} lineOpacity={lineOpacity} lift={lift} />;
  }
  return <FaceQuad surface={surface} color={color} fillOpacity={fillOpacity} lineOpacity={lineOpacity} lift={lift} />;
}

/** 面の中央に置くラベルチップ（面上表示）。クリックで該当面を選択する。 */
function FaceLabel({ surface, text, color, lift, selected, onSelect }) {
  const pos = useMemo(() => {
    const n = new THREE.Vector3(...surface.normal).normalize();
    return new THREE.Vector3(...surface.center).addScaledVector(n, lift);
  }, [surface, lift]);

  // 外側ラッパは pointerEvents:none（オービット阻害を防ぐ）、内側のピルだけ受け取る。
  return (
    <Html position={pos} center occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div
        title="クリックでこの面を選択（Shiftで複数選択）"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onSelect?.(e.shiftKey); }}
        style={{
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 800,
          whiteSpace: "nowrap",
          color: "#fff",
          background: selected ? "rgba(250,204,21,0.92)" : "rgba(11,16,32,0.9)",
          border: `1px solid ${selected ? "#facc15" : color}`,
          boxShadow: selected ? "0 0 0 2px rgba(250,204,21,0.35), 0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.5)",
          transform: "translateZ(0)",
          pointerEvents: "auto",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

export default function StructureTagOverlay() {
  const labels = useStructureLabelStore((s) => s.labels);
  const selection = useStructureLabelStore((s) => s.selection);
  const labelVisible = useStructureLabelStore((s) => s.labelVisible);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isMaterial = editorMode === "material";
  // Material モードでは、選択面=展開図に出ている面（useMaterialFaceStore）に合わせてハイライト。
  const materialFace = useMaterialFaceStore((s) => s.selectedFace);
  const upm = sceneMaxY > 100 ? 1000 : 1;

  // Shift 押下状態を window でも追跡（バッジクリックの shiftKey 取りこぼし保険）。
  const shiftHeldRef = React.useRef(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Shift") shiftHeldRef.current = e.type === "keydown"; };
    const onBlur = () => { shiftHeldRef.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const materialSelectedKey = useMemo(() => {
    const s = materialFace?.surface;
    return s ? structureFaceKeyOf(s.normal, s.center, upm) : null;
  }, [materialFace, upm]);

  // 非表示ラベル種別は除外（種別ごとの表示/非表示）
  const labelEntries = useMemo(
    () => Object.entries(labels).filter(([, l]) => labelVisible?.[l.semantic] !== false),
    [labels, labelVisible]
  );
  const selEntries = useMemo(() => Object.entries(selection), [selection]);

  // ラベルチップのクリック挙動。
  //  - Material モード: 展開図用の面選択（useMaterialFaceStore.setSelectedFace）。
  //  - それ以外（面ラベルツール）: 面クリックと同じ構造ラベル選択（通常=単独 / Shift=トグル）。
  const handleSelectLabel = (key, l, shiftKey) => {
    if (isMaterial) {
      const s = l.surface;
      const normal = s?.normal ?? [0, 1, 0];
      useMaterialFaceStore.getState().setSelectedFace({
        objectUuid: "",
        point: s?.center ?? [0, 0, 0],
        normal,
        surfaceType: classifySurface(normal[1] ?? 0),
        faceIndex: null,
        surface: s,
      });
      return;
    }
    const picked = {
      key,
      surface: l.surface,
      normalY: l.surface?.normal?.[1] ?? 0,
      autoSemantic: l.semantic,
    };
    useUiSelectionStore.getState().setSelectedItemId?.(null);
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
    const store = useStructureLabelStore.getState();
    // Shift+クリックで追加選択（トグル）、通常クリックは単独選択。
    if (shiftKey || shiftHeldRef.current) store.toggleSelect(picked);
    else store.selectOnly(picked);
  };

  return (
    <group userData={{ isEditorOverlay: true }}>
      {labelEntries.map(([key, l]) => {
        const color = l.collision ? COLLISION_COLOR : LABELED_COLOR;
        const storyPrefix = l.story ? `${l.story}F・` : "";
        const text = `${storyPrefix}${STRUCTURE_LABEL_JP[l.semantic] || ""}${l.collision ? " ・当たり" : ""}`;
        // Material モードでは面の塗り/枠は出さない（マテリアル表示を汚さない）。バッジのみ。
        const isSel = isMaterial ? materialSelectedKey === key : !!selection[key];
        return (
          <React.Fragment key={`l-${key}`}>
            {!isMaterial && (
              <FaceShape surface={l.surface} color={color} fillOpacity={0.2} lineOpacity={0.95} lift={upm * 0.004} />
            )}
            <FaceLabel
              surface={l.surface}
              text={text}
              color={color}
              lift={upm * 0.02}
              selected={isSel}
              onSelect={(shiftKey) => handleSelectLabel(key, l, shiftKey)}
            />
          </React.Fragment>
        );
      })}
      {/* 構造ラベルツールの一時選択ハイライト（Material モードは独自の選択面表示に任せる）。 */}
      {!isMaterial && selEntries.map(([key, f]) => (
        <FaceShape
          key={`s-${key}`}
          surface={f.surface}
          color={SELECT_COLOR}
          fillOpacity={0.3}
          lineOpacity={1}
          lift={upm * 0.008}
        />
      ))}
    </group>
  );
}
