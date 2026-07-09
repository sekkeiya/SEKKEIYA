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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Stack, Button, Tooltip, IconButton, Typography, Popover, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import * as THREE from "three";
import { layoutSceneRef } from "../services/layoutSceneRef";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import { useViewportUiStore, VIEWPORT_IDS, VIEWPORT_LAYOUT } from "../store/viewportUiStore";
import { useShotStore } from "../store/useShotStore";
import { useLayoutLoadSignal } from "../store/useLayoutLoadSignal";
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

/* 断面/間取り/パースのエディタ状態を適用（断面クリップ＋ビュー種別） */
function applyEditorViewState(kind, opts = {}) {
  const em = useEditorModeStore.getState();
  const vp = useViewportUiStore.getState();
  // ラベルモードは断面が強制OFFになるので layout へ切替（断面/間取りを見せるため）
  if (kind !== "persp" && em.editorMode === "label") em.setEditorMode("layout");

  if (kind === "persp") {
    em.setIsSectionClipEnabled(false);
    vp.setLayoutMode(VIEWPORT_LAYOUT.SINGLE);
    vp.setActiveViewportId(VIEWPORT_IDS.PERSP);
  } else if (kind === "floor") {
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(true);
    em.setSectionClipXEnabled(false);
    em.setSectionClipZEnabled(false);
    em.setSectionClipHeight(opts.cutY);
    vp.setLayoutMode(VIEWPORT_LAYOUT.SINGLE);
    vp.setActiveViewportId(VIEWPORT_IDS.TOP);
    setTimeout(() => vp.requestFrameAll?.(), 120);
  } else if (kind === "section") {
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(false);
    em.setSectionClipXEnabled(opts.axis === "x");
    em.setSectionClipZEnabled(opts.axis === "z");
    if (opts.axis === "x") em.setSectionClipX(opts.pos);
    else em.setSectionClipZ(opts.pos);
    vp.setLayoutMode(VIEWPORT_LAYOUT.SINGLE);
    vp.setActiveViewportId(opts.axis === "x" ? VIEWPORT_IDS.RIGHT : VIEWPORT_IDS.FRONT);
    setTimeout(() => vp.requestFrameAll?.(), 140);
  }
}

