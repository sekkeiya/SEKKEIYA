import React, { useState, useEffect } from "react";
import {
  Box, Tooltip, IconButton, Avatar, Menu, MenuItem,
  ListItemIcon, Divider, Typography,
} from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import PresentToAllRoundedIcon from "@mui/icons-material/PresentToAllRounded";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import { useLocation } from "react-router-dom";

import { APPS_CATALOG } from "./appRoutes.js";
import { usePanelTheme } from "./theme/ThemeContext.jsx";
import { useProjectContext } from "./hooks/useProjectContext.js";
import AppInitSkeleton from "./components/AppInitSkeleton.jsx";

const AppImageIcon = ({ src, alt, fallbackChar }) => (
  <Box
    sx={{
      width: 26,
      height: 26,
      borderRadius: "50%",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: src ? "transparent" : "#333",
      color: "#fff",
      overflow: "hidden",
    }}
  >
    {src ? (
      <Box component="img" src={src} alt={alt} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
    ) : (
      <span style={{ fontSize: 12, fontWeight: "bold" }}>{fallbackChar || alt?.charAt(0) || "A"}</span>
    )}
  </Box>
);

const NavIcon = ({ icon, label, active, onClick, BRAND, isBrand }) => (
  <Tooltip title={label} placement="right">
    <IconButton
      onClick={onClick}
      sx={{
        mb: isBrand ? 1 : 0.5,
        p: isBrand ? 0.75 : 1,
        color: active ? "#3498db" : "rgba(255,255,255,0.6)",
        bgcolor: active
          ? isBrand ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)"
          : "transparent",
        borderRadius: isBrand ? "50%" : 2,
        border: isBrand
          ? active ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent"
          : "none",
        boxShadow: active && isBrand ? "0 0 12px rgba(255,255,255,0.3)" : "none",
        "&:hover": {
          bgcolor: isBrand ? "rgba(255,255,255,0.1)" : (active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)"),
          color: active ? "#3498db" : "#fff",
          borderColor: isBrand ? "rgba(255,255,255,0.3)" : "transparent",
        },
        transition: "all 0.15s",
      }}
    >
      {React.cloneElement(icon, { fontSize: "small" })}
    </IconButton>
  </Tooltip>
);

