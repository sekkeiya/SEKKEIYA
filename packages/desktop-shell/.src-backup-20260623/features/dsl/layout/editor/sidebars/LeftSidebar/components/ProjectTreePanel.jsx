import React, { useMemo } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import NoteRoundedIcon from "@mui/icons-material/NoteRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { useAppStore } from "@desktop/store/useAppStore";
import { useAuthStore } from "@desktop/store/useAuthStore";
import { useWorkspaceLayouts } from "@desktop/features/dsl/layout/hooks/useWorkspaces";
import { createLayout, updateLayoutInfo, deleteLayout } from "@desktop/features/dsl/layout/utils/workspaceStubs";

function TreeItem({ 
  id, 
  name, 
  icon, 
  selected = false, 
  onClick, 
  onRenameClick,
  onDeleteClick,
  isRenaming = false,
  renameValue = "",
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  color = "rgba(255,255,255,0.7)", 
  activeBg = "rgba(255,255,255,0.1)",
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <Box
        onClick={!isRenaming ? onClick : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          py: 0.75,
          pl: 3,
          cursor: isRenaming ? "default" : "pointer",
          bgcolor: selected ? activeBg : "transparent",
          "&:hover": {
            bgcolor: selected ? activeBg : "rgba(255,255,255,0.05)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", width: 14, height: 14, mr: 1, color }}>
          {icon}
        </Box>
        
        {isRenaming ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange && onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit && onRenameSubmit();
                if (e.key === "Escape") onRenameCancel && onRenameCancel();
              }}
              onBlur={() => onRenameSubmit && onRenameSubmit()}
              style={{
                width: "100%",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #00BFFF",
                backgroundColor: "rgba(0,0,0,0.4)",
                color: "#fff",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </Box>
        ) : (
          <Typography
            sx={{
              flex: 1,
              fontSize: 12,
              color: selected ? "#fff" : "rgba(255,255,255,0.7)",
              fontWeight: selected ? 600 : 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name || "Untitled Layout"}
          </Typography>
        )}

        {/* Action Buttons */}
        {!isRenaming && (hovered || selected) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
            {/* Rename Icon */}
            <Box onClick={onRenameClick} sx={{ cursor: 'pointer', '&:hover': { color: '#fff' }, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </Box>
            {/* Delete Icon */}
            <Box onClick={onDeleteClick} sx={{ cursor: 'pointer', '&:hover': { color: '#ff4d4f' }, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function ProjectTreePanel() {
  const { currentUser } = useAuthStore();
  const { activeProjectId, panelSelections, setPanelSelection } = useAppStore();
  const activeProject = useAppStore((s) => s.getActiveProject());
  const { layouts, loading } = useWorkspaceLayouts(activeProjectId, 'layout');

  const [expanded, setExpanded] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // States for rename/delete dialogs
  const [renamePlanId, setRenamePlanId] = React.useState(null);
  const [renamePlanValue, setRenamePlanValue] = React.useState("");
  const [deletePlanId, setDeletePlanId] = React.useState(null);
  const [deletePlanName, setDeletePlanName] = React.useState("");

  const selectedLayoutId = panelSelections?.['layout']?.selectedLayoutId || panelSelections?.['layout']?.optionId || panelSelections?.['layout']?.planId;
  const isProjectSelected = !selectedLayoutId; 

  const getNextName = (list, prefix) => {
    const nums = list.map((o) => String(o?.name || "")).map((s) => {
        const m = s.match(new RegExp(`^${prefix}(\\d+)$`, "i")) || s.match(new RegExp(`^${prefix} (\\d+)$`, "i")) || s.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
        return m ? Number(m[1]) : NaN;
    }).filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `${prefix} ${max + 1}`;
  };

  const handleSelectProject = () => {
    setExpanded((prev) => !prev);
    const fallbackLayoutId = layouts?.[0]?.id || null;

    setPanelSelection('layout', {
      selectedLayoutId: fallbackLayoutId,
      baseId: undefined, planId: undefined, optionId: undefined,
      itemType: "Project",
    });
  };

  const handleSelectLayout = (layout) => {
    setPanelSelection('layout', {
      selectedLayoutId: layout.id,
      baseId: undefined, planId: undefined, optionId: undefined,
      itemType: "Layout",
      ...layout
    });
  };

  const handleCreateLayout = async (e) => {
    e.stopPropagation();
    if (!currentUser || creating || isProcessing) return;
    setCreating(true);
    setIsProcessing(true);
    try {
      const layoutName = getNextName(layouts, "Layout");
      const newLayout = await createLayout({
          projectId: activeProjectId,
          workspaceId: 'layout',
          userId: currentUser.uid,
          name: layoutName,
      });

      setPanelSelection('layout', {
        selectedLayoutId: newLayout.id,
        baseId: undefined, planId: undefined, optionId: undefined,
        itemType: "Layout",
        ...newLayout
      });
      setExpanded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
      setIsProcessing(false);
    }
  };

  const handleRenamePlanSubmit = async () => {
    if (!renamePlanId || !renamePlanValue.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateLayoutInfo(activeProjectId, 'layout', renamePlanId, { name: renamePlanValue.trim() });
      setRenamePlanId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePlanSubmit = async () => {
    if (!deletePlanId || isProcessing) return;
    setIsProcessing(true);
    try {
      await deleteLayout(activeProjectId, 'layout', deletePlanId);
      if (selectedLayoutId === deletePlanId) {
         setPanelSelection('layout', {
           selectedLayoutId: null,
           baseId: undefined, planId: undefined, optionId: undefined,
           itemType: "Project",
         });
      }
      setDeletePlanId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <Box sx={{ p: 2, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Loading...</Box>;
  }

  return (
    <Box sx={{ py: 1, height: "100%", overflowY: "auto", position: 'relative' }}>
      {/* Project Node */}
      <Box
        onClick={handleSelectProject}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          py: 0.75,
          cursor: "pointer",
          bgcolor: isProjectSelected ? "rgba(255,255,255,0.1)" : "transparent",
          "&:hover": {
            bgcolor: isProjectSelected ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", width: 16, height: 16, mr: 1, color: "rgba(255,255,255,0.7)" }}>
          {expanded ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          )}
        </Box>
        <Typography
          sx={{
            flex: 1,
            fontSize: 13,
            color: isProjectSelected ? "#fff" : "rgba(255,255,255,0.9)",
            fontWeight: isProjectSelected ? 600 : 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {activeProject?.name || "Project"}
        </Typography>

        {/* Add Layout Button */}
        <Box
          onClick={handleCreateLayout}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            color: "rgba(255,255,255,0.5)",
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.1)",
              color: "#fff",
            },
          }}
        >
          {creating ? <CircularProgress size={12} color="inherit" /> : <AddRoundedIcon sx={{ fontSize: 16 }} />}
        </Box>
      </Box>

      {/* Layouts List */}
      {expanded && (
        <Box sx={{ display: "flex", flexDirection: "column", mt: 0.5 }}>
          {layouts.map((layout) => {
            const isLayoutSelected = layout.id === selectedLayoutId;
            
            return (
              <TreeItem
                key={layout.id}
                id={layout.id}
                name={layout.name}
                icon={<NoteRoundedIcon sx={{ fontSize: 16 }} />}
                color="#00BFFF"
                activeBg="rgba(0, 191, 255, 0.15)"
                selected={isLayoutSelected}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectLayout(layout);
                }}
                isRenaming={renamePlanId === layout.id}
                renameValue={renamePlanValue}
                onRenameChange={setRenamePlanValue}
                onRenameSubmit={handleRenamePlanSubmit}
                onRenameCancel={() => setRenamePlanId(null)}
                onRenameClick={(e) => {
                  e.stopPropagation();
                  setRenamePlanId(layout.id);
                  setRenamePlanValue(layout.name || "");
                }}
                onDeleteClick={(e) => {
                  e.stopPropagation();
                  setDeletePlanId(layout.id);
                  setDeletePlanName(layout.name || "");
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Delete Dialog */}
      {deletePlanId && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>削除の確認</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3, fontSize: 14 }}>
              「{deletePlanName}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setDeletePlanId(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleDeletePlanSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

