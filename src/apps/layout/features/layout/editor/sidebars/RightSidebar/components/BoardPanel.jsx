// src/features/layout/components/RightSidebar/components/BoardPanel.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Box, Typography, Stack, IconButton, Chip, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded"; // Base
import ViewAgendaRoundedIcon from "@mui/icons-material/ViewAgendaRounded"; // Plan
import BurstModeRoundedIcon from "@mui/icons-material/BurstModeRounded"; // Option

import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useWorkspaceStructureStore } from "@layout/features/layout/store/useWorkspaceStructureStore";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeString(v, fb = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fb;
}

// 笨・1->A,2->B...
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

export default function BoardPanel() {
  const theme = useTheme();

  // ===== store (data) =====
  const bases = useWorkspaceStructureStore((s) => s.bases);
  const plansOfSelectedBase = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s) => s.options);

  // ===== store (selection) =====
  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);

  // ===== store (actions) =====
  const selectBase = useWorkspaceStructureStore((s) => s.selectBase);
  const selectPlan = useWorkspaceStructureStore((s) => s.selectPlan);
  const selectOption = useWorkspaceStructureStore((s) => s.selectOption);

  const deleteBase = useWorkspaceStructureStore((s) => s.deleteBase);
  const deletePlan = useWorkspaceStructureStore((s) => s.deletePlan);
  const deleteOption = useWorkspaceStructureStore((s) => s.deleteOption);

  const duplicatePlan = useWorkspaceStructureStore((s) => s.duplicatePlan);
  const duplicateOption = useWorkspaceStructureStore((s) => s.duplicateOption);

  const baseList = useMemo(() => safeArray(bases), [bases]);
  const planList = useMemo(() => safeArray(plansOfSelectedBase), [plansOfSelectedBase]);
  const optionList = useMemo(() => safeArray(options), [options]);

  // 笨・ID縺ｯ 窶懷ｮ櫑D窶・繧呈怙蜆ｪ蜈茨ｼ郁｡ｨ遉ｺ蜷阪ｒfallback縺ｫ縺励↑縺・ｼ・
  const getBaseId = useCallback((b) => safeString(b?.id || b?.baseId || b?.key || b?.docId || "", ""), []);
  const getPlanId = useCallback((p) => safeString(p?.id || p?.planId || p?.key || p?.docId || "", ""), []);
  const getOptionId = useCallback((o) => safeString(o?.id || o?.optionId || o?.key || o?.docId || "", ""), []);

  // 螻暮幕迥ｶ諷・
  const [expandedBaseIds, setExpandedBaseIds] = useState(() => new Set());
  const [expandedPlanIds, setExpandedPlanIds] = useState(() => new Set());

  // 驕ｸ謚槭′螟峨ｏ縺｣縺溘ｉ隕ｪ繧帝幕縺・
  useEffect(() => {
    if (selectedBaseId) {
      setExpandedBaseIds((prev) => {
        const next = new Set(prev);
        next.add(selectedBaseId);
        return next;
      });
    }
  }, [selectedBaseId]);

  useEffect(() => {
    if (selectedPlanId) {
      setExpandedPlanIds((prev) => {
        const next = new Set(prev);
        next.add(selectedPlanId);
        return next;
      });
    }
  }, [selectedPlanId]);

  const toggleBaseExpanded = useCallback((baseId) => {
    setExpandedBaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(baseId)) next.delete(baseId);
      else next.add(baseId);
      return next;
    });
  }, []);

  const togglePlanExpanded = useCallback((planId) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }, []);

  const rowSx = useMemo(
    () => ({
      width: "100%",
      borderRadius: 2,
      px: 1,
      py: 0.75,
      display: "flex",
      alignItems: "center",
      gap: 0.75,
      cursor: "pointer",
      userSelect: "none",
      border: `1px solid ${alpha("#fff", 0.08)}`,
      bgcolor: alpha("#fff", 0.02),
      "&:hover": { bgcolor: alpha("#fff", 0.05) },

      "& .rowActions": {
        opacity: 0,
        pointerEvents: "none",
        transform: "translateX(4px)",
        transition: "opacity 120ms ease, transform 120ms ease",
      },
      "&:hover .rowActions": {
        opacity: 1,
        pointerEvents: "auto",
        transform: "translateX(0px)",
      },
    }),
    []
  );

  const activeRowSx = useCallback(
    (active) => ({
      ...rowSx,
      border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.4) : alpha("#fff", 0.08)}`,
      bgcolor: active ? alpha(theme.palette.primary.main, 0.16) : alpha("#fff", 0.02),
    }),
    [rowSx, theme.palette.primary.main]
  );

  const iconChipSx = {
    height: 20,
    "& .MuiChip-label": { px: 0.75, fontSize: 11, opacity: 0.9 },
    bgcolor: alpha("#fff", 0.06),
    border: `1px solid ${alpha("#fff", 0.1)}`,
  };

  const sectionTitleSx = {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.9,
    letterSpacing: 0.2,
  };

  const labelSx = {
    fontSize: 12,
    fontWeight: 600,
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const actionBtnSx = useCallback(
    (danger = false) => ({
      width: 28,
      height: 28,
      borderRadius: 2,
      color: danger ? alpha("#ff6b6b", 0.92) : alpha("#fff", 0.86),
      "&:hover": { bgcolor: danger ? alpha("#ff6b6b", 0.14) : alpha("#fff", 0.1) },
    }),
    []
  );

  // 笨・陦ｨ遉ｺ蜷阪・ index 縺ｧ豎ｺ繧√ｋ・・winmotion鬚ｨ・・
  const baseLabel = (_b, index) => `Base-${numToAlpha(index + 1)}`;
  const planLabel = (_p, index) => `Plan-${numToAlpha(index + 1)}`;
  const optionLabel = (o, index) =>
    safeString(o?.name, "") || safeString(o?.label, "") || safeString(o?.id, `A-${index + 1}`);

  const confirmDelete = useCallback((kindLabel, nameLabel) => {
    const name = safeString(nameLabel, "");
    const msg = kindLabel + (name ? `「${name}」` : "") + "を削除しますか？\nこの操作は元に戻せません。";
    return window.confirm(msg);
  }, []);

  const handleDeleteBase = useCallback(
    (baseId, label) => {
      if (!baseId || !deleteBase) return;
      if (!confirmDelete("Base", label)) return;
      deleteBase(baseId);
    },
    [deleteBase, confirmDelete]
  );

  const handleDeletePlan = useCallback(
    (planId, label) => {
      if (!planId || !deletePlan) return;
      if (!confirmDelete("Plan", label)) return;
      deletePlan(planId);
    },
    [deletePlan, confirmDelete]
  );

  const handleDeleteOption = useCallback(
    (optId, label) => {
      if (!optId || !deleteOption) return;
      if (!confirmDelete("Option", label)) return;
      deleteOption(optId);
    },
    [deleteOption, confirmDelete]
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ px: 1.25, py: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={sectionTitleSx}>Project</Typography>
          <Chip label={`Bases ${baseList.length}`} size="small" sx={iconChipSx} />
          <Chip label={`Plans ${planList.length}`} size="small" sx={iconChipSx} />
          <Chip label={`Options ${optionList.length}`} size="small" sx={iconChipSx} />
        </Stack>

        <Typography sx={{ fontSize: 11, opacity: 0.65 }}>
          {selectedBaseId && selectedPlanId ? "Selected" : "Select"}
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ px: 1, pb: 1, overflow: "auto", minHeight: 0 }}>
        <Stack spacing={0.8}>
          {baseList.length === 0 ? (
            <Box sx={{ p: 1.25, borderRadius: 2, border: `1px dashed ${alpha("#fff", 0.16)}`, bgcolor: alpha("#fff", 0.03) }}>
              <Typography sx={{ fontSize: 12, opacity: 0.78 }}>Base 縺後≠繧翫∪縺帙ｓ</Typography>
            </Box>
          ) : (
            baseList.map((b, bi) => {
              const baseId = getBaseId(b);
              const baseName = baseLabel(b, bi);
              const isSelectedBase = baseId && baseId === selectedBaseId;
              const isExpanded = baseId ? expandedBaseIds.has(baseId) : false;

              return (
                <Box key={baseId || `base_${bi}`} sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                  {/* Base row */}
                  <Box
                    sx={activeRowSx(isSelectedBase)}
                    onClick={() => {
                      if (!baseId) return;
                      selectBase?.(baseId);
                      setExpandedBaseIds((prev) => {
                        const next = new Set(prev);
                        next.add(baseId);
                        return next;
                      });
                    }}
                  >
                    <Tooltip title={isExpanded ? "Collapse" : "Expand"}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (baseId) toggleBaseExpanded(baseId);
                        }}
                        sx={{ color: alpha("#fff", 0.82) }}
                      >
                        {isExpanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>

                    <LayersRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />
                    <Typography sx={labelSx}>{baseName}</Typography>

                    {!!deleteBase && (
                      <Box className="rowActions" sx={{ display: "flex", gap: 0.25 }}>
                        <Tooltip title="Delete Base">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteBase(baseId, baseName);
                              }}
                              sx={actionBtnSx(true)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="inherit" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    )}

                    {isSelectedBase && <CheckRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />}
                  </Box>

                  {/* Plans */}
                  {isExpanded && isSelectedBase && (
                    <Box sx={{ pl: 3.75, display: "flex", flexDirection: "column", gap: 0.6 }}>
                      {planList.length === 0 ? (
                        <Box sx={{ p: 1, borderRadius: 2, border: `1px dashed ${alpha("#fff", 0.14)}`, bgcolor: alpha("#fff", 0.02) }}>
                          <Typography sx={{ fontSize: 12, opacity: 0.72 }}>Plan 縺後≠繧翫∪縺帙ｓ</Typography>
                        </Box>
                      ) : (
                        planList.map((p, pi) => {
                          const planId = getPlanId(p);
                          const planName = planLabel(p, pi);
                          const isSelectedPlan = planId && planId === selectedPlanId;
                          const isPlanExpanded = planId ? expandedPlanIds.has(planId) : false;

                          return (
                            <Box key={planId || `plan_${pi}`} sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                              {/* Plan row */}
                              <Box
                                sx={{
                                  ...activeRowSx(isSelectedPlan),
                                  ...(planId ? null : { opacity: 0.55, cursor: "not-allowed" }),
                                }}
                                onClick={() => {
                                  if (!planId) return;
                                  selectPlan?.(planId);
                                  setExpandedPlanIds((prev) => {
                                    const next = new Set(prev);
                                    next.add(planId);
                                    return next;
                                  });
                                }}
                              >
                                <Tooltip title={isPlanExpanded ? "Collapse" : "Expand"}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (planId) togglePlanExpanded(planId);
                                    }}
                                    sx={{ color: alpha("#fff", 0.82) }}
                                  >
                                    {isPlanExpanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>

                                <ViewAgendaRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />
                                <Typography sx={labelSx}>{planName}</Typography>

                                <Box className="rowActions" sx={{ display: "flex", gap: 0.25 }}>
                                  <Tooltip title="Duplicate Plan">
                                    <span>
                                      <IconButton
                                        size="small"
                                        disabled={!duplicatePlan || !planId}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          duplicatePlan?.(planId);
                                        }}
                                        sx={actionBtnSx(false)}
                                      >
                                        <ContentCopyRoundedIcon fontSize="inherit" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>

                                  <Tooltip title="Delete Plan">
                                    <span>
                                      <IconButton
                                        size="small"
                                        disabled={!deletePlan || !planId}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDeletePlan(planId, planName);
                                        }}
                                        sx={actionBtnSx(true)}
                                      >
                                        <DeleteOutlineRoundedIcon fontSize="inherit" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Box>

                                {isSelectedPlan && <CheckRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />}
                              </Box>

                              {/* Options */}
                              {isPlanExpanded && isSelectedPlan && (
                                <Box sx={{ pl: 3.75, display: "flex", flexDirection: "column", gap: 0.6 }}>
                                  {optionList.length === 0 ? (
                                    <Box sx={{ p: 1, borderRadius: 2, border: `1px dashed ${alpha("#fff", 0.14)}`, bgcolor: alpha("#fff", 0.02) }}>
                                      <Typography sx={{ fontSize: 12, opacity: 0.72 }}>Option 縺後≠繧翫∪縺帙ｓ</Typography>
                                    </Box>
                                  ) : (
                                    optionList.map((o, oi) => {
                                      const optId = getOptionId(o);
                                      const optName = optionLabel(o, oi);
                                      const isSelectedOpt = optId && optId === selectedOptionId;

                                      return (
                                        <Box
                                          key={optId || `opt_${oi}`}
                                          sx={{ ...activeRowSx(isSelectedOpt), py: 0.6 }}
                                          onClick={() => {
                                            if (!optId) return;
                                            selectOption?.(optId);
                                          }}
                                        >
                                          <BurstModeRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />
                                          <Typography sx={labelSx}>{optName}</Typography>

                                          <Box className="rowActions" sx={{ display: "flex", gap: 0.25 }}>
                                            <Tooltip title="Duplicate Option">
                                              <span>
                                                <IconButton
                                                  size="small"
                                                  disabled={!duplicateOption || !optId}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    duplicateOption?.(optId);
                                                  }}
                                                  sx={actionBtnSx(false)}
                                                >
                                                  <ContentCopyRoundedIcon fontSize="inherit" />
                                                </IconButton>
                                              </span>
                                            </Tooltip>

                                            <Tooltip title="Delete Option">
                                              <span>
                                                <IconButton
                                                  size="small"
                                                  disabled={!deleteOption || !optId}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDeleteOption(optId, optName);
                                                  }}
                                                  sx={actionBtnSx(true)}
                                                >
                                                  <DeleteOutlineRoundedIcon fontSize="inherit" />
                                                </IconButton>
                                              </span>
                                            </Tooltip>
                                          </Box>

                                          {isSelectedOpt && <CheckRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />}
                                        </Box>
                                      );
                                    })
                                  )}
                                </Box>
                              )}
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Stack>
      </Box>
    </Box>
  );
}
