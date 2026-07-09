import React, { useState, useEffect } from 'react';
import { Box, Tooltip, IconButton, Avatar, Menu, MenuItem, ListItemIcon, Divider, Typography, Snackbar, Alert, useMediaQuery } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import SquareFootRoundedIcon from '@mui/icons-material/SquareFootRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import Badge from '@mui/material/Badge';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useNotificationsStore } from '../../store/useNotificationsStore';
import { useTeamsStore } from '../../store/useTeamsStore';
import { NotificationPanel } from '../../features/teams/components/NotificationPanel';
import { BRAND } from '../../styles/theme';
import type { AppScope } from '../../shared/layout/workspace/types';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdate } from '../../lib/checkForUpdate';

import icon3DSS from '../../../src-tauri/src/assets/icons/share.png';
import icon3DSL from '../../../src-tauri/src/assets/icons/layout.png';
import icon3DSP from '../../../src-tauri/src/assets/icons/presents.png';
import icon3DSC from '../../../src-tauri/src/assets/icons/create.png';
import icon3DSD from '../../../src-tauri/src/assets/icons/diagram.png';
import icon3DSR from '../../../src-tauri/src/assets/icons/drawing.png';
import icon3DSI from '../../../src-tauri/src/assets/icons/image.png';
import icon3DSQ from '../../../src-tauri/src/assets/icons/quest.png';
import icon3DSF from '../../../src-tauri/src/assets/icons/books.png';
import iconSekkeiya from '../../../src-tauri/src/assets/icons/sekkeiya.png';
import { UserSettingsDialog } from './UserSettingsDialog';

const NavIcon = ({ icon, label, active, onClick, isBrand, disabled }: any) => {
  const isMobile = useMediaQuery('(max-width:768px)');

  // On mobile the rail becomes a drawer: render a full-width row with a label and a 48px touch target.
  if (isMobile) {
    return (
      <Box
        component="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          minHeight: 48,
          px: 1.5,
          py: 1,
          border: 'none',
          borderRadius: 2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          bgcolor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: active ? '#3498db' : 'rgba(255,255,255,0.8)',
          opacity: disabled ? 0.4 : 1,
          textAlign: 'left',
          '&:active': { bgcolor: 'rgba(255,255,255,0.16)' },
        }}
      >
        <Box sx={{ display: 'flex', width: 24, justifyContent: 'center', flexShrink: 0 }}>
          {React.cloneElement(icon, { fontSize: 'small' })}
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'inherit' }} noWrap>
          {label}
        </Typography>
      </Box>
    );
  }

  return (
  <Tooltip title={disabled ? "プロジェクトを選択してください" : label} placement="right">
    <Box component="span" sx={{ display: 'block' }}>
      <IconButton
        onClick={disabled ? undefined : onClick}
        sx={{
          bgcolor: active ? (isBrand ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)') : 'transparent',
          color: active ? '#3498db' : 'rgba(255,255,255,0.6)',
          boxShadow: active && isBrand ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
          border: active && isBrand ? '1px solid rgba(255,255,255,0.5)' : (isBrand ? '1px solid transparent' : 'none'),
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          '&:hover': {
            bgcolor: disabled ? 'transparent' : (isBrand ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.1)'),
            color: disabled ? 'rgba(255,255,255,0.6)' : '#fff',
            borderColor: disabled ? 'transparent' : (isBrand ? 'rgba(255,255,255,0.3)' : 'none')
          },
          p: 0.75,
          borderRadius: isBrand ? '50%' : undefined
        }}
      >
        {React.cloneElement(icon, { fontSize: "small" })}
      </IconButton>
    </Box>
  </Tooltip>
  );
};

const AppImageFallback = ({ src, fallback, size = 22 }: { src: string, fallback: React.ReactElement, size?: number }) => {
  const [error, setError] = useState(false);
  if (error) return React.cloneElement(fallback, { fontSize: "small" } as any);
  return <img src={src} onError={() => setError(true)} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }} alt="" />;
};

