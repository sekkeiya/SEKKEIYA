// src/features/layout/components/Header/components/TopBar.jsx
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Box, Button, Chip, CircularProgress, Tooltip, IconButton, Menu, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import VerticalAlignBottomRoundedIcon from "@mui/icons-material/VerticalAlignBottomRounded";
import VerticalAlignTopRoundedIcon from "@mui/icons-material/VerticalAlignTopRounded";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";
import AlignHorizontalLeftRoundedIcon from "@mui/icons-material/AlignHorizontalLeftRounded";
import AlignHorizontalRightRoundedIcon from "@mui/icons-material/AlignHorizontalRightRounded";
import AlignHorizontalCenterRoundedIcon from "@mui/icons-material/AlignHorizontalCenterRounded";
import AlignVerticalCenterRoundedIcon from "@mui/icons-material/AlignVerticalCenterRounded";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import { useAppStore } from "@desktop/store/useAppStore";
import { useWorkspaceLayouts } from "@desktop/features/dsl/layout/hooks/useWorkspaces";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useAutoLayoutStore } from "@desktop/features/dsl/layout/store/useAutoLayoutStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import FindReplaceRoundedIcon from "@mui/icons-material/FindReplaceRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";


import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { keyframes } from "@mui/material/styles";

import CommandBar from "@desktop/features/dsl/layout/canvas/toolbar/CommandBar.jsx";
import ModeToolbar from "./toolbars/ModeToolbar.jsx";
import SelectionScopeButtons from "./toolbars/SelectionScopeButtons.jsx";

