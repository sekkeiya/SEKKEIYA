// src/features/layout/components/MainArea/components/menu/ViewportQuickMenu.jsx
import React, { useMemo, useState, useCallback } from "react";
import { Box, IconButton, Tooltip, Paper, Stack, Divider, Fade, ClickAwayListener } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";

import MoveSpeedDock, { SPEED_MODES } from "./MoveSpeedDock.jsx";

export default function ViewportQuickMenu({
  speedMode = SPEED_MODES.WALK,
  onChangeSpeedMode,        // (mode)=>void
  onToggleSectionClip,      // placeholder
  speedMul = 1,             // optional（表示だけ）
}) {
  const theme = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null); // "speed" | "section" | null

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
      position: "absolute",
      top: 12,
      right: 12,
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
                      bgcolor: panel === "speed" ? alpha(theme.palette.primary.main, 0.18) : "transparent",
                    }}
                  >
                    <SpeedOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Divider sx={{ borderColor: alpha("#fff", 0.1) }} />

                {/* 断面（UIだけ先に） */}
                <Tooltip title="Section clip" placement="left">
                  <IconButton
                    size="small"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel("section");
                    }}
                    sx={{
                      ...btnSx,
                      bgcolor: panel === "section" ? alpha(theme.palette.primary.main, 0.18) : "transparent",
                    }}
                  >
                    <ContentCutOutlinedIcon fontSize="small" />
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
                      onChangeSpeedMode?.(mode);
                    }}
                  />
                </Box>
              </Fade>

              {/* ✅ Section パネル（仮） */}
              <Fade in={panel === "section"} timeout={140}>
                <Box sx={{ ...panelSx, display: panel === "section" ? "block" : "none" }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: 220,
                      borderRadius: 2,
                      border: `1px solid ${alpha("#fff", 0.14)}`,
                      bgcolor: alpha("#0b1020", 0.62),
                      backdropFilter: "blur(10px)",
                      boxShadow: `0 12px 26px ${alpha("#000", 0.35)}`,
                      p: 1.2,
                      color: alpha("#fff", 0.9),
                      fontSize: 12,
                      fontWeight: 900,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <span>Section clip</span>
                    <IconButton
                      size="small"
                      onClick={() => onToggleSectionClip?.()}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.2,
                        border: `1px solid ${alpha("#fff", 0.14)}`,
                        color: alpha("#fff", 0.9),
                        "&:hover": { bgcolor: alpha("#fff", 0.08) },
                      }}
                    >
                      <ContentCutOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                </Box>
              </Fade>
            </Paper>
          </Box>
        </ClickAwayListener>
      )}
    </Box>
  );
}
