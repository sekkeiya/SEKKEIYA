// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import LayoutWorkspacePage from "./pages/LayoutWorkspacePage";
import NotFoundPage from "./pages/NotFoundPage";

import { PrivateRoute } from "@layout/features/auth/RouteGuards";
import HomePage from "./pages/HomePage";

import { WorkspaceTabsProvider } from "@layout/features/layout/contexts/WorkspaceTabsContext";
import LayoutViewerSharePage from "./pages/LayoutViewerSharePage";
import AppLayout from "@layout/shared/layout/AppLayout";

import { toSekkeiyaLoginUrl, toSekkeiyaSignupUrl } from "@layout/shared/utils/urls/sekkeiyaUrls";

const WorkspaceLegacyRedirect = () => {
  const { boardKey } = useParams();
  return <Navigate to={`/dashboard`} replace />; // Since we don't have projectId here easily, fallback to dashboard
};

const ExternalRedirect = ({ getTargetUrl }) => {
  const location = useLocation();

  useEffect(() => {
    // 現在のパスが /login や /signup の直叩きなら undefined を渡し、sekkeiyaUrls.js 側のデフォルトに任せる
    const current = location.pathname + location.search + location.hash;
    const isAuthPath = current.startsWith("/login") || current.startsWith("/signup");
    
    if (isAuthPath) {
      window.location.replace(getTargetUrl());
    } else {
      window.location.replace(getTargetUrl(current));
    }
  }, [getTargetUrl, location]);

  return null;
};

export default function App() {
  return (
    <WorkspaceTabsProvider>
      <Routes>
        {/* "/" は認証状態でHomePageかDashboardに振り分け */}
        <Route path="/" element={<HomePage />} />

        {/* 認証 */}
        <Route
          path="/login"
          element={<ExternalRedirect getTargetUrl={toSekkeiyaLoginUrl} />}
        />
        <Route
          path="/signup"
          element={<ExternalRedirect getTargetUrl={toSekkeiyaSignupUrl} />}
        />
        
        <Route path="/layout/share/:shareId" element={<LayoutViewerSharePage />} />

        {/* Project Section Integration */}
        <Route path="/projects/:projectId" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="workspaces/:workspaceId" element={<LayoutWorkspacePage />} />
        </Route>
        <Route path="/projects/:projectId/:section" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
        </Route>

        {/* ダッシュボード系を一括ラップ */}
        <Route path="/dashboard" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
        </Route>

        {/* レガシーダッシュボードURLからのリダイレクト */}
        <Route
          path="/dashboard/:handle"
          element={<Navigate to="/dashboard" replace />}
        />
        {/* レガシーワークスペースURLからのリダイレクト */}
        <Route
          path="/dashboard/:handle/boards/:boardKey"
          element={<WorkspaceLegacyRedirect />}
        />

        {/* 404 */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </WorkspaceTabsProvider>
  );
}
