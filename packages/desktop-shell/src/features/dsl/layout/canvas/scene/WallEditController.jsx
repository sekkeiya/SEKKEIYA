// WallEditController — 平面(Top)/パースで選択中の壁を編集するハンドル。
//   ・両端の丸ハンドル: 端点を移動・延長。ドラッグで直接移動（離して確定。ドラッグ中は
//     右クリック / Escape で取消＝元位置へ戻す）。クリック（動かさず離す）はその端点の
//     「選択」で、Item と同じ移動ギズモ（VertexGizmo）が出て X/Z 軸で正確に動かせる。
//     連結点は1つの頂点として扱う: 掴んだ端点と同一座標にある他の壁の端点も一緒に動く
//     （データは壁ごとの端点のまま。編集時にだけ束ねる）。
//     スナップの中身は「壁を作図するとき」と同じ（utils/drawSnap を共用）:
//     点（壁端点・床頂点・通り芯の交点）→ 直交 → 線（壁芯・床の辺・通り芯）→ 50mmグリッド。
//     何に吸ったかは DrawSnapMarker の印＋ラベルで示す。
//     ⚠️ 発動条件は経路で違う（ユーザー指定の経緯による）:
//       ・ハンドルを直接ドラッグ … 既定 ON（Alt 押下中だけ切る）＝作図と同じ操作感
//       ・端点を選択してギズモで動かす … Shift 押下中だけ ON（床の頂点編集と同じ）
//     端点ハンドルは「選択中の壁すべて」に出す（複数選択でも頂点は見えたまま個別に編集できる）。
//     連結点で重なる端点は1つだけ描く。
//   ・壁を選択すると中心（複数選択は重心）に移動ギズモが常時出る（Item と同じ）。
//     端点を選択している間はそちらのギズモを優先する。
//   ・壁本体（足元の透明ヒット面。平面図のみ）: ドラッグで壁全体を平行移動
//     （複数選択中はまとめて移動。Shift 中は 50mm 刻み。Ctrl/Shift+クリックの
//     選択トグルは素通しして WallsRenderer に任せる）。
//   ・頂点の範囲選択: 壁を選択中に、空き領域から普通の左ドラッグ で矩形選択 → 枠内の壁端点を
//     まとめて選択（壁未選択のときは従来の家具/壁まるごとマーキーに譲る）。選択された頂点は
//     リング表示され、その群の重心に移動ギズモが出てまとめて動かせる（どれかを直接ドラッグしても
//     全頂点が一緒に動く）。右クリック/Esc取消。余白クリック（または Esc）で選択解除。
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
import { resolveDrawSnap, DRAW_GRID_MM } from "../../utils/drawSnap";
import { wallTopLiftMm } from "../../utils/handleLift";
import { useHoverCursor } from "./useHoverCursor";
import DrawSnapMarker from "./DrawSnapMarker.jsx";
import VertexGizmo from "./VertexGizmo.jsx";

// 端点の吸着そのものは utils/drawSnap（作図と共通）に集約。ここに個別の閾値は持たない。
const SNAP_MM = DRAW_GRID_MM; // 壁本体/頂点群の平行移動で使う刻み（Shift 中）
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

