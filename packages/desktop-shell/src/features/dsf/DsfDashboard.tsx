import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { DsfPortfolioGrid } from './DsfPortfolioGrid';
import { DsfRightPanel } from './components/DsfRightPanel';
import { DsfBookViewer } from './components/DsfBookViewer';
import { DsfUploadDialog } from './upload/DsfUploadDialog';
import { dsfUploadService } from './upload/dsfUploadService';
import { useDsfStore, DSF_CATEGORIES, type DsfCategoryFilter } from './store/useDsfStore';
import { useAppStore } from '../../store/useAppStore';

const ACCENT = '#7e57c2';

interface DsfDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
  portfolios: any[];
  /** global_projects スコープ時の公開プロジェクト一覧（それ以外は null） */
  projects?: any[] | null;
  isInitializing?: boolean;
  isGlobal?: boolean;
  onSelectItem?: (item: any) => void;
  onOpenProject?: (project: any) => void;
}

const FILTER_TABS: { key: DsfCategoryFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  ...DSF_CATEGORIES.map(c => ({ key: c as DsfCategoryFilter, label: c })),
];

export const DsfDashboard: React.FC<DsfDashboardProps> = ({ payload, portfolios, projects = null, isInitializing, isGlobal, onOpenProject }) => {
  const categoryFilter = useDsfStore(s => s.categoryFilter);
  const setCategoryFilter = useDsfStore(s => s.setCategoryFilter);
  const selectedPortfolioId = useDsfStore(s => s.selectedPortfolioId);
  const setSelectedPortfolioId = useDsfStore(s => s.setSelectedPortfolioId);
  const viewerPortfolioId = useDsfStore(s => s.viewerPortfolioId);
  const setViewerPortfolioId = useDsfStore(s => s.setViewerPortfolioId);

  const projectId = payload?.projectId || '';
  const canWrite = !!projectId && !isGlobal;

  const isProjectsMode = projects !== null;
  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);
  useEffect(() => {
    setAiTaskInnerRight(isProjectsMode ? 0 : 260);
    return () => setAiTaskInnerRight(0);
  }, [isProjectsMode, setAiTaskInnerRight]);
  const selectedItem = useMemo(() => portfolios.find(p => p.id === selectedPortfolioId) || null, [portfolios, selectedPortfolioId]);
  const viewerItem = useMemo(() => portfolios.find(p => p.id === viewerPortfolioId) || null, [portfolios, viewerPortfolioId]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSetVisibility = async (item: any, visibility: 'public' | 'private') => {
    const pid = item.projectId || projectId;
    if (!pid) return;
    try {
      await dsfUploadService.setPortfolioVisibility(pid, item.id, visibility);
    } catch (e) {
      console.error('[DsfDashboard] set visibility failed', e);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectId || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await dsfUploadService.deletePortfolio(projectId, deleteTarget);
      if (selectedPortfolioId === deleteTarget.id) setSelectedPortfolioId(null);
      if (viewerPortfolioId === deleteTarget.id) setViewerPortfolioId(null);
      setDeleteTarget(null);
    } catch (e) {
      console.error('[DsfDashboard] delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default' }}>
      {/* Main column */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
                Portfolio Library
              </Typography>
              <Typography sx={{ color: 'var(--brand-fg)', fontSize: 22, fontWeight: 700, mt: 0.25 }}>
                {isProjectsMode ? '公開プロジェクト' : 'ポートフォリオ'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={isGlobal ? '公開ポートフォリオの閲覧' : !projectId ? 'プロジェクトを選択してください' : 'PDF をアップロード'} placement="left">
                <span>
                  <Button
                    variant="contained" size="small" startIcon={<CloudUploadRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => setUploadOpen(true)}
                    sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#9575cd' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
                  >
                    アップロード
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {/* Category filter tabs */}
          {!isProjectsMode && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {FILTER_TABS.map(tab => {
                const active = categoryFilter === tab.key;
                return (
                  <Box
                    key={tab.key}
                    onClick={() => setCategoryFilter(tab.key)}
                    sx={{
                      px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
                      color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                      bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.1)' },
                    }}
                  >
                    {tab.label}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Grid */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {isProjectsMode ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, p: 3, overflowY: 'auto', alignContent: 'start' }}>
              {(projects || []).map((p: any) => (
                <Box key={p.id} onClick={() => onOpenProject?.(p)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: 2, cursor: 'pointer',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', transform: 'translateY(-2px)' } }}>
                  <FolderSpecialRoundedIcon sx={{ fontSize: 28, color: ACCENT }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 600 }}>{p.name || 'プロジェクト'}</Typography>
                    <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11 }}>{p.ownerName || ''}</Typography>
                  </Box>
                </Box>
              ))}
              {(projects || []).length === 0 && (
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center', mt: 4 }}>
                  公開プロジェクトがありません
                </Typography>
              )}
            </Box>
          ) : (
            <DsfPortfolioGrid
              portfolios={portfolios}
              isInitializing={isInitializing}
              canWrite={canWrite}
              onDeleteItem={canWrite ? (item) => setDeleteTarget(item) : undefined}
              onOpenItem={(item) => setSelectedPortfolioId(item.id)}
            />
          )}
        </Box>
      </Box>

      {/* Right info panel */}
      {!isProjectsMode && (
        <Box sx={{ width: 260, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', bgcolor: 'light-dark(rgba(15,23,42,0.05), rgba(0,0,0,0.15))' }}>
          <DsfRightPanel
            item={selectedItem}
            onOpen={(item) => setViewerPortfolioId(item.id)}
            onSetVisibility={(canWrite || isGlobal) ? handleSetVisibility : undefined}
          />
        </Box>
      )}

      {/* Upload dialog */}
      {canWrite && (
        <DsfUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} projectId={projectId} />
      )}

      {/* Book viewer (full-screen) */}
      {viewerItem && (
        <DsfBookViewer item={viewerItem} onClose={() => setViewerPortfolioId(null)} />
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
            「{deleteTarget?.title || deleteTarget?.name || 'このポートフォリオ'}」を削除しますか？この操作は元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleConfirmDelete} disabled={deleting} variant="contained" color="error">
            {deleting ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
