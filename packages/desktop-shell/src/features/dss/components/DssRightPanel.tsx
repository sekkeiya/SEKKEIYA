import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Typography, Button, TextField, Select, MenuItem, FormControl, Slider, ToggleButton, ToggleButtonGroup, Divider, InputAdornment, Chip, IconButton, Autocomplete, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, List, ListItem, ListItemButton, ListItemText, ListItemIcon } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CategoryIcon from '@mui/icons-material/Category';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';
import { RightPanelModelViewer } from './RightPanelModelViewer';
import { resolveDownloadUrl, getCanonicalModelId } from '../utils/modelUtils';
import { useRhinoDragImport } from '../hooks/useRhinoDragImport';
import RhinoDropZone from './RhinoDropZone';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { useDccStore } from '../../../store/useDccStore';
import { useDssSyncStore } from '../../../store/useDssSyncStore';
import { useLocalUploadStore } from '../store/useLocalUploadStore';
import { LocalCloudUploadDialog } from '../upload/LocalCloudUploadDialog';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { useDssLiveDimensionsStore } from '../../../store/useDssLiveDimensionsStore';
import { useUserSettingsStore, MACRO_CATEGORY_ORDER } from '../../../store/useUserSettingsStore';
import AppsIcon from '@mui/icons-material/Apps';
import WeekendIcon from '@mui/icons-material/Weekend';
import ChairIcon from '@mui/icons-material/Chair';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import BedIcon from '@mui/icons-material/Bed';
import KitchenIcon from '@mui/icons-material/Kitchen';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ParkIcon from '@mui/icons-material/Park';
import DomainIcon from '@mui/icons-material/Domain';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import BathtubIcon from '@mui/icons-material/Bathtub';
import LightIcon from '@mui/icons-material/Light';
import TvIcon from '@mui/icons-material/Tv';
import YardIcon from '@mui/icons-material/Yard';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ImageIcon from '@mui/icons-material/Image';
export const DssRightPanel: React.FC = () => {
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const selectedItem = useAppStore(s => activeWorkspaceId ? s.panelSelections[activeWorkspaceId] : null);
  const dssSearchFilters = useAppStore(s => s.dssSearchFilters);
  const setDssSearchFilters = useAppStore(s => s.setDssSearchFilters);
  const resetDssSearchFilters = useAppStore(s => s.resetDssSearchFilters);

  if (selectedItem) {
    if (selectedItem.isProjectItem) {
      return <DssProjectInfoPanel selectedItem={selectedItem} />;
    }
    return <DssModelInfoPanel selectedItem={selectedItem} />;
  }

  return <DssFilterPanel filters={dssSearchFilters} setFilters={setDssSearchFilters} resetFilters={resetDssSearchFilters} />;
};

const DssProjectInfoPanel: React.FC<{ selectedItem: any }> = ({ selectedItem }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', pb: 1.5, mb: -0.5 }}>
        <InfoOutlinedIcon sx={{ fontSize: 18, color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography sx={{ fontWeight: 600, color: 'var(--brand-fg)', letterSpacing: 0.5, fontSize: 12 }}>Project Info</Typography>
      </Box>

      {/* Project image/preview or icon */}
      <Box sx={{ width: '100%', aspectRatio: '4/3', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 11, fontWeight: 500 }}>No Preview Available</Typography>
      </Box>

      {/* Title */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5, display: 'block', fontSize: 10 }}>PROJECT NAME</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-fg)', px: 1, py: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 1 }}>{selectedItem.name || 'Untitled Project'}</Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Description */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5, display: 'block', fontSize: 10 }}>DESCRIPTION</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.8)', px: 1, py: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 1, minHeight: 40, whiteSpace: 'pre-wrap' }}>
          {selectedItem.description || 'No description provided.'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Project Metadata */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>OWNER</Typography>
          <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontSize: 10 }}>{selectedItem.ownerName || 'Unknown'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>TYPE</Typography>
          <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontSize: 10 }}>{selectedItem.isTeam ? 'Team Project' : 'Personal Project'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>VISIBILITY</Typography>
          <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontSize: 10 }}>{selectedItem.visibility === 'public' ? 'Public' : 'Private'}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

