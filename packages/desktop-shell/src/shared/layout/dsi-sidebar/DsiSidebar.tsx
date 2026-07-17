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
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
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
          bgcolor: active ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent",
          "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || "rgb(var(--brand-fg-rgb) / 0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1,
          flexShrink: 0
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" } })}
        </Box>
        <Typography sx={{
          color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)",
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
              color: "rgb(var(--brand-fg-rgb) / 0.5)", "&:hover": { color: "var(--brand-fg)" }
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
            PaperProps={{ sx: { bgcolor: "var(--brand-surface2)", color: "var(--brand-fg)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", borderRadius: 2 } }}
          >
            {onRenameClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(); }} sx={{ color: "var(--brand-fg)", fontSize: 13 }}>
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

// サブフォルダ集計（相対パス→直下件数）から、中間階層も補完したツリーノード一覧を作る。
interface FolderNode { path: string; name: string; depth: number; count: number; setCount: number; }
function buildFolderTree(map: Record<string, number> | undefined, setMap?: Record<string, number>): FolderNode[] {
  if (!map) return [];
  const paths = new Set<string>();
  for (const key of Object.keys(map)) {
    if (!key) continue; // ルート直下は除外（ソース行が担う）
    const parts = key.split('/');
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('/'));
  }
  const nodes: FolderNode[] = [];
  for (const p of paths) {
    // 集計件数 = そのフォルダ直下＋配下すべて（ファイル数／テクスチャは別途セット数も）。
    let count = 0;
    let setCount = 0;
    for (const [k, v] of Object.entries(map)) {
      if (k === p || k.startsWith(p + '/')) count += v;
    }
    if (setMap) {
      for (const [k, v] of Object.entries(setMap)) {
        if (k === p || k.startsWith(p + '/')) setCount += v;
      }
    }
    const parts = p.split('/');
    nodes.push({ path: p, name: parts[parts.length - 1], depth: parts.length - 1, count, setCount });
  }
  nodes.sort((a, b) => a.path.localeCompare(b.path));
  return nodes;
}

// テクスチャフォルダ（トップ階層が「テクスチャ」）は Base/Normal/Rough/AO の4枚で1セットのため、
// 件数はファイル数ではなくセット数で表示する。
function isTextureFolder(path: string): boolean {
  return path === 'テクスチャ' || path.startsWith('テクスチャ/');
}

