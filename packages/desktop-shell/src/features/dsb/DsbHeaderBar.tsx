/**
 * DsbHeaderBar — S.Blog 用の全幅ヘッダーバンド（デスクトップのみ）。
 * 他サブアプリと同様「全幅ヘッダー＋左サイドバー｜本文」の最上段を担う。
 * 現在のセクション（ホーム/概要/スケジュール/カテゴリ/記事一覧）のタイトルと、
 * 管理者用の「自分のブログ⇄公式ブログ」トグルを 1 本のバンドへ集約する。
 * 各ビュー側の重複していたページタイトルヘッダーは撤去済み。
 * 編集モード（mode==='edit'）はエディタが独自のクロムを持つため null を返す。
 */
import React from 'react';
import { Box, Typography, InputBase, IconButton, Tooltip } from '@mui/material';
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useDsbStore } from './store/useDsbStore';
import { useOfficialBlogStore } from './store/useOfficialBlogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isBlogAdmin } from './lib/blogAdmin';

const ACCENT = '#e57373';
const OFFICIAL_ACCENT = 'light-dark(#0676a8, #38bdf8)';

// ビューごとのタイトル・サブタイトル・アイコン（サイドバーのナビ項目と対応）。
const VIEW_META: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
  feed: {
    title: 'ホーム',
    subtitle: '建築・インテリアの気になる記事から、AIと議論してあなたの記事を書けます',
    icon: <NewspaperRoundedIcon sx={{ color: ACCENT }} />,
  },
  overview: {
    title: '概要・分析・戦略',
    subtitle: 'ブログ全体の概要・分析と今後の戦略',
    icon: <InsightsRoundedIcon sx={{ color: ACCENT }} />,
  },
  schedule: {
    title: 'スケジュール',
    subtitle: '投稿カレンダーとAI投稿計画',
    icon: <EventNoteRoundedIcon sx={{ color: ACCENT }} />,
  },
  plan: {
    title: 'スケジュール',
    subtitle: '投稿カレンダーとAI投稿計画',
    icon: <EventNoteRoundedIcon sx={{ color: ACCENT }} />,
  },
  categories: {
    title: 'カテゴリ',
    subtitle: 'テーマごとにカテゴリを作成・管理し、記事を整理します。',
    icon: <CategoryRoundedIcon sx={{ color: ACCENT }} />,
  },
  list: {
    title: '記事一覧',
    subtitle: '作成した記事の管理',
    icon: <ArticleRoundedIcon sx={{ color: ACCENT }} />,
  },
  sources: {
    title: '情報源',
    subtitle: 'ホームに表示する記事メディア・YouTubeチャンネルを選んで紐づけます',
    icon: <RssFeedRoundedIcon sx={{ color: ACCENT }} />,
  },
};

// 公式ブログモードは別ストア（useOfficialBlogStore）で view キーも異なるため、専用のメタを用意する。
const OFFICIAL_VIEW_META: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
  feed: {
    title: 'ホーム',
    subtitle: 'おすすめメディアの最新記事フィード（インスピレーション）',
    icon: <NewspaperRoundedIcon sx={{ color: OFFICIAL_ACCENT }} />,
  },
  overview: {
    title: '概要・分析・戦略',
    subtitle: '公式ブログ全体の概要・分析と今後の戦略',
    icon: <InsightsRoundedIcon sx={{ color: OFFICIAL_ACCENT }} />,
  },
  schedule: {
    title: 'スケジュール',
    subtitle: '公式ブログの投稿カレンダーとAI投稿計画',
    icon: <EventNoteRoundedIcon sx={{ color: OFFICIAL_ACCENT }} />,
  },
  strategy: {
    title: 'コンテンツ戦略',
    subtitle: '公式ブログのテーマ戦略・トピック設計',
    icon: <AutoAwesomeRoundedIcon sx={{ color: OFFICIAL_ACCENT }} />,
  },
  categories: {
    title: 'カテゴリ',
    subtitle: 'テーマごとにカテゴリを作成・管理し、記事を整理します。',
    icon: <CategoryRoundedIcon sx={{ color: OFFICIAL_ACCENT }} />,
  },
  articles: {
    title: '記事一覧',
    subtitle: '公式ブログ記事の管理',
    icon: <ArticleRoundedIcon sx={{ color: OFFICIAL_ACCENT }} />,
  },
};

