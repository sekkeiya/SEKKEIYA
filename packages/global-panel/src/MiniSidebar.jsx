import React, { useState, useEffect } from "react";
import { Box, Tooltip, IconButton, Avatar, Menu, MenuItem, ListItemIcon, Divider } from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";

import { APPS_CATALOG } from "./appRoutes.js";
import { getBoardRoute } from "./getBoardRoute.js";
import { usePanelTheme } from "./theme/ThemeContext.jsx";
import { useSharedBoardStore } from "./store/useSharedBoardStore.js";

const AppImageIcon = ({ src, alt, fallbackChar }) => (
  <Box
    sx={{
      width: 28,
      height: 28,
      borderRadius: "50%",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: src ? "transparent" : "#333",
      color: "#fff",
      overflow: "hidden"
    }}
  >
    {src ? (
      <Box component="img" src={src} alt={alt} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
    ) : (
      <span style={{ fontSize: 13, fontWeight: "bold" }}>{fallbackChar || alt?.charAt(0) || "A"}</span>
    )}
  </Box>
);

const NavIcon = ({ icon, label, active, onClick, BRAND }) => (
  <Tooltip title={label} placement="right">
    <IconButton
      onClick={onClick}
      sx={{
        mb: 1,
        color: active ? BRAND.primary : "rgba(255,255,255,0.7)",
        bgcolor: active ? "rgba(255,255,255,0.1)" : "transparent",
        "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
      }}
    >
      {icon}
    </IconButton>
  </Tooltip>
);

const UserAvatarMenu = ({ user, onLogout, onNavigate, onNavigateExternal, onChangeMainView, BRAND }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  
  const loginUrl = "/login?return_to=%2Fdashboard";
  const signupUrl = "/signup?return_to=%2Fdashboard";

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleAction = (action) => {
    handleClose();
    if (typeof action === 'function') action();
  };

  return (
    <>
      <Tooltip title={user ? "アカウント設定" : "ログイン"} placement="right">
        <IconButton onClick={handleClick} sx={{ mb: 1 }}>
          <Avatar 
            src={user?.photoURL} 
            sx={{ 
              width: 36, 
              height: 36, 
              bgcolor: user ? "primary.main" : "rgba(255,255,255,0.1)",
              border: `2px solid ${anchorEl ? BRAND.text : 'transparent'}`,
              transition: "all 0.2s"
            }}
          >
            {!user && <LoginRoundedIcon fontSize="small" />}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: BRAND.panel || '#1e1e1e',
              color: BRAND.text || '#fff',
              border: `1px solid ${BRAND.line || 'rgba(255,255,255,0.1)'}`,
              minWidth: 180,
              mt: -1,
              ml: 1
            }
          }
        }}
      >
        {user ? [
          <Box key="user-info" sx={{ px: 2, py: 1.5, pb: 1 }}>
            <Box sx={{ fontSize: 14, fontWeight: 'bold' }}>{user.displayName || "ユーザー"}</Box>
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{user.email || ""}</Box>
          </Box>,
          <Divider key="div1" sx={{ borderColor: BRAND.line }} />,
          <MenuItem key="dashboard" onClick={() => handleAction(() => {
            if (onChangeMainView) onChangeMainView("home");
            else onNavigateExternal("/");
          })}>
            <ListItemIcon><DashboardRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            ダッシュボード
          </MenuItem>,
          <MenuItem key="connections" onClick={() => handleAction(() => {
            if (onChangeMainView) onChangeMainView("connections");
            else onNavigateExternal("/dashboard/connections");
          })}>
            <ListItemIcon><PeopleAltRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            つながり管理
          </MenuItem>,
          <Divider key="div2" sx={{ borderColor: BRAND.line }} />,
          <MenuItem key="logout" onClick={() => handleAction(onLogout)}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            ログアウト
          </MenuItem>
        ] : [
          <MenuItem key="login" onClick={() => handleAction(() => window.location.assign(loginUrl))}>
            <ListItemIcon><LoginRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            サインイン
          </MenuItem>,
          <MenuItem key="signup" onClick={() => handleAction(() => window.location.assign(signupUrl))}>
            <ListItemIcon><PersonAddRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            サインアップ
          </MenuItem>
        ]}
      </Menu>
    </>
  );
};

