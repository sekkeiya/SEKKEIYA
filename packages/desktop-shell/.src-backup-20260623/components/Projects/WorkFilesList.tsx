import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, Tooltip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import FileCopyRoundedIcon from '@mui/icons-material/FileCopyRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { InlineWorkFilePreview } from './InlineWorkFilePreview';
import {
  constructLocalDirPath, getLocalVersions, createNextLocalVersion,
  downloadFileToLocal, getDefaultBaseDirPath, getAllLocalVersions,
  renameLocalDirectory, deleteLocalDirectory, deleteLocalFile, renameLocalFile,
  type LocalVersionInfo
} from '../../features/projects/utils/workFileFsHelpers';
import { useWorkFileSyncStore } from '../../store/useWorkFileSyncStore';
import { WorkFileRepository } from '../../features/projects/workFileRepository';
import { useWorkFileStore } from '../../store/useWorkFileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

import type { WorkFile, DesktopProject, RhinoTemplate } from '../../features/projects/types';
import RhinoTemplateDialog from './RhinoTemplateDialog';
import { PreviewDialog } from './PreviewDialog';

interface WorkFilesListProps {
  project: DesktopProject;
}

export const WorkFilesList: React.FC<WorkFilesListProps> = ({ project }) => {
  const [workFiles, setWorkFiles] = useState<WorkFile[]>([]);
  const [versionsMap, setVersionsMap] = useState<Record<string, LocalVersionInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateComment, setDuplicateComment] = useState('');
  const [pastVersionSaveDialogOpen, setPastVersionSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<{ fileId: string; path: string } | null>(null);
  const [editVersionDialogOpen, setEditVersionDialogOpen] = useState(false);
  const [editVersionName, setEditVersionName] = useState('');
  const [versionToEdit, setVersionToEdit] = useState<{ fileId: string; path: string; originalName: string } | null>(null);

  const [show3DPreview, setShow3DPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; version?: string; tool?: string; fileId: string; localPath?: string } | null>(null);

  const [infoDialogType, setInfoDialogType] = useState<'upload' | 'fork' | null>(null);
  const [folderSettingsDialogOpen, setFolderSettingsDialogOpen] = useState(false);
  const [customBaseDir, setCustomBaseDir] = useState('');
  const [defaultBaseDir, setDefaultBaseDir] = useState('');
  const [cloudOverwriteDialogOpen, setCloudOverwriteDialogOpen] = useState(false);

  const bindings = useWorkFileStore(state => state.bindings);
  const notifyUpdate = useWorkFileStore(state => state.notifyUpdate);
  const lastUpdated = useWorkFileStore(state => state.lastUpdated);
  const registerActiveFile = useWorkFileSyncStore(state => state.registerActiveFile);
  const fileStatuses = useWorkFileSyncStore(state => state.statuses);
  const { currentUser } = useAuthStore.getState();

  useEffect(() => {
    const saved = localStorage.getItem(`sekkeiya_project_${project.id}_workfiles_dir`);
    if (saved) setCustomBaseDir(saved);
    getDefaultBaseDirPath(project.id).then(setDefaultBaseDir).catch(console.error);
  }, [project.id]);

  const handleSelectFolder = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setCustomBaseDir(selected);
        localStorage.setItem(`sekkeiya_project_${project.id}_workfiles_dir`, selected);
        await fetchFiles();
      }
    } catch (err) { console.error(err); }
  };

  const handleResetDefaultFolder = async () => {
    setCustomBaseDir('');
    localStorage.removeItem(`sekkeiya_project_${project.id}_workfiles_dir`);
    await fetchFiles();
  };

  const fetchFiles = async () => {
    setLoading(true);
    const files = await WorkFileRepository.getWorkFiles(project.id);
    setWorkFiles(files);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, [project.id, lastUpdated]);

  const selectedFile = workFiles.find(f => f.id === selectedFileId);

  useEffect(() => {
    workFiles.forEach(file => {
      constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType).then(dirPath => {
        registerActiveFile(file.id, {
          projectId: project.id,
          localPath: dirPath,
          latestVersionCreatedAt: file.updatedAt ? new Date(file.updatedAt).getTime() : null,
          latestVersionId: file.currentVersionId || null,
        });
        const existingBinding = useWorkFileStore.getState().getBinding(file.id);
        if (existingBinding && (existingBinding.localPath !== dirPath || existingBinding.projectId !== project.id)) {
          useWorkFileStore.getState().saveBinding(file.id, { ...existingBinding, localPath: dirPath, projectId: project.id });
        }
      });
    });
  }, [workFiles, project.id, project.name, registerActiveFile]);

  useEffect(() => {
    if (selectedFile) {
      getAllLocalVersions(project.id, selectedFile.id, project.name, selectedFile.name, selectedFile.toolType).then(vers => {
        setVersionsMap(prev => ({ ...prev, [selectedFile.id]: vers }));
      });
    }
  }, [selectedFile, project.id, project.name]);

  useEffect(() => { setShow3DPreview(false); }, [selectedFileId]);

  const toggleExpand = async (fileId: string) => {
    const isExpanded = expandedFiles[fileId];
    setExpandedFiles(prev => ({ ...prev, [fileId]: !isExpanded }));
    if (!isExpanded && !versionsMap[fileId]) {
      const file = workFiles.find(f => f.id === fileId);
      const vers = await getAllLocalVersions(project.id, fileId, project.name, file?.name, file?.toolType);
      setVersionsMap(prev => ({ ...prev, [fileId]: vers }));
    }
  };

  const handleOpenLocal = async (file: WorkFile, pastVersionPath?: string) => {
    try {
      useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'rhino');
      const activeInfo = useWorkFileSyncStore.getState().activeFiles[file.id];
      const dirPath = activeInfo?.localPath || await constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType);
      let targetPath: string;
      if (pastVersionPath) {
        targetPath = pastVersionPath;
        alert('過去の作業ファイルを開いています。上書き保存(Ctrl+S)すると過去の履歴が書き換わりますのでご注意ください。（別名保存推奨）');
      } else {
        targetPath = await createNextLocalVersion(dirPath, file.name || 'design');
      }
      await invoke('launch_rhino', { templatePath: '', targetFilePath: targetPath });
      const binding = bindings[file.id];
      useWorkFileStore.getState().saveBinding(file.id, {
        ...(binding || { existsLocally: true, localPath: dirPath }),
        openedVersionId: undefined,
        lastOpenedAt: new Date().toISOString(),
      });
      await WorkFileRepository.updateWorkFileTime(project.id, file.id, currentUser?.uid || 'unknown');
      await WorkFileRepository.logActivity({ projectId: project.id, type: 'work_file_opened', targetType: 'workFile', targetId: file.id, userId: currentUser?.uid || 'unknown' });
      const vers = await getAllLocalVersions(project.id, file.id, project.name, file.name, file.toolType);
      setVersionsMap(prev => ({ ...prev, [file.id]: vers }));
    } catch (e) {
      alert('開けませんでした: ' + e);
    } finally {
      useAppStore.getState().setGlobalLaunchingTool(null);
    }
  };

  const openVersionPreview = (e: React.MouseEvent, file: WorkFile, versionPath: string) => {
    e.stopPropagation();
    setPreviewFile({ name: file.name, version: versionPath.split(/[\\/]/).pop()!, tool: file.toolType || 'rhino', fileId: file.id, localPath: versionPath });
    setPreviewOpen(true);
  };

  const handleDownloadCloudLatest = async (file: WorkFile) => {
    if (!file.currentVersionId) { alert('クラウド履歴が存在しません。'); return; }
    setUploading(true);
    try {
      const cloudVersions = await WorkFileRepository.getVersions(project.id, file.id);
      const latestV = cloudVersions.find(v => v.id === file.currentVersionId);
      if (!latestV || !latestV.storagePath) { alert('選択した版にはファイルデータが存在しません'); return; }
      const downloadUrl = await WorkFileRepository.getStorageDownloadUrl(latestV.storagePath);
      const dirPath = await constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType);
      const newPath = await createNextLocalVersion(dirPath, file.name || 'cloud_download');
      await downloadFileToLocal(downloadUrl, newPath);
      useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'rhino');
      await invoke('launch_rhino', { templatePath: '', targetFilePath: newPath });
      useWorkFileStore.getState().saveBinding(file.id, { ...(bindings[file.id] || {}), localPath: dirPath, existsLocally: true, lastOpenedAt: new Date().toISOString() });
      const vers = await getAllLocalVersions(project.id, file.id, project.name, file.name, file.toolType);
      setVersionsMap(prev => ({ ...prev, [file.id]: vers }));
    } catch (e) {
      alert('クラウドからのダウンロードに失敗しました: ' + e);
    } finally {
      setUploading(false);
      useAppStore.getState().setGlobalLaunchingTool(null);
    }
  };

  const handleCloudOverwriteConfirm = async () => {
    setCloudOverwriteDialogOpen(false);
    if (selectedFile) await handleDownloadCloudLatest(selectedFile);
  };

  const handleUploadNewFile = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: 'Work Files', extensions: ['3dm', 'rfa', 'rvt', 'pln', 'skp', 'dwg', 'pdf', 'zip'] }] });
      if (!selected) return;
      const localPath = selected as string;
      const fileName = localPath.split('\\').pop()?.split('/').pop() || 'Untitled';
      if (!currentUser) throw new Error('Not logged in');
      setUploading(true);
      const fileData = await readFile(localPath);
      const newWorkFile = await WorkFileRepository.commitNewWorkFile({ projectId: project.id, fileData, fileName, toolType: fileName.endsWith('.3dm') ? 'rhino' : 'other', createdByUserId: currentUser.uid });
      const dirPath = await constructLocalDirPath(project.id, newWorkFile.id, project.name, newWorkFile.name, newWorkFile.toolType);
      const targetPath = await createNextLocalVersion(dirPath, fileName);
      const { copyFile } = await import('@tauri-apps/plugin-fs');
      await copyFile(localPath, targetPath);
      useWorkFileStore.getState().saveBinding(newWorkFile.id, { localPath: dirPath, existsLocally: true, lastOpenedAt: new Date().toISOString() });
      useAppStore.getState().setGlobalLaunchingTool(newWorkFile.toolType || 'rhino');
      await invoke('launch_rhino', { templatePath: '', targetFilePath: targetPath });
      await fetchFiles();
      setSelectedFileId(newWorkFile.id);
    } catch (e: any) {
      alert('アップロード失敗: ' + e.message);
    } finally {
      setUploading(false);
      useAppStore.getState().setGlobalLaunchingTool(null);
    }
  };

  const handleUploadVersion = async (file: WorkFile) => {
    try {
      const activeInfo = useWorkFileSyncStore.getState().activeFiles[file.id];
      const dirPath = activeInfo?.localPath || await constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType);
      const vers = await getLocalVersions(dirPath);
      let localPath = '';
      if (vers.length > 0) {
        localPath = vers[0].path;
      } else {
        const selected = await open({ multiple: false, filters: [{ name: 'Work Files', extensions: ['3dm', 'rfa', 'rvt', 'pln', 'skp', 'dwg', 'pdf', 'zip'] }] });
        if (!selected) return;
        localPath = selected as string;
      }
      const fileName = localPath.split('\\').pop()?.split('/').pop() || 'Untitled';
      if (!currentUser) throw new Error('Not logged in');
      setUploading(true);
      const fileData = await readFile(localPath);
      await WorkFileRepository.commitNewVersion({ projectId: project.id, workFileId: file.id, fileData, fileName, comment: 'クラウド(Web)へのアップロード', createdByUserId: currentUser.uid });
      useWorkFileStore.getState().saveBinding(file.id, { localPath: dirPath, existsLocally: true, lastOpenedAt: new Date().toISOString(), openedVersionId: undefined });
      await fetchFiles();
    } catch (e: any) {
      alert('バージョン追加失敗: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLaunchTemplate = async (template: RhinoTemplate) => {
    setIsTemplateDialogOpen(false);
    if (!currentUser) return;
    try {
      useAppStore.getState().setGlobalLaunchingTool('rhino');
      const createdWorkFile = await WorkFileRepository.createWorkFile({ projectId: project.id, name: `From Template: ${template.name}`, toolType: 'rhino', updatedBy: currentUser.uid, createdBy: currentUser.uid, status: 'active' });
      const dirPath = await constructLocalDirPath(project.id, createdWorkFile.id, project.name, createdWorkFile.name, createdWorkFile.toolType);
      const targetPath = await createNextLocalVersion(dirPath, template.name);
      let localTemplatePathStr = template.templatePath;
      if (!template.isMock && template.templatePath.startsWith('http')) {
        try { localTemplatePathStr = await invoke('resolve_template_local_path', { templateId: template.id, uid: template.ownerId || 'common' }); }
        catch (e) { localTemplatePathStr = await invoke('cache_template_locally', { url: template.templatePath, templateId: template.id, uid: template.ownerId || 'common' }); }
      }
      await invoke('launch_rhino', { templatePath: localTemplatePathStr, targetFilePath: targetPath });
      useWorkFileStore.getState().saveBinding(createdWorkFile.id, { localPath: dirPath, existsLocally: true, lastOpenedAt: new Date().toISOString() });
      await WorkFileRepository.logActivity({ projectId: project.id, type: 'work_file_created', targetType: 'workFile', targetId: createdWorkFile.id, userId: currentUser.uid, meta: { toolType: 'rhino', fileName: createdWorkFile.name, templateRef: template.id } });
      await fetchFiles();
      setSelectedFileId(createdWorkFile.id);
    } catch (e: any) {
      alert('テンプレート作成エラー: ' + e);
    } finally {
      setUploading(false);
      useAppStore.getState().setGlobalLaunchingTool(null);
    }
  };

  const handleDuplicateOpenDialog = () => {
    const sel = workFiles.find(f => f.id === selectedFileId);
    if (!sel) return;
    setDuplicateName(`${sel.name} - コピー`);
    setDuplicateComment('別案として複製');
    setDuplicateDialogOpen(true);
  };

  const handleDuplicateSubmit = async () => {
    setDuplicateDialogOpen(false);
    const originFile = workFiles.find(f => f.id === selectedFileId);
    if (!originFile || !currentUser) return;
    const binding = bindings[originFile.id];
    if (!binding || !binding.existsLocally) { alert('現在、クラウドのみのファイルの複製は未実装です。ローカルに結びついたファイルを対象にしてください。'); return; }
    try {
      setUploading(true);
      const fileData = await readFile(binding.localPath);
      const newWorkFile = await WorkFileRepository.commitNewWorkFile({ projectId: project.id, fileData, fileName: duplicateName, toolType: originFile.toolType || 'rhino', createdByUserId: currentUser.uid });
      useWorkFileStore.getState().saveBinding(newWorkFile.id, { localPath: binding.localPath, existsLocally: true, lastOpenedAt: new Date().toISOString() });
      await WorkFileRepository.logActivity({ projectId: project.id, type: 'work_file_created', targetType: 'workFile', targetId: newWorkFile.id, userId: currentUser.uid, meta: { toolType: originFile.toolType, fileName: duplicateName, duplicateOrigin: originFile.id } });
      await fetchFiles();
      setSelectedFileId(newWorkFile.id);
    } catch (e: any) {
      alert('複製エラー: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEditWorkFileOpen = () => {
    const sel = workFiles.find(f => f.id === selectedFileId);
    if (!sel) return;
    setEditName(sel.name);
    setEditDialogOpen(true);
  };

  const handleEditWorkFileSubmit = async () => {
    const sel = workFiles.find(f => f.id === selectedFileId);
    if (!sel || !editName.trim()) return;
    try {
      setUploading(true);
      const oldDirPath = await constructLocalDirPath(project.id, sel.id, project.name, sel.name, sel.toolType);
      const newDirPath = await constructLocalDirPath(project.id, sel.id, project.name, editName.trim(), sel.toolType);
      try {
        await renameLocalDirectory(oldDirPath, newDirPath);
        useWorkFileStore.getState().saveBinding(sel.id, { ...bindings[sel.id], localPath: newDirPath, existsLocally: true, lastOpenedAt: new Date().toISOString() });
      } catch (err) { console.warn('Could not rename local directory:', err); }
      await WorkFileRepository.updateWorkFile(project.id, sel.id, { name: editName.trim() });
      await fetchFiles();
      setEditDialogOpen(false);
    } catch (e: any) {
      alert('更新エラー: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteWorkFileClick = () => { if (selectedFileId) setDeleteDialogOpen(true); };

  const confirmDeleteWorkFile = async () => {
    const sel = workFiles.find(f => f.id === selectedFileId);
    if (!sel) return;
    try {
      setUploading(true);
      const dirPath = await constructLocalDirPath(project.id, sel.id, project.name, sel.name, sel.toolType);
      await deleteLocalDirectory(dirPath);
      await WorkFileRepository.deleteWorkFile(project.id, sel.id);
      setSelectedFileId(null);
      setDeleteDialogOpen(false);
      notifyUpdate();
      await fetchFiles();
    } catch (e: any) {
      alert('削除エラー: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVersionClick = (e: React.MouseEvent, fileId: string, path: string) => {
    e.stopPropagation();
    setVersionToDelete({ fileId, path });
    setDeleteVersionDialogOpen(true);
  };

  const confirmDeleteVersion = async () => {
    if (!versionToDelete) return;
    try {
      setUploading(true);
      await deleteLocalFile(versionToDelete.path);
      const file = workFiles.find(f => f.id === versionToDelete.fileId);
      const updatedVersions = await getAllLocalVersions(project.id, versionToDelete.fileId, project.name, file?.name);
      setVersionsMap(prev => ({ ...prev, [versionToDelete.fileId]: updatedVersions }));
      setDeleteVersionDialogOpen(false);
      setVersionToDelete(null);
    } catch (err: any) {
      alert('削除エラー: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEditVersionClick = (e: React.MouseEvent, fileId: string, path: string, originalName: string) => {
    e.stopPropagation();
    setVersionToEdit({ fileId, path, originalName });
    setEditVersionName(originalName.replace(/\.[^/.]+$/, ''));
    setEditVersionDialogOpen(true);
  };

  const handleEditVersionSubmit = async () => {
    if (!versionToEdit || !editVersionName.trim()) return;
    try {
      setUploading(true);
      let finalName = editVersionName.trim();
      const match = versionToEdit.originalName.match(/\.[^/.]+$/);
      const ext = match ? match[0] : '';
      if (!finalName.toLowerCase().endsWith(ext.toLowerCase())) finalName += ext;
      const lastSlashIdx = Math.max(versionToEdit.path.lastIndexOf('\\'), versionToEdit.path.lastIndexOf('/'));
      const newPath = versionToEdit.path.substring(0, lastSlashIdx + 1) + finalName;
      await renameLocalFile(versionToEdit.path, newPath);
      const file = workFiles.find(f => f.id === versionToEdit.fileId);
      if (file) {
        const vers = await getAllLocalVersions(project.id, file.id, project.name, file.name);
        setVersionsMap(prev => ({ ...prev, [file.id]: vers }));
      }
      setEditVersionDialogOpen(false);
      setVersionToEdit(null);
    } catch (e: any) {
      alert('ファイル名の変更に失敗しました: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const selectedBinding = selectedFile ? bindings[selectedFile.id] : null;
  const hasLocal = !!selectedBinding?.existsLocally;

  const groupedFiles = React.useMemo(() => {
    const groups: Record<string, WorkFile[]> = {};
    workFiles.forEach(file => {
      let group = 'other';
      if (file.appScope) group = file.appScope.toLowerCase();
      else if (file.toolType === 'rhino') group = 'rhino';
      else if (file.toolType === 'blender') group = 'blender';
      else if (file.toolType) group = file.toolType;
      if (!groups[group]) groups[group] = [];
      groups[group].push(file);
    });
    return groups;
  }, [workFiles]);

  const getGroupDisplayLabel = (key: string): string => {
    const labels: Record<string, string> = {
      rhino: '3Dモデル（Rhino）',
      blender: '3Dモデル（Blender）',
      '3dsp': 'S.Presentations',
      '3dsl': 'S.Layout',
      other: 'その他',
    };
    return labels[key] ?? key.toUpperCase();
  };

  const getGroupNote = (key: string): string | null => {
    if (key === '3dsp') return 'S.Presentationsで作業したファイルが自動的に登録されます';
    if (key === '3dsl') return 'S.Layoutで作業したファイルが自動的に登録されます';
    return null;
  };

  const formatDateTimeSec = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const getStatusInfo = (fileId: string) => {
    const st = fileStatuses[fileId];
    if (!st) return { label: '確認中', color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', badge: null };
    if (st.statusBadge === 'synced') return { label: '同期済み', color: '#43e97b', bg: 'rgba(67,233,123,0.1)', badge: 'synced' };
    if (st.statusBadge === 'local_dirty') return { label: '変更あり', color: '#ff9800', bg: 'rgba(255,152,0,0.1)', badge: 'local_dirty' };
    if (st.statusBadge === 'local_only') return { label: 'ローカルのみ', color: '#00BFFF', bg: 'rgba(0,191,255,0.1)', badge: 'local_only' };
    return { label: 'クラウドのみ', color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.04)', badge: 'cloud_only' };
  };

  const getFileTypeLabel = (file: WorkFile) => {
    if (file.appScope?.toLowerCase() === '3dsp') return 'プレゼンテーション';
    if (file.appScope?.toLowerCase() === '3dsl') return 'レイアウト';
    if (file.toolType === 'rhino') return '3Dモデル (Rhino)';
    if (file.toolType === 'blender') return '3Dモデル (Blender)';
    return file.toolType || 'other';
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 }, flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', maxWidth: 1600, mx: 'auto', width: '100%', height: '100%' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>プロジェクトファイル</Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 600 }}>
            Rhino・S.Layout・S.Presentations など、すべてのアプリの作業ファイルをまとめて管理します。
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Tooltip title="ローカル参照フォルダ設定">
            <IconButton onClick={() => setFolderSettingsDialogOpen(true)} sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2, '&:hover': { color: '#00BFFF', borderColor: 'rgba(0,191,255,0.5)', bgcolor: 'rgba(0,191,255,0.05)' } }}>
              <FolderOpenRoundedIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={() => setIsTemplateDialogOpen(true)} disabled={uploading} startIcon={<AutoAwesomeRoundedIcon />} sx={{ bgcolor: '#fa709a', color: '#fff', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ff90b2' } }}>
            Rhinoテンプレートから新規作成
          </Button>
          <Button variant="contained" onClick={handleUploadNewFile} disabled={uploading} startIcon={<AddCircleOutlineRoundedIcon />} sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#4facfe' } }}>
            外部ファイルをインポート
          </Button>
        </Box>
      </Box>

      {/* Main: Card Grid + Side Panel */}
      <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {uploading && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
            <CircularProgress sx={{ color: '#00BFFF' }} />
          </Box>
        )}

        {/* Card Grid */}
        <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress size={32} sx={{ color: '#00BFFF' }} /></Box>
          ) : workFiles.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pt: 12, gap: 2 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.12)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 2 }}>
                ファイルがありません<br />
                <Box component="span" sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.25)' }}>テンプレートから新規作成するか、外部ファイルをインポートしてください</Box>
              </Typography>
            </Box>
          ) : (
            Object.entries(groupedFiles).map(([groupKey, groupFileList]) => (
              <Box key={groupKey} sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {getGroupDisplayLabel(groupKey)}
                  </Typography>
                  {getGroupNote(groupKey) && (
                    <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>
                      — {getGroupNote(groupKey)}
                    </Typography>
                  )}
                  <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.07)' }} />
                  <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>{groupFileList.length}件</Typography>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {groupFileList.map(file => {
                    const isSelected = selectedFileId === file.id;
                    const st = getStatusInfo(file.id);
                    const isLocal = !!bindings[file.id]?.existsLocally;
                    const isCADFile = !file.appScope && !!file.toolType && file.toolType !== 'other';

                    return (
                      <Box
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        sx={{
                          width: 192, borderRadius: 2.5, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                          border: isSelected ? '1.5px solid rgba(0,191,255,0.7)' : '1px solid rgba(255,255,255,0.08)',
                          bgcolor: isSelected ? 'rgba(0,191,255,0.06)' : 'rgba(255,255,255,0.02)',
                          transition: 'border 0.15s, box-shadow 0.15s, background 0.15s',
                          '&:hover': {
                            border: '1.5px solid rgba(0,191,255,0.5)',
                            bgcolor: 'rgba(0,191,255,0.04)',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                            '& .card-hover-actions': { opacity: 1 },
                          },
                        }}
                      >
                        {/* Thumbnail */}
                        <Box sx={{ aspectRatio: '16/9', bgcolor: '#0a0d17', position: 'relative', overflow: 'hidden' }}>
                          {file.thumbnailUrl
                            ? <Box component="img" src={file.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}><AutoAwesomeRoundedIcon sx={{ fontSize: 36 }} /></Box>
                          }
                          {/* Status badge */}
                          <Box sx={{ position: 'absolute', top: 6, right: 6, px: 0.75, py: 0.2, borderRadius: 1, bgcolor: st.bg, border: `1px solid ${st.color}55` }}>
                            <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: st.color, lineHeight: 1.2, letterSpacing: 0.3 }}>{st.label}</Typography>
                          </Box>
                          {/* Hover actions */}
                          <Box className="card-hover-actions" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, opacity: 0, transition: 'opacity 0.18s' }}>
                            {isCADFile && isLocal && (
                              <Tooltip title="Rhinoで開く">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenLocal(file); }} sx={{ bgcolor: 'rgba(0,191,255,0.2)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.5)', '&:hover': { bgcolor: 'rgba(0,191,255,0.4)' } }}>
                                  <PlayArrowRoundedIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isLocal && st.badge === 'local_dirty' && (
                              <Tooltip title="クラウドへ同期">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleUploadVersion(file); }} sx={{ bgcolor: 'rgba(255,152,0,0.2)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.5)', '&:hover': { bgcolor: 'rgba(255,152,0,0.4)' } }}>
                                  <UploadFileRoundedIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        {/* Info */}
                        <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5 }}>
                          <Tooltip title={file.name} placement="top" enterDelay={600}>
                            <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.82rem', color: isSelected ? '#fff' : 'rgba(255,255,255,0.85)', lineHeight: 1.3, mb: 0.75 }}>
                              {file.name}
                            </Typography>
                          </Tooltip>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip size="small" label={`v${file.latestVersionNumber || 1}`} sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }} />
                            <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)' }}>
                              {new Date(file.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))
          )}
        </Box>

        {/* Side Detail Panel */}
        {selectedFile && (
          <Paper sx={{ width: 360, flexShrink: 0, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, p: 2.5, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

            {/* Panel Header */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="overline" sx={{ color: '#00BFFF', fontWeight: 800, letterSpacing: 1, lineHeight: 1, fontSize: '0.6rem' }}>ファイル詳細</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 800, wordBreak: 'break-all', mt: 0.25, fontSize: '0.95rem', lineHeight: 1.35 }}>{selectedFile.name}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexShrink: 0, ml: 1, gap: 0.25 }}>
                <Tooltip title="名前を変更"><IconButton onClick={handleEditWorkFileOpen} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}><EditRoundedIcon sx={{ fontSize: '1rem' }} /></IconButton></Tooltip>
                <Tooltip title="このファイルを削除"><IconButton onClick={handleDeleteWorkFileClick} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fa709a', bgcolor: 'rgba(250,112,154,0.1)' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} /></IconButton></Tooltip>
                <Tooltip title="パネルを閉じる"><IconButton onClick={() => setSelectedFileId(null)} size="small" sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}><ChevronRightIcon sx={{ fontSize: '1rem' }} /></IconButton></Tooltip>
              </Box>
            </Box>

            {/* Preview */}
            <Box sx={{ aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', mb: 1.5 }}>
              {show3DPreview ? (
                <InlineWorkFilePreview fileId={selectedFile.id} storagePath={selectedFile.storagePath} fileName={selectedFile.name} toolType={selectedFile.toolType || 'rhino'} localPath={selectedBinding?.localPath} onClose={() => setShow3DPreview(false)} />
              ) : (
                <>
                  {selectedFile.thumbnailUrl
                    ? <Box component="img" src={selectedFile.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#0b0f19' }} />
                    : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)' }}><AutoAwesomeRoundedIcon sx={{ fontSize: 36, mb: 1, opacity: 0.5 }} /><Typography variant="caption" sx={{ textAlign: 'center', px: 3, lineHeight: 1.6 }}>次回アップロード時、または<br />3Dプレビューを生成すると更新されます</Typography></Box>
                  }
                  <Button variant="contained" onClick={() => setShow3DPreview(true)} startIcon={<VisibilityRoundedIcon />} size="small" sx={{ position: 'absolute', bottom: 8, right: 8, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem', textTransform: 'none', '&:hover': { bgcolor: 'rgba(0,191,255,0.4)', borderColor: 'rgba(0,191,255,0.8)' } }}>
                    3Dビューワー
                  </Button>
                </>
              )}
            </Box>

            {/* Status */}
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', mb: 1.5 }}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mb: 1, fontWeight: 800, letterSpacing: 1, fontSize: '0.58rem' }}>STATUS</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {selectedBinding?.openedVersionId && <Chip size="small" label="⚠️ 過去版開示" sx={{ bgcolor: 'rgba(255,152,0,0.2)', color: '#ff9800', fontWeight: 700, border: '1px solid rgba(255,152,0,0.5)' }} />}
                <Chip size="small" label={`最新: v${selectedFile.latestVersionNumber}`} sx={{ bgcolor: 'rgba(0,191,255,0.1)', color: '#00BFFF', fontWeight: 700 }} />
                <Chip size="small" label={getFileTypeLabel(selectedFile)} sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }} />
                {(() => {
                  const si = getStatusInfo(selectedFile.id);
                  const borderColor = si.color + '4d';
                  return <Chip size="small" label={si.label} sx={{ bgcolor: si.bg, color: si.color, border: `1px solid ${borderColor}` }} />;
                })()}
              </Box>
            </Box>

            {/* Metadata */}
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', mb: 1.5 }}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mb: 1, fontWeight: 800, letterSpacing: 1, fontSize: '0.58rem' }}>METADATA</Typography>
              <Box sx={{ mb: 1.25 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 0.25 }}>最終更新日</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500, fontSize: '0.8rem' }}>{new Date(selectedFile.updatedAt).toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 0.25 }}>更新者</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.updatedBy}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1.5 }} />

            {/* Actions */}
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, fontWeight: 700, fontSize: '0.7rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>アクション</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(!versionsMap[selectedFile.id] || versionsMap[selectedFile.id].length === 0) && (
                <Button fullWidth variant="contained" startIcon={<DownloadRoundedIcon />} onClick={() => handleDownloadCloudLatest(selectedFile)} sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, fontSize: '0.8rem', textTransform: 'none' }}>
                  クラウドからダウンロード
                </Button>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => handleUploadVersion(selectedFile)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', fontSize: '0.78rem', textTransform: 'none', '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' } }}>クラウドへ同期</Button>
                <Tooltip title="クラウド連携について"><IconButton onClick={() => setInfoDialogType('upload')} sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1.5, p: 0.75, '&:hover': { borderColor: '#00BFFF', color: '#00BFFF' } }}><InfoOutlinedIcon fontSize="small" /></IconButton></Tooltip>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="outlined" startIcon={<FileCopyRoundedIcon />} onClick={handleDuplicateOpenDialog} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', fontSize: '0.78rem', textTransform: 'none', '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' } }}>別案として複製分岐</Button>
                <Tooltip title="複製分岐について"><IconButton onClick={() => setInfoDialogType('fork')} sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1.5, p: 0.75, '&:hover': { borderColor: '#00BFFF', color: '#00BFFF' } }}><InfoOutlinedIcon fontSize="small" /></IconButton></Tooltip>
              </Box>
              <Button variant="text" size="small" onClick={() => toggleExpand(selectedFile.id)} startIcon={<ViewListRoundedIcon />} sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'none', justifyContent: 'flex-start', '&:hover': { color: '#fff' } }}>
                {expandedFiles[selectedFile.id] ? 'ローカル履歴を隠す' : 'ローカル履歴を表示'}
              </Button>
            </Box>

            {/* Local Version History */}
            {expandedFiles[selectedFile.id] && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', mb: 1, fontWeight: 800, fontSize: '0.63rem', letterSpacing: 1.5, textTransform: 'uppercase' }}>ローカル履歴</Typography>
                {(versionsMap[selectedFile.id] || []).length === 0
                  ? <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', py: 1 }}>ローカル履歴がありません</Typography>
                  : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {(versionsMap[selectedFile.id] || []).map((v, idx) => (
                        <Box key={v.name} sx={{ display: 'flex', alignItems: 'center', p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', '& .ver-actions': { opacity: 1 } } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.75)', fontWeight: idx === 0 ? 700 : 400 }}>{v.name}</Typography>
                            <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.35)' }}>{idx === 0 ? '最新' : '過去のコピー'} • {formatDateTimeSec(v.createdAt)}</Typography>
                          </Box>
                          <Box className="ver-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s', gap: 0.25, flexShrink: 0, ml: 0.5 }}>
                            <Tooltip title="プレビュー"><IconButton size="small" onClick={(e) => openVersionPreview(e, selectedFile, v.path)} sx={{ color: 'rgba(255,255,255,0.5)', p: 0.4, '&:hover': { color: '#00BFFF' } }}><VisibilityRoundedIcon sx={{ fontSize: '0.95rem' }} /></IconButton></Tooltip>
                            <Tooltip title="この版を開く"><IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenLocal(selectedFile, v.path); }} sx={{ color: 'rgba(255,255,255,0.5)', p: 0.4, '&:hover': { color: '#00BFFF' } }}><PlayArrowRoundedIcon sx={{ fontSize: '0.95rem' }} /></IconButton></Tooltip>
                            <Tooltip title="名前を変更"><IconButton size="small" onClick={(e) => handleEditVersionClick(e, selectedFile.id, v.path, v.name)} sx={{ color: 'rgba(255,255,255,0.5)', p: 0.4, '&:hover': { color: '#00BFFF' } }}><EditRoundedIcon sx={{ fontSize: '0.95rem' }} /></IconButton></Tooltip>
                            <Tooltip title="削除"><IconButton size="small" onClick={(e) => handleDeleteVersionClick(e, selectedFile.id, v.path)} sx={{ color: 'rgba(255,255,255,0.5)', p: 0.4, '&:hover': { color: '#fa709a' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: '0.95rem' }} /></IconButton></Tooltip>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* ---- Dialogs ---- */}

      <RhinoTemplateDialog open={isTemplateDialogOpen} onClose={() => setIsTemplateDialogOpen(false)} onSelect={handleLaunchTemplate} />

      <Dialog open={cloudOverwriteDialogOpen} onClose={() => setCloudOverwriteDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#111827', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, maxWidth: 600 } }}>
        <DialogTitle sx={{ color: '#fa709a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5, pb: 2 }}><WarningAmberRoundedIcon /> ローカルの未保存な変更があります</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: 'rgba(255,255,255,0.8)' }}>手元のローカルファイルは、最後にクラウドへ保存した「版」よりも新しく編集されています。<br />クラウドから版をダウンロードすると、<b>現在のローカルの変更内容は上書きされて失われます</b>。</Typography>
          <Box sx={{ p: 2, bgcolor: 'rgba(0,191,255,0.05)', borderLeft: '4px solid #00BFFF', borderRadius: '0 8px 8px 0', mb: 2 }}><Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>安全のため、先に現在の状態を「新しい版として保存」することをお勧めします。</Typography></Box>
          <Typography variant="body2" sx={{ color: '#fa709a', fontWeight: 'bold' }}>本当にクラウドの版をダウンロードして上書きしてもよろしいですか？</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button onClick={() => setCloudOverwriteDialogOpen(false)} variant="outlined" sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>キャンセル</Button>
          <Button onClick={() => { setCloudOverwriteDialogOpen(false); handleUploadVersion(selectedFile!); }} variant="contained" startIcon={<UploadFileRoundedIcon />} sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 'bold', borderRadius: 2, px: 3, '&:hover': { bgcolor: '#4facfe' } }}>現在の変更を「版」として保存する</Button>
          <Button onClick={handleCloudOverwriteConfirm} variant="contained" sx={{ bgcolor: 'rgba(250,112,154,0.1)', color: '#fa709a', fontWeight: 'bold', borderRadius: 2, px: 3, boxShadow: 'none', '&:hover': { bgcolor: 'rgba(250,112,154,0.2)', boxShadow: 'none' } }}>放棄して上書きダウンロード</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1a2235', color: '#fff', borderRadius: 3, minWidth: 400 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>別案として複製</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>複製元: {selectedFile?.name}</Typography>
            <Chip size="small" label={hasLocal ? 'ローカル元 (リンク済み)' : 'クラウド元 (未実装)'} sx={{ bgcolor: hasLocal ? 'rgba(67,233,123,0.1)' : 'rgba(255,255,255,0.1)', color: hasLocal ? '#43e97b' : '#fff' }} />
          </Box>
          <TextField fullWidth label="新しいファイル名" value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} InputProps={{ sx: { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }} />
          <TextField fullWidth label="初回コメント" value={duplicateComment} onChange={(e) => setDuplicateComment(e.target.value)} InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} InputProps={{ sx: { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDuplicateDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleDuplicateSubmit} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#4facfe' } }}>複製を実行</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1a2235', color: '#fff', borderRadius: 3, minWidth: 400 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>ファイル名を変更</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          <TextField fullWidth label="ファイル名" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} InputProps={{ sx: { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }} onKeyDown={(e) => e.key === 'Enter' && handleEditWorkFileSubmit()} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleEditWorkFileSubmit} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#4facfe' } }}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pastVersionSaveDialogOpen} onClose={() => setPastVersionSaveDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1a2235', color: '#fff', borderRadius: 3, minWidth: 400 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>過去版からの保存</DialogTitle>
        <DialogContent sx={{ pt: 1 }}><Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>現在、過去の版を開いて作業しています。どのように保存しますか？</Typography></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, flexDirection: 'column', gap: 1 }}>
          <Button fullWidth variant="contained" onClick={() => { setPastVersionSaveDialogOpen(false); if (selectedFile) handleUploadVersion(selectedFile); }} sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#4facfe' } }}>この版として保存</Button>
          <Button fullWidth variant="outlined" onClick={() => { setPastVersionSaveDialogOpen(false); handleDuplicateOpenDialog(); }} sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }}>別案として新しいファイルを作成</Button>
          <Button fullWidth onClick={() => setPastVersionSaveDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>キャンセル</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1a2235', color: '#fff', borderRadius: 3, minWidth: 400 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#fa709a', display: 'flex', alignItems: 'center', gap: 1 }}><DeleteOutlineRoundedIcon /> 削除の確認</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>ファイル「<strong>{selectedFile?.name}</strong>」を削除してもよろしいですか？</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(250,112,154,0.8)', display: 'block', p: 1.5, bgcolor: 'rgba(250,112,154,0.1)', borderRadius: 2 }}>※この操作は元に戻せません。プロジェクトから完全に削除されます。</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={confirmDeleteWorkFile} variant="contained" sx={{ bgcolor: '#fa709a', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#ff90b2' } }}>完全に削除する</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteVersionDialogOpen} onClose={() => setDeleteVersionDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1a2235', color: '#fff', borderRadius: 3, minWidth: 400 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#fa709a', display: 'flex', alignItems: 'center', gap: 1 }}><DeleteOutlineRoundedIcon /> ローカルファイルの削除</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>このローカルファイル版を削除してもよろしいですか？</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(250,112,154,0.8)', display: 'block', p: 1.5, bgcolor: 'rgba(250,112,154,0.1)', borderRadius: 2 }}>※このファイルはローカルPCから削除されます。元には戻せません。</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteVersionDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={confirmDeleteVersion} variant="contained" sx={{ bgcolor: '#fa709a', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#ff90b2' } }}>削除する</Button>
        </DialogActions>
      </Dialog>

      {previewOpen && previewFile && (
        <PreviewDialog open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewFile(null); }} fileName={previewFile.name} versionName={previewFile.version} toolType={previewFile.tool} workFileId={previewFile.fileId} localPath={previewFile.localPath} />
      )}

      <Dialog open={folderSettingsDialogOpen} onClose={() => setFolderSettingsDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', backgroundImage: 'none' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><FolderOpenRoundedIcon sx={{ color: '#00BFFF' }} />ローカル参照フォルダ設定</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>このプロジェクトのローカルファイルが保存される親フォルダを設定します。プロジェクト固有の設定です。</Typography>
          <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, mb: 3 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}>現在の参照フォルダ</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#fff' }}>{customBaseDir || defaultBaseDir || 'デフォルト (Documents/SEKKEIYA/...)'}</Typography>
            {customBaseDir && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 1 }}>デフォルトの参照フォルダ</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', display: 'block' }}>{defaultBaseDir}</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {customBaseDir && <Button variant="text" onClick={handleResetDefaultFolder} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fa709a', bgcolor: 'rgba(250,112,154,0.1)' } }}>デフォルトに戻す</Button>}
            <Button variant="outlined" startIcon={<FolderOpenRoundedIcon />} onClick={handleSelectFolder} sx={{ color: '#00BFFF', borderColor: 'rgba(0,191,255,0.5)', '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' } }}>フォルダを選択</Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}><Button onClick={() => setFolderSettingsDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>閉じる</Button></DialogActions>
      </Dialog>

      <Dialog open={infoDialogType !== null} onClose={() => setInfoDialogType(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', backgroundImage: 'none', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
          <InfoOutlinedIcon sx={{ color: '#00BFFF', mr: 0.5 }} />
          {infoDialogType === 'upload' ? 'クラウド連携（WebにUP）について' : '別案として複製分岐（フォーク）について'}
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 4 }}>
          {infoDialogType === 'upload' && (
            <>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', mb: 3, lineHeight: 1.6 }}>手元のパソコンに保存されている最新の作業データを、クラウド（Webサーバー）にアップロードして同期します。</Typography>
              <Box sx={{ bgcolor: 'rgba(0,191,255,0.05)', p: 2, borderRadius: 2, border: '1px solid rgba(0,191,255,0.2)' }}>
                <Typography variant="subtitle2" sx={{ color: '#00BFFF', mb: 1, fontWeight: 700 }}>こんな時に使います：</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>・作成した3Dモデルを、クライアントにWeb経由で確認してほしい時<br />・別のパソコンでログインして、作業の続きを行いたい時<br />・プロジェクトのメンバーに最新の進捗を共有したい時</Typography>
              </Box>
            </>
          )}
          {infoDialogType === 'fork' && (
            <>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', mb: 3, lineHeight: 1.6 }}>現在のファイル（履歴とデータ群）を丸ごとコピーし、別の名前をつけて独立した新しいファイルとして分岐させます。</Typography>
              <Box sx={{ bgcolor: 'rgba(0,191,255,0.05)', p: 2, borderRadius: 2, border: '1px solid rgba(0,191,255,0.2)' }}>
                <Typography variant="subtitle2" sx={{ color: '#00BFFF', mb: 1, fontWeight: 700 }}>こんな時に使います：</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>・元のデザイン案（A案）は残しつつ、別のデザイン変更（B案）を試して比較したい時<br />・一つの基本モデルから、複数のカラーバリエーションや仕様違いのモデルを作成したい時</Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setInfoDialogType(null)} variant="outlined" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: '#fff' } }}>閉じる</Button></DialogActions>
      </Dialog>

      <Dialog open={editVersionDialogOpen} onClose={() => setEditVersionDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', backgroundImage: 'none', minWidth: 400, borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>ファイル名の変更</DialogTitle>
        <DialogContent sx={{ p: 3, pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>ローカルのファイル名を変更します。（元の拡張子は自動的に保持されます）</Typography>
          <TextField autoFocus fullWidth label="ファイル名" variant="outlined" value={editVersionName} onChange={(e) => setEditVersionName(e.target.value)} InputLabelProps={{ style: { color: 'rgba(255,255,255,0.5)' } }} InputProps={{ sx: { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00BFFF' } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditVersionDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>キャンセル</Button>
          <Button onClick={handleEditVersionSubmit} variant="contained" disabled={!editVersionName.trim()} sx={{ bgcolor: '#00BFFF', color: '#fff', fontWeight: 700, '&:hover': { bgcolor: '#009acd' } }}>保存</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};
