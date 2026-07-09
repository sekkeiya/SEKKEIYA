// 索引商品の詳細コンテンツ（共通）。
// - S.Library: メインエリア全画面詳細（IndexedProductsView）
// - Chat / SEKKEIYA Search: モーダル（ProductDetailDialog、←→で前後送り）
// 画像・名前・価格・ブランド・カテゴリ・タグ・出典＋ワークフロー導線（購入 / S.Layoutに配置）。
import React from 'react';
import { Box, Typography, Button, Chip, IconButton, Tooltip } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import WeekendRoundedIcon from '@mui/icons-material/WeekendRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import type { CatalogVisionItem } from './catalogVisionStore';
import { openExternalUrl } from '../../dss/utils/productImageSearch';
import { PRODUCT_SEARCH_MODES, catalogItemMatchesKind } from '../data/sourceRegistry';
import { useAppStore } from '../../../store/useAppStore';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ mb: 1.25 }}>
    <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', mb: 0.25 }}>{label}</Typography>
    {children}
  </Box>
);

interface ProductDetailPanelProps {
  item: CatalogVisionItem | null;
  /** 前後送り（指定時のみ矢印を表示）。 */
  onPrev?: () => void;
  onNext?: () => void;
}

export const ProductDetailPanel: React.FC<ProductDetailPanelProps> = ({ item, onPrev, onNext }) => {
  // S.Layout を開く（ワークフロー導線）。現状は2D参照のため配置の足がかりとして遷移する。
  const goToLayout = () => {
    const s = useAppStore.getState() as any;
    try {
      if (s.pinnedTabIds && !s.pinnedTabIds.includes('3dsl')) s.togglePinnedTab?.('3dsl');
      s.setActiveWorkspaceId?.('layout');
      s.setLastActiveAppScope?.('3dsl');
      s.setCurrentMainView?.('workspace');
    } catch (e) { console.error('[ProductDetail] goToLayout failed', e); }
  };

  if (!item) {
    return (
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        <Inventory2RoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />
        <Typography sx={{ fontSize: 12.5 }}>商品を選択すると詳細が表示されます</Typography>
      </Box>
    );
  }
  const isWeb = item.sourceType === 'web';
  // 旧索引（分類なし）でも種類を推定して表示する。
  const inferredKind = PRODUCT_SEARCH_MODES.find((m) => catalogItemMatchesKind(item, m.kind));
  const categoryLabel = item.category || (inferredKind ? `${inferredKind.label}（推定）` : null);
  const showNav = !!(onPrev || onNext);

  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      {showNav && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Tooltip title="前の商品（←）">
            <span><IconButton size="small" disabled={!onPrev} onClick={onPrev} sx={{ color: '#cbd5e1' }}><ChevronLeftRoundedIcon /></IconButton></span>
          </Tooltip>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>← → で前後の商品</Typography>
          <Tooltip title="次の商品（→）">
            <span><IconButton size="small" disabled={!onNext} onClick={onNext} sx={{ color: '#cbd5e1' }}><ChevronRightRoundedIcon /></IconButton></span>
          </Tooltip>
        </Box>
      )}

      <Box sx={{ aspectRatio: '1/1', borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.3)', mb: 1.5, border: '1px solid rgba(255,255,255,0.08)' }}>
        <img src={item.cropDataUrl} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </Box>

      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.35, mb: 0.5 }}>{item.label || '商品'}</Typography>
      {item.price && <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#86efac', mb: 1.25 }}>{item.price}</Typography>}

      {/* ワークフロー導線 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.75 }}>
        {isWeb && item.productUrl && (
          <Button
            fullWidth variant="contained" size="small"
            startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => openExternalUrl(item.productUrl!)}
            sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
          >
            購入ページを開く
          </Button>
        )}
        <Tooltip title="S.Layout を開いて検討に使う（2D参照。直接の3D配置は今後対応）">
          <Button
            fullWidth variant="outlined" size="small"
            startIcon={<WeekendRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={goToLayout}
            sx={{ color: '#c4b5fd', borderColor: 'rgba(196,181,253,0.5)', '&:hover': { borderColor: '#c4b5fd', bgcolor: 'rgba(196,181,253,0.08)' } }}
          >
            S.Layoutに配置
          </Button>
        </Tooltip>
      </Box>

      {item.brand && <Row label="ブランド"><Typography sx={{ fontSize: 12.5, color: '#e2e8f0' }}>{item.brand}</Typography></Row>}
      {categoryLabel && <Row label="カテゴリ"><Chip label={categoryLabel} size="small" sx={{ height: 22, fontSize: 11, color: '#7dd3fc', bgcolor: 'rgba(56,189,248,0.12)' }} /></Row>}
      {item.tags && item.tags.length > 0 && (
        <Row label="タグ">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {item.tags.map((t) => (
              <Chip key={t} label={t} size="small" sx={{ height: 20, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', bgcolor: 'rgba(255,255,255,0.08)' }} />
            ))}
          </Box>
        </Row>
      )}
      <Row label="出典"><Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.catalogTitle}</Typography></Row>
      {item.siteUrl && (
        <Row label="サイト">
          <Typography onClick={() => openExternalUrl(item.siteUrl!)} noWrap sx={{ fontSize: 11, color: '#7dd3fc', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            {item.siteUrl.replace(/^https?:\/\//, '')}
          </Typography>
        </Row>
      )}
      {!isWeb && <Row label="ページ"><Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>p.{item.page}</Typography></Row>}
    </Box>
  );
};
