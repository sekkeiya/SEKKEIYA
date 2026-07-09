// src/features/layout/components/RightSidebar/components/BoardPanel.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Typography, Stack, IconButton, Chip, Tooltip, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ViewAgendaRoundedIcon from "@mui/icons-material/ViewAgendaRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useAppStore } from "@desktop/store/useAppStore";
import { useAuthStore } from "@desktop/store/useAuthStore";
import { useWorkspaceLayouts } from "@desktop/features/dsl/layout/hooks/useWorkspaces";
import { deleteLayout } from "@desktop/features/dsl/layout/utils/workspaceStubs";

function safeString(v, fb = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fb;
}

export default function BoardPanel() {
  const theme = useTheme();

  // Stores
  const { currentUser } = useAuthStore();
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const panelSelections = useAppStore((state) => state.panelSelections);
  const setPanelSelection = useAppStore((state) => state.setPanelSelection);

  const selectedLayoutId = panelSelections?.layout?.selectedLayoutId;
  
  // Data
  const { layouts, loading } = useWorkspaceLayouts(activeProjectId, "layout");

  const layoutList = useMemo(() => {
    return Array.isArray(layouts) ? layouts : [];
  }, [layouts]);

  // Actions
  const handleSelectLayout = useCallback((layout) => {
    if (!layout?.id) return;
    setPanelSelection("layout", {
      selectedLayoutId: layout.id,
      baseId: undefined, planId: undefined, optionId: undefined,
      itemType: "Layout",
      ...layout
    });
  }, [setPanelSelection]);

  const handleDeleteLayout = useCallback(async (layoutId, label) => {
    if (!layoutId || !activeProjectId) return;
    const name = safeString(label, "Layout");
    const msg = `Layout「${name}」を削除しますか？\nこの操作は元に戻せません。`;
    if (!window.confirm(msg)) return;
    
    try {
      await deleteLayout(activeProjectId, 'layout', layoutId);
      if (selectedLayoutId === layoutId) {
        setPanelSelection('layout', {
          selectedLayoutId: null,
          baseId: undefined, planId: undefined, optionId: undefined,
          itemType: "Project",
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeProjectId, selectedLayoutId, setPanelSelection]);

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

  if (loading) {
     return (
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} sx={{ color: "rgba(255,255,255,0.3)" }} />
        </Box>
     );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ px: 1.25, py: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={sectionTitleSx}>Project</Typography>
          <Chip label={`Layouts ${layoutList.length}`} size="small" sx={iconChipSx} />
        </Stack>
        <Typography sx={{ fontSize: 11, opacity: 0.65 }}>
          {selectedLayoutId ? "Selected" : "Select"}
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ px: 1, pb: 1, overflow: "auto", minHeight: 0 }}>
        <Stack spacing={0.8}>
          {layoutList.length === 0 ? (
            <Box sx={{ p: 1.25, borderRadius: 2, border: `1px dashed ${alpha("#fff", 0.16)}`, bgcolor: alpha("#fff", 0.03) }}>
              <Typography sx={{ fontSize: 12, opacity: 0.78 }}>Layoutがありません</Typography>
            </Box>
          ) : (
            layoutList.map((layout, i) => {
              const isSelected = selectedLayoutId === layout.id;
              const layoutName = layout.name || `Layout ${i + 1}`;

              return (
                <Box
                  key={layout.id}
                  sx={activeRowSx(isSelected)}
                  onClick={() => handleSelectLayout(layout)}
                >
                  <ViewAgendaRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />
                  <Typography sx={labelSx}>{layoutName}</Typography>

                  <Box className="rowActions" sx={{ display: "flex", gap: 0.25 }}>
                    <Tooltip title="Delete Layout">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteLayout(layout.id, layoutName);
                          }}
                          sx={actionBtnSx(true)}
                        >
                          <DeleteOutlineRoundedIcon fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>

                  {isSelected && <CheckRoundedIcon fontSize="small" style={{ opacity: 0.9 }} />}
                </Box>
              );
            })
          )}
        </Stack>
      </Box>
    </Box>
  );
}
