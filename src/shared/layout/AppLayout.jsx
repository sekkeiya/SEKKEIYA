import React, { useState } from "react";
import { Box, useMediaQuery } from "@mui/material";
import { Outlet } from "react-router-dom";
import { BRAND } from "../ui/theme";
import MiniSidebar from "./sidebar/MiniSidebar";
import LeftSidebar from "./sidebar/LeftSidebar";
import BottomBar from "./BottomBar";
import { usePanelUrlSync, GlobalPanelHost } from "sekkeiya-global-panel";

export default function AppLayout() {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useMediaQuery("(max-width:600px)");
  const mobileBottomSafe = isMobile ? 84 : 0;
  
  // URLとPanel Stateの同期
  usePanelUrlSync();

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
      {/* ===== Left Sidebar (Desktop) / Bottom Bar (Mobile) ===== */}
      {isMobile ? (
        <BottomBar />
      ) : (
        <Box sx={{ display: "flex", position: "sticky", top: 0, height: "100vh", zIndex: 50 }}>
          <MiniSidebar isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />
          {isExpanded && <LeftSidebar onClose={() => setIsExpanded(false)} />}
        </Box>
      )}

      {/* ===== Main ===== */}
      <Box sx={{ flex: 1, position: "relative", overflowY: "auto", pb: `${mobileBottomSafe}px` }}>
        {/* The Outlet remains mounted even when panels are open */}
        <Outlet />
      </Box>

      {/* ===== Global Panels (Overlays) ===== */}
      <GlobalPanelHost />
    </Box>
  );
}
