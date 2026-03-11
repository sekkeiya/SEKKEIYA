import React, { useState, useCallback } from "react";
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

import { useAuth } from "@/features/auth/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import { useNavigate, useLocation } from "react-router-dom";
import DeleteAccountDialog from "@/shared/ui/DeleteAccountDialog";

import sharePng from "@/assets/icons/share.png";
import sekkeiyaPng from "@/assets/icons/sekkeiya.png";
import layoutPng from "@/assets/icons/layout.png";
import presentsPng from "@/assets/icons/presents.png";
import questPng from "@/assets/icons/quest.png";

import { BRAND } from "@/shared/ui/theme";
import NavIcon from "@/shared/ui/NavIcon";
import useBoards from "@/shared/hooks/useBoards";

const AppImageIcon = ({ src, alt }) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    sx={{
      width: 28,
      height: 28,
      borderRadius: "50%",
      objectFit: "cover",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    }}
  />
);

const UserAvatarMenu = () => {
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const loginUrl = "https://sekkeiya.com/login?return_to=%2Fdashboard";
  const signupUrl = "https://sekkeiya.com/signup?return_to=%2Fdashboard";

  const onLogout = useCallback(async () => {
    try {
      await signOut(auth);
      window.location.assign("/");
    } catch (e) {
      console.error("[AvatarMenu] signOut failed:", e);
      window.location.assign("/");
    }
  }, []);

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

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
              bgcolor: BRAND.panel,
              color: BRAND.text,
              border: `1px solid ${BRAND.line}`,
              minWidth: 180,
              mt: -1,
              ml: 1
            }
          }
        }}
      >
        {user ? [
          <MenuItem key="dashboard" onClick={() => { handleClose(); /* navigate to dashboard home if needed, or already there */ }}>
            <ListItemIcon><DashboardRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            ダッシュボード
          </MenuItem>,
          <MenuItem key="delete" onClick={() => { handleClose(); setDeleteDialogOpen(true); }} sx={{ color: "error.main" }}>
            <ListItemIcon><PersonRemoveRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            アカウント削除
          </MenuItem>,
          <Divider key="div" sx={{ borderColor: BRAND.line }} />,
          <MenuItem key="logout" onClick={() => { handleClose(); onLogout(); }}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            ログアウト
          </MenuItem>
        ] : [
          <MenuItem key="login" onClick={() => { handleClose(); window.location.assign(loginUrl); }}>
            <ListItemIcon><LoginRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            サインイン
          </MenuItem>,
          <MenuItem key="signup" onClick={() => { handleClose(); window.location.assign(signupUrl); }}>
            <ListItemIcon><PersonAddRoundedIcon fontSize="small" sx={{ color: BRAND.text }} /></ListItemIcon>
            サインアップ
          </MenuItem>
        ]}
      </Menu>

      <DeleteAccountDialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
        user={user} 
      />
    </>
  );
};

export default function MiniSidebar({ onToggle, isExpanded, appId = "sekkeiya" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { myBoards, teamBoards } = useBoards();

  const [appAnchorEl, setAppAnchorEl] = useState(null);
  const handleAppClick = (e) => setAppAnchorEl(e.currentTarget);
  const handleAppClose = () => setAppAnchorEl(null);

  const path = location.pathname;
  const isDrive = path.startsWith("/dashboard/drive");

  const myRecent = [...myBoards]
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .slice(0, 3);

  const teamRecent = [...teamBoards]
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .slice(0, 3);

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

      {/* Dashboard Home Button */}
      {appId === "sekkeiya" ? (
        <Tooltip title="SEKKEIYA ダッシュボード" placement="right">
          <IconButton onClick={() => navigate("/dashboard")} sx={{ mb: 1 }}>
            <AppImageIcon src={sekkeiyaPng} alt="SEKKEIYA" />
          </IconButton>
        </Tooltip>
      ) : appId === "3dss" ? (
        <Tooltip title="3D Shape Share ホーム" placement="right">
          <IconButton onClick={() => navigate("/dashboard")} sx={{ mb: 1 }}>
            <AppImageIcon src={sharePng} alt="3DSS" />
          </IconButton>
        </Tooltip>
      ) : null}

      <NavIcon 
        icon={<FolderRoundedIcon />} 
        label="AIドライブ" 
        active={isDrive} 
        onClick={() => { window.location.href = 'https://sekkeiya.com/app/drive'; }} 
      />

      <NavIcon 
        icon={<ChatRoundedIcon />} 
        label="AIチャット" 
        active={false} 
        onClick={() => { window.location.href = 'https://sekkeiya.com/app/chat'; }} 
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
      {myRecent.map((p, i) => {
        const isActive = path === `/dashboard/projects/${p.id}`;
        return (
        <Tooltip title={p.name} placement="right" key={p.id}>
          <Box
            onClick={() => { navigate(`/dashboard/projects/${p.id}`); }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: isActive ? "rgba(255,255,255,0.15)" : BRAND.panel2,
              border: `1px solid ${BRAND.line}`,
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 14,
              color: isActive ? "#3498db" : BRAND.text,
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
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
      })}

      <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />

      {/* Team Boards Shortcuts */}
      {teamRecent.length > 0 && (
        <Tooltip title="Team Boards" placement="right">
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center", opacity: 0.4, mt: 1, mb: 0.5 }}>
            <GroupRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>
      )}
      {teamRecent.map((p, i) => {
        const isActive = path === `/dashboard/projects/${p.id}`;
        return (
        <Tooltip title={p.name} placement="right" key={p.id}>
          <Box
            onClick={() => { navigate(`/dashboard/projects/${p.id}`); }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: isActive ? "rgba(255,255,255,0.15)" : BRAND.panel2,
              border: `1px solid ${BRAND.line}`,
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 14,
              color: isActive ? "#3498db" : BRAND.text,
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
            }}
          >
            {p.coverThumbnailUrl ? (
              <Box component="img" src={p.coverThumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px' }} />
            ) : (
              p.name ? p.name.charAt(0).toUpperCase() : "T"
            )}
          </Box>
        </Tooltip>
        );
      })}

      <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />

      <Box sx={{ flex: 1 }} />

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
        <MenuItem onClick={() => { handleAppClose(); window.location.assign(user ? "/app/share/dashboard" : "/app/share/"); }} sx={{ borderRadius: 2, mb: 0.5 }}>
          <ListItemIcon><AppImageIcon src={sharePng} alt="3DSS" /></ListItemIcon>
          3D Shape Share
        </MenuItem>
        <MenuItem onClick={() => { handleAppClose(); window.location.assign(user ? "/app/layout/dashboard" : "/app/layout/"); }} sx={{ borderRadius: 2, mb: 0.5 }}>
          <ListItemIcon><AppImageIcon src={layoutPng} alt="3DSL" /></ListItemIcon>
          3D Shape Layout
        </MenuItem>
        <MenuItem onClick={() => { handleAppClose(); window.location.assign("/app/presents/"); }} sx={{ borderRadius: 2, mb: 0.5 }}>
          <ListItemIcon><AppImageIcon src={presentsPng} alt="3DSP" /></ListItemIcon>
          3D Shape Presents
        </MenuItem>
        <MenuItem onClick={() => { handleAppClose(); window.location.assign("/app/quest/"); }} sx={{ borderRadius: 2 }}>
          <ListItemIcon><AppImageIcon src={questPng} alt="3DSQ" /></ListItemIcon>
          3D Shape Quest
        </MenuItem>
      </Menu>

      <UserAvatarMenu />
    </Box>
  );
}
