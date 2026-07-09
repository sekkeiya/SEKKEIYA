import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useCreateStore } from '../../../store/useCreateStore';
import { useDummyGeneration } from '../hooks/useDummyGeneration';

export default function GenerateActionBar() {
  const { canGenerate, isSubmitting } = useCreateStore((state) => state.uiState);
  const { status } = useCreateStore((state) => state.generationJob);
  const { startDummyGeneration, cancelDummyGeneration } = useDummyGeneration();

  let statusText = "生成の準備ができました";
  let statusColor = "primary.light";
  let btnColor = "primary";
  let isPulse = false;
  
  if (isSubmitting || status === 'running' || status === 'queued') {
    statusText = "生成中...";
    statusColor = "info.main";
    btnColor = "info";
    isPulse = true;
  } else if (!canGenerate) {
    statusText = "プロンプトを入力してください";
    statusColor = "text.disabled";
  } else if (status === 'done') {
    statusText = "生成完了";
    statusColor = "success.main";
    btnColor = "success";
  }

  return (
    <Box>
      <Typography variant="caption" sx={{ color: statusColor, display: 'block', mb: 1, textAlign: 'center', fontWeight: 500 }}>
        {statusText}
      </Typography>
      {isSubmitting ? (
        <Button 
          variant="outlined" 
          color="error" 
          fullWidth 
          onClick={cancelDummyGeneration}
          sx={{ height: 48, borderRadius: 2 }}
        >
          キャンセル
        </Button>
      ) : (
        <Button 
          variant="contained" 
          color={btnColor}
          fullWidth 
          size="large"
          startIcon={<AutoFixHighIcon />}
          disabled={!canGenerate}
          onClick={startDummyGeneration}
          sx={{ 
            height: 48, 
            borderRadius: 2,
            transition: 'all 0.3s ease',
            animation: isPulse ? 'pulse 2s infinite' : 'none',
            '&:hover': {
              transform: canGenerate ? 'translateY(-2px)' : 'none',
              boxShadow: canGenerate ? `0 4px 12px rgba(0,0,0,0.3), 0 0 10px ${statusColor}` : 'none',
            }
          }}
        >
          3Dモデルを生成
        </Button>
      )}
    </Box>
  );
}
