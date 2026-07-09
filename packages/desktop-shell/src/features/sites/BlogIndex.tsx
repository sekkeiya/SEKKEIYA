/**
 * BlogIndex — サイトの blog セクション本体。S.Blog の公開済み記事を、上部のカテゴリ
 * チップで絞り込みながら一覧表示する。見せ方は section.variant（blog-cards/list/
 * magazine/minimal）で切り替え、右サイドバーから選択できる。
 *
 * データ源:
 *  - 公開スナップショット（Web）: section.resolvedBlog を静的描画。
 *  - 編集/プレビュー（desktop）: useDsbStore のライブ記事（status==='published'）。
 */
import React, { useEffect, useMemo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import type { EditorialTheme } from './editorialThemes';
import { RATIO } from './designTokens';
import type { ResolvedBlog, ResolvedBlogArticle, SiteSectionVariant } from '../projects/types';
import { useDsbStore } from '../dsb/store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { isTauri } from '../../lib/platform';

interface Item { id: string; slug: string; title: string; excerpt: string; cover?: string | null; category: string; date: string; }

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export const BlogIndex: React.FC<{
  theme: EditorialTheme;
  variant?: SiteSectionVariant;
  resolved?: ResolvedBlog;
  hideCats?: boolean;
}> = ({ theme, variant, resolved, hideCats }) => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const articles = useDsbStore((s) => s.articles);
  const categories = useDsbStore((s) => s.categories);
  const articlesLoaded = useDsbStore((s) => s.articlesLoaded);
  const siteActiveBlogCat = useDsbStore((s) => s.siteActiveBlogCat);
  const setSiteActiveBlogCat = useDsbStore((s) => s.setSiteActiveBlogCat);
  const refresh = useDsbStore((s) => s.refresh);
  const loadCategories = useDsbStore((s) => s.loadCategories);

  // ライブ時のみ自分の記事を読み込む（公開スナップショットがあればそれを使う）。
  useEffect(() => {
    if (!resolved && uid) { refresh(uid); loadCategories(uid); }
  }, [resolved, uid, refresh, loadCategories]);

  // カテゴリ絞り込みは上部ナビバー（SiteBlogCategoryBar）と共有ストア経由で同期。
  const activeCat = siteActiveBlogCat;
  const setActiveCat = setSiteActiveBlogCat;

  // データ源を共通形へ正規化。
  const { items, cats } = useMemo(() => {
    if (resolved) {
      const its: Item[] = resolved.articles.map((a: ResolvedBlogArticle) => ({
        id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, cover: a.cover ?? null,
        category: a.category, date: fmtDate(a.publishedAt),
      }));
      return { items: its, cats: resolved.categories };
    }
    const pub = articles.filter((a) => a.status === 'published');
    const its: Item[] = pub.map((a) => ({
      id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, cover: a.coverUrl ?? null,
      category: a.category, date: fmtDate(a.publishedAt || a.updatedAt),
    }));
    const counts = new Map<string, number>();
    for (const a of pub) { const c = (a.category || '').trim(); if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
    // ユーザーが S.Blog で作成した全カテゴリを表示（公開記事がゼロでも表示）。
    // 記事側で使われているが未登録のカテゴリは末尾に追加。
    const ordered = [
      ...categories,
      ...[...counts.keys()].filter((c) => !categories.includes(c)).sort((x, y) => x.localeCompare(y, 'ja')),
    ];
    return { items: its, cats: ordered.map((name) => ({ name, count: counts.get(name) ?? 0 })) };
  }, [resolved, articles, categories]);

  const shown = activeCat ? items.filter((i) => i.category === activeCat) : items;

  // 記事を開く。desktop プレビューは S.Blog エディタを起動。
  // Web 公開サイトでは記事リーダーページ（/@user/blog/{slug}）へ遷移する想定（ルートは別リポで実装予定）。
  const open = (id: string, slug: string) => {
    if (isTauri()) {
      const app = useAppStore.getState();
      app.setActiveWorkspaceId('blog');
      app.setLastActiveAppScope('3dsb');
      app.setCurrentMainView('workspace');
      useDsbStore.getState().startEdit(id);
      return;
    }
    // Web: 同一サイト配下の記事リーダーへ（後続フェーズでルート実装）。スラッグが無ければ何もしない。
    if (slug && typeof window !== 'undefined') {
      const base = window.location.pathname.replace(/\/+$/, '');
      window.location.assign(`${base}/blog/${slug}`);
    }
  };

  // live モードでまだ記事フェッチが完了していなければスピナーを表示（「記事なし」との区別）。
  if (!resolved && !articlesLoaded) {
    return (
      <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={22} sx={{ color: theme.accent }} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.border}`, color: theme.subtext, borderRadius: 0.5 }}>
        <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.9rem' }}>
          公開済みの記事がありません。S.Blog で記事を公開すると、ここに並びます。
        </Typography>
      </Box>
    );
  }

  const v = variant ?? 'blog-cards';
  // カテゴリの並べ方（見せ方ごとに変える）: タブバー / インライン / ピル。
  const catLayout: 'tabs' | 'inline' | 'pills' = v === 'blog-bar' ? 'tabs' : v === 'blog-minimal' ? 'inline' : 'pills';

  return (
    <Box>
      {/* カテゴリ（クリックで絞り込み）。hideCats=true のときは SiteBlogCategoryBar が代替するため非表示。 */}
      {!hideCats && cats.length > 0 && (
        <CategoryBar layout={catLayout} theme={theme} cats={cats} total={items.length} active={activeCat} onPick={setActiveCat} />
      )}

      {v === 'blog-list' && <ListView items={shown} theme={theme} onOpen={open} />}
      {v === 'blog-magazine' && <MagazineView items={shown} theme={theme} onOpen={open} />}
      {v === 'blog-minimal' && <MinimalView items={shown} theme={theme} onOpen={open} />}
      {(v === 'blog-cards' || v === 'blog-bar') && <CardsView items={shown} theme={theme} onOpen={open} />}
    </Box>
  );
};

// ── カテゴリの並べ方（pills/tabs/inline を切替） ─────────────────
const CategoryBar: React.FC<{
  layout: 'tabs' | 'inline' | 'pills';
  theme: EditorialTheme;
  cats: { name: string; count: number }[];
  total: number;
  active: string | null;
  onPick: (c: string | null) => void;
}> = ({ layout, theme, cats, total, active, onPick }) => {
  const entries: { key: string | null; label: string; count: number }[] = [
    { key: null, label: 'すべて', count: total },
    ...cats.map((c) => ({ key: c.name, label: c.name, count: c.count })),
  ];

  if (layout === 'tabs') {
    // 固定カテゴリバー: スクロール中も画面上部に貼り付く。上部サイトヘッダーがある場合は
    // --site-header-h 変数分だけ下にずらす（SiteTopHeader が ResizeObserver で設定）。
    return (
      <Box sx={{
        position: 'sticky', top: 'var(--site-header-h, 0px)', zIndex: 10,
        display: 'flex', gap: { xs: 2.5, md: 4 }, mb: { xs: 3, md: 5 },
        borderBottom: `1px solid ${theme.border}`,
        bgcolor: `${theme.bg}f0`, backdropFilter: 'saturate(160%) blur(10px)',
        overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {entries.map((e) => {
          const on = active === e.key;
          return (
            <Box key={e.label} onClick={() => onPick(e.key)}
              sx={{ flexShrink: 0, pb: 1.25, cursor: 'pointer', borderBottom: `2px solid ${on ? theme.accent : 'transparent'}`, mb: '-1px', display: 'flex', alignItems: 'baseline', gap: 0.6 }}>
              <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: on ? theme.headingWeight : 400, fontSize: { xs: '0.95rem', md: '1.1rem' }, color: on ? theme.text : theme.subtext, letterSpacing: theme.headingLetterSpacing, transition: 'color 0.15s', '&:hover': { color: theme.text } }}>{e.label}</Typography>
              <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.66rem', color: theme.subtext }}>{e.count}</Typography>
            </Box>
          );
        })}
      </Box>
    );
  }

  if (layout === 'inline') {
    // テキストリンクを中点で区切るミニマルな並べ方。
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0.5, mb: { xs: 2.5, md: 3.5 } }}>
        {entries.map((e, i) => {
          const on = active === e.key;
          return (
            <React.Fragment key={e.label}>
              {i > 0 && <Box component="span" sx={{ color: theme.subtext, opacity: 0.5, mx: 0.75 }}>・</Box>}
              <Box component="span" onClick={() => onPick(e.key)}
                sx={{ cursor: 'pointer', fontFamily: theme.kickerFamily, fontSize: '0.8rem', fontWeight: on ? 700 : 500, color: on ? theme.accent : theme.subtext, '&:hover': { color: theme.text } }}>
                {e.label}
              </Box>
            </React.Fragment>
          );
        })}
      </Box>
    );
  }

  // pills（既定）
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: { xs: 3, md: 4 } }}>
      {entries.map((e) => (
        <Chip key={e.label} theme={theme} label={e.label} count={e.count} active={active === e.key} onClick={() => onPick(e.key)} />
      ))}
    </Box>
  );
};

// ── カテゴリチップ ──────────────────────────────────────────────
const Chip: React.FC<{ theme: EditorialTheme; label: string; count: number; active: boolean; onClick: () => void }> = ({ theme, label, count, active, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.6, borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${active ? theme.accent : theme.border}`,
      bgcolor: active ? theme.accent : 'transparent',
      color: active ? theme.surface : theme.text,
      fontFamily: theme.kickerFamily, fontSize: '0.78rem', fontWeight: 600,
      transition: 'all 0.15s',
      '&:hover': { borderColor: theme.accent },
    }}
  >
    {label}
    <Box component="span" sx={{ fontSize: '0.68rem', opacity: 0.7 }}>{count}</Box>
  </Box>
);

