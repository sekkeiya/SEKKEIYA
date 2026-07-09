import React from 'react';
import { Box } from '@mui/material';
import { tokens } from '../theme/tokens';

export const AppShell = ({ sidebar, children }) => {
  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      {/* Dedicated Atmospheric Background Layer */}
      <Box sx={{ 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
        bgcolor: tokens.background.base,
        backgroundImage: tokens.background.gradient,
        zIndex: 0 
      }} />
      {/* Sidebar Slot - Pluggable for SEKKEIYA common UI */}
      {sidebar && (
        <Box sx={{ flexShrink: 0, zIndex: 1200, display: 'flex', position: 'relative' }}>
          {sidebar}
        </Box>
      )}
      
      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {children}
      </Box>
    </Box>
  );
};
