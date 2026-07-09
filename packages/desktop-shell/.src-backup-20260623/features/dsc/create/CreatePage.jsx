import React, { useEffect } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { useQueryParams } from '../shared/hooks/useQueryParams';
import { useCreateStore } from '../store/useCreateStore';
import GenerationInputPanel from '../features/generation/components/GenerationInputPanel';
import GenerationStatusPanel from '../features/generation/components/GenerationStatusPanel';
import GenerationPreviewPanel from '../features/preview/components/GenerationPreviewPanel';
import SaveActionsPanel from '../features/save/components/SaveActionsPanel';

export default function CreatePage() {
  const queryParams = useQueryParams();
  const setSourceContext = useCreateStore((state) => state.setSourceContext);

  // Initialize context from query params
  useEffect(() => {
    setSourceContext({
      from: queryParams.from,
      boardId: queryParams.boardId,
      autoInsertToBoard: queryParams.autoInsertToBoard,
    });
  }, [queryParams, setSourceContext]);

  return (
    <Box sx={{ flexGrow: 1, p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        3D Shape Create
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column: Inputs */}
        <Grid item xs={12} md={4}>
          <GenerationInputPanel />
        </Grid>

        {/* Right Column: Status & Preview */}
        <Grid item xs={12} md={8}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <GenerationStatusPanel />
            <GenerationPreviewPanel />
            <SaveActionsPanel />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
