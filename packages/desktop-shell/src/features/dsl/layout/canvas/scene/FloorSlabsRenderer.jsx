// FloorSlabsRenderer — useSlabStore の床（スラブ）を 3D 表示する。
//   ・立体: 多角形を押し出し。上面が床レベル(FL)に揃い、下へ thicknessMm の厚み。
//   ・平面図(Top): 薄いニュートラルの床面＋細い輪郭線（家具・壁ポシェより下に敷く）。
//   ・クリックで選択（Properties に床設定を出す）。壁と同じ click レース対策込み。
import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useSlabStore, slabIsFloor, slabIsCeiling } from "../../store/useSlabStore";
import { useWallStore } from "../../store/useWallStore";
import { isDrawToolActive } from "../../utils/drawToolActive";
import { isBaseEditMode } from "../../utils/baseEditMode";
import { useGridAxisStore } from "../../store/useGridAxisStore";
import { useBuildingSpecStore, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useDrawnFinishMaterial } from "./useDrawnFinishMaterial";

const SLAB_COLOR = "#e7e5e4";      // 立体のスラブ（明るいニュートラル）
const PLAN_FILL = "#f1f5f9";       // 平面の床面
const PLAN_EDGE = "#94a3b8";       // 平面の輪郭
const SELECT_COLOR = "#38bdf8";
const GHOST_COLOR = "#64748b";     // 他階のトレース表示

function slabShape(points, k) {
  const s = new THREE.Shape();
  s.moveTo(points[0].x * k, -points[0].z * k);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i].x * k, -points[i].z * k);
  s.closePath();
  return s;
}

function SlabMesh({ slab, baseY, k, isTopView, selected, finishMat, ghost = false }) {
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
    // 作図ツール（壁/床/寸法/自動部屋作成）を構えている間は選択を奪わない。
    //   stopPropagation もしない＝奥の作図・部屋作成プレーンへイベントを通す。
    if (isDrawToolActive()) return;
    // Plan/Option（家具サイド）では床は「見えるだけ」。床は Base 共通データなので、
    // 選択→プロパティ編集/削除は Base を開いてから（全プラン巻き込み事故の防止）。
    if (!isBaseEditMode()) return;
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
      // 通り芯を選んでいたら解除（同時に2種類が選ばれた状態を作らない）
      useGridAxisStore.getState().setSelectedId(null);
      // 通常クリックは単独選択。別タイプ（壁）の選択は解除して床だけにする
      // （修飾キー無しで壁と床が同時選択されないように）。
      useWallStore.getState().setSelectedWallId(null);
    }
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
  };

  const outline = useMemo(
    () => [...slab.points, slab.points[0]].map((p) => [p.x * k, 0, p.z * k]),
    [slab.points, k],
  );

  return (
    // 上面 = baseY（押し出しは +Y なので厚み分だけ下げて配置）
    <group
      position={[0, (baseY - t) * k, 0]}
      // ghost（他階の透過表示）は断面クリップの対象外（WallsRenderer と同じ理由。
      // 上の階の床はカット面より上にあり、除外しないとゴーストが消える）。
      // isDrawnStructure: 躯体側の「クリックで選択解除」から守る印（WallsRenderer と同じ）。
      userData={ghost ? { isDrawnStructure: true, ignoreClipping: true } : { isDrawnStructure: true }}
      // 他階のゴーストは「見えるだけ」。触れないようにして誤選択を防ぐ。
      onClick={ghost ? undefined : select}
      raycast={ghost ? () => null : undefined}
    >
      {/* 自動マテリアルの仕上げがあればそれを使う（選択中も素材はそのまま＝見た目を壊さない）。 */}
      {ghost ? (
        <mesh geometry={geo} userData={{ isGhostFloor: true }}>
          <meshBasicMaterial color={GHOST_COLOR} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ) : (
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
      )}

      {/* 平面図: 床面（薄い塗り＋輪郭）。ポシェ(renderOrder 9990)より下、床グリッドより上。
          選択表現は「床の色を塗り替える」のではなく、ごく薄いティントを重ね、
          輪郭だけを選択色で締める（図面の見た目を壊さず、選択は分かる）。
          ⚠️ depthTest は必ず有効（既定）にする。切ると three.js の描画順（不透明→半透明）の都合で
             床の塗りが「先に描かれた不透明な家具」の上に重なり、家具が白っぽく透けて見える。
             床は家具より下にあるので、深度に任せれば家具が正しく手前に来る。 */}
      {planGeo && !ghost && (
        <>
          <mesh geometry={planGeo} position={[0, (t + 5) * k, 0]} renderOrder={9980}>
            <meshBasicMaterial
              color={PLAN_FILL}
              side={THREE.DoubleSide}
              transparent
              opacity={0.75}
            />
          </mesh>
          {selected && (
            <mesh geometry={planGeo} position={[0, (t + 6) * k, 0]} renderOrder={9981}>
              <meshBasicMaterial
                color={SELECT_COLOR}
                side={THREE.DoubleSide}
                transparent
                opacity={0.12}
              />
            </mesh>
          )}
          <group position={[0, (t + 7) * k, 0]}>
            {/* renderOrder は自分の塗り(9980/9981)より上・壁ポシェ(9990)より下。
                未指定だと既定 0 になり、自分の塗りの下に隠れて輪郭が見えない。 */}
            <Line
              points={outline}
              color={selected ? SELECT_COLOR : PLAN_EDGE}
              lineWidth={selected ? 1.8 : 1.2}
              transparent opacity={selected ? 0.9 : 0.8}
              renderOrder={9982}
            />
          </group>
        </>
      )}
    </group>
  );
}

