import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Tabs, Tab, useMediaQuery } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { useAccountProfileStore } from '../store/useAccountProfileStore';
import { ProjectSiteCanvas } from '../features/sites/ProjectSiteCanvas';
import { WorkspaceTabBar } from '../shared/layout/workspace/WorkspaceTabBar';
import { useProjectCreation } from '../features/projects/useProjectCreation';
import { SchedulesTasksList } from '../components/Projects/SchedulesTasksList';
import { AllProjectsFilesList } from '../components/Projects/AllProjectsFilesList';
import { AccountResearchMemoTab } from '../components/Projects/AccountResearchMemoTab';

const TAB_SX = {
  minHeight: 40,
  textTransform: 'none' as const,
  fontSize: 13,
  transition: 'color 0.2s',
  '&:hover': { color: 'var(--brand-fg)' },
};

// アカウントサイト（＝ログイン後ダッシュボード／公開ポートフォリオ）。
// 上部に子アプリタブ（WorkspaceTabBar）、本体はサイトエンジン（ProjectSiteCanvas, account）。
// サイドバーの My / Team プロジェクトナビ＋ ＋ボタンでプロジェクト作成。
//   ＋は名前入力ダイアログではなく、ミニサイドバーと同じ作成フロー
//   （仮称で即作成 →「プロジェクトサイトを作成」対話画面 / Team はチーム選択シート）を使う。
const TAB_ITEMS = [
  { id: 'home',      label: 'Home' },
  { id: 'schedule',  label: 'Schedules & Tasks' },
  { id: 'cadfiles',  label: 'CAD Files' },
  { id: 'workfiles', label: 'Work Files' },
  { id: 'memo',      label: 'Research & Memo' },
];

const MySitePage: React.FC = () => {
  // モバイル（iOS等）では子アプリタブ（WorkspaceTabBar）はボトムバー／ランチャーに集約されるため非表示。
  const isMobile = useMediaQuery('(max-width:768px)');
  const user = useAuthStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);
  const setProjects = useAppStore(s => s.setProjects);
  // ヒーロータイトル保存時にリアルタイム反映するため Auth displayName よりストアを優先
  const profileDisplayName = useAccountProfileStore(s => s.displayName);
  const _activeProjectTab = useAppStore(s => s.activeProjectTab);
  const setActiveProjectTab = useAppStore(s => s.setActiveProjectTab);
  // MySitePage のタブ定義にないタブ（workfiles 等）は home にフォールバック
  const activeTab = TAB_ITEMS.some(t => t.id === _activeProjectTab) ? _activeProjectTab : 'home';
  const setActiveTab = (tab: string) => setActiveProjectTab(tab);

  // プロジェクト一覧はアプリハブ等のマウント時にしか取得されないため、
  // ボトムバーから直接アカウントサイトを開いたケースでもここで取得する。
  useEffect(() => {
    if (!user?.uid || projects.length > 0) return;
    fetchUserProjects(user.uid).then(fetched => {
      if (fetched.length > 0) setProjects(fetched);
    }).catch(e => console.error('[MySite] fetch projects failed', e));
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // 各プロジェクトサイトの公開状態。非公開サイトは公開ページには出ないため、
  // ログインユーザー本人向けの一覧では「（非公開）」を付けて区別する。
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const projectsKey = projects.map(p => p.id).join(',');
  useEffect(() => {
    let active = true;
    (async () => {
      const checks = await Promise.all(projects.map(async p => {
        try {
          const snap = await getDoc(doc(db, 'projects', p.id, 'site', 'main'));
          return snap.exists() && snap.data()?.publish?.status === 'published' ? p.id : null;
        } catch { return null; }
      }));
      if (active) setPublishedIds(new Set(checks.filter((id): id is string => !!id)));
    })();
    return () => { active = false; };
  }, [projectsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountProjects = useMemo(() => {
    const label = (p: { id: string; name: string }) =>
      publishedIds.has(p.id) ? p.name : `${p.name}（非公開）`;
    return {
      my: projects.filter(p => !p.isTeam).map(p => ({ id: p.id, name: label(p), cover: p.coverThumbnailUrl, isTeam: false })),
      team: projects.filter(p => p.isTeam).map(p => ({ id: p.id, name: label(p), cover: p.coverThumbnailUrl, isTeam: true })),
    };
  }, [projects, publishedIds]);

  const { startCreate, teamSheet } = useProjectCreation();

  if (!user?.uid) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>ログインするとマイサイトを作成できます。</Typography>
      </Box>
    );
  }

  const displayName = profileDisplayName || user.displayName || 'My Site';

  // ホームタブのときはタブをサイトツールバーに統合して 1 行にまとめる（ProjectHome と同じ方式）
  const mergeTabsIntoToolbar = activeTab === 'home';

  const pageTabs = (
    <Tabs
      value={activeTab}
      onChange={(_e, val) => setActiveTab(val)}
      variant="scrollable"
      scrollButtons="auto"
      textColor="inherit"
      indicatorColor="primary"
      sx={{
        minHeight: 40,
        '& .MuiTabs-indicator': { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, bgcolor: '#00BFFF' },
      }}
    >
      {TAB_ITEMS.map(t => (
        <Tab
          key={t.id}
          label={t.label}
          value={t.id}
          disableRipple
          sx={{
            ...TAB_SX,
            fontWeight: activeTab === t.id ? 700 : 500,
            color: activeTab === t.id ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)',
          }}
        />
      ))}
    </Tabs>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {!isMobile && <WorkspaceTabBar />}

      {/* タブバー（サイトツールバーに統合していないときのみ独立表示） */}
      {!mergeTabsIntoToolbar && (
        <Box sx={{
          px: { xs: 2, md: 3, lg: 4 },
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          bgcolor: 'light-dark(rgba(255,255,255,0.92), rgba(10,15,25,0.8))',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
        }}>
          {pageTabs}
        </Box>
      )}

      {/* コンテンツ */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: (activeTab === 'home' || activeTab === 'memo') ? 'hidden' : 'auto' }}>
        {activeTab === 'home' ? (
          <ProjectSiteCanvas
            source={{ kind: 'account', id: user.uid }}
            displayName={displayName}
            accountProjects={accountProjects}
            onCreateProject={startCreate}
            tabsSlot={pageTabs}
          />
        ) : activeTab === 'schedule' ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <SchedulesTasksList project={null} />
          </Box>
        ) : activeTab === 'cadfiles' ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <AllProjectsFilesList filterMode="cad" />
          </Box>
        ) : activeTab === 'workfiles' ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <AllProjectsFilesList filterMode="other" />
          </Box>
        ) : activeTab === 'memo' ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            <AccountResearchMemoTab />
          </Box>
        ) : null}
      </Box>

      {/* Team Project 作成時のチーム選択シート（My は即作成のためダイアログなし） */}
      {teamSheet}
    </Box>
  );
};

export default MySitePage;
