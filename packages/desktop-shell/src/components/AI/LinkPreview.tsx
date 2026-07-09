// SEKKEIYA Drive の Quick Look 用リンク（URL）プレビュー。
// 保存したブックマークを、OG画像＋タイトル＋URL のカードで表示し、「ブラウザで開く」で外部ブラウザへ。
// ※ 任意サイトの iframe 埋め込みは X-Frame-Options 等で失敗することが多いため、埋め込みはしない。
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';

export const LinkPreview: React.FC<{ url: string; title?: string; image?: string }> = ({ url, title, image }) => {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* noop */ }

  const openExternal = async () => {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch (e) {
      console.warn('[LinkPreview] open failed:', e);
      try { window.open(url, '_blank'); } catch { /* noop */ }
    }
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}
      sx={{ width: 'min(560px, 88vw)', bgcolor: 'var(--brand-surface)', borderRadius: 3, overflow: 'hidden',
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.55)' }}>
      {/* OG 画像（あれば） */}
      {image ? (
        <Box sx={{ width: '100%', aspectRatio: '1.9 / 1', bgcolor: '#0d1017', overflow: 'hidden' }}>
          <img src={image} alt={title || host} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
      ) : (
        <Box sx={{ width: '100%', aspectRatio: '2.6 / 1', bgcolor: 'light-dark(#e0f2f1, #10201e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LinkRoundedIcon sx={{ fontSize: 56, color: 'light-dark(#0d9488, #5eead4)' }} />
        </Box>
      )}
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`} alt="" width={16} height={16}
            style={{ borderRadius: 3, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <Typography noWrap sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{host}</Typography>
        </Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title || host}
        </Typography>
        <Typography noWrap sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{url}</Typography>
        <Button onClick={openExternal} variant="contained" startIcon={<OpenInNewRoundedIcon />}
          sx={{ mt: 1, alignSelf: 'flex-start', textTransform: 'none', bgcolor: '#00BFFF', color: '#03121b', fontWeight: 700, '&:hover': { bgcolor: '#33ccff' } }}>
          ブラウザで開く
        </Button>
      </Box>
    </Box>
  );
};

export default LinkPreview;
