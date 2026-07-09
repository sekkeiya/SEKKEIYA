import React from 'react';
import { Box, Typography, Button } from '@mui/material';

const UploadedFileDisplay = ({ fileName, onClear }) => (
  <Box sx={{ mb: 2 }}>
    <Typography>ファイル: <strong>{fileName}</strong></Typography>
    <Button variant="outlined" onClick={onClear} color="secondary">クリア</Button>
  </Box>
);

export default UploadedFileDisplay;
