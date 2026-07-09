import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, Tooltip, Breadcrumbs, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { DsiImageGrid } from './DsiImageGrid';
import { DsiRightPanel } from './components/DsiRightPanel';
import { DsiUploadDialog } from './upload/DsiUploadDialog';
import { dsiUploadService } from './upload/dsiUploadService';
import { useDsiStore, DSI_CATEGORIES, type DsiCategoryFilter } from './store/useDsiStore';

const ACCENT = '#ec407a';
const ACCENT_HOVER = '#f48fb1';

interface DsiDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
  images: any[];
  sets: any[];
  /** global_projects スコープ時の公開プロジェクト一覧（それ以外は null） */
  projects?: any[] | null;
  isInitializing?: boolean;
  isGlobal?: boolean;
  onDeleteItem?: (item: any) => void;
  onSelectItem?: (item: any) => void;
  onOpenProject?: (project: any) => void;
}

const FILTER_TABS: { key: DsiCategoryFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  ...DSI_CATEGORIES.map(c => ({ key: c as DsiCategoryFilter, label: c })),
];

export const DsiDashboard: React.FC<DsiDashboardProps> = ({ payload, images, sets, projects = null, isInitializing, isGlobal, onOpenProject }) => {
  const categoryFilter = useDsiStore(s => s.categoryFilter);
  const setCategoryFilter = useDsiStore(s => s.setCategoryFilter);
  const openSetId = useDsiStore(s => s.openSetId);
  const setOpenSetId = useDsiStore(s => s.setOpenSetId);
  const selectedImageId = useDsiStore(s => s.selectedImageId);
  const setSelectedImageId = useDsiStore(s => s.setSelectedImageId);

  const projectId = payload?.projectId || '';
  const canWrite = !!projectId && !isGlobal;

  const isProjectsMode = projects !== null;
  const openSet = useMemo(() => sets.find(s => s.id === openSetId) || null, [sets, openSetId]);
  const selectedItem = useMemo(() => images.find(d => d.id === selectedImageId) || null, [images, selectedImageId]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreateSet = async () => {
    if (!projectId || !newSetName.trim() || creatingSet) return;
    setCreatingSet(true);
    try {
      await dsiUploadService.createImageSet(projectId, { title: newSetName.trim() });
      setNewSetName('');
      setSetDialogOpen(false);
    } catch (e) {
      console.error('[DsiDashboard] create set failed', e);
    } finally {
      setCreatingSet(false);
    }
  };

  const handleMove = async (item: any, newSetId: string | null) => {
    if (!projectId) return;
    try {
      await dsiUploadService.moveImageToSet(projectId, item.id, newSetId, item.parentSetId ?? null);
    } catch (e) {
      console.error('[DsiDashboard] move failed', e);
    }
  };

  const handleSetVisibility = async (item: any, visibility: 'public' | 'private') => {
    const pid = item.projectId || projectId;
    if (!pid) return;
    try {
      await dsiUploadService.setImageVisibility(pid, item.id, visibility);
    } catch (e) {
      console.error('[DsiDashboard] set visibility failed', e);
    }
  };

  const handleUpdateMeta = async (item: any, fields: { category?: any; tags?: string[] }) => {
    const pid = item.projectId || projectId;
    if (!pid) return;
    try {
      await dsiUploadService.updateImageMeta(pid, item.id, fields);
    } catch (e) {
      console.error('[DsiDashboard] update meta failed', e);
    }
  };

  const handleConfirmDelete = async (cascade: boolean) => {
    if (!projectId || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'image-set') {
        await dsiUploadService.deleteImageSet(projectId, deleteTarget.id, cascade);
        if (openSetId === deleteTarget.id) setOpenSetId(null);
      } else {
        await dsiUploadService.deleteImage(projectId, deleteTarget);
        if (selectedImageId === deleteTarget.id) setSelectedImageId(null);
      }
      setDeleteTarget(null);
    } catch (e) {
      console.error('[DsiDashboard] delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default' }}>
      {/* Main column */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                Image Library
              </Typography>
              {isProjectsMode ? (
                <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 700, mt: 0.25 }}>公開プロジェクト</Typography>
              ) : openSet ? (
                <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />} sx={{ mt: 0.25 }}>
                  <Link component="button" underline="hover" onClick={() => setOpenSetId(null)}
                    sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: 700, '&:hover': { color: '#fff' } }}>
                    画像・動画
                  </Link>
                  <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{openSet.title || 'セット'}</Typography>
                </Breadcrumbs>
              ) : (
                <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 700, mt: 0.25 }}>画像・動画</Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={canWrite ? '画像セットを作成' : 'プロジェクトを選択してください'} placement="bottom">
                <span>
                  <Button
                    variant="outlined" size="small" startIcon={<CreateNewFolderRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => { setNewSetName(''); setSetDialogOpen(true); }}
                    sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: ACCENT }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.1)' } }}
                  >
                    新規セット
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={isGlobal ? '公開画像の閲覧' : !projectId ? 'プロジェクトを選択してください' : '画像 / 動画をアップロード'} placement="left">
                <span>
                  <Button
                    variant="contained" size="small" startIcon={<CloudUploadRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => setUploadOpen(true)}
                    sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: ACCENT_HOVER }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' } }}
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
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                    bgcolor: active ? ACCENT : 'rgba(255,255,255,0.05)',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: active ? ACCENT : 'rgba(255,255,255,0.1)' },
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
                    bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.25)', transform: 'translateY(-2px)' } }}>
                  <FolderSpecialRoundedIcon sx={{ fontSize: 28, color: ACCENT }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{p.name || 'プロジェクト'}</Typography>
                    <Typography noWrap sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{p.ownerName || ''}</Typography>
                  </Box>
                </Box>
              ))}
              {(projects || []).length === 0 && (
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center', mt: 4 }}>
                  公開プロジェクトがありません
                </Typography>
              )}
            </Box>
          ) : (
            <DsiImageGrid
              images={images}
              sets={sets}
              isInitializing={isInitializing}
              onDeleteItem={canWrite ? (item) => setDeleteTarget(item) : undefined}
              onSelectItem={(item) => setSelectedImageId(item.id)}
            />
          )}
        </Box>
      </Box>

      {/* Right info panel */}
      {!isProjectsMode && (
        <Box sx={{ width: 280, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(0,0,0,0.15)', overflowY: 'auto' }}>
          <DsiRightPanel
            item={selectedItem}
            sets={canWrite ? sets : []}
            onMove={canWrite ? handleMove : undefined}
            onSetVisibility={(canWrite || isGlobal) ? handleSetVisibility : undefined}
            onUpdateMeta={(canWrite || isGlobal) ? handleUpdateMeta : undefined}
          />
        </Box>
      )}

      {/* Upload dialog */}
      {canWrite && (
        <DsiUploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          projectId={projectId}
          defaultParentSetId={openSetId}
          sets={sets}
        />
      )}

      {/* Create set dialog */}
      <Dialog open={setDialogOpen} onClose={() => !creatingSet && setSetDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 400 } }}>
        <DialogTitle sx={{ pb: 1 }}>新規セット作成</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            パース一式・動画コンテなど、複数の画像/動画をまとめるセット（フォルダ）を作成します。
          </Typography>
          <TextField
            autoFocus margin="dense" label="セット名" fullWidth variant="outlined"
            value={newSetName} onChange={(e) => setNewSetName(e.target.value)} disabled={creatingSet}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSet(); }}
            InputProps={{ style: { color: '#fff' } }} InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setSetDialogOpen(false)} disabled={creatingSet} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          <Button onClick={handleCreateSet} disabled={creatingSet || !newSetName.trim()} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: ACCENT_HOVER } }}>
            {creatingSet ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: '#1a1e27', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          {deleteTarget?.type === 'image-set' ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
              セット「{deleteTarget?.title || 'セット'}」を削除します。中の画像/動画も一緒に削除しますか？<br />
              「セットのみ削除」を選ぶと、中のアイテムはトップ階層に残ります。
            </Typography>
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
              「{deleteTarget?.title || deleteTarget?.name || 'このアイテム'}」を削除しますか？
              {(deleteTarget?.sourceType === 'layout-render' || deleteTarget?.sourceType === 'ai-render')
                ? ' これは元データへの参照です。S.Image の一覧から外れますが、元の S.Layout / AI Render のデータは残ります。'
                : ' この操作は元に戻せません。'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          {deleteTarget?.type === 'image-set' && (
            <Button onClick={() => handleConfirmDelete(false)} disabled={deleting} sx={{ color: '#fff' }}>
              セットのみ削除
            </Button>
          )}
          <Button onClick={() => handleConfirmDelete(true)} disabled={deleting} variant="contained" color="error">
            {deleting ? '削除中...' : deleteTarget?.type === 'image-set' ? 'まとめて削除' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
