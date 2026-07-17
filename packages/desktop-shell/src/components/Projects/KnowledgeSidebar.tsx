import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, InputBase, CircularProgress, Chip, Tooltip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import type { LibraryEntry } from '../../features/dsk/types';
import type { BlogArticle } from '../../features/dsb/types';

/** ドラッグで運ぶ知識の dataTransfer 型（ペイロードは KnowledgePick[] の JSON）。 */
export const KNOWLEDGE_DND_TYPE = 'application/x-sekkeiya-knowledge';

/** サイドバーからマインドマップへ渡す1件（トピック化はマインドマップ側で行う）。 */
export interface KnowledgePick {
  text: string;
  url?: string;
  /** トピックに載せるサムネ（S.Blog のカバー画像。S.Library はローカルパスのため無し）。 */
  image?: string;
  refType: 'library' | 'article';
  refId: string;
  refTitle: string;
}

type SourceFilter = 'all' | 'library' | 'article';

interface Props {
  open: boolean;
  onClose: () => void;
  /** クリック時: 選択中トピックの子として取り込む。 */
  onPick: (items: KnowledgePick[]) => void;
}

/**
 * マインドマップ右の知識パネル（Drive パネルと同じ右パネル形式）。
 * S.Library のエントリと S.Blog の記事を横断検索し、クリックで選択中トピックの
 * 子トピックに、ドラッグで任意のトピックの子に取り込む。
 * データ源は Drive とは別系統（S.Library=ローカル / S.Blog=Firestore）だが、
 * UI をパネルに揃えて「右パネルからカテゴリを絞って選ぶ」体験を統一する。
 */
