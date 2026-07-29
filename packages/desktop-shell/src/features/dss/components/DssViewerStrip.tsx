import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import StraightenIcon from '@mui/icons-material/Straighten';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  readMaterialPresets, readMaterialVariants, variantSwatchColor,
  type MaterialVariant, type MaterialPresetSlot,
} from '../../shared/material/materialPresets';
import { normalizeGimmicks } from '../../shared/walkthrough/gimmicks';

export type StripKind = 'material' | 'swap' | 'anim';
export type StripCounts = { material: number; swap: number; anim: number };

/** 各種類の登録件数を数える。セグメントの出し分けと件数バッジに使う。 */
export function countStripItems(model: any): StripCounts {
  const anim = normalizeGimmicks(model?.extendedMetadata).length + (model?.extendedMetadata?.anim ? 1 : 0);
  return {
    material: readMaterialVariants(model).length,
    swap: Array.isArray(model?.extendedMetadata?.swapModels) ? model.extendedMetadata.swapModels.length : 0,
    anim,
  };
}

interface StripProps {
  model: any;
  isAuthor: boolean;
  /**
   * 「閲覧者の見え方を確認」中かどうか。true の間は作成者にも閲覧者と同じ帯を見せる
   * （0 件のセグメントと「＋」を出さない）。確認モードは右パネルの編集面も閉じているので、
   * ここで「＋」を押せてしまうと、押しても何も起きないうえに確認モードを抜けた瞬間に
   * 「整える」が勝手に開く、という分かりにくい挙動になる。
   */
  previewMode: boolean;
  /** 選択中の種類。null なら帯を出さない。 */
  active: StripKind | null;
  onChangeActive: (k: StripKind | null) => void;
  /** 素材：適用中のパターンID（null は元の見た目）。 */
  selectedVariantId: string | null;
  onSelectVariant: (v: MaterialVariant | null) => void;
  /** 置き換え：選択中の差し替え先 index（null は元モデル）。 */
  selectedSwapIndex: number | null;
  onSelectSwap: (index: number | null) => void;
  /** 寸法線の ON/OFF。 */
  showDimensions: boolean;
  onToggleDimensions: () => void;
  /** 作成者が「＋」を押したとき。「整える」を開いて該当セクションへ誘導する。 */
  onRequestEdit: (k: StripKind) => void;
}

const LABELS: Record<StripKind, string> = { material: '素材', swap: '置き換え', anim: 'アニメ' };

