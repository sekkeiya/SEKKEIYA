// src/pages/RouteGuards.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { AppInitSkeleton, APPS_CATALOG, useSharedAuthState } from "@sekkeiya/global-panel";

const DUMMY_KEY = "MVP_DUMMY_AUTH";

// ✅ 本番ではダミー認証を無効化（事故防止）
const ENABLE_DUMMY = import.meta.env.DEV;

function isDummyAuthed() {
  if (!ENABLE_DUMMY) return false;
  try {
    return localStorage.getItem(DUMMY_KEY) === "1";
  } catch {
    return false;
  }
}

function FullscreenLoading() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#050815",
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}

export function PrivateRoute({ children }) {
  const { isAuthed, isLoading } = useSharedAuthState();

  const ok = isAuthed || isDummyAuthed();

  // ✅ “null” はやめる（本番で「遷移してない」ように見える）
  if (isLoading) {
    const appInfo = APPS_CATALOG.find(a => a.key === "layout");
    return <AppInitSkeleton appName={appInfo?.label || "S.Layout"} icon={appInfo?.icon} message="認証情報を確認しています..." />;
  }

  if (!ok) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// PublicRoute was removed as per integration specification requirements

// HomeEntryRedirect was replaced by HomePage as per design specification

// ✅ 任意：どこからでも呼べるダミーログアウト（DEVのみ意味がある）
export function clearDummyAuth() {
  try {
    localStorage.removeItem(DUMMY_KEY);
  } catch {
    // noop
  }
}
