import React, { useState, useCallback } from "react";
import { Box, Typography, Menu, MenuItem, ListItemIcon, ListItemText, IconButton, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import { useLayoutPatternStore } from "../../../store/useLayoutPatternStore";
import { useLayoutOptionActions } from "../../../hooks/useLayoutOptionActions";
import { resolveProposalPlan } from "../../../utils/layoutPatterns";

const menuPaperSx = {
  bgcolor: "var(--brand-surface2, #10151f)",
  border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
  color: "var(--brand-fg)",
  minWidth: 240,
  boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
  "& .MuiMenuItem-root": { fontSize: 12.5, py: 0.75 },
};

// パンくず（Base ▸ Plan）とは別軸のセレクタ。提案 = 「どの Plan を使い、どんな見た目
// にするか」の完全な最終形（Base 直下・実体は layouts/{baseId}/patterns）。
// v2（自動保存）では常にちょうど1つの提案がアクティブで、編集は自動的にそこへ
// 書き込まれる（useProposalAutoCapture）。ここでは「切替」「新規作成」「名前変更」
// 「削除」だけを扱う — 明示的な「更新（上書き保存）」操作はもう無い。
export default function ProposalSelector() {
  const patternsRaw = useLayoutPatternStore((s) => s.patterns);
  const patterns = Array.isArray(patternsRaw) ? patternsRaw : [];
  const activePatternId = useLayoutPatternStore((s) => s.activePatternId);
  const { ready, busy, plans, selectOption, createOption, renameOption, removeOption } = useLayoutOptionActions();

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const closeMenu = useCallback(() => setAnchorEl(null), []);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const activeOption = patterns.find((o) => o?.id === activePatternId) || null;
  const activeName = activeOption?.name || "提案";

  const openRenameDialog = useCallback(() => {
    setRenameDraft(activeOption?.name || "");
    setRenameOpen(true);
  }, [activeOption]);
  const submitRename = useCallback(async () => {
    setRenameOpen(false);
    if (activePatternId) await renameOption(activePatternId, renameDraft);
  }, [renameOption, activePatternId, renameDraft]);

  if (!ready) return null;

  const check = <CheckRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0aa5c2, #22d3ee)" }} />;
  const checkPlaceholder = <Box sx={{ width: 16 }} />;

  return (
    <Box sx={{ display: "flex", alignItems: "center", ml: 2, minWidth: 0, flexShrink: 0 }}>
      <Box
        onClick={openMenu}
        role="button"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          height: 26,
          pl: 1,
          pr: 0.75,
          borderRadius: 999,
          cursor: "pointer",
          userSelect: "none",
          background: alpha("#a855f7", 0.14),
          border: `1px solid ${alpha("#a855f7", 0.35)}`,
          transition: "background 0.12s, border-color 0.12s",
          "&:hover": { background: alpha("#a855f7", 0.2), borderColor: alpha("#a855f7", 0.5) },
        }}
      >
        <PaletteRoundedIcon sx={{ fontSize: 15, color: "#c084fc", flexShrink: 0 }} />
        <Typography
          noWrap
          sx={{
            fontSize: 12.5,
            fontWeight: 800,
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
            letterSpacing: 0.2,
            maxWidth: 160,
          }}
        >
          {activeName}
        </Typography>
        <ExpandMoreRoundedIcon sx={{ fontSize: 15, color: alpha("#fff", 0.5), flexShrink: 0 }} />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {patterns.length === 0 && (
          <MenuItem disabled>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>提案がありません</ListItemText>
          </MenuItem>
        )}
        {patterns.map((o) => {
          const planRef = resolveProposalPlan(o?.planId ?? null, plans);
          const planLabel =
            planRef.kind === "ok" ? planRef.name
              : planRef.kind === "none" ? "躯体のみ"
                : "Plan が見つかりません";
          const broken = planRef.kind === "missing";
          return (
            <MenuItem
              key={o.id}
              onClick={broken ? undefined : () => { closeMenu(); selectOption(o.id); }}
              sx={{
                display: "flex",
                alignItems: "center",
                ...(broken ? { opacity: 0.45, cursor: "default" } : {}),
              }}
            >
              <ListItemIcon>{o.id === activePatternId ? check : checkPlaceholder}</ListItemIcon>
              <ListItemText
                primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}
                secondaryTypographyProps={{ fontSize: 10.5, noWrap: true }}
                primary={o.name || "提案"}
                secondary={planLabel}
              />
              {/* 切替先 Plan が消えていても削除だけは常にできる（詰み状態を防ぐ）。 */}
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); closeMenu(); removeOption(o.id); }}
                sx={{ ml: 0.5, p: 0.4, opacity: 0.55, "&:hover": { opacity: 1, color: "#f87171" } }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </MenuItem>
          );
        })}
        <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />
        <MenuItem onClick={() => { closeMenu(); createOption(); }} disabled={busy}>
          <ListItemIcon><AddRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0aa5c2, #22d3ee)" }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>新しい提案</ListItemText>
        </MenuItem>
        {activePatternId && (
          <MenuItem onClick={() => { closeMenu(); openRenameDialog(); }}>
            <ListItemIcon><DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.6) }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>名前を変更…</ListItemText>
          </MenuItem>
        )}
        {activePatternId && (
          <MenuItem onClick={() => { closeMenu(); removeOption(activePatternId); }}>
            <ListItemIcon><DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.6) }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>この提案を削除</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>提案の名前を変更</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth size="small" label="提案名"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitRename(); } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameOpen(false)} sx={{ textTransform: "none" }}>キャンセル</Button>
          <Button onClick={() => { void submitRename(); }} disabled={!renameDraft.trim()} variant="contained" sx={{ textTransform: "none" }}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