const segSx = (selected: boolean, dim: boolean) => ({
  fontSize: 11.5, fontWeight: 700, height: 26, cursor: 'pointer',
  bgcolor: selected ? 'rgba(59,130,246,0.9)' : 'transparent',
  color: selected ? '#fff' : (dim ? 'rgb(var(--brand-fg-rgb) / 0.35)' : 'rgb(var(--brand-fg-rgb) / 0.75)'),
  border: `1px solid ${selected ? 'rgba(59,130,246,0.9)' : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
  '&:hover': { bgcolor: selected ? 'rgba(59,130,246,0.9)' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
});

const cellSx = (selected: boolean) => ({
  width: 56, height: 56, flexShrink: 0, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
  bgcolor: 'var(--brand-bg)',
  border: `2px solid ${selected ? '#3b82f6' : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'border-color 0.15s',
  '&:hover': { borderColor: '#3b82f6' },
});

/**
 * ビューア直下のセグメント行＋サムネ帯。
 * 「ビューアの見え方を変える操作」をここに集約する。3Dは上のメインビューア1枚のまま。
 */
export const DssViewerStrip: React.FC<StripProps> = ({
  model, isAuthor, previewMode, active, onChangeActive,
  selectedVariantId, onSelectVariant, selectedSwapIndex, onSelectSwap,
  showDimensions, onToggleDimensions, onRequestEdit,
}) => {
  const counts = useMemo(() => countStripItems(model), [model]);
  const variants = useMemo<MaterialVariant[]>(() => readMaterialVariants(model), [model]);
  const presets = useMemo<MaterialPresetSlot[]>(() => readMaterialPresets(model), [model]);
  const swaps = useMemo<any[]>(
    () => (Array.isArray(model?.extendedMetadata?.swapModels) ? model.extendedMetadata.swapModels : []),
    [model]
  );
  const gimmicks = useMemo(() => normalizeGimmicks(model?.extendedMetadata), [model]);

  // 「整える」への導線（0 件セグメントと「＋」）を出してよいのは、作成者かつ確認モードでないとき。
  const canEdit = isAuthor && !previewMode;
  // 閲覧者には 0 件の種類を出さない。作成者には淡色で出す（そこから追加できるため）。
  const kinds: StripKind[] = (['material', 'swap', 'anim'] as StripKind[])
    .filter((k) => canEdit || counts[k] > 0);
  // 出していないセグメントのサムネ列は開かない（確認モードで 0 件の種類が選ばれたままの場合）。
  const activeKind = active && kinds.includes(active) ? active : null;

  const baseThumb = model?.thumbnailUrl || model?.thumbnail || '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {kinds.map((k) => (
          <Chip
            key={k}
            size="small"
            label={counts[k] > 0 ? `${LABELS[k]} ${counts[k]}` : LABELS[k]}
            onClick={() => onChangeActive(active === k ? null : k)}
            sx={segSx(active === k, counts[k] === 0)}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="寸法線の表示" arrow>
          <Chip
            size="small"
            icon={<StraightenIcon sx={{ fontSize: 14 }} />}
            label="寸法"
            onClick={onToggleDimensions}
            sx={segSx(showDimensions, false)}
          />
        </Tooltip>
      </Box>

      {activeKind === 'material' && (
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
          <Tooltip title="元の見た目" arrow>
            <Box onClick={() => onSelectVariant(null)} sx={cellSx(selectedVariantId === null)}>
              {baseThumb
                ? <Box component="img" src={baseThumb} alt="元の見た目" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <PaletteRoundedIcon sx={{ fontSize: 20, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />}
            </Box>
          </Tooltip>
          {variants.map((v) => (
            <Tooltip key={v.id} title={v.title || 'パターン'} arrow>
              <Box onClick={() => onSelectVariant(v)} sx={cellSx(selectedVariantId === v.id)}>
                {v.thumbUrl
                  ? <Box component="img" src={v.thumbUrl} alt={v.title || 'パターン'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Box sx={{ width: '100%', height: '100%', background: variantSwatchColor(presets, v) }} />}
              </Box>
            </Tooltip>
          ))}
          {canEdit && (
            <Tooltip title="パターンを追加（整えるを開きます）" arrow>
              <Box onClick={() => onRequestEdit('material')} sx={{ ...cellSx(false), borderStyle: 'dashed', bgcolor: 'transparent' }}>
                <AddRoundedIcon sx={{ fontSize: 20, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      )}

      {activeKind === 'swap' && (
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
          <Tooltip title="元のモデル" arrow>
            <Box onClick={() => onSelectSwap(null)} sx={cellSx(selectedSwapIndex === null)}>
              {baseThumb
                ? <Box component="img" src={baseThumb} alt="元のモデル" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>元</Typography>}
            </Box>
          </Tooltip>
          {swaps.map((s: any, i: number) => (
            <Tooltip key={i} title={s?.title || `候補 ${i + 1}`} arrow>
              <Box onClick={() => onSelectSwap(i)} sx={cellSx(selectedSwapIndex === i)}>
                {s?.thumbUrl
                  ? <Box component="img" src={s.thumbUrl} alt={s?.title || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{i + 1}</Typography>}
              </Box>
            </Tooltip>
          ))}
          {canEdit && (
            <Tooltip title="置き換え候補を追加（整えるを開きます）" arrow>
              <Box onClick={() => onRequestEdit('swap')} sx={{ ...cellSx(false), borderStyle: 'dashed', bgcolor: 'transparent' }}>
                <AddRoundedIcon sx={{ fontSize: 20, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      )}

      {activeKind === 'anim' && (
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap', pb: 0.5 }}>
          {gimmicks.map((g: any) => (
            <Chip key={g.id} size="small" label={g.label || g.type}
              sx={{ bgcolor: 'rgba(79,140,255,0.18)', color: 'var(--brand-fg)', border: '1px solid rgba(79,140,255,0.4)', fontWeight: 700, fontSize: 11 }} />
          ))}
          {model?.extendedMetadata?.anim && (
            <Chip size="small" label={model.extendedMetadata.anim.type === 'rotate' ? '常時回転' : '常時往復'}
              sx={{ bgcolor: 'rgba(79,140,255,0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.8)', border: '1px solid rgba(79,140,255,0.3)', fontSize: 11 }} />
          )}
          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
            上の3Dビューアでモデルをクリックすると操作アイコンが表示されます。
          </Typography>
          {canEdit && (
            <Chip size="small" icon={<AddRoundedIcon sx={{ fontSize: 14 }} />} label="設定"
              onClick={() => onRequestEdit('anim')}
              sx={{ fontSize: 11, cursor: 'pointer', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.3)', bgcolor: 'transparent', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
          )}
        </Box>
      )}
    </Box>
  );
};
