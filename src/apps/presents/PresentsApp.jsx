import React from "react";
import { Routes, Route } from "react-router-dom";

import PresentsLandingPage from "@presents/pages/PresentsLandingPage";
import PresentsDashboardPage from "@presents/pages/PresentsDashboardPage";
import { PresentsEditorPage } from "@presents/pages/PresentsEditorPage";
import { PresentsViewerPage } from "@presents/pages/PresentsViewerPage";
import { PresentsTemplatesPage } from "@presents/pages/PresentsTemplatesPage";

// AppLayout/ProtectedRouteは廃止 — 親(main App.jsx)のAppLayoutが提供する
export default function PresentsApp() {
  return (
    <Routes>
      <Route index element={<PresentsLandingPage />} />
      <Route path="dashboard" element={<PresentsDashboardPage />} />
      <Route path="projects/:projectId/workspaces/presents" element={<PresentsDashboardPage />} />
      <Route path="projects/:projectId/workspaces/presents/:section" element={<PresentsDashboardPage />} />
      <Route path="projects/:projectId/workspaces/presents/editor/:itemId" element={<PresentsEditorPage />} />
      <Route path="projects/:projectId/workspaces/presents/viewer/:itemId" element={<PresentsViewerPage />} />
      <Route path="projects/:projectId/workspaces/presents/templates" element={<PresentsTemplatesPage />} />
    </Routes>
  );
}