const UserAvatarMenu = ({ user, onLogout, onNavigate, onNavigateExternal, onChangeMainView, BRAND }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const getAppBasePath = () => {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/^(\/app\/[^/]+)/);
    return match ? match[1] : "";
  };
  const appBase = getAppBasePath();
  const returnPath = encodeURIComponent(appBase + "/dashboard");
  const loginUrl = `/login?return_to=${returnPath}`;
  const signupUrl = `/signup?return_to=${returnPath}`;

  const handleClose = () => setAnchorEl(null);
  const handleAction = (action) => { handleClose(); if (typeof action === "function") action(); };

  return (
    <>
      <Tooltip title={user ? "アカウント" : "ログイン"} placement="right">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ mb: 1 }}>
          <Avatar
            src={user?.photoURL}
            sx={{
              width: 32,
              height: 32,
              bgcolor: user ? "primary.main" : "rgba(255,255,255,0.1)",
              border: `2px solid ${anchorEl ? "rgba(255,255,255,0.4)" : "transparent"}`,
              fontSize: "0.8rem",
              transition: "border-color 0.2s",
            }}
          >
            {user ? user.email?.[0]?.toUpperCase() : <LoginRoundedIcon fontSize="small" />}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: "left", vertical: "bottom" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(20,20,20,0.88)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              minWidth: 240,
              ml: 1.5,
              mb: 1,
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              overflow: "hidden",
            },
          },
        }}
      >
        {user ? [
          <Box key="user-info" sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "rgba(255,255,255,0.03)" }}>
            <Avatar src={user.photoURL} sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: "0.9rem" }}>
              {user.email?.[0]?.toUpperCase() || "U"}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>
                {user.displayName || "ユーザー"}
              </Typography>
              <Typography noWrap sx={{ fontSize: 11, color: "rgba(255,255,255,0.45)", mt: 0.25 }}>
                {user.email || ""}
              </Typography>
            </Box>
          </Box>,
          <Divider key="div1" sx={{ borderColor: "rgba(255,255,255,0.08)" }} />,
          <Box key="menu-items" sx={{ p: 0.75 }}>
            <MenuItem
              key="dashboard"
              onClick={() => handleAction(() => {
                if (onChangeMainView) onChangeMainView("home");
                else onNavigateExternal?.("/dashboard");
              })}
              sx={{ borderRadius: 2, py: 1.25, mb: 0.25, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" } }}
            >
              <ListItemIcon><StorefrontRoundedIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} /></ListItemIcon>
              <Typography sx={{ fontSize: 13 }}>ダッシュボード</Typography>
            </MenuItem>
            <MenuItem
              key="connections"
              onClick={() => handleAction(() => {
                if (onChangeMainView) onChangeMainView("connections");
                else onNavigateExternal?.("/dashboard/connections");
              })}
              sx={{ borderRadius: 2, py: 1.25, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" } }}
            >
              <ListItemIcon><PeopleAltRoundedIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} /></ListItemIcon>
              <Typography sx={{ fontSize: 13 }}>つながり管理</Typography>
            </MenuItem>
          </Box>,
          <Divider key="div2" sx={{ borderColor: "rgba(255,255,255,0.08)" }} />,
          <Box key="logout-box" sx={{ p: 0.75 }}>
            <MenuItem
              key="logout"
              onClick={() => handleAction(onLogout)}
              sx={{ borderRadius: 2, py: 1.25, color: "#ef4444", "&:hover": { bgcolor: "rgba(239,68,68,0.1)" } }}
            >
              <ListItemIcon><LogoutRoundedIcon fontSize="small" sx={{ color: "#ef4444" }} /></ListItemIcon>
              <Typography sx={{ fontSize: 13, color: "#ef4444" }}>ログアウト</Typography>
            </MenuItem>
          </Box>,
        ] : [
          <Box key="guest-items" sx={{ p: 0.75 }}>
            <MenuItem key="login" onClick={() => handleAction(() => onNavigateExternal?.(loginUrl))} sx={{ borderRadius: 2, py: 1.25, mb: 0.25, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" } }}>
              <ListItemIcon><LoginRoundedIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} /></ListItemIcon>
              <Typography sx={{ fontSize: 13 }}>サインイン</Typography>
            </MenuItem>
            <MenuItem key="signup" onClick={() => handleAction(() => onNavigateExternal?.(signupUrl))} sx={{ borderRadius: 2, py: 1.25, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" } }}>
              <ListItemIcon><PersonAddRoundedIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} /></ListItemIcon>
              <Typography sx={{ fontSize: 13 }}>サインアップ</Typography>
            </MenuItem>
          </Box>,
        ]}
      </Menu>
    </>
  );
};

