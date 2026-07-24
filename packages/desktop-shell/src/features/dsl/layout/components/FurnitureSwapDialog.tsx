import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { projectAssetsApi } from '../../../projects/api/projectAssetsApi';
import LibraryAssetCard from '../editor/sidebars/LeftSidebar/components/Library/LibraryAssetCard';
import { db } from '../../../../lib/firebase/client';
import { collection, query, where, getDocs, limit, or, and } from 'firebase/firestore';
import { useAuthStore } from '../../../../store/useAuthStore';
import {
  FormControlLabel,
  Radio,
  RadioGroup,
  Badge
} from '@mui/material';
import {
  matchCategoryKey, getCategoryMeta, LAYOUT_CATEGORY_MAP,
} from '../constants/furnitureCategoryDefaults';
import { resolveProduct } from '../services/productResolution';

interface FurnitureSwapDialogProps {
  open: boolean;
  onClose: () => void;
  placedItems: any[];
  projectId: string | null;
  onApplySwap: (newItems: any[]) => void;
}

/**
 * アセットから layoutCategory（粗粒度）を解決する。
 * 細粒度キー → layoutCategory の順で試み、最終的に 'other' にフォールバックする。
 */
function getAssetCategory(asset: any): string {
  if (!asset) return 'other';

  // 1. 既に layoutCategory が記録されている場合
  const stored =
    asset.layoutCategory ||
    asset.extendedMetadata?.layoutCategory ||
    asset.metadata?.layoutCategory;
  if (stored && LAYOUT_CATEGORY_MAP.has(stored)) return stored;

  // 2. 生カテゴリ文字列 + タイトルから matchCategoryKey で細粒度キーを解決し、そこから layoutCategory を取得
  const rawCat = (
    asset.extendedMetadata?.mainCategory ||
    asset.extendedMetadata?.category ||
    asset.metadata?.category ||
    asset.category ||
    ''
  ).toLowerCase();
  const rawTitle = (asset.title || asset.metadata?.title || asset.name || '').toLowerCase();

  const fineKey = matchCategoryKey(rawCat, rawTitle);
  if (fineKey) {
    const meta = getCategoryMeta(fineKey);
    if (meta) return meta.layoutCategory;
  }

  return 'other';
}

function getEntityId(asset: any): string {
  if (!asset) return '';
  return asset.metadata?.sourceModelId || asset.entityId || asset.id;
}

