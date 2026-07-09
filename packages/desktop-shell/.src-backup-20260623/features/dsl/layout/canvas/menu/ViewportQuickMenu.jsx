// src/features/layout/components/MainArea/components/menu/ViewportQuickMenu.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Box, IconButton, Tooltip, Paper, Stack, Divider, Fade, ClickAwayListener } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import GridOffRoundedIcon from "@mui/icons-material/GridOffRounded";

import MoveSpeedDock, { SPEED_MODES } from "./MoveSpeedDock.jsx";
import SectionClipSlider from "../SectionClipSlider.jsx";
import GridSettingsDock from "./GridSettingsDock.jsx";

import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

export default function ViewportQuickMenu() {
  const speedMode = useViewportUiStore((s) => s.speedMode);
  const setSpeedMode = useViewportUiStore((s) => s.setSpeedMode);
  const speedMul = useViewportUiStore((s) => s.speedMul);

  const theme = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null); // "speed" | null

  const setQuickMenuOpen = useViewportUiStore((s) => s.setQuickMenuOpen);
  
  const isSectionClipEnabled = useEditorModeStore((s) => s.isSectionClipEnabled);
  const setIsSectionClipEnabled = useEditorModeStore((s) => s.setIsSectionClipEnabled);

  const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
  const setIsGridVisible = useEditorModeStore((s) => s.setIsGridVisible);

  useEffect(() => {
    setQuickMenuOpen(menuOpen);
    return () => setQuickMenuOpen(false);
  }, [menuOpen, setQuickMenuOpen]);

  const closeMenuOnly = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((v) => {
      const next = !v;
      if (!next) setPanel(null);
      return next;
    });
  }, []);

    const togglePanel = useCallback((next) => {
    if (!menuOpen) setMenuOpen(true);
    setPanel((cur) => {
        const v = cur === next ? null : next;
        console.log("[ViewportQuickMenu] panel:", v);
        return v;
    });
    }, [menuOpen]);

  const wrapSx = useMemo(
    () => ({
      position: "relative",
      zIndex: 2000,
      pointerEvents: "auto",
    }),
    []
  );

  const eyeSx = useMemo(
    () => ({
      width: 44,
      height: 44,
      borderRadius: 2,
      border: `1px solid ${alpha("#fff", 0.14)}`,
      bgcolor: alpha("#0b1020", 0.62),
      color: alpha("#fff", 0.9),
      backdropFilter: "blur(10px)",
      boxShadow: `0 10px 24px ${alpha("#000", 0.32)}`,
      "&:hover": { bgcolor: alpha("#fff", 0.08) },
    }),
    []
  );

  const barSx = useMemo(
    () => ({
      width: 44,
      borderRadius: 2,
      border: `1px solid ${alpha("#fff", 0.14)}`,
      bgcolor: alpha("#0b1020", 0.62),
      backdropFilter: "blur(10px)",
      boxShadow: `0 12px 26px ${alpha("#000", 0.35)}`,
      overflow: "visible",

      // ✅ パネルを「縦バー基準」で左に出すため
      position: "relative",
    }),
    []
  );

  const btnSx = useMemo(
    () => ({
      width: 44,
      height: 44,
      borderRadius: 0,
      color: alpha("#fff", 0.88),
      "&:hover": { bgcolor: alpha("#fff", 0.08) },
    }),
    []
  );

  // ✅ パネルを縦バーの左に固定（バー基準）
  const panelSx = useMemo(
    () => ({
      position: "absolute",
      top: 0,
      right: "calc(100% + 8px)", // ✅ 縦バー幅に追従して “必ず左側”
      zIndex: 70,
      pointerEvents: "auto",
    }),
    []
  );

  return (
    <Box sx={wrapSx}>
      {/* 👁 目アイコン（開閉） */}
      <Tooltip title={menuOpen ? "Close menu" : "Open menu"} placement="left">
        <IconButton size="small" onClick={toggleMenu} sx={eyeSx}>
          <VisibilityOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {menuOpen && (
        <ClickAwayListener mouseEvent="onMouseDown" onClickAway={closeMenuOnly}>
          {/* ✅ 目アイコンの “下” に縦バー */}
          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            {/* 縦メニューバー（ここが基準） */}
            <Paper elevation={0} sx={barSx}>
              <Stack spacing={0}>
                {/* 速度 */}
                <Tooltip title="Speed" placement="left">
                  <IconButton
                    size="small"
                     onMouseDown={(e) => e.stopPropagation()}
                     onClick={(e) => {
                       e.stopPropagation();
                       togglePanel("speed");
                     }}
                    sx={{
                      ...btnSx,
                      bgcolor: panel === "speed" ? alpha(theme.palette.primary.main, 0.85) : "transparent",
                      color: panel === "speed" ? "#ffffff" : alpha("#fff", 0.88),
                      boxShadow: panel === "speed" ? `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}` : "none",
                    }}
                  >
                    <SpeedOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Divider sx={{ borderColor: alpha("#fff", 0.1) }} />

                {/* 断面 */}
                <Tooltip title="Section clip" placement="left">
                  <IconButton
                    size="small"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSectionClipEnabled) {
                        if (panel === "section") {
                          setIsSectionClipEnabled(false);
                          setPanel(null);
                        } else {
                          setPanel("section");
                        }
                      } else {
                        setIsSectionClipEnabled(true);
                        setPanel("section");
                      }
                    }}
                    sx={{
                      ...btnSx,
                      bgcolor: isSectionClipEnabled ? alpha(theme.palette.primary.main, 0.85) : "transparent",
                      color: isSectionClipEnabled ? "#ffffff" : alpha("#fff", 0.88),
                      boxShadow: isSectionClipEnabled ? `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}` : "none",
                    }}
                  >
                    <ContentCutOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Divider sx={{ borderColor: alpha("#fff", 0.1) }} />

                {/* Grid */}
                <Tooltip title="Grid Settings" placement="left">
                  <IconButton
                    size="small"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isGridVisible || panel === "grid") {
                        if (panel === "grid") {
                          setPanel(null);
                        } else {
                          setPanel("grid");
                        }
                      } else {
                        setIsGridVisible(true);
                        setPanel("grid");
                      }
                    }}
                    sx={{
                      ...btnSx,
                      bgcolor: isGridVisible ? alpha(theme.palette.primary.main, 0.85) : "transparent",
                      color: isGridVisible ? "#ffffff" : alpha("#fff", 0.88),
                      boxShadow: isGridVisible ? `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}` : "none",
                    }}
                  >
                    {isGridVisible ? <GridOnRoundedIcon fontSize="small" /> : <GridOffRoundedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* ✅ Speed パネル（左に出る） */}
              <Fade in={panel === "speed"} timeout={140}>
                <Box sx={{ ...panelSx, display: panel === "speed" ? "block" : "none" }}>
                  <MoveSpeedDock
                    value={speedMode}
                    speedMul={speedMul}
                    onChange={(mode) => {
                      setSpeedMode?.(mode);
                    }}
                  />
                </Box>
              </Fade>

              {/* ✅ Section Clip パネル（左に出る） */}
              <Fade in={panel === "section"} timeout={140}>
                <Box sx={{ ...panelSx, display: panel === "section" ? "block" : "none", right: "calc(100% + 8px)" }}>
                  <SectionClipSlider />
                </Box>
              </Fade>

              {/* ✅ Grid Паネル（左に出る） */}
              <Fade in={panel === "grid"} timeout={140}>
                <Box sx={{ ...panelSx, display: panel === "grid" ? "block" : "none", right: "calc(100% + 8px)" }}>
                  <GridSettingsDock />
                </Box>
              </Fade>
            </Paper>
          </Box>
        </ClickAwayListener>
      )}
    </Box>
  );
}