export const DsbHeaderBar: React.FC = () => {
  const view = useDsbStore((s) => s.view);
  const mode = useDsbStore((s) => s.mode);
  const blogScope = useDsbStore((s) => s.blogScope);
  const setBlogScope = useDsbStore((s) => s.setBlogScope);
  const feedSearch = useDsbStore((s) => s.feedSearch);
  const setFeedSearch = useDsbStore((s) => s.setFeedSearch);
  const bumpFeedRefresh = useDsbStore((s) => s.bumpFeedRefresh);
  // 公式モードの現在ビュー/編集状態は別ストアから取得（フック規則のため常に呼ぶ）。
  const officialView = useOfficialBlogStore((s: any) => s.view);
  const officialMode = useOfficialBlogStore((s: any) => s.mode);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const admin = isBlogAdmin(currentUser);

  const isOfficial = blogScope === 'official';

  // 編集モードはエディタが独自ヘッダーを持つためバンドを出さない（scope に応じたモードを見る）。
  if ((isOfficial ? officialMode : mode) === 'edit') return null;

  const meta = isOfficial
    ? (OFFICIAL_VIEW_META[officialView] ?? OFFICIAL_VIEW_META.articles)
    : (VIEW_META[view] ?? VIEW_META.feed);

  // ホーム（フィード）ビューのときだけ、中央に検索・右に「フィード更新」を出す。
  const isFeedView = isOfficial ? officialView === 'feed' : view === 'feed';

  return (
    <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, bgcolor: 'background.default' }}>
      {/* 左: アイコン＋セクションタイトル＋サブタイトル */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flexShrink: 0, maxWidth: '42%' }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {meta.icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.2 }}>{meta.title}</Typography>
          <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.82rem' }}>{meta.subtitle}</Typography>
        </Box>
      </Box>

      {/* 中央: 検索バーは常に表示（フィードは記事、ソース記事はメディアを絞り込む）。 */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', maxWidth: 560, px: 1.5, py: 0.5, borderRadius: 999, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
          <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }} />
          <InputBase
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
            placeholder="記事・メディアを検索…"
            sx={{ flex: 1, fontSize: 13, color: 'var(--brand-fg)' }}
          />
        </Box>
      </Box>

      {/* 右: 更新（フィードのみ）＋ 管理者トグル */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {isFeedView && (
          <Tooltip title="フィードを更新">
            <IconButton onClick={() => bumpFeedRefresh()} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: ACCENT } }}>
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>
        )}
      {admin && (
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.4, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }}>
          {([
            { key: 'account' as const, label: '自分のブログ', color: ACCENT },
            { key: 'official' as const, label: '公式ブログ', color: 'light-dark(#0676a8, #38bdf8)' },
          ]).map((opt) => {
            const on = blogScope === opt.key;
            return (
              <Box key={opt.key} onClick={() => setBlogScope(opt.key)}
                sx={{ minWidth: 96, textAlign: 'center', cursor: 'pointer', px: 1.5, py: 0.6, borderRadius: 1.5,
                  bgcolor: on ? `color-mix(in srgb, ${opt.color} 13%, transparent)` : 'transparent',
                  boxShadow: on ? `inset 0 0 0 1px color-mix(in srgb, ${opt.color} 40%, transparent)` : 'none',
                  '&:hover': { bgcolor: on ? `color-mix(in srgb, ${opt.color} 18%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>
                <Typography sx={{ fontSize: 11, fontWeight: on ? 800 : 600, color: on ? opt.color : 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                  {opt.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
      </Box>
    </Box>
  );
};
