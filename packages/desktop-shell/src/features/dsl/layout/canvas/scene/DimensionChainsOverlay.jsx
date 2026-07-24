// DimensionChainsOverlay — 図面の4辺（上下左右）に寸法列を並べる汎用エンジン。
//   列ごとに「刻み元(source)」を指定し、その刻みでセグメント寸法を打つ:
//     total … 両端だけ（総寸法） / grid … 通り芯間 / wall … 躯体の壁面 / level … 階レベル
//   列は内側から外側へ自動配置。表記は展開図・断面図と同じスレート線＋白地の mm 値に揃える。
//   図面注記なのでクリップ対象外（ignoreClipping）・深度無視で最前面に描く。
//
//   座標系: 画面横を h、画面縦を v と呼ぶ。ビューごとに world への写像だけが変わる。
//     平面(TOP)   … h=world X / v=world Z（水平面 y=cut に置く）
//     断面/立面 FRONT … h=world X / v=world Y（面 z=0）
//     断面/立面 RIGHT … h=world Z / v=world Y（面 x=0）
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useGridAxisStore } from "../../store/useGridAxisStore";
import { useWallStore } from "../../store/useWallStore";
import { useBuildingSpecStore, floorHeightOf, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useDimChainStore, defaultChainsFor, markKey } from "../../store/useDimChainStore";
import { useDrawToolActive } from "../../utils/drawToolActive";
import { useBaseEditMode } from "../../utils/baseEditMode";
import { useViewportDisplayStore } from "../../store/useViewportDisplayStore";
import { measureXZBounds, DIM_COL_OFFSET_MM, DIM_COL_GAP_MM } from "../../utils/planBounds";

const INK = "#475569";      // 寸法線
const INK_DARK = "#0f172a"; // 数値
const ACCENT = "#0369a1";

const tagStyle = (strong, hovered) => ({
  fontSize: strong ? 11 : 10,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: hovered ? ACCENT : INK_DARK,
  background: hovered ? "rgba(255,255,255,0.99)" : "rgba(255,255,255,0.92)",
  border: `1px solid ${hovered ? "rgba(3,105,161,0.75)" : "rgba(30,41,59,0.35)"}`,
  borderRadius: 3,
  padding: "0px 4px",
  whiteSpace: "nowrap",
  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
});

/** 寸法値のバッジ。刻み元から自動計算した値なので数値そのものは表示専用。
 *  ホバーすると × が出て、その寸法を作っている「区切り」を消せる（両隣の寸法が統合される）。 */
function ChainTag({ position, valueMm, strong, title, onDelete }) {
  const [hover, setHover] = useState(false);
  // 作図中は寸法がクリックを吸わないようにする（点を置けなくなるため）。
  // Plan/Option（家具サイド）でも操作不可（寸法列は Base 共通＝編集は Base で）。
  // ⚠️ フックは必ず両方・無条件に呼ぶこと。`!useA() || useB()` は短絡評価で
  //    B が呼ばれたり呼ばれなかったりし、Rules of Hooks 違反でクラッシュする。
  const baseEdit = useBaseEditMode();
  const drawTool = useDrawToolActive();
  const drawing = !baseEdit || drawTool;
  // 記号ロック中（寸法列）は区切りの削除（編集）を止める。設定パネルを開くだけの閲覧は残す。
  const locked = useViewportDisplayStore((s) => s.symbolLocks.dimension);
  // 寸法をクリック = その図面の寸法列の設定を右サイドバーに出す。
  const openPanel = (e) => {
    e?.stopPropagation?.();
    // 通り芯パネルより優先度が低いので、通り芯の選択は解除しておく。
    const gx = useGridAxisStore.getState();
    gx.setSelectedId(null);
    gx.setPanelOpen(false);
    useDimChainStore.getState().setPanelOpen(true);
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
  };
  return (
    <Html position={position} center zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ position: "relative", display: "inline-block", pointerEvents: drawing ? "none" : "auto" }}
      >
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={openPanel}
          title={`${title}（クリックで寸法列の設定を開く）`}
          style={{ ...tagStyle(strong, hover), pointerEvents: drawing ? "none" : "auto", userSelect: "none", cursor: "pointer" }}
        >
          {Math.round(valueMm)}
        </div>
        {onDelete && hover && !locked && (
          <div
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
            title="この寸法の区切りを消す（隣の寸法に統合）"
            style={{
              position: "absolute", top: -8, right: -8,
              width: 15, height: 15, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 900,
              lineHeight: 1, cursor: "pointer", pointerEvents: "auto",
              border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          >
            ×
          </div>
        )}
      </div>
    </Html>
  );
}

