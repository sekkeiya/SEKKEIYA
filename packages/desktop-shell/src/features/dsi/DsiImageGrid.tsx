import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { FixedSizeGrid as Grid } from 'react-window';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import { DsiImageCard, DSI_CARD_WIDTH, DSI_THUMB_HEIGHT, DSI_META_HEIGHT } from './DsiImageCard';
import { DsiLightbox } from './DsiLightbox';
import { useDsiStore } from './store/useDsiStore';
import { useImageSourcesStore } from './store/useImageSourcesStore';
import { useImagePickerStore } from '../../store/useImagePickerStore';
import type { TextureGroup } from './textureGrouping';

const ACCENT = '#ec407a';
/** 各セル内側の余白（カード周囲の隙間）。 */
const CELL_PAD = 8;
/** FixedSizeGrid のカラム幅（カード幅 + 左右余白）。 */
const COLUMN_WIDTH = DSI_CARD_WIDTH + CELL_PAD * 2;

interface DsiImageGridProps {
  images: any[];
  sets: any[];
  /** テクスチャをマテリアル単位に束ねたグループ（トップ階層でのみ使用）。 */
  textureGroups?: TextureGroup[];
  isInitializing?: boolean;
  isLocal?: boolean;
  localError?: string;
  onDeleteItem?: (item: any) => void;
  onSelectItem?: (item: any) => void;
  /** 複数選択の変更（範囲/トグル/単一）。選択ID配列で丸ごと置き換える。 */
  onMultiSelectChange?: (ids: string[]) => void;
  /** 複数選択中のID集合（リング表示に使用） */
  multiDeleteIds?: Set<string>;
}

type Entry =
  | { kind: 'set'; item: any; childCount: number }
  | { kind: 'image'; item: any }
  | { kind: 'texture-group'; group: TextureGroup; isGenerated?: boolean };

