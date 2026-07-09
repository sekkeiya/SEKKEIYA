import React, { useRef, useState } from 'react';
import { Box, Typography, CircularProgress, Snackbar, Alert, IconButton } from '@mui/material';
import { Camera, ImageIcon, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND } from '../styles/theme';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { JournalRepository } from '../features/projects/repositories/JournalRepository';

type UploadState = 'idle' | 'uploading' | 'preview' | 'success' | 'error';

const MobileCameraFab: React.FC = () => {
  const { activeProjectId, getActiveProject, setAIChatOpen } = useAppStore();
  const { currentUser } = useAuthStore();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  if (!activeProjectId) return null;

  const handleFileSelected = (file: File | null) => {
    setMenuOpen(false);
    if (!file || !file.type.startsWith('image/')) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState('preview');
  };

  const handleSave = async () => {
    if (!pendingFile || !activeProjectId || !currentUser) return;
    setUploadState('uploading');
    try {
      const downloadUrl = await JournalRepository.uploadAttachment(activeProjectId, pendingFile);
      const content = `![現場写真](${downloadUrl})`;
      await JournalRepository.addJournalEntry(activeProjectId, {
        authorId: currentUser.uid,
        content,
        title: '現場写真',
        aiContextSnapshot: { contextLevel: 'project', watchedScopes: [] },
        embeddingState: 'pending',
      });
      setUploadState('success');
      setToast({ msg: '写真を保存しました', severity: 'success' });
      setTimeout(() => {
        setUploadState('idle');
        setPreviewUrl(null);
        setPendingFile(null);
      }, 2000);
    } catch {
      setUploadState('error');
      setToast({ msg: '保存に失敗しました', severity: 'error' });
      setUploadState('idle');
    }
  };

  const handleDiscard = () => {
    setUploadState('idle');
    setPreviewUrl(null);
    setPendingFile(null);
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
      />

      {/* Menu scrim */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="fab-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1800 }}
          />
        )}
      </AnimatePresence>

      {/* Action menu (mini sheet above FAB) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="fab-menu"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 148,
              right: 20,
              zIndex: 1810,
              background: BRAND.panel2,
              border: `1px solid ${BRAND.line2}`,
              borderRadius: 16,
              overflow: 'hidden',
              minWidth: 200,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <Box
              component="button"
              onClick={() => { setMenuOpen(false); setTimeout(() => cameraInputRef.current?.click(), 80); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                width: '100%', px: 2.5, py: 1.8, border: 'none',
                bgcolor: 'transparent', color: BRAND.text, cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, textAlign: 'left',
                '&:active': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <Camera size={20} />
              カメラで撮影
            </Box>
            <Box sx={{ height: '1px', bgcolor: BRAND.line, mx: 2 }} />
            <Box
              component="button"
              onClick={() => { setMenuOpen(false); setTimeout(() => libraryInputRef.current?.click(), 80); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                width: '100%', px: 2.5, py: 1.8, border: 'none',
                bgcolor: 'transparent', color: BRAND.text, cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, textAlign: 'left',
                '&:active': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <ImageIcon size={20} />
              ライブラリから選択
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview overlay */}
      <AnimatePresence>
        {(uploadState === 'preview' || uploadState === 'uploading' || uploadState === 'success') && previewUrl && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1950,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 24,
              padding: '0 24px',
            }}
          >
            {/* Close button */}
            {uploadState === 'preview' && (
              <IconButton
                onClick={handleDiscard}
                sx={{ position: 'absolute', top: 60, right: 16, color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}
              >
                <X size={20} />
              </IconButton>
            )}

            {/* Photo preview */}
            <Box
              component="img"
              src={previewUrl}
              sx={{
                maxWidth: '100%', maxHeight: '55vh',
                borderRadius: 3, objectFit: 'contain',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              }}
            />

            {uploadState === 'preview' && (
              <>
                <Typography sx={{ color: BRAND.sub, fontSize: '0.85rem' }}>
                  {getActiveProject()?.name ?? 'プロジェクト'} に保存します
                </Typography>
                <Box
                  component="button"
                  onClick={handleSave}
                  sx={{
                    bgcolor: '#3498db', color: '#fff',
                    border: 'none', borderRadius: 3,
                    px: 5, py: 1.8,
                    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                    '&:active': { bgcolor: '#2980b9' },
                  }}
                >
                  保存する
                </Box>
              </>
            )}

            {uploadState === 'uploading' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={32} sx={{ color: '#3498db' }} />
                <Typography sx={{ color: BRAND.sub, fontSize: '0.9rem' }}>アップロード中...</Typography>
              </Box>
            )}

            {uploadState === 'success' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                >
                  <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: 24 }}>✓</Typography>
                  </Box>
                </motion.div>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>保存しました</Typography>
                <Box
                  component="button"
                  onClick={() => { handleDiscard(); setAIChatOpen(true); }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', border: `1px solid ${BRAND.line2}`,
                    borderRadius: 3, px: 3, py: 1.2,
                    fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                    '&:active': { bgcolor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <MessageSquare size={16} />
                  AIに相談する
                </Box>
              </Box>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setMenuOpen(v => !v)}
        style={{
          position: 'fixed',
          bottom: 80,   // above BottomNavigation (56px) + margin
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: menuOpen ? '#2980b9' : '#3498db',
          border: 'none',
          boxShadow: '0 4px 20px rgba(52,152,219,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1820,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <motion.div
          animate={{ rotate: menuOpen ? 45 : 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <Camera size={24} color="#fff" />
        </motion.div>
      </motion.button>

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} onClose={() => setToast(null)} sx={{ fontSize: 13 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default MobileCameraFab;
