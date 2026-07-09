import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Button, IconButton, Chip, CircularProgress, Tooltip, Menu, MenuItem } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { getAllItems, getAllMeta, deleteCatalogItems, type CatalogVisionItem, type CatalogIndexMeta } from './catalogVisionStore';
import { openExternalUrl } from '../../dss/utils/productImageSearch';
import { ProductDetailPanel } from './ProductDetailPanel';

const ACCENT = '#26a69a';

/**
 * S.Library「索引商品」ビュー。カタログ/サイトから索引化した商品を
 * ソース別にグリッド表示する。各カードはサムネ＋名前＋価格＋購入リンク。
 */
export const IndexedProductsView: React.FC = () => {
  const [items, setItems] = useState<CatalogVisionItem[]>([]);
  const [metas, setMetas] = useState<CatalogIndexMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<string>('all');
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; sourceId: string } | null>(null);
  // メインエリア全画面の詳細（S.Model 詳細と同様）。visible 配列内のインデックスで前後送り。
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const PAGE = 120;
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); setDetailIndex(null); }, [activeSource]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [its, ms] = await Promise.all([getAllItems(), getAllMeta()]);
      its.sort((a, b) => (b.score || 0) - (a.score || 0));
      setItems(its);
      setMetas(ms);
    } catch (e) {
      console.error('[IndexedProductsView] load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sources = useMemo(() => {
    // メタに無いソースも items から拾う（後方互換）。
    const byId = new Map<string, { id: string; title: string; count: number }>();
    for (const m of metas) byId.set(m.catalogEntryId, { id: m.catalogEntryId, title: m.catalogTitle, count: m.itemCount });
    for (const it of items) {
      if (!byId.has(it.catalogEntryId)) byId.set(it.catalogEntryId, { id: it.catalogEntryId, title: it.catalogTitle, count: 0 });
    }
    return Array.from(byId.values());
  }, [metas, items]);

  const visible = useMemo(
    () => (activeSource === 'all' ? items : items.filter((it) => it.catalogEntryId === activeSource)),
    [items, activeSource],
  );

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    setMenuAnchor(null);
    await deleteCatalogItems(sourceId);
    if (activeSource === sourceId) setActiveSource('all');
    await load();
  }, [activeSource, load]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {/* ヘッダ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 1 }}>
        <Inventory2RoundedIcon sx={{ color: ACCENT, fontSize: 22 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>KNOWLEDGE LIBRARY ・ 索引商品</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.1 }}>索引済み商品</Typography>
        </Box>
        <Tooltip title="再読み込み">
          <IconButton size="small" onClick={load} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
            <RefreshRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ソースタブ（詳細表示中は隠す） */}
      <Box sx={{ display: detailIndex !== null ? 'none' : 'flex', gap: 1, px: 3, py: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`すべて (${items.length})`}
          size="small"
          onClick={() => setActiveSource('all')}
          sx={chipSx(activeSource === 'all')}
        />
        {sources.map((s) => (
          <Chip
            key={s.id}
            label={`${s.title}`}
            size="small"
            onClick={() => setActiveSource(s.id)}
            onDelete={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget as HTMLElement, sourceId: s.id }); }}
            deleteIcon={<MoreVertRoundedIcon />}
            sx={chipSx(activeSource === s.id)}
          />
        ))}
      </Box>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.22)' } } }}>
        <MenuItem onClick={() => menuAnchor && handleDeleteSource(menuAnchor.sourceId)} sx={{ fontSize: 13, color: 'light-dark(#a80606, #fca5a5)' }}>
          <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} /> このソースの索引を削除
        </MenuItem>
      </Menu>

      {/* グリッド / メインエリア詳細 */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
        {detailIndex !== null && visible[detailIndex] ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1, mb: 1 }}>
              <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => setDetailIndex(null)} size="small" sx={{ color: 'var(--brand-fg)' }}>
                一覧に戻る
              </Button>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{detailIndex + 1} / {visible.length}</Typography>
            </Box>
            <Box sx={{ maxWidth: 560, mx: 'auto' }}>
              <ProductDetailPanel
                item={visible[detailIndex]}
                onPrev={detailIndex > 0 ? () => setDetailIndex(detailIndex - 1) : undefined}
                onNext={detailIndex < visible.length - 1 ? () => setDetailIndex(detailIndex + 1) : undefined}
              />
            </Box>
          </Box>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={26} sx={{ color: ACCENT }} /></Box>
        ) : visible.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
            <Typography sx={{ fontSize: 13 }}>索引済みの商品がありません。</Typography>
            <Typography sx={{ fontSize: 11.5, mt: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              「Web」エントリで「サイトを商品索引化」、または PDF カタログで「カタログ照合に索引化」を実行してください。
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.75, pt: 1 }}>
            {visible.slice(0, limit).map((it, i) => {
              const clickable = it.sourceType === 'web' && !!it.productUrl;
              return (
                <Box
                  key={it.id}
                  onClick={() => setDetailIndex(i)}
                  sx={{
                    borderRadius: 2, overflow: 'hidden', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                    cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s',
                    '&:hover': { borderColor: 'rgba(38,166,154,0.6)', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ aspectRatio: '1/1', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))' }}>
                    <img src={it.cropDataUrl} alt={it.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </Box>
                  <Box sx={{ p: 1 }}>
                    <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-fg)' }}>{it.label || '商品'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, mt: 0.25 }}>
                      {it.sourceType === 'web' ? (
                        <>
                          <Typography noWrap sx={{ fontSize: 11.5, color: 'light-dark(#149944, #86efac)', fontWeight: 700 }}>{it.price || ''}</Typography>
                          {clickable && (
                            <Tooltip title="購入ページを開く">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); openExternalUrl(it.productUrl!); }}
                                sx={{ p: 0.25, color: 'light-dark(#0352aa, #93c5fd)', '&:hover': { color: 'light-dark(#034dab, #bfdbfe)' } }}>
                                <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      ) : (
                        <Typography noWrap sx={{ fontSize: 10.5, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }}>p.{it.page} ・ {it.catalogTitle}</Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        {detailIndex === null && !loading && visible.length > limit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
            <Button variant="outlined" size="small" onClick={() => setLimit((n) => n + PAGE)}
              sx={{ color: 'light-dark(#0474a9, #7dd3fc)', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}>
              もっと見る（残り {visible.length - limit} 件）
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

function chipSx(active: boolean) {
  return {
    height: 28, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    bgcolor: active ? 'rgba(38,166,154,0.22)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
    color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
    border: active ? '1px solid rgba(38,166,154,0.5)' : '1px solid transparent',
    '& .MuiChip-deleteIcon': { color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 16, '&:hover': { color: 'var(--brand-fg)' } },
    '&:hover': { bgcolor: active ? 'rgba(38,166,154,0.28)' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
  };
}
