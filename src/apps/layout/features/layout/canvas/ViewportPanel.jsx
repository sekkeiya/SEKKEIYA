// src/features/layout/components/MainArea/ViewportPanel.jsx
import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { Box, Typography, Stack, Button, Tooltip, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

// ✅ Canvas extracted
import MultiViewportTiled from "@layout/features/layout/canvas/MultiViewportTiled.jsx";

// ✅ Toolbar
import ViewportToolbar from "./ViewportToolbar.jsx";

// ✅ Stores
import { useUiSelectionStore } from "@layout/features/layout/store/uiSelectionStore";
import { useToolsStore } from "@layout/features/layout/store/toolsStore/useToolsStore";
import { useViewportUiStore } from "@layout/features/layout/store/viewportUiStore";
import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

// ✅ speed enums (MultiViewportTiled に渡す互換)
import { SPEED_MODES } from "./menu/MoveSpeedDock.jsx";

import { buildCopyPayload } from "@layout/features/layout/commands/copyOps";

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
  onUploadBaseFiles,
  onOpenBaseBuilder,

  baseDoc,
  baseDocLoading,
  baseGlbUrlResolved,

  layoutDraft = null,
  onChangeLayoutDraft,
  onMarkDirty,

  onPickMaterial,

  onBeginHistoryBatch,
  onEndHistoryBatch,
  onCancelHistoryBatch,
}) {
  const theme = useTheme();
  const [numericCloseTick, setNumericCloseTick] = useState(0);

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
  const isBaseSelected = useMemo(() => !!baseId, [baseId]);
  const isBaseRenderable = !!baseGlbUrlResolved;

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

  // =========================
  // ✅ Copy（複製）
  // - “実体(items)” も必ず id を持つようにしてからコピー
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

      const json = e.dataTransfer?.getData("application/json");
      if (!json) return;

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

      openCommand({
        axis: a,
        label: `${m} ${a ?? ""} / ${sp}`,
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
   * ✅ 追加：Gizmo 矢印ホバーが外れたら “数値入力バー” を閉じて通常コマンドへ戻す
   */
  const lastHoverAxisRef = useRef(null);
  const handleGizmoHoverAxisChange = useCallback(
    (axis) => {
      const next = axis ?? null;
      const prev = lastHoverAxisRef.current;
      lastHoverAxisRef.current = next;

      if (prev && !next) {
        closeCommand();
        setNumericCloseTick((t) => t + 1);
      }
    },
    [closeCommand]
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
    if (!baseId) return true;
    if (baseDocLoading) return true;
    if (optionDocLoading) return true;
    if (!baseGlbUrlResolved) return true;
    return false;
  }, [baseId, baseDocLoading, optionDocLoading, baseGlbUrlResolved]);

  const [overlayVisible, setOverlayVisible] = useState(false);
  useEffect(() => {
    let t = null;
    if (shouldShowOverlayRaw) t = window.setTimeout(() => setOverlayVisible(true), 150);
    else setOverlayVisible(false);
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [shouldShowOverlayRaw]);

  const showEmptyGuide = !overlayVisible && !baseId && !baseDocLoading;
  const showMissingGlbGuide = !overlayVisible && !!baseId && !baseDocLoading && !baseGlbUrlResolved;

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
      // ✅ 2D 配置モード中は TOP を維持（vp_persp に戻さない）
      const is2D = useEditorModeStore.getState().editorMode === EDITOR_MODES.LAYOUT_2D;
      const homeId = is2D ? "vp_top" : "vp_persp";
      if (st.activeViewportId !== homeId) st.setActiveViewportId?.(homeId);
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
      <Box
        sx={{
          flex: "0 0 auto",
          px: 1,
          py: 1,
          borderBottom: `1px solid ${alpha("#fff", 0.08)}`,
          background: alpha("#000", 0.12),
        }}
      >
        <ViewportToolbar variant="inline" dense />
      </Box>

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
          onBeginHistoryBatch={onBeginHistoryBatch}
          onEndHistoryBatch={onEndHistoryBatch}
          onCancelHistoryBatch={onCancelHistoryBatch}
        />

        <input ref={uploadInputRef} type="file" accept=".glb,.3dm" hidden multiple={false} onChange={handleUploadFileChange} />

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

        {(showEmptyGuide || showMissingGlbGuide) && (
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <Box sx={{ textAlign: "center", px: 2, width: "min(860px, 92%)", pointerEvents: "auto" }}>
              {showEmptyGuide ? (
                <>
                  <Typography sx={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>躯体（Base）が未設定です</Typography>
                  <Typography sx={{ mt: 1, opacity: 0.75, fontSize: 12 }}>
                    まずは「選択 / アップロード / 作成」で躯体を設定してください。
                  </Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>躯体は選択済みですが、GLB が見つかりません</Typography>
                  <Typography sx={{ mt: 1, opacity: 0.75, fontSize: 12 }}>
                    baseDoc の asset.glbUrl（または glbPath）が未設定、もしくは URL 解決に失敗しています。「選択 / アップロード /
                    作成」から GLB を設定してください。
                  </Typography>
                </>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Tooltip title={!isBaseSelected ? "先にTopBarでBaseを作成してください" : "S.Modelから躯体（建物本体）を選択"}>
                  <span>
                    <Button variant="outlined" size="small" sx={btnSx} disabled={!isBaseSelected} onClick={() => onOpenSelectBase?.()}>
                      躯体を選択（S.Model）
                    </Button>
                  </span>
                </Tooltip>

                <Tooltip title={!isBaseSelected ? "先にTopBarでBaseを作成してください" : "PCから躯体ファイル（.glb/.3dm）をアップロード"}>
                  <span>
                    <Button variant="outlined" size="small" sx={btnSx} disabled={!isBaseSelected} onClick={handleClickUpload}>
                      躯体をアップロード
                    </Button>
                  </span>
                </Tooltip>

                <Tooltip title={!isBaseSelected ? "先にTopBarでBaseを作成してください" : "簡易躯体作成（MVP）"}>
                  <span>
                    <Button variant="outlined" size="small" sx={btnSx} disabled={!isBaseSelected} onClick={() => onOpenBaseBuilder?.()}>
                      躯体を作成
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
