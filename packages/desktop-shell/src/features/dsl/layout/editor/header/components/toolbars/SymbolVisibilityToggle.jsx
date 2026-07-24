// SymbolVisibilityToggle — 図面記号のオンオフ。
//   本体クリック  … 記号全体のマスター ON/OFF（従来どおりの二値スイッチ）
//   右の ▾ クリック … 項目別（断面線 / 展開記号 / 通り芯 / ゾーン / 寸法列）の切替メニュー
// TopBar Row2、SelectionScopeButtons（ALL/Item/Zone/Map）の隣に置く。
// 表示状態は useViewportDisplayStore が持つ（モードを跨いで保持）。
//
// 見た目: 目のアイコン＋「記号」＋ ON/OFF の文字。ON=アクセント / OFF=減光＋伏せ目アイコン。
// スコープ（ALL/Item/…）は「どれか一つを選ぶ」排他ボタン群なので、こちらは
// 一目で二値スイッチと分かる形にして役割を混同させない。
import React, { useCallback, useState } from "react";
import { Box, Tooltip, Menu, MenuItem, Checkbox, ListItemText, Divider, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";

import {
  useViewportDisplayStore,
  SYMBOL_KINDS,
  SYMBOL_LABEL,
} from "../../../../store/useViewportDisplayStore";

export default function SymbolVisibilityToggle() {
  const theme = useTheme();
  const showSymbols = useViewportDisplayStore((s) => s.showSymbols);
  const toggleShowSymbols = useViewportDisplayStore((s) => s.toggleShowSymbols);
  const symbolFlags = useViewportDisplayStore((s) => s.symbolFlags);
  const toggleSymbolFlag = useViewportDisplayStore((s) => s.toggleSymbolFlag);
  const setAllSymbolFlags = useViewportDisplayStore((s) => s.setAllSymbolFlags);
  const setShowSymbols = useViewportDisplayStore((s) => s.setShowSymbols);

  const [anchor, setAnchor] = useState(null);

  const handleClick = useCallback(() => {
    toggleShowSymbols();
  }, [toggleShowSymbols]);

  const accent = theme.palette.primary.main;
  const line = alpha(theme.palette.common.white, 0.12);
  const Icon = showSymbols ? VisibilityRoundedIcon : VisibilityOffRoundedIcon;

  // 個別に隠している項目の数（マスターが ON のときだけ意味を持つ）。
  const offCount = SYMBOL_KINDS.filter((k) => !symbolFlags[k]).length;

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Tooltip
        title={showSymbols ? "記号を隠す（まとめて）" : "記号を表示（まとめて）"}
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
            borderRadius: "4px 0 0 4px",
            cursor: "pointer",
            userSelect: "none",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.2,
            whiteSpace: "nowrap",
            transition: "background 120ms, color 120ms, border-color 120ms",
            border: `1px solid ${showSymbols ? alpha(accent, 0.5) : line}`,
            borderRight: "none",
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
          {/* ON/OFF を文字でも出す（アイコンだけだと「今どっちか」が読み取りにくい）。
              一部だけ隠しているときは ON ではなく残数を出して気づけるようにする。 */}
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
            {!showSymbols ? "OFF" : offCount ? `${SYMBOL_KINDS.length - offCount}/${SYMBOL_KINDS.length}` : "ON"}
          </Box>
        </Box>
      </Tooltip>

      {/* ▾ = 項目別の切替メニュー */}
      <Tooltip title="表示する記号を選ぶ" arrow>
        <Box
          component="button"
          type="button"
          aria-label="記号の項目を選ぶ"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 26, width: 18, borderRadius: "0 4px 4px 0", cursor: "pointer",
            border: `1px solid ${showSymbols ? alpha(accent, 0.5) : line}`,
            background: showSymbols ? alpha(accent, 0.22) : alpha("#fff", 0.04),
            color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)",
            "&:hover": { background: showSymbols ? alpha(accent, 0.3) : alpha("#fff", 0.08) },
          }}
        >
          <ArrowDropDownRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        MenuListProps={{ dense: true }}
        sx={{
          "& .MuiPaper-root": {
            bgcolor: "color-mix(in srgb, var(--brand-surface) 96%, transparent)",
            backgroundImage: "none",
            border: `1px solid ${line}`,
            minWidth: 180,
          },
        }}
      >
        <Typography sx={{ px: 1.5, pt: 0.75, pb: 0.5, fontSize: 10, fontWeight: 800, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
          表示する記号
        </Typography>
        {SYMBOL_KINDS.map((k) => (
          <MenuItem
            key={k}
            onClick={() => {
              // 個別を触ったらマスターは ON にする（OFF のまま操作しても見えないため）。
              if (!showSymbols) setShowSymbols(true);
              toggleSymbolFlag(k);
            }}
            sx={{ fontSize: 12.5, py: 0.25 }}
          >
            <Checkbox
              size="small" checked={!!symbolFlags[k]} disableRipple
              sx={{ p: 0.5, mr: 0.5, color: alpha(accent, 0.6), "&.Mui-checked": { color: accent } }}
            />
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }} primary={SYMBOL_LABEL[k]} />
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5, borderColor: line }} />
        <MenuItem
          onClick={() => { setShowSymbols(true); setAllSymbolFlags(true); setAnchor(null); }}
          sx={{ fontSize: 12, py: 0.4 }}
        >
          すべて表示
        </MenuItem>
        <MenuItem
          onClick={() => { setAllSymbolFlags(false); setAnchor(null); }}
          sx={{ fontSize: 12, py: 0.4 }}
        >
          すべて隠す
        </MenuItem>
      </Menu>
    </Box>
  );
}
