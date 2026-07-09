import React from 'react';
import { Paper, Typography, Box, LinearProgress, Chip } from '@mui/material';
import { useCreateStore } from '../../../store/useCreateStore';
import { tokens } from '../../../shared/theme/tokens';

export default function GenerationStatusPanel() {
  const job = useCreateStore((state) => state.generationJob);

  const getStatusColor = (status) => {
    switch(status) {
      case 'idle': return 'default'; // Gray
      case 'queued': return 'info'; // Blue
      case 'running': return 'info'; // Blue
      case 'postprocessing': return 'info'; // Blue
      case 'done': return 'success'; // Green
      case 'error': return 'error'; // Red
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'idle': return '待機中';
      case 'queued': return '生成待ち';
      case 'running': return '生成中';
      case 'postprocessing': return '後処理中';
      case 'done': return '完了';
      case 'error': return 'エラー';
      default: return status;
    }
  };

  return (
    <Paper sx={{ 
      p: 2, 
      bgcolor: tokens.background.panel, 
      backdropFilter: 'blur(12px)',
      border: `1px solid ${tokens.border.subtle}`
    }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        JOB STATUS
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>
          {job.status === 'done' ? '完了' : (job.status === 'idle' ? '待機中' : '処理中')}
        </Typography>
        <Chip 
          label={job.status === 'done' ? '生成完了' : (job.status === 'idle' ? '待機中' : '処理中')}
          color={getStatusColor(job.status)} 
          size="small" 
          variant="outlined"
          sx={{ 
            fontWeight: 500,
            animation: job.status === 'done' ? 'pulse 3s infinite' : 'none'
          }}
        />
      </Box>

      {job.status !== 'idle' && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              進行状況
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">
              {job.progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={job.progress} 
            color={getStatusColor(job.status)}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      )}

      {job.errorMessage && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          {job.errorMessage}
        </Typography>
      )}
    </Paper>
  );
}
