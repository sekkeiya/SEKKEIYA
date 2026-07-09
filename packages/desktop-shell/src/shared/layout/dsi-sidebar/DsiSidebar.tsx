import React, { useState, useMemo } from 'react';
import { Box, Typography, CardActionArea, IconButton, InputBase, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Divider } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Menu, MenuItem } from '@mui/material';
import { useEffect } from 'react';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import { useAppStore, type DsiScope } from '../../../store/useAppStore';
import { useImageSourcesStore } from '../../../features/dsi/store/useImageSourcesStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ec407a';

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  onRenameClick?: () => void;
  onDeleteClick?: () => void;
}

function ScopeItem({ icon, label, active, onClick, color, onRenameClick, onDeleteClick }: ScopeItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || "rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1,
          flexShrink: 0
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? "#fff" : "rgba(255,255,255,0.7)" } })}
        </Box>
        <Typography sx={{
          color: active ? "#ffffff" : "rgba(255,255,255,0.7)",
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1
        }}>
          {label}
        </Typography>
      </CardActionArea>

      {(onRenameClick || onDeleteClick) && (
        <>
          <IconButton
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
            size="small"
            sx={{
              position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
              opacity: 0, transition: "opacity 0.2s",
              ".MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded='true']": { opacity: 1 },
              color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" }
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
            PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 } }}
          >
            {onRenameClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(); }} sx={{ color: "#fff", fontSize: 13 }}>
                名前を変更
              </MenuItem>
            )}
            {onDeleteClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDeleteClick(); }} sx={{ color: "#ff4d4f", fontSize: 13 }}>
                プロジェクトを削除
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </Box>
  );
}

// ローカル参照ソース（複数フォルダ）の一覧・管理。「ローカル素材」スコープ選択時のみ表示。
function LocalSourceManager() {
  const sources = useImageSourcesStore(s => s.sources);
  const counts = useImageSourcesStore(s => s.counts);
  const sourceFilter = useImageSourcesStore(s => s.sourceFilter);
  const setSourceFilter = useImageSourcesStore(s => s.setSourceFilter);
  const refresh = useImageSourcesStore(s => s.refresh);
  const addSourceViaDialog = useImageSourcesStore(s => s.addSourceViaDialog);
  const removeSource = useImageSourcesStore(s => s.removeSource);
  const toggleSource = useImageSourcesStore(s => s.toggleSource);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Box sx={{ mx: 1.5, mt: 0.5, mb: 1, p: 1, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
          参照ソース
        </Typography>
        <Tooltip title="フォルダを追加" placement="top">
          <IconButton size="small" onClick={() => addSourceViaDialog()} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: ACCENT } }}>
            <CreateNewFolderRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* すべて（全ソース横断） */}
      <SourceRow
        label="すべて"
        count={Object.values(counts).reduce((a, b) => a + b, 0)}
        active={sourceFilter === null}
        onClick={() => setSourceFilter(null)}
      />

      {sources.map(src => (
        <SourceRow
          key={src.id}
          label={src.label}
          subtitle={src.builtin ? '既定' : src.path}
          count={counts[src.id] || 0}
          active={sourceFilter === src.id}
          enabled={src.enabled}
          missing={!src.exists}
          onClick={() => setSourceFilter(src.id)}
          onToggle={() => toggleSource(src.id, !src.enabled)}
          onRemove={src.builtin ? undefined : () => {
            if (window.confirm(`「${src.label}」を参照リストから外しますか？\n（フォルダ内のファイルは削除されません）`)) {
              removeSource(src.id);
            }
          }}
        />
      ))}
    </Box>
  );
}

interface SourceRowProps {
  label: string;
  subtitle?: string;
  count: number;
  active: boolean;
  enabled?: boolean;
  missing?: boolean;
  onClick: () => void;
  onToggle?: () => void;
  onRemove?: () => void;
}

