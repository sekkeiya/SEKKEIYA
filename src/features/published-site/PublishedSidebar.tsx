import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Drawer } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import { Link } from 'react-router-dom';
import type { EditorialTheme } from './editorialThemes';
import type { SiteSection } from './siteTypes';
import { SECTION_META } from './siteMeta';

// 公開サイトの左サイドバー（目次）。デスクトップ SiteNavSidebar の preview 相当。
// 複数ページのサイトはページごとにネスト（ページ見出し → 配下にセクション目次）。
// スクロールスパイ、公開済みプロジェクトへのリンク群、スマホはハンバーガー → Drawer。
// ※ MY/TEAM PROJECTS（未公開含む）等のアプリ内ナビは公開サイトには出さない。

const sectionLabel = (s: SiteSection): string =>
  s.type === 'hero' ? 'トップ' : (s.title && s.title.trim()) || SECTION_META[s.type].label;

export interface SidebarProject { id: string; name: string; publishedSlug: string; }
export interface TocPage { id: string; title: string; sections: SiteSection[] }

interface Props {
  theme: EditorialTheme;
  siteTitle: string;
  pages: TocPage[];             // ページごとのセクション（hidden 除外済み想定）
  projects?: SidebarProject[];  // 公開済みプロジェクトサイト（アカウントサイトのみ）
  accountLink?: { label: string; href: string }; // プロジェクトサイト時：上部にアカウントサイトへのリンク
}