/** 区切りのドラッグハンドル。普段は透明で、ホバー中とドラッグ中だけ●が出る。
 *  刻み元の実体（通り芯 / 階レベル）をそのまま動かすので、図面と一緒にモデルが直る。 */
function MarkDragHandle({ position, view, planeY, along, cursor, onMove, onCommit, title }) {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState(false);
  // 作図中は区切りハンドルもクリックを吸わないようにする。
  // Plan/Option（家具サイド）でもドラッグ不可（通り芯・階レベルの実体が動いてしまうため）。
  // ⚠️ フックは必ず両方・無条件に呼ぶ（短絡評価で条件呼び出しにしない。Rules of Hooks）。
  const baseEdit = useBaseEditMode();
  const drawTool = useDrawToolActive();
  // 記号ロック中（寸法列）は区切りハンドルのドラッグ（＝通り芯/階レベルの移動）を止める。
  const locked = useViewportDisplayStore((s) => s.symbolLocks.dimension);
  const drawing = !baseEdit || drawTool || locked;
  const [dragging, setDragging] = useState(false);
  // ドラッグ中に親が再レンダーされてもコールバックは最新を使う（依存には入れない）。
  const cb = useRef({ onMove, onCommit });
  cb.current = { onMove, onCommit };

  // 依存はプリミティブだけにする。毎レンダー新しくなる Vector3 などを渡すと
  // effect が張り直され、ドラッグが途切れる。
  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const plane = view === "plan" ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
      : view === "front" ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      : new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const pick = (hit) => (along === "h"
      ? (view === "right" ? hit.z : hit.x)
      : (view === "plan" ? hit.z : hit.y));
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const onPointerMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      cb.current.onMove?.(pick(hit));
    };
    const onUp = () => { setDragging(false); cb.current.onCommit?.(); };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, view, planeY, along]);

  const visible = hover || dragging;
  return (
    <Html position={position} center zIndexRange={[19, 0]}>
      <div
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setDragging(true); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={title}
        style={{
          width: 14, height: 14, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor, pointerEvents: drawing ? "none" : "auto", background: "transparent", touchAction: "none",
        }}
      >
        <div
          style={{
            width: visible ? 10 : 0, height: visible ? 10 : 0, borderRadius: "50%",
            background: dragging ? ACCENT : "rgba(255,255,255,0.95)",
            border: visible ? `1.5px solid ${ACCENT}` : "none",
            boxShadow: visible ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
            transition: "width 80ms, height 80ms",
          }}
        />
      </div>
    </Html>
  );
}

/** 近い刻みをまとめて昇順にする（同じ位置に2本立てない）。 */
function normalizeMarks(values, lo, hi, tol) {
  const inRange = values.filter((v) => v > lo + tol && v < hi - tol).sort((a, b) => a - b);
  const kept = [];
  inRange.forEach((v) => { if (!kept.length || v - kept[kept.length - 1] > tol) kept.push(v); });
  return [lo, ...kept, hi];
}

