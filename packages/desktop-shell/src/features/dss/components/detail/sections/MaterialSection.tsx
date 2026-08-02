import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import { DetailViewport } from '../DetailViewport';
import type { EnumeratedSlot } from '../../../../shared/material/applyMaterial';
import { getDownloadUrlForModel } from '../../../utils/modelUtils';
import { slotDisplayTitle } from '../../../utils/materialSlotLabel';
import {
  readMaterialVariants, readMaterialPresets, expandVariantSelection,
  slotMembers, type MaterialPreviewState,
} from '../../../../shared/material/materialPresets';
import {
  swatchVisualOf, variantVisualOf, selectionsEqual, selectionSummary,
  type SwatchVisual, type PatternVisual,
} from '../../../utils/materialSectionView';
import { DssMaterialPresets } from '../../DssMaterialPresets';

export interface MaterialSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  projectId?: string;
}

/** ヘッダー右側の件数ピル。SECTION 5（ProductsSection）の CountPill と同じ見た目。 */
const CountPill: React.FC<{ label: string }> = ({ label }) => (
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
const Swatch: React.FC<{
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

/**
 * S.Model 詳細画面「セクション1: 素材」。デザイン 192-241 行（閲覧）/ 604-671 行（編集）に準拠。
 *
 * 閲覧: このセクション専用の DetailViewport（部位ハイライト＋パターン全体プレビュー）と、
 * 部位フィルタチップ・パターングリッドで「見た目を比べる」体験を提供する。
 * 編集: 同じ専用 DetailViewport を、既存 DssMaterialPresets（`externalViewer` モード）の
 * プレビュー委譲先として使い、部位ごとの素材登録・パターン保存の機能は DssMaterialPresets の
 * 実装をそのまま器に嵌める（見た目調整は最小限、機能優先）。
 *
 * 表示するかどうか（variants/presets が0件のときに隠すか）は呼び出し側（DssModelDetailView）の
 * 責務。このコンポーネントは渡された model をそのまま描画する。
 */
export const MaterialSection: React.FC<MaterialSectionProps> = ({ model, mode, isAuthor, projectId }) => {
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);
  const placeholderUrl = model?.thumbnailUrl || model?.thumbnail || undefined;

  const presets = useMemo(() => readMaterialPresets(model), [model]);
  const variants = useMemo(() => readMaterialVariants(model), [model]);

  // ============================== 閲覧 ==============================
  // selection（slotKey -> optionId）が唯一の選択状態。空 = 元の GLB 素材のまま。
  // モデル切替時にリセットする。useEffect 内の setState は react-hooks/set-state-in-effect に
  // 抵触するため使わず、「レンダー中に調整」パターン（React 公式の推奨）で行う。
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [prevModelIdForSelection, setPrevModelIdForSelection] = useState(model?.id);
  if (model?.id !== prevModelIdForSelection) {
    setPrevModelIdForSelection(model?.id);
    setSelection({});
  }

  // glbUrl（≒表示モデル）が変わったらズームゲートを閉じる（OverviewSection と同じ考え方）。
  const [viewZoomEnabled, setViewZoomEnabled] = useState(false);
  const [prevGlbUrlForViewZoom, setPrevGlbUrlForViewZoom] = useState(glbUrl);
  if (glbUrl !== prevGlbUrlForViewZoom) {
    setPrevGlbUrlForViewZoom(glbUrl);
    setViewZoomEnabled(false);
  }

  // 部位クリック（pickable）は使わない。閲覧では部位行のスウォッチが選択の入口になるため、
  // ビューアのクリックは「ズーム有効化」だけを意味するようにして操作の二重化を避ける。
  const viewMaterialPreview: MaterialPreviewState | null = useMemo(() => (
    presets.length > 0 ? { presets, selection, highlight: [], pickable: false } : null
  ), [presets, selection]);

  const summary = useMemo(() => selectionSummary(presets, selection), [presets, selection]);

  const pickOption = useCallback((slotKey: string, optionId: string | null) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (optionId == null) delete next[slotKey];
      else next[slotKey] = optionId;
      return next;
    });
  }, []);

  // パターンカード。先頭は「元の見た目」（selection を空にする＝元の GLB 素材へ戻す）。
  const patternCards = useMemo(() => {
    const cards: Array<{ key: string; title: string; visual: PatternVisual; selection: Record<string, string> }> = [
      { key: '__default', title: '元の見た目', visual: { imageUrl: placeholderUrl, color: '#3a4150' }, selection: {} },
    ];
    for (const v of variants) {
      cards.push({
        key: v.id,
        title: v.title || 'パターン',
        visual: variantVisualOf(presets, v, placeholderUrl),
        selection: expandVariantSelection(presets, v),
      });
    }
    return cards;
  }, [variants, presets, placeholderUrl]);

  // ============================== 編集 ==============================
  // このセクション専用ビューアを DssMaterialPresets の externalViewer 委譲先にする配線。
  const [editPreview, setEditPreview] = useState<MaterialPreviewState | null>(null);
  const matPickRef = useRef<((meshName: string) => void) | null>(null);
  const matSlotsRef = useRef<((slots: EnumeratedSlot[]) => void) | null>(null);
  const addVariantRef = useRef<(() => void) | null>(null);
  // パターン保存時のサムネイル取得元。DetailViewport の CaptureBridge は現状 View の scissor
  // 矩形で切り出さず共有 Canvas 全面を描画する（DetailViewport.tsx の TODO 参照）。v2 と同じ
  // 挙動のまま踏襲し、解消はビューア側タスクに委ねる。
  const editCaptureRef = useRef<(() => string | null) | null>(null);
  const captureThumb = useCallback(() => editCaptureRef.current?.() ?? null, []);

  const [editZoomEnabled, setEditZoomEnabled] = useState(false);
  const [prevGlbUrlForEditZoom, setPrevGlbUrlForEditZoom] = useState(glbUrl);
  if (glbUrl !== prevGlbUrlForEditZoom) {
    setPrevGlbUrlForEditZoom(glbUrl);
    setEditZoomEnabled(false);
  }

  const handleEditMeshClick = useCallback((meshName: string) => { matPickRef.current?.(meshName); }, []);
  const handleEditSlots = useCallback((slots: EnumeratedSlot[]) => { matSlotsRef.current?.(slots); }, []);
  const handleAddVariant = useCallback(() => { addVariantRef.current?.(); }, []);

  // Finding I2: 共有 Canvas（DetailCanvasHost, zIndex:0）は DOM 上でページ本体より後に
  // レンダーされるため、zIndex を持たないオーバーレイ（このヒント等）は DOM 順で Canvas に
  // 先着していても背面に回り込み、Canvas に隠れて見えなくなる。zIndex を明示するだけで
  // 「昇格された stacking context」として Canvas より確実に前面へ出る。
  const overlayHintSx = {
    position: 'absolute' as const, bottom: 8, left: '50%', transform: 'translateX(-50%)',
    zIndex: 2,
    px: 1.25, py: 0.4, borderRadius: 999, pointerEvents: 'none' as const,
    bgcolor: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.75)',
    fontSize: 10.5, whiteSpace: 'nowrap' as const,
  };

  if (mode === 'view') {
    // presets が無いと部位も選べずパターンも効かないため、組み合わせブロックごと出さない。
    const showPatterns = presets.length > 0 && variants.length > 0;
    return (
      <Box sx={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '4px' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            SECTION 1
          </Typography>
          <PaletteRoundedIcon sx={{ fontSize: 19, color: '#93c5fd' }} />
          <Typography sx={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>素材</Typography>
          <Box sx={{ flex: 1 }} />
          {presets.length > 0 && <CountPill label={`部位 ${presets.length}`} />}
          {variants.length > 0 && <CountPill label={`パターン ${variants.length}`} />}
        </Box>
        <Typography sx={{ fontSize: 12.5, color: 'rgba(148,163,184,0.9)', mb: '16px' }}>
          部位ごとに素材を選ぶか、保存済みの組み合わせを選ぶ。
        </Typography>

        <Box sx={{ display: 'flex', gap: '18px' }}>
          <Box sx={{ width: 600, maxWidth: '45%', flex: 'none' }}>
            <Box
              onPointerDown={() => setViewZoomEnabled(true)}
              sx={{ aspectRatio: '1 / 1', borderRadius: '10px', overflow: 'hidden', bgcolor: '#080b11', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}
            >
              <DetailViewport
                glbUrl={glbUrl}
                placeholderUrl={placeholderUrl}
                height="100%"
                materialPreview={viewMaterialPreview}
                enableZoom={viewZoomEnabled}
              />
              {!viewZoomEnabled && glbUrl && (
                <Box sx={overlayHintSx}>クリックすると拡大縮小できます</Box>
              )}
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.8)', mt: '8px' }}>選択中</Typography>
            <Typography sx={{ fontSize: 12, color: '#fff', lineHeight: 1.5 }}>{summary}</Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {presets.map((ps, index) => {
              const name = slotDisplayTitle(ps.label, slotMembers(ps)[0]?.meshName, index);
              const selectedId = selection[ps.slotKey];
              const selectedOption = ps.options.find((o) => o.id === selectedId);
              return (
                <Box key={ps.slotKey}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px', mb: '8px' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{name}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.75)' }} noWrap>
                      {selectedOption?.title || '元のまま'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Swatch
                      visual={{ imageUrl: placeholderUrl, color: '#3a4150' }}
                      selected={!selectedId}
                      title="元のまま"
                      onClick={() => pickOption(ps.slotKey, null)}
                    />
                    {ps.options.map((o) => (
                      <Swatch
                        key={o.id}
                        visual={swatchVisualOf(o)}
                        selected={selectedId === o.id}
                        title={o.title || '素材'}
                        onClick={() => pickOption(ps.slotKey, o.id)}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}

            {showPatterns && (
              <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.09)', pt: '13px' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', mb: '9px' }}>保存済みの組み合わせ</Typography>
                {/* カードは固定幅の小さなサムネ。1fr で伸ばすと数が少ないときに間延びする。 */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 132px)', gap: '10px' }}>
                  {patternCards.map((card) => {
                    const selected = selectionsEqual(selection, card.selection);
                    return (
                      <Box
                        key={card.key}
                        component="button"
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelection(card.selection)}
                        sx={{
                          font: 'inherit', textAlign: 'left', padding: 0, background: 'none',
                          border: 'none', cursor: 'pointer',
                          '&:hover .pattern-thumb': { transform: 'translateY(-2px)', borderColor: selected ? '#3b82f6' : 'rgba(255,255,255,0.45)' },
                        }}
                      >
                        <Box
                          className="pattern-thumb"
                          sx={{
                            position: 'relative',
                            aspectRatio: '4 / 3', borderRadius: '8px', overflow: 'hidden',
                            bgcolor: card.visual.color,
                            border: selected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
                            transition: 'transform 0.15s, border-color 0.15s',
                          }}
                        >
                          {card.visual.imageUrl && (
                            <Box component="img" src={card.visual.imageUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          )}
                          {/* 組み合わせ固有のサムネが未保存のとき、素材を右下のバッジで補う。 */}
                          {card.visual.badge && (
                            <Box
                              sx={{
                                position: 'absolute', right: 5, bottom: 5,
                                width: 22, height: 22, borderRadius: '50%', overflow: 'hidden',
                                bgcolor: card.visual.badge.color,
                                border: '1px solid rgba(0,0,0,0.45)',
                                boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                              }}
                            >
                              {card.visual.badge.imageUrl && (
                                <Box component="img" src={card.visual.badge.imageUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              )}
                            </Box>
                          )}
                        </Box>
                        <Typography sx={{ fontSize: 11.5, mt: '5px', fontWeight: 600, color: '#fff' }} noWrap>{card.title}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // ============================== 編集モード ==============================
  return (
    <Box sx={{ padding: '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: '14px' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          SECTION 1
        </Typography>
        <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>素材</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>部位に素材を割り当ててパターンとして保存</Typography>
        <Box sx={{ flex: 1 }} />
        {isAuthor && (
          <Button
            size="small"
            variant="outlined"
            onClick={handleAddVariant}
            startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              height: 28, borderRadius: '8px', textTransform: 'none', fontSize: 11.5, fontWeight: 600,
              color: '#93c5fd', borderColor: 'rgba(96,165,250,0.5)',
              '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
            }}
          >
            パターンを追加
          </Button>
        )}
      </Box>

      {!isAuthor ? (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: '20px' }}>
          <Box
            onPointerDown={() => setEditZoomEnabled(true)}
            sx={{ width: 300, flex: 'none', height: 190, borderRadius: '10px', overflow: 'hidden', bgcolor: '#080b11', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}
          >
            <DetailViewport
              glbUrl={glbUrl}
              placeholderUrl={placeholderUrl}
              height="100%"
              materialPreview={editPreview}
              onMeshClick={handleEditMeshClick}
              onSlots={handleEditSlots}
              captureRef={editCaptureRef}
              enableZoom={editZoomEnabled}
            />
            {!editZoomEnabled && glbUrl && (
              <Box sx={overlayHintSx}>クリックすると拡大縮小できます</Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <DssMaterialPresets
              model={model}
              isAuthor={isAuthor}
              projectId={projectId}
              mode="edit"
              hideToggle
              section="both"
              externalViewer
              onPreviewState={setEditPreview}
              pickHandlerRef={matPickRef}
              slotsHandlerRef={matSlotsRef}
              captureThumb={captureThumb}
              addVariantRef={addVariantRef}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};
