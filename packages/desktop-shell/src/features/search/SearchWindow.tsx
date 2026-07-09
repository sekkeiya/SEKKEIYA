// ポップアウトされた SEKKEIYA Search の中身（独立ネイティブウィンドウ /?searchWindow=true で描画）。
// OS標準枠で移動/リサイズし、中身は GlobalSearchDialog を embedded モードで全面表示する。
import React from 'react';
import { Box } from '@mui/material';
import { GlobalSearchDialog } from './GlobalSearchDialog';

export const SearchWindow: React.FC = () => {
  const handleClose = () => {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().close())
      .catch(() => {});
  };
  return (
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#0a0d16', overflow: 'hidden' }}>
      <GlobalSearchDialog open embedded onClose={handleClose} />
    </Box>
  );
};
