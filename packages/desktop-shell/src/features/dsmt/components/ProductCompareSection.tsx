import React, { useMemo, useState } from 'react';
import { Box, Typography, Button, IconButton, Chip, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { DsmtProduct } from '../types';
import { overallScore } from '../data/manufacturers';
import { ProductRadarChart, ProductBarChart } from './ProductCharts';
import { ProductEditDialog } from './ProductEditDialog';
import { ProductImportDialog } from './ProductImportDialog';

const ACCENT = '#ec407a';

interface Props {
  products: DsmtProduct[];
  /** 商品配列が変わったとき（追加/編集/削除/取り込み）。親が永続化する。 */
  onChange: (products: DsmtProduct[]) => void;
  /** プロジェクト由来でない素材は編集不可。 */
  readOnly?: boolean;
}

const MiniBar: React.FC<{ label: string; value?: number; color: string }> = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Typography sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.5)', width: 26, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', overflow: 'hidden' }}>
      <Box sx={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, height: '100%', bgcolor: color }} />
    </Box>
  </Box>
);

export const ProductCompareSection: React.FC<Props> = ({ products, onChange, readOnly }) => {
  const [editing, setEditing] = useState<DsmtProduct | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const manufacturerCount = useMemo(
    () => new Set(products.map((p) => p.manufacturer).filter(Boolean)).size,
    [products],
  );
  // 「総合」スコアの高い順に並べたランキング（選定の目安）。
  const ranked = useMemo(() => {
    return products
      .map((p) => ({ p, score: overallScore(products, p) }))
      .sort((a, b) => b.score - a.score);
  }, [products]);
  const bestId = ranked[0]?.p.id;

  const openNew = () => { setEditing(null); setEditOpen(true); };
  const openEdit = (p: DsmtProduct) => { setEditing(p); setEditOpen(true); };

  const handleSave = (prod: DsmtProduct) => {
    const exists = products.some((p) => p.id === prod.id);
    onChange(exists ? products.map((p) => (p.id === prod.id ? prod : p)) : [...products, prod]);
    setEditOpen(false);
  };
  const handleDelete = (id: string) => onChange(products.filter((p) => p.id !== id));
  const handleImport = (drafts: DsmtProduct[]) => {
    onChange([...products, ...drafts]);
    setImportOpen(false);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StorefrontRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)' }}>リンク商品・メーカー比較</Typography>
        <Chip size="small" label={`${products.length} 商品 / ${manufacturerCount} メーカー`} sx={{ height: 20, fontSize: 10.5, color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
        <Box sx={{ flex: 1 }} />
        {!readOnly && (
          <>
            <Button size="small" startIcon={<LinkRoundedIcon />} onClick={() => setImportOpen(true)}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', textTransform: 'none', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }} variant="outlined">
              URLから取り込み
            </Button>
            <Button size="small" startIcon={<AddRoundedIcon />} onClick={openNew}
              sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', textTransform: 'none', '&:hover': { bgcolor: '#f06292' } }} variant="contained">
              商品を追加
            </Button>
          </>
        )}
      </Box>

      <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 1.5 }}>
        このマテリアルに該当する実商品を複数メーカー分リンクし、価格・耐久・防火で比較して選定します。
      </Typography>

      {/* 複数メーカー推奨の警告 */}
      {!readOnly && products.length > 0 && manufacturerCount < 2 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,167,38,0.1)', border: '1px solid rgba(255,167,38,0.3)' }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#ad6700, #ffa726)' }} />
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>比較するには 2 社以上の商品を登録してください。</Typography>
        </Box>
      )}

      {products.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', borderRadius: 2, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.15)' }}>
          <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>まだ商品がリンクされていません。</Typography>
          {!readOnly && <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 0.5 }}>「商品を追加」または「URLから取り込み」で複数メーカーの商品を登録してください。</Typography>}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 商品カード一覧 */}
          <Box sx={{ flex: '1 1 360px', minWidth: 320, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.25 }}>
            {ranked.map(({ p, score }) => (
              <Box key={p.id} sx={{
                position: 'relative', borderRadius: 2, p: 1.25, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                border: `1px solid ${p.id === bestId ? `${ACCENT}88` : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
              }}>
                {p.id === bestId && (
                  <Chip size="small" label="総合トップ" sx={{ position: 'absolute', top: -9, left: 10, height: 18, fontSize: 9.5, color: 'var(--brand-fg)', bgcolor: ACCENT }} />
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: 1, overflow: 'hidden', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <StorefrontRoundedIcon sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontSize: 10.5, color: ACCENT, fontWeight: 600 }}>{p.manufacturer || '—'}</Typography>
                    <Typography noWrap sx={{ fontSize: 12.5, color: 'var(--brand-fg)', fontWeight: 600 }}>{p.name || '無題'}</Typography>
                    <Typography noWrap sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>{p.code || ''}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>総合</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1 }}>{score}</Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: 11, color: 'var(--brand-fg)' }}>
                    {typeof p.price === 'number' ? `¥${p.price.toLocaleString()} / ${p.priceUnit || '㎡'}` : <span style={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>価格未設定</span>}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.75 }}>
                  <MiniBar label="耐久" value={p.durability} color="#4dd0e1" />
                  <MiniBar label="防火" value={p.fireSafety} color="#ff8a80" />
                </Box>
                {p.fireRating && <Chip size="small" label={p.fireRating} sx={{ mt: 0.75, height: 17, fontSize: 9.5, color: 'var(--brand-fg)', bgcolor: 'rgba(255,138,128,0.2)', border: '1px solid rgba(255,138,128,0.4)' }} />}

                <Box sx={{ display: 'flex', gap: 0.25, mt: 0.75, justifyContent: 'flex-end' }}>
                  {p.url && (
                    <Tooltip title="商品ページを開く">
                      <IconButton size="small" onClick={() => window.open(p.url, '_blank')} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><OpenInNewRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                    </Tooltip>
                  )}
                  {!readOnly && (
                    <>
                      <IconButton size="small" onClick={() => openEdit(p)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><EditRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                      <IconButton size="small" onClick={() => handleDelete(p.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ff5252' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                    </>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* 比較グラフ */}
          <Box sx={{ flex: '1 1 300px', minWidth: 280, borderRadius: 2, p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 1 }}>総合バランス（レーダー）</Typography>
            <ProductRadarChart products={products} />
            <Box sx={{ my: 2, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 1 }}>軸別比較（棒グラフ）</Typography>
            <ProductBarChart products={products} />
          </Box>
        </Box>
      )}

      <ProductEditDialog open={editOpen} product={editing} onClose={() => setEditOpen(false)} onSave={handleSave} />
      <ProductImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </Box>
  );
};
