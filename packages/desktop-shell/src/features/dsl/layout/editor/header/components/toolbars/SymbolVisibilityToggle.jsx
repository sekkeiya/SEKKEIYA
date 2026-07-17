// SymbolVisibilityToggle — 図面記号（断面線 / ゾーン / 展開記号）の一括オンオフ。
// TopBar Row2、SelectionScopeButtons（ALL/Item/Zone/Map）の隣に置く。
// 表示状態は useViewportDisplayStore が持つ（モードを跨いで保持）。
//
// 見た目: 目のアイコン＋「記号」＋ ON/OFF の文字。ON=アクセント / OFF=減光＋伏せ目アイコン。
// スコープ（ALL/Item/…）は「どれか一つを選ぶ」排他ボタン群なので、こちらは
// 一目で二値スイッチと分かる形にして役割を混同させない。
import React, { useCallback } from "react";
import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import { useViewportDisplayStore } from "../../../../store/useViewportDisplayStore";

export default function SymbolVisibilityToggle() {
  const theme = useTheme();
  const showSymbols = useViewportDisplayStore((s) => s.showSymbols);
  const toggleShowSymbols = useViewportDisplayStore((s) => s.toggleShowSymbols);

  const handleClick = useCallback(() => {
    toggleShowSymbols();
  }, [toggleShowSymbols]);

  const accent = theme.palette.primary.main;
  const line = alpha(theme.palette.common.white, 0.12);
  const Icon = showSymbols ? VisibilityRoundedIcon : VisibilityOffRoundedIcon;

  return (
    <Tooltip
      title={showSymbols ? "記号を隠す（断面線・ゾーン・展開記号）" : "記号を表示（断面線・ゾーン・展開記号）"}
      arrow
    >
      <Box
        component="button"
        type="button"
        role="switch"
        aria-checked={showSymbols}
        aria-label="記号の表示"
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
          border: `1px solid ${showSymbols ? alpha(accent, 0.5) : line}`,
          background: showSymbols ? alpha(accent, 0.22) : alpha("#fff", 0.04),
          color: showSymbols
            ? "color-mix(in srgb, var(--brand-fg) 95%, transparent)"
            : "color-mix(in srgb, var(--brand-fg) 45%, transparent)",
          "&:hover": {
            background: showSymbols ? alpha(accent, 0.3) : alpha("#fff", 0.08),
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
          },
        }}
      >
        <Icon sx={{ fontSize: 14 }} />
        記号
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
            background: showSymbols ? alpha(accent, 0.55) : alpha("#fff", 0.1),
            color: showSymbols ? "#fff" : "color-mix(in srgb, var(--brand-fg) 55%, transparent)",
          }}
        >
          {showSymbols ? "ON" : "OFF"}
        </Box>
      </Box>
    </Tooltip>
  );
}
