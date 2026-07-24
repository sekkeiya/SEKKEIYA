// WallsRenderer — useWallStore の壁を 3D 表示する。
//   ・高さ: 外壁=階高（floorHeightMm） / 内壁=CL（ceilingHeightMm）。wall.heightMm があればそれを優先。
//   ・角の処理（マイター）: 壁芯から左右に t/2 オフセットした線の交点で端部を留める。
//     マイター点は必ずオフセット線上に乗るため、壁の左右エッジは常に「オフセット線の区間」
//     になる。これを利用して、壁を軸方向スパン×上下レンジの「ピース」に分割できる。
//     角に集まる壁は角度順（CCW）に並べ、隣り合う腕どうしで留める。斜め壁が既存の角に
//     取り付くような「1点に3本以上」でも、すべての面が正しく閉じる。
//   ・開口部（ドア/窓）: 開口スパンでは下（腰壁）と上（垂れ壁）のピースだけを作り、
//     間を実際の穴として抜く。平面図はカット高さ(1500mm)に交差するピースのみポシェ表示
//     するので、ドア/窓のスパンは自然にギャップになる。加えてドアは1/4円の開き軌跡、
//     窓は薄い矩形記号を描く（建築図面の作法）。
//   ・クリックで選択（Properties に壁設定を出す）。
import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useWallStore } from "../../store/useWallStore";
import { useSlabStore } from "../../store/useSlabStore";
import { isDrawToolActive } from "../../utils/drawToolActive";
import { isBaseEditMode } from "../../utils/baseEditMode";
import { useGridAxisStore } from "../../store/useGridAxisStore";
import { useBuildingSpecStore, floorHeightOf, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useDrawnFinishMaterial } from "./useDrawnFinishMaterial";

const POCHE_COLOR = "#0f172a";   // 平面図の壁ポシェ（断面）
const WALL_COLOR = "#cbd5e1";    // 立体の壁面
const SELECT_COLOR = "#38bdf8";
const SYMBOL_COLOR = "#475569";  // 平面のドア/窓記号
const GHOST_COLOR = "#64748b";   // 他階のトレース表示
const JOINT_TOL = 1;             // 端点一致とみなす距離(mm)
const MITER_LIMIT = 4;           // マイター長の上限（× 壁厚半分）
const PLAN_CUT_MM = 1500;        // 平面図の想定カット高さ（床からの相対）

// ── XZ 平面の 2D ベクトル小道具 ─────────────────────────────
const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
const mul = (v, s) => ({ x: v.x * s, z: v.z * s });
const dot = (a, b) => a.x * b.x + a.z * b.z;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const norm = (v) => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
const leftNormal = (u) => ({ x: -u.z, z: u.x });

function intersect(p, u, q, v) {
  const d = u.x * v.z - u.z * v.x;
  if (Math.abs(d) < 1e-6) return null;
  const t = ((q.x - p.x) * v.z - (q.z - p.z) * v.x) / d;
  return { x: p.x + u.x * t, z: p.z + u.z * t };
}

/**
 * その点に集まる壁の「腕」を、外向き方向の角度順（CCW）に並べて返す。
 *   out: その点から離れていく向きの単位ベクトル。h: 壁厚の半分。
 * 自分自身も含める（自分の左右エッジの端点をここから受け取るため）。
 */
function armsAt(walls, p) {
  const arms = [];
  for (const o of walls) {
    if (dist(o.start, p) <= JOINT_TOL) arms.push({ id: o.id, out: norm(sub(o.end, o.start)), h: (o.thicknessMm || 0) / 2 });
    else if (dist(o.end, p) <= JOINT_TOL) arms.push({ id: o.id, out: norm(sub(o.start, o.end)), h: (o.thicknessMm || 0) / 2 });
  }
  for (const a of arms) a.ang = Math.atan2(a.out.z, a.out.x);
  arms.sort((a, b) => a.ang - b.ang);
  return arms;
}

/**
 * 角度順に隣り合う腕どうしを留める（マイター）。
 *   腕 i の CCW 側エッジ（+leftNormal(out) 側）と、次の腕 i+1 の CW 側エッジの交点が
 *   その2本の間を埋める角の点。これを一周分解くと、T字・十字など何本集まっても
 *   「隣り合う面どうし」が正しく閉じる。
 *   隣を1本だけ選ぶ方式だと3本以上集まる角で残りが解かれず、欠けやトゲになる。
 * 結果は arms[i].ccw / arms[i].cw に入れる（解けなければ null＝直角の切り落とし）。
 */
