import React from 'react';
import { Box, Typography } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { useAIDriveStore } from '../../store/useAIDriveStore';
import { useAppStore } from '../../store/useAppStore';

// AI Drive タブの左サイドバー（保存先＝スコープの一覧）。
// SEKKEIYA Chat のチャット階層と同様、左でコンテキストを切り替えられるようにする。
const AIDriveScopeSidebar: React.FC = () => {
  const activeScope = useAIDriveStore(s => s.activeScope);
  const setActiveScope = useAIDriveStore(s => s.setActiveScope);
  const projects = useAppStore(s => s.projects);
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const fixed: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'すべてのデータ', icon: <PublicRoundedIcon sx={{ fontSize: '1rem' }} /> },
    ...(activeProjectId ? [{ key: 'current_project', label: '現在のプロジェクト', icon: <FolderRoundedIcon sx={{ fontSize: '1rem' }} /> }] : []),
    { key: 'my_library', label: 'マイライブラリ', icon: <PersonRoundedIcon sx={{ fontSize: '1rem' }} /> },
    { key: 'team_library', label: 'チームライブラリ', icon: <GroupsRoundedIcon sx={{ fontSize: '1rem' }} /> },
  ];

  const renderItem = (key: string, label: string, icon: React.ReactNode) => {
    const active = activeScope === key;
    return (
      <Box
        key={key}
        onClick={() => setActiveScope(key)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.25, py: 0.75, mx: 0.5, borderRadius: 1, cursor: 'pointer',
          color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
          bgcolor: active ? 'rgba(52,152,219,0.18)' : 'transparent',
          '&:hover': { bgcolor: active ? 'rgba(52,152,219,0.24)' : 'rgb(var(--brand-fg-rgb) / 0.06)' },
        }}
      >
        <Box sx={{ color: active ? '#3498db' : 'rgb(var(--brand-fg-rgb) / 0.45)', display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography sx={{ fontSize: 12.5, fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, flexShrink: 0 }}>
        保存先
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pb: 1 }}>
        {fixed.map(f => renderItem(f.key, f.label, f.icon))}
        {projects.length > 0 && (
          <Typography sx={{ px: 1.5, pt: 1.5, pb: 0.5, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 600 }}>
            プロジェクト
          </Typography>
        )}
        {projects.map(p => renderItem(`project_${p.id}`, p.name, <FolderRoundedIcon sx={{ fontSize: '1rem' }} />))}
      </Box>
    </Box>
  );
};

export default AIDriveScopeSidebar;
