// src/features/layout/components/Header/components/TopBar.jsx
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Box, Button, Chip, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

import { useWorkspaceStructureStore } from "@layout/features/layout/store/useWorkspaceStructureStore";

// ✁E刁E��コンポ�EネンチE
import Menus from "./Menus";
import ConfirmDialog from "./ConfirmDialog";

// ✅ 2D/3D モード
import EditorModeToggle from "./EditorModeToggle";
import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

// ✁EToolButtons�E�Erops無し運用�E�E
import MaterialPickerButton from "./ToolButtons/MaterialPickerButton";
import MoveButton from "./ToolButtons/MoveButton";
import RotateButton from "./ToolButtons/RotateButton";
import ScaleButton from "./ToolButtons/ScaleButton";
import WorldButton from "./ToolButtons/WorldButton";
import LocalButton from "./ToolButtons/LocalButton";
import SnapButton from "./ToolButtons/SnapButton";
import ToolDivider from "./ToolButtons/ToolDivider";
import SaveButton from "./ToolButtons/SaveButton";
import UndoButton from "./ToolButtons/UndoButton";
import RedoButton from "./ToolButtons/RedoButton";

// ===== 表示ヘルパ！EopBarのピル用だけ残す�E�E====
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

/**
 * ✁ETopBar は workspace structure めEStore から読む�E�Erops地獁E��断つ�E�E
 * ✁Eselector を「�E割」して getSnapshot 警告を回避
 */
