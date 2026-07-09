import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useLightboxStore } from '../store/useLightboxStore';

// 共有の画像ライトボックス。useLightboxStore で開閉。
// クリックで拡大、←→ で前後、Esc/背景クリックで閉じる。アプリ内で1つだけマウントする。
export const ImageLightbox: React.FC = () => {
  const { open, images, index, close, next, prev } = useLightboxStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, prev]);

  if (!open || !images.length) return null;
  const img = images[index];
  const multi = images.length > 1;

  // document.body へ Portal する。チャットパネルが切り離し（transform 配置）でも
  // position:fixed が画面全体を覆い、中央ダイアログ＋余白クリックで閉じられる。
  return createPortal(
    <Box
      onClick={close}
      sx={{
        position: 'fixed', inset: 0, zIndex: 20000,
        bgcolor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* 閉じる */}
      <IconButton
        onClick={(e) => { e.stopPropagation(); close(); }}
        sx={{ position: 'absolute', top: 16, right: 16, color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
      >
        <CloseRoundedIcon />
      </IconButton>

      {/* 前へ */}
      {multi && (
        <IconButton
          onClick={(e) => { e.stopPropagation(); prev(); }}
          sx={{ position: 'absolute', left: 16, color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 32 }} />
        </IconButton>
      )}

      {/* 画像 */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
      >
        <Box
          component="img"
          src={img.url}
          sx={{ maxWidth: '90vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 1, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {img.caption && (
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{img.caption}</Typography>
          )}
          {multi && (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{index + 1} / {images.length}</Typography>
          )}
        </Box>
      </Box>

      {/* 次へ */}
      {multi && (
        <IconButton
          onClick={(e) => { e.stopPropagation(); next(); }}
          sx={{ position: 'absolute', right: 16, color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
        >
          <ChevronRightRoundedIcon sx={{ fontSize: 32 }} />
        </IconButton>
      )}
    </Box>,
    document.body,
  );
};
