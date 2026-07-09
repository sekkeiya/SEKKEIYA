import React, { useCallback, useEffect, useRef } from "react";
import { Box, Divider, Typography } from "@mui/material";
import { useAuthStore } from "@desktop/store/useAuthStore";
import { useAppStore } from "@desktop/store/useAppStore";
import { BRAND } from "@desktop/styles/theme";

import LibraryPanelShell from "./components/Library/LibraryPanelShell";
import EditorBasePlanOptionTree from "./components/EditorBasePlanOptionTree";
import { useUiLeftSidebarStore } from "@desktop/features/dsl/layout/store/uiLeftSidebarStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { IconButton } from "@mui/material";

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
          borderBottom: "1px solid rgba(255,255,255,0.05)", // Top divider removed since we put title
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
      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", position: "absolute", top: 4, left: 0, right: 0, pointerEvents: 'none' }} />
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
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
        bgcolor: BRAND.panel,
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>3D SHAPE LAYOUT</Typography>
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
                  <IconButton size="small" onClick={toggleLibraryDetached} sx={{ color: 'rgba(255,255,255,0.7)', padding: '2px' }}>
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
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
