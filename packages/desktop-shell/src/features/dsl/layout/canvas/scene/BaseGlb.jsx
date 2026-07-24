// src/features/layout/components/MainArea/components/scene/BaseGlb.jsx
import React, { useEffect, useRef, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore, useViewportEditorMode } from "../../store/useEditorModeStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { runScanDiagnostics } from "../../services/scanDiagnostics";

const PLAN_CUT_MM = 1500; // 平面図の想定カット高さ（各階 FL からの相対）。WallsRenderer と揃える。
const GHOST_COLOR = 0x64748b; // 他階トレースの色（WallsRenderer の GHOST_COLOR と同じ）

function applyShadowFlags(obj) {
  obj.traverse?.((c) => {
    if (c && c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;

      // ✅ Raycastのface判定があるので、可能ならDoubleSideにしておくと当たりが安定する
      // （見た目に影響が出る場合はここは外してOK）
      if (Array.isArray(c.material)) c.material.forEach((m) => (m.needsUpdate = true));
      else if (c.material) c.material.needsUpdate = true;
    }
  });
}

/**
 * ✅ Base GLB
 * - XZは中心合わせ
 * - Yは床(minY)を 0 に合わせる
 *
 * 変更点（重要）:
 * - 「壁/床を名前で分類」ではなく、
 *   ✅ BaseのMeshをすべて収集して外へ渡す（Raycastはヒット後に法線で壁/床を判定する）
 *
 * onLoaded で返すもの：
 * - root: Group
 * - snap: { baseMeshes: Mesh[] }
 */
