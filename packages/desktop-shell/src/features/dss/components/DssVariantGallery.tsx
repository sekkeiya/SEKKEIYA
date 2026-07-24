import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import {
  readMaterialPresets, readMaterialVariants, variantSwatchColor,
  type MaterialVariant, type MaterialPresetSlot,
} from '../../shared/material/materialPresets';

/** サムネイルが無いパターン用の代替表示（部位の代表色を使ったスウォッチ）。 */
const SwatchFallback: React.FC<{ color: string }> = ({ color }) => (
  <Box sx={{
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `radial-gradient(circle at 34% 28%, rgb(var(--brand-fg-rgb) / 0.5), ${color} 62%, rgba(0,0,0,0.45))`,
  }}>
    <PaletteRoundedIcon sx={{ fontSize: 22, color: 'rgba(255,255,255,0.65)' }} />
  </Box>
);

interface Props {
  model: any;
  /** カード選択時：その素材の組み合わせをメインビューアへ適用する。null は「元の見た目」。 */
  onSelect: (variant: MaterialVariant | null) => void;
  /** 現在適用中のパターンID（null は元の見た目）。 */
  selectedVariantId: string | null;
}

/**
 * 素材バリエーション・ギャラリー。
 * 同じ家具の素材違い（脚の材、張地など）を並べて比較し、クリックで上部のビューアへ適用する。
 * データは既存の materialVariants（マテリアルタブの「パターン」）をそのまま使う。
 */
export const DssVariantGallery: React.FC<Props> = ({ model, onSelect, selectedVariantId }) => {
  const variants = useMemo<MaterialVariant[]>(() => readMaterialVariants(model), [model]);
  const presets = useMemo<MaterialPresetSlot[]>(() => readMaterialPresets(model), [model]);

  // パターンが未登録なら、比較するものが無いのでセクションごと出さない
  if (variants.length === 0) return null;

  const baseThumb = model.thumbnailUrl || model.thumbnail || '';

  const cardSx = (selected: boolean) => ({
    width: 150, flexShrink: 0, borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
    border: `1px solid ${selected ? 'rgba(236,64,122,0.75)' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
    boxShadow: selected ? '0 0 0 2px rgba(236,64,122,0.28)' : 'none',
    transition: 'border-color 0.15s, transform 0.15s',
    '&:hover': { borderColor: 'rgba(236,64,122,0.7)', transform: 'translateY(-2px)' },
  });

  return (
    <Box sx={{ p: 2, pt: 0, mb: 2, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <PaletteRoundedIcon sx={{ fontSize: 20, color: 'light-dark(#c2185b, #f48fb1)' }} />
        <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 700 }}>素材バリエーション</Typography>
      </Box>
      <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.85)', mb: 2 }}>
        同じ家具の素材違いです。クリックすると上の3Dビューアに反映されます。
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* 元の見た目 */}
        <Box onClick={() => onSelect(null)} sx={cardSx(selectedVariantId === null)}>
          <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {baseThumb
              ? <Box component="img" src={baseThumb} alt="元の見た目" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <SwatchFallback color="#9aa0a6" />}
          </Box>
          <Box sx={{ p: 1.25 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)' }} noWrap>元の見た目</Typography>
          </Box>
        </Box>

        {variants.map((v) => {
          const selected = selectedVariantId === v.id;
          return (
            <Tooltip key={v.id} title="この素材を3Dビューアに適用" arrow>
              <Box onClick={() => onSelect(v)} sx={cardSx(selected)}>
                <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v.thumbUrl
                    ? <Box component="img" src={v.thumbUrl} alt={v.title || 'パターン'} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <SwatchFallback color={variantSwatchColor(presets, v)} />}
                </Box>
                <Box sx={{ p: 1.25 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)' }} noWrap>{v.title || 'パターン'}</Typography>
                  {!v.thumbUrl && (
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} noWrap>
                      画像は保存し直すと生成されます
                    </Typography>
                  )}
                </Box>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};
