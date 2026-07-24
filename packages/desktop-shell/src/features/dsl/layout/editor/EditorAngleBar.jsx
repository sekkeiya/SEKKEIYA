// src/features/dsl/layout/editor/EditorAngleBar.jsx
//
// エディタ用「ビュースロット・バー」（上端中央・コンパクト）。
//   並び: 全体 / 1F 2F… / 外観1 外観2… / 内観1 内観2… / 断面1 断面2… / ＋
//   - 全体/外観/内観 = 保存ビュー(useShotStore, tag:'editorView')。perspective。
//   - 1F/2F… = useBuildingSpecStore のフロアから動的算出。クリックで「水平断面(間取り)＝
//     床+1100mm で切って真上(vp_top)」を適用。
//   - 断面N = 保存ビュー(category:'断面', section:{axis,pos})。クリックで「縦切り(X=側面/Z=正面)」を
//     vp_right/vp_front で適用。断面線を出した状態で ＋ すると断面として登録される。
//   - ＋: 選択中スロットを上書き／未選択なら新規（縦切り中=断面 / それ以外=外観/内観 自動判定）。
//   - 各スロットはホバーでサムネ（オフスクリーン撮影）。外観/内観/断面は × で削除。
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Button, Tooltip, IconButton, Typography, Popover, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import * as THREE from "three";
import { layoutSceneRef } from "../services/layoutSceneRef";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import { useViewportUiStore, VIEWPORT_IDS, VIEWPORT_LAYOUT } from "../store/viewportUiStore";
import { useShotStore } from "../store/useShotStore";
import { useLayoutLoadSignal } from "../store/useLayoutLoadSignal";
// 展開図（部屋の中から四方の壁を見回す一人称視点）用
// 展開記号（平面図の「どこから見た展開図か」マーカー）と展開図オープンの共通経路
import { useElevationMarkerStore, computeRoomBoxFromRects } from "../store/useElevationMarkerStore";
// 部屋ごとの展開ドキュメント（展開A〜D + 追加分）とオープン経路
import { useRoomElevationsStore } from "../store/useRoomElevationsStore";
import { openRoomElevation, computeElevationRooms, getElevationMarkerPos } from "../utils/openElevationView";
import { useSelectionScopeStore } from "../store/useSelectionScopeStore";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";
// 断面表示時に右サイドバーの Properties（断面専用）を自動で開く
import { useUiRightSidebarStore } from "../store/uiRightSidebarStore";
// 断面ライン（A-A' / B-B'…）
import { useSectionLinesStore } from "../store/useSectionLinesStore";
// @ts-ignore
import { captureLayoutPerspective } from "../services/layoutPerspectiveCapture";

const TAG = "editorView";
const CAT_OVERVIEW = "全体";
const CAT_EXTERIOR = "外観";
const CAT_INTERIOR = "内観";
const CAT_SECTION = "断面";

function getBounds() {
  const root = layoutSceneRef.baseRoot;
  if (!root) return null;
  let box;
  try {
    box = new THREE.Box3().setFromObject(root);
  } catch {
    return null;
  }
  if (!box || box.isEmpty()) return null;
  return { center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) };
}

/* デフォルトの保存ビュー: 全体×1 / 外観×4 / 内観×3 / 断面×2 */
function buildDefaultViews(b) {
  const c = b.center;
  const s = b.size;
  const sx = Math.max(s.x, 1);
  const sz = Math.max(s.z, 1);
  const r = Math.max(sx, sz, 1);
  const h = Math.max(s.y, 1);
  const floorY = c.y - h / 2;
  const eyeY = floorY + Math.min(1600, h * 0.55);
  const tgtY = floorY + Math.min(1200, h * 0.45);
  const extH = c.y + h * 0.4 + r * 0.5;
  const D = r * 1.3;
  const ctr = [c.x, c.y, c.z];
  const diag = (dx, dz) => [c.x + dx * D, extH, c.z + dz * D];
  return [
    { category: CAT_OVERVIEW, position: [c.x + sx * 0.45, c.y + r * 1.0, c.z + sz * 0.62], target: ctr },
    { category: CAT_EXTERIOR, position: diag(0.45, 1.0), target: ctr },
    { category: CAT_EXTERIOR, position: diag(1.0, -0.45), target: ctr },
    { category: CAT_EXTERIOR, position: diag(-0.45, -1.0), target: ctr },
    { category: CAT_EXTERIOR, position: diag(-1.0, 0.45), target: ctr },
    { category: CAT_INTERIOR, position: [c.x - sx * 0.34, eyeY, c.z - sz * 0.34], target: [c.x + sx * 0.12, tgtY, c.z + sz * 0.12] },
    { category: CAT_INTERIOR, position: [c.x + sx * 0.34, eyeY, c.z + sz * 0.34], target: [c.x - sx * 0.12, tgtY, c.z - sz * 0.12] },
    { category: CAT_INTERIOR, position: [c.x - sx * 0.34, eyeY, c.z + sz * 0.34], target: [c.x + sx * 0.12, tgtY, c.z - sz * 0.12] },
    // 断面: Z=正面切り（中央）/ X=側面切り（中央）
    { category: CAT_SECTION, position: [c.x, c.y, c.z + r * 1.9], target: ctr, section: { axis: "z", pos: c.z } },
    { category: CAT_SECTION, position: [c.x + r * 1.9, c.y, c.z], target: ctr, section: { axis: "x", pos: c.x } },
  ];
}

function detectCategory(camPos, b) {
  if (!b || !Array.isArray(camPos)) return CAT_INTERIOR;
  const c = b.center;
  const s = b.size;
  const m = 200;
  const inX = Math.abs(camPos[0] - c.x) <= s.x / 2 + m;
  const inZ = Math.abs(camPos[2] - c.z) <= s.z / 2 + m;
  const belowRoof = camPos[1] <= c.y + s.y / 2 + m;
  return inX && inZ && belowRoof ? CAT_INTERIOR : CAT_EXTERIOR;
}

