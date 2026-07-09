import React from 'react';
import { FormControl, Select, MenuItem, Typography, Box } from '@mui/material';
import { useCreateStore } from '../../../store/useCreateStore';
import { GENERATION_ENGINES } from '../../../shared/constants/generationEngines';

export default function EngineSelect() {
  const engine = useCreateStore((state) => state.generationInput.engine);
  const updateGenerationInput = useCreateStore((state) => state.updateGenerationInput);

  const handleChange = (event) => {
    updateGenerationInput({ engine: event.target.value });
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom color="text.secondary">
        エンジン
      </Typography>
      <FormControl fullWidth size="small">
        <Select
          value={engine}
          onChange={handleChange}
        >
          {GENERATION_ENGINES.map((eng) => (
            <MenuItem key={eng.value} value={eng.value}>
              {eng.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
