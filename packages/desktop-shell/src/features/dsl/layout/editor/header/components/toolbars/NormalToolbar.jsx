// src/features/layout/components/MainArea/components/ViewportToolbar.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Stack, Divider, IconButton, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";



// ToolButtons previously from Header
import MaterialPickerButton from "../ToolButtons/MaterialPickerButton";
import FurnitureDimensionButton from "../ToolButtons/FurnitureDimensionButton";
import MoveButton from "../ToolButtons/MoveButton";
import RotateButton from "../ToolButtons/RotateButton";
import ScaleButton from "../ToolButtons/ScaleButton";
import WorldButton from "../ToolButtons/WorldButton";
import LocalButton from "../ToolButtons/LocalButton";
import SnapButton from "../ToolButtons/SnapButton";
import WalkthroughButton from "../ToolButtons/WalkthroughButton";
import ToolDivider from "../ToolButtons/ToolDivider";

// ✁Eicons�E�揃えて使ぁE��E
import VerticalAlignTopRoundedIcon from "@mui/icons-material/VerticalAlignTopRounded";
import VerticalAlignBottomRoundedIcon from "@mui/icons-material/VerticalAlignBottomRounded";
import AlignHorizontalLeftRoundedIcon from "@mui/icons-material/AlignHorizontalLeftRounded";
import AlignHorizontalRightRoundedIcon from "@mui/icons-material/AlignHorizontalRightRounded";
import AlignHorizontalCenterRoundedIcon from "@mui/icons-material/AlignHorizontalCenterRounded";
import AlignVerticalCenterRoundedIcon from "@mui/icons-material/AlignVerticalCenterRounded";

import GroupWorkRoundedIcon from "@mui/icons-material/GroupWorkRounded";
import GroupOffRoundedIcon from "@mui/icons-material/GroupOffRounded";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";

// ✁EView switch icons
import CropSquareRoundedIcon from "@mui/icons-material/CropSquareRounded";
import VerticalSplitRoundedIcon from "@mui/icons-material/VerticalSplitRounded";
import ViewQuiltRoundedIcon from "@mui/icons-material/ViewQuiltRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import ThreeDRotationRoundedIcon from "@mui/icons-material/ThreeDRotationRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import ViewComfyRoundedIcon from "@mui/icons-material/ViewComfyRounded";

// ✁Estore
import { useViewportUiStore, VIEWPORT_IDS, VIEWPORT_LAYOUT } from "../../../../store/viewportUiStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";