type SubAppDef = { label: string; scope: AppScope; workspaceId: string; src: string; Fallback: React.ComponentType<any> };
const ALL_SUB_APPS: SubAppDef[] = [
  { label: 'S.Models',        scope: '3dss', workspaceId: 'models',   src: icon3DSS, Fallback: ViewInArRoundedIcon    },
  { label: 'S.Layout',        scope: '3dsl', workspaceId: 'layout',   src: icon3DSL, Fallback: GridViewRoundedIcon    },
  { label: 'S.Presentations', scope: '3dsp', workspaceId: 'presents', src: icon3DSP, Fallback: PresentToAllRoundedIcon },
  { label: 'S.Create',        scope: '3dsc', workspaceId: 'create',   src: icon3DSC, Fallback: BrushRoundedIcon       },
  { label: 'S.Diagram',       scope: '3dsd', workspaceId: 'diagram',  src: icon3DSD, Fallback: WbSunnyRoundedIcon     },
  { label: 'S.Drawing',       scope: '3dsr', workspaceId: 'drawing',  src: icon3DSR, Fallback: SquareFootRoundedIcon  },
  { label: 'S.Image',         scope: '3dsi', workspaceId: 'image',    src: icon3DSI, Fallback: PhotoLibraryRoundedIcon },
  { label: 'S.Quest',         scope: '3dsq', workspaceId: 'quest',    src: icon3DSQ, Fallback: SchoolRoundedIcon      },
  { label: 'S.Portfolio',     scope: '3dsf', workspaceId: 'portfolio', src: icon3DSF, Fallback: MenuBookRoundedIcon  },
];

// Fixed height of all non-sub-app items (px): top padding + menu + sekkeiya + spacer + AI×5 + dividers×2 + mgmt×3 + bottom items
const SUBAPP_OVERHEAD_PX = 580;
const SUBAPP_ITEM_PX     = 36;

