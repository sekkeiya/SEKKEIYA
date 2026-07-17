import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Tooltip, Breadcrumbs, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Slider, useMediaQuery,
} from '@mui/material';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { DsiImageGrid } from './DsiImageGrid';
import { DsiRightPanel } from './components/DsiRightPanel';
import { DsiSidebar } from '../../shared/layout/dsi-sidebar/DsiSidebar';
import { DsiUploadDialog } from './upload/DsiUploadDialog';
import { dsiUploadService } from './upload/dsiUploadService';
import { useDsiStore, DSI_CATEGORIES, type DsiCategoryFilter } from './store/useDsiStore';
import { useTextureSetStore } from './store/useTextureSetStore';
import { useTextureMetaStore } from './store/useTextureMetaStore';
import { buildTextureGroups, autoGroupByFolder, type TextureApplication } from './textureGrouping';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import { useImagePickerStore } from '../../store/useImagePickerStore';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDsiEditorStore } from './store/useDsiEditorStore';
import { useAiSettingsStore, isEditCapableProvider, DEFAULT_EDIT_PROVIDER } from '../../store/useAiSettingsStore';

const ACCENT = '#ec407a';
const ACCENT_HOVER = '#f48fb1';

interface DsiDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
  images: any[];
  sets: any[];
  /** global_projects スコープ時の公開プロジェクト一覧（それ以外は null） */
  projects?: any[] | null;
  isInitializing?: boolean;
  isGlobal?: boolean;
  /** ローカル素材（LocalAssets）の読み取り専用ブラウズモード */
  isLocal?: boolean;
  /** ローカル素材の読み込みエラー */
  localError?: string;
  onDeleteItem?: (item: any) => void;
  onSelectItem?: (item: any) => void;
  onOpenProject?: (project: any) => void;
}

const FILTER_TABS: { key: DsiCategoryFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  // 動画は S.Movie 側で管理するため S.Image のカテゴリからは除外する。
  ...DSI_CATEGORIES.filter(c => c !== '動画').map(c => ({ key: c as DsiCategoryFilter, label: c })),
];

// ヘッダーの大見出し = 左サイドバーで選択中のスコープ名（S.Movie と同様）。
// プロジェクトスコープはプロジェクト名を出すため、ここには含めず下で解決する。
const DSI_SCOPE_TITLES: Record<string, string> = {
  global_images: 'Image',
  global_projects: 'Public Projects',
  local_assets: 'ローカル素材',
  my_public_images: 'Public Image',
  my_private_images: 'Private Image',
};

