import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { DetailViewport } from '../DetailViewport';
import type { EnumeratedSlot } from '../../../../shared/material/applyMaterial';
import { getDownloadUrlForModel } from '../../../utils/modelUtils';
import {
  readMaterialVariants, readMaterialPresets, expandVariantSelection, variantSwatchColor,
  resolveSelectedOption, swatchColorOf, slotMembers, type MaterialPreviewState,
} from '../../../../shared/material/materialPresets';
import { DssMaterialPresets } from '../../DssMaterialPresets';

export interface MaterialSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  projectId?: string;
}

const PART_CHIP_BASE_SX = {
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '11.5px',
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid transparent',
  whiteSpace: 'nowrap' as const,
} as const;

/** 選択中/非選択の部位フィルタチップ。「すべての部位」＋各プリセットスロット共通で使う。 */
const PartChip: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      ...PART_CHIP_BASE_SX,
      font: 'inherit',
      bgcolor: selected ? 'rgba(59,130,246,0.9)' : 'transparent',
      color: selected ? '#fff' : 'rgba(255,255,255,0.72)',
      borderColor: selected ? 'transparent' : 'rgba(255,255,255,0.15)',
    }}
  >
    {label}
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
  // 部位フィルタ（null = すべての部位）とパターン選択（null = 元の見た目）。
  // モデル切替時にリセットする。useEffect 内の setState は react-hooks/set-state-in-effect に
  // 抵触するため使わず、「レンダー中に調整」パターン（React 公式の推奨）で行う。
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [prevModelIdForSelection, setPrevModelIdForSelection] = useState(model?.id);
  if (model?.id !== prevModelIdForSelection) {
    setPrevModelIdForSelection(model?.id);
    setSelectedPartKey(null);
    setSelectedVariantId(null);
  }

  // glbUrl（≒表示モデル）が変わったらズームゲートを閉じる（OverviewSection と同じ考え方）。
  const [viewZoomEnabled, setViewZoomEnabled] = useState(false);
  const [prevGlbUrlForViewZoom, setPrevGlbUrlForViewZoom] = useState(glbUrl);
  if (glbUrl !== prevGlbUrlForViewZoom) {
    setPrevGlbUrlForViewZoom(glbUrl);
    setViewZoomEnabled(false);
  }

  const captionForSelection = useCallback((sel: Record<string, string>) => {
    const parts: string[] = [];
    for (const ps of presets) {
      const opt = resolveSelectedOption(ps, sel[ps.slotKey]);
      if (opt?.title) parts.push(opt.title);
    }
    return parts.length > 0 ? parts.join(' / ') : null;
  }, [presets]);

  const defaultSwatchColor = useMemo(() => {
    for (const ps of presets) {
      const opt = resolveSelectedOption(ps, undefined);
      if (opt) return swatchColorOf(opt);
    }
    return '#9aa0a6';
  }, [presets]);

  const patternCards = useMemo(() => {
    const cards: Array<{ id: string | null; title: string; thumbUrl?: string | null; swatchColor: string; caption: string | null }> = [
      { id: null, title: '元の見た目', thumbUrl: null, swatchColor: defaultSwatchColor, caption: captionForSelection({}) },
    ];
    for (const v of variants) {
      cards.push({
        id: v.id,
        title: v.title || 'パターン',
        thumbUrl: v.thumbUrl,
        swatchColor: variantSwatchColor(presets, v),
        caption: captionForSelection(v.selection),
      });
    }
    return cards;
  }, [variants, presets, defaultSwatchColor, captionForSelection]);

  const viewSelection = useMemo(() => {
    if (selectedVariantId == null) return {};
    const v = variants.find((vv) => vv.id === selectedVariantId);
    return v ? expandVariantSelection(presets, v) : {};
  }, [selectedVariantId, variants, presets]);

  const viewHighlight = useMemo(() => {
    if (!selectedPartKey) return [];
    const p = presets.find((ps) => ps.slotKey === selectedPartKey);
    if (!p) return [];
    return slotMembers(p).map((m) => m.meshName).filter((n): n is string => !!n);
  }, [selectedPartKey, presets]);

  const viewMaterialPreview: MaterialPreviewState | null = useMemo(() => (
    presets.length > 0 ? { presets, selection: viewSelection, highlight: viewHighlight, pickable: true } : null
  ), [presets, viewSelection, viewHighlight]);

  const rowKeyForMeshName = useCallback((meshName: string): string | null => {
    const p = presets.find((ps) => slotMembers(ps).some((m) => m.meshName === meshName));
    return p ? p.slotKey : null;
  }, [presets]);

  const handleViewMeshClick = useCallback((meshName: string) => {
    const key = rowKeyForMeshName(meshName);
    if (key) setSelectedPartKey(key);
  }, [rowKeyForMeshName]);

  const currentPatternLabel = selectedVariantId == null
    ? '元の見た目'
    : (variants.find((v) => v.id === selectedVariantId)?.title || 'パターン');

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
    return (
      <Box sx={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: '16px' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            SECTION 1
          </Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>素材</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(148,163,184,0.9)' }}>張地・木部のパターンを切り替えて比べる</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: '20px' }}>
          <Box
            onPointerDown={() => setViewZoomEnabled(true)}
            sx={{ width: 360, flex: 'none', height: 230, borderRadius: '10px', overflow: 'hidden', bgcolor: '#080b11', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}
          >
            <DetailViewport
              glbUrl={glbUrl}
              placeholderUrl={placeholderUrl}
              height="100%"
              materialPreview={viewMaterialPreview}
              onMeshClick={handleViewMeshClick}
              enableZoom={viewZoomEnabled}
            />
            {!viewZoomEnabled && glbUrl && (
              <Box sx={overlayHintSx}>クリックすると拡大縮小できます</Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <PartChip label="すべての部位" selected={selectedPartKey === null} onClick={() => setSelectedPartKey(null)} />
              {presets.map((p) => (
                <PartChip
                  key={p.slotKey}
                  label={p.label || 'パーツ'}
                  selected={selectedPartKey === p.slotKey}
                  onClick={() => setSelectedPartKey(p.slotKey)}
                />
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
              {patternCards.map((card) => {
                const selected = card.id === selectedVariantId;
                return (
                  <Box key={card.id ?? '__default'} onClick={() => setSelectedVariantId(card.id)} sx={{ cursor: 'pointer' }}>
                    <Box
                      sx={{
                        height: 90, borderRadius: '8px', overflow: 'hidden',
                        border: selected ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.12)',
                        bgcolor: card.swatchColor,
                      }}
                    >
                      {card.thumbUrl && (
                        <Box component="img" src={card.thumbUrl} alt={card.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 12, mt: '6px', fontWeight: 600, color: '#fff' }} noWrap>{card.title}</Typography>
                    {card.caption && (
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }} noWrap>{card.caption}</Typography>
                    )}
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.22)' }}>
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', flex: 1 }}>
                選んだパターンはこの画面のビューアに反映されます
              </Typography>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }} noWrap>現在：{currentPatternLabel}</Typography>
            </Box>
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
