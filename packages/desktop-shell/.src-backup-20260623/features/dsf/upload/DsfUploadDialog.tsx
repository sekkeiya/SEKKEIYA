import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, LinearProgress,
} from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { dsfUploadService } from './dsfUploadService';
import { DSF_CATEGORIES, type DsfCategory } from '../store/useDsfStore';

const ACCENT = '#7e57c2';
const ACCEPT = '.pdf';
const ALLOWED_EXT = ['pdf'];

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

interface DsfUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export const DsfUploadDialog: React.FC<DsfUploadDialogProps> = ({ open, onClose, projectId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DsfCategory>('作品集');
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'thumbnail' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle('');
      setCategory('作品集');
      setProgress(null);
      setPhase('idle');
      setError(null);
    }
  }, [open]);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!ALLOWED_EXT.includes(getExt(f.name))) {
      setError('PDF のみアップロードできます。');
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(stripExt(f.name));
  };

  const handleUpload = async () => {
    if (!file || !projectId) return;
    setError(null);
    setPhase('thumbnail');
    setProgress(0);
    try {
      await dsfUploadService.processPortfolioUpload(
        file,
        { title: title.trim() || file.name, category },
        projectId,
        (p) => { setPhase('uploading'); setProgress(p); },
      );
      onClose();
    } catch (e: any) {
      console.error('[DsfUploadDialog] upload failed', e);
      setError(e?.message ?? 'アップロードに失敗しました。');
      setProgress(null);
      setPhase('idle');
    }
  };

  const isUploading = phase !== 'idle';

  return (
    <Dialog
      open={open}
      onClose={() => !isUploading && onClose()}
      PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 460 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>ポートフォリオをアップロード</DialogTitle>
      <DialogContent>
        {/* Drop zone */}
        <Box
          onClick={() => !isUploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!isUploading) acceptFile(e.dataTransfer.files?.[0]); }}
          sx={{
            mt: 1, mb: 2, p: 3, borderRadius: 2, textAlign: 'center', cursor: isUploading ? 'default' : 'pointer',
            border: `1.5px dashed ${dragOver ? ACCENT : 'rgba(255,255,255,0.2)'}`,
            bgcolor: dragOver ? `${ACCENT}11` : 'rgba(0,0,0,0.2)',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} hidden
            onChange={(e) => acceptFile(e.target.files?.[0])} />
          {file ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
              <MenuBookRoundedIcon sx={{ fontSize: 32, color: ACCENT }} />
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ fontSize: 13, color: '#fff' }}>{file.name}</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</Typography>
              </Box>
            </Box>
          ) : (
            <>
              <CloudUploadRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.4)', mb: 0.5 }} />
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>クリックまたはドラッグ＆ドロップ</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>PDF（一冊の本として閲覧できます）</Typography>
            </>
          )}
        </Box>

        <TextField
          margin="dense" label="タイトル" fullWidth variant="outlined"
          value={title} onChange={(e) => setTitle(e.target.value)} disabled={isUploading}
          InputProps={{ style: { color: '#fff' } }} InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
          sx={fieldSx}
        />

        <TextField
          select margin="dense" label="カテゴリ" fullWidth variant="outlined"
          value={category} onChange={(e) => setCategory(e.target.value as DsfCategory)} disabled={isUploading}
          InputProps={{ style: { color: '#fff' } }} InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
          sx={fieldSx}
        >
          {DSF_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        {error && <Typography sx={{ color: '#ff6b6b', fontSize: 12, mt: 1 }}>{error}</Typography>}

        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant={phase === 'thumbnail' ? 'indeterminate' : 'determinate'} value={progress ?? 0}
              sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }}
            />
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mt: 0.5, textAlign: 'right' }}>
              {phase === 'thumbnail' ? '表紙を生成中...' : `${Math.round(progress ?? 0)}%`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={isUploading} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
        <Button onClick={handleUpload} disabled={!file || isUploading} variant="contained"
          startIcon={<CloudUploadRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: '#9575cd' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' } }}>
          {isUploading ? 'アップロード中...' : 'アップロード'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const fieldSx = {
  mt: 1,
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
} as const;
