// FloorSlabDrawController — 平面図(Top)で床（スラブ）を左クリック連打の多角形で作図する。
//   ツールバーの「床」ボタンで useSlabStore.drawActive を立て、
//     クリック = 頂点を追加（50mmスナップ／前の頂点基準の直交スナップ。Alt で自由角度）
//     最初の頂点の近くをクリック or 右クリック（=Enter） = 多角形を閉じてスラブ確定。
//       同時に床ツール自体も解除し、確定した床を選択状態にする（そのまま頂点編集に移れる）。
//     Escape = 取消。下書きを捨ててコマンド終了（＝ツールも解除）。
//   壁の作図（WallDrawController）と同じ操作系に揃えている。
import React, { useRef, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiSelectionStore } from "../../store/uiSelectionStore";
import { useSlabStore, SLAB_MIN_POINTS, slabAreaMm2 } from "../../store/useSlabStore";

const SNAP_MM = 50;        // グリッド刻み
const CLOSE_SNAP_MM = 250; // 最初の頂点へ吸着して閉じる距離
const ORTHO_TOL = 0.28;    // 直交スナップの許容（rad ≒ 16°）
const PREVIEW_COLOR = "#0d9488"; // 床ツール = ティール（壁のスレートと区別）

const snap = (v) => Math.round(v / SNAP_MM) * SNAP_MM;

export default function FloorSlabDrawController({ enabled = true }) {
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const drawActive = useSlabStore((s) => s.drawActive);
  const draftPoints = useSlabStore((s) => s.draftPoints);
  const setDraftPoints = useSlabStore((s) => s.setDraftPoints);

  const { gl } = useThree();
  // カーソル位置（プレビュー用）。draft の最後の点から引く。
  const cursorRef = useRef(null);
  const [, force] = React.useReducer((c) => c + 1, 0);

  const active = enabled && drawActive;

  /** 直交スナップ（前の頂点基準。Alt で解除）＋グリッドスナップ。 */
  const resolvePoint = useCallback((e, prev) => {
    const raw = { x: e.point.x, z: e.point.z };
    let p = raw;
    if (!e.altKey && prev) {
      const dx = p.x - prev.x, dz = p.z - prev.z;
      if (dx !== 0 || dz !== 0) {
        const ang = Math.atan2(Math.abs(dz), Math.abs(dx));
        if (ang < ORTHO_TOL) p = { x: p.x, z: prev.z };
        else if (ang > Math.PI / 2 - ORTHO_TOL) p = { x: prev.x, z: p.z };
      }
    }
    return { x: snap(p.x), z: snap(p.z) };
  }, []);

  /**
   * コマンドを終了する（右クリック／Enter＝確定、Escape＝取消）。壁の作図と同じ流儀で、
   * 終了と同時に床ツール自体も解除する。commit=true かつ3点以上なら多角形を閉じて確定し、
   * addSlab がその床を選択状態にするので、そのまま頂点ハンドルで編集に移れる。
   */
  const finishCommand = useCallback((commit) => {
    const st = useSlabStore.getState();
    const pts = st.draftPoints;
    if (commit && pts.length >= SLAB_MIN_POINTS) st.addSlab(pts);
    else st.setDraftPoints([]);
    st.setDrawActive(false);
    cursorRef.current = null;
  }, []);

  // Enter = 確定（コマンド終了）／Escape = 取消（下書きを捨ててコマンド終了）
  useEffect(() => {
    const onKey = (e) => {
      const st = useSlabStore.getState();
      if (e.key === "Enter" && st.draftPoints.length >= SLAB_MIN_POINTS) {
        e.stopPropagation();
        finishCommand(true);
        return;
      }
      if (e.key !== "Escape" || !st.drawActive) return;
      e.stopPropagation();
      finishCommand(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishCommand]);

  // ツール解除／Top を離れたら下書きを破棄
  useEffect(() => {
    if (!active && useSlabStore.getState().draftPoints.length > 0) {
      useSlabStore.getState().setDraftPoints([]);
      cursorRef.current = null;
    }
  }, [active]);

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

  const handlePointerDown = useCallback((e) => {
    if (!active) return;

    // 右クリック = Enter（3点以上なら閉じて確定。コマンド終了＝ツールも解除）。
    // 作図を始めていなくても「ツールを構えたのをやめる」出口として機能させる。
    if (e.button === 2) {
      e.stopPropagation();
      suppressCtxRef.current = true; // 直後に来る contextmenu を1回だけ止める
      finishCommand(true);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();

    const pts = useSlabStore.getState().draftPoints;
    const prev = pts.length ? pts[pts.length - 1] : null;
    const p = resolvePoint(e, prev);

    if (pts.length === 0) {
      useUiSelectionStore.getState().setSelectedItemIds([]);
      useSlabStore.getState().setSelectedSlabId(null);
      setDraftPoints([p]);
      return;
    }
    // 最初の頂点の近く = 閉じる
    const first = pts[0];
    if (pts.length >= SLAB_MIN_POINTS && Math.hypot(p.x - first.x, p.z - first.z) <= CLOSE_SNAP_MM) {
      finishCommand(true);
      return;
    }
    // 直前と同一点は無視
    if (prev && Math.hypot(p.x - prev.x, p.z - prev.z) < 1) return;
    setDraftPoints([...pts, p]);
  }, [active, resolvePoint, setDraftPoints, finishCommand]);

  const handlePointerMove = useCallback((e) => {
    const pts = useSlabStore.getState().draftPoints;
    if (!pts.length) return;
    e.stopPropagation();
    cursorRef.current = resolvePoint(e, pts[pts.length - 1]);
    force();
  }, [resolvePoint]);

  const y = gridHeightMm + 2;
  const cursor = cursorRef.current;
  // プレビュー: 確定済み頂点 ＋ カーソル位置
  const previewPts = draftPoints.length
    ? [...draftPoints, ...(cursor ? [cursor] : [])]
    : [];
  const areaM2 = previewPts.length >= 3 ? slabAreaMm2(previewPts) / 1_000_000 : 0;
  const centroid = previewPts.length
    ? previewPts.reduce((a, p) => ({ x: a.x + p.x / previewPts.length, z: a.z + p.z / previewPts.length }), { x: 0, z: 0 })
    : null;

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

      {/* ライブプレビュー（外周ライン＋閉じる破線＋面積ラベル） */}
      {previewPts.length >= 2 && (
        <>
          <Line
            points={previewPts.map((p) => [p.x, y, p.z])}
            color={PREVIEW_COLOR} lineWidth={2.2} transparent opacity={0.9} depthTest={false}
          />
          {previewPts.length >= 3 && (
            <Line
              points={[
                [previewPts[previewPts.length - 1].x, y, previewPts[previewPts.length - 1].z],
                [previewPts[0].x, y, previewPts[0].z],
              ]}
              color={PREVIEW_COLOR} lineWidth={1.4} transparent opacity={0.55} depthTest={false}
              dashed dashSize={220} gapSize={120}
            />
          )}
          {centroid && areaM2 > 0.01 && (
            <Html position={[centroid.x, y, centroid.z]} center zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
              <div
                style={{
                  padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
                  color: "#f0fdfa", background: "rgba(13,148,136,0.85)",
                  border: "1px solid rgba(153,246,228,0.35)",
                  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
                }}
              >
                床 {areaM2.toFixed(2)}㎡（右クリックで確定）
              </div>
            </Html>
          )}
        </>
      )}
    </>
  );
}
