import React from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { useCreateStore } from '../../../store/useCreateStore';

export default function PromptInput() {
  const { prompt } = useCreateStore((state) => state.generationInput);
  const updateGenerationInput = useCreateStore((state) => state.updateGenerationInput);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        テキストプロンプト
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder="モダンな木の椅子、金属製の脚..."
        value={prompt || ''}
        onChange={(e) => updateGenerationInput({ prompt: e.target.value })}
        variant="outlined"
        size="small"
      />
    </Box>
  );
}
