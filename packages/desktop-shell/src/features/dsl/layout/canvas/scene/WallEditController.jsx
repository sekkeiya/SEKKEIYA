// WallEditController — 平面(Top)/パースで選択中の壁を編集するハンドル。
//   ・両端の丸ハンドル: 端点を移動・延長。ドラッグで直接移動（離して確定。ドラッグ中は
//     右クリック / Escape で取消＝元位置へ戻す）。クリック（動かさず離す）はその端点の
//     「選択」で、Item と同じ移動ギズモ（VertexGizmo）が出て X/Z 軸で正確に動かせる。
//     連結点は1つの頂点として扱う: 掴んだ端点と同一座標にある他の壁の端点も一緒に動く
//     （データは壁ごとの端点のまま。編集時にだけ束ねる）。
//     スナップは Shift 押下中のみ。他の壁の端点＋床（スラブ）の頂点へ完全吸着 → 反対側の
//     端点基準の直交 → 他の壁端点/床頂点と同じX/Zへ整列（ガイド線表示）→ 50mmグリッド。
//     Shift を押していなければ自由配置（1mm 丸めのみ）。
//     端点ハンドルは「選択中の壁すべて」に出す（複数選択でも頂点は見えたまま個別に編集できる）。
//     連結点で重なる端点は1つだけ描く。
//   ・壁を選択すると中心（複数選択は重心）に移動ギズモが常時出る（Item と同じ）。
//     端点を選択している間はそちらのギズモを優先する。
//   ・壁本体（足元の透明ヒット面。平面図のみ）: ドラッグで壁全体を平行移動
//     （複数選択中はまとめて移動。Shift 中は 50mm 刻み。Ctrl/Shift+クリックの
//     選択トグルは素通しして WallsRenderer に任せる）。
//   ・頂点の範囲選択: 余白から Alt+左ドラッグ で矩形選択 → 枠内の壁端点をまとめて選択。
//     選択された頂点はリング表示され、どれかをドラッグすると全頂点が一緒に動く
//     （右クリック/Esc取消。Esc で選択解除）。
//   操作中はローカル更新のみ（updateWallLocal）、確定時に Base へ永続化する。
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useWallStore, WALL_MIN_LENGTH } from "../../store/useWallStore";
import { useSlabStore } from "../../store/useSlabStore";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { useHoverCursor } from "./useHoverCursor";
import VertexGizmo from "./VertexGizmo.jsx";

const SNAP_MM = 50;
const END_SNAP_MM = 250;   // 他の壁端点／床頂点への完全吸着の距離
const ALIGN_MM = 120;      // 「同じX/Z」に揃える整列吸着の距離（通り芯合わせ）
const ORTHO_TOL = 0.28;
const JOINT_TOL = 1;          // 連結点（同一座標の端点）とみなす距離(mm)
const HANDLE_COLOR = "#38bdf8";
const SELECT_COLOR = "#fff";  // 掴んでいる端点の強調色
const MARQUEE_COLOR = "#22d3ee";
// ハンドルの大きさはスクリーンpx基準（ズームに依らず一定の操作感）
const HANDLE_PX = 4.5;
const OUTLINE_PX = 1.2;       // ハンドルの白フチ（濃い背景でも埋もれないように）
// 見た目は小さくても掴みやすいよう、当たり判定は見た目より大きくとる（透明ヒット）
const HANDLE_HIT_PX = 14;

const snap = (v) => Math.round(v / SNAP_MM) * SNAP_MM;
const vKey = (wallId, end) => `${wallId}:${end}`;
// useFrame 内で毎フレーム使う視線ベクトルのスクラッチ（アロケーション回避）
const _viewDir = new THREE.Vector3();

/**
 * 端点の丸ハンドル。
 * ⚠️ 必ずモジュール階層に置くこと。render 関数内で定義すると毎レンダーで別コンポーネント型に
 * なり全ハンドルが再マウントされる。R3F の click は「pointerdown 時にヒットしていたオブジェクト」
 * にしか配送されないため、再マウント後のハンドルには click が届かず、onClick の stopPropagation
 * （＝躯体側の「クリックで選択解除」のブロック）が効かない。結果、端点をクリックした直後に
 * 選択が解除され、ギズモが一瞬で消えるバグになる（床側はインライン描画なので無事だった）。
 */
