// src/shared/layout/AppLayout.jsx
import React from "react";
import { Box } from "@mui/material";
import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { MiniSidebar, MainSidebar, GlobalPanelHost } from "@sekkeiya/global-panel";
import { useAuth } from "@layout/features/auth/AuthContext";
import { useWorkspaces } from "@layout/features/layout/hooks/useWorkspaces";
import { signOut } from "firebase/auth";
import { auth } from "@layout/shared/lib/firebase/config";
import { toSekkeiyaLoginUrl } from "@layout/shared/utils/urls/sekkeiyaUrls";

import BoardManagementPage from "@layout/pages/BoardManagementPage";
import { ConnectionsPage } from "@sekkeiya/global-panel";

// URL から WorkspaceId を推定
function getWorkspaceIdFromLocation(pathname) {
  const match = pathname.match(/\/workspaces\/([^/]+)/);
  if (match) {
    return match[1];
  }
  return null;
}

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const uid = user?.uid || null;

  const { workspaces } = useWorkspaces(projectId, uid);
  const currentWorkspaceId = getWorkspaceIdFromLocation(location.pathname);

  const [mainView, setMainView] = React.useState("app");
  const [localWorkspaceId, setLocalWorkspaceId] = React.useState(currentWorkspaceId);
  const [isDriveOpen, setIsDriveOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);

  // When route changes externally, reset to the app view
  React.useEffect(() => {
    setMainView("app");
    setIsDriveOpen(false);
    setIsChatOpen(false);
  }, [location.pathname]);

  return (
    <Box sx={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#02040a" }}>
      {/* 1. グローバルミニサイドバー (100vh) */}
      <Box sx={{ flexShrink: 0, zIndex: 1200 }}>
        <MiniSidebar
          currentApp="layout"
          currentBoardId={localWorkspaceId || currentWorkspaceId}
          boards={workspaces || []} // Provide workspaces to satisfy legacy board prop
          user={user}
          onChangeMainView={(view) => {
            setIsDriveOpen(false);
            if (view === "home" || view === "workspace") setMainView("app");
            else setMainView(view);
          }}
          onSelectBoard={(id) => {
            setLocalWorkspaceId(id);
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
          onLogout={async () => {
            try {
              setIsDriveOpen(false);
              setIsChatOpen(false);
              await signOut(auth);
              window.location.assign(toSekkeiyaLoginUrl("/app/layout/dashboard"));
            } catch (e) {
              console.error(e);
              window.location.assign(toSekkeiyaLoginUrl("/app/layout/dashboard"));
            }
          }}
          onToggle={() => {
            setIsDriveOpen(false);
          }}
          isExpanded={false}
        />
      </Box>

      <Box sx={{ flexShrink: 0, zIndex: 1100 }}>
        <MainSidebar 
          user={user}
          activeTab={mainView === "app" ? "home" : mainView}
          onSelectTab={(tab) => {
            setIsDriveOpen(false);
            if (tab === "home" || tab === "workspace") setMainView("app");
            else setMainView(tab);
          }}
          currentBoardId={localWorkspaceId || currentWorkspaceId}
          onSelectBoard={(pid, wid) => {
            setLocalWorkspaceId(wid);
            setIsDriveOpen(false);
            setMainView("boardDetail");
          }}
          onNavigateProjects={() => {
            setIsDriveOpen(false);
            setMainView("boards");
          }}
        />
      </Box>

      {/* 2. メインコンテンツエリア */}
      <Box sx={{ flex: 1, minWidth: 0, height: "100%", position: "relative" }}>
        {mainView === "app" && <Outlet />}
        
        {mainView === "boards" && (
          <BoardManagementPage user={user} projectId={projectId} />
        )}

        {mainView === "connections" && (
          <ConnectionsPage user={user} />
        )}
      </Box>

      {/* 3. Global Panels (Chat / Drive) */}
      <GlobalPanelHost 
        activePanelState={isDriveOpen ? "drive" : isChatOpen ? "chat" : null}
        onClosePanel={() => { setIsDriveOpen(false); setIsChatOpen(false); }}
      />
    </Box>
  );
}
