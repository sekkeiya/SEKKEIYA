// RoomColorToggle — 平面図で部屋（ゾーン）の範囲を「部屋ごとに異なる色」で塗り分ける ON/OFF。
// TopBar Row2、DrawingLightToggle（ライト）の隣に置く。
// 表示状態は useViewportDisplayStore が持つ（モードを跨いで保持）。
//
// 既定 OFF（従来どおり淡い既定色）。ON で各部屋に自動配色を乗せ、部屋の範囲・区分けを
// ひと目で把握できるようにする。見た目は SymbolVisibilityToggle / DrawingLightToggle と
// 同型（パレットアイコン＋「部屋色」＋ ON/OFF）。
import React, { useCallback } from "react";
import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";

import { useViewportDisplayStore } from "../../../../store/useViewportDisplayStore";

export default function RoomColorToggle() {
  const theme = useTheme();
  const showRoomColors = useViewportDisplayStore((s) => s.showRoomColors);
  const toggleShowRoomColors = useViewportDisplayStore((s) => s.toggleShowRoomColors);

  const handleClick = useCallback(() => {
    toggleShowRoomColors();
  }, [toggleShowRoomColors]);

  const accent = theme.palette.primary.main;
  const line = alpha(theme.palette.common.white, 0.12);
  const Icon = showRoomColors ? PaletteRoundedIcon : PaletteOutlinedIcon;

  return (
    <Tooltip
      title={
        showRoomColors
          ? "部屋の色分けを消す（部屋の範囲の塗り分けをやめる）"
          : "部屋の色分けを表示（部屋ごとに異なる色で範囲を塗る）"
      }
      arrow
    >
      <Box
        component="button"
        type="button"
        role="switch"
        aria-checked={showRoomColors}
        aria-label="部屋の色分け"
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          height: 26,
          px: 0.9,
          borderRadius: 1,
          cursor: "pointer",
          userSelect: "none",
          fontFamily: "inherit",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.2,
          whiteSpace: "nowrap",
          transition: "background 120ms, color 120ms, border-color 120ms",
          border: `1px solid ${showRoomColors ? alpha(accent, 0.5) : line}`,
          background: showRoomColors ? alpha(accent, 0.22) : alpha("#fff", 0.04),
          color: showRoomColors
            ? "color-mix(in srgb, var(--brand-fg) 95%, transparent)"
            : "color-mix(in srgb, var(--brand-fg) 45%, transparent)",
          "&:hover": {
            background: showRoomColors ? alpha(accent, 0.3) : alpha("#fff", 0.08),
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
          },
        }}
      >
        <Icon sx={{ fontSize: 14 }} />
        部屋色
        {/* ON/OFF を文字でも出す（アイコンだけだと「今どっちか」が読み取りにくい） */}
        <Box
          component="span"
          sx={{
            ml: 0.2,
            px: 0.5,
            borderRadius: 0.5,
            fontSize: 9.5,
            fontWeight: 900,
            lineHeight: "14px",
            background: showRoomColors ? alpha(accent, 0.55) : alpha("#fff", 0.1),
            color: showRoomColors ? "#fff" : "color-mix(in srgb, var(--brand-fg) 55%, transparent)",
          }}
        >
          {showRoomColors ? "ON" : "OFF"}
        </Box>
      </Box>
    </Tooltip>
  );
}
