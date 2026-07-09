import React from 'react';
import { Box, Typography } from '@mui/material';
import { BRAND } from '../../../../theme/constants';

const ThinkingIndicator = ({ status }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'flex-start',
      mb: 2, 
      pl: 1
    }}>
      {/* Animated dots container */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        p: 1.5,
        bgcolor: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        border: `1px solid ${BRAND.line}`,
        mb: 1
      }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: BRAND.text, animation: 'pulse 1.4s infinite ease-in-out both' }} />
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: BRAND.text, animation: 'pulse 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: BRAND.text, animation: 'pulse 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
      </Box>

      {/* Status Text */}
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5, fontStyle: 'italic' }}>
        {status || "考えています..."}
      </Typography>

      <style>
        {`
          @keyframes pulse {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </Box>
  );
};

export default ThinkingIndicator;