export default function FloorSlabsRenderer({ isTopView = false, isCeilingView = false }) {
  const slabs = useSlabStore((s) => s.slabs);
  const selectedSlabIds = useSlabStore((s) => s.selectedSlabIds);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const floors = useBuildingSpecStore((s) => s.floors);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const showOtherFloorsGhost = useEditorModeStore((s) => s.showOtherFloorsGhost);
  const ghostFloors = useEditorModeStore((s) => s.ghostFloors);
  // 自動マテリアルで解決された床仕上げ（未実行なら null → 既定色）
  const floorMat = useDrawnFinishMaterial("floor");

  // 床は「その床自身の階」のレベルに敷く（アクティブ階を切替えても動かない）。
  const floorBaseY = useMemo(() => {
    const n = Math.max(1, floors?.length || 1);
    return (i) => (fl0Mm || 0) + (floors?.[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0);
  }, [fl0Mm, floors]);
  // 天井として使う面は、その階の CL（天井高）に貼る。
  const ceilingBaseY = useMemo(() => {
    const spec = useBuildingSpecStore.getState();
    return (i) => floorBaseY(i) + ceilingHeightOf(spec, i);
  }, [floorBaseY, floors]);

  if (!slabs.length) return null;
  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;

  return (
    <group>
      {slabs.map((s) => {
        if (!(s.points?.length >= 3)) return null;
        // 役割で出し分ける。天井伏図では「天井として使う面」だけを CL に貼り、
        // 平面図・立体では「床として使う面」を FL に敷く。
        //   both（床/天井）は同じ輪郭が両方の図面に出る＝部屋の輪郭を1回描けば済む。
        const asCeiling = isCeilingView && slabIsCeiling(s);
        if (isCeilingView ? !asCeiling : !slabIsFloor(s)) return null;
        // 平面図ではアクティブ階だけ実体、他階は薄いトレース（立体/断面は全階を実体で）。
        const ghost = isTopView && (s.floorIndex || 0) !== (activeFloorIndex || 0);
        // 他階は既定で非表示。マスターON かつ その階の目アイコンONのときだけ透過表示する。
        if (ghost && (!showOtherFloorsGhost || !ghostFloors.includes(s.floorIndex || 0))) return null;
        const fi = s.floorIndex || 0;
        return (
          <SlabMesh
            key={s.id}
            slab={s}
            // 床ごとの上下オフセット（段差床）。未設定は FL ちょうど。
            // 天井として描くときは CL に貼る（オフセットは天井の下げ天井として効かせる）。
            baseY={(asCeiling ? ceilingBaseY(fi) : floorBaseY(fi)) + (s.offsetYMm || 0)}
            k={k}
            isTopView={isTopView}
            selected={!ghost && selectedSlabIds.includes(s.id)}
            finishMat={asCeiling ? null : floorMat}
            ghost={ghost}
          />
        );
      })}
    </group>
  );
}
