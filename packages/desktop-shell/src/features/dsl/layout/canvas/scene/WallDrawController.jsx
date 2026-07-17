// WallDrawController — 平面図(Top)で壁（内壁／外壁）を左クリックの連打で連続作図する。
//   ツールバーの「内壁」「外壁」ボタンで useWallStore.drawKind を立て、
//   透明フロアプレーン上で
//     1回目クリック = 始点を置く／2回目以降 = そこまでの壁を確定し、その点から続けて次の壁へ
//   （ポリライン作図。折れ線でどんどん壁をつないでいける）
//   ・50mm グリッドスナップ（ゾーン作図と同じ刻み）
//   ・既定で直交スナップ（水平/垂直へ吸着）。Alt 押下中は自由角度。
//   ・既存の壁端点にも近ければスナップ（つなぎ目・閉合対策）
//   ・右クリック = Enter（コマンド終了）。連続作図を終えると同時に壁ツール自体を解除し、
//     最後に描いた壁を選択状態にする（そのまま頂点ハンドルで編集に移れる）。AutoCAD の
//     LINE コマンドと同じ流儀。別の壁を描くときは内壁/外壁ボタンを押し直す。
//   ・Escape = 取消。同じくコマンドを終えるが、選択はしない（確定済みの壁は残る）。
import React, { useRef, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiSelectionStore } from "../../store/uiSelectionStore";
import {
  useWallStore,
  makeWall,
  WALL_MIN_LENGTH,
  WALL_DEFAULT_THICKNESS,
  WALL_KIND_LABEL,
} from "../../store/useWallStore";
import { useSlabStore } from "../../store/useSlabStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";

const SNAP_MM = 50;        // グリッド刻み
const END_SNAP_MM = 250;   // 既存端点への吸着距離
const ORTHO_TOL = 0.28;    // 直交スナップの許容（rad ≒ 16°）

const PREVIEW_COLOR = { exterior: "#0f172a", interior: "#475569" };

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const snap = (v) => Math.round(v / SNAP_MM) * SNAP_MM;