function solveJoint(p, arms) {
  const n = arms.length;
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const a = arms[i];
    const b = arms[(i + 1) % n];
    const X = intersect(
      add(p, mul(leftNormal(a.out), a.h)), a.out,
      sub(p, mul(leftNormal(b.out), b.h)), b.out,
    );
    // 鋭角すぎてマイターが伸びすぎる場合は諦める（長いトゲを出さない）
    const ok = X && dist(X, p) <= MITER_LIMIT * Math.max(a.h, b.h);
    a.ccw = ok ? X : null;
    b.cw = ok ? X : null;
  }
}

/**
 * 壁の「フレーム」= 幾何の素。左右エッジ（オフセット線）の始終端を軸パラメータで持つ。
 *   tL0/tL1: 左エッジの始端/終端（壁芯始点からの距離。マイターで ±に伸縮）
 *   tR0/tR1: 右エッジ同様
 */
function wallFrame(walls, w) {
  const P = w.start;
  const Q = w.end;
  const len = dist(P, Q);
  if (len < 1) return null;
  const u = norm(sub(Q, P));
  const n = leftNormal(u);
  const h = (w.thicknessMm || 0) / 2;

  let tL0 = 0, tR0 = 0, tL1 = len, tR1 = len;

  // 終端 Q では腕の向き out = -u。leftNormal(-u) = -leftNormal(u) なので
  //   腕の CCW 側 = 壁の右エッジ / 腕の CW 側 = 壁の左エッジ、と入れ替わる。
  const armsE = armsAt(walls, Q);
  if (armsE.length >= 2) {
    solveJoint(Q, armsE);
    const self = armsE.find((a) => a.id === w.id);
    if (self?.cw) tL1 = dot(sub(self.cw, P), u);
    if (self?.ccw) tR1 = dot(sub(self.ccw, P), u);
  }
  // 始端 P では out = +u なので、腕の CCW 側がそのまま壁の左エッジ。
  const armsS = armsAt(walls, P);
  if (armsS.length >= 2) {
    solveJoint(P, armsS);
    const self = armsS.find((a) => a.id === w.id);
    if (self?.ccw) tL0 = dot(sub(self.ccw, P), u);
    if (self?.cw) tR0 = dot(sub(self.cw, P), u);
  }
  return { P, u, n, h, len, tL0, tR0, tL1, tR1 };
}

/** ピース（軸スパン [a,b] × 高さ [y0,y1]）の平面ポリゴン。端はマイター済みの斜め端面。 */
function piecePolygon(frame, a, b) {
  const { P, u, n, h, len, tL0, tR0, tL1, tR1 } = frame;
  const atStart = a <= 0.5;
  const atEnd = b >= len - 0.5;
  const aL = atStart ? tL0 : a;
  const aR = atStart ? tR0 : a;
  const bL = atEnd ? tL1 : b;
  const bR = atEnd ? tR1 : b;
  // 端面には壁芯の端点を経由させる。
  //   3本以上が集まる角では左右の留め点が別々の位置に来るため、端面は「壁芯の端点を
  //   頂点とするくの字」になる。これを入れないと各壁の端面の内側に三角形の穴が残る
  //   （斜め壁を既存の角に取り付けたときに見えていた白い欠け）。
  //   2本だけの角や自由端では留め点と壁芯端点が一直線に並ぶので、入れても形は変わらない。
  const pts = [
    add(add(P, mul(u, aL)), mul(n, h)),   // 始端・左
    add(add(P, mul(u, bL)), mul(n, h)),   // 終端・左
  ];
  if (atEnd) pts.push(add(P, mul(u, len)));
  pts.push(sub(add(P, mul(u, bR)), mul(n, h)));  // 終端・右
  pts.push(sub(add(P, mul(u, aR)), mul(n, h)));  // 始端・右
  if (atStart) pts.push(P);
  return pts;
}

/** 開口スパンを [50, len-50] にクランプし、offset 順に整列（重なりは前優先で切り詰め）。 */
function normalizedOpenings(w, len, wallH) {
  const list = (w.openings || [])
    .map((o) => {
      const half = Math.max(50, o.widthMm / 2);
      const c = Math.max(half + 25, Math.min(len - half - 25, o.offsetMm));
      const y0 = Math.max(0, Math.min(o.sillMm, wallH - 100));
      const y1 = Math.max(y0 + 100, Math.min(o.sillMm + o.heightMm, wallH));
      return { ...o, a: c - half, b: c + half, y0, y1 };
    })
    .sort((p, q) => p.a - q.a);
  // 重なりは後ろの開口を前の終端まで切り詰め（最低幅を割ったら捨てる）
  const out = [];
  let cursor = 0;
  for (const o of list) {
    const a = Math.max(o.a, cursor);
    if (o.b - a < 100) continue;
    out.push({ ...o, a });
    cursor = o.b;
  }
  return out;
}

