import React, { useMemo, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { DssFurnitureSwap } from '../../DssFurnitureSwap';
import { readSwapModels, type SwapModelRef } from '../../../utils/swapModels';

export interface SwapSelection {
  url: string;
  dims: any;
}

export interface SwapSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  selected: SwapSelection | null;
  onSelect: (sel: SwapSelection | null) => void;
}

interface Dims {
  width?: number;
  depth?: number;
  height?: number;
}

/** `W780 D820 H690` のような短い寸法表記。値が一つも無ければ null（呼び出し側は行ごと隠す）。 */
function formatDimsShort(dims: Dims | null | undefined): string | null {
  if (!dims) return null;
  const w = Number(dims.width) || 0;
  const d = Number(dims.depth) || 0;
  const h = Number(dims.height) || 0;
  if (!w && !d && !h) return null;
  return `W${w} D${d} H${h}`;
}

/**
 * 候補モデルと元モデルの寸法差（W/D/H のうち最大差分1つ）を「幅 +40mm」のように表す。
 * どちらかの寸法が未登録なら null（呼び出し側は行ごと非表示にする）。差が全軸5mm以内なら「同寸」。
 */
function dimsDiffLabel(candidate: Dims | null | undefined, own: Dims | null | undefined): string | null {
  if (!candidate || !own) return null;
  const cw = Number(candidate.width) || 0, cd = Number(candidate.depth) || 0, ch = Number(candidate.height) || 0;
  const ow = Number(own.width) || 0, od = Number(own.depth) || 0, oh = Number(own.height) || 0;
  if (!cw && !cd && !ch) return null;
  if (!ow && !od && !oh) return null;
  const diffs = [
    { label: '幅', diff: cw - ow },
    { label: '奥行', diff: cd - od },
    { label: '高さ', diff: ch - oh },
  ];
  let max = diffs[0];
  for (const d of diffs) { if (Math.abs(d.diff) > Math.abs(max.diff)) max = d; }
  if (Math.abs(max.diff) <= 5) return '同寸';
  const rounded = Math.round(Math.abs(max.diff));
  return `${max.label} ${max.diff > 0 ? '+' : '−'}${rounded}mm`;
}

const SectionHeader: React.FC<{ variant: 'view' | 'edit'; onSearch?: () => void }> = ({ variant, onSearch }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: variant === 'view' ? '16px' : '14px' }}>
    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
      SECTION 2
    </Typography>
    <Typography sx={{ fontSize: variant === 'view' ? 19 : 17, fontWeight: 700, color: '#fff' }}>置き換え</Typography>
    <Typography sx={{ fontSize: variant === 'view' ? 12.5 : 12, color: 'rgba(148,163,184,0.9)' }}>
      {variant === 'view' ? '似ている別モデルに差し替えて寸法差を確認する' : '同カテゴリの候補から選んで登録'}
    </Typography>
    {variant === 'edit' && (
      <>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          onClick={onSearch}
          startIcon={<SearchRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            height: 28, borderRadius: '8px', textTransform: 'none', fontSize: 11.5, fontWeight: 600,
            color: '#93c5fd', borderColor: 'rgba(96,165,250,0.5)',
            '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
          }}
        >
          類似モデルを検索
        </Button>
      </>
    )}
  </Box>
);

const ThumbArea: React.FC<{ url?: string | null; fallback: React.ReactNode }> = ({ url, fallback }) => (
  <Box sx={{ aspectRatio: '4/3', bgcolor: '#0e1219', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {url ? <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : fallback}
  </Box>
);

/**
 * S.Model 詳細画面「セクション2: 置き換え」。デザイン 243-279 行（閲覧）/ 673-719 行（編集）に準拠。
 *
 * 自前の3Dビューアは持たない。候補カードを選ぶと `onSelect` 経由で OverviewSection（画面上部の
 * メインビューア）の表示モデルが差し替わる（`swapUrl`/`swapDims` prop）。
 *
 * 編集: 候補の追加/削除/検索は既存 DssFurnitureSwap（Firestore 照会・ピッカーダイアログ・
 * 永続化ロジック）をそのまま器に嵌めて流用する。DssFurnitureSwap は元々「同カテゴリから選ぶ」
 * 84px サムネ行 UI を持っており、デザインの5列カードグリッド（橙×削除・破線＋候補追加タイル）
 * とは見た目が完全には一致しない。検索/追加/削除ロジックを複製しないための判断として、
 * ヘッダーの「類似モデルを検索」ボタンだけを追加で外出しし（`addPickerRef` 経由）、
 * 本体はそのまま描画する。削除ボタンの配色のみ、デザインの「削除橙」(#f97316) に合わせて調整済み。
 */
export const SwapSection: React.FC<SwapSectionProps> = ({ model, mode, isAuthor, selected, onSelect }) => {
  const ownThumbUrl: string | null = model?.thumbnailUrl || model?.thumbnail || null;
  const ownDimsLabel = useMemo(() => formatDimsShort(model?.dimensions), [model]);
  const swapModels = useMemo(() => readSwapModels(model), [model]);

  const addPickerRef = useRef<(() => void) | null>(null);

  if (mode === 'edit') {
    return (
      <Box sx={{ padding: '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <SectionHeader variant="edit" onSearch={() => addPickerRef.current?.()} />
        {!isAuthor ? (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
        ) : (
          <Box sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.02)' }}>
            <DssFurnitureSwap
              model={model}
              isAuthor={isAuthor}
              mode="edit"
              externalViewer
              onSelectSwap={onSelect}
              addPickerRef={addPickerRef}
            />
            {/* デザインの注記文言「並べ替えはドラッグハンドル。」は実装しない
                （DssFurnitureSwap に候補の並べ替え機能が無いため。実際にできることだけを伝える）。 */}
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', px: 2, pb: 1.5 }}>
              閲覧者には確定した候補だけが並びます。
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // ============================== 閲覧 ==============================
  if (swapModels.length === 0) return null;

  return (
    <Box sx={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader variant="view" />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {/* 元モデル */}
        <Box
          onClick={() => onSelect(null)}
          sx={{
            borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: selected === null ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <ThumbArea
            url={ownThumbUrl}
            fallback={
              <Typography sx={{ fontSize: 10.5, color: 'rgba(147,197,253,0.6)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                now viewing
              </Typography>
            }
          />
          <Box sx={{ p: '10px' }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }} noWrap>
              元モデル {model?.title || model?.name || ''}
            </Typography>
            {ownDimsLabel && (
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: '2px' }}>{ownDimsLabel}</Typography>
            )}
          </Box>
        </Box>

        {/* 候補 */}
        {swapModels.map((c: SwapModelRef) => {
          const isSelected = !!selected && !!c.glbUrl && selected.url === c.glbUrl;
          const metaLabel = dimsDiffLabel(c.dimensions, model?.dimensions);
          return (
            <Box
              key={c.id}
              onClick={() => { if (c.glbUrl) onSelect({ url: c.glbUrl, dims: c.dimensions || null }); }}
              sx={{
                borderRadius: '10px', overflow: 'hidden', cursor: c.glbUrl ? 'pointer' : 'default',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <ThumbArea url={c.thumbUrl} fallback={<ImageRoundedIcon sx={{ fontSize: 28, color: 'rgba(255,255,255,0.2)' }} />} />
              <Box sx={{ p: '10px' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }} noWrap>{c.title || '無題'}</Typography>
                {metaLabel && (
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: '2px' }}>{metaLabel}</Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
