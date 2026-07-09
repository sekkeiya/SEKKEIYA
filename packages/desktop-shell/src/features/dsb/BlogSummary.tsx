// S.Blog サマリー — アカウント/プロジェクトのワークスペースタブ（Home の隣の Blog）に表示する。
// 役割: 「書く」は S.Blog サブアプリ、「状況を見る/管理する」はこのサマリー。
// 公開記事数・下書き数・閲覧数などを俯瞰し、S.Blog（執筆）へ橋渡しする。
import React, { useEffect, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, Chip } from '@mui/material';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BlogStrategyCard } from './BlogStrategyCard';
import type { BlogArticle } from './types';

const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

const ACCENT = '#e57373';

export type BlogSummarySource =
  | { kind: 'account' }
  | { kind: 'project'; projectId: string; projectName?: string };

interface BlogSummaryProps {
  source: BlogSummarySource;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <Box sx={{
      flex: '1 1 160px', minWidth: 140, p: 2, borderRadius: 2,
      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ width: 24, height: 24, borderRadius: 1.5, bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 15, color: 'var(--brand-fg)' } })}
        </Box>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1 }}>{value}</Typography>
    </Box>
  );
}

export const BlogSummary: React.FC<BlogSummaryProps> = ({ source }) => {
  const { articles, schedules, loading, refresh, startNew, startEdit, setView } = useDsbStore();
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const displayName = useAuthStore((s: any) => s.currentUser?.displayName as string | undefined);

  useEffect(() => { if (uid) refresh(uid); }, [uid, refresh]);

  // 記事プールはアカウント単位。プロジェクトサマリーでは公開先がそのプロジェクトの記事に絞る。
  const scoped = useMemo(() => {
    if (source.kind === 'account') return articles;
    return articles.filter(
      (a) => a.publishTarget.scope === 'project' && a.publishTarget.projectId === source.projectId,
    );
  }, [articles, source]);

  const stats = useMemo(() => {
    const published = scoped.filter((a) => a.status === 'published');
    const drafts = scoped.filter((a) => a.status === 'draft');
    const totalViews = scoped.reduce((sum, a) => sum + (a.views ?? 0), 0);
    const anyViews = scoped.some((a) => typeof a.views === 'number');
    return { total: scoped.length, published: published.length, drafts: drafts.length, totalViews, anyViews };
  }, [scoped]);

  // 記事別の閲覧数ランキング（公開記事を閲覧数の多い順）。
  const ranking = useMemo(() => {
    const pub = scoped.filter((a) => a.status === 'published');
    const sorted = [...pub].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    const max = Math.max(1, ...sorted.map((a) => a.views ?? 0));
    return { items: sorted.slice(0, 8), max };
  }, [scoped]);

  // カテゴリ別の記事数（テーマの偏りを把握＝戦略の材料）。
  const byCategory = useMemo(() => {
    const m = new Map<string, { published: number; draft: number }>();
    for (const a of scoped) {
      const c = (a.category || '未分類').trim() || '未分類';
      const cur = m.get(c) ?? { published: 0, draft: 0 };
      if (a.status === 'published') cur.published += 1; else cur.draft += 1;
      m.set(c, cur);
    }
    const rows = [...m.entries()].map(([name, v]) => ({ name, ...v, total: v.published + v.draft }));
    rows.sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...rows.map((r) => r.total));
    return { rows, max };
  }, [scoped]);

  // 今後の投稿予定（戦略→実行の橋渡し）。
  const upcoming = useMemo(() => {
    const t = todayStr();
    return schedules.filter((s) => s.status === 'planned' && s.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  }, [schedules]);

  const openEditorNew = () => { if (uid) startNew(uid, displayName); };

  const scopeLabel = source.kind === 'account' ? 'アカウントサイト' : `プロジェクト: ${source.projectName ?? ''}`;

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ArticleRoundedIcon sx={{ color: ACCENT, fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>ブログ</Typography>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 12 }}>{scopeLabel} の記事の状況</Typography>
        </Box>
        <Button
          onClick={openEditorNew}
          variant="contained" startIcon={<AddRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}
        >
          新規記事
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          {/* 運営戦略・目標（アカウント。AI投稿計画の最優先材料） */}
          {source.kind === 'account' && <BlogStrategyCard scope="account" uid={uid} accent="#ce93d8" />}

          {/* 統計カード */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
            <StatCard icon={<ArticleRoundedIcon />} label="記事数" value={stats.total} color="#607d8b" />
            <StatCard icon={<PublicRoundedIcon />} label="公開済み" value={stats.published} color="#43a047" />
            <StatCard icon={<EditNoteRoundedIcon />} label="下書き" value={stats.drafts} color="#9e9e9e" />
            <StatCard icon={<VisibilityRoundedIcon />} label="累計閲覧数" value={stats.anyViews ? stats.totalViews.toLocaleString() : '—'} color={ACCENT} />
          </Box>

          {scoped.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'rgb(var(--brand-fg-rgb) / 0.4)', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2 }}>
              <ArticleRoundedIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1 }} />
              <Typography sx={{ mb: 2 }}>まだ記事がありません。最初の記事を書いて戦略を立て始めましょう。</Typography>
              <Button onClick={openEditorNew} variant="outlined" sx={{ color: ACCENT, borderColor: `${ACCENT}77`, textTransform: 'none' }}>
                最初の記事を書く
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
              {/* 閲覧数ランキング */}
              <Box sx={{ flex: '1 1 420px', minWidth: 300, p: 2, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <VisibilityRoundedIcon sx={{ fontSize: 16, color: ACCENT }} />
                  <Typography sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 700 }}>記事別の閲覧数（公開記事）</Typography>
                </Box>
                {ranking.items.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)', py: 2 }}>公開記事がありません。記事を公開すると閲覧数が並びます。</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {ranking.items.map((a: BlogArticle, i) => {
                      const v = a.views ?? 0;
                      const pct = Math.round((v / ranking.max) * 100);
                      return (
                        <Box key={a.id} onClick={() => startEdit(a.id)} sx={{ cursor: 'pointer', '&:hover .ttl': { color: 'var(--brand-fg)' } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.3)', width: 16 }}>{i + 1}</Typography>
                            <Typography noWrap className="ttl" sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>{a.title || '(無題)'}</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)' }}>{typeof a.views === 'number' ? v.toLocaleString() : '—'}</Typography>
                          </Box>
                          <Box sx={{ height: 5, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', overflow: 'hidden', ml: 3 }}>
                            <Box sx={{ width: `${typeof a.views === 'number' ? pct : 0}%`, height: '100%', bgcolor: ACCENT, borderRadius: 3 }} />
                          </Box>
                        </Box>
                      );
                    })}
                    {!stats.anyViews && (
                      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.3)', mt: 0.5 }}>
                        ※ 閲覧数は公開サイトの計測連携（後続フェーズ）で記録され、ここに反映されます。
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* カテゴリ別の記事数 */}
              <Box sx={{ flex: '1 1 320px', minWidth: 280, p: 2, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
                <Typography sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 700, mb: 1.5 }}>カテゴリ別の記事数</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {byCategory.rows.map((r) => (
                    <Box key={r.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>{r.name}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>公開{r.published}・下書き{r.draft}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)', width: 24, textAlign: 'right' }}>{r.total}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' }}>
                        <Box sx={{ width: `${(r.published / byCategory.max) * 100}%`, bgcolor: '#43a047' }} />
                        <Box sx={{ width: `${(r.draft / byCategory.max) * 100}%`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* 今後の投稿予定（スケジュールへの導線） */}
              <Box sx={{ flex: '1 1 100%', p: 2, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <EventNoteRoundedIcon sx={{ fontSize: 16, color: ACCENT }} />
                  <Typography sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 700, flex: 1 }}>今後の投稿予定</Typography>
                  <Button size="small" onClick={() => setView('schedule')} endIcon={<ChevronRightRoundedIcon />}
                    sx={{ color: ACCENT, textTransform: 'none', fontSize: 12 }}>
                    スケジュールを開く
                  </Button>
                </Box>
                {upcoming.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                    予定がありません。「スケジュール」でテーマと日付を計画すると、戦略的に投稿できます。
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {upcoming.map((s) => (
                      <Box key={s.id} onClick={() => setView('schedule')}
                        sx={{ cursor: 'pointer', flex: '1 1 200px', minWidth: 180, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', '&:hover': { borderColor: `${ACCENT}66` } }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{s.date}</Typography>
                        <Typography noWrap sx={{ fontSize: 12.5, color: 'var(--brand-fg)', fontWeight: 600 }}>{s.title}</Typography>
                        {s.category && <Chip size="small" label={s.category} sx={{ mt: 0.5, height: 18, fontSize: 9.5, bgcolor: `${ACCENT}26`, color: 'var(--brand-fg)' }} />}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};