/** ピース一覧（{a,b,y0,y1}）。開口の無いスパンは全高、開口スパンは腰壁/垂れ壁のみ。 */
function buildPieces(frame, openings, wallH) {
  const pieces = [];
  let cursor = 0;
  const pushSolid = (a, b) => { if (b - a > 1) pieces.push({ a, b, y0: 0, y1: wallH }); };
  for (const o of openings) {
    pushSolid(cursor, o.a);
    if (o.y0 > 5) pieces.push({ a: o.a, b: o.b, y0: 0, y1: o.y0 });         // 腰壁
    if (o.y1 < wallH - 5) pieces.push({ a: o.a, b: o.b, y0: o.y1, y1: wallH }); // 垂れ壁
    cursor = o.b;
  }
  pushSolid(cursor, frame.len);
  return pieces;
}

function polygonShape(poly, k) {
  const s = new THREE.Shape();
  s.moveTo(poly[0].x * k, -poly[0].z * k);
  for (let i = 1; i < poly.length; i++) s.lineTo(poly[i].x * k, -poly[i].z * k);
  s.closePath();
  return s;
}

/** ピース1つ＝押し出しメッシュ（＋Top では平面ポシェ）。 */
function PieceMesh({ poly, y0, y1, baseY, k, isTopView, selected, onSelect, finishMat, ghost = false }) {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(polygonShape(poly, k), { depth: (y1 - y0) * k, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [poly, y0, y1, k]);
  const pocheGeo = useMemo(() => {
    if (!isTopView || !(y0 <= PLAN_CUT_MM && PLAN_CUT_MM <= y1)) return null;
    const g = new THREE.ShapeGeometry(polygonShape(poly, k));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [poly, k, isTopView, y0, y1]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => { pocheGeo?.dispose(); }, [pocheGeo]);

  return (
    // onPointerDown で選択。床側の選択解除は onClick（pointerup 時）で走るため、
    // click も止めないと「選択した瞬間に床の click が解除する」レースになる。
    <group
      position={[0, (baseY + y0) * k, 0]}
      // ghost（他階の透過表示）は断面クリップの対象外にする。平面図は「カット高さより上を
      // 消す」クリップで描くため、上の階（例: 1F表示中の2F）の壁はカット面より上にあり、
      // 除外しないとゴーストごと消えて「上の階が重ならない」ことになる。
      // isDrawnStructure: 躯体(BaseGlb)側の「クリックで選択解除」から守るための印。
      //   躯体の屋根等が上から見て壁より手前にあると、そちらの onClick が先に走って
      //   選択が即解除されてしまう（こちらの stopPropagation では間に合わない）ため、
      //   解除側がこの印を見てスキップする。
      userData={ghost ? { isDrawnStructure: true, ignoreClipping: true } : { isDrawnStructure: true }}
      // 他階のゴーストは「見えるだけ」。触れないようにして誤選択・誤ドラッグを防ぐ。
      onPointerDown={ghost ? undefined : onSelect}
      onClick={ghost ? undefined : (e) => e.stopPropagation()}
      raycast={ghost ? () => null : undefined}
    >
      {/* 自動マテリアルの仕上げがあればそれを使う（選択中も素材はそのまま＝見た目を壊さない）。 */}
      {ghost ? (
        // 他階のトレース表示: 薄いグレーの面だけ（断面ポシェも出さない）。
        <mesh geometry={geo} userData={{ isGhostFloor: true }}>
          <meshBasicMaterial color={GHOST_COLOR} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <mesh
          geometry={geo}
          castShadow
          receiveShadow
          userData={{ isWall: true }}
          material={finishMat || undefined}
        >
          {!finishMat && (
            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
          )}
        </mesh>
      )}
      {/* 選択表現: 素材を塗り替えず、ごく薄いティントを重ねるだけ。 */}
      {selected && !ghost && (
        <mesh geometry={geo} renderOrder={9991}>
          <meshBasicMaterial color={SELECT_COLOR} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {pocheGeo && !ghost && (
        <>
          {/* ポシェは図面の要なので黒のまま。選択時は上に薄い選択色を重ねる。
              ⚠️ transparent を必ず立てる（opacity は 1 のまま）。three.js は
              「不透明を全部描いてから半透明を描く」ので、不透明のままだと renderOrder に
              関わらず半透明の床面(9980)より先に描かれ、床が壁の上に乗って見えてしまう。
              半透明リストに入れて初めて renderOrder どおり 9980 < 9990 の順になる。 */}
          <mesh geometry={pocheGeo} position={[0, (12 - y0) * k, 0]} renderOrder={9990}>
            <meshBasicMaterial color={POCHE_COLOR} side={THREE.DoubleSide} depthTest={false} transparent opacity={1} />
          </mesh>
          {selected && (
            <mesh geometry={pocheGeo} position={[0, (13 - y0) * k, 0]} renderOrder={9992}>
              <meshBasicMaterial
                color={SELECT_COLOR}
                side={THREE.DoubleSide}
                depthTest={false}
                transparent
                opacity={0.45}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

/** 平面のドア記号（開き戸: 吊元から1/4円の軌跡＋戸のライン）。 */
function DoorSymbol({ frame, opening, baseY, k }) {
  const { P, u, n } = frame;
  const r = opening.b - opening.a;
  const hinge = add(P, mul(u, opening.a));
  const pts = useMemo(() => {
    const arr = [];
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * (Math.PI / 2);
      const p = add(hinge, add(mul(u, Math.cos(th) * r), mul(n, Math.sin(th) * r)));
      arr.push([p.x * k, 0, p.z * k]);
    }
    return arr;
  }, [hinge.x, hinge.z, u.x, u.z, n.x, n.z, r, k]);
  const leafTip = add(hinge, mul(n, r));
  const y = (baseY + 14) * k;
  return (
    <group position={[0, y, 0]}>
      <Line points={pts} color={SYMBOL_COLOR} lineWidth={1.1} transparent opacity={0.75} depthTest={false} />
      <Line
        points={[[hinge.x * k, 0, hinge.z * k], [leafTip.x * k, 0, leafTip.z * k]]}
        color={SYMBOL_COLOR} lineWidth={1.4} transparent opacity={0.85} depthTest={false}
      />
    </group>
  );
}

/** 平面の窓記号（開口スパンに薄い矩形＋中芯線）。 */
function WindowSymbol({ frame, opening, baseY, k }) {
  const { P, u, n, h } = frame;
  const A = add(P, mul(u, opening.a));
  const B = add(P, mul(u, opening.b));
  const y = (baseY + 14) * k;
  const c = (p, s) => [add(p, mul(n, s)).x * k, 0, add(p, mul(n, s)).z * k];
  return (
    <group position={[0, y, 0]}>
      <Line
        points={[c(A, h), c(B, h), c(B, -h), c(A, -h), c(A, h)]}
        color={SYMBOL_COLOR} lineWidth={1.1} transparent opacity={0.8} depthTest={false}
      />
      <Line points={[c(A, 0), c(B, 0)]} color={SYMBOL_COLOR} lineWidth={1.1} transparent opacity={0.8} depthTest={false} />
    </group>
  );
}

export default function WallsRenderer({ isTopView = false }) {
  const walls = useWallStore((s) => s.walls);
  const selectedWallIds = useWallStore((s) => s.selectedWallIds);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const showOtherFloorsGhost = useEditorModeStore((s) => s.showOtherFloorsGhost);
  const ghostFloors = useEditorModeStore((s) => s.ghostFloors);
  const floors = useBuildingSpecStore((s) => s.floors);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  // 自動マテリアルで解決された壁仕上げ（未実行なら null → 既定色）。内壁/外壁で出し分ける。
  const interiorMat = useDrawnFinishMaterial("interiorWall");
  const exteriorMat = useDrawnFinishMaterial("exteriorWall");

  // 壁は「その壁自身の階」の床レベルに建てる（アクティブ階を切替えても動かない）。
  //   floorIndex 未設定の既存データは 1F 扱い。
  const floorBaseY = useMemo(() => {
    const n = Math.max(1, floors?.length || 1);
    return (i) => (fl0Mm || 0) + (floors?.[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0);
  }, [fl0Mm, floors]);

  // 全壁のフレーム・ピースをまとめて算出
  const built = useMemo(() => {
    return walls.map((w) => {
      const frame = wallFrame(walls, w);
      if (!frame) return null;
      // 既定高さはその壁が属する階の階高 / CL（階ごとに違ってよい）。
      const spec = useBuildingSpecStore.getState();
      const fi = Math.max(0, Math.min(w.floorIndex || 0, (spec.floors?.length || 1) - 1));
      const wallH = w.heightMm ?? (w.kind === "exterior" ? floorHeightOf(spec, fi) : ceilingHeightOf(spec, fi));
      const openings = normalizedOpenings(w, frame.len, wallH);
      const pieces = buildPieces(frame, openings, wallH);
      return { wall: w, frame, openings, pieces, wallH };
    }).filter(Boolean);
  }, [walls, floorHeightMm, ceilingHeightMm, floors]);

  if (!walls.length) return null;
  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;

  return (
    <group>
      {built.map(({ wall, frame, openings, pieces }) => {
        // 平面図では「アクティブ階の壁」だけを実体として描き、他階は薄いトレースにする
        // （立体/断面ではすべての階を実体で描く＝建物の実像）。
        const wallFloor = wall.floorIndex || 0;
        const ghost = isTopView && wallFloor !== (activeFloorIndex || 0);
        // 他階は既定で非表示。マスターON かつ その階の目アイコンONのときだけ透過表示する。
        if (ghost && (!showOtherFloorsGhost || !ghostFloors.includes(wallFloor))) return null;
        const selected = !ghost && selectedWallIds.includes(wall.id);
        const onSelect = (e) => {
          // 左クリックだけで選択する。onPointerDown は右/中ボタンでも飛んでくるので、
          // ここで弾かないと右クリック（＝コンテキストメニューや取消の操作）でも壁が選ばれる。
          if (e.button !== 0) return;
          // 作図ツール（壁/床/寸法）を構えている間は選択を奪わない。
          //   stopPropagation もしない＝奥にある作図用プレーンへイベントを通す。
          if (isDrawToolActive()) return;
          // Plan/Option（家具サイド）を開いている間、壁は「見えるだけ」。
          //   壁は Base 共通データなので、ここで選択→プロパティ編集/削除させると
          //   全プランが変わってしまう。編集は Base を開いてから。
          if (!isBaseEditMode()) return;
          e.stopPropagation();
          // Ctrl/Shift/⌘+クリック = 複数選択トグル。通常クリック = 単独選択。
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            useWallStore.getState().toggleWallSelection(wall.id);
          } else {
            useWallStore.getState().setSelectedWallId(wall.id);
            // 通り芯を選んでいたら解除（同時に2種類が選ばれた状態を作らない）
            useGridAxisStore.getState().setSelectedId(null);
            // 通常クリックは単独選択。別タイプ（床）の選択は解除して壁だけにする
            // （修飾キー無しで壁と床が同時選択されないように）。
            useSlabStore.getState().setSelectedSlabId(null);
          }
          useUiRightSidebarStore.getState().setRightPanel("properties", true);
        };
        const finishMat = wall.kind === "exterior" ? exteriorMat : interiorMat;
        // 壁ごとの上下オフセット（浮き壁・下がり壁）。未設定は FL に立つ。
        const wallBaseY = floorBaseY(wall.floorIndex || 0) + (wall.offsetYMm || 0);
        return (
          <group key={wall.id}>
            {pieces.map((p, i) => (
              // key に高さ(y0/y1)を含めない。含めると階高/CL を動かすたびに全ピースが
              // 再マウントされ、新しいマテリアルにクリップ面が付くまで（SectionClipManager の
              // 次の適用まで）壁が切れずに描かれてチラつく。ジオメトリは PieceMesh 内の
              // useMemo が y0/y1 を見て作り直すので、key を固定しても高さ変更は反映される。
              <PieceMesh
                key={`${wall.id}_${i}`}
                poly={piecePolygon(frame, p.a, p.b)}
                y0={p.y0} y1={p.y1}
                baseY={wallBaseY} k={k}
                isTopView={isTopView}
                selected={selected}
                onSelect={onSelect}
                finishMat={finishMat}
                ghost={ghost}
              />
            ))}
            {isTopView && !ghost && openings.map((o) =>
              o.type === "door"
                ? <DoorSymbol key={o.id} frame={frame} opening={o} baseY={wallBaseY} k={k} />
                : <WindowSymbol key={o.id} frame={frame} opening={o} baseY={wallBaseY} k={k} />
            )}
          </group>
        );
      })}
    </group>
  );
}