// サブフォルダ1行（インデントで階層を表現）。子を持つフォルダは開閉トグル付き。
// 行本体クリック=絞り込み、シェブロンクリック=開閉。
function DsiSubfolderRow({ name, depth, count, setCount, isTexture, active, hasChildren, expanded, onSelect, onToggle }: {
  name: string; depth: number; count: number; setCount?: number; isTexture?: boolean; active: boolean;
  hasChildren: boolean; expanded: boolean; onSelect: () => void; onToggle: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', py: 0.4, borderRadius: 1.5,
        pl: `${6 + depth * 14}px`, pr: 0.75,
        bgcolor: active ? 'rgba(236,64,122,0.18)' : 'transparent',
        '&:hover': { bgcolor: active ? 'rgba(236,64,122,0.22)' : 'rgb(var(--brand-fg-rgb) / 0.05)' },
      }}
    >
      {/* 開閉シェブロン（子が無ければ空スペーサ） */}
      <Box
        onClick={hasChildren ? (e) => { e.stopPropagation(); onToggle(); } : undefined}
        sx={{
          width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: hasChildren ? 'pointer' : 'default', color: 'rgb(var(--brand-fg-rgb) / 0.5)',
          '&:hover': hasChildren ? { color: 'var(--brand-fg)' } : undefined,
        }}
      >
        {hasChildren && (expanded ? <ExpandMoreRoundedIcon sx={{ fontSize: 14 }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 14 }} />)}
      </Box>
      {/* 名前＋件数（クリックで絞り込み） */}
      <Box onClick={onSelect} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0, cursor: 'pointer' }}>
        {hasChildren && expanded
          ? <FolderOpenRoundedIcon sx={{ fontSize: 12, flexShrink: 0, color: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
          : <FolderRoundedIcon sx={{ fontSize: 12, flexShrink: 0, color: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)' }} />}
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: active ? 600 : 500, color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
          {name}
        </Typography>
        <Typography
          title={isTexture ? `${count} 枚` : undefined}
          sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', flexShrink: 0 }}
        >
          {isTexture ? `${setCount ?? 0} セット` : count}
        </Typography>
      </Box>
    </Box>
  );
}

// あるノードが見えるか（全ての祖先フォルダが展開済みか）を判定。キー = `${srcId}:${path}`。
function isFolderVisible(path: string, srcId: string, expanded: Set<string>): boolean {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) {
    if (!expanded.has(`${srcId}:${parts.slice(0, i).join('/')}`)) return false;
  }
  return true; // 直下（depth 0）は常に可視。
}

// ローカル参照ソース（複数フォルダ）の一覧・管理。「ローカル素材」スコープ選択時のみ表示。
function LocalSourceManager() {
  const sources = useImageSourcesStore(s => s.sources);
  const counts = useImageSourcesStore(s => s.counts);
  const subfolderCounts = useImageSourcesStore(s => s.subfolderCounts);
  const subfolderSetCounts = useImageSourcesStore(s => s.subfolderSetCounts);
  const sourceFilter = useImageSourcesStore(s => s.sourceFilter);
  const subfolderFilter = useImageSourcesStore(s => s.subfolderFilter);
  const setSourceFilter = useImageSourcesStore(s => s.setSourceFilter);
  const selectNode = useImageSourcesStore(s => s.selectNode);
  const refresh = useImageSourcesStore(s => s.refresh);
  const addSourceViaDialog = useImageSourcesStore(s => s.addSourceViaDialog);
  const removeSource = useImageSourcesStore(s => s.removeSource);
  const toggleSource = useImageSourcesStore(s => s.toggleSource);

  // 展開中フォルダ（キー = `${srcId}:${path}`）。既定は全て折りたたみ。
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (key: string) => setExpandedFolders(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Box sx={{ mx: 1.5, mt: 0.5, mb: 1, p: 1, borderRadius: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
          参照ソース
        </Typography>
        <Tooltip title="フォルダを追加" placement="top">
          <IconButton size="small" onClick={() => addSourceViaDialog()} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: ACCENT } }}>
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

      {sources.map(src => {
        const tree = buildFolderTree(subfolderCounts[src.id], subfolderSetCounts[src.id]);
        // 親パス集合（子を持つフォルダの判定用）。空文字=直下フォルダの親（=ソース）。
        const parentPaths = new Set(tree.map(n => n.path.split('/').slice(0, -1).join('/')));
        return (
          <React.Fragment key={src.id}>
            <SourceRow
              label={src.label}
              subtitle={src.builtin ? '既定' : src.path}
              count={counts[src.id] || 0}
              active={sourceFilter === src.id && !subfolderFilter}
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
            {/* サブフォルダのネスト表示（既定=Images 配下、追加ソース=そのフォルダ配下）。
                子を持つフォルダは開閉でき、折りたたまれた親の子孫は非表示。 */}
            {src.enabled && tree
              .filter(node => isFolderVisible(node.path, src.id, expandedFolders))
              .map(node => (
                <DsiSubfolderRow
                  key={node.path}
                  name={node.name}
                  depth={node.depth}
                  count={node.count}
                  setCount={node.setCount}
                  isTexture={isTextureFolder(node.path)}
                  active={sourceFilter === src.id && subfolderFilter === node.path}
                  hasChildren={parentPaths.has(node.path)}
                  expanded={expandedFolders.has(`${src.id}:${node.path}`)}
                  onSelect={() => selectNode(src.id, node.path)}
                  onToggle={() => toggleFolder(`${src.id}:${node.path}`)}
                />
              ))}
          </React.Fragment>
        );
      })}
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
        '&:hover': { bgcolor: active ? 'rgba(236,64,122,0.22)' : 'rgb(var(--brand-fg-rgb) / 0.05)' },
        '&:hover .src-actions': { opacity: 1 },
      }}
      onClick={onClick}
    >
      {/* 接続状態ドット */}
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: missing ? 'rgb(var(--brand-fg-rgb) / 0.25)' : '#2ecc71' }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 12, fontWeight: active ? 600 : 500, color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
          {label}
        </Typography>
        {subtitle && (
          <Typography noWrap sx={{ fontSize: 9.5, color: missing ? '#e0a030' : 'rgb(var(--brand-fg-rgb) / 0.35)', direction: 'rtl', textAlign: 'left' }}>
            {missing ? '未接続 · ' : ''}{subtitle}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)', flexShrink: 0 }}>{count}</Typography>
      <Box className="src-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}>
        {onToggle && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle(); }} sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
            {enabled ? <VisibilityRoundedIcon sx={{ fontSize: 14 }} /> : <VisibilityOffRoundedIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        )}
        {onRemove && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }} sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'light-dark(#ad0000, #ff6b6b)' } }}>
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
        bgcolor: BRAND.bg,
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
        {/* Search Input */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
          '&:focus-within': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mr: 1 }} />
          <InputBase
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: 'var(--brand-fg)', fontSize: 12, flex: 1 }}
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

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

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
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
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
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
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
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, minWidth: 400 } }}
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
            InputProps={{ style: { color: 'var(--brand-fg)' } }}
            InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#f48fb1' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      {activeRenameProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase
              fullWidth
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={isProcessing}
              sx={{ bgcolor: "light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))", color: "var(--brand-fg)", px: 2, py: 1, borderRadius: 2, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", mb: 3 }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveRenameProject(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: ACCENT, fontSize: 13, cursor: isProcessing || !renameValue.trim() ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
