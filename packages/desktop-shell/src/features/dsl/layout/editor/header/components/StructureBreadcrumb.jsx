import React, { useState, useCallback } from "react";
import { Box, Typography, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";

import { useWorkspaceStructureStore } from "../../../store/useWorkspaceStructureStore";

// ヘッダーの Base / Plan / Option メニュー。
// 「Base: 01 › Plan 1 › Option 1」の各セグメントがドロップダウンになっており、
//  - Base   … プロジェクトに登録されている Base から 1 つだけ選択（切替は最後の Plan を自動で開く）
//  - Plan   … 選択中 Base 配下の Plan を選択／新規作成（配置パターンを複数作れる）
//  - Option … 選択中 Plan 配下の Option を選択／新規作成（マテリアルパターンを複数作れる）
// Plan/Option 未選択（=Base のみ開いている）ときは躯体編集バッジを表示。
const menuPaperSx = {
  bgcolor: "var(--brand-surface2, #10151f)",
  border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
  color: "var(--brand-fg)",
  minWidth: 220,
  boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
  "& .MuiMenuItem-root": { fontSize: 12.5, py: 0.75 },
};

function Segment({ label, strong, onClick }) {
  return (
    <Box
      onClick={onClick}
      role="button"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        px: 0.6,
        py: 0.2,
        borderRadius: 0.75,
        cursor: "pointer",
        userSelect: "none",
        transition: "color 0.12s, background 0.12s",
        "&:hover": { background: alpha("#fff", 0.08) },
      }}
    >
      <Typography
        noWrap
        sx={{
          fontSize: 12.5,
          fontWeight: strong ? 800 : 600,
          color: strong
            ? "color-mix(in srgb, var(--brand-fg) 95%, transparent)"
            : alpha("#fff", 0.65),
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Typography>
      <ExpandMoreRoundedIcon sx={{ fontSize: 15, color: alpha("#fff", 0.5), flexShrink: 0 }} />
    </Box>
  );
}

export default function StructureBreadcrumb() {
  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);
  const bases = useWorkspaceStructureStore((s) => s.bases);
  const plans = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s) => s.options);
  const selectBase = useWorkspaceStructureStore((s) => s.selectBase);
  const selectPlan = useWorkspaceStructureStore((s) => s.selectPlan);
  const selectOption = useWorkspaceStructureStore((s) => s.selectOption);
  const openLayout = useWorkspaceStructureStore((s) => s.openLayout);
  const createPlan = useWorkspaceStructureStore((s) => s.createPlan);
  const createOption = useWorkspaceStructureStore((s) => s.createOption);

  // 開いているメニュー: 'base' | 'plan' | 'option' | null
  const [menuKey, setMenuKey] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = useCallback((key) => (e) => {
    setMenuKey(key);
    setAnchorEl(e.currentTarget);
  }, []);
  const closeMenu = useCallback(() => {
    setMenuKey(null);
    setAnchorEl(null);
  }, []);

  const baseList = Array.isArray(bases) ? bases : [];
  const planList = Array.isArray(plans) ? plans : [];
  const optionList = Array.isArray(options) ? options : [];

  const baseName = baseList.find((b) => b?.id === selectedBaseId)?.name || "—";
  const planName = selectedPlanId
    ? planList.find((p) => p?.id === selectedPlanId)?.name || "Plan"
    : null;
  const optionName = selectedOptionId
    ? optionList.find((o) => o?.id === selectedOptionId)?.name || "Option"
    : null;

  if (!selectedBaseId) return null;

  // Plan/Option を開いていない＝Base 編集（躯体モード相当）であることを示すバッジ。
  const isBaseOnly = !planName && !optionName;

  const check = <CheckRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0aa5c2, #22d3ee)" }} />;
  const checkPlaceholder = <Box sx={{ width: 16 }} />;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, minWidth: 0, overflow: "hidden" }}>
      {/* ── Base ── */}
      <Segment label={`Base: ${baseName}`} strong={isBaseOnly} onClick={openMenu("base")} />

      {/* ── Plan ── */}
      <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", flexShrink: 0 }} />
      <Segment label={planName ? planName : "Plan: 未選択"} strong={!!planName && !optionName} onClick={openMenu("plan")} />

      {/* ── Option ── */}
      <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", flexShrink: 0 }} />
      <Segment label={optionName ? optionName : "Option: なし"} strong={!!optionName} onClick={openMenu("option")} />

      {isBaseOnly && (
        <Box
          sx={{
            ml: 0.75, px: 0.75, height: 18,
            display: "flex", alignItems: "center",
            borderRadius: 0.75, fontSize: 10, fontWeight: 900, letterSpacing: 0.3,
            color: "light-dark(rgba(12,141,161,0.95), rgba(34,211,238,0.95))",
            background: alpha("#22d3ee", 0.16),
            border: `1px solid ${alpha("#22d3ee", 0.4)}`,
            flexShrink: 0,
          }}
        >
          躯体編集
        </Box>
      )}

      {/* ── Base メニュー: プロジェクト内の Base から 1 つ選択 ── */}
      <Menu
        anchorEl={anchorEl}
        open={menuKey === "base"}
        onClose={closeMenu}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {baseList.map((b) => (
          <MenuItem
            key={b.id}
            onClick={() => {
              closeMenu();
              if (b.id !== selectedBaseId) openLayout(b.id);
            }}
          >
            <ListItemIcon>{b.id === selectedBaseId ? check : checkPlaceholder}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}>{b.name || "Base"}</ListItemText>
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />
        <MenuItem
          onClick={() => {
            closeMenu();
            selectBase(selectedBaseId); // Plan/Option を解除して躯体のみ表示
          }}
        >
          <ListItemIcon><HomeWorkRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0aa5c2, #22d3ee)" }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>躯体を編集（Base のみ表示）</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Plan メニュー: Base 配下の Plan を選択／新規作成 ── */}
      <Menu
        anchorEl={anchorEl}
        open={menuKey === "plan"}
        onClose={closeMenu}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {planList.length === 0 && (
          <MenuItem disabled>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>Plan がありません</ListItemText>
          </MenuItem>
        )}
        {planList.map((p) => (
          <MenuItem
            key={p.id}
            onClick={() => {
              closeMenu();
              selectPlan(p.id);
            }}
          >
            <ListItemIcon>{p.id === selectedPlanId ? check : checkPlaceholder}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}>{p.name || "Plan"}</ListItemText>
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />
        <MenuItem
          onClick={() => {
            closeMenu();
            Promise.resolve(createPlan(selectedBaseId)).catch((e) => console.error("[StructureBreadcrumb] createPlan failed:", e));
          }}
        >
          <ListItemIcon><AddRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0aa5c2, #22d3ee)" }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>新規 Plan を作成（配置パターン）</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Option メニュー: Plan 配下の Option を選択／新規作成 ── */}
      <Menu
        anchorEl={anchorEl}
        open={menuKey === "option"}
        onClose={closeMenu}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {!selectedPlanId && (
          <MenuItem disabled>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>先に Plan を選択してください</ListItemText>
          </MenuItem>
        )}
        {selectedPlanId && optionList.length === 0 && (
          <MenuItem disabled>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>Option がありません</ListItemText>
          </MenuItem>
        )}
        {selectedPlanId && optionList.map((o) => (
          <MenuItem
            key={o.id}
            onClick={() => {
              closeMenu();
              selectOption(o.id);
            }}
          >
            <ListItemIcon>{o.id === selectedOptionId ? check : checkPlaceholder}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}>{o.name || "Option"}</ListItemText>
          </MenuItem>
        ))}
        {selectedPlanId && selectedOptionId && (
          <MenuItem
            onClick={() => {
              closeMenu();
              selectPlan(selectedPlanId); // Option を解除して Plan 本体へ
            }}
          >
            <ListItemIcon>{checkPlaceholder}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>Plan 本体を表示（Option 解除）</ListItemText>
          </MenuItem>
        )}
        {selectedPlanId && <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />}
        {selectedPlanId && (
          <MenuItem
            onClick={() => {
              closeMenu();
              Promise.resolve(createOption({ baseId: selectedBaseId, planId: selectedPlanId })).catch((e) => console.error("[StructureBreadcrumb] createOption failed:", e));
            }}
          >
            <ListItemIcon><AddRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0aa5c2, #22d3ee)" }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 12.5 }}>新規 Option を作成（マテリアルパターン）</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