function Slot({ label, active, onClick, onHover, onLeave, onDelete }) {
  return (
    <Box
      onClick={onClick}
      onMouseEnter={(e) => onHover(e.currentTarget)}
      onMouseLeave={onLeave}
      sx={{
        position: "relative", height: 30, px: 1.4, display: "flex", alignItems: "center",
        borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
        color: active ? "#06210f" : alpha("#fff", 0.82),
        background: active ? `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)` : "transparent",
        transition: "background 0.12s, color 0.12s",
        "&:hover": { background: active ? undefined : alpha("#fff", 0.1) },
        "&:hover .rm": { opacity: 1 },
      }}
    >
      {label}
      {onDelete && (
        <IconButton
          className="rm" size="small"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          sx={{
            position: "absolute", top: -7, right: -5, p: 0.15, opacity: 0, transition: "opacity 0.15s",
            color: "#fff", bgcolor: alpha("#0b0f18", 0.95), border: `1px solid ${alpha("#fff", 0.25)}`,
            "&:hover": { bgcolor: "#e0564f" },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 12 }} />
        </IconButton>
      )}
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
          border: `2px solid ${active ? "#34d399" : alpha("#fff", 0.14)}`, background: alpha("#0b0f18", 0.7),
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
          <CircularProgress size={15} sx={{ color: alpha("#fff", 0.6) }} />
        ) : (
          <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.35) }}>—</Typography>
        )}
        {onRemove && (
          <IconButton
            className="rm" size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            sx={{ position: "absolute", top: 1, right: 1, p: 0.25, opacity: 0, transition: "opacity 0.15s", color: "#fff", bgcolor: alpha("#000", 0.5), "&:hover": { bgcolor: "#e0564f" } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
      </Box>
      <Typography sx={{ mt: 0.3, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: active ? "#fff" : alpha("#fff", 0.65), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

  const goShot = useCallback((shot) => {
    const cam = shot?.camera;
    if (!cam) return;
    if (shot.category === CAT_SECTION && shot.section) {
      applyEditorViewState("section", { axis: shot.section.axis, pos: shot.section.pos });
    } else {
      applyEditorViewState("persp");
      // perspective viewport へ切替後に飛ばす
      setTimeout(() => flyTo(cam.position, cam.target, cam.fov), 90);
    }
    setActiveId(shot.id);
    setActiveShotId(shot.id);
  }, [flyTo, setActiveShotId]);

  const goFloor = useCallback((fv) => {
    applyEditorViewState("floor", { cutY: fv.cutY });
    setActiveId(fv.id);
    setActiveShotId(null);
  }, [setActiveShotId]);

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
  const hoverShot = hover && !isFloorHover ? views.find((s) => s.id === hover.id) : null;
  const previewThumb = hoverShot?.thumbnail || null;
  const previewBusy = hover ? capturingKey === hover.id : false;
  let previewLabel = "";
  if (isFloorHover) previewLabel = `${hover.floor}（間取り・水平断面）`;
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

  const Divider = () => <Box sx={{ width: "1px", height: 18, bgcolor: alpha("#fff", 0.14), mx: 0.2 }} />;

  return (
    <Box
      sx={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 12,
        opacity: hover ? 1 : 0.35, transition: "opacity 0.16s ease",
        "&:hover": { opacity: 1 },
      }}
    >
      <Stack
        direction="row" spacing={0.3} alignItems="center"
        sx={{
          px: 0.7, py: 0.5, borderRadius: 999,
          background: alpha("#0b0f18", 0.82), border: `1px solid ${alpha("#fff", 0.12)}`,
          backdropFilter: "blur(10px)", boxShadow: `0 8px 24px ${alpha("#000", 0.4)}`,
        }}
      >
        {vOverview && <Slot {...shotSlot(vOverview, CAT_OVERVIEW, false)} />}

        {floorViews.length > 0 && <Divider />}
        {floorViews.map((fv) => (
          <Slot
            key={fv.id} label={fv.label} active={activeId === fv.id}
            onClick={() => goFloor(fv)} onHover={(a) => onFloorHover(fv, a)} onLeave={onSlotLeave}
          />
        ))}

        <Divider />
        {[
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
                color: activeInCat ? "#06210f" : alpha("#fff", 0.82),
                background: activeInCat ? `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)` : "transparent",
                "&:hover": { background: activeInCat ? undefined : alpha("#fff", 0.1) },
              }}
            >
              {cat}
              <Box component="span" sx={{ fontSize: 10.5, fontWeight: 800, px: 0.5, borderRadius: 999, color: activeInCat ? alpha("#06210f", 0.7) : alpha("#fff", 0.5), bgcolor: activeInCat ? alpha("#06210f", 0.14) : alpha("#fff", 0.1) }}>
                {list.length}
              </Box>
              <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, ml: -0.3, opacity: 0.7 }} />
            </Box>
          );
        })}

        <Divider />
        <Tooltip title={views.some((s) => s.id === activeId) ? "選択中のビューを上書き" : "現在のビューを登録（断面中=断面 / それ以外=外観/内観 自動）"} arrow>
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
        </Tooltip>
      </Stack>

      {/* ホバー・サムネプレビュー */}
      <Popover
        open={Boolean(hover)} anchorEl={hover?.anchor || null} onClose={onSlotLeave}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        disableRestoreFocus hideBackdrop sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1, p: 0.8, borderRadius: 2, overflow: "hidden",
              background: alpha("#0b0f18", 0.95), border: `1px solid ${alpha("#fff", 0.14)}`,
              backdropFilter: "blur(12px)", boxShadow: `0 14px 40px ${alpha("#000", 0.55)}`,
            },
          },
        }}
      >
        <Box sx={{ width: 220, height: 138, borderRadius: 1.5, overflow: "hidden", background: alpha("#000", 0.4), display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isFloorHover ? (
            <LayersRoundedIcon sx={{ fontSize: 34, color: alpha("#fff", 0.35) }} />
          ) : previewThumb ? (
            <img src={previewThumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : previewBusy ? (
            <CircularProgress size={20} sx={{ color: alpha("#fff", 0.6) }} />
          ) : (
            <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.4) }}>サムネ準備中…</Typography>
          )}
        </Box>
        <Typography sx={{ mt: 0.6, mb: 0.2, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{previewLabel}</Typography>
      </Popover>

      {/* カテゴリ・ドロップダウン（サムネのグリッドで選択。多数登録でも選びやすい） */}
      <Popover
        open={Boolean(catMenu)}
        anchorEl={catMenu?.anchor || null}
        onClose={closeCat}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        disableRestoreFocus
        hideBackdrop
        sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            onMouseEnter: cancelCloseCat,
            onMouseLeave: scheduleCloseCat,
            sx: {
              mt: 1, p: 1.4, borderRadius: 2.5, pointerEvents: "auto",
              background: alpha("#0b0f18", 0.95), border: `1px solid ${alpha("#fff", 0.14)}`,
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
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#fff" }}>
                    {catMenu.category}（{list.length}）
                  </Typography>
                  {list.length > 1 && (
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: alpha("#fff", 0.5) }}>
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
                <Box sx={{ py: 2.5, textAlign: "center", border: `1px dashed ${alpha("#fff", 0.16)}`, borderRadius: 1.5, color: alpha("#fff", 0.45), fontSize: 12 }}>
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
