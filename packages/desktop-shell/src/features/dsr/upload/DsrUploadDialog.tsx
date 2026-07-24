import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, LinearProgress,
} from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { dsrUploadService } from './dsrUploadService';
import { DSR_CATEGORIES, type DsrCategory } from '../store/useDsrStore';

const ACCENT = '#4db6ac';
const ACCEPT = '.pdf,.png,.jpg,.jpeg';
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg'];

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

interface DsrUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** アップロード先のセット（開いているセット）。null ならトップ階層 */
  defaultParentSetId?: string | null;
  /** セット選択用のセット一覧 */
  sets: any[];
}

export const DsrUploadDialog: React.FC<DsrUploadDialogProps> = ({ open, onClose, projectId, defaultParentSetId = null, sets }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DsrCategory>('設計図書');
  const [parentSetId, setParentSetId] = useState<string | null>(defaultParentSetId);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle('');
      setCategory('設計図書');
      setParentSetId(defaultParentSetId);
      setProgress(null);
      setError(null);
    }
  }, [open, defaultParentSetId]);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!ALLOWED_EXT.includes(getExt(f.name))) {
      setError('PDF / PNG / JPG のみアップロードできます。');
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(stripExt(f.name));
  };

  const handleUpload = async () => {
    if (!file || !projectId) return;
    setError(null);
    setProgress(0);
    try {
      await dsrUploadService.processDrawingUpload(
        file,
        { title: title.trim() || file.name, category, parentSetId },
        projectId,
        (p) => setProgress(p),
      );
      onClose();
    } catch (e: any) {
      console.error('[DsrUploadDialog] upload failed', e);
      setError(e?.message ?? 'アップロードに失敗しました。');
      setProgress(null);
    }
  };

  const isUploading = progress !== null;

  return (
    <Dialog
      open={open}
      onClose={() => !isUploading && onClose()}
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 460 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>図面をアップロード</DialogTitle>
      <DialogContent>
        {/* Drop zone */}
        <Box
          onClick={() => !isUploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!isUploading) acceptFile(e.dataTransfer.files?.[0]); }}
          sx={{
            mt: 1, mb: 2, p: 3, borderRadius: 2, textAlign: 'center', cursor: isUploading ? 'default' : 'pointer',
            border: `1.5px dashed ${dragOver ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.2)'}`,
            bgcolor: dragOver ? `${ACCENT}11` : 'rgba(0,0,0,0.2)',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} hidden
            onChange={(e) => acceptFile(e.target.files?.[0])} />
          {file ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
              {getExt(file.name) === 'pdf'
                ? <PictureAsPdfRoundedIcon sx={{ fontSize: 32, color: '#ef5350' }} />
                : <ImageRoundedIcon sx={{ fontSize: 32, color: ACCENT }} />}
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ fontSize: 13, color: 'var(--brand-fg)' }}>{file.name}</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{(file.size / 1024).toFixed(0)} KB</Typography>
              </Box>
            </Box>
          ) : (
            <>
              <CloudUploadRoundedIcon sx={{ fontSize: 32, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 0.5 }} />
              <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>クリックまたはドラッグ＆ドロップ</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.5 }}>PDF / PNG / JPG</Typography>
            </>
          )}
        </Box>

        <TextField
          margin="dense" label="タイトル" fullWidth variant="outlined"
          value={title} onChange={(e) => setTitle(e.target.value)} disabled={isUploading}
          InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
          sx={fieldSx}
        />

        <TextField
          select margin="dense" label="カテゴリ" fullWidth variant="outlined"
          value={category} onChange={(e) => setCategory(e.target.value as DsrCategory)} disabled={isUploading}
          InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
          sx={fieldSx}
        >
          {DSR_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        <TextField
          select margin="dense" label="セット（任意）" fullWidth variant="outlined"
          value={parentSetId ?? ''} onChange={(e) => setParentSetId(e.target.value || null)} disabled={isUploading}
          InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
          sx={fieldSx}
        >
          <MenuItem value="">（セットに入れない）</MenuItem>
          {sets.map(s => <MenuItem key={s.id} value={s.id}>{s.title || 'セット'}</MenuItem>)}
        </TextField>

        {error && <Typography sx={{ color: 'light-dark(#ad0000, #ff6b6b)', fontSize: 12, mt: 1 }}>{error}</Typography>}

        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress ?? 0} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5, textAlign: 'right' }}>{Math.round(progress ?? 0)}%</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={isUploading} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button onClick={handleUpload} disabled={!file || isUploading} variant="contained"
          startIcon={<CloudUploadRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#000', '&:hover': { bgcolor: '#80cbc4' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}>
          {isUploading ? 'アップロード中...' : 'アップロード'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const fieldSx = {
  mt: 1,
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
    '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
} as const;
