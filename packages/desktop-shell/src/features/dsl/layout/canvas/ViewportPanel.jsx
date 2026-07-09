// src/features/layout/components/MainArea/ViewportPanel.jsx
import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { Box, Typography, Stack, Button, Tooltip, CircularProgress, IconButton, Dialog, DialogContent } from "@mui/material";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { alpha, useTheme } from "@mui/material/styles";

// ✅ Canvas extracted
import MultiViewportTiled from "./MultiViewportTiled.jsx";


// ✅ Stores
import { useUiSelectionStore } from "../store/uiSelectionStore";
import { useToolsStore } from "../store/toolsStore/useToolsStore";
import { useViewportUiStore } from "../store/viewportUiStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useZoningStore } from "../store/useZoningStore";
import LayoutOperationUI from "./LayoutOperationUI.jsx";
import SectionClipSlider from "./SectionClipSlider.jsx";

// ✅ speed enums (MultiViewportTiled に渡す互換)
import { SPEED_MODES } from "./menu/MoveSpeedDock.jsx";

import { buildCopyPayload } from "../commands/copyOps";

// CAD（Rhino）テンプレート起動
import RhinoTemplateDialog from "../../../../components/Projects/RhinoTemplateDialog";
import { createCadFromTemplateAndLaunch } from "../../../projects/cadLaunch";
import { useAppStore } from "../../../../store/useAppStore";
import { useAuthStore } from "../../../../store/useAuthStore";

