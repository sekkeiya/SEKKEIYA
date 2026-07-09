import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box, DialogActions, Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useAppStore } from '../../../store/useAppStore';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';
import { getDownloadUrlForModel } from '../utils/modelUtils';

export const SaveToProjectDialog: React.FC<{
  model: any;
  open: boolean;
  onClose: () => void;
}> = ({ model, open, onClose }) => {
  const projects = useAppStore(state => state.projects);

  if (!model) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f172a',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>プロジェクトに保存</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          「{model.title || model.name || 'Untitled'}」を保存するプロジェクトを選択してください。
        </Typography>
        <List sx={{ mt: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
          {projects.length > 0 ? (
            projects.map(p => (
              <ListItem disablePadding key={p.id}>
                <ListItemButton onClick={async () => {
                  try {
                    // Setup projectAssetsApi import at the top later, but for now access it directly:
                    const { projectAssetsApi } = await import('../../projects/api/projectAssetsApi');
                    const { useAuthStore } = await import('../../../store/useAuthStore');
                    
                    const user = useAuthStore.getState().user;
                    const uid = user?.uid || 'unknown';

                    const thumbnailUrl =
                      model?.metadata?.thumbnailFilePath?.url ||
                      model?.metadata?.thumbnailUrl ||
                      model?.metadata?.thumbnail?.url ||
                      model?.thumbnailFilePath?.url ||
                      model?.thumbnailUrl ||
                      model?.thumbnail?.url ||
                      model?.imageUrl ||
                      model?.previewUrl ||
                      '';

                    const finalAssetId = await projectAssetsApi.saveAssetToProject(p.id, model, uid);
                    console.log('Successfully processed project asset:', finalAssetId);
                    
                    // --- Inject 3DSS Logging here ---
                    try {
                      const { useAiProfileStore } = await import('../../../store/useAiProfileStore');
                      useAiProfileStore.getState().logSaveDataEvent({
                        userId: 'local-user',
                        actionType: 'MODEL_SAVED_TO_PROJECT',
                        context: {
                          workspaceId: '3DSS-workspace', // Use workspaceId instead
                          projectId: p.id,
                          targetId: model.id,
                          targetType: '3dss-model',
                          source: 'user',
                          payload: {
                            projectName: p.name,
                            targetModelName: model.title || model.name || 'Untitled',
                            targetCategory: model.category || 'unknown'
                          }
                        }
                      });
                    } catch (e) {
                      console.error('Failed to log event', e);
                    }
                    // ---------------------------------

                    console.log('Successfully saved to project:', p.id);
                    onClose();
                  } catch (err) {
                    console.error('Failed to save to project', err);
                    alert('保存に失敗しました');
                  }
                }}>
                  <ListItemIcon><FolderIcon sx={{ color: '#38bdf8' }} /></ListItemIcon>
                  <ListItemText 
                    primary={p.name} 
                    secondary={p.description || 'プロジェクト'} 
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                </ListItemButton>
              </ListItem>
            ))
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">プロジェクトがありません</Typography>
            </Box>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
      </DialogActions>
    </Dialog>
  );
};
