import React from "react";
import { Box, useMediaQuery } from "@mui/material";
import { Outlet, useSearchParams } from "react-router-dom";
import { BRAND } from "../ui/theme";
import LeftSidebar from "./LeftSidebar";
import BottomBar from "./BottomBar";
import MobileTopBar from "./MobileTopBar";
import { usePanelUrlSync, AssistantDrawer } from "@sekkeiya/global-panel";
import GlobalPanelHost from "./panel/GlobalPanelHost";
import { useProjectContext } from '@/app/providers/ProjectProvider';

export default function AppLayout({ hideMainSidebar = false }) {
  const isMobile = useMediaQuery("(max-width:600px)");

  // URLとPanel Stateの同期
  usePanelUrlSync();

  const [searchParams, setSearchParams] = useSearchParams();
  const activePanel = searchParams.get("panel");
  const isChatOpen = activePanel === "chat";

  const { activeProjectId } = useProjectContext();

  const closeChat = () => {
    setSearchParams(params => {
      params.delete("panel");
      return params;
    });
  };

  return (
    <Box
      sx={{
        height: "100vh",
        overflow: "hidden",
        bgcolor: BRAND.bg,
        color: BRAND.text,
        display: "flex",
        backgroundImage:
          "radial-gradient(60% 50% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 55%)",
      }}
    >
      {/* ===== Left Sidebar (Desktop) / Top+Bottom Bar (Mobile) ===== */}
      {isMobile ? (
        <>
          <MobileTopBar />
          <BottomBar />
        </>
      ) : (
        <LeftSidebar hideMainSidebar={hideMainSidebar} />
      )}

      {/* ===== Main and Right Area ===== */}
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Main Content Box */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
            overflowY: "auto",
            overflowX: "hidden",
            pt: isMobile ? "calc(52px + env(safe-area-inset-top))" : 0,
            pb: isMobile ? "calc(64px + env(safe-area-inset-bottom))" : 0,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.15) transparent',
            '&::-webkit-scrollbar': { width: '8px', height: '8px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '10px' 
            },
            '&::-webkit-scrollbar-thumb:hover': { 
              background: 'rgba(255, 255, 255, 0.25)' 
            },
          }}
        >
          {/* The Outlet remains mounted even when panels are open */}
          <Outlet />
        </Box>

        {/* Right AIChat Participant */}
        {!isMobile && (
          <AssistantDrawer 
            isOpen={isChatOpen} 
            onClose={closeChat} 
            projectId={activeProjectId}
          />
        )}
      </Box>

      {/* Mobile Fullscreen Drawer for AI */}
      {isMobile && (
        <AssistantDrawer 
          isOpen={isChatOpen} 
          onClose={closeChat} 
          projectId={activeProjectId}
        />
      )}

      {/* ===== Global Panels (Overlays - e.g. Drive) ===== */}
      <GlobalPanelHost />
    </Box>
  );
}
