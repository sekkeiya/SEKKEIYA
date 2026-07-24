// ElevationDimensionsOverlay — 展開図（部屋の壁面姿図）に図面の体裁を与える注記レイヤー。
//   ① 下端: 家具エッジで区切った連続セグメント寸法列 ＋ 内法の全幅寸法
//   ② 画面左: 高さのセグメント寸法列（家具天端で区切る）＋ 全高（FL〜CL）
//   ③ 断面ポシェ: 天井・床・両側壁の切り口を濃色の枠で描き「部屋を切った」見た目にする
//   寸法は mm 表示（測定誤差は 5mm 丸めで吸収）。各値はダブルクリックで手入力できる
//   （全高→CL は実データを更新 / それ以外は表示のみの上書き＝useElevationDimOverridesStore）。
//   すべて図面注記なので断面クリップ対象外（userData.ignoreClipping）・深度無視で最前面に描く。
//   表示は展開図ビュー（useElevationMarkerStore.viewActive）かつ部屋範囲（roomBox）があるときのみ。
import React, { useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import {
  useElevationMarkerStore,
  ELEV_ROOM_PAD_MM,
} from "../../store/useElevationMarkerStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useRoomElevationsStore } from "../../store/useRoomElevationsStore";
import { useElevationDimOverridesStore } from "../../store/useElevationDimOverridesStore";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { measureBaseInterior } from "../../utils/baseFootprint";

const INK = "#475569";        // 寸法線（ミディアムスレート）
const INK_DARK = "#0f172a";   // 文字
const ACCENT = "#0369a1";     // 手入力で上書き中の文字色
const POCHE = "#1e293b";      // 断面ポシェ（切り口）

// 寸法は mm 表示。測定誤差（998.98mm など）を吸収するため 5mm 単位に丸める。
const roundMm = (mm) => Math.round(mm / 5) * 5;

const TAG_STYLE = (strong, overridden) => ({
  fontSize: strong ? 11 : 10,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: overridden ? ACCENT : INK_DARK,
  background: "rgba(255,255,255,0.92)",
  border: `1px solid ${overridden ? "rgba(3,105,161,0.5)" : "rgba(30,41,59,0.35)"}`,
  borderRadius: 3,
  padding: "0px 4px",
  whiteSpace: "nowrap",
  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
});

const inputStyle = {
  width: 60, fontSize: 11, fontWeight: 700, textAlign: "center",
  borderRadius: 3, border: "1px solid rgba(3,105,161,0.6)",
  background: "rgba(255,255,255,0.98)", color: INK_DARK, outline: "none",
};

/** 寸法バッジ。ダブルクリックで mm 値を手入力できる（表示のみ上書き＝CAD の寸法テキスト上書き相当）。
 *  - valueMm: 自動算出値(mm) / okey: 上書きストアのキー（省略時は編集不可の静的表示）
 *  - onCommitMm: 指定時は「実データを更新」（全高→CL 等）。未指定なら overrides ストアへ保存。
 *  - onDelete: 指定時はホバーで × を出し、クリックでこの区切りを削除（隣のセグメントへ統合）。 */
function DimTag({ position, valueMm, okey, strong = false, suffix = "", editable = true, onCommitMm, onDelete }) {
  const override = useElevationDimOverridesStore((s) => (okey ? s.overrides[okey] : undefined));
  const setOverride = useElevationDimOverridesStore((s) => s.setOverride);
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);

  const auto = roundMm(valueMm);
  const shown = onCommitMm ? Math.round(valueMm) : (override != null ? override : auto);
  const overridden = !onCommitMm && override != null;

  const commit = (raw) => {
    setEditing(false);
    const v = Math.round(Number(raw));
    if (!Number.isFinite(v) || v <= 0) return;
    if (onCommitMm) { onCommitMm(v); return; }
    if (!okey) return;
    // 自動値と同じなら上書き解除（＝自動追従に戻す）
    setOverride(okey, v === auto ? null : v);
  };

  const canEdit = editable && (okey || onCommitMm);

  return (
    <Html position={position} center zIndexRange={[18, 0]} style={(canEdit || onDelete) ? undefined : { pointerEvents: "none" }}>
      {editing ? (
        <input
          autoFocus type="number" defaultValue={shown} step={5}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={inputStyle}
        />
      ) : (
        <div
          onMouseEnter={onDelete ? () => setHover(true) : undefined}
          onMouseLeave={onDelete ? () => setHover(false) : undefined}
          style={{ position: "relative", display: "inline-block" }}
        >
          <div
            onDoubleClick={canEdit ? (e) => { e.stopPropagation(); setEditing(true); } : undefined}
            title={canEdit ? "ダブルクリックで数値を編集" : undefined}
            style={{ ...TAG_STYLE(strong, overridden), pointerEvents: (canEdit || onDelete) ? "auto" : "none", cursor: canEdit ? "text" : "default" }}
          >
            {shown}{suffix}
          </div>
          {onDelete && hover && (
            <div
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
              title="この区切りを削除（隣の寸法に統合）"
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
      )}
    </Html>
  );
}

const SNAP_GREEN = "#16a34a"; // スナップ吸着中の色

/** 区切り（寸法境界）の端部ハンドル。選択不要で左ドラッグ＝区切りを移動し、両隣の寸法を再配分する。
 *  普段は透明（ティック位置にホバーすると●が現れる）で、図面を散らかさない。
 *  Shift＋ドラッグ＝スナップ（他の区切り・壁・床天井・グリッド刻み）＋ガイドライン表示。
 *  - role: "bwm"（幅＝画面横に移動）/ "bhm"（高さ＝Y に移動）
 *  - axis: 画面横の world 軸（"x"=FRONT / "z"=RIGHT）。drawing plane はビュー軸=depth 面。
 *  - minPos/maxPos: 両隣の world 位置（この間にクランプ）。
 *  - snaps: 吸着候補の world 位置 / makeGuidePoints: ガイド線の両端を返す (w)=>[p1,p2] */
function MarkHandle({ role, markKey, position, axis, depth, minPos, maxPos, isMm, snaps, makeGuidePoints }) {
  const { camera, gl } = useThree();
  const setMarkPosition = useElevationDimOverridesStore((s) => s.setMarkPosition);
  const beginHistory = useElevationDimOverridesStore((s) => s.beginHistory);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const [snapped, setSnapped] = useState(false);
  // Shift ドラッグ中のガイドライン（現在位置）。null=非表示。
  const [guidePos, setGuidePos] = useState(null);
  const startedRef = useRef(false);
  const snapsRef = useRef(snaps);
  snapsRef.current = snaps;

  React.useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    // 描画平面（ビュー軸＝depth の面）に投影して、移動軸の座標を読む。
    const plane = axis === "x"
      ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -depth)   // FRONT: z=depth
      : new THREE.Plane(new THREE.Vector3(1, 0, 0), -depth);  // RIGHT: x=depth
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const margin = isMm ? 50 : 0.05;

    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      let w = role === "bhm" ? hit.y : (axis === "x" ? hit.x : hit.z);
      w = Math.max(minPos + margin, Math.min(maxPos - margin, w));

      // ── スナップ（Shift 押下中のみ）──
      let didSnap = false;
      if (ev.shiftKey) {
        // 吸着許容＝画面 ~10px（正射カメラの world/px から算出、遠近時のフォールバックあり）。
        const clientH = rect.height || 1;
        const worldPerPx = camera.isOrthographicCamera
          ? (camera.top - camera.bottom) / (camera.zoom || 1) / clientH
          : (isMm ? 20 : 0.02); // フォールバック
        const tol = worldPerPx * 10;
        // グリッド刻み（グリッド設定に合わせる。既定 100mm）
        const em = useEditorModeStore.getState();
        const stepMm = em.isGridVisible && em.gridCellSizeMm > 0 ? em.gridCellSizeMm : 100;
        const stepW = isMm ? stepMm : stepMm / 1000;

        let best = null, bestD = tol;
        for (const c of snapsRef.current || []) {
          if (Math.abs(c - w) < 1e-6) continue; // 自分自身は除外
          const d = Math.abs(w - c);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (stepW > 0) {
          const g = Math.round(w / stepW) * stepW;
          const d = Math.abs(w - g);
          if (d < bestD) { bestD = d; best = g; }
        }
        didSnap = best != null;
        if (didSnap) w = Math.max(minPos + margin, Math.min(maxPos - margin, best));
      }
      setSnapped(didSnap);
      // ガイドラインは Shift 押下中のみ（現在位置＝吸着後の位置に表示）
      setGuidePos(ev.shiftKey ? w : null);

      if (!startedRef.current) { startedRef.current = true; beginHistory(); } // 開始時に履歴点
      setMarkPosition(markKey, Math.round((isMm ? w : w * 1000) / 5) * 5, false);
    };
    const onUp = () => { setDragging(false); setSnapped(false); setGuidePos(null); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, axis, depth, role, markKey, minPos, maxPos, isMm, setMarkPosition, beginHistory]);

  const visible = hover || dragging;
  return (
    <>
      <Html position={position} center zIndexRange={[19, 0]}>
        {/* 常時ドラッグ可能な当たり領域（14px）。見た目はホバー/ドラッグ中のみ● */}
        <div
          onPointerDown={(e) => { e.stopPropagation(); startedRef.current = false; setDragging(true); }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title="ドラッグで区切りを移動（Shift でスナップ）"
          style={{
            width: 14, height: 14, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: role === "bhm" ? "ns-resize" : "ew-resize",
            pointerEvents: "auto", background: "transparent",
          }}
        >
          <div
            style={{
              width: visible ? 11 : 0, height: visible ? 11 : 0, borderRadius: "50%",
              background: snapped ? SNAP_GREEN : dragging ? ACCENT : "rgba(255,255,255,0.95)",
              border: visible ? `1.5px solid ${snapped ? SNAP_GREEN : ACCENT}` : "none",
              boxShadow: visible ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
              transition: "width 80ms, height 80ms",
            }}
          />
        </div>
      </Html>
      {/* Shift ドラッグ中のガイドライン（吸着中は緑・それ以外は青） */}
      {dragging && guidePos != null && makeGuidePoints && (
        <Line
          points={makeGuidePoints(guidePos)}
          color={snapped ? SNAP_GREEN : ACCENT}
          lineWidth={1.2}
          dashed
          dashSize={isMm ? 120 : 0.12}
          gapSize={isMm ? 80 : 0.08}
          transparent
          opacity={0.9}
          depthTest={false}
          renderOrder={9500}
          userData={{ ignoreClipping: true }}
        />
      )}
    </>
  );
}

export default function ElevationDimensionsOverlay() {
  const viewActive = useElevationMarkerStore((s) => s.viewActive);
  const dir = useElevationMarkerStore((s) => s.activeDir);
  const roomBox = useElevationMarkerStore((s) => s.roomBox);
  const markerPos = useElevationMarkerStore((s) => s.pos);

  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const setCeilingHeightMm = useBuildingSpecStore((s) => s.setCeilingHeightMm);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const objectMap = useSceneObjectRegistryStore((s) => s.map);
  // 実躯体（床/壁）。ゾーン矩形ではなく実際に描画されるジオメトリで枠・寸法を出すために使う。
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders);
  // 手入力オーバーライドのスコープ（この展開図を一意に識別）。
  const activeElevationId = useRoomElevationsStore((s) => s.activeElevationId);
  const scope = activeElevationId || dir || "elev";
  // 削除した区切り（隣の寸法に統合）＋ 区切り位置の手動上書き（端部ドラッグ）
  const removedMarks = useElevationDimOverridesStore((s) => s.removedMarks);
  const removeMark = useElevationDimOverridesStore((s) => s.removeMark);
  const markPositions = useElevationDimOverridesStore((s) => s.markPositions);

  const isMm = (sceneMaxY || 0) > 100;
  const toWorld = (mm) => (isMm ? mm : mm / 1000);
  // world 長さ → mm。overrides のキーにも使う位置は mm・50 丸めで安定させる。
  const toMm = (worldLen) => (isMm ? worldLen : worldLen * 1000);
  const posKey = (worldPos) => Math.round(toMm(worldPos) / 50);

  // 家具ドラッグ中は Three.js オブジェクトが直接変異するだけで objectMap の参照は
  // 変わらない → useMemo が再計算されない。ドラッグ中は tick を進めて寸法を追従させる。
  const invalidate = useThree((s) => s.invalidate);
  const [dragTick, setDragTick] = useState(0);
  const frameRef = useRef(0);
  useFrame(() => {
    if (!useViewportUiStore.getState().gizmoDragging) return;
    frameRef.current += 1;
    if (frameRef.current % 4 !== 0) return; // ~15fps
    setDragTick((t) => t + 1);
    invalidate();
  });

  const data = useMemo(() => {
    if (!viewActive || !dir || !roomBox || !markerPos) return null;

    // ── ビューの向きから座標系を決める ─────────────────────────────
    // axis: 画面横に対応する world 軸 / sign: world 軸＋方向が画面右なら +1
    // wallDepth: 見ている壁の位置 / cutDepth: クリップ位置（記号＝視点）
    const axis = dir === "A" || dir === "C" ? "x" : "z";
    const sign = dir === "A" || dir === "B" ? +1 : -1;
    const wallDepth =
      dir === "A" ? roomBox.minZ : dir === "C" ? roomBox.maxZ :
      dir === "B" ? roomBox.maxX : roomBox.minX;
    const cutDepth = axis === "x" ? markerPos.z : markerPos.x;
    // 注記はクリップ面のわずか手前（カメラ側）に置く
    const towardCam = dir === "A" || dir === "D" ? +1 : -1;
    const depth = cutDepth + towardCam * toWorld(20);

    const pad = toWorld(ELEV_ROOM_PAD_MM);
    const hMinBox = axis === "x" ? roomBox.minX : roomBox.minZ;
    const hMaxBox = axis === "x" ? roomBox.maxX : roomBox.maxZ;
    // ゾーン矩形（内法）の位置＝roomBox から壁厚パディングを戻した位置
    let innerMin = hMinBox + pad;
    let innerMax = hMaxBox - pad;
    if (innerMax - innerMin < toWorld(300)) return null;

    let flW = toWorld(fl0Mm || 0);
    let clW = toWorld((fl0Mm || 0) + (ceilingHeightMm || 2400));

    // ── 実測の床上端/天井下端を優先（「本来のサイズ」を表示） ──────────
    // 断面の CL 設定値と躯体がずれていても、展開図は実際の部屋の高さを示す
    // （例: CL設定2400・実躯体2600 → 展開図の全高は2600）。
    // 記号位置（部屋の中の点）から上下へレイキャスト。取れなければ spec 値のまま。
    {
      const colliders = baseColliders || [];
      const rayY = (dirY, wantUpFace) => {
        if (!colliders.length) return null;
        const ray = new THREE.Raycaster(
          new THREE.Vector3(markerPos.x, flW + toWorld(1200), markerPos.z),
          new THREE.Vector3(0, dirY, 0)
        );
        for (const h of ray.intersectObjects(colliders, true)) {
          const nyW = h.face?.normal ? h.face.normal.clone().transformDirection(h.object.matrixWorld).y : 0;
          if (wantUpFace ? nyW > 0.5 : nyW < -0.5) return h.point.y;
        }
        return null;
      };
      const mFl = rayY(-1, true);
      if (mFl != null && Math.abs(mFl - flW) < toWorld(600)) flW = mFl;
      const mCl = rayY(1, false);
      if (mCl != null && mCl > flW + toWorld(1500) && mCl < flW + toWorld(6500)) clW = mCl;
    }

    // ── 表示中の奥行きスラブ（見ている壁〜クリップ位置） ──
    const dLo = Math.min(wallDepth, cutDepth);
    const dHi = Math.max(wallDepth, cutDepth);

    // ── 実躯体の「内法」でクランプ ─────────────────────────────
    // ゾーン矩形が実躯体とズレていても、枠と寸法は実際の部屋（壁の内側の面）を指す。
    // measureBaseInterior は薄くて長い箱＝壁の内側の面から内法を実測する。平面図の
    // 「躯体にフィット」も同じ実測値を使うので、平面と展開図の寸法が一致する。
    // （ゾーンが建物を複数部屋に区切っている場合は、ゾーンの方が狭いのでゾーン側が勝つ）
    const interior = measureBaseInterior();
    if (interior) {
      const gMin = axis === "x" ? interior.minX : interior.minZ;
      const gMax = axis === "x" ? interior.maxX : interior.maxZ;
      innerMin = Math.max(innerMin, gMin);
      innerMax = Math.min(innerMax, gMax);
      if (innerMax - innerMin < toWorld(300)) return null;
    }

    // ── 部屋内アイテムを壁面に投影してエッジと天端高さを拾う ──────────
    const edges = [innerMin, innerMax];
    const tops = [];
    const box = new THREE.Box3();
    objectMap.forEach((obj) => {
      if (!obj) return;
      try { box.setFromObject(obj); } catch { return; }
      if (box.isEmpty()) return;
      const bh0 = axis === "x" ? box.min.x : box.min.z;
      const bh1 = axis === "x" ? box.max.x : box.max.z;
      const bd0 = axis === "x" ? box.min.z : box.min.x;
      const bd1 = axis === "x" ? box.max.z : box.max.x;
      // 表示中の領域（壁〜クリップ位置）かつ部屋の内法内のものだけ
      if (bd1 < dLo || bd0 > dHi) return;
      if (bh1 < innerMin || bh0 > innerMax) return;
      if (box.max.y < flW + toWorld(30) || box.min.y > clW) return;
      edges.push(Math.max(bh0, innerMin), Math.min(bh1, innerMax));
      tops.push(Math.min(box.max.y, clW));
    });

    // マークのキー（自動位置ベースで安定）と、位置上書きの適用。
    const mkKey = (role, worldPos) => `${scope}:${role}:${Math.round((isMm ? worldPos : worldPos * 1000) / 50)}`;
    const applyPos = (key, autoPos) => {
      const ov = markPositions[key];
      return ov != null ? (isMm ? ov : ov / 1000) : autoPos;
    };
    const tol = toWorld(60);
    // 内側の自動マーク列（近接統合＋削除除外＋位置上書き）→ 端付きキー付きマークへ。
    const buildMarks = (internalRaw, minEnd, maxEnd, role) => {
      const s = [...internalRaw].filter((v) => v > minEnd + tol && v < maxEnd - tol).sort((a, b) => a - b);
      const kept = [];
      s.forEach((v) => { if (!kept.length || v - kept[kept.length - 1] > tol) kept.push(v); });
      const marks = [{ pos: minEnd, key: null }];
      kept.forEach((v) => {
        const key = mkKey(role, v);
        if (removedMarks[key]) return; // 削除した区切りは隣へ統合
        marks.push({ pos: applyPos(key, v), key });
      });
      marks.push({ pos: maxEnd, key: null });
      marks.sort((a, b) => a.pos - b.pos);
      return marks;
    };
    const marksToSegs = (marks, minLen) => {
      const segs = [];
      for (let i = 0; i < marks.length - 1; i++) {
        const a = marks[i], b = marks[i + 1];
        if (b.pos - a.pos > minLen) segs.push({ a: a.pos, b: b.pos, aKey: a.key, bKey: b.key });
      }
      return segs;
    };

    // 幅（画面横）: 家具エッジで区切る
    const widthMarks = buildMarks(edges, innerMin, innerMax, "bwm");
    const widthSegs = marksToSegs(widthMarks, toWorld(120));

    // 高さ: 家具天端で区切る（FL/CL 近傍は除外・100mm で統合・上位4つ）
    const topTol = toWorld(100);
    const topsSorted = [...tops].sort((a, b) => a - b);
    let topKept = [];
    topsSorted.forEach((y) => {
      if (y < flW + toWorld(150) || y > clW - toWorld(150)) return;
      if (topKept.length && y - topKept[topKept.length - 1] < topTol) return;
      topKept.push(y);
    });
    while (topKept.length > 4) topKept.splice(0, 1);
    const heightMarks = buildMarks(topKept, flW, clW, "bhm");
    const heightSegs = marksToSegs(heightMarks, toWorld(1));

    return { axis, sign, depth, innerMin, innerMax, flW, clW, widthMarks, widthSegs, heightMarks, heightSegs };
  }, [viewActive, dir, roomBox, markerPos, objectMap, baseColliders, fl0Mm, ceilingHeightMm, isMm, scope, removedMarks, markPositions, dragTick]);

  if (!data) return null;
  const { axis, sign, depth, innerMin, innerMax, flW, clW, widthMarks, widthSegs, heightMarks, heightSegs } = data;

  // world 座標ヘルパ（h=画面横軸の位置 / y=高さ）
  const pt = (h, y) => (axis === "x" ? [h, y, depth] : [depth, y, h]);

  // ポシェ帯（切り口）: hc/yc=中心, hl/yl=幅/高さ
  const Band = ({ hc, yc, hl, yl }) => (
    <mesh
      position={axis === "x" ? [hc, yc, depth] : [depth, yc, hc]}
      rotation={axis === "x" ? [0, 0, 0] : [0, Math.PI / 2, 0]}
      renderOrder={800}
      userData={{ ignoreClipping: true }}
    >
      <planeGeometry args={[hl, yl]} />
      <meshBasicMaterial color={POCHE} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  );

  const wallT = toWorld(200);
  const slabT = toWorld(200);
  const ceilT = toWorld(150);
  const outer0 = innerMin - wallT;
  const outer1 = innerMax + wallT;
  const yBot = flW - slabT;
  const yTop = clW + ceilT;

  // 寸法チェーンの縦位置（FL の下）
  const yChain = flW - toWorld(420);
  const yTotal = flW - toWorld(780);
  const tick = toWorld(70);

  // 高さ寸法（画面左側＝sign が正なら innerMin 側）。下端と同じ描き方:
  // 内側チェーン＝家具天端で区切ったセグメント寸法列 / 外側チェーン＝全高（FL〜CL）
  const hSeg = (sign > 0 ? innerMin : innerMax) - sign * toWorld(420);
  const hTot = (sign > 0 ? innerMin : innerMax) - sign * toWorld(780);
  const hSegLbl = hSeg - sign * toWorld(150);
  const hTotLbl = hTot - sign * toWorld(150);
  const hasMidMarks = heightMarks.length > 2;

  const lineCommon = { color: INK, lineWidth: 1.4, transparent: true, opacity: 0.95, depthTest: false, userData: { ignoreClipping: true } };

  return (
    <group renderOrder={9000}>
      {/* ── ③ 断面ポシェ（床・天井・左右の壁の切り口）── */}
      <Band hc={(outer0 + outer1) / 2} yc={flW - slabT / 2} hl={outer1 - outer0} yl={slabT} />
      <Band hc={(outer0 + outer1) / 2} yc={clW + ceilT / 2} hl={outer1 - outer0} yl={ceilT} />
      <Band hc={innerMin - wallT / 2} yc={(yBot + yTop) / 2} hl={wallT} yl={yTop - yBot} />
      <Band hc={innerMax + wallT / 2} yc={(yBot + yTop) / 2} hl={wallT} yl={yTop - yBot} />

      {/* ── ① 下端: セグメント寸法列（値=ダブルクリックで手入力 / ×で区切り削除 / ●で区切り移動）── */}
      <Line points={[pt(innerMin, yChain), pt(innerMax, yChain)]} {...lineCommon} />
      {widthSegs.map((s, i) => (
        <React.Fragment key={`seg-${i}`}>
          {i === 0 && <Line points={[pt(s.a, yChain - tick), pt(s.a, yChain + tick)]} {...lineCommon} />}
          <Line points={[pt(s.b, yChain - tick), pt(s.b, yChain + tick)]} {...lineCommon} />
          <DimTag
            position={pt((s.a + s.b) / 2, yChain - toWorld(130))}
            valueMm={toMm(s.b - s.a)}
            okey={`${scope}:bw:${posKey((s.a + s.b) / 2)}`}
            onDelete={(s.aKey || s.bKey) ? () => removeMark(s.aKey || s.bKey) : undefined}
          />
        </React.Fragment>
      ))}
      {/* 区切りの端部ハンドル（内側マークのみ）。普段は透明で、ティック位置にホバーすると●が出る。
          左ドラッグで移動・Shift でスナップ＋ガイドライン。 */}
      {widthMarks.map((m, i) => m.key ? (
        <MarkHandle
          key={`wh-${m.key}`} role="bwm" markKey={m.key}
          position={pt(m.pos, yChain)} axis={axis} depth={depth}
          minPos={widthMarks[i - 1].pos} maxPos={widthMarks[i + 1].pos} isMm={isMm}
          snaps={widthMarks.filter((_, j) => j !== i).map((x) => x.pos)}
          makeGuidePoints={(w) => [pt(w, yBot), pt(w, yTop)]}
        />
      ) : null)}

      {/* ── ① 下端: 内法の全幅 ── */}
      <Line points={[pt(innerMin, yTotal), pt(innerMax, yTotal)]} {...lineCommon} />
      <Line points={[pt(innerMin, yTotal - tick), pt(innerMin, yTotal + tick)]} {...lineCommon} />
      <Line points={[pt(innerMax, yTotal - tick), pt(innerMax, yTotal + tick)]} {...lineCommon} />
      <DimTag
        position={pt((innerMin + innerMax) / 2, yTotal - toWorld(130))}
        valueMm={toMm(innerMax - innerMin)}
        okey={`${scope}:totalW`}
        strong
      />

      {/* ── ② 画面左: 高さのセグメント寸法列（家具天端で区切る。下端と同じ描き方）── */}
      {hasMidMarks && (
        <>
          <Line points={[pt(hSeg, flW), pt(hSeg, clW)]} {...lineCommon} />
          {heightMarks.map((m, i) => (
            <Line key={`ht-${i}`} points={[pt(hSeg - tick, m.pos), pt(hSeg + tick, m.pos)]} {...lineCommon} />
          ))}
          {heightSegs.map((s, i) => (
            <DimTag
              key={`hs-${i}`}
              position={pt(hSegLbl, (s.a + s.b) / 2)}
              valueMm={toMm(s.b - s.a)}
              okey={`${scope}:bh:${posKey((s.a + s.b) / 2)}`}
              onDelete={(s.aKey || s.bKey) ? () => removeMark(s.aKey || s.bKey) : undefined}
            />
          ))}
          {heightMarks.map((m, i) => m.key ? (
            <MarkHandle
              key={`hh-${m.key}`} role="bhm" markKey={m.key}
              position={pt(hSeg, m.pos)} axis={axis} depth={depth}
              minPos={heightMarks[i - 1].pos} maxPos={heightMarks[i + 1].pos} isMm={isMm}
              snaps={heightMarks.filter((_, j) => j !== i).map((x) => x.pos)}
              makeGuidePoints={(w) => [pt(outer0, w), pt(outer1, w)]}
            />
          ) : null)}
        </>
      )}

      {/* ── ② 画面左: 全高（FL〜CL）。ダブルクリックで CL（実データ）を編集 ── */}
      <Line points={[pt(hasMidMarks ? hTot : hSeg, flW), pt(hasMidMarks ? hTot : hSeg, clW)]} {...lineCommon} />
      <Line points={[pt((hasMidMarks ? hTot : hSeg) - tick, flW), pt((hasMidMarks ? hTot : hSeg) + tick, flW)]} {...lineCommon} />
      <Line points={[pt((hasMidMarks ? hTot : hSeg) - tick, clW), pt((hasMidMarks ? hTot : hSeg) + tick, clW)]} {...lineCommon} />
      <DimTag
        position={pt(hasMidMarks ? hTotLbl : hSegLbl, (flW + clW) / 2)}
        valueMm={Math.round(toMm(clW - flW))}
        strong
        onCommitMm={(v) => { if (v >= 1800 && v <= 6000) setCeilingHeightMm(v); }}
      />
    </group>
  );
}
