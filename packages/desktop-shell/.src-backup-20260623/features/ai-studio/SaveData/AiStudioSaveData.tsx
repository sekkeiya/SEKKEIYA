import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Button, Avatar, CardActions, Paper } from '@mui/material';
import { useAiStudioStore } from '../store/useAiStudioStore';
import { BRAND } from '../../../styles/theme';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';

export const AiStudioSaveData: React.FC = () => {
  const { profiles, activateProfile } = useAiStudioStore();

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, color: '#fff', maxWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, letterSpacing: -0.5 }}>
        セーブデータ (AIプロファイル)
      </Typography>

      <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(144, 202, 249, 0.08)', border: `1px solid rgba(144, 202, 249, 0.2)`, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ color: '#90caf9', mt: 0.5 }}>
          <InfoRoundedIcon />
        </Box>
        <Box>
          <Typography sx={{ color: '#90caf9', fontWeight: 700, mb: 0.5 }}>セーブデータ（プロファイル）とは？</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6 }}>
            ナレッジベースで抽出した知識や、手動で設定した「評価基準・ルール」をひとまとめにしたセットです。<br/>
            たとえば「新築オフィス向け」や「改修ビル向け」など、用途に合わせて複数のAIをストックできます。<br/>
            対象のAIを選んで「このAIを使う」をクリックすると、実際のプロジェクト採点にそのルールが自動適用されます。
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {profiles.map(profile => (
          <Box key={profile.id}>
            <Card sx={{ 
              bgcolor: BRAND.panel, 
              borderRadius: 3, 
              border: `1px solid ${profile.isActive ? '#90caf9' : BRAND.line}`,
              transition: 'all 0.2s',
              boxShadow: profile.isActive ? `0 4px 20px -5px #90caf940` : 'none',
              '&:hover': {
                borderColor: profile.isActive ? '#90caf9' : 'rgba(255,255,255,0.2)',
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: profile.avatarColor, width: 48, height: 48, fontSize: 20, fontWeight: 700 }}>
                    {profile.name.charAt(0)}
                  </Avatar>
                  {profile.isActive && (
                    <Chip 
                      icon={<CheckCircleRoundedIcon fontSize="small" />} 
                      label="使用中" 
                      size="small" 
                      color="primary"
                      sx={{ bgcolor: `#90caf920`, color: '#90caf9', fontWeight: 700, border: 'none' }} 
                    />
                  )}
                </Box>
                
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {profile.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3, minHeight: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {profile.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip size="small" label={`ナレッジ: ${profile.documentCount}件`} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                  <Chip size="small" label={`評価項目: ${profile.itemCount}件`} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                  <Chip size="small" label={`ルール: ${profile.ruleCount}件`} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                </Box>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                <Button 
                  size="small" 
                  startIcon={<BuildRoundedIcon />}
                  sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
                >
                  編集
                </Button>
                {!profile.isActive && (
                  <Button 
                    variant="contained" 
                    size="small"
                    endIcon={<PlayArrowRoundedIcon />}
                    onClick={() => activateProfile(profile.id)}
                    sx={{ bgcolor: '#90caf9', color: '#000', fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: '#e0e0e0' } }}
                  >
                    このAIを使う
                  </Button>
                )}
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
