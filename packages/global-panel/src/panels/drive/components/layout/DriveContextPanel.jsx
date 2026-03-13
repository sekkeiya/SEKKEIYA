import React from "react";
import { Box, Typography, Paper, Chip } from "@mui/material";
import ImageNotSupportedRoundedIcon from '@mui/icons-material/ImageNotSupportedRounded';
import { usePanelTheme } from "../../../../theme/ThemeContext.jsx";
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';

export default function DriveContextPanel() {
  const BRAND = usePanelTheme();
  
  return (
    <Box sx={{
      width: 320,
      flexShrink: 0,
      borderLeft: `1px solid rgba(255,255,255,0.08)`,
      bgcolor: "rgba(255,255,255,0.02)",
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <Typography variant="subtitle2" fontWeight="bold">Properties</Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Preview */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Preview</Typography>
          <Paper sx={{ 
            height: 160, 
            bgcolor: 'rgba(255,255,255,0.02)', 
            border: `1px solid rgba(255,255,255,0.08)`, 
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1
          }}>
            <ImageNotSupportedRoundedIcon sx={{ fontSize: 32, opacity: 0.2 }} />
            <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.5 }}>No preview available</Typography>
          </Paper>
        </Box>

        {/* Metadata */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Metadata</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 1.5, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Name</Typography>
            <Typography variant="body2" align="right" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }} noWrap>SampleAsset.png</Typography>

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Type</Typography>
            <Typography variant="body2" align="right" sx={{ color: 'rgba(255,255,255,0.9)' }}>Image</Typography>

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Size</Typography>
            <Typography variant="body2" align="right" sx={{ color: 'rgba(255,255,255,0.9)' }}>2.4 MB</Typography>

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Modified</Typography>
            <Typography variant="body2" align="right" sx={{ color: 'rgba(255,255,255,0.9)' }}>Just now</Typography>
          </Box>
        </Box>

        {/* Tags */}
        <Box>
           <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Tags</Typography>
           <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>No tags added</Typography>
        </Box>
      </Box>
    </Box>
  );
}
