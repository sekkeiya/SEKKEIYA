// src/features/layout/components/Header/components/TopBar.jsx
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Box, Button, Chip, CircularProgress, Tooltip, IconButton, Menu, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import FileOpenRoundedIcon from "@mui/icons-material/FileOpenRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";

import VerticalAlignBottomRoundedIcon from "@mui/icons-material/VerticalAlignBottomRounded";
import VerticalAlignTopRoundedIcon from "@mui/icons-material/VerticalAlignTopRounded";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";
import AlignHorizontalLeftRoundedIcon from "@mui/icons-material/AlignHorizontalLeftRounded";
import AlignHorizontalRightRoundedIcon from "@mui/icons-material/AlignHorizontalRightRounded";
import AlignHorizontalCenterRoundedIcon from "@mui/icons-material/AlignHorizontalCenterRounded";
import AlignVerticalCenterRoundedIcon from "@mui/icons-material/AlignVerticalCenterRounded";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import { useAppStore } from "../../../../../../store/useAppStore";
import { useWorkspaceStructureStore } from "../../../store/useWorkspaceStructureStore";
import { useViewportUiStore } from "../../../store/viewportUiStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useZoningStore } from "../../../store/useZoningStore";
import { useAutoLayoutStore } from "../../../store/useAutoLayoutStore";
import { useLayoutTaskStore } from "../../../store/useLayoutTaskStore";
import { useSelectionScopeStore, canSelectItem, canSelectZone } from "../../../store/useSelectionScopeStore";
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useStructureLabelStore } from "../../../store/useStructureLabelStore";
import { enumerateStructureFaces } from "../../../canvas/tools/structure/enumerateStructureFaces";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import FindReplaceRoundedIcon from "@mui/icons-material/FindReplaceRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";


import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import CommandBar from "../../../canvas/toolbar/CommandBar.jsx";
import ModeToolbar from "./toolbars/ModeToolbar.jsx";
import SelectionScopeButtons from "./toolbars/SelectionScopeButtons.jsx";
import SymbolVisibilityToggle from "./toolbars/SymbolVisibilityToggle.jsx";
import ViewGroupToggle from "./toolbars/ViewGroupToggle.jsx";
import StructureBreadcrumb from "./StructureBreadcrumb.jsx";

import ConfirmDialog from "./ConfirmDialog";
import { useUiRightSidebarStore } from "../../../store/uiRightSidebarStore";



