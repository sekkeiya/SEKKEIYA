import React, { useState, useMemo } from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, CardActionArea, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';

import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { BRAND } from '../../../styles/theme';

export type AiCanvasView = 'all' | 'diagram' | 'mood' | 'material';

const MENU_ITEMS: { id: AiCanvasView; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: '全体ビュー', icon: <DashboardCustomizeRoundedIcon fontSize="small" /> },
];

function ProjectListItem({ project, active, onClick }: { project: any; active: boolean; onClick: () => void }) {
  const hue = [...(project.name || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <Box sx={{ position: "relative", mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          bgcolor: active ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent",
          "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" },
        }}
      >
        <Box sx={{ 
          width: 20, height: 20, borderRadius: 1.5, 
          bgcolor: `hsl(${hue}, 50%, 40%)`,
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1,
          flexShrink: 0
        }}>
          <FolderRoundedIcon sx={{ fontSize: 14, color: "var(--brand-fg)" }} />
        </Box>
        <Typography sx={{ 
          color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", 
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1
        }}>
          {project.name}
        </Typography>
      </CardActionArea>
    </Box>
  );
}

export const AiCanvasSidebar: React.FC = () => {
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  const projects = useAppStore(s => s.projects);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const setProjects = useAppStore(s => s.setProjects);
  const canvasPages = useAppStore(s => s.canvasPages);
  const canvasCurrentPageId = useAppStore(s => s.canvasCurrentPageId);
  const canvasMode = useAppStore(s => s.canvasMode);
  const setCanvasMode = useAppStore(s => s.setCanvasMode);
  const { currentUser } = useAuthStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<{ id: string, name: string } | null>(null);

  const handleCreateProject = async () => {
    if (!currentUser || !newProjectName.trim()) return;
    try {
      setIsCreating(true);
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newProjectName.trim(),
        isTeam: createProjectType === 'team',
      });
      // Update global store
      setProjects([newProject as any, ...projects]);
      
      setNewProjectName('');
      setIsCreateDialogOpen(false);
      
      setActiveProjectId(newProject.id, 'canvas');

      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const { myProjects, teamProjects } = useMemo(() => {
    return {
      myProjects: projects.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: projects.filter(p => p.ownerId !== currentUser?.uid || p.isTeam)
    };
  }, [projects, currentUser?.uid]);

  const renderProjectWithPages = (p: any, isActive: boolean) => (
    <Box key={p.id}>
      <ProjectListItem 
        project={p} 
        active={isActive}
        onClick={() => setActiveProjectId(p.id, 'canvas')} 
      />
      {isActive && (
        <Box sx={{ ml: 4, mr: 1.5, my: 0.5 }}>
          {canvasPages.map(page => (
            <Box 
              key={page.id} 
              onClick={(e) => {
                e.stopPropagation();
                const editor = (window as any).canvasEditor;
                if (editor) editor.setCurrentPage(page.id);
              }} 
              sx={{ 
                display: 'flex', alignItems: 'center', py: 0.5, px: 1, borderRadius: 1.5, cursor: 'pointer', 
                bgcolor: page.id === canvasCurrentPageId ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent', 
                '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } 
              }}
            >
              <Typography sx={{ fontSize: 11, color: page.id === canvasCurrentPageId ? "light-dark(#095fa5, #90caf9)" : "rgb(var(--brand-fg-rgb) / 0.6)", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {page.name || "Untitled Page"}
              </Typography>
              {canvasPages.length > 1 && (
                <IconButton 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPageToDelete(page);
                  }}
                  sx={{ 
                    p: 0.25, ml: 1, 
                    color: "rgb(var(--brand-fg-rgb) / 0.3)", 
                    '&:hover': { color: "#f44336", bgcolor: "rgba(244, 67, 54, 0.1)" } 
                  }}
                >
                  <DeleteRoundedIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Box>
          ))}
          <Box 
            onClick={(e) => {
              e.stopPropagation();
              const editor = (window as any).canvasEditor;
              if (editor) {
                editor.createPage({ name: `Page ${canvasPages.length + 1}` })
              }
            }} 
            sx={{ 
              display: 'flex', alignItems: 'center', py: 0.5, px: 1, borderRadius: 1.5, cursor: 'pointer', 
              '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' } 
            }}
          >
             <AddRoundedIcon sx={{ fontSize: 12, color: "rgb(var(--brand-fg-rgb) / 0.4)" }} />
             <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.4)", pl: 1 }}>Add Page</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: "100%",
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: "flex",
        flexDirection: "column",
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s",
      }}
    >
      <Box sx={{ px: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgb(var(--brand-fg-rgb) / 0.45)", textTransform: "uppercase" }}>
          AI Canvas
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List sx={{ px: 1, mb: 2 }}>
          {MENU_ITEMS.map((item) => {
            const active = canvasMode === item.id;
            return (
              <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => setCanvasMode(item.id)}
                  sx={{
                    borderRadius: 2,
                    bgcolor: active ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label} 
                    primaryTypographyProps={{ 
                      fontSize: 13, 
                      fontWeight: active ? 600 : 500,
                      color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)'
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {myProjects.length > 0 && (
          <Box sx={{ mb: 2, minWidth: 200, mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
                My Projects
              </Typography>
              <Tooltip title="Create Project" placement="top">
                <IconButton 
                  size="small" 
                  onClick={() => { setCreateProjectType('my'); setIsCreateDialogOpen(true); }}
                  sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }, width: 20, height: 20 }}
                >
                  <AddRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
            {myProjects.map(p => renderProjectWithPages(p, p.id === activeProjectId))}
          </Box>
        )}

        {teamProjects.length > 0 && (
          <Box sx={{ mb: 2, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
                Team Projects
              </Typography>
              <Tooltip title="Create Team Project" placement="top">
                <IconButton 
                  size="small" 
                  onClick={() => { setCreateProjectType('team'); setIsCreateDialogOpen(true); }}
                  sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }, width: 20, height: 20 }}
                >
                  <AddRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
            {teamProjects.map(p => renderProjectWithPages(p, p.id === activeProjectId))}
          </Box>
        )}
      </Box>

      {/* Create Project Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{
          sx: { bgcolor: "var(--brand-surface2)", color: "var(--brand-fg)", minWidth: 400, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1, fontSize: 16, fontWeight: 700 }}>
          <FolderRoundedIcon sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
          新規{createProjectType === 'team' ? 'チーム' : ''}プロジェクトを作成
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 2, fontSize: 13 }}>
            {createProjectType === 'team' 
              ? '共有のチームプロジェクトを作成します。チームメンバーを後から追加できます。' 
              : '個人用の新しいプロジェクトを作成します。'}
          </Typography>
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
            InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 14, borderRadius: 2 } }}
            InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgb(var(--brand-fg-rgb) / 0.1)" },
                "&:hover fieldset": { borderColor: "rgb(var(--brand-fg-rgb) / 0.2)" },
                "&.Mui-focused fieldset": { borderColor: '#90caf9' },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setIsCreateDialogOpen(false)} 
            disabled={isCreating}
            sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", '&:hover': { bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)" } }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleCreateProject}
            disabled={!newProjectName.trim() || isCreating}
            variant="contained"
            sx={{ 
              bgcolor: '#90caf9', color: '#000', fontWeight: 600,
              '&:hover': { bgcolor: '#90caf9' },
              '&.Mui-disabled': { bgcolor: 'rgba(144, 202, 249, 0.3)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }
            }}
          >
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Page Dialog */}
      <Dialog 
        open={!!pageToDelete} 
        onClose={() => setPageToDelete(null)}
        PaperProps={{
          sx: { bgcolor: "var(--brand-surface2)", color: "var(--brand-fg)", minWidth: 360, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1, fontSize: 16, fontWeight: 700 }}>
          <DeleteRoundedIcon sx={{ color: '#f44336' }} />
          ページを削除
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", fontSize: 13 }}>
            本当に「{pageToDelete?.name || 'このページ'}」を削除しますか？
            <br/>この操作は元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setPageToDelete(null)} 
            sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", '&:hover': { bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)" } }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={() => {
              const editor = (window as any).canvasEditor;
              if (editor && pageToDelete) {
                editor.deletePage(pageToDelete.id);
                setPageToDelete(null);
              }
            }}
            variant="contained"
            sx={{ 
              bgcolor: '#f44336', color: 'var(--brand-fg)', fontWeight: 600,
              '&:hover': { bgcolor: '#d32f2f' }
            }}
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
