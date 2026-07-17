// WallsRenderer — useWallStore の壁を 3D 表示する。
//   ・高さ: 外壁=階高（floorHeightMm） / 内壁=CL（ceilingHeightMm）。wall.heightMm があればそれを優先。
//   ・角の処理（マイター）: 壁芯から左右に t/2 オフセットした線の交点で端部を留める。
//     マイター点は必ずオフセット線上に乗るため、壁の左右エッジは常に「オフセット線の区間」
//     になる。これを利用して、壁を軸方向スパン×上下レンジの「ピース」に分割できる。
//   ・開口部（ドア/窓）: 開口スパンでは下（腰壁）と上（垂れ壁）のピースだけを作り、
//     間を実際の穴として抜く。平面図はカット高さ(1500mm)に交差するピースのみポシェ表示
//     するので、ドア/窓のスパンは自然にギャップになる。加えてドアは1/4円の開き軌跡、
//     窓は薄い矩形記号を描く（建築図面の作法）。
//   ・クリックで選択（Properties に壁設定を出す）。
import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useWallStore } from "../../store/useWallStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useDrawnFinishMaterial } from "./useDrawnFinishMaterial";

const POCHE_COLOR = "#0f172a";   // 平面図の壁ポシェ（断面）
const WALL_COLOR = "#cbd5e1";    // 立体の壁面
const SELECT_COLOR = "#38bdf8";
const SYMBOL_COLOR = "#475569";  // 平面のドア/窓記号
const JOINT_TOL = 1;             // 端点一致とみなす距離(mm)
const MITER_LIMIT = 4;           // マイター長の上限（× 壁厚半分）
const PLAN_CUT_MM = 1500;        // 平面図の想定カット高さ（床からの相対）

// ── XZ 平面の 2D ベクトル小道具 ─────────────────────────────
const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
const mul = (v, s) => ({ x: v.x * s, z: v.z * s });
const neg = (v) => ({ x: -v.x, z: -v.z });
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

function miterAt(Q, u1, h1, u2, h2) {
  const n1 = leftNormal(u1);
  const n2 = leftNormal(u2);
  const L = intersect(add(Q, mul(n1, h1)), u1, add(Q, mul(n2, h2)), u2);
  const R = intersect(sub(Q, mul(n1, h1)), u1, sub(Q, mul(n2, h2)), u2);
  if (!L || !R) return null;
  const lim = MITER_LIMIT * Math.max(h1, h2);
  if (dist(L, Q) > lim || dist(R, Q) > lim) return null;
  return { left: L, right: R };
}

function neighborAt(walls, self, p) {
  for (const o of walls) {
    if (o.id === self.id) continue;
    if (dist(o.start, p) <= JOINT_TOL) return { wall: o, out: norm(sub(o.end, o.start)) };
    if (dist(o.end, p) <= JOINT_TOL) return { wall: o, out: norm(sub(o.start, o.end)) };
  }
  return null;
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

  const nbE = neighborAt(walls, w, Q);
  if (nbE) {
    const m = miterAt(Q, u, h, nbE.out, (nbE.wall.thicknessMm || 0) / 2);
    if (m) { tL1 = dot(sub(m.left, P), u); tR1 = dot(sub(m.right, P), u); }
  }
  const nbS = neighborAt(walls, w, P);
  if (nbS) {
    const m = miterAt(P, neg(nbS.out), (nbS.wall.thicknessMm || 0) / 2, u, h);
    if (m) { tL0 = dot(sub(m.left, P), u); tR0 = dot(sub(m.right, P), u); }
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
  return [
    add(add(P, mul(u, aL)), mul(n, h)),
    add(add(P, mul(u, bL)), mul(n, h)),
    sub(add(P, mul(u, bR)), mul(n, h)),
    sub(add(P, mul(u, aR)), mul(n, h)),
  ];
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
function PieceMesh({ poly, y0, y1, baseY, k, isTopView, selected, onSelect, finishMat }) {
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
    <group position={[0, (baseY + y0) * k, 0]} onPointerDown={onSelect} onClick={(e) => e.stopPropagation()}>
      {/* 自動マテリアルの仕上げがあればそれを使う（選択中も素材はそのまま＝見た目を壊さない）。 */}
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
      {/* 選択表現: 素材を塗り替えず、ごく薄いティントを重ねるだけ。 */}
      {selected && (
        <mesh geometry={geo} renderOrder={9991}>
          <meshBasicMaterial color={SELECT_COLOR} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {pocheGeo && (
        <>
          {/* ポシェは図面の要なので黒のまま。選択時は上に薄い選択色を重ねる。 */}
          <mesh geometry={pocheGeo} position={[0, (12 - y0) * k, 0]} renderOrder={9990}>
            <meshBasicMaterial color={POCHE_COLOR} side={THREE.DoubleSide} depthTest={false} />
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
  const floors = useBuildingSpecStore((s) => s.floors);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  // 自動マテリアルで解決された壁仕上げ（未実行なら null → 既定色）。内壁/外壁で出し分ける。
  const interiorMat = useDrawnFinishMaterial("interiorWall");
  const exteriorMat = useDrawnFinishMaterial("exteriorWall");

  // 壁はアクティブ階の床レベルに建てる（家具の配置高さと同じ規約）。
  const baseY = useMemo(() => {
    const i = Math.max(0, Math.min(activeFloorIndex || 0, (floors?.length || 1) - 1));
    return (fl0Mm || 0) + (floors?.[i]?.flMm || 0);
  }, [fl0Mm, floors, activeFloorIndex]);

  // 全壁のフレーム・ピースをまとめて算出
  const built = useMemo(() => {
    return walls.map((w) => {
      const frame = wallFrame(walls, w);
      if (!frame) return null;
      const wallH = w.heightMm ?? (w.kind === "exterior" ? floorHeightMm : ceilingHeightMm);
      const openings = normalizedOpenings(w, frame.len, wallH);
      const pieces = buildPieces(frame, openings, wallH);
      return { wall: w, frame, openings, pieces, wallH };
    }).filter(Boolean);
  }, [walls, floorHeightMm, ceilingHeightMm]);

  if (!walls.length) return null;
  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;

  return (
    <group>
      {built.map(({ wall, frame, openings, pieces }) => {
        const selected = selectedWallIds.includes(wall.id);
        const onSelect = (e) => {
          e.stopPropagation();
          // Ctrl/Shift/⌘+クリック = 複数選択トグル。通常クリック = 単独選択。
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            useWallStore.getState().toggleWallSelection(wall.id);
          } else {
            useWallStore.getState().setSelectedWallId(wall.id);
          }
          useUiRightSidebarStore.getState().setRightPanel("properties", true);
        };
        const finishMat = wall.kind === "exterior" ? exteriorMat : interiorMat;
        return (
          <group key={wall.id}>
            {pieces.map((p, i) => (
              <PieceMesh
                key={`${wall.id}_${i}_${p.y0}_${p.y1}`}
                poly={piecePolygon(frame, p.a, p.b)}
                y0={p.y0} y1={p.y1}
                baseY={baseY} k={k}
                isTopView={isTopView}
                selected={selected}
                onSelect={onSelect}
                finishMat={finishMat}
              />
            ))}
            {isTopView && openings.map((o) =>
              o.type === "door"
                ? <DoorSymbol key={o.id} frame={frame} opening={o} baseY={baseY} k={k} />
                : <WindowSymbol key={o.id} frame={frame} opening={o} baseY={baseY} k={k} />
            )}
          </group>
        );
      })}
    </group>
  );
}
