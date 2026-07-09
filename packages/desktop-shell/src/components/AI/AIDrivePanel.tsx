import React, { useState } from 'react';
import { Box, Typography, TextField, IconButton, Chip, Paper, Avatar, Button, Menu, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import { BRAND } from '../../styles/theme';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { useAppStore } from '../../store/useAppStore';
import { useAIDriveStore, resolveAssetPreviewUrl } from '../../store/useAIDriveStore';
import { auth } from '../../lib/firebase/client';
import { useAIDriveDragStore } from '../../store/useAIDriveDragStore';
import { createPortal } from 'react-dom';

const GlobalDragOverlay = () => {
  const { isDragging, draggingAsset, pointerPosition, updateDrag, endDrag } = useAIDriveDragStore();

  React.useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      updateDrag(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      // Find what we dropped on
      // We temporarily hide the drag ghost so elementFromPoint works correctly
      const ghost = document.getElementById('ai-drive-drag-ghost');
      if (ghost) ghost.style.pointerEvents = 'none';

      const el = document.elementFromPoint(e.clientX, e.clientY);
      let targetInfo = undefined;

      // Walk up the tree to find data-drop-target
      let current = el;
      while (current) {
        if (current.getAttribute && current.getAttribute('data-drop-target')) {
          targetInfo = current.getAttribute('data-drop-target') || undefined;
          break;
        }
        current = current.parentElement;
      }

      endDrag(e.clientX, e.clientY, targetInfo);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, updateDrag, endDrag]);

  if (!isDragging || !draggingAsset || !pointerPosition) return null;

  return createPortal(
    <Box
      id="ai-drive-drag-ghost"
      sx={{
        position: 'fixed',
        left: pointerPosition.x,
        top: pointerPosition.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        pl: 1.5,
        pr: 2,
        bgcolor: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid #00BFFF',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        color: '#fff',
      }}
    >
      {getFileIcon(draggingAsset.type)}
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{draggingAsset.name}</Typography>
    </Box>,
    document.body
  );
};

const quickFilters = [
  { id: 'recent', label: '最近使った' },
  { id: 'favorites', label: 'お気に入り' },
  { id: 'in_project', label: 'プロジェクト内' },
  { id: 'all', label: '全て' },
  { id: 'document', label: 'ドキュメント' },
  { id: 'image', label: '画像' },
  { id: 'model', label: 'モデル' },
  { id: 'pdf', label: 'PDF' }
];
const getFileIcon = (type: string) => {
  switch (type) {
    case 'image': return <ImageRoundedIcon sx={{ color: '#E1BEE7', fontSize: 32 }} />;
    case 'model': return <ViewInArRoundedIcon sx={{ color: '#81D4FA', fontSize: 32 }} />;
    case 'pdf': return <PictureAsPdfRoundedIcon sx={{ color: '#FFCDD2', fontSize: 32 }} />;
    default: return <InsertDriveFileRoundedIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 32 }} />;
  }
};

