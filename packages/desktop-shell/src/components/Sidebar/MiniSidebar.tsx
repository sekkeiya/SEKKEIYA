import React, { useState, useEffect } from 'react';
import { Box, Tooltip, IconButton, Avatar, Menu, MenuItem, ListItemIcon, Divider, Typography, Snackbar, Alert, useMediaQuery, Popover } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
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
import LocalLibraryRoundedIcon from '@mui/icons-material/LocalLibraryRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import Badge from '@mui/material/Badge';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAccountProfileStore } from '../../store/useAccountProfileStore';
import { useNotificationsStore } from '../../store/useNotificationsStore';
import { useTeamsStore } from '../../store/useTeamsStore';
import { NotificationPanel } from '../../features/teams/components/NotificationPanel';
import { GlobalSearchDialog } from '../../features/search/GlobalSearchDialog';
import { ProjectIcon } from '../../features/projects/components/ProjectIcon';
import { ProjectIconPicker } from '../../features/projects/components/ProjectIconPicker';
import { useProjectCreation } from '../../features/projects/useProjectCreation';
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
import icon3DSK from '../../../src-tauri/src/assets/icons/library.png';
import icon3DSM from '../../../src-tauri/src/assets/icons/movie.png';
import icon3DSMT from '../../../src-tauri/src/assets/icons/material.png';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TextureRoundedIcon from '@mui/icons-material/TextureRounded';
import { UserSettingsDialog } from './UserSettingsDialog';
import { CreditBalanceChip } from '../../features/billing/CreditBalanceChip';

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
          bgcolor: active ? BRAND.panel2 : 'transparent',
          color: active ? '#3498db' : BRAND.sub,
          opacity: disabled ? 0.4 : 1,
          textAlign: 'left',
          '&:active': { bgcolor: BRAND.panel2 },
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
          bgcolor: active ? (isBrand ? BRAND.panel : BRAND.panel2) : 'transparent',
          color: active ? '#3498db' : BRAND.sub2,
          boxShadow: active && isBrand ? `0 0 12px ${BRAND.glow}` : 'none',
          border: active && isBrand ? `1px solid ${BRAND.line2}` : (isBrand ? '1px solid transparent' : 'none'),
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          '&:hover': {
            bgcolor: disabled ? 'transparent' : BRAND.panel2,
            color: disabled ? BRAND.sub2 : BRAND.text,
            borderColor: disabled ? 'transparent' : (isBrand ? BRAND.line2 : 'none')
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

// アクティブになった瞬間に一度だけ弾む「ポップ」演出。クリックの手応えとして
// 押し込み（&:active）も併せて付ける。レール幅(56px)に収まる範囲のスケールに留める。
const SITE_ICON_POP = {
  '@keyframes siteIconPop': {
    '0%': { transform: 'scale(0.9)', opacity: 0.65 },
    '60%': { transform: 'scale(1.05)', opacity: 1 },
    '100%': { transform: 'scale(1)' },
  },
} as const;

const AppImageFallback = ({ src, fallback, size = 22 }: { src?: string, fallback: React.ReactElement, size?: number }) => {
  const [error, setError] = useState(false);
  if (!src || error) return React.cloneElement(fallback, { fontSize: "small" } as any);
  return <img src={src} onError={() => setError(true)} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }} alt="" />;
};

type SubAppDef = { label: string; scope: AppScope; workspaceId: string; src?: string; Fallback: React.ComponentType<any> };
const ALL_SUB_APPS: SubAppDef[] = [
  { label: 'S.Model',        scope: '3dss', workspaceId: 'models',   src: icon3DSS, Fallback: ViewInArRoundedIcon    },
  { label: 'S.Layout',        scope: '3dsl', workspaceId: 'layout',   src: icon3DSL, Fallback: GridViewRoundedIcon    },
  { label: 'S.Slide', scope: '3dsp', workspaceId: 'presents', src: icon3DSP, Fallback: PresentToAllRoundedIcon },
  { label: 'S.Create',        scope: '3dsc', workspaceId: 'create',   src: icon3DSC, Fallback: BrushRoundedIcon       },
  { label: 'S.Diagram',       scope: '3dsd', workspaceId: 'diagram',  src: icon3DSD, Fallback: WbSunnyRoundedIcon     },
  { label: 'S.Drawing',       scope: '3dsr', workspaceId: 'drawing',  src: icon3DSR, Fallback: SquareFootRoundedIcon  },
  { label: 'S.Image',         scope: '3dsi', workspaceId: 'image',    src: icon3DSI, Fallback: PhotoLibraryRoundedIcon },
  { label: 'S.Quest',         scope: '3dsq', workspaceId: 'quest',    src: icon3DSQ, Fallback: SchoolRoundedIcon      },
  { label: 'S.Portfolio',     scope: '3dsf', workspaceId: 'portfolio', src: icon3DSF, Fallback: MenuBookRoundedIcon  },
  { label: 'S.Library',       scope: '3dsk', workspaceId: 'library',   src: icon3DSK, Fallback: LocalLibraryRoundedIcon },
  { label: 'S.Movie',         scope: '3dsm', workspaceId: 'movie',     src: icon3DSM, Fallback: MovieRoundedIcon       },
  { label: 'S.Material',      scope: '3dsmt', workspaceId: 'material', src: icon3DSMT, Fallback: TextureRoundedIcon },
];

