// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, ButtonGroup, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DssModelsGrid } from '../dss/DssModelsGrid';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDscStore } from './store/useDscStore';
import { WorkFileRepository } from '../projects/workFileRepository';

// ─── DscDashboard ──────────────────────────────────────────────────────────────

interface DscDashboardProps {
  payload: any;
  items: any[];
  isInitializing: boolean;
}

export const DscDashboard: React.FC<DscDashboardProps> = ({ payload, items: adapterItems, isInitializing: adapterIsInitializing }) => {
  const { setDscShellMode, activeProjectId, projects, setActiveProjectId, setPanelSelection } = useAppStore();
  const { currentUser } = useAuthStore();
  const { dscViewScope, savedCount } = useDscStore();

  const isProjectScope = dscViewScope === 'project';

  // プロジェクトスコープ専用: 自前フェッチ
  const [projectItems, setProjectItems] = useState<any[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);

  // グローバルスコープはアダプタからの items を使用、プロジェクトスコープは自前 items を使用
  const furnitureItems: any[] = isProjectScope ? projectItems : (adapterItems || []);
  const loading = isProjectScope ? projectLoading : (adapterIsInitializing ?? false);

  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState(210);
  const [searchQuery, setSearchQuery] = useState('');

  const DENSITY_PRESETS = [
    { key: 'compact', label: 'Compact', value: 168 },
    { key: 'default', label: 'Default', value: 210 },
    { key: 'large', label: 'Large', value: 246 },
  ];
  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1]; let bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) { const d = Math.abs(p.value - cardSize); if (d < bestDiff) { best = p; bestDiff = d; } }
    return best.key;
  }, [cardSize]);

  const mappedItems = useMemo(() => {
    const mapped = furnitureItems.map(item => ({
      ...item,
      title: item.name || item.title || (item.isProjectItem ? item.name : '造作家具'),
    }));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(item => {
      const hay = [item.title, item.name, ...(Array.isArray(item.tags) ? item.tags : [])]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [furnitureItems, searchQuery]);

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  // プロジェクトスコープ専用フェッチ
  const fetchProjectItems = useCallback(async () => {
    if (!currentUser || !activeProjectId) return;
    setProjectLoading(true);
    try {
      const files = await WorkFileRepository.getWorkFiles(activeProjectId);
      setProjectItems(files.filter((f: any) => f.appScope === '3dsc'));
    } catch (err) {
      console.error('[DSC] Failed to fetch furniture items:', err);
    } finally {
      setProjectLoading(false);
    }
  }, [activeProjectId, currentUser]);

  useEffect(() => {
    if (isProjectScope) {
      fetchProjectItems();
    }
  }, [isProjectScope, fetchProjectItems, savedCount]);

  // スコープ・プロジェクト変更時に右パネル選択をクリア
  useEffect(() => {
    setSelectedItemId(null);
    setPanelSelection('create', null);
  }, [dscViewScope, activeProjectId]);

  const handleOpenItem = (item: any) => {
    // Public Projects スコープ: プロジェクトをクリック → そのプロジェクトの家具一覧へ
    if (dscViewScope === 'global_projects' && item.isProjectItem) {
      setActiveProjectId(item.id);
      useDscStore.getState().setDscViewScope('project');
      return;
    }
    if (item.projectId) setActiveProjectId(item.projectId);
    useDscStore.getState().loadWorkFile(item);
    setDscShellMode('studio');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem || isDeleting) return;
    const pid = deletingItem.projectId || activeProjectId;
    if (!pid) return;
    try {
      setIsDeleting(true);
      await WorkFileRepository.deleteWorkFile(pid, deletingItem.id);
      setProjectItems(prev => prev.filter(f => f.id !== deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.error('[DSC] Failed to delete furniture:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNewFurniture = () => {
    if (!activeProjectId) {
      alert('プロジェクトを選択してから造作家具を作成してください。');
      return;
    }
    setDscShellMode('studio');
  };

  // スコープ表示名
  const scopeTitle =
    dscViewScope === 'global_following_furniture' || dscViewScope === 'global_furniture' ? 'Furniture' :
    dscViewScope === 'global_projects' ? 'Public Projects' :
    dscViewScope === 'my_public_furniture' ? 'Public Furniture' :
    dscViewScope === 'my_private_furniture' ? 'Private Furniture' :
    projectNameMap[activeProjectId] || '造作家具';

  // Furniture タブのサブ切替（フォロー中 / 全体）
  const isFurnitureScope = dscViewScope === 'global_following_furniture' || dscViewScope === 'global_furniture';

  // 削除可能かどうか（自分のアイテムのみ）
  const canDelete = isProjectScope
    || dscViewScope === 'my_public_furniture'
    || dscViewScope === 'my_private_furniture';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary' }}>

      {/* ── Sticky Header (3DSS 構造に統一) ── */}
      <Box sx={styles.stickyHeaderWrap}>
        <Box component="header" sx={styles.topBar}>
          <Box sx={styles.titleBlock}>
            <Box sx={styles.breadcrumb}>
              {isProjectScope
                ? `Project Furniture / ${projectNameMap[activeProjectId] || 'Overview'}`
                : 'Global Asset Hub'}
            </Box>

            {isFurnitureScope ? (
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                <Typography
                  onClick={() => useDscStore.getState().setDscViewScope('global_following_furniture')}
                  sx={{
                    fontSize: 24, fontWeight: 700, cursor: 'pointer',
                    color: dscViewScope === 'global_following_furniture' ? '#ffa726' : 'rgba(255,255,255,0.4)',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffa726' },
                  }}
                >
                  Following
                </Typography>
                <Typography
                  onClick={() => useDscStore.getState().setDscViewScope('global_furniture')}
                  sx={{
                    fontSize: 24, fontWeight: 700, cursor: 'pointer',
                    color: dscViewScope === 'global_furniture' ? '#ffa726' : 'rgba(255,255,255,0.4)',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffa726' },
                  }}
                >
                  All
                </Typography>
              </Box>
            ) : (
              <Box sx={styles.pageTitle}>{scopeTitle}</Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          <Box sx={styles.searchWrap}>
            <SearchRoundedIcon sx={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search furniture..."
              style={styles.searchInput as React.CSSProperties}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {loading && <CircularProgress size={18} sx={{ color: '#ffa726' }} />}
            {furnitureItems.length > 0 && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
                {furnitureItems.length} 件
              </Typography>
            )}
            <Box sx={styles.viewBlock}>
              <Box sx={styles.miniLabel}>Density</Box>
              <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
                {DENSITY_PRESETS.map(p => (
                  <Button
                    key={p.key}
                    onClick={() => setCardSize(p.value)}
                    sx={densityKey === p.key ? styles.densityBtnActive : styles.densityBtn}
                  >
                    {p.label}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>
            {(isProjectScope || dscViewScope === 'my_private_furniture') && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleNewFurniture}
                sx={{
                  bgcolor: '#ffa726', '&:hover': { bgcolor: '#fb8c00' },
                  color: '#000', fontWeight: 700, textTransform: 'none',
                  borderRadius: 999, height: 30, fontSize: 12,
                }}
              >
                新規造作
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, p: 3, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && furnitureItems.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40%' }}>
            <CircularProgress sx={{ color: '#ffa726' }} />
          </Box>
        ) : furnitureItems.length === 0 ? (
          <Box sx={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '60%', gap: 2,
          }}>
            <ViewInArIcon sx={{ fontSize: 56, color: 'rgba(255,167,38,0.18)', mb: 0.5 }} />
            <Typography variant="h6" color="text.secondary">
              {dscViewScope === 'global_projects' ? 'まだ公開プロジェクトはありません' :
               dscViewScope === 'my_public_furniture' ? 'まだ公開した造作家具はありません' :
               dscViewScope === 'my_private_furniture' ? '造作家具がまだありません' :
               isFurnitureScope ? 'まだ公開された造作家具はありません' :
               '造作家具がまだありません'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dscViewScope === 'my_private_furniture' || isProjectScope
                ? '「新規造作」ボタンから家具を作成してください'
                : '造作家具を公開するとここに表示されます'}
            </Typography>
            {(isProjectScope || dscViewScope === 'my_private_furniture') && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleNewFurniture}
                sx={{ borderColor: '#ffa726', color: '#ffa726', mt: 1 }}
              >
                最初の造作家具を作る
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, height: '100%', mx: -3, mb: -3 }}>
            <DssModelsGrid
              items={mappedItems}
              cardSize={cardSize}
              selectedItemId={selectedItemId}
              onSelectModel={(item) => {
                setSelectedItemId(item.id);
                setPanelSelection('create', item);
              }}
              onDoubleClick={(item) => handleOpenItem(item)}
              onDelete={canDelete ? (item) => setDeletingItem(item) : undefined}
              isInitializing={loading && furnitureItems.length === 0}
              cardContext={dscViewScope === 'global_projects' ? 'publicProjects' : 'privateModels'}
            />
          </Box>
        )}
      </Box>

      {/* ── 削除確認ダイアログ ── */}
      {deletingItem && (
        <Box sx={{
          position: 'fixed', inset: 0,
          bgcolor: 'rgba(0,0,0,0.55)',
          zIndex: 1400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Box sx={{
            width: 380, bgcolor: '#1a1e27', p: 4,
            borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 1.5, fontWeight: 700, fontSize: 15 }}>
              造作家具を削除
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 3, fontSize: 13 }}>
              「{deletingItem.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography
                onClick={() => !isDeleting && setDeletingItem(null)}
                sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: '#fff' } }}
              >
                キャンセル
              </Typography>
              <Typography
                onClick={handleDeleteConfirm}
                sx={{
                  color: '#ff4d4f', fontSize: 13, fontWeight: 600, py: 1,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                {isDeleting ? '削除中...' : '削除'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const styles = {
  stickyHeaderWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(2,6,23,0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(148,163,184,0.18)',
    minWidth: 0,
    flexShrink: 0,
  },
  topBar: {
    minHeight: 58,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },
  titleBlock: {
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  breadcrumb: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.85)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 760,
    letterSpacing: 0.2,
    lineHeight: 1.2,
    color: '#ffa726',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.30)',
    background: 'rgba(15,23,42,0.62)',
    width: 'min(560px, 100%)',
    minWidth: 220,
  },
  searchIcon: { fontSize: 18, color: 'rgba(148,163,184,0.9)' },
  searchInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#e5e7eb',
    fontSize: 12,
  },
  viewBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  miniLabel: { fontSize: 11, color: 'rgba(148,163,184,0.85)' },
  densityGroup: {
    '& .MuiButton-root': {
      textTransform: 'none',
      borderColor: 'rgba(148,163,184,0.22)',
    },
  },
  densityBtn: {
    color: 'rgba(229,231,235,0.9)',
    background: 'rgba(15,23,42,0.32)',
    borderColor: 'rgba(148,163,184,0.22)',
    padding: '3px 10px',
    fontSize: 11,
  },
  densityBtnActive: {
    color: '#0b1220',
    background: 'rgba(255,167,38,0.9)',
    borderColor: 'rgba(255,167,38,0.9)',
    padding: '3px 10px',
    fontSize: 11,
    '&:hover': { background: 'rgba(255,167,38,0.95)' },
  },
};
