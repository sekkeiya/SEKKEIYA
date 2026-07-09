import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Tooltip, Breadcrumbs, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { DsrDrawingGrid } from './DsrDrawingGrid';
import { DsrRightPanel } from './components/DsrRightPanel';
import { DsrPdfViewer } from './components/DsrPdfViewer';
import { DsrUploadDialog } from './upload/DsrUploadDialog';
import { dsrUploadService } from './upload/dsrUploadService';
import { useDsrStore, DSR_CATEGORIES, type DsrCategoryFilter } from './store/useDsrStore';
import { useAppStore } from '../../store/useAppStore';

const ACCENT = '#4db6ac';

interface DsrDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
  drawings: any[];
  sets: any[];
  /** global_projects スコープ時の公開プロジェクト一覧（それ以外は null） */
  projects?: any[] | null;
  isInitializing?: boolean;
  isGlobal?: boolean;
  onDeleteItem?: (item: any) => void;
  onSelectItem?: (item: any) => void;
  onOpenProject?: (project: any) => void;
}

const FILTER_TABS: { key: DsrCategoryFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  ...DSR_CATEGORIES.map(c => ({ key: c as DsrCategoryFilter, label: c })),
];

export const DsrDashboard: React.FC<DsrDashboardProps> = ({ payload, drawings, sets, projects = null, isInitializing, isGlobal, onOpenProject }) => {
  const categoryFilter = useDsrStore(s => s.categoryFilter);
  const setCategoryFilter = useDsrStore(s => s.setCategoryFilter);
  const openSetId = useDsrStore(s => s.openSetId);
  const setOpenSetId = useDsrStore(s => s.setOpenSetId);
  const selectedDrawingId = useDsrStore(s => s.selectedDrawingId);
  const setSelectedDrawingId = useDsrStore(s => s.setSelectedDrawingId);

  const projectId = payload?.projectId || '';
  const canWrite = !!projectId && !isGlobal;

  const isProjectsMode = projects !== null;
  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);
  useEffect(() => {
    setAiTaskInnerRight(isProjectsMode ? 0 : 260);
    return () => setAiTaskInnerRight(0);
  }, [isProjectsMode, setAiTaskInnerRight]);
  const openSet = useMemo(() => sets.find(s => s.id === openSetId) || null, [sets, openSetId]);
  const selectedItem = useMemo(() => drawings.find(d => d.id === selectedDrawingId) || null, [drawings, selectedDrawingId]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewerItem, setViewerItem] = useState<any | null>(null);

  // Tauri デスクトップ webview では window.open が機能しないため、plugin-opener で外部ブラウザを開く
  const openExternal = (url?: string) => {
    if (!url) return;
    import('@tauri-apps/plugin-opener')
      .then(({ openUrl }) => { if (openUrl) openUrl(url); else window.open(url, '_blank'); })
      .catch(() => window.open(url, '_blank'));
  };

  const handleCreateSet = async () => {
    if (!projectId || !newSetName.trim() || creatingSet) return;
    setCreatingSet(true);
    try {
      await dsrUploadService.createDrawingSet(projectId, { title: newSetName.trim() });
      setNewSetName('');
      setSetDialogOpen(false);
    } catch (e) {
      console.error('[DsrDashboard] create set failed', e);
    } finally {
      setCreatingSet(false);
    }
  };

  const handleMove = async (item: any, newSetId: string | null) => {
    if (!projectId) return;
    try {
      await dsrUploadService.moveDrawingToSet(projectId, item.id, newSetId, item.parentSetId ?? null);
    } catch (e) {
      console.error('[DsrDashboard] move failed', e);
    }
  };

  const handleSetVisibility = async (item: any, visibility: 'public' | 'private') => {
    const pid = item.projectId || projectId;
    if (!pid) return;
    try {
      await dsrUploadService.setDrawingVisibility(pid, item.id, visibility);
    } catch (e) {
      console.error('[DsrDashboard] set visibility failed', e);
    }
  };

  const handleConfirmDelete = async (cascade: boolean) => {
    if (!projectId || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'drawing-set') {
        await dsrUploadService.deleteDrawingSet(projectId, deleteTarget.id, cascade);
        if (openSetId === deleteTarget.id) setOpenSetId(null);
      } else {
        await dsrUploadService.deleteDrawing(projectId, deleteTarget);
        if (selectedDrawingId === deleteTarget.id) setSelectedDrawingId(null);
      }
      setDeleteTarget(null);
    } catch (e) {
      console.error('[DsrDashboard] delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default' }}>
      {/* Main column */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {viewerItem ? (
          <DsrPdfViewer item={viewerItem} onClose={() => setViewerItem(null)} onOpenExternal={openExternal} />
        ) : (
        <>
        {/* Toolbar */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
                Drawing Library
              </Typography>
              {isProjectsMode ? (
                <Typography sx={{ color: 'var(--brand-fg)', fontSize: 22, fontWeight: 700, mt: 0.25 }}>公開プロジェクト</Typography>
              ) : openSet ? (
                <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />} sx={{ mt: 0.25 }}>
                  <Link component="button" underline="hover" onClick={() => setOpenSetId(null)}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 20, fontWeight: 700, '&:hover': { color: 'var(--brand-fg)' } }}>
                    図面
                  </Link>
                  <Typography sx={{ color: 'var(--brand-fg)', fontSize: 20, fontWeight: 700 }}>{openSet.title || 'セット'}</Typography>
                </Breadcrumbs>
              ) : (
                <Typography sx={{ color: 'var(--brand-fg)', fontSize: 22, fontWeight: 700, mt: 0.25 }}>図面</Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={canWrite ? '設計図書セットを作成' : 'プロジェクトを選択してください'} placement="bottom">
                <span>
                  <Button
                    variant="outlined" size="small" startIcon={<CreateNewFolderRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => { setNewSetName(''); setSetDialogOpen(true); }}
                    sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: ACCENT }, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                  >
                    新規セット
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={isGlobal ? '公開図面の閲覧（共有機能は今後対応）' : !projectId ? 'プロジェクトを選択してください' : 'PDF / 画像をアップロード'} placement="left">
                <span>
                  <Button
                    variant="contained" size="small" startIcon={<CloudUploadRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => setUploadOpen(true)}
                    sx={{ bgcolor: ACCENT, color: '#000', '&:hover': { bgcolor: '#80cbc4' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
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
                    color: active ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.7)',
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
            <DsrDrawingGrid
              drawings={drawings}
              sets={sets}
              isInitializing={isInitializing}
              onDeleteItem={canWrite ? (item) => setDeleteTarget(item) : undefined}
              onSelectItem={(item) => setSelectedDrawingId(item.id)}
            />
          )}
        </Box>
        </>
        )}
      </Box>

      {/* Right info panel */}
      {!isProjectsMode && (
        <Box sx={{ width: 260, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', bgcolor: 'light-dark(rgba(15,23,42,0.05), rgba(0,0,0,0.15))' }}>
          <DsrRightPanel
            item={selectedItem}
            sets={canWrite ? sets : []}
            onMove={canWrite ? handleMove : undefined}
            onSetVisibility={(canWrite || isGlobal) ? handleSetVisibility : undefined}
            onOpen={setViewerItem}
          />
        </Box>
      )}

      {/* Upload dialog */}
      {canWrite && (
        <DsrUploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          projectId={projectId}
          defaultParentSetId={openSetId}
          sets={sets}
        />
      )}

      {/* Create set dialog */}
      <Dialog open={setDialogOpen} onClose={() => !creatingSet && setSetDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 400 } }}>
        <DialogTitle sx={{ pb: 1 }}>新規セット作成</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            設計図書一式など、複数の図面をまとめるセット（フォルダ）を作成します。
          </Typography>
          <TextField
            autoFocus margin="dense" label="セット名" fullWidth variant="outlined"
            value={newSetName} onChange={(e) => setNewSetName(e.target.value)} disabled={creatingSet}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSet(); }}
            InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setSetDialogOpen(false)} disabled={creatingSet} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleCreateSet} disabled={creatingSet || !newSetName.trim()} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#000', '&:hover': { bgcolor: '#80cbc4' } }}>
            {creatingSet ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          {deleteTarget?.type === 'drawing-set' ? (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
              セット「{deleteTarget?.title || 'セット'}」を削除します。中の図面も一緒に削除しますか？<br />
              「セットのみ削除」を選ぶと、中の図面はトップ階層に残ります。
            </Typography>
          ) : (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
              「{deleteTarget?.title || deleteTarget?.name || 'この図面'}」を削除しますか？この操作は元に戻せません。
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          {deleteTarget?.type === 'drawing-set' && (
            <Button onClick={() => handleConfirmDelete(false)} disabled={deleting} sx={{ color: 'var(--brand-fg)' }}>
              セットのみ削除
            </Button>
          )}
          <Button onClick={() => handleConfirmDelete(true)} disabled={deleting} variant="contained" color="error">
            {deleting ? '削除中...' : deleteTarget?.type === 'drawing-set' ? '図面ごと削除' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
