import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Box, Button, ButtonGroup, Card, Chip, CircularProgress, Divider, IconButton,
  Tooltip, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tab, Tabs,
} from '@mui/material';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { FixedSizeGrid as Grid } from 'react-window';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DrawRoundedIcon from '@mui/icons-material/DrawRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAppStore } from '../../store/useAppStore';
import { dspRepository } from './api/dspRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { buildInitialContent, type TemplateId } from './templates/initialContentBuilders';
import { MiniSlidePreview } from './components/MiniSlidePreview';

// ─── Template Definitions ──────────────────────────────────────────────────────

export const TEMPLATES: {
  id: TemplateId;
  title: string;
  description: string;
  icon: React.ReactNode;
  color?: string;
  badge?: string;
}[] = [
  {
    id: 'blank',
    title: '空白',
    description: '何も配置されていない白紙のスライドから自由に作成します。',
    icon: <AddCircleOutlineRoundedIcon sx={{ fontSize: 26 }} />,
    color: 'light-dark(#0775a6, #29b6f6)',
  },
  {
    id: 'client_proposal',
    title: 'クライアント\n提案書',
    description: '表紙・目次・コンセプト・プラン・概算費用の5枚構成。クライアントへの提案に最適です。',
    icon: <SlideshowRoundedIcon sx={{ fontSize: 26 }} />,
    color: '#0a84ff',
    badge: '5枚',
  },
  {
    id: 'interior_pres',
    title: 'インテリア\nプレゼン',
    description: 'ビジュアル重視のインテリア提案書。フルブリード画像レイアウトで空間の魅力を伝えます。',
    icon: <HomeRoundedIcon sx={{ fontSize: 26 }} />,
    color: '#30d158',
    badge: '3枚',
  },
  {
    id: 'design_review',
    title: 'デザイン\nレビュー',
    description: '社内・チーム向けのビフォーアフター比較とフィードバック整理シート（3枚）。',
    icon: <DashboardRoundedIcon sx={{ fontSize: 26 }} />,
    color: '#ff9f0a',
    badge: '3枚',
  },
  {
    id: 'mood_board',
    title: 'ムード\nボード',
    description: '7枚の画像グリッドとカラーパレット付き。空間イメージを視覚的に伝えます。',
    icon: <ImageRoundedIcon sx={{ fontSize: 26 }} />,
    color: '#ff375f',
    badge: '1枚',
  },
  {
    id: 'material_board',
    title: 'マテリアル\nボード',
    description: '素材・仕上げ材の提案ボード＋カラースキームシート（2枚）。仕上げ選定に。',
    icon: <PaletteRoundedIcon sx={{ fontSize: 26 }} />,
    color: 'light-dark(#6f0da1, #bf5af2)',
    badge: '2枚',
  },
  {
    id: 'diagram',
    title: 'ダイアグラム',
    description: 'ゾーニング図とプロセスフロー図のスターター（2枚）。計画・動線の整理に。',
    icon: <AccountTreeRoundedIcon sx={{ fontSize: 26 }} />,
    color: 'light-dark(#007bad, #64d2ff)',
    badge: '2枚',
  },
  {
    id: 'spec_sheet',
    title: '仕様書\nスペック表',
    description: '家具リスト＋建材・仕上げ材リストの2シート構成。品番・数量・金額を管理。',
    icon: <ListAltRoundedIcon sx={{ fontSize: 26 }} />,
    color: '#a2845e',
    badge: '2枚',
  },
  {
    id: 'infinite_board',
    title: '無限ボード',
    description: '自由にアイデアを書き出すための無限キャンバス。ブレスト・スケッチに。',
    icon: <DrawRoundedIcon sx={{ fontSize: 26 }} />,
    color: '#9b59b6',
  },
];

const DENSITY_PRESETS = [
  { key: 'compact', label: '小', value: 168 },
  { key: 'default', label: '中', value: 210 },
  { key: 'large',   label: '大', value: 246 },
];

type SortKey = 'updatedAt_desc' | 'updatedAt_asc' | 'createdAt_desc' | 'name_asc' | 'name_desc' | 'slides_desc';
const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: 'updatedAt_desc', label: '更新日↓新しい順', icon: <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'updatedAt_asc',  label: '更新日↑古い順',  icon: <ArrowUpwardRoundedIcon  sx={{ fontSize: 14 }} /> },
  { key: 'createdAt_desc', label: '作成日↓新しい順', icon: <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'name_asc',       label: '名前 A→Z',       icon: <ArrowUpwardRoundedIcon  sx={{ fontSize: 14 }} /> },
  { key: 'name_desc',      label: '名前 Z→A',       icon: <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'slides_desc',    label: 'スライド数多い順',icon: <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} /> },
];

type TypeFilter = 'all' | 'presentation' | 'canvas';

const BADGE_COLOR = '#29b6f6';

// ─── Shared panel button styles ────────────────────────────────────────────────

const activeTypeSx = {
  bgcolor: 'rgba(41,182,246,0.15)',
  color: 'light-dark(#0775a6, #29b6f6)',
  borderColor: 'rgba(41,182,246,0.4)',
  '&:hover': { bgcolor: 'rgba(41,182,246,0.22)' },
  textTransform: 'none' as const,
  fontSize: 12,
  fontWeight: 600,
};
const inactiveTypeSx = {
  color: 'rgb(var(--brand-fg-rgb) / 0.4)',
  borderColor: 'rgb(var(--brand-fg-rgb) / 0.12)',
  '&:hover': { color: 'light-dark(#0775a6, #29b6f6)', bgcolor: 'rgba(41,182,246,0.06)', borderColor: 'rgba(41,182,246,0.25)' },
  textTransform: 'none' as const,
  fontSize: 12,
  fontWeight: 500,
};
const activeSortSx = {
  bgcolor: 'rgba(41,182,246,0.15)',
  color: 'light-dark(#0775a6, #29b6f6)',
  borderColor: 'rgba(41,182,246,0.35)',
  border: '1px solid',
  borderRadius: 1,
  textTransform: 'none' as const,
};
const inactiveSortSx = {
  color: 'rgb(var(--brand-fg-rgb) / 0.4)',
  borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)',
  border: '1px solid',
  borderRadius: 1,
  textTransform: 'none' as const,
  '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.75)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
};
const sectionLabelSx = {
  color: 'text.secondary',
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  mb: 1,
  display: 'block',
};

// ─── ResizeObserver hook (same as DssModelsGrid) ───────────────────────────────

function useElementSizeWithLastNonZero() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (node) {
      const measure = () => {
        const rect = node.getBoundingClientRect();
        setSize(prev => {
          const w = Math.floor(rect.width);
          const h = Math.floor(rect.height);
          if (prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
      };
      measure();
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(node);
    }
  }, []);
  return [ref, size] as const;
}