const MiniSidebar: React.FC<{ open?: boolean; onClose?: () => void }> = ({ open = false, onClose }) => {
  const isMobile = useMediaQuery('(max-width:768px)');
  const { currentUser, logout } = useAuthStore();
  const {
    setCurrentMainView,
    setViewingCreatorId,
    toggleProjectSidebar,
    toggleAIChat,
    toggleAIDrive,
    isAIDriveOpen,
    isAIChatOpen,
    isAI3DCreateOpen,
    currentMainView,
    setAIDriveOpen,
    toggleAI3DCreate,
    setAI3DCreateOpen,
    isAIRenderOpen,
    toggleAIRender,
    setAIRenderOpen,
    activeWorkspaceId,
    setActiveWorkspaceId,
    setLastActiveAppScope,
    isAIDriveExpanded,
    setActiveProjectId
  } = useAppStore();

  const { unreadCount, startListening, stopListening, actionError, clearActionError } = useNotificationsStore();
  const setActiveTeamId = useTeamsStore(s => s.setActiveTeamId);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (currentUser) {
      startListening(currentUser.uid);
      return () => stopListening();
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const currentVersion = await getVersion();
        const update = await checkForUpdate(currentVersion);
        if (update) {
          useNotificationsStore.getState().addLocalNotification({
            id: `update_available_${update.latestVersion}`,
            type: 'update_available',
            read: false,
            createdAt: new Date().toISOString(),
            latestVersion: update.latestVersion,
            releaseNotes: update.releaseNotes,
          });
        }
      } catch {
        // version check is best-effort
      }
    })();
  }, [currentUser?.uid]);

  // On mobile, close the nav drawer whenever the user navigates to a destination / opens a panel.
  useEffect(() => {
    if (isMobile && open) onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMainView, activeWorkspaceId, isAIDriveOpen, isAIChatOpen, isAI3DCreateOpen, isAIRenderOpen]);

  const openMyProfile = () => {
    setAnchorEl(null);
    if (currentUser?.uid) {
      setViewingCreatorId(currentUser.uid);
      setCurrentMainView('creator-profile');
    }
  };

  const handleNavClick = (action: () => void, ignoreCloseRender = false, ignoreCloseCreate = false, ignoreCloseDrive = false) => {
    if (!ignoreCloseDrive) setAIDriveOpen(false);
    if (!ignoreCloseRender) setAIRenderOpen(false);
    if (!ignoreCloseCreate) setAI3DCreateOpen(false);
    action();
  };

  const launchAppWithContext = (scope: AppScope, defaultWorkspaceId: string) => {
    handleNavClick(() => {
      setCurrentMainView('workspace');
      setLastActiveAppScope(scope);
      setActiveWorkspaceId(defaultWorkspaceId);
    });
  };

  // Determine how many sub-apps fit in the available vertical space.
  const rawMax    = Math.floor((windowHeight - SUBAPP_OVERHEAD_PX) / SUBAPP_ITEM_PX);
  const maxVisible = Math.max(2, Math.min(ALL_SUB_APPS.length, rawMax));

  // Always keep the currently active sub-app visible.
  const activeIdx = ALL_SUB_APPS.findIndex(a => a.workspaceId === activeWorkspaceId);
  let visibleApps = ALL_SUB_APPS.slice(0, maxVisible);
  const hiddenApps = ALL_SUB_APPS.slice(maxVisible);
  if (activeIdx >= maxVisible) {
    visibleApps = [...ALL_SUB_APPS.slice(0, maxVisible - 1), ALL_SUB_APPS[activeIdx]];
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <Box
      sx={{
        width: 56,
        height: "100%",
        bgcolor: BRAND.bg,
        borderRight: `1px solid ${BRAND.line}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 1,
        gap: 0.5,
        position: "relative",
        zIndex: 1400,
        flexShrink: 0,
        ...(isMobile && {
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 264,
          maxWidth: '80vw',
          alignItems: 'stretch',
          px: 1,
          gap: 0.5,
          overflowY: 'auto',
          zIndex: 1500,
          boxShadow: '4px 0 24px rgba(0,0,0,0.6)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }),
      }}
    >
      {/* ── トップ固定 ── */}
      <Tooltip title="プロジェクトバーを開閉" placement="right">
        <IconButton onClick={() => handleNavClick(toggleProjectSidebar)} sx={{ color: BRAND.text, p: 0.75 }}>
          <MenuRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <NavIcon
        icon={<AppImageFallback src={iconSekkeiya} fallback={<DashboardRoundedIcon />} size={20} />}
        label="SEKKEIYA"
        active={currentMainView === 'app-hub'}
        onClick={() => handleNavClick(() => setCurrentMainView('app-hub'))}
      />

      <Box sx={{ height: 6 }} />

      {/* ── AIツール ── */}
      <NavIcon
        icon={<FolderRoundedIcon />}
        label="AIドライブ"
        active={isAIDriveOpen}
        onClick={() => {
          setAIRenderOpen(false);
          setAI3DCreateOpen(false);
          toggleAIDrive();
        }}
      />

      <NavIcon
        icon={<ChatRoundedIcon />}
        label="AIチャット"
        active={isAIChatOpen}
        onClick={() => handleNavClick(toggleAIChat, false, false, isAIDriveExpanded)}
      />

      <NavIcon
        icon={<WallpaperRoundedIcon />}
        label="AI Render"
        active={isAIRenderOpen}
        onClick={() => handleNavClick(toggleAIRender, true, false, isAIDriveExpanded)}
      />

      <NavIcon
        icon={<BrushRoundedIcon />}
        label="AI 3D Generate"
        active={isAI3DCreateOpen}
        onClick={() => handleNavClick(toggleAI3DCreate, false, true, isAIDriveExpanded)}
      />

      <NavIcon
        icon={<SchoolRoundedIcon />}
        label="AI Studio"
        active={currentMainView === 'ai-studio'}
        onClick={() => handleNavClick(() => setCurrentMainView(currentMainView === 'ai-studio' ? 'app-hub' : 'ai-studio'))}
      />

      {/* ── 管理・発見 ── */}
      <Divider sx={{ width: "80%", my: 1.25, borderColor: 'rgba(144,202,249,0.35)', boxShadow: '0 0 6px rgba(144,202,249,0.15)' }} />

      <NavIcon
        icon={<AccountTreeRoundedIcon />}
        label="プロジェクト管理"
        active={currentMainView === 'project-management'}
        onClick={() => handleNavClick(() => setCurrentMainView(currentMainView === 'project-management' ? 'app-hub' : 'project-management'))}
      />

      <NavIcon
        icon={<GroupsRoundedIcon />}
        label="チーム管理"
        active={currentMainView === 'teams'}
        onClick={() => handleNavClick(() => {
          setActiveTeamId(null);
          setCurrentMainView('teams');
        })}
      />

      <NavIcon
        icon={<CollectionsRoundedIcon />}
        label="ギャラリー"
        active={currentMainView === 'gallery'}
        onClick={() => handleNavClick(() => setCurrentMainView(currentMainView === 'gallery' ? 'app-hub' : 'gallery'))}
      />

      {/* ── サブアプリ ── */}
      <Divider sx={{ width: "80%", my: 1.25, borderColor: 'rgba(144,202,249,0.35)', boxShadow: '0 0 6px rgba(144,202,249,0.15)' }} />

      {visibleApps.map(app => (
        <NavIcon
          key={app.workspaceId}
          icon={<AppImageFallback src={app.src} fallback={<app.Fallback />} />}
          label={app.label}
          isBrand={true}
          active={activeWorkspaceId === app.workspaceId && currentMainView === 'workspace'}
          onClick={() => launchAppWithContext(app.scope, app.workspaceId)}
        />
      ))}

      {hiddenApps.length > 0 && (
        <>
          <Tooltip title="他のアプリ" placement="right">
            <Box component="span" sx={{ display: 'block' }}>
              <IconButton
                onClick={e => setMoreAnchorEl(e.currentTarget)}
                sx={{ p: 0.75, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                <MoreHorizRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Tooltip>
          <Menu
            anchorEl={moreAnchorEl}
            open={Boolean(moreAnchorEl)}
            onClose={() => setMoreAnchorEl(null)}
            anchorOrigin={{ horizontal: 'right', vertical: 'center' }}
            transformOrigin={{ horizontal: 'left', vertical: 'center' }}
            slotProps={{ paper: { sx: { bgcolor: '#1a1c22', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minWidth: 180, ml: 1, borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' } } }}
          >
            {hiddenApps.map(app => (
              <MenuItem
                key={app.workspaceId}
                onClick={() => { launchAppWithContext(app.scope, app.workspaceId); setMoreAnchorEl(null); }}
                sx={{ gap: 1.5, fontSize: '0.85rem', borderRadius: 1, mx: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
              >
                <AppImageFallback src={app.src} fallback={<app.Fallback />} size={18} />
                {app.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      {/* ── ユーティリティ（下部固定） ── */}
      <Box sx={{ flex: 1 }} />

      <NavIcon
        icon={<StorefrontRoundedIcon />}
        label="Marketplace"
        active={currentMainView === 'marketplace'}
        onClick={() => handleNavClick(() => setCurrentMainView(currentMainView === 'marketplace' ? 'app-hub' : 'marketplace'))}
      />

      <NavIcon
        icon={<SettingsRoundedIcon />}
        label="設定"
        active={currentMainView === 'global-settings'}
        onClick={() => handleNavClick(() => setCurrentMainView(currentMainView === 'global-settings' ? 'app-hub' : 'global-settings'))}
      />

      <Tooltip title="通知" placement="right">
        <IconButton
          onClick={e => setNotifAnchorEl(e.currentTarget)}
          sx={{ color: unreadCount > 0 ? '#3498db' : 'rgba(255,255,255,0.6)', p: 0.75 }}
        >
          <Badge
            badgeContent={unreadCount}
            max={9}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#ef4444', color: '#fff',
                fontSize: 10, minWidth: 16, height: 16,
              },
            }}
          >
            <NotificationsRoundedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title="アカウント" placement="right">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ mb: 0 }}>
          <Avatar 
            src={currentUser?.photoURL || undefined} 
            sx={{ 
              width: 32, 
              height: 32, 
              fontSize: '0.875rem',
              bgcolor: "primary.main",
              border: `2px solid transparent`,
            }}
          >
            {currentUser?.email?.[0]?.toUpperCase() || 'U'}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ 
          paper: { 
            sx: { 
              bgcolor: 'rgba(20, 20, 20, 0.85)', 
              backdropFilter: 'blur(16px)',
              color: '#fff', 
              border: `1px solid rgba(255, 255, 255, 0.1)`, 
              minWidth: 240, 
              ml: 2,
              mb: 1,
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden'
            }
          }
        }}
      >
        {currentUser && (
          <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
            <Avatar 
              src={currentUser.photoURL || undefined}
              sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 'bold' }}
            >
              {currentUser.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
                {currentUser.displayName || "ユーザー"}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                {currentUser.email}
              </Typography>
            </Box>
          </Box>
        )}
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
        
        <Box sx={{ p: 1 }}>
          <MenuItem 
            onClick={openMyProfile}
            sx={{ borderRadius: 2, mb: 0.5, py: 1.5, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' } }}
          >
            <ListItemIcon><PersonRoundedIcon fontSize="small" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} /></ListItemIcon>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>マイページ</Typography>
          </MenuItem>
          <MenuItem 
            onClick={() => { setAnchorEl(null); setSettingsOpen(true); }}
            sx={{ borderRadius: 2, py: 1.5, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' } }}
          >
            <ListItemIcon><SettingsRoundedIcon fontSize="small" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} /></ListItemIcon>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>アカウント</Typography>
          </MenuItem>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
        <Box sx={{ p: 1 }}>
          <MenuItem 
            onClick={() => { setAnchorEl(null); handleLogout(); }}
            sx={{ borderRadius: 2, py: 1.5, color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
          >
            <ListItemIcon><LogoutRoundedIcon fontSize="small" sx={{ color: '#ef4444' }} /></ListItemIcon>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>ログアウト</Typography>
          </MenuItem>
        </Box>
      </Menu>

      <UserSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <NotificationPanel
        anchorEl={notifAnchorEl}
        onClose={() => setNotifAnchorEl(null)}
      />

      {/* グローバルエラー通知（通知パネルが閉じていても表示） */}
      <Snackbar
        open={!!actionError}
        autoHideDuration={5000}
        onClose={clearActionError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={clearActionError} sx={{ fontSize: 13 }}>
          {actionError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MiniSidebar;
