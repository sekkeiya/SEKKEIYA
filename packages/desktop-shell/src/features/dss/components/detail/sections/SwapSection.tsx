import React, { useMemo, useRef, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { DssFurnitureSwap } from '../../DssFurnitureSwap';
import { readSwapModels, type SwapModelRef } from '../../../utils/swapModels';
import { DetailViewport } from '../DetailViewport';
import { getDownloadUrlForModel } from '../../../utils/modelUtils';
import { resolveViewerYawDeg } from '../../../utils/viewerYaw';
import {
  buildDimCompareRows, formatDiff, diffColor, mergeSwapCandidate,
  type SwapCandidateLive,
} from '../../../utils/swapSectionView';
import { CountPill } from './materialSectionParts';

export interface SwapSelection {
  url: string;
  dims: any;
}

export interface SwapSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  /**
   * 編集モードで DssFurnitureSwap が候補を選んだときに親へ通知する（＝上部ヒーロービューアの差し替え）。
   * 閲覧モードでは呼ばない —— 選択はセクション内 state で持ち、右のセクション専用ビューアだけを
   * 切り替える（操作した場所と変化する場所を一致させるため）。
   */
  onSelect: (sel: SwapSelection | null) => void;
  /**
   * 読み込み済みのモデル一覧。候補カードから詳細画面へ飛ぶとき、id で実体を引くのに使う。
   * このセクションが必要なのは id だけなので、モデル全体の型は要求しない。
   */
  allItems?: SwapCandidateLive[];
  /** 別モデルの詳細画面を開く（SECTION 6「同じ作者」と同じ経路）。 */
  onSelectRelated?: (model: unknown) => void;
}