// react-window outer wrapper (same pattern as DssModelsGrid)
const WindowOuter = React.forwardRef<HTMLDivElement, any>(function WindowOuter(props, ref) {
  const { style, ...rest } = props;
  return (
    <div ref={ref} {...rest} style={{ ...style, overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', width: 'calc(100% + 1px)', touchAction: 'pan-y' }} />
  );
});

// ─── Presentation Card (matches DssModelCard design language) ──────────────────

const PresentationCard: React.FC<{
  item: any;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  cardSize?: number;
}> = ({ item, isSelected, onClick, onDoubleClick, onDelete, cardSize = 210 }) => {
  const isCanvas = item.type === 'canvas';
  const slideCount: number = item.content?.pages?.length ?? 0;
  const firstPage = item.content?.pages?.[0];
  const hasElements = (firstPage?.elements?.length ?? 0) > 0;
  const canvasSize = item.content?.canvasSize ?? null;
  const previewContainerSize = cardSize - 16; // 8px padding each side in GridCell
  const title = item.name || 'Untitled';
  const updatedAt = item.updatedAt || item.createdAt;
  const dateStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '';

  // ── 3D Tilt (same as DssModelCard) ──
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const mouseXSpring = useSpring(mouseX, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(mouseY, { stiffness: 400, damping: 30 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['9deg', '-9deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-9deg', '9deg']);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => { mouseX.set(0); mouseY.set(0); };

  const typeChipSx = {
    height: 22,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.01em',
    boxShadow: '0 1px 0 rgba(0,0,0,0.22), 0 0 0 1px rgb(var(--slate-panel-rgb) / 0.6)',
    ...(isCanvas ? {
      color: '#1a0b2e',
      background: 'linear-gradient(135deg, rgba(155,89,182,0.95), rgba(186,136,215,0.92))',
      border: '1px solid rgba(224,188,255,0.65)',
    } : {
      color: '#0b2239',
      background: 'linear-gradient(135deg, rgba(41,182,246,0.95), rgba(129,212,250,0.9))',
      border: '1px solid rgba(179,229,252,0.75)',
    }),
  };

  const slideCountChipSx = {
    height: 20,
    fontSize: 10,
    fontWeight: 600,
    bgcolor: 'rgb(var(--slate-panel-rgb) / 0.6)',
    color: 'var(--brand-fg)',
    border: isSelected ? `2px solid ${BADGE_COLOR}` : '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
  };

  return (
    <Box sx={{ width: '100%', height: '100%', perspective: 1400 }}>
      <motion.div
        style={{ width: '100%', height: '100%', rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <Card
          elevation={0}
          data-model-card="true"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          sx={{
            position: 'relative',
            height: '100%',
            aspectRatio: '1 / 1',
            backgroundColor: 'var(--brand-bg)',
            backgroundImage: 'radial-gradient(circle at 20% 0%, rgb(var(--slate-mid-rgb) / 0.4) 0%, rgb(var(--slate-deep-rgb) / 1) 70%)',
            borderRadius: 3,
            border: '1px solid rgb(var(--slate-800-rgb) / 0.9)',
            boxShadow: isSelected
              ? `0 18px 30px rgb(var(--slate-panel-rgb) / 0.9), 0 0 18px ${BADGE_COLOR}33`
              : '0 8px 16px rgba(0,0,0,0.4)',
            borderColor: isSelected ? undefined : 'rgb(var(--slate-ink-rgb) / 0.2)',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            overflow: 'hidden',
            userSelect: 'none',
            cursor: 'pointer',
            '&:hover': {
              boxShadow: isSelected
                ? `0 24px 40px rgb(var(--slate-panel-rgb) / 1), 0 0 24px ${BADGE_COLOR}33`
                : '0 16px 32px rgba(0,0,0,0.6), 0 0 4px rgb(var(--slate-ink-rgb) / 0.3)',
              borderColor: isSelected ? undefined : 'rgb(var(--slate-ink-rgb) / 0.4)',
            },
            '& .DspPresentCard-icon': {
              transition: 'transform 220ms cubic-bezier(0.22,0.61,0.36,1), filter 220ms ease',
            },
            '&:hover .DspPresentCard-icon': {
              transform: 'scale(1.15) translateY(-4px)',
              filter: 'drop-shadow(8px 16px 20px rgba(0,0,0,0.8))',
            },
            '& .DspPresentCard-details': {
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.2s ease',
            },
            '&:hover .DspPresentCard-details': {
              opacity: 1,
              pointerEvents: 'auto',
            },
            '&::after': isSelected ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: `3px solid rgba(41,182,246,0.55)`,
              pointerEvents: 'none',
              zIndex: 20,
            } : undefined,
          }}
        >
          {/* ── Slide Thumbnail / Fallback Icon ─────────────── */}
          {item.thumbnailUrl ? (
            <Box
              component="img"
              src={item.thumbnailUrl}
              alt={title}
              sx={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          ) : hasElements ? (
            <MiniSlidePreview
              page={firstPage}
              canvasSize={canvasSize}
              containerSize={previewContainerSize}
            />
          ) : (
            <Box
              className="DspPresentCard-icon"
              sx={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              {isCanvas
                ? <DrawRoundedIcon sx={{ fontSize: 72, color: 'rgba(155,89,182,0.28)', filter: 'drop-shadow(0 8px 16px rgba(155,89,182,0.3))' }} />
                : <SlideshowRoundedIcon sx={{ fontSize: 72, color: 'light-dark(rgba(7,117,166,0.22), rgba(41,182,246,0.22))', filter: 'drop-shadow(0 8px 16px rgba(41,182,246,0.25))' }} />
              }
            </Box>
          )}

          {/* ── Top-Left Info Chips (hover) ─────────────────── */}
          <Box
            className="DspPresentCard-details"
            sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 0.8, maxWidth: '86%' }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
              <Chip size="small" label={isCanvas ? '無限ボード' : 'スライド'} sx={typeChipSx} />
            </Box>
            {slideCount > 0 && (
              <Chip size="small" label={`${slideCount} スライド`} sx={slideCountChipSx} />
            )}
            {(item.tags as string[] | undefined)?.slice(0, 3).map((tag: string) => (
              <Chip key={tag} size="small" label={tag} sx={{
                height: 18, fontSize: 10, fontWeight: 600, borderRadius: 999,
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.65)',
                border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
              }} />
            ))}
          </Box>

          {/* ── Top-Right Quick Action (hover) ──────────────── */}
          <Box className="DspPresentCard-details" sx={{ position: 'absolute', top: 4, right: 4, zIndex: 13 }}>
            <Tooltip title="エディタで開く">
              <IconButton
                size="small"
                onClick={e => { e.stopPropagation(); onDoubleClick(); }}
                sx={{ backgroundColor: 'rgb(var(--slate-panel-rgb) / 0.8)', '&:hover': { backgroundColor: 'rgb(var(--slate-panel-rgb) / 1)' } }}
              >
                <EditRoundedIcon sx={{ fontSize: 18, color: 'var(--brand-fg)' }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* ── Bottom Action Bar (hover) ────────────────────── */}
          <Box
            className="DspPresentCard-details"
            sx={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              pt: 1.1, pb: 0.8, px: 1.2,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
              background: 'linear-gradient(to top, rgb(var(--slate-panel-rgb) / 0.96), rgb(var(--slate-panel-rgb) / 0.75), rgb(var(--slate-panel-rgb) / 0))',
              backdropFilter: 'blur(6px)',
              zIndex: 12,
            }}
          >
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
              <Typography noWrap sx={{ color: 'var(--brand-fg)', fontWeight: 600, fontSize: 13 }} title={title}>
                {title}
              </Typography>
              {dateStr && (
                <Typography noWrap variant="caption" sx={{ color: 'rgb(var(--slate-ink-rgb) / 0.95)', fontSize: 11 }}>
                  {dateStr}
                </Typography>
              )}
            </Box>
            <Box sx={{ flexShrink: 0, display: 'flex' }}>
              <Tooltip title="削除">
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); onDelete(); }}
                  sx={{ p: 0.5 }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#f97316' }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Card>
      </motion.div>
    </Box>
  );
};

// ─── Presentation Grid (matches DssModelsGrid) ────────────────────────────────

const GridCell = React.memo(({ columnIndex, rowIndex, style, data }: any) => {
  const { items, selectedItemId, onSelectItem, onOpenEditor, onDelete, columnCount, paddingLeft, cardSize } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= items.length) return null;
  const item = items[index];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        ...style,
        left: typeof style.left === 'number' ? style.left + paddingLeft : `calc(${style.left} + ${paddingLeft}px)`,
        display: 'flex',
        padding: 8,
      }}
    >
      <Box sx={{ flex: 1, height: '100%', position: 'relative' }}>
        <PresentationCard
          item={item}
          isSelected={selectedItemId === item.id}
          onClick={() => onSelectItem(item)}
          onDoubleClick={() => onOpenEditor(item)}
          onDelete={() => onDelete(item)}
          cardSize={cardSize}
        />
      </Box>
    </motion.div>
  );
});
GridCell.displayName = 'DspGridCell';