// gizmoOnly: 立面/断面（側面正射）用。視線が水平で床平面と交わらず toFloor が成立しないため、
//   ハンドルのドラッグ・範囲選択は使えない。移動ギズモ（床平面に依存しない）だけを出す。
export default function WallEditController({ enabled = true, orbitRef = null, sideAxis = null }) {
  // sideAxis: 立面/断面（側面正射）で「画面の横方向」に当たる世界軸（FRONT="x" / RIGHT="z"）。
  //   null = 平面/パース（従来どおりハンドル操作あり）。
  const gizmoOnly = !!sideAxis;
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const walls = useWallStore((s) => s.walls);
  const selectedWallId = useWallStore((s) => s.selectedWallId);
  const selectedWallIds = useWallStore((s) => s.selectedWallIds);
  const drawKind = useWallStore((s) => s.drawKind);
  const slabDrawActive = useSlabStore((s) => s.drawActive);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const floors = useBuildingSpecStore((s) => s.floors);

  // 壁が立つ床レベル(mm)。WallsRenderer と同じ規約（オフセット 0 の壁の足元）。
  //   選択中の壁がある階に合わせる（3D/断面で他階の壁を選んでもハンドルがその階に出る）。
  const floorBaseYMm = useMemo(() => {
    const sel = walls.find((w) => w.id === selectedWallId);
    const idx = sel ? (sel.floorIndex || 0) : (activeFloorIndex || 0);
    const i = Math.max(0, Math.min(idx, (floors?.length || 1) - 1));
    return (fl0Mm || 0) + (floors?.[i]?.flMm || 0);
  }, [fl0Mm, floors, activeFloorIndex, walls, selectedWallId]);

  // ハンドルを浮かせる高さ(mm)。いちばん高い壁の「頭」より上に置く（下の yEnd/yMove の説明を参照）。
  //   ⚠️ 壁の高さだけで計算しないこと。壁は各階の FL に建ち上下オフセットも載るので、
  //      高さだけだと壁の頭より下に潜り、端点ハンドルが掴めなくなる（utils/handleLift）。
  const handleLiftMm = useMemo(
    () => wallTopLiftMm(walls, useBuildingSpecStore.getState()),
    [walls, floorHeightMm, ceilingHeightMm, fl0Mm, floors],
  );

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
  // 吸着中のヒント（resolveDrawSnap の戻り値。DrawSnapMarker に渡す）
  const [snapHint, setSnapHint] = useState(null);
  // ギズモ（PivotControls）は onMove で修飾キーを渡してくれないので、Shift の押下状態を
  // 自前で持つ。ハンドルの直接ドラッグは pointer イベントの修飾キーを使うが、
  // 「端点を選択 → ギズモで動かす」経路はこちらを見る。
  const shiftRef = useRef(false);
  useEffect(() => {
    const onKey = (e) => { shiftRef.current = !!e.shiftKey; };
    // ウィンドウがフォーカスを失うと keyup を取りこぼす（押しっぱなし扱いで固まる）。
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
  // 範囲選択された頂点（[{wallId, end}]）と、選択中の矩形
  const [vertSel, setVertSel] = useState([]);
  const vertSelRef = useRef([]);
  vertSelRef.current = vertSel;
  const [marquee, setMarquee] = useState(null); // { a:{x,z}, b:{x,z} }
  const marqueeRef = useRef(null);
  marqueeRef.current = marquee;
  // マーキー開始前の「待機中ドラッグ候補」。しきい値(数px)を超えたら実際に開始する。
  //   ここで待つことで、ただのクリックでは gizmoDragging を立てず、余白クリックの選択解除を邪魔しない。
  const pendingMarqueeRef = useRef(null);

  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  // ハンドル面の高さ（world単位）。useFrame（パースの距離計算）からも参照するので ref に流す。
  // handleLiftMm は world 絶対値（壁の頭 + 余裕）なので gridHeightMm を足さない。
  // 作図グリッドを高く上げている場合はそちらより上に来るよう大きい方を採る。
  const handleBaseYMm = Math.max(handleLiftMm, gridHeightMm + 200);
  const handleBaseY = handleBaseYMm * k;
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
  // 立面/断面（gizmoOnly）ではハンドルを出さない（掴んでも床平面レイキャストが成立せず動かせない）
  const showHandles = toolIdle && !gizmoOnly && endpointHandles.length > 0;
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
   * 端点のスナップ。壁を「作図するとき」と同じ resolveDrawSnap を使う（挙動を1つに統一）。
   *   点（壁端点・床頂点・通り芯の交点）→ 直交（反対側の端点基準）→ 線（壁芯・床の辺・通り芯）→ 50mmグリッド
   * 既定 ON。Alt 押下中だけ吸着を切る（作図と同じ）。
   * exclude: 一緒に動いている端点（自分＋連結点）と、その壁の壁芯を候補から外す。
   *          外さないと自分自身に吸着して動かなくなる。
   * 何に吸ったかは DrawSnapMarker（印＋「通り芯 X1」等のラベル）で示す。作図と同じ見せ方。
   */
  const snapEndpoint = useCallback((pt, fixed, excludeKeys, free) => {
    const wallIds = new Set();
    for (const key of excludeKeys) wallIds.add(key.split(":")[0]);
    return resolveDrawSnap(pt, fixed || null, free, { wallIds, wallEnds: excludeKeys });
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
      // 作図と同じ: 吸着は既定 ON、Alt 押下中だけ切る
      const r = snapEndpoint(pt, fixed, exclude, !!ev.altKey);
      const p = { x: r.x, z: r.z };
      setSnapHint(r.kind ? r : null);
      // 最小長を割る位置は無視（潰れ防止）
      if (Math.hypot(p.x - fixed.x, p.z - fixed.z) < WALL_MIN_LENGTH) return;
      st.updateWallLocal(d.wallId, d.mode === "start" ? { start: p } : { end: p });
      // 連結点（同一座標だった他壁の端点）も一緒に動かす＝1つの頂点として編集
      for (const m of d.mates || []) st.updateWallLocal(m.wallId, { [m.end]: p });
    };

    /** 操作を終える（確定 or 取消の後始末）。 */
    const finish = () => {
      setDrag(null);
      setSnapHint(null);
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

  // ── 頂点の範囲選択（壁を選択中に、空き領域から普通の左ドラッグ） ───────────
  //   ・壁が未選択のときは何もしない → 従来の家具/壁まるごとマーキー選択（左ドラッグ）に譲る。
  //   ・ハンドル/ギズモ/壁本体を掴んでいる間（gizmoDragging）は開始しない。
  //   ・しきい値(6px)を超えて初めて開始し、そのとき gizmoDragging を立てて家具マーキーを抑止する。
  //     クリック（動かさず離す）では立てないので、余白クリックの選択解除を邪魔しない。
  useEffect(() => {
    if (!toolIdle || gizmoOnly) return; // 立面/断面ではハンドル操作不可（ギズモのみ）
    const el = gl.domElement;
    const vp = useViewportUiStore;

    const onDown = (ev) => {
      if (ev.button !== 0) return;
      if (!useWallStore.getState().selectedWallIds.length) return; // 壁選択中のみ
      if (dragRef.current || marqueeRef.current || pendingMarqueeRef.current) return;
      if (vp.getState().gizmoDragging) return; // ハンドル/ギズモ/壁本体を掴んでいる
      const pt = toFloor(ev.clientX, ev.clientY);
      if (!pt) return;
      pendingMarqueeRef.current = { a: pt }; // まだ開始しない（動き出したら開始）
    };

    const onMove = (ev) => {
      // 実行中: 矩形の終端を更新
      if (marqueeRef.current) {
        const pt = toFloor(ev.clientX, ev.clientY);
        if (pt) setMarquee((m) => (m ? { a: m.a, b: pt } : m));
        return;
      }
      const pend = pendingMarqueeRef.current;
      if (!pend) return;
      // 途中でハンドル/ギズモ/壁本体の操作が始まったら中止
      if (dragRef.current || vp.getState().gizmoDragging) { pendingMarqueeRef.current = null; return; }
      const pt = toFloor(ev.clientX, ev.clientY);
      if (!pt) return;
      const threshold = 6 * pxWorldRef.current;
      if (Math.hypot(pt.x - pend.a.x, pt.z - pend.a.z) < threshold) return;
      // しきい値超え → ここで初めて開始（家具マーキーを抑止）
      pendingMarqueeRef.current = null;
      vp.getState().setGizmoDragging?.(true);
      setMarquee({ a: pend.a, b: pt });
    };

    const onUp = () => {
      pendingMarqueeRef.current = null;
      const m = marqueeRef.current;
      if (!m) return;
      setMarquee(null);
      vp.getState().setGizmoDragging?.(false);
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
    // Esc: マーキー/待機中を中止 → 頂点選択を解除 → 端点ギズモを畳む（段階的に）
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      if (dragRef.current) return;
      if (marqueeRef.current || pendingMarqueeRef.current) {
        pendingMarqueeRef.current = null;
        setMarquee(null); vp.getState().setGizmoDragging?.(false); return;
      }
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
  }, [toolIdle, gl, toFloor, gizmoOnly]);

  // 壁が消えたら選択中の頂点も掃除
  useEffect(() => {
    if (!vertSel.length) return;
    const ids = new Set(walls.map((w) => w.id));
    const next = vertSel.filter((v) => ids.has(v.wallId));
    if (next.length !== vertSel.length) setVertSel(next);
  }, [walls, vertSel]);

  // ドラッグが終わったら吸着ヒントを必ず消す。
  //   finish() でも消しているが、pointerup を取りこぼす／掴んだ壁が消える等で
  //   マーカーとラベルだけ画面に残ってしまうことがあるため、状態からも落とす。
  useEffect(() => {
    if (!drag) setSnapHint(null);
  }, [drag]);

  // ハンドルが消えるときにカーソル／ホバー状態を戻す（pointerOut が来ないケースの保険）
  const anyHandle = showHandles;
  useEffect(() => {
    if (!anyHandle) { cursorApi.clear(); setHoverMode(null); setPicked(null); }
  }, [anyHandle, cursorApi]);

  // 選択が変わったとき:
  //   ・壁が全て解除された（余白クリック等）→ 頂点の範囲選択も端点ギズモも畳む（＝完全に解除）
  //   ・一部だけ変わった → 選択から外れた端点のギズモ対象だけ畳む
  useEffect(() => {
    if (!selectedWallIds.length) {
      if (vertSelRef.current.length) setVertSel([]);
      setPicked(null);
      return;
    }
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
    if (e.button !== 0) return;
    // Alt は「吸着を切る」修飾キー（作図と同じ）なので、ここで弾かない。
    // 頂点の範囲選択は空き領域からの左ドラッグで始められる。
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
    if (e.altKey) return; // Alt+ドラッグは頂点の範囲選択に予約（マーキーへ譲る）
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

  // 範囲選択された頂点の現在位置（壁からライブに引く）
  const vertMarkers = vertSel
    .map((v) => {
      const w = walls.find((x) => x.id === v.wallId);
      return w ? { ...v, p: w[v.end] } : null;
    })
    .filter(Boolean);
  // 範囲選択した頂点群の重心（まとめて動かすギズモの取り付け位置）
  let vertGroupMid = null;
  if (vertMarkers.length) {
    let sx = 0, sz = 0;
    for (const v of vertMarkers) { sx += v.p.x; sz += v.p.z; }
    vertGroupMid = { x: sx / vertMarkers.length, z: sz / vertMarkers.length };
  }

  // ── 移動ギズモ（Item と同じ PivotControls）──────────────────────────
  //   ・頂点を範囲選択中（vertMarkers）は、その群の重心に取り付けてまとめて移動
  //   ・端点を選択中（picked）はその端点に取り付ける（連結点ごと移動）
  //   ・そうでなければ、選択中の壁の中心（複数選択なら重心）に常時出す（Item と同じ）
  //   picked の有効性は描画時に毎回確認する（stale な picked が残っても壊れない）。
  const pickedWall = picked ? walls.find((x) => x.id === picked.wallId) : null;
  const pickedValid = !!(pickedWall && selectedWallIds.includes(picked.wallId));
  let gizmoPos = null;
  let gizmoKind = null; // 'vgroup'（範囲選択頂点群） | 'vertex'（端点） | 'walls'（壁全体/複数）
  if (gizmoOnly) {
    // 立面/断面: 端点ハンドルが無く頂点は選べないので、常に「壁全体」を動かす。
    // 上下オフセットも壁単位のプロパティなので、単位としてもこれが正しい。
    if (selectedWallIds.length === 1 && wall) {
      gizmoPos = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
      gizmoKind = "walls";
    } else if (selectedWallIds.length > 1 && multiMid) {
      gizmoPos = multiMid;
      gizmoKind = "walls";
    }
  } else if (vertGroupMid) {
    gizmoPos = vertGroupMid;
    gizmoKind = "vgroup";
  } else if (pickedValid) {
    gizmoPos = pickedWall[picked.end];
    gizmoKind = "vertex";
  } else if (selectedWallIds.length === 1 && wall) {
    gizmoPos = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
    gizmoKind = "walls";
  } else if (selectedWallIds.length > 1 && multiMid) {
    gizmoPos = multiMid;
    gizmoKind = "walls";
  }
  // ギズモの取り付け高さ(mm)。
  //   平面/パース: ハンドルの当たり判定と同一平面だとレイキャストの順序が曖昧になるので少し上へ。
  //   立面/断面: 実際の壁の足元（床レベル＋その壁の上下オフセット）。上空に浮くと
  //     断面のどこの話か分からず、上下ドラッグの起点としても不正確になるため。
  const gizmoWallOffsetMm = gizmoOnly && wall ? (wall.offsetYMm || 0) : 0;
  const gizmoYMm = gizmoOnly
    ? floorBaseYMm + gizmoWallOffsetMm
    : handleBaseYMm + 4;
  // 立面/断面は画面に見えている2軸だけ（横＝視線に直交する水平軸／縦＝上下）。
  const gizmoAxes = gizmoOnly
    ? (sideAxis === "x" ? [true, true, false] : [false, true, true])
    : [true, false, true];

  /** ギズモ掴み始め: 元位置と連結点（同一座標の他壁端点）を控える。 */
  const onGizmoBegin = () => {
    const st = useWallStore.getState();
    if (gizmoKind === "vgroup") {
      // 範囲選択した各頂点の元位置＋重心を控える（重心基準の差分で全部動かす）
      const items = vertSelRef.current
        .map((v) => {
          const w = st.walls.find((x) => x.id === v.wallId);
          return w ? { wallId: v.wallId, end: v.end, orig: { ...w[v.end] } } : null;
        })
        .filter(Boolean);
      if (!items.length) return;
      let sx = 0, sz = 0;
      for (const it of items) { sx += it.orig.x; sz += it.orig.z; }
      gizmoOrigRef.current = { kind: "vgroup", items, mid: { x: sx / items.length, z: sz / items.length } };
      return;
    }
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
        // Shift スナップ用: 掴む前の位置と、一緒に動く端点（自分＋連結点）＝候補から外す集合。
        origPoint: { ...p0 },
        excludeKeys: new Set([
          vKey(picked.wallId, picked.end),
          ...mates.map((m) => vKey(m.wallId, m.end)),
        ]),
      };
      return;
    }
    // 壁全体（単体は中心、複数は重心）: 対象の元位置と、差分の基準になる重心を控える。
    // 上下オフセットも控える（立面/断面での縦ドラッグ用）。
    const items = st.walls
      .filter((w) => st.selectedWallIds.includes(w.id))
      .map((w) => ({
        wallId: w.id,
        orig: { start: { ...w.start }, end: { ...w.end } },
        origOffsetY: w.offsetYMm || 0,
      }));
    if (!items.length) return;
    let sx = 0, sz = 0, n = 0;
    for (const it of items) {
      sx += it.orig.start.x + it.orig.end.x;
      sz += it.orig.start.z + it.orig.end.z;
      n += 2;
    }
    gizmoOrigRef.current = {
      kind: "walls",
      items,
      mid: { x: sx / n, z: sz / n },
      midY: gizmoYMm, // 縦ドラッグの基準（ギズモの開始高さ）
    };
  };

  const onGizmoMove = ({ xMm, yMm, zMm }) => {
    const g = gizmoOrigRef.current;
    if (!g) return;
    const st = useWallStore.getState();
    if (g.kind === "vgroup") {
      // 頂点群のまとめ移動は「移動量」を Shift で 50mm 刻みに（形は保ったまま動かす）。
      const rd = shiftRef.current ? snap : Math.round;
      const dx = rd(xMm - g.mid.x);
      const dz = rd(zMm - g.mid.z);
      for (const it of g.items) {
        st.updateWallLocal(it.wallId, { [it.end]: { x: it.orig.x + dx, z: it.orig.z + dz } });
      }
      return;
    }
    if (g.kind === "vertex") {
      // Shift 中はスナップ（直接ドラッグと同じ resolveDrawSnap ＝ 通り芯・壁芯・端点・床の辺）。
      // ⚠️ ギズモは軸拘束（X矢印なら X だけ動く）。スナップで拘束していない軸まで動かすと
      //    「X に沿って動かしたつもりが Z もずれる」ので、実際に動いた軸だけ採用する。
      const orig = g.origPoint || { x: xMm, z: zMm };
      const movedX = Math.abs(xMm - orig.x) > 0.5;
      const movedZ = Math.abs(zMm - orig.z) > 0.5;
      let p = { x: Math.round(xMm), z: Math.round(zMm) };
      if (shiftRef.current) {
        const r = snapEndpoint({ x: xMm, z: zMm }, g.fixed, g.excludeKeys || new Set(), false);
        setSnapHint(r.kind ? r : null);
        p = { x: movedX ? r.x : orig.x, z: movedZ ? r.z : orig.z };
      } else {
        setSnapHint(null);
        p = { x: movedX ? p.x : orig.x, z: movedZ ? p.z : orig.z };
      }
      // 最小長を割る位置は無視（潰れ防止。直接ドラッグと同じルール）
      if (Math.hypot(p.x - g.fixed.x, p.z - g.fixed.z) < WALL_MIN_LENGTH) return;
      st.updateWallLocal(picked.wallId, { [picked.end]: p });
      for (const m of g.mates) st.updateWallLocal(m.wallId, { [m.end]: p });
      return;
    }
    // 壁のまとめ移動も Shift で 50mm 刻み。
    const rdAll = shiftRef.current ? snap : Math.round;
    const dx = rdAll(xMm - g.mid.x);
    const dz = rdAll(zMm - g.mid.z);
    // 立面/断面の縦ドラッグ: 床レベル(FL)からの上下オフセットを変える
    const dy = g.midY != null && Number.isFinite(yMm) ? Math.round(yMm - g.midY) : 0;
    for (const it of g.items) {
      const patch = {
        start: { x: it.orig.start.x + dx, z: it.orig.start.z + dz },
        end: { x: it.orig.end.x + dx, z: it.orig.end.z + dz },
      };
      if (dy) patch.offsetYMm = it.origOffsetY + dy;
      st.updateWallLocal(it.wallId, patch);
    }
  };

  const onGizmoCommit = () => {
    if (gizmoOrigRef.current) useWallStore.getState().persistWalls();
    gizmoOrigRef.current = null;
    setSnapHint(null); // 吸着マーカー／ラベルを消す
  };

  return (
    // ignoreClipping: ハンドルは壁の立体より上（＝平面図のカット高さより上）に浮かせてあるので、
    // 断面クリップの対象にすると丸ごと消える。UI ギズモは断面表現の対象外（SectionClipManager が
    // この印の付いた枝を飛ばす）。
    <group userData={{ ignoreClipping: true, isDrawnStructure: true }}>
      {/* 吸着ヒント: 何に吸ったか（印＋「通り芯 X1」等のラベル）。作図中とまったく同じ見せ方。
          ⚠️ 高さはハンドル（yEnd＝壁より上に逃がしてある）ではなく床すぐ上にすること。
          ハンドルの高さだと ①ひし形がハンドルの丸に隠れる ②ラベル(drei Html)が
          トップビューのカメラより上＝「カメラの後ろ」と判定されて消える。作図側と同じ高さにする。 */}
      <DrawSnapMarker snap={snapHint} y={(gridHeightMm + 4) * k} />

      {/* 壁本体の移動用ヒット面（平面図のみ）: 選択中の壁の足元に透明の帯を敷き、
          掴んでドラッグで壁（複数選択なら全部）を平行移動。パースでは壁の上空に浮いて
          見当違いのクリックを奪うため出さない（パースは中心ギズモで動かす）。 */}
      {!gizmoOnly && camera?.isOrthographicCamera && selectedWalls.map((w) => {
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
          xMm={gizmoPos.x} zMm={gizmoPos.z} yMm={gizmoYMm} k={k}
          axes={gizmoAxes}
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

      {/* 範囲選択された頂点（クリックでグループ移動を開始）。立面/断面では掴めないので出さない */}
      {!gizmoOnly && vertMarkers.map((v) => (
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
