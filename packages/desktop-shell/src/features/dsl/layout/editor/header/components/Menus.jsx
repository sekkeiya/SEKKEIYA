// src/features/layout/components/Header/components/Menus.jsx
import React, { useMemo, useCallback } from "react";
import { Menu, MenuItem, ListItemText, ListItemIcon, Divider, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import { useWorkspaceStructureStore } from "../../../store/useWorkspaceStructureStore";
import TopBarMenuRow from "./TopBarMenuRow";
import { useLayoutOptionActions } from "../../../hooks/useLayoutOptionActions";
import { useLayoutPatternStore } from "../../../store/useLayoutPatternStore";
import { resolveProposalPlan } from "../../../utils/layoutPatterns";

// ===== display helpers�E�Eenus 側�E�E====
function numToAlpha(n) {
  let x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "A";
  let s = "";
  while (x > 0) {
    x -= 1;
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s;
}
function displayBaseNameByIndex(i0) {
  return `Base-${numToAlpha(i0 + 1)}`;
}
function displayPlanNameByIndex(i0) {
  return `Plan-${numToAlpha(i0 + 1)}`;
}
function displayOptionNameByIndex(i0) {
  return `A-${i0 + 1}`;
}

export default function Menus({
  // anchors only
  baseAnchorEl,
  planAnchorEl,
  optionAnchorEl,
  openBase,
  openPlan,
  openOption,
  closeAll,

  // confirm opener (TopBar側の ConfirmDialog を使ぁE��揁E
  openConfirm,
}) {
  const theme = useTheme();

  // =========================
  // ✁EZustand selectors�E��E割して getSnapshot 無限ループ回避�E�E
  // =========================
  const bases = useWorkspaceStructureStore((s) => s.bases);
  const plansOfSelectedBase = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s) => s.options);
  const optionsLoading = useWorkspaceStructureStore((s) => s.optionsLoading);

  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);

  const creatingBase = useWorkspaceStructureStore((s) => s.creatingBase);
  const creatingPlan = useWorkspaceStructureStore((s) => s.creatingPlan);

  const deletingBase = useWorkspaceStructureStore((s) => s.deletingBase);
  const deletingPlan = useWorkspaceStructureStore((s) => s.deletingPlan);
  const deletingOption = useWorkspaceStructureStore((s) => s.deletingOption);

  const duplicatingBase = useWorkspaceStructureStore((s) => s.duplicatingBase);
  const duplicatingPlan = useWorkspaceStructureStore((s) => s.duplicatingPlan);
  const duplicatingOption = useWorkspaceStructureStore((s) => s.duplicatingOption);

  const createBase = useWorkspaceStructureStore((s) => s.createBase);
  const createPlan = useWorkspaceStructureStore((s) => s.createPlan);

  const deleteBase = useWorkspaceStructureStore((s) => s.deleteBase);
  const deletePlan = useWorkspaceStructureStore((s) => s.deletePlan);
  const deleteOption = useWorkspaceStructureStore((s) => s.deleteOption);

  const duplicateBase = useWorkspaceStructureStore((s) => s.duplicateBase);
  const duplicatePlan = useWorkspaceStructureStore((s) => s.duplicatePlan);
  const duplicateOption = useWorkspaceStructureStore((s) => s.duplicateOption);

  // 提案（旧 Option）＝「どの Plan を使い、どんな見た目にするか」の完全な最終形（Base 直下）。
  // プレビューと同じ実体を使うので、どちらで作成・選択しても自動的に連動する。
  // 切替は参照先 planId が違えば Plan 切替を含む（resolveProposalPlan で使用 Plan を解決）。
  const {
    busy: optionBusy,
    plans: proposalPlans,
    selectOption: applyOption,
    registerOption,
    updateOption,
    removeOption,
  } = useLayoutOptionActions();
  // 一覧と選択中はプレビューと同じくストアを直接購読する。
  const rawViewOptions = useLayoutPatternStore((s) => s.patterns);
  const viewOptions = Array.isArray(rawViewOptions) ? rawViewOptions : [];
  const activeOptionId = useLayoutPatternStore((s) => s.activePatternId);
  const optionCount = viewOptions.length;
  const [optionDialogOpen, setOptionDialogOpen] = React.useState(false);
  const [optionNameDraft, setOptionNameDraft] = React.useState("");
  const openOptionDialog = React.useCallback(() => {
    closeAll?.();
    setOptionNameDraft(`提案 ${optionCount + 1}`);
    setOptionDialogOpen(true);
  }, [closeAll, optionCount]);
  const submitOptionDialog = React.useCallback(async () => {
    setOptionDialogOpen(false);
    await registerOption(optionNameDraft);
  }, [registerOption, optionNameDraft]);

  const selectBase = useWorkspaceStructureStore((s) => s.selectBase);
  const selectPlan = useWorkspaceStructureStore((s) => s.selectPlan);
  const selectOption = useWorkspaceStructureStore((s) => s.selectOption);

  // ✁Eundefined で落ちなぁE��ぁE��忁E��配�E匁E
  const safeBases = useMemo(() => (Array.isArray(bases) ? bases : []), [bases]);
  const safePlans = useMemo(() => (Array.isArray(plansOfSelectedBase) ? plansOfSelectedBase : []), [plansOfSelectedBase]);
  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);

  const selectedBaseIndex = useMemo(() => {
    if (!selectedBaseId) return 0;
    const idx = safeBases.findIndex((b) => b?.id === selectedBaseId);
    return idx >= 0 ? idx : 0;
  }, [safeBases, selectedBaseId]);

  const selectedPlanIndex = useMemo(() => {
    if (!selectedPlanId) return 0;
    const idx = safePlans.findIndex((p) => p?.id === selectedPlanId);
    return idx >= 0 ? idx : 0;
  }, [safePlans, selectedPlanId]);

  const currentBaseLabel = useMemo(() => {
    if (!safeBases.length) return "No Base";
    return displayBaseNameByIndex(selectedBaseIndex);
  }, [safeBases.length, selectedBaseIndex]);

  const currentPlanLabel = useMemo(() => {
    if (!safePlans.length) return "Plan-A";
    return displayPlanNameByIndex(selectedPlanIndex);
  }, [safePlans.length, selectedPlanIndex]);

  const currentOptionLabel = useMemo(() => {
    if (!safeOptions.length) return "A-1";
    const idx = Math.max(0, safeOptions.findIndex((o) => o?.id === selectedOptionId));
    return safeOptions[idx]?.name || safeOptions[idx]?.id || displayOptionNameByIndex(idx) || "A-1";
  }, [safeOptions, selectedOptionId]);

  // styles�E�Eenus側で完結！E
  const menuPaperSx = useMemo(
    () => ({
      mt: 1,
      borderRadius: 2,
      background: "color-mix(in srgb, var(--brand-surface) 92%, transparent)",
      border: `1px solid ${alpha("#fff", 0.10)}`,
      backdropFilter: "blur(10px)",
      color: "var(--brand-fg)",
      minWidth: 240,
    }),
    []
  );

  const menuItemSx = useMemo(
    () => ({
      borderRadius: 1.5,
      mx: 0.75,
      my: 0.25,
      "&.Mui-selected": { background: alpha(theme.palette.primary.main, 0.18) },
      "&.Mui-selected:hover": { background: alpha(theme.palette.primary.main, 0.22) },
    }),
    [theme]
  );

  const danger = useMemo(() => alpha("#ff5252", 0.95), []);

  const askDelete = useCallback(
    (type, targetId, labelForHuman) => {
      if (!openConfirm || !targetId) return;
      const title = type === "base" ? "Delete Base" : type === "plan" ? "Delete Plan" : "Delete Option";
      openConfirm({
        type,
        targetId,
        title,
        description: `、E{labelForHuman || targetId}」を削除しますか�E�（この操作�E取り消せません�E�`,
      });
    },
    [openConfirm]
  );

  // handlers
  const handleSelectBase = useCallback(
    (baseId) => {
      if (!baseId) return;
      closeAll?.();
      selectBase?.(baseId);
    },
    [closeAll, selectBase]
  );

  const handleSelectPlan = useCallback(
    (planId) => {
      if (!selectedBaseId || !planId) return;
      closeAll?.();
      selectPlan?.(planId); // ↁEstore仕様が (planId) でOKな前提
    },
    [closeAll, selectPlan, selectedBaseId]
  );

  const handleSelectOption = useCallback(
    (optionId) => {
      if (!optionId) return;
      closeAll?.();
      selectOption?.(optionId);
    },
    [closeAll, selectOption]
  );

  const handleNewBase = useCallback(async () => {
    closeAll?.();
    await createBase?.();
  }, [closeAll, createBase]);

  const handleNewPlan = useCallback(async () => {
    closeAll?.();
    if (!selectedBaseId) return;
    await createPlan?.(selectedBaseId);
  }, [closeAll, createPlan, selectedBaseId]);

  const canCreatePlan = Boolean(selectedBaseId);

  return (
    <>
      {/* ========================= Base Menu ========================= */}
      <Menu
        anchorEl={baseAnchorEl}
        open={openBase}
        onClose={closeAll}
        PaperProps={{ sx: menuPaperSx }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {safeBases.length === 0 ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemText primary="No bases" primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : (
          safeBases.map((b, i) => {
            const selected = b?.id === selectedBaseId;
            const primary = displayBaseNameByIndex(i);
            const secondary = b?.name ? b.name : "";
            const human = `${primary}${secondary ? ` (${secondary})` : ""}`;

            return (
              <TopBarMenuRow
                key={b?.id || i}
                selected={selected}
                primary={primary}
                secondary={secondary}
                menuItemSx={menuItemSx}
                danger={danger}
                onClick={() => handleSelectBase(b?.id)}
                onAskDuplicate={duplicateBase ? () => duplicateBase(b?.id) : null}
                duplicateTooltip="Duplicate Base"
                duplicateDisabled={duplicatingBase}
                duplicateLoading={duplicatingBase}
                onAskDelete={deleteBase && openConfirm ? () => askDelete("base", b?.id, human) : null}
                deleteTooltip="Delete Base"
                dangerDelete
                disabled={!b?.id}
              />
            );
          })
        )}

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        <MenuItem onClick={handleNewBase} disabled={!createBase || creatingBase} sx={{ ...menuItemSx, fontWeight: 900 }}>
          <ListItemIcon sx={{ minWidth: 28, color: "var(--brand-fg)" }}>
            {creatingBase ? <CircularProgress size={16} /> : <AddRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary="+ New Base" primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }} />
        </MenuItem>

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        <MenuItem
          onClick={() => selectedBaseId && deleteBase && askDelete("base", selectedBaseId, currentBaseLabel)}
          disabled={!deleteBase || !selectedBaseId || deletingBase}
          sx={{ ...menuItemSx, color: danger, "&:hover": { background: alpha("#ff5252", 0.12) } }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: danger }}>
            {deletingBase ? <CircularProgress size={16} /> : <DeleteOutlineRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary="Delete Base"
            secondary={selectedBaseId ? currentBaseLabel : ""}
            primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
            secondaryTypographyProps={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}
          />
        </MenuItem>
      </Menu>

      {/* ========================= Plan Menu ========================= */}
      <Menu
        anchorEl={planAnchorEl}
        open={openPlan}
        onClose={closeAll}
        PaperProps={{ sx: menuPaperSx }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {!selectedBaseId ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemText primary="Select a base first" primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : safePlans.length === 0 ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemText primary="No plans" primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : (
          safePlans.map((p, i) => {
            const selected = p?.id === selectedPlanId;
            const primary = displayPlanNameByIndex(i);
            const secondary = p?.name ? p.name : "";
            const human = `${primary}${secondary ? ` (${secondary})` : ""}`;

            return (
              <TopBarMenuRow
                key={p?.id || i}
                selected={selected}
                primary={primary}
                secondary={secondary}
                menuItemSx={menuItemSx}
                danger={danger}
                onClick={() => handleSelectPlan(p?.id)}
                onAskDuplicate={duplicatePlan ? () => duplicatePlan(p?.id) : null}
                duplicateTooltip="Duplicate Plan"
                duplicateDisabled={duplicatingPlan}
                duplicateLoading={duplicatingPlan}
                onAskDelete={deletePlan && openConfirm ? () => askDelete("plan", p?.id, human) : null}
                deleteTooltip="Delete Plan"
                dangerDelete
                disabled={!p?.id}
              />
            );
          })
        )}

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        <MenuItem
          onClick={handleNewPlan}
          disabled={!createPlan || creatingPlan || !canCreatePlan}
          sx={{ ...menuItemSx, fontWeight: 900 }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: "var(--brand-fg)" }}>
            {creatingPlan ? <CircularProgress size={16} /> : <AddRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary="+ New Plan" primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }} />
        </MenuItem>

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        <MenuItem
          onClick={() => selectedPlanId && deletePlan && askDelete("plan", selectedPlanId, currentPlanLabel)}
          disabled={!deletePlan || !selectedPlanId || deletingPlan}
          sx={{ ...menuItemSx, color: danger, "&:hover": { background: alpha("#ff5252", 0.12) } }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: danger }}>
            {deletingPlan ? <CircularProgress size={16} /> : <DeleteOutlineRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary="Delete Plan"
            secondary={selectedPlanId ? currentPlanLabel : ""}
            primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
            secondaryTypographyProps={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}
          />
        </MenuItem>
      </Menu>

      {/* ========================= 提案 Menu ========================= */}
      <Menu
        anchorEl={optionAnchorEl}
        open={openOption}
        onClose={closeAll}
        PaperProps={{ sx: menuPaperSx }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {!selectedBaseId ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemText primary="Select base first" primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : (
          <>
            <TopBarMenuRow
              selected={!activeOptionId}
              primary="デフォルト（いまの Plan の素の見た目）"
              menuItemSx={menuItemSx}
              danger={danger}
              onClick={() => { closeAll?.(); applyOption(null); }}
            />
            {viewOptions.map((o) => {
              const planRef = resolveProposalPlan(o?.planId ?? null, proposalPlans);
              const planLabel =
                planRef.kind === "ok" ? planRef.name
                  : planRef.kind === "none" ? "躯体のみ"
                    : "Plan が見つかりません";
              const broken = planRef.kind === "missing";
              return (
                <TopBarMenuRow
                  key={o.id}
                  selected={o.id === activeOptionId}
                  primary={o.name || "提案"}
                  secondary={planLabel}
                  menuItemSx={menuItemSx}
                  danger={danger}
                  onClick={() => { closeAll?.(); applyOption(o.id); }}
                  onAskDelete={() => removeOption(o.id)}
                  deleteTooltip="Delete Proposal"
                  dangerDelete
                  dim={broken}
                />
              );
            })}
          </>
        )}

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        {/* 提案は登録時のスナップショット。見た目を変えたらここで明示的に上書きする
            （自動保存はしない＝意図しない破壊を防ぐ。仕様 §4）。 */}
        {activeOptionId && (
          <MenuItem
            onClick={() => { closeAll?.(); updateOption(activeOptionId); }}
            disabled={optionBusy}
            sx={{ ...menuItemSx, fontWeight: 900 }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: "var(--brand-fg)" }}>
              {optionBusy ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary="この提案を更新"
              secondary="いまの Plan と見た目で上書きする"
              primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
              secondaryTypographyProps={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}
            />
          </MenuItem>
        )}

        <MenuItem
          onClick={openOptionDialog}
          disabled={!selectedBaseId || optionBusy}
          sx={{ ...menuItemSx, fontWeight: 900 }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: "var(--brand-fg)" }}>
            {optionBusy ? <CircularProgress size={16} /> : <AddRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={activeOptionId ? "+ 新しい提案として保存" : "+ いまの状態を提案として登録"}
            secondary="使用中の Plan と見た目をまとめて保存"
            primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
            secondaryTypographyProps={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}
          />
        </MenuItem>
      </Menu>

      {/* 提案名の入力（プレビュー側と同じ操作をエディタからも行えるように） */}
      <Dialog open={optionDialogOpen} onClose={() => setOptionDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>いまの状態を提案として登録</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, opacity: 0.7, mb: 1.5 }}>
            使用中の Plan と、床壁天井の仕上げ・照明・家具の素材と置き換えをまとめて保存します。
          </Typography>
          <TextField
            autoFocus fullWidth size="small" label="提案名"
            value={optionNameDraft}
            onChange={(e) => setOptionNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitOptionDialog(); } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOptionDialogOpen(false)} sx={{ textTransform: "none" }}>キャンセル</Button>
          <Button onClick={() => { void submitOptionDialog(); }} disabled={!optionNameDraft.trim()} variant="contained" sx={{ textTransform: "none" }}>登録</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
