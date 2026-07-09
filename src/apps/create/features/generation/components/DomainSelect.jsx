import React from 'react';
import { ToggleButton, ToggleButtonGroup, Typography, Box } from '@mui/material';
import { useCreateStore } from '../../../store/useCreateStore';

export default function DomainSelect() {
  const domain = useCreateStore((state) => state.generationInput.domain);
  const updateGenerationInput = useCreateStore((state) => state.updateGenerationInput);

  const handleDomainChange = (event, newDomain) => {
    if (newDomain !== null) {
      const defaultEngine = newDomain === 'furniture' ? 'self-furniture-v1' : 'self-architecture-v1';
      updateGenerationInput({ domain: newDomain, engine: defaultEngine });
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom color="text.secondary">
        ドメイン
      </Typography>
      <ToggleButtonGroup
        color="primary"
        value={domain}
        exclusive
        onChange={handleDomainChange}
        aria-label="Domain"
        fullWidth
        size="small"
      >
        <ToggleButton value="furniture">家具（Furniture）</ToggleButton>
        <ToggleButton value="architecture">空間（Architecture）</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