export default function BaseGlb({ url, onLoaded }) {
  const gltf = useGLTF(url);
  const groupRef = useRef(null);
  // 平面図ポシェ用の真っ黒・無光源マテリアル（Topビューで壁を塗りつぶす）。
  // depthTest/Write 無効＋高 renderOrder で、床仕上げの上に常に黒く描く。
  const fillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
    []
  );
  useEffect(() => () => { fillMat.dispose(); }, [fillMat]);
  // 他階トレース用: 薄いグレーの半透明フィル（作図壁ゴーストと同じ見た目）。
  const ghostFillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
    []
  );
  useEffect(() => () => { ghostFillMat.dispose(); }, [ghostFillMat]);
  // 他階トレース時、躯体メッシュ本体を「描かない・グリッドを遮らない」ための透明マテリアル。
  //   薄いフィル(ghostFillMat)だけを見せたいので、本体は colorWrite/depthWrite を無効化する。
  const invisibleMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    []
  );
  useEffect(() => () => { invisibleMat.dispose(); }, [invisibleMat]);
  const { layoutSubMode, layoutCameraTilt } = useViewportEditorMode();
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isSectionClipEnabled = useEditorModeStore((s) => s.isSectionClipEnabled);
  const setSceneMaxY = useEditorModeStore((s) => s.setSceneMaxY);
  const setSectionClipHeight = useEditorModeStore((s) => s.setSectionClipHeight);
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);
  const setSceneExtentXZ = useEditorModeStore((s) => s.setSceneExtentXZ);
  // 階ゴースト（他階トレース）判定用。作図壁(WallsRenderer)と同じ入力で階を出し分ける。
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const floorsSpec = useBuildingSpecStore((s) => s.floors);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const ghostFloors = useEditorModeStore((s) => s.ghostFloors);
  const showOtherFloorsGhost = useEditorModeStore((s) => s.showOtherFloorsGhost);

  let effectiveSubMode = layoutSubMode;
  if (layoutSubMode === "furniture_iso") {
      if (layoutCameraTilt === "ceiling") effectiveSubMode = "ceiling_top";
      else if (layoutCameraTilt === "top") effectiveSubMode = "furniture_top";
  }

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    applyShadowFlags(g);

    // いったん最新のワールド行列に
    g.updateMatrixWorld(true);

    // bbox（ワールド）から中心/minYを取得
    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    const minY = box.min.y;

    // XZは中心を原点へ、Yは床を0へ
    if (!box.isEmpty() && isFinite(center.x) && isFinite(center.z) && isFinite(minY)) {
      g.position.x -= center.x;
      g.position.z -= center.z;
      g.position.y -= minY;
      // 位置調整後の行列を更新
      g.updateMatrixWorld(true);

      // Recompute exact max Y and XZ extents to set into the store for scaling section clipping
      const adjustedBox = new THREE.Box3().setFromObject(g);
      const computedMaxY = adjustedBox.max.y;
      if (isFinite(computedMaxY) && computedMaxY > 0) {
        // Debounce or dispatch async to avoid deep warning during render
        setTimeout(() => {
          setSceneMaxY(computedMaxY);
          // XZ extent: the larger of absolute X/Z bounds, used for X/Z slider range
          const extentX = Math.max(Math.abs(adjustedBox.max.x), Math.abs(adjustedBox.min.x));
          const extentZ = Math.max(Math.abs(adjustedBox.max.z), Math.abs(adjustedBox.min.z));
          setSceneExtentXZ(Math.max(extentX, extentZ, computedMaxY * 0.5));
          // mm スケール GLB を読み込んだ場合（computedMaxY > 100）、
          // sectionClipHeight を常に 1500mm に設定する（建物高さの中間ではなく固定値）。
          if (computedMaxY > 100 && sectionClipHeight < 10) {
            setSectionClipHeight(1500); // 1500mm 固定
          }
        }, 0);
      }
    }

    // ── 階ゴースト（他階トレース）の事前計算 ───────────────────────────
    //  躯体GLBは階タグを持たない共有モデルなので、作図壁と同じく「アクティブ階の
    //  平面カット高さ(FL+1500mm)」を各躯体壁が横切るかで実体/他階を判定する。
    //  躯体は minY→0 に載せ替えてあるので、Y=0 が最下階(1F)の床。フロア base は
    //  fl0Mm 分を打ち消せば「壁自身の flMm」に一致する（下の unit 変換込み）。
    const spec = useBuildingSpecStore.getState();
    // アクティブ階は購読値ではなく getState() の確定値を使う。階追加(addFloor)＋階切替が
    // 別更新で走るため、購読クロージャが一瞬古い値(0)のまま effect が実行され、躯体が
    // 「アクティブ階扱い」＝黒実体のまま残ることがある。getState() なら effect 実行時点の最新。
    const activeFloor = spec.activeFloorIndex || 0;
    const fhMm = spec.floorHeightMm || 3000;
    // 各階の床レベル(mm)。floors[] に該当階が無い場合（例: 2F 追加直後で buildingSpec 未反映）は
    // 均等積み上げで推定する。getFloorBaseYmm はレンジ外を末尾階にクランプするため、そのまま使うと
    // 上階のカット高さが 1F と同じ(1500mm)になり、単層躯体が全階で「アクティブ扱い」＝黒実体のまま
    // 残ってしまう（他階トレースに切り替わらない）。
    const floorBaseMm = (fi) => {
      const f = spec.floors?.[fi];
      if (f && Number.isFinite(f.flMm)) return (spec.fl0Mm || 0) + f.flMm;
      return (spec.fl0Mm || 0) + Math.max(0, fi) * fhMm;
    };
    const nFloors = Math.max(spec.floors?.length || 1, activeFloor + 1);
    const gbox = new THREE.Box3().setFromObject(g);
    const structIsMm = (gbox.max.y - gbox.min.y) > 100; // 躯体が mm スケールか
    const unit = structIsMm ? 1 : 0.001;                // 躯体ワールド単位 / mm
    const fl0 = spec.fl0Mm || 0;
    const floorBaseStructY = (fi) => (floorBaseMm(fi) - fl0) * unit; // 躯体Y での床レベル
    const epsY = 2 * unit;
    // その Y に載っている躯体メッシュが属する階（床 base が直下の最大階）。
    const floorOfY = (midY) => {
      let fw = 0;
      for (let fi = 0; fi < nFloors; fi++) if (floorBaseStructY(fi) <= midY + epsY) fw = fi;
      return fw;
    };

    // ✅ Base内の Mesh をすべて収集（壁/床の判定は Raycastヒット後に法線で行う）
    const baseMeshes = [];
    g.traverse((o) => {
      if (!o?.isMesh) return;
      if (!o.geometry) return;

      // 自前で追加した平面図ポシェ用の黒塗りメッシュ（isSectionFill）は処理対象外。
      // これを躯体メッシュとして処理すると、同形状の黒塗り子メッシュを無限に追加し続け、
      // 1 回の traverse 内で updateMatrixWorld がスタックオーバーフロー（Maximum call stack）する。
      if (o.userData?.isSectionFill) return;

      // ゴーストモードで躯体のみを透過するための識別フラグ
      o.userData.isStructuralBase = true;

      // 天井（Ceiling）の判定と表示制御
      const name = o.name.toLowerCase();
      const isCeiling = name.includes("ceiling") || name.includes("天井");
      if (isCeiling) {
        if (effectiveSubMode === "ceiling_top") {
          // 天井ビュー（天井伏図の見上げ含む）では、クリップ中でも天井を表示する。
          // （tilt="ceiling" 経由でも効くよう effectiveSubMode で判定する）
          o.visible = true;
        } else if (isSectionClipEnabled) {
          o.visible = false;
        } else if (editorMode === "layout") {
          o.visible = false; // layout では天井ビュー時のみ表示（上で処理済み）
        } else {
          o.visible = true;
        }
      }

      // Raycastが安定するよう、薄い板でも当たりやすくする（必要なら）
      const targetSide = effectiveSubMode === "furniture_iso" ? THREE.FrontSide : THREE.DoubleSide;
      if (Array.isArray(o.material)) o.material.forEach((m) => { m.side = targetSide; m.needsUpdate = true; });
      else if (o.material) { o.material.side = targetSide; o.material.needsUpdate = true; }

      // LayoutのTopビューやZoningの2Dビューで、壁の輪郭を黒い線で描画して平面図のように見せる
      if (!isCeiling) {
        const isTopView = (effectiveSubMode === "furniture_top" || effectiveSubMode === "zone_2d");

        // 壁判定: 鉛直方向に高さがあるメッシュ＝壁（薄い床・板は除外）。mm/m スケール両対応。
        let isWall = false;
        let objMinY = null; // ワールド最小Y（断面クリップの見上げ線判定に使う）
        let objMaxY = null; // ワールド最大Y
        let objMidY = 0;    // ワールド中央Y（属する階の判定に使う）
        try {
          const wb = new THREE.Box3().setFromObject(o);
          objMinY = wb.min.y;
          objMaxY = wb.max.y;
          objMidY = (wb.min.y + wb.max.y) / 2;
          const yExt = wb.max.y - wb.min.y;
          const mm = wb.max.y > 50; // mm スケール GLB かどうかの簡易判定
          isWall = yExt > (mm ? 500 : 0.5);
        } catch (err) {}

        // この躯体メッシュが「どの階に建っているか」は、その土台(最小Y)が乗る階で決める。
        //   躯体は1つの大きなメッシュのことが多く、高さ(断面)で判定すると「1F土台だが背が高い
        //   →2Fのカットも跨ぐ→2Fでも実体扱い」となり他階トレースに切り替わらない。土台の階で
        //   判定すれば、1F土台の躯体は2F表示では必ず別階＝薄いトレース/非表示になる。
        //   （各階が別メッシュに分かれた躯体でも、そのメッシュの土台階で正しく振り分く。）
        const floorOfMesh = floorOfY((objMinY != null ? objMinY : objMidY) + epsY);
        const isActiveHere = floorOfMesh === activeFloor;
        //   別階トレース: 目アイコンON（ghostFloors にその階が含まれる）なら薄く重ねる。
        const ghostOn = !isActiveHere && showOtherFloorsGhost && Array.isArray(ghostFloors) && ghostFloors.includes(floorOfMesh);

        // 躯体本体マテリアルの退避（他階トレース時に透明マテリアルへ差し替えるため）。
        if (o.userData.baseOrigMat === undefined) o.userData.baseOrigMat = o.material;
        const restoreBaseMat = () => { if (o.userData.baseOrigMat !== undefined) o.material = o.userData.baseOrigMat; };

        if (isTopView) {
          // 輪郭線（既存）
          if (!o.userData.baseOutlineMesh && o.geometry && o.geometry.attributes.position) {
            try {
              const edges = new THREE.EdgesGeometry(o.geometry, 15);
              const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
              lineMat.polygonOffset = true;
              lineMat.polygonOffsetFactor = -1;
              lineMat.polygonOffsetUnits = -1;
              const outlineMesh = new THREE.LineSegments(edges, lineMat);
              outlineMesh.renderOrder = 10000; // 黒塗りより前面に
              o.add(outlineMesh);
              o.userData.baseOutlineMesh = outlineMesh;
            } catch (err) {}
          }
          // 薄いフィル（他階トレース）用の子メッシュ。黒ポシェとは別に持ち、素材だけ切替える。
          const ensureFillMesh = () => {
            if (!o.userData.baseFillMesh && o.geometry && o.geometry.attributes.position) {
              try {
                const fillMesh = new THREE.Mesh(o.geometry, fillMat);
                fillMesh.renderOrder = 9998;
                fillMesh.raycast = () => null;
                fillMesh.userData.isSectionFill = true;
                o.add(fillMesh);
                o.userData.baseFillMesh = fillMesh;
              } catch (err) {}
            }
            return o.userData.baseFillMesh;
          };

          if (!isActiveHere) {
            // ── 別階の躯体 ─────────────────────────────────────────────
            if (isWall && ghostOn && !isSectionClipEnabled) {
              // 薄いトレース: 本体は透明にし、薄グレーのフィルだけを重ねる（作図壁ゴーストと同じ）。
              o.visible = true;
              o.material = invisibleMat;
              const fm = ensureFillMesh();
              if (fm) { fm.material = ghostFillMat; fm.visible = true; }
              if (o.userData.baseOutlineMesh) o.userData.baseOutlineMesh.visible = false;
            } else {
              // 目アイコンOFF・非壁・断面クリップ中などは、平面から完全に隠す。
              o.visible = false;
              restoreBaseMat();
            }
          } else {
            // ── アクティブ階（またはその床など） ───────────────────────
            o.visible = true;
            restoreBaseMat();
            if (o.userData.baseOutlineMesh) {
              // 平面図の水平カット中は、カット面より「完全に上」にある躯体（屋根など）の
              // 輪郭線を隠す。輪郭線(LineSegments)はクリップ面を無視するため、そのままだと
              // 屋根を見上げたような線が平面図に写り込む。
              let aboveCut = false;
              if (isSectionClipEnabled && objMinY != null && Number.isFinite(sectionClipHeight)) {
                const marginY = sectionClipHeight > 100 ? 20 : 0.02;
                if (objMinY > sectionClipHeight + marginY) aboveCut = true;
              }
              o.userData.baseOutlineMesh.visible = !aboveCut;
            }
            // 壁の黒塗り（平面図ポシェ）: この階の断面として黒く塗る。断面クリップ中は出さない。
            if (isWall && !isSectionClipEnabled) {
              const fm = ensureFillMesh();
              if (fm) { fm.material = fillMat; fm.visible = true; }
            } else if (o.userData.baseFillMesh) {
              o.userData.baseFillMesh.visible = false;
            }
          }
        } else {
          // 立体/断面など: 躯体は全階を実像として描く。トレース用の差し替えは戻す。
          o.visible = true;
          restoreBaseMat();
          if (o.userData.baseOutlineMesh) o.userData.baseOutlineMesh.visible = false;
          if (o.userData.baseFillMesh) o.userData.baseFillMesh.visible = false;
        }
      }

      baseMeshes.push(o);
    });

    // 🔬 一時診断: window.__SK_SCAN_DEBUG__=true のときのみ走る（自動マテリアル設計検証）
    try { runScanDiagnostics(g, baseMeshes); } catch (e) { /* noop */ }

    // ✅ 外へ通知（root + baseMeshes）
    if (typeof onLoaded === "function") {
      try {
        onLoaded({ root: g, snap: { baseMeshes } });
      } catch {
        // ignore
      }
    }

    // unmount/URL変更時にクリア（安全）
    return () => {
      if (typeof onLoaded === "function") {
        try {
          onLoaded(null);
        } catch {
          // ignore
        }
      }
    };
  }, [gltf, url, onLoaded, layoutSubMode, editorMode, isSectionClipEnabled, sectionClipHeight, effectiveSubMode,
      activeFloorIndex, floorsSpec, fl0Mm, ghostFloors, showOtherFloorsGhost]);

  const clonedScene = useMemo(() => {
    return gltf.scene ? gltf.scene.clone() : null;
  }, [gltf.scene]);

  return (
    <group ref={groupRef}>
      {clonedScene && <primitive object={clonedScene} />}
    </group>
  );
}

