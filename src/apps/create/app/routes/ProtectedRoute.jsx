import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSharedAuthState } from '../../shared/hooks/useSharedAuthState';
import { AppInitSkeleton, APPS_CATALOG } from "@sekkeiya/global-panel";

export default function ProtectedRoute({ children }) {
  const { isAuthed: isAuthenticated, isLoading } = useSharedAuthState();
  const location = useLocation();

  if (isLoading) {
    const appInfo = APPS_CATALOG.find(a => a.key === "create");
    return <AppInitSkeleton appName={appInfo?.label || "S.Create"} icon={appInfo?.icon} message="認証情報を確認しています..." />;
  }

  // Redirect to landing page on unauthenticated access
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}
