import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, DialogActions, Button, Box } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { AIDriveAsset } from '../../store/useAIDriveStore';

export const AIDriveDeleteConfirmDialog: React.FC<{
  assets: AIDriveAsset[];
  open: boolean;
  onClose: () => void;
  onConfirm: (assets: AIDriveAsset[]) => void;
  isProjectScope?: boolean;
}> = ({ assets, open, onClose, onConfirm, isProjectScope }) => {
  if (!assets || assets.length === 0) return null;

  const isMultiple = assets.length > 1;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f172a',
          backgroundImage: 'none',
          border: '1px solid rgba(249,115,22,0.3)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#f97316' }}>
        <DeleteOutlineRoundedIcon /> 削除の確認
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {isMultiple ? (
            <>選択した <strong>{assets.length}</strong> 件のアイテムを{isProjectScope ? 'プロジェクトから外しますか？' : '削除しますか？'}</>
          ) : (
            <>「{assets[0].name || 'Untitled'}」を{isProjectScope ? 'プロジェクトから外しますか？' : '削除しますか？'}</>
          )}
        </Typography>
        
        <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(249,115,22,0.1)', borderRadius: 1, border: '1px dashed rgba(249,115,22,0.3)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(249,115,22,0.8)' }}>
            {isProjectScope 
              ? '※アイテム自体は削除されず、このプロジェクトとの紐付けが解除されます。' 
              : '※他アプリのファイルの場合、連携されている実データも削除される可能性があります。'}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        <Button 
          variant="contained" 
          color="error" 
          onClick={() => {
            onConfirm(assets);
            onClose();
          }}
          sx={{ fontWeight: 600 }}
        >
          {isProjectScope ? 'プロジェクトから外す' : '削除する'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
