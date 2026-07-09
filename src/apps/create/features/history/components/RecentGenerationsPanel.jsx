import React from 'react';
import { Paper, Typography, Box, Stack } from '@mui/material';
import { tokens } from '../../../shared/theme/tokens';
import HistoryIcon from '@mui/icons-material/History';

import { useCreateStore } from '../../../store/useCreateStore';

export default function RecentGenerationsPanel() {
  const recentJobs = useCreateStore((state) => state.recentJobs);
  const restoreJob = useCreateStore((state) => state.restoreJob);
  return (
    <Paper sx={{ 
      p: 2, 
      flexGrow: 1, 
      overflowY: 'auto', 
      bgcolor: tokens.background.panel, 
      backdropFilter: 'blur(12px)',
      border: `1px solid ${tokens.border.subtle}`,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <HistoryIcon fontSize="small" color="action" />
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.secondary' }}>
        生成履歴
      </Typography>
      </Box>

      <Stack spacing={2} sx={{ flexGrow: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        生成履歴がここに表示されます。S.Modelsに保存するとアセットとして管理されます。
      </Typography>
        {recentJobs.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            まだ生成履歴はありません。
          </Typography>
        ) : (
          recentJobs.map((job) => (
            <Box 
              key={job.id} 
              onClick={() => restoreJob(job)}
              sx={{ 
                height: 64, 
                borderRadius: 2, 
                border: `1px solid ${tokens.border.subtle}`, 
                bgcolor: 'rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                p: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.06)',
                  borderColor: tokens.border.active
                }
              }}
            >
              <Box 
                component="img"
                src={job.resultPreviewImagePath || ''}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
                sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.5)', mr: 2, objectFit: 'cover' }} 
              />
              <Box sx={{ display: 'none', width: 48, height: 48, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.5)', mr: 2, alignItems: 'center', justifyContent: 'center' }}>
                <HistoryIcon sx={{ color: 'text.disabled', fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" color="text.primary" noWrap>
                  {job.engine === 'tripo-api' ? 'Tripo High Quality' : 'Draft Model'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(job.updatedAt || Date.now()).toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Stack>
    </Paper>
  );
}