export default function ViewportPanel({
  boardId,
  baseId,
  planId,
  optionId,

  optionDoc,
  optionDocLoading,

  meta,
  onDropAsset,

  onOpenSelectBase,
  onOpenSelectWorkFile,
  onUploadBaseFiles,
  onOpenBaseBuilder,
  onSetDefaultBase,
  onCloseEmptyGuide,

  baseDoc,
  baseDocLoading,
  baseGlbUrlResolved,

  layoutDraft = null,
  onChangeLayoutDraft,
  onMarkDirty,

  onPickMaterial,

  saving,

  onBeginHistoryBatch,
  onEndHistoryBatch,
  onCancelHistoryBatch,
}) {
  const theme = useTheme();
  const [numericCloseTick, setNumericCloseTick] = useState(0);

  // ── CAD を開く（空状態のベース未設定ガイド用） ──
  const [cadMenuOpen, setCadMenuOpen] = useState(false);
  const [cadTemplateOpen, setCadTemplateOpen] = useState(false);
  const activeProject = useAppStore((s) => s.projects.find((p) => p.id === s.activeProjectId) || null);
  const currentUser = useAuthStore((s) => s.currentUser);
  const handlePickCadTemplate = useCallback(async (template) => {
    setCadTemplateOpen(false);
    if (!activeProject || !currentUser) { alert("プロジェクト情報が取得できませんでした"); return; }
    try {
      await createCadFromTemplateAndLaunch({ id: activeProject.id, name: activeProject.name }, currentUser.uid, template);
    } catch (e) {
      alert("Rhino の起動に失敗しました: " + e);
    }
  }, [activeProject, currentUser]);

  // =========================
  // ✅ Tools（propsで受け取らない）
  // =========================
  const gizmoMode = useToolsStore((s) => s.mode);
  const gizmoSpace = useToolsStore((s) => s.space);
  const snapEnabled = useToolsStore((s) => s.snapEnabled);
  const materialPicking = useToolsStore((s) => s.materialPicking);

  // =========================
  // ✅ Selection (Store)
  // =========================
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const setSelectedItemId = useUiSelectionStore((s) => s.setSelectedItemId);
  const setSelectedItemIds = useUiSelectionStore((s) => s.setSelectedItemIds);
  const primarySelectedItemId = useMemo(() => selectedItemIds?.[0] ?? null, [selectedItemIds]);

  // =========================
  // ✅ Viewport UI store
  // =========================
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isZoningMode = editorMode === "zoning";
  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const isZoningActionSelect = useZoningStore((s) => s.isZoningActionSelect);

  const layoutMode = useViewportUiStore((s) => s.layoutMode);
  const activeViewportId = useViewportUiStore((s) => s.activeViewportId);
  const setActiveViewportId = useViewportUiStore((s) => s.setActiveViewportId);

  const lockToGround = useViewportUiStore((s) => s.lockToGround);
  const axisConstraint = useViewportUiStore((s) => s.axisConstraint);

  const focusTick = useViewportUiStore((s) => s.focusTick);
  const frameAllTick = useViewportUiStore((s) => s.frameAllTick);

  const speedMode = useViewportUiStore((s) => s.speedMode);
  const speedMul = useViewportUiStore((s) => s.speedMul);
  const setSpeedMode = useViewportUiStore((s) => s.setSpeedMode);
  const setSpeedMul = useViewportUiStore((s) => s.setSpeedMul);

  const openCommand = useViewportUiStore((s) => s.openCommand);
  const closeCommand = useViewportUiStore((s) => s.closeCommand);

  // =========================
  // ✅ MultiViewportTiled を外から操作する
  // =========================
  const viewportRef = useRef(null);

  // ✅ “refが入った瞬間”に確実に store へ登録（rAF不要）
  const setViewportApiRef = useCallback((api) => {
    const safe = api || null;
    viewportRef.current = safe;
    useViewportUiStore.getState().registerViewportApi(safe);
  }, []);

  // =========================
  // ✅ Base selection
  // =========================
  const isBaseSelected = useMemo(() => !!optionDoc, [optionDoc]);
  // パラメトリックルーム（躯体の寸法データ）。GLB が無くてもこれがあれば躯体ありとみなす。
  const roomSpec = useMemo(() => {
    const rs = baseDoc?.roomSpec;
    return rs && (rs.widthMm || rs.depthMm || rs.heightMm) ? rs : null;
  }, [baseDoc?.roomSpec]);
  const isBaseRenderable = !!baseGlbUrlResolved || !!roomSpec;

  // =========================
  // ✅ items（直前値キャッシュで一瞬[]を防ぐ）
  // =========================
  const lastItemsRef = useRef([]);

  const items = useMemo(() => {
    let candidate = null;

    const d1 = layoutDraft?.items;
    if (Array.isArray(d1)) candidate = d1;

    if (!candidate) {
      const v1 = optionDoc?.layout?.items;
      if (Array.isArray(v1)) candidate = v1;
    }

    if (!candidate) {
      const v2 = optionDoc?.items;
      if (Array.isArray(v2)) candidate = v2;
    }

    if (!candidate) {
      const v3 =
        optionDoc?.layout?.items && typeof optionDoc.layout.items === "object"
          ? Object.values(optionDoc.layout.items)
          : null;
      if (Array.isArray(v3)) candidate = v3;
    }

    if (!candidate) {
      const v4 = optionDoc?.items && typeof optionDoc.items === "object" ? Object.values(optionDoc.items) : null;
      if (Array.isArray(v4)) candidate = v4;
    }

    if (Array.isArray(candidate)) {
      lastItemsRef.current = candidate.slice();
      return candidate;
    }

    return lastItemsRef.current;
  }, [layoutDraft?.items, optionDoc]);

  // ✅ 表示用（idを補完）
  const normalizedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map((it, idx) => {
      const id = it?.id || it?.itemId || it?.modelId || `item_${idx}`;
      return { ...it, id };
    });
  }, [items]);

  // ✅ “実体（draft/layout）” 側も id を必ず持たせるためのヘルパ
  const ensureItemIds = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    let changed = false;

    const next = arr.map((it, idx) => {
      const id = it?.id || it?.itemId || it?.modelId || `item_${idx}`;
      if (!it?.id) changed = true;
      return { ...it, id };
    });

    return { items: next, changed };
  }, []);

  // =========================
  // ✅ 選択更新（store直更新）
  // =========================
  const handleSelectItemId = useCallback((id) => setSelectedItemId(id ?? null), [setSelectedItemId]);

  const handleSelectItemIds = useCallback(
    (ids) => {
      const next = Array.isArray(ids) ? ids.filter(Boolean) : [];
      setSelectedItemIds(next);
    },
    [setSelectedItemIds]
  );

  // =========================
  // ✅ draft 更新（共通）
  // =========================
  const applyTransformsToDraft = useCallback(
    (updates, { markDirty = true, pushToHistory = true } = {}) => {
      if (!Array.isArray(updates) || updates.length === 0) return;

      const baseLayout = layoutDraft ?? optionDoc?.layout ?? null;

      // ✅ 実体側 items を優先しつつ、必ず id を付与
      const rawBaseItems = Array.isArray(baseLayout?.items) ? baseLayout.items : normalizedItems;
      const { items: baseItems } = ensureItemIds(rawBaseItems);

      const map = new Map(updates.map((u) => [u.itemId, u.transform]));

      const nextItems = baseItems.map((x, idx) => {
        const id = x?.id || x?.itemId || x?.modelId || `item_${idx}`;
        const t = map.get(id);
        if (!t) return x;

        const prev = x || {};
        return {
          ...prev,
          id: prev.id || id,
          transform: {
            ...(prev.transform || {}),
            position: Array.isArray(t.position) ? t.position : prev?.transform?.position,
            rotation: Array.isArray(t.rotation) ? t.rotation : prev?.transform?.rotation,
            scale: Array.isArray(t.scale) ? t.scale : prev?.transform?.scale,
          },
        };
      });

      const nextLayout = { ...(baseLayout || {}), items: nextItems };
      onChangeLayoutDraft?.(nextLayout, { markDirty, pushToHistory });
      if (markDirty) onMarkDirty?.(true);
    },
    [layoutDraft, optionDoc?.layout, normalizedItems, ensureItemIds, onChangeLayoutDraft, onMarkDirty]
  );

  const commitItemTransformToDraft = useCallback(
    ({ itemId, transform }) => {
      if (!itemId || !transform) return;
      applyTransformsToDraft([{ itemId, transform }], { markDirty: true, pushToHistory: true });
    },
    [applyTransformsToDraft]
  );

  const commitItemTransformsToDraft = useCallback(
    (updates) => applyTransformsToDraft(updates, { markDirty: true, pushToHistory: true }),
    [applyTransformsToDraft]
  );

  const previewItemTransformToDraft = useCallback(
    ({ itemId, transform }) => {
      if (!itemId || !transform) return;
      applyTransformsToDraft([{ itemId, transform }], { markDirty: false, pushToHistory: false });
    },
    [applyTransformsToDraft]
  );

  const previewItemTransformsToDraft = useCallback(
    (updates) => applyTransformsToDraft(updates, { markDirty: false, pushToHistory: false }),
    [applyTransformsToDraft]
  );

  const handleDeleteItemIds = useCallback((idsToDelete) => {
    if (!Array.isArray(idsToDelete) || idsToDelete.length === 0) return;
    const baseLayout = layoutDraft ?? optionDoc?.layout ?? null;
    const rawBaseItems = Array.isArray(baseLayout?.items) ? baseLayout.items : normalizedItems;
    const { items: baseItems } = ensureItemIds(rawBaseItems);

    const idSet = new Set(idsToDelete);
    const nextItemsFiltered = baseItems.filter(x => {
        const id = x.id || x.itemId || x.modelId;
        return !idSet.has(id);
    });

    const nextLayout = { ...(baseLayout || {}), items: nextItemsFiltered }; 
    onChangeLayoutDraft?.(nextLayout, { markDirty: true, pushToHistory: true });
    
    const rem = selectedItemIds.filter(id => !idSet.has(id));
    setSelectedItemIds(rem);
    if (!rem.includes(primarySelectedItemId)) {
      setSelectedItemId(rem.length > 0 ? rem[0] : null);
    }
  }, [layoutDraft, optionDoc, normalizedItems, ensureItemIds, onChangeLayoutDraft, selectedItemIds, primarySelectedItemId, setSelectedItemIds, setSelectedItemId]);

  // =========================
  // ✅ History Batching (DND or multi-step operations)
  // =========================id を持つようにしてからコピー
  // - clones も必ず id を持つ前提（copyOps側）
  // =========================
  const handleRequestCopy = useCallback(
    ({ offset = [0.2, 0, 0.2] } = {}) => {
      const baseLayout = layoutDraft ?? optionDoc?.layout ?? null;

      // ✅ 実体側 items を優先（draft/layout）
      const rawBaseItems = Array.isArray(baseLayout?.items) ? baseLayout.items : normalizedItems;

      // ✅ id を必ず付与（必要なら地ならしで draft も正規化）
      const { items: baseItems, changed } = ensureItemIds(rawBaseItems);

      // まず draft/layout を “id付き” に正規化（後続の selection/registry が崩れない）
      if (changed) {
        const normalizedLayout = { ...(baseLayout || {}), items: baseItems };
        onChangeLayoutDraft?.(normalizedLayout);
      }

      const { clones, nextSelectedIds } = buildCopyPayload({
        items: baseItems,
        selectedIds: selectedItemIds,
        offset,
        idPrefix: "item",
      });

      // デバッグ（必要ならコメント外す）
      // console.log("[copy] selected:", selectedItemIds);
      // console.log("[copy] base ids:", baseItems.map((x) => x.id));
      // console.log("[copy] clones:", clones.map((x) => x.id));

      if (!clones?.length) return;

      const nextLayout = {
        ...(baseLayout || {}),
        items: [...baseItems, ...clones],
      };

      onChangeLayoutDraft?.(nextLayout);
      onMarkDirty?.(true);

      // ✅ 複製側を選択状態に（Rhinoっぽい挙動）
      setSelectedItemIds(nextSelectedIds);
    },
    [
      layoutDraft,
      optionDoc?.layout,
      normalizedItems,
      ensureItemIds,
      selectedItemIds,
      onChangeLayoutDraft,
      onMarkDirty,
      setSelectedItemIds,
    ]
  );

  // =========================
  // ✅ D&D
  // =========================
  const canDrop = isBaseSelected && isBaseRenderable && !materialPicking;

  const handleDragOver = useCallback(
    (e) => {
      if (!canDrop) return;
      e.preventDefault();
    },
    [canDrop]
  );

  const handleDrop = useCallback(
    (e) => {
      if (!canDrop) return;
      e.preventDefault();

      let json = e.dataTransfer?.getData("application/json");
      if (!json) {
        // Fallback to text/plain for Tauri WebView2 compatibility
        json = e.dataTransfer?.getData("text/plain");
      }

      // Ensure that we only attempt to parse if it resembles JSON
      if (!json || (!json.startsWith("{") && !json.startsWith("["))) return;

      try {
        const payload = JSON.parse(json);
        onDropAsset?.(payload);
      } catch (err) {
        console.warn("[ViewportPanel] drop payload parse failed:", err);
      }
    },
    [onDropAsset, canDrop]
  );

  // =========================
  // ✅ Gizmo → Command（数値入力バー）
  // =========================
  const handleRequestNumericOpen = useCallback(
    ({ axis, mode, space, applyNumeric }) => {
      const a = axis ?? null;
      if (!a) return;

      const m = String(mode || gizmoMode || "translate").toUpperCase();
      const sp = String(space || gizmoSpace || "local");

      // Z-up 表示規約: ラベルの軸文字だけ Rhino 式に読み替える（Y↔Z）。
      // 適用先の axis は Three.js の実軸のまま（applyNumeric は実軸で動かす）。
      const AXIS_DISPLAY = { X: "X", Y: "Z", Z: "Y" };
      const aDisp = AXIS_DISPLAY[String(a).toUpperCase()] ?? a;

      openCommand({
        axis: a,
        label: `${m} ${aDisp ?? ""} / ${sp}`,
        applyNumeric,
      });
    },
    [openCommand, gizmoMode, gizmoSpace]
  );

  const handleRequestNumericClose = useCallback(() => {
    closeCommand();
    setNumericCloseTick((t) => t + 1);
  }, [closeCommand]);

  /**
   * ✅ Gizmo hover 追跡 (ホバーが外れても数値入力は閉じないように変更)
   */
  const lastHoverAxisRef = useRef(null);
  const handleGizmoHoverAxisChange = useCallback(
    (axis) => {
      lastHoverAxisRef.current = axis ?? null;
      // Removed closeCommand() here to prevent closing the UI when hover is lost
    },
    []
  );

  // =========================
  // ✅ Upload
  // =========================
  const uploadInputRef = useRef(null);
  const handleClickUpload = useCallback(() => uploadInputRef.current?.click(), []);

  const handleUploadFileChange = useCallback(
    async (e) => {
      const files = e.target?.files;
      if (!files || files.length === 0) return;
      if (!isBaseSelected) {
        e.target.value = "";
        return;
      }

      try {
        await Promise.resolve(onUploadBaseFiles?.(files));
      } catch (err) {
        console.warn("[ViewportPanel] onUploadBaseFiles failed:", err);
      } finally {
        e.target.value = "";
      }
    },
    [onUploadBaseFiles, isBaseSelected]
  );

  const btnSx = useMemo(
    () => ({
      textTransform: "none",
      fontWeight: 900,
      borderRadius: 0,
      px: 1.35,
      py: 0.85,
      minWidth: 0,
      borderColor: alpha(theme.palette.common.white, 0.2),
      bgcolor: alpha(theme.palette.common.white, 0.04),
      "&:hover": {
        bgcolor: alpha(theme.palette.common.white, 0.07),
        borderColor: alpha(theme.palette.common.white, 0.26),
      },
    }),
    [theme]
  );

  // =========================
  // ✅ overlay / guide
  // =========================
  const everRenderableRef = useRef(false);
  useEffect(() => {
    everRenderableRef.current = false;
  }, [boardId]);
  useEffect(() => {
    if (baseGlbUrlResolved) everRenderableRef.current = true;
  }, [baseGlbUrlResolved]);

  const shouldShowOverlayRaw = useMemo(() => {
    const everRenderable = everRenderableRef.current;
    if (everRenderable) return false;
    
    // IF WE ARE LOADING DOCS, keep loading
    if (baseDocLoading) return true;

    if (!optionDoc) return false;
    if (!baseGlbUrlResolved) return false;

    return false;
  }, [optionDoc, optionDocLoading, baseDocLoading, baseGlbUrlResolved]);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  useEffect(() => {
    let t = null;
    if (shouldShowOverlayRaw) t = window.setTimeout(() => setOverlayVisible(true), 150);
    else setOverlayVisible(false);
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [shouldShowOverlayRaw]);

  // Base concept is deprecated, but we still need a building/base to lay out furniture.
  // Show the empty guide if a layout is selected but no base model is resolved.
  const showEmptyGuide = !baseGlbUrlResolved && !roomSpec && !baseDocLoading && !optionDocLoading && optionDoc;

  // speedMode 互換（必要なら）
  useEffect(() => {
    if (speedMode === "walk") return;
    if (speedMode === SPEED_MODES.WALK) return;
  }, [speedMode]);

  // ✅ Split↔Single 切替時に “残ってるセッション” を強制リセット（超重要）
  useEffect(() => {
    const st = useViewportUiStore.getState();
    if (st.isGizmoActive?.() || st.gizmoDragging || st.gizmoHotAxis) {
      return; // ✅ Gizmo優先：範囲選択しない
    }

    try {
      st.endAlignSession?.();
    } catch {}

    try {
      st.closeCommand?.();
    } catch {}

    if (layoutMode !== "split") {
      if (st.activeViewportId !== "vp_persp") st.setActiveViewportId?.("vp_persp");
    }
  }, [layoutMode]);

  return (
    <Box
      sx={{
        borderRadius: 0,
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        background: alpha("#050815", 0.55),
        backdropFilter: "blur(10px)",
        height: "100%",
        flex: "1 1 auto",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ✅ Header */}

      {/* Viewport */}
      <Box sx={{ flex: 1, minHeight: 0, height: "100%", overflow: "hidden", position: "relative" }}>
        <MultiViewportTiled
          ref={setViewportApiRef}
          layoutMode={layoutMode}
          activeViewportId={activeViewportId}
          singleViewId={activeViewportId}
          onChangeActiveViewportId={setActiveViewportId}
          isBaseReady={isBaseSelected}
          baseGlbUrlResolved={baseGlbUrlResolved}
          roomSpec={roomSpec}
          items={normalizedItems}
          selectedItemId={primarySelectedItemId}
          selectedItemIds={selectedItemIds}
          onSelectItemId={handleSelectItemId}
          onSelectItemIds={handleSelectItemIds}
          onCanvasDragOver={handleDragOver}
          onCanvasDrop={handleDrop}
          gizmoMode={gizmoMode}
          gizmoSpace={gizmoSpace}
          snapEnabled={snapEnabled}
          onChangeTransform={previewItemTransformToDraft}
          onChangeTransforms={previewItemTransformsToDraft}
          onCommitTransform={commitItemTransformToDraft}
          onCommitTransforms={commitItemTransformsToDraft}
          lockToGround={lockToGround}
          axisConstraint={axisConstraint}
          focusTick={focusTick}
          frameAllTick={frameAllTick}
          speedMode={speedMode}
          speedMul={speedMul}
          onChangeSpeedMode={setSpeedMode}
          onSpeedMulChange={setSpeedMul}
          onRequestNumericOpen={handleRequestNumericOpen}
          onRequestNumericClose={handleRequestNumericClose}
          numericCloseTick={numericCloseTick}
          materialPicking={materialPicking}
          onPickMaterial={onPickMaterial}
          onGizmoHoverAxisChange={handleGizmoHoverAxisChange}
          onRequestCopy={handleRequestCopy}
          onDeleteItems={handleDeleteItemIds}
          onBeginHistoryBatch={onBeginHistoryBatch}
          onEndHistoryBatch={onEndHistoryBatch}
          onCancelHistoryBatch={onCancelHistoryBatch}
        />

        {editorMode === "zoning" && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 32,
              bgcolor: alpha("#000", 0.6),
              display: "flex",
              alignItems: "center",
              px: 2,
              gap: 3,
              zIndex: 10,
              pointerEvents: "none"
            }}
          >
            {isZoningActionSelect ? (
               <>
                 <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.7) }}>
                   <Box component="span" sx={{ px: 0.5, py: 0.25, border: `1px solid ${alpha('#fff', 0.3)}`, borderRadius: 1, mr: 0.5, color: '#fff' }}>クリック</Box>
                   導線を選択
                 </Typography>
                 <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.7) }}>
                   <Box component="span" sx={{ px: 0.5, py: 0.25, border: `1px solid ${alpha('#fff', 0.3)}`, borderRadius: 1, mr: 0.5, color: '#fff' }}>Delete</Box>
                   削除
                 </Typography>
                 <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.7) }}>
                   <Box component="span" sx={{ px: 0.5, py: 0.25, border: `1px solid ${alpha('#fff', 0.3)}`, borderRadius: 1, mr: 0.5, color: '#fff' }}>Esc</Box>
                   選択解除
                 </Typography>
               </>
            ) : zoningSubMode === 'circulation' ? (
               <>
                 <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.7) }}>
                   <Box component="span" sx={{ px: 0.5, py: 0.25, border: `1px solid ${alpha('#fff', 0.3)}`, borderRadius: 1, mr: 0.5, color: '#fff' }}>Shift + クリック</Box>
                   直交スナップ
                 </Typography>
                 <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.7) }}>
                   <Box component="span" sx={{ px: 0.5, py: 0.25, border: `1px solid ${alpha('#fff', 0.3)}`, borderRadius: 1, mr: 0.5, color: '#fff' }}>Backspace</Box>
                   1つ前の点に戻る
                 </Typography>
                 <Typography sx={{ fontSize: 11, color: alpha("#fff", 0.7) }}>
                   <Box component="span" sx={{ px: 0.5, py: 0.25, border: `1px solid ${alpha('#fff', 0.3)}`, borderRadius: 1, mr: 0.5, color: '#fff' }}>ダブルクリック / 右クリック</Box>
                   描画を完了
                 </Typography>
               </>
            ) : null}
          </Box>
        )}

        <input ref={uploadInputRef} type="file" accept=".glb,.3dm" hidden multiple={false} onChange={handleUploadFileChange} />

        {/* JSON Sync / Save Indicator (Non-blocking) */}
        {(optionDocLoading || saving) && (
          <Box sx={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderRadius: 1.5, bgcolor: alpha("#000", 0.6), backdropFilter: "blur(4px)", border: `1px solid ${alpha("#fff", 0.1)}` }}>
            <CircularProgress size={14} thickness={5} sx={{ color: "primary.main", animationDuration: saving ? "400ms" : "800ms" }} />
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: "primary.main", letterSpacing: "0.03em" }}>
              {saving ? "SAVING..." : "SYNCING..."}
            </Typography>
          </Box>
        )}

        {overlayVisible && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(5, 8, 21, 0.45)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            <Stack spacing={1} alignItems="center">
              <CircularProgress size={22} />
              <Typography sx={{ fontSize: 13, opacity: 0.9 }}>読み込み中…</Typography>
            </Stack>
          </Box>
        )}

        {/* 建物の3Dモデル未設定の Base を開いたら、画面全体をブロックするダイアログで
            ベースモデルの選択を促す（左右サイドバー・ツールバー等を誤操作させない）。 */}
        <Dialog
          open={!!showEmptyGuide}
          onClose={() => onCloseEmptyGuide?.()}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: "rgba(14, 18, 28, 0.98)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 3,
              color: "#fff",
              backgroundImage: "none",
            },
          }}
        >
          <DialogContent sx={{ px: 4, py: 4, position: "relative" }}>
            {/* 閉じる: ベース一覧画面へ戻る */}
            <IconButton
              size="small"
              onClick={() => onCloseEmptyGuide?.()}
              sx={{ position: "absolute", top: 10, right: 10, color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" } }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
            <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ color: "white", fontWeight: 700, textAlign: "center" }}>
                建物の3Dモデルを設定
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
                レイアウトを開始するには、躯体（ベースモデル）を選択してください。
              </Typography>
            </Stack>
            <Stack direction="column" spacing={1.5} alignItems="center">
              <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  onClick={() => onOpenSelectBase?.()}
                  sx={{ bgcolor: "#2a85ff", "&:hover": { bgcolor: "#1e6ee6" }, textTransform: "none", borderRadius: 2 }}
                >
                  プロジェクトから選択
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => onOpenSelectWorkFile?.()}
                  sx={{ color: "white", borderColor: "rgba(255,255,255,0.3)", "&:hover": { borderColor: "rgba(255,255,255,0.6)", bgcolor: "rgba(255,255,255,0.05)" }, textTransform: "none", borderRadius: 2 }}
                >
                  CAD Filesから選択
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setCadMenuOpen((v) => !v)}
                  sx={{ color: "white", borderColor: "rgba(0,191,255,0.5)", "&:hover": { borderColor: "#00BFFF", bgcolor: "rgba(0,191,255,0.08)" }, textTransform: "none", borderRadius: 2 }}
                >
                  CADを開く（新規作成）
                </Button>
              </Stack>

              {/* CADを開く → Rhino / Blender */}
              {cadMenuOpen && (
                <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    onClick={() => { setCadMenuOpen(false); setCadTemplateOpen(true); }}
                    sx={{ bgcolor: "#00BFFF", color: "#04121c", fontWeight: 700, "&:hover": { bgcolor: "#33ccff" }, textTransform: "none", borderRadius: 2 }}
                  >
                    Rhinoを開く（テンプレートから）
                  </Button>
                  <Tooltip title="Blender 起動は近日対応予定" arrow>
                    <span>
                      <Button
                        variant="outlined"
                        disabled
                        sx={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.2)", textTransform: "none", borderRadius: 2 }}
                      >
                        Blenderを開く（準備中）
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              )}

              <Button
                variant="text"
                onClick={() => onSetDefaultBase?.()}
                sx={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textTransform: "none", borderRadius: 2, "&:hover": { color: "rgba(255,255,255,0.8)", bgcolor: "rgba(255,255,255,0.05)" } }}
              >
                デフォルトルームを使用（床 + 四方の壁）
              </Button>
            </Stack>
          </DialogContent>
        </Dialog>

        {editorMode === "layout" && <LayoutOperationUI />}

        {/* CAD（Rhino）テンプレート選択ダイアログ */}
        <RhinoTemplateDialog
          open={cadTemplateOpen}
          onClose={() => setCadTemplateOpen(false)}
          onSelect={handlePickCadTemplate}
        />

        {/* ─── Camera / Shortcut Guide ─── */}
        {!showEmptyGuide && !overlayVisible && (
          <Box
            sx={{
              position: "absolute",
              bottom: 52,
              left: 12,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0.75,
              pointerEvents: "none",
            }}
          >
            {showCameraGuide && (
              <Box
                sx={{
                  pointerEvents: "auto",
                  background: alpha("#070b14", 0.84),
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  border: `1px solid ${alpha("#fff", 0.09)}`,
                  borderRadius: 1.5,
                  px: 1.5,
                  py: 1.25,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.3,
                  minWidth: 220,
                }}
              >
                {/* ── Camera ── */}
                <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: alpha("#fff", 0.3), letterSpacing: "0.1em", textTransform: "uppercase", mb: 0.4 }}>
                  Camera
                </Typography>
                {[
                  ["右ボタン ドラッグ", "視点回転"],
                  ["Shift + 右ドラッグ", "パン"],
                  ["スクロール", "ズーム"],
                  ["← →", "視点を90°回転 *"],
                  ["↑ ↓", "仰角切替（天井/通常/真上）*"],
                ].map(([key, desc]) => (
                  <Stack key={key} direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: 18 }}>
                    <Box component="span" sx={{
                      display: "inline-block",
                      fontSize: 9, fontWeight: 700, color: alpha("#fff", 0.85),
                      background: alpha("#fff", 0.09),
                      border: `1px solid ${alpha("#fff", 0.17)}`,
                      borderRadius: "4px",
                      px: "6px", py: "1px",
                      minWidth: 90, textAlign: "center",
                      whiteSpace: "nowrap", letterSpacing: 0,
                    }}>
                      {key}
                    </Box>
                    <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.55), whiteSpace: "nowrap" }}>{desc}</Typography>
                  </Stack>
                ))}
                <Typography sx={{ fontSize: 8.5, color: alpha("#fff", 0.28), mt: 0.2, ml: 0.25 }}>
                  * アイテム未選択・Iso ビュー時のみ
                </Typography>

                <Box sx={{ borderTop: `1px solid ${alpha("#fff", 0.07)}`, my: 0.6 }} />

                {/* ── Edit ── */}
                <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: alpha("#fff", 0.3), letterSpacing: "0.1em", textTransform: "uppercase", mb: 0.4 }}>
                  Edit
                </Typography>
                {[
                  ["左クリック", "選択"],
                  ["左ドラッグ", "移動"],
                  ["Delete", "削除"],
                  ["F", "選択にフォーカス"],
                  ["Ctrl + Z / Y", "Undo / Redo"],
                ].map(([key, desc]) => (
                  <Stack key={key} direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: 18 }}>
                    <Box component="span" sx={{
                      display: "inline-block",
                      fontSize: 9, fontWeight: 700, color: alpha("#fff", 0.85),
                      background: alpha("#fff", 0.09),
                      border: `1px solid ${alpha("#fff", 0.17)}`,
                      borderRadius: "4px",
                      px: "6px", py: "1px",
                      minWidth: 90, textAlign: "center",
                      whiteSpace: "nowrap", letterSpacing: 0,
                    }}>
                      {key}
                    </Box>
                    <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.55), whiteSpace: "nowrap" }}>{desc}</Typography>
                  </Stack>
                ))}
              </Box>
            )}

            {/* Toggle button */}
            <Tooltip title={showCameraGuide ? "ガイドを閉じる" : "操作ガイド"} placement="right" arrow>
              <IconButton
                size="small"
                onClick={() => setShowCameraGuide((v) => !v)}
                sx={{
                  pointerEvents: "auto",
                  width: 26, height: 26,
                  background: showCameraGuide
                    ? alpha("#6366f1", 0.35)
                    : alpha("#000", 0.62),
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  border: `1px solid ${alpha("#fff", showCameraGuide ? 0.28 : 0.18)}`,
                  borderRadius: 1,
                  color: alpha("#fff", showCameraGuide ? 1.0 : 0.65),
                  "&:hover": {
                    background: alpha("#6366f1", 0.45),
                    color: "#fff",
                    border: `1px solid ${alpha("#fff", 0.35)}`,
                  },
                  transition: "all 0.15s ease",
                }}
              >
                <KeyboardRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}
