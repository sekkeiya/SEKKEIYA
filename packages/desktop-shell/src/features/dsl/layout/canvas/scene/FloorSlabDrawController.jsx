// FloorSlabDrawController — 平面図(Top)で床（スラブ）を「2クリックの矩形」で作図する。
//   ツールバーの「床」ボタンで useSlabStore.drawActive を立て、
//     1回目クリック = 開始点（矩形の一方の隅）を置く
//     カーソル移動   = 開始点から現在位置までの矩形をライブプレビュー（面積ラベル付き）
//     2回目クリック = 終点（対角の隅）を置いて矩形の床を確定
//       確定と同時に床ツール自体も解除し、その床を選択状態にする
//       （そのまま頂点ハンドル／中心ギズモで編集に移れる）。
//     右クリック / Escape = 取消（下書きを捨ててコマンド終了＝ツールも解除）。
//   四角以外の形にしたいときは、確定後に SlabEditController の辺の中点「＋」ハンドルで
//   頂点を追加して折れば作れる（矩形はあくまで作図の出発点）。
//   スナップは既定でON（壁の作図と同じ）。点（壁端点・床頂点・通り芯の交点）→
//   線（通り芯・壁芯・床の辺）→ 50mm グリッドの順に効き、何に吸着したかはマーカーで出る。
//   Alt 押下中は吸着を外して自由配置。
import React, { useRef, useCallback, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiSelectionStore } from "../../store/uiSelectionStore";
import { useSlabStore, slabAreaMm2 } from "../../store/useSlabStore";
import { useWallStore } from "../../store/useWallStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { resolveDrawSnap } from "../../utils/drawSnap";
import DrawSnapMarker from "./DrawSnapMarker.jsx";

const SNAP_MM = 50;        // グリッド刻み（Shift 押下中のみ）
const PT_SNAP_MM = 250;    // 既存の壁端点／床頂点への吸着距離（Shift 押下中のみ）
const MIN_SIDE_MM = 100;   // これより細い辺の矩形は確定しない（誤クリック対策）
const PREVIEW_COLOR = "#0d9488"; // 床ツール = ティール（壁のスレートと区別）

const snap = (v) => Math.round(v / SNAP_MM) * SNAP_MM;

/** 対角の2点 → 矩形の4頂点（world XZ 軸に平行）。 */
const rectPoints = (a, b) => [
  { x: a.x, z: a.z },
  { x: b.x, z: a.z },
  { x: b.x, z: b.z },
  { x: a.x, z: b.z },
];