// ===== 表示ヘルパ！EopBarのピル用だけ残す�E�E====
function numToAlpha(n) {
  let x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "A";
  let s = "";
  while (x > 0) {
    x -= 1;
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s;
}
function displayBaseNameByIndex(i0) {
  return `Base-${numToAlpha(i0 + 1)}`;
}
function displayPlanNameByIndex(i0) {
  return `Plan-${numToAlpha(i0 + 1)}`;
}
function displayOptionNameByIndex(i0) {
  return `A-${i0 + 1}`;
}

/**
 * ✁ETopBar は workspace structure めEStore から読む�E�Erops地獁E��断つ�E�E
 * ✁Eselector を「�E割」して getSnapshot 警告を回避
 */
export default function TopBar({
  // 表示だぁEprops に残す
  boardId, // 現状未使用だが親から来るなら残してOK�E�忁E��なければ外してOK�E�E
  meta, // 同丁E
  loadingMeta,

  // 右側に差し込み
  rightActions,

  // Save
  dirty = false,
  saving = false,
  onSave,
  layoutItems = [],
  onClickProductionPreview,
  onClickShare,
  onClickImportBase,
  onClickImportUnderlay,
}) {
  const theme = useTheme();

  // =========================
  // Zustand selectors (最小限)
  // =========================

  const selectedLayoutId = useAppStore((s) => {
    const sel = s.panelSelections["layout"];
    return sel?.selectedLayoutId || sel?.optionId || sel?.planId || null;
  });

  const setPanelSelection = useAppStore((s) => s.setPanelSelection);

  // レイアウト名ピルは廃止（左のパンくずが Base › Plan › Option を表示するため冗長）。

  const mode = useEditorModeStore((s) => s.editorMode);
  const setMode = useEditorModeStore((s) => s.setEditorMode);
  const setLayoutSubMode = useEditorModeStore((s) => s.setLayoutSubMode);
  const setLayoutCameraTilt = useEditorModeStore((s) => s.setLayoutCameraTilt);
  const rotateStepDeg = useEditorModeStore((s) => s.rotateStepDeg);
  const setRotateStepDeg = useEditorModeStore((s) => s.setRotateStepDeg);

  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const circulationType = useZoningStore((s) => s.circulationType);
  const circulationWidths = useZoningStore((s) => s.circulationWidths);

  const isGenerating = useAutoLayoutStore((s) => s.isGenerating);
  const requestAutoLayout = useAutoLayoutStore((s) => s.requestAutoLayout);

  const selectedZoneIds = useLayoutTaskStore((s) => s.selectedZoneIds);
  const zones = useLayoutTaskStore((s) => s.zones);
  const hasZones = zones.length > 0;

  const activeZone = useMemo(() => zones.find(z => z.id === null), [zones]);

  const setViewportDisplayMode = useViewportUiStore((s) => s.setViewportDisplayMode);
  const activeViewportId = useViewportUiStore((s) => s.activeViewportId);

  const [alertInfo, setAlertInfo] = useState({ open: false, message: "" });
  const closeAlert = () => setAlertInfo({ open: false, message: "" });

  const handleAutoLayout = useCallback(() => {
    const ids = selectedZoneIds.length > 0
      ? selectedZoneIds
      : zones.length > 0
        ? zones.map(z => z.id)
        : ['__full_room__'];
    requestAutoLayout(ids);
  }, [selectedZoneIds, zones, requestAutoLayout]);

  const requestAlign = useViewportUiStore((s) => s.requestAlign);
  const [rotateMenuAnchor, setRotateMenuAnchor] = useState(null);
  
  const autoLayoutMode = useAutoLayoutStore((s) => s.autoLayoutMode);
  const setAutoLayoutMode = useAutoLayoutStore((s) => s.setAutoLayoutMode);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);

  const openSwapDialog = useAutoLayoutStore((s) => s.openSwapDialog);
  const hasPlacedItems = useMemo(() => layoutItems.length > 0, [layoutItems]);

  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);

  // インポートメニュー。下絵（PDF/画像）は Base か Plan に紐づけて取り込む。
  // Option は親 Plan / Base の下絵を引き継ぐだけなので取り込み不可。
  const [importMenuAnchor, setImportMenuAnchor] = useState(null);
  const canImportUnderlay = useWorkspaceStructureStore(
    (s) => !!s.selectedBaseId && !s.selectedOptionId
  );

  // Removed mode-based right panel switching to allow consistent dock layout across all modes

  // Ctrl+S 保孁E
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (!metaOrCtrl) return;
      if (e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (typeof onSave === "function" && !saving) onSave();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, saving]);

  // Ctrl/Cmd + A — 現在のスコープで選択できるものをすべて選択
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (!metaOrCtrl) return;
      if (e.key.toLowerCase() !== "a") return;

      // テキスト入力中は通常の全選択を優先（横取りしない）
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;

      e.preventDefault();

      const scope = useSelectionScopeStore.getState().scope;
      const modeState = useEditorModeStore.getState();
      // ウォークスルー中は対象外
      if (modeState.editorMode === "walkthrough") return;

      // Base 編集中（躯体）：床・壁・天井の面をすべて選択する。
      if (modeState.structureTagging) {
        const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
        const faces = enumerateStructureFaces(colliders);
        // 列挙は「内向き面」のみのため、自動ラベル等で付いた外壁などが漏れる。
        // 既にラベルのある面は必ず選択に含める（key でマージ）。
        const byKey = new Map(faces.map((f) => [f.key, f]));
        const labels = useStructureLabelStore.getState().labels || {};
        for (const k of Object.keys(labels)) {
          if (byKey.has(k)) continue;
          const l = labels[k];
          if (!l?.surface) continue;
          byKey.set(k, {
            key: k,
            surface: l.surface,
            normalY: Array.isArray(l.surface.normal) ? l.surface.normal[1] : 1,
            autoSemantic: l.semantic,
          });
        }
        const all = Array.from(byKey.values());
        useStructureLabelStore.getState().selectMany(all);
        if (all.length) setRightPanel("properties", true);
        return;
      }

      if (canSelectItem(scope)) {
        const ids = (layoutItems || []).map((it) => it?.id).filter(Boolean);
        useUiSelectionStore.getState().setSelectedItemIds(ids);
      }
      if (canSelectZone(scope)) {
        const zoneIds = (useLayoutTaskStore.getState().zones || []).map((z) => z?.id).filter(Boolean);
        useLayoutTaskStore.getState().setSelectedZoneIds(zoneIds);
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layoutItems]);

  // F — 選択しているものすべてが収まるようにフォーカス（フレーミング）
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== "f") return;

      // テキスト入力中・コマンド入力中は横取りしない
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;

      if (useEditorModeStore.getState().editorMode === "walkthrough") return;

      e.preventDefault();
      useViewportUiStore.getState().requestFocus();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // styles
  const line = alpha(theme.palette.common.white, 0.08);
  const fg = alpha("#fff", 0.92);

  const pillBtnSx = {
    height: 30,
    borderRadius: 999,
    px: 1.1,
    minWidth: 0,
    fontWeight: 900,
    textTransform: "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
    color: fg,
    background: alpha("#fff", 0.06),
    border: `1px solid ${alpha("#fff", 0.12)}`,
    "&:hover": {
      background: alpha("#fff", 0.1),
      borderColor: alpha("#fff", 0.18),
    },
  };

  const pillBtnActiveSx = {
    background: alpha(theme.palette.primary.main, 0.22),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
    "&:hover": {
      background: alpha(theme.palette.primary.main, 0.28),
      borderColor: alpha(theme.palette.primary.main, 0.42),
    },
  };

  const statusChipSx = {
    height: 24,
    borderRadius: 999,
    fontWeight: 900,
    background: dirty ? alpha("#ffcc00", 0.14) : alpha("#00d084", 0.10),
    border: `1px solid ${dirty ? alpha("#ffcc00", 0.35) : alpha("#00d084", 0.25)}`,
    color: fg,
    "& .MuiChip-label": { px: 1.0, fontSize: 12 },
  };

  const statusLabel = saving ? "Saving..." : dirty ? "Unsaved" : "Saved";

  const openPreviewByCurrentUrl = useCallback(() => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }, []);

  const handleProductionPreview = useCallback(() => {
    if (typeof onClickProductionPreview === "function") return onClickProductionPreview();
    openPreviewByCurrentUrl();
  }, [onClickProductionPreview, openPreviewByCurrentUrl]);

  return (
    <Box sx={{ 
      display: "flex", 
      flexDirection: "column", 
      width: "100%", 
      flexShrink: 0, 
      overflow: "hidden" 
    }}>
      {/* === Row 1: Primary (Context) === */}
      <Box sx={{ 
        display: "flex", 
        alignItems: "center", 
        width: "100%", 
        minWidth: 0, 
        overflow: "hidden", 
        justifyContent: "space-between", 
        height: 36 
      }}>
        
        {/* Row 1 LEFT: Exit Button */}
        <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.5 }}>
          <Button
            size="small"
            startIcon={<ArrowBackRoundedIcon fontSize="small" />}
            onClick={() => {
              // Exit＝エディタを抜けて Layout Dashboard へ戻る。
              // panelSelection だけでなく Base/Plan/Option の構造選択も解除する必要があるため、
              // LayoutShell が bindExternal で登録する onGoToDashboard（両方クリア）を呼ぶ。
              useWorkspaceStructureStore.getState().goToDashboard();
              // 外部ハンドラ未登録時のフォールバック（従来挙動）
              setPanelSelection("layout", null);
            }}
            sx={{
              color: "rgb(var(--brand-fg-rgb) / 0.5)",
              minWidth: "auto",
              px: 1,
              textTransform: "none",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 1.5,
              "&:hover": {
                color: "var(--brand-fg)",
                bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)",
              },
            }}
          >
            Exit
          </Button>
        </Box>

        {/* Row 1 CENTER-LEFT: 現在開いている Base / Plan / Option のパンくず */}
        <Box sx={{ flexShrink: 1, display: "flex", alignItems: "center", ml: 1.5, minWidth: 0, overflow: "hidden" }}>
          <StructureBreadcrumb />
        </Box>

        {/* Row 1 RIGHT: Context Controls (Base/Plan/Option, Save, Preview) */}
        <Box sx={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 0.8, flexWrap: "nowrap" }}>
          
          {/* 保存状態（現在のレイアウト）— 共有/プレビューと高さ・角丸を揃える。
              レイアウト名は左のパンくず（Base › Plan › Option）が表示するのでピルは廃止。 */}
          {selectedLayoutId ? (
            <Chip
              size="small"
              sx={{
                height: 28,
                borderRadius: 999,
                fontWeight: 800,
                "& .MuiChip-label": { px: 1.3, fontSize: 12 },
                bgcolor: saving ? alpha("#fff", 0.10) : dirty ? alpha("#ff9800", 0.16) : alpha("#22c55e", 0.14),
                color: saving ? alpha(theme.palette.common.white, 0.9) : dirty ? "#ffb454" : "#4ade80",
                border: `1px solid ${saving ? alpha("#fff", 0.2) : dirty ? alpha("#ff9800", 0.4) : alpha("#22c55e", 0.32)}`,
              }}
              label={saving ? "保存中…" : dirty ? "未保存" : "保存済み"}
            />
          ) : null}

          {/* RIGHT ACTIONS INJECTED FROM PARENT (if any) */}
          {rightActions && selectedLayoutId ? (
            <Box sx={{ display: "flex", alignItems: "center" }}>{rightActions}</Box>
          ) : null}

          {/* Import Button — 躯体（GLB）と下絵（PDF/画像）をメニューで選ぶ */}
          {(typeof onClickImportBase === "function" ||
            typeof onClickImportUnderlay === "function") && (
            <>
              <Tooltip title="インポート：躯体モデル / 下絵（PDF・画像）を読み込む">
                <Button
                  onClick={(e) => setImportMenuAnchor(e.currentTarget)}
                  startIcon={<FileOpenRoundedIcon sx={{ fontSize: 16, opacity: 0.9 }} />}
                  endIcon={<ArrowDropDownRoundedIcon sx={{ fontSize: 18, opacity: 0.9 }} />}
                  sx={{
                    height: 28,
                    borderRadius: 999,
                    px: 1.5,
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: 12.5,
                    letterSpacing: 0.2,
                    boxShadow: "none",
                    color: alpha(theme.palette.common.white, 0.92),
                    bgcolor: alpha("#fff", 0.05),
                    border: `1px solid ${alpha("#fff", 0.18)}`,
                    "& .MuiButton-startIcon": { mr: 0.5, ml: 0 },
                    "& .MuiButton-endIcon": { ml: 0.25, mr: -0.5 },
                    "&:hover": { bgcolor: alpha("#fff", 0.1), borderColor: alpha("#fff", 0.28) },
                  }}
                >
                  インポート
                </Button>
              </Tooltip>
              <Menu
                anchorEl={importMenuAnchor}
                open={Boolean(importMenuAnchor)}
                onClose={() => setImportMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                {typeof onClickImportBase === "function" && (
                  <MenuItem
                    onClick={() => {
                      setImportMenuAnchor(null);
                      onClickImportBase();
                    }}
                    sx={{ gap: 1, fontSize: 13 }}
                  >
                    <ViewInArRoundedIcon sx={{ fontSize: 18, opacity: 0.8 }} />
                    躯体モデル（CAD Files）
                  </MenuItem>
                )}
                {typeof onClickImportUnderlay === "function" && (
                  /* Tooltip は disabled な MenuItem のイベントを拾えないので span で包む。 */
                  <Tooltip
                    title={
                      canImportUnderlay
                        ? "PDF / 画像を床下に敷いてトレースする"
                        : "下絵は Base か Plan に紐づきます。Option では取り込めません（親 Plan / Base の下絵が表示されます）"
                    }
                    placement="left"
                  >
                    <span>
                      <MenuItem
                        disabled={!canImportUnderlay}
                        onClick={() => {
                          setImportMenuAnchor(null);
                          onClickImportUnderlay();
                        }}
                        sx={{ gap: 1, fontSize: 13 }}
                      >
                        <ImageRoundedIcon sx={{ fontSize: 18, opacity: 0.8 }} />
                        下絵（PDF・画像）
                      </MenuItem>
                    </span>
                  </Tooltip>
                )}
              </Menu>
            </>
          )}

          {/* Share Button — ウォークスルーの共有リンクを作成 */}
          {typeof onClickShare === "function" && (
            <Tooltip title="共有：ウォークスルーのリンクを作成">
              <Button
                onClick={onClickShare}
                startIcon={<IosShareRoundedIcon sx={{ fontSize: 16, opacity: 0.9 }} />}
                sx={{
                  height: 28,
                  borderRadius: 999,
                  px: 1.5,
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: 12.5,
                  letterSpacing: 0.2,
                  boxShadow: "none",
                  color: alpha(theme.palette.common.white, 0.92),
                  bgcolor: alpha("#fff", 0.05),
                  border: `1px solid ${alpha("#fff", 0.18)}`,
                  "& .MuiButton-startIcon": { mr: 0.5, ml: 0 },
                  "&:hover": { bgcolor: alpha("#fff", 0.1), borderColor: alpha("#fff", 0.28) },
                }}
              >
                共有
              </Button>
            </Tooltip>
          )}

          {/* Preview Button — 客先向けビューワ（内観ウォークスルー入り）を開く */}
          <Tooltip title="プレビュー：客先向けビューワを開く（内観でウォークスルー）">
            <Button
              onClick={handleProductionPreview}
              startIcon={<VisibilityRoundedIcon sx={{ fontSize: 16, opacity: 0.95 }} />}
              sx={{
                height: 28,
                borderRadius: 999,
                px: 1.6,
                textTransform: "none",
                fontWeight: 850,
                fontSize: 12.5,
                letterSpacing: 0.2,
                color: "#eafff5",
                background: `linear-gradient(180deg, ${alpha("#34d399", 0.95)} 0%, ${alpha("#059669", 0.9)} 100%)`,
                border: `1px solid ${alpha("#34d399", 0.55)}`,
                boxShadow: `0 4px 14px ${alpha("#059669", 0.35)}`,
                "& .MuiButton-startIcon": { mr: 0.5, ml: 0 },
                "&:hover": {
                  background: `linear-gradient(180deg, ${alpha("#34d399", 1)} 0%, ${alpha("#059669", 0.98)} 100%)`,
                  borderColor: alpha("#34d399", 0.7),
                },
              }}
            >
              プレビュー
            </Button>
          </Tooltip>

        </Box>
      </Box>

      {/* === Row 2: Secondary (Command Input + Mode Toolbar) === */}
      <Box sx={{ 
        display: "flex", 
        alignItems: "center", 
        width: "100%", 
        minWidth: 0, 
        overflow: "hidden", 
        height: 40, 
        gap: 1, /* 8px gap */
        background: "color-mix(in srgb, var(--brand-bg) 72%, transparent)", 
        px: 1, 
        borderRadius: 1,
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`
      }}>
        {/* Row 2 LEFT: 2D/3Dグループ ＋ 選択スコープ（グループで絞込）＋ 記号表示 ＋ Command Input */}
        <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.75 }}>
          <ViewGroupToggle />
          <SelectionScopeButtons />
          <SymbolVisibilityToggle />
          <CommandBar />
        </Box>

        {/* Row 2 RIGHT: Mode Toolbar */}
        <Box sx={{ flex: 1, minWidth: 0, overflowX: "auto", display: "flex", alignItems: "center", justifyContent: "flex-end", '& > *': { flexShrink: 0 } }}>
          <ModeToolbar mode={mode} layoutItems={layoutItems} />
        </Box>
      </Box>



      <Dialog
        open={alertInfo.open}
        onClose={closeAlert}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "color-mix(in srgb, var(--brand-surface) 98%, transparent)",
            border: `1px solid ${alpha("#fff", 0.10)}`,
            color: "var(--brand-fg)",
            minWidth: 320,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>確認</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "color-mix(in srgb, var(--brand-fg) 72%, transparent)", fontSize: 14 }}>
            {alertInfo.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={closeAlert}
            variant="contained"
            sx={{
              borderRadius: 999,
              fontWeight: 900,
              background: alpha(theme.palette.primary.main, 0.95),
              "&:hover": { background: theme.palette.primary.main },
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