export default function NormalToolbar({ variant = "inline", dense = true }) {
  const theme = useTheme();
  // =========================
  // ✁EViewport UI store
  // =========================
  const layoutMode = useViewportUiStore((s) => s.layoutMode);
  const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);

  const activeViewportId = useViewportUiStore((s) => s.activeViewportId);
  const setActiveViewportId = useViewportUiStore((s) => s.setActiveViewportId);


  // ✁EAlign (tick/event)
  const requestAlign = useViewportUiStore((s) => s.requestAlign);

  const requestGroup = useViewportUiStore((s) => s.requestGroup);
  const requestUngroup = useViewportUiStore((s) => s.requestUngroup);
  const requestFocus = useViewportUiStore((s) => s.requestFocusCommand);
  const requestFrameAll = useViewportUiStore((s) => s.requestFrameAllCommand);

  // =========================
  // ✁Ehandlers
  // =========================
  const onAlign = useCallback(
    (key) => {
      // ✁EviewportId を指定しなぁE
      requestAlign(key);
    },
    [requestAlign]
  );

  const onGroup = useCallback(() => requestGroup(), [requestGroup]);
  const onUngroup = useCallback(() => requestUngroup(), [requestUngroup]);
  const onFocus = useCallback(() => requestFocus(), [requestFocus]);
  const onFrameAll = useCallback(() => requestFrameAll(), [requestFrameAll]);

  // ✁Elayout刁E���E�EINGLE / SPLIT のみ�E�E
  const onSetSingle = useCallback(() => setLayoutMode(VIEWPORT_LAYOUT.SINGLE), [setLayoutMode]);
  const onSetSplit = useCallback(() => setLayoutMode(VIEWPORT_LAYOUT.SPLIT), [setLayoutMode]);
  const onSetTriple = useCallback(() => setLayoutMode(VIEWPORT_LAYOUT.TRIPLE), [setLayoutMode]);
  const onSetQuad = useCallback(() => setLayoutMode(VIEWPORT_LAYOUT.QUAD), [setLayoutMode]);

  // ✁ESINGLE時�E view 刁E���E�Eersp/Top/Front/Right�E�E
  const onSetView = useCallback(
    (id) => {
      setActiveViewportId(id);
    },
    [setActiveViewportId]
  );

  // =========================
  // ✁Estyles
  // =========================
  const rootSx = useMemo(() => {
    const isOverlay = variant === "overlay";
    return {
      ...(isOverlay
        ? { position: "absolute", top: 10, left: 10, right: 10, zIndex: 20 }
        : { position: "relative", zIndex: 5, width: "100%" }),
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "nowrap",
      overflowX: "auto",
      "&::-webkit-scrollbar": { display: "none" },
      scrollbarWidth: "none",
      gap: 1,
    };
  }, [variant]);

  const panelSx = useMemo(
    () => ({
      px: dense ? 1 : 1.25,
      py: dense ? 0.75 : 0.9,
      display: "flex",
      alignItems: "center",
      flexWrap: "nowrap",
      gap: 1,
      background: "color-mix(in srgb, var(--brand-bg) 72%, transparent)",
      backdropFilter: "blur(12px)",
      boxShadow: `0 10px 30px ${alpha("#000", 0.45)}`,
      minHeight: dense ? 40 : 44,
      height: 30,
    }),
    [dense]
  );

  const iconBtnSx = useMemo(
    () => ({
      p: dense ? 0.6 : 0.75,
      borderRadius: 0.9,
      color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)",
      border: `1px solid ${alpha("#fff", 0.12)}`,
      bgcolor: alpha("#fff", 0.03),
      "&:hover": {
        bgcolor: alpha("#fff", 0.07),
        borderColor: alpha("#fff", 0.22),
      },
    }),
    [dense]
  );

  const iconBtnActiveSx = useMemo(
    () => ({
      ...iconBtnSx,
      bgcolor: alpha(theme.palette.primary.main, 0.85),
      borderColor: theme.palette.primary.main,
      color: "var(--brand-fg)",
      boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}`,
    }),
    [iconBtnSx, theme.palette.primary.main]
  );

  const mkBtn = (title, onClick, Icon, active = false) => (
    <Tooltip title={title} arrow>
      <IconButton size="small" sx={active ? iconBtnActiveSx : iconBtnSx} onClick={onClick}>
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  const isSingle = layoutMode === VIEWPORT_LAYOUT.SINGLE;
  const isSplit = layoutMode === VIEWPORT_LAYOUT.SPLIT;
  const isTriple = layoutMode === VIEWPORT_LAYOUT.TRIPLE;
  const isQuad = layoutMode === VIEWPORT_LAYOUT.QUAD;

  const viewBtnsDisabled = !isSingle; // ✁ESINGLEのときだぁEview 刁E��UIを有効にする


  return (
    <Box sx={rootSx}>
      {/* LEFT */}
      <Box sx={panelSx}>
        <Stack direction="row" spacing={1} alignItems="center">



          {/* Edit Tools (Transform, Snapping) */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <MaterialPickerButton />
            <ToolDivider />
            <MoveButton />
            <RotateButton />
            <ScaleButton />
            <ToolDivider />
            <WorldButton />
            <LocalButton />
            <ToolDivider />
            <SnapButton />
            <ToolDivider />
            <WalkthroughButton />
            <ToolDivider />
            <FurnitureDimensionButton />
          </Stack>

          <Divider flexItem orientation="vertical" />

          {/* ✁ELayout buttons�E�EINGLE / SPLIT�E�E*/}
          <Stack direction="row" spacing={0.5} alignItems="center">
            {mkBtn("Layout: Single", onSetSingle, CropSquareRoundedIcon, isSingle)}
            {mkBtn("Layout: Split", onSetSplit, VerticalSplitRoundedIcon, isSplit)}
            {mkBtn("Layout: Triple", onSetTriple, ViewQuiltRoundedIcon, isTriple)}
            {mkBtn("Layout: Quad", onSetQuad, WindowRoundedIcon, isQuad)}
          </Stack>

          <Divider flexItem orientation="vertical" />

          {/* ✁ESINGLE時：View刁E���E�Eersp/Top/Front/Right�E�E*/}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: viewBtnsDisabled ? 0.45 : 1 }}>
            {mkBtn(
              "View: Perspective (1)",
              () => onSetView(VIEWPORT_IDS.PERSP),
              ThreeDRotationRoundedIcon,
              isSingle && activeViewportId === VIEWPORT_IDS.PERSP
            )}
            {mkBtn(
              "View: Top (2)",
              () => onSetView(VIEWPORT_IDS.TOP),
              ViewModuleRoundedIcon,
              isSingle && activeViewportId === VIEWPORT_IDS.TOP
            )}
            {mkBtn(
              "View: Front (3)",
              () => onSetView(VIEWPORT_IDS.FRONT),
              ViewInArRoundedIcon,
              isSingle && activeViewportId === VIEWPORT_IDS.FRONT
            )}
            {mkBtn(
              "View: Right (4)",
              () => onSetView(VIEWPORT_IDS.RIGHT),
              ViewComfyRoundedIcon,
              isSingle && activeViewportId === VIEWPORT_IDS.RIGHT
            )}
          </Stack>
        </Stack>
      </Box>

      {/* RIGHT */}
      <Box sx={panelSx}>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* ✁EAlign */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            {mkBtn("Align Top (AT)", () => onAlign("AT"), VerticalAlignTopRoundedIcon)}
            {mkBtn("Align Bottom (AB)", () => onAlign("AB"), VerticalAlignBottomRoundedIcon)}
            {mkBtn("Align Left (AL)", () => onAlign("AL"), AlignHorizontalLeftRoundedIcon)}
            {mkBtn("Align Right (AR)", () => onAlign("AR"), AlignHorizontalRightRoundedIcon)}
            {mkBtn("Align Horizontal Center (AH)", () => onAlign("AH"), AlignHorizontalCenterRoundedIcon)}
            {mkBtn("Align Vertical Center (AV)", () => onAlign("AV"), AlignVerticalCenterRoundedIcon)}
          </Stack>

          <Divider flexItem orientation="vertical" />

          {/* ✁EGroup */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            {mkBtn("Group", onGroup, GroupWorkRoundedIcon)}
            {mkBtn("Ungroup", onUngroup, GroupOffRoundedIcon)}
          </Stack>

          <Divider flexItem orientation="vertical" />

          {/* ✁EFocus / FrameAll */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            {mkBtn("Focus", onFocus, CenterFocusStrongRoundedIcon)}
            {mkBtn("Frame All", onFrameAll, CropFreeRoundedIcon)}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
