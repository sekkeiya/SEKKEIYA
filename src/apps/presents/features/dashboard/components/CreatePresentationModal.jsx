import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { createPresentation } from '../../../shared/api/presentsApi';
import { tokens } from '../../../shared/theme/tokens';

export const CreatePresentationModal = ({ open, onClose }) => {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams();

  const handleCreate = async () => {
    if (!title.trim() || !projectId) return;
    
    setCreating(true);
    try {
      const newId = await createPresentation(projectId, { title, type: 'presentation' });
      onClose();
      setTitle('');
      navigate(`/projects/${projectId}/workspaces/presents/editor/${newId}`);
    } catch (e) {
      console.error('Failed to create presentation:', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: tokens.background.panel, backdropFilter: 'blur(16px)', border: tokens.border.subtle, color: 'white' } }}>
      <DialogTitle fontWeight="bold">新規プレゼンテーション</DialogTitle>
      <DialogContent sx={{ minWidth: 400 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          新しいプレゼンテーションのタイトルを入力してください。
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="タイトル"
          type="text"
          fullWidth
          variant="outlined"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{
             '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2 },
             '& .MuiInputLabel-root': { color: 'text.secondary' }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={creating} color="inherit" sx={{ color: 'text.secondary' }}>キャンセル</Button>
        <Button onClick={handleCreate} disabled={!title.trim() || creating} variant="contained" color="primary" sx={{ borderRadius: 4, boxShadow: tokens.glow.primary }}>
          {creating ? <CircularProgress size={20} color="inherit" /> : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
