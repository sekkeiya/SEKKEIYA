import React, { useMemo, useState } from 'react';
import { Box, Typography, CardActionArea, InputBase, Divider } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TextureRoundedIcon from '@mui/icons-material/TextureRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { useAppStore, type DsmtScope } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ec407a';

function ScopeItem({ icon, label, active, onClick, color }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || 'rgb(var(--brand-fg-rgb) / 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0,
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' } })}
        </Box>
        <Typography sx={{
          color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {label}
        </Typography>
      </CardActionArea>
    </Box>
  );
}

export const DsmtSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    isProjectSidebarOpen,
    dsmtScope,
    setDsmtScope,
    setActiveWorkspaceId,
    setCurrentMainView,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');

  const { myProjects, teamProjects } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = projects.filter((p) => !q || p.name?.toLowerCase().includes(q));
    return {
      myProjects: filtered.filter((p) => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: filtered.filter((p) => p.ownerId !== currentUser?.uid || p.isTeam),
    };
  }, [projects, searchQuery, currentUser?.uid]);

  const handleScopeSelect = (scope: DsmtScope) => {
    setDsmtScope(scope);
    setActiveWorkspaceId('material');
    setCurrentMainView('workspace');
    setActiveProjectId(null);
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDsmtScope(isTeam ? 'team_project_materials' : 'project_materials');
    setActiveProjectId(projectId);
    setActiveWorkspaceId('material');
  };

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: '100%',
        bgcolor: BRAND.bg,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
      }}
    >
      <Box sx={{ px: 2, mb: 1 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
          '&:focus-within': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mr: 1 }} />
          <InputBase
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: 'var(--brand-fg)', fontSize: 12, flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* グローバルスコープ */}
        <Box>
          <ScopeItem
            icon={<LanguageRoundedIcon />}
            label="Material"
            active={dsmtScope === 'global_materials'}
            onClick={() => handleScopeSelect('global_materials')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dsmtScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* 個人スコープ */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem
            icon={<PublicRoundedIcon />}
            label="Public Material"
            active={dsmtScope === 'my_public_materials'}
            onClick={() => handleScopeSelect('my_public_materials')}
            color="#9b59b6"
          />
          <ScopeItem
            icon={<LockRoundedIcon />}
            label="Private Material"
            active={dsmtScope === 'my_private_materials'}
            onClick={() => handleScopeSelect('my_private_materials')}
            color="#e67e22"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              My Projects
            </Typography>
          </Box>
          {myProjects.map((p) => (
            <ScopeItem
              key={p.id}
              icon={<TextureRoundedIcon />}
              label={p.name}
              active={p.id === activeProjectId && dsmtScope === 'project_materials'}
              onClick={() => handleProjectSelect(p.id, false)}
            />
          ))}
        </Box>

        {/* Team Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              Team Projects
            </Typography>
          </Box>
          {teamProjects.map((p) => (
            <ScopeItem
              key={p.id}
              icon={<TextureRoundedIcon />}
              label={p.name}
              active={p.id === activeProjectId && dsmtScope === 'team_project_materials'}
              onClick={() => handleProjectSelect(p.id, true)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};
