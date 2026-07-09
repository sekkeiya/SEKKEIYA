import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, IconButton, Chip, Paper, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Slider, Button, Menu, MenuItem, CircularProgress } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAIDriveStore } from '../../store/useAIDriveStore';
import { auth, functions } from '../../lib/firebase/client';
import { httpsCallable } from 'firebase/functions';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIDriveDragStore } from '../../store/useAIDriveDragStore';
import { AIDriveDeleteConfirmDialog } from './AIDriveDeleteConfirmDialog';

// Icons for Left Sidebar
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

// Icons for Topbar
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

// Icons for Center Gallery / File Types
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

// Inspector Icons
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';

// Mock color palette colors for inspector
const mockPalette = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA', '#E0E0E0', '#424242'];

const getFileIcon = (type: string) => {
  switch (type) {
    case 'image': return <ImageRoundedIcon sx={{ color: '#E1BEE7', fontSize: 48 }} />;
    case 'model': return <ViewInArRoundedIcon sx={{ color: '#81D4FA', fontSize: 48 }} />;
    case 'pdf': return <PictureAsPdfRoundedIcon sx={{ color: '#FFCDD2', fontSize: 48 }} />;
    default: return <InsertDriveFileRoundedIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 48 }} />;
  }
};

const SidebarNavItem: React.FC<{ icon: React.ReactNode, label: string, count?: number, active?: boolean }> = ({ icon, label, count, active }) => (
  <ListItem disablePadding sx={{ mb: 0.5 }}>
    <ListItemButton 
      sx={{ 
        py: 0.5, px: 2, borderRadius: 1.5, mx: 1,
        bgcolor: active ? 'rgba(0,191,255,0.15)' : 'transparent',
        '&:hover': { bgcolor: active ? 'rgba(0,191,255,0.2)' : 'rgba(255,255,255,0.05)' }
      }}
    >
      <ListItemIcon sx={{ minWidth: 32, color: active ? '#00BFFF' : 'rgba(255,255,255,0.6)', '& svg': { fontSize: 18 } }}>
        {icon}
      </ListItemIcon>
      <ListItemText 
        primary={label} 
        primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? '#00BFFF' : 'rgba(255,255,255,0.8)' }} 
      />
      {count !== undefined && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          {count}
        </Typography>
      )}
    </ListItemButton>
  </ListItem>
);

const FolderItem: React.FC<{ label: string, count?: number, depth?: number, hasChildren?: boolean, active?: boolean, onClick?: () => void, projectId?: string }> = ({ label, count, depth = 0, hasChildren, active, onClick, projectId }) => (
  <ListItem disablePadding sx={{ mb: 0.5 }} data-folder-project-id={projectId}>
    <ListItemButton 
      onClick={onClick}
      sx={{ 
        py: 0.25, pr: 2, pl: 2 + depth * 1.5, borderRadius: 1.5, mx: 1,
        bgcolor: active ? 'rgba(0,191,255,0.15)' : 'transparent',
        '&:hover': { bgcolor: active ? 'rgba(0,191,255,0.2)' : 'rgba(255,255,255,0.05)' }
      }}
    >
      <ListItemIcon sx={{ minWidth: 24, color: active ? '#00BFFF' : 'rgba(255,255,255,0.4)', '& svg': { fontSize: 16 } }}>
        {hasChildren ? <KeyboardArrowDownRoundedIcon /> : <ChevronRightRoundedIcon opacity={0}/>}
      </ListItemIcon>
      <ListItemIcon sx={{ minWidth: 28, color: active ? '#00BFFF' : 'rgba(255,255,255,0.6)', '& svg': { fontSize: 18 } }}>
        <FolderRoundedIcon />
      </ListItemIcon>
      <ListItemText 
        primary={label} 
        primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? '#00BFFF' : 'rgba(255,255,255,0.8)' }} 
      />
      {count !== undefined && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          {count}
        </Typography>
      )}
    </ListItemButton>
  </ListItem>
);

const SemanticTagChip: React.FC<{ tag: string, onDelete?: () => void, size?: 'tiny' | 'small' | 'medium' }> = ({ tag, onDelete, size = 'small' }) => {
  const isAITag = tag.startsWith('AI:');
  const isRuleTag = tag.startsWith('Rule:');
  
  let label = tag;
  let icon = undefined;
  let colorTheme = { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.1)' };
  
  if (isAITag) {
    label = tag.replace('AI: ', '').replace('AI:', '');
    icon = <AutoAwesomeRoundedIcon sx={{ fontSize: size === 'tiny' ? 10 : size === 'small' ? 12 : 14 }} />;
    colorTheme = { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)', border: 'rgba(0,191,255,0.3)' };
  } else if (isRuleTag) {
    label = tag.replace('Rule: ', '').replace('Rule:', '');
    icon = <SettingsRoundedIcon sx={{ fontSize: size === 'tiny' ? 10 : size === 'small' ? 12 : 14 }} />;
    colorTheme = { color: '#FF9800', bgcolor: 'rgba(255,152,0,0.1)', border: 'rgba(255,152,0,0.3)' };
  } else {
    // User tag might have User: prefix or no prefix
    label = tag.replace('User: ', '').replace('User:', '');
  }

  return (
    <Chip 
      label={label}
      size={size === 'tiny' ? 'small' : size}
      icon={icon}
      onDelete={onDelete}
      sx={{ 
        height: size === 'tiny' ? 20 : undefined,
        bgcolor: colorTheme.bgcolor, 
        color: colorTheme.color, 
        fontSize: size === 'tiny' ? 9 : size === 'small' ? 11 : 12, 
        fontWeight: 600,
        border: `1px solid ${colorTheme.border}`,
        px: size === 'tiny' ? 0 : undefined,
        '& .MuiChip-label': { px: size === 'tiny' ? 1 : undefined },
        '& .MuiChip-deleteIcon': { 
          color: colorTheme.color, opacity: 0.5, 
          fontSize: size === 'tiny' ? 12 : size === 'small' ? 14 : 16, 
          '&:hover': { color: colorTheme.color, opacity: 1 } 
        },
        '& .MuiChip-icon': { color: colorTheme.color }
      }}
    />
  );
};

