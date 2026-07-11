import React, { useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, Typography, Chip, Tooltip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PreviewGalleryStrip from '../../components/AI/PreviewGalleryStrip';

const ACCENT = '#ec407a';

interface DsiLightboxProps {
  /** ナビゲーション対象の画像/動画（表示順）。 */
  images: any[];
  /** 現在表示中のアイテム ID（null で非表示）。 */
  currentId: string | null;
  onClose: () => void;
  /** 別アイテムへ切替（前後ナビゲーション）。 */
  onChange: (id: string) => void;
}

/**
 * S.Image の拡大ギャラリー（ライトボックス）。
 * カードのダブルクリックで開き、← → キーまたは左右ボタンで前後の画像/動画に切り替える。
 */
export const DsiLightbox: React.FC<DsiLightboxProps> = ({ images, currentId, onClose, onChange }) => {
  const index = useMemo(() => images.findIndex((i) => i.id === currentId), [images, currentId]);
  const item = index >= 0 ? images[index] : null;

  const goPrev = useCallback(() => {
    if (index > 0) onChange(images[index - 1].id);
  }, [index, images, onChange]);
  const goNext = useCallback(() => {
    if (index >= 0 && index < images.length - 1) onChange(images[index + 1].id);
  }, [index, images, onChange]);

  // キーボード操作（← → / Esc）。
  useEffect(() => {
    if (!currentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentId, goPrev, goNext, onClose]);

  if (!currentId || !item) return null;

  const isVideo = item.mediaType === 'video';
  const url = item.downloadUrl || item.thumbnailUrl;
  const title = item.title || item.name || '無題';
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < images.length - 1;

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed', inset: 0, zIndex: 1400,
        bgcolor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
        animation: 'dsiLbFade 0.12s ease',
        '@keyframes dsiLbFade': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      {/* ヘッダー */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, flexShrink: 0 }}
      >
        <Typography sx={{ color: '#fff', fontSize: 15, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        {item.category && (
          <Chip size="small" label={item.category} sx={{ height: 20, fontSize: 10.5, color: '#fff', bgcolor: `${ACCENT}33`, border: `1px solid ${ACCENT}55` }} />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5 }}>
          {index + 1} / {images.length}
        </Typography>
        {url && (
          <>
            <Tooltip title="新しいタブで開く">
              <IconButton size="small" onClick={() => window.open(url, '_blank')} sx={{ color: 'rgba(255,255,255,0.75)' }}>
                <OpenInNewRoundedIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="ダウンロード">
              <IconButton size="small" component="a" href={url} download target="_blank" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                <DownloadRoundedIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title="閉じる (Esc)">
          <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>
            <CloseRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 本体 */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', px: { xs: 6, md: 9 }, pb: 3 }}>
        {/* 前へ */}
        <IconButton
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={!hasPrev}
          sx={{
            position: 'absolute', left: 12, zIndex: 2,
            color: '#fff', bgcolor: 'rgba(255,255,255,0.08)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' },
          }}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 34 }} />
        </IconButton>

        {/* メディア（クリックはバブリングさせない＝閉じない） */}
        <Box onClick={(e) => e.stopPropagation()} sx={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {url ? (
            isVideo ? (
              <Box component="video" key={item.id} src={url} controls autoPlay sx={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 1.5, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
            ) : (
              <Box component="img" key={item.id} src={url} alt={title} sx={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 1.5, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
            )
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>表示できるデータがありません</Typography>
          )}
        </Box>

        {/* 次へ */}
        <IconButton
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={!hasNext}
          sx={{
            position: 'absolute', right: 12, zIndex: 2,
            color: '#fff', bgcolor: 'rgba(255,255,255,0.08)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' },
          }}
        >
          <ChevronRightRoundedIcon sx={{ fontSize: 34 }} />
        </IconButton>
      </Box>

      {/* 下部ギャラリー（SEKKEIYA Reader と同じ UX で前後移動・ドラッグ/クリック/←→） */}
      {images.length > 1 && (
        <PreviewGalleryStrip
          items={images.map((im) => ({ id: im.id, image: im.thumbnailUrl || im.downloadUrl, title: im.title || im.name, subtitle: im.category }))}
          activeIndex={index}
          onSelect={(i) => onChange(images[i].id)}
          accent={ACCENT}
        />
      )}
    </Box>
  );
};
