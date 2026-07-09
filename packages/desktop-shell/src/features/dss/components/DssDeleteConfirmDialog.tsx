import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, DialogActions, Button, Box } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

export const DssDeleteConfirmDialog: React.FC<{
  model: any;
  open: boolean;
  onClose: () => void;
  onConfirm: (model: any) => void;
  isBoardModels?: boolean;
}> = ({ model, open, onClose, onConfirm, isBoardModels }) => {
  if (!model) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface)',
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
          「{model.title || model.name || 'Untitled'}」を{isBoardModels ? 'このボードから' : ''}削除しますか？
        </Typography>
        
        <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(249,115,22,0.1)', borderRadius: 1, border: '1px dashed rgba(249,115,22,0.3)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(249,115,22,0.8)' }}>
            {isBoardModels 
              ? '※モデル自体は削除されず、このボード（プロジェクト）との共有リンクが解除されます。' 
              : '※将来的に 30 日間の一時保存エリア（ゴミ箱）へ送られるようになる予定ですが、現在はすぐにリストから非表示になります。'}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        <Button 
          variant="contained" 
          color="error" 
          onClick={() => {
            onConfirm(model);
            onClose();
          }}
          sx={{ fontWeight: 600 }}
        >
          削除する
        </Button>
      </DialogActions>
    </Dialog>
  );
};
