import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, InputBase, IconButton,
  Chip, CircularProgress, Tooltip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import type { ResearchCanvasItem } from '../../features/projects/repositories/ResearchCanvasRepository';
import type { LibraryEntry } from '../../features/dsk/types';
import type { BlogArticle } from '../../features/dsb/types';

/** ピッカーからキャンバスへ渡すアイテム（座標・IDはキャンバス側で採番） */
export type PickedBoardItem = Omit<ResearchCanvasItem, 'id' | 'x' | 'y' | 'createdAt' | 'updatedAt'>;

type SourceFilter = 'all' | 'library' | 'article';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 選んだ知識をキャンバスに置く（複数可） */
  onPick: (items: PickedBoardItem[]) => void;
}

/**
 * 知識ピッカー: S.Library のエントリと S.Blog の記事を横断検索して、
 * リサーチボードに「ソースカード」「引用カード（要点）」として取り込む。
 */
export const KnowledgePickerDialog: React.FC<Props> = ({ open, onClose, onPick }) => {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // S.Library はローカル（Tauri）、S.Blog は Firestore。片方が失敗しても他方は出す。
      const [lib, blog] = await Promise.all([
        import('../../features/dsk/api/knowledgeApi')
          .then(m => m.getLocalKnowledge())
          .catch(() => [] as LibraryEntry[]),
        (async () => {
          const { useAuthStore } = await import('../../store/useAuthStore');
          const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;
          if (!uid) return [] as BlogArticle[];
          const { listBlogArticles } = await import('../../features/dsb/api/blogApi');
          return listBlogArticles(uid);
        })().catch(() => [] as BlogArticle[]),
      ]);
      if (cancelled) return;
      setEntries(lib);
      setArticles(blog);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const q = search.trim().toLowerCase();
  const matches = (...fields: Array<string | null | undefined>) =>
    !q || fields.some(f => (f || '').toLowerCase().includes(q));

  const libraryRows = useMemo(
    () => (filter === 'article' ? [] : entries.filter(e => matches(e.title, e.category, e.tags.join(' '), e.summary))),
    [entries, filter, q], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const articleRows = useMemo(
    () => (filter === 'library' ? [] : articles.filter(a => matches(a.title, a.category, a.tags.join(' '), a.excerpt))),
    [articles, filter, q], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const addLibrarySource = (e: LibraryEntry) => {
    onPick([{
      kind: 'source', refType: 'library', refId: e.localId, refTitle: e.title,
      refMeta: e.category || undefined, url: e.sourceUrl || undefined,
    }]);
  };
  const addLibraryQuotes = (e: LibraryEntry) => {
    const points = (e.keyPoints || []).filter(Boolean);
    if (points.length === 0) return;
    onPick(points.map(text => ({
      kind: 'quote', text, refType: 'library', refId: e.localId, refTitle: e.title,
    })));
  };
  const addArticleSource = (a: BlogArticle) => {
    onPick([{
      kind: 'source', refType: 'article', refId: a.id, refTitle: a.title,
      refMeta: a.category || undefined,
    }]);
  };
  const addArticleQuote = (a: BlogArticle) => {
    if (!a.excerpt) return;
    onPick([{ kind: 'quote', text: a.excerpt, refType: 'article', refId: a.id, refTitle: a.title }]);
  };

  const rowSx = {
    display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.9, borderRadius: 2,
    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', '& .picker-actions': { opacity: 1 } },
  } as const;
  const actionSx = { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#00BFFF' } } as const;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)', height: '70vh' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        知識をボードに取り込む
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: '4px !important' }}>
        {/* 検索 + フィルタ */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 2,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
        }}>
          <SearchRoundedIcon sx={{ fontSize: 17, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
          <InputBase autoFocus fullWidth value={search} onChange={e => setSearch(e.target.value)}
            placeholder="タイトル・カテゴリ・タグで検索..."
            sx={{ fontSize: 13, color: 'var(--brand-fg)' }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {([
            { key: 'all', label: 'すべて' },
            { key: 'library', label: 'S.Library' },
            { key: 'article', label: 'S.Blog' },
          ] as const).map(f => (
            <Chip key={f.key} label={f.label} size="small" onClick={() => setFilter(f.key)}
              sx={{
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                bgcolor: filter === f.key ? 'rgba(0,191,255,0.15)' : 'rgb(var(--brand-fg-rgb) / 0.06)',
                color: filter === f.key ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                border: '1px solid', borderColor: filter === f.key ? 'rgba(0,191,255,0.4)' : 'transparent',
              }} />
          ))}
        </Box>

        {/* 一覧 */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
              <CircularProgress size={22} sx={{ color: '#00BFFF' }} />
            </Box>
          ) : (
            <>
              {libraryRows.length > 0 && (
                <Typography sx={{ px: 1.25, pt: 1, pb: 0.5, fontSize: 10.5, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  S.LIBRARY（{libraryRows.length}）
                </Typography>
              )}
              {libraryRows.map(e => (
                <Box key={e.localId} sx={rowSx}>
                  <MenuBookRoundedIcon sx={{ fontSize: 18, color: '#26a69a', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                      {e.kind} / {e.category}{(e.keyPoints || []).length > 0 ? ` / 要点 ${e.keyPoints.length}` : ''}
                    </Typography>
                  </Box>
                  <Box className="picker-actions" sx={{ display: 'flex', gap: 0.25, opacity: 0.35, transition: 'opacity .12s' }}>
                    <Tooltip title="ソースカードを置く">
                      <IconButton size="small" sx={actionSx} onClick={() => addLibrarySource(e)}>
                        <AddCircleOutlineRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={(e.keyPoints || []).length > 0 ? '要点を引用カードで置く' : '要点（AI要約）がありません'}>
                      <span>
                        <IconButton size="small" sx={actionSx} disabled={(e.keyPoints || []).length === 0}
                          onClick={() => addLibraryQuotes(e)}>
                          <FormatQuoteRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ))}

              {articleRows.length > 0 && (
                <Typography sx={{ px: 1.25, pt: 1.5, pb: 0.5, fontSize: 10.5, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  S.BLOG（{articleRows.length}）
                </Typography>
              )}
              {articleRows.map(a => (
                <Box key={a.id} sx={rowSx}>
                  <ArticleRoundedIcon sx={{ fontSize: 18, color: '#ff8a65', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.title}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                      {a.status === 'published' ? '公開済み' : '下書き'} / {a.category}
                    </Typography>
                  </Box>
                  <Box className="picker-actions" sx={{ display: 'flex', gap: 0.25, opacity: 0.35, transition: 'opacity .12s' }}>
                    <Tooltip title="ソースカードを置く">
                      <IconButton size="small" sx={actionSx} onClick={() => addArticleSource(a)}>
                        <AddCircleOutlineRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={a.excerpt ? '要約を引用カードで置く' : '要約がありません'}>
                      <span>
                        <IconButton size="small" sx={actionSx} disabled={!a.excerpt}
                          onClick={() => addArticleQuote(a)}>
                          <FormatQuoteRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ))}

              {libraryRows.length === 0 && articleRows.length === 0 && (
                <Typography sx={{ textAlign: 'center', pt: 6, fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  該当する知識がありません
                </Typography>
              )}
            </>
          )}
        </Box>

        <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
          カードは出典（S.Library / S.Blog）に紐づいたまま置かれ、クリックでいつでも原典に戻れます
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgePickerDialog;
