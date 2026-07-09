import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Button, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, CircularProgress, Fade, Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { projectAssetsApi } from '../../projects/api/projectAssetsApi';

/** 各プロジェクトの保存状態 */
type ProjectStatus = 'idle' | 'checking' | 'saved' | 'saving' | 'done';

export const SaveToProjectDialog: React.FC<{
  model: any;
  open: boolean;
  onClose: () => void;
}> = ({ model, open, onClose }) => {
  const projects = useAppStore(state => state.projects);
  const currentUser = useAuthStore(state => state.currentUser);

  // projectId → status
  const [statusMap, setStatusMap] = useState<Record<string, ProjectStatus>>({});
  // 最後に保存成功したプロジェクトID（チェックアニメ用）
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // ダイアログが開いたとき、各プロジェクトの保存状態を確認する
  useEffect(() => {
    if (!open || !model?.id) return;
    let cancelled = false;

    const init: Record<string, ProjectStatus> = {};
    projects.forEach(p => { init[p.id] = 'checking'; });
    setStatusMap(init);
    setJustSavedId(null);

    Promise.all(
      projects.map(async p => {
        try {
          const existing = await projectAssetsApi.findAssetBySourceModelId(p.id, model.id);
          return { id: p.id, status: (existing && existing.status !== 'archived') ? 'saved' : 'idle' } as const;
        } catch {
          return { id: p.id, status: 'idle' as ProjectStatus };
        }
      })
    ).then(results => {
      if (cancelled) return;
      const next: Record<string, ProjectStatus> = {};
      results.forEach(r => { next[r.id] = r.status; });
      setStatusMap(next);
    });

    return () => { cancelled = true; };
  }, [open, model?.id, projects]);

  const handleSave = useCallback(async (projectId: string) => {
    const uid = currentUser?.uid || 'unknown';

    setStatusMap(prev => ({ ...prev, [projectId]: 'saving' }));
    try {
      await projectAssetsApi.saveAssetToProject(projectId, model, uid);

      // ログ（失敗してもOK）
      try {
        const { useAiProfileStore } = await import('../../../store/useAiProfileStore');
        const proj = projects.find(p => p.id === projectId);
        useAiProfileStore.getState().logSaveDataEvent({
          userId: 'local-user',
          actionType: 'MODEL_SAVED_TO_PROJECT',
          context: {
            workspaceId: '3DSS-workspace',
            projectId,
            targetId: model.id,
            targetType: '3dss-model',
            source: 'user',
            payload: {
              projectName: proj?.name || '',
              targetModelName: model.title || model.name || 'Untitled',
              targetCategory: model.category || 'unknown',
            },
          },
        });
      } catch { /* noop */ }

      setStatusMap(prev => ({ ...prev, [projectId]: 'done' }));
      setJustSavedId(projectId);

      // 0.8秒後に 'saved' に移行（チェックアニメ完了後）
      setTimeout(() => {
        setStatusMap(prev => ({ ...prev, [projectId]: 'saved' }));
        setJustSavedId(prev => (prev === projectId ? null : prev));
      }, 800);
    } catch (err) {
      console.error('Failed to save to project', err);
      setStatusMap(prev => ({ ...prev, [projectId]: 'idle' }));
    }
  }, [currentUser, model, projects]);

  if (!model) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface)',
          backgroundImage: 'none',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>プロジェクトに保存</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          「{model.title || model.name || 'Untitled'}」を保存するプロジェクトを選択してください。
        </Typography>
        <List sx={{ mt: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
          {projects.length > 0 ? (
            projects.map(p => {
              const status = statusMap[p.id] || 'checking';
              const isAlreadySaved = status === 'saved';
              const isSaving = status === 'saving';
              const isDone = status === 'done';
              const isChecking = status === 'checking';
              const isJustSaved = justSavedId === p.id;

              return (
                <ListItem disablePadding key={p.id}>
                  <ListItemButton
                    onClick={() => {
                      if (isSaving || isChecking) return;
                      handleSave(p.id);
                    }}
                    disabled={isSaving || isChecking}
                    sx={{
                      borderRadius: 1,
                      transition: 'background 0.2s',
                      ...(isAlreadySaved && {
                        opacity: 0.7,
                      }),
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {/* チェックアニメーション */}
                      {isJustSaved || isDone ? (
                        <Fade in timeout={200}>
                          <CheckCircleIcon
                            sx={{
                              color: '#4ade80',
                              fontSize: 24,
                              animation: 'popIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275)',
                              '@keyframes popIn': {
                                '0%': { transform: 'scale(0.4)', opacity: 0 },
                                '100%': { transform: 'scale(1)', opacity: 1 },
                              },
                            }}
                          />
                        </Fade>
                      ) : isChecking ? (
                        <CircularProgress size={20} thickness={3} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
                      ) : isSaving ? (
                        <CircularProgress size={20} thickness={3} sx={{ color: 'light-dark(#0676a8, #38bdf8)' }} />
                      ) : isAlreadySaved ? (
                        <CheckCircleOutlineIcon sx={{ color: '#4ade80', fontSize: 22 }} />
                      ) : (
                        <FolderIcon sx={{ color: 'light-dark(#0676a8, #38bdf8)' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                            {p.name}
                          </Typography>
                          {isAlreadySaved && !isDone && !isJustSaved && (
                            <Chip
                              label="追加済み"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: 10,
                                bgcolor: 'rgba(74, 222, 128, 0.15)',
                                color: '#4ade80',
                                border: '1px solid rgba(74, 222, 128, 0.3)',
                              }}
                            />
                          )}
                          {(isDone || isJustSaved) && (
                            <Chip
                              label="追加しました"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: 10,
                                bgcolor: 'rgba(74, 222, 128, 0.2)',
                                color: '#4ade80',
                                border: '1px solid rgba(74, 222, 128, 0.4)',
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={p.description || 'プロジェクト'}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">プロジェクトがありません</Typography>
            </Box>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
