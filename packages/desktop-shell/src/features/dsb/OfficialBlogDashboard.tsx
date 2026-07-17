import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Chip, IconButton, Paper, Tooltip, TextField,
  InputAdornment, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useOfficialBlogStore } from './store/useOfficialBlogStore';
import { OfficialBlogEditor } from './OfficialBlogEditor';
import { OfficialContentStrategy } from './OfficialContentStrategy';
import { OfficialCategories } from './OfficialCategories';
import { OfficialSummary } from './OfficialSummary';
import { BlogNewsFeed } from './BlogNewsFeed';
import { OfficialScheduleView } from './OfficialScheduleView';
import { OFFICIAL_STATUS_META, type OfficialArticle, type OfficialStatus } from './officialTypes';
import { BRAND } from '../../styles/theme';

const ACCENT = '#38bdf8';

// Firestore Timestamp | ISO文字列 | null を安全に表示用文字列へ。
const fmtDateTime = (v: unknown): string => {
  if (!v) return '—';
  try {
    const d = typeof (v as any)?.toDate === 'function' ? (v as any).toDate() : new Date(v as any);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const StatusBadge: React.FC<{ status: OfficialStatus }> = ({ status }) => {
  const m = OFFICIAL_STATUS_META[status] || OFFICIAL_STATUS_META.draft;
  return <Chip label={m.label} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, color: m.color, bgcolor: m.bg, border: `1px solid color-mix(in srgb, ${m.color} 20%, transparent)` }} />;
};

const COLS = 'minmax(160px, 2fr) 108px 120px 128px 84px';

export const OfficialBlogDashboard: React.FC = () => {
  const { articles, loading, loaded, mode, view, categoryFilter, setView, refresh, startNew, startEdit, remove } = useOfficialBlogStore();
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loaded) void refresh(); }, [loaded, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (categoryFilter && (a.category?.name || '') !== categoryFilter) return false;
      if (!q) return true;
      return (a.title || '').toLowerCase().includes(q) ||
        (a.excerpt || '').toLowerCase().includes(q) ||
        (a.category?.name || '').toLowerCase().includes(q) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q));
    });
  }, [articles, search, categoryFilter]);

  if (mode === 'edit') {
    return (
      <>
        <OfficialBlogEditor onToast={(msg, sev) => setToast({ msg, sev })} />
        <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
        </Snackbar>
      </>
    );
  }
  // 公式モードのナビ（アカウントブログと項目を揃える）。記事クリックで公式エディタを開く。
  if (view === 'feed') {
    // ホーム = ニュースフィード（公式は閲覧/インスピレーション用。議論・投稿予定は非表示）
    return <BlogNewsFeed official />;
  }
  if (view === 'overview') {
    return <OfficialSummary />;
  }
  if (view === 'schedule') {
    // スケジュール = 公式記事を公開日で並べる月カレンダー（タスクなし）
    return <OfficialScheduleView />;
  }
  if (view === 'strategy') {
    return <OfficialContentStrategy onOpenArticle={(id) => { setView('articles'); void startEdit(id); }} />;
  }
  if (view === 'categories') {
    return <OfficialCategories />;
  }

  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await remove(confirm.id);
      setConfirm(null);
      setToast({ msg: '削除しました', sev: 'info' });
    } catch (e) {
      console.error(e);
      setToast({ msg: '削除に失敗しました', sev: 'error' });
    } finally { setBusy(false); }
  };

  const cell = { display: 'flex', alignItems: 'center', minWidth: 0 } as const;

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 } }}>
          {/* アクション */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2.5 }}>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={startNew}
              sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#0ea5e9' } }}>
              新規記事
            </Button>
          </Box>

          {loading && articles.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
          ) : (
            <>
              {/* 検索 */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.78rem' }}>{filtered.length} 件</Typography>
                  {categoryFilter && (
                    <Chip label={`カテゴリ: ${categoryFilter}`} size="small" onDelete={() => setView('articles')}
                      sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, bgcolor: `${ACCENT}1f`, color: ACCENT, border: `1px solid ${ACCENT}55`,
                        '& .MuiChip-deleteIcon': { color: ACCENT } }} />
                  )}
                </Box>
                <TextField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="記事を検索" size="small"
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: '1.05rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} /></InputAdornment>, sx: { color: 'var(--brand-fg)', fontSize: '0.82rem' } }}
                  sx={{ width: 230, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.14)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }} />
              </Box>

              <Paper sx={{ bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 2, overflow: 'hidden' }}>
                {/* ヘッダ行 */}
                <Box sx={{ display: 'grid', gridTemplateColumns: COLS, gap: 1.5, alignItems: 'center', px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.line}`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', fontSize: '0.76rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                  <Box sx={cell}>タイトル</Box>
                  <Box sx={cell}>状況</Box>
                  <Box sx={cell}>カテゴリ</Box>
                  <Box sx={cell}>更新日時</Box>
                  <Box sx={{ ...cell, justifyContent: 'flex-end' }}>操作</Box>
                </Box>

                {filtered.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.85rem' }}>
                    {articles.length === 0 ? 'まだ公式記事がありません。「新規記事」から書き始めましょう。' : '条件に一致する記事はありません。'}
                  </Box>
                ) : filtered.map((a: OfficialArticle) => (
                  <Box key={a.id} onClick={() => void startEdit(a.id)}
                    sx={{ display: 'grid', gridTemplateColumns: COLS, gap: 1.5, alignItems: 'center', px: 1.5, py: 1, cursor: 'pointer', borderBottom: `1px solid ${BRAND.line}`, transition: 'background 0.12s', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' }, '&:last-of-type': { borderBottom: 'none' } }}>
                    <Box sx={{ ...cell, gap: 1.25 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${BRAND.line}` }}>
                        {a.status === 'published' ? <PublicRoundedIcon sx={{ fontSize: '1rem', color: 'light-dark(#357838, #81c784)' }} /> : <ArticleRoundedIcon sx={{ fontSize: '1rem', color: ACCENT }} />}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.86rem' }}>{a.title || '(無題)'}</Typography>
                        <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{a.excerpt || '本文なし'}</Typography>
                      </Box>
                    </Box>
                    <Box sx={cell}><StatusBadge status={a.status} /></Box>
                    <Box sx={cell}><Typography noWrap sx={{ fontSize: '0.76rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{a.category?.name || '—'}</Typography></Box>
                    <Box sx={{ ...cell, color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.74rem' }}>{fmtDateTime(a.updatedAt)}</Box>
                    <Box sx={{ ...cell, justifyContent: 'flex-end', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="編集"><IconButton size="small" onClick={() => void startEdit(a.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: 'var(--brand-fg)' } }}><LaunchRoundedIcon sx={{ fontSize: '1.05rem' }} /></IconButton></Tooltip>
                      <Tooltip title="削除"><IconButton size="small" onClick={() => setConfirm({ id: a.id, title: a.title || '(無題)' })} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'light-dark(#a50832, #fa9bb4)' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: '1.05rem' }} /></IconButton></Tooltip>
                    </Box>
                  </Box>
                ))}
              </Paper>
            </>
          )}
        </Box>
      </Box>

      {/* 削除確認 */}
      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 420, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>記事を削除</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>「{confirm?.title}」を削除します。この操作は取り消せません。</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={() => void doDelete()} disabled={busy} variant="contained" sx={{ bgcolor: '#ef4444', color: 'var(--brand-fg)', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>
            {busy ? '処理中...' : '削除する'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
