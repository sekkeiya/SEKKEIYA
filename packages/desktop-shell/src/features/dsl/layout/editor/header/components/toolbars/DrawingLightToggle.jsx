// DrawingLightToggle — 図面ビュー（展開/立面/断面）の補助光オンオフ。
// TopBar Row2、SymbolVisibilityToggle（記号）の隣に置く。
// 表示状態は useViewportDisplayStore が持つ（モードを跨いで保持）。
//
// 通常のシーン照明（太陽＋Ambience）は側面正射ビューでカメラ正対の壁面を
// ほぼ照らさず、貼ったマテリアルが黒く沈む。ON（既定）でカメラ方向からの
// フィルライトを足して図面として見やすくする。実際の陰影を確認したいときは OFF。
// 見た目は SymbolVisibilityToggle と同型（電球アイコン＋「ライト」＋ ON/OFF）。
import React, { useCallback } from "react";
import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

import { useViewportDisplayStore } from "../../../../store/useViewportDisplayStore";

export default function DrawingLightToggle() {
  const theme = useTheme();
  const drawingLight = useViewportDisplayStore((s) => s.drawingLight);
  const toggleDrawingLight = useViewportDisplayStore((s) => s.toggleDrawingLight);

  const handleClick = useCallback(() => {
    toggleDrawingLight();
  }, [toggleDrawingLight]);

  const accent = theme.palette.primary.main;
  const line = alpha(theme.palette.common.white, 0.12);
  const Icon = drawingLight ? LightbulbRoundedIcon : LightbulbOutlinedIcon;

  return (
    <Tooltip
      title={
        drawingLight
          ? "図面の補助光を消す（展開/立面/断面が実際の照明だけになります）"
          : "図面の補助光を点ける（展開/立面/断面のマテリアルを明るく表示）"
      }
      arrow
    >
      <Box
        component="button"
        type="button"
        role="switch"
        aria-checked={drawingLight}
        aria-label="図面の補助光"
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
          border: `1px solid ${drawingLight ? alpha(accent, 0.5) : line}`,
          background: drawingLight ? alpha(accent, 0.22) : alpha("#fff", 0.04),
          color: drawingLight
            ? "color-mix(in srgb, var(--brand-fg) 95%, transparent)"
            : "color-mix(in srgb, var(--brand-fg) 45%, transparent)",
          "&:hover": {
            background: drawingLight ? alpha(accent, 0.3) : alpha("#fff", 0.08),
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
          },
        }}
      >
        <Icon sx={{ fontSize: 14 }} />
        ライト
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
            background: drawingLight ? alpha(accent, 0.55) : alpha("#fff", 0.1),
            color: drawingLight ? "#fff" : "color-mix(in srgb, var(--brand-fg) 55%, transparent)",
          }}
        >
          {drawingLight ? "ON" : "OFF"}
        </Box>
      </Box>
    </Tooltip>
  );
}
