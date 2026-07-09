import React, { useCallback, useRef, useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { FixedSizeGrid as Grid } from 'react-window';
import { motion } from 'framer-motion';
import { DssProjectCard } from './DssProjectCard';

interface DssProjectsGridProps {
  items: any[];
  cardSize: number;
  selectedItemId?: string | null;
  onSelectProject: (project: any) => void;
  onDoubleClickProject?: (project: any) => void;
  onOwnerClick?: (project: any) => void;
  isInitializing?: boolean;
  badgeColor?: string;
}

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
  const { items, selectedItemId, onSelectProject, onDoubleClickProject, onOwnerClick, badgeColor, columnCount, paddingLeft } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= items.length) return null;
  const project = items[index];

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
        <DssProjectCard
          project={project}
          isSelected={selectedItemId === project.id}
          onClick={() => onSelectProject(project)}
          onDoubleClick={() => onDoubleClickProject && onDoubleClickProject(project)}
          onOwnerClick={onOwnerClick ? () => onOwnerClick(project) : undefined}
          badgeColor={badgeColor}
        />
      </Box>
    </motion.div>
  );
});
GridCell.displayName = 'GridCell';

export const DssProjectsGrid: React.FC<DssProjectsGridProps> = ({
  items,
  cardSize,
  selectedItemId,
  onSelectProject,
  onDoubleClickProject,
  onOwnerClick,
  isInitializing,
  badgeColor,
}) => {
  const [containerRef, { width, height }] = useElementSizeWithLastNonZero();

  const columnCount = useMemo(() => {
    return Math.max(1, Math.floor(width / cardSize));
  }, [width, cardSize]);

  const rowCount = useMemo(() => {
    return Math.ceil((items?.length || 0) / columnCount);
  }, [items?.length, columnCount]);

  const excessWidth = Math.max(0, width - (columnCount * cardSize));
  const paddingLeft = Math.floor(excessWidth / 2);

  const gridItemData = useMemo(() => {
    return {
      items,
      selectedItemId,
      onSelectProject,
      onDoubleClickProject,
      onOwnerClick,
      badgeColor,
      columnCount,
      paddingLeft
    };
  }, [items, selectedItemId, onSelectProject, onDoubleClickProject, onOwnerClick, badgeColor, columnCount, paddingLeft]);

  if (isInitializing) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">Loading projects...</Typography>
      </Box>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        <Typography variant="h6">No Projects Found</Typography>
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
