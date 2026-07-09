// src/features/layout/components/Header/components/Menus.jsx
import React, { useMemo, useCallback } from "react";
import { Menu, MenuItem, ListItemText, ListItemIcon, Divider, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useWorkspaceStructureStore } from "@layout/features/layout/store/useWorkspaceStructureStore";
import TopBarMenuRow from "./TopBarMenuRow";

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
  const creatingOption = useWorkspaceStructureStore((s) => s.creatingOption);

  const deletingBase = useWorkspaceStructureStore((s) => s.deletingBase);
  const deletingPlan = useWorkspaceStructureStore((s) => s.deletingPlan);
  const deletingOption = useWorkspaceStructureStore((s) => s.deletingOption);

  const duplicatingBase = useWorkspaceStructureStore((s) => s.duplicatingBase);
  const duplicatingPlan = useWorkspaceStructureStore((s) => s.duplicatingPlan);
  const duplicatingOption = useWorkspaceStructureStore((s) => s.duplicatingOption);

  const createBase = useWorkspaceStructureStore((s) => s.createBase);
  const createPlan = useWorkspaceStructureStore((s) => s.createPlan);
  const createOption = useWorkspaceStructureStore((s) => s.createOption);

  const deleteBase = useWorkspaceStructureStore((s) => s.deleteBase);
  const deletePlan = useWorkspaceStructureStore((s) => s.deletePlan);
  const deleteOption = useWorkspaceStructureStore((s) => s.deleteOption);

  const duplicateBase = useWorkspaceStructureStore((s) => s.duplicateBase);
  const duplicatePlan = useWorkspaceStructureStore((s) => s.duplicatePlan);
  const duplicateOption = useWorkspaceStructureStore((s) => s.duplicateOption);

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
      background: alpha("#0b1022", 0.92),
      border: `1px solid ${alpha("#fff", 0.10)}`,
      backdropFilter: "blur(10px)",
      color: "#fff",
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

  const handleNewOption = useCallback(async () => {
    closeAll?.();
    if (!selectedBaseId || !selectedPlanId) return;
    await createOption?.({ baseId: selectedBaseId, planId: selectedPlanId });
  }, [closeAll, createOption, selectedBaseId, selectedPlanId]);

  const canCreatePlan = Boolean(selectedBaseId);
  const canCreateOption = Boolean(selectedBaseId && selectedPlanId);

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
          <ListItemIcon sx={{ minWidth: 28, color: "#fff" }}>
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
            secondaryTypographyProps={{ fontSize: 11, color: alpha("#fff", 0.55) }}
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
          <ListItemIcon sx={{ minWidth: 28, color: "#fff" }}>
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
            secondaryTypographyProps={{ fontSize: 11, color: alpha("#fff", 0.55) }}
          />
        </MenuItem>
      </Menu>

      {/* ========================= Option Menu ========================= */}
      <Menu
        anchorEl={optionAnchorEl}
        open={openOption}
        onClose={closeAll}
        PaperProps={{ sx: menuPaperSx }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {!selectedBaseId || !selectedPlanId ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemText primary="Select base & plan first" primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : optionsLoading ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemIcon sx={{ minWidth: 28, color: "#fff" }}>
              <CircularProgress size={16} />
            </ListItemIcon>
            <ListItemText primary="Loading options..." primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : safeOptions.length === 0 ? (
          <MenuItem disabled sx={{ mx: 0.75, my: 0.25, borderRadius: 1.5, opacity: 0.7 }}>
            <ListItemText primary="No options" primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }} />
          </MenuItem>
        ) : (
          safeOptions.map((o, i) => {
            const selected = o?.id === selectedOptionId;
            const primary = displayOptionNameByIndex(i);
            const secondary = o?.name ? o.name : "";
            const human = `${primary}${secondary ? ` (${secondary})` : ""}`;

            return (
              <TopBarMenuRow
                key={o?.id || i}
                selected={selected}
                primary={primary}
                secondary={secondary}
                menuItemSx={menuItemSx}
                danger={danger}
                onClick={() => handleSelectOption(o?.id)}
                onAskDuplicate={duplicateOption ? () => duplicateOption(o?.id) : null}
                duplicateTooltip="Duplicate Option"
                duplicateDisabled={duplicatingOption}
                duplicateLoading={duplicatingOption}
                onAskDelete={deleteOption && openConfirm ? () => askDelete("option", o?.id, human) : null}
                deleteTooltip="Delete Option"
                dangerDelete
                disabled={!o?.id}
              />
            );
          })
        )}

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        <MenuItem
          onClick={handleNewOption}
          disabled={!createOption || creatingOption || !canCreateOption}
          sx={{ ...menuItemSx, fontWeight: 900 }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: "#fff" }}>
            {creatingOption ? <CircularProgress size={16} /> : <AddRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary="+ New Option" primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }} />
        </MenuItem>

        <Divider sx={{ my: 0.75, borderColor: alpha("#fff", 0.08) }} />

        <MenuItem
          onClick={() => selectedOptionId && deleteOption && askDelete("option", selectedOptionId, currentOptionLabel)}
          disabled={!deleteOption || !selectedOptionId || deletingOption}
          sx={{ ...menuItemSx, color: danger, "&:hover": { background: alpha("#ff5252", 0.12) } }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: danger }}>
            {deletingOption ? <CircularProgress size={16} /> : <DeleteOutlineRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary="Delete Option"
            secondary={selectedOptionId ? currentOptionLabel : ""}
            primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
            secondaryTypographyProps={{ fontSize: 11, color: alpha("#fff", 0.55) }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
