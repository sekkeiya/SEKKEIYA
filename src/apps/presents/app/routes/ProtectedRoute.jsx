import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSharedAuthState } from '../../shared/hooks/useSharedAuthState';
import { AppInitSkeleton, APPS_CATALOG } from "@sekkeiya/global-panel";

export default function ProtectedRoute({ children }) {
  const { isAuthed, isLoading } = useSharedAuthState();

  if (isLoading) {
    const appInfo = APPS_CATALOG.find(a => a.key === "presents");
    return <AppInitSkeleton appName={appInfo?.label || "S.Slide"} icon={appInfo?.icon} message="認証情報を確認しています..." />;
  }
  if (!isAuthed) return <Navigate to="/" replace />;
  return children;
}
