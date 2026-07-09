import React from "react";
import { Box } from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MiniSidebar, GlobalPanelHost } from "@sekkeiya/global-panel";
import { useSharedAuthState } from "../../shared/hooks/useSharedAuthState";

// URL から BoardId を推定
function getBoardIdFromLocation(pathname) {
  const match = pathname.match(/\/dashboard\/boards\/([^/]+)/);
  if (match) {
    const key = match[1];
    if (key.includes("__")) return key.split("__")[0];
    if (key.startsWith("b") && !isNaN(Number(key.slice(1)))) return null; // b1 etc
    return key;
  }
  return null;
}

export default function AppLayout() {
  const { isAuthed } = useSharedAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  const currentBoardId = getBoardIdFromLocation(location.pathname);

  const [mainView, setMainView] = React.useState("app");
  const [localBoardId, setLocalBoardId] = React.useState(currentBoardId);
  const [isDriveOpen, setIsDriveOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);

  // When route changes externally, reset to the app view
  React.useEffect(() => {
    setMainView("app");
    setIsDriveOpen(false);
    setIsChatOpen(false);
  }, [location.pathname]);

  // Dummy user object to satisfy MiniSidebar since 3DSP doesn't use Firebase directly
  const user = isAuthed ? { uid: "user", displayName: "User" } : null;

  return (
    <Box sx={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#02040a" }}>
      {/* 1. グローバルミニサイドバー (100vh) */}
      <Box sx={{ flexShrink: 0, zIndex: 1200 }}>
        <MiniSidebar
          currentApp="presents"
          currentBoardId={localBoardId || currentBoardId}
          boards={[]}
          user={user}
          onChangeMainView={(view) => {
            setIsDriveOpen(false);
            if (view === "home" || view === "workspace") setMainView("app");
            else setMainView(view);
          }}
          onSelectBoard={(id) => {
            setLocalBoardId(id);
            setIsDriveOpen(false);
            setMainView("boardDetail");
          }}
          onNavigate={(path) => {
            setIsDriveOpen(false);
            setIsChatOpen(false);
            navigate(path);
          }}
          onNavigateExternal={(url) => {
            setIsDriveOpen(false);
            setIsChatOpen(false);
            window.location.assign(url);
          }}
          onOpenChat={() => {
            setIsDriveOpen(false);
            setIsChatOpen(prev => !prev);
          }}
          onOpenDrive={() => {
            setIsChatOpen(false);
            setIsDriveOpen(prev => !prev);
          }}
          activePanelState={isDriveOpen ? "drive" : isChatOpen ? "chat" : null}
          onLogout={() => {
            setIsDriveOpen(false);
            setIsChatOpen(false);
            // 3DSP relies on parent app for logout
            window.location.assign("/logout");
          }}
          onToggle={() => {
            setIsDriveOpen(false);
          }}
          isExpanded={false}
        />
      </Box>

      {/* 2. メインコンテンツエリア */}
      <Box sx={{ flex: 1, minWidth: 0, height: "100%", position: "relative" }}>
        {mainView === "app" && <Outlet />}
      </Box>

      {/* 3. Global Panels (Chat / Drive) */}
      <GlobalPanelHost 
        isDriveOpen={isDriveOpen}
        isChatOpen={isChatOpen}
        onCloseDrive={() => setIsDriveOpen(false)} 
        onCloseChat={() => setIsChatOpen(false)}
      />
    </Box>
  );
}
