// 共有結果サーフェス（バケツ）。
// retrieval 層（searchCatalogByText / searchCatalogByImage）が返した商品アイテムを
// 視覚的なグリッドで並べる。SEKKEIYA Search の家具モード／将来は Chat の検索結果着地に共用。
// 仕様: docs/16_sekkeiya_search_spec.md

import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { CatalogVisionItem } from '../dsk/catalog/catalogVisionStore';
import { openExternalUrl } from '../dss/utils/productImageSearch';
import { ProductDetailDialog } from './ProductDetailDialog';

export type ProductResultItem = CatalogVisionItem & { similarity?: number };

interface ProductResultGridProps {
  items: ProductResultItem[];
  /** カードの最小幅（px）。狭い場所では小さく。 */
  minTile?: number;
}

/** 商品グリッド。Web商品は購入リンク（クリックで外部ブラウザ）付き。 */
export const ProductResultGrid: React.FC<ProductResultGridProps> = ({ items, minTile = 150 }) => {
  // カードクリックで索引商品の詳細モーダルを開く（←→で前後送り）。外部ページは角のアイコン or 詳細内ボタンから。
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  if (!items.length) return null;
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minTile}px, 1fr))`, gap: 1.5 }}>
        {items.map((m, i) => {
          const isWeb = m.sourceType === 'web';
          const clickable = isWeb && !!m.productUrl;
          return (
            <Box
              key={m.id}
              onClick={() => setDetailIndex(i)}
              sx={{
                borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                '&:hover': { borderColor: 'rgba(96,165,250,0.6)' },
              }}
            >
              <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))' }}>
                <img src={m.cropDataUrl} alt={m.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                {clickable && (
                  <Tooltip title="購入ページを開く">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openExternalUrl(m.productUrl!); }}
                      sx={{ position: 'absolute', bottom: 2, right: 2, zIndex: 2, color: 'var(--brand-fg)', bgcolor: 'rgba(0,0,0,0.4)', p: 0.4, '&:hover': { color: 'light-dark(#0352aa, #93c5fd)', bgcolor: 'rgba(0,0,0,0.6)' } }}
                    >
                      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {m.similarity != null && (
                  <Box sx={{ position: 'absolute', top: 4, right: 4, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(22,163,74,0.85)', fontSize: 10.5, fontWeight: 700, color: 'var(--brand-fg)' }}>
                    {Math.round(m.similarity * 100)}%
                  </Box>
                )}
              </Box>
              <Box sx={{ p: 1 }}>
                <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-fg)' }}>
                  {isWeb ? (m.label || m.catalogTitle) : m.catalogTitle}
                </Typography>
                {isWeb ? (
                  <Typography noWrap sx={{ fontSize: 11, color: 'light-dark(#149944, #86efac)', fontWeight: 700, mt: 0.25 }}>{m.price || ''}</Typography>
                ) : (
                  <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }}>p.{m.page} ・ {m.label}</Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      <ProductDetailDialog items={items} index={detailIndex} onClose={() => setDetailIndex(null)} />
    </>
  );
};
