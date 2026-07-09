import React from 'react';
import { Box, Typography } from '@mui/material';

export const PageHeader = ({ title, subtitle, actions }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 2,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        bgcolor: 'background.paper',
        zIndex: 10,
      }}
    >
      <Box>
        <Typography variant="h6" fontWeight="bold">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box>{actions}</Box>}
    </Box>
  );
};