const Kicker: React.FC<{ theme: EditorialTheme; children: React.ReactNode }> = ({ theme, children }) => (
  <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.accent, mb: 0.5 }}>{children}</Typography>
);

// ── カード（既定） ──────────────────────────────────────────────
const CardsView: React.FC<{ items: Item[]; theme: EditorialTheme; onOpen: (id: string, slug: string) => void }> = ({ items, theme, onOpen }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2.5, md: 3 } }}>
    {items.map((a) => (
      <Box key={a.id} onClick={() => onOpen(a.id, a.slug)} sx={{ cursor: 'pointer', '&:hover .bi-cover img': { transform: 'scale(1.05)' }, '&:hover .bi-arrow': { opacity: 1 } }}>
        <Box className="bi-cover" sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.card, bgcolor: theme.surface, border: `1px solid ${theme.border}` }}>
          {a.cover
            ? <Box component="img" src={a.cover} alt={a.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
            : <Box sx={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${theme.accent}22 0%, ${theme.surface} 60%)` }} />}
        </Box>
        <Box sx={{ mt: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Kicker theme={theme}>{a.category || 'ブログ'}</Kicker>
            <ArrowOutwardRoundedIcon className="bi-arrow" sx={{ fontSize: '0.95rem', color: theme.accent, opacity: 0.4, transition: 'opacity 0.2s' }} />
          </Box>
          <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: '1.05rem', color: theme.text, lineHeight: 1.35, letterSpacing: theme.headingLetterSpacing }}>{a.title || '(無題)'}</Typography>
          {a.date && <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.66rem', color: theme.subtext, mt: 0.5 }}>{a.date}</Typography>}
        </Box>
      </Box>
    ))}
  </Box>
);

// ── リスト（横並び：サムネ＋テキスト） ─────────────────────────
const ListView: React.FC<{ items: Item[]; theme: EditorialTheme; onOpen: (id: string, slug: string) => void }> = ({ items, theme, onOpen }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
    {items.map((a, i) => (
      <Box key={a.id} onClick={() => onOpen(a.id, a.slug)}
        sx={{ display: 'flex', gap: { xs: 2, md: 3 }, py: 3, cursor: 'pointer', borderTop: i === 0 ? `1px solid ${theme.border}` : 'none', borderBottom: `1px solid ${theme.border}`, '&:hover .bi-title': { color: theme.accent } }}>
        <Box sx={{ width: { xs: 96, md: 160 }, flexShrink: 0, aspectRatio: RATIO.card, overflow: 'hidden', bgcolor: theme.surface, border: `1px solid ${theme.border}` }}>
          {a.cover
            ? <Box component="img" src={a.cover} alt={a.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <Box sx={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${theme.accent}22 0%, ${theme.surface} 60%)` }} />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Kicker theme={theme}>{a.category || 'ブログ'}{a.date ? ` ・ ${a.date}` : ''}</Kicker>
          <Typography className="bi-title" sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: { xs: '1.1rem', md: '1.4rem' }, color: theme.text, lineHeight: 1.3, letterSpacing: theme.headingLetterSpacing, transition: 'color 0.15s' }}>{a.title || '(無題)'}</Typography>
          {a.excerpt && <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.85rem', color: theme.subtext, mt: 0.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.excerpt}</Typography>}
        </Box>
      </Box>
    ))}
  </Box>
);