const DssModelInfoPanel: React.FC<{ selectedItem: any }> = ({ selectedItem: propSelectedItem }) => {
  const getMergedCategoryMap = useUserSettingsStore(s => s.getMergedCategoryMap);
  const mergedCategoryMap = getMergedCategoryMap();
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const setPanelSelection = useAppStore(s => s.setPanelSelection);
  const getMergedOptions = useUserSettingsStore(s => s.getMergedOptions);
  
  const buildingTypeOptions = getMergedOptions('buildingTypes');
  const roomOptions = getMergedOptions('rooms');
  const zoneOptions = getMergedOptions('zones');
  const companionClassOptions = getMergedOptions('companionClasses');
  const materialOptions = getMergedOptions('materials');

  const currentUser = useAuthStore(s => s.currentUser);

  const [localItemData, setLocalItemData] = useState<any>(null);
  useEffect(() => {
    setLocalItemData(null);
  }, [propSelectedItem.id]);

  const selectedItem = localItemData || propSelectedItem;
  const isAuthor = currentUser && (selectedItem.authorId === currentUser?.uid || selectedItem.ownerId === currentUser?.uid || selectedItem.createdBy === currentUser?.uid);
  
  const rhinoStatus = useDccStore(s => s.rhinoStatus);
  const openSetupModal = useDccStore(s => s.openSetupModal);

  // Sync Store
  const syncStatus = useDssSyncStore(s => s.statuses[selectedItem.id]);
  const isDirty = syncStatus?.isDirty;
  const clearSyncStatus = useDssSyncStore(s => s.clearDirtyStatus);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  const versionsObj = selectedItem.versions || {};
  const latestVersion = selectedItem.latestVersion || 1;
  const versionKeys = Object.keys(versionsObj).map(Number).sort((a,b) => b-a);
  const [selectedVersionId, setSelectedVersionId] = useState<number>(latestVersion);

  // Local Models のオンデマンドプレビュー変換（3dm/blend → GLB）。
  const [localPreviewGlb, setLocalPreviewGlb] = useState<string | null>(null);
  const [convertingPreview, setConvertingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    setLocalPreviewGlb(null);
    setPreviewError(null);
    setConvertingPreview(false);
    const it = propSelectedItem;
    if (!it?.isLocal || it.glbUrl) return; // 既に glb がある / 非ローカルなら変換不要
    const ext = String(it.topExt || '').toLowerCase();
    if ((ext !== '3dm' && ext !== 'blend') || !it.localPath) return;
    let cancelled = false;
    (async () => {
      try {
        const { invoke, convertFileSrc, isTauri } = await import('@tauri-apps/api/core');
        if (!isTauri()) return;
        setConvertingPreview(true);
        const glbPath = await invoke<string>('ensure_local_preview_glb', { path: it.localPath });
        if (!cancelled && glbPath) setLocalPreviewGlb(convertFileSrc(String(glbPath).replace(/\\/g, '/')));
      } catch (e) {
        if (!cancelled) setPreviewError(String(e));
      } finally {
        if (!cancelled) setConvertingPreview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [propSelectedItem?.id, propSelectedItem?.isLocal, propSelectedItem?.glbUrl, propSelectedItem?.localPath, propSelectedItem?.topExt]);
  const effectiveLocalGlbUrl = selectedItem.glbUrl || localPreviewGlb;

  // Local Models のクラウド保存状態・アップロード。
  const uploadRecords = useLocalUploadStore(s => s.records);
  const uploadingMap = useLocalUploadStore(s => s.uploading);
  const uploadLocalModel = useLocalUploadStore(s => s.upload);
  const revertLocalModel = useLocalUploadStore(s => s.revertToLocal);
  const refreshUploadRecords = useLocalUploadStore(s => s.refresh);
  const [cloudUploadDialogOpen, setCloudUploadDialogOpen] = useState(false);
  useEffect(() => { if (propSelectedItem?.isLocal) refreshUploadRecords(); }, [propSelectedItem?.isLocal, refreshUploadRecords]);
  const localUploadRec = propSelectedItem?.isLocal && propSelectedItem?.localPath
    ? uploadRecords[String(propSelectedItem.localPath).toLowerCase()] || null
    : null;
  const localUploading = propSelectedItem?.localPath ? !!uploadingMap[String(propSelectedItem.localPath).toLowerCase()] : false;

  const [isCompanionDialogOpen, setIsCompanionDialogOpen] = useState(false);
  const [companionSearchText, setCompanionSearchText] = useState('');
  const [availableCompanionModels, setAvailableCompanionModels] = useState<any[]>([]);
  const [isLoadingCompanions, setIsLoadingCompanions] = useState(false);

  const handleOpenCompanionDialog = async () => {
    setIsCompanionDialogOpen(true);
    setCompanionSearchText('');
    setIsLoadingCompanions(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const assetsRef = collection(db, 'assets');
      
      const qPublic = query(assetsRef, where('type', '==', '3d-model'), where('visibility', '==', 'public'));
      const snapPublic = await getDocs(qPublic);
      const publicItems = snapPublic.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let privateItems: any[] = [];
      if (currentUser?.uid) {
        const qPrivate = query(assetsRef, where('type', '==', '3d-model'), where('ownerId', '==', currentUser.uid));
        const snapPrivate = await getDocs(qPrivate);
        privateItems = snapPrivate.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      const mergedMap = new Map();
      [...publicItems, ...privateItems].forEach(item => {
        if (item.id !== selectedItem.id) {
          mergedMap.set(item.id, item);
        }
      });
      
      setAvailableCompanionModels(Array.from(mergedMap.values()));
    } catch (error) {
      console.error('Failed to fetch companion models', error);
    } finally {
      setIsLoadingCompanions(false);
    }
  };

  useEffect(() => {
    setSelectedVersionId(selectedItem.latestVersion || 1);
  }, [selectedItem.id, selectedItem.latestVersion]);

  const {
    startSendToRhino,
    isDraggingToRhino,
    openRhinoDocs,
    errorMessage,
    handleDropToRhino,
    handleCancelDrop,
    isSendingToRhino
  } = useRhinoDragImport();

  const handlePushNewVersion = async () => {
    if (!isAuthor) return;
    if (!syncStatus?.filePath) {
      alert("編集ファイルのパスが特定できません。Rhinoでこのモデルをもう一度開き直してから保存してください。");
      return;
    }
    setIsUploadingVersion(true);
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const normalizedPath = syncStatus.filePath.replace(/\\/g, '/');
      const fileData = await readFile(normalizedPath);
      
      const fileName = syncStatus.filePath.split(/[/\\]/).pop() || 'model.3dm';
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      const mimeType = fileExt === '3dm' ? 'application/octet-stream' : (fileExt === 'glb' ? 'model/gltf-binary' : 'application/octet-stream');
      const file = new File([fileData], fileName, { type: mimeType });
      Object.defineProperty(file, 'path', { value: syncStatus.filePath, writable: false });
      
      let companionGlbFile: File | null = null;
      let thumbnailFile: File | null = null;
      let newDimensions: { width: number; depth: number; height: number } | null = null;

      try {
        const { convert3dmToGlb } = await import('../upload/utils/convert3dmToGlb');
        const { extractDimensionsFromGlb } = await import('../upload/utils/extractDimensionsFromGlb');
        const { generateThumbnailFromGlb } = await import('../upload/utils/generateThumbnailFromGlb');

        let glbToProcess: File | null = null;

        if (fileExt === '3dm') {
          console.log('Converting 3DM to GLB for versioning...');
          companionGlbFile = await convert3dmToGlb(file);
          glbToProcess = companionGlbFile;
        } else if (fileExt === 'glb') {
          glbToProcess = file;
          // If primary is GLB, companion is not needed separately
          companionGlbFile = null; 
        }

        if (glbToProcess) {
          console.log('Generating thumbnail and extracting dimensions...');
          try {
            const thumbResult = await generateThumbnailFromGlb(glbToProcess);
            thumbnailFile = thumbResult.file;
          } catch (e) {
            console.warn('Thumbnail generation failed', e);
          }
          
          try {
            newDimensions = await extractDimensionsFromGlb(glbToProcess);
            console.log('Extracted new dimensions:', newDimensions);
          } catch (e) {
            console.warn('Dimensions extraction failed', e);
          }
        }
      } catch (err) {
        console.warn('Failed to process GLB/Thumbnail/Dimensions during pushNewVersion:', err);
      }

      // DIMENSIONSが抽出できた場合はeditDataを更新
      let updatedEditData = { ...editData };
      if (newDimensions) {
        updatedEditData = {
          ...updatedEditData,
          width: newDimensions.width.toString(),
          depth: newDimensions.depth.toString(),
          height: newDimensions.height.toString()
        };
        setEditData(updatedEditData);
      }
      
      // 全ての最新メタデータ（変更済みの寸法やその他のUI入力値を含む）を確実にFirestoreへ保存
      await persistModelInfo(updatedEditData);

      const canonicalId = getCanonicalModelId(selectedItem) || selectedItem.id;
      const { dssUploadService } = await import('../upload/dssUploadService');
      await dssUploadService.pushNewVersion(canonicalId, file, companionGlbFile, thumbnailFile, (p) => {
        console.log(`Uploading new version: ${p}%`);
      });
      
      clearSyncStatus(selectedItem.id);

      // Re-fetch local data to instantly show the new version in the UI!
      const { db } = await import('../../../lib/firebase/client');
      const { doc, getDoc } = await import('firebase/firestore');
      const updatedSnap = await getDoc(doc(db, 'assets', canonicalId));
      if (updatedSnap.exists()) {
        const data = updatedSnap.data();
        setLocalItemData({ ...selectedItem, ...data });
        setSelectedVersionId(data.latestVersion);
      }

      alert('最新版をWEBにアップロードしました。');
    } catch (e) {
      console.error(e);
      alert('アップロードに失敗しました: ' + e);
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const [activeDeleteVersion, setActiveDeleteVersion] = useState<number | null>(null);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);

  const confirmDeleteVersion = async () => {
    if (activeDeleteVersion === null || isDeletingVersion) return;
    setIsDeletingVersion(true);

    try {
      const versionId = activeDeleteVersion;
      const canonicalId = getCanonicalModelId(selectedItem) || selectedItem.id;
      const { dssUploadService } = await import('../upload/dssUploadService');
      await dssUploadService.deleteVersion(canonicalId, versionId);
      
      // Re-fetch local data to instantly show the deletion
      const { db } = await import('../../../lib/firebase/client');
      const { doc, getDoc } = await import('firebase/firestore');
      const updatedSnap = await getDoc(doc(db, 'assets', canonicalId));
      if (updatedSnap.exists()) {
        const data = updatedSnap.data();
        setLocalItemData({ ...selectedItem, ...data });
        setSelectedVersionId(data.latestVersion);
      }
      
      setActiveDeleteVersion(null);
    } catch (e: any) {
      console.error(e);
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('削除に失敗しました: ' + (e?.message || e), { title: 'エラー', kind: 'error' });
      setActiveDeleteVersion(null);
    } finally {
      setIsDeletingVersion(false);
    }
  };
  const [isManageVersionsOpen, setIsManageVersionsOpen] = useState(false);
  const [selectedVersionsToDelete, setSelectedVersionsToDelete] = useState<number[]>([]);
  const [isDeletingVersions, setIsDeletingVersions] = useState(false);

  const handleDeleteSelectedVersions = async () => {
    if (selectedVersionsToDelete.length === 0 || isDeletingVersions) return;
    setIsDeletingVersions(true);
    try {
      const canonicalId = getCanonicalModelId(selectedItem) || selectedItem.id;
      const { dssUploadService } = await import('../upload/dssUploadService');
      await dssUploadService.deleteVersions(canonicalId, selectedVersionsToDelete);
      
      // Re-fetch local data to instantly show the deletion
      const { db } = await import('../../../lib/firebase/client');
      const { doc, getDoc } = await import('firebase/firestore');
      const updatedSnap = await getDoc(doc(db, 'assets', canonicalId));
      if (updatedSnap.exists()) {
        const data = updatedSnap.data();
        setLocalItemData({ ...selectedItem, ...data });
        setSelectedVersionId(data.latestVersion);
      }
      
      setIsManageVersionsOpen(false);
      setSelectedVersionsToDelete([]);
    } catch (e: any) {
      console.error(e);
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('一括削除に失敗しました: ' + (e?.message || e), { title: 'エラー', kind: 'error' });
    } finally {
      setIsDeletingVersions(false);
    }
  };
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);

  const getInputSx = (fieldName: string) => {
    const isHighlighted = autoFilledFields.includes(fieldName);
    return {
      '& .MuiInputBase-root': { height: 26, fontSize: 11, transition: 'all 0.3s' },
      input: { color: isHighlighted ? 'light-dark(#aa8804, #facc15)' : 'var(--brand-fg)', bgcolor: isHighlighted ? 'rgba(250, 204, 21, 0.1)' : 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, px: 1 },
      fieldset: { borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.1)', transition: 'border-color 0.3s' },
      '&:hover fieldset': { borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.2)' }
    };
  };

  const getSelectSx = (fieldName: string) => {
    const isHighlighted = autoFilledFields.includes(fieldName);
    return {
      height: 26, fontSize: 11, color: isHighlighted ? 'light-dark(#aa8804, #facc15)' : 'var(--brand-fg)', bgcolor: isHighlighted ? 'rgba(250, 204, 21, 0.1)' : 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
      transition: 'all 0.3s',
      '.MuiOutlinedInput-notchedOutline': { borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.1)', transition: 'border-color 0.3s' },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.2)' }
    };
  };
  const getToggleSx = (fieldName: string) => {
    const isHighlighted = autoFilledFields.includes(fieldName);
    return { width: '100%', '& .MuiToggleButton-root': { transition: 'all 0.3s', flex: 1, py: 0.5, fontSize: 11, fontWeight: 500, color: 'text.secondary', borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: isHighlighted ? 'rgba(250, 204, 21, 0.05)' : 'transparent', textTransform: 'none', '&.Mui-selected': { bgcolor: 'rgba(79, 195, 247, 0.15)', color: 'light-dark(#0875a6, #4fc3f7)', borderColor: 'rgba(79, 195, 247, 0.3)', '&:hover': { bgcolor: 'rgba(79, 195, 247, 0.2)' } } } };
  };

  const inputSx = getInputSx(''); // Fallback
  const selectSx = getSelectSx(''); // Fallback
  const selectMenuProps = { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } } };

  const getAutocompleteSx = (fieldName?: string) => {
    const isHighlighted = fieldName && autoFilledFields.includes(fieldName);
    return {
      '& .MuiInputBase-root': { py: 0.5, minHeight: 26, fontSize: 11, color: isHighlighted ? 'light-dark(#aa8804, #facc15)' : 'var(--brand-fg)', bgcolor: isHighlighted ? 'rgba(250, 204, 21, 0.1)' : 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, transition: 'all 0.3s' },
      '& .MuiOutlinedInput-notchedOutline': { borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.1)', transition: 'border-color 0.3s' },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isHighlighted ? '#facc15' : 'rgb(var(--brand-fg-rgb) / 0.2)' },
      '& .MuiChip-root': { height: 18, fontSize: 10, bgcolor: isHighlighted ? 'rgba(250, 204, 21, 0.2)' : 'rgb(var(--brand-fg-rgb) / 0.1)', color: isHighlighted ? 'light-dark(#aa8804, #facc15)' : 'text.secondary', mt: 0.5, mb: 0.5, '& .MuiChip-deleteIcon': { color: isHighlighted ? 'light-dark(#aa8804, #facc15)' : 'text.secondary', fontSize: 14, '&:hover': { color: 'var(--brand-fg)' } } },
      '& .MuiAutocomplete-input': { p: '0 !important' },
    };
  };
  const autocompletePaperProps = {
    sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', '& .MuiAutocomplete-option': { fontSize: 11, minHeight: 'auto', p: 1 } }
  };



  const [editData, setEditData] = useState({
    id: '',
    title: '',
    macroCategory: '家具 (既製品)',
    mainCategory: '',
    subCategory: '',
    tags: [] as string[],
    buildingTypes: [] as string[],
    rooms: [] as string[],
    zones: [] as string[],
    companionClasses: [] as string[],
    materials: [] as string[],
    width: '',
    depth: '',
    height: '',
    price: '',
    relatedLinks: [] as { title: string; url: string; thumbnail?: string; source?: string }[],
    catalogLinks: [] as { title: string; url: string; price?: string; thumbnail?: string; source?: string }[],
    visibility: 'public',
    character: null as any,
    gimmick: null as any,
  });
  // 編集中の寸法を 3Dビューワ（プレビュー/詳細画面）へ即時共有する
  const setLiveDimensions = useDssLiveDimensionsStore(s => s.setLiveDimensions);
  const liveTargetDimensions = useMemo(() => ({
    width: Number(editData.width) || 0,
    depth: Number(editData.depth) || 0,
    height: Number(editData.height) || 0,
  }), [editData.width, editData.depth, editData.height]);

  useEffect(() => {
    if (!editData.id) return;
    setLiveDimensions(editData.id, liveTargetDimensions);
  }, [editData.id, liveTargetDimensions, setLiveDimensions]);

  const [tagInput, setTagInput] = useState('');
  const [urlTitleInput, setUrlTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  // カタログ登録（RELATED URLs とは別の項目）の追加フォーム入力。
  const [catTitleInput, setCatTitleInput] = useState('');
  const [catUrlInput, setCatUrlInput] = useState('');

  const parseCatalogLinks = (item: any) => {
    if (Array.isArray(item.catalogLinks)) return [...item.catalogLinks];
    return [] as { title: string; url: string; price?: string; thumbnail?: string; source?: string }[];
  };

  const parseRelatedLinks = (item: any) => {
    if (Array.isArray(item.relatedLinks)) return [...item.relatedLinks];
    const links: { title: string, url: string }[] = [];
    if (Array.isArray(item.sourceUrls)) {
      item.sourceUrls.forEach((url: string) => {
        if (typeof url === 'string') links.push({ title: '関連リンク', url });
      });
    } else if (item.sourceUrl) {
      links.push({ title: '関連リンク', url: item.sourceUrl });
    }
    return links;
  };
  const [isSaving, setIsSaving] = useState(false);

  // Track when we have unsaved changes to prevent overwriting user input
  // while allowing selectedItem updates (e.g. from auto-save or external sync) to refresh editData
  const [isFormDirty, setIsFormDirty] = useState(false);
  // selectedItem 由来の relatedLinks/catalogLinks の署名。編集中でも「外部で実際に変わった時だけ」
  // 反映するために使う（手動削除など editData 側の変更を外部更新と誤認して上書きしないため）。
  const lastExtSigRef = useRef<string>('');

  useEffect(() => {
    if (selectedItem) {
      const typeStr = (selectedItem.modelType || selectedItem.type) === 'Architecture' ? 'Architecture' : 'Furniture';
      const isCustom = selectedItem.tags?.includes('造作家具') || selectedItem.readyStatus === 'custom';
      
      const newEditData = {
        id: selectedItem.id,
        title: selectedItem.title || selectedItem.name || 'Untitled',
        macroCategory: selectedItem.macroCategory || (typeStr === 'Architecture' ? '建築・空間' : (isCustom ? '家具 (造作)' : '家具 (既製品)')),
        mainCategory: selectedItem.mainCategory || '',
        subCategory: selectedItem.userCategory || selectedItem.subCategory || '',
        tags: Array.isArray(selectedItem.tags) ? [...selectedItem.tags] : [],
        buildingTypes: Array.isArray(selectedItem.buildingTypes) ? [...selectedItem.buildingTypes] : [],
        rooms: Array.isArray(selectedItem.rooms) ? [...selectedItem.rooms] : [],
        zones: Array.isArray(selectedItem.zones) ? [...selectedItem.zones] : [],
        companionClasses: Array.isArray(selectedItem.companionClasses) ? [...selectedItem.companionClasses] : [],
        materials: Array.isArray(selectedItem.materials) ? [...selectedItem.materials] : [],
        width: selectedItem.dimensions?.width?.toString() || '',
        depth: selectedItem.dimensions?.depth?.toString() || '',
        height: selectedItem.dimensions?.height?.toString() || '',
        price: selectedItem.price?.toString() || '',
        relatedLinks: parseRelatedLinks(selectedItem),
        catalogLinks: parseCatalogLinks(selectedItem),
        companionModels: Array.isArray(selectedItem.companionModels) ? [...selectedItem.companionModels] : [],
        visibility: selectedItem.visibility || 'public',
        character: selectedItem.extendedMetadata?.character || null,
        gimmick: selectedItem.extendedMetadata?.gimmick || null,
      };

      // Only synchronize if the user hasn't made unsaved changes, or if the ID changed.
      const extSig = JSON.stringify([newEditData.relatedLinks, newEditData.catalogLinks]);
      const idChanged = editData.id !== selectedItem.id;

      if (idChanged) {
        setIsFormDirty(false);
        setTagInput('');
        setAutoFilledFields([]);
        lastExtSigRef.current = extSig;
        setEditData(newEditData);
      } else if (!isFormDirty) {
        lastExtSigRef.current = extSig;
        setEditData(newEditData);
      } else if (extSig !== lastExtSigRef.current) {
        // 編集中(dirty)でも、selectedItem 側の relatedLinks/catalogLinks が「実際に」変わった時だけ
        // 反映する（外部の自動登録など）。editData 側だけの手動編集（削除/追加）は上書きしない。
        lastExtSigRef.current = extSig;
        setEditData((prev) => ({ ...prev, relatedLinks: newEditData.relatedLinks, catalogLinks: newEditData.catalogLinks }));
      }
    }
  }, [selectedItem, isFormDirty]);

  // カタログ登録のサムネ補完: Storage 未アップロード（thumbnail 無し）のものは、ローカルの
  // S.Library カタログ索引（cropDataUrl）から商品URLをキーに引いて表示する。
  const [catalogThumbMap, setCatalogThumbMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const cl = editData.catalogLinks || [];
    if (cl.length === 0 || !cl.some((l: any) => l && l.url && !l.thumbnail)) return;
    let mounted = true;
    import('../../dsk/catalog/catalogVisionStore')
      .then(async (mod) => {
        try {
          const items = await mod.getAllItems();
          if (!mounted) return;
          const map: Record<string, string> = {};
          for (const it of items) { if (it.productUrl && it.cropDataUrl) map[it.productUrl] = it.cropDataUrl; }
          setCatalogThumbMap(map);
        } catch { /* noop */ }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [editData.catalogLinks]);

  // Compute Original Data to detect changes
  const originalData = useMemo(() => {
    if (!selectedItem) return null;
    const typeStr = (selectedItem.modelType || selectedItem.type) === 'Architecture' ? 'Architecture' : 'Furniture';
    const isCustom = selectedItem.tags?.includes('造作家具') || selectedItem.readyStatus === 'custom';
    return {
      id: selectedItem.id,
      title: selectedItem.title || selectedItem.name || 'Untitled',
      macroCategory: selectedItem.macroCategory || (typeStr === 'Architecture' ? '建築・空間' : (isCustom ? '家具 (造作)' : '家具 (既製品)')),
      mainCategory: selectedItem.mainCategory || '',
      subCategory: selectedItem.userCategory || selectedItem.subCategory || '',
      tags: Array.isArray(selectedItem.tags) ? [...selectedItem.tags] : [],
      buildingTypes: Array.isArray(selectedItem.buildingTypes) ? [...selectedItem.buildingTypes] : [],
      rooms: Array.isArray(selectedItem.rooms) ? [...selectedItem.rooms] : [],
      zones: Array.isArray(selectedItem.zones) ? [...selectedItem.zones] : [],
      companionClasses: Array.isArray(selectedItem.companionClasses) ? [...selectedItem.companionClasses] : [],
      materials: Array.isArray(selectedItem.materials) ? [...selectedItem.materials] : [],
      width: selectedItem.dimensions?.width?.toString() || '',
      depth: selectedItem.dimensions?.depth?.toString() || '',
      height: selectedItem.dimensions?.height?.toString() || '',
      price: selectedItem.price?.toString() || '',
      relatedLinks: parseRelatedLinks(selectedItem),
      catalogLinks: parseCatalogLinks(selectedItem),
      companionModels: Array.isArray(selectedItem.companionModels) ? [...selectedItem.companionModels] : [],
      visibility: selectedItem.visibility || 'public',
      character: selectedItem.extendedMetadata?.character || null,
      gimmick: selectedItem.extendedMetadata?.gimmick || null,
    };
  }, [selectedItem]);

  const hasChanged = useMemo(() => {
    if (!originalData) return false;
    if (editData.id !== originalData.id) return false;
    const changed = JSON.stringify(editData) !== JSON.stringify(originalData);
    setIsFormDirty(changed);
    return changed;
  }, [editData, originalData]);

  // Core persist logic
  const persistModelInfo = async (dataToSave: any) => {
    setIsSaving(true);
    try {
      let updatedTags = [...(dataToSave.tags || [])];
      if (dataToSave.macroCategory === '家具 (造作)') {
        if (!updatedTags.includes('造作家具')) updatedTags.push('造作家具');
        updatedTags = updatedTags.filter(t => t !== '既製品家具');
      } else if (dataToSave.macroCategory === '家具 (既製品)') {
        if (!updatedTags.includes('既製品家具')) updatedTags.push('既製品家具');
        updatedTags = updatedTags.filter(t => t !== '造作家具');
      } else {
        updatedTags = updatedTags.filter(t => t !== '既製品家具' && t !== '造作家具');
      }

      const state = useUserSettingsStore.getState();
      let saveMainCategory = dataToSave.mainCategory;
      let saveSubCategory = dataToSave.subCategory;
      let saveUserCategory: string | null = null;

      const customCat = state.customCategories.find(c => c.name === dataToSave.subCategory);
      if (customCat) {
        saveMainCategory = dataToSave.mainCategory;
        saveSubCategory = ''; // We don't have a 3rd level base category, so leave empty
        saveUserCategory = customCat.name;
      }

      // Determine legacy type based on macroCategory to maintain backward compatibility
      const inferredModelType = dataToSave.macroCategory === '建築・空間' ? 'Architecture' : 'Furniture';

      const updatedPayload = {
        title: dataToSave.title,
        name: dataToSave.title, // keep sync
        type: '3d-model', // MUST BE 3d-model to appear in assets query
        modelType: inferredModelType, // Map Furniture/Architecture here
        macroCategory: dataToSave.macroCategory,
        mainCategory: saveMainCategory,
        subCategory: saveSubCategory,
        userCategory: saveUserCategory,
        tags: updatedTags,
        buildingTypes: dataToSave.buildingTypes || [],
        rooms: dataToSave.rooms || [],
        zones: dataToSave.zones || [],
        companionClasses: dataToSave.companionClasses || [],
        materials: dataToSave.materials || [],
        dimensions: {
          ...(selectedItem.dimensions || {}),
          width: Number(dataToSave.width) || 0,
          depth: Number(dataToSave.depth) || 0,
          height: Number(dataToSave.height) || 0
        },
        price: Number(dataToSave.price) || 0,
        relatedLinks: dataToSave.relatedLinks || [],
        catalogLinks: dataToSave.catalogLinks || [],
        companionModels: dataToSave.companionModels || [],
        sourceUrl: dataToSave.relatedLinks?.[0]?.url || '',
        visibility: dataToSave.visibility || 'public',
        // ウォークスルー設定（既存 extendedMetadata を温存しつつ character/gimmick をマージ）
        extendedMetadata: {
          ...(selectedItem.extendedMetadata || {}),
          character: dataToSave.character || null,
          gimmick: dataToSave.gimmick || null,
        },
      };

      const isProjectAsset = !!selectedItem.sourceModelId || !!selectedItem.metadata?.sourceModelId || !!selectedItem.originalModelId;

      if (isProjectAsset && activeProjectId) {
        // Update Project Asset directly
        try {
          const { projectAssetsApi } = await import('../../projects/api/projectAssetsApi');
          await projectAssetsApi.updateAsset(activeProjectId, selectedItem.id, {
            ...updatedPayload,
            name: dataToSave.title,
            tags: updatedTags
          });
          console.log(`Updated Project Asset ${selectedItem.id}`);

          // Sync back to Global Asset
          const sourceId = selectedItem.sourceModelId || selectedItem.metadata?.sourceModelId || selectedItem.originalModelId;
          if (sourceId) {
            try {
              // Attempt to update the global asset. Firestore security rules will prevent it if the user is not the owner.
              await WorkspaceItemRepository.updateGlobalAsset(sourceId, updatedPayload);
              console.log(`Synced changes back to Global Asset ${sourceId}`);
            } catch (err) {
              console.warn('Could not sync to global asset (user might not be the owner):', err);
            }
          }
        } catch (err) {
          console.error('Failed to update Project Asset properties:', err);
          throw err;
        }
      } else {
        // Update Global Asset
        await WorkspaceItemRepository.updateGlobalAsset(selectedItem.id, updatedPayload);

        if (activeProjectId) {
          try {
            const { projectAssetsApi } = await import('../../projects/api/projectAssetsApi');
            const isAssetInProject = await projectAssetsApi.findAssetBySourceModelId(activeProjectId, selectedItem.id);
            if (isAssetInProject) {
              await projectAssetsApi.updateAsset(activeProjectId, isAssetInProject.id, {
                ...updatedPayload,
                name: dataToSave.title,
                tags: updatedTags,
              });
              console.log(`Synced model info to project asset ${isAssetInProject.id}`);
            }
          } catch (err) {
            console.error('Failed to sync updated Model Info to Project Asset:', err);
          }
        }
      }

      if (activeWorkspaceId) {
        setPanelSelection(activeWorkspaceId, {
          ...selectedItem,
          ...updatedPayload
        });
      }

      // Capture User Feedback for AI Studio
      const isAIFeedback = 
        dataToSave.mainCategory !== originalData?.mainCategory || 
        dataToSave.subCategory !== originalData?.subCategory ||
        dataToSave.width !== originalData?.width ||
        dataToSave.depth !== originalData?.depth ||
        dataToSave.height !== originalData?.height;

      if (isAIFeedback && originalData) {
        const { useAiProfileStore } = await import('../../../store/useAiProfileStore');
        let contentStr = '';
        if (dataToSave.mainCategory !== originalData.mainCategory || dataToSave.subCategory !== originalData.subCategory) {
          contentStr += `Category: [${originalData.mainCategory || 'None'}/${originalData.subCategory || 'None'}] -> [${dataToSave.mainCategory || 'None'}/${dataToSave.subCategory || 'None'}]. `;
        }
        if (dataToSave.width !== originalData.width || dataToSave.height !== originalData.height || dataToSave.depth !== originalData.depth) {
          contentStr += `Dimensions: W${originalData.width}xD${originalData.depth}xH${originalData.height} -> W${dataToSave.width}xD${dataToSave.depth}xH${dataToSave.height}.`;
        }

        useAiProfileStore.getState().logSaveDataEvent({
          userId: currentUser?.uid || 'unknown',
          actionType: 'METADATA_CORRECTED',
          content: `User corrected metadata for "${dataToSave.title}": ${contentStr.trim()}`,
          context: {
            targetId: selectedItem.id,
            targetType: 'asset',
            source: 'user',
            payload: { before: originalData, after: dataToSave }
          }
        });
      }
    } catch (err) {
      console.error('Failed to save asset properties:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save logic
  const saveTimeoutRef = useRef<any>(null);
  const flushSaveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (hasChanged && isAuthor && !isAutoFilling && originalData && !isCompanionDialogOpen) {
      flushSaveRef.current = () => persistModelInfo(editData);
    } else {
      flushSaveRef.current = null;
    }
  }, [editData, hasChanged, isAuthor, isAutoFilling, originalData, isCompanionDialogOpen]);

  useEffect(() => {
    if (flushSaveRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (flushSaveRef.current) {
          flushSaveRef.current();
          flushSaveRef.current = null;
        }
      }, 1500);
    }
  }, [editData]);

  useEffect(() => {
    return () => {
      if (flushSaveRef.current) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        flushSaveRef.current();
        flushSaveRef.current = null;
      }
    };
  }, [selectedItem?.id]);


  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() && isAuthor) {
      e.preventDefault();
      if (!editData.tags.includes(tagInput.trim())) {
        setEditData({ ...editData, tags: [...editData.tags, tagInput.trim()] });
      }
      setTagInput('');
    }
  };

  const handleAutoFill = async () => {
    if (!isAuthor) return;
    setIsAutoFilling(true);
    setAutoFilledFields([]);
    try {
      const canonicalId = getCanonicalModelId(selectedItem) || selectedItem.id;
      const resolvedGlbUrl = await resolveDownloadUrl(selectedItem, 'glb', canonicalId);
      const { executeAiAutoFill } = await import('../utils/aiAutoFillService');
      const res = await executeAiAutoFill(editData.title, editData.tags, resolvedGlbUrl || '');
      
      const newEditData = { ...editData };
      let filledFields: string[] = res.autoFilledFields || [];
      if (res.mainCategory) {
        newEditData.macroCategory = res.mainCategory;
        newEditData.mainCategory = res.subCategory || '';
        newEditData.subCategory = res.detailedCategory || '';
        newEditData.type = res.type || editData.type;
        filledFields.push('macroCategory', 'mainCategory');
        if (res.detailedCategory) filledFields.push('subCategory');
      }
      if (res.tags && res.tags.length > 0) {
        newEditData.tags = Array.from(new Set([...(editData.tags || []), ...res.tags]));
        filledFields.push('tags');
      }
      if (res.rooms && res.rooms.length > 0) {
         newEditData.rooms = Array.from(new Set([...(editData.rooms || []), ...res.rooms]));
         filledFields.push('rooms');
      }
      if (res.zones && res.zones.length > 0) {
         newEditData.zones = Array.from(new Set([...(editData.zones || []), ...res.zones]));
         filledFields.push('zones');
      }
      if (res.buildingTypes && res.buildingTypes.length > 0) {
         newEditData.buildingTypes = Array.from(new Set([...(editData.buildingTypes || []), ...res.buildingTypes]));
         filledFields.push('buildingTypes');
      }
      if (res.companionClasses && res.companionClasses.length > 0) {
         newEditData.companionClasses = Array.from(new Set([...(editData.companionClasses || []), ...res.companionClasses]));
         filledFields.push('companionClasses');
      }
      if (res.materials && res.materials.length > 0) {
         newEditData.materials = Array.from(new Set([...(editData.materials || []), ...res.materials]));
         filledFields.push('materials');
      }
      
      if (res.dimensions) {
        newEditData.width = res.dimensions.width;
        newEditData.depth = res.dimensions.depth;
        newEditData.height = res.dimensions.height;
      }
      
      setEditData(newEditData);
      setAutoFilledFields(filledFields);
      
      // Implicitly save the AI-filled data to Firestore and state store
      await persistModelInfo(newEditData);
      
      setTimeout(() => setAutoFilledFields([]), 3500);
      
    } catch (e) {
      console.error('Failed to execute AI Auto-fill', e);
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!isAuthor) return;
    setEditData({ ...editData, tags: editData.tags.filter(t => t !== tagToRemove) });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', pb: 1.5, mb: -0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'light-dark(#0875a6, #4fc3f7)' }} />
          <Typography sx={{ fontWeight: 600, color: 'var(--brand-fg)', letterSpacing: 0.5, fontSize: 11, whiteSpace: 'nowrap' }}>Model Info</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
          {isSaving && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'light-dark(#0875a6, #4fc3f7)' }}>
              <CircularProgress size={10} color="inherit" />
              <Typography sx={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>保存中...</Typography>
            </Box>
          )}

          {isDirty && isAuthor && (
            <Button
              size="small"
              variant="contained"
              disabled={isUploadingVersion}
              onClick={handlePushNewVersion}
              startIcon={<CloudUploadRoundedIcon sx={{ fontSize: 12 }} />}
              sx={{
                textTransform: 'none',
                fontSize: 10,
                height: 24,
                minWidth: 0,
                px: 1,
                borderRadius: 1,
                bgcolor: '#ce93d8',
                color: '#000',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#ba68c8' }
              }}
            >
              {isUploadingVersion ? 'UP中...' : 'WEBにUP'}
            </Button>
          )}

          <Button 
            size="small" 
            variant="contained"
            disabled={isSendingToRhino}
            startIcon={rhinoStatus === 'connected' ? <SendRoundedIcon sx={{ fontSize: 12 }} /> : <ErrorOutlineRoundedIcon sx={{ fontSize: 12 }}/>} 
            onClick={() => {
              if (rhinoStatus !== 'connected') {
                openSetupModal('rhino');
                return;
              }
              const targetModel = selectedVersionId === latestVersion 
                ? selectedItem 
                : { ...selectedItem, ...versionsObj[selectedVersionId] };
              startSendToRhino(targetModel);
            }}
            sx={{ 
              textTransform: 'none', 
              fontSize: 10, 
              height: 24, 
              minWidth: 0, 
              px: 1, 
              borderRadius: 1, 
              bgcolor: rhinoStatus === 'connected' ? 'rgba(22,163,74,0.9)' : 'rgba(245, 158, 11, 0.9)', 
              color: 'var(--brand-fg)', 
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: rhinoStatus === 'connected' ? 'rgba(22,163,74,1)' : 'rgba(245, 158, 11, 1)' } 
            }}
          >
            {isSendingToRhino ? '読込中...' : (rhinoStatus === 'connected' ? 'Rhinoへ' : 'セットアップ')}
          </Button>
        </Box>
      </Box>

      {/* Rhino Drop Zone Overlay */}
      <RhinoDropZone
        open={isDraggingToRhino}
        docs={openRhinoDocs}
        errorMessage={errorMessage}
        onSelectDoc={(docId) => handleDropToRhino({ docId })}
        onClose={handleCancelDrop}
      />

      {/* Model Preview */}
      <Box sx={{ width: '100%', aspectRatio: '4/3', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {((versionsObj[selectedVersionId] && versionsObj[selectedVersionId].glbUrl) || (selectedVersionId === latestVersion && effectiveLocalGlbUrl)) ? (
          <RightPanelModelViewer
            modelUrl={(versionsObj[selectedVersionId] && versionsObj[selectedVersionId].glbUrl) || effectiveLocalGlbUrl}
            versionId={selectedVersionId}
            targetDimensions={editData.id === selectedItem.id ? liveTargetDimensions : null}
          />
        ) : convertingPreview ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={22} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 10 }}>プレビュー生成中…</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 9 }}>{String(selectedItem.topExt || '').toUpperCase()} を変換しています</Typography>
          </Box>
        ) : ((versionsObj[selectedVersionId] && versionsObj[selectedVersionId].thumbnailUrl) || (selectedVersionId === latestVersion && (selectedItem.thumbnailUrl || selectedItem.imageUrl))) ? (
          <img src={(versionsObj[selectedVersionId] && versionsObj[selectedVersionId].thumbnailUrl) || selectedItem.thumbnailUrl || selectedItem.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.75)' }} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, px: 2, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 11, fontWeight: 500 }}>No Preview Available</Typography>
            {previewError && (
              <Typography sx={{ color: 'light-dark(rgba(173,0,0,0.55), rgba(255,120,120,0.55))', fontSize: 9, lineHeight: 1.3 }}>変換に失敗しました</Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Local Models: クラウド保存（公開/非公開） */}
      {selectedItem.isLocal && (
        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1.5, border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
          {localUploadRec ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {localUploadRec.visibility === 'private'
                ? <LockRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#aa4e03, #fb923c)' }} />
                : <PublicRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#2f07a6, #a78bfa)' }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)' }}>
                  クラウド保存済み · {localUploadRec.visibility === 'private' ? '非公開' : '公開'}
                </Typography>
                <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  {localUploadRec.visibility === 'private' ? 'Private Models に保存されています' : 'Public Models に公開されています'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Button
              size="small" variant="contained" fullWidth disabled={localUploading}
              startIcon={localUploading ? <CircularProgress size={12} color="inherit" /> : <CloudUploadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => setCloudUploadDialogOpen(true)}
              sx={{ fontSize: 12, bgcolor: '#7c3aed', '&:hover': { bgcolor: '#8b5cf6' } }}
            >
              クラウドへ保存
            </Button>
          )}
          {localUploadRec && (
            <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                size="small" variant="text" disabled={localUploading}
                onClick={() => setCloudUploadDialogOpen(true)}
                sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', minWidth: 0 }}
              >
                {localUploadRec.visibility === 'private' ? '公開に変更' : '公開設定を変更'}
              </Button>
              <Button
                size="small" variant="text" disabled={localUploading}
                onClick={() => {
                  if (window.confirm('クラウドのデータを削除してローカルのみに戻します。\nクラウド（公開/非公開）からは見えなくなります。よろしいですか？')) {
                    revertLocalModel(selectedItem);
                  }
                }}
                sx={{ fontSize: 10.5, color: 'light-dark(#ad0000, #ff6b6b)', minWidth: 0 }}
              >
                {localUploading ? <CircularProgress size={12} color="inherit" /> : 'ローカルに戻す'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* クラウド保存ダイアログ（自動カテゴライズ） */}
      <LocalCloudUploadDialog
        open={cloudUploadDialogOpen}
        model={selectedItem}
        uploading={localUploading}
        onClose={() => setCloudUploadDialogOpen(false)}
        onConfirm={async (meta, visibility) => {
          try {
            await uploadLocalModel(selectedItem, visibility, meta);
            setCloudUploadDialogOpen(false);
          } catch { /* エラーはストア側で通知 */ }
        }}
      />

      {/* Version Selector */}
      {versionKeys.length > 0 && (
        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>バージョンを選択:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Select
              size="small"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
              sx={{
                ...selectSx,
                minWidth: 100,
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)',
                '& .MuiSelect-select': { py: 0.5, px: 2, fontSize: 12, fontWeight: 600 }
              }}
              MenuProps={selectMenuProps}
              renderValue={(selected) => `v${selected} ${selected === latestVersion ? '(最新版)' : ''}`}
            >
              {versionKeys.map(v => (
                <MenuItem key={v} value={v} sx={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>v{v} {v === latestVersion ? '(最新版)' : ''}</Box>
                  {isAuthor && (
                    <IconButton 
                      size="small" 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveDeleteVersion(v);
                      }}
                      sx={{ 
                        color: 'rgb(var(--brand-fg-rgb) / 0.3)', 
                        p: 0.5,
                        mr: -1,
                        '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' } 
                      }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </MenuItem>
              ))}
            </Select>
            {isAuthor && (
              <IconButton 
                size="small" 
                onClick={() => {
                  setSelectedVersionsToDelete([]);
                  setIsManageVersionsOpen(true);
                }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
              >
                <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      {/* AI Auto-fill Button */}
      {isAuthor && (
        <Button
          fullWidth
          variant="outlined"
          onClick={handleAutoFill}
          disabled={isAutoFilling}
          sx={{
            py: 1,
            mt: 0.5,
            bgcolor: 'rgba(250, 204, 21, 0.05)', 
            color: 'light-dark(#aa8804, #facc15)', 
            borderColor: 'rgba(250, 204, 21, 0.3)',
            fontWeight: 600,
            fontSize: 12,
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(250, 204, 21, 0.1)', borderColor: '#facc15' }
          }}
        >
          {isAutoFilling ? 'AIモデル解析中...' : '✨ AIによる寸法・カテゴリ自動入力'}
        </Button>
      )}

      {/* Title */}
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5, display: 'block', fontSize: 10 }}>TITLE</Typography>
        {isAuthor ? (
          <TextField 
            fullWidth 
            size="small" 
            value={editData.title} 
            onChange={(e) => setEditData({...editData, title: e.target.value})}
            sx={{ ...inputSx, input: { ...inputSx.input, fontWeight: 500, fontSize: 12 } }} 
          />
        ) : (
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-fg)', px: 1, py: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 1 }}>{selectedItem.title || selectedItem.name || 'Untitled'}</Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Visibility */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5, display: 'block', fontSize: 10 }}>VISIBILITY</Typography>
        {isAuthor ? (
          <ToggleButtonGroup
            value={editData.visibility}
            exclusive
            onChange={(_e, val) => { if(val) setEditData({...editData, visibility: val}); }}
            size="small"
            sx={{ width: '100%', '& .MuiToggleButton-root': { flex: 1, py: 0.5, fontSize: 11, fontWeight: 500, color: 'text.secondary', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', textTransform: 'none', '&.Mui-selected': { bgcolor: 'rgba(79, 195, 247, 0.15)', color: 'light-dark(#0875a6, #4fc3f7)', borderColor: 'rgba(79, 195, 247, 0.3)', '&:hover': { bgcolor: 'rgba(79, 195, 247, 0.2)' } } } }}
          >
            <ToggleButton value="public">全体公開</ToggleButton>
            <ToggleButton value="private">非公開（自分のみ）</ToggleButton>
          </ToggleButtonGroup>
        ) : (
          <Chip size="small" label={selectedItem.visibility === 'private' ? '非公開' : '全体公開'} sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'var(--brand-fg)', fontSize: 11, borderRadius: 1 }} />
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Categories */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>CATEGORIZATION</Typography>
        {isAuthor ? (
          <>
            <Select 
              size="small" 
              value={editData.macroCategory} 
              onChange={(e) => setEditData({...editData, macroCategory: e.target.value as string, mainCategory: '', subCategory: ''})} 
              displayEmpty 
              sx={getSelectSx('macroCategory')} 
              MenuProps={selectMenuProps}
            >
              <MenuItem value="" sx={{ fontSize: 11, fontStyle: 'italic', color: 'text.secondary' }}>Select Primary Type</MenuItem>
              {MACRO_CATEGORY_ORDER
                .filter(c => Object.keys(useUserSettingsStore.getState().getMergedCategoryMap()).includes(c))
                .map(macro => (
                <MenuItem key={macro} value={macro} sx={{ fontSize: 11 }}>{macro}</MenuItem>
              ))}
            </Select>

            <Select 
              size="small" 
              disabled={!editData.macroCategory} 
              value={editData.mainCategory} 
              onChange={(e) => setEditData({...editData, mainCategory: e.target.value as string, subCategory: ''})} 
              displayEmpty 
              sx={getSelectSx('mainCategory')} 
              MenuProps={selectMenuProps}
            >
              <MenuItem value="" sx={{ fontSize: 11, fontStyle: 'italic', color: 'text.secondary' }}>Select Category</MenuItem>
              {editData.macroCategory && useUserSettingsStore.getState().getMergedCategoryMap()[editData.macroCategory] && Object.keys(useUserSettingsStore.getState().getMergedCategoryMap()[editData.macroCategory] || {}).map(cat => (
                <MenuItem key={cat} value={cat} sx={{ fontSize: 11 }}>{cat}</MenuItem>
              ))}
            </Select>

            <Select 
              size="small" 
              disabled={!editData.mainCategory} 
              value={editData.subCategory} 
              onChange={(e) => setEditData({...editData, subCategory: e.target.value as string})} 
              displayEmpty 
              sx={getSelectSx('subCategory')} 
              MenuProps={selectMenuProps}
            >
              <MenuItem value="" sx={{ fontSize: 11, fontStyle: 'italic', color: 'text.secondary' }}>Select Detailed Category</MenuItem>
              {editData.macroCategory && editData.mainCategory && useUserSettingsStore.getState().getMergedCategoryMap()[editData.macroCategory]?.[editData.mainCategory]?.map(sub => (
                <MenuItem key={sub} value={sub} sx={{ fontSize: 11 }}>{sub}</MenuItem>
              ))}
            </Select>
          </>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
             {selectedItem.macroCategory && (
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.65)', px: 1, py: 0.5, bgcolor: 'rgba(165, 214, 167, 0.1)', borderRadius: 1, display: 'inline-flex', width: 'fit-content' }}>{selectedItem.macroCategory}</Typography>
             )}
             <Box sx={{ display: 'flex', gap: 1 }}>
                <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', px: 1, py: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 1, display: 'inline-flex' }}>{selectedItem.mainCategory || 'Uncategorized'}</Typography>
                {selectedItem.subCategory && (
                   <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 1, py: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 1, display: 'inline-flex' }}>{selectedItem.subCategory}</Typography>
                )}
             </Box>
          </Box>
        )}
      </Box>



      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Dimensions & Price */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>DIMENSIONS (mm)</Typography>
        {isAuthor ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" placeholder="1800" value={editData.width} onChange={(e) => setEditData({...editData, width: e.target.value})} sx={getInputSx('width')} InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 10, color: 'text.secondary', mr: -0.5 }}>W</Typography></InputAdornment>, sx: { fontSize: 11 } }} fullWidth />
            <TextField size="small" placeholder="600" value={editData.depth} onChange={(e) => setEditData({...editData, depth: e.target.value})} sx={getInputSx('depth')} InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 10, color: 'text.secondary', mr: -0.5 }}>D</Typography></InputAdornment>, sx: { fontSize: 11 } }} fullWidth />
            <TextField size="small" placeholder="700" value={editData.height} onChange={(e) => setEditData({...editData, height: e.target.value})} sx={getInputSx('height')} InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 10, color: 'text.secondary', mr: -0.5 }}>H</Typography></InputAdornment>, sx: { fontSize: 11 } }} fullWidth />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)' }}><Typography component="span" sx={{ fontSize: 10, color: 'text.secondary', mr: 0.5 }}>W</Typography>{selectedItem.dimensions?.width || '---'}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>×</Typography>
            <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)' }}><Typography component="span" sx={{ fontSize: 10, color: 'text.secondary', mr: 0.5 }}>D</Typography>{selectedItem.dimensions?.depth || '---'}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>×</Typography>
            <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)' }}><Typography component="span" sx={{ fontSize: 10, color: 'text.secondary', mr: 0.5 }}>H</Typography>{selectedItem.dimensions?.height || '---'}</Typography>
          </Box>
        )}

        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10, mt: 0.5 }}>PRICE (JPY)</Typography>
        {isAuthor ? (
          <TextField fullWidth size="small" value={editData.price} onChange={(e) => setEditData({...editData, price: e.target.value})} placeholder="価格" sx={inputSx} />
        ) : (
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-fg)', px: 1, py: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 1 }}>{selectedItem.price ? `¥${Number(selectedItem.price).toLocaleString()}` : '未設定'}</Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Spatial Context */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>SPATIAL CONTEXT</Typography>
        
        {isAuthor ? (
          <>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>BUILDING TYPES (建物タイプ)</Typography>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={buildingTypeOptions}
                value={editData.buildingTypes}
                onChange={(_, newValue) => setEditData({...editData, buildingTypes: newValue})}
                sx={getAutocompleteSx('buildingTypes')}
                PaperComponent={props => <Box {...props} sx={autocompletePaperProps.sx} />}
                renderInput={(params) => <TextField {...params} placeholder={editData.buildingTypes.length === 0 ? "住宅, レストラン..." : ""} />}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>ROOMS (部屋)</Typography>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={roomOptions}
                value={editData.rooms}
                onChange={(_, newValue) => setEditData({...editData, rooms: newValue})}
                sx={getAutocompleteSx('rooms')}
                PaperComponent={props => <Box {...props} sx={autocompletePaperProps.sx} />}
                renderInput={(params) => <TextField {...params} placeholder={editData.rooms.length === 0 ? "リビング, ダイニング..." : ""} />}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>ZONES (機能ゾーン)</Typography>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={zoneOptions}
                value={editData.zones}
                onChange={(_, newValue) => setEditData({...editData, zones: newValue})}
                sx={getAutocompleteSx('zones')}
                PaperComponent={props => <Box {...props} sx={autocompletePaperProps.sx} />}
                renderInput={(params) => <TextField {...params} placeholder={editData.zones.length === 0 ? "リラックス, 作業..." : ""} />}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>COMPANION CLASSES (セット家具タグ)</Typography>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={companionClassOptions}
                value={editData.companionClasses}
                onChange={(_, newValue) => setEditData({...editData, companionClasses: newValue})}
                sx={getAutocompleteSx('companionClasses')}
                PaperComponent={props => <Box {...props} sx={autocompletePaperProps.sx} />}
                renderInput={(params) => <TextField {...params} placeholder={editData.companionClasses.length === 0 ? "ダイニングセット..." : ""} />}
              />
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'BUILDING TYPES', data: selectedItem.buildingTypes },
              { label: 'ROOMS', data: selectedItem.rooms },
              { label: 'ZONES', data: selectedItem.zones },
              { label: 'COMPANION', data: selectedItem.companionClasses }
            ].map(({ label, data }) => (
              <Box key={label}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>{label}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {Array.isArray(data) && data.length > 0 ? (
                    data.map((item: string) => (
                      <Chip key={item} label={item} size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'var(--brand-fg)', fontSize: 10, height: 20 }} />
                    ))
                  ) : (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>Not specified</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Meta */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>META: TAGS & MATERIALS</Typography>

        {isAuthor ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>MATERIALS (素材)</Typography>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={materialOptions}
                value={editData.materials}
                onChange={(_, newValue) => setEditData({...editData, materials: newValue})}
                sx={getAutocompleteSx('materials')}
                PaperComponent={props => <Box {...props} sx={autocompletePaperProps.sx} />}
                renderInput={(params) => <TextField {...params} placeholder={editData.materials.length === 0 ? "オーク, スチール..." : ""} />}
              />
            </Box>
            
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>CUSTOM TAGS</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                {editData.tags && editData.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" onDelete={isAuthor ? () => handleRemoveTag(tag) : undefined} sx={{ bgcolor: autoFilledFields.includes('tags') ? 'rgba(250, 204, 21, 0.2)' : 'rgb(var(--brand-fg-rgb) / 0.1)', color: autoFilledFields.includes('tags') ? 'light-dark(#aa8804, #facc15)' : 'text.secondary', fontSize: 10, height: 20, '& .MuiChip-deleteIcon': { color: 'text.secondary', fontSize: 14, '&:hover': { color: 'var(--brand-fg)' } } }} />
                ))}
                {editData.tags.length === 0 && (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>No tags provided</Typography>
                )}
              </Box>
              <TextField fullWidth disabled={!isAuthor} size="small" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="+ タグを追加 (Enter)" sx={{ ...getInputSx('tags'), mt: 0.5 }} />
              {useUserSettingsStore.getState().customTags.filter(t => !editData.tags.includes(t)).length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, pt: 0.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                  <Typography sx={{ width: '100%', fontSize: 9, color: 'text.secondary', mb: 0.5 }}>マイタグから追加:</Typography>
                  {useUserSettingsStore.getState().customTags.filter(t => !editData.tags.includes(t)).map(tag => (
                    <Chip 
                      key={`custom-add-${tag}`} 
                      onClick={() => setEditData({ ...editData, tags: [...editData.tags, tag] })} 
                      label={`+ ${tag}`} 
                      size="small" 
                      sx={{ bgcolor: 'rgba(250, 204, 21, 0.1)', color: 'light-dark(#aa8804, #facc15)', fontSize: 9, height: 20, '&:hover': { bgcolor: 'rgba(250, 204, 21, 0.2)' } }} 
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>MATERIALS</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Array.isArray(selectedItem.materials) && selectedItem.materials.length > 0 ? (
                  selectedItem.materials.map((m: string) => (
                    <Chip key={m} label={m} size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'var(--brand-fg)', fontSize: 10, height: 20 }} />
                  ))
                ) : (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>Not specified</Typography>
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, mb: 0.5, display: 'block' }}>TAGS</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Array.isArray(selectedItem.tags) && selectedItem.tags.length > 0 ? (
                  selectedItem.tags.map((tag: string) => (
                    <Chip key={tag} label={tag} size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'text.secondary', fontSize: 10, height: 20 }} />
                  ))
                ) : (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>No tags</Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Related URLs */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>RELATED URLs (関連URL)</Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {editData.relatedLinks && editData.relatedLinks.map((link, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(79, 195, 247, 0.05)', px: 1, py: 0.5, borderRadius: 1 }}>
              {editingLinkIndex === idx ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <TextField 
                    fullWidth size="small" 
                    value={editLinkTitle} onChange={(e) => setEditLinkTitle(e.target.value)}
                    placeholder="タイトル" sx={{ ...getInputSx('relatedLinks'), '& input': { fontSize: 11, py: 0.5 } }} 
                  />
                  <TextField 
                    fullWidth size="small" 
                    value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)}
                    placeholder="URL" sx={{ ...getInputSx('relatedLinks'), '& input': { fontSize: 10, py: 0.5 } }} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const updatedLinks = [...editData.relatedLinks];
                        updatedLinks[idx] = { title: editLinkTitle || '関連リンク', url: editLinkUrl };
                        setEditData({ ...editData, relatedLinks: updatedLinks });
                        setEditingLinkIndex(null);
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
                    <Typography sx={{ fontSize: 10, cursor: 'pointer', color: 'text.secondary', '&:hover': { color: 'var(--brand-fg)' } }} onClick={() => setEditingLinkIndex(null)}>キャンセル</Typography>
                    <Typography sx={{ fontSize: 10, cursor: 'pointer', color: 'light-dark(#0875a6, #4fc3f7)', '&:hover': { color: 'light-dark(#0774a7, #81d4fa)' } }} onClick={() => {
                        const updatedLinks = [...editData.relatedLinks];
                        updatedLinks[idx] = { title: editLinkTitle || '関連リンク', url: editLinkUrl };
                        setEditData({ ...editData, relatedLinks: updatedLinks });
                        setEditingLinkIndex(null);
                    }}>保存</Typography>
                  </Box>
                </Box>
              ) : (
                <>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, flexShrink: 0, overflow: 'hidden', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {link.thumbnail
                      ? <Box component="img" src={link.thumbnail} alt="" referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <LinkRoundedIcon sx={{ fontSize: 16, color: 'light-dark(rgba(8,117,166,0.6), rgba(79,195,247,0.6))' }} />}
                  </Box>
                  <Box
                    sx={{ flex: 1, overflow: 'hidden', cursor: 'pointer', py: 0.5, '&:hover': { opacity: 0.8 } }}
                    onClick={(e) => {
                      e.stopPropagation();
                      let targetUrl = link.url;
                      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                        targetUrl = 'https://' + targetUrl;
                      }
                      import('@tauri-apps/plugin-opener')
                        .then(({ openUrl }) => {
                          if (openUrl) openUrl(targetUrl);
                          else window.open(targetUrl, '_blank');
                        })
                        .catch(() => window.open(targetUrl, '_blank'));
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {link.title || '関連リンク'}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'light-dark(#0875a6, #4fc3f7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'underline' }}>
                      {link.url}
                    </Typography>
                  </Box>
                  {isAuthor && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setEditingLinkIndex(idx);
                          setEditLinkTitle(link.title);
                          setEditLinkUrl(link.url);
                        }}
                        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', p: 0.5, '&:hover': { color: 'light-dark(#0875a6, #4fc3f7)', bgcolor: 'rgba(79, 195, 247, 0.1)' } }}
                      >
                        <EditRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => setEditData({ ...editData, relatedLinks: editData.relatedLinks.filter((_, i) => i !== idx) })}
                        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', p: 0.5, '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  )}
                </>
              )}
            </Box>
          ))}
          {!isAuthor && (!editData.relatedLinks || editData.relatedLinks.length === 0) && (
             <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>未設定</Typography>
          )}
        </Box>

        {isAuthor && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5, p: 1, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9 }}>新しいリンクを追加</Typography>
            <TextField 
              fullWidth 
              size="small" 
              value={urlTitleInput} 
              onChange={(e) => setUrlTitleInput(e.target.value)}
              placeholder="タイトル (例: メーカー製品ページ)" 
              sx={getInputSx('relatedLinks')} 
            />
            <TextField 
              fullWidth 
              size="small" 
              value={urlInput} 
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlInput.trim()) {
                  e.preventDefault();
                  const newLink = { title: urlTitleInput.trim() || '関連リンク', url: urlInput.trim() };
                  setEditData({ ...editData, relatedLinks: [...editData.relatedLinks, newLink] });
                  setUrlInput('');
                  setUrlTitleInput('');
                }
              }}
              placeholder="URL (https://...) + Enterで追加"
              sx={getInputSx('relatedLinks')}
            />
          </Box>
        )}

      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* カタログ登録（S.Library カタログ照合の商品を登録。RELATED URLs とは別管理） */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>カタログ登録 (CATALOG)</Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {editData.catalogLinks && editData.catalogLinks.map((link, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(134, 239, 172, 0.06)', px: 1, py: 0.5, borderRadius: 1 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 1, flexShrink: 0, overflow: 'hidden', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(link.thumbnail || catalogThumbMap[link.url])
                  ? <Box component="img" src={link.thumbnail || catalogThumbMap[link.url]} alt="" referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <LinkRoundedIcon sx={{ fontSize: 16, color: 'light-dark(rgba(20,153,68,0.6), rgba(134,239,172,0.6))' }} />}
              </Box>
              <Box
                sx={{ flex: 1, overflow: 'hidden', cursor: 'pointer', py: 0.5, '&:hover': { opacity: 0.8 } }}
                onClick={(e) => {
                  e.stopPropagation();
                  let targetUrl = link.url;
                  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) targetUrl = 'https://' + targetUrl;
                  import('@tauri-apps/plugin-opener')
                    .then(({ openUrl }) => { if (openUrl) openUrl(targetUrl); else window.open(targetUrl, '_blank'); })
                    .catch(() => window.open(targetUrl, '_blank'));
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {link.title || 'カタログ商品'}
                  </Typography>
                  {link.price && (
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'light-dark(#149944, #86efac)', flexShrink: 0 }}>{link.price}</Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: 10, color: 'light-dark(#149944, #86efac)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'underline' }}>
                  {link.source || link.url}
                </Typography>
              </Box>
              {isAuthor && (
                <IconButton
                  size="small"
                  onClick={() => setEditData({ ...editData, catalogLinks: editData.catalogLinks.filter((_, i) => i !== idx) })}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', p: 0.5, '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          ))}
          {!isAuthor && (!editData.catalogLinks || editData.catalogLinks.length === 0) && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>未設定</Typography>
          )}
        </Box>

        {isAuthor && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5, p: 1, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9 }}>カタログ商品を手動追加（または S.Library カタログ照合から登録）</Typography>
            <TextField
              fullWidth size="small"
              value={catTitleInput}
              onChange={(e) => setCatTitleInput(e.target.value)}
              placeholder="商品名（例: SHADOWS ラウンジチェア）"
              sx={getInputSx('relatedLinks')}
            />
            <TextField
              fullWidth size="small"
              value={catUrlInput}
              onChange={(e) => setCatUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && catUrlInput.trim()) {
                  e.preventDefault();
                  const newLink = { title: catTitleInput.trim() || 'カタログ商品', url: catUrlInput.trim() };
                  setEditData({ ...editData, catalogLinks: [...editData.catalogLinks, newLink] });
                  setCatUrlInput('');
                  setCatTitleInput('');
                }
              }}
              placeholder="商品URL (https://...) + Enterで追加"
              sx={getInputSx('relatedLinks')}
            />
          </Box>
        )}
      </Box>

      {isAuthor && isSaving && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Typography sx={{ fontSize: 10, color: 'light-dark(#0875a6, #4fc3f7)', fontStyle: 'italic' }}>Saving changes...</Typography>
        </Box>
      )}
      {activeDeleteVersion !== null && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>バージョンを削除</Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 3, fontSize: 14 }}>
              本当にバージョン v{activeDeleteVersion} を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => !isDeletingVersion && setActiveDeleteVersion(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: isDeletingVersion ? "not-allowed" : "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={() => !isDeletingVersion && confirmDeleteVersion()} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isDeletingVersion ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isDeletingVersion ? 0.5 : 1 }}>
                {isDeletingVersion ? '削除中...' : '削除'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Set Furniture Dialog */}
      <Dialog 
        open={isCompanionDialogOpen} 
        onClose={() => setIsCompanionDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 400, maxWidth: 500, height: 500 } }}
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          セット家具を追加
          <TextField
            placeholder="モデルを検索..."
            size="small"
            value={companionSearchText}
            onChange={(e) => setCompanionSearchText(e.target.value)}
            sx={{ width: 200, '& .MuiOutlinedInput-root': { bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', color: 'var(--brand-fg)', borderRadius: 1 }, '& input': { fontSize: 12, py: 0.5 } }}
          />
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {isLoadingCompanions ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, py: 4 }}>
              <CircularProgress size={24} sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
            </Box>
          ) : (
            <List sx={{ pt: 0, overflowY: 'auto' }}>
              {availableCompanionModels
                .filter(m => !companionSearchText || m.title?.toLowerCase().includes(companionSearchText.toLowerCase()) || m.name?.toLowerCase().includes(companionSearchText.toLowerCase()))
                .filter(m => !(editData.companionModels || []).some((c: any) => c.id === m.id))
                .map(m => (
                <ListItem key={m.id} disablePadding>
                  <ListItemButton 
                    onClick={() => {
                      const newCompanion = { id: m.id, title: m.title || m.name || 'Untitled', thumbnailUrl: m.thumbnailUrl || m.thumbnail || '' };
                      setEditData({ ...editData, companionModels: [...(editData.companionModels || []), newCompanion] });
                    }}
                    sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }, display: 'flex', gap: 2, py: 1 }}
                  >
                    <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: 'hidden', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', flexShrink: 0 }}>
                      {(m.thumbnailUrl || m.thumbnail) ? (
                        <img src={m.thumbnailUrl || m.thumbnail} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 20, m: 1 }} />
                      )}
                    </Box>
                    <ListItemText 
                      primary={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-fg)' }}>{m.title || m.name || 'Untitled'}</Typography>}
                      secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{m.visibility === 'public' ? 'Public' : 'Private'} / {m.macroCategory || ''}</Typography>}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {availableCompanionModels.length === 0 && (
                <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>モデルが見つかりません</Typography>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', px: 3, py: 1.5 }}>
          <Button onClick={() => setIsCompanionDialogOpen(false)} sx={{ color: 'text.secondary', textTransform: 'none', '&:hover': { color: 'var(--brand-fg)' } }}>
            キャンセル
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Versions Dialog */}
      <Dialog 
        open={isManageVersionsOpen} 
        onClose={() => !isDeletingVersions && setIsManageVersionsOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 320 } }}
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', pb: 1.5 }}>
          バージョン一括削除
        </DialogTitle>
        <DialogContent sx={{ p: 0, maxHeight: 400 }}>
          <List sx={{ pt: 0 }}>
            {versionKeys.map(v => {
              const isSelected = selectedVersionsToDelete.includes(v);
              return (
                <ListItem key={v} disablePadding>
                  <ListItemButton 
                    onClick={() => {
                      if (isSelected) {
                        setSelectedVersionsToDelete(prev => prev.filter(id => id !== v));
                      } else {
                        setSelectedVersionsToDelete(prev => [...prev, v]);
                      }
                    }}
                    sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox 
                        edge="start" 
                        checked={isSelected} 
                        tabIndex={-1} 
                        disableRipple 
                        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&.Mui-checked': { color: '#ef4444' } }}
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`v${v} ${v === latestVersion ? '(最新版)' : ''}`} 
                      primaryTypographyProps={{ fontSize: 13, fontWeight: v === latestVersion ? 600 : 400, color: isSelected ? '#ef4444' : 'var(--brand-fg)' }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 1.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
          <Button 
            onClick={() => setIsManageVersionsOpen(false)} 
            disabled={isDeletingVersions}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 12 }}
          >
            キャンセル
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            disabled={selectedVersionsToDelete.length === 0 || isDeletingVersions || selectedVersionsToDelete.length === versionKeys.length}
            onClick={handleDeleteSelectedVersions}
            sx={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}
          >
            {isDeletingVersions ? '削除中...' : `${selectedVersionsToDelete.length}件を削除`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const getCategoryIcon = (catName: string): React.ElementType => {
  if (catName === 'すべて' || catName === 'ALL') return AppsIcon;
  if (catName.includes('ソファ')) return WeekendIcon;
  if (catName.includes('チェア') || catName.includes('椅子')) return ChairIcon;
  if (catName.includes('テーブル') || catName.includes('机')) return TableRestaurantIcon;
  if (catName.includes('ベッド')) return BedIcon;
  if (catName.includes('収納') || catName.includes('ボード')) return KitchenIcon;
  if (catName.includes('什器') || catName.includes('店舗') || catName.includes('オフィス')) return StorefrontIcon;
  if (catName.includes('キッズ') || catName.includes('ベビー')) return ChildCareIcon;
  if (catName.includes('建具') || catName.includes('ドア') || catName.includes('窓')) return MeetingRoomIcon;
  if (catName.includes('外構') || catName.includes('屋外')) return ParkIcon;
  if (catName.includes('建築') || catName.includes('建物') || catName.includes('躯体')) return DomainIcon;
  if (catName.includes('水回り') || catName.includes('衛生') || catName.includes('サニタリー')) return BathtubIcon;
  if (catName.includes('照明')) return LightIcon;
  if (catName.includes('家電') || catName.includes('デバイス')) return TvIcon;
  if (catName.includes('グリーン') || catName.includes('植物') || catName.includes('植栽')) return YardIcon;
  if (catName.includes('装飾') || catName.includes('アート') || catName.includes('趣味')) return ColorLensIcon;
  if (catName.includes('ファブリック')) return CheckroomIcon;
  if (catName.includes('日用品') || catName.includes('テーブルウェア')) return RestaurantIcon;
  if (catName.includes('その他') || catName.includes('備品') || catName.includes('雑貨') || catName.includes('小物')) return LocalOfferIcon;
  
  return CategoryIcon;
};

const DssFilterPanel: React.FC<{ filters: any, setFilters: any, resetFilters: () => void }> = ({ filters, setFilters, resetFilters }) => {
  const getMergedCategoryMap = useUserSettingsStore(s => s.getMergedCategoryMap);
  const mergedCategoryMap = getMergedCategoryMap();
  const inputSx = { '& .MuiInputBase-root': { height: 26, fontSize: 11 }, input: { color: 'var(--brand-fg)', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, px: 1 }, fieldset: { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } };
  const selectSx = { height: 26, fontSize: 11, color: 'var(--brand-fg)', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } };
  const selectMenuProps = { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } } };

  // Resolve dynamic categories based on user selection
  // Fallback to "家具 (既製品)" if ALL is selected, just to show some generic subcategories rather than empty
  const activePrimaryType = filters.type && mergedCategoryMap[filters.type] ? filters.type : '家具 (既製品)';
  const availableCategories = ['すべて', ...Object.keys(mergedCategoryMap[activePrimaryType] || {})];
  const activeCategoryUI = filters.category === 'ALL' || !filters.category ? 'すべて' : filters.category;
  const availableDetailed = activeCategoryUI !== 'すべて' && mergedCategoryMap[activePrimaryType][activeCategoryUI] 
      ? mergedCategoryMap[activePrimaryType][activeCategoryUI] 
      : [];
      
  const availableLayoutPaths = useAppStore(s => s.availableLayoutPaths);
  const modelsScope = useAppStore(s => s.modelsScope);
  const isProjectScope = modelsScope === 'project_models' || modelsScope === 'team_project_models';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pb: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', pb: 1.5, mb: -0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterAltIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} />
          <Typography sx={{ fontWeight: 600, color: 'var(--brand-fg)', letterSpacing: 0.5, fontSize: 12 }}>Search & Filter</Typography>
        </Box>
        <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 12 }} />} sx={{ color: 'text.secondary', textTransform: 'none', fontSize: 10, height: 22, minWidth: 0, px: 1, borderRadius: 1, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }} onClick={resetFilters}>
          Reset
        </Button>
      </Box>

      {/* Layout Placement */}
      {isProjectScope && availableLayoutPaths.length > 0 && (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>IN LAYOUT</Typography>
            <FormControl fullWidth size="small">
              <Select 
                multiple
                value={filters.layoutPaths || []} 
                displayEmpty
                onChange={(e) => setFilters({layoutPaths: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value})} 
                sx={selectSx} 
                MenuProps={selectMenuProps}
                renderValue={(selected) => {
                  if ((selected as string[]).length === 0) {
                    return <Typography sx={{ fontSize: 11, fontStyle: 'italic', color: 'text.secondary' }}>No layout filter</Typography>;
                  }
                  return <Typography sx={{ fontSize: 11 }}>{(selected as string[]).join(', ')}</Typography>;
                }}
              >
                {availableLayoutPaths.map(path => (
                  <MenuItem key={path} value={path} sx={{ fontSize: 11 }}>
                    {path}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />
        </>
      )}

      {/* Formats */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>FILE FORMAT</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {['ALL', '3DM', 'BLEND', 'GLB'].map((fmt) => {
            const isActive = filters.format === fmt || (fmt === 'ALL' && !filters.format);
            return (
              <Button key={fmt} fullWidth disableElevation variant="outlined" sx={{ color: isActive ? 'rgb(var(--brand-fg-rgb) / 0.65)' : 'text.secondary', fontWeight: isActive ? 600 : 400, borderColor: isActive ? '#a5d6a7' : 'rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: isActive ? 'rgba(165, 214, 167, 0.15)' : 'transparent', textTransform: 'none', fontSize: 10, height: 28, borderRadius: 1.5, '&:hover': { borderColor: '#a5d6a7', color: 'rgb(var(--brand-fg-rgb) / 0.65)', bgcolor: 'rgba(165, 214, 167, 0.05)' } }} onClick={() => setFilters({format: fmt === 'ALL' ? '' : fmt})}>{fmt}</Button>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Primary Category Toggles */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>PRIMARY CATEGORY</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', p: 0.5, borderRadius: 1.5, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
          <Button fullWidth disableElevation sx={{ gridColumn: '1 / -1', color: filters.type === 'ALL' || !filters.type ? 'rgb(var(--brand-fg-rgb) / 0.65)' : 'text.secondary', fontWeight: filters.type === 'ALL' || !filters.type ? 600 : 400, fontSize: 10, height: 26, borderRadius: 1, bgcolor: filters.type === 'ALL' || !filters.type ? 'rgba(165, 214, 167, 0.15)' : 'transparent', '&:hover': { bgcolor: 'rgba(165, 214, 167, 0.1)' }, whiteSpace: 'nowrap' }} onClick={() => setFilters({type: 'ALL', category: 'ALL', subCategory: 'ALL'})}>ALL</Button>
          {MACRO_CATEGORY_ORDER.filter(c => Object.keys(mergedCategoryMap).includes(c)).map((macroCat) => {
            return (
              <Button key={macroCat} fullWidth disableElevation sx={{ color: filters.type === macroCat ? 'rgb(var(--brand-fg-rgb) / 0.65)' : 'text.secondary', fontWeight: filters.type === macroCat ? 600 : 400, fontSize: 10, height: 26, borderRadius: 1, bgcolor: filters.type === macroCat ? 'rgba(165, 214, 167, 0.15)' : 'transparent', '&:hover': { bgcolor: 'rgba(165, 214, 167, 0.1)' }, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => setFilters({type: macroCat, category: 'ALL', subCategory: 'ALL', wantsReady: false, wantsCustom: false})}>{macroCat}</Button>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Sub Categories Grid */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>SUB CATEGORIES</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {availableCategories.map((cat) => {
            const logicalCat = cat === 'すべて' ? 'ALL' : cat;
            const isActive = filters.category === logicalCat || (logicalCat === 'ALL' && (!filters.category || filters.category === 'ALL'));
            const IconComp = getCategoryIcon(cat);
            return (
              <Button key={cat} variant="outlined" sx={{ flexDirection: 'column', py: 1.5, px: 0.5, color: isActive ? 'rgb(var(--brand-fg-rgb) / 0.65)' : 'text.secondary', borderColor: isActive ? 'rgba(165, 214, 167, 0.3)' : 'rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: isActive ? 'rgba(165, 214, 167, 0.05)' : 'transparent', borderRadius: 1.5, fontSize: 9, minWidth: 0, textTransform: 'none', '&:hover': { borderColor: '#a5d6a7', color: 'rgb(var(--brand-fg-rgb) / 0.65)', bgcolor: 'rgba(165, 214, 167, 0.05)' } }} onClick={() => setFilters({category: logicalCat, subCategory: 'ALL'})}>
                <IconComp sx={{ mb: 0.5, fontSize: 16, opacity: isActive ? 1 : 0.8 }} />
                {cat}
              </Button>
            );
          })}
        </Box>
        <FormControl fullWidth size="small" sx={{ mt: 0.5 }} disabled={availableDetailed.length === 0}>
          <Select value={filters.subCategory || 'ALL'} sx={selectSx} MenuProps={selectMenuProps} onChange={(e) => setFilters({subCategory: e.target.value === 'ALL' ? '' : e.target.value})}>
            <MenuItem value="ALL" sx={{ fontSize: 11 }}>詳細カテゴリ: すべて</MenuItem>
            {availableDetailed.map(d => (
               <MenuItem key={d} value={d} sx={{ fontSize: 11 }}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>



      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Tags */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>TAGS</Typography>
        <TextField fullWidth size="small" placeholder="例: 北欧, シンプル" sx={inputSx} value={filters.tags || ''} onChange={(e) => setFilters({tags: e.target.value})} />
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Extended Metadata */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>EXTENDED METADATA</Typography>
        <TextField fullWidth size="small" placeholder="BUILDING TYPES (例: 住宅, 店舗)" sx={inputSx} value={filters.buildingTypes || ''} onChange={(e) => setFilters({buildingTypes: e.target.value})} />
        <TextField fullWidth size="small" placeholder="ROOMS (例: リビング, 厨房)" sx={inputSx} value={filters.rooms || ''} onChange={(e) => setFilters({rooms: e.target.value})} />
        <TextField fullWidth size="small" placeholder="ZONES (例: 作業, リラックス)" sx={inputSx} value={filters.zones || ''} onChange={(e) => setFilters({zones: e.target.value})} />
        <TextField fullWidth size="small" placeholder="MATERIALS (例: 木材, スチール)" sx={inputSx} value={filters.materials || ''} onChange={(e) => setFilters({materials: e.target.value})} />
        <TextField fullWidth size="small" placeholder="COMPANION (例: ダイニングセット)" sx={inputSx} value={filters.companionClasses || ''} onChange={(e) => setFilters({companionClasses: e.target.value})} />
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

      {/* Dimensions & Price */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>DIMENSIONS & PRICE</Typography>
        
        {['幅 (W) / mm', '奥行 (D) / mm', '高さ (H) / mm'].map((dim) => (
          <Box key={dim}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: -0.5 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>{dim}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>0 - MAX</Typography>
            </Box>
            <Box sx={{ px: 1 }}>
              <Slider defaultValue={[0, 100]} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', py: 1.5, '& .MuiSlider-thumb': { width: 12, height: 12 } }} size="small" />
            </Box>
          </Box>
        ))}
      </Box>
      
    </Box>
  );
};
