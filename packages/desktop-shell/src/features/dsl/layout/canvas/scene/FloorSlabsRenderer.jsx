// FloorSlabsRenderer — useSlabStore の床（スラブ）を 3D 表示する。
//   ・立体: 多角形を押し出し。上面が床レベル(FL)に揃い、下へ thicknessMm の厚み。
//   ・平面図(Top): 薄いニュートラルの床面＋細い輪郭線（家具・壁ポシェより下に敷く）。
//   ・クリックで選択（Properties に床設定を出す）。壁と同じ click レース対策込み。
import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useSlabStore } from "../../store/useSlabStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useDrawnFinishMaterial } from "./useDrawnFinishMaterial";

const SLAB_COLOR = "#e7e5e4";      // 立体のスラブ（明るいニュートラル）
const PLAN_FILL = "#f1f5f9";       // 平面の床面
const PLAN_EDGE = "#94a3b8";       // 平面の輪郭
const SELECT_COLOR = "#38bdf8";

function slabShape(points, k) {
  const s = new THREE.Shape();
  s.moveTo(points[0].x * k, -points[0].z * k);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i].x * k, -points[i].z * k);
  s.closePath();
  return s;
}

function SlabMesh({ slab, baseY, k, isTopView, selected, finishMat }) {
  const t = slab.thicknessMm || 150;

  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(slabShape(slab.points, k), { depth: t * k, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // XY 形状 → XZ 平面、押し出しは +Y 方向
    return g;
  }, [slab.points, t, k]);

  const planGeo = useMemo(() => {
    if (!isTopView) return null;
    const g = new THREE.ShapeGeometry(slabShape(slab.points, k));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [slab.points, k, isTopView]);

  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => { planGeo?.dispose(); }, [planGeo]);

  // 選択は onClick（pointerdown ではない）で行う:
  //   ・pointerdown を止めないので、床の上での左ドラッグ＝マーキー選択は従来どおり動く
  //   ・床は背景キャッチャー（groundY 直下の巨大平面）より上にあるため、R3F の
  //     交差順（カメラに近い順）で床の onClick が先に走る。ここで stopPropagation
  //     すれば「選択した直後に床の onClick が解除する」レースも起きない。
  const select = (e) => {
    e.stopPropagation();
    const st = useSlabStore.getState();
    // Ctrl/Shift/⌘+クリック = 複数選択トグル。通常クリック = 単独選択（壁と同じ流儀）。
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      const has = st.selectedSlabIds.includes(slab.id);
      st.setSelectedSlabIds(
        has ? st.selectedSlabIds.filter((x) => x !== slab.id) : [...st.selectedSlabIds, slab.id],
      );
    } else {
      st.setSelectedSlabId(slab.id);
    }
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
  };

  const outline = useMemo(
    () => [...slab.points, slab.points[0]].map((p) => [p.x * k, 0, p.z * k]),
    [slab.points, k],
  );

  return (
    // 上面 = baseY（押し出しは +Y なので厚み分だけ下げて配置）
    <group position={[0, (baseY - t) * k, 0]} onClick={select}>
      {/* 自動マテリアルの仕上げがあればそれを使う（選択中も素材はそのまま＝見た目を壊さない）。 */}
      <mesh
        geometry={geo}
        receiveShadow
        userData={{ isFloorSlab: true, slabId: slab.id }}
        material={finishMat || undefined}
      >
        {!finishMat && (
          <meshStandardMaterial color={SLAB_COLOR} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
        )}
      </mesh>

      {/* 平面図: 床面（薄い塗り＋輪郭）。ポシェ(renderOrder 9990)より下、床グリッドより上。
          選択表現は「床の色を塗り替える」のではなく、ごく薄いティントを重ね、
          輪郭だけを選択色で締める（図面の見た目を壊さず、選択は分かる）。 */}
      {planGeo && (
        <>
          <mesh geometry={planGeo} position={[0, (t + 5) * k, 0]} renderOrder={9980}>
            <meshBasicMaterial
              color={PLAN_FILL}
              side={THREE.DoubleSide}
              depthTest={false}
              transparent
              opacity={0.75}
            />
          </mesh>
          {selected && (
            <mesh geometry={planGeo} position={[0, (t + 6) * k, 0]} renderOrder={9981}>
              <meshBasicMaterial
                color={SELECT_COLOR}
                side={THREE.DoubleSide}
                depthTest={false}
                transparent
                opacity={0.12}
              />
            </mesh>
          )}
          <group position={[0, (t + 7) * k, 0]}>
            <Line
              points={outline}
              color={selected ? SELECT_COLOR : PLAN_EDGE}
              lineWidth={selected ? 1.8 : 1.2}
              transparent opacity={selected ? 0.9 : 0.8}
              depthTest={false}
            />
          </group>
        </>
      )}
    </group>
  );
}

export default function FloorSlabsRenderer({ isTopView = false }) {
  const slabs = useSlabStore((s) => s.slabs);
  const selectedSlabIds = useSlabStore((s) => s.selectedSlabIds);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const floors = useBuildingSpecStore((s) => s.floors);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  // 自動マテリアルで解決された床仕上げ（未実行なら null → 既定色）
  const floorMat = useDrawnFinishMaterial("floor");

  // 床はアクティブ階の床レベルに敷く（壁・家具と同じ規約）。
  const baseY = useMemo(() => {
    const i = Math.max(0, Math.min(activeFloorIndex || 0, (floors?.length || 1) - 1));
    return (fl0Mm || 0) + (floors?.[i]?.flMm || 0);
  }, [fl0Mm, floors, activeFloorIndex]);

  if (!slabs.length) return null;
  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;

  return (
    <group>
      {slabs.map((s) => (
        s.points?.length >= 3 ? (
          <SlabMesh
            key={s.id}
            slab={s}
            baseY={baseY}
            k={k}
            isTopView={isTopView}
            selected={selectedSlabIds.includes(s.id)}
            finishMat={floorMat}
          />
        ) : null
      ))}
    </group>
  );
}
