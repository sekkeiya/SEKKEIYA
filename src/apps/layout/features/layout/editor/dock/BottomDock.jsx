// src/features/layout/components/BottomBar/BottomDock.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Stack, IconButton, Typography, Tooltip, Divider } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import TextureRoundedIcon from "@mui/icons-material/TextureRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";

// ✅ Twinmotion式 Right Panels
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded"; // Scene
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"; // Properties
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded"; // Board

// ✅ NEW: Zustand
import { useUiRightSidebarStore } from "@layout/features/layout/store/uiRightSidebarStore";

// ✅ Bottom Panel のモード
const MODES = [
  { key: "import", label: "Import", icon: <DownloadRoundedIcon fontSize="small" /> },

  // ✅ NEW: textures（Texture Library）
  { key: "textures", label: "Textures", icon: <ImageRoundedIcon fontSize="small" /> },

  // ✅ materials（Material Library）
  { key: "materials", label: "Materials", icon: <TextureRoundedIcon fontSize="small" /> },

  { key: "populate", label: "Populate", icon: <GroupsRoundedIcon fontSize="small" /> },
  { key: "media", label: "Media", icon: <MovieCreationRoundedIcon fontSize="small" /> },
  { key: "export", label: "Export", icon: <IosShareRoundedIcon fontSize="small" /> },
];

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
      {/* Left */}
      <Stack direction="row" spacing={1} alignItems="center">
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
