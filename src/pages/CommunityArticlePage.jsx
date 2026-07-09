/**
 * CommunityArticlePage — S.Blog で公開されたユーザー記事の公開ページ。
 * URL: /articles/u/:uid/:slug（sitemap 登録・SEOメタ付き = Google にインデックスされる）
 * 正本: users/{uid}/blogArticles（published は誰でも read 可）。
 *
 * props（省略時は URL パラメータ・既定を使う）:
 *   uid / slug     … 記事の所有者・スラッグ（ブランドURL /:handle/blog/:slug から呼ぶとき渡す）
 *   canonicalUrl   … SEO canonical。省略時は /articles/u/:uid/:slug
 *   backTo / backLabel … 戻るボタンの遷移先・ラベル
 */
import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, CircularProgress, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/shared/config/firebase';
import ReactMarkdown from 'react-markdown';
import { SEO } from '@/shared/components/seo/SEO';
import { SchemaTypes } from '@/shared/components/seo/SchemaTypes';
import { SITE_URL } from '@/config/seoConfig';

const fmtDate = (v) => {
  try {
    const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString('ja-JP') : '';
  } catch { return ''; }
};

export default function CommunityArticlePage({ uid: uidProp, slug: slugProp, canonicalUrl, backTo, backLabel } = {}) {
  const params = useParams();
  const uid = uidProp ?? params.uid;
  const slug = slugProp ?? params.slug;
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    (async () => {
      try {
        const q = query(
          collection(db, 'users', uid, 'blogArticles'),
          where('slug', '==', slug),
          where('status', '==', 'published'),
          limit(1),
        );
        const snap = await getDocs(q);
        setArticle(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      } catch (e) {
        console.error('[CommunityArticle] fetch failed', e);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, slug]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} sx={{ color: '#e57373' }} />
      </Box>
    );
  }

  if (!article) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: '#fff' }}>404 - Article Not Found</Typography>
          <Typography variant="body1" sx={{ mb: 4, color: 'rgba(255,255,255,0.6)' }}>お探しの記事は見つかりませんでした。</Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo || '/articles')}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#fff' } }}>
            {backLabel || '記事一覧へ'}
          </Button>
        </Container>
      </Box>
    );
  }

  const url = canonicalUrl || `${SITE_URL}/articles/u/${uid}/${article.slug}`;
  const jsonLd = SchemaTypes.getArticle(
    article.title, article.excerpt || '', url, article.coverUrl || '',
    article.publishedAt || undefined, article.authorName || undefined,
  );

  return (
    <Box sx={{ bgcolor: '#0a0a0a', minHeight: '100vh', pb: 16 }}>
      <SEO
        title={`${article.title} | SEKKEIYA Articles`}
        description={article.excerpt || `${article.title}について`}
        canonical={url}
        ogImage={article.coverUrl || undefined}
        ogType="article"
      >
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </SEO>

      <Container maxWidth="md" sx={{ pt: { xs: 14, md: 18 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo || '/articles?source=community')}
          sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, textTransform: 'none', '&:hover': { color: '#fff', background: 'transparent' } }}>
          {backLabel || 'みんなの記事へ戻る'}
        </Button>

        {/* メタ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <Chip label="みんなの記事" size="small"
            sx={{ bgcolor: 'rgba(229,115,115,0.15)', color: '#e57373', border: '1px solid rgba(229,115,115,0.35)', fontWeight: 700 }} />
          {article.category && (
            <Chip label={article.category} size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }} />
          )}
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDate(article.publishedAt)}</Typography>
        </Box>

        <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.8rem' }, lineHeight: 1.3, color: '#fff', mb: 2.5 }}>
          {article.title}
        </Typography>

        {article.authorName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 4 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'rgba(229,115,115,0.2)', border: '1px solid rgba(229,115,115,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e57373', fontSize: '0.85rem', fontWeight: 800 }}>
              {article.authorName.charAt(0).toUpperCase()}
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>{article.authorName}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>— S.Blog で執筆</Typography>
          </Box>
        )}

        {/* 🎧 音声版（著者がAI音声で生成したPodcast） */}
        {article.audioUrl && (
          <Box sx={{ mb: 4, p: 2, borderRadius: 2.5, bgcolor: 'rgba(229,115,115,0.06)', border: '1px solid rgba(229,115,115,0.25)' }}>
            <Typography variant="caption" sx={{ color: '#e57373', fontWeight: 700, display: 'block', mb: 1 }}>
              🎧 この記事を聴く{article.audioDurationSec ? `（約${Math.ceil(article.audioDurationSec / 60)}分）` : ''}
            </Typography>
            <Box component="audio" controls preload="none" src={article.audioUrl} sx={{ width: '100%', height: 40 }} />
          </Box>
        )}

        {article.coverUrl && (
          <Box component="img" src={article.coverUrl} alt={article.title}
            sx={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 3, mb: 5, border: '1px solid rgba(255,255,255,0.08)' }} />
        )}

        {/* 本文（Markdown） */}
        <Box sx={{
          color: 'rgba(255,255,255,0.85)', fontSize: '1.02rem', lineHeight: 1.9,
          '& h1, & h2, & h3, & h4': { fontWeight: 800, color: '#fff', mt: 6, mb: 2, letterSpacing: '-0.01em' },
          '& h2': { fontSize: '1.7rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 1.5 },
          '& h3': { fontSize: '1.3rem' },
          '& p': { mb: 2.5 },
          '& ul, & ol': { mb: 2.5, pl: 3 }, '& li': { mb: 0.75 },
          '& a': { color: '#e57373', textDecoration: 'none', borderBottom: '1px solid rgba(229,115,115,0.35)', '&:hover': { color: '#fff', borderBottomColor: '#fff' } },
          '& img': { maxWidth: '100%', height: 'auto', borderRadius: 2.5, my: 3, display: 'block' },
          '& blockquote': { borderLeft: '3px solid rgba(229,115,115,0.5)', pl: 2.5, ml: 0, my: 3, color: 'rgba(255,255,255,0.65)' },
          '& hr': { borderColor: 'rgba(255,255,255,0.1)', my: 5 },
          '& table': { borderCollapse: 'collapse', my: 3, width: '100%' },
          '& th, & td': { border: '1px solid rgba(255,255,255,0.12)', px: 1.5, py: 1, textAlign: 'left' },
          '& code': { bgcolor: 'rgba(255,255,255,0.1)', px: 0.75, py: 0.25, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.9em' },
        }}>
          <ReactMarkdown>{article.bodyMarkdown || ''}</ReactMarkdown>
        </Box>

        {article.tags?.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 6 }}>
            {article.tags.map((t, i) => (
              <Chip key={i} label={`#${t}`} size="small"
                sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }} />
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}