function Handle({ x, z, y, k, r, hitR, outlineW, active, hovered, onBegin, onOver, onOut }) {
  const hr = active ? r * 1.5 : hovered ? r * 1.25 : r;
  return (
    <group position={[x * k, y, z * k]}>
      {/* 透明の当たり判定（見た目より大きく） */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={9999}
        onPointerDown={onBegin}
        onClick={(e) => e.stopPropagation()} // 躯体側の onClick（選択解除）へ届かせない
        onPointerOver={onOver}
        onPointerOut={onOut}
      >
        <circleGeometry args={[hitR, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* 選択/掴み中を示す外周リング（白フチと同化しないよう色付き） */}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9998}>
          <ringGeometry args={[r * 2.0, r * 2.8, 24]} />
          <meshBasicMaterial color={MARQUEE_COLOR} transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 白フチ: 濃い壁ポシェの上でも頂点が沈まないように一回り大きい白を敷く */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9999}>
        <circleGeometry args={[hr + outlineW, 16]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      {/* 見た目（選択中は白＋拡大 / ホバーで少し拡大） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10000}>
        <circleGeometry args={[hr, 16]} />
        <meshBasicMaterial
          color={active ? SELECT_COLOR : HANDLE_COLOR}
          transparent opacity={1} depthTest={false} side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function WallEditController({ enabled = true, orbitRef = null }) {
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const walls = useWallStore((s) => s.walls);
  const selectedWallId = useWallStore((s) => s.selectedWallId);
  const selectedWallIds = useWallStore((s) => s.selectedWallIds);
  const drawKind = useWallStore((s) => s.drawKind);
  const slabDrawActive = useSlabStore((s) => s.drawActive);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);

  // ハンドルを浮かせる高さ(mm)。いちばん高い壁より上に置く（下の yEnd/yMove の説明を参照）。
  const handleLiftMm = useMemo(() => {
    let maxH = 0;
    for (const w of walls) {
      const h = w.heightMm ?? (w.kind === "exterior" ? floorHeightMm : ceilingHeightMm);
      if (h > maxH) maxH = h;
    }
    return maxH + 200;
  }, [walls, floorHeightMm, ceilingHeightMm]);

  const { camera, gl } = useThree();
  // カーソルは canvas に当てる（body だと他コントローラの canvas 指定に負けて効かなくなる）
  const cursorApi = useHoverCursor();
  // drag =
  //   { mode:'start'|'end', wallId, grab, orig:{start,end}, mates:[{wallId,end,orig}] } 端点（連結点ごと）
  //   { mode:'group', grab, items:[{wallId,end,orig}] }                                 範囲選択した頂点群
  //   { mode:'multi', grab, items:[{wallId, orig:{start,end}}] }                        壁本体ドラッグ（選択壁の平行移動）
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;
  // 端点ハンドルのホバー（拡大して掴みやすさを示す）
  const [hoverMode, setHoverMode] = useState(null);
  // クリックで「選択」された端点 { wallId, end }。Item と同じ移動ギズモを取り付ける対象。
  // null のときは選択中の壁の中心（複数なら重心）にギズモを出す。
  const [picked, setPicked] = useState(null);
  const pickedRef = useRef(null);
  pickedRef.current = picked;
  // ギズモのドラッグ開始時に元位置を控える（差分適用と潰れ防止に使う）
  const gizmoOrigRef = useRef(null);
  // 整列スナップ中のガイド線（揃えた基準の X / Z）
  const [guides, setGuides] = useState({ x: null, z: null });
  // 範囲選択された頂点（[{wallId, end}]）と、選択中の矩形
  const [vertSel, setVertSel] = useState([]);
  const vertSelRef = useRef([]);
  vertSelRef.current = vertSel;
  const [marquee, setMarquee] = useState(null); // { a:{x,z}, b:{x,z} }
  const marqueeRef = useRef(null);
  marqueeRef.current = marquee;

  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  // ハンドル面の高さ（world単位）。useFrame（パースの距離計算）からも参照するので ref に流す。
  const handleBaseY = (gridHeightMm + handleLiftMm) * k;
  const handleYRef = useRef(handleBaseY);
  handleYRef.current = handleBaseY;

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
    if (Math.abs(pw - pxWorldRef.current) > pxWorldRef.current * 0.08) {
      pxWorldRef.current = pw;
      setPxWorld(pw);
    }
  });

  const wall = walls.find((w) => w.id === selectedWallId) || null;
  const toolIdle = enabled && !drawKind && !slabDrawActive;

  // 選択中の壁（複数選択のときはその全部）。頂点は「選択状態なら常に」出す。
  const selectedWalls = useMemo(
    () => walls.filter((w) => selectedWallIds.includes(w.id)),
    [walls, selectedWallIds],
  );
  // 端点ハンドル: 選択中の壁すべての start/end。連結点（同一座標）は1つに畳む。
  //   掴んだときの mates 収集が同一座標の他壁端点を拾うので、代表を1つ描けば足りる。
  const endpointHandles = useMemo(() => {
    const out = [];
    for (const w of selectedWalls) {
      for (const end of ["start", "end"]) {
        const p = w[end];
        if (out.some((o) => Math.hypot(o.p.x - p.x, o.p.z - p.z) <= JOINT_TOL)) continue;
        out.push({ wall: w, end, p });
      }
    }
    return out;
  }, [selectedWalls]);
  const showHandles = toolIdle && endpointHandles.length > 0;
  // 複数選択中のギズモ位置（選択群の重心）
  const multiMid = useMemo(() => {
    if (selectedWalls.length <= 1) return null;
    let sx = 0, sz = 0, n = 0;
    for (const w of selectedWalls) {
      sx += w.start.x + w.end.x;
      sz += w.start.z + w.end.z;
      n += 2;
    }
    return n ? { x: sx / n, z: sz / n } : null;
  }, [selectedWalls]);

  /** クライアント座標 → 床平面(world mm)。 */
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
   * 端点のスナップ（Shift 押下中のみ）。床の頂点編集と同じ水準に揃えている。
   *   1) 他の壁の端点／床（スラブ）の頂点へ完全吸着（END_SNAP_MM）
   *   2) 反対側の端点に対する直交（角度判定。長い壁でも効く）＝壁を水平/垂直に保つ
   *   3) 他の壁端点・床頂点と同じ X / Z へ揃える（整列。通り芯合わせ）
   *   4) 揃わなかった軸だけ 50mm グリッド
   * Shift を押していないときは自由配置（1mm 丸めのみ）。
   * excludeKeys: 一緒に動いている端点（自分＋連結点）は候補から外す（自分に吸着して固まるため）。
   * 揃えた基準値は guides として返し、ガイド線の描画に使う。
   */
  const snapEndpoint = useCallback((pt, fixed, excludeKeys, snapOn) => {
    if (!snapOn) return { p: { x: Math.round(pt.x), z: Math.round(pt.z) }, guides: { x: null, z: null } };

    // 候補点: 他の壁の端点（連動中は除外）＋ 床（スラブ）の頂点
    const cands = [];
    for (const o of useWallStore.getState().walls) {
      for (const end of ["start", "end"]) {
        if (excludeKeys.has(vKey(o.id, end))) continue;
        cands.push(o[end]);
      }
    }
    for (const s of useSlabStore.getState().slabs) for (const p of s.points || []) cands.push(p);

    // 1) 完全吸着（点そのものに乗せる）
    let best = null, bestD = END_SNAP_MM;
    for (const c of cands) {
      const d = Math.hypot(c.x - pt.x, c.z - pt.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) return { p: { x: best.x, z: best.z }, guides: { x: best.x, z: best.z } };

    let x = pt.x, z = pt.z, gx = null, gz = null;
    // 2) 反対側の端点に対する直交（角度判定なので長い壁でも吸い付く）
    if (fixed) {
      const dx = x - fixed.x, dz = z - fixed.z;
      if (dx !== 0 || dz !== 0) {
        const ang = Math.atan2(Math.abs(dz), Math.abs(dx));
        if (ang < ORTHO_TOL) { z = fixed.z; gz = fixed.z; }
        else if (ang > Math.PI / 2 - ORTHO_TOL) { x = fixed.x; gx = fixed.x; }
      }
    }
    // 3) 他の壁端点・床頂点と同じ X / Z へ整列
    for (const c of cands) {
      if (gx === null && Math.abs(c.x - x) <= ALIGN_MM) { x = c.x; gx = c.x; }
      if (gz === null && Math.abs(c.z - z) <= ALIGN_MM) { z = c.z; gz = c.z; }
      if (gx !== null && gz !== null) break;
    }
    // 4) 揃わなかった軸だけグリッドに乗せる
    return {
      p: { x: gx !== null ? x : snap(x), z: gz !== null ? z : snap(z) },
      guides: { x: gx, z: gz },
    };
  }, []);

  // ── ドラッグ／配置処理（window で追従） ─────────────────────
  useEffect(() => {
    if (!drag) return;
    const st = useWallStore.getState();

    /** 取消: 掴む前の位置へ戻す。 */
    const restore = (d) => {
      if (d.mode === "group") {
        for (const it of d.items) st.updateWallLocal(it.wallId, { [it.end]: it.orig });
        return;
      }
      if (d.mode === "multi") {
        for (const it of d.items) st.updateWallLocal(it.wallId, { start: it.orig.start, end: it.orig.end });
        return;
      }
      st.updateWallLocal(d.wallId, { start: d.orig.start, end: d.orig.end });
      for (const m of d.mates || []) st.updateWallLocal(m.wallId, { [m.end]: m.orig });
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      // 配置/移動中はカーソルを十字の移動アイコンで固定
      cursorApi.set("move");
      const pt = toFloor(ev.clientX, ev.clientY);
      if (!pt) return;

      // スナップ（50mmグリッド）は Shift 押下中のみ。押していなければ 1mm 丸めの自由配置。
      const rd = ev.shiftKey ? snap : Math.round;

      if (d.mode === "group") {
        // クリック（選択）とドラッグ（移動）を区別する遊び（数px 動くまで移動しない）
        if (!d.moved) {
          if (Math.hypot(pt.x - d.grab.x, pt.z - d.grab.z) < (3 * pxWorldRef.current) / k) return;
          d.moved = true;
        }
        const dx = rd(pt.x - d.grab.x);
        const dz = rd(pt.z - d.grab.z);
        for (const it of d.items) {
          st.updateWallLocal(it.wallId, { [it.end]: { x: it.orig.x + dx, z: it.orig.z + dz } });
        }
        return;
      }

      if (d.mode === "multi") {
        // 壁本体ドラッグ＝選択中の壁（複数なら全部）の平行移動
        // クリック（選択の維持）とドラッグ（移動）を区別する遊び（数px 動くまで移動しない）
        if (!d.moved) {
          if (Math.hypot(pt.x - d.grab.x, pt.z - d.grab.z) < (3 * pxWorldRef.current) / k) return;
          d.moved = true;
        }
        const dx = rd(pt.x - d.grab.x);
        const dz = rd(pt.z - d.grab.z);
        for (const it of d.items) {
          st.updateWallLocal(it.wallId, {
            start: { x: it.orig.start.x + dx, z: it.orig.start.z + dz },
            end: { x: it.orig.end.x + dx, z: it.orig.end.z + dz },
          });
        }
        return;
      }

      // 端点（連結点ごと）
      // クリック（選択＝ギズモを出す）とドラッグ（移動）を区別する遊び。
      // 数px 動くまで移動を始めない（雑なクリックで頂点が数mmズレて保存されるのを防ぐ）。
      if (!d.moved) {
        if (Math.hypot(pt.x - d.grab.x, pt.z - d.grab.z) < (3 * pxWorldRef.current) / k) return;
        d.moved = true;
      }
      const fixed = d.mode === "start" ? d.orig.end : d.orig.start;
      const exclude = new Set([vKey(d.wallId, d.mode), ...(d.mates || []).map((m) => vKey(m.wallId, m.end))]);
      const { p, guides: g } = snapEndpoint(pt, fixed, exclude, ev.shiftKey);
      setGuides(g);
      // 最小長を割る位置は無視（潰れ防止）
      if (Math.hypot(p.x - fixed.x, p.z - fixed.z) < WALL_MIN_LENGTH) return;
      st.updateWallLocal(d.wallId, d.mode === "start" ? { start: p } : { end: p });
      // 連結点（同一座標だった他壁の端点）も一緒に動かす＝1つの頂点として編集
      for (const m of d.mates || []) st.updateWallLocal(m.wallId, { [m.end]: p });
    };

    /** 操作を終える（確定 or 取消の後始末）。 */
    const finish = () => {
      setDrag(null);
      setGuides({ x: null, z: null });
      cursorApi.clear();
      useViewportUiStore.getState().setGizmoDragging?.(false);
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      // すべてドラッグ式（押して動かし、離して確定）。「動かさず離した」場合は
      // クリック＝選択のみなので保存も走らせない（選択対象にはギズモが出る）。
      if (d.moved) {
        useWallStore.getState().persistWalls();
      }
      finish();
    };

    // ドラッグ中の右クリック = 取消（掴む前の位置へ戻す）
    const onDown = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      if (ev.button !== 2) return;
      ev.preventDefault();
      ev.stopPropagation();
      restore(d);
      finish();
    };

    // Escape = 取消
    const onKey = (ev) => {
      const d = dragRef.current;
      if (!d || ev.key !== "Escape") return;
      ev.stopPropagation();
      restore(d);
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
  }, [drag, toFloor, snapEndpoint, cursorApi]);

  // ── 頂点の範囲選択（余白から Shift+左ドラッグ） ─────────────────
  useEffect(() => {
    if (!toolIdle) return;
    const el = gl.domElement;

    const onDown = (ev) => {
      // Shift はスナップ修飾キーなので、頂点の範囲選択は Alt+ドラッグに割り当てる
      if (ev.button !== 0 || !ev.altKey) return;
      if (dragRef.current || marqueeRef.current) return;
      const pt = toFloor(ev.clientX, ev.clientY);
      if (!pt) return;
      // 家具マーキー等の誤発火を抑止
      useViewportUiStore.getState().setGizmoDragging?.(true);
      setMarquee({ a: pt, b: pt });
    };
    const onMove = (ev) => {
      if (!marqueeRef.current) return;
      const pt = toFloor(ev.clientX, ev.clientY);
      if (!pt) return;
      setMarquee((m) => (m ? { a: m.a, b: pt } : m));
    };
    const onUp = () => {
      const m = marqueeRef.current;
      if (!m) return;
      setMarquee(null);
      useViewportUiStore.getState().setGizmoDragging?.(false);
      // ほぼ動いていない＝Shift+クリック（壁の複数選択トグル）なので何もしない
      const minPx = 6 * pxWorldRef.current;
      if (Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) < minPx) return;
      const minX = Math.min(m.a.x, m.b.x), maxX = Math.max(m.a.x, m.b.x);
      const minZ = Math.min(m.a.z, m.b.z), maxZ = Math.max(m.a.z, m.b.z);
      const sel = [];
      for (const w of useWallStore.getState().walls) {
        for (const end of ["start", "end"]) {
          const p = w[end];
          if (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ) sel.push({ wallId: w.id, end });
        }
      }
      setVertSel(sel);
    };
    // 範囲選択の解除（配置中でなければ Esc でクリア）。頂点選択（ギズモ）も Esc で畳む。
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      if (dragRef.current) return;
      if (marqueeRef.current) { setMarquee(null); useViewportUiStore.getState().setGizmoDragging?.(false); return; }
      if (vertSelRef.current.length) { setVertSel([]); return; }
      if (pickedRef.current) setPicked(null);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [toolIdle, gl, toFloor]);

  // 壁が消えたら選択中の頂点も掃除
  useEffect(() => {
    if (!vertSel.length) return;
    const ids = new Set(walls.map((w) => w.id));
    const next = vertSel.filter((v) => ids.has(v.wallId));
    if (next.length !== vertSel.length) setVertSel(next);
  }, [walls, vertSel]);

  // ハンドルが消えるときにカーソル／ホバー状態を戻す（pointerOut が来ないケースの保険）
  const anyHandle = showHandles;
  useEffect(() => {
    if (!anyHandle) { cursorApi.clear(); setHoverMode(null); setPicked(null); }
  }, [anyHandle, cursorApi]);

  // 選択が変わったら、選択から外れた端点の「ギズモ対象」も畳む
  // （描画側でも pickedValid で無効な picked は無視するので、これは掃除だけの役割）
  useEffect(() => {
    setPicked((p) => (p && !selectedWallIds.includes(p.wallId) ? null : p));
  }, [selectedWallIds]);

  if (!toolIdle) return null;

  // ハンドルは「壁の立体より上」（handleBaseY）に置く。壁は床から階高（〜3000mm）まで
  // 立っているため、床すぐ上（+20mm 等）に置くとトップビューで壁が手前に来てしまい、
  // 壁の内側（黒いポシェ）からはレイキャストが壁に先に当たってハンドルを掴めない
  // （depthTest=false は描画のみで交差判定には効かない）。壁より確実に高い位置へ逃がす。
  const yMove = handleBaseY;
  const yEnd = handleBaseY + 2 * k;
  const r = HANDLE_PX * pxWorld;
  const hitR = HANDLE_HIT_PX * pxWorld;

  /** 端点ハンドルを掴む（mode: "start" | "end"）。クリック＝選択（ギズモ）、ドラッグ＝直接移動。 */
  const begin = (mode, w) => (e) => {
    if (e.button !== 0) return; // Shift はスナップ修飾キー（掴む操作は妨げない）
    e.stopPropagation();
    useViewportUiStore.getState().setGizmoDragging?.(true); // マーキー等の誤発火を抑止
    // クリック＝その端点を「選択」（移動ギズモの取り付け先）。そのままドラッグすれば直接移動。
    setPicked({ wallId: w.id, end: mode });
    // 連結点: 掴んだ端点と同一座標の他壁端点を集めて一緒に動かす
    const mates = [];
    const p0 = w[mode];
    for (const o of useWallStore.getState().walls) {
      if (o.id === w.id) continue;
      for (const end of ["start", "end"]) {
        const q = o[end];
        if (Math.hypot(q.x - p0.x, q.z - p0.z) <= JOINT_TOL) mates.push({ wallId: o.id, end, orig: { ...q } });
      }
    }
    setDrag({
      mode,
      wallId: w.id,
      grab: { x: e.point.x / k, z: e.point.z / k },
      orig: { start: { ...w.start }, end: { ...w.end } },
      mates,
    });
  };

  /** 壁本体（足元の透明ヒット面）を掴む: 選択中の壁（複数なら全部）を平行移動する。 */
  const beginBody = (w) => (e) => {
    if (e.button !== 0) return;
    // Ctrl/⌘/Shift+クリックは複数選択のトグルに使うので素通し（WallsRenderer 側が受ける）
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.stopPropagation();
    const st = useWallStore.getState();
    const ids = st.selectedWallIds.length > 1 && st.selectedWallIds.includes(w.id)
      ? st.selectedWallIds
      : [w.id];
    const items = st.walls
      .filter((x) => ids.includes(x.id))
      .map((x) => ({ wallId: x.id, orig: { start: { ...x.start }, end: { ...x.end } } }));
    if (!items.length) return;
    useViewportUiStore.getState().setGizmoDragging?.(true);
    setPicked(null); // 端点の選択は解除（本体を掴んだら中心ギズモ系に切替）
    setDrag({ mode: "multi", grab: { x: e.point.x / k, z: e.point.z / k }, items });
  };

  /** 範囲選択した頂点群を、クリックした点から一括で動かす。 */
  const beginGroup = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const now = useWallStore.getState().walls;
    const items = vertSelRef.current
      .map((v) => {
        const w = now.find((x) => x.id === v.wallId);
        return w ? { ...v, orig: { ...w[v.end] } } : null;
      })
      .filter(Boolean);
    if (!items.length) return;
    useViewportUiStore.getState().setGizmoDragging?.(true);
    setPicked(null); // 範囲選択の頂点群はリング表示＋直接ドラッグで扱う（ギズモは単一ハンドル用）
    setDrag({ mode: "group", grab: { x: e.point.x / k, z: e.point.z / k }, items });
  };

  // ── 移動ギズモ（Item と同じ PivotControls）──────────────────────────
  //   ・端点を選択中（picked）はその端点に取り付ける（連結点ごと移動）
  //   ・そうでなければ、選択中の壁の中心（複数選択なら重心）に常時出す（Item と同じ）
  //   picked の有効性は描画時に毎回確認する（stale な picked が残っても壊れない）。
  const pickedWall = picked ? walls.find((x) => x.id === picked.wallId) : null;
  const pickedValid = !!(pickedWall && selectedWallIds.includes(picked.wallId));
  let gizmoPos = null;
  let gizmoKind = null; // 'vertex'（端点） | 'walls'（壁全体/複数）
  if (pickedValid) {
    gizmoPos = pickedWall[picked.end];
    gizmoKind = "vertex";
  } else if (selectedWallIds.length === 1 && wall) {
    gizmoPos = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
    gizmoKind = "walls";
  } else if (selectedWallIds.length > 1 && multiMid) {
    gizmoPos = multiMid;
    gizmoKind = "walls";
  }
  // ハンドルの当たり判定と同一平面に置くとレイキャストの順序が曖昧になるので、少しだけ上へ
  const gizmoY = yEnd + 2 * k;

  /** ギズモ掴み始め: 元位置と連結点（同一座標の他壁端点）を控える。 */
  const onGizmoBegin = () => {
    const st = useWallStore.getState();
    if (gizmoKind === "vertex") {
      const w = st.walls.find((x) => x.id === picked.wallId);
      if (!w) return;
      const p0 = w[picked.end];
      const mates = [];
      for (const o of st.walls) {
        for (const end of ["start", "end"]) {
          if (o.id === picked.wallId && end === picked.end) continue;
          const q = o[end];
          if (Math.hypot(q.x - p0.x, q.z - p0.z) <= JOINT_TOL) mates.push({ wallId: o.id, end });
        }
      }
      gizmoOrigRef.current = {
        kind: "vertex",
        fixed: picked.end === "start" ? { ...w.end } : { ...w.start },
        mates,
      };
      return;
    }
    // 壁全体（単体は中心、複数は重心）: 対象の元位置と、差分の基準になる重心を控える
    const items = st.walls
      .filter((w) => st.selectedWallIds.includes(w.id))
      .map((w) => ({ wallId: w.id, orig: { start: { ...w.start }, end: { ...w.end } } }));
    if (!items.length) return;
    let sx = 0, sz = 0, n = 0;
    for (const it of items) {
      sx += it.orig.start.x + it.orig.end.x;
      sz += it.orig.start.z + it.orig.end.z;
      n += 2;
    }
    gizmoOrigRef.current = { kind: "walls", items, mid: { x: sx / n, z: sz / n } };
  };

  const onGizmoMove = ({ xMm, zMm }) => {
    const g = gizmoOrigRef.current;
    if (!g) return;
    const st = useWallStore.getState();
    if (g.kind === "vertex") {
      const p = { x: Math.round(xMm), z: Math.round(zMm) };
      // 最小長を割る位置は無視（潰れ防止。直接ドラッグと同じルール）
      if (Math.hypot(p.x - g.fixed.x, p.z - g.fixed.z) < WALL_MIN_LENGTH) return;
      st.updateWallLocal(picked.wallId, { [picked.end]: p });
      for (const m of g.mates) st.updateWallLocal(m.wallId, { [m.end]: p });
      return;
    }
    const dx = Math.round(xMm - g.mid.x);
    const dz = Math.round(zMm - g.mid.z);
    for (const it of g.items) {
      st.updateWallLocal(it.wallId, {
        start: { x: it.orig.start.x + dx, z: it.orig.start.z + dz },
        end: { x: it.orig.end.x + dx, z: it.orig.end.z + dz },
      });
    }
  };

  const onGizmoCommit = () => {
    if (gizmoOrigRef.current) useWallStore.getState().persistWalls();
    gizmoOrigRef.current = null;
  };

  // 範囲選択された頂点の現在位置（壁からライブに引く）
  const vertMarkers = vertSel
    .map((v) => {
      const w = walls.find((x) => x.id === v.wallId);
      return w ? { ...v, p: w[v.end] } : null;
    })
    .filter(Boolean);

  // ガイド線の長さ（シーン全体を貫く程度）
  const gLen = Math.max((sceneExtentXZ || 0) * 2, isMm ? 20000 : 20);

  return (
    // ignoreClipping: ハンドルは壁の立体より上（＝平面図のカット高さより上）に浮かせてあるので、
    // 断面クリップの対象にすると丸ごと消える。UI ギズモは断面表現の対象外（SectionClipManager が
    // この印の付いた枝を飛ばす）。
    <group userData={{ ignoreClipping: true }}>
      {/* 整列スナップのガイド線（他の壁端点・床頂点と同じ X / Z に揃っていることを示す） */}
      {guides.x != null && (
        <Line
          points={[[guides.x * k, yEnd, -gLen * k], [guides.x * k, yEnd, gLen * k]]}
          color={MARQUEE_COLOR} lineWidth={1} transparent opacity={0.7} depthTest={false}
          dashed dashSize={200 * k} gapSize={140 * k}
        />
      )}
      {guides.z != null && (
        <Line
          points={[[-gLen * k, yEnd, guides.z * k], [gLen * k, yEnd, guides.z * k]]}
          color={MARQUEE_COLOR} lineWidth={1} transparent opacity={0.7} depthTest={false}
          dashed dashSize={200 * k} gapSize={140 * k}
        />
      )}

      {/* 壁本体の移動用ヒット面（平面図のみ）: 選択中の壁の足元に透明の帯を敷き、
          掴んでドラッグで壁（複数選択なら全部）を平行移動。パースでは壁の上空に浮いて
          見当違いのクリックを奪うため出さない（パースは中心ギズモで動かす）。 */}
      {camera?.isOrthographicCamera && selectedWalls.map((w) => {
        const dx = w.end.x - w.start.x;
        const dz = w.end.z - w.start.z;
        const len = Math.hypot(dx, dz);
        if (len < 1) return null;
        // 細い壁でも掴みやすいよう、帯の幅は壁厚と画面12px相当の大きい方
        const grabW = Math.max((w.thicknessMm || 100) * k, 12 * pxWorld);
        return (
          <mesh
            key={`body_${w.id}`}
            position={[((w.start.x + w.end.x) / 2) * k, yMove, ((w.start.z + w.end.z) / 2) * k]}
            rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]}
            onPointerDown={beginBody(w)}
            onClick={(e) => {
              // 修飾キー付き（選択トグル）は素通し。それ以外は躯体側の選択解除をブロック
              if (!(e.ctrlKey || e.metaKey || e.shiftKey)) e.stopPropagation();
            }}
            onPointerOver={() => { if (!dragRef.current) cursorApi.set("move"); }}
            onPointerOut={() => { if (!dragRef.current) cursorApi.clear(); }}
          >
            <planeGeometry args={[len * k, grabW]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}

      {/* 端点ハンドル: 選択中の壁すべてに出す（＝選択状態なら頂点は常に見える）。
          範囲選択された頂点と同じ位置のものは描かない（下のリング側が担当。
          同じ高さに2枚重ねるとレイキャストの当たりが曖昧になるため）。 */}
      {showHandles && endpointHandles
        .filter(({ p }) => !vertMarkers.some((v) => Math.hypot(v.p.x - p.x, v.p.z - p.z) <= JOINT_TOL))
        .map(({ wall: w, end, p }) => (
        <Handle
          key={vKey(w.id, end)}
          x={p.x} z={p.z} y={yEnd} k={k}
          r={r} hitR={hitR} outlineW={OUTLINE_PX * pxWorld}
          active={(drag?.mode === end && drag?.wallId === w.id) ||
                  (pickedValid && picked.wallId === w.id && picked.end === end)}
          hovered={hoverMode === vKey(w.id, end)}
          onBegin={begin(end, w)}
          onOver={() => { if (!dragRef.current) setHoverMode(vKey(w.id, end)); }}
          onOut={() => { setHoverMode((h) => (h === vKey(w.id, end) ? null : h)); }}
        />
      ))}

      {/* 移動ギズモ（Item と同じ操作感）: 端点選択中はその端点、通常は壁の中心/重心。
          直接ドラッグ中は隠す */}
      {!drag && gizmoPos && (
        <VertexGizmo
          orbitRef={orbitRef}
          xMm={gizmoPos.x} zMm={gizmoPos.z} y={gizmoY} k={k}
          onBegin={onGizmoBegin} onMove={onGizmoMove} onCommit={onGizmoCommit}
        />
      )}

      {/* 範囲選択の矩形プレビュー */}
      {marquee && (
        <Line
          points={[
            [marquee.a.x * k, yEnd, marquee.a.z * k],
            [marquee.b.x * k, yEnd, marquee.a.z * k],
            [marquee.b.x * k, yEnd, marquee.b.z * k],
            [marquee.a.x * k, yEnd, marquee.b.z * k],
            [marquee.a.x * k, yEnd, marquee.a.z * k],
          ]}
          color={MARQUEE_COLOR} lineWidth={1.2} transparent opacity={0.9} depthTest={false}
          dashed dashSize={160 * k} gapSize={110 * k}
        />
      )}

      {/* 範囲選択された頂点（クリックでグループ移動を開始） */}
      {vertMarkers.map((v) => (
        <group key={vKey(v.wallId, v.end)} position={[v.p.x * k, yEnd, v.p.z * k]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={9999}
            onPointerDown={beginGroup}
            onClick={(e) => e.stopPropagation()}
          >
            <circleGeometry args={[hitR, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10000}>
            <ringGeometry args={[r * 1.6, r * 2.4, 20]} />
            <meshBasicMaterial color={MARQUEE_COLOR} transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10000}>
            <circleGeometry args={[r, 12]} />
            <meshBasicMaterial color={HANDLE_COLOR} transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
