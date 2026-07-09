import React, { useState } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { invoke } from '@tauri-apps/api/core';

export const SekkeiyaSettingsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleMount = async () => {
    try {
      setLoading(true);
      setMessage(null);
      await invoke('setup_ai_drive');
      setMessage({ text: 'SEKKEIYA DriveをPC直下にマウントしました。', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `マウントに失敗しました: ${err}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnmount = async () => {
    try {
      setLoading(true);
      setMessage(null);
      await invoke('remove_ai_drive_mount');
      setMessage({ text: 'SEKKEIYA Driveのマウントを解除しました。（実体フォルダは残っています）', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `アンマウントに失敗しました: ${err}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        SEKKEIYA 設定
      </Typography>

      <Paper sx={{ p: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderSpecialIcon sx={{ color: '#00BFFF' }} />
          PC\SEKKEIYA ネイティブ統合 (Windows専用)
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 3 }}>
          エクスプローラーの「PC」直下に「SEKKEIYA」を表示し、シームレスなアクセスを提供します。
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleMount}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <FolderSpecialIcon />}
            sx={{
              bgcolor: '#00BFFF',
              color: '#000',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: '#4facfe' }
            }}
          >
            PCにマウントする
          </Button>

          <Button
            variant="outlined"
            onClick={handleUnmount}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
            sx={{
              borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
              color: 'rgb(var(--brand-fg-rgb) / 0.7)',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { borderColor: '#fa709a', color: 'light-dark(#a80637, #fa709a)', bgcolor: 'rgba(250,112,154,0.1)' }
            }}
          >
            マウントを解除
          </Button>
        </Box>

        {message && (
          <Typography
            variant="body2"
            sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: message.type === 'success' ? 'rgba(67, 233, 123, 0.1)' : 'rgba(250, 112, 154, 0.1)', color: message.type === 'success' ? '#43e97b' : 'light-dark(#a80637, #fa709a)' }}
          >
            {message.text}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};
