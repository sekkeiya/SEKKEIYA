import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { createProject } from '../features/projects/api/createProject';
import { BRAND } from '../styles/theme';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const GlobalProjectDashboard: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { projects, setProjects, setActiveProjectId, setCurrentMainView, setActiveWorkspaceId } = useAppStore();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const refreshProjects = async () => {
    if (currentUser) {
      const fetchedProjects = await fetchUserProjects(currentUser.uid);
      setProjects(fetchedProjects);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, [currentUser, setProjects]);

  const doCreateProject = async (name: string) => {
    if (!currentUser || !name.trim()) return;
    try {
      setIsCreating(true);
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: name.trim(),
      });
      // 即時反映（Optimistic Update）
      setProjects([newProject as any, ...projects]);
      
      // Navigate immediately with the optimistically updated local state
      setActiveProjectId(newProject.id);

      // Background refresh
      refreshProjects();
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateProject = async () => {
    await doCreateProject(newProjectName);
    setNewProjectName('');
    setIsDialogOpen(false);
  };

  return (
    <Box sx={{ flex: 1, p: { xs: 4, md: 6 }, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, maxWidth: 1000, mx: 'auto', width: '100%' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.9)' }}>
          最近のプロジェクト
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddRoundedIcon />}
          sx={{ 
            bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', 
            color: 'var(--brand-fg)', 
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
            '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)' }
          }}
          onClick={() => setIsDialogOpen(true)}
        >
          新規手動作成
        </Button>
      </Box>

      <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
        {projects.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center', border: `1px dashed ${BRAND.line}`, borderRadius: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.01)' }}>
            <FolderRoundedIcon sx={{ fontSize: 48, color: 'rgb(var(--brand-fg-rgb) / 0.2)', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 1, fontWeight: 700 }}>
              プロジェクトがありません
            </Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 4 }}>
              以下のボタンから最初のプロジェクトを作成してください。
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => setIsDialogOpen(true)} 
              startIcon={<AddRoundedIcon />}
              sx={{ 
                bgcolor: '#00BFFF', color: '#000', textTransform: 'none', borderRadius: 2, fontWeight: 800,
                '&:hover': { bgcolor: '#4facfe' } 
              }}
            >
              最初のプロジェクトを作成
            </Button>
          </Box>

        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
            {projects.map(project => {
              const hue = [...(project.name || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
              return (
                <Box key={project.id}>
                  <Paper
                    onClick={() => {
                      setActiveProjectId(project.id);
                      setActiveWorkspaceId(null);
                      setCurrentMainView('workspace');
                    }}
                    sx={{
                      p: 3,
                      bgcolor: BRAND.panel,
                      borderRadius: 3,
                      border: `1px solid ${BRAND.line}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                      }
                    }}
                  >
                    <IconButton 
                      size="small" 
                      sx={{ position: 'absolute', top: 12, right: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'var(--brand-fg)' } }}
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>

                    <Box sx={{ 
                      width: 44, height: 44, borderRadius: 2, 
                      bgcolor: `hsl(${hue}, 50%, 20%)`,
                      border: `1px solid hsl(${hue}, 50%, 30%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2
                    }}>
                      <FolderRoundedIcon sx={{ fontSize: 20, color: `hsl(${hue}, 80%, 70%)` }} />
                    </Box>

                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: 'var(--brand-fg)', mb: 0.5 }}>
                      {project.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', display: 'block', fontWeight: 500 }}>
                      Last updated recently
                    </Typography>
                  </Paper>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Dialog 
        open={isDialogOpen} 
        onClose={() => !isCreating && setIsDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: BRAND.panel, color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 400 } }}
      >
        <DialogTitle>新規プロジェクト作成</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="プロジェクト名"
            type="text"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            disabled={isCreating}
            InputProps={{ style: { color: 'var(--brand-fg)' } }}
            InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GlobalProjectDashboard;
