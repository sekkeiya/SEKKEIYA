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
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";

import {
  useViewportDisplayStore,
  SYMBOL_KINDS,
  SYMBOL_LABEL,
  LOCKABLE_SYMBOL_KINDS,
} from "../../../../store/useViewportDisplayStore";

export default function SymbolVisibilityToggle() {
  const theme = useTheme();
  const showSymbols = useViewportDisplayStore((s) => s.showSymbols);
  const symbolFlags = useViewportDisplayStore((s) => s.symbolFlags);
  const toggleSymbolFlag = useViewportDisplayStore((s) => s.toggleSymbolFlag);
  const setAllSymbolFlags = useViewportDisplayStore((s) => s.setAllSymbolFlags);
  const setShowSymbols = useViewportDisplayStore((s) => s.setShowSymbols);
  const symbolLocks = useViewportDisplayStore((s) => s.symbolLocks);
  const toggleSymbolLock = useViewportDisplayStore((s) => s.toggleSymbolLock);

  const [anchor, setAnchor] = useState(null);

  // 本体クリックで「表示 → 非表示 → 全ロック」を循環する。
  //   表示   : 表示ON＋ロック全解除
  //   非表示 : 表示OFF
  //   全ロック: 表示ON＋ロック対象を全ロック
  const handleClick = useCallback(() => {
    const st = useViewportDisplayStore.getState();
    const shown = st.showSymbols;
    const everLocked = shown && LOCKABLE_SYMBOL_KINDS.every((k) => !!st.symbolLocks[k]);
    if (!shown) {
      // 非表示 → 全ロック
      st.setShowSymbols(true);
      st.setAllSymbolLocks(true);
    } else if (everLocked) {
      // 全ロック → 表示（全解除）
      st.setAllSymbolLocks(false);
    } else {
      // 表示 → 非表示
      st.setShowSymbols(false);
    }
  }, []);

  const accent = theme.palette.primary.main;
  const lockColor = "#f59e0b"; // 全ロック状態は琥珀色で区別
  const line = alpha(theme.palette.common.white, 0.12);

  // 現在の状態（3値）。全ロック＝表示中かつロック対象すべてロック。
  const allLocked = showSymbols && LOCKABLE_SYMBOL_KINDS.every((k) => !!symbolLocks[k]);
  const state = !showSymbols ? "hidden" : allLocked ? "locked" : "shown";
  const on = state !== "hidden";                 // 見えている（表示 or 全ロック）
  const activeColor = state === "locked" ? lockColor : accent;
  const Icon = state === "hidden"
    ? VisibilityOffRoundedIcon
    : state === "locked"
      ? LockRoundedIcon
      : VisibilityRoundedIcon;

  // 個別に隠している項目の数（マスターが ON のときだけ意味を持つ）。
  const offCount = SYMBOL_KINDS.filter((k) => !symbolFlags[k]).length;

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Tooltip
        title={
          state === "shown" ? "記号：表示中（クリックで非表示）"
            : state === "hidden" ? "記号：非表示（クリックで全ロック表示）"
              : "記号：全ロック中（表示のまま操作不可・クリックで表示に戻す）"
        }
        arrow
      >
        <Box
          component="button"
          type="button"
          aria-label="記号の表示・ロック"
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
            border: `1px solid ${on ? alpha(activeColor, 0.5) : line}`,
            borderRight: "none",
            background: on ? alpha(activeColor, 0.22) : alpha("#fff", 0.04),
            color: on
              ? "color-mix(in srgb, var(--brand-fg) 95%, transparent)"
              : "color-mix(in srgb, var(--brand-fg) 45%, transparent)",
            "&:hover": {
              background: on ? alpha(activeColor, 0.3) : alpha("#fff", 0.08),
              color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
            },
          }}
        >
          <Icon sx={{ fontSize: 14 }} />
          記号
          {/* 現在の状態を文字でも出す（アイコンだけだと読み取りにくい）。
              表示中に一部だけ隠しているときは残数を出して気づけるようにする。 */}
          <Box
            component="span"
            sx={{
              ml: 0.2,
              px: 0.5,
              borderRadius: 0.5,
              fontSize: 9.5,
              fontWeight: 900,
              lineHeight: "14px",
              background: on ? alpha(activeColor, 0.55) : alpha("#fff", 0.1),
              color: on ? "#fff" : "color-mix(in srgb, var(--brand-fg) 55%, transparent)",
            }}
          >
            {state === "hidden"
              ? "OFF"
              : state === "locked"
                ? "LOCK"
                : offCount
                  ? `${SYMBOL_KINDS.length - offCount}/${SYMBOL_KINDS.length}`
                  : "ON"}
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
            border: `1px solid ${on ? alpha(activeColor, 0.5) : line}`,
            background: on ? alpha(activeColor, 0.22) : alpha("#fff", 0.04),
            color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)",
            "&:hover": { background: on ? alpha(activeColor, 0.3) : alpha("#fff", 0.08) },
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
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, pt: 0.75, pb: 0.5 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
            表示する記号
          </Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
            ロック
          </Typography>
        </Box>
        {SYMBOL_KINDS.map((k) => {
          const lockable = LOCKABLE_SYMBOL_KINDS.includes(k);
          const locked = !!symbolLocks[k];
          return (
            <MenuItem
              key={k}
              onClick={() => {
                // 個別を触ったらマスターは ON にする（OFF のまま操作しても見えないため）。
                if (!showSymbols) setShowSymbols(true);
                toggleSymbolFlag(k);
              }}
              sx={{ fontSize: 12.5, py: 0.25, pr: 0.75 }}
            >
              <Checkbox
                size="small" checked={!!symbolFlags[k]} disableRipple
                sx={{ p: 0.5, mr: 0.5, color: alpha(accent, 0.6), "&.Mui-checked": { color: accent } }}
              />
              <ListItemText primaryTypographyProps={{ fontSize: 12.5 }} primary={SYMBOL_LABEL[k]} />
              {/* ロック: 表示はそのままで、選択・移動・編集だけ不可にする。行クリック（表示切替）と
                  分けるため stopPropagation する。床グリッドは操作が無いのでロックボタンを出さない。 */}
              {lockable ? (
                <Tooltip title={locked ? "ロック中：クリックで解除（操作可に戻す）" : "ロック（表示のまま選択・移動・編集を不可にする）"} arrow>
                  <Box
                    component="span"
                    role="button"
                    aria-label={`${SYMBOL_LABEL[k]}のロック`}
                    onClick={(e) => { e.stopPropagation(); toggleSymbolLock(k); }}
                    sx={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      ml: 1, p: 0.35, borderRadius: 0.75, cursor: "pointer",
                      color: locked ? accent : "color-mix(in srgb, var(--brand-fg) 32%, transparent)",
                      background: locked ? alpha(accent, 0.14) : "transparent",
                      "&:hover": { background: alpha("#fff", 0.1) },
                    }}
                  >
                    {locked ? <LockRoundedIcon sx={{ fontSize: 15 }} /> : <LockOpenRoundedIcon sx={{ fontSize: 15 }} />}
                  </Box>
                </Tooltip>
              ) : (
                <Box component="span" sx={{ width: 27 }} />
              )}
            </MenuItem>
          );
        })}
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
