/**
 * OfficialSummary — 公式ブログの「概要・分析・戦略」。
 * 概要・分析 / 戦略 の2タブ。
 * - 概要・分析: 記事の状況（統計・ステータス別・カテゴリ別）。右サイドバー＝クイックアクション。
 * - 戦略: メイン＝方向性のロードマップ・ボード（ビュー切替）。右サイドバー＝AIと戦略を議論するチャット。
 *   ボードはチャットで確定した戦略を反映。AI投稿計画・記事ネタはスケジュール画面へ移設。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Tabs, Tab, Button, Stack, Collapse } from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useOfficialBlogStore } from './store/useOfficialBlogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { StrategyRoadmapBoard } from './StrategyRoadmapBoard';
import { BlogStrategyChat } from './BlogStrategyChat';
import { OfficialContentStrategy } from './OfficialContentStrategy';
import { loadBlogStrategy } from './api/blogStrategyApi';
import type { BlogStrategy } from './types';
import { type OfficialStatus } from './officialTypes';
import { BRAND } from '../../styles/theme';

const ACCENT = '#38bdf8';
const STRAT_ACCENT = '#c084fc';

type SummaryTab = 'overview' | 'strategy';

const StatCard: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color }) => (
  <Box sx={{ flex: 1, minWidth: 120, p: 2, borderRadius: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}` }}>
    <Typography sx={{ fontSize: '1.7rem', fontWeight: 800, color: color || 'var(--brand-fg)', lineHeight: 1.1 }}>{value}</Typography>
    <Typography sx={{ fontSize: '0.76rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.25 }}>{label}</Typography>
  </Box>
);

export const OfficialSummary: React.FC = () => {
  const { articles, loading, loaded, refresh, startNew, startEdit, setView, setCategoryFilter } = useOfficialBlogStore();
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const [tab, setTab] = useState<SummaryTab>('overview');
  const [strategy, setStrategy] = useState<BlogStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => { if (!loaded) void refresh(); }, [loaded, refresh]);

  useEffect(() => {
    if (!uid) { setStrategyLoading(false); return; }
    let alive = true;
    setStrategyLoading(true);
    void loadBlogStrategy('official', uid).then((s) => { if (alive) { setStrategy(s); setStrategyLoading(false); } }).catch(() => { if (alive) setStrategyLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const stats = useMemo(() => {
    const byStatus: Record<OfficialStatus, number> = { draft: 0, interview: 0, review: 0, published: 0 };
    const byCat = new Map<string, number>();
    for (const a of articles) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      const c = a.category?.name || '未分類';
      byCat.set(c, (byCat.get(c) ?? 0) + 1);
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...cats.map(([, n]) => n));
    return { byStatus, cats, maxCat };
  }, [articles]);

  if (loading && articles.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }

  const statusRows: { key: OfficialStatus; label: string; color: string }[] = [
    { key: 'published', label: '公開済み', color: '#4ade80' },
    { key: 'review', label: 'レビュー待ち', color: 'light-dark(#5704a9, #c084fc)' },
    { key: 'interview', label: '取材中', color: 'light-dark(#aa4e03, #fb923c)' },
    { key: 'draft', label: '下書き', color: 'light-dark(#aa7c03, #fbbf24)' },
  ];
  const maxStatus = Math.max(1, ...statusRows.map((r) => stats.byStatus[r.key]));

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* メイン（スクロール） */}
      <Box sx={{ flex: 1, height: '100%', overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 } }}>
          {/* ヘッダ */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <InsightsRoundedIcon sx={{ color: ACCENT }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.2 }}>概要・分析・戦略</Typography>
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: '0.76rem' }}>公式ブログの状況と運営戦略</Typography>
            </Box>
          </Box>

          {/* タブ */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, minHeight: 40, borderBottom: `1px solid ${BRAND.line}`,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 700, fontSize: '0.88rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' },
            '& .Mui-selected': { color: `${ACCENT} !important` }, '& .MuiTabs-indicator': { bgcolor: ACCENT } }}>
            <Tab value="overview" label="概要・分析" />
            <Tab value="strategy" label="戦略" />
          </Tabs>

          {/* 概要・分析 */}
          {tab === 'overview' && (
            <Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 4 }}>
                <StatCard label="記事総数" value={articles.length} />
                <StatCard label="公開済み" value={stats.byStatus.published} color="#4ade80" />
                <StatCard label="下書き" value={stats.byStatus.draft} color="light-dark(#aa7c03, #fbbf24)" />
                <StatCard label="取材・レビュー待ち" value={stats.byStatus.interview + stats.byStatus.review} color="light-dark(#5704a9, #c084fc)" />
              </Box>

              <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--brand-fg)', mb: 1.5 }}>ステータス別の内訳</Typography>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 1, mb: 4 }}>
                {statusRows.map((r) => (
                  <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ width: 96, fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)', flexShrink: 0 }}>{r.label}</Typography>
                    <Box sx={{ flex: 1, height: 8, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', overflow: 'hidden' }}>
                      <Box sx={{ width: `${(stats.byStatus[r.key] / maxStatus) * 100}%`, height: '100%', bgcolor: r.color, borderRadius: 1 }} />
                    </Box>
                    <Typography sx={{ width: 28, textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.6)', flexShrink: 0 }}>{stats.byStatus[r.key]}</Typography>
                  </Box>
                ))}
              </Box>

              <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--brand-fg)', mb: 1.5 }}>カテゴリ別の記事数</Typography>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.cats.length === 0 ? (
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.82rem' }}>まだ記事がありません。</Typography>
                ) : stats.cats.map(([name, n]) => (
                  <Box key={name} onClick={() => name !== '未分類' && setCategoryFilter(name)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: name !== '未分類' ? 'pointer' : 'default',
                      borderRadius: 1, px: 0.5, py: 0.25, '&:hover': name !== '未分類' ? { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' } : {} }}>
                    <Typography noWrap sx={{ width: 160, fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)', flexShrink: 0 }}>{name}</Typography>
                    <Box sx={{ flex: 1, height: 8, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', overflow: 'hidden' }}>
                      <Box sx={{ width: `${(n / stats.maxCat) * 100}%`, height: '100%', bgcolor: ACCENT, borderRadius: 1 }} />
                    </Box>
                    <Typography sx={{ width: 28, textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.6)', flexShrink: 0 }}>{n}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* 戦略 — 方向性ロードマップ・ボード（右サイドバーのチャットで確定した戦略を反映） */}
          {tab === 'strategy' && (
            <Box>
              <StrategyRoadmapBoard strategy={strategy} loading={strategyLoading} accent={STRAT_ACCENT} />

              {/* 運営ツール（AIモデル・開発アップデート記事）。折りたたみ */}
              <Box sx={{ mt: 4, borderTop: `1px solid ${BRAND.line}`, pt: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} onClick={() => setToolsOpen((v) => !v)}
                  sx={{ cursor: 'pointer', px: 0.5, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
                  <BuildRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 18 }} />
                  <Typography sx={{ fontWeight: 800, color: 'var(--brand-fg)', fontSize: '0.86rem', flex: 1 }}>運営ツール（AIモデル設定・開発アップデート記事）</Typography>
                  <ExpandMoreRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', transform: toolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </Stack>
                <Collapse in={toolsOpen} unmountOnExit>
                  <Box sx={{ pt: 1.5 }}>
                    <OfficialContentStrategy embedded onOpenArticle={(id) => { setView('articles'); void startEdit(id); }} />
                  </Box>
                </Collapse>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* 右サイドバー（md未満では非表示）。戦略タブ＝AIチャット / 概要・分析タブ＝クイックアクション */}
      <Box sx={{ width: tab === 'strategy' ? 360 : 288, flexShrink: 0, height: '100%',
        overflowY: tab === 'strategy' ? 'hidden' : 'auto', borderLeft: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel,
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', p: 2.5, gap: tab === 'strategy' ? 0 : 3 }}>
        {tab === 'strategy' ? (
          uid ? (
            <BlogStrategyChat scope="official" uid={uid} accent={STRAT_ACCENT} onSaved={setStrategy} />
          ) : (
            <Typography sx={{ fontSize: '0.82rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>ログインすると戦略チャットを利用できます。</Typography>
          )
        ) : (
          <>
            {/* クイックアクション */}
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.45)', letterSpacing: '.06em', mb: 1.25 }}>クイックアクション</Typography>
              <Stack spacing={1}>
                <Button fullWidth variant="contained" startIcon={<AddRoundedIcon />} onClick={() => startNew()}
                  sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 800, textTransform: 'none', borderRadius: 2, justifyContent: 'flex-start', '&:hover': { bgcolor: '#0ea5e9' } }}>
                  新しい記事
                </Button>
                <Button fullWidth variant="outlined" startIcon={<EventNoteRoundedIcon />} onClick={() => setView('schedule')}
                  sx={{ color: '#c084fc', borderColor: 'rgba(192,132,252,0.4)', fontWeight: 700, textTransform: 'none', borderRadius: 2, justifyContent: 'flex-start', '&:hover': { borderColor: '#c084fc', bgcolor: 'rgba(192,132,252,0.06)' } }}>
                  スケジュール・記事ネタ
                </Button>
                <Button fullWidth variant="outlined" startIcon={<ArticleRoundedIcon />} onClick={() => setView('articles')}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', borderColor: BRAND.line, fontWeight: 700, textTransform: 'none', borderRadius: 2, justifyContent: 'flex-start', '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
                  記事一覧（{articles.length}）
                </Button>
              </Stack>
            </Box>

            {/* 要点 */}
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.45)', letterSpacing: '.06em', mb: 1.25 }}>いまの状況</Typography>
              <Stack spacing={1}>
                {statusRows.map((r) => (
                  <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{r.label}</Typography>
                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--brand-fg)' }}>{stats.byStatus[r.key]}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* 運営の流れ */}
            <Box sx={{ mt: 'auto', p: 1.75, borderRadius: 2, bgcolor: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: ACCENT, mb: 0.75 }}>運営の流れ</Typography>
              <Typography sx={{ fontSize: '0.74rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)', lineHeight: 1.7 }}>
                ① AIと戦略・目標を決める（戦略タブ）<br />② スケジュールでAI投稿計画・記事ネタ<br />③ ⚡で執筆・公開
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};
