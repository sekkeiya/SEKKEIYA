// SectionPickController — 断面ビューで「黒く塗られた切り口」をクリックして床/天井/壁を選択する。
//
// 以前は切り口の位置に透明ヒット面（SectionSlabPicker / SectionWallPicker）を置いて R3F の
// レイキャストに任せていたが、断面ビューには「クリップで消えているだけでレイキャストには
// 当たる」躯体（カット面より手前側の壁・スラブの本体）が大量にあり、それらの
// onPointerDown / onClick（stopPropagation 付き）が交差順しだいでクリックを先に奪う。
// ヒット面はカット面上＝手前の躯体より必ず奥なので勝てず、「選択できたりできなかったり」
// が安定しなかった。
//
// 本実装は R3F のイベント系を使わない。canvas の click を直接拾い、
// 「カット面上のどの切り口（黒塗り矩形）の中をクリックしたか」をデータから計算して選択する。
//   ・切り口の横範囲: 多角形フットプリントとカット面の交差（crossSpan）
//   ・縦範囲: スラブ=上面(FL/CL＋オフセット)〜下面(厚み) / 壁=足元〜足元+高さ
//   ・複数候補に入るときは面積最小（＝最も限定的。壁の細い帯が天井の大きな帯に勝つ）
// R3F 側のハンドラ（手前の見えない躯体の選択等）が先に走っても、この listener は
// canvas への登録順で必ず後に実行されるため、最終的な選択はここで確定する。
// 黒塗りの外（立面に見えているだけの部分）をクリックしても何もしない。
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useSlabStore } from "../../store/useSlabStore";
import { useWallStore } from "../../store/useWallStore";
import { useGridAxisStore } from "../../store/useGridAxisStore";
import { useBuildingSpecStore, floorHeightOf, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { isDrawToolActive } from "../../utils/drawToolActive";
import { isBaseEditMode } from "../../utils/baseEditMode";
import { crossSpan, wallRect } from "../../utils/sectionCrossSpan";

// sideAxis: 画面の横方向に当たる世界軸（FRONT="x" / RIGHT="z"）。
export default function SectionPickController({ sideAxis }) {
  const { gl, camera } = useThree();

  useEffect(() => {
    if (!sideAxis) return;
    const el = gl.domElement;
    let down = null;
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY, button: e.button }; };
    const onClick = (e) => {
      const d = down; down = null;
      if (!d || d.button !== 0) return;
      // 数px 以上動いたらドラッグ（パン/ハンドル操作/マーキー）なので選択しない
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;

      // 断面（高さ断面ではない側面カット）でのみ動く。ゲートは旧ピッカーと同じ。
      const em = useEditorModeStore.getState();
      if (!em.isSectionClipEnabled || em.sectionClipYEnabled) return;
      const depthAxis = sideAxis === "x" ? "z" : "x"; // 視線＝カット軸
      if (depthAxis === "z" ? !em.sectionClipZEnabled : !em.sectionClipXEnabled) return;
      if (em.editorMode === "walkthrough") return;
      if (isDrawToolActive()) return;
      if (!isBaseEditMode()) return;
      if (useViewportUiStore.getState().gizmoDragging) return;

      const isMm = (em.sceneMaxY || 0) > 100;
      const k = isMm ? 1 : 0.001;
      const cutWorld = depthAxis === "z" ? em.sectionClipZ : em.sectionClipX;
      const cutMm = cutWorld / k;

      // クリック位置 → カット面（視線に直交する鉛直面）上の (横 h, 高さ y)[mm]
      const rect = el.getBoundingClientRect();
      const v2 = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(v2, camera);
      const normal = depthAxis === "z" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const plane = new THREE.Plane(normal, -cutWorld);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const hMm = (sideAxis === "x" ? hit.x : hit.z) / k;
      const yMm = hit.y / k;
      // 当たり許容は画面 4px 相当（直交カメラ前提。念のためのフォールバックは 20mm）
      const tolMm = camera.isOrthographicCamera
        ? Math.max((4 / Math.max(camera.zoom, 1e-6)) / k, 2)
        : 20;

      // 切り口（黒塗り矩形）の候補を全部集める
      const spec = useBuildingSpecStore.getState();
      const fl0 = spec.fl0Mm || 0;
      const floors = spec.floors;
      const n = Math.max(1, floors?.length || 1);
      const flAt = (i) => fl0 + (floors?.[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0);
      const cands = [];
      for (const s of useSlabStore.getState().slabs) {
        if (!(s.points?.length >= 3)) continue;
        const span = crossSpan(s.points, depthAxis, sideAxis, cutMm);
        if (!span) continue; // カット面がこのスラブを横切っていない＝黒く塗られない
        const fi = s.floorIndex || 0;
        // 天井スラブ(role="ceiling")は CL に貼られる（FloorSlabsRenderer と同じ規約）
        const top = (s.role === "ceiling" ? flAt(fi) + ceilingHeightOf(spec, fi) : flAt(fi)) + (s.offsetYMm || 0);
        cands.push({ kind: "slab", id: s.id, lo: span[0], hi: span[1], y0: top - (s.thicknessMm || 150), y1: top });
      }
      for (const w of useWallStore.getState().walls) {
        if (!w?.start || !w?.end) continue;
        const span = crossSpan(wallRect(w), depthAxis, sideAxis, cutMm);
        if (!span) continue;
        const fi = Math.max(0, Math.min(w.floorIndex || 0, n - 1));
        const wallH = w.heightMm ?? (w.kind === "exterior" ? floorHeightOf(spec, fi) : ceilingHeightOf(spec, fi));
        const y0 = flAt(fi) + (w.offsetYMm || 0);
        cands.push({ kind: "wall", id: w.id, lo: span[0], hi: span[1], y0, y1: y0 + wallH });
      }

      // クリック点が入る候補のうち面積最小＝最も限定的なもの（壁の細い帯 > 天井の大きな帯）
      let best = null;
      for (const c of cands) {
        if (hMm < c.lo - tolMm || hMm > c.hi + tolMm) continue;
        if (yMm < c.y0 - tolMm || yMm > c.y1 + tolMm) continue;
        const area = (c.hi - c.lo) * (c.y1 - c.y0);
        if (!best || area < best.area) best = { ...c, area };
      }
      if (!best) return; // 黒塗りの外＝何もしない（選択解除は既存の余白クリックに任せる）

      // 選択（平面図の床/壁クリックと同じ作法）
      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      if (best.kind === "slab") {
        const st = useSlabStore.getState();
        if (additive) {
          const has = st.selectedSlabIds.includes(best.id);
          st.setSelectedSlabIds(has ? st.selectedSlabIds.filter((x) => x !== best.id) : [...st.selectedSlabIds, best.id]);
        } else {
          st.setSelectedSlabId(best.id);
          useGridAxisStore.getState().setSelectedId(null);
          useWallStore.getState().setSelectedWallId(null);
        }
      } else {
        const st = useWallStore.getState();
        if (additive) {
          st.toggleWallSelection(best.id);
        } else {
          st.setSelectedWallId(best.id);
          useGridAxisStore.getState().setSelectedId(null);
          useSlabStore.getState().setSelectedSlabId(null);
        }
      }
      useUiRightSidebarStore.getState().setRightPanel("properties", true);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClick);
    };
  }, [gl, camera, sideAxis]);

  return null;
}
