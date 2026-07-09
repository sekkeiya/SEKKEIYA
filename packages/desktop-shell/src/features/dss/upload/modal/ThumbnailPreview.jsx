import React from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const ThumbnailPreview = ({ url, onClear }) => (
  <Box sx={{ position: 'relative', mt: 2, width: 'fit-content' }}>
    <img src={url} alt="thumbnail" width={200} style={{ borderRadius: 4 }} />
    <IconButton size="small" onClick={onClear} sx={{
      position: 'absolute', top: -8, right: -8, backgroundColor: '#fff',
      borderRadius: '50%', boxShadow: 1
    }}>
      <CloseIcon fontSize="small" />
    </IconButton>
  </Box>
);

export default ThumbnailPreview;
