import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Box, Typography, CircularProgress } from '@mui/material';
import { getPublishedAccount, getPublishedProject } from '@/features/published-site/publishedSiteApi';
import { normalizeSite } from '@/features/published-site/siteMeta';
import { resolveEditorialTheme } from '@/features/published-site/editorialThemes';
import { resolveMotionConfig } from '@/features/published-site/designTokens';
import { PublishedSection } from '@/features/published-site/PublishedSection';
import { PublishedSidebar } from '@/features/published-site/PublishedSidebar';
import { ViewModeSwitcher } from '@/features/published-site/ViewModeSwitcher';
import { BookView } from '@/features/published-site/BookView';
import { VideoView } from '@/features/published-site/VideoView';
import { deriveSlides } from '@/features/published-site/siteSlides';

// 公開サイトのページ。/@username（アカウント）と /@username/{projectSlug}（プロジェクト）。
// kind で取得元を切り替え、焼き込み済みスナップショットを本サイトレンダラで描画する。

const stripAt = (h) => (h || '').replace(/^@/, '');

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export default function PublishedSitePage({ kind }) {
  const params = useParams();
  const username = stripAt(params.handle);
  const projectSlug = params.projectSlug;

  const [state, setState] = useState({ status: 'loading', doc: null });
  const [viewMode, setViewMode] = useState('scroll'); // 'scroll' | 'book' | 'video'

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', doc: null });
    setViewMode('scroll');           // サイト遷移時は既定表示へ戻す
    window.scrollTo(0, 0);           // 上端から（SPA 遷移で位置リセット）
    (async () => {
      try {
        const data = kind === 'project'
          ? await getPublishedProject(username, projectSlug)
          : await getPublishedAccount(username);
        if (!active) return;
        if (data && data.site) {
          // プロジェクトサイト時は、上部リンク用にアカウントサイト名（hero title）を取得。
          let accountName = null;
          if (kind === 'project') {
            try {
              const acc = await getPublishedAccount(username);
              const heroT = (acc?.site?.pages || []).flatMap(p => p.sections || []).find(s => s.type === 'hero')?.title;
              accountName = (heroT && heroT.trim()) || `@${username}`;
            } catch { accountName = `@${username}`; }
            if (!active) return;
          }
          setState({ status: 'ok', doc: data, accountName });
        } else {
          setState({ status: 'notfound', doc: null });
        }
      } catch (e) {
        if (active) setState({ status: 'notfound', doc: null });
      }
    })();
    return () => { active = false; };
  }, [kind, username, projectSlug]);

  if (state.status === 'loading') {
    // 黒い全画面フラッシュ（リロードに見える原因）を避け、中立的な明るい地で。
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f4f3f0' }}>
        <CircularProgress size={26} sx={{ color: '#b0aaa0' }} />
      </Box>
    );
  }

  if (state.status === 'notfound') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: '#0b0b0c', color: '#f3efe8', px: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 700 }}>サイトが見つかりません</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem' }}>
          このページは存在しないか、まだ公開されていません。
        </Typography>
        <Box component={Link} to="/" sx={{ mt: 1, color: '#7fd1ff', textDecoration: 'none', fontSize: '0.9rem' }}>← SEKKEIYA トップへ</Box>
      </Box>
    );
  }

  const data = state.doc;
  const site = normalizeSite(data.site);
  const theme = resolveEditorialTheme(site.theme?.personality, site.theme?.accent);
  const motion = resolveMotionConfig(theme.motion, site.theme?.motionOverride, { preview: true, reduced: reducedMotion() });

  // hero の見出しフォールバック名。
  const projectName = kind === 'project' ? (projectSlug || username) : username;
  // ページタイトル（hero の title を優先）。
  const heroTitle = site.pages?.[0]?.sections?.find(s => s.type === 'hero')?.title;
  const pageTitle = `${heroTitle || projectName} — SEKKEIYA`;

  // 全ページのセクションを縦に連結して描画。
  const sections = (site.pages || []).flatMap(p => p.sections || []);
  const tocSections = sections.filter(s => !s.hidden);
  // サイドバー目次（ページごとにネスト）。空ページは除外。
  const tocPages = (site.pages || [])
    .map(p => ({ id: p.id, title: p.title, sections: (p.sections || []).filter(s => !s.hidden) }))
    .filter(p => p.sections.length > 0);
  // ブック / 動画ビュー用のスライド。
  const slides = deriveSlides(tocSections, heroTitle || projectName);

  // 公開済みプロジェクトサイト（works セクションに焼き込んだ resolvedWorks から、
  // publishedSlug を持つもの＝公開済みのみ）。サイドバーにリンク表示する。
  const seenPj = new Set();
  const publishedProjects = [];
  for (const s of sections) {
    for (const w of (s.resolvedWorks || [])) {
      if (w.publishedSlug && !seenPj.has(w.id)) {
        seenPj.add(w.id);
        publishedProjects.push({ id: w.id, name: w.name, publishedSlug: w.publishedSlug });
      }
    }
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      sx={{ bgcolor: theme.bg, color: theme.text, minHeight: '100vh' }}
    >
      <Helmet>
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} />
        <meta property="og:type" content="website" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Inter:wght@400;500;600;700;800&family=Shippori+Mincho:wght@400;500;600;700;800&display=swap" />
      </Helmet>

      {/* 表示方法の切替（スクロール / ブック / 動画） */}
      {slides.length > 0 && <ViewModeSwitcher mode={viewMode} onChange={setViewMode} accent={theme.accent} />}

      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* 左サイドバー（目次＋スクロールスパイ。md 以上で表示） */}
        <PublishedSidebar
          theme={theme}
          siteTitle={heroTitle || projectName}
          pages={tocPages}
          projects={publishedProjects}
          accountLink={kind === 'project' ? { label: state.accountName || `@${username}`, href: `/@${username}` } : undefined}
        />

        {/* 本体 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {sections.map(section => (
            <PublishedSection
              key={section.id}
              section={section}
              theme={theme}
              projectName={projectName}
              motion={motion}
            />
          ))}
          {/* フッタ */}
          <Box sx={{ borderTop: `1px solid ${theme.border}`, py: 4, textAlign: 'center' }}>
            <Box component={Link} to="/" sx={{ textDecoration: 'none', color: theme.subtext, fontFamily: theme.kickerFamily, fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Built with SEKKEIYA
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ブック / 動画ビュー（全画面オーバーレイ） */}
      {viewMode === 'book' && <BookView slides={slides} theme={theme} onClose={() => setViewMode('scroll')} />}
      {viewMode === 'video' && <VideoView slides={slides} theme={theme} onClose={() => setViewMode('scroll')} />}
    </Box>
  );
}
