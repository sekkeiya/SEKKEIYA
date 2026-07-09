import React, { useRef, useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, TextField, CircularProgress,
  Snackbar, Alert,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Check, Image as ImageIcon } from 'lucide-react';
import { BRAND } from '../styles/theme';
import { uploadFieldPhoto } from '../features/projects/fieldPhotosApi';
import { useAIDriveStore } from '../store/useAIDriveStore';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  /** Active project id. If null, photo goes to global drive only. */
  projectId: string | null;
}

/**
 * iOS-native camera / photo-library capture flow.
 * Uses <input type="file" capture> so the iOS system camera sheet appears.
 * After selection, shows a full-screen preview with caption and upload.
 */
const CameraCapture: React.FC<CameraCaptureProps> = ({ open, onClose, projectId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [mode, setMode] = useState<'picker' | 'preview'>('picker');

  const uploadImageToDrive = useAIDriveStore(s => s.uploadImageToDrive);

  // Triggered by the FAB: open mode sheet first time
  const handleOpen = useCallback(() => {
    setMode('picker');
    setPreview(null);
    setFile(null);
    setCaption('');
  }, []);

  React.useEffect(() => {
    if (open) {
      handleOpen();
      // Small delay so the component is mounted before triggering the picker
      const t = setTimeout(() => fileInputRef.current?.click(), 100);
      return () => clearTimeout(t);
    }
  }, [open, handleOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      onClose();
      return;
    }
    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreview(url);
    setMode('preview');
    // Reset input value so the same file can be re-selected if retried
    e.target.value = '';
  };

  const handleRetry = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setCaption('');
    setMode('picker');
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    if (!file) return;
    setUploading(true);
    try {
      if (projectId) {
        await uploadFieldPhoto(projectId, file, caption);
      } else {
        // No active project → upload to global AI Drive only
        await uploadImageToDrive([file], null);
      }
      setToast({ msg: '写真を保存しました', severity: 'success' });
      if (preview) URL.revokeObjectURL(preview);
      onClose();
    } catch (err) {
      console.error(err);
      setToast({ msg: '保存に失敗しました', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    onClose();
  };

  return (
    <>
      {/* Hidden file input — capture="environment" triggers iOS camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Preview overlay */}
      <AnimatePresence>
        {open && mode === 'preview' && preview && (
          <motion.div
            key="camera-preview"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              background: '#000',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Top bar */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              pt: 'env(safe-area-inset-top, 16px)',
              pb: 1,
              bgcolor: 'rgba(0,0,0,0.8)',
            }}>
              <IconButton onClick={handleCancel} sx={{ color: '#fff' }}>
                <X size={22} />
              </IconButton>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                現場フォト
              </Typography>
              <IconButton onClick={handleRetry} sx={{ color: '#fff' }}>
                <RotateCcw size={20} />
              </IconButton>
            </Box>

            {/* Photo preview */}
            <Box sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img
                src={preview}
                alt="preview"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </Box>

            {/* Caption + save area */}
            <Box sx={{
              bgcolor: 'rgba(0,0,0,0.85)',
              px: 2,
              pt: 2,
              pb: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              {!projectId && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  bgcolor: 'rgba(255,165,0,0.15)', border: '1px solid rgba(255,165,0,0.3)',
                  borderRadius: 2, px: 2, py: 1,
                }}>
                  <ImageIcon size={14} color="#ffa726" />
                  <Typography sx={{ color: '#ffa726', fontSize: '0.78rem' }}>
                    プロジェクト未選択 — AI ドライブに保存されます
                  </Typography>
                </Box>
              )}

              <TextField
                fullWidth
                multiline
                maxRows={3}
                placeholder="キャプションを追加..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.4)' },
                }}
              />

              {/* Save button */}
              <Box
                component="button"
                onClick={handleSave}
                disabled={uploading}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                  width: '100%', height: 52,
                  bgcolor: uploading ? 'rgba(52,152,219,0.5)' : '#3498db',
                  color: '#fff',
                  border: 'none', borderRadius: 3,
                  fontSize: 16, fontWeight: 700,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s',
                  '&:active': { bgcolor: '#2980b9' },
                }}
              >
                {uploading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <>
                    <Check size={18} />
                    保存する
                  </>
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)} sx={{ fontSize: 13 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default CameraCapture;
