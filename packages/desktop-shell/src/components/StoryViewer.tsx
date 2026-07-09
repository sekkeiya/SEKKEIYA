import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Box, Typography, Avatar, CircularProgress } from '@mui/material';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Heart, MessageCircle, ChevronLeft } from 'lucide-react';
import { BRAND } from '../styles/theme';
import { getFieldPhotos, toggleLike, type FieldPhoto } from '../features/projects/fieldPhotosApi';
import { useAuthStore } from '../store/useAuthStore';

const STORY_DURATION_MS = 5000;

interface Props {
  projectId: string | null;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

// ── Progress bar for one story segment ──
const StoryProgressBar: React.FC<{
  state: 'done' | 'active' | 'pending';
  paused: boolean;
  onComplete: () => void;
}> = ({ state, paused, onComplete }) => {
  return (
    <Box sx={{ flex: 1, height: 2.5, bgcolor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' }}>
      {state === 'done' && (
        <Box sx={{ width: '100%', height: '100%', bgcolor: '#fff' }} />
      )}
      {state === 'active' && (
        <motion.div
          key="active-bar"
          initial={{ width: '0%' }}
          animate={paused ? {} : { width: '100%' }}
          transition={{ duration: STORY_DURATION_MS / 1000, ease: 'linear' }}
          onAnimationComplete={onComplete}
          style={{ height: '100%', background: '#fff', borderRadius: 4 }}
        />
      )}
    </Box>
  );
};

const StoryViewer: React.FC<Props> = ({ projectId, projectName, open, onClose }) => {
  const { currentUser } = useAuthStore();
  const dragControls = useDragControls();

  const [photos, setPhotos] = useState<FieldPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Load photos when viewer opens
  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    setCurrentIndex(0);
    getFieldPhotos(projectId)
      .then(data => setPhotos(data))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => {
      if (i < photos.length - 1) return i + 1;
      // Last photo — close
      onClose();
      return i;
    });
  }, [photos.length, onClose]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i > 0 ? i - 1 : 0));
  }, []);

  // Long-press pause
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => setPaused(true), 150);
  };
  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setPaused(false);
  };

  const currentPhoto = photos[currentIndex] ?? null;
  const isLiked = !!(currentUser && currentPhoto?.likes.includes(currentUser.uid));

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !currentPhoto || !projectId) return;
    setPhotos(prev => prev.map((p, i) =>
      i !== currentIndex ? p : {
        ...p,
        likes: isLiked
          ? p.likes.filter(id => id !== currentUser.uid)
          : [...p.likes, currentUser.uid],
      }
    ));
    await toggleLike(projectId, currentPhoto.id, currentUser.uid, isLiked);
  };

  // Render into document.body via portal so position:fixed escapes any
  // ancestor overflow:hidden or CSS transform containment.
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="story-viewer"
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.4 }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100 || info.velocity.y > 400) onClose();
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2100,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {/* ── Top chrome: progress bars + user row + X ── */}
          <Box sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            zIndex: 20,
            pt: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            px: 1.5,
            pb: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)',
          }}>
            {/* Progress bars */}
            {!loading && photos.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                {photos.map((_, i) => (
                  <StoryProgressBar
                    key={`bar-${i}-${currentIndex}`}
                    state={i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending'}
                    paused={paused}
                    onComplete={i === currentIndex ? goNext : () => {}}
                  />
                ))}
              </Box>
            )}

            {/* User row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#3498db', fontSize: 14, fontWeight: 800, border: '2px solid rgba(255,255,255,0.5)', flexShrink: 0 }}>
                {projectName[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }} noWrap>
                  {projectName}
                </Typography>
              </Box>

              {/* ✕ close button — prominent, easy to tap */}
              <Box
                component="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose(); }}
                sx={{
                  width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', borderRadius: '50%',
                  bgcolor: 'rgba(0,0,0,0.4)',
                  color: '#fff',
                  cursor: 'pointer',
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background-color 0.15s',
                  '&:active': { bgcolor: 'rgba(0,0,0,0.7)', transform: 'scale(0.9)' },
                }}
              >
                <X size={22} />
              </Box>
            </Box>
          </Box>

          {/* ── Photo area ── */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {loading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: '#fff' }} size={36} />
              </Box>
            )}

            {!loading && photos.length === 0 && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: 48 }}>📷</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>
                  現場フォトがまだありません
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                  カメラで撮影して追加しましょう
                </Typography>
              </Box>
            )}

            {!loading && currentPhoto && (
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentPhoto.id}
                  src={currentPhoto.storageUrl}
                  initial={{ opacity: 0.6, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.6, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  alt={currentPhoto.caption}
                />
              </AnimatePresence>
            )}

            {/* Tap zones — prev (left 35%) / next (right 65%) */}
            {!loading && photos.length > 0 && (
              <>
                <Box
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); goPrev(); }}
                  sx={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%',
                    zIndex: 10, display: 'flex', alignItems: 'center', pl: 1, opacity: 0,
                    '&:active': { opacity: 1 },
                  }}
                >
                  <ChevronLeft size={28} color="#fff" />
                </Box>
                <Box
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); goNext(); }}
                  sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '65%', zIndex: 10 }}
                />
              </>
            )}
          </Box>

          {/* ── Bottom: caption + actions ── */}
          {currentPhoto && (
            <Box sx={{
              px: 2, pt: 2,
              pb: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
              zIndex: 15,
            }}>
              {currentPhoto.caption && (
                <Typography sx={{ color: '#fff', fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>
                  {currentPhoto.caption}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
                <Box
                  component="button"
                  onClick={handleLike}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    border: 'none', bgcolor: 'transparent',
                    color: isLiked ? '#ef4444' : '#fff',
                    cursor: 'pointer', p: 0,
                    transition: 'color 0.15s, transform 0.1s',
                    '&:active': { transform: 'scale(0.85)' },
                  }}
                >
                  <Heart size={24} fill={isLiked ? '#ef4444' : 'none'} />
                  {currentPhoto.likes.length > 0 && (
                    <Typography sx={{ color: 'inherit', fontSize: 13, fontWeight: 700 }}>
                      {currentPhoto.likes.length}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'rgba(255,255,255,0.85)' }}>
                  <MessageCircle size={24} />
                  {currentPhoto.comments.length > 0 && (
                    <Typography sx={{ fontSize: 13 }}>{currentPhoto.comments.length}</Typography>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default StoryViewer;