// ── マガジン（先頭を大きく＋残りグリッド） ─────────────────────
const MagazineView: React.FC<{ items: Item[]; theme: EditorialTheme; onOpen: (id: string, slug: string) => void }> = ({ items, theme, onOpen }) => {
  const [lead, ...rest] = items;
  if (!lead) return null;
  return (
    <Box>
      <Box onClick={() => onOpen(lead.id, lead.slug)} sx={{ cursor: 'pointer', mb: 4, '&:hover .bi-cover img': { transform: 'scale(1.04)' } }}>
        <Box className="bi-cover" sx={{ position: 'relative', overflow: 'hidden', aspectRatio: '21 / 9', bgcolor: theme.surface, border: `1px solid ${theme.border}` }}>
          {lead.cover
            ? <Box component="img" src={lead.cover} alt={lead.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
            : <Box sx={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${theme.accent}22 0%, ${theme.surface} 60%)` }} />}
        </Box>
        <Box sx={{ mt: 1.5, maxWidth: 720 }}>
          <Kicker theme={theme}>{lead.category || 'ブログ'}{lead.date ? ` ・ ${lead.date}` : ''}</Kicker>
          <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: { xs: '1.6rem', md: '2.2rem' }, color: theme.text, lineHeight: 1.25, letterSpacing: theme.headingLetterSpacing }}>{lead.title || '(無題)'}</Typography>
          {lead.excerpt && <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.95rem', color: theme.subtext, mt: 1 }}>{lead.excerpt}</Typography>}
        </Box>
      </Box>
      {rest.length > 0 && <CardsView items={rest} theme={theme} onOpen={onOpen} />}
    </Box>
  );
};

// ── ミニマル（画像なしテキストリスト） ─────────────────────────
const MinimalView: React.FC<{ items: Item[]; theme: EditorialTheme; onOpen: (id: string, slug: string) => void }> = ({ items, theme, onOpen }) => (
  <Box sx={{ maxWidth: 760 }}>
    {items.map((a, i) => (
      <Box key={a.id} onClick={() => onOpen(a.id, a.slug)}
        sx={{ display: 'flex', alignItems: 'baseline', gap: 2, py: 2, cursor: 'pointer', borderTop: i === 0 ? `1px solid ${theme.border}` : 'none', borderBottom: `1px solid ${theme.border}`, '&:hover .bi-title': { color: theme.accent } }}>
        <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.66rem', color: theme.subtext, width: 92, flexShrink: 0 }}>{a.date}</Typography>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Kicker theme={theme}>{a.category || 'ブログ'}</Kicker>
          <Typography className="bi-title" sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: '1.2rem', color: theme.text, lineHeight: 1.35, letterSpacing: theme.headingLetterSpacing, transition: 'color 0.15s' }}>{a.title || '(無題)'}</Typography>
        </Box>
        <ArrowOutwardRoundedIcon sx={{ fontSize: '1rem', color: theme.accent, opacity: 0.4, flexShrink: 0 }} />
      </Box>
    ))}
  </Box>
);