export const KnowledgeSidebar: React.FC<Props> = ({ open, onClose, onPick }) => {
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
          const uid = useAuthStore.getState().currentUser?.uid;
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

  const libraryPick = (e: LibraryEntry): KnowledgePick => ({
    text: e.title, url: e.sourceUrl || undefined,
    refType: 'library', refId: e.localId, refTitle: e.title,
  });
  const articlePick = (a: BlogArticle): KnowledgePick => ({
    text: a.title, image: a.coverUrl || undefined,
    refType: 'article', refId: a.id, refTitle: a.title,
  });
  /** 要点をそれぞれ子トピックに（テキスト＝要点、出典は同じエントリ）。 */
  const libraryQuotePicks = (e: LibraryEntry): KnowledgePick[] =>
    (e.keyPoints || []).filter(Boolean).map(text => ({
      text, refType: 'library' as const, refId: e.localId, refTitle: e.title,
    }));

  const startDrag = (ev: React.DragEvent, picks: KnowledgePick[]) => {
    ev.dataTransfer.setData(KNOWLEDGE_DND_TYPE, JSON.stringify(picks));
    ev.dataTransfer.setData('text/plain', picks.map(p => p.text).join('\n'));
    ev.dataTransfer.effectAllowed = 'copy';
  };

  const rowSx = {
    display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.7, borderRadius: 1.5,
    cursor: 'grab',
    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', '& .picker-actions': { opacity: 1 } },
    '&:active': { cursor: 'grabbing' },
  } as const;
  const actionSx = { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#00BFFF' }, p: 0.25 } as const;
  const sectionSx = { px: 0.75, pt: 1, pb: 0.5, fontSize: 10, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.4)' } as const;

  if (!open) return null;

  return (
    <Box className="nodrag nopan" sx={{
      position: 'absolute', top: 12, right: 12, bottom: 12, width: 264, zIndex: 6,
      display: 'flex', flexDirection: 'column',
      p: 1.5, borderRadius: 3,
      bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
      boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-fg)', flex: 1 }}>
          知識（S.Library / S.Blog）
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 0.25 }}>
          <CloseRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.4, mb: 1, borderRadius: 1.5,
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
      }}>
        <SearchRoundedIcon sx={{ fontSize: 15, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
        <InputBase fullWidth value={search} onChange={e => setSearch(e.target.value)}
          placeholder="タイトル・カテゴリ・タグで検索..." sx={{ fontSize: 12, color: 'var(--brand-fg)' }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        {([
          { key: 'all', label: 'すべて' },
          { key: 'library', label: 'S.Library' },
          { key: 'article', label: 'S.Blog' },
        ] as const).map(f => (
          <Chip key={f.key} label={f.label} size="small" onClick={() => setFilter(f.key)}
            sx={{
              height: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              bgcolor: filter === f.key ? 'rgba(0,191,255,0.15)' : 'rgb(var(--brand-fg-rgb) / 0.06)',
              color: filter === f.key ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.6)',
              border: '1px solid', borderColor: filter === f.key ? 'rgba(0,191,255,0.4)' : 'transparent',
              '& .MuiChip-label': { px: 0.9 },
            }} />
        ))}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={20} sx={{ color: '#00BFFF' }} />
          </Box>
        ) : (
          <>
            {libraryRows.length > 0 && (
              <Typography sx={sectionSx}>S.LIBRARY（{libraryRows.length}）</Typography>
            )}
            {libraryRows.map(e => (
              <Box key={e.localId} sx={rowSx}
                draggable
                onDragStart={ev => startDrag(ev, [libraryPick(e)])}
                onClick={() => onPick([libraryPick(e)])}
                title={`${e.title}（クリックで選択中トピックの子に / ドラッグでトピックへ）`}>
                <MenuBookRoundedIcon sx={{ fontSize: 16, color: '#26a69a', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </Typography>
                  <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.kind} / {e.category}{(e.keyPoints || []).length > 0 ? ` / 要点 ${e.keyPoints.length}` : ''}
                  </Typography>
                </Box>
                <Box className="picker-actions" sx={{ display: 'flex', gap: 0, opacity: 0.3, transition: 'opacity .12s', flexShrink: 0 }}>
                  <Tooltip title="子トピックに取り込む">
                    <IconButton size="small" sx={actionSx}
                      onClick={ev => { ev.stopPropagation(); onPick([libraryPick(e)]); }}>
                      <AddCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={(e.keyPoints || []).length > 0 ? '要点をそれぞれ子トピックに' : '要点（AI要約）がありません'}>
                    <span>
                      <IconButton size="small" sx={actionSx} disabled={(e.keyPoints || []).length === 0}
                        onClick={ev => { ev.stopPropagation(); onPick(libraryQuotePicks(e)); }}>
                        <FormatQuoteRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            ))}

            {articleRows.length > 0 && (
              <Typography sx={sectionSx}>S.BLOG（{articleRows.length}）</Typography>
            )}
            {articleRows.map(a => (
              <Box key={a.id} sx={rowSx}
                draggable
                onDragStart={ev => startDrag(ev, [articlePick(a)])}
                onClick={() => onPick([articlePick(a)])}
                title={`${a.title}（クリックで選択中トピックの子に / ドラッグでトピックへ）`}>
                {a.coverUrl ? (
                  <Box component="img" src={a.coverUrl} alt="" draggable={false}
                    sx={{ width: 30, height: 30, borderRadius: 1, objectFit: 'cover', flexShrink: 0, pointerEvents: 'none' }} />
                ) : (
                  <ArticleRoundedIcon sx={{ fontSize: 16, color: '#ff8a65', flexShrink: 0 }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.title}
                  </Typography>
                  <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                    {a.status === 'published' ? '公開済み' : '下書き'} / {a.category}
                  </Typography>
                </Box>
                <Box className="picker-actions" sx={{ display: 'flex', gap: 0, opacity: 0.3, transition: 'opacity .12s', flexShrink: 0 }}>
                  <Tooltip title="子トピックに取り込む">
                    <IconButton size="small" sx={actionSx}
                      onClick={ev => { ev.stopPropagation(); onPick([articlePick(a)]); }}>
                      <AddCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={a.excerpt ? '要約を子トピックに' : '要約がありません'}>
                    <span>
                      <IconButton size="small" sx={actionSx} disabled={!a.excerpt}
                        onClick={ev => {
                          ev.stopPropagation();
                          if (a.excerpt) onPick([{ text: a.excerpt, refType: 'article', refId: a.id, refTitle: a.title }]);
                        }}>
                        <FormatQuoteRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            ))}

            {libraryRows.length === 0 && articleRows.length === 0 && (
              <Typography sx={{ textAlign: 'center', pt: 4, fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                該当する知識がありません
              </Typography>
            )}
          </>
        )}
      </Box>

      <Typography sx={{ mt: 1, fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.5 }}>
        クリックで選択中トピックの子に / ドラッグでトピックへ。出典に紐づいたまま取り込まれ、いつでも原典に戻れます
      </Typography>
    </Box>
  );
};

export default KnowledgeSidebar;
