import React from 'react';
import { Box, Typography, Paper, Card, CardContent, Chip, Button, Avatar } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { BRAND } from '../../../styles/theme';
import { useAiStudioStore } from '../store/useAiStudioStore';

export const AiStudioScore: React.FC = () => {
  const { profiles } = useAiStudioStore();
  const activeProfile = profiles.find(p => p.isActive);

  // Mock scoring history/report data
  const scoreReports = [
    { id: 'proj_A', name: '大手町オフィスタワー エントランス改修', date: '2026-03-28', score: 85, status: 'pass' },
    { id: 'proj_B', name: '新宿イノベーションハブ 新規レイアウト', date: '2026-03-27', score: 62, status: 'fail' },
  ];

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, color: '#fff', maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
            AIでの採点と評価 (AI Score)
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 600 }}>
            設定されたルールと評価基準に基づき、プロジェクトに対する採点を行います。
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AutorenewRoundedIcon />}
          sx={{ bgcolor: '#90caf9', color: '#000', fontWeight: 600, '&:hover': { bgcolor: '#e0e0e0' } }}
        >
          全プロジェクト再採点
        </Button>
      </Box>

      {/* Active Profile Info */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(144, 202, 249, 0.05)', border: `1px solid rgba(144, 202, 249, 0.2)`, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Avatar sx={{ bgcolor: 'rgba(144, 202, 249, 0.2)', color: '#90caf9', width: 56, height: 56 }}>
          <AssessmentRoundedIcon fontSize="large" />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: BRAND.sub, fontSize: 13, textTransform: 'uppercase', mb: 0.5 }}>
            現在適応中の評価AI
          </Typography>
          <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
            {activeProfile ? activeProfile.name : 'AIが選択されていません'}
          </Typography>
        </Box>
        <Chip 
          label={`${activeProfile ? activeProfile.ruleCount : 0} 適用ルール`} 
          sx={{ bgcolor: 'rgba(144, 202, 249, 0.1)', color: '#90caf9', fontWeight: 600 }} 
        />
      </Paper>

      {/* Score Reports Grid */}
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>最新の採点レポート</Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {scoreReports.map(report => (
          <Card key={report.id} sx={{ bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                  {report.name}
                </Typography>
                <Chip 
                  label={report.status === 'pass' ? '基準クリア' : '要改善'} 
                  icon={report.status === 'pass' ? <CheckCircleRoundedIcon /> : <ErrorOutlineRoundedIcon />}
                  color={report.status === 'pass' ? 'success' : 'error'}
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 3 }}>
                <Typography sx={{ fontSize: 48, fontWeight: 800, color: report.status === 'pass' ? '#2ecc71' : '#e74c3c', lineHeight: 1 }}>
                  {report.score}
                </Typography>
                <Typography sx={{ color: BRAND.sub, fontSize: 16 }}>/ 100 pt</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: `1px solid ${BRAND.line}` }}>
                <Typography sx={{ color: BRAND.sub, fontSize: 12 }}>
                  採点日: {report.date}
                </Typography>
                <Button size="small" sx={{ color: '#90caf9' }}>レポート詳細を見る</Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

    </Box>
  );
};