export const PublishedSidebar: React.FC<Props> = ({ theme, siteTitle, pages, projects = [], accountLink }) => {
  const allSections = useMemo(() => pages.flatMap(p => p.sections), [pages]);
  const nested = pages.length > 1; // 複数ページ時のみページ見出しでネスト
  const [activeId, setActiveId] = useState<string | null>(allSections[0]?.id ?? null);
  const [open, setOpen] = useState(false);

  // スクロールスパイ：ビューポート中央付近にあるセクションをアクティブに。
  useEffect(() => {
    const els = allSections
      .map(s => document.getElementById(`sec-${s.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id.replace(/^sec-/, ''));
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [allSections]);

  const scrollTo = (id?: string) => {
    if (!id) return;
    const el = document.getElementById(`sec-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };

  // セクション目次の 1 行。
  const TocItem = ({ s }: { s: SiteSection }) => {
    const current = activeId === s.id;
    return (
      <Box
        onClick={() => scrollTo(s.id)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.4, px: 0.75, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: `${theme.text}08` } }}
      >
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, bgcolor: current ? theme.accent : 'transparent', boxShadow: current ? `0 0 0 3px ${theme.accent}22` : 'none', transition: 'background 0.2s, box-shadow 0.2s' }} />
        <Typography noWrap sx={{ fontFamily: theme.bodyFamily, fontSize: '0.74rem', color: current ? theme.accent : theme.subtext, fontWeight: current ? 700 : 400, transition: 'color 0.2s' }}>
          {sectionLabel(s)}
        </Typography>
      </Box>
    );
  };

  // サイドバー / Drawer 共通の中身。
  const NavContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', py: 2.5 }}>
      {/* サイト名 */}
      <Box sx={{ px: 2.5, mb: 2 }}>
        {accountLink ? (
          <Box
            component={Link}
            to={accountLink.href}
            onClick={() => setOpen(false)}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 0.7, ml: -0.75, px: 0.75, py: 0.35,
              borderRadius: 1.5, textDecoration: 'none', maxWidth: 'calc(100% + 6px)',
              border: `1px solid ${theme.border}`, transition: 'background 0.15s, border-color 0.15s',
              '&:hover': { bgcolor: `${theme.accent}14`, borderColor: `${theme.accent}55`, '& .acct': { color: theme.accent } },
            }}
          >
            <ChevronLeftRoundedIcon className="acct" sx={{ fontSize: '0.95rem', color: theme.subtext, transition: 'color 0.15s', flexShrink: 0 }} />
            <HomeRoundedIcon className="acct" sx={{ fontSize: '0.8rem', color: theme.subtext, transition: 'color 0.15s', flexShrink: 0 }} />
            <Typography className="acct" noWrap sx={{ fontFamily: theme.kickerFamily, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.subtext, transition: 'color 0.15s' }}>
              {accountLink.label}
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: theme.kickerUppercase ? 'uppercase' : 'none', color: theme.subtext, mb: 0.5 }}>
            {theme.label}
          </Typography>
        )}
        <Typography noWrap sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: '1.05rem', color: theme.text, letterSpacing: theme.headingLetterSpacing }}>
          {siteTitle}
        </Typography>
      </Box>

      {/* 目次（複数ページはページごとにネスト） */}
      <Box sx={{ px: 1.25 }}>
        {nested ? (
          pages.map(page => {
            const pageActive = page.sections.some(s => s.id === activeId);
            return (
              <Box key={page.id} sx={{ mb: 0.5 }}>
                {/* ページ見出し */}
                <Box
                  onClick={() => scrollTo(page.sections[0]?.id)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: pageActive ? `${theme.accent}1a` : 'transparent', '&:hover': { bgcolor: pageActive ? `${theme.accent}26` : `${theme.text}0a` } }}
                >
                  <Box sx={{ width: 3, height: 15, borderRadius: 2, bgcolor: pageActive ? theme.accent : 'transparent', flexShrink: 0 }} />
                  <Typography noWrap sx={{ fontFamily: theme.headingFamily, fontSize: '0.85rem', fontWeight: pageActive ? 800 : 600, color: pageActive ? theme.text : theme.subtext }}>
                    {page.title}
                  </Typography>
                </Box>
                {/* 配下のセクション目次 */}
                <Box sx={{ ml: 2.5, mt: 0.25, mb: 0.5, borderLeft: `1px solid ${theme.border}`, pl: 0.5 }}>
                  {page.sections.map(s => <TocItem key={s.id} s={s} />)}
                </Box>
              </Box>
            );
          })
        ) : (
          <Box sx={{ ml: 1.25, borderLeft: `1px solid ${theme.border}`, pl: 0.5 }}>
            {(pages[0]?.sections ?? []).map(s => <TocItem key={s.id} s={s} />)}
          </Box>
        )}
      </Box>

      {/* 公開済みプロジェクトサイト */}
      {projects.length > 0 && (
        <Box sx={{ px: 1.25, mt: 2 }}>
          <Typography sx={{ px: 1.25, mb: 0.75, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.subtext }}>
            Projects
          </Typography>
          {projects.map(p => (
            <Box
              key={p.id}
              component={Link}
              to={`/${p.publishedSlug}`}
              onClick={() => setOpen(false)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1, px: 1.25, py: 0.5, borderRadius: 1, cursor: 'pointer', textDecoration: 'none', '&:hover': { bgcolor: `${theme.text}08`, '& .pj-name': { color: theme.accent }, '& .pj-arrow': { opacity: 1 } } }}
            >
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: theme.subtext, flexShrink: 0 }} />
              <Typography className="pj-name" noWrap sx={{ flex: 1, fontFamily: theme.bodyFamily, fontSize: '0.78rem', color: theme.subtext, transition: 'color 0.15s' }}>{p.name}</Typography>
              <ArrowOutwardRoundedIcon className="pj-arrow" sx={{ fontSize: '0.8rem', color: theme.accent, opacity: 0.4, transition: 'opacity 0.15s' }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <>
      {/* デスクトップ：sticky サイドバー（md 以上） */}
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'sticky', top: 0, alignSelf: 'flex-start',
          width: 232, flexShrink: 0, height: '100vh', overflowY: 'auto',
          bgcolor: theme.surface, borderRight: `1px solid ${theme.border}`,
        }}
      >
        {NavContent}
      </Box>

      {/* モバイル：ハンバーガーボタン（md 未満のみ） */}
      <IconButton
        onClick={() => setOpen(true)}
        aria-label="メニューを開く"
        sx={{
          display: { xs: 'inline-flex', md: 'none' },
          position: 'fixed', top: 12, left: 12, zIndex: 1200,
          bgcolor: theme.surface, color: theme.text,
          border: `1px solid ${theme.border}`, borderRadius: 1.5,
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          '&:hover': { bgcolor: theme.surface },
        }}
      >
        <MenuRoundedIcon />
      </IconButton>

      {/* モバイル：Drawer */}
      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 268, bgcolor: theme.surface, backgroundImage: 'none' } }}
        sx={{ display: { xs: 'block', md: 'none' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 1 }}>
          <IconButton onClick={() => setOpen(false)} aria-label="閉じる" sx={{ color: theme.subtext }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>
        {NavContent}
      </Drawer>
    </>
  );
};
