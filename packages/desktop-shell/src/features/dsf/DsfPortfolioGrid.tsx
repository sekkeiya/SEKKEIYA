import React, { useMemo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { DsfPortfolioCard } from './DsfPortfolioCard';
import { useDsfStore } from './store/useDsfStore';

interface DsfPortfolioGridProps {
  portfolios: any[];
  isInitializing?: boolean;
  /** 編集可能なプロジェクト表示か（表紙バックフィルの可否） */
  canWrite?: boolean;
  onDeleteItem?: (item: any) => void;
  onOpenItem?: (item: any) => void;
}

export const DsfPortfolioGrid: React.FC<DsfPortfolioGridProps> = ({ portfolios, isInitializing, canWrite, onDeleteItem, onOpenItem }) => {
  const categoryFilter = useDsfStore(s => s.categoryFilter);
  const selectedPortfolioId = useDsfStore(s => s.selectedPortfolioId);
  const setSelectedPortfolioId = useDsfStore(s => s.setSelectedPortfolioId);

  const visible = useMemo(
    () => portfolios.filter(p => categoryFilter === 'all' || p.category === categoryFilter),
    [portfolios, categoryFilter],
  );

  if (isInitializing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: '#7e57c2' }} />
      </Box>
    );
  }

  if (visible.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgb(var(--brand-fg-rgb) / 0.4)', gap: 1.5 }}>
        <MenuBookRoundedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
        <Typography sx={{ fontSize: 14 }}>ポートフォリオがまだありません</Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.7 }}>右上の「アップロード」から PDF を追加できます</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 2,
      p: 3,
      overflowY: 'auto',
      alignContent: 'start',
    }}>
      {visible.map(p => (
        <DsfPortfolioCard
          key={p.id}
          item={p}
          active={selectedPortfolioId === p.id}
          canPersist={canWrite}
          onClick={() => { setSelectedPortfolioId(p.id); onOpenItem?.(p); }}
          onDelete={onDeleteItem ? () => onDeleteItem(p) : undefined}
        />
      ))}
    </Box>
  );
};