const PresentationGrid: React.FC<{
  items: any[];
  cardSize: number;
  selectedItemId?: string | null;
  onSelectItem: (item: any) => void;
  onOpenEditor: (item: any) => void;
  onDelete: (item: any) => void;
}> = ({ items, cardSize, selectedItemId, onSelectItem, onOpenEditor, onDelete }) => {
  const [containerRef, { width, height }] = useElementSizeWithLastNonZero();
  const columnCount = useMemo(() => Math.max(1, Math.floor(width / cardSize)), [width, cardSize]);
  const rowCount = useMemo(() => Math.ceil((items?.length || 0) / columnCount), [items?.length, columnCount]);
  const paddingLeft = Math.floor(Math.max(0, width - columnCount * cardSize) / 2);

  const gridData = useMemo(() => ({
    items, selectedItemId, onSelectItem, onOpenEditor, onDelete, columnCount, paddingLeft, cardSize,
  }), [items, selectedItemId, onSelectItem, onOpenEditor, onDelete, columnCount, paddingLeft, cardSize]);

  return (
    <Box ref={containerRef} sx={{ flex: 1, width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      {width > 0 && height > 0 && (
        <Grid
          columnCount={columnCount}
          columnWidth={cardSize}
          rowCount={rowCount}
          rowHeight={cardSize}
          width={width}
          height={height}
          outerElementType={WindowOuter}
          itemData={gridData}
        >
          {GridCell}
        </Grid>
      )}
    </Box>
  );
};

// ─── DspRightPanel (Portal) ────────────────────────────────────────────────────

const DspRightPanel: React.FC<{
  selectedItem: any;
  onOpen: () => void;
  onDelete: (item: any) => void;
  onToggleVisibility: (item: any, visibility: 'public' | 'private') => Promise<void>;
  onUpdateTags: (item: any, tags: string[]) => Promise<void>;
  typeFilter: TypeFilter;
  setTypeFilter: (v: TypeFilter) => void;
  sortKey: SortKey;
  setSortKey: (v: SortKey) => void;
  tagFilter: string | null;
  setTagFilter: (v: string | null) => void;
  allTags: string[];
  onReset: () => void;
}> = ({
  selectedItem, onOpen, onDelete, onToggleVisibility, onUpdateTags,
  typeFilter, setTypeFilter, sortKey, setSortKey, tagFilter, setTagFilter, allTags, onReset,
}) => {
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  useEffect(() => {
    setLocalTags(selectedItem?.tags ?? []);
    setTagInput('');
  }, [selectedItem?.id]);

  useEffect(() => {
    let unmounted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const findNode = () => {
      if (unmounted) return;
      const node = document.getElementById('dsp-right-sidebar-portal');
      if (node) { setPortalNode(node); } else { timer = setTimeout(findNode, 100); }
    };
    findNode();
    return () => { unmounted = true; if (timer) clearTimeout(timer); };
  }, []);

  if (!portalNode) return null;

  // ── Helpers for item panel ──
  const isCanvas = selectedItem?.type === 'canvas';
  const slideCount: number = selectedItem?.content?.pages?.length ?? 0;
  const isPublic = selectedItem?.visibility === 'public';
  const inspectorFirstPage = selectedItem?.content?.pages?.[0];
  const inspectorHasElements = (inspectorFirstPage?.elements?.length ?? 0) > 0;
  const inspectorCanvasSize = selectedItem?.content?.canvasSize ?? null;

  const fmtDate = (str?: string) => {
    if (!str) return '—';
    try { return new Date(str).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch { return str; }
  };

  const handleVisibilityToggle = async (newVisibility: 'public' | 'private') => {
    if (isTogglingVisibility || selectedItem?.visibility === newVisibility) return;
    setIsTogglingVisibility(true);
    try { await onToggleVisibility(selectedItem, newVisibility); }
    finally { setIsTogglingVisibility(false); }
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim();
    if (!tag || localTags.includes(tag)) { setTagInput(''); return; }
    const next = [...localTags, tag];
    setLocalTags(next);
    setTagInput('');
    setIsSavingTags(true);
    try { await onUpdateTags(selectedItem, next); } finally { setIsSavingTags(false); }
  };

  const handleRemoveTag = async (tag: string) => {
    const next = localTags.filter(t => t !== tag);
    setLocalTags(next);
    setIsSavingTags(true);
    try { await onUpdateTags(selectedItem, next); } finally { setIsSavingTags(false); }
  };

  const filteredTagList = tagSearch
    ? allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTags;

  const panelContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', bgcolor: 'var(--brand-bg)' }}>
      {/* ── Panel Header ─────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 1.25,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <FilterAltRoundedIcon sx={{ fontSize: 15, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.6)', letterSpacing: 0.3 }}>
            Search &amp; Filter
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={onReset}
          sx={{ fontSize: 11, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.35)', py: 0.25, px: 1, minWidth: 0, '&:hover': { color: 'light-dark(#0775a6, #29b6f6)', bgcolor: 'transparent' } }}
        >
          Reset
        </Button>
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* ── TYPE ─────────────────────────────────────────────── */}
        <Box>
          <Typography variant="caption" sx={sectionLabelSx}>TYPE</Typography>
          <ButtonGroup fullWidth size="small" sx={{ mb: 0.5, '& .MuiButton-root': { py: 0.6 } }}>
            <Button onClick={() => setTypeFilter('all')} sx={typeFilter === 'all' ? activeTypeSx : inactiveTypeSx}>ALL</Button>
            <Button onClick={() => setTypeFilter('presentation')} sx={typeFilter === 'presentation' ? activeTypeSx : inactiveTypeSx}>スライド</Button>
            <Button onClick={() => setTypeFilter('canvas')} sx={typeFilter === 'canvas' ? activeTypeSx : inactiveTypeSx}>無限ボード</Button>
          </ButtonGroup>
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />

        {/* ── SORT ─────────────────────────────────────────────── */}
        <Box>
          <Typography variant="caption" sx={sectionLabelSx}>SORT</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
            {SORT_OPTIONS.map(opt => (
              <Button
                key={opt.key}
                size="small"
                onClick={() => setSortKey(opt.key)}
                sx={sortKey === opt.key
                  ? { ...activeSortSx, fontSize: 11, py: 0.5, px: 0.75, lineHeight: 1.3, whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start' }
                  : { ...inactiveSortSx, fontSize: 11, py: 0.5, px: 0.75, lineHeight: 1.3, whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start' }
                }
              >
                {opt.label}
              </Button>
            ))}
          </Box>
        </Box>

        {allTags.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />

            {/* ── TAGS ─────────────────────────────────────────────── */}
            <Box>
              <Typography variant="caption" sx={sectionLabelSx}>TAGS</Typography>
              {allTags.length > 6 && (
                <TextField
                  size="small"
                  placeholder="タグを絞り込み..."
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  sx={{
                    mb: 1, width: '100%',
                    '& .MuiOutlinedInput-root': {
                      height: 26, fontSize: 11, color: 'var(--brand-fg)',
                      '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
                      '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                      '&.Mui-focused fieldset': { borderColor: 'rgba(41,182,246,0.5)' },
                      '& input': { py: 0, px: 1 },
                    },
                  }}
                />
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {tagFilter && (
                  <Chip
                    label="解除"
                    size="small"
                    clickable
                    onClick={() => setTagFilter(null)}
                    onDelete={() => setTagFilter(null)}
                    deleteIcon={<CloseRoundedIcon sx={{ fontSize: '10px !important' }} />}
                    sx={{
                      height: 20, fontSize: 10,
                      color: 'light-dark(#0352aa, #93c5fd)', border: '1px solid rgba(41,182,246,0.3)',
                      bgcolor: 'rgba(41,182,246,0.1)',
                    }}
                  />
                )}
                {filteredTagList.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    clickable
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    sx={tagFilter === tag ? {
                      height: 20, fontSize: 10, fontWeight: 600,
                      bgcolor: 'rgba(41,182,246,0.18)', color: 'light-dark(#0352aa, #93c5fd)',
                      border: '1px solid rgba(41,182,246,0.35)',
                    } : {
                      height: 20, fontSize: 10,
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', color: 'rgb(var(--brand-fg-rgb) / 0.5)',
                      border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
                      '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.85)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </>
        )}

        {/* ── Item Info (when selected) ─────────────────────────── */}
        {selectedItem && (
          <>
            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.09)', mt: 0.5 }} />

            {/* Preview */}
            <Box sx={{
              aspectRatio: `${(inspectorCanvasSize?.width || 1587) / (inspectorCanvasSize?.height || 1122)}`,
              borderRadius: 2,
              border: '1px solid rgb(var(--slate-800-rgb) / 0.9)',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              bgcolor: selectedItem.thumbnailUrl || inspectorHasElements ? '#fff' : 'var(--brand-bg)',
              backgroundImage: selectedItem.thumbnailUrl || inspectorHasElements ? 'none' : 'radial-gradient(circle at 20% 0%, rgb(var(--slate-mid-rgb) / 0.4) 0%, rgb(var(--slate-deep-rgb) / 1) 70%)',
            }}>
              {selectedItem.thumbnailUrl ? (
                <Box component="img" src={selectedItem.thumbnailUrl} alt=""
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : inspectorHasElements ? (
                <MiniSlidePreview
                  page={inspectorFirstPage}
                  canvasSize={inspectorCanvasSize}
                  containerSize={220}
                />
              ) : (
                isCanvas
                  ? <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DrawRoundedIcon sx={{ fontSize: 72, color: 'rgba(155,89,182,0.3)' }} /></Box>
                  : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SlideshowRoundedIcon sx={{ fontSize: 72, color: 'light-dark(rgba(7,117,166,0.25), rgba(41,182,246,0.25))' }} /></Box>
              )}
            </Box>

            {/* Title & Badge */}
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-fg)', mb: 0.75, lineHeight: 1.4 }}>
                {selectedItem.name || 'Untitled'}
              </Typography>
              <Chip
                label={isCanvas ? '無限ボード' : 'スライドプレゼン'}
                size="small"
                sx={{
                  height: 20, fontSize: 11,
                  ...(isCanvas ? {
                    color: '#1a0b2e',
                    background: 'linear-gradient(135deg, rgba(155,89,182,0.95), rgba(186,136,215,0.92))',
                    border: '1px solid rgba(224,188,255,0.5)',
                  } : {
                    color: '#0b2239',
                    background: 'linear-gradient(135deg, rgba(41,182,246,0.95), rgba(129,212,250,0.9))',
                    border: '1px solid rgba(179,229,252,0.6)',
                  }),
                }}
              />
            </Box>

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />

            {/* Metadata */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {slideCount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>スライド数</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)', fontWeight: 600 }}>{slideCount}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>作成日</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>{fmtDate(selectedItem.createdAt)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>更新日</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>{fmtDate(selectedItem.updatedAt)}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />

            {/* Tags for selected item */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalOfferRoundedIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', letterSpacing: 0.3 }}>タグ</Typography>
                </Box>
                {isSavingTags && <CircularProgress size={10} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1 }}>
                {localTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                    deleteIcon={<CloseRoundedIcon sx={{ fontSize: '10px !important' }} />}
                    sx={{
                      height: 20, fontSize: 11, fontWeight: 500,
                      bgcolor: 'rgba(41,182,246,0.12)', color: 'light-dark(#0352aa, #93c5fd)',
                      border: '1px solid rgba(41,182,246,0.2)',
                      '& .MuiChip-deleteIcon': { color: 'light-dark(rgba(3,82,170,0.5), rgba(147,197,253,0.5))', '&:hover': { color: 'light-dark(#0352aa, #93c5fd)' } },
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <TextField
                  size="small"
                  placeholder="タグを追加..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      height: 28, fontSize: 12, color: 'var(--brand-fg)',
                      '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
                      '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                      '&.Mui-focused fieldset': { borderColor: 'rgba(41,182,246,0.5)' },
                      '& input': { py: 0, px: 1 },
                    },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  sx={{
                    width: 28, height: 28,
                    bgcolor: 'rgba(41,182,246,0.15)',
                    color: 'light-dark(#0775a6, #29b6f6)',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'rgba(41,182,246,0.25)' },
                    '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.15)' },
                  }}
                >
                  <AddRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />

            {/* Visibility Toggle */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', letterSpacing: 0.3 }}>
                  公開設定
                </Typography>
                {isTogglingVisibility && (
                  <CircularProgress size={12} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
                )}
              </Box>
              <ButtonGroup
                size="small"
                variant="outlined"
                fullWidth
                disabled={isTogglingVisibility}
                sx={{
                  '& .MuiButton-root': {
                    textTransform: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    py: 0.75,
                    borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)',
                    transition: 'all 0.18s ease',
                  },
                }}
              >
                <Button
                  startIcon={<PublicRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => handleVisibilityToggle('public')}
                  sx={isPublic ? {
                    bgcolor: 'rgba(41,182,246,0.15)',
                    color: 'light-dark(#0775a6, #29b6f6)',
                    borderColor: 'rgba(41,182,246,0.4) !important',
                    '&:hover': { bgcolor: 'rgba(41,182,246,0.22)' },
                  } : {
                    color: 'rgb(var(--brand-fg-rgb) / 0.3)',
                    '&:hover': { color: 'light-dark(#0775a6, #29b6f6)', bgcolor: 'rgba(41,182,246,0.08)', borderColor: 'rgba(41,182,246,0.25) !important' },
                  }}
                >
                  公開
                </Button>
                <Button
                  startIcon={<LockRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => handleVisibilityToggle('private')}
                  sx={!isPublic ? {
                    bgcolor: 'rgba(249,115,22,0.12)',
                    color: '#f97316',
                    borderColor: 'rgba(249,115,22,0.35) !important',
                    '&:hover': { bgcolor: 'rgba(249,115,22,0.2)' },
                  } : {
                    color: 'rgb(var(--brand-fg-rgb) / 0.3)',
                    '&:hover': { color: '#f97316', bgcolor: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.25) !important' },
                  }}
                >
                  非公開
                </Button>
              </ButtonGroup>
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {isPublic
                  ? <><PublicRoundedIcon sx={{ fontSize: 12, color: 'light-dark(#0775a6, #29b6f6)' }} /><Typography variant="caption" sx={{ color: 'light-dark(#0775a6, #29b6f6)', fontSize: 11 }}>公開中 — Presentationsフィードに表示されます</Typography></>
                  : <><LockRoundedIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} /><Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 11 }}>非公開 — 自分だけが閲覧できます</Typography></>
                }
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={onOpen}
                startIcon={<EditRoundedIcon />}
                sx={{
                  bgcolor: BADGE_COLOR, color: 'rgba(0,0,0,0.85)', fontWeight: 700,
                  textTransform: 'none', borderRadius: 1.5,
                  '&:hover': { bgcolor: '#4fc3f7' },
                }}
              >
                エディタで開く
              </Button>
              <Button
                variant="outlined"
                fullWidth
                size="small"
                onClick={() => onDelete(selectedItem)}
                startIcon={<DeleteOutlineRoundedIcon />}
                sx={{
                  textTransform: 'none', borderRadius: 1.5,
                  color: 'rgba(249,115,22,0.8)', borderColor: 'rgba(249,115,22,0.25)',
                  '&:hover': { color: '#f97316', borderColor: 'rgba(249,115,22,0.6)', bgcolor: 'rgba(249,115,22,0.05)' },
                }}
              >
                削除
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );

  return createPortal(panelContent, portalNode);
};

// ─── New Presentation Dialog ───────────────────────────────────────────────────

const NewPresentationDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (templateId: string, name: string) => Promise<void>;
  isCreating: boolean;
}> = ({ open, onClose, onSubmit, isCreating }) => {
  const [selectedId, setSelectedId] = useState<TemplateId>('blank');
  const [name, setName] = useState('');
  const selectedTemplate = TEMPLATES.find(t => t.id === selectedId) ?? TEMPLATES[0];

  const handleSelect = (id: TemplateId) => {
    setSelectedId(id);
    const tpl = TEMPLATES.find(t => t.id === id)!;
    const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    setName(`${tpl.title.replace('\n', '')} ${dateStr}`);
  };

  React.useEffect(() => {
    if (open) {
      setSelectedId('blank');
      const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
      setName(`空白のプレゼン ${dateStr}`);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', borderRadius: 2.5, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}
    >
      <DialogTitle sx={{ color: 'var(--brand-fg)', fontWeight: 700, pb: 0.5 }}>新しいプレゼンテーションを作成</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        {/* Template grid — 3 columns × 3 rows */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25, mb: 2 }}>
          {TEMPLATES.map(t => {
            const active = t.id === selectedId;
            const accentColor = t.color || '#29b6f6';
            return (
              <Box
                key={t.id}
                onClick={() => handleSelect(t.id as TemplateId)}
                sx={{
                  borderRadius: 2,
                  border: `1.5px solid ${active ? accentColor : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
                  bgcolor: active ? `color-mix(in srgb, ${accentColor} 9%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.03)',
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.5, py: 1.25, cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative', overflow: 'hidden',
                  '&:hover': {
                    bgcolor: active ? `color-mix(in srgb, ${accentColor} 13%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.07)',
                    borderColor: active ? accentColor : 'rgb(var(--brand-fg-rgb) / 0.2)',
                  },
                }}
              >
                {/* Icon */}
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: active ? `color-mix(in srgb, ${accentColor} 19%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.06)',
                  color: active ? accentColor : (t.color || 'rgb(var(--brand-fg-rgb) / 0.45)'),
                }}>
                  {t.icon}
                </Box>
                {/* Text */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    color: active ? accentColor : 'rgb(var(--brand-fg-rgb) / 0.85)',
                    fontSize: 12, fontWeight: 700, lineHeight: 1.35,
                    whiteSpace: 'pre-line',
                  }}>
                    {t.title}
                  </Typography>
                  {t.badge && (
                    <Typography sx={{
                      color: active ? `color-mix(in srgb, ${accentColor} 80%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.3)',
                      fontSize: 10, fontWeight: 600, mt: 0.25,
                    }}>
                      {t.badge}のスライド構成
                    </Typography>
                  )}
                </Box>
                {/* Active check */}
                {active && (
                  <Box sx={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    bgcolor: accentColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#000', fontWeight: 900,
                  }}>✓</Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Selected template description */}
        <Box sx={{
          mb: 2, p: 1.5, borderRadius: 1.5,
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
          display: 'flex', alignItems: 'flex-start', gap: 1,
        }}>
          <Box sx={{ color: selectedTemplate.color || 'light-dark(#0775a6, #29b6f6)', mt: 0.25, flexShrink: 0 }}>
            {selectedTemplate.icon}
          </Box>
          <Box>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 12, fontWeight: 600, mb: 0.25 }}>
              {selectedTemplate.title.replace('\n', ' ')}
            </Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 12, lineHeight: 1.6 }}>
              {selectedTemplate.description}
            </Typography>
          </Box>
        </Box>

        {/* Name field */}
        <TextField
          autoFocus label="プレゼンテーション名" fullWidth variant="outlined" size="small"
          value={name} onChange={e => setName(e.target.value)} disabled={isCreating}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSubmit(selectedId, name); }}
          sx={{
            '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.35)' }, '&.Mui-focused fieldset': { borderColor: '#29b6f6' } },
            '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.45)' },
            '& .MuiInputLabel-root.Mui-focused': { color: 'light-dark(#0775a6, #29b6f6)' },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1 }}>
        <Button onClick={onClose} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={() => onSubmit(selectedId, name)} variant="contained" disabled={isCreating || !name.trim()}
          sx={{ bgcolor: '#29b6f6', color: 'rgba(0,0,0,0.85)', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#4fc3f7' }, px: 3 }}>
          {isCreating ? '作成中...' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onNew: () => void; canCreate?: boolean }> = ({ onNew, canCreate = true }) => (
  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, py: 10 }}>
    <SlideshowRoundedIcon sx={{ fontSize: 56, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
    <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontWeight: 500 }}>
      {canCreate ? 'このプロジェクトにはまだプレゼンテーションがありません' : 'プレゼンテーションが見つかりません'}
    </Typography>
    {canCreate && (
      <Button variant="outlined" startIcon={<AddCircleOutlineRoundedIcon />} onClick={onNew}
        sx={{ mt: 1, borderColor: 'rgba(41,182,246,0.5)', color: 'light-dark(#0775a6, #29b6f6)', textTransform: 'none', '&:hover': { bgcolor: 'rgba(41,182,246,0.08)', borderColor: '#29b6f6' } }}>
        新規スライド作成
      </Button>
    )}
  </Box>
);

// ─── Scope header label helpers ────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, { breadcrumb: string; title: string; scope: string }> = {
  global_presentations:    { breadcrumb: 'Global Presentation Hub', title: 'Explore', scope: 'Presentations フィード' },
  global_projects:         { breadcrumb: 'Global Presentation Hub', title: 'Explore', scope: '公開プロジェクト' },
  my_public_presentations: { breadcrumb: 'My Presentations',        title: 'Explore', scope: '公開中' },
  my_private_presentations:{ breadcrumb: 'My Presentations',        title: 'Explore', scope: '非公開' },
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export const DspDashboard: React.FC<{
  payload: any;
  items: any[];
  isInitializing: boolean;
}> = ({ payload, items, isInitializing }) => {
  const setPanelSelection = useAppStore(s => s.setPanelSelection);
  const selectedItem = useAppStore(s => payload?.workspaceId ? s.panelSelections[payload.workspaceId] : null);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const dspScope = useAppStore(s => s.dspScope);
  const dspGlobalFilter = useAppStore(s => s.dspGlobalFilter);
  const setDspGlobalFilter = useAppStore(s => s.setDspGlobalFilter);

  const currentUser = useAuthStore(s => s.currentUser);

  const isGlobal = ['global_presentations', 'my_public_presentations', 'my_private_presentations', 'global_projects'].includes(dspScope);
  const canCreate = !isGlobal && !!payload?.projectId;
  const scopeLabel = SCOPE_LABELS[dspScope];

  const [cardSize, setCardSize] = useState(210);
  const [searchQuery, setSearchQuery] = useState('');
  // 種別フィルタはストア共有（テンプレ⇄プレゼン切替でも保持）
  const typeFilter = useAppStore(s => s.dspTypeFilter);
  const setTypeFilter = useAppStore(s => s.setDspTypeFilter);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt_desc');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1], bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) { const d = Math.abs(p.value - cardSize); if (d < bestDiff) { best = p; bestDiff = d; } }
    return best.key;
  }, [cardSize]);

  const handleReset = useCallback(() => {
    setTypeFilter('all');
    setTagFilter(null);
    setSortKey('updatedAt_desc');
    setSearchQuery('');
  }, []);

  const handleSelectItem = useCallback((item: any) => {
    if (!payload?.workspaceId) return;
    if (selectedItem?.id === item.id) setPanelSelection(payload.workspaceId, null);
    else setPanelSelection(payload.workspaceId, item);
  }, [payload?.workspaceId, selectedItem?.id, setPanelSelection]);

  const handleOpenEditor = useCallback((item?: any) => {
    const wsId = payload?.workspaceId || 'presents';
    const target = item || selectedItem;
    if (!target) return;

    // グローバルスコープのアイテムは item.projectId を持つ。エディタに渡す前に activeProject をそのプロジェクトに切り替える
    const targetProjectId: string | null = target.projectId || payload?.projectId || null;
    if (isGlobal && targetProjectId) {
      useAppStore.getState().setActiveProjectId(targetProjectId);
    }

    setPanelSelection(wsId, target);
    useAppStore.getState().setActiveWorkspaceId(wsId);
    useAppStore.getState().setDspShellMode('editor');
  }, [payload?.workspaceId, payload?.projectId, selectedItem, isGlobal, setPanelSelection]);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el?.closest?.('[data-right-sidebar="true"]')) return;
    if (el?.closest?.('[data-no-dismiss="true"]')) return;
    if (el?.closest?.('[data-model-card="true"]')) return;
    if (payload?.workspaceId) setPanelSelection(payload.workspaceId, null);
  }, [payload?.workspaceId, setPanelSelection]);

  const handleDelete = useCallback(async (item: any) => {
    // グローバルスコープのアイテムは item.projectId を使用
    const targetProjectId = item?.projectId || payload?.projectId;
    if (!targetProjectId || !item?.id) return;
    const ok = window.confirm(`「${item.name || 'Untitled'}」を削除しますか？`);
    if (!ok) return;
    try {
      const ref = doc(db, `projects/${targetProjectId}/workFiles/${item.id}`);
      await updateDoc(ref, { status: 'archived', isArchived: true });
      if (payload?.workspaceId && selectedItem?.id === item.id) {
        setPanelSelection(payload.workspaceId, null);
      }
    } catch (e) {
      console.error('[DspDashboard] Delete failed:', e);
    }
  }, [payload?.projectId, payload?.workspaceId, selectedItem?.id, setPanelSelection]);

  const handleToggleVisibility = useCallback(async (item: any, newVisibility: 'public' | 'private') => {
    const targetProjectId = item?.projectId || payload?.projectId;
    if (!targetProjectId || !item?.id) return;
    try {
      const ref = doc(db, `projects/${targetProjectId}/workFiles/${item.id}`);
      await updateDoc(ref, { visibility: newVisibility });
      // panelSelection も即時更新して inspector の表示を同期させる
      if (payload?.workspaceId && selectedItem?.id === item.id) {
        setPanelSelection(payload.workspaceId, { ...item, visibility: newVisibility });
      }
    } catch (e) {
      console.error('[DspDashboard] Toggle visibility failed:', e);
      throw e; // inspector の isTogglingVisibility を finally で解除させるために再スロー
    }
  }, [payload?.projectId, payload?.workspaceId, selectedItem?.id, setPanelSelection]);

  const handleCreate = useCallback(async (templateId: string, name: string) => {
    const targetProjectId = payload?.projectId || activeProjectId;
    if (!targetProjectId) return;
    setIsCreating(true);
    try {
      const workFileType = templateId === 'infinite_board' ? 'canvas' : 'presentation';
      const initialContent = buildInitialContent(templateId as TemplateId);
      const wf = await dspRepository.createPresentationWorkFile(
        targetProjectId, name, currentUser?.uid || 'user', workFileType, initialContent
      );
      const wsId = payload?.workspaceId || 'presents';
      useAppStore.getState().setPanelSelection(wsId, wf);
      useAppStore.getState().setActiveWorkspaceId(wsId);
      useAppStore.getState().setDspShellMode('editor');
      setShowNewDialog(false);
    } catch (e) {
      console.error('Failed to create presentation:', e);
    } finally {
      setIsCreating(false);
    }
  }, [payload?.projectId, payload?.workspaceId, activeProjectId, currentUser]);

  const handleUpdateTags = useCallback(async (item: any, tags: string[]) => {
    const targetProjectId = item?.projectId || payload?.projectId;
    if (!targetProjectId || !item?.id) return;
    await dspRepository.updatePresentationMeta(targetProjectId, item.id, { tags });
    if (payload?.workspaceId && selectedItem?.id === item.id) {
      setPanelSelection(payload.workspaceId, { ...item, tags });
    }
  }, [payload?.projectId, payload?.workspaceId, selectedItem?.id, setPanelSelection]);

  const filteredItems = useMemo(() => {
    let result = [...items];
    // テキスト検索
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => {
        const text = [m.name, m.title, m.type, ...(m.tags || [])].filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
      });
    }
    // タイプフィルター
    if (typeFilter === 'presentation') result = result.filter(m => m.type !== 'canvas');
    if (typeFilter === 'canvas')       result = result.filter(m => m.type === 'canvas');
    // タグフィルター
    if (tagFilter) result = result.filter(m => (m.tags as string[] | undefined)?.includes(tagFilter));
    // 並び替え
    result.sort((a, b) => {
      switch (sortKey) {
        case 'updatedAt_desc': return (b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1;
        case 'updatedAt_asc':  return (a.updatedAt || '') > (b.updatedAt || '') ? 1 : -1;
        case 'createdAt_desc': return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
        case 'name_asc':  return (a.name || '').localeCompare(b.name || '', 'ja');
        case 'name_desc': return (b.name || '').localeCompare(a.name || '', 'ja');
        case 'slides_desc': return ((b.content?.pages?.length ?? 0) - (a.content?.pages?.length ?? 0));
        default: return 0;
      }
    });
    return result;
  }, [items, searchQuery, typeFilter, tagFilter, sortKey]);

  // 現在表示中アイテムから使用されているタグ一覧を集計
  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach(m => (m.tags as string[] | undefined)?.forEach(t => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [items]);

  return (
    <Box sx={styles.root}>
      {/* ── Sticky Header ───────────────────────────────────── */}
      <Box sx={styles.stickyHeaderWrap} data-no-dismiss="true">
        {/* ── Top Bar ─────────────────────────────────────────── */}
        <Box component="header" sx={styles.topBar}>
          {/* Left: breadcrumb + title */}
          <Box sx={styles.titleBlock}>
            <Box sx={styles.breadcrumb}>
              {scopeLabel ? scopeLabel.breadcrumb : `プレゼン / ${payload?.workspaceName || '概要'}`}
            </Box>
            <Box sx={styles.pageTitle}>
              {scopeLabel ? (
                <>
                  <Box component="span" sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 22 }}>{scopeLabel.title}&nbsp;</Box>
                  <Box component="span" sx={{ color: 'light-dark(#0775a6, #29b6f6)', fontWeight: 700, fontSize: 22 }}>{scopeLabel.scope}</Box>
                </>
              ) : (
                <Box component="span" sx={{ color: 'light-dark(#0775a6, #29b6f6)', fontWeight: 700, fontSize: 22 }}>S.Slide ワークスペース</Box>
              )}
            </Box>
          </Box>

          {/* Center: search */}
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', px: 2 }}>
            <Box sx={styles.searchWrap}>
              <SearchRoundedIcon sx={styles.searchIcon} />
              <input type="text" placeholder="プレゼンテーションを検索..."
                style={styles.searchInput as React.CSSProperties}
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onPointerDown={e => e.stopPropagation()} />
            </Box>
          </Box>

          {/* Right: density */}
          <Box sx={styles.viewBlock}>
            <Box sx={styles.miniLabel}>Density</Box>
            <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
              {DENSITY_PRESETS.map(p => (
                <Button key={p.key} onClick={() => setCardSize(p.value)}
                  sx={densityKey === p.key ? styles.densityBtnActive : styles.densityBtn}>
                  {p.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </Box>

        {/* ── Presentations フィード: フォロー中 / 全ユーザー タブ ── */}
        {dspScope === 'global_presentations' && (
          <Box sx={{ px: 3, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))' }}>
            <Tabs
              value={dspGlobalFilter}
              onChange={(_, v) => setDspGlobalFilter(v)}
              textColor="inherit"
              TabIndicatorProps={{ style: { backgroundColor: '#29b6f6', height: 2 } }}
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, fontSize: 13, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&.Mui-selected': { color: 'light-dark(#0775a6, #29b6f6)' } } }}
            >
              <Tab
                value="following"
                label="フォロー中"
                icon={<PeopleRoundedIcon sx={{ fontSize: 15 }} />}
                iconPosition="start"
              />
              <Tab
                value="all"
                label="全ユーザー"
                icon={<PublicRoundedIcon sx={{ fontSize: 15 }} />}
                iconPosition="start"
              />
            </Tabs>
          </Box>
        )}

        {/* ── Filter Row ──────────────────────────────────────── */}
        <Box component="section" sx={styles.filterRow}>
          {/* Type tabs — 3DSS style ButtonGroup（＋テンプレート切替） */}
          <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { py: 0.5, px: 2, textTransform: 'none', fontSize: 13, fontWeight: 600 } }}>
            {([
              { key: 'all' as TypeFilter, label: 'すべて' },
              { key: 'presentation' as TypeFilter, label: 'スライド' },
              { key: 'canvas' as TypeFilter, label: '無限ボード' },
            ]).map(opt => (
              <Button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                sx={typeFilter === opt.key ? {
                  color: 'light-dark(#0775a6, #29b6f6)',
                  bgcolor: 'rgba(41,182,246,0.12)',
                  borderColor: 'rgba(41,182,246,0.35)',
                  '&:hover': { bgcolor: 'rgba(41,182,246,0.18)' },
                } : {
                  color: 'rgb(var(--brand-fg-rgb) / 0.5)',
                  borderColor: 'rgb(var(--brand-fg-rgb) / 0.12)',
                  '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.85)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
                }}
              >
                {opt.label}
              </Button>
            ))}
            {/* テンプレート管理ビューへ切替 */}
            <Button
              onClick={() => { useAppStore.getState().setDspScope('my_templates'); useAppStore.getState().setGlobalDspHub(); }}
              sx={{
                color: 'rgb(var(--brand-fg-rgb) / 0.5)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.12)',
                '&:hover': { color: 'light-dark(#0775a6, #29b6f6)', bgcolor: 'rgba(41,182,246,0.08)' },
              }}
            >
              テンプレート
            </Button>
          </ButtonGroup>

          <Box sx={{ flex: 1 }} />

          {/* Action buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            {canCreate && (
              <Button variant="contained" size="small" startIcon={<AddCircleOutlineRoundedIcon />}
                disabled={isInitializing} onClick={() => setShowNewDialog(true)}
                sx={{ bgcolor: '#29b6f6', '&:hover': { bgcolor: '#4fc3f7' }, color: 'rgba(0,0,0,0.8)', textTransform: 'none', fontWeight: 600 }}>
                新規スライド作成
              </Button>
            )}
            <Button variant="contained" size="small" startIcon={<EditRoundedIcon />}
              disabled={!selectedItem || isInitializing}
              onClick={() => handleOpenEditor()}
              sx={{ bgcolor: 'rgba(41,182,246,0.15)', color: 'light-dark(#0775a6, #29b6f6)', '&:hover': { bgcolor: 'rgba(41,182,246,0.25)' }, boxShadow: 'none', textTransform: 'none' }}>
              エディタで開く
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Main Content ─────────────────────────────────────── */}
      <Box component="main" sx={styles.content} onPointerDownCapture={handleBgPointerDown}>
        <Box sx={styles.pageBodyInner}>
          {isInitializing ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>読み込み中...</Typography>
            </Box>
          ) : filteredItems.length === 0 ? (
            <EmptyState onNew={() => setShowNewDialog(true)} canCreate={canCreate} />
          ) : (
            <PresentationGrid
              items={filteredItems}
              cardSize={cardSize}
              selectedItemId={selectedItem?.id}
              onSelectItem={handleSelectItem}
              onOpenEditor={handleOpenEditor}
              onDelete={handleDelete}
            />
          )}
        </Box>
      </Box>

      {/* ── Dialogs ──────────────────────────────────────────── */}
      {canCreate && (
        <NewPresentationDialog
          open={showNewDialog}
          onClose={() => setShowNewDialog(false)}
          onSubmit={handleCreate}
          isCreating={isCreating}
        />
      )}

      {/* ── Right Panel (fills #dsp-right-sidebar-portal) ── */}
      <DspRightPanel
        selectedItem={selectedItem}
        onOpen={() => handleOpenEditor()}
        onDelete={handleDelete}
        onToggleVisibility={handleToggleVisibility}
        onUpdateTags={handleUpdateTags}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        sortKey={sortKey}
        setSortKey={setSortKey}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        allTags={allTags}
        onReset={handleReset}
      />
    </Box>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary', overflow: 'hidden' },
  stickyHeaderWrap: { flexShrink: 0, backgroundColor: 'light-dark(rgba(255,255,255,0.92), rgba(10,15,25,0.85))', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, zIndex: 10 },
  topBar: { height: 72, px: 3, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.04)' },
  titleBlock: { display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0, minWidth: 180 },
  breadcrumb: { fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.3 },
  pageTitle: { display: 'flex', alignItems: 'baseline', flexWrap: 'nowrap' },
  searchWrap: { flex: '0 1 560px', width: '100%', height: 36, borderRadius: 18, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', alignItems: 'center', px: 2, transition: 'all 0.2s', '&:focus-within': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', boxShadow: '0 0 0 2px rgba(41,182,246,0.2)' } },
  searchIcon: { fontSize: 18, color: 'text.secondary', mr: 1 },
  searchInput: { flex: 1, border: 'none', background: 'transparent', color: 'var(--brand-fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  viewBlock: { display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 },
  miniLabel: { fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 },
  densityGroup: { '& .MuiButton-root': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'text.secondary', fontSize: 12, px: 1.5 } },
  densityBtn: { '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } },
  densityBtnActive: { bgcolor: 'rgba(41,182,246,0.1)', color: 'light-dark(#0775a6, #29b6f6)', borderColor: 'rgba(41,182,246,0.3)' },
  filterRow: { height: 44, px: 3, display: 'flex', alignItems: 'center' },
  content: { flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' },
  pageBodyInner: { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0', height: '100%', width: '100%' },
};
