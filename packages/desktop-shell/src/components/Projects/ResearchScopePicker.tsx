// 独立ウィンドウのサイドバー最上部に出すスコープ（アカウント / プロジェクト）選択。
// 本体のタブでは使わない（本体はプロジェクトの文脈が既に決まっているため）。
import React from 'react';
import { Box, Typography } from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { ACCOUNT_SCOPE, groupProjectsForScope, type ScopeProject } from '../../features/projects/research/researchScope';

interface Props {
  scope: string;
  onChange: (scope: string) => void;
  projects: ScopeProject[];
}

const rowSx = (active: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 0.75,
  px: 1, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
  fontSize: 12.5, fontWeight: active ? 800 : 600,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  color: active ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.7)',
  bgcolor: active ? 'rgba(0,191,255,0.12)' : 'transparent',
  '&:hover': { bgcolor: active ? 'rgba(0,191,255,0.16)' : 'rgb(var(--brand-fg-rgb) / 0.07)' },
});

const headingSx = {
  fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
  color: 'rgb(var(--brand-fg-rgb) / 0.4)', px: 1, pt: 0.75, pb: 0.25,
} as const;

export const ResearchScopePicker: React.FC<Props> = ({ scope, onChange, projects }) => {
  const { my, team } = groupProjectsForScope(projects);

  return (
    <Box sx={{
      flexShrink: 0, maxHeight: '38%', overflowY: 'auto', p: 0.75,
      borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
    }}>
      <Box sx={rowSx(scope === ACCOUNT_SCOPE)} onClick={() => onChange(ACCOUNT_SCOPE)}>
        <PersonRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
        アカウントサイト
      </Box>

      {my.length > 0 && <Typography sx={headingSx}>マイプロジェクト</Typography>}
      {my.map(p => (
        <Box key={p.id} sx={rowSx(scope === p.id)} onClick={() => onChange(p.id)}>
          <FolderRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
          {p.label}
        </Box>
      ))}

      {team.length > 0 && <Typography sx={headingSx}>チームプロジェクト</Typography>}
      {team.map(p => (
        <Box key={p.id} sx={rowSx(scope === p.id)} onClick={() => onChange(p.id)}>
          <GroupsRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
          {p.label}
        </Box>
      ))}
    </Box>
  );
};
