import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "@layout/features/auth/AuthContext";
import { WorkspaceTabsProvider } from "@layout/features/layout/contexts/WorkspaceTabsContext";
import DashboardPage from "@layout/pages/DashboardPage";
import LayoutWorkspacePage from "@layout/pages/LayoutWorkspacePage";
import LayoutViewerSharePage from "@layout/pages/LayoutViewerSharePage";

// AppLayout/PrivateRouteは廃止 — 親(main App.jsx)のAppLayoutが提供する
export default function LayoutApp() {
  return (
    <AuthProvider>
      <WorkspaceTabsProvider>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="projects/:projectId/workspaces/:workspaceId"
            element={<LayoutWorkspacePage />}
          />
          <Route path="share/:shareId" element={<LayoutViewerSharePage />} />
        </Routes>
      </WorkspaceTabsProvider>
    </AuthProvider>
  );
}
