import React, { useRef, useState } from 'react';
import { Popover, Box, Typography, Button, CircularProgress, Divider, Tooltip } from '@mui/material';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

import { useAppStore } from '../../../store/useAppStore';
import { updateProjectIcon } from '../api/updateProject';
import { uploadImageAndGetUrl } from '../../../lib/firebase/uploadImage';

// 建築・インテリア・設計プロジェクト向けの絵文字セット
const EMOJIS = [
  '🏠', '🏡', '🏢', '🏗️', '🏛️', '🏘️', '🏬', '🏨', '🏯', '🏰',
  '⛪', '🗼', '🌉', '🏙️', '🌆', '🛋️', '🪑', '🚪', '🪟', '🛏️',
  '🛁', '🚿', '📐', '📏', '✏️', '🖌️', '🎨', '🧩', '🗂️', '📋',
  '📌', '📍', '🎯', '⭐', '🔥', '💡', '🌿', '🍃', '🌸', '🌳',
  '🌲', '🪴', '☀️', '🌙', '💎', '🔷', '🔶', '🟦', '🟧', '🟫',
  '🎬', '📸', '🖼️', '🗺️', '🧭', '🚀', '✨', '🏷️', '📦', '🔑',
];

interface Props {
  anchorEl: HTMLElement | null;
  projectId: string | null;
  hasCustomIcon?: boolean;
  onClose: () => void;
}

export const ProjectIconPicker: React.FC<Props> = ({ anchorEl, projectId, hasCustomIcon, onClose }) => {
  const patchProject = useAppStore(s => s.patchProject);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const applyEmoji = async (emoji: string) => {
    if (!projectId) return;
    patchProject(projectId, { iconEmoji: emoji, iconUrl: undefined });
    onClose();
    try { await updateProjectIcon(projectId, { iconEmoji: emoji, iconUrl: null }); }
    catch (e) { console.error('Failed to set project emoji', e); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const url = await uploadImageAndGetUrl(file);
      patchProject(projectId, { iconUrl: url, iconEmoji: undefined });
      await updateProjectIcon(projectId, { iconUrl: url, iconEmoji: null });
      onClose();
    } catch (err) {
      console.error('Failed to upload project icon', err);
      alert('画像のアップロードに失敗しました。');
    } finally {
      setUploading(false);
    }
  };

  const reset = async () => {
    if (!projectId) return;
    patchProject(projectId, { iconEmoji: undefined, iconUrl: undefined });
    onClose();
    try { await updateProjectIcon(projectId, { iconEmoji: null, iconUrl: null }); }
    catch (e) { console.error('Failed to reset project icon', e); }
  };

  return (
    <Popover
      open={!!anchorEl && !!projectId}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      slotProps={{ paper: { sx: { bgcolor: '#1a2233', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, width: 300, p: 1.5, color: '#fff', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' } } }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', mb: 1, px: 0.5 }}>
        絵文字を選ぶ
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 0.25, maxHeight: 168, overflowY: 'auto' }}>
        {EMOJIS.map(em => (
          <Box
            key={em}
            onClick={() => applyEmoji(em)}
            sx={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
          >
            {em}
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.25, borderColor: 'rgba(255,255,255,0.08)' }} />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          fullWidth size="small" variant="outlined" disabled={uploading}
          startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => fileRef.current?.click()}
          sx={{ textTransform: 'none', fontSize: 12, color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.08)' } }}
        >
          {uploading ? 'アップロード中…' : '画像をアップロード'}
        </Button>
        {hasCustomIcon && (
          <Tooltip title="デフォルト（頭文字）に戻す">
            <Button
              size="small" variant="text" onClick={reset}
              sx={{ minWidth: 40, color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}
            >
              <RestartAltRoundedIcon sx={{ fontSize: 18 }} />
            </Button>
          </Tooltip>
        )}
      </Box>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
    </Popover>
  );
};
