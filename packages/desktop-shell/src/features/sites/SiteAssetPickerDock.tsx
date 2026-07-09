import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Box, Typography, Tabs, Tab, Chip, Collapse, CircularProgress, Tooltip, IconButton } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type {
  SiteAssetRef, SiteSection, SiteSectionVariant, SiteSectionType, SiteThemePersonality, MotionMode,
  SiteLayoutMode,
} from '../projects/types';
import { variantsForType, VARIANT_LABEL, SECTION_META, ADDABLE_SECTION_TYPES } from './siteTemplates';
import {
  MOTION_PRESETS, MOTION_CATEGORY_LABEL, MOTION_CATEGORY_ORDER, LIB_LABEL,
  CURATED_MOTIONS,
  type MotionCategory,
} from './motionPresets';
import { EDITORIAL_THEMES, PERSONALITY_LIST, CURATED_PERSONALITIES, MOTION_OPTIONS } from './editorialThemes';
import {
  LAYOUT_PRESETS, LAYOUT_CATEGORY_LABEL, LAYOUT_CATEGORY_ORDER, CURATED_LAYOUTS, type LayoutCategory,
} from './layoutPresets';
import {
  TEMPLATE_PRESETS, CATEGORY_LABEL, CATEGORY_ICON,
  type TemplateCategory, type TemplatePreset,
} from './templatePresets';
import { useMyAssets } from './useMyAssets';
import { sampleLibraryRefs } from './sampleAssets';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import { SITE_BUNDLES } from './siteBundles';

interface Props {
  projectId: string;
  selectedSectionId: string | null;
  selectedSection: SiteSection | undefined;
  personality: SiteThemePersonality;
  motionOverride: MotionMode | null;
  onPick: (ref: SiteAssetRef) => void;
  onSelectPersonality: (p: SiteThemePersonality) => void;
  onSelectMotion: (mode: MotionMode | null) => void;
  onSetVariant: (variant: SiteSectionVariant) => void;
  onSelectLayoutMode: (mode: SiteLayoutMode) => void;
  /** レイアウトプリセットを適用する。 */
  onApplyLayoutPreset: (id: string) => void;
  /** 現在適用中のレイアウトプリセット ID（ハイライト用）。 */
  currentLayoutPresetId?: string;
  onApplyMotionPreset: (presetId: string) => void;
  onApplyBundle: (id: string) => void;
  currentMotionPresetId?: string;
  /** 現在ページの全セクション（セクションタブの一覧表示用）。 */
  sections: SiteSection[];
  /** 一覧でクリックされたセクションを選択＋本文へスクロール。 */
  onSelectSection: (id: string) => void;
  /** セクションの公開/非表示を切り替える。 */
  onToggleHidden: (id: string, hidden: boolean) => void;
  /** セクションを削除する。 */
  onRemoveSection: (id: string) => void;
  /** ドラッグ並び替え後の順序を確定する。 */
  onReorder: (orderedIds: string[]) => void;
  /** afterId の直後にセクションを挿入（null＝先頭）。 */
  onInsertSection: (type: SiteSectionType, afterId: string | null) => void;
  /** 既存セクションの種類を変更する。 */
  onChangeSectionType: (id: string, type: SiteSectionType) => void;
  currentLayoutMode: SiteLayoutMode;
}

type DockTab = 'style' | 'layout' | 'motion' | 'sections' | 'assets';
type AssetSource = 'mine' | 'sample';

const CATEGORIES: TemplateCategory[] = ['editorial', 'minimal', 'dark', 'contemporary', 'accent'];

const MOTION_SHORT: Record<string, string> = {
  '自動（人格に従う）': '自動',
  '控えめ': '控えめ',
  '大胆': '大胆',
  'シネマティック': 'シネマ',
  '変わり種': '変わり種',
  '静止': '静止',
};

// ─── レイアウトカード定義 ────────────────────────────────────────────────
interface LayoutCard {
  mode: SiteLayoutMode;
  label: string;
  desc: string;
  svg: React.ReactNode;
}

const LayoutSVG: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 48 36" fill="none" width="48" height="36" style={{ display: 'block' }}>
    {children}
  </svg>
);

