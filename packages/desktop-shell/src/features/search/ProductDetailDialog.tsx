// 索引商品の詳細モーダル（Chat / SEKKEIYA Search のグリッドから開く）。
// items + index を受け取り、左右エッジの矢印 / 矢印キーで前後の商品にスライド切替する。
// モーダルは固定サイズ（どの商品でも同じ大きさ）。
import React, { useEffect, useState } from 'react';
import { Dialog, Box, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { ProductDetailPanel } from '../dsk/catalog/ProductDetailPanel';
import { SimilarModelsSidebar } from './SimilarModelsSidebar';
import type { ProductResultItem } from './ProductResultGrid';

const EDGE_BTN = {
  position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', zIndex: 3,
  color: '#e2e8f0', bgcolor: 'rgba(0,0,0,0.45)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
  '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)', bgcolor: 'rgba(0,0,0,0.25)' },
};

export const ProductDetailDialog: React.FC<{
  items: ProductResultItem[];
  index: number | null;
  onClose: () => void;
}> = ({ items, index, onClose }) => {
  const [cur, setCur] = useState<number>(index ?? 0);
  useEffect(() => { if (index != null) setCur(index); }, [index]);

  const open = index != null && items.length > 0;
  const clamped = Math.min(Math.max(cur, 0), Math.max(0, items.length - 1));
  const item = open ? items[clamped] : null;
  const hasPrev = clamped > 0;
  const hasNext = clamped < items.length - 1;
  const goPrev = () => hasPrev && setCur(clamped - 1);
  const goNext = () => hasNext && setCur(clamped + 1);

  // 矢印キーで前後送り。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, clamped, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{ paper: { sx: { bgcolor: '#0c0f18', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, width: 880, maxWidth: 'calc(100vw - 32px)', height: '82vh', m: 2 } } }}
    >
      <Box sx={{ position: 'relative', height: '100%', display: 'flex' }}>
        <IconButton
          size="small" onClick={onClose}
          sx={{ position: 'absolute', top: 6, right: 6, zIndex: 4, color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(0,0,0,0.6)' } }}
        >
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* 左右エッジの送り矢印（縦中央） */}
        <IconButton size="small" onClick={goPrev} disabled={!hasPrev} sx={{ ...EDGE_BTN, left: 6 }}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <IconButton size="small" onClick={goNext} disabled={!hasNext} sx={{ ...EDGE_BTN, right: 6 }}>
          <ChevronRightRoundedIcon />
        </IconButton>

        {/* 左: 商品詳細 / 右: 似た3Dモデル＋生成 */}
        <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          {item && <ProductDetailPanel item={item} />}
        </Box>
        {item && <SimilarModelsSidebar item={item} />}
      </Box>
    </Dialog>
  );
};