interface Dims {
  width?: number;
  depth?: number;
  height?: number;
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

const SectionHeader: React.FC<{ variant: 'view' | 'edit'; count?: number; onSearch?: () => void }> = ({ variant, count, onSearch }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: variant === 'view' ? '16px' : '14px' }}>
    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
      SECTION 2
    </Typography>
    {variant === 'view' && <SwapHorizRoundedIcon sx={{ fontSize: 19, color: '#93c5fd' }} />}
    <Typography sx={{ fontSize: variant === 'view' ? 19 : 17, fontWeight: 700, color: '#fff' }}>置き換え</Typography>
    <Typography sx={{ fontSize: variant === 'view' ? 12.5 : 12, color: 'rgba(148,163,184,0.9)' }}>
      {variant === 'view' ? '似ている別モデルに差し替えて寸法差を確認する' : '同カテゴリの候補から選んで登録'}
    </Typography>
    <Box sx={{ flex: 1 }} />
    {variant === 'view' && !!count && <CountPill label={`候補 ${count}`} />}
    {variant === 'edit' && (
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
    )}
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
export const SwapSection: React.FC<SwapSectionProps> = ({ model, mode, isAuthor, onSelect, allItems, onSelectRelated }) => {
  const ownThumbUrl: string | null = model?.thumbnailUrl || model?.thumbnail || null;
  const swapModels = useMemo(() => readSwapModels(model), [model]);

  const addPickerRef = useRef<(() => void) | null>(null);

  // 読み込み済みモデルの実体を id で引けるようにする。用途は2つ:
  //  1. 候補の寸法/名前/サムネを最新に保つ（swapModels は登録時のスナップショット）
  //  2. 候補カードから詳細画面へ飛ぶ（実体が無ければ遷移ボタンを出さない）
  const itemsById = useMemo(() => {
    const m = new Map<string, SwapCandidateLive>();
    for (const it of (Array.isArray(allItems) ? allItems : [])) {
      if (it?.id) m.set(it.id, it);
    }
    return m;
  }, [allItems]);

  const resolvedCandidates = useMemo(
    () => swapModels.map((c) => ({ ref: c, merged: mergeSwapCandidate(c, itemsById.get(c.id)) })),
    [swapModels, itemsById],
  );

  // 閲覧モードの選択はセクション内で持つ。親の onSelect（＝上部ヒーロービューアの差し替え）は
  // 呼ばない —— 操作した場所と変化する場所を一致させるため（SECTION 1 と同じ考え方）。
  // null = 元モデル。モデル切替時にリセットする（「レンダー中に調整」パターン）。
  const [viewSelected, setViewSelected] = useState<SwapModelRef | null>(null);
  const [prevModelIdForSwap, setPrevModelIdForSwap] = useState(model?.id);
  if (model?.id !== prevModelIdForSwap) {
    setPrevModelIdForSwap(model?.id);
    setViewSelected(null);
  }

  const ownGlbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);

  // 選択中候補の表示情報。登録時のスナップショットではなく実体を正とする。
  const selectedMerged = useMemo(
    () => (viewSelected ? mergeSwapCandidate(viewSelected, itemsById.get(viewSelected.id)) : null),
    [viewSelected, itemsById],
  );

  // ビューアに映すモデル。未選択なら元モデル。
  // glbUrl だけは登録時のものを使う —— 実体側のフィールド名が一定でなく、差し替えると
  // ビューアが読めなくなるリスクがあるため（寸法・名前・サムネの鮮度が今回の目的）。
  const viewerGlbUrl = viewSelected?.glbUrl || ownGlbUrl;
  const viewerThumbUrl = viewSelected ? (selectedMerged?.thumbUrl || undefined) : (ownThumbUrl || undefined);
  const viewerTitle = viewSelected ? (selectedMerged?.title || '無題') : (model?.title || model?.name || '元モデル');

  const viewerDimensions = useMemo(() => {
    const src = viewSelected ? selectedMerged?.dimensions : model?.dimensions;
    if (!src) return null;
    const w = Number(src.width) || 0;
    const d = Number(src.depth) || 0;
    const h = Number(src.height) || 0;
    if (!w && !d && !h) return null;
    // 向き補正は候補の実体が持っていれば効く（登録時のスナップショットには入らない）。
    const yawDeg = resolveViewerYawDeg({
      swapActive: !!viewSelected,
      swapDims: selectedMerged?.dimensions,
      modelDims: model?.dimensions,
    });
    return { width: w, depth: d, height: h, yawDeg };
  }, [viewSelected, selectedMerged, model?.dimensions]);

  const compareRows = useMemo(
    () => buildDimCompareRows(model?.dimensions, selectedMerged?.dimensions),
    [model?.dimensions, selectedMerged],
  );

  // glbUrl が変わったらズームゲートを閉じる（SECTION 1・概要と同じ考え方）。
  const [viewZoomEnabled, setViewZoomEnabled] = useState(false);
  const [prevGlbForZoom, setPrevGlbForZoom] = useState(viewerGlbUrl);
  if (viewerGlbUrl !== prevGlbForZoom) {
    setPrevGlbForZoom(viewerGlbUrl);
    setViewZoomEnabled(false);
  }

  const ownCategoryLabel = [model?.mainCategory, model?.subCategory].filter(Boolean).join(' / ');

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
      <SectionHeader variant="view" count={swapModels.length} />

      <Box sx={{ display: 'flex', gap: '18px' }}>
        {/* 左: 寸法比較 → 候補カード */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Box sx={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', bgcolor: 'rgba(255,255,255,0.025)', padding: '12px 14px' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px', mb: '10px' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }} noWrap>{viewerTitle}</Typography>
              {/* 候補はカテゴリを持たないため、元モデル表示中だけ出す。 */}
              {!viewSelected && ownCategoryLabel && (
                <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.75)' }} noWrap>{ownCategoryLabel}</Typography>
              )}
            </Box>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <Box component="tbody">
                <Box component="tr" sx={{ color: 'rgba(148,163,184,0.7)', fontSize: 11 }}>
                  <Box component="td" sx={{ padding: '3px 0' }} />
                  <Box component="td" sx={{ textAlign: 'right', padding: '3px 0' }}>元モデル</Box>
                  {viewSelected && <Box component="td" sx={{ textAlign: 'right', padding: '3px 0' }}>選択中</Box>}
                  {viewSelected && <Box component="td" sx={{ textAlign: 'right', padding: '3px 0' }}>差</Box>}
                </Box>
                {compareRows.map((row) => (
                  <Box component="tr" key={row.key}>
                    <Box component="td" sx={{ color: 'rgba(148,163,184,0.9)', padding: '3px 0' }}>{row.label}</Box>
                    <Box component="td" sx={{ textAlign: 'right', color: '#fff', padding: '3px 0' }}>
                      {row.own > 0 ? row.own.toLocaleString() : ''}
                    </Box>
                    {viewSelected && (
                      <Box component="td" sx={{ textAlign: 'right', color: '#fff', padding: '3px 0' }}>
                        {row.candidate > 0 ? row.candidate.toLocaleString() : ''}
                      </Box>
                    )}
                    {viewSelected && (
                      <Box component="td" sx={{ textAlign: 'right', color: diffColor(row.diff), padding: '3px 0' }}>
                        {formatDiff(row.diff)}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', mb: '9px' }}>置き換え候補</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 118px)', gap: '10px' }}>
              {/* 元モデル。選択を戻す手段がこれしかないので必ず先頭に置く。 */}
              <Box
                component="button"
                type="button"
                aria-pressed={viewSelected === null}
                onClick={() => setViewSelected(null)}
                sx={{
                  font: 'inherit', textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                  '&:hover .swap-thumb': { transform: 'translateY(-2px)', borderColor: 'rgba(255,255,255,0.45)' },
                }}
              >
                <Box
                  className="swap-thumb"
                  sx={{
                    aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', bgcolor: '#0e1219',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: viewSelected === null ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
                    transition: 'transform 0.15s, border-color 0.15s',
                  }}
                >
                  {ownThumbUrl
                    ? <Box component="img" src={ownThumbUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImageRoundedIcon sx={{ fontSize: 24, color: 'rgba(255,255,255,0.2)' }} />}
                </Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fff', mt: '5px' }} noWrap>元モデル</Typography>
              </Box>

              {resolvedCandidates.map(({ ref: c, merged }) => {
                const isSelected = !!viewSelected && viewSelected.id === c.id;
                const metaLabel = dimsDiffLabel(merged.dimensions, model?.dimensions);
                const selectable = !!c.glbUrl;
                // ラベルの色は比較表と同じ規則にする。文字列から `+` を探すような
                // 表示文字列の解析はしない（表記を変えた瞬間に壊れるため）。
                const maxDiff = buildDimCompareRows(model?.dimensions, merged.dimensions)
                  .reduce((acc, r) => (r.diff !== null && Math.abs(r.diff) > Math.abs(acc) ? r.diff : acc), 0);
                const relatedItem = itemsById.get(c.id);
                const canOpenDetail = !!relatedItem && !!onSelectRelated;
                return (
                  // 遷移ボタンは選択ボタンの「兄弟」にする。button の入れ子は不正な HTML で、
                  // stopPropagation でも構造の問題は消えない。
                  <Box key={c.id} sx={{ position: 'relative', '&:hover .swap-open': { opacity: 1 } }}>
                    <Box
                      component="button"
                      type="button"
                      disabled={!selectable}
                      aria-pressed={isSelected}
                      onClick={() => { if (selectable) setViewSelected(c); }}
                      sx={{
                        display: 'block', width: '100%',
                        font: 'inherit', textAlign: 'left', padding: 0, background: 'none', border: 'none',
                        cursor: selectable ? 'pointer' : 'default', opacity: selectable ? 1 : 0.5,
                        '&:hover .swap-thumb': selectable
                          ? { transform: 'translateY(-2px)', borderColor: 'rgba(255,255,255,0.45)' }
                          : undefined,
                      }}
                    >
                      <Box
                        className="swap-thumb"
                        sx={{
                          aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', bgcolor: '#0e1219',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
                          transition: 'transform 0.15s, border-color 0.15s',
                        }}
                      >
                        {merged.thumbUrl
                          ? <Box component="img" src={merged.thumbUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <ImageRoundedIcon sx={{ fontSize: 24, color: 'rgba(255,255,255,0.2)' }} />}
                      </Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fff', mt: '5px' }} noWrap>{merged.title || '無題'}</Typography>
                      {metaLabel && (
                        <Typography sx={{ fontSize: 10.5, color: diffColor(maxDiff) }} noWrap>{metaLabel}</Typography>
                      )}
                    </Box>
                    {canOpenDetail && (
                      <Box
                        component="button"
                        type="button"
                        className="swap-open"
                        title={`${merged.title || '無題'} の詳細を開く`}
                        aria-label={`${merged.title || '無題'} の詳細を開く`}
                        onClick={() => onSelectRelated?.(relatedItem)}
                        sx={{
                          position: 'absolute', top: 4, right: 4, width: 22, height: 22, padding: 0,
                          borderRadius: '50%', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: 'rgba(20,24,32,0.92)', color: 'rgba(255,255,255,0.75)',
                          opacity: 0, transition: 'opacity 0.15s',
                          '&:hover': { bgcolor: '#3b82f6', color: '#fff' },
                        }}
                      >
                        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* 右: セクション専用ビューア */}
        <Box sx={{ width: 600, maxWidth: '45%', flex: 'none' }}>
          <Box
            onPointerDown={() => setViewZoomEnabled(true)}
            sx={{ aspectRatio: '1 / 1', borderRadius: '10px', overflow: 'hidden', bgcolor: '#080b11', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}
          >
            <DetailViewport
              glbUrl={viewerGlbUrl}
              placeholderUrl={viewerThumbUrl}
              height="100%"
              targetDimensions={viewerDimensions}
              enableZoom={viewZoomEnabled}
            />
            {!viewZoomEnabled && viewerGlbUrl && (
              <Box
                sx={{
                  position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
                  px: 1.25, py: 0.4, borderRadius: 999, pointerEvents: 'none',
                  bgcolor: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.75)',
                  fontSize: 10.5, whiteSpace: 'nowrap',
                }}
              >
                クリックすると拡大縮小できます
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.8)', mt: '8px' }}>表示中</Typography>
          <Typography sx={{ fontSize: 12, color: '#fff', lineHeight: 1.5 }} noWrap>{viewerTitle}</Typography>
        </Box>
      </Box>
    </Box>
  );
};
