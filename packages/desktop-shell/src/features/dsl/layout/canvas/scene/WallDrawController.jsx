// WallDrawController — 平面図(Top)で壁（内壁／外壁）を左クリックの連打で連続作図する。
//   ツールバーの「内壁」「外壁」ボタンで useWallStore.drawKind を立て、
//   透明フロアプレーン上で
//     1回目クリック = 始点を置く／2回目以降 = そこまでの壁を確定し、その点から続けて次の壁へ
//   （ポリライン作図。折れ線でどんどん壁をつないでいける）
//   ・スナップは既定でON（CAD と同じ流儀。何に吸着したかはマーカーとラベルで出る）。
//     点（壁の端点／床の頂点／通り芯の交点）→ 直交（水平/垂直）→
//     線（通り芯・壁芯・床の辺）→ 50mm グリッド、の順に効く。
//     Alt 押下中は吸着も直交も外れて自由配置（角度も長さも自由）。
//   ・右クリック = Enter（コマンド終了）。連続作図を終えると同時に壁ツール自体を解除し、
//     最後に描いた壁を選択状態にする（そのまま頂点ハンドルで編集に移れる）。AutoCAD の
//     LINE コマンドと同じ流儀。別の壁を描くときは内壁/外壁ボタンを押し直す。
//   ・Escape = 取消。同じくコマンドを終えるが、選択はしない（確定済みの壁は残る）。
import React, { useRef, useCallback, useEffect, useState } from "react";
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
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { resolveDrawSnap } from "../../utils/drawSnap";
import DrawSnapMarker from "./DrawSnapMarker.jsx";


const PREVIEW_COLOR = { exterior: "#0f172a", interior: "#475569" };

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export default function WallDrawController({ enabled = true }) {
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const drawKind = useWallStore((s) => s.drawKind);
  const draftLine = useWallStore((s) => s.draftLine);
  const setDraftLine = useWallStore((s) => s.setDraftLine);

  const { camera, raycaster, gl } = useThree();
  // 連続作図の現在の起点。null = 未開始（次のクリックが始点になる）。
  const anchorRef = useRef(null);

  const active = enabled && !!drawKind;

  // 吸着（点・通り芯・壁芯・床の辺・グリッド）は utils/drawSnap に集約。

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
    setSnapHint(null);
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

  // 今どこへ吸着しているか（マーカー表示用）。
  const [snapHint, setSnapHint] = useState(null);

  // 吸着は utils/drawSnap に集約（壁ツールと床ツールで同じ挙動にする）。
  //   点（壁端点・床頂点・通り芯の交点）→ 直交 → 線（通り芯・壁芯・床の辺）→ 50mmグリッド。
  //   Alt 押下中は吸着も直交も外して自由配置。
  const resolvePoint = useCallback((e, start) => {
    const r = resolveDrawSnap({ x: e.point.x, z: e.point.z }, start || null, !!e.altKey);
    setSnapHint(r.kind ? r : null);
    return { x: r.x, z: r.z };
  }, []);

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
      useSlabStore.getState().setSelectedSlabId(null); // 作図中は他タイプの選択も畳む
      anchorRef.current = pt;
      setDraftLine({ start: pt, end: pt });
      return;
    }

    // 短すぎる区間は無視（起点は動かさずクリックし直せる）
    const len = Math.hypot(pt.x - anchor.x, pt.z - anchor.z);
    if (len < WALL_MIN_LENGTH) return;

    // 作図した時点のアクティブ階を記録する（以後その階の FL に建つ）。
    const wall = makeWall(drawKind, anchor, pt, useBuildingSpecStore.getState().activeFloorIndex || 0);
    useWallStore.getState().addWall(wall);
    lastWallIdRef.current = wall.id; // Enter で選択して編集へ渡す
    // 確定した終点から続けて次の壁へ（ポリライン）
    anchorRef.current = pt;
    setDraftLine({ start: pt, end: pt });
  }, [active, drawKind, resolvePoint, setDraftLine, finishCommand]);

  // 起点が決まっていれば、カーソル位置までをプレビュー（ボタンは押していなくてよい）
  const handlePointerMove = useCallback((e) => {
    e.stopPropagation();
    const anchor = anchorRef.current;
    // 始点を置く前もカーソル位置の吸着を解決しておく（どこに乗るか見えないと置けない）。
    const pt = resolvePoint(e, anchor || null);
    if (!anchor) return;
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

      {/* 吸着マーカー（何に吸着しているかを形と色で示す） */}
      {active && <DrawSnapMarker snap={snapHint} y={y} />}

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
