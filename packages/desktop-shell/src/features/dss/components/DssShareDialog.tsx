import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box, DialogActions, Button, IconButton, InputBase, Tooltip, Snackbar } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';

export const DssShareDialog: React.FC<{
  model: any;
  open: boolean;
  onClose: () => void;
}> = ({ model, open, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!model) return null;

  const shareUrl = `https://sekkeiya.com/models/${model.id || model.itemId || ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--brand-surface)',
            backgroundImage: 'none',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon color="primary" /> モデルを共有
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            以下のリンクをコピーして、「{model.title || model.name || 'Untitled'}」を共有できます。
          </Typography>
          
          <Box sx={{ 
            mt: 2, 
            p: 1, 
            display: 'flex', 
            alignItems: 'center', 
            bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', 
            borderRadius: 1,
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)'
          }}>
            <InputBase
              value={shareUrl}
              readOnly
              sx={{ flex: 1, pl: 1, color: 'text.primary', fontSize: '0.875rem' }}
            />
            <Tooltip title="リンクをコピー" placement="top">
              <IconButton onClick={handleCopy} color="primary" size="small">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">閉じる</Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
        message="リンクをクリップボードにコピーしました"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};