export default function DimensionChainsOverlay({ viewKey = null, view = "plan" }) {
  // view: "plan" | "front" | "right"
  const configs = useDimChainStore((s) => s.configs);
  const visible = useDimChainStore((s) => s.visible);
  const removedMarks = useDimChainStore((s) => s.removedMarks);
  const axes = useGridAxisStore((s) => s.axes);
  const walls = useWallStore((s) => s.walls);
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const glMm = useBuildingSpecStore((s) => s.glMm);
  const floors = useBuildingSpecStore((s) => s.floors);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);

  const isMm = (sceneMaxY || 0) > 100;
  const w = (mm) => (isMm ? mm : mm / 1000);   // mm → world
  const toMm = (v) => (isMm ? v : v * 1000);   // world → mm

  // 未設定のビューは既定構成で描く（設定を触るまで何も出ない、を避ける）。
  const chains = useMemo(
    () => (viewKey ? (configs[viewKey] || defaultChainsFor(viewKey)) : null),
    [viewKey, configs],
  );

  // ── 建物の範囲（h/v）を実躯体から測る。無ければシーン範囲でフォールバック。 ──
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    // 断面線と共通の計測（utils/planBounds）。基準がずれると断面線が寸法列を突き抜ける。
    // GLB の走査は重いので 3 軸ぶんをこの 1 回で受け取る（Y は側面ビューの縦方向に使う）。
    const xz = measureXZBounds(baseColliders, walls, w);
    const has = !!xz;
    if (xz) {
      box.set(
        new THREE.Vector3(xz.minX, xz.minY, xz.minZ),
        new THREE.Vector3(xz.maxX, xz.maxY, xz.maxZ),
      );
    }
    if (!has) {
      const e = Math.max(sceneExtentXZ || 0, isMm ? 4000 : 4);
      box.set(new THREE.Vector3(-e, 0, -e), new THREE.Vector3(e, Math.max(sceneMaxY || 0, w(3000)), e));
    }
    if (view === "plan") {
      return { hMin: box.min.x, hMax: box.max.x, vMin: box.min.z, vMax: box.max.z };
    }
    if (view === "front") {
      return { hMin: box.min.x, hMax: box.max.x, vMin: box.min.y, vMax: box.max.y };
    }
    return { hMin: box.min.z, hMax: box.max.z, vMin: box.min.y, vMax: box.max.y };
  }, [baseColliders, walls, sceneExtentXZ, sceneMaxY, view, isMm]);

  // (h, v) → world 座標。平面は水平面、側面は正対する垂直面に置く。
  const P = useMemo(() => {
    if (view === "plan") {
      const y = (sectionClipHeight || w(1500)) * 0.94;
      return (h, v) => [h, y, v];
    }
    if (view === "front") return (h, v) => [h, v, 0];
    return (h, v) => [0, v, h];
  }, [view, sectionClipHeight, isMm]);

  /** その列の向きに対応する通り芯の world 位置（昇順・近接は1本に統合）。 */
  const gridValues = (along) => {
    //   平面: h=X → X通り(axis "x") / v=Z → Y通り(axis "z")
    //   FRONT: h=X → X通り（縦方向に通り芯は無い）／ RIGHT: h=Z → Y通り
    let want = null;
    if (view === "plan") want = along === "h" ? "x" : "z";
    else if (along === "h") want = view === "front" ? "x" : "z";
    if (!want) return [];
    const vals = (axes || [])
      .filter((a) => a.axis === want)
      .map((a) => w(a.pos))
      .sort((a, b) => a - b);
    const kept = [];
    vals.forEach((v) => { if (!kept.length || v - kept[kept.length - 1] > w(60)) kept.push(v); });
    return kept;
  };

  // ── 刻み元ごとの位置（world・h または v 軸上）を作る ──
  const marksFor = (source, along, lo, hi) => {
    // along: "h" | "v"
    if (source === "total") {
      // 総寸法は「最初の通り芯 → 最後の通り芯」。製図では通り芯の総長を打つ。
      // 通り芯が無い（または1本だけの）向きは、建物の外形で代用する。
      const g = gridValues(along);
      return g.length >= 2 ? [g[0], g[g.length - 1]] : [lo, hi];
    }

    if (source === "grid") {
      // 通り芯間は「通り芯の端から端まで」を芯ごとに刻む（建物の外形では切らない）。
      const g = gridValues(along);
      return g.length >= 2 ? g : [];
    }

    if (source === "level") {
      // 縦方向の列だけ。GL / 各階 FL / CL を刻みにする。
      if (along !== "v" || view === "plan") return [];
      const base = fl0Mm || 0;
      const spec = useBuildingSpecStore.getState();
      const vals = [w(base + glMm)];
      (floors || []).forEach((f, i) => {
        const fl = base + (f.flMm || 0);
        vals.push(w(fl));                              // その階の床
        vals.push(w(fl + ceilingHeightOf(spec, i)));   // その階の天井（CL は階ごと）
        vals.push(w(fl + floorHeightOf(spec, i)));     // 上階の床
      });
      return normalizeMarks(vals, lo, hi, w(60));
    }

    if (source === "wall") {
      // 躯体の壁面（薄い箱の中心）＋作図した壁の芯を、この列の軸へ射影する。
      const vals = [];
      const pick = (box) => {
        const sx = box.max.x - box.min.x;
        const sy = box.max.y - box.min.y;
        const sz = box.max.z - box.min.z;
        if (sy < w(800)) return;                       // 立っていない
        if (Math.min(sx, sz) > w(700)) return;         // 厚い＝壁ではない
        if (Math.max(sx, sz) < w(900)) return;         // 短い
        if (view === "plan") {
          if (along === "h" && sx <= sz) vals.push((box.min.x + box.max.x) / 2);
          if (along === "v" && sz < sx) vals.push((box.min.z + box.max.z) / 2);
        } else if (along === "h") {
          if (view === "front" && sx <= sz) vals.push((box.min.x + box.max.x) / 2);
          if (view === "right" && sz <= sx) vals.push((box.min.z + box.max.z) / 2);
        }
      };
      const b = new THREE.Box3();
      (baseColliders || []).forEach((o) => {
        if (!o) return;
        try { b.setFromObject(o); } catch { return; }
        if (!b.isEmpty()) pick(b.clone());
      });
      (walls || []).forEach((wl) => {
        // 平面図は「その階の図面」なので、他の階に建つ壁は刻みに使わない
        // （2F だけにある間仕切りが 1F の寸法に出てしまうため）。
        // 断面・立面は全階が写る図なので階で絞らない。
        if (view === "plan" && (wl.floorIndex || 0) !== (activeFloorIndex || 0)) return;
        const dx = Math.abs(wl.end.x - wl.start.x);
        const dz = Math.abs(wl.end.z - wl.start.z);
        if (Math.hypot(dx, dz) < 900) return;
        if (view === "plan") {
          if (along === "h" && dx < dz) vals.push(w((wl.start.x + wl.end.x) / 2));
          if (along === "v" && dz < dx) vals.push(w((wl.start.z + wl.end.z) / 2));
        } else if (along === "h") {
          if (view === "front" && dx < dz) vals.push(w((wl.start.x + wl.end.x) / 2));
          if (view === "right" && dz < dx) vals.push(w((wl.start.z + wl.end.z) / 2));
        }
      });
      if (!vals.length) return [];
      return normalizeMarks(vals, lo, hi, w(120));
    }
    return [];
  };

  // × で消した区切りを除く（両端＝総寸法の端は消さない）。
  const applyRemoved = (marks, side, source) => {
    if (marks.length < 3) return marks;
    const keep = [marks[0]];
    for (let i = 1; i < marks.length - 1; i++) {
      if (removedMarks[markKey(viewKey, side, source, toMm(marks[i]))]) continue;
      keep.push(marks[i]);
    }
    keep.push(marks[marks.length - 1]);
    return keep;
  };

  /**
   * 区切りをドラッグしたときに動かす「実体」を返す。
   *   grid  … その位置の通り芯そのもの
   *   level … GL / 各階 FL / 各階 CL
   * wall（躯体から拾った位置）と total（建物の端）は動かせないので null。
   */
  const resolveMarkDrag = (source, along, worldPos) => {
    const bs = useBuildingSpecStore.getState();
    if (source === "grid") {
      let want = null;
      if (view === "plan") want = along === "h" ? "x" : "z";
      else if (along === "h") want = view === "front" ? "x" : "z";
      if (!want) return null;
      const target = (axes || [])
        .filter((a) => a.axis === want)
        .find((a) => Math.abs(w(a.pos) - worldPos) < w(80));
      if (!target) return null;
      return {
        cursor: along === "h" ? "ew-resize" : "ns-resize",
        title: `通り芯 ${target.name} を動かす`,
        onMove: (v) => useGridAxisStore.getState().updateAxisLocal(target.id, { pos: Math.round(toMm(v) / 50) * 50 }),
        onCommit: () => useGridAxisStore.getState().persistAxes(),
      };
    }
    if (source === "level") {
      const base = bs.fl0Mm || 0;
      const mm = toMm(worldPos);
      const near = (a) => Math.abs(a - mm) < 80;
      if (near(base + bs.glMm)) {
        return { cursor: "ns-resize", title: "GL（地盤レベル）を動かす",
          onMove: (v) => bs.setGlMm(Math.round(toMm(v)) - base) };
      }
      for (let i = 0; i < (bs.floors || []).length; i++) {
        const fl = base + (bs.floors[i].flMm || 0);
        if (i > 0 && near(fl)) {
          return { cursor: "ns-resize", title: `${bs.floors[i].name || `${i + 1}FL`} の床レベルを動かす`,
            onMove: (v) => bs.setFloorFlMm(i, Math.round(toMm(v)) - base) };
        }
        if (near(fl + ceilingHeightOf(bs, i))) {
          return { cursor: "ns-resize", title: `${bs.floors[i].name || `${i + 1}FL`} の天井高（CL）を動かす`,
            onMove: (v) => bs.setCeilingHeightAt(i, Math.round(toMm(v)) - fl) };
        }
      }
      return null;
    }
    return null;
  };

  if (!viewKey || !chains || !visible) return null;

  const { hMin, hMax, vMin, vMax } = bounds;
  if (!(hMax > hMin) || !(vMax > vMin)) return null;

  // 断面線の既定長さもこの値を基準にする（utils/planBounds に集約）
  const gap = w(DIM_COL_GAP_MM);   // 列の間隔
  const off0 = w(DIM_COL_OFFSET_MM);  // 図面から1列目までの距離
  const tick = w(70);
  const lblGap = w(150);
  const lineCommon = {
    color: INK, lineWidth: 1.4, transparent: true, opacity: 0.95,
    depthTest: false, userData: { ignoreClipping: true },
  };

  // world 軸と「画面の向き」の対応。ここを取り違えると上下・左右が逆の辺に寸法が出る。
  //   平面(TOP)   … 画面の上 = −Z（北が上の約束）→ v 軸は画面と逆向き
  //   断面 RIGHT  … 画面の右 = −Z（−X 方向を見るビュー）→ h 軸は画面と逆向き
  //   断面 FRONT  … 画面の右 = +X / 上 = +Y → どちらも同じ向き
  const hFlip = view === "right";
  const vFlip = view === "plan";
  // 区切りドラッグのレイキャスト平面の高さ（平面図の作図面）。
  const planeY = (sectionClipHeight || w(1500)) * 0.94;

  const sides = [
    { side: "top", along: "h", lo: hMin, hi: hMax, base: vFlip ? vMin : vMax, sign: vFlip ? -1 : +1 },
    { side: "bottom", along: "h", lo: hMin, hi: hMax, base: vFlip ? vMax : vMin, sign: vFlip ? +1 : -1 },
    { side: "left", along: "v", lo: vMin, hi: vMax, base: hFlip ? hMax : hMin, sign: hFlip ? +1 : -1 },
    { side: "right", along: "v", lo: vMin, hi: vMax, base: hFlip ? hMin : hMax, sign: hFlip ? -1 : +1 },
  ];

  return (
    <group renderOrder={9000} userData={{ ignoreClipping: true }}>
      {sides.map(({ side, along, lo, hi, sign, base }) =>
        (chains[side] || []).map((column, ci) => {
          const marks = applyRemoved(marksFor(column.source, along, lo, hi), side, column.source);
          if (marks.length < 2) return null;
          const at = base + sign * (off0 + gap * ci);       // この列の位置（列軸に直交する方向）
          const lbl = at + sign * lblGap;
          // 列軸に沿った点 → world。along="h" なら (t, at)、"v" なら (at, t)。
          const pt = (t, cross) => (along === "h" ? P(t, cross) : P(cross, t));
          const strong = column.source === "total";
          return (
            <React.Fragment key={`${side}-${column.id}`}>
              <Line points={[pt(marks[0], at), pt(marks[marks.length - 1], at)]} {...lineCommon} />
              {marks.map((m, i) => (
                <Line key={`t-${i}`} points={[pt(m, at - tick), pt(m, at + tick)]} {...lineCommon} />
              ))}
              {/* 内側の区切りは、刻み元の実体（通り芯 / レベル）をドラッグで動かせる。 */}
              {marks.slice(1, -1).map((m, i) => {
                const drag = resolveMarkDrag(column.source, along, m);
                if (!drag) return null;
                return (
                  // key に位置を入れない。入れるとドラッグ中に key が変わって
                  // ハンドルが作り直され、掴んだ状態が外れてしまう。
                  <MarkDragHandle
                    key={`mh-${column.id}-${i}`}
                    position={pt(m, at)}
                    view={view}
                    planeY={planeY}
                    along={along}
                    cursor={drag.cursor}
                    title={drag.title}
                    onMove={drag.onMove}
                    onCommit={drag.onCommit}
                  />
                );
              })}
              {marks.slice(0, -1).map((m, i) => {
                const a = m;
                const b = marks[i + 1];
                if (b - a < w(120)) return null;
                // × はこの寸法の「終わり側の区切り」を消す（最後の区間は始まり側）。
                const cut = i === marks.length - 2 ? a : b;
                const isEnd = cut === marks[0] || cut === marks[marks.length - 1];
                return (
                  <ChainTag
                    key={`v-${i}`}
                    position={pt((a + b) / 2, lbl)}
                    valueMm={toMm(b - a)}
                    strong={strong}
                    title={`${CHAIN_TITLE[column.source]}（${SIDE_TITLE[side]}）`}
                    onDelete={isEnd ? undefined : () =>
                      useDimChainStore.getState().removeMark(markKey(viewKey, side, column.source, toMm(cut)))}
                  />
                );
              })}
            </React.Fragment>
          );
        }),
      )}
    </group>
  );
}

const CHAIN_TITLE = { total: "総寸法", grid: "通り芯間", wall: "壁面", level: "階レベル" };
const SIDE_TITLE = { top: "上", bottom: "下", left: "左", right: "右" };
