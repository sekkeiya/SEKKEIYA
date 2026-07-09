import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, Box, Typography, IconButton, CircularProgress, Button, Checkbox } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import type { CatalogMatch, CatalogIndexMeta } from './searchCatalog';
import type { CatalogLink } from '../utils/lensResultsSearch';
import { openExternalUrl } from '../utils/productImageSearch';

interface Props {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  progressText?: string | null;
  error?: string | null;
  queryImage?: string | null;   // クエリ（3Dモデルサムネ）プレビュー
  modelTitle?: string | null;
  matches: CatalogMatch[];
  sources?: CatalogIndexMeta[]; // 索引済みのカタログ/サイト
  canRegister?: boolean;        // 著者のみカタログ登録できる
  registering?: boolean;
  onRegister?: (links: CatalogLink[]) => void;
}

function hostOf(u?: string): string {
  try { return u ? new URL(u).host : ''; } catch { return ''; }
}
function matchToLink(m: CatalogMatch): CatalogLink {
  return {
    title: m.label || m.catalogTitle || 'カタログ商品',
    url: m.productUrl || '',
    price: m.price || undefined,
    thumbnail: m.cropDataUrl || undefined,
    source: hostOf(m.productUrl) || undefined,
  };
}

/** 索引済みソース（カタログ/サイト）の一覧表示。 */
const SourcesSection: React.FC<{ sources: CatalogIndexMeta[] }> = ({ sources }) => {
  if (!sources.length) return null;
  const totalItems = sources.reduce((s, m) => s + (m.itemCount || 0), 0);
  return (
    <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Inventory2RoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'light-dark(rgba(31,41,55,0.85), rgba(229,231,235,0.85))' }}>
          索引済みソース（{sources.length}件・商品{totalItems}点）
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {sources.map((s) => (
          <Box key={s.catalogEntryId} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' }}>
            <MenuBookRoundedIcon sx={{ fontSize: 15, color: 'light-dark(#0474a9, #7dd3fc)', flexShrink: 0 }} />
            <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{s.catalogTitle}</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.9)', flexShrink: 0 }}>{s.itemCount}点</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/** S.Library カタログとの視覚類似検索結果を表示するダイアログ。 */
export const CatalogMatchDialog: React.FC<Props> = ({
  open, onClose, busy, progressText, error, queryImage, modelTitle, matches, sources = [],
  canRegister = false, registering = false, onRegister,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) setSelected(new Set()); }, [open, matches]);

  // 登録できるのは商品URLを持つ（Web）マッチのみ。
  const registrable = useMemo(() => matches.filter((m) => !!m.productUrl), [matches]);
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectedLinks = useMemo(
    () => registrable.filter((m) => selected.has(m.id)).map(matchToLink),
    [registrable, selected],
  );
  const autoLinks = useMemo(() => registrable.slice(0, 5).map(matchToLink), [registrable]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.22)', borderRadius: 2, height: 'min(86vh, 820px)' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }}>
        <MenuBookRoundedIcon sx={{ fontSize: 20, color: 'light-dark(#0352aa, #93c5fd)' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>S.Library カタログ照合</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 2カラム: 左=結果グリッド（スクロール）／右=サイドバー（クエリ・登録・索引済みソース） */}
      <Box sx={{ display: 'flex', minHeight: 0, flex: 1 }}>
        {/* 左: 結果グリッド */}
        <Box sx={{ flex: 1, minWidth: 0, p: 2.5, overflowY: 'auto' }}>
        {busy && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 4, justifyContent: 'center' }}>
            <CircularProgress size={20} sx={{ color: 'light-dark(#0352aa, #93c5fd)' }} />
            <Typography sx={{ fontSize: 13, color: 'light-dark(rgba(31,41,55,0.85), rgba(229,231,235,0.85))' }}>{progressText || '照合中…'}</Typography>
          </Box>
        )}

        {!busy && error && (
          <Typography sx={{ color: 'light-dark(#a80606, #fca5a5)', fontSize: 13, py: 3, textAlign: 'center', whiteSpace: 'pre-wrap' }}>{error}</Typography>
        )}

        {!busy && !error && matches.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            {sources.length === 0 ? (
              <>
                <Typography sx={{ fontSize: 13, color: 'light-dark(rgba(31,41,55,0.8), rgba(229,231,235,0.8))' }}>まだ索引化されたソースがありません。</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.8)', mt: 0.5 }}>
                  S.Library でインテリアカタログ（PDF）や家具サイト（Web）を索引化すると、ここに近い商品が表示されます。
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 13, color: 'light-dark(rgba(31,41,55,0.8), rgba(229,231,235,0.8))' }}>このモデルに近い商品は見つかりませんでした。</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.8)', mt: 0.5 }}>
                  右の索引済みソースの中に、形・素材が近い商品がなかった可能性があります。
                </Typography>
              </>
            )}
          </Box>
        )}

        {!busy && !error && matches.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
            {matches.map((m) => {
              const isWeb = m.sourceType === 'web';
              const clickable = isWeb && !!m.productUrl;
              const isReg = !!m.productUrl;
              const isSel = selected.has(m.id);
              return (
              <Box
                key={m.id}
                onClick={isReg ? () => toggle(m.id) : (clickable ? () => openExternalUrl(m.productUrl!) : undefined)}
                sx={{
                  borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                  border: isSel ? '1.5px solid #86efac' : '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                  cursor: (isReg || clickable) ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                  '&:hover': (isReg || clickable) ? { borderColor: isSel ? '#86efac' : 'rgba(96,165,250,0.6)' } : undefined,
                }}
              >
                <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))' }}>
                  <img src={m.cropDataUrl} alt={m.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  {isReg && (
                    <Checkbox
                      checked={isSel}
                      size="small"
                      onClick={(e) => { e.stopPropagation(); toggle(m.id); }}
                      sx={{ position: 'absolute', top: 2, left: 2, zIndex: 2, color: 'rgb(var(--brand-fg-rgb) / 0.7)', '&.Mui-checked': { color: 'light-dark(#149944, #86efac)' }, bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', p: 0.25, borderRadius: 1 }}
                    />
                  )}
                  {clickable && (
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openExternalUrl(m.productUrl!); }}
                      sx={{ position: 'absolute', bottom: 2, right: 2, zIndex: 2, color: 'var(--brand-fg)', bgcolor: 'rgba(0,0,0,0.4)', p: 0.4, '&:hover': { color: 'light-dark(#0352aa, #93c5fd)', bgcolor: 'rgba(0,0,0,0.6)' } }}
                    >
                      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  )}
                  <Box sx={{ position: 'absolute', top: 4, right: 4, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(22,163,74,0.85)', fontSize: 10.5, fontWeight: 700 }}>
                    {Math.round(m.similarity * 100)}%
                  </Box>
                </Box>
                <Box sx={{ p: 1 }}>
                  <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600 }}>{isWeb ? (m.label || m.catalogTitle) : m.catalogTitle}</Typography>
                  {isWeb ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, mt: 0.25 }}>
                      <Typography noWrap sx={{ fontSize: 11, color: 'light-dark(#149944, #86efac)', fontWeight: 700 }}>{m.price || ''}</Typography>
                      {clickable && <OpenInNewRoundedIcon sx={{ fontSize: 13, color: 'light-dark(#0352aa, #93c5fd)', flexShrink: 0 }} />}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }}>p.{m.page} ・ {m.label}</Typography>
                  )}
                </Box>
              </Box>
              );
            })}
          </Box>
        )}
        </Box>

        {/* 右: サイドバー（クエリ・登録・索引済みソース） */}
        <Box sx={{ width: 308, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* クエリ（このモデル） */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
            {queryImage && (
              <Box sx={{ width: 56, height: 44, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }}>
                <img src={queryImage} alt="query" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }}>このモデルに近いカタログ商品</Typography>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{modelTitle || '選択中のモデル'}</Typography>
            </Box>
          </Box>

          {/* 登録アクション */}
          {!busy && !error && registrable.length > 0 && onRegister && (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'rgb(var(--slate-ink-rgb) / 0.9)', textTransform: 'uppercase' }}>カタログ登録</Typography>
              <Typography sx={{ fontSize: 12, color: 'light-dark(rgba(31,41,55,0.85), rgba(229,231,235,0.85))' }}>{selected.size} 件選択中</Typography>
              {!canRegister && (
                <Typography sx={{ fontSize: 11, color: 'light-dark(rgba(170,78,3,0.9), rgba(251,146,60,0.9))' }}>※ 自分のモデルのみ登録できます</Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                disabled={!canRegister || selected.size === 0 || registering}
                onClick={() => onRegister(selectedLinks)}
                startIcon={registering ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <BookmarkAddRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', fontSize: 13, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
              >
                選択を登録（{selected.size}）
              </Button>
              <Button
                fullWidth
                variant="outlined"
                disabled={!canRegister || autoLinks.length === 0 || registering}
                onClick={() => onRegister(autoLinks)}
                startIcon={<BookmarkAddRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', fontSize: 13, color: 'light-dark(#149944, #86efac)', borderColor: 'rgba(134,239,172,0.5)', '&:hover': { borderColor: '#86efac', bgcolor: 'rgba(134,239,172,0.1)' } }}
              >
                上位{autoLinks.length}件を登録
              </Button>
            </Box>
          )}

          {/* 索引済みソース */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {!busy && <SourcesSection sources={sources} />}
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};