export const DsiDashboard: React.FC<DsiDashboardProps> = ({ payload, images, sets, projects = null, isInitializing, isGlobal, isLocal, localError, onOpenProject }) => {
  const categoryFilter = useDsiStore(s => s.categoryFilter);
  const setCategoryFilter = useDsiStore(s => s.setCategoryFilter);
  const openSetId = useDsiStore(s => s.openSetId);
  const setOpenSetId = useDsiStore(s => s.setOpenSetId);
  const selectedImageId = useDsiStore(s => s.selectedImageId);
  const setSelectedImageId = useDsiStore(s => s.setSelectedImageId);
  const pickMode = useDsiStore(s => s.pickMode);
  const pickMax = useDsiStore(s => s.pickMax);
  const selectedIds = useDsiStore(s => s.selectedIds);
  const clearPicks = useDsiStore(s => s.clearPicks);
  const selectAll = useDsiStore(s => s.selectAll);
  const generatedFilter = useDsiStore(s => s.generatedFilter);
  const setGeneratedFilter = useDsiStore(s => s.setGeneratedFilter);
  const textureSetMode = useDsiStore(s => s.textureSetMode);
  const setTextureSetMode = useDsiStore(s => s.setTextureSetMode);
  const textureSetSelection = useDsiStore(s => s.textureSetSelection);
  const clearTextureSetSelection = useDsiStore(s => s.clearTextureSetSelection);
  const manualTextureSets = useTextureSetStore(s => s.sets);
  const createTextureSet = useTextureSetStore(s => s.createSet);
  const removeTextureSet = useTextureSetStore(s => s.removeSet);
  const appOverrides = useTextureMetaStore(s => s.appOverrides);
  const setAppOverride = useTextureMetaStore(s => s.setAppOverride);
  const existingMaterialIds = useImagePickerStore(s => s.existingMaterialIds);
  const pickerPurpose = useImagePickerStore(s => s.request?.purpose);

  const handleConfirmPick = () => {
    const items = images
      .filter((d) => selectedIds.has(d.id) && d.downloadUrl)
      .map((d) => ({
        id: d.id,
        downloadUrl: d.downloadUrl as string,
        title: d.title || d.name,
        tags: d.tags,
      }));
    useImagePickerStore.getState().confirm(items);
  };
  const handleCancelPick = () => useImagePickerStore.getState().cancel();

  const projectId = payload?.projectId || '';
  const canWrite = !!projectId && !isGlobal;

  const setDsiShellMode = useAppStore(s => s.setDsiShellMode);
  // S.Image エディター（生成 / 編集）を開く。baseUrl 指定時はその画像を編集の起点にする。
  // targetProjectId は保存先。横断ビュー（Private/Public Image）では編集元画像の
  // projectId を渡し、その画像が属するプロジェクトへ保存する。
  const openImageEditor = useCallback((baseUrl?: string, targetProjectId?: string, title?: string) => {
    // 保存先: 明示指定 → 選択中プロジェクト → アクティブ/自分の既定プロジェクト。
    // 横断ビュー（Private/Public Image など、プロジェクト未選択）でも既定プロジェクトへ保存して開けるようにする。
    let target = targetProjectId || projectId;
    if (!target) {
      const st = useAppStore.getState();
      const uid = useAuthStore.getState().currentUser?.uid;
      const projs = (st.projects || []) as any[];
      target = st.activeProjectId
        || projs.find((p) => p.ownerId === uid && !p.isTeam)?.id
        || projs.find((p) => !p.isTeam)?.id
        || projs[0]?.id
        || '';
    }
    if (!target) { window.alert('保存先のプロジェクトがありません。先にプロジェクトを作成してください。'); return; }
    const configured = useAiSettingsStore.getState().imageProvider || 'nanobanana';
    // 編集（ベース画像あり）は画像編集対応モデルが必須。未対応なら編集対応の既定へ。
    const provider = baseUrl ? (isEditCapableProvider(configured) ? configured : DEFAULT_EDIT_PROVIDER) : configured;
    const editorStore = useDsiEditorStore.getState();
    // ベース画像指定（特定画像の編集）or 既存チャットが無い場合のみ新規セッション。
    // それ以外（「画像生成・編集」で再入）は既存チャットを維持して開き直す＝ダッシュボード
    // 往復で生成履歴がリセットされないようにする。
    const hasSession = editorStore.branches.some((b) => b.messages.length > 0);
    if (baseUrl || !hasSession) {
      editorStore.initSession({
        originImageUrl: baseUrl || null,
        originTitle: title || '',
        targetProjectId: target,
        provider,
      });
    }
    setDsiShellMode('editor');
  }, [projectId, setDsiShellMode]);

  const isProjectsMode = projects !== null;
  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);
  useEffect(() => {
    setAiTaskInnerRight(isProjectsMode ? 0 : 280);
    return () => setAiTaskInnerRight(0);
  }, [isProjectsMode, setAiTaskInnerRight]);
  const openSet = useMemo(() => sets.find(s => s.id === openSetId) || null, [sets, openSetId]);

  // 大見出しは左サイドバーで選択中のスコープ/プロジェクト名を表示する（S.Movie と同じ挙動）。
  const dsiScope = useAppStore(s => s.dsiScope);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const allProjects = useAppStore(s => s.projects);
  const scopeTitle = useMemo(() => {
    if (dsiScope === 'project_images' || dsiScope === 'team_project_images') {
      return allProjects.find((p: any) => p.id === activeProjectId)?.name || 'プロジェクト';
    }
    return DSI_SCOPE_TITLES[dsiScope] || '画像';
  }, [dsiScope, activeProjectId, allProjects]);

  // 削除可否: 自分のライブラリ（Private/Public Image）・プロジェクト・ローカルのみ。
  // 「みんなの公開（global_images）」等の他人の画像は削除できない。
  const canDelete = isLocal || canWrite || dsiScope === 'my_public_images' || dsiScope === 'my_private_images';

  // 画像/動画ドキュメントを「出所（sourceCollection）」に応じて正しいコレクションから削除する。
  const deleteImageDoc = useCallback(async (d: any) => {
    const sc = d.sourceCollection;
    const pid = d.projectId || projectId;
    if (sc === 'global_assets') {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase/client');
      await deleteDoc(doc(db, 'assets', d.id));
      return;
    }
    if (sc === 'assets' && pid && pid !== 'global') {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase/client');
      await deleteDoc(doc(db, 'projects', pid, 'assets', d.id));
      return;
    }
    if (!pid) throw new Error('削除先プロジェクトが特定できません');
    // workFiles（＋手動アップロードの実体 Storage）。参照リンクは元 Storage を守る。
    await dsiUploadService.deleteImage(pid, d);
  }, [projectId]);

  // 複数の画像アイテムをまとめて削除（ローカルはファイル削除、クラウドは各コレクション）。
  const performDeleteImages = useCallback(async (items: any[]) => {
    const locals = items.filter((d) => d.isLocal || d.localPath || d.path);
    const cloud = items.filter((d) => !(d.isLocal || d.localPath || d.path));
    if (locals.length) {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths = locals.map((d) => d.localPath || d.path || d.id).filter(Boolean);
      if (paths.length) await invoke('delete_local_files', { paths });
    }
    for (const d of cloud) {
      try { await deleteImageDoc(d); }
      catch (e) { console.warn('[DsiDashboard] delete doc failed', d?.id, e); }
    }
  }, [deleteImageDoc]);

  // テクスチャ（トップ階層）をマテリアル単位に束ねる。手動セットを最優先。
  // 部位カテゴリは手動上書き（appOverrides）があればそれを採用する。
  // 一覧の重ねカード／右パネルの両方で共有。
  const textureGroups = useMemo(
    () => buildTextureGroups(images.filter(d => !d.parentSetId && d.category === 'テクスチャ'), manualTextureSets)
      .map(g => appOverrides[g.id] ? { ...g, applications: appOverrides[g.id] } : g),
    [images, manualTextureSets, appOverrides],
  );
  const hasTextures = textureGroups.length > 0;
  // まだセットになっていない（1マップの）テクスチャがあるか＝自動セット化の余地。
  const ungroupedTextureCount = useMemo(
    () => textureGroups.filter(g => g.items.length === 1).length,
    [textureGroups],
  );

  // 「テクスチャをセット化」: 同じフォルダのテクスチャを自動で 1 セットにまとめる。
  const handleAutoTextureSets = () => {
    // 現在 1 マップ（未グループ）の素材だけを対象にする（既存セットは触らない）。
    const singletonIds = new Set(
      textureGroups.filter(g => g.items.length === 1).map(g => g.items[0]?.id).filter(Boolean),
    );
    const candidates = images.filter(d => !d.parentSetId && d.category === 'テクスチャ' && singletonIds.has(d.id));
    const groups = autoGroupByFolder(candidates);
    let created = 0;
    for (const g of groups) {
      if (createTextureSet(g.memberIds, g.name)) created++;
    }
    if (created > 0) {
      window.alert(`${created} 件のテクスチャセットを自動作成しました。`);
    } else {
      window.alert('フォルダ単位で自動的にまとめられるテクスチャが見つかりませんでした。\nマテリアルごとにフォルダ分けされていない場合は「手動で選択」でまとめてください。');
    }
  };

  // 選択中テクスチャを 1 セットにまとめる（手動）。
  const handleCreateTextureSet = () => {
    const ids = Array.from(textureSetSelection);
    if (ids.length < 2) return;
    // 名前: 選択に含まれる basecolor のファイル名 → 無ければ汎用名。
    const memberImgs = images.filter(d => textureSetSelection.has(d.id));
    const albedo = memberImgs.find(d => /(albedo|basecolor|base_color|diffuse|color)/i.test(d.name || d.title || ''));
    const base = (albedo?.name || albedo?.title || memberImgs[0]?.name || 'テクスチャセット')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]?(albedo|basecolor|base_color|diffuse|color|normal|nrm|rough(ness)?|ao|occlusion|metal(ness|lic)?)$/i, '')
      .trim();
    createTextureSet(ids, base || 'テクスチャセット');
    clearTextureSetSelection();
    setTextureSetMode(false);
  };
  const selectedGroup = useMemo(
    () => textureGroups.find(g => g.id === selectedImageId) || null,
    [textureGroups, selectedImageId],
  );
  const selectedItem = useMemo(
    () => selectedGroup?.cover || images.find(d => d.id === selectedImageId) || null,
    [selectedGroup, images, selectedImageId],
  );

  // Ctrl+A 全選択
  const handleSelectAll = useCallback(() => {
    const ids: string[] = [];
    if (openSetId) {
      images
        .filter(d => d.parentSetId === openSetId && (categoryFilter === 'all' || d.category === categoryFilter) && d.downloadUrl)
        .forEach(d => ids.push(d.id));
    } else {
      if (categoryFilter === 'all' || categoryFilter === 'テクスチャ') {
        textureGroups.forEach(g => g.items.forEach((it: any) => { if (it.id && it.downloadUrl) ids.push(it.id); }));
      }
      if (categoryFilter !== 'テクスチャ') {
        images
          .filter(d => !d.parentSetId && d.category !== 'テクスチャ' && (categoryFilter === 'all' || d.category === categoryFilter) && d.downloadUrl)
          .forEach(d => ids.push(d.id));
      }
    }
    selectAll(ids);
  }, [openSetId, categoryFilter, images, textureGroups, selectAll]);

  useEffect(() => {
    if (!pickMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickMode, handleSelectAll]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ライトマップ一括削除
  const [lightmapDeleteOpen, setLightmapDeleteOpen] = useState(false);
  const [deletingLightmaps, setDeletingLightmaps] = useState(false);
  // Shift+クリック複数選択削除
  const [dsiMultiDeleteIds, setDsiMultiDeleteIds] = useState<Set<string>>(new Set());
  const [dsiMultiDeleteConfirm, setDsiMultiDeleteConfirm] = useState<any[] | null>(null);
  const [deletingDsiMulti, setDeletingDsiMulti] = useState(false);
  // 類似検出しきい値ダイアログ
  const [simTexThresholdDialog, setSimTexThresholdDialog] = useState(false);
  const [simTexThresholdBits, setSimTexThresholdBits] = useState(8);
  const lightmapImages = useMemo(() => {
    if (!isLocal) return [];
    return images.filter((img) => {
      const name = (img.name || img.title || '').toLowerCase();
      return name.includes('lightmap') || name.includes('light_map');
    });
  }, [images, isLocal]);

  const handleDeleteLightmaps = async () => {
    if (!lightmapImages.length || deletingLightmaps) return;
    setDeletingLightmaps(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths = lightmapImages.map((img) => img.path || img.id);
      await invoke('delete_local_files', { paths });
      setLightmapDeleteOpen(false);
    } catch (e) {
      console.error('[DsiDashboard] lightmap delete failed', e);
      window.alert('削除に失敗しました: ' + String(e));
    } finally {
      setDeletingLightmaps(false);
    }
  };

  // 視覚的類似テクスチャグループの自動検出・削除（dHash ベース）
  type TexGroup = typeof textureGroups[0];
  const [simTexDialog, setSimTexDialog] = useState<{
    groups: { keep: TexGroup; remove: TexGroup[]; minDist: number }[];
    totalGroups: number;
    totalFiles: number;
  } | null>(null);
  const [simTexProgress, setSimTexProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingSimTex, setDeletingSimTex] = useState(false);

  const detectSimilarTextures = async (threshold = 8) => {
    if (!textureGroups.length) return;
    setSimTexProgress({ done: 0, total: textureGroups.length });
    try {
      const { detectSimilarByHash } = await import('./utils/imageHash');
      const groups = await detectSimilarByHash(
        textureGroups,
        (g) => g.id,
        (g) => g.cover?.downloadUrl || g.cover?.thumbnailUrl,
        (g) => g.items.length, // マップ数が多い方を残す
        threshold,
        (done, total) => setSimTexProgress({ done, total }),
      );
      setSimTexProgress(null);
      if (!groups.length) { window.alert('視覚的に類似するテクスチャグループは見つかりませんでした。'); return; }
      const totalFiles = groups.reduce((s, g) => s + g.remove.reduce((ss, r) => ss + r.items.length, 0), 0);
      setSimTexDialog({
        groups: groups.map((g) => ({ keep: g.keep, remove: g.remove, minDist: g.minDist })),
        totalGroups: groups.reduce((s, g) => s + g.remove.length, 0),
        totalFiles,
      });
    } catch (e) {
      setSimTexProgress(null);
      console.error('[DsiDashboard] sim tex detect failed', e);
      window.alert('解析に失敗しました: ' + String(e));
    }
  };

  const handleSimTexDeleteConfirm = async () => {
    if (!simTexDialog || deletingSimTex) return;
    setDeletingSimTex(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths = simTexDialog.groups.flatMap((g) =>
        g.remove.flatMap((r) => r.items.map((it: any) => it.path || it.id)),
      ).filter(Boolean);
      if (paths.length) await invoke('delete_local_files', { paths });
      setSimTexDialog(null);
    } catch (e) {
      console.error('[DsiDashboard] sim tex delete failed', e);
      window.alert('削除に失敗しました: ' + String(e));
    } finally {
      setDeletingSimTex(false);
    }
  };

  const handleDsiMultiDeleteOpen = () => {
    const items: any[] = [];
    for (const id of dsiMultiDeleteIds) {
      const group = textureGroups.find((g) => g.id === id);
      if (group) { items.push({ ...group, _type: 'texture-group' }); continue; }
      const img = images.find((d) => d.id === id);
      if (img) items.push({ ...img, _type: 'image' });
    }
    if (items.length) setDsiMultiDeleteConfirm(items);
  };

  const handleDsiMultiDeleteConfirm = async () => {
    if (!dsiMultiDeleteConfirm || deletingDsiMulti) return;
    const items = dsiMultiDeleteConfirm;
    setDeletingDsiMulti(true);
    setDsiMultiDeleteConfirm(null);
    try {
      // テクスチャグループは全マップに展開してから、出所別に一括削除。
      const flat = items.flatMap((d) => d._type === 'texture-group' ? (d.items || []) : [d]);
      await performDeleteImages(flat);
      setDsiMultiDeleteIds(new Set());
      setSelectedImageId(null);
    } catch (e) {
      console.error('[DsiDashboard] multi delete failed', e);
      window.alert('削除に失敗しました: ' + String(e));
    } finally { setDeletingDsiMulti(false); }
  };

  const handleCreateSet = async () => {
    if (!projectId || !newSetName.trim() || creatingSet) return;
    setCreatingSet(true);
    try {
      await dsiUploadService.createImageSet(projectId, { title: newSetName.trim() });
      setNewSetName('');
      setSetDialogOpen(false);
    } catch (e) {
      console.error('[DsiDashboard] create set failed', e);
    } finally {
      setCreatingSet(false);
    }
  };

  const handleMove = async (item: any, newSetId: string | null) => {
    if (!projectId) return;
    try {
      await dsiUploadService.moveImageToSet(projectId, item.id, newSetId, item.parentSetId ?? null);
    } catch (e) {
      console.error('[DsiDashboard] move failed', e);
    }
  };

  const handleSetVisibility = async (item: any, visibility: 'public' | 'private') => {
    const pid = item.projectId || projectId;
    if (!pid) return;
    try {
      await dsiUploadService.setImageVisibility(pid, item.id, visibility);
    } catch (e) {
      console.error('[DsiDashboard] set visibility failed', e);
    }
  };

  const handleUpdateMeta = async (item: any, fields: { category?: any; tags?: string[] }) => {
    const pid = item.projectId || projectId;
    if (!pid) return;
    try {
      await dsiUploadService.updateImageMeta(pid, item.id, fields);
    } catch (e) {
      console.error('[DsiDashboard] update meta failed', e);
    }
  };

  const handleConfirmDelete = async (cascade: boolean) => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'image-set') {
        if (projectId) {
          await dsiUploadService.deleteImageSet(projectId, deleteTarget.id, cascade);
          if (openSetId === deleteTarget.id) setOpenSetId(null);
        }
      } else if (deleteTarget.type === 'texture-group' && deleteTarget._textureGroup) {
        // テクスチャセットは含まれる全マップ（Base/Normal/Rough/AO）をまとめて削除。
        await performDeleteImages(deleteTarget._textureGroup.items || []);
        if (selectedImageId === deleteTarget._textureGroup.id) setSelectedImageId(null);
      } else {
        await performDeleteImages([deleteTarget]);
        if (selectedImageId === deleteTarget.id) setSelectedImageId(null);
      }
      setDeleteTarget(null);
    } catch (e) {
      console.error('[DsiDashboard] delete failed', e);
      window.alert('削除に失敗しました: ' + String(e));
    } finally {
      setDeleting(false);
    }
  };

  // Delete / Backspace キーで選択中のアイテムを削除（確認ダイアログ経由）。
  useEffect(() => {
    if (!canDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (pickMode || textureSetMode) return;
      if (deleteTarget || dsiMultiDeleteConfirm) return; // ダイアログ表示中は無視
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Shift+クリックで複数選択済みならそれらを、無ければ単一選択（グループ優先）を対象にする。
      if (dsiMultiDeleteIds.size > 0) {
        e.preventDefault();
        handleDsiMultiDeleteOpen();
        return;
      }
      if (selectedGroup) {
        e.preventDefault();
        setDeleteTarget({ type: 'texture-group', _textureGroup: selectedGroup, id: selectedGroup.id, title: selectedGroup.title });
      } else if (selectedImageId) {
        const img = images.find((d) => d.id === selectedImageId);
        if (img) { e.preventDefault(); setDeleteTarget(img); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canDelete, pickMode, textureSetMode, deleteTarget, dsiMultiDeleteConfirm, dsiMultiDeleteIds, selectedGroup, selectedImageId, images, handleDsiMultiDeleteOpen]);

  // ESC で選択を解除（複数選択・単一選択）。ダイアログ表示中はダイアログ側に委ねる。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pickMode || textureSetMode) return; // これらの解除は専用バーで行う
      if (deleteTarget || dsiMultiDeleteConfirm) return; // ダイアログ優先
      if (dsiMultiDeleteIds.size > 0 || selectedImageId) {
        e.preventDefault();
        if (dsiMultiDeleteIds.size > 0) setDsiMultiDeleteIds(new Set());
        setSelectedImageId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickMode, textureSetMode, deleteTarget, dsiMultiDeleteConfirm, dsiMultiDeleteIds, selectedImageId, setSelectedImageId]);

  // ── 全幅ヘッダー化レイアウト（デスクトップのみ） ──────────────────────────
  // デスクトップでは MainLayout のグローバル左サイドバーを抑止済みのため、
  // ツールバーを全幅トップバンドにし、その下の 3 ゾーン行へ DsiSidebar を埋め込む。
  // モバイルは従来どおり（左サイドバー埋め込みなし）。
  const isMobile = useMediaQuery('(max-width:768px)');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', bgcolor: 'background.default', position: 'relative' }}>
      {/* ── 全幅トップバンド: ピッカーバー / セット化バー / ツールバー ── */}
        {/* 複数選択モード（チャットの3D生成ピッカー）バー */}
        {pickMode && (
          <Box sx={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2, py: 1,
            bgcolor: 'rgba(236,64,122,0.12)', borderBottom: `1px solid ${ACCENT}`,
          }}>
            <ViewInArRoundedIcon sx={{ color: ACCENT, flexShrink: 0 }} />
            <Typography sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 0 }}>
              選択中 {selectedIds.size} / 最大 {pickMax} 枚
            </Typography>

            {/* 生成済み/未生成フィルタ（S.Material ピッカーのみ表示） */}
            {pickerPurpose === 'material' && existingMaterialIds.size > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                {(['all', 'ungenerated', 'generated'] as const).map((f) => {
                  const label = f === 'all' ? 'すべて' : f === 'ungenerated' ? '未生成' : '生成済み';
                  const active = generatedFilter === f;
                  return (
                    <Box key={f} onClick={() => setGeneratedFilter(f)}
                      sx={{
                        px: 1.25, py: 0.375, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                        bgcolor: active ? (f === 'generated' ? 'rgba(76,175,80,0.7)' : f === 'ungenerated' ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.15)') : 'rgb(var(--brand-fg-rgb) / 0.07)',
                        border: `1px solid ${active ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
                        transition: 'background-color 0.12s',
                        '&:hover': { bgcolor: active ? undefined : 'rgb(var(--brand-fg-rgb) / 0.12)' },
                      }}>
                      {label}
                    </Box>
                  );
                })}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, ml: 'auto', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', whiteSpace: 'nowrap', mr: 0.5 }}>
                Ctrl+A で全選択
              </Typography>
              <Button onClick={clearPicks} size="small" disabled={selectedIds.size === 0}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', whiteSpace: 'nowrap', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.25)' } }}>
                選択解除
              </Button>
              <Button onClick={handleCancelPick} size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', whiteSpace: 'nowrap' }}>
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmPick} size="small" variant="contained" disabled={selectedIds.size === 0}
                startIcon={<ViewInArRoundedIcon />}
                sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', whiteSpace: 'nowrap', '&:hover': { bgcolor: ACCENT_HOVER }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
              >
                {pickerPurpose === 'material' ? `この画像でマテリアル生成（${selectedIds.size}）` : `この画像で3D生成（${selectedIds.size}）`}
              </Button>
            </Box>
          </Box>
        )}
        {/* テクスチャ手動セット化バー */}
        {textureSetMode && (
          <Box sx={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2, py: 1,
            bgcolor: 'rgba(66,165,245,0.12)', borderBottom: '1px solid #42a5f5',
          }}>
            <LayersRoundedIcon sx={{ color: 'light-dark(#095fa5, #42a5f5)', flexShrink: 0 }} />
            <Typography sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              1セットにするテクスチャを選択　選択中 {textureSetSelection.size} 枚
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, ml: 'auto', alignItems: 'center' }}>
              <Button onClick={() => setTextureSetMode(false)} size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', whiteSpace: 'nowrap' }}>
                キャンセル
              </Button>
              <Button
                onClick={handleCreateTextureSet} size="small" variant="contained" disabled={textureSetSelection.size < 2}
                startIcon={<LayersRoundedIcon />}
                sx={{ bgcolor: '#42a5f5', color: 'var(--brand-fg)', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#64b5f6' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
              >
                セットにする（{textureSetSelection.size}）
              </Button>
            </Box>
          </Box>
        )}
        {/* Toolbar */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
                {isLocal ? 'Local Assets' : 'Image Library'}
              </Typography>
              {openSet ? (
                <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />} sx={{ mt: 0.25 }}>
                  <Link component="button" underline="hover" onClick={() => setOpenSetId(null)}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 20, fontWeight: 700, '&:hover': { color: 'var(--brand-fg)' } }}>
                    {scopeTitle}
                  </Link>
                  <Typography sx={{ color: 'var(--brand-fg)', fontSize: 20, fontWeight: 700 }}>{openSet.title || 'セット'}</Typography>
                </Breadcrumbs>
              ) : (
                <Typography sx={{ color: 'var(--brand-fg)', fontSize: 22, fontWeight: 700, mt: 0.25 }}>{scopeTitle}</Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {hasTextures && !pickMode && !textureSetMode && (
              <>
                <Tooltip title="同じフォルダのテクスチャ（ベースカラー/ノーマル/ラフネス/AO）を自動で1セットにまとめます" placement="bottom">
                  <span>
                    <Button
                      size="small" variant="contained" startIcon={<LayersRoundedIcon />}
                      disabled={ungroupedTextureCount === 0}
                      onClick={handleAutoTextureSets}
                      sx={{ bgcolor: '#42a5f5', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#64b5f6' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
                    >
                      テクスチャをセット化
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="自動でまとまらないテクスチャを手で選んでセットにします" placement="bottom">
                  <Button
                    size="small" variant="text"
                    onClick={() => setTextureSetMode(true)}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', minWidth: 0, '&:hover': { color: 'light-dark(#095fa5, #42a5f5)' } }}
                  >
                    手動で選択
                  </Button>
                </Tooltip>
              </>
            )}
            {isLocal ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  %USERPROFILE%\SEKKEIYA\LocalAssets\Images（読み取り専用・サブフォルダ対応）
                </Typography>
                {textureGroups.length > 0 && (
                  <Tooltip title="画像の見た目を解析して人の目で見分けがつかないテクスチャを自動検出・削除" placement="bottom">
                    <Button
                      size="small" variant="outlined" startIcon={<DeleteSweepRoundedIcon />}
                      disabled={!!simTexProgress}
                      onClick={() => setSimTexThresholdDialog(true)}
                      sx={{ color: 'light-dark(#9e103f, #f48fb1)', borderColor: 'rgba(244,143,177,0.4)', '&:hover': { borderColor: '#f48fb1', bgcolor: 'rgba(244,143,177,0.06)' }, '&.Mui-disabled': { color: 'light-dark(rgba(158,16,63,0.4), rgba(244,143,177,0.4))', borderColor: 'rgba(244,143,177,0.2)' } }}
                    >
                      {simTexProgress
                        ? `解析中 ${simTexProgress.done}/${simTexProgress.total}…`
                        : '類似を削除'}
                    </Button>
                  </Tooltip>
                )}
                {lightmapImages.length > 0 && (
                  <Tooltip title={`ライトマップファイルを ${lightmapImages.length} 件削除`} placement="bottom">
                    <Button
                      size="small" variant="outlined" startIcon={<DeleteSweepRoundedIcon />}
                      onClick={() => setLightmapDeleteOpen(true)}
                      sx={{ color: 'light-dark(#9e103f, #f48fb1)', borderColor: 'rgba(244,143,177,0.4)', '&:hover': { borderColor: '#f48fb1', bgcolor: 'rgba(244,143,177,0.06)' } }}
                    >
                      ライトマップ削除 ({lightmapImages.length})
                    </Button>
                  </Tooltip>
                )}
              </Box>
            ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={canWrite ? '画像セットを作成' : 'プロジェクトを選択してください'} placement="bottom">
                <span>
                  <Button
                    variant="outlined" size="small" startIcon={<CreateNewFolderRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => { setNewSetName(''); setSetDialogOpen(true); }}
                    sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: ACCENT }, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                  >
                    新規セット
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={allProjects.length > 0 ? 'AIで画像を生成・編集（エディタが開きます・保存先は選択中／既定のプロジェクト）' : 'まずプロジェクトを作成してください'} placement="bottom">
                <span>
                  <Button
                    variant="outlined" size="small" startIcon={<AutoAwesomeRoundedIcon />}
                    disabled={allProjects.length === 0}
                    onClick={() => openImageEditor()}
                    sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: ACCENT }, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                  >
                    画像生成・編集
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={isGlobal ? '公開画像の閲覧' : !projectId ? 'プロジェクトを選択してください' : '画像をアップロード'} placement="left">
                <span>
                  <Button
                    variant="contained" size="small" startIcon={<CloudUploadRoundedIcon />}
                    disabled={!canWrite}
                    onClick={() => setUploadOpen(true)}
                    sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: ACCENT_HOVER }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
                  >
                    アップロード
                  </Button>
                </span>
              </Tooltip>
            </Box>
            )}
            </Box>
          </Box>

          {/* Category filter tabs */}
          {!isProjectsMode && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {FILTER_TABS.map(tab => {
              const active = categoryFilter === tab.key;
              return (
                <Box
                  key={tab.key}
                  onClick={() => setCategoryFilter(tab.key)}
                  sx={{
                    px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                    bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.1)' },
                  }}
                >
                  {tab.label}
                </Box>
              );
            })}
          </Box>
          )}
        </Box>

      {/* 全幅ヘッダー下の 3 ゾーン行: 左サイドバー | グリッド | 右情報パネル */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 左サイドバー（デスクトップのみ）。ストア駆動で自身が開閉・幅を管理する。 */}
        {!isMobile && <DsiSidebar />}
        {/* Grid */}
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {isProjectsMode ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, p: 3, flex: 1, minHeight: 0, overflowY: 'auto', alignContent: 'start' }}>
              {(projects || []).map((p: any) => (
                <Box key={p.id} onClick={() => onOpenProject?.(p)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: 2, cursor: 'pointer',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', transform: 'translateY(-2px)' } }}>
                  <FolderSpecialRoundedIcon sx={{ fontSize: 28, color: ACCENT }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 600 }}>{p.name || 'プロジェクト'}</Typography>
                    <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11 }}>{p.ownerName || ''}</Typography>
                  </Box>
                </Box>
              ))}
              {(projects || []).length === 0 && (
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center', mt: 4 }}>
                  公開プロジェクトがありません
                </Typography>
              )}
            </Box>
          ) : (
            <DsiImageGrid
              images={images}
              sets={sets}
              textureGroups={textureGroups}
              isInitializing={isInitializing}
              isLocal={isLocal}
              localError={localError}
              onDeleteItem={canDelete ? (item) => setDeleteTarget(item) : undefined}
              onSelectItem={(item) => setSelectedImageId(item.id)}
              onMultiSelectChange={!pickMode && !textureSetMode ? (ids) => setDsiMultiDeleteIds(new Set(ids)) : undefined}
              multiDeleteIds={!pickMode ? dsiMultiDeleteIds : undefined}
            />
          )}
        </Box>

        {/* Right info panel（行の右端＝ヘッダー下に収まる） */}
      {!isProjectsMode && (
        <Box sx={{ width: 280, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', bgcolor: 'light-dark(rgba(15,23,42,0.05), rgba(0,0,0,0.15))', overflowY: 'auto' }}>
          <DsiRightPanel
            item={selectedItem}
            textureGroup={selectedGroup}
            onUngroupTexture={(setId) => { removeTextureSet(setId); setSelectedImageId(null); }}
            onSetApplications={(groupId, apps) => setAppOverride(groupId, apps as TextureApplication[])}
            sets={canWrite ? sets : []}
            allImages={images}
            allTextureGroups={textureGroups}
            onMove={canWrite ? handleMove : undefined}
            onSetVisibility={(canWrite || isGlobal) ? handleSetVisibility : undefined}
            onUpdateMeta={(canWrite || isGlobal) ? handleUpdateMeta : undefined}
            onAiEdit={(item) => openImageEditor(item.downloadUrl, item.projectId, item.title || item.name)}
          />
        </Box>
      )}
      </Box>

      {/* Shift+クリック複数選択フローティングバー */}
      {dsiMultiDeleteIds.size > 0 && !pickMode && !textureSetMode && (
        <Box sx={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)',
          borderRadius: 3, px: 2.5, py: 1.25,
          boxShadow: '0 6px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
        }}>
          <CheckCircleOutlineRoundedIcon sx={{ color: 'light-dark(#095fa5, #42a5f5)', fontSize: 18 }} />
          <Typography sx={{ fontSize: 13, color: 'var(--brand-fg)', fontWeight: 700 }}>
            {dsiMultiDeleteIds.size} 件選択中
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            Shift+クリックで範囲選択 / Ctrl+クリックで追加・解除 / ESCで解除
          </Typography>
          <Button size="small" onClick={() => setDsiMultiDeleteIds(new Set())}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none', minWidth: 0, ml: 0.5 }}>
            解除
          </Button>
          <Button size="small" variant="contained" color="error"
            startIcon={deletingDsiMulti ? undefined : <DeleteOutlineRoundedIcon />}
            onClick={handleDsiMultiDeleteOpen} disabled={deletingDsiMulti}
            sx={{ textTransform: 'none' }}>
            {deletingDsiMulti ? '削除中...' : '削除'}
          </Button>
        </Box>
      )}

      {/* Upload dialog */}
      {canWrite && (
        <DsiUploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          projectId={projectId}
          defaultParentSetId={openSetId}
          sets={sets}
        />
      )}

      {/* Create set dialog */}
      <Dialog open={setDialogOpen} onClose={() => !creatingSet && setSetDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 400 } }}>
        <DialogTitle sx={{ pb: 1 }}>新規セット作成</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            パース一式・動画コンテなど、複数の画像/動画をまとめるセット（フォルダ）を作成します。
          </Typography>
          <TextField
            autoFocus margin="dense" label="セット名" fullWidth variant="outlined"
            value={newSetName} onChange={(e) => setNewSetName(e.target.value)} disabled={creatingSet}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSet(); }}
            InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setSetDialogOpen(false)} disabled={creatingSet} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleCreateSet} disabled={creatingSet || !newSetName.trim()} variant="contained"
            sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: ACCENT_HOVER } }}>
            {creatingSet ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 類似検出しきい値ダイアログ（S.Image） */}
      <Dialog open={simTexThresholdDialog} onClose={() => setSimTexThresholdDialog(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, minWidth: 420 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>類似検出の設定</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.65)', mb: 2.5, lineHeight: 1.6 }}>
            テクスチャ画像の 64 ビットハッシュを比較して、何ビット以内の差異なら「類似」とみなすか設定します。
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 1 }}>
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography sx={{ fontSize: 28, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
                {simTexThresholdBits}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>ビット</Typography>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mt: 0.25 }}>
                ({(simTexThresholdBits / 64 * 100).toFixed(1)}%)
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Slider
                value={simTexThresholdBits}
                onChange={(_, v) => setSimTexThresholdBits(v as number)}
                min={1} max={20} step={1}
                marks={[
                  { value: 2, label: '3%' },
                  { value: 8, label: '12.5%' },
                  { value: 16, label: '25%' },
                ]}
                sx={{
                  color: ACCENT,
                  '& .MuiSlider-markLabel': { color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: 10 },
                  '& .MuiSlider-mark': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>厳格（ほぼ完全一致のみ）</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>緩い（多少の差も類似と判定）</Typography>
          </Box>
          <Box sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', borderRadius: 1.5, px: 2, py: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.7 }}>
              推奨: <strong style={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>8 ビット（12.5%）</strong> — 人の目では区別しにくいもの<br />
              3 ビット以下: ほぼ同一画像のみ / 16 ビット以上: 色調が似ているものも含む
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSimTexThresholdDialog(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" color="warning"
            startIcon={simTexProgress ? undefined : <DeleteSweepRoundedIcon />}
            disabled={!!simTexProgress}
            onClick={() => { setSimTexThresholdDialog(false); detectSimilarTextures(simTexThresholdBits); }}
            sx={{ textTransform: 'none' }}>
            {simTexProgress ? `解析中 ${simTexProgress.done}/${simTexProgress.total}…` : '検出開始'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shift+クリック一括削除確認ダイアログ（S.Image） */}
      <Dialog open={!!dsiMultiDeleteConfirm} onClose={() => !deletingDsiMulti && setDsiMultiDeleteConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, minWidth: 380 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>
          {dsiMultiDeleteConfirm?.length ?? 0} 件を削除
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.65)', mb: 1.5 }}>
            選択したアイテムを削除します。{isLocal ? 'ローカルファイルが削除されます。' : ''}この操作は元に戻せません。
          </Typography>
          <Box sx={{ maxHeight: 220, overflowY: 'auto', bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 1.5, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {(dsiMultiDeleteConfirm || []).map((d, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef5350', flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.85)' }} noWrap>
                  {d._type === 'texture-group'
                    ? `${d.title || 'テクスチャグループ'} (${(d.items || []).length} マップ)`
                    : (d.title || d.name || 'アイテム')}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDsiMultiDeleteConfirm(null)} disabled={deletingDsiMulti} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" color="error" disabled={deletingDsiMulti} onClick={handleDsiMultiDeleteConfirm}
            sx={{ textTransform: 'none' }}>
            {deletingDsiMulti ? '削除中...' : `${dsiMultiDeleteConfirm?.length ?? 0} 件を削除する`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 類似テクスチャグループ削除ダイアログ */}
      <Dialog open={!!simTexDialog} onClose={() => !deletingSimTex && setSimTexDialog(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>
          視覚的に類似するテクスチャを検出 — {simTexDialog?.totalGroups ?? 0} グループ削除 / {simTexDialog?.totalFiles ?? 0} ファイル
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.5 }}>
            画像の模様・明暗の変化を 64 ビットで比較し、差異が 12.5% 以内（人の目では区別困難）のグループを検出しました。
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1.5 }}>
            各グループからマップ数が多いものを 1 件残し、残りをローカルから削除します。この操作は元に戻せません。
          </Typography>
          <Box sx={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {simTexDialog?.groups.map((g, i) => (
              <Box key={i} sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', borderRadius: 1.5, px: 1.5, py: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
                {/* サムネイル比較行 */}
                <Box sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
                  {[g.keep, ...g.remove].slice(0, 4).map((grp, j) => (
                    <Box key={j} sx={{ position: 'relative', flexShrink: 0 }}>
                      <Box
                        component="img"
                        src={grp.cover?.downloadUrl || grp.cover?.thumbnailUrl}
                        sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1,
                          border: `2px solid ${j === 0 ? '#4caf50' : '#ef5350'}`,
                          opacity: j === 0 ? 1 : 0.75 }}
                      />
                      <Box sx={{ position: 'absolute', bottom: 1, left: 1, right: 1, fontSize: 8, fontWeight: 700,
                        color: 'var(--brand-fg)', bgcolor: j === 0 ? 'rgba(76,175,80,0.85)' : 'rgba(239,83,80,0.85)',
                        textAlign: 'center', borderRadius: 0.5 }}>
                        {j === 0 ? '残す' : '削除'}
                      </Box>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', ml: 0.5 }}>
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                      類似度スコア: {64 - g.minDist}/64 ビット一致
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                      ({Math.round((1 - g.minDist / 64) * 100)}% 同一)
                    </Typography>
                  </Box>
                </Box>
                {/* 詳細テキスト */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4caf50', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, color: 'var(--brand-fg)', fontWeight: 600 }}>{g.keep.title} ({g.keep.items.length} マップ)</Typography>
                </Box>
                {g.remove.map((r, j) => (
                  <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 1 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ef5350', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{r.title} ({r.items.length} マップ)</Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSimTexDialog(null)} disabled={deletingSimTex} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" color="error" disabled={deletingSimTex} onClick={handleSimTexDeleteConfirm}
            sx={{ textTransform: 'none' }}>
            {deletingSimTex ? '削除中...' : `削除する (${simTexDialog?.totalFiles ?? 0} ファイル)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ライトマップ一括削除ダイアログ */}
      <Dialog open={lightmapDeleteOpen} onClose={() => !deletingLightmaps && setLightmapDeleteOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 440 } }}>
        <DialogTitle sx={{ pb: 1 }}>ライトマップを削除</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14, mb: 1.5 }}>
            以下の {lightmapImages.length} 件のライトマップファイルをローカルから削除します。この操作は元に戻せません。
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1.5, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {lightmapImages.map((img) => (
              <Typography key={img.id} sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.55)', wordBreak: 'break-all' }}>
                {img.name || img.title}
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setLightmapDeleteOpen(false)} disabled={deletingLightmaps} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleDeleteLightmaps} disabled={deletingLightmaps} variant="contained" color="error">
            {deletingLightmaps ? '削除中...' : `${lightmapImages.length} 件を削除`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          {deleteTarget?.type === 'image-set' ? (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
              セット「{deleteTarget?.title || 'セット'}」を削除します。中の画像/動画も一緒に削除しますか？<br />
              「セットのみ削除」を選ぶと、中のアイテムはトップ階層に残ります。
            </Typography>
          ) : (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
              「{deleteTarget?.title || deleteTarget?.name || 'このアイテム'}」
              {deleteTarget?.type === 'texture-group' ? `（${deleteTarget?._textureGroup?.items?.length ?? 0} マップ）` : ''}
              を削除しますか？
              {(deleteTarget?.sourceType === 'layout-render' || deleteTarget?.sourceType === 'ai-render')
                ? ' これは元データへの参照です。S.Image の一覧から外れますが、元の S.Layout / AI Render のデータは残ります。'
                : ' この操作は元に戻せません。'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          {deleteTarget?.type === 'image-set' && (
            <Button onClick={() => handleConfirmDelete(false)} disabled={deleting} sx={{ color: 'var(--brand-fg)' }}>
              セットのみ削除
            </Button>
          )}
          <Button onClick={() => handleConfirmDelete(true)} disabled={deleting} variant="contained" color="error">
            {deleting ? '削除中...' : deleteTarget?.type === 'image-set' ? 'まとめて削除' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
