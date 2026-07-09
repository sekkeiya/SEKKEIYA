import React, { useCallback, useRef, useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { FixedSizeGrid as Grid } from 'react-window';
import { motion } from 'framer-motion';
import { DssModelCard } from './DssModelCard';

interface UsageInfo {
  totalCount: number;
  locations: { optionId: string; pathName: string; count: number }[];
}

interface DssModelsGridProps {
  items: any[];
  cardSize: number;
  selectedItemId?: string | null;
  /** 複数選択中の id 群。設定時はこれでハイライト判定する。 */
  multiSelectedIds?: string[];
  onSelectModel: (model: any, e?: React.MouseEvent) => void;
  onModelDragStart?: (e: React.DragEvent<HTMLDivElement>, model: any) => void;
  isInitializing?: boolean;
  badgeColor?: string;
  showDetails?: boolean;
  onSave?: (model: any) => void;
  onShare?: (model: any) => void;
  onDelete?: (model: any) => void;
  onAuthorClick?: (model: any) => void;
  onDoubleClick?: (model: any) => void;
  cardContext?: "models" | "boards" | "publicModels" | "privateModels" | "boardModels";
  usageMap?: Record<string, UsageInfo | number>;
  /** ピッカーモード: 設定時はカードにチェックオーバーレイを表示する。 */
  pickerSelectedIds?: string[];
  onPickerToggle?: (id: string) => void;
}

/** ResizeObserver hook for reliable container size */
function useElementSizeWithLastNonZero() {
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
      observerRef.current = new ResizeObserver(() => {
        measure();
      });
      observerRef.current.observe(node);
    }
  }, []);

  return [ref, size] as const;
}

/** react-window outer wrapper to prevent horizontal scrollbars */
const WindowOuter = React.forwardRef<HTMLDivElement, any>(function WindowOuter(props, ref) {
  const { style, ...rest } = props;
  return (
    <div
      ref={ref}
      {...rest}
      style={{
        ...style,
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        width: "calc(100% + 1px)",
        touchAction: "pan-y",
      }}
      className="rw-outer-vertical-only"
    />
  );
});

const GridCell = React.memo(({ columnIndex, rowIndex, style, data }: any) => {
  const { items, selectedItemId, multiSelectedIds, onSelectModel, onModelDragStart, badgeColor, columnCount, paddingLeft, showDetails, cardContext, onSave, onShare, onDelete, onAuthorClick, onDoubleClick, usageMap, pickerSelectedIds, onPickerToggle } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= items.length) return null;
  const model = items[index];

  // Support both plain number and rich object from useProjectAssetUsage
  const rawUsage = usageMap?.[model.id];
  const usageCount = typeof rawUsage === 'object' ? rawUsage.totalCount : (typeof rawUsage === 'number' ? rawUsage : 0);
  const layoutCount = typeof rawUsage === 'object' ? rawUsage.locations.length : (typeof rawUsage === 'number' && rawUsage > 0 ? 1 : 0);

  const inPickerMode = !!pickerSelectedIds;
  const pickerSelected = inPickerMode && pickerSelectedIds.includes(model.id);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        ...style,
        left: typeof style.left === 'number' ? style.left + paddingLeft : `calc(${style.left} + ${paddingLeft}px)`,
        display: 'flex',
        padding: 8
      }}
    >
      <Box sx={{ flex: 1, height: '100%', position: 'relative' }}>
        <DssModelCard
          model={model}
          isSelected={inPickerMode ? pickerSelected : (multiSelectedIds ? multiSelectedIds.includes(model.id) : selectedItemId === model.id)}
          onClick={(e) => inPickerMode ? onPickerToggle?.(model.id) : onSelectModel(model, e)}
          onDragStart={inPickerMode ? undefined : onModelDragStart}
          badgeColor={badgeColor}
          showDetails={showDetails}
          cardContext={cardContext}
          onSave={inPickerMode ? undefined : (onSave ? () => onSave(model) : undefined)}
          onShare={inPickerMode ? undefined : (onShare ? () => onShare(model) : undefined)}
          onDelete={inPickerMode ? undefined : (onDelete ? () => onDelete(model) : undefined)}
          onAuthorClick={inPickerMode ? undefined : (onAuthorClick ? () => onAuthorClick(model) : undefined)}
          onDoubleClick={inPickerMode ? undefined : (onDoubleClick ? () => onDoubleClick(model) : undefined)}
          usageCount={usageCount}
          layoutCount={layoutCount}
        />
        {/* ピッカーモードのチェックオーバーレイ */}
        {inPickerMode && (
          <Box
            onClick={() => onPickerToggle?.(model.id)}
            sx={{
              position: 'absolute', top: 10, left: 10,
              width: 22, height: 22, borderRadius: '6px',
              border: `2px solid ${pickerSelected ? '#ffd740' : 'rgb(var(--brand-fg-rgb) / 0.6)'}`,
              bgcolor: pickerSelected ? '#ffd740' : 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10,
              transition: 'all 0.15s',
            }}
          >
            {pickerSelected && (
              <Box component="span" sx={{ fontSize: '0.75rem', color: '#1a1f2b', fontWeight: 900, lineHeight: 1 }}>✓</Box>
            )}
          </Box>
        )}
      </Box>
    </motion.div>
  );
});
GridCell.displayName = 'GridCell';

export const DssModelsGrid: React.FC<DssModelsGridProps> = ({
  items,
  cardSize,
  selectedItemId,
  multiSelectedIds,
  onSelectModel,
  onModelDragStart,
  isInitializing,
  badgeColor,
  showDetails,
  cardContext,
  onSave,
  onShare,
  onDelete,
  onAuthorClick,
  onDoubleClick,
  usageMap,
  pickerSelectedIds,
  onPickerToggle,
}) => {
  const [containerRef, { width, height }] = useElementSizeWithLastNonZero();

  const columnCount = useMemo(() => {
    return Math.max(1, Math.floor(width / cardSize));
  }, [width, cardSize]);

  const rowCount = useMemo(() => {
    return Math.ceil((items?.length || 0) / columnCount);
  }, [items?.length, columnCount]);

  // To center the grid items when there is excess space:
  const excessWidth = Math.max(0, width - (columnCount * cardSize));
  const paddingLeft = Math.floor(excessWidth / 2);

  const gridItemData = useMemo(() => {
    return {
      items,
      selectedItemId,
      multiSelectedIds,
      onSelectModel,
      onModelDragStart,
      badgeColor,
      columnCount,
      paddingLeft,
      showDetails,
      cardContext,
      onSave,
      onShare,
      onDelete,
      onAuthorClick,
      onDoubleClick,
      usageMap,
      pickerSelectedIds,
      onPickerToggle,
    };
  }, [
    items, selectedItemId, multiSelectedIds, onSelectModel, onModelDragStart, badgeColor,
    columnCount, paddingLeft, showDetails, cardContext, onSave, onShare,
    onDelete, onAuthorClick, onDoubleClick, usageMap, pickerSelectedIds, onPickerToggle,
  ]);

  if (isInitializing) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">Loading models...</Typography>
      </Box>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        <Typography variant="h6">No Models Found</Typography>
        <Typography variant="body2">Try adjusting your filters or search query.</Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ flex: 1, width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      {width > 0 && height > 0 ? (
        <Grid
          columnCount={columnCount}
          columnWidth={cardSize}
          rowCount={rowCount}
          rowHeight={cardSize}
          width={width}
          height={height}
          outerElementType={WindowOuter}
          itemData={gridItemData}
        >
          {GridCell}
        </Grid>
      ) : null}
    </Box>
  );
};