export default function WallDrawController({ enabled = true }) {
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const drawKind = useWallStore((s) => s.drawKind);
  const draftLine = useWallStore((s) => s.draftLine);
  const setDraftLine = useWallStore((s) => s.setDraftLine);

  const { camera, raycaster, gl } = useThree();
  // 連続作図の現在の起点。null = 未開始（次のクリックが始点になる）。
  const anchorRef = useRef(null);

  const active = enabled && !!drawKind;

  /** 既存の壁端点＋床（スラブ）の頂点へ吸着（近い方を優先） */
  const snapToEnds = useCallback((pt) => {
    let best = null;
    let bestD = END_SNAP_MM;
    const consider = (p) => {
      const d = Math.hypot(p.x - pt.x, p.z - pt.z);
      if (d < bestD) { bestD = d; best = p; }
    };
    for (const w of useWallStore.getState().walls) { consider(w.start); consider(w.end); }
    for (const s of useSlabStore.getState().slabs) for (const p of s.points || []) consider(p);
    return best ? { x: best.x, z: best.z } : null;
  }, []);

  /** 床（スラブ）の辺へ吸着: 辺までの距離が閾値内なら、辺上の最近点に乗せる。 */
  const snapToSlabEdges = useCallback((pt) => {
    let best = null;
    let bestD = END_SNAP_MM;
    for (const s of useSlabStore.getState().slabs) {
      const pts = s.points || [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const ex = b.x - a.x, ez = b.z - a.z;
        const len2 = ex * ex + ez * ez;
        if (len2 < 1) continue;
        let t = ((pt.x - a.x) * ex + (pt.z - a.z) * ez) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + ex * t, cz = a.z + ez * t;
        const d = Math.hypot(cx - pt.x, cz - pt.z);
        if (d < bestD) { bestD = d; best = { x: Math.round(cx), z: Math.round(cz) }; }
      }
    }
    return best;
  }, []);

  /** 始点からの直交スナップ（Alt で解除） */
  const applyOrtho = useCallback((start, pt, altKey) => {
    if (altKey) return pt;
    const dx = pt.x - start.x;
    const dz = pt.z - start.z;
    if (dx === 0 && dz === 0) return pt;
    const ang = Math.atan2(Math.abs(dz), Math.abs(dx));
    if (ang < ORTHO_TOL) return { x: pt.x, z: start.z };              // 水平
    if (ang > Math.PI / 2 - ORTHO_TOL) return { x: start.x, z: pt.z }; // 垂直
    return pt;
  }, []);

  // この連続作図で最後に確定した壁（Enter で選択状態にして編集へ引き渡す）
  const lastWallIdRef = useRef(null);

  /** 連続作図の状態だけ畳む（確定済みの壁は残す）。ツールの解除はしない。 */
  const endChain = useCallback(() => {
    anchorRef.current = null;
    setDraftLine(null);
  }, [setDraftLine]);

  /**
   * コマンドを終了する（右クリック＝Enter／Escape）。
   * 連続作図を畳み、壁ツール自体も解除する。select=true なら最後に描いた壁を選択して
   * 頂点ハンドル（WallEditController）へそのまま引き渡す。
   */
  const finishCommand = useCallback((select) => {
    endChain();
    useWallStore.getState().setDrawKind(null);
    const id = lastWallIdRef.current;
    lastWallIdRef.current = null;
    if (select && id) {
      useWallStore.getState().setSelectedWallId(id);
      useUiRightSidebarStore.getState().setRightPanel("properties", true);
    }
  }, [endChain]);

  // Escape = 取消（コマンド終了。選択はしない）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (!useWallStore.getState().drawKind) return;
      e.stopPropagation();
      finishCommand(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishCommand]);

  // ツール解除／Top を離れたら作図中断。ツールボタンで解除された場合もここを通るので、
  // 「前回の最後の壁」が残って次回の Enter で誤って選択されないよう一緒に捨てる。
  useEffect(() => {
    if (active) return;
    lastWallIdRef.current = null;
    if (anchorRef.current) endChain();
  }, [active, endChain]);

  // 右クリック＝Enter で受けた分だけブラウザのコンテキストメニューを抑止する。
  // Enter はツール自体を解除する（active が false になる）ので、リスナを active で
  // 出し入れすると解除の直後にメニューが出てしまう。常時張っておき、pointerdown 側が
  // 立てたフラグを見て1回だけ止める。
  const suppressCtxRef = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const onCtx = (e) => {
      if (!suppressCtxRef.current) return;
      suppressCtxRef.current = false;
      e.preventDefault();
    };
    el.addEventListener("contextmenu", onCtx);
    return () => el.removeEventListener("contextmenu", onCtx);
  }, [gl]);

  // スナップの優先順位: 壁端点/床頂点（完全吸着）→ 床の辺（辺上の最近点）→ 直交＋グリッド
  const resolvePoint = useCallback((e, start) => {
    const raw = { x: e.point.x, z: e.point.z };
    const ends = snapToEnds(raw);
    if (ends) return ends;
    const edge = snapToSlabEdges(raw);
    if (edge) return edge;
    const orth = start ? applyOrtho(start, raw, e.altKey) : raw;
    return { x: snap(orth.x), z: snap(orth.z) };
  }, [snapToEnds, snapToSlabEdges, applyOrtho]);

  // 左クリック連打で連続作図:
  //   1回目 = 始点を置く／2回目以降 = そこまでの壁を確定し、その点を次の始点にして続行。
  //   右クリック = Enter（連続作図を終了）。
  const handlePointerDown = useCallback((e) => {
    if (!active) return;

    // 右クリック = Enter（確定済みの壁は残してコマンドを終える＝ツールも解除）。
    // 作図を始めていなくても「ツールを構えたのをやめる」出口として機能させる。
    if (e.button === 2) {
      e.stopPropagation();
      suppressCtxRef.current = true; // 直後に来る contextmenu を1回だけ止める
      finishCommand(true);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();

    const anchor = anchorRef.current;
    const pt = resolvePoint(e, anchor);

    if (!anchor) {
      // 始点を置く
      useUiSelectionStore.getState().setSelectedItemIds([]);
      useWallStore.getState().setSelectedWallId(null);
      anchorRef.current = pt;
      setDraftLine({ start: pt, end: pt });
      return;
    }

    // 短すぎる区間は無視（起点は動かさずクリックし直せる）
    const len = Math.hypot(pt.x - anchor.x, pt.z - anchor.z);
    if (len < WALL_MIN_LENGTH) return;

    const wall = makeWall(drawKind, anchor, pt);
    useWallStore.getState().addWall(wall);
    lastWallIdRef.current = wall.id; // Enter で選択して編集へ渡す
    // 確定した終点から続けて次の壁へ（ポリライン）
    anchorRef.current = pt;
    setDraftLine({ start: pt, end: pt });
  }, [active, drawKind, resolvePoint, setDraftLine, finishCommand]);

  // 起点が決まっていれば、カーソル位置までをプレビュー（ボタンは押していなくてよい）
  const handlePointerMove = useCallback((e) => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    e.stopPropagation();
    const pt = resolvePoint(e, anchor);
    setDraftLine({ start: anchor, end: pt });
  }, [resolvePoint, setDraftLine]);

  const y = gridHeightMm + 2;
  const preview = draftLine;
  const previewLen = preview
    ? Math.hypot(preview.end.x - preview.start.x, preview.end.z - preview.start.z)
    : 0;

  return (
    <>
      {/* 作図用の透明フロアプレーン（ツール選択中のみ） */}
      {active && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, gridHeightMm, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <planeGeometry args={[100000, 100000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}

      {/* ライブプレビュー（壁厚の帯＋長さラベル） */}
      {preview && previewLen > 1 && (
        <>
          <Line
            points={[
              [preview.start.x, y, preview.start.z],
              [preview.end.x, y, preview.end.z],
            ]}
            color={PREVIEW_COLOR[drawKind] || "#475569"}
            lineWidth={Math.max(3, (WALL_DEFAULT_THICKNESS[drawKind] || 100) / 40)}
            transparent
            opacity={0.75}
            depthTest={false}
          />
          <Html
            position={[
              (preview.start.x + preview.end.x) / 2,
              y,
              (preview.start.z + preview.end.z) / 2,
            ]}
            center
            zIndexRange={[18, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                transform: "translateY(-18px)",
                padding: "2px 7px",
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: "#f8fafc",
                background: "rgba(15,23,42,0.85)",
                border: "1px solid rgba(148,163,184,0.3)",
                fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
              }}
            >
              {WALL_KIND_LABEL[drawKind]} {(previewLen / 1000).toFixed(2)}m
            </div>
          </Html>
        </>
      )}
    </>
  );
}