function SourceRow({ label, subtitle, count, active, enabled = true, missing = false, onClick, onToggle, onRemove }: SourceRowProps) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
        bgcolor: active ? 'rgba(236,64,122,0.18)' : 'transparent',
        opacity: enabled ? 1 : 0.45,
        '&:hover': { bgcolor: active ? 'rgba(236,64,122,0.22)' : 'rgba(255,255,255,0.05)' },
        '&:hover .src-actions': { opacity: 1 },
      }}
      onClick={onClick}
    >
      {/* 接続状態ドット */}
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: missing ? 'rgba(255,255,255,0.25)' : '#2ecc71' }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 12, fontWeight: active ? 600 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.8)' }}>
          {label}
        </Typography>
        {subtitle && (
          <Typography noWrap sx={{ fontSize: 9.5, color: missing ? '#e0a030' : 'rgba(255,255,255,0.35)', direction: 'rtl', textAlign: 'left' }}>
            {missing ? '未接続 · ' : ''}{subtitle}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{count}</Typography>
      <Box className="src-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}>
        {onToggle && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
            {enabled ? <VisibilityRoundedIcon sx={{ fontSize: 14 }} /> : <VisibilityOffRoundedIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        )}
        {onRemove && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ff6b6b' } }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

export const DsiSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    isProjectSidebarOpen,
    dsiScope,
    setDsiScope,
    setActiveWorkspaceId,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [activeRenameProject, setActiveRenameProject] = useState<any>(null);
  const [activeDeleteProject, setActiveDeleteProject] = useState<any>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRenameSubmit = async () => {
    if (!activeRenameProject || !renameValue.trim()) return;
    try {
      setIsProcessing(true);
      await renameProject(activeRenameProject.id, renameValue);
      setProjects(projects.map(p => p.id === activeRenameProject.id ? { ...p, name: renameValue.trim() } : p));
      setActiveRenameProject(null);
    } catch (e) {
      console.error("Failed to rename project:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!activeDeleteProject) return;
    try {
      setIsProcessing(true);
      await deleteProject(activeDeleteProject.id);
      setProjects(projects.filter(p => p.id !== activeDeleteProject.id));
      if (activeProjectId === activeDeleteProject.id) setActiveProjectId(null);
      setActiveDeleteProject(null);
    } catch (e) {
      console.error("Failed to delete project:", e);
    } finally {
      setIsProcessing(false);
    }
  };

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
      setProjects([newProject as any, ...projects]);

      setNewProjectName('');
      setIsCreateDialogOpen(false);

      setActiveProjectId(newProject.id);
      setDsiScope('project_images');
      setActiveWorkspaceId('image');

      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const { myProjects, teamProjects } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(p => !query || p.name?.toLowerCase().includes(query));

    return {
      myProjects: filtered.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: filtered.filter(p => p.ownerId !== currentUser?.uid || p.isTeam)
    };
  }, [projects, searchQuery, currentUser?.uid]);

  const handleScopeSelect = (scope: DsiScope) => {
    setDsiScope(scope);
    setActiveWorkspaceId('image');
    useAppStore.getState().setCurrentMainView('workspace');
    setActiveProjectId(null);
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDsiScope(isTeam ? 'team_project_images' : 'project_images');
    setActiveProjectId(projectId);
    setActiveWorkspaceId('image');
  };

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
      <Box sx={{ px: 2, mb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", mb: 1.5 }}>
          画像・動画管理 / S.Image
        </Typography>

        {/* Search Input */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgba(255,255,255,0.05)',
          '&:focus-within': { borderColor: 'rgba(255,255,255,0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 1 }} />
          <InputBase
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: '#fff', fontSize: 12, flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Global Scopes */}
        <Box>
          <ScopeItem
            icon={<LanguageRoundedIcon />}
            label="Image"
            active={dsiScope === 'global_images'}
            onClick={() => handleScopeSelect('global_images')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dsiScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
          <ScopeItem
            icon={<FolderSpecialRoundedIcon />}
            label="ローカル素材"
            active={dsiScope === 'local_assets'}
            onClick={() => handleScopeSelect('local_assets')}
            color="#ec407a"
          />
          {dsiScope === 'local_assets' && <LocalSourceManager />}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem
            icon={<PublicRoundedIcon />}
            label="Public Image"
            active={dsiScope === 'my_public_images'}
            onClick={() => handleScopeSelect('my_public_images')}
            color="#9b59b6"
          />
          <ScopeItem
            icon={<LockRoundedIcon />}
            label="Private Image"
            active={dsiScope === 'my_private_images'}
            onClick={() => handleScopeSelect('my_private_images')}
            color="#e67e22"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              My Projects
            </Typography>
          </Box>
          {myProjects.map(p => (
            <ScopeItem
              key={p.id}
              icon={<PhotoLibraryRoundedIcon />}
              label={p.name}
              active={p.id === activeProjectId && dsiScope === 'project_images'}
              onClick={() => handleProjectSelect(p.id, false)}
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
            />
          ))}
        </Box>

        {/* Team Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              Team Projects
            </Typography>
          </Box>
          {teamProjects.map(p => (
            <ScopeItem
              key={p.id}
              icon={<PhotoLibraryRoundedIcon />}
              label={p.name}
              active={p.id === activeProjectId && dsiScope === 'team_project_images'}
              onClick={() => handleProjectSelect(p.id, true)}
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
            />
          ))}
        </Box>

      </Box>

      {/* Create Project Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: `1px solid rgba(255,255,255,0.1)`, minWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {createProjectType === 'my' ? '新規マイプロジェクト作成' : '新規チームプロジェクト作成'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {createProjectType === 'my'
              ? '個人用の新しいプロジェクトを作成します。'
              : 'チームのメンバーと共有するための新しいプロジェクトを作成します。'}
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
            InputProps={{ style: { color: '#fff' } }}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: '#f48fb1' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      {activeRenameProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase
              fullWidth
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={isProcessing}
              sx={{ bgcolor: "rgba(0,0,0,0.2)", color: "#fff", px: 2, py: 1, borderRadius: 2, border: "1px solid rgba(255,255,255,0.1)", mb: 3 }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveRenameProject(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: ACCENT, fontSize: 13, cursor: isProcessing || !renameValue.trim() ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
