import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField, Button, ToggleButton, ToggleButtonGroup, Autocomplete, Chip, Typography, CircularProgress } from '@mui/material';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
// @ts-ignore — JS utility
import { extractDefaultMetadata } from './utils/fileMetadataExtractor';
import type { ModelVisibility, LocalUploadMeta } from './uploadLocalModelToCloud';

// Local Models → クラウド保存用ダイアログ。ファイル名から category/tags を自動推定し、
// ユーザーが調整したうえで公開/非公開を選んでアップロードする。
export const LocalCloudUploadDialog: React.FC<{
  open: boolean;
  model: any | null;
  uploading?: boolean;
  onClose: () => void;
  onConfirm: (meta: LocalUploadMeta, visibility: ModelVisibility) => void;
}> = ({ open, model, uploading, onClose, onConfirm }) => {
  const ext = useMemo(() => String(model?.topExt || 'glb').toLowerCase(), [model]);
  const dims = model?.dimensions || null;

  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ModelVisibility>('private');

  // ダイアログを開くたびにファイル名から自動推定して初期化。
  useEffect(() => {
    if (!open || !model) return;
    const filename = String(model.name || model.title || 'model');
    let auto: any = {};
    try { auto = extractDefaultMetadata(filename, ext, dims) || {}; } catch { /* noop */ }
    setTitle(auto.title || filename.replace(/\.[^.]+$/, ''));
    setType(auto.type || 'Object');
    setCategory(auto.mainCategory || 'Uncategorized');
    setSubCategory(auto.subCategory || '');
    setTags(Array.isArray(auto.tags) ? auto.tags : []);
    setVisibility('private');
  }, [open, model, ext, dims]);

  const handleConfirm = () => {
    onConfirm(
      { title: title.trim(), type, category, subCategory, tags, dimensions: dims },
      visibility,
    );
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#7c3aed' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
  };

  return (
    <Dialog
      open={open}
      onClose={() => !uploading && onClose()}
      PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 440 } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>クラウドへ保存</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mb: 2 }}>
          ファイル名から自動でカテゴリ・タグを推定しました。必要に応じて調整してください。
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="タイトル" size="small" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} sx={fieldSx} />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="タイプ" size="small" fullWidth value={type} onChange={(e) => setType(e.target.value)} sx={fieldSx} />
            <TextField label="カテゴリ" size="small" fullWidth value={category} onChange={(e) => setCategory(e.target.value)} sx={fieldSx} />
          </Box>
          <TextField label="サブカテゴリ" size="small" fullWidth value={subCategory} onChange={(e) => setSubCategory(e.target.value)} sx={fieldSx} />

          <Autocomplete
            multiple freeSolo size="small" options={[]} value={tags}
            onChange={(_, v) => setTags(v as string[])}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} key={option} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
              ))
            }
            renderInput={(params) => <TextField {...params} label="タグ" sx={fieldSx} />}
          />

          <Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 0.75 }}>公開設定</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={visibility}
              onChange={(_, v) => v && setVisibility(v)}
              sx={{ width: '100%', '& .MuiToggleButton-root': { flex: 1, color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' } }}
            >
              <ToggleButton value="public" sx={{ '&.Mui-selected': { bgcolor: 'rgba(124,58,237,0.3) !important', color: '#fff !important' } }}>
                <PublicRoundedIcon sx={{ fontSize: 16, mr: 0.5 }} /> 公開
              </ToggleButton>
              <ToggleButton value="private" sx={{ '&.Mui-selected': { bgcolor: 'rgba(251,146,60,0.3) !important', color: '#fff !important' } }}>
                <LockRoundedIcon sx={{ fontSize: 16, mr: 0.5 }} /> 非公開
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={uploading} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
        <Button
          onClick={handleConfirm} disabled={uploading || !title.trim()} variant="contained"
          startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#8b5cf6' } }}
        >
          {uploading ? 'アップロード中…' : `${visibility === 'public' ? '公開' : '非公開'}で保存`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
