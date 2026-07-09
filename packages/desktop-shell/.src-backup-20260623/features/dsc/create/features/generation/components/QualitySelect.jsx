import React from 'react';
import { ToggleButton, ToggleButtonGroup, Typography, Box } from '@mui/material';
import { useCreateStore } from '../../../store/useCreateStore';

export default function QualitySelect() {
  const quality = useCreateStore((state) => state.generationInput.quality);
  const updateGenerationInput = useCreateStore((state) => state.updateGenerationInput);

  const handleQualityChange = (event, newQuality) => {
    if (newQuality !== null) {
      updateGenerationInput({ quality: newQuality });
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom color="text.secondary">
        品質
      </Typography>
      <ToggleButtonGroup
        color="primary"
        value={quality}
        exclusive
        onChange={handleQualityChange}
        aria-label="Quality"
        fullWidth
        size="small"
      >
        <ToggleButton value="standard">標準</ToggleButton>
        <ToggleButton value="high">高品質</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