const AIDrivePanel: React.FC = () => {
  const { setAIDriveExpanded, setAIDriveOpen, activeProjectId, projects } = useAppStore();
  const { assets, activeScope, setActiveScope, subscribeToAssets } = useAIDriveStore();
  const [activeFilter, setActiveFilter] = useState('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const currentUser = auth.currentUser;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleScopeSelect = (scope: string) => {
    setActiveScope(scope);
    handleMenuClose();
  };

  const getScopeLabel = () => {
    if (activeScope === 'all') return 'すべてのデータ';
    if (activeScope === 'current_project') return '現在のプロジェクト';
    if (activeScope === 'my_library') return 'マイライブラリ';
    if (activeScope === 'team_library') return 'チームライブラリ';
    if (activeScope.startsWith('project_')) {
      const pId = activeScope.split('project_')[1];
      const p = projects.find(proj => proj.id === pId);
      return p ? p.name : 'Unknown Project';
    }
    return 'AI Drive';
  };

  // Default to the current project scope when opening the AI Drive Panel
  React.useEffect(() => {
    if (activeProjectId) {
      setActiveScope(`project_${activeProjectId}`);
    } else {
      setActiveScope('all');
    }
  }, []); // Only run once on mount

  React.useEffect(() => {
    subscribeToAssets(activeProjectId, currentUser?.uid || null, projects);
  }, [activeScope, activeProjectId, currentUser, projects, subscribeToAssets]);

  return (
    <>
      <GlobalDragOverlay />
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,24,32,0.95)', backdropFilter: 'blur(32px)' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, minHeight: 56, gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={handleMenuClick}
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              color: '#fff', 
              textTransform: 'none', 
              p: 0.5,
              px: 1,
              minWidth: 0,
              maxWidth: '100%',
              borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } 
            }}
          >
            <AutoAwesomeRoundedIcon sx={{ color: '#00BFFF', fontSize: 20, mr: 1, flexShrink: 0 }} />
            <Typography noWrap sx={{ fontWeight: 800, fontSize: 14 }}>
              {getScopeLabel()}
            </Typography>
            <KeyboardArrowDownRoundedIcon sx={{ ml: 0.5, fontSize: 18, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleMenuClose}
            PaperProps={{
              sx: {
                bgcolor: '#1E1E24',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.08)',
                minWidth: 200,
                mt: 1
              }
            }}
          >
            <MenuItem onClick={() => handleScopeSelect('all')} selected={activeScope === 'all'}>
              <ListItemIcon><InboxRoundedIcon sx={{ color: 'rgba(255,255,255,0.5)' }} fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13 }}>すべてのデータ</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleScopeSelect('current_project')} selected={activeScope === 'current_project'}>
              <ListItemIcon><FolderSpecialRoundedIcon sx={{ color: 'rgba(255,255,255,0.5)' }} fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13 }}>現在のプロジェクト</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleScopeSelect('my_library')} selected={activeScope === 'my_library'}>
              <ListItemIcon><FolderRoundedIcon sx={{ color: 'rgba(255,255,255,0.5)' }} fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13 }}>マイライブラリ</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleScopeSelect('team_library')} selected={activeScope === 'team_library'}>
              <ListItemIcon><PublicRoundedIcon sx={{ color: 'rgba(255,255,255,0.5)' }} fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13 }}>チームライブラリ</ListItemText>
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />
            <Box sx={{ px: 2, py: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>プロジェクト</Typography>
            </Box>
            {projects.map(p => (
              <MenuItem key={p.id} onClick={() => handleScopeSelect(`project_${p.id}`)} selected={activeScope === `project_${p.id}`}>
                <ListItemIcon><FolderRoundedIcon sx={{ color: activeScope === `project_${p.id}` ? '#00BFFF' : 'rgba(255,255,255,0.5)' }} fontSize="small" /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: 13, color: activeScope === `project_${p.id}` ? '#00BFFF' : 'inherit' }}>{p.name}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
            <SortRoundedIcon fontSize="small" />
          </IconButton>
          <Box sx={{ width: 1, height: 16, bgcolor: BRAND.line, mx: 0.5 }} />
          <IconButton 
            size="small" 
            onClick={() => setViewMode('list')}
            sx={{ color: viewMode === 'list' ? '#00BFFF' : 'rgba(255,255,255,0.4)', bgcolor: viewMode === 'list' ? 'rgba(0,191,255,0.1)' : 'transparent' }}
          >
            <ViewListRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setViewMode('grid')}
            sx={{ color: viewMode === 'grid' ? '#00BFFF' : 'rgba(255,255,255,0.4)', bgcolor: viewMode === 'grid' ? 'rgba(0,191,255,0.1)' : 'transparent' }}
          >
            <AppsRoundedIcon fontSize="small" />
          </IconButton>
          <Box sx={{ width: 1, height: 16, bgcolor: BRAND.line, mx: 0.5 }} />
          <IconButton 
            size="small" 
            onClick={() => setAIDriveExpanded(true)}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <OpenInFullRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setAIDriveOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Toolbar Area (Search & Filters) */}
        <Box sx={{ p: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Search */}
          <Box sx={{ 
            display: 'flex', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 3, px: 2, py: 1.5, 
            border: `1px solid rgba(255,255,255,0.08)`, transition: 'all 0.2s',
            '&:focus-within': { borderColor: '#00BFFF', boxShadow: '0 0 0 1px #00BFFF', bgcolor: 'rgba(0,0,0,0.6)' } 
          }}>
            <SearchRoundedIcon sx={{ color: 'rgba(255,255,255,0.4)', mr: 1.5, fontSize: 20 }} />
            <TextField 
              placeholder="AI Drive のファイル、モデル、プロジェクトを検索..."
              variant="standard"
              fullWidth
              InputProps={{ disableUnderline: true, sx: { color: '#fff', fontSize: '14px' } }}
            />
          </Box>

          {/* Quick Filters */}
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {quickFilters.map((f) => (
              <Chip 
                key={f.id} 
                label={f.label} 
                onClick={() => setActiveFilter(f.id)}
                sx={{
                  height: 32, 
                  px: 0.5,
                  bgcolor: activeFilter === f.id ? 'rgba(0,191,255,0.15)' : 'rgba(255,255,255,0.05)', 
                  color: activeFilter === f.id ? '#00BFFF' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${activeFilter === f.id ? 'rgba(0,191,255,0.3)' : 'transparent'}`, 
                  fontWeight: activeFilter === f.id ? 600 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  "&:hover": { bgcolor: activeFilter === f.id ? 'rgba(0,191,255,0.2)' : 'rgba(255,255,255,0.1)', color: '#fff' }
                }} 
              />
            ))}
          </Box>
        </Box>

        {/* Content Area */}
        <Box sx={{ px: 3, pb: 3, flexGrow: 1, overflowY: 'auto' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, mb: 2 }}>ファイル</Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(140px, 1fr))' : '1fr', gap: 2 }}>
            {assets.map(asset => (
              <Paper 
                key={asset.id}
                data-debug-component="ActualAIDriveCard"
                onPointerDown={(e) => {
                  console.log('[ActualAIDriveCard] pointer down, starting drag for:', asset.name);
                  // Prevent starting internal drag if clicking the HTML5 drag handle
                  if ((e.target as HTMLElement).closest('.html5-drag-handle')) return;
                  
                  // Left click only
                  if (e.button !== 0) return;
                  e.preventDefault();
                  useAIDriveDragStore.getState().startDrag(asset, [asset], e.clientX, e.clientY, e.altKey || e.metaKey);
                }}
                sx={{ 
                  p: viewMode === 'grid' ? 2 : 1.5, 
                  bgcolor: 'rgba(255,255,255,0.02)', 
                  border: `1px solid rgba(255,255,255,0.08)`, 
                  borderRadius: 3,
                  cursor: 'grab',
                  position: 'relative',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: viewMode === 'grid' ? 'column' : 'row',
                  alignItems: viewMode === 'grid' ? 'flex-start' : 'center',
                  gap: viewMode === 'grid' ? 1.5 : 2,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    transform: viewMode === 'grid' ? 'translateY(-2px)' : 'none'
                  },
                  '&:active': {
                    cursor: 'grabbing'
                  }
                }}
              >
                <Box sx={{ 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', 
                  width: viewMode === 'grid' ? '100%' : 48,
                  height: viewMode === 'grid' ? 100 : 48, 
                  bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2,
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative'
                }}>
                  {(() => {
                    const previewUrl = resolveAssetPreviewUrl(asset);
                    return previewUrl ? (
                      <img src={previewUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getFileIcon(asset.type)
                    );
                  })()}
                  
                  {/* HTML5 Drag Handle for External Apps (Rhino) */}
                  <Box
                    className="html5-drag-handle"
                    draggable={true}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      const url = asset.storageUrl || asset.thumbnailUrl;
                      if (url) {
                        const ext = url.split('?')[0].split('.').pop() || 'png';
                        const mime = asset.type === 'image' ? 'image/png' : asset.type === 'model' ? 'model/gltf-binary' : 'application/octet-stream';
                        e.dataTransfer.setData('DownloadURL', `${mime}:${asset.name || 'asset'}.${ext}:${url}`);
                      }
                    }}
                    sx={{
                      position: 'absolute', top: 4, left: 4,
                      width: 24, height: 24, borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'grab', backdropFilter: 'blur(4px)',
                      opacity: 0, transition: 'opacity 0.2s',
                      '.MuiPaper-root:hover &': { opacity: 1 },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                    }}
                    title="外部アプリ（Rhino等）へドラッグして配置"
                  >
                    <InsertDriveFileRoundedIcon sx={{ fontSize: 14, color: '#fff' }} />
                  </Box>
                </Box>
                
                <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: viewMode === 'grid' ? 'column' : 'row', alignItems: viewMode === 'grid' ? 'flex-start' : 'center', gap: viewMode === 'grid' ? 0.5 : 2, width: '100%' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                    <Typography noWrap sx={{ color: '#fff', fontSize: '0.875rem', fontWeight: 600, mb: 0.5, display: 'block', width: '100%' }}>
                      {asset.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography noWrap sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', display: 'block', width: '100%' }}>
                        {asset.updatedAt || asset.createdAt ? new Date(asset.updatedAt || asset.createdAt || 0).toLocaleDateString() : ''} に更新
                      </Typography>
                    </Box>
                  </Box>
                  
                  {viewMode === 'list' && (
                    <>
                      <Typography noWrap sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', width: 60, flexShrink: 0 }}>
                        {asset.size ? `${(Number(asset.size) / 1024 / 1024).toFixed(1)}MB` : '-'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 120, minWidth: 0, flexShrink: 0 }}>
                        <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: 'primary.main' }}>
                          {asset.ownerId ? asset.ownerId.charAt(0).toUpperCase() : 'U'}
                        </Avatar>
                        <Typography noWrap sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', minWidth: 0 }}>
                          {asset.ownerId || 'Unknown'}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
    </>
  );
};

export default AIDrivePanel;
