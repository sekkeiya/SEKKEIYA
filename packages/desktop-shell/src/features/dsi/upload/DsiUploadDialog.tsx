import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, LinearProgress,
} from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import { dsiUploadService, mediaTypeForExt } from './dsiUploadService';
import { DSI_CATEGORIES, type DsiCategory } from '../store/useDsiStore';

const ACCENT = '#ec407a';
const ACCENT_HOVER = '#f48fb1';
const ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.m4v';
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'webm', 'm4v'];

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

interface DsiUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** アップロード先のセット（開いているセット）。null ならトップ階層 */
  defaultParentSetId?: string | null;
  /** セット選択用のセット一覧 */
  sets: any[];
}

export const DsiUploadDialog: React.FC<DsiUploadDialogProps> = ({ open, onClose, projectId, defaultParentSetId = null, sets }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DsiCategory>('静止画');
  const [parentSetId, setParentSetId] = useState<string | null>(defaultParentSetId);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle('');
      setCategory('静止画');
      setParentSetId(defaultParentSetId);
      setProgress(null);
      setError(null);
    }
  }, [open, defaultParentSetId]);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    const ext = getExt(f.name);
    if (!ALLOWED_EXT.includes(ext)) {
      setError('画像（PNG/JPG/WebP/GIF）または動画（MP4/MOV/WebM）のみアップロードできます。');
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(stripExt(f.name));
    // 動画なら自動的に「動画」カテゴリへ
    setCategory(mediaTypeForExt(ext) === 'video' ? '動画' : '静止画');
  };

  const handleUpload = async () => {
    if (!file || !projectId) return;
    setError(null);
    setProgress(0);
    try {
      await dsiUploadService.processImageUpload(
        file,
        { title: title.trim() || file.name, category, parentSetId },
        projectId,
        (p) => setProgress(p),
      );
      onClose();
    } catch (e: any) {
      console.error('[DsiUploadDialog] upload failed', e);
      setError(e?.message ?? 'アップロードに失敗しました。');
      setProgress(null);
    }
  };

  const isUploading = progress !== null;
  const isVideo = file ? mediaTypeForExt(getExt(file.name)) === 'video' : false;

  return (
    <Dialog
      open={open}
      onClose={() => !isUploading && onClose()}
      PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 460 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>画像 / 動画をアップロード</DialogTitle>
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
              {isVideo
                ? <MovieRoundedIcon sx={{ fontSize: 32, color: ACCENT }} />
                : <ImageRoundedIcon sx={{ fontSize: 32, color: ACCENT }} />}
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ fontSize: 13, color: '#fff' }}>{file.name}</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{(file.size / 1024).toFixed(0)} KB</Typography>
              </Box>
            </Box>
          ) : (
            <>
              <CloudUploadRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.4)', mb: 0.5 }} />
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>クリックまたはドラッグ＆ドロップ</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>画像 PNG / JPG / WebP / GIF・動画 MP4 / MOV / WebM</Typography>
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
          value={category} onChange={(e) => setCategory(e.target.value as DsiCategory)} disabled={isUploading}
          InputProps={{ style: { color: '#fff' } }} InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
          sx={fieldSx}
        >
          {DSI_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        <TextField
          select margin="dense" label="セット（任意）" fullWidth variant="outlined"
          value={parentSetId ?? ''} onChange={(e) => setParentSetId(e.target.value || null)} disabled={isUploading}
          InputProps={{ style: { color: '#fff' } }} InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
          sx={fieldSx}
        >
          <MenuItem value="">（セットに入れない）</MenuItem>
          {sets.map(s => <MenuItem key={s.id} value={s.id}>{s.title || 'セット'}</MenuItem>)}
        </TextField>

        {error && <Typography sx={{ color: '#ff6b6b', fontSize: 12, mt: 1 }}>{error}</Typography>}

        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress ?? 0} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mt: 0.5, textAlign: 'right' }}>{Math.round(progress ?? 0)}%</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={isUploading} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
        <Button onClick={handleUpload} disabled={!file || isUploading} variant="contained"
          startIcon={<CloudUploadRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: ACCENT_HOVER }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' } }}>
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
