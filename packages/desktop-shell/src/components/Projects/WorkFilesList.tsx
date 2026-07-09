import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, Tooltip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider, InputAdornment
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import FileCopyRoundedIcon from '@mui/icons-material/FileCopyRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

import type { WorkFile, DesktopProject, RhinoTemplate } from '../../features/projects/types';
import RhinoTemplateDialog from './RhinoTemplateDialog';
import { PreviewDialog } from './PreviewDialog';

interface WorkFilesListProps {
  project: DesktopProject;
  filterMode?: 'all' | 'cad' | 'other';
}

const isCADFile = (file: WorkFile) => !file.appScope && !!file.toolType && file.toolType !== 'other';

export const WorkFilesList: React.FC<WorkFilesListProps> = ({ project, filterMode = 'all' }) => {
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
  const [toolTypeFilter, setToolTypeFilter] = useState<'all' | 'rhino' | 'blender'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [updatedByName, setUpdatedByName] = useState<string>('');
  const userNameCacheRef = React.useRef<Record<string, string>>({});

  const bindings = useWorkFileStore(state => state.bindings);
  const notifyUpdate = useWorkFileStore(state => state.notifyUpdate);
  const lastUpdated = useWorkFileStore(state => state.lastUpdated);
  const registerActiveFile = useWorkFileSyncStore(state => state.registerActiveFile);
  const fileStatuses = useWorkFileSyncStore(state => state.statuses);
  const { currentUser } = useAuthStore.getState();
  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);

  useEffect(() => {
    setAiTaskInnerRight(selectedFileId ? 320 : 0);
    return () => { setAiTaskInnerRight(0); };
  }, [selectedFileId, setAiTaskInnerRight]);

  useEffect(() => {
    setSelectedFileId(null);
  }, [filterMode]);

  const selectedFile = workFiles.find(f => f.id === selectedFileId) ?? null;

  useEffect(() => {
    const uid = selectedFile?.updatedBy;
    if (!uid) { setUpdatedByName(''); return; }
    if (userNameCacheRef.current[uid]) { setUpdatedByName(userNameCacheRef.current[uid]); return; }
    getDoc(doc(db, 'users', uid)).then(snap => {
      const name = snap.exists() ? ((snap.data() as any).displayName || uid) : uid;
      userNameCacheRef.current[uid] = name;
      setUpdatedByName(name);
    }).catch(() => setUpdatedByName(uid));
  }, [selectedFile?.updatedBy]);

  useEffect(() => {
    const saved = localStorage.getItem(`sekkeiya_project_${project.id}_workfiles_dir`);
    if (saved) setCustomBaseDir(saved);
    getDefaultBaseDirPath(project.id).then(setDefaultBaseDir).catch(console.error);
  }, [project.id]);

  const handleOpenFolderInExplorer = async () => {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(customBaseDir || defaultBaseDir);
    } catch (err) { console.error(err); }
  };

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

  useEffect(() => {
    // ローカルのファイル監視(watcher)とステータスチェックが必要なのは、
    // ローカルで編集される CAD（Rhino/Blender）ファイルのみ。
    // appScope を持つ成果物（S.Material の自動生成マテリアル等は数十件規模になる）まで
    // 監視すると大量の watcher と同期チェックが一斉に走り、プロジェクト切替時に固まる。
    const watchTargets = workFiles.filter(isCADFile);
    watchTargets.forEach(file => {
      constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType, file.appScope).then(dirPath => {
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
      getAllLocalVersions(project.id, selectedFile.id, project.name, selectedFile.name, selectedFile.toolType, selectedFile.appScope).then(vers => {
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
      const vers = await getAllLocalVersions(project.id, fileId, project.name, file?.name, file?.toolType, file?.appScope);
      setVersionsMap(prev => ({ ...prev, [fileId]: vers }));
    }
  };

  const handleOpenLocal = async (file: WorkFile, pastVersionPath?: string) => {
    try {
      useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'rhino');
      const activeInfo = useWorkFileSyncStore.getState().activeFiles[file.id];
      const dirPath = activeInfo?.localPath || await constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType, file.appScope);
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
      const vers = await getAllLocalVersions(project.id, file.id, project.name, file.name, file.toolType, file.appScope);
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
      const dirPath = await constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType, file.appScope);
      const newPath = await createNextLocalVersion(dirPath, file.name || 'cloud_download');
      await downloadFileToLocal(downloadUrl, newPath);
      useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'rhino');
      await invoke('launch_rhino', { templatePath: '', targetFilePath: newPath });
      useWorkFileStore.getState().saveBinding(file.id, { ...(bindings[file.id] || {}), localPath: dirPath, existsLocally: true, lastOpenedAt: new Date().toISOString() });
      const vers = await getAllLocalVersions(project.id, file.id, project.name, file.name, file.toolType, file.appScope);
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
      const dirPath = await constructLocalDirPath(project.id, newWorkFile.id, project.name, newWorkFile.name, newWorkFile.toolType, newWorkFile.appScope);
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
      const dirPath = activeInfo?.localPath || await constructLocalDirPath(project.id, file.id, project.name, file.name, file.toolType, file.appScope);
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
      const dirPath = await constructLocalDirPath(project.id, createdWorkFile.id, project.name, createdWorkFile.name, createdWorkFile.toolType, createdWorkFile.appScope);
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
      const oldDirPath = await constructLocalDirPath(project.id, sel.id, project.name, sel.name, sel.toolType, sel.appScope);
      const newDirPath = await constructLocalDirPath(project.id, sel.id, project.name, editName.trim(), sel.toolType, sel.appScope);
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
      const dirPath = await constructLocalDirPath(project.id, sel.id, project.name, sel.name, sel.toolType, sel.appScope);
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
      const updatedVersions = await getAllLocalVersions(project.id, versionToDelete.fileId, project.name, file?.name, file?.toolType, file?.appScope);
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
        const vers = await getAllLocalVersions(project.id, file.id, project.name, file.name, file.toolType, file.appScope);
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

  const filteredWorkFiles = React.useMemo(() => {
    if (filterMode === 'cad') return workFiles.filter(isCADFile);
    if (filterMode === 'other') return workFiles.filter(f => !isCADFile(f));
    return workFiles;
  }, [workFiles, filterMode]);

  const toolFilteredFiles = React.useMemo(() => {
    let list = filteredWorkFiles;
    if (filterMode === 'cad' && toolTypeFilter !== 'all') {
      list = list.filter(f => f.toolType === toolTypeFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.toolType?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [filteredWorkFiles, filterMode, toolTypeFilter, searchQuery]);

  const groupedFiles = React.useMemo(() => {
    const groups: Record<string, WorkFile[]> = {};
    toolFilteredFiles.forEach(file => {
      let group = 'other';
      if (file.appScope) group = file.appScope.toLowerCase();
      else if (file.toolType === 'rhino') group = 'rhino';
      else if (file.toolType === 'blender') group = 'blender';
      else if (file.toolType) group = file.toolType;
      if (!groups[group]) groups[group] = [];
      groups[group].push(file);
    });
    return groups;
  }, [toolFilteredFiles]);

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
    <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}>

      {uploading && (
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: '#00BFFF' }} />
        </Box>
      )}

      <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 2, flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>

      {filterMode === 'cad' ? (
        /* ── CAD Files: Template Library と揃えた 2 段ヘッダー ── */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 1.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {/* Row 1: title + file count + action buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
            <FolderOpenRoundedIcon sx={{ fontSize: 18, color: '#fa709a' }} />
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
              {project.name}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
              {filteredWorkFiles.length} ファイル
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Button size="small" variant="contained" onClick={() => setIsTemplateDialogOpen(true)} disabled={uploading}
                startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: '14px !important' }} />}
                sx={{ bgcolor: '#fa709a', color: '#fff', fontWeight: 700, textTransform: 'none', fontSize: '0.72rem', px: 1.5, py: 0.5, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#ff90b2' } }}>
                テンプレート
              </Button>
              <Button size="small" variant="contained" onClick={handleUploadNewFile} disabled={uploading}
                startIcon={<AddCircleOutlineRoundedIcon sx={{ fontSize: '14px !important' }} />}
                sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none', fontSize: '0.72rem', px: 1.5, py: 0.5, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#4facfe' } }}>
                インポート
              </Button>
            </Box>
          </Box>

          {/* Row 2: tool filter + search + view toggles */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
            {/* Tool type filter */}
            <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'rgba(0,0,0,0.35)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.09)' }}>
              {(['all', 'rhino', 'blender'] as const).map(t => (
                <Button key={t} size="small" onClick={() => setToolTypeFilter(t)}
                  sx={{ textTransform: 'none', fontWeight: toolTypeFilter === t ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                    color: toolTypeFilter === t ? '#fff' : 'rgba(255,255,255,0.45)',
                    bgcolor: toolTypeFilter === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' } }}>
                  {t === 'all' ? 'すべて' : t === 'rhino' ? 'Rhino' : 'Blender'}
                </Button>
              ))}
            </Box>
            {/* Search */}
            <TextField
              placeholder="ファイル検索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 160 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: 'rgba(255,255,255,0.28)', fontSize: 18 }} /></InputAdornment>,
                sx: { borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' } },
              }}
            />
            {/* Grid / List / Folder toggles */}
            <Box sx={{ display: 'flex', gap: 0.25, p: 0.375, bgcolor: 'rgba(0,0,0,0.35)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.09)' }}>
              <Tooltip title="グリッド表示">
                <IconButton size="small" onClick={() => setViewMode('grid')}
                  sx={{ p: 0.5, borderRadius: 1.5, color: viewMode === 'grid' ? '#fff' : 'rgba(255,255,255,0.4)',
                    bgcolor: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' } }}>
                  <ViewModuleRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="リスト表示">
                <IconButton size="small" onClick={() => setViewMode('list')}
                  sx={{ p: 0.5, borderRadius: 1.5, color: viewMode === 'list' ? '#fff' : 'rgba(255,255,255,0.4)',
                    bgcolor: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' } }}>
                  <ViewListRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="ローカル保存先を確認">
                <IconButton onClick={() => setFolderSettingsDialogOpen(true)} size="small"
                  sx={{ p: 0.5, borderRadius: 1.5, color: 'rgba(255,255,255,0.4)',
                    '&:hover': { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.08)' } }}>
                  <FolderOpenRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      ) : (
        /* ── Work Files / All: シンプルなヘッダー ── */
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 1.5, mb: 2, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#00BFFF', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              プロジェクト
            </Typography>
            <Box sx={{ px: 1.25, py: 0.25, bgcolor: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.25)', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00BFFF', whiteSpace: 'nowrap' }}>
                {project.name}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
              {filteredWorkFiles.length} ファイル
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="ローカル保存先を確認">
              <IconButton onClick={() => setFolderSettingsDialogOpen(true)} size="small"
                sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5,
                  '&:hover': { color: '#00BFFF', borderColor: 'rgba(0,191,255,0.4)', bgcolor: 'rgba(0,191,255,0.05)' } }}>
                <FolderOpenRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Card Grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress size={32} sx={{ color: '#00BFFF' }} /></Box>
          ) : toolFilteredFiles.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pt: 12, gap: 2 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.12)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 2 }}>
                ファイルがありません<br />
                <Box component="span" sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.25)' }}>
                  {filterMode === 'other'
                    ? 'S.Layout や S.Presentations で作業すると、ここに自動登録されます'
                    : 'テンプレートから新規作成するか、外部ファイルをインポートしてください'}
                </Box>
              </Typography>
            </Box>
          ) : (
            Object.entries(groupedFiles).map(([groupKey, groupFileList]) => (
              <Box key={groupKey} sx={{ mb: 4 }}>
                {/* Group header */}
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

                {viewMode === 'grid' ? (
                  /* ── Grid view ── */
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {groupFileList.map(file => {
                      const isSelected = selectedFileId === file.id;
                      const st = getStatusInfo(file.id);
                      const isLocal = !!bindings[file.id]?.existsLocally;
                      const isCad = isCADFile(file);
                      return (
                        <Box key={file.id} onClick={() => setSelectedFileId(file.id)}
                          sx={{ width: 192, borderRadius: 2.5, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                            border: isSelected ? '1.5px solid rgba(0,191,255,0.7)' : '1px solid rgba(255,255,255,0.08)',
                            bgcolor: isSelected ? 'rgba(0,191,255,0.06)' : 'rgba(255,255,255,0.02)',
                            transition: 'border 0.15s, box-shadow 0.15s, background 0.15s',
                            '&:hover': { border: '1.5px solid rgba(0,191,255,0.5)', bgcolor: 'rgba(0,191,255,0.04)',
                              boxShadow: '0 4px 24px rgba(0,0,0,0.35)', '& .card-hover-actions': { opacity: 1 } },
                          }}>
                          {/* Thumbnail */}
                          <Box sx={{ aspectRatio: '16/9', bgcolor: '#0a0d17', position: 'relative', overflow: 'hidden' }}>
                            {file.thumbnailUrl
                              ? <Box component="img" src={file.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>
                                  <AutoAwesomeRoundedIcon sx={{ fontSize: 36 }} />
                                </Box>
                            }
                            <Box sx={{ position: 'absolute', top: 6, right: 6, px: 0.75, py: 0.2, borderRadius: 1, bgcolor: st.bg, border: `1px solid ${st.color}55` }}>
                              <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: st.color, lineHeight: 1.2, letterSpacing: 0.3 }}>{st.label}</Typography>
                            </Box>
                            <Box className="card-hover-actions" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, opacity: 0, transition: 'opacity 0.18s' }}>
                              {isCad && isLocal && (
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
                ) : (
                  /* ── List view ── */
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {groupFileList.map(file => {
                      const isSelected = selectedFileId === file.id;
                      const st = getStatusInfo(file.id);
                      const isLocal = !!bindings[file.id]?.existsLocally;
                      const isCad = isCADFile(file);
                      return (
                        <Box key={file.id} onClick={() => setSelectedFileId(file.id)}
                          sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                            border: `1px solid ${isSelected ? 'rgba(0,191,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                            bgcolor: isSelected ? 'rgba(0,191,255,0.05)' : 'transparent',
                            transition: 'all 0.15s',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.12)', '& .list-actions': { opacity: 1 } } }}>
                          {/* Thumbnail */}
                          <Box sx={{ width: 72, height: 40, bgcolor: '#0a0d17', borderRadius: 1.5, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                            {file.thumbnailUrl
                              ? <Box component="img" src={file.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.18 }}>
                                  <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                            }
                          </Box>
                          {/* Name + type */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#fff' : 'rgba(255,255,255,0.88)' }}>
                              {file.name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.38)' }}>
                              {getFileTypeLabel(file)}
                            </Typography>
                          </Box>
                          {/* Version */}
                          <Chip size="small" label={`v${file.latestVersionNumber || 1}`}
                            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                          {/* Status */}
                          <Box sx={{ px: 0.75, py: 0.2, borderRadius: 1, bgcolor: st.bg, border: `1px solid ${st.color}55`, flexShrink: 0 }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: st.color, lineHeight: 1.4 }}>{st.label}</Typography>
                          </Box>
                          {/* Date */}
                          <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                            {new Date(file.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          </Typography>
                          {/* Actions */}
                          <Box className="list-actions" sx={{ display: 'flex', gap: 0.5, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                            {isCad && isLocal && (
                              <Tooltip title="Rhinoで開く">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenLocal(file); }}
                                  sx={{ p: 0.5, color: '#00BFFF', border: '1px solid rgba(0,191,255,0.3)', borderRadius: 1.5,
                                    '&:hover': { bgcolor: 'rgba(0,191,255,0.1)' } }}>
                                  <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isLocal && st.badge === 'local_dirty' && (
                              <Tooltip title="クラウドへ同期">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleUploadVersion(file); }}
                                  sx={{ p: 0.5, color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 1.5,
                                    '&:hover': { bgcolor: 'rgba(255,152,0,0.1)' } }}>
                                  <UploadFileRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>

      </Box>

      {/* Side Detail Panel */}
      {selectedFile && (
        <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: '#0c1219', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fa709a', flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff', flex: 1 }}>ファイル詳細</Typography>
              <Tooltip title="名前を変更">
                <IconButton onClick={handleEditWorkFileOpen} size="small" sx={{ p: '4px', color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}>
                  <EditRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="このファイルを削除">
                <IconButton onClick={handleDeleteWorkFileClick} size="small" sx={{ p: '4px', color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fa709a' } }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <IconButton onClick={() => setSelectedFileId(null)} size="small" sx={{ p: '4px', color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            {/* Scrollable content */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

              {/* File name field */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>ファイル名</Typography>
                <Box sx={{ px: 1.25, py: 0.875, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5 }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', wordBreak: 'break-all', lineHeight: 1.4 }}>{selectedFile.name}</Typography>
                </Box>
              </Box>

              {/* Type + Version row */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>種別</Typography>
                  <Box sx={{ px: 1.25, py: 0.75, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>{getFileTypeLabel(selectedFile)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>バージョン</Typography>
                  <Box sx={{ px: 1.25, py: 0.75, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>v{selectedFile.latestVersionNumber || 1}</Typography>
                  </Box>
                </Box>
              </Box>

              {/* Status */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>ステータス</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {selectedBinding?.openedVersionId && <Chip size="small" label="⚠️ 過去版開示" sx={{ bgcolor: 'rgba(255,152,0,0.2)', color: '#ff9800', fontWeight: 700, border: '1px solid rgba(255,152,0,0.5)' }} />}
                  {(() => {
                    const si = getStatusInfo(selectedFile.id);
                    return <Chip size="small" label={si.label} sx={{ bgcolor: si.bg, color: si.color, border: `1px solid ${si.color}4d` }} />;
                  })()}
                </Box>
              </Box>

              {/* Preview */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>プレビュー</Typography>
                <Box sx={{ aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                  {show3DPreview ? (
                    <InlineWorkFilePreview fileId={selectedFile.id} storagePath={selectedFile.storagePath} fileName={selectedFile.name} toolType={selectedFile.toolType || 'rhino'} localPath={selectedBinding?.localPath} onClose={() => setShow3DPreview(false)} />
                  ) : (
                    <>
                      {selectedFile.thumbnailUrl
                        ? <Box component="img" src={selectedFile.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#0b0f19' }} />
                        : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)' }}>
                            <AutoAwesomeRoundedIcon sx={{ fontSize: 28, mb: 0.5, opacity: 0.4 }} />
                            <Typography sx={{ fontSize: '0.6rem', textAlign: 'center', px: 2, lineHeight: 1.6, color: 'rgba(255,255,255,0.25)' }}>次回アップロード時に更新されます</Typography>
                          </Box>
                      }
                      <Button variant="contained" onClick={() => setShow3DPreview(true)} startIcon={<VisibilityRoundedIcon />} size="small"
                        sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.65rem', textTransform: 'none', '&:hover': { bgcolor: 'rgba(0,191,255,0.4)', borderColor: 'rgba(0,191,255,0.8)' } }}>
                        3Dビューワー
                      </Button>
                    </>
                  )}
                </Box>
              </Box>

              {/* Metadata */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>最終更新</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                    {new Date(selectedFile.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3 }}>更新者</Typography>
                  <Typography noWrap sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{updatedByName || selectedFile.updatedBy}</Typography>
                </Box>
              </Box>

              {/* Download from cloud (only if no local version) */}
              {(!versionsMap[selectedFile.id] || versionsMap[selectedFile.id].length === 0) && (
                <Button fullWidth variant="contained" startIcon={<DownloadRoundedIcon />} onClick={() => handleDownloadCloudLatest(selectedFile)}
                  sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, fontSize: '0.78rem', textTransform: 'none', borderRadius: 1.5 }}>
                  クラウドからダウンロード
                </Button>
              )}

              {/* Fork */}
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Button fullWidth variant="outlined" startIcon={<FileCopyRoundedIcon />} onClick={handleDuplicateOpenDialog}
                  sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', textTransform: 'none', borderRadius: 1.5,
                    '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.08)', color: '#fff' } }}>
                  別案として複製
                </Button>
                <Tooltip title="複製分岐について">
                  <IconButton onClick={() => setInfoDialogType('fork')}
                    sx={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5, p: 0.625,
                      '&:hover': { borderColor: '#00BFFF', color: '#00BFFF' } }}>
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Version history toggle */}
              <Button variant="text" size="small" onClick={() => toggleExpand(selectedFile.id)} startIcon={<ViewListRoundedIcon />}
                sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem',
                  '&:hover': { color: '#fff', bgcolor: 'transparent' } }}>
                {expandedFiles[selectedFile.id] ? 'ローカル履歴を隠す' : 'ローカル履歴を表示'}
              </Button>

              {/* Local Version History */}
              {expandedFiles[selectedFile.id] && (
                <Box>
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
            </Box>

            {/* Footer */}
            <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
              <Button onClick={() => setSelectedFileId(null)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}>
                閉じる
              </Button>
              <Tooltip title="クラウド連携について">
                <IconButton onClick={() => setInfoDialogType('upload')}
                  sx={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5, p: 0.5,
                    '&:hover': { borderColor: '#fa709a', color: '#fa709a' } }}>
                  <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Button onClick={() => handleUploadVersion(selectedFile)} variant="contained"
                sx={{ bgcolor: '#fa709a', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, fontSize: '0.78rem',
                  '&:hover': { bgcolor: '#ff90b2' }, boxShadow: 'none' }}>
                クラウドへ同期
              </Button>
            </Box>

        </Box>
      )}

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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><FolderOpenRoundedIcon sx={{ color: '#00BFFF' }} />ローカル保存先</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>このプロジェクトのローカルファイルが保存されているフォルダです。</Typography>
          <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}>保存先フォルダ</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#fff', wordBreak: 'break-all' }}>{customBaseDir || defaultBaseDir || '—'}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setFolderSettingsDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>閉じる</Button>
        </DialogActions>
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
