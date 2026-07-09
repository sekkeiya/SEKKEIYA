import React, { useState, useMemo } from 'react';
import {
  Button, Box, Typography, useMediaQuery,
  Switch, FormControlLabel, Stack, FormHelperText,
  ToggleButton, ToggleButtonGroup, Chip, Divider,
  Menu, MenuItem, IconButton, Snackbar, Alert, CircularProgress, LinearProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AppsIcon from '@mui/icons-material/Apps';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import GridViewIcon from '@mui/icons-material/GridView';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { useAppStore } from '../../../../store/useAppStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useUploadModal } from './useUploadModal';
import UploadQueueItemCard from './UploadQueueItemCard';
import DropZone from './DropZone';
import CategoryCheatSheetDialog from './CategoryCheatSheetDialog';
import { useUserSettingsStore } from '../../../../store/useUserSettingsStore';
import { categoryOptions, categoryOptionsArchitecture } from '../constants/Categories';

const UploadModalContent = React.forwardRef(({ open, onClose, initialFiles, rhinoJob }, ref) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  const { currentProject, currentWorkspace, projects } = useAppStore();
  const { currentUser: user } = useAuthStore();
  const currentProjectId = currentProject?.id;
  const currentWorkspaceId = currentWorkspace?.id || 'models';
  const getMergedCategoryMap = useUserSettingsStore(state => state.getMergedCategoryMap);
  const mergedCategoryMap = getMergedCategoryMap();

  // Only use currentProjectId if we are inside a project.
  // If we are in Global Scopes (Hub), this remains undefined.
  const targetProjectId = currentProjectId;

  const {
    state, setters,
    handleFilesDrop,
    handleProcessQueue,
    handleRunAI,
    uploading,
    isLoadingFiles,
    loadingProgress,
    loadingCurrent,
    loadingTotal,
    loadingMessage,
  } = useUploadModal({ user, onClose, projectId: targetProjectId, workspaceId: currentWorkspaceId, mergedCategoryMap });

  const [selectedItemIds, setSelectedItemIds] = useState(new Set());

  const { uploadQueue } = state;
  const hasFiles = uploadQueue && uploadQueue.length > 0;

  const initialFilesProcessed = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      initialFilesProcessed.current = false;
    } else if (open && initialFiles && initialFiles.length > 0 && !initialFilesProcessed.current) {
      initialFilesProcessed.current = true;
      handleFilesDrop(initialFiles);
    }
  }, [open, initialFiles]);

  // ==== States for UI enhancements ====
  const [filterFormats, setFilterFormats] = useState(['ALL']);
  const [filterDuplicates, setFilterDuplicates] = useState(false);

  const toggleFilterFormat = (fmt) => {
    if (fmt === 'ALL') {
      setFilterFormats(['ALL']);
      return;
    }
    setFilterFormats(prev => {
      let next = prev.filter(f => f !== 'ALL');
      if (next.includes(fmt)) {
        next = next.filter(f => f !== fmt);
        if (next.length === 0) return ['ALL'];
        return next;
      }
      return [...next, fmt];
    });
  };
  const [isGridView, setIsGridView] = useState(false);

  const fileInputRef = React.useRef(null);
  const folderInputRef = React.useRef(null);
  const [anchorElAdd, setAnchorElAdd] = useState(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

  const handleAddMenuOpen = (e) => setAnchorElAdd(e.currentTarget);
  const handleAddMenuClose = () => setAnchorElAdd(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesDrop(e.target.files);
    }
    e.target.value = "";
    handleAddMenuClose();
  };

  const handleFileBtnClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
    handleAddMenuClose();
  };

  const handleFolderBtnClick = () => {
    if (folderInputRef.current) folderInputRef.current.click();
    handleAddMenuClose();
  };

  // Selected Formats removed. Added Selection buttons.
  const handleSelectAll = () => {
    const allIds = uploadQueue.map(item => item.id);
    setSelectedItemIds(new Set(allIds));
  };

  const handleSelectVisible = () => {
    const visibleIds = filteredQueue.map(item => item.id);
    setSelectedItemIds(new Set(visibleIds));
  };

  const handleSelectDuplicates = () => {
    const dupIds = uploadQueue
      .filter(item => item.duplicateInfo?.level === 'exact' || item.duplicateInfo?.level === 'strong')
      .map(item => item.id);
    setSelectedItemIds(new Set(dupIds));
  };

  const handleSelectUncategorized = () => {
    const uncategorizedIds = filteredQueue
      .filter(item => !item.macroCategory || !item.mainCategory)
      .map(item => item.id);
    setSelectedItemIds(new Set(uncategorizedIds));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  // ==== Derived Stats ====
  const stats = useMemo(() => {
    const total = uploadQueue.length;
    let errorCount = 0;
    let needsReviewCount = 0;
    let readyCount = 0;
    let targetedCount = 0;
    let preparingCount = 0;

    uploadQueue.forEach(item => {
      const isUnset = !item.mainCategory;
      if (item.uploadEnabled) targetedCount++;

      if (['parsing', 'processing', 'thumbnailing'].includes(item.status)) {
        preparingCount++;
      } else if (item.status === 'error') {
        errorCount++;
      } else if (isUnset) {
        needsReviewCount++;
      } else {
        readyCount++;
      }
    });

    return { total, errorCount, needsReviewCount, readyCount, targetedCount, preparingCount };
  }, [uploadQueue]);

  const canUpload = hasFiles && !uploading && stats.preparingCount === 0 && stats.errorCount === 0 && stats.needsReviewCount === 0 && stats.targetedCount > 0;

  // ==== Filtering Items ====
  const filteredQueue = useMemo(() => {
    return uploadQueue.filter(item => {
      // 1) Format Filter
      if (!filterFormats.includes('ALL') && !filterFormats.includes(item.ext.toUpperCase())) {
        return false;
      }

      // 2) Duplicate Filter
      if (filterDuplicates) {
        const hasDuplicate = item.duplicateInfo?.level === 'exact' || item.duplicateInfo?.level === 'strong';
        if (!hasDuplicate) return false;
      }
      
      return true;
    });
  }, [uploadQueue, filterFormats, filterDuplicates]);

  const handleValidatedSave = async () => {
    if (!canUpload) return;
    await handleProcessQueue(uploadQueue);
    setToastMsg('追加完了しました');
    setToastOpen(true);
    setTimeout(() => { onClose(); }, 1500);
  };

  // Automatic uploading is disabled. The user must click the Upload button explicitly.

  // ==== Bulk Edit Handlers ====
  const handleBulkUploadTarget = (mode) => {
    if (selectedItemIds.size === 0) return;
    uploadQueue.forEach(item => {
      if (selectedItemIds.has(item.id) && item.status !== 'done' && item.status !== 'error') {
        let enable = false;
        if (mode === 'all') enable = true;
        else if (mode === 'none') enable = false;
        
        setters.updateQueueItem(item.id, { uploadEnabled: enable });
      }
    });
  };

  const handleBulkVisibility = (val) => {
    if (selectedItemIds.size === 0) return;
    uploadQueue.forEach(item => {
      if (selectedItemIds.has(item.id) && item.status !== 'done' && item.status !== 'error') {
        setters.updateQueueItem(item.id, { visibility: val });
      }
    });
  };

  const [anchorElMacroCategory, setAnchorElMacroCategory] = useState(null);
  const handleMacroCategoryMenuOpen = (e) => setAnchorElMacroCategory(e.currentTarget);
  const handleMacroCategoryMenuClose = () => setAnchorElMacroCategory(null);
  const handleBulkMacroCategory = (macroVal) => {
    if (selectedItemIds.size === 0) return;
    uploadQueue.forEach(item => {
      if (selectedItemIds.has(item.id) && item.status !== 'done' && item.status !== 'error') {
        setters.updateQueueItem(item.id, { macroCategory: macroVal, mainCategory: '', subCategory: '' });
      }
    });
    handleMacroCategoryMenuClose();
  };

  // Combine categories for generic bulk set, or separate them
  const safeMacroCategories = Object.keys(mergedCategoryMap);
  const allMainCategories = [
    ...new Set(
      Object.values(mergedCategoryMap).flatMap(macro => Object.keys(macro))
    )
  ];

  const [anchorElCategory, setAnchorElCategory] = useState(null);
  const handleCategoryMenuOpen = (e) => setAnchorElCategory(e.currentTarget);
  const handleCategoryMenuClose = () => setAnchorElCategory(null);
  const handleBulkCategory = (catVal) => {
    if (selectedItemIds.size === 0) return;
    uploadQueue.forEach(item => {
      if (selectedItemIds.has(item.id) && item.status !== 'done' && item.status !== 'error') {
        setters.updateQueueItem(item.id, { mainCategory: catVal });
      }
    });
    handleCategoryMenuClose();
  };

  return (
    <Box
      ref={ref}
      tabIndex={-1}
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '100%', sm: '92vw' },
        maxWidth: 1040,
        height: { xs: '100dvh', sm: '88vh' },
        maxHeight: 820,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#202124', // Modern solid dark background, not transparent
        color: '#fff',
        borderRadius: { xs: 0, sm: 3 },
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        outline: 'none',
      }}
    >
      {/* ==== Loading Files Overlay ==== */}
      {isLoadingFiles && (
        <Box 
          sx={{ 
            position: 'absolute', inset: 0, zIndex: 9999, 
            display: 'flex', flexDirection: 'column', 
            alignItems: 'center', justifyContent: 'center', 
            bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' 
          }}
        >
          <Box sx={{ width: '60%', maxWidth: 400, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
              {loadingMessage || "ファイルを読み込み中..."}
            </Typography>
            <LinearProgress variant="determinate" value={loadingProgress || 0} sx={{ height: 10, borderRadius: 5, mb: 1, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#1e90ff' } }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {loadingCurrent || 0} / {loadingTotal || 0} 件
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
                {loadingProgress || 0}%
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}

      {/* ==== Hidden Inputs for Add More ==== */}
      <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".3dm,.glb,.skp,.blend,.gh,.obj" />
      <input type="file" multiple webkitdirectory="true" directory="true" ref={folderInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ==== Header ==== */}
      <Box sx={{ p: { xs: 2, sm: 3 }, pb: 1.5, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant={isXs ? 'h6' : 'h5'} sx={{ fontWeight: 700, letterSpacing: '0.02em', color: '#fff' }}>
            3Dモデルアップロード
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {hasFiles && (
              <>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={handleAddMenuOpen}
                  endIcon={<KeyboardArrowDownIcon />}
                  startIcon={<AddIcon />}
                  sx={{ 
                    color: 'white', borderColor: 'rgba(255,255,255,0.4)', 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    fontWeight: 700,
                    px: 2,
                    '&:hover': { borderColor: '#1e90ff', bgcolor: 'rgba(30,144,255,0.1)', color: '#1e90ff' } 
                  }}
                >
                  さらに追加
                </Button>
                <Menu
                  anchorEl={anchorElAdd}
                  open={Boolean(anchorElAdd)}
                  onClose={handleAddMenuClose}
                  PaperProps={{ sx: { bgcolor: '#2a2a2a', color: 'white', mt: 1, minWidth: 160 } }}
                >
                  <MenuItem onClick={handleFileBtnClick}>
                    <InsertDriveFileIcon fontSize="small" sx={{ mr: 1.5, color: 'rgba(255,255,255,0.7)' }} />
                    ファイルを追加
                  </MenuItem>
                  <MenuItem onClick={handleFolderBtnClick}>
                    <CreateNewFolderIcon fontSize="small" sx={{ mr: 1.5, color: 'rgba(255,255,255,0.7)' }} />
                    フォルダを追加
                  </MenuItem>
                </Menu>
              </>
            )}
            <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.78)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* ==== Initial DropZone ==== */}
      {!hasFiles && (
        <Box sx={{ p: { xs: 2, sm: 3 }, flexShrink: 0 }}>
          <DropZone 
            label="3Dモデルファイルをドロップ"
            onDrop={handleFilesDrop}
            isCompact={false}
          />
        </Box>
      )}

      {/* ==== Management Bar ==== */}
      {hasFiles && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          
          {/* 1. Display Filters */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, mr: 0.5, alignSelf: 'center' }}>表示:</Typography>
              <Chip icon={<AppsIcon fontSize="small"/>} label="ALL" size="small" variant={filterFormats.includes('ALL') ? 'filled' : 'outlined'} onClick={() => toggleFilterFormat('ALL')} sx={{ color: filterFormats.includes('ALL') ? '#ffffff' : 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', bgcolor: filterFormats.includes('ALL') ? '#1e90ff' : 'transparent', '&:hover': { bgcolor: filterFormats.includes('ALL') ? '#1c86ee' : 'rgba(255,255,255,0.08)' } }} />
              <Chip icon={<ViewInArIcon fontSize="small"/>} label="GLB" size="small" variant={filterFormats.includes('GLB') ? 'filled' : 'outlined'} onClick={() => toggleFilterFormat('GLB')} sx={{ color: filterFormats.includes('GLB') ? '#ffffff' : 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', bgcolor: filterFormats.includes('GLB') ? '#1e90ff' : 'transparent', '&:hover': { bgcolor: filterFormats.includes('GLB') ? '#1c86ee' : 'rgba(255,255,255,0.08)' } }} />
              <Chip icon={<ArchitectureIcon fontSize="small"/>} label="3DM" size="small" variant={filterFormats.includes('3DM') ? 'filled' : 'outlined'} onClick={() => toggleFilterFormat('3DM')} sx={{ color: filterFormats.includes('3DM') ? '#ffffff' : 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', bgcolor: filterFormats.includes('3DM') ? '#1e90ff' : 'transparent', '&:hover': { bgcolor: filterFormats.includes('3DM') ? '#1c86ee' : 'rgba(255,255,255,0.08)' } }} />
              <Chip icon={<MovieFilterIcon fontSize="small"/>} label="BLEND" size="small" variant={filterFormats.includes('BLEND') ? 'filled' : 'outlined'} onClick={() => toggleFilterFormat('BLEND')} sx={{ color: filterFormats.includes('BLEND') ? '#ffffff' : 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', bgcolor: filterFormats.includes('BLEND') ? '#1e90ff' : 'transparent', '&:hover': { bgcolor: filterFormats.includes('BLEND') ? '#1c86ee' : 'rgba(255,255,255,0.08)' } }} />
              <Chip icon={<AccountTreeIcon fontSize="small"/>} label="GH" size="small" variant={filterFormats.includes('GH') ? 'filled' : 'outlined'} onClick={() => toggleFilterFormat('GH')} sx={{ color: filterFormats.includes('GH') ? '#ffffff' : 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', bgcolor: filterFormats.includes('GH') ? '#1e90ff' : 'transparent', '&:hover': { bgcolor: filterFormats.includes('GH') ? '#1c86ee' : 'rgba(255,255,255,0.08)' } }} />
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)', mx: 0.5 }} />
              <Chip icon={<FileCopyIcon fontSize="small"/>} label="重複" size="small" variant={filterDuplicates ? 'filled' : 'outlined'} onClick={() => setFilterDuplicates(!filterDuplicates)} sx={{ color: filterDuplicates ? '#ffffff' : '#ffb74d', borderColor: filterDuplicates ? 'transparent' : 'rgba(255,183,77,0.5)', bgcolor: filterDuplicates ? '#f57c00' : 'transparent', '&:hover': { bgcolor: filterDuplicates ? '#ef6c00' : 'rgba(255,183,77,0.1)' } }} />
            </Stack>
            
            <ToggleButtonGroup
              value={isGridView}
              exclusive
              onChange={(_, val) => { if (val !== null) setIsGridView(val); }}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
            >
              <ToggleButton value={false} title="カード表示" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-selected': { bgcolor: '#1e90ff', color: 'white', '&:hover': { bgcolor: '#1c86ee' } }, '&:hover': { color: 'white' } }}>
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value={true} title="小型グリッド表示" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-selected': { bgcolor: '#1e90ff', color: 'white', '&:hover': { bgcolor: '#1c86ee' } }, '&:hover': { color: 'white' } }}>
                <GridViewIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {/* 2. Selection Controls */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
            <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, mr: 0.5 }}>選択:</Typography>
              <Button size="small" variant="text" onClick={handleSelectAll} sx={{ color: 'white', minWidth: 'auto', px: 1 }}>すべて選択</Button>
              <Button size="small" variant="text" onClick={handleSelectVisible} sx={{ color: 'white', minWidth: 'auto', px: 1 }}>表示中を選択</Button>
              <Button size="small" variant="text" onClick={handleSelectDuplicates} sx={{ color: 'white', minWidth: 'auto', px: 1 }}>重複だけ選択</Button>
              <Button size="small" variant="text" onClick={handleSelectUncategorized} sx={{ color: 'white', minWidth: 'auto', px: 1 }}>カテゴリ未設定を選択</Button>
              <Button size="small" variant="text" onClick={handleDeselectAll} sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 'auto', px: 1 }}>選択解除</Button>
            </Stack>
            {selectedItemIds.size > 0 && (
              <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600 }}>
                選択中: {selectedItemIds.size}件
              </Typography>
            )}
          </Stack>

          {/* 3. Bulk Edit Bar */}
          <Box sx={{ 
            p: 1.5, 
            border: '1px solid rgba(255,255,255,0.05)', 
            borderRadius: 2, 
            background: 'rgba(255,255,255,0.02)', 
            opacity: selectedItemIds.size > 0 ? 1 : 0.5, 
            pointerEvents: selectedItemIds.size > 0 ? 'auto' : 'none',
            transition: 'opacity 0.2s'
          }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              
              <Stack direction="row" alignItems="center" spacing={1} sx={{ overflowX: 'auto', flexWrap: 'nowrap', pb: isXs ? 1 : 0 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, mr: 1, whiteSpace: 'nowrap' }}>選択項目の操作:</Typography>
                <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => handleBulkUploadTarget('all')}>アップロードON</Button>
                <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => handleBulkUploadTarget('none')}>アップロードOFF</Button>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => handleBulkVisibility('public')}>公開にする</Button>
                <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => handleBulkVisibility('private')}>非公開にする</Button>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleMacroCategoryMenuOpen}>タイプ変更</Button>
                <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleCategoryMenuOpen}>カテゴリ変更</Button>
              </Stack>
            </Stack>

            {/* Macro Category Menu */}
            <Menu anchorEl={anchorElMacroCategory} open={Boolean(anchorElMacroCategory)} onClose={handleMacroCategoryMenuClose} PaperProps={{ sx: { bgcolor: '#2a2a2a', color: 'white' } }}>
              {safeMacroCategories.map((type) => (
                <MenuItem key={type} onClick={() => handleBulkMacroCategory(type)}>{type}</MenuItem>
              ))}
            </Menu>

            {/* Category Menu */}
            <Menu anchorEl={anchorElCategory} open={Boolean(anchorElCategory)} onClose={handleCategoryMenuClose} PaperProps={{ sx: { bgcolor: '#2a2a2a', color: 'white', maxHeight: 300 } }}>
               {allMainCategories.map(cat => (
                 <MenuItem key={cat} onClick={() => handleBulkCategory(cat)}>
                   {cat + ' に統一'}
                 </MenuItem>
               ))}
            </Menu>
          </Box>
        </Box>
      )}

      {/* ==== Scrollable Queue List ==== */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, pb: 3, pt: 1.5, minHeight: 0 }}>
        {hasFiles && filteredQueue.length > 0 ? (
          <Box sx={{ 
            display: isGridView ? 'grid' : 'flex', 
            flexDirection: isGridView ? 'unset' : 'column', 
            gridTemplateColumns: isGridView ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'unset',
            gap: isGridView ? 2 : 1.5 
          }}>
            {filteredQueue.map((item) => (
              <UploadQueueItemCard
                key={item.id}
                item={item}
                setters={setters}
                isGridView={isGridView}
                onOpenCheatSheet={() => setCheatSheetOpen(true)}
                isSelected={selectedItemIds.has(item.id)}
                onToggleSelect={(id) => {
                  setSelectedItemIds(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                mergedCategoryMap={mergedCategoryMap}
              />
            ))}
            {filteredQueue.length === 1 && !uploading && (
                <Box sx={{ textAlign: 'center', mt: 3, mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                    右上の「さらに追加」ボタンから、さらにファイルやフォルダを追加できます
                  </Typography>
                </Box>
            )}
          </Box>
        ) : hasFiles ? (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)', textAlign: 'center', mt: 4 }}>
            該当するアイテムがありません
          </Typography>
        ) : null}
      </Box>

      {/* ==== Fixed Footer ==== */}
      <Box 
        sx={{ 
          flexShrink: 0, 
          p: { xs: 1.5, sm: 2 }, 
          borderTop: '1px solid rgba(255,255,255,0.05)', 
          bgcolor: 'rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box>
          {hasFiles && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600 }}>
                全 {stats.total}件
              </Typography>
              {!isXs && (
                <>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                  <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600, fontSize: '0.9rem' }}>
                    {stats.targetedCount}件 対象
                  </Typography>
                  {stats.needsReviewCount > 0 && (
                    <>
                      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                      <Typography variant="body2" sx={{ color: '#ff9800', fontWeight: 600 }}>
                         未設定項目があります
                      </Typography>
                    </>
                  )}
                </>
              )}
            </Stack>
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, mr: { xs: 0, sm: 2 } }}>
            {uploading ? 'バックグラウンド最適化・保存中...' : stats.preparingCount > 0 ? 'モデルを準備中...' : !hasFiles ? `ファイルを選択してください` : stats.targetedCount === 0 ? `対象が0件です` : stats.needsReviewCount > 0 ? `必須項目を設定してください` : stats.errorCount > 0 ? `エラーを解消してください` : `アップロードの準備完了`}
          </Typography>
          <Button 
            onClick={onClose} 
            size="small"
            sx={{ color: 'rgba(255,255,255,0.58)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            {uploading ? 'バックグラウンドで閉じる' : 'キャンセル'}
          </Button>
          <Button
            onClick={handleValidatedSave}
            size="small"
            variant="contained"
            startIcon={<CloudUploadRoundedIcon />}
            disabled={!canUpload || uploading}
            sx={{
              fontWeight: 700,
              bgcolor: canUpload ? '#4caf50' : 'rgba(255,255,255,0.1)',
              color: canUpload ? '#fff' : 'rgba(255,255,255,0.3)',
              '&:hover': { bgcolor: '#43a047' },
            }}
          >
            {uploading ? 'アップロード中...' : 'アップロード'}
          </Button>
        </Stack>
      </Box>

      {/* ==== Success Toast ==== */}
      <Snackbar open={toastOpen} autoHideDuration={3000} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToastOpen(false)} severity="success" sx={{ width: '100%', bgcolor: '#4caf50', color: '#fff' }}>
          {toastMsg}
        </Alert>
      </Snackbar>

      <CategoryCheatSheetDialog 
        open={cheatSheetOpen} 
        onClose={() => setCheatSheetOpen(false)} 
        mergedCategoryMap={mergedCategoryMap} 
      />
    </Box>
  );
});

export default UploadModalContent;
