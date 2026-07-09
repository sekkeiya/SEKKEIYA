import React from 'react';
import {
  Box, Typography, Avatar, Chip, CardActionArea, CircularProgress, Divider,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useTeamsStore } from '../../store/useTeamsStore';
import { useAppStore } from '../../store/useAppStore';
import { BRAND } from '../../styles/theme';

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 45%)`;
};

export const TeamsManagementPage: React.FC = () => {
  const { teams, isLoading, setActiveTeamId } = useTeamsStore();
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  const handleTeamClick = (teamId: string) => {
    setActiveTeamId(teamId);
    setCurrentMainView('teams');
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 4, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <GroupsRoundedIcon sx={{ fontSize: 26, color: '#3498db' }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: BRAND.text }}>チーム管理</Typography>
        </Box>
        <Typography sx={{ fontSize: 13, color: BRAND.sub2 }}>
          参加中のチームを管理します。新しいチームは左サイドバーの「+」から作成できます。
        </Typography>
      </Box>

      <Divider sx={{ borderColor: BRAND.line, mx: { xs: 3, md: 5 } }} />

      <Box sx={{ px: { xs: 3, md: 5 }, pt: 3, flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress sx={{ color: '#3498db' }} />
          </Box>
        ) : teams.length === 0 ? (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            py: 10, borderRadius: 3, border: `1px dashed rgba(255,255,255,0.12)`,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}>
            <GroupsRoundedIcon sx={{ fontSize: 56, color: BRAND.sub2, mb: 2 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: BRAND.sub, mb: 1 }}>
              チームがありません
            </Typography>
            <Typography sx={{ fontSize: 13, color: BRAND.sub2, textAlign: 'center', maxWidth: 300 }}>
              左サイドバーの「TEAM PROJECTS」横の「+」からチームを作成できます
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
            {teams.map(team => {
              const color = teamColor(team.name);
              return (
                <CardActionArea
                  key={team.id}
                  onClick={() => handleTeamClick(team.id)}
                  sx={{
                    borderRadius: 3, border: `1px solid ${BRAND.line}`,
                    bgcolor: 'rgba(255,255,255,0.03)', p: 2.5,
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.5,
                    '&:hover': { bgcolor: 'rgba(52,152,219,0.06)', borderColor: 'rgba(52,152,219,0.3)' },
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <Avatar sx={{
                      width: 44, height: 44, bgcolor: color,
                      fontSize: 18, fontWeight: 700, borderRadius: 2, flexShrink: 0,
                    }}>
                      {team.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text, mb: 0.25 }}>
                        {team.name}
                      </Typography>
                      <Chip
                        icon={team.visibility === 'public'
                          ? <PublicRoundedIcon sx={{ fontSize: '11px !important' }} />
                          : <LockRoundedIcon sx={{ fontSize: '11px !important' }} />}
                        label={team.visibility === 'public' ? '公開' : '非公開'}
                        size="small"
                        sx={{
                          fontSize: 10, height: 18,
                          bgcolor: 'rgba(255,255,255,0.08)', color: BRAND.sub,
                          '& .MuiChip-icon': { color: BRAND.sub },
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: BRAND.sub2 }}>
                    <GroupsRoundedIcon sx={{ fontSize: 14 }} />
                    <Typography sx={{ fontSize: 12 }}>{team.memberIds.length}名のメンバー</Typography>
                  </Box>
                  {team.description && (
                    <Typography sx={{
                      fontSize: 12, color: BRAND.sub2, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {team.description}
                    </Typography>
                  )}
                </CardActionArea>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};
