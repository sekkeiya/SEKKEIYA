import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Divider, Stack, Chip } from '@mui/material';

export default function CategoryCheatSheetDialog({ open, onClose, mergedCategoryMap }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', backgroundImage: 'none' } }}>
      <DialogTitle sx={{ fontWeight: 'bold' }}>システムカテゴリ 早見表</DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        {Object.entries(mergedCategoryMap).map(([macro, mains]) => (
          <Box key={macro} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold', mb: 1, letterSpacing: 1 }}>{macro}</Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
              {Object.entries(mains).map(([main, subs]) => (
                <Box key={main} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', p: 1.5, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: '#64b5f6', fontWeight: 600, mb: 1 }}>{main}</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                     {subs.length === 0 ? <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>サブカテゴリなし</Typography> : null}
                     {subs.map(sub => (
                       <Chip key={sub} label={sub} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', fontWeight: 500 }} />
                     ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
        {Object.keys(mergedCategoryMap).length === 0 && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 4 }}>
            カテゴリが登録されていません
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)' }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
