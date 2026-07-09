import React, { useCallback, useEffect, useRef } from "react";
import { Box, Divider, Typography } from "@mui/material";
import { useAuthStore } from "../../../../../../store/useAuthStore";
import { useAppStore } from "../../../../../../store/useAppStore";
import { BRAND } from "../../../../../../styles/theme";

import LibraryPanelShell from "./components/Library/LibraryPanelShell";
import EditorBasePlanOptionTree from "./components/EditorBasePlanOptionTree";
import { useUiLeftSidebarStore } from "../../../store/uiLeftSidebarStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useWorkspaceStructureStore } from "../../../store/useWorkspaceStructureStore";
import { useAIChatStore } from "../../../../../../store/useAIChatStore";
import { useCoreOrchestrator } from "../../../../../../store/useCoreOrchestrator";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { IconButton, Tooltip } from "@mui/material";

const Section = React.forwardRef(({ title, children, explicitHeight, minHeight = 150, headerRight }, ref) => {
  return (
    <Box
      ref={ref}
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: explicitHeight ? `0 0 ${explicitHeight}px` : "1 1 0px",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.05)", // Top divider removed since we put title
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: BRAND.panel,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: 12, opacity: 0.86, fontWeight: 600 }}>{title}</Typography>
        {headerRight}
      </Box>

      <Box sx={{ minHeight, minWidth: 0, flex: "1 1 0px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </Box>
    </Box>
  );
});

const Resizer = ({ onResize }) => {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent) => {
      onResize(moveEvent.clientY);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
  }, [onResize]);

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        height: 8,
        mt: "-4px",
        mb: "-4px",
        zIndex: 10,
        position: "relative",
        cursor: "ns-resize",
        "&:hover > .hover-bar": {
          backgroundColor: "#38bdf8",
        }
      }}
    >
      <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.05)", position: "absolute", top: 4, left: 0, right: 0, pointerEvents: 'none' }} />
      <Box className="hover-bar" sx={{ position: "absolute", top: 3, left: 0, right: 0, height: 2, transition: "background-color 0.2s", pointerEvents: 'none' }} />
    </Box>
  );
};

export default function LeftSidebar({ width = "100%" }) {
  const { currentUser } = useAuthStore();
  const { activeWorkspaceId, activeProjectId, panelSelections } = useAppStore();

  const uid = currentUser?.uid;
  const boardId = activeWorkspaceId;
  const baseId = panelSelections?.[boardId]?.baseId;
  const planId = panelSelections?.[boardId]?.planId;

  const leftPanels = useUiLeftSidebarStore(s => s.leftPanels);
  const visibleSections = useUiLeftSidebarStore(s => s.visibleSections);
  const sectionHeights = useUiLeftSidebarStore(s => s.sectionHeights);
  const setSectionHeight = useUiLeftSidebarStore(s => s.setSectionHeight);
  const isLibraryDetached = useUiLeftSidebarStore(s => s.isLibraryDetached);
  const toggleLibraryDetached = useUiLeftSidebarStore(s => s.toggleLibraryDetached);

  const containerRef = useRef(null);

  const mode = useEditorModeStore(s => s.editorMode);

  const actualVisibleSections = isLibraryDetached
    ? visibleSections.filter(k => k !== 'library')
    : visibleSections;

  const finalVisibleSections = actualVisibleSections;

  // 家具選定ボタン：SEKKEIYA Chat を開き、選択中の Plan のための家具選定メッセージを送信する。
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const plansOfSelectedBase = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const basesForName = useWorkspaceStructureStore((s) => s.bases);
  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);

  const handleSelectFurniture = useCallback(() => {
    const aiChat = useAIChatStore.getState();
    let sessionId = aiChat.activeSessionId;
    if (!sessionId) {
      sessionId = aiChat.createSession(activeProjectId || "default");
    }
    useAppStore.getState().setAIChatOpen(true);

    const baseName = (basesForName || []).find((b) => b?.id === selectedBaseId)?.name || "";
    const planName = (plansOfSelectedBase || []).find((p) => p?.id === selectedPlanId)?.name || "";
    const target = [baseName, planName].filter(Boolean).join(" / ");
    const msg = planName
      ? `現在開いているプラン「${target}」のための家具を選定し、このプロジェクトに追加してください。部屋の用途・スタイルに合った最適な家具を提案してください。`
      : `現在開いている躯体${baseName ? `「${baseName}」` : ""}のプランのための家具を選定し、このプロジェクトに追加してください。まずプランを選択するか、最適な家具を提案してください。`;

    useCoreOrchestrator.getState().sendMessageToOrchestrator(msg, { source: "sidebar_chat", sessionId });
  }, [activeProjectId, selectedPlanId, plansOfSelectedBase, basesForName, selectedBaseId]);

  if (finalVisibleSections.length === 0) return null;

  return (
    <Box
      ref={containerRef}
      sx={{
        width,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        borderRight: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
        bgcolor: BRAND.panel,
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.05)", flexShrink: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "var(--brand-fg)", letterSpacing: 1 }}>3D SHAPE LAYOUT</Typography>
      </Box>

      {finalVisibleSections.map((key, i) => {
        const isLast = i === finalVisibleSections.length - 1;
        const passExplicitHeight = !isLast; 
        
        let preferredHeight = sectionHeights[key] || 250;
        
        const handleResize = (clientY) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          
          let yOffset = rect.top + 48; // Account for header
          for (let j = 0; j < i; j++) {
            yOffset += sectionHeights[finalVisibleSections[j]] || 250; 
            if (j < i) yOffset += 31; // Add Section Header height approx
          }

          const newHeight = clientY - yOffset;
          const minHeight = 150;
          setSectionHeight(key, Math.max(minHeight, newHeight));
        };

        return (
          <React.Fragment key={key}>
            <Section
              title={key.charAt(0).toUpperCase() + key.slice(1)}
              minHeight={150}
              explicitHeight={passExplicitHeight ? preferredHeight : null}
              headerRight={
                key === 'library' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="AI で家具を選定（選択中のプランに追加）" placement="top">
                      <IconButton
                        size="small"
                        onClick={handleSelectFurniture}
                        sx={{
                          color: 'light-dark(#2705a9, #c4b5fd)', padding: '2px', borderRadius: 1,
                          bgcolor: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.4)',
                          '&:hover': { bgcolor: 'rgba(124,58,237,0.3)' },
                        }}
                      >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={toggleLibraryDetached} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', padding: '2px' }}>
                      <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ) : null
              }
            >
              {key === "project" && (
                <EditorBasePlanOptionTree />
              )}

              {key === "library" && (
                <LibraryPanelShell
                  projectId={activeProjectId}
                  workspaceId={activeWorkspaceId}
                  planId={planId}
                />
              )}

            </Section>

            {!isLast && <Resizer onResize={handleResize} />}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