/** ResizeObserver でコンテナの実寸を取得（S.Model と同じ方式）。 */
function useElementSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const measure = () => {
        const rect = node.getBoundingClientRect();
        setSize((prev) => {
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

/** 横スクロールバーを出さない react-window の外側ラッパ（縦スクロールのみ）。 */
const WindowOuter = React.forwardRef<HTMLDivElement, any>(function WindowOuter(props, ref) {
  const { style, ...rest } = props;
  return (
    <div
      ref={ref}
      {...rest}
      style={{
        ...style,
        overflowX: 'hidden',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    />
  );
});

const Cell = React.memo(({ columnIndex, rowIndex, style, data }: any) => {
  const { entries, columnCount, paddingLeft, pickMode, selectedImageId, selectedIds, onCardClick, onCardDoubleClick, onCardDelete, existingMaterialIds, textureSetMode, textureSetSelection, onMultiSelect, multiDeleteIds } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= entries.length) return null;
  const entry: Entry = entries[index];
  const isImage = entry.kind === 'image';
  const isGroup = entry.kind === 'texture-group';
  const cardItem = isGroup ? entry.group.cover : entry.item;
  const activeId = isGroup ? entry.group.id : (isImage ? entry.item.id : undefined);
  // 手動セット化モード: グループ全メンバーが選択中なら selected。
  const setSelected = textureSetMode && isGroup
    && entry.kind === 'texture-group'
    && entry.group.items.length > 0
    && entry.group.items.every((it: any) => textureSetSelection.has(it.id));
  const isMultiSelected = !!(multiDeleteIds && activeId && multiDeleteIds.has(activeId));
  // 削除ボタンの対象: テクスチャグループはグループ全体（全マップ）を削除対象にする。
  const deletePayload = entry.kind === 'texture-group'
    ? { type: 'texture-group', _textureGroup: entry.group, id: entry.group.id, title: entry.group.title }
    : cardItem;

  return (
    <div
      style={{
        ...style,
        left: (typeof style.left === 'number' ? style.left : 0) + paddingLeft,
        padding: CELL_PAD,
        boxSizing: 'border-box',
      }}
      onClick={(e: React.MouseEvent) => {
        // 複数選択（Shift=範囲 / Ctrl(⌘)=トグル）。onMultiSelect は通常モード時のみ渡される。
        if (activeId && onMultiSelect && (e.shiftKey || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onMultiSelect(index, activeId, e.shiftKey ? 'range' : 'toggle');
          return;
        }
        // 通常クリック: 単一選択（アンカー更新・複数選択はクリア）。
        if (activeId && onMultiSelect) onMultiSelect(index, activeId, 'single');
        onCardClick(entry);
      }}
    >
      {/* Shift+クリック複数選択リング */}
      {isMultiSelected && (
        <div style={{
          position: 'absolute',
          top: CELL_PAD, left: CELL_PAD, right: CELL_PAD, bottom: CELL_PAD,
          border: '2px solid #42a5f5',
          borderRadius: 8,
          zIndex: 10,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          boxShadow: '0 0 0 2px rgba(66,165,245,0.35)',
        }} />
      )}
      <DsiImageCard
        item={cardItem}
        variant={isGroup ? 'texture-group' : entry.kind}
        childCount={entry.kind === 'set' ? entry.childCount : undefined}
        textureGroup={isGroup ? entry.group : undefined}
        active={!pickMode && activeId != null && selectedImageId === activeId}
        pickMode={pickMode && (isImage || isGroup)}
        picked={pickMode && (isImage
          ? selectedIds.has(entry.item.id)
          : isGroup && entry.kind === 'texture-group' && entry.group.items.some((it: any) => selectedIds.has(it.id)))}
        isGenerated={isGroup && entry.kind === 'texture-group' ? entry.isGenerated : undefined}
        selectMode={textureSetMode && isGroup}
        selected={setSelected}
        onClick={() => onCardClick(entry)}
        onDoubleClick={isImage ? () => onCardDoubleClick(entry) : undefined}
        onDelete={onCardDelete && (isImage || isGroup) ? () => onCardDelete(deletePayload) : undefined}
      />
    </div>
  );
});
Cell.displayName = 'DsiGridCell';

export const DsiImageGrid: React.FC<DsiImageGridProps> = ({ images, sets, textureGroups = [], isInitializing, isLocal, localError, onDeleteItem, onSelectItem, onMultiSelectChange, multiDeleteIds }) => {
  const categoryFilter = useDsiStore((s) => s.categoryFilter);
  const tagFilter = useDsiStore((s) => s.tagFilter);
  const applicationFilter = useDsiStore((s) => s.applicationFilter);
  const generatedFilter = useDsiStore((s) => s.generatedFilter);
  const existingMaterialIds = useImagePickerStore((s) => s.existingMaterialIds);
  const openSetId = useDsiStore((s) => s.openSetId);
  const setOpenSetId = useDsiStore((s) => s.setOpenSetId);
  const selectedImageId = useDsiStore((s) => s.selectedImageId);
  const setSelectedImageId = useDsiStore((s) => s.setSelectedImageId);
  const pickMode = useDsiStore((s) => s.pickMode);
  const selectedIds = useDsiStore((s) => s.selectedIds);
  const togglePick = useDsiStore((s) => s.togglePick);
  const textureSetMode = useDsiStore((s) => s.textureSetMode);
  const textureSetSelection = useDsiStore((s) => s.textureSetSelection);
  const toggleTextureSetMembers = useDsiStore((s) => s.toggleTextureSetMembers);

  const [containerRef, { width, height }] = useElementSize();
  // ライトボックス（拡大ギャラリー）で表示中の画像/動画ID。
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const matchesCategory = useCallback(
    (item: any) => categoryFilter === 'all' || item.category === categoryFilter,
    [categoryFilter],
  );

  const matchesTag = useCallback(
    (item: any) => !tagFilter || (Array.isArray(item.tags) && item.tags.includes(tagFilter)),
    [tagFilter],
  );

  // ローカル参照ソース（複数フォルダ）＋サブフォルダの絞り込み。null = 全ソース／ソース全体。
  const sourceFilter = useImageSourcesStore((s) => s.sourceFilter);
  const subfolderFilter = useImageSourcesStore((s) => s.subfolderFilter);
  const matchesSource = useCallback(
    (item: any) => {
      if (sourceFilter && item.sourceId !== sourceFilter) return false;
      if (subfolderFilter) {
        const sub = String(item.subfolder || '');
        if (sub !== subfolderFilter && !sub.startsWith(subfolderFilter + '/')) return false;
      }
      return true;
    },
    [sourceFilter, subfolderFilter],
  );

  // セットごとの子枚数を一度に集計。
  const childCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of images) {
      if (d.parentSetId) map[d.parentSetId] = (map[d.parentSetId] || 0) + 1;
    }
    return map;
  }, [images]);

  // セット → テクスチャグループ → 画像 の順で 1 本のフラット配列にする（react-window の index 用）。
  const entries = useMemo<Entry[]>(() => {
    if (openSetId) {
      return images
        .filter((d) => d.parentSetId === openSetId && d.mediaType !== 'video' && matchesCategory(d) && matchesTag(d) && matchesSource(d))
        .map((item) => ({ kind: 'image', item }));
    }
    const setEntries: Entry[] = sets
      .filter((s) => matchesCategory(s) && matchesTag(s))
      .map((item) => ({ kind: 'set', item, childCount: childCountMap[item.id] || 0 }));
    // テクスチャは束ねたグループとして 1 枚の重ねカードに（個別の生テクスチャは一覧から除外）。
    const groupEntries: Entry[] = textureGroups
      .filter((g) => matchesCategory(g)
        && (!tagFilter || g.tags.includes(tagFilter))
        && ((!sourceFilter && !subfolderFilter) || g.items.some((it: any) => matchesSource(it)))
        && (!applicationFilter || g.applications.includes(applicationFilter as any)))
      .map((group) => {
        let isGenerated = false;
        if (existingMaterialIds.size > 0) {
          const base = group.title.replace(/\.[a-z0-9]+$/i, '').trim();
          const fixedId = `dsmt_imggen_${base.replace(/[/\.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 120)}`;
          isGenerated = existingMaterialIds.has(fixedId);
        }
        return { kind: 'texture-group' as const, group, isGenerated };
      })
      .filter((e) => {
        if (generatedFilter === 'generated') return e.isGenerated;
        if (generatedFilter === 'ungenerated') return !e.isGenerated;
        return true;
      });
    // 用途・部位フィルタはテクスチャ専用。設定中は通常画像/セットを隠す。
    const imageEntries: Entry[] = applicationFilter ? [] : images
      .filter((d) => !d.parentSetId && d.mediaType !== 'video' && d.category !== 'テクスチャ' && matchesCategory(d) && matchesTag(d) && matchesSource(d))
      .map((item) => ({ kind: 'image', item }));
    const visibleSetEntries = applicationFilter ? [] : setEntries;
    return [...visibleSetEntries, ...groupEntries, ...imageEntries];
  }, [images, sets, textureGroups, openSetId, matchesCategory, matchesTag, matchesSource, sourceFilter, subfolderFilter, tagFilter, applicationFilter, generatedFilter, existingMaterialIds, childCountMap]);

  const handleCardClick = useCallback(
    (entry: Entry) => {
      // テクスチャ手動セット化モード: グループのメンバーをまとめてトグル。
      if (textureSetMode) {
        if (entry.kind === 'texture-group') {
          toggleTextureSetMembers(entry.group.items.map((it: any) => it.id));
        }
        return;
      }
      if (entry.kind === 'set') {
        setOpenSetId(entry.item.id);
        return;
      }
      if (entry.kind === 'texture-group') {
        if (pickMode) {
          const items = entry.group.items as any[];
          // 全選択済みならまとめて解除、それ以外は未選択分をまとめて選択。
          const allSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id));
          items.forEach((it) => {
            if (allSelected || !selectedIds.has(it.id)) togglePick(it.id);
          });
          return;
        }
        setSelectedImageId(entry.group.id);
        return;
      }
      if (pickMode) {
        togglePick(entry.item.id);
        return;
      }
      setSelectedImageId(entry.item.id);
      onSelectItem?.(entry.item);
    },
    [pickMode, selectedIds, setOpenSetId, togglePick, setSelectedImageId, onSelectItem, textureSetMode, toggleTextureSetMembers],
  );

  // 一覧に表示中の画像/動画だけをライトボックスのナビゲーション対象にする（表示順）。
  const lightboxImages = useMemo(
    () => entries.filter((e): e is Extract<Entry, { kind: 'image' }> => e.kind === 'image').map((e) => e.item),
    [entries],
  );

  // ダブルクリックでライトボックスを開く（選択モード中は無効）。
  const handleCardDoubleClick = useCallback(
    (entry: Entry) => {
      if (pickMode || textureSetMode || entry.kind !== 'image') return;
      setLightboxId(entry.item.id);
    },
    [pickMode, textureSetMode],
  );

  // ── 複数選択（Shift=範囲 / Ctrl(⌘)=トグル / 通常=単一）。削除フローと選択集合を共有。 ──
  const anchorIdRef = useRef<string | null>(null);
  // entries 順の「選択できるID」（セットは選択対象外なので null）。範囲選択に使う。
  const orderedSelectableIds = useMemo(
    () => entries.map((e) => (e.kind === 'image' ? e.item.id : e.kind === 'texture-group' ? e.group.id : null)),
    [entries],
  );
  const handleMultiSelect = useCallback(
    (index: number, activeId: string, mode: 'single' | 'toggle' | 'range') => {
      if (mode === 'single') {
        anchorIdRef.current = activeId;
        if (multiDeleteIds && multiDeleteIds.size > 0) onMultiSelectChange?.([]);
        return;
      }
      if (mode === 'toggle') {
        const next = new Set(multiDeleteIds || []);
        if (next.has(activeId)) next.delete(activeId); else next.add(activeId);
        anchorIdRef.current = activeId;
        onMultiSelectChange?.(Array.from(next));
        return;
      }
      // range: アンカー（無ければ現在の単一選択）からクリック位置までを連続選択。
      const anchorId = anchorIdRef.current || selectedImageId;
      const anchorIdx = anchorId ? orderedSelectableIds.indexOf(anchorId) : -1;
      const from = anchorIdx >= 0 ? anchorIdx : index;
      const lo = Math.min(from, index);
      const hi = Math.max(from, index);
      const ids: string[] = [];
      for (let i = lo; i <= hi; i++) { const id = orderedSelectableIds[i]; if (id) ids.push(id); }
      onMultiSelectChange?.(ids);
    },
    [multiDeleteIds, selectedImageId, orderedSelectableIds, onMultiSelectChange],
  );

  const columnCount = Math.max(1, Math.floor(width / COLUMN_WIDTH));
  const rowCount = Math.ceil(entries.length / columnCount);
  const rowHeight = DSI_THUMB_HEIGHT + (pickMode ? 0 : DSI_META_HEIGHT) + CELL_PAD * 2;
  // 余ったスペースを左右に振ってグリッドを中央寄せ（S.Model と同じ）。
  const paddingLeft = Math.floor(Math.max(0, width - columnCount * COLUMN_WIDTH) / 2);

  const itemData = useMemo(
    () => ({
      entries,
      columnCount,
      paddingLeft,
      pickMode,
      selectedImageId,
      selectedIds,
      existingMaterialIds,
      textureSetMode,
      textureSetSelection,
      onCardClick: handleCardClick,
      onCardDoubleClick: handleCardDoubleClick,
      onCardDelete: pickMode ? undefined : onDeleteItem,
      onMultiSelect: (!pickMode && !textureSetMode && onMultiSelectChange) ? handleMultiSelect : undefined,
      multiDeleteIds,
    }),
    [entries, columnCount, paddingLeft, pickMode, selectedImageId, selectedIds, existingMaterialIds, textureSetMode, textureSetSelection, handleCardClick, handleCardDoubleClick, onDeleteItem, onMultiSelectChange, handleMultiSelect, multiDeleteIds],
  );

  if (isInitializing) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0, color: 'rgb(var(--brand-fg-rgb) / 0.4)', gap: 1.5, p: 3 }}>
        <PhotoLibraryRoundedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
        <Typography sx={{ fontSize: 14 }}>
          {isLocal ? 'ローカル素材が見つかりません' : openSetId ? 'このセットには画像がありません' : '画像がまだありません'}
        </Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
          {isLocal
            ? '%USERPROFILE%\\SEKKEIYA\\LocalAssets\\Images に画像を置いてください（動画は S.Movie へ）'
            : '右上の「アップロード」から追加、または S.Layout / AI Render の成果物が自動でここに集まります'}
        </Typography>
        {isLocal && localError && (
          <Typography sx={{ fontSize: 11, color: 'light-dark(#9e103f, #f48fb1)', opacity: 0.9, textAlign: 'center', maxWidth: 480, wordBreak: 'break-all' }}>
            エラー: {localError}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ flex: 1, width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      {width > 0 && height > 0 ? (
        <Grid
          columnCount={columnCount}
          columnWidth={COLUMN_WIDTH}
          rowCount={rowCount}
          rowHeight={rowHeight}
          width={width}
          height={height}
          outerElementType={WindowOuter}
          itemData={itemData}
        >
          {Cell}
        </Grid>
      ) : null}

      <DsiLightbox
        images={lightboxImages}
        currentId={lightboxId}
        onClose={() => setLightboxId(null)}
        onChange={setLightboxId}
      />
    </Box>
  );
};