interface AIDriveFullScreenProps {
  isPickerMode?: boolean;
  onPickAsset?: (asset: any) => void;
  onClosePicker?: () => void;
}

const AIDriveFullScreen: React.FC<AIDriveFullScreenProps> = ({ isPickerMode, onPickAsset, onClosePicker }) => {
  const { setAIDriveExpanded, activeProjectId, projects } = useAppStore();
  const { assets, selectedAssetIds, setSelectedAssetIds, activeScope, setActiveScope, subscribeToAssets, updateAsset, deleteAsset, moveOrCopyAssets, uploadImageToDrive } = useAIDriveStore();
  const { isDragging, startDrag, updateDrag, endDrag, pointerPosition, draggingAssets, pendingDropAsset, consumeDropAsset, isCopyMode } = useAIDriveDragStore();
  
  // UI States
  const [densityKey, setDensityKey] = useState<'compact' | 'default' | 'large'>('default');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  
  // AI System States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isAITagging, setIsAITagging] = useState(false);
  const [analyzingAssetId, setAnalyzingAssetId] = useState<string | null>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const currentUser = auth.currentUser;

  // Handle Drag Drops
  useEffect(() => {
    if (pendingDropAsset && pendingDropAsset.target.startsWith('project_')) {
      const targetProjectId = pendingDropAsset.target.split('project_')[1];
      const assetIds = pendingDropAsset.assets.map(a => a.id);
      
      moveOrCopyAssets(assetIds, targetProjectId, pendingDropAsset.isCopy);
      consumeDropAsset();
    }
  }, [pendingDropAsset, moveOrCopyAssets, consumeDropAsset]);

  // Global Pointer Events for Dragging
  useEffect(() => {
    if (!isDragging) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      updateDrag(e.clientX, e.clientY, e.altKey || e.metaKey);
    };
    const handlePointerUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const folderEl = el?.closest('[data-folder-project-id]');
      let targetInfo;
      if (folderEl) {
        targetInfo = `project_${folderEl.getAttribute('data-folder-project-id')}`;
      }
      endDrag(e.clientX, e.clientY, targetInfo);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, updateDrag, endDrag]);

  // Default to the current project scope when opening the AI Drive
  useEffect(() => {
    if (activeProjectId) {
      setActiveScope(`project_${activeProjectId}`);
    } else {
      setActiveScope('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    subscribeToAssets(activeProjectId, currentUser?.uid || null, projects);
  }, [activeScope, activeProjectId, currentUser, projects, subscribeToAssets]);

  useEffect(() => {
    setSelectedAssetIds([]);
    setLastSelectedId(null);
  }, [activeScope, activeTags, searchQuery, setSelectedAssetIds]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAssetIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        // Prevent deleting 3D models per user request
        const hasDeletableAssets = selectedAssetIds.some(id => {
          const asset = assets.find(a => a.id === id);
          return asset && asset.type !== '3d-model' && asset.type !== 'model';
        });
        
        if (hasDeletableAssets) {
          setDeleteDialogOpen(true);
        }
      }
      
      if (e.key === 'Escape') {
        if (expandedAssetId) {
          setExpandedAssetId(null);
        } else if (selectedAssetIds.length > 0) {
          setSelectedAssetIds([]);
          setLastSelectedId(null);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAssetIds, assets, deleteAsset, expandedAssetId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    const projectId = activeScope.startsWith('project_') ? activeScope.split('project_')[1] : null;
    setIsUploading(true);
    try {
      await uploadImageToDrive(files, projectId);
    } catch (err) {
      console.error('[AI Drive] Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsFileDragOver(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsFileDragOver(false);
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsFileDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    const projectId = activeScope.startsWith('project_') ? activeScope.split('project_')[1] : null;
    setIsUploading(true);
    try {
      await uploadImageToDrive(files, projectId);
    } catch (err) {
      console.error('[AI Drive] Drop upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Total counts for active scope
  const totalCount = assets.length;

  const filteredAssets = React.useMemo(() => {
    return assets.filter(a => {
      const matchesQuery = !searchQuery || 
        (a.name && a.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.memo && a.memo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.type && a.type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        
      if (!matchesQuery) return false;
      
      if (activeTags.length > 0) {
        return activeTags.every(filterTag => {
          if (filterTag === '種類: 3Dモデル' || filterTag === 'Type: 3D Model') return a.type === 'model' || a.type === '3d-model';
          if (filterTag === '種類: 画像' || filterTag === 'Type: Image') return a.type === 'image' || a.type === 'screenshot' || a.type === 'cover';
          if (filterTag === 'Date: 本日追加') return a.createdAt && (Date.now() - a.createdAt) < 86400000;
          if (filterTag === 'Color: Dark') return true; // Mock color filter logic mapped to true for demo
          if (a.tags) return a.tags.includes(filterTag);
          return false;
        });
      }
      
      return true;
    });
  }, [assets, searchQuery, activeTags]);

  const handleAssetClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isPickerMode && onPickAsset) {
      const asset = assets.find(a => a.id === id);
      if (asset) onPickAsset(asset);
      return;
    }
    
    if (e.shiftKey && lastSelectedId) {
      // Range selection
      const currentIndex = filteredAssets.findIndex(a => a.id === id);
      const lastIndex = filteredAssets.findIndex(a => a.id === lastSelectedId);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeIds = filteredAssets.slice(start, end + 1).map(a => a.id);
        
        // Union with current selection (or replace). Standard file explorers replace if ctrl is not held
        // We will just do union for simplicity unless explicit UX overrides it
        const newSelection = new Set([...selectedAssetIds, ...rangeIds]);
        setSelectedAssetIds(Array.from(newSelection));
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single
      if (selectedAssetIds.includes(id)) {
        setSelectedAssetIds(selectedAssetIds.filter(selId => selId !== id));
      } else {
        setSelectedAssetIds([...selectedAssetIds, id]);
      }
      setLastSelectedId(id);
    } else {
      // Single select
      setSelectedAssetIds([id]);
      setLastSelectedId(id);
    }
  };

  const selectedAsset = assets.find(a => selectedAssetIds.includes(a.id));

  const handleUpdateSelectedAsset = (updates: Partial<NonNullable<typeof selectedAsset>>) => {
    if (selectedAsset && selectedAsset.projectId) {
      updateAsset(selectedAsset.id, selectedAsset.projectId, updates);
    }
  };

  const applyTagToAssets = async (assetIds: string[], tag: string) => {
    for (const id of assetIds) {
      const a = assets.find(a => a.id === id);
      if (!a) continue;
      const newTags = [...new Set([...(a.tags || []), tag])];
      await updateAsset(id, a.projectId || '', { tags: newTags });
    }
  };

  const assignFolderToAssets = async (assetIds: string[], folderId: string) => {
    console.log(`[Mock] Assigned folder ${folderId} to assets:`, assetIds);
    // Expand with actual folder linking later
  };

  const handleAssetDoubleClick = (id: string) => {
    setExpandedAssetId(id);
  };

  const expandedAsset = assets.find(a => a.id === expandedAssetId);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'row', bgcolor: '#141518', position: 'relative', color: '#fff' }}>
      
      {/* 1. LEFT SIDEBAR */}
      <Box sx={{ 
        width: 240, flexShrink: 0, bgcolor: '#1B1C20', borderRight: '1px solid rgba(255,255,255,0.06)', 
        display: 'flex', flexDirection: 'column', height: '100%' 
      }}>
        {/* Brand / Close Header */}
        <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AutoAwesomeRoundedIcon sx={{ color: '#00BFFF', fontSize: 24 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 15 }}>AI Drive</Typography>
          </Box>
          <IconButton onClick={() => isPickerMode && onClosePicker ? onClosePicker() : setAIDriveExpanded(false)} size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Global Navigation */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', pb: 4, pt: 1 }}>
          <List disablePadding>
            <Box onClick={() => setActiveScope('all')}>
              <SidebarNavItem icon={<InboxRoundedIcon />} label="すべてのデータ" count={activeScope === 'all' ? totalCount : undefined} active={activeScope === 'all'} />
            </Box>
            <Box onClick={() => setActiveScope('unorganized')}>
              <SidebarNavItem icon={<ErrorOutlineRoundedIcon />} label="未整理" count={activeScope === 'unorganized' ? totalCount : undefined} active={activeScope === 'unorganized'} />
            </Box>
            <Box onClick={() => setActiveScope('my_library')}>
              <SidebarNavItem icon={<FolderRoundedIcon />} label="マイライブラリ" count={activeScope === 'my_library' ? totalCount : undefined} active={activeScope === 'my_library'} />
            </Box>
            <Box onClick={() => setActiveScope('team_library')}>
              <SidebarNavItem icon={<PublicRoundedIcon />} label="チームライブラリ" count={activeScope === 'team_library' ? totalCount : undefined} active={activeScope === 'team_library'} />
            </Box>
            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)', mx: 2 }} />
            <Box onClick={() => setActiveScope('trash')}>
              <SidebarNavItem icon={<DeleteRoundedIcon />} label="ゴミ箱" count={activeScope === 'trash' ? totalCount : undefined} active={activeScope === 'trash'} />
            </Box>
          </List>

          <Box sx={{ mt: 3, px: 2, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>プロジェクト</Typography>
            <AddRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', '&:hover': { color: '#fff' } }} />
          </Box>
          
          <List disablePadding>
            {projects.map(p => (
              <FolderItem 
                key={p.id} 
                label={p.name} 
                projectId={p.id}
                active={activeScope === `project_${p.id}`}
                onClick={() => setActiveScope(`project_${p.id}`)}
              />
            ))}
          </List>
        </Box>
      </Box>

      {/* 2. CENTER GALLERY */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        
        {/* Topbar Toolbar */}
        <Box sx={{ 
          flexShrink: 0, 
          borderBottom: '1px solid rgba(255,255,255,0.06)', 
          display: 'flex', 
          flexDirection: 'column', 
          px: 4, 
          py: 2,
          gap: 2
        }}>
          {/* Row 1: Title, Search, View Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, minWidth: 180, display: 'flex', alignItems: 'center' }}>
              {activeScope === 'all' ? 'すべてのデータ' :
               activeScope === 'unorganized' ? '未整理' :
               activeScope === 'my_library' ? 'マイライブラリ' : 
               activeScope === 'team_library' ? 'チームライブラリ' : 
               activeScope === 'trash' ? 'ゴミ箱' : 
               activeScope.startsWith('project_') ? projects.find(p => p.id === activeScope.split('_')[1])?.name || 'プロジェクト' :
               'すべてのプロジェクト'}
               <Typography component="span" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', ml: 1.5, fontWeight: 500, bgcolor: 'rgba(255,255,255,0.05)', px: 1, py: 0.25, borderRadius: 1 }}>{totalCount}</Typography>
            </Typography>

            {/* AI Smart Search Bar */}
            <Box sx={{ 
              flexGrow: 1, display: 'flex', alignItems: 'center', 
              bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, px: 2, py: 0.75, 
              border: `1px solid rgba(0,191,255,0.15)`,
              transition: 'all 0.2s',
              '&:focus-within': {
                bgcolor: 'rgba(0,191,255,0.05)',
                borderColor: '#00BFFF',
                boxShadow: '0 0 0 3px rgba(0,191,255,0.15)'
              }
            }}>
              <SearchRoundedIcon sx={{ color: '#00BFFF', mr: 1, fontSize: 18 }} />
              <TextField 
                placeholder="AI Drive内を検索... (例: 木材の家具、タグが無いアイテム)"
                variant="standard"
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{ disableUnderline: true, sx: { color: '#fff', fontSize: '14px', fontWeight: 500 } }}
              />
              <AutoFixHighRoundedIcon sx={{ color: 'rgba(255,255,255,0.3)', ml: 1, fontSize: 18 }} />
            </Box>

            {/* Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
               <Box sx={{ display: 'flex', alignItems: 'center', mx: 1 }}>
                 <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', mr: 1, letterSpacing: '0.05em' }}>Density</Typography>
                 <Box sx={{ display: 'flex', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, p: 0.5, border: '1px solid rgba(255,255,255,0.05)' }}>
                   <Button size="small" onClick={() => setDensityKey('compact')} sx={{ minWidth: 0, px: 1.5, py: 0.25, fontSize: '0.7rem', fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: densityKey === 'compact' ? '#fff' : 'rgba(255,255,255,0.4)', bgcolor: densityKey === 'compact' ? '#00BFFF' : 'transparent', '&:hover': { bgcolor: densityKey === 'compact' ? '#00BFFF' : 'rgba(255,255,255,0.05)' }}}>Compact</Button>
                   <Button size="small" onClick={() => setDensityKey('default')} sx={{ minWidth: 0, px: 1.5, py: 0.25, fontSize: '0.7rem', fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: densityKey === 'default' ? '#fff' : 'rgba(255,255,255,0.4)', bgcolor: densityKey === 'default' ? '#00BFFF' : 'transparent', '&:hover': { bgcolor: densityKey === 'default' ? '#00BFFF' : 'rgba(255,255,255,0.05)' }}}>Default</Button>
                   <Button size="small" onClick={() => setDensityKey('large')} sx={{ minWidth: 0, px: 1.5, py: 0.25, fontSize: '0.7rem', fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: densityKey === 'large' ? '#fff' : 'rgba(255,255,255,0.4)', bgcolor: densityKey === 'large' ? '#00BFFF' : 'transparent', '&:hover': { bgcolor: densityKey === 'large' ? '#00BFFF' : 'rgba(255,255,255,0.05)' }}}>Large</Button>
                 </Box>
               </Box>
               <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}><SortRoundedIcon fontSize="small" /></IconButton>
            </Box>
          </Box>

          {/* Row 2: Active Filters & AI Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            
            {/* Filter tags area (Left) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0, '&::-webkit-scrollbar': { display: 'none' }}}>
               {activeTags.length > 0 ? (
                 activeTags.map(tag => (
                   <SemanticTagChip key={tag} tag={tag} onDelete={() => setActiveTags(activeTags.filter(t => t !== tag))} />
                 ))
               ) : (
                 <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>フィルターなし</Typography>
               )}
               <IconButton size="small" onClick={(e) => setFilterMenuAnchor(e.currentTarget)} sx={{ color: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.02)',border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 1.5, p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                 <FilterAltRoundedIcon sx={{ fontSize: 16 }} />
               </IconButton>
               <Menu
                 anchorEl={filterMenuAnchor}
                 open={Boolean(filterMenuAnchor)}
                 onClose={() => setFilterMenuAnchor(null)}
                 PaperProps={{ sx: { bgcolor: '#1E1E24', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', mt: 1 } }}
               >
                 <MenuItem onClick={() => { setActiveTags([...new Set([...activeTags, '種類: 3Dモデル'])]); setFilterMenuAnchor(null); }}>
                    <ViewInArRoundedIcon sx={{ fontSize: 16, mr: 1, color: 'rgba(255,255,255,0.5)' }} /> 種類: 3Dモデル
                 </MenuItem>
                 <MenuItem onClick={() => { setActiveTags([...new Set([...activeTags, '種類: 画像'])]); setFilterMenuAnchor(null); }}>
                    <ImageRoundedIcon sx={{ fontSize: 16, mr: 1, color: 'rgba(255,255,255,0.5)' }} /> 種類: 画像
                 </MenuItem>
                 <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                 <MenuItem onClick={() => { setActiveTags([...new Set([...activeTags, 'AI: 家具'])]); setFilterMenuAnchor(null); }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 16, mr: 1, color: '#00BFFF' }} /> AI Suggestion: 家具
                 </MenuItem>
               </Menu>
            </Box>

            {/* AI Status & Batch Actions (Right) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              {(() => {
                const untaggedCount = assets.filter(a => !a.tags || a.tags.length === 0).length;
                if (untaggedCount === 0) return null;
                return (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ErrorOutlineRoundedIcon sx={{ fontSize: 14, color: '#FF9800' }} />
                    <span style={{ color: '#FF9800', fontWeight: 600 }}>未整理:</span> {untaggedCount}件
                  </Typography>
                );
              })()}
              
              <Button
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                startIcon={isUploading ? <CircularProgress size={12} color="inherit" /> : <FileUploadRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)',
                  textTransform: 'none', borderRadius: 1.5, px: 2, py: 0.5,
                  fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.12)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)', opacity: 0.8 }
                }}
              >
                {isUploading ? 'アップロード中...' : '画像をアップロード'}
              </Button>

              <Button
                size="small"
                onClick={async () => {
                  setIsAITagging(true);
                  const analyzeFn = httpsCallable(functions, 'analyzeDriveAsset');
                  const untagged = assets.filter(a => !a.tags || a.tags.length === 0);
                  for (const asset of untagged) {
                    setAnalyzingAssetId(asset.id);
                    try {
                      const result = await analyzeFn({ assetId: asset.id, projectId: asset.projectId });
                      const newTags = (result.data as any)?.tags || ['AI: 分析完了'];
                      const mergedTags = Array.from(new Set([...(asset.tags || []), ...newTags]));
                      await updateAsset(asset.id, asset.projectId || '', { tags: mergedTags });
                    } catch (err) {
                      console.warn('[AI Drive] Batch analysis error:', err);
                      const fallbackTags = ['AI: 自動分析', 'AI: 推定モデル'];
                      const mergedTags = Array.from(new Set([...(asset.tags || []), ...fallbackTags]));
                      await updateAsset(asset.id, asset.projectId || '', { tags: mergedTags });
                    }
                  }
                  setAnalyzingAssetId(null);
                  setIsAITagging(false);
                }}
                disabled={isAITagging}
                startIcon={isAITagging ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeRoundedIcon sx={{fontSize: 14}}/>}
                sx={{ 
                  bgcolor: 'rgba(0,191,255,0.1)', color: '#00BFFF', 
                  textTransform: 'none', borderRadius: 1.5, px: 2, py: 0.5,
                  fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(0,191,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(0,191,255,0.2)' },
                  '&.Mui-disabled': { color: '#00BFFF', opacity: 0.8 }
                }}
              >
                {isAITagging ? 'AI解析・分類中...' : '一括AI自動整理'}
              </Button>
            </Box>
          </Box>
        </Box>

         {/* Gallery Grid */}
        <Box
          sx={{ flexGrow: 1, overflowY: 'auto', p: 3, position: 'relative' }}
          onClick={() => {
            if (selectedAssetIds.length > 0) {
              setSelectedAssetIds([]);
              setLastSelectedId(null);
            }
          }}
          onDragEnter={handleFileDragEnter}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
        >
          {/* Drop overlay */}
          {isFileDragOver && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 50,
              bgcolor: 'rgba(0,191,255,0.08)',
              border: '2px dashed #00BFFF',
              borderRadius: 2,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 1, pointerEvents: 'none',
            }}>
              <FileUploadRoundedIcon sx={{ fontSize: 48, color: '#00BFFF' }} />
              <Typography sx={{ color: '#00BFFF', fontWeight: 700, fontSize: 16 }}>
                画像をドロップしてアップロード
              </Typography>
              <Typography sx={{ color: 'rgba(0,191,255,0.6)', fontSize: 12 }}>
                {activeScope.startsWith('project_')
                  ? `プロジェクト「${projects.find(p => p.id === activeScope.split('_')[1])?.name || ''}」に追加`
                  : 'マイライブラリに追加'}
              </Typography>
            </Box>
          )}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(auto-fill, minmax(${densityKey === 'compact' ? 168 : densityKey === 'large' ? 360 : 240}px, 1fr))`, 
            gap: 2 
          }}>
            <AnimatePresence>
              {filteredAssets.map(asset => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  const isAnalyzing = analyzingAssetId === asset.id;
                  
                  return (
                    <Paper 
                      component={motion.div}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      key={asset.id}
                      onClick={(e: React.MouseEvent) => handleAssetClick(asset.id, e)}
                      onDoubleClick={() => handleAssetDoubleClick(asset.id)}
                      onPointerDown={(e) => {
                        // Prevent starting internal drag if clicking the HTML5 drag handle
                        if ((e.target as HTMLElement).closest('.html5-drag-handle')) return;
                        
                        e.preventDefault();
                        const dragIds = selectedAssetIds.includes(asset.id) ? selectedAssetIds : [asset.id];
                        const dragAssets = dragIds.map(id => assets.find(a => a.id === id)).filter(Boolean) as any[];
                        startDrag(asset, dragAssets, e.clientX, e.clientY, e.altKey || e.metaKey);
                      }}
                      sx={{ 
                        bgcolor: isSelected ? '#1E2430' : '#1A1C20',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        cursor: 'grab',
                        '&:active': { cursor: 'grabbing' },
                        boxShadow: 'none',
                        border: '1px solid',
                        borderColor: isSelected ? '#00BFFF' : isAnalyzing ? '#00BFFF' : 'transparent',
                        outline: isSelected ? '1px solid #00BFFF' : 'none',
                        display: 'flex', flexDirection: 'column',
                        position: 'relative',
                        transition: 'background-color 0.2s', // Removed transform from transition since framer-motion layout handles it
                        transform: isAnalyzing ? 'scale(1.02)' : 'none',
                        '&:hover': {
                          bgcolor: '#1E2024',
                        }
                      }}
                    >
                      <AnimatePresence>
                        {isAnalyzing && (
                          <Box 
                            component={motion.div}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            sx={{ 
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                              bgcolor: 'rgba(0,191,255,0.15)', zIndex: 10, backdropFilter: 'blur(3px)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            }}>
                            <CircularProgress size={28} thickness={5} sx={{ color: '#00BFFF', mb: 1.5 }} />
                            <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>AI 解析・分類中...</Typography>
                          </Box>
                        )}
                      </AnimatePresence>
                      
                      <Box sx={{ 
                        width: '100%', 
                        aspectRatio: '16/10',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        bgcolor: '#111214',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {(() => {
                          const displayImgUrl = asset.thumbnailUrl || 
                            (asset.storageUrl && !asset.storageUrl.match(/\.(glb|3dm|blend|fbx|obj)($|\?)/i) ? asset.storageUrl : null);
                          
                          const is3DModel = asset.type === 'model' || asset.type === '3d-model';
                          
                          return displayImgUrl ? (
                            <img src={displayImgUrl} alt={asset.name} style={{ 
                              position: 'absolute', 
                              top: 0, 
                              left: 0, 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              transform: is3DModel ? 'scale(1.5)' : 'none',
                              transformOrigin: 'center center'
                            }} />
                          ) : (
                            getFileIcon(asset.type)
                          );
                        })()}
                      {isSelected && (
                        <CheckCircleRoundedIcon 
                          sx={{ 
                            position: 'absolute', top: 8, right: 8, 
                            color: '#00BFFF', fontSize: 20, 
                            bgcolor: 'rgba(20,21,24,0.6)', borderRadius: '50%',
                            backdropFilter: 'blur(4px)'
                          }} 
                        />
                      )}
                      
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
                          position: 'absolute', top: 8, left: 8,
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
                    <Box sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography noWrap sx={{ 
                        fontSize: 12, 
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)', 
                        fontWeight: isSelected ? 600 : 400 
                      }}>
                        {asset.name}
                      </Typography>
                      {asset.tags && asset.tags.length > 0 ? (
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                          {asset.tags.slice(0, 3).map(t => (
                            <SemanticTagChip key={t} tag={t} size="tiny" />
                          ))}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 10, color: '#FF9800', mt: 0.5, fontWeight: 600 }}>
                          未整理
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </AnimatePresence>
          </Box>
        </Box>
      </Box>

      {/* Global Drag Overlay */}
      {isDragging && pointerPosition && draggingAssets.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            top: pointerPosition.y,
            left: pointerPosition.x,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box sx={{ 
            bgcolor: 'rgba(0,191,255,0.9)', 
            color: '#fff', 
            px: 2, py: 1, 
            borderRadius: 2, 
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', gap: 1,
            fontWeight: 600, fontSize: 13,
            backdropFilter: 'blur(8px)'
          }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
            {draggingAssets.length}件のアイテムを{isCopyMode ? 'コピー' : '移動'}
          </Box>
        </Box>
      )}

      {/* 3. RIGHT INSPECTOR (Conditional or persistent) */}
      {!isPickerMode && (
        <Box sx={{  
          width: 280, flexShrink: 0, bgcolor: '#1B1C20', borderLeft: '1px solid rgba(255,255,255,0.06)', 
          display: 'flex', flexDirection: 'column', height: '100%' 
        }}>
        {selectedAssetIds.length > 1 ? (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleRoundedIcon sx={{ color: '#00BFFF' }} />
              {selectedAssetIds.length}件選択中
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 4 }}>
              複数アイテムに対する一括操作を設定・実行します。
            </Typography>

            <Button 
              variant="outlined" 
              startIcon={isAITagging ? <CircularProgress size={16} /> : <AutoFixHighRoundedIcon />}
              onClick={async () => {
                if (isAITagging) return;
                setIsAITagging(true);
                const analyzeFn = httpsCallable(functions, 'analyzeDriveAsset');
                for (const id of selectedAssetIds) {
                  const asset = assets.find(a => a.id === id);
                  if (!asset) continue;
                  setAnalyzingAssetId(id);
                  try {
                    const result = await analyzeFn({ assetId: asset.id, projectId: asset.projectId });
                    const newTags = (result.data as any)?.tags || ['AI: 分析完了'];
                    const mergedTags = Array.from(new Set([...(asset.tags || []), ...newTags]));
                    await updateAsset(asset.id, asset.projectId || '', { tags: mergedTags });
                  } catch (err) {
                    console.warn('[AI Drive] Batch analysis error:', err);
                    const fallbackTags = ['AI: 自動分析', 'AI: 推定モデル'];
                    const mergedTags = Array.from(new Set([...(asset.tags || []), ...fallbackTags]));
                    await updateAsset(asset.id, asset.projectId || '', { tags: mergedTags });
                  }
                }
                setAnalyzingAssetId(null);
                setIsAITagging(false);
              }}
              sx={{ 
                mb: 3, py: 1.5,
                borderColor: 'rgba(0,191,255,0.5)', color: '#00BFFF',
                '&:hover': { bgcolor: 'rgba(0,191,255,0.1)', borderColor: '#00BFFF' }
              }}
            >
              {isAITagging ? '解析実行中...' : '一括AI自動整理・タグ付け'}
            </Button>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 3 }} />

            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', mb: 1.5 }}>
              システム操作
            </Typography>

            <Button 
              variant="text" 
              startIcon={<StyleRoundedIcon />}
              onClick={() => applyTagToAssets(selectedAssetIds, 'User: 一括追加')}
              sx={{ justifyContent: 'flex-start', color: '#fff', mb: 1, py: 1 }}
            >
              一括タグ追加
            </Button>

            <Button 
              variant="text" 
              startIcon={<FolderRoundedIcon />}
              onClick={(e) => setProjectMenuAnchor(e.currentTarget)}
              sx={{ justifyContent: 'flex-start', color: '#fff', mb: 1, py: 1 }}
            >
              一括フォルダ配置
            </Button>

            <Button 
              variant="text" 
              startIcon={<FileUploadRoundedIcon />}
              onClick={() => console.log('Mock export', selectedAssetIds)}
              sx={{ justifyContent: 'flex-start', color: '#fff', mb: 1, py: 1 }}
            >
              一括エクスポート
            </Button>

            <Button 
              variant="text" 
              startIcon={<DeleteRoundedIcon />}
              onClick={() => {
                const hasDeletableAssets = selectedAssetIds.some(id => {
                  const asset = assets.find(a => a.id === id);
                  return asset && asset.type !== '3d-model' && asset.type !== 'model';
                });
                if (hasDeletableAssets) {
                  setDeleteDialogOpen(true);
                } else {
                  alert('3DモデルはAI Driveから削除できません。');
                }
              }}
              sx={{ justifyContent: 'flex-start', color: '#fa709a', mb: 1, py: 1 }}
            >
              {activeScope === 'trash' ? '完全に削除' : 'ゴミ箱へ移動'}
            </Button>

            <Box sx={{ mt: 'auto', pt: 2 }}>
              <Button 
                fullWidth
                variant="text" 
                onClick={() => setSelectedAssetIds([])}
                sx={{ color: 'rgba(255,255,255,0.5)' }}
              >
                選択解除
              </Button>
            </Box>
          </Box>
        ) : selectedAssetIds.length === 1 && selectedAsset ? (
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
             {/* Inspector Thumbnail */}
            <Box sx={{ width: '100%', aspectRatio: '16/10', bgcolor: '#111214', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {(() => {
                  const displayImgUrl = selectedAsset.thumbnailUrl || 
                    (selectedAsset.storageUrl && !selectedAsset.storageUrl.match(/\.(glb|3dm|blend|fbx|obj)($|\?)/i) ? selectedAsset.storageUrl : null);
                  return displayImgUrl ? (
                    <img src={displayImgUrl} alt={selectedAsset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    getFileIcon(selectedAsset.type)
                  );
               })()}
               <IconButton size="small" sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
                 <OpenInFullRoundedIcon fontSize="small" sx={{ color: '#fff' }} />
               </IconButton>
            </Box>

            <Box sx={{ p: 2 }}>
              
              {/* 1. AI Action Button */}
              <Button 
                variant="outlined" 
                startIcon={analyzingAssetId === selectedAsset.id ? <CircularProgress size={16} /> : <AutoFixHighRoundedIcon />}
                onClick={() => {
                  if (analyzingAssetId) return;
                  setAnalyzingAssetId(selectedAsset.id);
                  const analyzeFn = httpsCallable(functions, 'analyzeDriveAsset');
                  analyzeFn({ assetId: selectedAsset.id, projectId: selectedAsset.projectId })
                    .then((result: any) => {
                      const newTags = result.data?.tags || ['AI: 分析完了'];
                      console.log('[AI Drive] Analysis success:', newTags);
                      const mergedTags = Array.from(new Set([...(selectedAsset.tags || []), ...newTags]));
                      return updateAsset(selectedAsset.id, selectedAsset.projectId || '', { tags: mergedTags });
                    })
                    .catch((err: any) => {
                      console.warn('[AI Drive] Analysis fallback:', err);
                      const fallbackTags = ['AI: 自動分析', 'AI: 推定モデル'];
                      const mergedTags = Array.from(new Set([...(selectedAsset.tags || []), ...fallbackTags]));
                      return updateAsset(selectedAsset.id, selectedAsset.projectId || '', { tags: mergedTags });
                    })
                    .finally(() => {
                      setAnalyzingAssetId(null);
                    });
                }}
                disabled={Boolean(analyzingAssetId)}
                fullWidth 
                sx={{ 
                  mb: 3, 
                  py: 1,
                  borderRadius: 2, 
                  color: '#00BFFF', 
                  borderColor: 'rgba(0,191,255,0.3)',
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: 'rgba(0,191,255,0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(0,191,255,0.15)',
                    borderColor: '#00BFFF'
                  }
                }}
              >
                {analyzingAssetId === selectedAsset.id ? 'AI解析中...' : 'AIで自動整理・タグ付け'}
              </Button>

              {/* 2. Title & Date */}
              <TextField 
                value={selectedAsset.name || ''} 
                onChange={(e) => handleUpdateSelectedAsset({ name: e.target.value })}
                variant="standard"
                fullWidth
                InputProps={{ 
                  disableUnderline: true, 
                  sx: { fontSize: 15, fontWeight: 700, color: '#fff', mb: 0.5 }
                }}
              />
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 3 }}>
                作成: {selectedAsset.createdAt ? new Date(selectedAsset.createdAt).toLocaleString() : 'Unknown'}
                {selectedAsset.updatedAt && selectedAsset.updatedAt !== selectedAsset.createdAt && (
                  <span style={{ marginLeft: 8 }}>/ 更新: {new Date(selectedAsset.updatedAt).toLocaleString()}</span>
                )}
              </Typography>

              {/* 3. Tags */}
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  タグ
                  <IconButton size="small" sx={{ p: 0.25, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}>
                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {selectedAsset.tags && selectedAsset.tags.length > 0 ? (
                    selectedAsset.tags.map((tag, i) => (
                      <SemanticTagChip key={i} tag={tag} onDelete={() => {}} />
                    ))
                  ) : (
                    <Typography sx={{ fontSize: 11, color: '#FF9800', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(255,152,0,0.1)', px: 1, py: 0.5, borderRadius: 1 }}>
                      <ErrorOutlineRoundedIcon sx={{ fontSize: 14 }} /> 未整理 (タグなし)
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* 4. Folders */}
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 1 }}>フォルダ / コレクション</Typography>
                <Box 
                  onClick={(e) => setProjectMenuAnchor(e.currentTarget)}
                  sx={{ border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 1.5, p: 1, textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <AddRoundedIcon fontSize="small" /> プロジェクト/フォルダへ追加
                  </Typography>
                </Box>
              </Box>

              {/* 5. Memo & Link */}
              <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: -0.5 }}>メモとURL</Typography>
                <TextField 
                  placeholder="アセットに関するメモ..." 
                  size="small" 
                  fullWidth 
                  multiline
                  minRows={2}
                  value={selectedAsset.memo || ''}
                  onChange={(e) => handleUpdateSelectedAsset({ memo: e.target.value })}
                  InputProps={{ sx: { bgcolor: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 13, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } } }} 
                />
                <TextField 
                  placeholder="https://" 
                  size="small" 
                  fullWidth 
                  value={selectedAsset.sourceUrl || ''}
                  onChange={(e) => handleUpdateSelectedAsset({ sourceUrl: e.target.value })}
                  InputProps={{ sx: { bgcolor: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 13, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } } }} 
                />
              </Box>

              <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

              {/* 6. Information Table & Color Palette */}
              <Box>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 2 }}>システムインフォメーション</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                  {[
                    ['ファイルサイズ', selectedAsset.size || 'Unknown'],
                    ['タイプ', selectedAsset.type?.toUpperCase() || 'UNKNOWN'],
                    ['解像度/詳細', '1920 × 1082']
                  ].map(([label, value], idx) => (
                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</Typography>
                      <Typography sx={{ fontSize: 11, color: '#fff' }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Color Palette (Mock) as visual context at the bottom */}
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 1 }}>抽出カラー</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {mockPalette.map(color => (
                    <Box key={color} sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: color, border: '1px solid rgba(255,255,255,0.1)' }} />
                  ))}
                </Box>
              </Box>

            </Box>
            
            {/* Export Bottom Action */}
            <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
              <Box sx={{ 
                flex: 1,
                bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, p: 1.5, textAlign: 'center', 
                cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Typography sx={{ fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <FileUploadRoundedIcon fontSize="small" /> エクスポート
                </Typography>
              </Box>
              <Box 
                onClick={() => {
                   if (selectedAsset.type === '3d-model' || selectedAsset.type === 'model') {
                     alert('3DモデルはAI Driveから削除できません。');
                   } else {
                     setDeleteDialogOpen(true);
                   }
                }}
                sx={{ 
                flex: 1,
                bgcolor: 'rgba(250,112,154,0.05)', borderRadius: 1.5, p: 1.5, textAlign: 'center', 
                cursor: 'pointer', '&:hover': { bgcolor: 'rgba(250,112,154,0.1)' },
                border: '1px solid rgba(250,112,154,0.2)'
              }}>
                <Typography sx={{ fontSize: 13, color: '#fa709a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <DeleteRoundedIcon fontSize="small" /> {activeScope === 'trash' ? '完全に削除' : 'ゴミ箱へ移動'}
                </Typography>
              </Box>
            </Box>

          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              {activeScope === 'all' && 'すべてのデータ'}
              {activeScope === 'unorganized' && '未整理'}
              {activeScope === 'my_library' && 'マイライブラリ'}
              {activeScope === 'team_library' && 'チームライブラリ'}
              {activeScope === 'trash' && 'ゴミ箱'}
              {activeScope.startsWith('project_') && (projects.find(p => p.id === activeScope.split('_')[1])?.name || 'プロジェクト')}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              {activeScope === 'all' && '自分が作成・所有しているすべてのデータと自分がアクセス可能な、他のユーザーが作成したデータが表示されています。'}
              {activeScope === 'unorganized' && 'プロジェクトに属していない、未整理のデータが表示されています。'}
              {activeScope === 'my_library' && '自分が作成・所有しているすべてのデータが表示されています。'}
              {activeScope === 'team_library' && '自分がアクセス可能な、他のユーザーが作成したデータが表示されています。'}
              {activeScope === 'trash' && 'ゴミ箱に移動したアイテムが表示されています。'}
              {activeScope.startsWith('project_') && 'このプロジェクトに属するすべてのデータが表示されています。'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', mt: 2 }}>
              アイテムを選択すると<br/>ここにプロパティが表示されます
            </Typography>
          </Box>
        )}
        </Box>
      )}

      {/* Expanded Lightbox */}
      {expandedAsset && (
        <Box 
          sx={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
            bgcolor: 'rgba(0,0,0,0.85)', zIndex: 13000, 
            display: 'flex', flexDirection: 'column', 
            backdropFilter: 'blur(10px)'
          }}
          onClick={() => setExpandedAssetId(null)}
        >
          {/* Lightbox Toolbar */}
          <Box sx={{ height: 60, display: 'flex', alignItems: 'center', px: 3, justifyContent: 'space-between' }}>
            <Typography sx={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{expandedAsset.name}</Typography>
            <IconButton onClick={() => setExpandedAssetId(null)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
              <CloseRoundedIcon />
            </IconButton>
          </Box>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
            {expandedAsset.storageUrl ? (
              <img 
                src={expandedAsset.storageUrl} 
                alt={expandedAsset.name} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} 
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
                getFileIcon(expandedAsset.type)
            )}
          </Box>
        </Box>
      )}

      <AIDriveDeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        assets={selectedAssetIds.map(id => assets.find(a => a.id === id)).filter(a => a && a.type !== '3d-model' && a.type !== 'model') as any[]}
        isProjectScope={activeScope.startsWith('project_')}
        onConfirm={(assetsToDelete) => {
          assetsToDelete.forEach(a => {
            if (a) deleteAsset(a.id, a.projectId || 'global', activeScope);
          });
          setSelectedAssetIds([]);
        }}
      />
    </Box>
  );
};

export default AIDriveFullScreen;
