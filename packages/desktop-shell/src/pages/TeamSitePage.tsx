import React, { useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { useTeamsStore } from '../store/useTeamsStore';
import { ProjectSiteCanvas } from '../features/sites/ProjectSiteCanvas';
import { BRAND } from '../styles/theme';

// チームサイト（チームの公開トップ＝SiteOwner 2層モデル, docs/15 §8）。
// アカウントサイト（MySitePage）と対称に、ProjectSiteCanvas を team ソースで描画する。
// サイト本体は teams/{teamId}/site/main に保存され、未作成なら buildTeamSite で自動生成される。
const TeamSitePage: React.FC = () => {
  const user = useAuthStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const activeTeamId = useTeamsStore(s => s.activeTeamId);
  const teams = useTeamsStore(s => s.teams);

  const team = teams.find(t => t.id === activeTeamId) || null;

  // このチームのプロジェクトのみを Works サイドバーに渡す。
  const accountProjects = useMemo(() => ({
    my: [] as { id: string; name: string; cover?: string; isTeam: boolean }[],
    team: projects
      .filter(p => p.isTeam && (p.teamId === activeTeamId))
      .map(p => ({ id: p.id, name: p.name, cover: p.coverThumbnailUrl, isTeam: true })),
  }), [projects, activeTeamId]);

  if (!user?.uid || !team) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>チームが選択されていません。</Typography>
        <Button onClick={() => setCurrentMainView('teams')} sx={{ color: '#3498db', textTransform: 'none' }}>
          チーム一覧へ
        </Button>
      </Box>
    );
  }

  const openTeamProject = (scope: 'my' | 'team') => {
    // チームサイトからのプロジェクト作成はチームホームの追加フローに委譲。
    void scope;
    setCurrentMainView('teams');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* 戻りバー（チームホームへ） */}
      <Box sx={{
        px: { xs: 2, md: 3 }, py: 0.75, flexShrink: 0,
        borderBottom: `1px solid ${BRAND.line}`, bgcolor: 'light-dark(rgba(255,255,255,0.92), rgba(10,15,25,0.8))',
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Button
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => setCurrentMainView('teams')}
          size="small"
          sx={{ color: BRAND.sub2, textTransform: 'none', fontSize: 12, fontWeight: 500, '&:hover': { color: BRAND.sub, bgcolor: 'transparent' } }}
        >
          {team.name}（チームホーム）
        </Button>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: 12 }}>/ チームサイト</Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ProjectSiteCanvas
          source={{ kind: 'team', id: team.id }}
          displayName={team.name}
          accountProjects={accountProjects}
          onCreateProject={openTeamProject}
        />
      </Box>
    </Box>
  );
};

export default TeamSitePage;