export default function FloorSlabDrawController({ enabled = true }) {
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const drawActive = useSlabStore((s) => s.drawActive);
  const draftPoints = useSlabStore((s) => s.draftPoints);
  const setDraftPoints = useSlabStore((s) => s.setDraftPoints);

  const { gl } = useThree();
  // 矩形の開始点。null = 未開始（次のクリックが開始点になる）。
  const anchorRef = useRef(null);

  const active = enabled && drawActive;

  // 今どこへ吸着しているか（マーカー表示用）。
  const [snapHint, setSnapHint] = useState(null);

  /**
   * クリック位置を決める。スナップは Shift 押下中のみ。
   *   点（壁端点・床頂点・通り芯の交点）→ 線（通り芯・壁芯・床の辺）→ 50mm グリッド。
   *   Alt 押下中は吸着を外して自由配置。
   */
  const resolvePoint = useCallback((e) => {
    // 矩形の作図なので直交スナップ（anchor 基準の水平/垂直寄せ）は使わない。
    const r = resolveDrawSnap({ x: e.point.x, z: e.point.z }, null, !!e.altKey);
    setSnapHint(r.kind ? r : null);
    return { x: r.x, z: r.z };
  }, []);

  // ツールを離れたら吸着マーカーも消す。
  useEffect(() => { if (!active) setSnapHint(null); }, [active]);

  /** 下書きを捨ててコマンド終了（床ツール自体も解除する）。 */
  const cancelCommand = useCallback(() => {
    const st = useSlabStore.getState();
    st.setDraftPoints([]);
    st.setDrawActive(false);
    anchorRef.current = null;
  }, []);

  // Escape = 取消（下書きを捨ててコマンド終了）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || !useSlabStore.getState().drawActive) return;
      e.stopPropagation();
      cancelCommand();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelCommand]);

  // ツール解除／Top を離れたら下書きを破棄
  useEffect(() => {
    if (!active) {
      anchorRef.current = null;
      if (useSlabStore.getState().draftPoints.length > 0) useSlabStore.getState().setDraftPoints([]);
    }
  }, [active]);

  // 右クリック＝取消で受けた分だけブラウザのコンテキストメニューを抑止する。
  // 取消はツール自体を解除する（active が false になる）ので、リスナを active で
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

    // 右クリック = 取消（作図を始めていなくても「ツールを構えたのをやめる」出口になる）
    if (e.button === 2) {
      e.stopPropagation();
      suppressCtxRef.current = true; // 直後に来る contextmenu を1回だけ止める
      cancelCommand();
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();

    const p = resolvePoint(e);

    // 1回目 = 開始点を置く
    if (!anchorRef.current) {
      useUiSelectionStore.getState().setSelectedItemIds([]);
      useSlabStore.getState().setSelectedSlabId(null);
      useWallStore.getState().setSelectedWallId(null); // 作図中は他タイプの選択も畳む
      anchorRef.current = p;
      setDraftPoints(rectPoints(p, p));
      return;
    }

    // 2回目 = 終点。矩形を確定してコマンド終了（ツールも解除）。
    const a = anchorRef.current;
    // 潰れた矩形は無視（開始点は動かさずクリックし直せる）
    if (Math.abs(p.x - a.x) < MIN_SIDE_MM || Math.abs(p.z - a.z) < MIN_SIDE_MM) return;
    const st = useSlabStore.getState();
    // 作図した時点のアクティブ階を記録する（以後その階の FL に敷かれる）。
    // addSlab はその床を選択状態にするので、そのまま編集に移れる。
    st.addSlab(rectPoints(a, p), useBuildingSpecStore.getState().activeFloorIndex || 0);
    st.setDrawActive(false);
    anchorRef.current = null;
  }, [active, resolvePoint, setDraftPoints, cancelCommand]);

  // 開始点が決まっていれば、カーソル位置までの矩形をプレビュー（ボタンは押していなくてよい）
  const handlePointerMove = useCallback((e) => {
    e.stopPropagation();
    const a = anchorRef.current;
    // 開始点を置く前もカーソル位置の吸着を解決しておく（マーカーで狙いを付けられる）。
    const pt = resolvePoint(e);
    if (!a) return;
    setDraftPoints(rectPoints(a, pt));
  }, [resolvePoint, setDraftPoints]);

  const y = gridHeightMm + 2;
  // プレビューは矩形の4頂点（閉じた輪郭で描く）
  const hasPreview = draftPoints.length === 4;
  const areaM2 = hasPreview ? slabAreaMm2(draftPoints) / 1_000_000 : 0;
  const centroid = hasPreview
    ? {
        x: (draftPoints[0].x + draftPoints[2].x) / 2,
        z: (draftPoints[0].z + draftPoints[2].z) / 2,
      }
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

      {/* 吸着マーカー（何に吸着しているかを形と色で示す） */}
      {active && <DrawSnapMarker snap={snapHint} y={gridHeightMm + 3} />}

      {/* ライブプレビュー（矩形の輪郭＋面積ラベル）。輪郭は動かし始めた時点から出す。 */}
      {hasPreview && (
        <>
          <Line
            points={[...draftPoints, draftPoints[0]].map((p) => [p.x, y, p.z])}
            color={PREVIEW_COLOR} lineWidth={2.2} transparent opacity={0.9} depthTest={false}
          />
          {centroid && areaM2 > 0.001 && (
            <Html position={[centroid.x, y, centroid.z]} center zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
              <div
                style={{
                  padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
                  color: "#f0fdfa", background: "rgba(13,148,136,0.85)",
                  border: "1px solid rgba(153,246,228,0.35)",
                  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
                }}
              >
                床 {areaM2.toFixed(2)}㎡（クリックで確定）
              </div>
            </Html>
          )}
        </>
      )}
    </>
  );
}
