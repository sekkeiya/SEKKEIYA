import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DssModelCard } from './DssModelCard';
import type { LayoutAssetGroup, DedupedAsset } from './utils/dashboardViewUtils';

export interface DssGroupedModelsGridProps {
  groups: LayoutAssetGroup[];
  cardSize: number;
  selectedItemId?: string | null;
  onSelectModel: (model: any) => void;
  onModelDragStart?: (e: React.DragEvent<HTMLDivElement>, model: any) => void;
  badgeColor?: string;
  showDetails?: boolean;
  onSave?: (model: any) => void;
  onShare?: (model: any) => void;
  onDelete?: (model: any) => void;
  onAuthorClick?: (model: any) => void;
  onDoubleClick?: (model: any) => void;
  cardContext?: "models" | "boards" | "publicModels" | "privateModels" | "boardModels";
}

export const DssGroupedModelsGrid: React.FC<DssGroupedModelsGridProps> = ({
  groups,
  cardSize,
  selectedItemId,
  onSelectModel,
  onModelDragStart,
  badgeColor,
  showDetails,
  cardContext,
  onSave,
  onShare,
  onDelete,
  onAuthorClick,
  onDoubleClick,
}) => {
  return (
    <Box sx={{ width: '100%', height: '100%', overflowY: 'auto', p: 2 }}>
      {groups.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">No grouped assets found.</Typography>
        </Box>
      ) : (
        groups.map((group) => (
          <Box key={group.pathName} sx={{ mb: 4 }}>
            {/* Group Header */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                {group.pathName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>
                {group.items.length} {group.items.length === 1 ? 'asset' : 'assets'}
              </Typography>
              <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            </Box>

            {/* Grid Container */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <AnimatePresence>
                {group.items.map((deduped: DedupedAsset) => {
                  const { item: model, usageInfo } = deduped;
                  
                  return (
                    <motion.div
                      key={model.id}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      style={{
                        width: cardSize,
                        height: cardSize,
                      }}
                    >
                      <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                        <DssModelCard
                          model={model}
                          isSelected={selectedItemId === model.id}
                          onClick={() => onSelectModel(model)}
                          onDragStart={onModelDragStart}
                          badgeColor={badgeColor}
                          showDetails={showDetails}
                          cardContext={cardContext}
                          onSave={onSave ? () => onSave(model) : undefined}
                          onShare={onShare ? () => onShare(model) : undefined}
                          onDelete={onDelete ? () => onDelete(model) : undefined}
                          onAuthorClick={onAuthorClick ? () => onAuthorClick(model) : undefined}
                          onDoubleClick={onDoubleClick ? () => onDoubleClick(model) : undefined}
                          usageCount={usageInfo.totalCount}
                          layoutCount={usageInfo.locations.length}
                        />
                      </Box>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};
