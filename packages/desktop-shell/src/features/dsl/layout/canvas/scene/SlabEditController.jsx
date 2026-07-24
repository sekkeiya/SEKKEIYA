// SlabEditController — 平面図(Top)で選択中の床（スラブ）を編集するハンドル。
//   ・面（ポリゴン内側）: ホバーで move カーソル。ドラッグで床全体を平行移動。
//   ・辺: ホバーで「辺に直交する向き」の resize カーソル。ドラッグで辺を法線方向へ移動
//        （＝その辺を伸縮）。軸に平行な辺は他頂点との整列スナップ＋ガイド線あり。
//   ・辺の中点の小ハンドル: ドラッグでその辺に頂点を挿入して動かす（辺を折る）
//   ・床を選択すると中心（重心）に移動ギズモが常時出る（Item・壁と同じ）。X/Z 軸で
//     床全体を正確に平行移動できる。頂点を選択している間はそちらのギズモを優先する。
//   ・各頂点の丸ハンドル: ホバーは既定カーソルのまま（クリックして選択する対象のため）。
//       ドラッグで直接移動（離して確定。ドラッグ中は右クリック / Escape で取消＝元位置へ戻す）。
//       クリック（動かさず離す）はその頂点の「選択」で、Item と同じ移動ギズモ（VertexGizmo）
//       が出て X/Z 軸で正確に動かせる。
//       スナップは Shift 押下中のみ: 他頂点/壁端点へ完全吸着 → 隣接頂点と同じX/Z（＝辺が
//       水平/垂直＝直交スナップ）→ 他の頂点と同じX/Z（整列。ガイド線を表示）→ 50mmグリッド。
//       Shift を押していなければ自由配置（1mm 丸めのみ）。
//   ・Delete: 選択中の頂点を削除（3頂点未満になる操作は無視）
//   ・Alt+ドラッグ（面/辺/頂点）: 掴んだ床を複製する。元の床はその場に残り、動かした形の
//       コピーができて選択が移る（部屋 ZoneActiveGizmo の Alt+ドラッグ複製と同じ操作感）。
//       ドラッグ中はカーソルが copy になり、複製になることが分かる。
//   ヒットの優先順位は y の高さで決める（面 < 辺 < 中点 < 頂点。Top ビューは上から見るので
//   高い方が先に当たる）。ドラッグ中はローカル更新のみ、離した時に Base へ永続化する（壁と同じ）。
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useBuildingSpecStore, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useSlabStore, SLAB_MIN_POINTS } from "../../store/useSlabStore";
import { useWallStore } from "../../store/useWallStore";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { wallTopLiftMm } from "../../utils/handleLift";
import { gridSnap } from "../../utils/drawSnap";
import { useHoverCursor } from "./useHoverCursor";
import VertexGizmo from "./VertexGizmo.jsx";

const PT_SNAP_MM = 250;   // 他頂点／壁端点への吸着距離
const ALIGN_MM = 120;     // 「同じX/Z」に揃えるアライメント吸着距離
const HANDLE_COLOR = "#38bdf8";
const MID_COLOR = "#a5f3fc";
const GUIDE_COLOR = "#22d3ee";

// ハンドルの大きさ・掴み判定はスクリーンpx基準（ズームに依らず一定の操作感。ZoneActiveGizmo と同じ方針）。
// ワールド固定寸法にすると、ズームアウト時に画面上で数pxになって掴めなくなる。
const HANDLE_PX = 4.5;    // 頂点ハンドルの半径(px)
const OUTLINE_PX = 1.2;   // ハンドルの白フチ（濃い背景でも埋もれないように）
const MID_PX = 3.5;       // 中点（＋）ハンドルの半径(px)
const EDGE_TOL_PX = 11;   // 辺の掴み判定の半幅(px)
// 見た目は小さくても掴みやすいよう、当たり判定は見た目より大きくとる（透明ヒット）。
const HANDLE_HIT_PX = 14;

// グリッド丸めは表示中の床グリッド（gridCellSizeMm）に合わせる（Shift 押下中のみ使用）。
const snap = gridSnap;
// useFrame 内で毎フレーム使う視線ベクトルのスクラッチ（アロケーション回避）
const _viewDir = new THREE.Vector3();

/** 面のヒット領域用ジオメトリ（XY形状 → XZ平面）。 */
function makeFaceGeo(pts, k) {
  const s = new THREE.Shape();
  s.moveTo(pts[0].x * k, -pts[0].z * k);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x * k, -pts[i].z * k);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * 辺の向き（world XZ）→ 画面上で「辺に直交する向き」の resize カーソル。
 * 画面角 = world角 + rotIndex×(-90°)（方位記号と同じ規約）。ドラッグ方向は辺の法線なので +90°。
 */
function edgeResizeCursor(dx, dz, rotIndex) {
  const a = Math.atan2(dz, dx) - (rotIndex * Math.PI) / 2;
  let deg = ((a * 180) / Math.PI + 90) % 180;
  if (deg < 0) deg += 180;
  if (deg < 22.5 || deg >= 157.5) return "ew-resize";
  if (deg < 67.5) return "nwse-resize";
  if (deg < 112.5) return "ns-resize";
  return "nesw-resize";
}

