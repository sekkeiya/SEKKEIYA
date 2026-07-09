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
import ViewSidebarRoundedIcon from "@mui/icons-material/ViewSidebarRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";

// ✅ Twinmotion式 Right Panels
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded"; // Scene
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"; // Properties
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded"; // Board
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded"; // History

import ViewportQuickMenu from "@desktop/features/dsl/layout/canvas/menu/ViewportQuickMenu.jsx";

// ✅ NEW: Zustand
import { useUiRightSidebarStore } from "@desktop/features/dsl/layout/store/uiRightSidebarStore";
import { useUiLeftSidebarStore } from "@desktop/features/dsl/layout/store/uiLeftSidebarStore";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

// ✅ Bottom Panel のモード
const MODES = [

  // ✅ NEW: textures（Texture Library）
  { key: "textures", label: "Textures", icon: <ImageRoundedIcon fontSize="small" /> },

  // ✅ materials（Material Library）
  { key: "materials", label: "Materials", icon: <TextureRoundedIcon fontSize="small" /> },

  { key: "populate", label: "配置アイテム", icon: <GroupsRoundedIcon fontSize="small" /> },
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

  // ✅ LeftSidebar表示状態
  const leftPanels = useUiLeftSidebarStore((s) => s.leftPanels);
  const toggleLeftPanel = useUiLeftSidebarStore((s) => s.toggleLeftPanel);

  const editorMode = useEditorModeStore((s) => s.editorMode);

  const quickMenuOpen = useViewportUiStore((s) => s.quickMenuOpen);

  const rootSx = useMemo(
    () => ({
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 60,
      pointerEvents: "none", // root is click-through
    }),
    []
  );

  const glassBoxCenterSx = useMemo(
    () => ({
      pointerEvents: "auto",
      position: "absolute",
      left: "50%",
      bottom: 12,
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 2,
      height: 56,
      borderRadius: "28px",
      background: alpha("#070b18", 0.7),
      backdropFilter: "blur(12px)",
      border: `1px solid ${alpha("#ffffff", 0.1)}`,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      transition: "all 0.3s ease",
      opacity: 0.15, // dim normally
      "&:hover": {
        opacity: 1, // reveal on hover
        background: alpha("#070b18", 0.8),
      }    }),
    []
  );

  // Vertical layout for left/right islands
  const glassBoxVerticalSx = useMemo(
    () => ({
      pointerEvents: "auto",
      position: "absolute",
      top: 160,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1.5,
      py: 2,
      width: 56,
      borderRadius: "28px",
      background: alpha("#070b18", 0.7),
      backdropFilter: "blur(12px)",
      border: `1px solid ${alpha("#ffffff", 0.1)}`,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      transition: "all 0.3s ease",
      opacity: 0.15, // dim normally
      "&:hover": {
        opacity: 1, // reveal on hover
        background: alpha("#070b18", 0.8),
      }
    }),
    []
  );

  const pillBtn = useCallback(
    (active) => ({
      width: 40,
      height: 40,
      borderRadius: 2.25,
      background: active ? alpha(theme.palette.primary.main, 0.85) : "transparent",
      border: `1px solid ${
        active ? theme.palette.primary.main : alpha("#fff", 0.10)
      }`,
      color: active ? "#ffffff" : alpha("#fff", 0.82),
      boxShadow: active ? `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}` : "none",
      "&:hover": { background: active ? theme.palette.primary.main : alpha("#fff", 0.06) },
    }),
    [theme.palette.primary.main]
  );

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
  const isHistoryOn = !!rightPanels?.history;

  return (
    <Box sx={rootSx}>
      {/* Left Vertical Dock: Project, Structure, Library */}
      <Box sx={{ ...glassBoxVerticalSx, left: 16, top: 230 }}>
            <Tooltip title="デフォルト左サイドバー (Default Sidebar)" placement="right">
              <IconButton onClick={() => toggleLeftPanel('dashboard')} sx={pillBtn(!!leftPanels?.dashboard)}>
                <ViewSidebarRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Layout Tasks is deprecated in Phase 2 (Retroactive Space Programming) */}
            {/* <Tooltip title="レイアウトタスク (Layout Tasks)" placement="right"> ... </Tooltip> */}

            <Tooltip title="Project Hierarchy" placement="right">
              <IconButton onClick={() => toggleLeftPanel('project')} sx={pillBtn(!!leftPanels?.project)}>
                <DashboardCustomizeRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

        <Tooltip title="ライブラリ (Models Library)" placement="right">
          <IconButton onClick={() => toggleLeftPanel('library')} sx={pillBtn(!!leftPanels?.library)}>
            <FolderOpenRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Center Dock: Modes (Horizontal, Bottom) */}
      <Box sx={glassBoxCenterSx}>
        {MODES.map((m) => {
          const active = m.key === mode;
          const tip = active ? (panelOpen ? "Click to close" : `Open ${m.label}`) : `Open ${m.label}`;

          return (
            <Tooltip key={m.key} title={tip} placement="top">
              <IconButton onClick={() => handleClickMode(m.key)} sx={pillBtn(active && panelOpen)}>
                {m.icon}
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {/* Right Vertical Dock: Scene, Properties, plus ViewportQuickMenu */}
      <Box sx={{ ...glassBoxVerticalSx, right: 16, top: 160 }}>
            <Tooltip title="Scene（アウトライナー）" placement="left">
              <IconButton onClick={() => toggleRightPanel("scene")} sx={pillBtn(isSceneOn)}>
                <AccountTreeRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
        <Tooltip title="Properties（Ambience等）" placement="left">
          <IconButton onClick={() => toggleRightPanel("properties")} sx={pillBtn(isPropsOn)}>
            <TuneRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="History（生成履歴）" placement="left">
          <IconButton onClick={() => toggleRightPanel("history")} sx={pillBtn(isHistoryOn)}>
            <PhotoLibraryRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ mt: 1 }}>
          <ViewportQuickMenu />
        </Box>
      </Box>
    </Box>
  );
}