export const FurnitureSwapDialog: React.FC<FurnitureSwapDialogProps> = ({
  open,
  onClose,
  placedItems,
  projectId,
  onApplySwap
}) => {
  const { user } = useAuthStore();
  const uid = user?.uid;

  const [targetEntityId, setTargetEntityId] = useState<string | null>(null);
  const [replacementEntityId, setReplacementEntityId] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Scope states
  const [scope, setScope] = useState<'project' | 'following' | 'public'>('project');
  const [activeScope, setActiveScope] = useState<'project' | 'following' | 'public' | null>('project');
  const [alternativesCache, setAlternativesCache] = useState<Record<string, any[]>>({});
  const [isFetchingCounts, setIsFetchingCounts] = useState(false);

  // Reset state and fetch assets on open
  React.useEffect(() => {
    if (open) {
      setTargetEntityId(null);
      setReplacementEntityId(null);
      setScope('project');
      setActiveScope('project');
      setAlternativesCache({});
      if (projectId) {
        setLoading(true);
        projectAssetsApi.getAssets(projectId)
          .then(assets => setAvailableAssets(assets))
          .catch(err => console.error('Failed to load assets for swap', err))
          .finally(() => setLoading(false));
      } else {
        setAvailableAssets([]);
      }
    }
  }, [open, projectId]);

  // Extract unique placed models
  const uniquePlaced = useMemo(() => {
    const map = new Map<string, { count: number; snapshot: any; entityId: string }>();
    placedItems.forEach(item => {
      const eid = item.modelId || item.assetId || item.entityId;
      if (!eid) return;
      if (!map.has(eid)) {
        map.set(eid, { count: 0, snapshot: item.snapshot || item, entityId: eid });
      }
      map.get(eid)!.count++;
    });
    return Array.from(map.values());
  }, [placedItems]);

  // Auto-select step 1 if only 1 placed item exists
  React.useEffect(() => {
    if (open && uniquePlaced.length === 1 && !targetEntityId) {
      setTargetEntityId(uniquePlaced[0].entityId);
    }
  }, [open, uniquePlaced, targetEntityId]);

  // Handle target entity change and background fetch
  React.useEffect(() => {
    if (!targetEntityId || availableAssets.length === 0) {
      return;
    }
    
    const targetAsset = availableAssets.find(a => getEntityId(a) === targetEntityId);
    const category = getAssetCategory(targetAsset);
    
    const projectAlts = availableAssets.filter(a => {
      const eid = getEntityId(a);
      if (eid === targetEntityId) return false;
      return getAssetCategory(a) === category;
    });

    setAlternativesCache(prev => ({ ...prev, project: projectAlts }));

    const fetchBackground = async () => {
      setIsFetchingCounts(true);
      try {
        const assetsCol = collection(db, "assets");
        const existingIds = new Set(projectAlts.map(a => getEntityId(a)));
        existingIds.add(targetEntityId);
        
        let followingAlts: any[] = [];
        if (uid) {
          const followingRef = collection(db, `users/${uid}/following`);
          const followingSnap = await getDocs(query(followingRef, limit(30)));
          const followIds = followingSnap.docs.map(d => d.id);
          
          if (followIds.length > 0) {
            const followingQuery = query(assetsCol, 
              and(
                where('type', '==', '3d-model'), 
                or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
                where('ownerId', 'in', followIds)
              ),
              limit(100)
            );
            const fSnap = await getDocs(followingQuery);
            followingAlts = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              .filter(a => getAssetCategory(a) === category && !existingIds.has(getEntityId(a)));
            
            followingAlts.forEach(a => existingIds.add(getEntityId(a)));
          }
        }

        let publicAlts: any[] = [];
        const publicQuery = query(assetsCol, 
          and(
            where('type', '==', '3d-model'), 
            or(where('visibility', '==', 'public'), where('isPublic', '==', true))
          ),
          limit(100)
        );
        const pSnap = await getDocs(publicQuery);
        publicAlts = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(a => getAssetCategory(a) === category && !existingIds.has(getEntityId(a)));

        setAlternativesCache(prev => ({
          ...prev,
          following: followingAlts,
          public: publicAlts
        }));

      } catch (e) {
        console.error("Background fetch failed", e);
      } finally {
        setIsFetchingCounts(false);
      }
    };

    fetchBackground();
    setActiveScope('project');
    setScope('project');
  }, [targetEntityId, availableAssets, uid]);

  const handleSelectTarget = (id: string) => {
    if (targetEntityId === id) return;
    setTargetEntityId(id);
    setReplacementEntityId(null);
    setAlternativesCache({});
    setActiveScope(null);
  };

  const handleApply = () => {
    if (!targetEntityId || !replacementEntityId) {
      onClose();
      return;
    }

    const swapMap = { [targetEntityId]: replacementEntityId };

    const newItems = placedItems.map(item => {
      const eid = item.modelId || item.assetId || item.entityId;
      const swapToId = swapMap[eid];
      if (!swapToId || swapToId === eid) return item;

      // Search in all cached alternatives since we might have selected an explore model
      const allAlts = [
        ...(alternativesCache.project || []),
        ...(alternativesCache.following || []),
        ...(alternativesCache.public || [])
      ];
      
      const newAsset = allAlts.find(a => getEntityId(a) === swapToId) || availableAssets.find(a => getEntityId(a) === swapToId);
      if (!newAsset) return item;

      const { title, brand, thumbnailUrl, glbUrl, itemRef } = resolveProduct(newAsset);

      return {
        ...item,
        modelId: swapToId,
        assetId: swapToId,
        entityId: swapToId,
        title,
        name: title,
        label: title,
        brand,
        thumbUrl: thumbnailUrl,
        glbUrl,
        itemRef,
        snapshot: {
          title,
          brand,
          thumbnailUrl,
          glbUrl
        }
      };
    });

    onApplySwap(newItems);
  };

  const canApply = !!targetEntityId && !!replacementEntityId && targetEntityId !== replacementEntityId;

  const getActiveAlternatives = () => {
    if (!activeScope) return [];
    let res = [...(alternativesCache.project || [])];
    if (activeScope === 'following' || activeScope === 'public') {
      res = res.concat(alternativesCache.following || []);
    }
    if (activeScope === 'public') {
      res = res.concat(alternativesCache.public || []);
    }
    return res;
  };
  
  const activeAlternatives = getActiveAlternatives();
  const isLoadingActiveScope = activeScope && activeScope !== 'project' && isFetchingCounts && (!alternativesCache[activeScope]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
        家具を変える
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box p={4} textAlign="center" color="rgb(var(--brand-fg-rgb) / 0.5)">
            <CircularProgress size={24} sx={{ color: 'light-dark(#2f07a6, #a78bfa)', mb: 2 }} />
            <Typography variant="body2">代替家具を読み込み中...</Typography>
          </Box>
        ) : uniquePlaced.length === 0 ? (
          <Box p={4} textAlign="center" color="rgb(var(--brand-fg-rgb) / 0.5)">
            配置された家具がありません
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Step 1: Select target furniture */}
            <Box sx={{ p: 3, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--brand-fg)', mb: 2 }}>
                ステップ1：どの家具を変えますか？
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, pt: 1, px: 1 }}>
                {uniquePlaced.map(placed => {
                  const originalAsset = availableAssets.find(a => getEntityId(a) === placed.entityId);
                  const currentThumb = originalAsset?.thumbnailUrl || originalAsset?.metadata?.thumbnailUrl || originalAsset?.thumbUrl || originalAsset?.coverUrl || placed.snapshot?.thumbnailUrl || placed.snapshot?.metadata?.thumbnail || placed.snapshot?.thumbUrl || placed.snapshot?.coverUrl;
                  const isSelected = targetEntityId === placed.entityId;

                  return (
                    <Box key={placed.entityId} sx={{ position: 'relative' }}>
                      <LibraryAssetCard
                        model={null}
                        modelId={placed.entityId}
                        displayName={`${placed.snapshot?.title || 'Unknown'} (×${placed.count})`}
                        thumbUrl={currentThumb}
                        isSelected={isSelected}
                        inPlan={false}
                        isFluid={false}
                        fixedSize={140}
                        onClick={() => handleSelectTarget(placed.entityId)}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Step 2: Select replacement furniture */}
            {targetEntityId && (
              <Box sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--brand-fg)', mb: 2 }}>
                  ステップ2：変更先を選択
                </Typography>
                
                <Box sx={{ mb: 3, p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant={scope === 'project' ? 'contained' : 'outlined'}
                      onClick={() => {
                        setScope('project');
                        setReplacementEntityId(null);
                        setActiveScope(null);
                      }}
                      sx={{
                        borderRadius: 20,
                        textTransform: 'none',
                        bgcolor: scope === 'project' ? '#a78bfa' : 'transparent',
                        color: scope === 'project' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                        borderColor: scope === 'project' ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.2)',
                        '&:hover': {
                          bgcolor: scope === 'project' ? '#8b5cf6' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                          borderColor: scope === 'project' ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                        }
                      }}
                    >
                      プロジェクトのみ {alternativesCache.project?.length || 0}件
                    </Button>

                    <Button
                      variant={scope === 'following' ? 'contained' : 'outlined'}
                      onClick={() => {
                        setScope('following');
                        setReplacementEntityId(null);
                        setActiveScope(null);
                      }}
                      sx={{
                        borderRadius: 20,
                        textTransform: 'none',
                        bgcolor: scope === 'following' ? '#a78bfa' : 'transparent',
                        color: scope === 'following' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                        borderColor: scope === 'following' ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.2)',
                        '&:hover': {
                          bgcolor: scope === 'following' ? '#8b5cf6' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                          borderColor: scope === 'following' ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                        }
                      }}
                    >
                      プロジェクト+Following&nbsp;
                      {isFetchingCounts && !alternativesCache.following ? (
                        <CircularProgress size={12} sx={{ color: 'inherit', ml: 0.5 }} />
                      ) : (
                        `(+${alternativesCache.following?.length || 0}件)`
                      )}
                    </Button>

                    <Button
                      variant={scope === 'public' ? 'contained' : 'outlined'}
                      onClick={() => {
                        setScope('public');
                        setReplacementEntityId(null);
                        setActiveScope(null);
                      }}
                      sx={{
                        borderRadius: 20,
                        textTransform: 'none',
                        bgcolor: scope === 'public' ? '#a78bfa' : 'transparent',
                        color: scope === 'public' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                        borderColor: scope === 'public' ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.2)',
                        '&:hover': {
                          bgcolor: scope === 'public' ? '#8b5cf6' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                          borderColor: scope === 'public' ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                        }
                      }}
                    >
                      すべて&nbsp;
                      {isFetchingCounts && !alternativesCache.public ? (
                        <CircularProgress size={12} sx={{ color: 'inherit', ml: 0.5 }} />
                      ) : (
                        `(+${alternativesCache.public?.length || 0}件)`
                      )}
                    </Button>
                  </Box>

                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => setActiveScope(scope)}
                    sx={{ color: 'light-dark(#2f07a6, #a78bfa)', borderColor: '#a78bfa', '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(167,139,250,0.1)' }, borderRadius: 20, px: 2, py: 0.5 }}
                  >
                    代替家具を探す
                  </Button>
                </Box>

                {/* Results Grid */}
                {!activeScope ? (
                  <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                    「代替家具を探す」をクリックして検索してください。
                  </Typography>
                ) : isLoadingActiveScope ? (
                  <Box p={4} textAlign="center">
                    <CircularProgress size={24} sx={{ color: 'light-dark(#2f07a6, #a78bfa)', mb: 2 }} />
                    <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>検索中...</Typography>
                  </Box>
                ) : activeAlternatives.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                    同じカテゴリの代替家具が見つかりません。
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pb: 1, pt: 1, px: 1 }}>
                    {activeAlternatives.map(alt => {
                      const altId = getEntityId(alt);
                      const isSelected = replacementEntityId === altId;
                      const thumb = alt.metadata?.thumbnail || alt.metadata?.thumbnailUrl || alt.thumbnailUrl || alt.thumbUrl || alt.coverUrl;
                      const title = alt.metadata?.title || alt.metadata?.name || alt.title || alt.name || 'Unknown';
                      
                      return (
                        <Box key={altId} sx={{ position: 'relative' }}>
                          <LibraryAssetCard
                            model={null}
                            modelId={altId}
                            displayName={title}
                            thumbUrl={thumb}
                            isSelected={isSelected}
                            inPlan={false}
                            isFluid={false}
                            fixedSize={140}
                            onClick={() => setReplacementEntityId(altId)}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
          キャンセル
        </Button>
        <Button 
          variant="contained" 
          onClick={handleApply} 
          disabled={!canApply}
          sx={{ 
            bgcolor: '#a78bfa', 
            '&:hover': { bgcolor: '#8b5cf6' },
            '&.Mui-disabled': { bgcolor: 'rgba(167, 139, 250, 0.3)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }
          }}
        >
          適用して変更
        </Button>
      </DialogActions>
    </Dialog>
  );
};