const LAYOUT_CARDS: LayoutCard[] = [
  {
    mode: 'editorial', label: 'エディトリアル', desc: '左サイドバー＋本文',
    svg: (
      <LayoutSVG>
        <rect x="2" y="2" width="10" height="32" stroke="currentColor" strokeWidth="1.5" rx="1"/>
        <line x1="16" y1="8" x2="46" y2="8" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="16" y1="16" x2="46" y2="16" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="16" y1="24" x2="40" y2="24" stroke="currentColor" strokeWidth="1.5"/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'minimal', label: 'ミニマル', desc: 'サイドバーなし、センター寄せ',
    svg: (
      <LayoutSVG>
        <line x1="8" y1="10" x2="40" y2="10" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="4" y1="18" x2="44" y2="18" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="8" y1="26" x2="40" y2="26" stroke="currentColor" strokeWidth="1.5"/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'magazine', label: 'マガジン', desc: 'トップヘッダー＋全幅',
    svg: (
      <LayoutSVG>
        <rect x="2" y="2" width="44" height="6" rx="1" fill="currentColor" opacity={0.4}/>
        <line x1="2" y1="14" x2="46" y2="14" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="2" y1="22" x2="46" y2="22" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="2" y1="30" x2="46" y2="30" stroke="currentColor" strokeWidth="1.5"/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'portfolio', label: 'ポートフォリオ', desc: 'フルスクリーン没入',
    svg: (
      <LayoutSVG>
        <rect x="2" y="2" width="44" height="32" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="8" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="42" cy="30" r="2" fill="currentColor" opacity={0.6}/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'split', label: 'スプリット', desc: '左ナビ＋右コンテンツ',
    svg: (
      <LayoutSVG>
        <rect x="2" y="2" width="14" height="32" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="20" y1="8" x2="46" y2="8" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="20" y1="18" x2="46" y2="18" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="20" y1="28" x2="40" y2="28" stroke="currentColor" strokeWidth="1.5"/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'studio', label: 'スタジオ', desc: 'トップバー＋全幅コンテンツ',
    svg: (
      <LayoutSVG>
        <line x1="2" y1="6" x2="46" y2="6" stroke="currentColor" strokeWidth="1"/>
        <line x1="2" y1="14" x2="46" y2="14" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="2" y1="22" x2="46" y2="22" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="2" y1="30" x2="46" y2="30" stroke="currentColor" strokeWidth="1.5"/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'immersive', label: 'イマーシブ', desc: 'ナビなし完全没入',
    svg: (
      <LayoutSVG>
        <rect x="2" y="2" width="44" height="32" fill="currentColor" opacity={0.15} rx="1"/>
        <line x1="10" y1="18" x2="38" y2="18" stroke="currentColor" strokeWidth="2"/>
      </LayoutSVG>
    ),
  },
  {
    mode: 'grid', label: 'グリッド', desc: 'グリッドマガジン',
    svg: (
      <LayoutSVG>
        <rect x="2" y="2" width="20" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="26" y="2" width="20" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="2" y="20" width="20" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="26" y="20" width="20" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      </LayoutSVG>
    ),
  },
];

// mode → SVG プレビュー（レイアウトプリセットカードで流用）。
const LAYOUT_SVG_BY_MODE: Record<SiteLayoutMode, React.ReactNode> =
  LAYOUT_CARDS.reduce((acc, c) => { acc[c.mode] = c.svg; return acc; }, {} as Record<SiteLayoutMode, React.ReactNode>);

// ─── プリセットカード（2 カラム用） ────────────────────────────────────
const PresetCard: React.FC<{ preset: TemplatePreset; active: boolean; onClick: () => void }> = ({
  preset, active, onClick,
}) => {
  const bg      = preset.overrides?.bg      ?? '#fbfaf8';
  const surface = preset.overrides?.surface ?? bg;
  const text    = preset.overrides?.text    ?? '#16140f';
  const accent  = preset.accent;
  const isDark  = (preset.overrides?.text ?? '').startsWith('#f') || (preset.overrides?.text ?? '').startsWith('rgba(24');

  return (
    <Tooltip title={preset.name} placement="top" arrow enterDelay={600}>
      <Box
        onClick={onClick}
        sx={{
          position: 'relative', borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
          border: `1.5px solid ${active ? '#00BFFF' : 'rgba(255,255,255,0.09)'}`,
          boxShadow: active ? '0 0 0 2px rgba(0,191,255,0.25)' : 'none',
          transition: 'border-color 0.12s, transform 0.1s, box-shadow 0.12s',
          '&:hover': { borderColor: active ? '#00BFFF' : 'rgba(255,255,255,0.28)', transform: 'translateY(-1px)' },
        }}
      >
        <Box sx={{ height: 52, bgcolor: bg, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute', top: 8, left: 8, right: 8, height: 20, borderRadius: 0.75, bgcolor: surface,
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)', opacity: surface === bg ? 0.4 : 0.85,
          }} />
          <Box sx={{ position: 'absolute', bottom: 7, left: 8, width: 28, height: 3, borderRadius: 2, bgcolor: accent }} />
          <Box sx={{ position: 'absolute', bottom: 7, left: 44, width: 20, height: 3, borderRadius: 2, bgcolor: text, opacity: 0.3 }} />
        </Box>
        <Box sx={{ px: 0.875, py: 0.625, bgcolor: bg, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: text, lineHeight: 1.25, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {preset.nameJa ?? preset.name}
          </Typography>
        </Box>
        {active && (
          <Box sx={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', bgcolor: '#00BFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.3)' }}>
            <Typography sx={{ fontSize: '0.45rem', color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</Typography>
          </Box>
        )}
      </Box>
    </Tooltip>
  );
};

// ─── セクション一覧の 1 行（ドラッグ並び替え対応） ─────────────────────
const SortableSectionRow: React.FC<{
  section: SiteSection;
  index: number;
  active: boolean;
  isHero: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  onChangeType: () => void;
}> = ({ section: s, index: i, active, isHero, onSelect, onToggleHidden, onRemove, onChangeType }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  return (
    <Box
      ref={setNodeRef}
      onClick={onSelect}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.625, borderRadius: 1.25, cursor: 'pointer',
        bgcolor: active ? 'rgba(0,191,255,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(0,191,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
        opacity: isDragging ? 0.6 : (s.hidden ? 0.55 : 1),
        position: 'relative', zIndex: isDragging ? 10 : 'auto',
        transition: 'border-color 0.12s, background-color 0.12s',
        '&:hover': { borderColor: active ? 'rgba(0,191,255,0.6)' : 'rgba(255,255,255,0.2)', '& .row-actions': { opacity: 1 } },
      }}
    >
      {/* ドラッグハンドル */}
      <IconButton
        size="small"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        sx={{ p: 0.25, color: 'rgba(255,255,255,0.3)', cursor: 'grab', '&:active': { cursor: 'grabbing' }, '&:hover': { color: '#fff' }, flexShrink: 0 }}
      >
        <DragIndicatorRoundedIcon sx={{ fontSize: '1rem' }} />
      </IconButton>
      <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: 'rgba(255,255,255,0.28)', width: 16, flexShrink: 0, textAlign: 'center' }}>
        {String(i + 1).padStart(2, '0')}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 700, color: active ? '#00BFFF' : '#fff', lineHeight: 1.3 }}>
          {s.title?.trim() || SECTION_META[s.type].label}
        </Typography>
        <Typography noWrap sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }}>
          {SECTION_META[s.type].label}{s.variant ? ` ・ ${VARIANT_LABEL[s.variant]}` : ''}{s.hidden ? ' ・ 非表示' : ''}
        </Typography>
      </Box>
      {/* アクション：表示切替・種類変更・削除 */}
      <Box className="row-actions" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: { xs: 1, md: 0.55 }, transition: 'opacity 0.12s' }}>
        <Tooltip title={s.hidden ? '公開対象に含める' : '公開時に非表示にする'}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleHidden(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
            {s.hidden ? <VisibilityOffRoundedIcon sx={{ fontSize: '0.95rem' }} /> : <VisibilityRoundedIcon sx={{ fontSize: '0.95rem' }} />}
          </IconButton>
        </Tooltip>
        {!isHero && (
          <Tooltip title="セクションの種類を変更">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onChangeType(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#00BFFF' } }}>
              <SwapHorizRoundedIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          </Tooltip>
        )}
        {!isHero && (
          <Tooltip title="このセクションを削除">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fa709a' } }}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

// ─── セクション一覧＋見せ方エディタ ─────────────────────────────────────
// 現在ページの全セクションを一覧表示。クリックで選択（本文へスクロール）、
// ドラッグで並び替え、各行で表示/非表示・削除ができる。
// 下半分で選択中セクションの「見せ方」(variant) を切り替える。
const SectionListEditor: React.FC<{
  sections: SiteSection[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onSetVariant: (v: SiteSectionVariant) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onRemoveSection: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onInsertSection: (type: SiteSectionType, afterId: string | null) => void;
  onChangeSectionType: (id: string, type: SiteSectionType) => void;
}> = ({ sections, selectedSectionId, onSelectSection, onSetVariant, onToggleHidden, onRemoveSection, onReorder, onInsertSection, onChangeSectionType }) => {
  const selected = sections.find(s => s.id === selectedSectionId);
  const variants = selected ? variantsForType(selected.type) : [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // セクション種類ピッカー（挿入 or 種類変更）。下部パネルにグリッド表示する。
  const [picker, setPicker] = useState<
    | { mode: 'insert'; afterId: string | null }
    | { mode: 'change'; id: string }
    | null
  >(null);

  const handlePickType = (type: SiteSectionType) => {
    if (!picker) return;
    if (picker.mode === 'insert') onInsertSection(type, picker.afterId);
    else onChangeSectionType(picker.id, type);
    setPicker(null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const ids = sections.map(s => s.id);
    const from = ids.indexOf(String(a.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  // セクション間のホバー挿入ゾーン
  const InsertZone: React.FC<{ afterId: string | null }> = ({ afterId }) => (
    <Box
      sx={{
        height: 10, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        '&:hover .ins-btn': { opacity: 1 }, '&:hover': { height: 22 }, transition: 'height 0.12s',
      }}
    >
      <IconButton
        className="ins-btn"
        size="small"
        onClick={(e) => { e.stopPropagation(); setPicker({ mode: 'insert', afterId }); }}
        sx={{
          opacity: 0, transition: 'opacity 0.12s', p: 0.1,
          bgcolor: 'rgba(0,191,255,0.2)', border: '1px solid rgba(0,191,255,0.5)', color: '#00BFFF',
          '&:hover': { bgcolor: 'rgba(0,191,255,0.32)' },
        }}
      >
        <AddRoundedIcon sx={{ fontSize: '0.9rem' }} />
      </IconButton>
    </Box>
  );

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* ══ 上半分：現在のセクション一覧（スクロール） ══ */}
      <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5, flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
          このページのセクション（{sections.length}）
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.25, pb: 1, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {sections.length === 0 ? (
          <Box sx={{ pt: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.8 }}>
              セクションがありません
            </Typography>
            <Box
              component="button"
              onClick={() => setPicker({ mode: 'insert', afterId: null })}
              sx={{
                mt: 1.5, display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                px: 1.5, py: 0.625, borderRadius: 1.25, border: '1px solid rgba(0,191,255,0.5)',
                bgcolor: 'rgba(0,191,255,0.12)', color: '#00BFFF', fontWeight: 700, fontSize: '0.72rem', fontFamily: 'inherit',
                '&:hover': { bgcolor: 'rgba(0,191,255,0.2)' },
              }}
            >
              <AddRoundedIcon sx={{ fontSize: '0.95rem' }} /> セクションを追加
            </Box>
          </Box>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {sections.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {/* 先頭の前にも挿入ゾーン */}
                    {i === 0 && <InsertZone afterId={null} />}
                    <SortableSectionRow
                      section={s}
                      index={i}
                      active={s.id === selectedSectionId}
                      isHero={s.type === 'hero'}
                      onSelect={() => onSelectSection(s.id)}
                      onToggleHidden={() => onToggleHidden(s.id, !s.hidden)}
                      onRemove={() => onRemoveSection(s.id)}
                      onChangeType={() => setPicker({ mode: 'change', id: s.id })}
                    />
                    {/* 各セクションの後ろに挿入ゾーン */}
                    <InsertZone afterId={s.id} />
                  </React.Fragment>
                ))}
              </Box>
            </SortableContext>
          </DndContext>
        )}
      </Box>
      </Box>

      {/* ══ 下半分：picker 有効時＝種類グリッド／通常時＝見せ方（スクロール） ══ */}
      <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {picker ? (
          /* ── セクション種類グリッド（挿入 / 種類変更 共用） ── */
          <>
            <Box sx={{ px: 1.5, pt: 1, pb: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                {picker.mode === 'change' ? 'セクションの種類を変更' : 'セクションを追加'}
              </Typography>
              <Box
                component="button"
                onClick={() => setPicker(null)}
                sx={{
                  px: 0.875, py: 0.3, borderRadius: 1, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                  bgcolor: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.62rem', fontFamily: 'inherit',
                  '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.35)' },
                }}
              >
                キャンセル
              </Box>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.25, pb: 1.5, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.625 }}>
                {ADDABLE_SECTION_TYPES.map(type => (
                  <Box
                    key={type}
                    onClick={() => handlePickType(type)}
                    sx={{
                      p: 0.875, borderRadius: 1.25, cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.12s',
                      '&:hover': { borderColor: 'rgba(0,191,255,0.5)', bgcolor: 'rgba(0,191,255,0.06)' },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{SECTION_META[type].label}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3, mt: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {SECTION_META[type].description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        ) : (
          /* ── 通常時：選択中セクションの見せ方 ── */
          <>
            <Box sx={{ px: 1.5, pt: 1, pb: 0.5, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                  見せ方{selected && variants.length > 0 ? `（${variants.length}）` : ''}
                </Typography>
                {selected && selected.type !== 'hero' && (
                  <Box
                    component="button"
                    onClick={() => setPicker({ mode: 'change', id: selected.id })}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.375, cursor: 'pointer',
                      px: 0.875, py: 0.3, borderRadius: 1, border: '1px solid rgba(255,255,255,0.15)',
                      bgcolor: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.62rem', fontFamily: 'inherit',
                      '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.35)' },
                    }}
                  >
                    種類を変更
                  </Box>
                )}
              </Box>
              {selected && (
                <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>
                  {selected.title?.trim() || SECTION_META[selected.type].label}
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pb: 1.5, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {!selected ? (
                <Box sx={{ pt: 4, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.9 }}>
                    上の一覧からセクションを<br />選択してください
                  </Typography>
                </Box>
              ) : variants.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625 }}>
                  {variants.map(v => {
                    const active = (selected.variant ?? '') === v;
                    return (
                      <Box
                        key={v}
                        onClick={() => onSetVariant(v)}
                        sx={{
                          px: 1, py: 0.4, borderRadius: 1, cursor: 'pointer',
                          bgcolor: active ? 'rgba(0,191,255,0.18)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${active ? 'rgba(0,191,255,0.55)' : 'rgba(255,255,255,0.1)'}`,
                          color: active ? '#00BFFF' : 'rgba(255,255,255,0.65)',
                          fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.4, transition: 'all 0.12s',
                          '&:hover': { color: active ? '#00BFFF' : '#fff' },
                        }}
                      >
                        {VARIANT_LABEL[v]}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
                  このセクションは見せ方が固定です。
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

// ─── 素材ピッカー（旧 assets タブ） ──────────────────────────────────────
const AssetPicker: React.FC<{
  projectId: string;
  selectedSectionId: string | null;
  onPick: (ref: SiteAssetRef) => void;
}> = ({ projectId, selectedSectionId, onPick }) => {
  const [source, setSource] = useState<AssetSource>('mine');
  const { items: myItems, loading } = useMyAssets(projectId);
  const sampleItems = useMemo(() => sampleLibraryRefs(), []);
  const items = source === 'mine' ? myItems : sampleItems;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: 1.5, pt: 1.25, pb: 0.875, display: 'flex', gap: 0.625 }}>
        {([['mine', 'マイ素材'], ['sample', 'サンプル']] as [AssetSource, string][]).map(([s, label]) => (
          <Box
            key={s}
            onClick={() => setSource(s)}
            sx={{
              px: 1, py: 0.4, borderRadius: 1, cursor: 'pointer',
              bgcolor: source === s ? 'rgba(0,191,255,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${source === s ? 'rgba(0,191,255,0.5)' : 'transparent'}`,
              color: source === s ? '#00BFFF' : 'rgba(255,255,255,0.5)',
              fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.4, transition: 'all 0.12s',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
      <Box sx={{ px: 1.5, pb: 0.875 }}>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1.55 }}>
          {selectedSectionId ? 'クリックで選択セクションへ追加' : 'クリックで新規セクションを作成'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, pb: 2, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {source === 'mine' && loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={22} sx={{ color: '#00BFFF' }} />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ pt: 6, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', lineHeight: 1.8 }}>
              マイ素材がありません
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.18)', mt: 0.5, lineHeight: 1.6 }}>
              各子アプリや AI Drive から<br />素材を保存してください
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.875 }}>
            {items.map(item => (
              <Box
                key={item.id}
                onClick={() => onPick(item)}
                sx={{
                  position: 'relative', borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.07)', bgcolor: '#0a0d17', aspectRatio: '16/10',
                  transition: 'border-color 0.12s, transform 0.1s',
                  '&:hover': { borderColor: 'rgba(0,191,255,0.6)', transform: 'translateY(-1px)', '& .pick-add': { opacity: 1 } },
                }}
              >
                {item.thumbnailUrl ? (
                  <Box component="img" src={item.thumbnailUrl} alt={item.title || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem', textAlign: 'center', p: 1 }}>
                    {item.title || '—'}
                  </Box>
                )}
                {item.sample && (
                  <Box sx={{ position: 'absolute', top: 4, left: 4 }}>
                    <Chip label="サンプル" size="small" sx={{ height: 15, fontSize: '0.5rem', fontWeight: 800, bgcolor: 'rgba(0,0,0,0.65)', color: '#ffd36b' }} />
                  </Box>
                )}
                <Box className="pick-add" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,191,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.12s' }}>
                  <AddRoundedIcon sx={{ color: '#fff', fontSize: 26 }} />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── コンポーネント本体 ────────────────────────────────────────────────
export const SiteAssetPickerDock: React.FC<Props> = ({
  projectId, selectedSectionId, selectedSection, personality, motionOverride,
  onPick, onSelectPersonality, onSelectMotion, onSetVariant,
  onApplyLayoutPreset, currentLayoutPresetId,
  onApplyMotionPreset, onApplyBundle, currentMotionPresetId, sections, onSelectSection,
  onToggleHidden, onRemoveSection, onReorder, onInsertSection, onChangeSectionType,
}) => {
  const [tab, setTab] = useState<DockTab>('style');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
  const [styleOpen, setStyleOpen] = useState(false);
  const [motionCat, setMotionCat] = useState<MotionCategory | null>(null); // null＝カテゴリ一覧
  const [layoutCat, setLayoutCat] = useState<LayoutCategory | null>(null); // null＝カテゴリ一覧
  const [intensityOpen, setIntensityOpen] = useState(false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // ── リサイズ ──────────────────────────────────────────────────────
  const MIN_W = 220;
  const MAX_W = 520;
  const [dockWidth, setDockWidth] = useState(360);
  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);
  useEffect(() => {
    setAiTaskInnerRight(dockWidth);
    return () => setAiTaskInnerRight(0);
  }, [dockWidth, setAiTaskInnerRight]);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(0);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = dockWidth;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [dockWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      setDockWidth(Math.min(MAX_W, Math.max(MIN_W, startW.current + delta)));
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current             = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  const applyPreset     = useProjectSiteStore(s => s.applyPreset);
  const currentPresetId = useProjectSiteStore(s => s.site?.theme.presetId);
  const activePreset    = useMemo(
    () => TEMPLATE_PRESETS.find(p => p.id === currentPresetId),
    [currentPresetId],
  );

  const filteredPresets = useMemo(
    () => activeCategory === 'all'
      ? TEMPLATE_PRESETS
      : TEMPLATE_PRESETS.filter(p => p.category === activeCategory),
    [activeCategory],
  );

  const TAB_DEFS: { val: DockTab; label: string }[] = [
    { val: 'style',    label: 'スタイル' },
    { val: 'layout',   label: 'レイアウト' },
    { val: 'motion',   label: 'モーション' },
    { val: 'sections', label: 'セクション' },
    { val: 'assets',   label: '素材' },
  ];

  return (
    <Box sx={{
      width: dockWidth, flexShrink: 0, height: '100%',
      display: 'flex', flexDirection: 'row',
      borderLeft: '1px solid rgba(255,255,255,0.07)', bgcolor: '#0c1018', position: 'relative',
    }}>
      {/* ── ドラッグハンドル（左端） */}
      <Box
        onMouseDown={onHandleMouseDown}
        sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          '&:hover .handle-line': { opacity: 1 },
          '& .handle-line': { opacity: 0, transition: 'opacity 0.15s' },
        }}
      >
        <Box className="handle-line" sx={{ width: 2, height: 40, borderRadius: 1, bgcolor: 'rgba(0,191,255,0.7)' }} />
      </Box>

      {/* ── 本体コンテンツ */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, pl: '6px' }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 38, borderBottom: '1px solid rgba(255,255,255,0.07)',
            '& .MuiTabs-indicator': { bgcolor: '#00BFFF', height: 2 },
          }}
        >
          {TAB_DEFS.map(({ val, label }) => (
            <Tab
              key={val}
              value={val}
              label={label}
              disableRipple
              sx={{
                minHeight: 38, fontSize: '0.63rem', fontWeight: 700, textTransform: 'none',
                color: tab === val ? '#fff' : 'rgba(255,255,255,0.42)', px: 0.75, minWidth: 0,
              }}
            />
          ))}
        </Tabs>

        {/* ===== スタイルタブ（personality + preset 統合） ===== */}
        {tab === 'style' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ px: 1.25, pt: 1, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', px: 0.25, mb: 0.75 }}>おすすめ構成（ワンクリック）</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.625 }}>
                {SITE_BUNDLES.map(b => (
                  <Box key={b.id} onClick={() => onApplyBundle(b.id)}
                    sx={{ p: 0.875, borderRadius: 1.25, cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.12s', '&:hover': { borderColor: 'rgba(0,191,255,0.5)', bgcolor: 'rgba(0,191,255,0.06)' } }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{b.name}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.3, mt: 0.25 }}>{b.description}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ px: 1.5, py: 0.875, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                  スタイル
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.4, color: activePreset ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                  {activePreset ? (activePreset.nameJa ?? activePreset.name) : EDITORIAL_THEMES[personality]?.label ?? personality}
                </Typography>
              </Box>
              {activePreset && (
                <Box
                  onClick={() => onSelectPersonality(personality)}
                  sx={{ flexShrink: 0, px: 1, py: 0.4, borderRadius: 1, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }, lineHeight: 1.4 }}
                >
                  クリア
                </Box>
              )}
            </Box>

            <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Box
                onClick={() => setStyleOpen(o => !o)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.875, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
              >
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                  ベーススタイル
                </Typography>
                <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', transform: styleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </Box>
              <Collapse in={styleOpen}>
                <Box sx={{ px: 1.25, pb: 1.25, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.625 }}>
                  {CURATED_PERSONALITIES.map(p => {
                    const t      = EDITORIAL_THEMES[p];
                    const active = personality === p;
                    return (
                      <Box
                        key={p}
                        onClick={() => onSelectPersonality(p)}
                        sx={{
                          borderRadius: 1.25, overflow: 'hidden', cursor: 'pointer',
                          border: `1.5px solid ${active ? '#00BFFF' : 'rgba(255,255,255,0.08)'}`,
                          transition: 'border-color 0.12s',
                          '&:hover': { borderColor: active ? '#00BFFF' : 'rgba(255,255,255,0.25)' },
                        }}
                      >
                        <Box sx={{ height: 28, bgcolor: t.bg, position: 'relative' }}>
                          <Box sx={{ position: 'absolute', bottom: 4, left: 6, width: 14, height: 3, borderRadius: 1, bgcolor: t.accent }} />
                        </Box>
                        <Box sx={{ px: 0.75, py: 0.5, bgcolor: t.bg }}>
                          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: active ? '#00BFFF' : (t.text ?? '#fff'), lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {t.label}{active ? ' ✓' : ''}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>

            <Box sx={{ px: 1.5, py: 1.5 }}>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
                上質な3スタイルに厳選しています。色や書体の細部は各スタイル選択後に調整できます。
              </Typography>
            </Box>
          </Box>
        )}

        {/* ===== レイアウトタブ（カテゴリフィルタ＋プリセットグリッド） ===== */}
        {tab === 'layout' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                厳選した3つのレイアウトから選べます。
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.25, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
                {CURATED_LAYOUTS.map(c => {
                  const active = currentLayoutPresetId === c.id;
                  return (
                    <Box key={c.id} onClick={() => onApplyLayoutPreset(c.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                        border: `1.5px solid ${active ? '#00BFFF' : 'rgba(255,255,255,0.09)'}`,
                        boxShadow: active ? '0 0 0 2px rgba(0,191,255,0.2)' : 'none',
                        bgcolor: active ? 'rgba(0,191,255,0.07)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.12s',
                        '&:hover': { borderColor: active ? '#00BFFF' : 'rgba(255,255,255,0.28)', transform: 'translateY(-1px)' },
                      }}>
                      <Box sx={{ flexShrink: 0, color: active ? '#00BFFF' : 'rgba(255,255,255,0.6)' }}>
                        {c.label === 'スタンダード' ? (
                          <LayoutSVG>
                            <rect x="2" y="2" width="44" height="5" rx="1" fill="currentColor" opacity={0.5}/>
                            <rect x="2" y="11" width="44" height="23" rx="1" fill="currentColor" opacity={0.12}/>
                            <line x1="2" y1="18" x2="46" y2="18" stroke="currentColor" strokeWidth="1" opacity={0.4}/>
                            <line x1="2" y1="24" x2="38" y2="24" stroke="currentColor" strokeWidth="1" opacity={0.3}/>
                          </LayoutSVG>
                        ) : c.label === '左サイドバー' ? (
                          <LayoutSVG>
                            <rect x="2" y="2" width="12" height="32" rx="1" fill="currentColor" opacity={0.35}/>
                            <rect x="17" y="2" width="29" height="5" rx="1" fill="currentColor" opacity={0.5}/>
                            <rect x="17" y="11" width="29" height="23" rx="1" fill="currentColor" opacity={0.12}/>
                            <line x1="17" y1="18" x2="46" y2="18" stroke="currentColor" strokeWidth="1" opacity={0.4}/>
                          </LayoutSVG>
                        ) : (
                          <LayoutSVG>
                            <rect x="2" y="2" width="10" height="32" rx="1" fill="currentColor" opacity={0.35}/>
                            <rect x="15" y="2" width="18" height="32" rx="1" fill="currentColor" opacity={0.12}/>
                            <rect x="36" y="2" width="10" height="32" rx="1" fill="currentColor" opacity={0.25}/>
                            <line x1="15" y1="10" x2="33" y2="10" stroke="currentColor" strokeWidth="1" opacity={0.4}/>
                            <line x1="15" y1="16" x2="33" y2="16" stroke="currentColor" strokeWidth="1" opacity={0.3}/>
                          </LayoutSVG>
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: active ? '#00BFFF' : '#fff', lineHeight: 1.3 }}>{c.label}</Typography>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, mt: 0.25 }}>{c.description}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}

        {/* ===== モーションタブ ===== */}
        {tab === 'motion' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                厳選した3つのモーションから選べます（細かな強度は下で調整可能）。
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.25, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
                {CURATED_MOTIONS.map(c => {
                  const active = currentMotionPresetId === c.id;
                  return (
                    <Box key={c.id} onClick={() => onApplyMotionPreset(c.id)}
                      sx={{ p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                        border: `1.5px solid ${active ? '#00BFFF' : 'rgba(255,255,255,0.09)'}`,
                        boxShadow: active ? '0 0 0 2px rgba(0,191,255,0.2)' : 'none',
                        bgcolor: active ? 'rgba(0,191,255,0.07)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.12s', '&:hover': { borderColor: active ? '#00BFFF' : 'rgba(255,255,255,0.28)', transform: 'translateY(-1px)' } }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: active ? '#00BFFF' : '#fff', lineHeight: 1.3 }}>{c.label}</Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, mt: 0.25 }}>{c.description}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
            {/* 強度（詳細・折りたたみ） */}
            <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Box onClick={() => setIntensityOpen(o => !o)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.875, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>強度を手動調整</Typography>
                <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', transform: intensityOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </Box>
              <Collapse in={intensityOpen}>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', px: 1.5, pb: 1.25 }}>
                  {MOTION_OPTIONS.map(opt => {
                    const active = motionOverride === opt.value;
                    const short = MOTION_SHORT[opt.label] ?? opt.label;
                    return (
                      <Box key={opt.value ?? 'auto'} onClick={() => onSelectMotion(opt.value)}
                        sx={{ px: 0.875, py: 0.375, borderRadius: 1, cursor: 'pointer',
                          bgcolor: active ? 'rgba(0,191,255,0.18)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${active ? 'rgba(0,191,255,0.55)' : 'transparent'}`,
                          color: active ? '#00BFFF' : 'rgba(255,255,255,0.5)',
                          fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                        {short}
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          </Box>
        )}

        {/* ===== セクションタブ ===== */}
        {tab === 'sections' && (
          <SectionListEditor
            sections={sections}
            selectedSectionId={selectedSectionId}
            onSelectSection={onSelectSection}
            onSetVariant={onSetVariant}
            onToggleHidden={onToggleHidden}
            onRemoveSection={onRemoveSection}
            onReorder={onReorder}
            onInsertSection={onInsertSection}
            onChangeSectionType={onChangeSectionType}
          />
        )}

        {/* ===== 素材タブ ===== */}
        {tab === 'assets' && (
          <AssetPicker projectId={projectId} selectedSectionId={selectedSectionId} onPick={onPick} />
        )}
      </Box>
    </Box>
  );
};
