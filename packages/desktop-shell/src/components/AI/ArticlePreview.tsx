// SEKKEIYA Drive の Quick Look 用 記事プレビュー（S.Blog 公開記事）。
// Drive 資産の id は blog_{articleId} なので articleId を復元し、正本
// users/{ownerUid}/blogArticles/{articleId} から本文(bodyMarkdown)を取得してスクロール表示する。
// 読み終えて外部で見たい/共有したいときは「ブラウザで開く」で公開ページへ。
import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';

type Loaded = { title: string; coverUrl?: string | null; body: string };

export const ArticlePreview: React.FC<{
  articleId: string; ownerUid?: string; coverUrl?: string; publicUrl?: string; title?: string;
}> = ({ articleId, ownerUid, coverUrl, publicUrl, title }) => {
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null); setErr(false);
    (async () => {
      if (!ownerUid || !articleId) { setErr(true); return; }
      try {
        const snap = await getDoc(doc(db, 'users', ownerUid, 'blogArticles', articleId));
        if (!active) return;
        if (!snap.exists()) { setErr(true); return; }
        const a = snap.data() as any;
        setData({ title: a.title || title || '無題の記事', coverUrl: a.coverUrl ?? coverUrl, body: a.bodyMarkdown || '' });
      } catch (e) {
        console.warn('[ArticlePreview] load failed:', e);
        if (active) setErr(true);
      }
    })();
    return () => { active = false; };
  }, [articleId, ownerUid, coverUrl, title]);

  const openExternal = async () => {
    if (!publicUrl) return;
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(publicUrl);
    } catch { try { window.open(publicUrl, '_blank'); } catch { /* noop */ } }
  };

  if (err) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} onClick={(e) => e.stopPropagation()}>
        <ArticleRoundedIcon sx={{ fontSize: 56, color: 'light-dark(#b45309, #fcd34d)' }} />
        <Typography sx={{ fontSize: 14 }}>記事の本文を読み込めませんでした</Typography>
        {publicUrl && (
          <Button onClick={openExternal} variant="contained" startIcon={<OpenInNewRoundedIcon />}
            sx={{ mt: 1, textTransform: 'none', bgcolor: '#00BFFF', color: '#03121b', fontWeight: 700 }}>ブラウザで開く</Button>
        )}
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
        <CircularProgress size={28} sx={{ color: '#00BFFF' }} />
        <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>記事を読み込み中…</Typography>
      </Box>
    );
  }

  return (
    <Box onClick={(e) => e.stopPropagation()}
      sx={{ width: 'min(820px, 88vw)', height: '84vh', bgcolor: '#fff', color: '#1a1a1a', borderRadius: 2, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.55)' }}>
      {/* 本文（スクロール） */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto',
        '&::-webkit-scrollbar': { width: 10 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 5 } }}>
        {data.coverUrl && (
          <Box sx={{ width: '100%', aspectRatio: '2 / 1', overflow: 'hidden', bgcolor: '#0d1017' }}>
            <img src={data.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        )}
        <Box sx={{
          maxWidth: 720, mx: 'auto', px: { xs: 3, sm: 5 }, py: 4, fontSize: 16, lineHeight: 1.9, color: '#242424',
          '& h1': { fontSize: 28, fontWeight: 800, lineHeight: 1.4, mt: 3, mb: 2 },
          '& h2': { fontSize: 22, fontWeight: 700, lineHeight: 1.4, mt: 3.5, mb: 1.5, borderBottom: '1px solid #eee', pb: 0.5 },
          '& h3': { fontSize: 18, fontWeight: 700, mt: 3, mb: 1 },
          '& p': { my: 1.5 },
          '& a': { color: '#0774a7', textDecoration: 'underline' },
          '& ul, & ol': { pl: 3, my: 1.5 },
          '& li': { my: 0.5 },
          '& img': { maxWidth: '100%', height: 'auto', borderRadius: 8, my: 2 },
          '& blockquote': { borderLeft: '4px solid #ddd', pl: 2, ml: 0, color: '#555', fontStyle: 'italic' },
          '& code': { bgcolor: '#f2f2f2', px: 0.75, py: 0.25, borderRadius: 1, fontSize: 14 },
          '& pre': { bgcolor: '#f6f8fa', p: 2, borderRadius: 2, overflowX: 'auto', '& code': { bgcolor: 'transparent', p: 0 } },
          '& hr': { border: 'none', borderTop: '1px solid #eee', my: 3 },
          '& table': { borderCollapse: 'collapse', width: '100%', my: 2 },
          '& th, & td': { border: '1px solid #e5e5e5', px: 1.25, py: 0.75, textAlign: 'left' },
        }}>
          <Typography component="h1" sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.35, mb: 3 }}>{data.title}</Typography>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.body || '_（本文がありません）_'}</ReactMarkdown>
        </Box>
      </Box>

      {/* フッター: 公開ページを開く */}
      {publicUrl && (
        <Box sx={{ flexShrink: 0, borderTop: '1px solid #eee', px: 3, py: 1.5, display: 'flex', justifyContent: 'flex-end', bgcolor: '#fafafa' }}>
          <Button onClick={openExternal} startIcon={<OpenInNewRoundedIcon />}
            sx={{ textTransform: 'none', color: '#0774a7', fontWeight: 700 }}>公開ページをブラウザで開く</Button>
        </Box>
      )}
    </Box>
  );
};

export default ArticlePreview;
