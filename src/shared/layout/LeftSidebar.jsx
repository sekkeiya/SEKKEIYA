import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { auth } from "@/shared/config/firebase";
import { signOut } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BRAND } from "../ui/theme";
import { useGlobalPanelStore, MiniSidebar, useProjectContext } from "@sekkeiya/global-panel";
import { useAppStore } from "@/shared/store/useAppStore";
import LeftSidebarInner from "./sidebar/LeftSidebar";

export default function LeftSidebar({ onSelectProject, activeTab, onSelectTab, hideMainSidebar = false }) {
  const { user } = useAuth();
  const { currentApp, recentApps } = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const storeActivePanel = useGlobalPanelStore((state) => state.activePanel);
  const activePanelState = searchParams.get("panel") || storeActivePanel;

  const isSidebarExpanded = useGlobalPanelStore(state => state.isSidebarExpanded);
  const setSidebarExpanded = useGlobalPanelStore(state => state.setSidebarExpanded);
  const handleTogglePanel = (panelName) => {
    const next = new URLSearchParams(searchParams);
    if (activePanelState === panelName) {
      next.delete("panel");
    } else {
      next.set("panel", panelName);
    }
    setSearchParams(next);
  };

  return (
    <Box
      sx={{
        display: "flex",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 50,
      }}
    >
      <MiniSidebar
        currentApp={currentApp || "sekkeiya"}
        user={user}
        onNavigate={(path) => navigate(path)}
        onNavigateExternal={(url) => {
          if (url.startsWith("/dashboard") || url.startsWith("/projects") || url === "/") {
            navigate(url);
          } else {
            window.location.assign(url);
          }
        }}
        onOpenChat={() => handleTogglePanel("chat")}
        onOpenDrive={() => handleTogglePanel("drive")}
        activePanelState={activePanelState}
        onLogout={async () => {
          try {
            await signOut(auth);
            window.location.assign("/");
          } catch (e) {
            console.error(e);
            window.location.assign("/");
          }
        }}
        isExpanded={isSidebarExpanded}
        onToggle={() => setSidebarExpanded(!isSidebarExpanded)}
        recentApps={recentApps}
      />

      {isSidebarExpanded && (
        <LeftSidebarInner onClose={() => setSidebarExpanded(false)} />
      )}
    </Box>
  );
}
