/**
 * SECTION 1「素材」の閲覧・編集で共有する小さな表示パーツ。
 * MaterialSection（閲覧）と MaterialEditor（編集）の双方から import される。
 * 循環 import を避けるため、このファイルは他のセクション用ファイルを import しない。
 */
import React from 'react';
import { Box } from '@mui/material';
import type { SwatchVisual } from '../../../utils/materialSectionView';

/** ヘッダー右側の件数ピル。SECTION 5（ProductsSection）の CountPill と同じ見た目。 */
export const CountPill: React.FC<{ label: string }> = ({ label }) => (
  <Box
    sx={{
      fontSize: 11, fontWeight: 600, color: '#93c5fd',
      border: '1px solid rgba(147,197,253,0.35)', borderRadius: '999px',
      padding: '3px 10px', whiteSpace: 'nowrap',
    }}
  >
    {label}
  </Box>
);

/** 丸スウォッチ。テクスチャ画像があれば敷き、無ければ色のベタ塗り。 */
export const Swatch: React.FC<{
  visual: SwatchVisual;
  selected: boolean;
  title: string;
  onClick: () => void;
}> = ({ visual, selected, title, onClick }) => (
  <Box
    component="button"
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={selected}
    onClick={onClick}
    sx={{
      width: 44, height: 44, flex: 'none', padding: 0, borderRadius: '50%',
      overflow: 'hidden', cursor: 'pointer', bgcolor: visual.color,
      border: selected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.18)',
      transition: 'border-color 0.15s, transform 0.15s',
      '&:hover': { borderColor: selected ? '#3b82f6' : 'rgba(255,255,255,0.45)', transform: 'scale(1.06)' },
    }}
  >
    {visual.imageUrl && (
      <Box component="img" src={visual.imageUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    )}
  </Box>
);