function downscaleDataUrl(dataUrl, maxW = 360) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round((img.width || maxW) * scale));
        const hh = Math.max(1, Math.round((img.height || maxW) * scale));
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = hh;
        const ctx = cv.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, w, hh);
        resolve(cv.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/* ドックで選んだビューを「どこに出すか」を決める。
 *   1画面: そのビューへ切替。
 *   2画面: 分割を維持したまま、左=Top ペインはそのまま／右ペインを差し替える
 *          （Top 系＝平面図は左ペインが担当なので、右は触らず左を選択状態にする）。 */
function focusViewportForDock(vp, targetId) {
  if (vp.layoutMode === VIEWPORT_LAYOUT.SPLIT) {
    if (targetId !== VIEWPORT_IDS.TOP) vp.setSplitRightViewId?.(targetId);
    vp.setActiveViewportId(targetId);
    return;
  }
  vp.setLayoutMode(VIEWPORT_LAYOUT.SINGLE);
  vp.setActiveViewportId(targetId);
}

/* 断面/間取り/パースのエディタ状態を適用（断面クリップ＋ビュー種別） */
function applyEditorViewState(kind, opts = {}) {
  const em = useEditorModeStore.getState();
  const vp = useViewportUiStore.getState();
  // 切替の起点でディゾルブを開始（クリップ即適用→リフレーム遅延の中間フレームを覆い隠す）。
  vp.beginViewTransition?.();
  // 単体ビューへの切替は図面グリッド（分割図面ビュー）からの離脱でもある。
  // SPLIT 中に Top へ行く経路は setLayoutMode/setSplitRightViewId を通らないため明示的に畳む。
  vp.setDrawingGrid?.(null);
  // Material モード（面仕上げ）は図面ビューを跨いで維持する（面ピックは平面/立面/断面/展開すべてで可）。
  // ただしユーザーが明示的に Material スコープに居るときだけ維持し、旧来の一時的な material は layout へ戻す。
  const scope = useSelectionScopeStore.getState().scope;
  if (em.editorMode === "material" && scope !== "material") em.setEditorMode("layout");
  // ラベルモードは断面が強制OFFになるので layout へ切替（断面/間取りを見せるため）
  if (kind !== "persp" && em.editorMode === "label") em.setEditorMode("layout");

  // 断面・立面は向き反転（flip）で見る側を切替（北⇄南 / 東⇄西）。それ以外は解除して鏡写しを防ぐ。
  em.setSectionViewFlip?.((kind === "section" || kind === "elevation") ? !!opts.flip : false);
  // 展開図ビューのハイライトを解除（1F/立面/断面/パースへ切替えたとき）
  useElevationMarkerStore.getState().setViewActive(false);

  if (kind === "persp") {
    em.setIsSectionClipEnabled(false);
    focusViewportForDock(vp, VIEWPORT_IDS.PERSP);
  } else if (kind === "floor") {
    // 平面図: layoutCameraTilt="top" で真上固定（SingleViewportCanvas が furniture_top=Top へ）。
    // tilt を効かせるため subMode は furniture_iso に正規化（天井ビューからの復帰も含む）。
    if (em.layoutSubMode === "ceiling_top") em.setLayoutSubMode?.("furniture_iso");
    em.setLayoutCameraTilt?.("top");
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(true);
    em.setSectionClipYInvert?.(false);
    em.setSectionClipXEnabled(false);
    em.setSectionClipZEnabled(false);
    em.setSectionClipHeight(opts.cutY);
    focusViewportForDock(vp, VIEWPORT_IDS.TOP);
    // リフレームはディゾルブカバーの不透明保持中に済ませる（中間フレームを見せない）。
    setTimeout(() => vp.requestFrameAll?.(), 40);
  } else if (kind === "ceiling") {
    // 天井伏図: その階の FL+カット高で「下を消す」Y反転クリップにし、下から見上げる
    // （tilt="ceiling" → effectiveSubMode=ceiling_top。LayoutCameraRig が真下から
    //   見上げるカメラに組む。BaseGlb は天井を表示、家具はクリップで自然に消える）。
    // tilt を効かせるため subMode は furniture_iso に正規化する。
    if (em.layoutSubMode !== "furniture_iso") em.setLayoutSubMode?.("furniture_iso");
    em.setLayoutCameraTilt?.("ceiling");
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(true);
    em.setSectionClipYInvert?.(true);
    em.setSectionClipXEnabled(false);
    em.setSectionClipZEnabled(false);
    em.setSectionClipHeight(opts.cutY);
    focusViewportForDock(vp, VIEWPORT_IDS.TOP);
    setTimeout(() => vp.requestFrameAll?.(), 40);
  } else if (kind === "section") {
    // 断面図: tilt="default" にしないと Top 強制で FRONT/RIGHT が無視される（2D配置の要）。
    em.setLayoutCameraTilt?.("default");
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(false);
    em.setSectionClipXEnabled(opts.axis === "x");
    em.setSectionClipZEnabled(opts.axis === "z");
    if (opts.axis === "x") em.setSectionClipX(opts.pos);
    else em.setSectionClipZ(opts.pos);
    focusViewportForDock(vp, opts.axis === "x" ? VIEWPORT_IDS.RIGHT : VIEWPORT_IDS.FRONT);
    setTimeout(() => vp.requestFrameAll?.(), 40);
  } else if (kind === "elevation") {
    // 立面図: 断面クリップOFFで正面(FRONT)/側面(RIGHT)を正射投影表示（建物の外形＝立面）。
    // tilt="default" にしないと Top 強制で FRONT/RIGHT が無視される。
    em.setLayoutCameraTilt?.("default");
    em.setIsSectionClipEnabled(false);
    focusViewportForDock(vp, opts.axis === "x" ? VIEWPORT_IDS.RIGHT : VIEWPORT_IDS.FRONT);
    setTimeout(() => vp.requestFrameAll?.(), 40);
  }
}

/** 指定階の切断高さ（world単位）。平面図・天井伏図共通の FL+1500mm。 */
function floorCutY(index) {
  const bs = useBuildingSpecStore.getState();
  const em = useEditorModeStore.getState();
  const i = Math.max(0, Math.min(index ?? (bs.activeFloorIndex || 0), (bs.floors?.length || 1) - 1));
  const cutMm = (bs.fl0Mm || 0) + (bs.floors?.[i]?.flMm || 0) + 1500;
  const isMm = (em.sceneMaxY || 0) > 100;
  return { index: i, cutY: isMm ? cutMm : cutMm / 1000 };
}

/** アクティブ階の平面図を開く（右ドック以外＝LayoutOperationUI などからの共通経路）。 */
export function openFloorViewForActiveFloor() {
  const { cutY } = floorCutY(null);
  applyEditorViewState("floor", { cutY });
}

/** アクティブ階の天井伏図（見上げ）を開く（右ドック以外からの共通経路）。 */
export function openCeilingViewForActiveFloor() {
  const { cutY } = floorCutY(null);
  applyEditorViewState("ceiling", { cutY });
}

function Slot({ label, active, onClick, onHover, onLeave, onDelete, indent = false, trailing = null }) {
  return (
    <Box
      onClick={onClick}
      onMouseEnter={(e) => onHover?.(e.currentTarget)}
      onMouseLeave={() => onLeave?.()}
      sx={{
        position: "relative", height: 30, px: 1.4, display: "flex", alignItems: "center", gap: 0.5,
        ml: indent ? 1.8 : 0,
        borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
        color: active ? "#06210f" : "color-mix(in srgb, var(--brand-fg) 82%, transparent)",
        background: active ? `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)` : "transparent",
        transition: "background 0.12s, color 0.12s",
        "&:hover": { background: active ? undefined : alpha("#fff", 0.1) },
        "&:hover .rm": { opacity: 1 },
      }}
    >
      <Box component="span" sx={{ flex: 1 }}>{label}</Box>
      {trailing}
      {onDelete && (
        <IconButton
          className="rm" size="small"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          sx={{
            position: "absolute", top: -7, right: -5, p: 0.15, opacity: 0, transition: "opacity 0.15s",
            color: "var(--brand-fg)", bgcolor: "color-mix(in srgb, var(--brand-bg) 95%, transparent)", border: `1px solid ${alpha("#fff", 0.25)}`,
            "&:hover": { bgcolor: "#e0564f" },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 12 }} />
        </IconButton>
      )}
    </Box>
  );
}

/* ネスト用の親スロット（立面/断面/部屋ごとの展開）。
 *   ラベルクリック = 分割図面ビュー（グリッド）を開く（onOpen）。
 *   チェブロンクリック = 子リストの開閉のみ（onToggle）。
 *   gridActive = このグループのグリッドを表示中。childActive = 子ビューが単体表示中。 */
function GroupSlot({ label, expanded, childActive, gridActive, onToggle, onOpen }) {
  const highlighted = gridActive || (childActive && !expanded);
  return (
    <Box
      onClick={onOpen || onToggle}
      sx={{
        height: 30, px: 1.1, display: "flex", alignItems: "center", gap: 0.4,
        borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
        color: highlighted ? "#06210f" : childActive ? "#34d399" : "color-mix(in srgb, var(--brand-fg) 82%, transparent)",
        background: highlighted ? `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)` : "transparent",
        transition: "background 0.12s, color 0.12s",
        "&:hover": { background: highlighted ? undefined : alpha("#fff", 0.1) },
      }}
    >
      <Box
        onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
        sx={{ display: "flex", alignItems: "center", borderRadius: 999, "&:hover": { background: alpha("#fff", 0.14) } }}
      >
        <KeyboardArrowDownRoundedIcon
          sx={{ fontSize: 15, transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", opacity: 0.75 }}
        />
      </Box>
      <Box component="span" sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
    </Box>
  );
}

/* カテゴリ・ドロップダウン内のサムネタイル */
function ViewTile({ thumb, label, active, busy, onClick, onRemove }) {
  return (
    <Box sx={{ width: 104, flexShrink: 0 }}>
      <Box
        onClick={onClick}
        sx={{
          position: "relative", width: 104, height: 66, borderRadius: 1.5, overflow: "hidden", cursor: "pointer",
          border: `2px solid ${active ? "#34d399" : alpha("#fff", 0.14)}`, background: "color-mix(in srgb, var(--brand-bg) 70%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 0.15s",
          "&:hover": { borderColor: active ? "#34d399" : alpha("#fff", 0.4) },
          "&:hover .rm": { opacity: 1 },
          "&:hover img": { transform: "scale(1.06)" },
        }}
      >
        {thumb ? (
          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.2s" }} />
        ) : busy ? (
          <CircularProgress size={15} sx={{ color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }} />
        ) : (
          <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)" }}>—</Typography>
        )}
        {onRemove && (
          <IconButton
            className="rm" size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            sx={{ position: "absolute", top: 1, right: 1, p: 0.25, opacity: 0, transition: "opacity 0.15s", color: "var(--brand-fg)", bgcolor: "color-mix(in srgb, var(--brand-bg) 50%, transparent)", "&:hover": { bgcolor: "#e0564f" } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
      </Box>
      <Typography sx={{ mt: 0.3, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 65%, transparent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function EditorAngleBar() {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const floors = useBuildingSpecStore((s) => s.floors);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const setActiveFloorIndex = useBuildingSpecStore((s) => s.setActiveFloorIndex);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  // 他階の表示切替（右ドックの階の目アイコン）。既定は非表示、ONにした階だけ透過表示する。
  const ghostFloors = useEditorModeStore((s) => s.ghostFloors);
  const toggleFloorGhost = useEditorModeStore((s) => s.toggleFloorGhost);
  const showOtherFloorsGhost = useEditorModeStore((s) => s.showOtherFloorsGhost);
  const loadedKey = useLayoutLoadSignal((s) => s.loadedKey);
  const shots = useShotStore((s) => s.shots);
  const addShot = useShotStore((s) => s.addShot);
  const removeShot = useShotStore((s) => s.removeShot);
  const updateShot = useShotStore((s) => s.updateShot);
  const updateThumbnail = useShotStore((s) => s.updateThumbnail);
  const setActiveShotId = useShotStore((s) => s.setActiveShotId);

  const [activeId, setActiveId] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [capturingKey, setCapturingKey] = useState(null);
  const [hover, setHover] = useState(null);
  const [catMenu, setCatMenu] = useState(null); // { category, anchor }
  const rafRef = useRef(null);
  const seededKeyRef = useRef(null);
  const catCloseTimer = useRef(null);

  // ✅ 2D/3D グループでスロットを絞る（2D=フロア間取りのみ / 3D=全体+外観/内観/断面+登録）
  const editorViewGroup = useEditorModeStore((s) => s.editorViewGroup);
  const isViewGroup2D = editorViewGroup === "2d";

  // 断面ライン（A-A' / B-B'…）
  const sectionLines = useSectionLinesStore((s) => s.lines);

  const views = shots.filter((sh) => (sh.kind ?? "still") === "still" && (sh.tags || []).includes(TAG));
  const vOverview = views.find((sh) => sh.category === CAT_OVERVIEW) || null;
  const exteriors = views.filter((sh) => sh.category === CAT_EXTERIOR);
  const interiors = views.filter((sh) => sh.category === CAT_INTERIOR);
  const sections = views.filter((sh) => sh.category === CAT_SECTION);

  // フロア（間取り）= 建物スペックから動的算出。床+1100mm で水平断面。
  const isMm = (sceneMaxY || 0) > 100;
  const toWorldY = (mm) => (isMm ? mm : mm / 1000);
  const floorViews = (floors || []).map((f, i) => ({
    id: `floor-${i}`,
    index: i,
    label: `${i + 1}F`,
    // 各階の床(FL)から約1500mm 上で水平に切る（窓・カウンタ上端を切る一般的な間取り高さ）。
    cutY: toWorldY((fl0Mm || 0) + (f.flMm || 0) + 1500),
  }));

  /* デフォルトシード（ローダー完了後・空のときだけ） */
  useEffect(() => {
    if (!loadedKey || seededKeyRef.current === loadedKey) return;
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      const existing = useShotStore.getState().shots.filter((sh) => (sh.tags || []).includes(TAG));
      if (existing.length > 0) { seededKeyRef.current = loadedKey; clearInterval(iv); return; }
      const b = getBounds();
      if (!b) { if (tries > 30) clearInterval(iv); return; }
      seededKeyRef.current = loadedKey;
      clearInterval(iv);
      const fov = layoutSceneRef.getCameraState?.()?.fov ?? 50;
      buildDefaultViews(b).forEach((d) => {
        addShot({ position: d.position, target: d.target, fov }, null, "still", { name: d.category, category: d.category, tags: [TAG], section: d.section ?? null });
      });
      setActiveShotId(null);
    }, 500);
    return () => clearInterval(iv);
  }, [loadedKey, addShot, setActiveShotId]);

  /* 断面線のデフォルト: ローダー完了後、まだ 1 本も無ければ A-A'（縦断面=左右X切り）と
     B-B'（横断面=前後Z切り）を建物中央に自動作成し、最初から両方を平面図に表示しておく。
     既定は未選択（activeLine=null）にしてギズモ/ボタンは出さない。 */
  const seededSectionsRef = useRef(null);
  useEffect(() => {
    if (!loadedKey || seededSectionsRef.current === loadedKey) return;
    if (useSectionLinesStore.getState().lines.length > 0) { seededSectionsRef.current = loadedKey; return; }
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      const st = useSectionLinesStore.getState();
      if (st.lines.length > 0) { seededSectionsRef.current = loadedKey; clearInterval(iv); return; }
      const b = getBounds();
      if (!b) { if (tries > 30) clearInterval(iv); return; }
      seededSectionsRef.current = loadedKey;
      clearInterval(iv);
      const cx = b.center?.x ?? 0;
      const cz = b.center?.z ?? 0;
      st.addLine("x", cx); // A-A'（縦の断面線＝左右切り）
      st.addLine("z", cz); // B-B'（横の断面線＝前後切り）
      st.setActiveLine(null); // 既定は未選択
    }, 500);
    return () => clearInterval(iv);
  }, [loadedKey]);

  /* 滑らかにカメラ移動して留まる */
  const flyTo = useCallback((position, target, targetFov) => {
    const set = layoutSceneRef.setCameraPose;
    const get = layoutSceneRef.getCameraState;
    if (typeof set !== "function") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = typeof get === "function" ? get() : null;
    const curFov = from?.fov ?? 50;
    const toFov = typeof targetFov === "number" ? targetFov : curFov;
    if (!from || !Array.isArray(from.position) || !Array.isArray(from.target)) {
      set({ position, target, fov: toFov });
      return;
    }
    const dur = 650;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const lerp3 = (a, b, e) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      set({ position: lerp3(from.position, position, e), target: lerp3(from.target, target, e), fov: curFov + (toFov - curFov) * e });
      rafRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // ユーザーが明示的にビューを選んだか。下の「初回デフォルト＝1F」を抑止するために使う。
  //   図面グリッド（立面/断面/展開）と展開図は activeId を null に戻すので、activeId だけを
  //   見ていると「プランを開いて最初に断面を押したのに 1F へ飛ぶ」ことになる
  //   （グリッドを開いた直後にデフォルトが発火し、goFloor → applyEditorViewState が
  //     setDrawingGrid(null) でグリッドを畳んでしまう）。
  const userPickedRef = useRef(false);
  const consumeAutoDefault = useCallback(() => { userPickedRef.current = true; }, []);
  // 別の Base/Plan を読み込んだらデフォルト選択の権利を戻す。
  useEffect(() => { userPickedRef.current = false; }, [loadedKey]);

  const goShot = useCallback((shot) => {
    const cam = shot?.camera;
    if (!cam) return;
    consumeAutoDefault();
    if (shot.category === CAT_SECTION && shot.section) {
      applyEditorViewState("section", { axis: shot.section.axis, pos: shot.section.pos });
    } else {
      applyEditorViewState("persp");
      // perspective viewport へ切替後に飛ばす
      setTimeout(() => flyTo(cam.position, cam.target, cam.fov), 90);
    }
    setActiveId(shot.id);
    setActiveShotId(shot.id);
  }, [flyTo, setActiveShotId, consumeAutoDefault]);

  const goFloor = useCallback((fv) => {
    consumeAutoDefault();
    applyEditorViewState("floor", { cutY: fv.cutY });
    // 新規家具の配置高さ（床レベル）をこの階に合わせる。
    if (typeof fv.index === "number") setActiveFloorIndex(fv.index);
    setActiveId(fv.id);
    setActiveShotId(null);
  }, [setActiveShotId, setActiveFloorIndex, consumeAutoDefault]);

  // 天井伏図（見上げ）: 同じ階リストから「その階の天井」を開く。
  const goCeiling = useCallback((fv) => {
    consumeAutoDefault();
    applyEditorViewState("ceiling", { cutY: fv.cutY });
    if (typeof fv.index === "number") setActiveFloorIndex(fv.index);
    setActiveId(`ceil-${fv.index}`);
    setActiveShotId(null);
  }, [setActiveShotId, setActiveFloorIndex, consumeAutoDefault]);

  // 「＋平面」「＋天井」: 直上に1階追加して、その階のビューをそのまま開く。
  //   階は建物スペック（floors）に持つので、平面・天井の両リストに同時に増える。
  //   ※ 階の追加は buildingSpec の変更なので、保存ボタンで永続化される。
  const addFloorAndOpen = useCallback((kind) => {
    const bs = useBuildingSpecStore.getState();
    bs.addFloor();
    const next = useBuildingSpecStore.getState().floors;
    const i = next.length - 1;
    const cutY = toWorldY((bs.fl0Mm || 0) + (next[i]?.flMm || 0) + 1500);
    const fv = { id: `floor-${i}`, index: i, label: `${i + 1}F`, cutY };
    if (kind === "ceiling") goCeiling(fv); else goFloor(fv);
    setOpenGroups((g) => ({ ...g, [kind === "ceiling" ? "ceil" : "plan"]: true }));
  }, [toWorldY, goFloor, goCeiling]);

  // ✅ 初回オープン時のデフォルト: 2D 配置なら 1F（平面図）を選択状態にする。
  //    ローダー完了(loadedKey)後、まだ何も選択されておらず、かつ 2D グループのときに一度だけ適用。
  const autoFloorRef = useRef(null);
  useEffect(() => {
    if (!isViewGroup2D) return;
    if (!loadedKey || autoFloorRef.current === loadedKey) return;
    if (activeId || userPickedRef.current) return; // 既に選択済み／ユーザーが選んだなら尊重
    if (floorViews.length === 0) return; // フロア情報がまだ無ければ次の再評価を待つ
    autoFloorRef.current = loadedKey;
    goFloor(floorViews[0]);
  }, [isViewGroup2D, loadedKey, activeId, floorViews, goFloor]);

  // 2D 図面種別: 立面図（断面クリップOFFの正面/側面を正射投影）。
  //   北⇄南 は Z軸(FRONT)の flip、東⇄西 は X軸(RIGHT)の flip で切替。
  //   平面(TOP)の上=−Z=北 の約束に合わせる: 南=+Z(flip無) / 北=−Z(flip) / 東=+X(flip無) / 西=−X(flip)。
  const goElevation = useCallback((axis, flip, id) => {
    consumeAutoDefault();
    applyEditorViewState("elevation", { axis, flip });
    setActiveId(id);
    setActiveShotId(null);
  }, [setActiveShotId, consumeAutoDefault]);

  // 2D 図面種別: 断面図（登録済みの断面ライン A-A' / B-B'… を開く）
  const openSectionProps = useCallback(() => {
    const rs = useUiRightSidebarStore.getState();
    rs.closeAll();
    rs.setRightPanel("properties", true);
  }, []);

  const goSectionLine = useCallback((line) => {
    if (!line) return;
    consumeAutoDefault();
    applyEditorViewState("section", { axis: line.axis, pos: line.pos, flip: !!line.flip });
    useSectionLinesStore.getState().setActiveLine(line.id);
    openSectionProps();
    setActiveId(`sect-${line.id}`);
    setActiveShotId(null);
  }, [setActiveShotId, openSectionProps, consumeAutoDefault]);

  // 「＋断面」: 建物中央に新しい断面ライン（既定は前後Z＝正面切り）を登録して開く。
  //   位置・向きはプロパティの平面ミニマップで調整できる。
  const addSectionLine = useCallback(() => {
    const b = getBounds();
    const axis = "z";
    const pos = b ? b.center.z : 0;
    const line = useSectionLinesStore.getState().addLine(axis, pos);
    goSectionLine(line);
  }, [goSectionLine]);

  // 2D 図面種別: 展開図。部屋（ゾーン）ごとの展開ドキュメント（useRoomElevationsStore）を
  // 「部屋名：展開」でグループ化して出す。開くのは平面図の展開記号と同じ経路（openRoomElevation）。
  const elevViewActive = useElevationMarkerStore((s) => s.viewActive);
  const zones = useLayoutTaskStore((s) => s.zones);
  const roomsList = useLayoutTaskStore((s) => s.rooms);
  const roomElevations = useRoomElevationsStore((s) => s.elevations);
  const activeElevationId = useRoomElevationsStore((s) => s.activeElevationId);
  const ensureRoomDefaults = useRoomElevationsStore((s) => s.ensureRoomDefaults);
  // 部屋 = Room 単位（同一 roomId のゾーンを束ねる。プランオーバーレイと同じ導出）
  const rooms = useMemo(() => computeElevationRooms(zones || [], roomsList || []), [zones, roomsList]);

  const goRoomElevation = useCallback((elevationId) => {
    consumeAutoDefault();
    openRoomElevation(elevationId);
    setActiveId(null);
    setActiveShotId(null);
  }, [setActiveShotId, consumeAutoDefault]);

  // 「＋展開」: 部屋に展開を1本追加してそのまま開く（向き・名前はストアが自動採番）。
  const addAndOpenRoomElevation = useCallback((roomId) => {
    const el = useRoomElevationsStore.getState().addElevation(roomId);
    goRoomElevation(el.id);
  }, [goRoomElevation]);

  // 平面図の展開記号クリック（オーバーレイ側）でも開かれるため、viewActive が立ったら
  // 他スロット（1F等）のハイライトを消して展開側へ寄せる。
  useEffect(() => {
    if (!elevViewActive) return;
    consumeAutoDefault(); // 展開図を開いた＝ユーザーの選択。1F デフォルトに奪われないようにする。
    setActiveId(null);
  }, [elevViewActive, consumeAutoDefault]);

  // ✅ グループ（平面/天井/立面/断面/部屋ごとの展開）の開閉状態。
  //    平面（1F/2F…）だけは従来フラットに並んでいた機能なので既定で展開しておく。
  const [openGroups, setOpenGroups] = useState({ plan: true });
  const toggleGroup = useCallback((key) => setOpenGroups((s) => ({ ...s, [key]: !s[key] })), []);

  // ============================================================
  // ✅ 図面グリッド（親クリックで立面4面 / 断面 / 展開の分割図面ビュー）
  // ============================================================
  const drawingGrid = useViewportUiStore((s) => s.drawingGrid);

  // グリッドへ入る前の共通リセット。グローバルのクリップ/flip はペイン別設定に置き換わるので落とす。
  const prepareDrawingGrid = useCallback(() => {
    consumeAutoDefault(); // グリッドを開いた＝ユーザーの選択（activeId は null に戻すので明示的に印を付ける）
    const em = useEditorModeStore.getState();
    if (em.editorMode === "material" || em.editorMode === "label") em.setEditorMode("layout");
    em.setLayoutCameraTilt?.("default");
    em.setIsSectionClipEnabled(false);
    em.setSectionViewFlip?.(false);
    useElevationMarkerStore.getState().setViewActive(false);
    useSectionLinesStore.getState().setActiveLine(null);
    setActiveId(null);
    setActiveShotId(null);
  }, [setActiveShotId, consumeAutoDefault]);

  // 立面: 北/東/南/西 の4面（goElevation と同じ axis/flip の組）。
  const openElevationGrid = useCallback(() => {
    prepareDrawingGrid();
    useViewportUiStore.getState().setDrawingGrid({
      kind: "elevation",
      key: "elevation",
      panes: [
        { label: "立面 北", viewType: "front", flip: true },
        { label: "立面 東", viewType: "right", flip: false },
        { label: "立面 南", viewType: "front", flip: false },
        { label: "立面 西", viewType: "right", flip: true },
      ],
    });
    setOpenGroups((s) => ({ ...s, elev: true }));
  }, [prepareDrawingGrid]);

  // 断面: 登録済みの断面ライン（最大4本）。クリップは SectionClipManager と同じ式を
  // ペイン別（レンダラー単位）に持たせる。
  const openSectionGrid = useCallback(() => {
    const lines = useSectionLinesStore.getState().lines.slice(0, 4);
    if (lines.length === 0) { addSectionLine(); return; }
    if (lines.length === 1) { goSectionLine(lines[0]); return; } // 1本なら単体表示で十分
    prepareDrawingGrid();
    useViewportUiStore.getState().setDrawingGrid({
      kind: "section",
      key: "section",
      panes: lines.map((line) => ({
        label: `断面 ${line.name}`,
        viewType: line.axis === "x" ? "right" : "front",
        flip: !!line.flip,
        clipPlanes: [
          line.axis === "x"
            ? { normal: [line.flip ? 1 : -1, 0, 0], constant: line.flip ? -line.pos : line.pos }
            : { normal: [0, 0, line.flip ? 1 : -1], constant: line.flip ? -line.pos : line.pos },
        ],
        // 切り口の黒塗り＋切断フレーム＋FL/GL レベル線（単体断面ビューと同じ見た目にする）
        cap: { axis: line.axis, pos: line.pos },
      })),
    });
    setOpenGroups((s) => ({ ...s, sect: true }));
  }, [prepareDrawingGrid, addSectionLine, goSectionLine]);

  // 展開: その部屋の展開（最大4面）。部屋ボックス6面クリップ＋部屋へのフレーミングを
  // SectionClipManager の elevationPlanes と同じ式でペイン別に持たせる。
  const openRoomElevationGrid = useCallback((room) => {
    ensureRoomDefaults(room.id);
    const els = useRoomElevationsStore.getState().elevations
      .filter((e) => e.roomId === room.id)
      .slice(0, 4);
    const roomBox = computeRoomBoxFromRects((room.zones || []).map((z) => z.rect));
    if (!els.length || !roomBox) return;

    const panes = els
      .map((el) => {
        const pos = getElevationMarkerPos(el);
        if (!pos) return null;
        const axis = el.dir === "A" || el.dir === "C" ? "z" : "x";
        const flip = el.dir === "C" || el.dir === "B"; // ＋軸方向を見る＝反転側
        const s = flip ? 1 : -1; // 視線方向の符号（−Z/−X が既定）
        const m = axis === "x" ? pos.x : pos.z; // マーカー（視点）位置
        const ax = axis === "x" ? [1, 0, 0] : [0, 0, 1];
        const o = axis === "x" ? [0, 0, 1] : [1, 0, 0];
        const oMin = axis === "x" ? roomBox.minZ : roomBox.minX;
        const oMax = axis === "x" ? roomBox.maxZ : roomBox.maxX;
        const farEdge = axis === "x" ? (s > 0 ? roomBox.maxX : roomBox.minX) : (s > 0 ? roomBox.maxZ : roomBox.minZ);
        const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
        return {
          label: `${el.name}${room.name ? ` ・ ${room.name}` : ""}`,
          viewType: axis === "x" ? "right" : "front",
          flip,
          clipPlanes: [
            { normal: mul(ax, s), constant: -s * m },          // near: 視点の背面側を消す
            { normal: mul(ax, -s), constant: s * farEdge },    // far: 対象壁の外側で切る
            { normal: o, constant: -oMin },                    // 横: 部屋の左右端（隣室を消す）
            { normal: mul(o, -1), constant: oMax },
            { normal: [0, 1, 0], constant: -roomBox.yMin },    // 床〜天井
            { normal: [0, -1, 0], constant: roomBox.yMax },
          ],
          frameBox: {
            center: [
              (roomBox.minX + roomBox.maxX) / 2,
              (roomBox.yMin + roomBox.yMax) / 2,
              (roomBox.minZ + roomBox.maxZ) / 2,
            ],
            maxDim: Math.max(
              roomBox.maxX - roomBox.minX,
              roomBox.maxZ - roomBox.minZ,
              roomBox.yMax - roomBox.yMin
            ),
          },
        };
      })
      .filter(Boolean);
    if (!panes.length) return;

    prepareDrawingGrid();
    useViewportUiStore.getState().setDrawingGrid({ kind: "developed", key: `room:${room.id}`, panes });
    setOpenGroups((s) => ({ ...s, [`room:${room.id}`]: true }));
  }, [prepareDrawingGrid, ensureRoomDefaults]);

  const ensureThumb = useCallback((shot) => {
    if (!shot || shot.thumbnail || capturingKey === shot.id) return;
    setCapturingKey(shot.id);
    (async () => {
      try {
        const url = await captureLayoutPerspective(shot.camera, { forceShadows: false });
        if (url) {
          const small = await downscaleDataUrl(url, 360);
          updateThumbnail(shot.id, small);
        }
      } catch { /* skip */ } finally {
        setCapturingKey((k) => (k === shot.id ? null : k));
      }
    })();
  }, [capturingKey, updateThumbnail]);

  /* ＋: forcedCategory 指定時はそのカテゴリへ新規登録。
     未指定時は「選択中なら上書き／未選択なら新規（縦切り中=断面/それ以外=外観/内観 自動）」。 */
  const registerOrOverwrite = useCallback(async (forcedCategory) => {
    const cam = layoutSceneRef.getCameraState?.();
    if (!cam) return;
    const em = useEditorModeStore.getState();
    const hasVertSection = em.isSectionClipEnabled && (em.sectionClipXEnabled || em.sectionClipZEnabled) && !em.sectionClipYEnabled;
    const sectionCfg = hasVertSection
      ? { axis: em.sectionClipXEnabled ? "x" : "z", pos: em.sectionClipXEnabled ? em.sectionClipX : em.sectionClipZ }
      : null;
    // 断面カテゴリ指定なのに断面線が無いときは登録しない（再現不能なため）
    if (forcedCategory === CAT_SECTION && !sectionCfg) return;

    setRegistering(true);
    try {
      const url = await captureLayoutPerspective(cam, { forceShadows: false });
      const thumb = url ? await downscaleDataUrl(url, 360) : null;
      const activeShot = !forcedCategory ? views.find((sh) => sh.id === activeId) : null;
      if (activeShot) {
        const patch = { camera: cam, thumbnail: thumb };
        if (activeShot.category === CAT_SECTION && sectionCfg) patch.section = sectionCfg;
        updateShot(activeShot.id, patch);
      } else {
        let category = forcedCategory;
        let section = null;
        if (forcedCategory === CAT_SECTION) section = sectionCfg;
        else if (!forcedCategory && sectionCfg) { category = CAT_SECTION; section = sectionCfg; }
        else if (!forcedCategory) category = detectCategory(cam.position, getBounds());
        const id = addShot(cam, thumb, "still", { name: category, category, tags: [TAG], section });
        setActiveId(id);
      }
    } finally {
      setRegistering(false);
    }
  }, [views, activeId, updateShot, addShot]);

  const onSlotHover = useCallback((shot, anchor) => {
    if (shot) ensureThumb(shot);
    setHover({ id: shot ? shot.id : null, anchor });
  }, [ensureThumb]);
  const onFloorHover = useCallback((fv, anchor) => setHover({ id: fv.id, floor: fv.label, anchor }), []);
  const onCeilHover = useCallback((fv, anchor) => setHover({ id: `ceil-${fv.index}`, floor: fv.label, anchor }), []);
  const onSlotLeave = useCallback(() => setHover(null), []);

  // カテゴリ・ドロップダウンを開く（その分のサムネを撮影）。
  // クリックではなくホバーで開く。ホバーの場合はトリガー⇄パネル間を移動できるよう
  // 閉じる動作を少し遅延させる（hover-intent）。
  const openCat = useCallback((category, anchor, list) => {
    if (catCloseTimer.current) { clearTimeout(catCloseTimer.current); catCloseTimer.current = null; }
    setHover(null);
    setCatMenu({ category, anchor });
    (list || []).forEach((sh) => ensureThumb(sh));
  }, [ensureThumb]);
  const cancelCloseCat = useCallback(() => {
    if (catCloseTimer.current) { clearTimeout(catCloseTimer.current); catCloseTimer.current = null; }
  }, []);
  const scheduleCloseCat = useCallback(() => {
    if (catCloseTimer.current) clearTimeout(catCloseTimer.current);
    catCloseTimer.current = setTimeout(() => { setCatMenu(null); catCloseTimer.current = null; }, 180);
  }, []);
  const closeCat = useCallback(() => {
    if (catCloseTimer.current) { clearTimeout(catCloseTimer.current); catCloseTimer.current = null; }
    setCatMenu(null);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (catCloseTimer.current) clearTimeout(catCloseTimer.current);
  }, []);

  // カテゴリ・ドロップダウンを開いている間は ← → でそのカテゴリ内のアングルを切替・適用。
  useEffect(() => {
    if (!catMenu) return;
    const list =
      catMenu.category === CAT_EXTERIOR ? exteriors : catMenu.category === CAT_INTERIOR ? interiors : sections;
    if (!list.length) return;
    const onKey = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const curIdx = list.findIndex((sh) => sh.id === activeId);
      const next = curIdx < 0
        ? (dir === 1 ? 0 : list.length - 1)
        : (curIdx + dir + list.length) % list.length;
      const sh = list[next];
      if (sh) { ensureThumb(sh); goShot(sh); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [catMenu, exteriors, interiors, sections, activeId, goShot, ensureThumb]);

  if (editorMode === "walkthrough") return null;

  // ホバープレビューの解決
  const isFloorHover = hover && typeof hover.id === "string" && hover.id.startsWith("floor-");
  const isCeilHover = hover && typeof hover.id === "string" && hover.id.startsWith("ceil-");
  const hoverShot = hover && !isFloorHover && !isCeilHover ? views.find((s) => s.id === hover.id) : null;
  const previewThumb = hoverShot?.thumbnail || null;
  const previewBusy = hover ? capturingKey === hover.id : false;
  let previewLabel = "";
  if (isFloorHover) previewLabel = `${hover.floor}（間取り・水平断面）`;
  else if (isCeilHover) previewLabel = `${hover.floor}（天井伏図・見上げ）`;
  else if (hoverShot) {
    if (hoverShot.category === CAT_OVERVIEW) previewLabel = "全体（俯瞰）";
    else {
      const list =
        hoverShot.category === CAT_EXTERIOR ? exteriors : hoverShot.category === CAT_INTERIOR ? interiors : sections;
      previewLabel = `${hoverShot.category}${list.findIndex((x) => x.id === hoverShot.id) + 1}`;
    }
  }

  const shotSlot = (shot, label, deletable) => ({
    label,
    active: activeId === shot.id,
    onClick: () => goShot(shot),
    onHover: (a) => onSlotHover(shot, a),
    onLeave: onSlotLeave,
    onDelete: deletable ? () => { removeShot(shot.id); if (activeId === shot.id) setActiveId(null); } : undefined,
  });

  // 縦並びレール用の区切り（横線）
  const Divider = () => <Box sx={{ height: "1px", width: 18, bgcolor: alpha("#fff", 0.14), my: 0.2, alignSelf: "center" }} />;

  // 2D 配置は常に図面種別（平面/立面/断面/展開）を出すので非表示にしない。

  return (
    <Box
      sx={{
        // 旧・右ドック位置（ビューポート右端）に縦置き
        position: "absolute", top: 160, right: 16, zIndex: 12,
        opacity: hover ? 1 : 0.6, transition: "opacity 0.16s ease",
        "&:hover": { opacity: 1 },
      }}
    >
      <Stack
        direction="column" spacing={0.3} alignItems="stretch"
        sx={{
          px: 0.5, py: 0.6, borderRadius: 4,
          // グループ展開や部屋数の増加でレールが伸びても画面内に収める
          maxHeight: "calc(100vh - 240px)", overflowY: "auto", overflowX: "hidden",
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { background: alpha("#fff", 0.2), borderRadius: 2 },
          background: "color-mix(in srgb, var(--brand-bg) 82%, transparent)", border: `1px solid ${alpha("#fff", 0.12)}`,
          backdropFilter: "blur(10px)", boxShadow: `0 8px 24px ${alpha("#000", 0.4)}`,
        }}
      >
        {/* ✅ 全体（保存パースビュー）は 3D 演出グループのみ */}
        {!isViewGroup2D && vOverview && <Slot {...shotSlot(vOverview, CAT_OVERVIEW, false)} />}

        {/* ✅ 平面（1F/2F… 間取り・水平断面）は 2D 配置グループのみ。
            ラベルクリック=アクティブ階の平面図を開く、チェブロン=階リストの開閉。 */}
        {isViewGroup2D && floorViews.length > 0 && (
          <>
            <GroupSlot
              label="平面"
              expanded={!!openGroups.plan}
              childActive={String(activeId || "").startsWith("floor-")}
              gridActive={false}
              onToggle={() => toggleGroup("plan")}
              onOpen={() => goFloor(floorViews[Math.min(activeFloorIndex || 0, floorViews.length - 1)] || floorViews[0])}
            />
            {!!openGroups.plan && (
              <>
                {floorViews.map((fv) => {
                  // アクティブ階は常に実体（目アイコン無し）。他階は既定で非表示、目アイコンを
                  // ONにした階だけ透過（ゴースト）表示する。
                  const isActiveFloor = (fv.index ?? 0) === (activeFloorIndex || 0);
                  const isGhost = ghostFloors.includes(fv.index ?? 0);
                  const showEye = !isActiveFloor && showOtherFloorsGhost;
                  return (
                    <Slot
                      key={fv.id} indent label={fv.label} active={activeId === fv.id}
                      onClick={() => goFloor(fv)} onHover={(a) => onFloorHover(fv, a)} onLeave={onSlotLeave}
                      trailing={showEye ? (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); toggleFloorGhost(fv.index ?? 0); }}
                          title={isGhost ? `${fv.label} を非表示にする` : `${fv.label} を薄く重ねて表示`}
                          sx={{ p: 0.2, color: activeId === fv.id ? "#06210f" : `color-mix(in srgb, var(--brand-fg) ${isGhost ? 75 : 40}%, transparent)` }}
                        >
                          {isGhost
                            ? <VisibilityRoundedIcon sx={{ fontSize: 15 }} />
                            : <VisibilityOffRoundedIcon sx={{ fontSize: 15 }} />}
                        </IconButton>
                      ) : null}
                    />
                  );
                })}
                <Slot indent label="＋ 平面" onClick={() => addFloorAndOpen("floor")} />
              </>
            )}
            <Divider />

            {/* 天井（1F/2F… 天井伏図）: その階の天井を FL+カット高から見上げるビュー。 */}
            <GroupSlot
              label="天井"
              expanded={!!openGroups.ceil}
              childActive={String(activeId || "").startsWith("ceil-")}
              gridActive={false}
              onToggle={() => toggleGroup("ceil")}
              onOpen={() => goCeiling(floorViews[Math.min(activeFloorIndex || 0, floorViews.length - 1)] || floorViews[0])}
            />
            {!!openGroups.ceil && (
              <>
                {floorViews.map((fv) => (
                  <Slot
                    key={`ceil-${fv.index}`} indent label={fv.label} active={activeId === `ceil-${fv.index}`}
                    onClick={() => goCeiling(fv)} onHover={(a) => onCeilHover(fv, a)} onLeave={onSlotLeave}
                  />
                ))}
                <Slot indent label="＋ 天井" onClick={() => addFloorAndOpen("ceiling")} />
              </>
            )}
          </>
        )}

        {/* ✅ 2D 配置グループ: 平面/天井(上記) に加えて 立面 / 断面 / 部屋ごとの展開 をネストで切替 */}
        {isViewGroup2D && floorViews.length > 0 && <Divider />}
        {isViewGroup2D && (
          <>
            {/* 立面。ラベルクリック=北/東/南/西の4面分割、チェブロン=子リスト開閉。 */}
            <GroupSlot
              label="立面"
              expanded={!!openGroups.elev}
              childActive={["elev-n", "elev-e", "elev-s", "elev-w"].includes(activeId)}
              gridActive={drawingGrid?.key === "elevation"}
              onToggle={() => toggleGroup("elev")}
              onOpen={openElevationGrid}
            />
            {!!openGroups.elev && (
              <>
                <Slot indent label="立面 北" active={activeId === "elev-n"} onClick={() => goElevation("z", true,  "elev-n")} />
                <Slot indent label="立面 東" active={activeId === "elev-e"} onClick={() => goElevation("x", false, "elev-e")} />
                <Slot indent label="立面 南" active={activeId === "elev-s"} onClick={() => goElevation("z", false, "elev-s")} />
                <Slot indent label="立面 西" active={activeId === "elev-w"} onClick={() => goElevation("x", true,  "elev-w")} />
              </>
            )}
            <Divider />

            {/* 断面。ラベルクリック=A-A'|B-B'…の分割、チェブロン=子リスト開閉。＋で新規登録。 */}
            <GroupSlot
              label="断面"
              expanded={!!openGroups.sect}
              childActive={String(activeId || "").startsWith("sect-")}
              gridActive={drawingGrid?.key === "section"}
              onToggle={() => toggleGroup("sect")}
              onOpen={openSectionGrid}
            />
            {!!openGroups.sect && (
              <>
                {sectionLines.map((line) => (
                  <Slot key={line.id} indent label={`断面 ${line.name}`} active={activeId === `sect-${line.id}`} onClick={() => goSectionLine(line)} />
                ))}
                <Slot indent label="＋ 断面" onClick={addSectionLine} />
              </>
            )}

            {/* 展開: 部屋（ゾーン）ごとに「部屋名：展開」でグループ化。＋で同じ部屋に追加。 */}
            {rooms.length > 0 && <Divider />}
            {rooms.map((room) => {
              const key = `room:${room.id}`;
              const list = roomElevations.filter((e) => e.roomId === room.id);
              const childActive = elevViewActive && list.some((e) => e.id === activeElevationId);
              return (
                <React.Fragment key={key}>
                  <GroupSlot
                    label={`${room.name || "部屋"}：展開`}
                    expanded={!!openGroups[key]}
                    childActive={childActive}
                    gridActive={drawingGrid?.key === key}
                    onToggle={() => { ensureRoomDefaults(room.id); toggleGroup(key); }}
                    onOpen={() => openRoomElevationGrid(room)}
                  />
                  {!!openGroups[key] && (
                    <>
                      {list.map((el) => (
                        <Slot
                          key={el.id}
                          indent
                          label={el.name}
                          active={elevViewActive && activeElevationId === el.id}
                          onClick={() => goRoomElevation(el.id)}
                        />
                      ))}
                      <Slot indent label="＋ 展開" onClick={() => addAndOpenRoomElevation(room.id)} />
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* ✅ 外観/内観/断面 の保存ビューは 3D 演出グループのみ */}
        {!isViewGroup2D && <Divider />}
        {!isViewGroup2D && [
          { cat: CAT_EXTERIOR, list: exteriors },
          { cat: CAT_INTERIOR, list: interiors },
          { cat: CAT_SECTION, list: sections },
        ].map(({ cat, list }) => {
          const activeInCat = list.some((sh) => sh.id === activeId);
          return (
            <Box
              key={cat}
              onMouseEnter={(e) => openCat(cat, e.currentTarget, list)}
              onMouseLeave={scheduleCloseCat}
              onClick={(e) => openCat(cat, e.currentTarget, list)}
              sx={{
                position: "relative", height: 30, px: 1.3, display: "flex", alignItems: "center", gap: 0.5,
                borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
                color: activeInCat ? "#06210f" : "color-mix(in srgb, var(--brand-fg) 82%, transparent)",
                background: activeInCat ? `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)` : "transparent",
                "&:hover": { background: activeInCat ? undefined : alpha("#fff", 0.1) },
              }}
            >
              {cat}
              <Box component="span" sx={{ fontSize: 10.5, fontWeight: 800, px: 0.5, borderRadius: 999, color: activeInCat ? alpha("#06210f", 0.7) : alpha("#fff", 0.5), bgcolor: activeInCat ? "color-mix(in srgb, var(--brand-surface) 14%, transparent)" : alpha("#fff", 0.1) }}>
                {list.length}
              </Box>
              <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, ml: -0.3, opacity: 0.7 }} />
            </Box>
          );
        })}

        {/* ✅ ビュー登録（＋）は 3D 演出グループのみ（外観/内観/断面の登録機能のため） */}
        {!isViewGroup2D && <Divider />}
        {!isViewGroup2D && <Tooltip title={views.some((s) => s.id === activeId) ? "選択中のビューを上書き" : "現在のビューを登録（断面中=断面 / それ以外=外観/内観 自動）"} arrow>
          <span>
            <IconButton
              size="small" onClick={registerOrOverwrite} disabled={registering}
              sx={{
                width: 30, height: 30, color: "#06210f",
                background: `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)`,
                "&:hover": { background: `linear-gradient(180deg, ${alpha("#34d399", 1)} 0%, ${alpha("#047857", 1)} 100%)` },
                "&.Mui-disabled": { color: alpha("#06210f", 0.6), background: alpha("#34d399", 0.4) },
              }}
            >
              {registering ? <CircularProgress size={15} sx={{ color: "#06210f" }} /> : <AddRoundedIcon sx={{ fontSize: 19 }} />}
            </IconButton>
          </span>
        </Tooltip>}
      </Stack>

      {/* ホバー・サムネプレビュー */}
      <Popover
        open={Boolean(hover)} anchorEl={hover?.anchor || null} onClose={onSlotLeave}
        anchorOrigin={{ vertical: "center", horizontal: "left" }} transformOrigin={{ vertical: "center", horizontal: "right" }}
        disableRestoreFocus hideBackdrop sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1, p: 0.8, borderRadius: 2, overflow: "hidden",
              background: "color-mix(in srgb, var(--brand-bg) 95%, transparent)", border: `1px solid ${alpha("#fff", 0.14)}`,
              backdropFilter: "blur(12px)", boxShadow: `0 14px 40px ${alpha("#000", 0.55)}`,
            },
          },
        }}
      >
        <Box sx={{ width: 220, height: 138, borderRadius: 1.5, overflow: "hidden", background: "color-mix(in srgb, var(--brand-bg) 40%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isFloorHover ? (
            <LayersRoundedIcon sx={{ fontSize: 34, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)" }} />
          ) : previewThumb ? (
            <img src={previewThumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : previewBusy ? (
            <CircularProgress size={20} sx={{ color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }} />
          ) : (
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>サムネ準備中…</Typography>
          )}
        </Box>
        <Typography sx={{ mt: 0.6, mb: 0.2, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--brand-fg)" }}>{previewLabel}</Typography>
      </Popover>

      {/* カテゴリ・ドロップダウン（サムネのグリッドで選択。多数登録でも選びやすい） */}
      <Popover
        open={Boolean(catMenu)}
        anchorEl={catMenu?.anchor || null}
        onClose={closeCat}
        anchorOrigin={{ vertical: "center", horizontal: "left" }}
        transformOrigin={{ vertical: "center", horizontal: "right" }}
        disableRestoreFocus
        hideBackdrop
        sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            onMouseEnter: cancelCloseCat,
            onMouseLeave: scheduleCloseCat,
            sx: {
              mt: 1, p: 1.4, borderRadius: 2.5, pointerEvents: "auto",
              background: "color-mix(in srgb, var(--brand-bg) 95%, transparent)", border: `1px solid ${alpha("#fff", 0.14)}`,
              backdropFilter: "blur(14px)", boxShadow: `0 16px 46px ${alpha("#000", 0.55)}`,
            },
          },
        }}
      >
        {(() => {
          if (!catMenu) return null;
          const list =
            catMenu.category === CAT_EXTERIOR ? exteriors : catMenu.category === CAT_INTERIOR ? interiors : sections;
          return (
            <Box sx={{ width: "min(70vw, 660px)" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "var(--brand-fg)" }}>
                    {catMenu.category}（{list.length}）
                  </Typography>
                  {list.length > 1 && (
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
                      ← → で切替
                    </Typography>
                  )}
                </Stack>
                <Button
                  size="small" disableElevation
                  onClick={async () => { await registerOrOverwrite(catMenu.category); }}
                  disabled={registering}
                  startIcon={registering ? <CircularProgress size={12} sx={{ color: "#06210f" }} /> : <AddRoundedIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    textTransform: "none", fontSize: 11.5, fontWeight: 800, color: "#06210f", borderRadius: 999, px: 1.2,
                    background: `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)`,
                    "&:hover": { background: `linear-gradient(180deg, ${alpha("#34d399", 1)} 0%, ${alpha("#047857", 1)} 100%)` },
                    "&.Mui-disabled": { color: alpha("#06210f", 0.6), background: alpha("#34d399", 0.4) },
                  }}
                >
                  現在を登録
                </Button>
              </Stack>
              {list.length === 0 ? (
                <Box sx={{ py: 2.5, textAlign: "center", border: `1px dashed ${alpha("#fff", 0.16)}`, borderRadius: 1.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", fontSize: 12 }}>
                  {catMenu.category === CAT_SECTION ? "断面線を出した状態で「現在を登録」" : "アングルを合わせて「現在を登録」"}
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 280, overflowY: "auto" }}>
                  {list.map((sh, i) => (
                    <ViewTile
                      key={sh.id}
                      thumb={sh.thumbnail}
                      label={`${catMenu.category}${i + 1}`}
                      active={activeId === sh.id}
                      busy={capturingKey === sh.id}
                      onClick={() => { goShot(sh); closeCat(); }}
                      onRemove={() => { removeShot(sh.id); if (activeId === sh.id) setActiveId(null); }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          );
        })()}
      </Popover>
    </Box>
  );
}
