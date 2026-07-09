/**
 * BlogArticleBySlugPage — ブランドURL /:handle/blog/:slug で公開ブログ記事を表示する。
 * 例: https://sekkeiya.com/sekkeiya/blog/rosso-listening-bar-red-space-design
 *
 * handle（@あり/なし両対応）→ uid を usernames から解決し、CommunityArticlePage に委譲して
 * 記事本文を描画する。canonical はこのブランドURLに設定する。
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Container, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { resolveUidByHandle } from '@/shared/api/users/read';
import CommunityArticlePage from '@/pages/CommunityArticlePage';
import { SITE_URL } from '@/config/seoConfig';

const stripAt = (h) => String(h || '').replace(/^@/, '');

export default function BlogArticleBySlugPage() {
  const { handle, slug } = useParams();
  const navigate = useNavigate();
  const [uid, setUid] = useState(undefined); // undefined=解決中 / null=該当ユーザーなし / string=uid

  useEffect(() => {
    let active = true;
    setUid(undefined);
    resolveUidByHandle(stripAt(handle))
      .then((u) => { if (active) setUid(u); })
      .catch(() => { if (active) setUid(null); });
    return () => { active = false; };
  }, [handle]);

  if (uid === undefined) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} sx={{ color: '#e57373' }} />
      </Box>
    );
  }

  if (uid === null) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: '#fff' }}>404 - Article Not Found</Typography>
          <Typography variant="body1" sx={{ mb: 4, color: 'rgba(255,255,255,0.6)' }}>お探しの記事は見つかりませんでした。</Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#fff' } }}>
            トップへ
          </Button>
        </Container>
      </Box>
    );
  }

  const canonical = `${SITE_URL}/${stripAt(handle)}/blog/${slug}`;
  return (
    <CommunityArticlePage
      uid={uid}
      slug={slug}
      canonicalUrl={canonical}
      backTo={`/@${stripAt(handle)}`}
      backLabel="サイトへ戻る"
    />
  );
}