// gizmoOnly: 立面/断面（側面正射）用。視線が水平で床平面と交わらず toFloor が成立しないため、
//   面/辺/頂点ハンドルのドラッグは使えない。移動ギズモ（床平面に依存しない）だけを出す。
export default function SlabEditController({ enabled = true, orbitRef = null, sideAxis = null }) {
  // sideAxis: 立面/断面（側面正射）で「画面の横方向」に当たる世界軸（FRONT="x" / RIGHT="z"）。
  //   null = 平面図（従来どおりハンドル操作あり）。
  const gizmoOnly = !!sideAxis;
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const slabs = useSlabStore((s) => s.slabs);
  const selectedSlabId = useSlabStore((s) => s.selectedSlabId);
  const selectedSlabIds = useSlabStore((s) => s.selectedSlabIds);
  const drawActive = useSlabStore((s) => s.drawActive);
  const selectedEdgeIndices = useSlabStore((s) => s.selectedEdgeIndices);
  const wallDrawKind = useWallStore((s) => s.drawKind);
  const walls = useWallStore((s) => s.walls);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const floors = useBuildingSpecStore((s) => s.floors);

  // 選択中スラブの「基準レベル」(mm)。床=FL / 天井(role="ceiling")=CL。
  //   FloorSlabsRenderer と同じ規約（オフセット 0 のスラブの上面）。選択中のスラブがある階に
  //   合わせる（3D/断面で他階の床を選んでもハンドルがその階に出る）。
  //   ⚠️ 天井は必ず CL 基準にすること。FL のままだと断面で天井を選択したのに
  //      ギズモ・上下左右ハンドルが床レベルに出て「選択できていない」ように見え、
  //      上端ドラッグの offsetYMm も CL 基準（レンダラーの貼り位置）とズレる。
  const floorBaseYMm = useMemo(() => {
    const sel = slabs.find((x) => x.id === selectedSlabId);
    const idx = sel ? (sel.floorIndex || 0) : (activeFloorIndex || 0);
    const i = Math.max(0, Math.min(idx, (floors?.length || 1) - 1));
    const fl = (fl0Mm || 0) + (floors?.[i]?.flMm || 0);
    if (sel?.role === "ceiling") return fl + ceilingHeightOf(useBuildingSpecStore.getState(), i);
    return fl;
  }, [fl0Mm, floors, activeFloorIndex, slabs, selectedSlabId, ceilingHeightMm, floorHeightMm]);

  // ハンドルを浮かせる高さ(mm)。いちばん高い壁の「頭」より上に置く（下の yEdge/y の説明を参照）。
  //   ⚠️ 壁の高さだけで計算しないこと。壁は各階の FL に建ち上下オフセットも載るので、
  //      高さだけだと壁の頭より下に潜り、壁と重なった頂点が掴めなくなる（utils/handleLift）。
  const handleLiftMm = useMemo(
    () => wallTopLiftMm(walls, useBuildingSpecStore.getState()),
    [walls, floorHeightMm, ceilingHeightMm, fl0Mm, floors],
  );

  const rotIndex = useEditorModeStore((s) => s.layoutCameraRotationIndex) || 0;
  // カーソルは canvas に当てる（body だと他コントローラの canvas 指定に負けて効かなくなる）
  const cursorApi = useHoverCursor();

  const { camera, gl } = useThree();
  // drag = { mode:'vertex'|'edge'|'move', slabId, index, grab, orig(points) }
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;
  // 選択中の頂点（Delete の対象＋Item と同じ移動ギズモの取り付け先）
  const [activeVertex, setActiveVertex] = useState(null);
  // ギズモのドラッグ開始時に元の頂点列を控える
  const gizmoOrigRef = useRef(null);
  // 整列スナップ中のガイド線（揃えた基準の X / Z）
  const [guides, setGuides] = useState({ x: null, z: null });
  // ギズモ（PivotControls）は onMove で修飾キーを渡してくれないので、Shift の押下状態を
  // 自前で持つ。ハンドルの直接ドラッグは pointer イベントの ev.shiftKey を使うが、
  // 「頂点を選択 → ギズモで動かす」経路はこちらを見る。
  const shiftRef = useRef(false);
  useEffect(() => {
    const onKey = (e) => { shiftRef.current = !!e.shiftKey; };
    // ウィンドウがフォーカスを失うと keyup を取りこぼす（押しっぱなし扱いのまま固まる）。
    const onBlur = () => { shiftRef.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  // ＋ハンドルのホバー（強調表示用）
  const [hoverMid, setHoverMid] = useState(null);
  // 頂点ハンドルのホバー（拡大して掴みやすさを示す）
  const [hoverVertex, setHoverVertex] = useState(null);
  // 断面(gizmoOnly)の縦リサイズ: "top"=レベル(上下オフセット) / "bottom"=厚み。
  const [secEdge, setSecEdge] = useState(null);
  const secOrigRef = useRef(null);
  // 断面(gizmoOnly)の横リサイズ: "left"/"right"。反対側の辺を固定してスラブを横に伸縮する。
  const [secH, setSecH] = useState(null);
  const secHOrigRef = useRef(null);

  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  // ハンドル面の高さ（world単位）。useFrame（パースの距離計算）からも参照するので ref に流す。
  // handleLiftMm は world 絶対値（壁の頭 + 余裕）なので gridHeightMm を足さない。
  // 作図グリッドを高く上げている場合はそちらより上に来るよう大きい方を採る。
  const liftY = Math.max(handleLiftMm, gridHeightMm + 200) * k;
  const handleYRef = useRef(liftY);
  handleYRef.current = liftY;

  // スクリーン1px ＝ ワールド何単位か（毎フレーム追従）。
  //   直交: 1/zoom。透視: 視線とハンドル面（水平面）の交点までの距離から換算する。
  //   固定値のフォールバックだと mm スケールのシーンで頂点が数mm相当＝見えなくなる。
  const pxWorldRef = useRef(4);
  const [pxWorld, setPxWorld] = useState(4);
  useFrame(({ camera: cam, size }) => {
    let pw;
    if (cam.isOrthographicCamera) {
      pw = 1 / Math.max(cam.zoom, 1e-6);
    } else {
      cam.getWorldDirection(_viewDir);
      let dist = Math.abs(_viewDir.y) > 1e-4
        ? (handleYRef.current - cam.position.y) / _viewDir.y
        : Infinity;
      // 面を向いていない（ほぼ水平視線など）ときは鉛直距離で代用
      if (!(dist > 0) || !Number.isFinite(dist)) {
        dist = Math.max(Math.abs(cam.position.y - handleYRef.current), 1);
      }
      pw = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov || 50) / 2)) / Math.max(size.height, 1);
    }
    // 微小変化で再レンダーしないよう 8% 以上の変化のみ反映
    if (Math.abs(pw - pxWorldRef.current) > pxWorldRef.current * 0.08) {
      pxWorldRef.current = pw;
      setPxWorld(pw);
    }
  });

  const slab = slabs.find((s) => s.id === selectedSlabId) || null;
  // 作図ツール使用中はハンドルを出さない（クリックが競合するため）
  const active = enabled && !!slab && !drawActive && !wallDrawKind;

  const toFloor = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect();
    const v2 = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(v2, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gridHeightMm * k);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x / k, z: hit.z / k };
  }, [camera, gl, gridHeightMm, k]);

  /**
   * 頂点スナップ。snapOn（＝Shift 押下中）のときだけ効く。
   *   1) 他の頂点／壁端点へ完全吸着（PT_SNAP_MM）
   *   2) 隣接頂点（前後）と同じ X / Z へ揃える ＝ 辺が水平/垂直になる（直交スナップ）
   *   3) その他の頂点・壁端点と同じ X / Z へ揃える（整列スナップ）
   *   4) 50mm グリッド
   * Shift を押していないときは自由配置（1mm 丸めのみ）。
   * 揃えた基準値は guides として返し、ガイド線の描画に使う。
   */
  const snapVertex = useCallback((pt, selfId, selfIndex, snapOn) => {
    if (!snapOn) {
      return { p: { x: Math.round(pt.x), z: Math.round(pt.z) }, guides: { x: null, z: null } };
    }
    const cands = [];
    for (const s of useSlabStore.getState().slabs) {
      s.points.forEach((p, i) => {
        if (s.id === selfId && i === selfIndex) return;
        cands.push(p);
      });
    }
    for (const w of useWallStore.getState().walls) { cands.push(w.start); cands.push(w.end); }

    // 1) 完全吸着（頂点そのものに乗せる）
    let best = null, bestD = PT_SNAP_MM;
    for (const c of cands) {
      const d = Math.hypot(c.x - pt.x, c.z - pt.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) return { p: { x: best.x, z: best.z }, guides: { x: best.x, z: best.z } };

    let x = pt.x, z = pt.z, gx = null, gz = null;
    // 2) 隣接頂点＝直交スナップ（辺を水平/垂直に保つ）を最優先で見る
    const self = useSlabStore.getState().slabs.find((s) => s.id === selfId);
    const n = self?.points.length || 0;
    const ordered = [];
    if (n >= 2 && selfIndex != null) {
      ordered.push(self.points[(selfIndex - 1 + n) % n], self.points[(selfIndex + 1) % n]);
    }
    // 3) 続いてその他の候補で整列
    ordered.push(...cands);
    for (const c of ordered) {
      if (gx === null && Math.abs(c.x - x) <= ALIGN_MM) { x = c.x; gx = c.x; }
      if (gz === null && Math.abs(c.z - z) <= ALIGN_MM) { z = c.z; gz = c.z; }
      if (gx !== null && gz !== null) break;
    }
    // 揃わなかった軸だけグリッドに乗せる
    return {
      p: { x: gx !== null ? x : snap(x), z: gz !== null ? z : snap(z) },
      guides: { x: gx, z: gz },
    };
  }, []);

  /** 軸に平行な辺を動かすときの整列候補（他の頂点・壁端点の x / z 値）。 */
  const axisCandidates = useCallback((axis, selfId, movedIdx) => {
    const out = [];
    for (const s of useSlabStore.getState().slabs) {
      s.points.forEach((p, i) => {
        if (s.id === selfId && movedIdx.includes(i)) return;
        out.push(p[axis]);
      });
    }
    for (const w of useWallStore.getState().walls) { out.push(w.start[axis]); out.push(w.end[axis]); }
    return out;
  }, []);

  useEffect(() => {
    if (!drag || gizmoOnly) return; // 立面/断面ではハンドル操作不可（ギズモのみ）
    const st = useSlabStore.getState();

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      // 配置/移動中はカーソルを十字の移動アイコンで固定
      // （他ハンドルの上を通っても resize 等に変わらないように）。
      // Alt 押下中は複製カーソル（部屋の Alt+ドラッグ複製と同じ操作感）。
      cursorApi.set(ev.altKey ? "copy" : "move");
      const pt = toFloor(ev.clientX, ev.clientY);
      if (!pt) return;

      // 辺を法線方向へ移動（＝その辺を伸縮）
      if (d.mode === "edge") {
        const n = d.orig.length;
        const i0 = d.index;
        const i1 = (d.index + 1) % n;
        const p0 = d.orig[i0];
        const p1 = d.orig[i1];
        const ex = p1.x - p0.x, ez = p1.z - p0.z;
        const elen = Math.hypot(ex, ez) || 1;
        const nx = -ez / elen, nz = ex / elen; // 辺の法線
        let amt = (pt.x - d.grab.x) * nx + (pt.z - d.grab.z) * nz;

        let gx = null, gz = null;
        // スナップは Shift 押下中のみ。軸に平行な辺は他の頂点へ整列（＋グリッド）。
        const axis = Math.abs(nx) > 0.99 ? "x" : Math.abs(nz) > 0.99 ? "z" : null;
        if (!ev.shiftKey) {
          amt = Math.round(amt); // 自由配置（1mm 丸めのみ）
        } else if (axis) {
          const sign = axis === "x" ? nx : nz;
          const target = p0[axis] + sign * amt;
          let hit = null;
          for (const c of axisCandidates(axis, d.slabId, [i0, i1])) {
            if (Math.abs(c - target) <= ALIGN_MM) { hit = c; break; }
          }
          const finalV = hit != null ? hit : snap(target);
          amt = (finalV - p0[axis]) / sign;
          if (hit != null) { if (axis === "x") gx = hit; else gz = hit; }
        } else {
          amt = snap(amt);
        }
        if (Math.abs(amt) >= 1) d.moved = true; // 実際に動いた（クリック選択と区別する）
        setGuides({ x: gx, z: gz });
        st.updateSlabLocal(d.slabId, {
          points: d.orig.map((q, i) =>
            i === i0 || i === i1 ? { x: q.x + nx * amt, z: q.z + nz * amt } : q,
          ),
        });
        return;
      }

      if (d.mode === "move") {
        // スナップ（50mmグリッド）は Shift 押下中のみ
        const rd = ev.shiftKey ? snap : Math.round;
        const dx = rd(pt.x - d.grab.x);
        const dz = rd(pt.z - d.grab.z);
        if (dx || dz) d.moved = true; // 実際に動いた（クリックや Alt+クリックの空複製と区別する）
        st.updateSlabLocal(d.slabId, {
          points: d.orig.map((p) => ({ x: p.x + dx, z: p.z + dz })),
        });
        return;
      }
      // 頂点: クリック（選択＝ギズモを出す）とドラッグ（移動）を区別する遊び。
      // 数px 動くまで移動を始めない（雑なクリックで頂点が数mmズレて保存されるのを防ぐ）。
      if (!d.moved) {
        if (Math.hypot(pt.x - d.grab.x, pt.z - d.grab.z) < (3 * pxWorldRef.current) / k) return;
        d.moved = true;
      }
      const { p, guides: g } = snapVertex(pt, d.slabId, d.index, ev.shiftKey);
      setGuides(g);
      const next = d.orig.map((q, i) => (i === d.index ? p : q));
      st.updateSlabLocal(d.slabId, { points: next });
    };

    /** 操作を終える（確定 or 取消の後始末）。 */
    const finish = () => {
      setDrag(null);
      setGuides({ x: null, z: null });
      cursorApi.clear();
      useViewportUiStore.getState().setGizmoDragging?.(false);
    };

    const onUp = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      // すべてドラッグ式（押して動かし、離して確定）。
      if (d.mode === "edge" && !d.moved) {
        // 辺を「動かさずにクリック」した場合は選択トグル（壁の一括作成に使う）。
        useSlabStore.getState().toggleEdgeIndex(d.index);
      } else if (d.mode === "vertex" && !d.moved) {
        // 頂点のクリック＝選択のみ（activeVertex は begin で設定済み。ギズモが出る）。保存は不要。
      } else if (ev?.altKey && d.moved) {
        // Alt+ドラッグ複製（部屋の ZoneActiveGizmo と同じ）: いま編集した形で床を複製し、
        // 元の床は掴む前の位置へ戻す。移動・辺の伸縮・頂点移動のどれからでも複製できる。
        const cur = useSlabStore.getState().slabs.find((x) => x.id === d.slabId);
        useSlabStore.getState().duplicateSlab(d.slabId, cur ? cur.points : d.orig, d.orig);
        setActiveVertex(null); // 複製後は新しい床の主選択に切り替わる
      } else {
        useSlabStore.getState().persistSlabs();
      }
      finish();
    };

    // ドラッグ中の右クリック = 取消（掴む前の位置へ戻す）
    const onDown = (ev) => {
      const d = dragRef.current;
      if (!d || d.mode !== "vertex") return;
      if (ev.button !== 2) return;
      ev.preventDefault();
      ev.stopPropagation();
      useSlabStore.getState().updateSlabLocal(d.slabId, { points: d.orig });
      finish();
    };

    // Escape = 取消
    const onKey = (ev) => {
      const d = dragRef.current;
      if (!d || ev.key !== "Escape") return;
      ev.stopPropagation();
      useSlabStore.getState().updateSlabLocal(d.slabId, { points: d.orig });
      finish();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [drag, toFloor, snapVertex, axisCandidates, cursorApi, gizmoOnly]);

  // 別の床を選び直したら頂点選択は解除（前の床の index が残らないように）
  useEffect(() => { setActiveVertex(null); }, [selectedSlabId]);

  // Delete: 選択中の頂点を削除（3頂点は維持）
  useEffect(() => {
    if (!active || activeVertex == null) return;
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      // 頂点を選択している間の Delete は必ず「頂点の削除」。
      // ここで止めないと LayoutShell の「床ごと削除」に落ちてしまう（三角形のときに顕著）。
      e.preventDefault();
      e.stopPropagation();
      const s = useSlabStore.getState().slabs.find((x) => x.id === selectedSlabId);
      if (!s || s.points.length <= SLAB_MIN_POINTS) return; // 三角形は割らない（床も消さない）
      useSlabStore.getState().updateSlab(selectedSlabId, {
        points: s.points.filter((_, i) => i !== activeVertex),
      });
      useSlabStore.getState().clearEdgeSelection(); // 頂点が減ると辺 index がずれるため
      setActiveVertex(null);
    };
    // capture で LayoutShell の「床ごと削除」より先に頂点削除を処理する
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, activeVertex, selectedSlabId]);

  // 面のヒット領域ジオメトリ（頂点が変わるたびに作り直し、前のものは破棄）
  const faceGeo = useMemo(
    () => (slab?.points?.length >= 3 ? makeFaceGeo(slab.points, k) : null),
    [slab?.points, k],
  );
  useEffect(() => () => { faceGeo?.dispose(); }, [faceGeo]);
  // ハンドルが消えるときにカーソル／ホバー状態を戻す（pointerOut が来ないケースの保険）
  useEffect(() => {
    if (!active) { cursorApi.clear(); setHoverVertex(null); setHoverMid(null); }
    return () => { cursorApi.clear(); };
  }, [active]);

  // 断面(gizmoOnly)での縦リサイズ。上端ハンドル=レベル(offsetYMm)/下端ハンドル=厚み。
  //   断面はカメラが sideAxis に沿って見るので、その視線に直交する鉛直平面へレイキャストして
  //   ポインタの世界Yを取る。スナップ: 上端は床レベル(offset 0)へ吸着＋50mmグリッド、下端は50mm。
  useEffect(() => {
    if (!secEdge || !gizmoOnly) return;
    const el = gl.domElement;
    const normal = sideAxis === "x" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const ray = new THREE.Raycaster();
    const v2 = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const onMove = (ev) => {
      const o = secOrigRef.current; if (!o) return;
      const rect = el.getBoundingClientRect();
      v2.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(v2, camera);
      const plane = new THREE.Plane(normal, -o.planeAt);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      let yMm = hit.y / k;
      if (secEdge === "top") {
        yMm = Math.abs(yMm - o.floorBaseYMm) < 120 ? o.floorBaseYMm : Math.round(yMm / 50) * 50;
        useSlabStore.getState().updateSlabLocal(o.slabId, { offsetYMm: Math.round(yMm - o.floorBaseYMm) });
      } else {
        yMm = Math.round(yMm / 50) * 50;
        const t = Math.max(50, Math.round(o.topY - yMm)); // 上端は保持、下端で厚み
        useSlabStore.getState().updateSlabLocal(o.slabId, { thicknessMm: t });
      }
    };
    const onUp = () => {
      useSlabStore.getState().persistSlabs();
      setSecEdge(null);
      useViewportUiStore.getState().setGizmoDragging?.(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [secEdge, gizmoOnly, sideAxis, camera, gl, k]);

  // 断面(gizmoOnly)での横リサイズ。左/右ハンドルを掴むと、反対側の辺を固定したまま
  //   スラブを横方向（sideAxis）に伸縮する（＝スラブの横幅を変える）。多角形でも破綻しないよう
  //   反対辺を基準にした一様スケールで全頂点の sideAxis 座標を動かす（矩形なら＝辺の移動と同じ）。
  //   縦ハンドルと同じく、視線に直交する鉛直面へレイキャストしてポインタの横位置(mm)を取る。
  useEffect(() => {
    if (!secH || !gizmoOnly) return;
    const el = gl.domElement;
    const normal = sideAxis === "x" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const ray = new THREE.Raycaster();
    const v2 = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const onMove = (ev) => {
      const o = secHOrigRef.current; if (!o) return;
      const rect = el.getBoundingClientRect();
      v2.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(v2, camera);
      const plane = new THREE.Plane(normal, -o.planeAt);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      let hMm = (sideAxis === "x" ? hit.x : hit.z) / k;
      hMm = ev.shiftKey ? Math.round(hMm / 50) * 50 : Math.round(hMm); // Shift=50mm 刻み
      const span = o.maxH - o.minH;
      if (span <= 1) return;
      let scale, anchor;
      if (secH === "right") {
        anchor = o.minH;
        scale = (hMm - anchor) / span;
      } else {
        anchor = o.maxH;
        scale = (anchor - hMm) / span;
      }
      scale = Math.max(scale, 50 / span); // 最小幅 50mm（潰れ・反転を防ぐ）
      const next = o.points.map((p) => {
        const v = p[sideAxis];
        const nv = secH === "right"
          ? anchor + (v - anchor) * scale
          : anchor - (anchor - v) * scale;
        return sideAxis === "x" ? { ...p, x: Math.round(nv) } : { ...p, z: Math.round(nv) };
      });
      useSlabStore.getState().updateSlabLocal(o.slabId, { points: next });
    };
    const onUp = () => {
      useSlabStore.getState().persistSlabs();
      setSecH(null);
      useViewportUiStore.getState().setGizmoDragging?.(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [secH, gizmoOnly, sideAxis, camera, gl, k]);

  if (!active || !faceGeo) return null;

  // ヒットの優先順位は y の高さで決める（Top ビューは上から見るので高い方が先に当たる）。
  // 面だけは床の上（低い位置）に置く: 高く上げると床の外まで面のヒットが被さり、
  // 壁のクリックや余白クリックを奪ってしまうため。
  const yFace = (gridHeightMm + 21) * k;
  // 辺・中点・頂点は「壁の立体より上」へ逃がす。壁は床から階高（〜3000mm）まで立っており、
  // 床すぐ上に置くとトップビューで壁が手前に来て、壁の内側（黒いポシェ）からは
  // レイキャストが壁に先に当たって掴めない（depthTest=false は描画のみで交差判定には効かない）。
  // （立面/断面ではハンドルを出さないので、この高さはギズモには使わない。
  //   ギズモの高さは下の gizmoYMm で実際の床の上面に合わせる。）
  const yLift = liftY;
  const yEdge = yLift;
  const yMid = yLift + 2 * k;
  const y = yLift + 4 * k; // 頂点ハンドル（gizmoOnly ではギズモの取り付け高さとして使う）
  // ハンドル寸法はワールド単位（＝ px × pxWorld）。位置は mm 空間なので * k で world にする。
  const handleR = HANDLE_PX * pxWorld;
  const midR = MID_PX * pxWorld;
  const edgeHalf = EDGE_TOL_PX * pxWorld;
  const hitR = HANDLE_HIT_PX * pxWorld; // 透明の当たり判定（見た目より大きく）
  const pts = slab.points;

  const begin = (mode, index) => (e) => {
    if (e.button !== 0) return; // Shift はスナップ修飾キー（掴む操作は妨げない）
    e.stopPropagation();
    useViewportUiStore.getState().setGizmoDragging?.(true);
    // 頂点以外（面/辺）を触ったら頂点選択は解除 → Delete は「床ごと削除」に戻る
    setActiveVertex(mode === "vertex" ? index : null);
    setDrag({
      mode,
      slabId: slab.id,
      index,
      grab: { x: e.point.x / k, z: e.point.z / k },
      orig: pts.map((p) => ({ ...p })),
    });
  };

  /** 辺の中点をドラッグ → その位置に頂点を挿入してそのまま動かす。 */
  const beginInsert = (edgeIndex, mid) => (e) => {
    if (e.button !== 0) return; // Shift はスナップ修飾キー（掴む操作は妨げない）
    e.stopPropagation();
    useViewportUiStore.getState().setGizmoDragging?.(true);
    const inserted = [...pts.slice(0, edgeIndex + 1), { ...mid }, ...pts.slice(edgeIndex + 1)];
    useSlabStore.getState().clearEdgeSelection(); // 頂点が増えると辺 index がずれるため
    useSlabStore.getState().updateSlabLocal(slab.id, { points: inserted });
    setActiveVertex(edgeIndex + 1);
    setDrag({
      mode: "vertex",
      slabId: slab.id,
      index: edgeIndex + 1,
      grab: { x: e.point.x / k, z: e.point.z / k },
      orig: inserted,
      moved: true, // 挿入自体が変更なので、動かさず離しても保存する
    });
  };

  // ガイド線の長さ（シーン全体を貫く程度）
  const gLen = Math.max((sceneExtentXZ || 0) * 2, isMm ? 20000 : 20);

  // 主選択以外の「選択中」スラブ（範囲選択で複数掛かったときなど）。
  // 頂点は選択状態なら常に見せる。編集ハンドル一式（辺・中点・面）は主選択のみで、
  // こちらの頂点はクリックするとそのスラブを主選択へ昇格して編集に入れる。
  const otherSelected = slabs.filter(
    (s) => s.id !== slab.id && selectedSlabIds.includes(s.id) && s.points?.length >= 3,
  );
  const promote = (id) => (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const st = useSlabStore.getState();
    st.setSelectedSlabIds([id, ...st.selectedSlabIds.filter((x) => x !== id)]);
  };

  // ── 移動ギズモ（Item と同じ PivotControls）──────────────────────────
  //   ・頂点を選択中（activeVertex）はその頂点に取り付けて、X/Z の矢印・平面スライダーで
  //     正確に動かせる。
  //   ・頂点未選択なら、床を選択した時点で「床の中心（重心）」に常時出す（壁と同じ）。
  //     ギズモを掴めば床全体を平行移動できる（面ドラッグと同じ結果を正確な軸移動で）。
  const gizmoVertex =
    activeVertex != null && activeVertex < pts.length ? pts[activeVertex] : null;
  // 床の中心（頂点の重心）。頂点未選択時のギズモ取り付け位置。
  // ここは早期 return より後（＝毎回同じ実行経路）なので、フックではなく素の計算で出す。
  let slabMid = null;
  if (pts.length) {
    let sx = 0, sz = 0;
    for (const p of pts) { sx += p.x; sz += p.z; }
    slabMid = { x: sx / pts.length, z: sz / pts.length };
  }
  // 立面/断面では頂点ハンドルが無く頂点を選べないので、常に「床全体」を動かす。
  // 上下オフセットも床単位のプロパティなので、単位としてもこれが正しい。
  const gizmoPos = gizmoOnly ? slabMid : (gizmoVertex || slabMid);
  const gizmoKind = !gizmoOnly && gizmoVertex ? "vertex" : "move";
  // ギズモの取り付け高さ(mm)。
  //   平面図: ハンドル面（壁より上へ逃がした高さ）。
  //   立面/断面: 実際の床の上面（床レベル＋その床の上下オフセット）。
  const slabOffsetMm = slab?.offsetYMm || 0;
  const gizmoYMm = gizmoOnly ? floorBaseYMm + slabOffsetMm : y / k;
  // 立面/断面は画面に見えている2軸だけ（横＝視線に直交する水平軸／縦＝上下）。
  const gizmoAxes = gizmoOnly
    ? (sideAxis === "x" ? [true, true, false] : [false, true, true])
    : [true, false, true];

  const onGizmoBegin = () => {
    if (gizmoKind === "vertex") {
      gizmoOrigRef.current = { kind: "vertex", index: activeVertex, points: pts.map((p) => ({ ...p })) };
    } else {
      // 床全体を平行移動: 元の頂点列と重心（差分の基準）＋上下オフセットを控える
      gizmoOrigRef.current = {
        kind: "move",
        points: pts.map((p) => ({ ...p })),
        mid: { ...slabMid },
        midY: gizmoYMm,        // 縦ドラッグの基準（ギズモの開始高さ）
        origOffsetY: slabOffsetMm,
      };
    }
  };
  const onGizmoMove = ({ xMm, yMm, zMm }) => {
    const g = gizmoOrigRef.current;
    if (!g) return;
    if (g.kind === "vertex") {
      const orig = g.points[g.index] || { x: xMm, z: zMm };
      // ギズモは軸拘束（X矢印なら X だけ動く）。スナップで拘束していない軸まで動かすと
      // 「X に沿って動かしたつもりが Z もずれる」ので、実際に動いた軸だけ採用する。
      const movedX = Math.abs(xMm - orig.x) > 0.5;
      const movedZ = Math.abs(zMm - orig.z) > 0.5;
      const r = snapVertex({ x: xMm, z: zMm }, slab.id, g.index, shiftRef.current);
      setGuides(shiftRef.current ? r.guides : { x: null, z: null });
      const p = {
        x: movedX ? r.p.x : orig.x,
        z: movedZ ? r.p.z : orig.z,
      };
      useSlabStore.getState().updateSlabLocal(slab.id, {
        points: g.points.map((q, i) => (i === g.index ? p : q)),
      });
      return;
    }
    // move: 重心からの差分を全頂点へ適用（Shift 中は移動量を 50mm 刻みに）
    const rd = shiftRef.current ? snap : Math.round;
    const dx = rd(xMm - g.mid.x);
    const dz = rd(zMm - g.mid.z);
    // 立面/断面の縦ドラッグ: 床レベル(FL)からの上下オフセットを変える
    const dy = g.midY != null && Number.isFinite(yMm) ? Math.round(yMm - g.midY) : 0;
    const patch = { points: g.points.map((q) => ({ x: q.x + dx, z: q.z + dz })) };
    if (dy) patch.offsetYMm = g.origOffsetY + dy;
    useSlabStore.getState().updateSlabLocal(slab.id, patch);
  };
  const onGizmoCommit = () => {
    if (gizmoOrigRef.current) useSlabStore.getState().persistSlabs();
    gizmoOrigRef.current = null;
    setGuides({ x: null, z: null }); // スナップのガイド線を消す
  };

  return (
    // ignoreClipping: ハンドル（頂点・辺・中点）は壁の立体より上へ浮かせてあるので、断面クリップの
    // 対象にすると平面図のカット高さで切られて消える。UI ギズモは断面表現の対象外
    // （SectionClipManager がこの印の付いた枝を飛ばす）。
    <group userData={{ ignoreClipping: true, isDrawnStructure: true }}>
      {/* 整列スナップのガイド線（同じ X / Z に揃っていることを示す） */}
      {guides.x != null && (
        <Line
          points={[[guides.x * k, y, -gLen * k], [guides.x * k, y, gLen * k]]}
          color={GUIDE_COLOR} lineWidth={1} transparent opacity={0.7} depthTest={false}
          dashed dashSize={200 * k} gapSize={140 * k}
        />
      )}
      {guides.z != null && (
        <Line
          points={[[-gLen * k, y, guides.z * k], [gLen * k, y, guides.z * k]]}
          color={GUIDE_COLOR} lineWidth={1} transparent opacity={0.7} depthTest={false}
          dashed dashSize={200 * k} gapSize={140 * k}
        />
      )}

      {/* 面: ホバーで move カーソル、ドラッグで全体移動（透明ヒット領域） */}
      {!gizmoOnly && (
        <mesh
          geometry={faceGeo}
          position={[0, yFace, 0]}
          onPointerDown={begin("move", null)}
          onClick={(e) => e.stopPropagation()}
          // move カーソルは onPointerMove で毎回張り直す（onPointerOver 1回だと、辺/頂点/中点の
          // ハンドルが stopPropagation でこの面のイベントを止めたあと、内側に戻っても move が
          // 復帰しない）。ハンドル上ではハンドル側が stopPropagation するのでここは呼ばれない。
          onPointerMove={() => { if (!dragRef.current) cursorApi.set("move"); }}
          onPointerOut={() => { if (!dragRef.current) cursorApi.clear(); }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 辺: ホバーで直交方向の resize カーソル。ドラッグで辺を伸縮、
          動かさずクリックで選択トグル（選択した辺は Properties の「外壁/内壁を作成」で壁になる）。 */}
      {!gizmoOnly && pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const dx = q.x - p.x, dz = q.z - p.z;
        const len = Math.hypot(dx, dz);
        if (len < 1) return null;
        const cursor = edgeResizeCursor(dx, dz, rotIndex);
        const edgeSelected = selectedEdgeIndices.includes(i);
        return (
          <group key={`e${i}`}>
            <mesh
              position={[((p.x + q.x) / 2) * k, yEdge, ((p.z + q.z) / 2) * k]}
              rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]}
              onPointerDown={begin("edge", i)}
              onClick={(e) => e.stopPropagation()}
              // 辺は「その辺に直交する向き」のリサイズカーソル。下の面(move)へイベントを流すと
              // move で上書きされるので stopPropagation で止める。onPointerMove で毎回張り直す。
              onPointerMove={(e) => { e.stopPropagation(); if (!dragRef.current) cursorApi.set(cursor); }}
              onPointerOver={(e) => { e.stopPropagation(); if (!dragRef.current) cursorApi.set(cursor); }}
              onPointerOut={() => { if (!dragRef.current) cursorApi.clear(); }}
            >
              <planeGeometry args={[len * k, edgeHalf * 2]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {edgeSelected && (
              <Line
                points={[[p.x * k, yEdge, p.z * k], [q.x * k, yEdge, q.z * k]]}
                color={GUIDE_COLOR} lineWidth={3} transparent opacity={0.95} depthTest={false}
              />
            )}
          </group>
        );
      })}

      {/* 頂点ハンドル: 見た目は小さく、当たり判定は大きく（透明）。
          クリックで選択（Delete で削除できる）、ドラッグで移動。 */}
      {!gizmoOnly && pts.map((p, i) => {
        const on = activeVertex === i;
        const hovered = hoverVertex === i;
        // 選択中 > ホバー > 通常 の順に大きく（ホバーで掴みやすさを示す）
        const vr = on ? handleR * 1.5 : hovered ? handleR * 1.25 : handleR;
        return (
          <group key={`v${i}`} position={[p.x * k, y, p.z * k]}>
            {/* 透明の当たり判定 */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={9999}
              onPointerDown={begin("vertex", i)}
              onClick={(e) => { e.stopPropagation(); setActiveVertex(i); }}
              // 頂点は「クリックして選択する」対象なのでホバーでは既定カーソルのまま。
              // 十字（move）は掴んで移動している間だけ（onMove 側で固定する）。
              // 代わりにホバーで少し拡大して、掴めることを示す。
              // 下の面(move)へイベントを流すと move で上書きされるので stopPropagation で止め、
              // 既定カーソル（clear）を張り直す。
              onPointerMove={(e) => { e.stopPropagation(); if (!dragRef.current) cursorApi.clear(); }}
              onPointerOver={(e) => { e.stopPropagation(); if (!dragRef.current) { setHoverVertex(i); cursorApi.clear(); } }}
              onPointerOut={() => { setHoverVertex((h) => (h === i ? null : h)); }}
            >
              <circleGeometry args={[hitR, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* 選択中を示す外周リング（白フチと同化しないよう色付き） */}
            {on && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9998}>
                <ringGeometry args={[handleR * 2.0, handleR * 2.8, 24]} />
                <meshBasicMaterial color={GUIDE_COLOR} transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
              </mesh>
            )}
            {/* 白フチ: 床の塗りや壁ポシェの上でも頂点が沈まないように一回り大きい白を敷く */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9999}>
              <circleGeometry args={[vr + OUTLINE_PX * pxWorld, 16]} />
              <meshBasicMaterial color="#fff" transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
            </mesh>
            {/* 見た目（選択中は白＋拡大 / ホバーで少し拡大） */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10000}>
              <circleGeometry args={[vr, 16]} />
              <meshBasicMaterial
                color={on ? "#fff" : HANDLE_COLOR}
                transparent opacity={1} depthTest={false} side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {/* 辺の中点ハンドル: ＋記号で「頂点を追加できる」ことを示す（ドラッグで挿入して移動）。
          ホバーで拡大＋濃くして、掴めることを分かりやすくする。 */}
      {!gizmoOnly && pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
        const on = hoverMid === i;
        const rr = on ? midR * 1.35 : midR;
        const arm = rr * 0.5;
        return (
          <group key={`m${i}`} position={[mid.x * k, yMid, mid.z * k]}>
            {/* 透明の当たり判定（見た目より大きく） */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={9998}
              onPointerDown={beginInsert(i, mid)}
              onClick={(e) => e.stopPropagation()}
              // ＋ハンドルは「頂点を追加」の copy カーソル。下の面(move)で上書きされないよう
              // stopPropagation で止め、onPointerMove で毎回張り直す。
              onPointerMove={(e) => { e.stopPropagation(); if (!dragRef.current) { setHoverMid(i); cursorApi.set("copy"); } }}
              onPointerOver={(e) => { e.stopPropagation(); if (dragRef.current) return; setHoverMid(i); cursorApi.set("copy"); }}
              onPointerOut={() => { setHoverMid((h) => (h === i ? null : h)); if (!dragRef.current) cursorApi.clear(); }}
            >
              <circleGeometry args={[hitR, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* 見た目 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9999}>
              <circleGeometry args={[rr, 16]} />
              <meshBasicMaterial
                color={on ? HANDLE_COLOR : MID_COLOR}
                transparent opacity={on ? 0.98 : 0.85}
                depthTest={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* ＋ 記号（円より少し上に描いて確実に見せる。90°対称なのでビュー回転でも崩れない） */}
            <Line
              points={[[-arm, rr * 0.02, 0], [arm, rr * 0.02, 0]]}
              color="#0b1020" lineWidth={on ? 2.2 : 1.6} transparent opacity={0.9} depthTest={false}
            />
            <Line
              points={[[0, rr * 0.02, -arm], [0, rr * 0.02, arm]]}
              color="#0b1020" lineWidth={on ? 2.2 : 1.6} transparent opacity={0.9} depthTest={false}
            />
          </group>
        );
      })}

      {/* 移動ギズモ（Item と同じ操作感）: 頂点選択中はその頂点、通常は床の中心（重心）。
          直接ドラッグ中は隠す */}
      {!drag && !secEdge && !secH && gizmoPos && (
        <VertexGizmo
          orbitRef={orbitRef}
          xMm={gizmoPos.x} zMm={gizmoPos.z} yMm={gizmoYMm} k={k}
          axes={gizmoAxes}
          onBegin={onGizmoBegin} onMove={onGizmoMove} onCommit={onGizmoCommit}
        />
      )}

      {/* 断面(gizmoOnly)の縦リサイズハンドル: 上端＝レベル(上下オフセット) / 下端＝厚み。
          横リサイズハンドル: 左/右＝スラブの横幅（反対辺を固定して伸縮）。
          縦は上端＝床レベルへ吸着＋50mm・下端＝50mm刻み、横は Shift 中のみ 50mm 刻み。 */}
      {gizmoOnly && slabMid && (() => {
        const topY = floorBaseYMm + slabOffsetMm;
        const thick = slab.thicknessMm || 150;
        const bottomY = topY - thick;
        const midY = (topY + bottomY) / 2;
        const hx = slabMid.x * k, hz = slabMid.z * k;
        const hr = 7 * pxWorld;
        // 横方向(sideAxis)のスラブ端。左=min / 右=max（切り口の左右に一致する）。
        const hvals = pts.map((p) => p[sideAxis]);
        const minH = Math.min(...hvals);
        const maxH = Math.max(...hvals);
        const begin = (edge) => (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          useViewportUiStore.getState().setGizmoDragging?.(true);
          secOrigRef.current = {
            slabId: slab.id,
            floorBaseYMm,
            topY,
            planeAt: (sideAxis === "x" ? slabMid.z : slabMid.x) * k,
          };
          setSecEdge(edge);
        };
        const beginH = (side) => (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          useViewportUiStore.getState().setGizmoDragging?.(true);
          secHOrigRef.current = {
            slabId: slab.id,
            points: pts.map((p) => ({ ...p })),
            minH, maxH,
            planeAt: (sideAxis === "x" ? slabMid.z : slabMid.x) * k,
          };
          setSecH(side);
        };
        // 左/右ハンドルのワールド位置（縦は上下端の中央、奥行きはスラブ中心＝切り口の面上）。
        const leftPos = sideAxis === "x" ? [minH * k, midY * k, hz] : [hx, midY * k, minH * k];
        const rightPos = sideAxis === "x" ? [maxH * k, midY * k, hz] : [hx, midY * k, maxH * k];
        return (
          <group userData={{ ignoreClipping: true }}>
            <mesh position={[hx, topY * k, hz]} renderOrder={10001} onPointerDown={begin("top")}>
              <sphereGeometry args={[hr, 14, 14]} />
              <meshBasicMaterial color="#38bdf8" depthTest={false} />
            </mesh>
            <mesh position={[hx, bottomY * k, hz]} renderOrder={10001} onPointerDown={begin("bottom")}>
              <sphereGeometry args={[hr, 14, 14]} />
              <meshBasicMaterial color="#a5f3fc" depthTest={false} />
            </mesh>
            {/* 左/右（横幅）ハンドル */}
            <mesh position={leftPos} renderOrder={10001} onPointerDown={beginH("left")}>
              <sphereGeometry args={[hr, 14, 14]} />
              <meshBasicMaterial color="#38bdf8" depthTest={false} />
            </mesh>
            <mesh position={rightPos} renderOrder={10001} onPointerDown={beginH("right")}>
              <sphereGeometry args={[hr, 14, 14]} />
              <meshBasicMaterial color="#38bdf8" depthTest={false} />
            </mesh>
          </group>
        );
      })()}

      {/* 主選択以外の選択中スラブの頂点（選択状態なら常に表示）。クリックで主選択へ昇格。 */}
      {!gizmoOnly && otherSelected.map((s) =>
        s.points.map((p, i) => (
          <group key={`${s.id}_ov${i}`} position={[p.x * k, y, p.z * k]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={9999}
              onPointerDown={promote(s.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <circleGeometry args={[hitR, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9999}>
              <circleGeometry args={[handleR + OUTLINE_PX * pxWorld, 16]} />
              <meshBasicMaterial color="#fff" transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10000}>
              <circleGeometry args={[handleR, 16]} />
              <meshBasicMaterial color={HANDLE_COLOR} transparent opacity={1} depthTest={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