import ConfirmDialog from "./ConfirmDialog";
import { useUiRightSidebarStore } from "@desktop/features/dsl/layout/store/uiRightSidebarStore";



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
  onClickPreview,
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

  const { layouts, loading: layoutsLoading } = useWorkspaceLayouts();
  
  const layoutPillLabel = React.useMemo(() => {
    if (!selectedLayoutId) return "No Layout";
    const current = layouts?.find((l) => l.id === selectedLayoutId);
    return current?.name || "Unknown Layout";
  }, [layouts, selectedLayoutId]);

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

  const openConfigDialog = useAutoLayoutStore((s) => s.openConfigDialog);

  const handleAutoLayout = useCallback(() => {
    if (selectedZoneIds.length === 0) {
      setAlertInfo({ open: true, message: "ゾーンを1つ以上選択してください" });
      return;
    }
    openConfigDialog(selectedZoneIds);
  }, [selectedZoneIds, openConfigDialog]);

  const requestAlign = useViewportUiStore((s) => s.requestAlign);
  const [rotateMenuAnchor, setRotateMenuAnchor] = useState(null);
  
  const autoLayoutMode = useAutoLayoutStore((s) => s.autoLayoutMode);
  const setAutoLayoutMode = useAutoLayoutStore((s) => s.setAutoLayoutMode);
  const [autoLayoutMenuAnchor, setAutoLayoutMenuAnchor] = useState(null);

  const openSwapDialog = useAutoLayoutStore((s) => s.openSwapDialog);
  const hasPlacedItems = useMemo(() => layoutItems.length > 0, [layoutItems]);

  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);

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

  const statusLabel = saving ? "Saving..." : dirty ? "◁EUnsaved" : "Saved";

  const shine = useMemo(
    () =>
      keyframes`
        0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
        15% { opacity: 0.55; }
        45% { opacity: 0.25; }
        100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
      `,
    []
  );

  const openPreviewByCurrentUrl = useCallback(() => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }, []);

  const handlePreview = useCallback(() => {
    if (typeof onClickPreview === "function") return onClickPreview();
    openPreviewByCurrentUrl();
  }, [onClickPreview, openPreviewByCurrentUrl]);

  const previewBtnSx = {
    position: "relative",
    overflow: "hidden",
    height: 28,
    borderRadius: 999,
    px: 1.1,
    gap: 0.6,
    textTransform: "none",
    fontWeight: 950,
    letterSpacing: 0.2,
    color: alpha(theme.palette.common.white, 0.92),
    background: `linear-gradient(180deg, ${alpha("#ffffff", 0.11)} 0%, ${alpha("#ffffff", 0.06)} 55%, ${alpha("#000000", 0.08)} 100%)`,
    border: `1px solid ${alpha("#fff", 0.16)}`,
    boxShadow: `0 10px 20px ${alpha("#000", 0.28)}, inset 0 1px 0 ${alpha("#fff", 0.14)}`,
    "&::before": {
      content: '""',
      position: "absolute",
      inset: -2,
      borderRadius: 999,
      background: `radial-gradient(120px 42px at 30% 20%, ${alpha(theme.palette.primary.main, 0.35)} 0%, transparent 60%)`,
      opacity: 0.9,
      pointerEvents: "none",
    },
    "&::after": {
      content: '""',
      position: "absolute",
      left: 10,
      right: 10,
      top: 4,
      height: 1,
      borderRadius: 999,
      background: alpha("#fff", 0.14),
      pointerEvents: "none",
    },
    "& .MuiButton-startIcon, & .MuiButton-endIcon": { margin: 0 },
    "&:hover": {
      transform: "translateY(-0.5px)",
      borderColor: alpha("#fff", 0.22),
      background: `linear-gradient(180deg, ${alpha("#ffffff", 0.14)} 0%, ${alpha("#ffffff", 0.07)} 55%, ${alpha("#000000", 0.10)} 100%)`,
      boxShadow: `0 14px 26px ${alpha("#000", 0.34)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, inset 0 1px 0 ${alpha("#fff", 0.16)}`,
    },
    "&:active": {
      transform: "translateY(0px)",
      boxShadow: `0 8px 16px ${alpha("#000", 0.30)}, inset 0 1px 0 ${alpha("#fff", 0.10)}`,
    },
  };

  const previewShineSx = {
    position: "absolute",
    top: -10,
    left: -40,
    width: 60,
    height: 60,
    background: `linear-gradient(90deg, transparent 0%, ${alpha("#fff", 0.30)} 45%, transparent 100%)`,
    filter: "blur(0.4px)",
    opacity: 0,
    pointerEvents: "none",
  };

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
            onClick={() => setPanelSelection("layout", null)}
            sx={{
              color: "rgba(255,255,255,0.5)",
              minWidth: "auto",
              px: 1,
              textTransform: "none",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 1.5,
              "&:hover": {
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.06)",
              },
            }}
          >
            Exit
          </Button>
        </Box>

        {/* Row 1 RIGHT: Context Controls (Base/Plan/Option, Save, Preview) */}
        <Box sx={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 0.8, flexWrap: "nowrap" }}>
          
          {selectedLayoutId ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flexWrap: "nowrap" }}>
              <Button
                size="small"
                sx={{
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontWeight: 700,
                  color: alpha("#fff", 0.82),
                  bgcolor: alpha("#fff", 0.05),
                  border: `1px solid ${alpha("#fff", 0.12)}`,
                  px: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 100,
                  maxWidth: 200,
                }}
              >
                {layoutsLoading ? "Loading..." : layoutPillLabel}
              </Button>

              <Chip 
                sx={{
                  height: 24, fontSize: 12, fontWeight: 700,
                  bgcolor: saving ? alpha("#fff", 0.12) : dirty ? alpha("#ff9800", 0.2) : alpha("#4caf50", 0.15),
                  color: saving ? "#fff" : dirty ? "#ff9800" : "#4caf50",
                  border: `1px solid ${saving ? alpha("#fff", 0.2) : dirty ? alpha("#ff9800", 0.4) : alpha("#4caf50", 0.3)}`,
                }} 
                label={saving ? "Saving..." : dirty ? "◁EUnsaved" : "Saved"} 
              />
            </Box>
          ) : null}

          {/* RIGHT ACTIONS INJECTED FROM PARENT (if any) */}
          {rightActions && selectedLayoutId ? (
            <Box sx={{ ml: 0.5, display: "flex", alignItems: "center" }}>{rightActions}</Box>
          ) : null}

          <Box sx={{ width: "1px", height: 18, bgcolor: alpha(theme.palette.common.white, 0.08), mx: 0.5 }} />

          {/* Preview Button */}
          <Tooltip title="共有前に “閲覧者と同じ画面” を別タブで確認（?preview=1）">
            <Button
              onClick={handlePreview}
              startIcon={<VisibilityRoundedIcon fontSize="small" sx={{ opacity: 0.88 }} />}
              endIcon={<OpenInNewRoundedIcon fontSize="small" sx={{ opacity: 0.88 }} />}
              sx={previewBtnSx}
            >
              <Box
                sx={{
                  ...previewShineSx,
                  animation: `${shine} 1.9s ease-in-out infinite`,
                }}
              />
              <Typography component="span" sx={{ fontSize: 12.5, lineHeight: 1, mt: "1px" }}>
                Preview
              </Typography>
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
        background: alpha("#050815", 0.72), 
        px: 1, 
        borderRadius: 1,
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`
      }}>
        {/* Row 2 LEFT: Selection Scope + Command Input */}
        <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.75 }}>
          <SelectionScopeButtons />
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
            background: alpha("#0b1022", 0.98),
            border: `1px solid ${alpha("#fff", 0.10)}`,
            color: "#fff",
            minWidth: 320,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>確認</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: alpha("#fff", 0.72), fontSize: 14 }}>
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