const MAX_SIDEBAR_APPS = 5;

// ProjectSidebarと同じカラーロジック
const projectHue = (name: string) =>
  [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 42%)`;
};

const MiniSidebar: React.FC<{ open?: boolean; onClose?: () => void }> = ({ open = false, onClose }) => {
  const isMobile = useMediaQuery('(max-width:768px)');
  const { currentUser, logout } = useAuthStore();
  const {
    setCurrentMainView,
    setViewingCreatorId,
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
    setActiveProjectId,
    openUserSettings,
    closeUserSettings,
    userSettingsOpen,
    userSettingsInitialTab,
    isGlobalSearchOpen,
    setGlobalSearchOpen,
  } = useAppStore();

  const pinnedTabIds   = useAppStore(s => s.pinnedTabIds);
  const projects       = useAppStore(s => s.projects);
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const { unreadCount, startListening, stopListening, actionError, clearActionError } = useNotificationsStore();
  const setActiveTeamId = useTeamsStore(s => s.setActiveTeamId);
  const accountLogoUrl = useAccountProfileStore(s => s.logoUrl);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [appsPopoverAnchor, setAppsPopoverAnchor] = useState<null | HTMLElement>(null);
  const [iconPicker, setIconPicker] = useState<{ anchor: HTMLElement; projectId: string; hasCustom: boolean } | null>(null);

  // ── プロジェクト作成（＋ボタン） ──────────────
  // 名前入力なし→対話画面 / Team はチーム選択シート。アカウントサイト左サイドバーと共通。
  const [createMenuAnchor, setCreateMenuAnchor] = useState<null | HTMLElement>(null);
  const { isCreating, createMyProject, openTeamSheet, teamSheet } = useProjectCreation();

  useEffect(() => {
    if (currentUser) {
      startListening(currentUser.uid);
      return () => stopListening();
    }
  }, [currentUser?.uid]);

  // アカウントサイトのロゴ（users/{uid}.accountLogoUrl）をライブ購読
  useEffect(() => {
    if (currentUser?.uid) {
      useAccountProfileStore.getState().subscribe(currentUser.uid);
    } else {
      useAccountProfileStore.getState().unsubscribe();
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

  // プロジェクト管理 / ギャラリー / Marketplace / 設定 のトグル。
  // 表示中に同じボタンを押すと「閉じる」＝開く直前の画面へ戻す。
  const TOOL_VIEWS = ['ai-studio', 'project-management', 'teams', 'gallery', 'marketplace', 'global-settings'] as const;
  const prevViewRef = React.useRef<typeof currentMainView>('my-site');
  const toggleToolView = (view: typeof currentMainView) => {
    handleNavClick(() => {
      if (currentMainView === view) {
        setCurrentMainView(prevViewRef.current || 'my-site');
      } else {
        if (!(TOOL_VIEWS as readonly string[]).includes(currentMainView)) {
          prevViewRef.current = currentMainView;
        }
        setCurrentMainView(view);
      }
    });
  };

  const myProjects   = projects.filter(p => !p.isTeam);
  const teamProjects = projects.filter(p => p.isTeam);

  const handleProjectClick = (projectId: string) => {
    setActiveProjectId(projectId);
    // 上部タブの SEKKEIYA を廃止したため、プロジェクトを選ぶ＝そのプロジェクトの
    // サイトホーム（activeWorkspaceId=null）を開く挙動に統一する。
    // activeProjectTab はストア共有なので schedule/memo 選択中は自動維持される。
    handleNavClick(() => {
      setActiveWorkspaceId(null);
      setCurrentMainView('workspace');
    });
  };

  // タブバーにピン留めされたアプリ全件（グリッド用）
  const allPinnedApps = pinnedTabIds
    .map(id => ALL_SUB_APPS.find(a => a.scope === id))
    .filter((a): a is SubAppDef => !!a);

  // サイドバーには上位 MAX_SIDEBAR_APPS 件を表示
  // ただし現在アクティブなアプリが範囲外なら差し替え
  const activeIdx = allPinnedApps.findIndex(a => a.workspaceId === activeWorkspaceId);
  let visibleApps = allPinnedApps.slice(0, MAX_SIDEBAR_APPS);
  if (activeIdx >= MAX_SIDEBAR_APPS) {
    visibleApps = [...allPinnedApps.slice(0, MAX_SIDEBAR_APPS - 1), allPinnedApps[activeIdx]];
  }
  const hasMoreApps = allPinnedApps.length > MAX_SIDEBAR_APPS;

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
        position: "relative",
        zIndex: 1400,
        flexShrink: 0,
        overflow: 'hidden',
        ...(isMobile && {
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: 264, maxWidth: '80vw',
          alignItems: 'stretch',
          px: 1,
          overflowY: 'auto',
          overflow: 'auto',
          zIndex: 1500,
          boxShadow: '4px 0 24px rgba(0,0,0,0.6)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }),
      }}
    >

      {/* ══ 上部固定（常に表示） ══ */}
      <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, pt: 2.5, width: '100%' }}>
        {/* アカウントサイト（マイページ）— ユーザー設定のサイトロゴ。MY PROJECTS と同じ角丸四角 */}
        <Tooltip title={`${currentUser?.displayName || 'マイページ'}（アカウントサイト）`} placement="right">
          <Box
            onClick={() => handleNavClick(() => setCurrentMainView('my-site'))}
            sx={{
              position: 'relative',
              width: 36, height: 36, borderRadius: '11px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              border: currentMainView === 'my-site' ? '2px solid #90caf9' : '2px solid transparent',
              boxShadow: currentMainView === 'my-site' ? '0 0 0 3px rgba(144,202,249,0.3)' : 'none',
              ...SITE_ICON_POP,
              animation: currentMainView === 'my-site' ? 'siteIconPop 0.42s cubic-bezier(0.22,1,0.36,1)' : undefined,
              transition: 'border 0.18s ease, box-shadow 0.18s ease, transform 0.13s ease',
              '&:hover': { transform: 'scale(1.08)', border: currentMainView === 'my-site' ? '2px solid #90caf9' : `2px solid ${BRAND.line2}` },
              '&:active': { transform: 'scale(0.9)' },
            }}
          >
            <Avatar
              src={accountLogoUrl || undefined}
              variant="rounded"
              sx={{
                width: '100%', height: '100%', borderRadius: '9px',
                bgcolor: 'primary.main', fontSize: 16, fontWeight: 700,
              }}
            >
              {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </Box>
        </Tooltip>

        {/* アカウントサイト と マイプロジェクト の区切り（下側を少し広めに） */}
        <Divider sx={{ width: "60%", mt: 0.5, mb: 1.5, opacity: 0.2 }} />
      </Box>

      {/* ══ 中段：プロジェクト一覧（スクロール可） ══ */}
      <Box sx={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        width: '100%', pt: 1,
        '&::-webkit-scrollbar': { width: 2 },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bgcolor: BRAND.line, borderRadius: 2 },
      }}>
        {/* MY PROJECTS */}
        {myProjects.map(project => {
          const hue = projectHue(project.name);
          // アカウントサイトを開いている間はプロジェクトの選択状態を出さない（相互排他）。
          const isActive = activeProjectId === project.id && currentMainView !== 'my-site';
          return (
            <Tooltip key={project.id} title={`${project.name}（右クリックでアイコン変更）`} placement="right">
              <Box
                onClick={() => handleProjectClick(project.id)}
                onContextMenu={(e) => { e.preventDefault(); setIconPicker({ anchor: e.currentTarget, projectId: project.id, hasCustom: !!(project.iconUrl || project.iconEmoji) }); }}
                sx={{
                  position: 'relative',
                  width: 32, height: 32, borderRadius: '10px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  border: isActive ? '2px solid #90caf9' : '2px solid transparent',
                  boxShadow: isActive ? '0 0 0 3px rgba(144,202,249,0.3)' : 'none',
                  ...SITE_ICON_POP,
                  animation: isActive ? 'siteIconPop 0.42s cubic-bezier(0.22,1,0.36,1)' : undefined,
                  transition: 'border 0.18s ease, box-shadow 0.18s ease, transform 0.13s ease',
                  '&:hover': { transform: 'scale(1.08)', border: isActive ? '2px solid #90caf9' : `2px solid ${BRAND.line2}` },
                  '&:active': { transform: 'scale(0.9)' },
                }}
              >
                <ProjectIcon
                  iconUrl={project.iconUrl}
                  iconEmoji={project.iconEmoji}
                  size={32}
                  radius="8px"
                  fallbackBg={`hsl(${hue},55%,38%)`}
                  fallbackContent={
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)', userSelect: 'none', lineHeight: 1 }}>
                      {project.name.trim().charAt(0).toUpperCase()}
                    </Typography>
                  }
                  sx={{ width: '100%', height: '100%' }}
                />
              </Box>
            </Tooltip>
          );
        })}

        {/* TEAM PROJECTS（区切り付き） */}
        {teamProjects.length > 0 && myProjects.length > 0 && (
          <Divider sx={{ width: "60%", my: 0.5, opacity: 0.2 }} />
        )}
        {teamProjects.map(project => {
          const color = teamColor(project.name);
          // アカウントサイトを開いている間はプロジェクトの選択状態を出さない（相互排他）。
          const isActive = activeProjectId === project.id && currentMainView !== 'my-site';
          return (
            <Tooltip key={project.id} title={`[チーム] ${project.name}（右クリックでアイコン変更）`} placement="right">
              <Box
                onClick={() => handleProjectClick(project.id)}
                onContextMenu={(e) => { e.preventDefault(); setIconPicker({ anchor: e.currentTarget, projectId: project.id, hasCustom: !!(project.iconUrl || project.iconEmoji) }); }}
                sx={{
                  position: 'relative',
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  border: isActive ? '2px solid #90caf9' : '2px solid transparent',
                  boxShadow: isActive ? '0 0 0 3px rgba(144,202,249,0.3)' : 'none',
                  ...SITE_ICON_POP,
                  animation: isActive ? 'siteIconPop 0.42s cubic-bezier(0.22,1,0.36,1)' : undefined,
                  transition: 'border 0.18s ease, box-shadow 0.18s ease, transform 0.13s ease',
                  '&:hover': { transform: 'scale(1.08)', border: isActive ? '2px solid #90caf9' : `2px solid ${BRAND.line2}` },
                  '&:active': { transform: 'scale(0.9)' },
                }}
              >
                <ProjectIcon
                  iconUrl={project.iconUrl}
                  iconEmoji={project.iconEmoji}
                  size={32}
                  radius="50%"
                  fallbackBg={color}
                  fallbackContent={
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)', userSelect: 'none', lineHeight: 1 }}>
                      {project.name.trim().charAt(0).toUpperCase()}
                    </Typography>
                  }
                  sx={{ width: '100%', height: '100%' }}
                />
              </Box>
            </Tooltip>
          );
        })}

        {/* ＋ プロジェクト作成ボタン */}
        <Tooltip title="プロジェクトを作成" placement="right">
          <Box
            onClick={(e) => setCreateMenuAnchor(e.currentTarget)}
            sx={{
              width: 32, height: 32, borderRadius: '8px', flexShrink: 0, mt: 0.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: Boolean(createMenuAnchor) ? BRAND.text : BRAND.sub2,
              border: `1px dashed ${Boolean(createMenuAnchor) ? BRAND.line2 : BRAND.line}`,
              transition: 'border 0.15s, color 0.15s, transform 0.15s',
              '&:hover': { transform: 'scale(1.08)', color: BRAND.text, borderColor: BRAND.line2 },
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>
      </Box>

      {/* ══ プロジェクト作成メニュー（個人 / チーム） ══ */}
      <Menu
        anchorEl={createMenuAnchor}
        open={Boolean(createMenuAnchor)}
        onClose={() => setCreateMenuAnchor(null)}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: BRAND.glass, backdropFilter: 'blur(16px)', color: BRAND.text,
              border: `1px solid ${BRAND.line}`, minWidth: 220, ml: 1, borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            },
          },
        }}
      >
        <Typography sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: BRAND.sub2, textTransform: 'uppercase' }}>
          新規作成
        </Typography>
        <MenuItem
          disabled={isCreating}
          onClick={() => { setCreateMenuAnchor(null); createMyProject(); }}
          sx={{ py: 1.25, '&:hover': { bgcolor: BRAND.panel } }}
        >
          <ListItemIcon><FolderRoundedIcon fontSize="small" sx={{ color: 'light-dark(#095fa5, #90caf9)' }} /></ListItemIcon>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>My Project</Typography>
            <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>個人プロジェクト（対話で作成）</Typography>
          </Box>
        </MenuItem>
        <MenuItem
          disabled={isCreating}
          onClick={() => { setCreateMenuAnchor(null); openTeamSheet(); }}
          sx={{ py: 1.25, '&:hover': { bgcolor: BRAND.panel } }}
        >
          <ListItemIcon><GroupsRoundedIcon fontSize="small" sx={{ color: '#3498db' }} /></ListItemIcon>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Team Project</Typography>
            <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>チームを選んで対話で作成</Typography>
          </Box>
        </MenuItem>
      </Menu>

      {/* ══ プロジェクトアイコン変更ポップオーバー ══ */}
      <ProjectIconPicker
        anchorEl={iconPicker?.anchor ?? null}
        projectId={iconPicker?.projectId ?? null}
        hasCustomIcon={iconPicker?.hasCustom}
        onClose={() => setIconPicker(null)}
      />

      {/* ══ アプリ一覧グリッドポップオーバー ══ */}
      <Popover
          open={Boolean(appsPopoverAnchor)}
          anchorEl={appsPopoverAnchor}
          onClose={() => setAppsPopoverAnchor(null)}
          anchorOrigin={{ horizontal: 'right', vertical: 'center' }}
          transformOrigin={{ horizontal: 'left', vertical: 'center' }}
          slotProps={{
            paper: {
              sx: {
                bgcolor: BRAND.glass,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${BRAND.line}`,
                borderRadius: 2.5,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                ml: 1, p: 1.5,
                minWidth: 200,
              },
            },
          }}
        >
          <Typography sx={{ fontSize: 11, color: BRAND.sub2, fontWeight: 600, letterSpacing: 1, px: 0.5, pb: 1, textTransform: 'uppercase' }}>
            インストール済みアプリ
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
            {allPinnedApps.map(app => {
              const isActive = activeWorkspaceId === app.workspaceId && currentMainView === 'workspace';
              return (
                <Box
                  key={app.workspaceId}
                  onClick={() => { launchAppWithContext(app.scope, app.workspaceId); setAppsPopoverAnchor(null); }}
                  sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
                    p: 1, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: isActive ? 'rgba(52,152,219,0.18)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(52,152,219,0.4)' : 'transparent'}`,
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: isActive ? 'rgba(52,152,219,0.25)' : BRAND.panel },
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                    <AppImageFallback src={app.src} fallback={<app.Fallback />} size={36} />
                  </Box>
                  <Typography sx={{ fontSize: 10, color: isActive ? '#3498db' : BRAND.sub, textAlign: 'center', lineHeight: 1.2, fontWeight: isActive ? 600 : 400 }} noWrap>
                    {app.label.replace('S.', '')}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Popover>

      {/* ══ 下部固定（常に表示） ══ */}
      <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, pb: 1, width: '100%' }}>

        <Divider sx={{ width: '80%', my: 0.75, borderColor: BRAND.line2 }} />

        {/* 管理・発見（SEKKEIYA SEARCH は SEKKEIYA Chat ハブのホバーメニューに集約） */}
        <NavIcon
          icon={<AutoAwesomeRoundedIcon />}
          label="AI Studio"
          active={currentMainView === 'ai-studio'}
          onClick={() => toggleToolView('ai-studio')}
        />
        <NavIcon
          icon={<AccountTreeRoundedIcon />}
          label="プロジェクト管理"
          active={currentMainView === 'project-management'}
          onClick={() => toggleToolView('project-management')}
        />
        <NavIcon
          icon={<GroupsRoundedIcon />}
          label="チーム管理"
          active={currentMainView === 'teams'}
          onClick={() => { if (currentMainView !== 'teams') setActiveTeamId(null); toggleToolView('teams'); }}
        />
        <NavIcon
          icon={<CollectionsRoundedIcon />}
          label="ギャラリー"
          active={currentMainView === 'gallery'}
          onClick={() => toggleToolView('gallery')}
        />

        <Divider sx={{ width: "80%", my: 0.75, borderColor: 'rgba(144,202,249,0.35)', boxShadow: '0 0 6px rgba(144,202,249,0.15)' }} />

        {/* アプリ一覧ボタン */}
        <Tooltip title="アプリ一覧" placement="right">
          <Box component="span" sx={{ display: 'block' }}>
            <IconButton
              onClick={e => setAppsPopoverAnchor(e.currentTarget)}
              sx={{
                p: 0.75,
                color: Boolean(appsPopoverAnchor) ? '#3498db' : BRAND.sub2,
                bgcolor: Boolean(appsPopoverAnchor) ? 'rgba(52,152,219,0.15)' : 'transparent',
                border: `1px solid ${Boolean(appsPopoverAnchor) ? 'rgba(52,152,219,0.4)' : 'transparent'}`,
                borderRadius: 1.5,
                '&:hover': { color: BRAND.text, bgcolor: BRAND.panel2 },
              }}
            >
              <AppsRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>

        <NavIcon
          icon={<StorefrontRoundedIcon />}
          label="Marketplace"
          active={currentMainView === 'marketplace'}
          onClick={() => toggleToolView('marketplace')}
        />

        <NavIcon
          icon={<SettingsRoundedIcon />}
          label="設定"
          active={currentMainView === 'global-settings'}
          onClick={() => toggleToolView('global-settings')}
        />

      <Tooltip title="通知" placement="right">
        <IconButton
          onClick={e => setNotifAnchorEl(e.currentTarget)}
          sx={{ color: unreadCount > 0 ? '#3498db' : BRAND.sub2, p: 0.75 }}
        >
          <Badge
            badgeContent={unreadCount}
            max={9}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#ef4444', color: 'var(--brand-fg)',
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

      </Box>{/* ── 下部固定セクション終了 ── */}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ 
          paper: { 
            sx: {
              bgcolor: BRAND.glass,
              backdropFilter: 'blur(16px)',
              color: BRAND.text,
              border: `1px solid ${BRAND.line}`,
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
          <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: BRAND.panel }}>
            <Avatar 
              src={currentUser.photoURL || undefined}
              sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 'bold' }}
            >
              {currentUser.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: BRAND.text, lineHeight: 1.2 }}>
                {currentUser.displayName || "ユーザー"}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: BRAND.sub2, mt: 0.5 }}>
                {currentUser.email}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <CreditBalanceChip onClick={() => { setAnchorEl(null); openUserSettings(2); }} />
              </Box>
            </Box>
          </Box>
        )}
        <Divider sx={{ borderColor: BRAND.line }} />
        
        <Box sx={{ p: 1 }}>
          <MenuItem
            onClick={openMyProfile}
            sx={{ borderRadius: 2, mb: 0.5, py: 1.5, '&:hover': { bgcolor: BRAND.panel } }}
          >
            <ListItemIcon><PersonRoundedIcon fontSize="small" sx={{ color: BRAND.sub }} /></ListItemIcon>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>マイページ</Typography>
          </MenuItem>
          <MenuItem
            onClick={() => { setAnchorEl(null); openUserSettings(0); }}
            sx={{ borderRadius: 2, py: 1.5, '&:hover': { bgcolor: BRAND.panel } }}
          >
            <ListItemIcon><ManageAccountsRoundedIcon fontSize="small" sx={{ color: BRAND.sub }} /></ListItemIcon>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>アカウント設定</Typography>
          </MenuItem>
        </Box>
        
        <Divider sx={{ borderColor: BRAND.line }} />
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

      <UserSettingsDialog open={userSettingsOpen} onClose={closeUserSettings} initialTab={userSettingsInitialTab} />

      <NotificationPanel
        anchorEl={notifAnchorEl}
        onClose={() => setNotifAnchorEl(null)}
      />

      {/* 全体検索（虫眼鏡ボタン: Private/Public 横断検索） */}
      <GlobalSearchDialog open={isGlobalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />

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

      {/* ══ チーム選択シート（Team Project の作成前に 1 枚だけ挟む。共通フック） ══ */}
      {teamSheet}
    </Box>
  );
};

// 親（MainLayout）がチャットのホバー開閉などで再描画されても、
// props（open/onClose）が変わらなければ再描画しない。
export default React.memo(MiniSidebar);
