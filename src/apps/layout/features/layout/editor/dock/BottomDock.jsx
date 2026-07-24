// src/features/layout/components/BottomBar/BottomDock.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Stack, IconButton, Typography, Tooltip, Divider } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";

import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";

// ✅ Twinmotion式 Right Panels
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded"; // Scene
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"; // Properties
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded"; // Board

// ✅ NEW: Zustand
import { useUiRightSidebarStore } from "@layout/features/layout/store/uiRightSidebarStore";
import { useToolsStore } from "@layout/features/layout/store/toolsStore/useToolsStore";
import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

// ✅ Bottom Panel のモード
// - 2D 配置: モデル/一括配置/マテリアル等は左ドックへ移動したので下部モードは出さない
// - 3D 演出: 出力系（Import/Media/Export）のみ。Materials/Texturesは左ドックへ
const MODES_3D = [
  { key: "import", label: "Import", icon: <DownloadRoundedIcon fontSize="small" /> },
  { key: "media", label: "Media", icon: <MovieCreationRoundedIcon fontSize="small" /> },
  { key: "export", label: "Export", icon: <IosShareRoundedIcon fontSize="small" /> },
];
const MODES_2D = [];

export default function BottomDock({
  mode = "media",
  onChangeMode,

  panelOpen = false,
  onTogglePanelOpen,
  globalPanelWidth = 0,
}) {
  const theme = useTheme();

  // ✅ RightSidebar表示状態（Zustandから直読み）
  const rightPanels = useUiRightSidebarStore((s) => s.rightPanels);
  const toggleRightPanel = useUiRightSidebarStore((s) => s.toggleRightPanel);

  // ✅ 2D/3D モード
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const is2DMode = editorMode === EDITOR_MODES.LAYOUT_2D;
  const MODES = is2DMode ? MODES_2D : MODES_3D;

  // ✅ 2D ステータス表示用
  const snapEnabled = useToolsStore((s) => s.snapEnabled);

  const rootSx = useMemo(
    () => ({
      position: "fixed",
      left: 0,
      right: globalPanelWidth,
      bottom: 0,
      height: 64,
      zIndex: 60,
      display: "grid",
      gridTemplateColumns: "240px 1fr 300px",
      alignItems: "center",
      px: 1.25,
      background: alpha("#070b18", 0.92),
      borderTop: `1px solid ${alpha("#fff", 0.10)}`,
      boxShadow: "0 -10px 40px rgba(0,0,0,0.45)",
      pointerEvents: "auto",
      transition: "right 0.160s ease",
    }),
    [globalPanelWidth]
  );

  const pillBtn = useCallback(
    (active) => ({
      width: 40,
      height: 40,
      borderRadius: 2.25,
      background: active ? alpha(theme.palette.primary.main, 0.20) : "transparent",
      border: `1px solid ${
        active ? alpha(theme.palette.primary.main, 0.35) : alpha("#fff", 0.10)
      }`,
      color: active ? alpha("#fff", 0.96) : alpha("#fff", 0.82),
      "&:hover": { background: alpha("#fff", 0.06) },
    }),
    [theme.palette.primary.main]
  );

  const tiny = { fontSize: 11, opacity: 0.78 };

  const handleClickMode = useCallback(
    (nextMode) => {
      if (nextMode === mode) {
        onTogglePanelOpen?.();
        return;
      }
      onChangeMode?.(nextMode);
      if (!panelOpen) onTogglePanelOpen?.();
    },
    [mode, onChangeMode, onTogglePanelOpen, panelOpen]
  );

  const isLibraryOn = !!rightPanels?.library;

  const isSceneOn = !!rightPanels?.scene;
  const isPropsOn = !!rightPanels?.properties;
  const isBoardOn = !!rightPanels?.board;

  return (
    <Box sx={rootSx}>
      {/* Left（2D: ステータス表示） */}
      <Stack direction="row" spacing={1.5} alignItems="center">
        {is2DMode ? (
          <>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: alpha("#fff", 0.55) }}>
              2D 配置モード — TOPビュー
            </Typography>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 800,
                color: snapEnabled ? alpha("#ffb74d", 0.9) : alpha("#fff", 0.4),
              }}
            >
              スナップ {snapEnabled ? "ON" : "OFF"}
            </Typography>
          </>
        ) : null}
      </Stack>

      {/* Center */}
      <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
        {MODES.map((m) => {
          const active = m.key === mode;
          const tip = active ? (panelOpen ? "Click to close" : `Open ${m.label}`) : `Open ${m.label}`;

          return (
            <Tooltip key={m.key} title={tip}>
              <IconButton onClick={() => handleClickMode(m.key)} sx={pillBtn(active && panelOpen)}>
                {m.icon}
              </IconButton>
            </Tooltip>
          );
        })}
      </Stack>

      {/* Right */}
      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
        <Tooltip title="Library（S.Modelモデル）">
          <IconButton onClick={() => toggleRightPanel("library")} sx={pillBtn(isLibraryOn)}>
            <FolderOpenRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Scene（アウトライナー）">
          <IconButton onClick={() => toggleRightPanel("scene")} sx={pillBtn(isSceneOn)}>
            <AccountTreeRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Properties（Ambience等）">
          <IconButton onClick={() => toggleRightPanel("properties")} sx={pillBtn(isPropsOn)}>
            <TuneRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Board（Base/Plan/Option）">
          <IconButton onClick={() => toggleRightPanel("board")} sx={pillBtn(isBoardOn)}>
            <DashboardCustomizeRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
