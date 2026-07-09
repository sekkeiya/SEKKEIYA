// SEKKEIYA Drive の Quick Look 用 HTML プレビュー。
// Storage 上の .html を取得し、サンドボックス iframe（srcdoc）で描画する。
// ★セキュリティ: allow-scripts は付けるが allow-same-origin は付けない。
//   → ページ内スクリプトは動くが「null オリジン」扱いになり、アプリ本体の Cookie/Storage/
//     Firebase 認証等には一切アクセスできない。自己完結型 HTML（インライン CSS/JS）向け。
import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';

export const HtmlPreview: React.FC<{ url: string; name?: string }> = ({ url }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    setHtml(null); setErr(false);
    (async () => {
      try {
        const res = await fetch(url);
        const text = await res.text();
        if (active) setHtml(text);
      } catch (e) {
        console.warn('[HtmlPreview] failed:', e);
        if (active) setErr(true);
      }
    })();
    return () => { active = false; };
  }, [url]);

  if (err) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} onClick={(e) => e.stopPropagation()}>
        <LanguageRoundedIcon sx={{ fontSize: 56, color: 'light-dark(#0d9488, #5eead4)' }} />
        <Typography sx={{ fontSize: 14 }}>HTML を読み込めませんでした</Typography>
      </Box>
    );
  }

  if (html == null) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
        <CircularProgress size={28} sx={{ color: '#00BFFF' }} />
        <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>HTML を読み込み中…</Typography>
      </Box>
    );
  }

  return (
    <Box onClick={(e) => e.stopPropagation()}
      sx={{ width: 'min(1100px, 82vw)', height: '80vh', bgcolor: '#fff', borderRadius: 2, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
      <iframe
        title="html-preview"
        srcDoc={html}
        sandbox="allow-scripts allow-popups allow-forms allow-modals"
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      />
    </Box>
  );
};

export default HtmlPreview;