export default function TopBar({
  // 表示だぁEprops に残す
  boardId, // 現状未使用だが親から来るなら残してOK�E�忁E��なければ外してOK�E�E
  meta, // 同丁E
  loadingMeta,

  // 右側に差し込み
  rightActions,

  // Save
  dirty = false,
  saving = false,
  onSave,
}) {
  const theme = useTheme();

  // ✅ 2D/3D モード
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const is3DMode = editorMode === EDITOR_MODES.PRESENT_3D;

  // =========================
  // ✁EZustand selectors�E�最小限�E�E
  // =========================
  const bases = useWorkspaceStructureStore((s) => s.bases);
  const plansOfSelectedBase = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s) => s.options);
  const optionsLoading = useWorkspaceStructureStore((s) => s.optionsLoading);

  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);

  // ✁Eundefined で落ちなぁE��ぁE��忁E��配�E匁E
  const safeBases = useMemo(() => (Array.isArray(bases) ? bases : []), [bases]);
  const safePlans = useMemo(
    () => (Array.isArray(plansOfSelectedBase) ? plansOfSelectedBase : []),
    [plansOfSelectedBase]
  );
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

  const selectedOptionIndex = useMemo(() => {
    if (!selectedOptionId) return 0;
    const idx = safeOptions.findIndex((o) => o?.id === selectedOptionId);
    return idx >= 0 ? idx : 0;
  }, [safeOptions, selectedOptionId]);

  // Compact Menu UI state
  const [baseAnchorEl, setBaseAnchorEl] = useState(null);
  const [planAnchorEl, setPlanAnchorEl] = useState(null);
  const [optionAnchorEl, setOptionAnchorEl] = useState(null);
  const openBase = Boolean(baseAnchorEl);
  const openPlan = Boolean(planAnchorEl);
  const openOption = Boolean(optionAnchorEl);

  const closeAll = useCallback(() => {
    setBaseAnchorEl(null);
    setPlanAnchorEl(null);
    setOptionAnchorEl(null);
  }, []);

  // Ctrl+S 保孁E
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (!metaOrCtrl) return;
      if (e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (typeof onSave === "function" && !saving) onSave();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, saving]);

  // styles
  const line = alpha(theme.palette.common.white, 0.08);
  const fg = alpha("#fff", 0.92);

  const pillBtnSx = {
    height: 30,
    borderRadius: 999,
    px: 1.1,
    minWidth: 0,
    fontWeight: 900,
    textTransform: "none",
    color: fg,
    background: alpha("#fff", 0.06),
    border: `1px solid ${alpha("#fff", 0.12)}`,
    "&:hover": {
      background: alpha("#fff", 0.1),
      borderColor: alpha("#fff", 0.18),
    },
  };

  const pillBtnActiveSx = {
    background: alpha(theme.palette.primary.main, 0.22),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
    "&:hover": {
      background: alpha(theme.palette.primary.main, 0.28),
      borderColor: alpha(theme.palette.primary.main, 0.42),
    },
  };

  const statusChipSx = {
    height: 24,
    borderRadius: 999,
    fontWeight: 900,
    background: dirty ? alpha("#ffcc00", 0.14) : alpha("#00d084", 0.10),
    border: `1px solid ${dirty ? alpha("#ffcc00", 0.35) : alpha("#00d084", 0.25)}`,
    color: fg,
    "& .MuiChip-label": { px: 1.0, fontSize: 12 },
  };

  const statusLabel = saving ? "Saving..." : dirty ? "◁EUnsaved" : "Saved";

  // ピル表示�E�EopBarは “見た目 Eだけ！E
  const basePillLabel = safeBases.length > 0 ? displayBaseNameByIndex(selectedBaseIndex) : "No Base";
  const planPillLabel = safePlans.length > 0 ? displayPlanNameByIndex(selectedPlanIndex) : "Plan-A";
  const optionPillLabel =
    safeOptions.length > 0
      ? safeOptions[selectedOptionIndex]?.name ||
        safeOptions[selectedOptionIndex]?.id ||
        displayOptionNameByIndex(selectedOptionIndex)
      : "A-1";

  // ===== Confirm Dialog =====
  const [confirm, setConfirm] = useState({
    open: false,
    type: /** @type {"base"|"plan"|"option"|null} */ (null),
    targetId: "",
    title: "",
    description: "",
    busy: false,
  });

  const closeConfirm = useCallback(() => {
    setConfirm((s) => ({ ...s, open: false, type: null, targetId: "", title: "", description: "", busy: false }));
  }, []);

  // Menus から呼ぶだけ（実行�E ConfirmDialog の onConfirm で�E�E
  const openConfirm = useCallback(
    ({ type, targetId, title, description }) => {
      closeAll();
      setConfirm({ open: true, type, targetId, title, description, busy: false });
    },
    [closeAll]
  );

  // delete は store の関数を呼ぶ
  const deleteBase = useWorkspaceStructureStore((s) => s.deleteBase);
  const deletePlan = useWorkspaceStructureStore((s) => s.deletePlan);
  const deleteOption = useWorkspaceStructureStore((s) => s.deleteOption);

  const runDelete = useCallback(async () => {
    if (!confirm.open || !confirm.type || !confirm.targetId) return;

    try {
      setConfirm((s) => ({ ...s, busy: true }));

      if (confirm.type === "base") await deleteBase?.(confirm.targetId);
      if (confirm.type === "plan") await deletePlan?.(confirm.targetId);
      if (confirm.type === "option") await deleteOption?.(confirm.targetId);

      closeConfirm();
    } catch (e) {
      console.error(e);
      setConfirm((s) => ({ ...s, busy: false }));
    }
  }, [confirm, deleteBase, deletePlan, deleteOption, closeConfirm]);

  // ✁E重要E��選択だけしたいので「basesがあるなめEMenu は開ける、E
  const canCreateBase = Boolean(useWorkspaceStructureStore((s) => s.createBase)); // 表示制御用だぁE
  const disableBaseMenu = safeBases.length === 0 && !canCreateBase;
  const disablePlanMenu = !selectedBaseId;
  const disableOptionMenu = !selectedBaseId || !selectedPlanId;

  return (
    <Box
      sx={{
        height: 48,
        px: 1,
        borderBottom: `1px solid ${line}`,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        columnGap: 1,
        minWidth: 0,
      }}
    >
      {/* LEFT: Base/Plan/Option Pills + Status */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Button
            size="small"
            endIcon={<ExpandMoreRoundedIcon />}
            onClick={(e) => setBaseAnchorEl(e.currentTarget)}
            sx={{
              ...pillBtnSx,
              ...(openBase ? pillBtnActiveSx : null),
              ...(safeBases.length === 0 ? { borderColor: alpha("#ffcc00", 0.35), background: alpha("#ffcc00", 0.08) } : null),
            }}
            disabled={disableBaseMenu}
          >
            {basePillLabel}
          </Button>

          <Button
            size="small"
            endIcon={<ExpandMoreRoundedIcon />}
            onClick={(e) => setPlanAnchorEl(e.currentTarget)}
            sx={{ ...pillBtnSx, ...(openPlan ? pillBtnActiveSx : null) }}
            disabled={disablePlanMenu}
          >
            {planPillLabel}
          </Button>

          <Button
            size="small"
            endIcon={<ExpandMoreRoundedIcon />}
            onClick={(e) => setOptionAnchorEl(e.currentTarget)}
            sx={{ ...pillBtnSx, ...(openOption ? pillBtnActiveSx : null) }}
            disabled={disableOptionMenu || optionsLoading}
          >
            {optionsLoading ? "Options..." : optionPillLabel}
          </Button>

          <Chip sx={statusChipSx} label={statusLabel} />
        </Box>
      </Box>

      {/* CENTER: 2D/3D モードトグル（一等地） */}
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0 }}>
        <EditorModeToggle />
      </Box>

      {/* RIGHT: ToolButtons（モード別ゲート） */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 0.8, minWidth: 0 }}>
        {loadingMeta ? <CircularProgress size={14} /> : null}

        <ToolDivider />
        {/* ✅ 3D 演出モード限定ツール（材質・スケール・座標系） */}
        {is3DMode ? <MaterialPickerButton /> : null}
        <MoveButton />
        <RotateButton />
        {is3DMode ? <ScaleButton /> : null}

        {/* Space（3Dのみ） */}
        {is3DMode ? <WorldButton /> : null}
        {is3DMode ? <LocalButton /> : null}

        <ToolDivider />

        {/* Snap */}
        <SnapButton />

        <ToolDivider />

        {/* Save/Undo/Redo */}
        <SaveButton dirty={dirty} saving={saving} onSave={onSave} />
        <UndoButton />
        <RedoButton />

        {rightActions ? <Box sx={{ ml: 0.5, display: "flex", alignItems: "center" }}>{rightActions}</Box> : null}
      </Box>

      {/* Menus */}
      <Menus
        baseAnchorEl={baseAnchorEl}
        planAnchorEl={planAnchorEl}
        optionAnchorEl={optionAnchorEl}
        openBase={openBase}
        openPlan={openPlan}
        openOption={openOption}
        closeAll={closeAll}
        openConfirm={openConfirm}
      />

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title || "Confirm"}
        description={confirm.description || "Are you sure?"}
        busy={confirm.busy}
        onClose={closeConfirm}
        onConfirm={runDelete}
      />
    </Box>
  );
}