export default function MiniSidebar({ 
  currentApp = "sekkeiya", 
  currentBoardId, 
  boards = [], 
  user, 
  onNavigate, 
  onNavigateExternal, 
  onChangeMainView,
  onSelectBoard,
  onOpenChat, 
  onOpenDrive, 
  activePanelState, // "chat" | "drive" | null
  onLogout,
  onToggle,
  isExpanded = false,
  recentApps = [],
  appIcons = {}
}) {
  const BRAND = usePanelTheme();
  const [appAnchorEl, setAppAnchorEl] = useState(null);

  // Sync currentBoardId with the shared store so OTHER apps know the last active board
  useEffect(() => {
    if (currentBoardId) {
      useSharedBoardStore.getState().setCurrentBoardId(currentBoardId);
    }
  }, [currentBoardId]);

  const handleAppClick = (e) => setAppAnchorEl(e.currentTarget);
  const handleAppClose = () => setAppAnchorEl(null);

  const handleBoardClick = (boardId) => {
    // Save to shared store immediately when clicking a board shortcut
    useSharedBoardStore.getState().setCurrentBoardId(boardId);
    
    if (onSelectBoard) onSelectBoard(boardId);
    if (onChangeMainView) {
      onChangeMainView("boardDetail");
    } else {
      const route = getBoardRoute(currentApp, boardId);
      // Board switching within the same app
      onNavigate(route);
    }
  };

  const handleMenuNavigate = (targetApp, authRoute, pubRoute) => {
    const savedBoardId = useSharedBoardStore.getState().currentBoardId;
    let url = (user && authRoute) ? authRoute : pubRoute;
    
    // Auto-append board context if moving across apps
    if (user && savedBoardId) {
      url = getBoardRoute(targetApp, savedBoardId);
    }

    if (targetApp === currentApp) {
      if (onNavigate) onNavigate(url);
      else window.location.assign(url);
    } else {
      if (onNavigateExternal) onNavigateExternal(url);
      else window.location.assign(url);
    }
  };

  const myBoards = boards.filter(b => b.boardType !== "teamBoards");
  const teamBoards = boards.filter(b => b.boardType === "teamBoards");

  const myRecent = [...myBoards]
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .slice(0, 3);

  const teamRecent = [...teamBoards]
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .slice(0, 3);

  const renderBoardShortcut = (p) => {
    const isActive = p.id === currentBoardId;
    return (
      <Tooltip title={p.name} placement="right" key={p.id}>
        <Box
          onClick={() => handleBoardClick(p.id)}
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: isActive ? "rgba(255,255,255,0.15)" : (BRAND.panel2 || '#2a2a2a'),
            border: `1px solid ${BRAND.line}`,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 14,
            color: isActive ? (BRAND.primary || "#3498db") : BRAND.text,
            cursor: "pointer",
            "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
            my: 0.5
          }}
        >
          {p.coverThumbnailUrl ? (
            <Box component="img" src={p.coverThumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px' }} />
          ) : (
            p.name ? p.name.charAt(0).toUpperCase() : "M"
          )}
        </Box>
      </Tooltip>
    );
  };

  const getCurrentAppHomeRoute = (appKey) => {
    const app = APPS_CATALOG.find(a => a.key === appKey);
    return user ? (app?.hrefAuth || "/dashboard") : (app?.hrefPublic || "/");
  };

  const getCurrentAppHomeIcon = (appKey) => {
    return appIcons[appKey] || APPS_CATALOG.find(a => a.key === appKey)?.icon || null;
  };

  return (
    <Box
      sx={{
        width: 72,
        borderRight: `1px solid ${BRAND.line}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 1.75,
        gap: 1,
        height: "100vh",
        bgcolor: BRAND.bg,
        position: "relative",
        zIndex: 20,
      }}
    >
      {onToggle && (
        <Tooltip title={isExpanded ? "メニューを閉じる" : "メニューを開く"} placement="right">
          <IconButton 
            onClick={onToggle} 
            sx={{ 
              mb: 1, 
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
              transform: isExpanded ? "rotate(180deg) scale(0.9)" : "rotate(0deg) scale(1)",
            }}
          >
            {isExpanded ? <MenuOpenRoundedIcon sx={{ color: BRAND.text }} /> : <MenuRoundedIcon sx={{ color: BRAND.text }} />}
          </IconButton>
        </Tooltip>
      )}

      {/* Current App Home Button */}
      <Tooltip title={`${APPS_CATALOG.find(a => a.key === currentApp)?.label || "Home"}`} placement="right">
        <IconButton onClick={() => {
          if (onChangeMainView) onChangeMainView("home");
          
          const homeRoute = getCurrentAppHomeRoute(currentApp);
          if (onNavigate) onNavigate(homeRoute);
          else window.location.assign(homeRoute);
        }} sx={{ mb: 1 }}>
          <AppImageIcon src={getCurrentAppHomeIcon(currentApp)} alt={currentApp} fallbackChar={currentApp.charAt(0).toUpperCase()} />
        </IconButton>
      </Tooltip>

      <NavIcon 
        icon={<FolderRoundedIcon />} 
        label="AIドライブ" 
        BRAND={BRAND}
        active={activePanelState === "drive"} 
        onClick={onOpenDrive} 
      />

      <NavIcon 
        icon={<ChatRoundedIcon />} 
        label="AIチャット" 
        BRAND={BRAND}
        active={activePanelState === "chat"} 
        onClick={onOpenChat} 
      />

      <NavIcon 
        icon={<AccountTreeRoundedIcon />} 
        label="ボード管理" 
        BRAND={BRAND}
        active={false} // Needs logic passed from outside if we want to highlight this
        onClick={() => {
          if (onChangeMainView) onChangeMainView("boards");
          else onNavigateExternal("/dashboard/boards");
        }} 
      />

      <Divider sx={{ width: "60%", opacity: 0.25, my: 1.5 }} />

      {/* My Boards Shortcuts */}
      {myRecent.length > 0 && (
        <Tooltip title="My Boards" placement="right">
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center", opacity: 0.4, mb: 0.5 }}>
            <PersonRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>
      )}
      {myRecent.map(renderBoardShortcut)}

      {myRecent.length > 0 && teamRecent.length > 0 && (
        <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />
      )}

      {/* Team Boards Shortcuts */}
      {teamRecent.length > 0 && (
        <Tooltip title="Team Boards" placement="right">
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center", opacity: 0.4, mt: 1, mb: 0.5 }}>
            <GroupRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>
      )}
      {teamRecent.map(renderBoardShortcut)}

      <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />

      <Box sx={{ flex: 1 }} />

      {/* Recent Apps Shortcuts */}
      {recentApps.length > 0 && recentApps.map(app => {
        const appInfo = APPS_CATALOG.find(a => a.key === app);
        if (!appInfo) return null;
        return (
          <Tooltip title={`直前のアプリ: ${appInfo.label}`} placement="right" key={app}>
            <IconButton onClick={() => handleMenuNavigate(app, appInfo.hrefAuth, appInfo.hrefPublic)} sx={{ mb: 1, bgcolor: "rgba(255,255,255,0.05)" }}>
              <AppImageIcon 
                src={appIcons[app] || appInfo.icon} 
                alt={app.toUpperCase()} 
                fallbackChar={app.charAt(0).toUpperCase()}
              />
            </IconButton>
          </Tooltip>
        );
      })}

      {/* App Switcher */}
      <Tooltip title="アプリ一覧" placement="right">
        <IconButton 
          onClick={handleAppClick} 
          sx={{ 
            mb: 1.5, 
            bgcolor: appAnchorEl ? "rgba(255,255,255,0.08)" : "transparent",
            "&:hover": { bgcolor: "rgba(255,255,255,0.08)" }
          }}
        >
          <AppsRoundedIcon sx={{ color: "rgba(255,255,255,0.8)", fontSize: 26 }} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={appAnchorEl}
        open={Boolean(appAnchorEl)}
        onClose={handleAppClose}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, ml: 2, mb: 1, p: 0.5, borderRadius: 3 }}}}
      >
        {APPS_CATALOG.map((app) => (
          <MenuItem 
            key={app.key} 
            onClick={() => { 
              handleAppClose(); 
              handleMenuNavigate(app.key, app.hrefAuth, app.hrefPublic);
            }} 
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon>
              <AppImageIcon src={appIcons[app.key] || app.icon} alt={app.key.toUpperCase()} fallbackChar={app.key.charAt(0).toUpperCase()} />
            </ListItemIcon>
            {app.label}
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
  );
}