export default function MiniSidebar({
  currentApp = "sekkeiya",
  currentBoardId,
  user,
  onNavigate,
  onNavigateExternal,
  onChangeMainView,
  onSelectBoard,
  onOpenChat,
  onOpenDrive,
  activePanelState,
  onLogout,
  onToggle,
  isExpanded = false,
  recentApps = [],
  appIcons = {},
}) {
  const BRAND = usePanelTheme();
  const [appAnchorEl, setAppAnchorEl] = useState(null);
  const [transitionTarget, setTransitionTarget] = useState(null);

  let location = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    location = useLocation();
  } catch (_) {
    // not inside Router — sub-apps may have different routing context
  }
  const currentPath = location?.pathname ?? "";

  useEffect(() => {
    if (currentBoardId) {
      useProjectContext.getState().setActiveBoardId(currentBoardId);
    }
  }, [currentBoardId]);

  const handleAppClick = (e) => setAppAnchorEl(e.currentTarget);
  const handleAppClose = () => setAppAnchorEl(null);

  const handleProjectClick = (projectId) => {
    useProjectContext.getState().setActiveProjectId(projectId);
    if (onNavigate) onNavigate(`/projects/${projectId}`);
  };

  const handleMenuNavigate = (targetApp, authRoute, pubRoute) => {
    const savedProjectId = useProjectContext.getState().activeProjectId;
    let url = user && authRoute ? authRoute : pubRoute;
    if (user && savedProjectId) {
      const base = url.endsWith("/") ? url.slice(0, -1) : url;
      url = `${base}/projects/${savedProjectId}`;
    }
    if (targetApp === currentApp) {
      onNavigate?.(url);
    } else {
      const appInfo = APPS_CATALOG.find((a) => a.id === targetApp || a.key === targetApp);
      setTransitionTarget({
        appName: appInfo?.label ?? targetApp,
        boardName: null,
        icon: appInfo?.icon ?? null,
      });
      setTimeout(() => onNavigateExternal?.(url), 150);
    }
  };

  const getCurrentAppHomeRoute = (appKey) => {
    const app = APPS_CATALOG.find((a) => a.key === appKey);
    return user ? app?.hrefAuth ?? "/dashboard" : app?.hrefPublic ?? "/";
  };

  const getCurrentAppHomeIcon = (appKey) =>
    appIcons[appKey] ?? APPS_CATALOG.find((a) => a.key === appKey)?.icon ?? null;

  const isProjectsActive = currentPath.startsWith("/projects");
  const isDriveActive = activePanelState === "drive";
  const isChatActive = activePanelState === "chat";
  const isMarketActive = currentPath.startsWith("/dashboard/marketplace");

  return (
    <>
      {transitionTarget && (
        <AppInitSkeleton
          appName={transitionTarget.appName}
          boardName={transitionTarget.boardName}
          icon={transitionTarget.icon}
          message="Opening workspace..."
          showSidebarCol={true}
        />
      )}
      <Box
        sx={{
          width: 56,
          borderRight: `1px solid ${BRAND.line}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 1.5,
          gap: 0.5,
          height: "100vh",
          bgcolor: BRAND.bg,
          position: "relative",
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        {onToggle && (
          <Tooltip title={isExpanded ? "メニューを閉じる" : "メニューを開く"} placement="right">
            <IconButton
              onClick={onToggle}
              sx={{
                mb: 0.5,
                p: 1,
                color: "rgba(255,255,255,0.6)",
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isExpanded ? "rotate(180deg) scale(0.9)" : "rotate(0deg) scale(1)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#fff" },
                borderRadius: 2,
              }}
            >
              {isExpanded ? <MenuOpenRoundedIcon fontSize="small" /> : <MenuRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        {/* Current App Home */}
        <Tooltip title={APPS_CATALOG.find((a) => a.key === currentApp)?.label ?? "Home"} placement="right">
          <IconButton
            onClick={() => {
              onChangeMainView?.("home");
              const homeRoute = getCurrentAppHomeRoute(currentApp);
              onNavigate?.(homeRoute);
            }}
            sx={{ mb: 0.5, p: 0.75, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" }, borderRadius: 2 }}
          >
            <AppImageIcon
              src={getCurrentAppHomeIcon(currentApp)}
              alt={currentApp}
              fallbackChar={currentApp.charAt(0).toUpperCase()}
            />
          </IconButton>
        </Tooltip>

        <NavIcon icon={<FolderRoundedIcon />} label="AIドライブ" BRAND={BRAND} active={isDriveActive} onClick={onOpenDrive} />
        <NavIcon icon={<ChatRoundedIcon />} label="AIチャット" BRAND={BRAND} active={isChatActive} onClick={onOpenChat} />
        <NavIcon
          icon={<AccountTreeRoundedIcon />}
          label="プロジェクト管理"
          BRAND={BRAND}
          active={isProjectsActive && !isDriveActive && !isChatActive}
          onClick={() => {
            onNavigateExternal?.("/projects") ?? onNavigate?.("/projects");
          }}
        />
        <NavIcon
          icon={<GroupsRoundedIcon />}
          label="チーム管理"
          BRAND={BRAND}
          active={currentPath.startsWith("/dashboard/teams")}
          onClick={() => {
            onNavigateExternal?.("/dashboard/teams") ?? onNavigate?.("/dashboard/teams");
          }}
        />
        <NavIcon
          icon={<SchoolRoundedIcon />}
          label="AI Studio"
          BRAND={BRAND}
          active={currentPath.startsWith("/dashboard/ai-studio")}
          onClick={() => {
            onNavigateExternal?.("/dashboard/ai-studio") ?? onNavigate?.("/dashboard/ai-studio");
          }}
        />

        <Divider sx={{ width: "60%", opacity: 0.25, my: 1.5 }} />

        {/* Brand app icons */}
        <NavIcon
          icon={<ViewInArRoundedIcon />}
          label="Models (3DSS)"
          BRAND={BRAND}
          isBrand={true}
          active={currentPath.startsWith("/app/share")}
          onClick={() => onNavigate?.("/app/share/dashboard")}
        />
        <NavIcon
          icon={<GridViewRoundedIcon />}
          label="Layouts (3DSL)"
          BRAND={BRAND}
          isBrand={true}
          active={currentPath.startsWith("/app/layout")}
          onClick={() => onNavigate?.("/app/layout/dashboard")}
        />
        <NavIcon
          icon={<PresentToAllRoundedIcon />}
          label="Presents (3DSP)"
          BRAND={BRAND}
          isBrand={true}
          active={currentPath.startsWith("/app/presents")}
          onClick={() => onNavigate?.("/app/presents/dashboard")}
        />
        <NavIcon
          icon={<BrushRoundedIcon />}
          label="Create (3DSC)"
          BRAND={BRAND}
          isBrand={true}
          active={currentPath.startsWith("/app/create")}
          onClick={() => onNavigate?.("/app/create/dashboard")}
        />

        <Divider sx={{ width: "60%", opacity: 0.15, my: 1 }} />

        <Box sx={{ flex: 1 }} />

        {/* Recent Apps */}
        {recentApps.length > 0 &&
          recentApps.map((app) => {
            const appInfo = APPS_CATALOG.find((a) => a.key === app);
            if (!appInfo) return null;
            return (
              <Tooltip title={`直前のアプリ: ${appInfo.label}`} placement="right" key={app}>
                <IconButton
                  onClick={() => handleMenuNavigate(app, appInfo.hrefAuth, appInfo.hrefPublic)}
                  sx={{ mb: 0.5, p: 0.75, bgcolor: "rgba(255,255,255,0.05)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" }, borderRadius: 2 }}
                >
                  <AppImageIcon src={appIcons[app] || appInfo.icon} alt={app.toUpperCase()} fallbackChar={app.charAt(0).toUpperCase()} />
                </IconButton>
              </Tooltip>
            );
          })}

        <NavIcon
          icon={<StorefrontRoundedIcon />}
          label="Marketplace"
          BRAND={BRAND}
          active={isMarketActive}
          onClick={() => {
            onNavigateExternal?.("/dashboard/marketplace") ?? onNavigate?.("/dashboard/marketplace");
          }}
        />
        <NavIcon
          icon={<SettingsRoundedIcon />}
          label="設定"
          BRAND={BRAND}
          active={currentPath.startsWith("/dashboard/settings")}
          onClick={() => {
            onNavigateExternal?.("/dashboard/settings") ?? onNavigate?.("/dashboard/settings");
          }}
        />

        {/* App Switcher */}
        <Tooltip title="アプリ一覧" placement="right">
          <IconButton
            onClick={handleAppClick}
            sx={{
              mb: 0.5,
              p: 1,
              bgcolor: appAnchorEl ? "rgba(255,255,255,0.1)" : "transparent",
              borderRadius: 2,
              "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            <AppsRoundedIcon sx={{ color: "rgba(255,255,255,0.7)", fontSize: 22 }} />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={appAnchorEl}
          open={Boolean(appAnchorEl)}
          onClose={handleAppClose}
          transformOrigin={{ horizontal: "left", vertical: "bottom" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          slotProps={{
            paper: {
              sx: {
                bgcolor: "rgba(20,20,20,0.88)",
                backdropFilter: "blur(16px)",
                border: `1px solid ${BRAND.line}`,
                ml: 1.5,
                mb: 1,
                p: 0.5,
                borderRadius: 3,
              },
            },
          }}
        >
          {APPS_CATALOG.map((app) => (
            <MenuItem
              key={app.key}
              onClick={() => {
                handleAppClose();
                handleMenuNavigate(app.key, app.hrefAuth, app.hrefPublic);
              }}
              sx={{ borderRadius: 2, mb: 0.25, py: 1 }}
            >
              <ListItemIcon>
                <AppImageIcon src={appIcons[app.key] || app.icon} alt={app.key.toUpperCase()} fallbackChar={app.key.charAt(0).toUpperCase()} />
              </ListItemIcon>
              <Typography sx={{ fontSize: 13 }}>{app.label}</Typography>
            </MenuItem>
          ))}
        </Menu>

        <UserAvatarMenu
          user={user}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onNavigateExternal={onNavigateExternal}
          onChangeMainView={onChangeMainView}
          BRAND={BRAND}
        />
      </Box>
    </>
  );
}
