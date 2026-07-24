import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useDspStore } from '../store/useDspStore';
import { resolveAssetPreviewUrl } from '../../../store/useAIDriveStore';
import { useDriveAssets, PICKER_LAYERS } from '../../drive/driveAccess';
import { dspRepository } from '../api/dspRepository';
import { getAuth } from 'firebase/auth';
import type { PresentationWorkFile } from '../types/dsp.types';
import { DspEditorDock } from './DspEditorDock';
import { PresentsCanvas } from './PresentsCanvas';
import { PresentsInspector } from './PresentsInspector';
import { SpeakerNotesPanel } from './SpeakerNotesPanel';
import { DspToolbar } from './DspToolbar';
import { useDspAutosave } from '../hooks/useDspAutosave';
import { dspFsHelpers } from '../utils/dspFsHelpers';
import { useAutosaveDraft } from '../../../shared/hooks/useAutosaveDraft';

interface DspEditorProps {
  payload: any;
  onBack: () => void;
}

export const DspEditor: React.FC<DspEditorProps> = ({ payload, onBack }) => {
  const { projectId, workspaceId } = payload;

  // App store context
  const selectedItem = useAppStore(s => workspaceId ? s.panelSelections[workspaceId] : null);

  // Dsp store state
  const isHydrated = useDspStore(s => s.isHydrated);
  const { initializeWorkspace, saveStatus, isModelPickerOpen, setModelPickerOpen, selectedPageId, addElement, presentation } = useDspStore();
  const activeProject = useAppStore(s => s.projects.find(p => p.id === projectId));
  // SEKKEIYA Drive の資産（driveAccess = 決定的プール。AI Drive パネル未オープンでも取得できる）。
  const { assets: allAssets } = useDriveAssets({ layers: PICKER_LAYERS });

  const [hasError, setHasError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const modelPickerAssets = React.useMemo(() => {
    const q = modelSearch.toLowerCase();
    return allAssets.filter(a =>
      (!projectId || (a as any).projectId === projectId || !(a as any).projectId) &&
      !(a as any).isDeleted &&
      ((a as any).itemType === 'model' || (a as any).category === 'model' || (a as any).toolType || a.type === 'model' || (a as any).appScope) &&
      (!q || (a.name || '').toLowerCase().includes(q) || ((a as any).title || '').toLowerCase().includes(q))
    );
  }, [allAssets, projectId, modelSearch]);

  // Initialize autosave listener
  useDspAutosave();

  // 自動保存（ローカル下書きのみ）— 編集停止後に 3DSP フォルダへ書き出す
  useAutosaveDraft({
    key: projectId ? `3dsp:${useDspStore.getState().workFileId || 'new'}` : null,
    dirty: saveStatus === 'dirty',
    signal: presentation,
    save: async () => {
      const s = useDspStore.getState();
      if (!projectId || !s.workFileId || !s.presentation) return;
      await dspFsHelpers.saveLocalDraft(
        projectId, s.projectName || activeProject?.name || 'UnnamedProject',
        s.workFileId, s.workFileName || 'untitled', s.presentation,
      );
    },
  });

  // 未保存状態をグローバル registry に反映 → タブの「作業中」ドット表示に使う。
  // あわせて、どのプレゼンが未保存かを workFileId 単位で記録（サイドバーの「作業中」表示用）。
  const setScopeDirty = useAppStore(s => s.setScopeDirty);
  useEffect(() => {
    const isDirty = saveStatus === 'dirty';
    setScopeDirty('3dsp', isDirty);
    const st = useDspStore.getState();
    const wfId = st.workFileId;
    if (wfId && projectId) {
      useAppStore.getState().setDspWorkingSession(wfId, isDirty ? { projectId } : null);
      useAppStore.getState().setWorkingFile(`3dsp:${wfId}`, isDirty ? {
        scope: '3dsp', projectId, workFileId: wfId,
        name: st.workFileName || 'プレゼンテーション', isNew: false,
      } : null);
    }
  }, [saveStatus, setScopeDirty, projectId]);
  useEffect(() => () => { useAppStore.getState().setScopeDirty('3dsp', false); }, []);

  // initializeWorkspace が leftPanelActiveTab/showProjectBrowser をリセットするため追加エフェクト不要

  // エディター離脱時（EXIT / 別プレゼンへ切替 / サイドバー移動）の状態退避処理。
  // 未保存の作業内容はメモリの sessionCache に退避し、再起動後にも復元できるよう
  // ローカルドラフトにも書き出す。アクティブ状態はクリアして DspSidebar に戻す。
  const stashAndPersist = React.useCallback(() => {
    const s = useDspStore.getState();
    const wfId = s.workFileId;
    const wasDirty = s.saveStatus === 'dirty';

    if (wfId && s.presentation && wasDirty) {
      // 再起動後の復元用にローカルドラフトへ退避（クラウドには勝手に push しない）
      dspFsHelpers.saveLocalDraft(
        s.projectId || projectId,
        s.projectName || activeProject?.name || 'UnnamedProject',
        wfId,
        s.workFileName || 'untitled',
        s.presentation,
      ).catch(err => console.warn('[DSP] stash local draft failed:', err));
    }

    // サイドバーの「作業中」マーカー：未保存のものだけ残す
    if (wfId) {
      useAppStore.getState().setDspWorkingSession(wfId, wasDirty ? { projectId } : null);
    }
    useAppStore.getState().setDspOpenSession(null);

    // メモリへフル状態を退避（アンドゥ履歴・選択状態含む）してアクティブ状態をクリア
    s.stashWorkspace();
    // 注: projectName / presentation 等は呼び出し時に getState() から取得するため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    let active = true;

    // 退避済みセッションがあれば Firestore を再読込せず即座に復元する
    if (selectedItem?.id && useDspStore.getState().hasSession(selectedItem.id)) {
      useDspStore.getState().restoreSession(selectedItem.id);
      useAppStore.getState().setDspOpenSession({ projectId, workFileId: selectedItem.id });
      const restoredDirty = useDspStore.getState().saveStatus === 'dirty';
      useAppStore.getState().setDspWorkingSession(selectedItem.id, restoredDirty ? { projectId } : null);
      return () => {
        active = false;
        stashAndPersist();
      };
    }

    const initPresentation = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        let workFile: PresentationWorkFile | null = null;
        let localContentToUse: any = null;
        
        if (selectedItem?.id) {
          // Load existing
          workFile = await dspRepository.loadPresentationWorkFile(projectId, selectedItem.id);
          
          if (workFile) {
            // Check for newer local draft
            const pName = activeProject?.name || 'UnnamedProject';
            const localDraft = await dspFsHelpers.loadLocalDraft(projectId, pName, selectedItem.id, workFile.name || 'untitled');
            if (localDraft) {
               const cloudTime = new Date(workFile.updatedAt).getTime();
               if (localDraft.mtime > cloudTime) {
                 localContentToUse = localDraft.content;
                 // ローカル版がクラウドより新しい場合はFirestoreに自動同期
                 // （ダッシュボードのサムネイル表示のため）
                 dspRepository.savePresentationContent(
                   projectId,
                   selectedItem.id,
                   localDraft.content,
                   user.uid,
                 ).catch(err => console.warn('[DSP] Auto-sync on open failed:', err));
               }
            }
          }
        } else {
          // Create new
          const name = `Presentation ${new Date().toLocaleDateString()}`;
          workFile = await dspRepository.createPresentationWorkFile(projectId, name, user.uid);
          
          // Auto-select it in the host app store so subsequent renders know what it is
          if (active && workspaceId) {
             useAppStore.getState().setPanelSelection(workspaceId, {
               id: workFile.id,
               name: workFile.name,
               type: workFile.type
             });
          }
        }

        if (active && workFile) {
          const pName = activeProject?.name || 'UnnamedProject';
          initializeWorkspace(projectId, pName, workspaceId, workFile.id, workFile.name || 'untitled', localContentToUse || workFile.content);
          // 現在開いているプレゼンとしてマーク（サイドバーの編集中ハイライト用）
          useAppStore.getState().setDspOpenSession({ projectId, workFileId: workFile.id });
        } else if (active) {
          throw new Error("Failed to load or create presentation");
        }
      } catch (err) {
        console.error("[DspEditor] Init Error:", err);
        if (active) setHasError(true);
      }
    };

    if (projectId && workspaceId) {
      initPresentation();
    }

    return () => {
      active = false;
      stashAndPersist();
    };
  }, [projectId, workspaceId, selectedItem?.id, initializeWorkspace, stashAndPersist]);

  if (hasError) {
    return (
      <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h5" color="error">Failed to load Presentation</Typography>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
          Go Back
        </Button>
      </Box>
    );
  }

  if (!isHydrated) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: 'light-dark(#0775a6, #29b6f6)', mb: 2 }} />
        <Typography color="text.secondary">Loading 3D Shape Presents...</Typography>
      </Box>
    );
  }

  const handleSyncToCloud = async () => {
    const { projectId, workFileId, presentation } = useDspStore.getState();
    const { currentUser } = getAuth();
    if (!projectId || !workFileId || !presentation || !currentUser) return;
    try {
      setIsSyncing(true);
      await dspRepository.savePresentationContent(projectId, workFileId, presentation, currentUser.uid);
      // Optional: you could show a success toast here
    } catch (e) {
      console.error('Cloud Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveStatusIndicator = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
      {/* ── ローカル保存ステータス ── */}
      {saveStatus === 'saving' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
          <CircularProgress size={13} sx={{ color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>保存中...</Typography>
        </Box>
      )}
      {saveStatus === 'saved' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#4caf50' }}>
          <SaveRoundedIcon sx={{ fontSize: 15 }} />
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>ローカル保存済</Typography>
        </Box>
      )}
      {saveStatus === 'dirty' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
          <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: '#ff9800' }} />
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>未保存</Typography>
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap', color: 'rgb(var(--brand-fg-rgb) / 0.25)', fontSize: 10 }}>
            Ctrl+S で保存
          </Typography>
        </Box>
      )}
      {saveStatus === 'error' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#f44336' }}>
          <CloudOffRoundedIcon sx={{ fontSize: 15 }} />
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>保存失敗</Typography>
        </Box>
      )}
      {(saveStatus === 'idle') && (
        <Typography variant="caption" sx={{ whiteSpace: 'nowrap', color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 10 }}>
          Ctrl+S で保存
        </Typography>
      )}

      {/* ── 区切り線 ── */}
      <Box sx={{ width: 1, height: 20, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />

      {/* ── テンプレートとして保存（①手作業/②パワポ/③既存流用 の共通出口）── */}
      <Button
        variant="contained"
        size="small"
        onClick={() => {
          const s = useDspStore.getState();
          s.setShowRightSidebar(true);
          s.setInspectorActiveTopTab('deck');
          s.setPendingSaveTemplate(true);
        }}
        startIcon={<BookmarkAddRoundedIcon sx={{ fontSize: 15 }} />}
        sx={{
          bgcolor: 'rgba(41,182,246,0.15)', color: 'light-dark(#0775a6, #29b6f6)',
          boxShadow: 'none', textTransform: 'none', py: 0.25, px: 1.25,
          whiteSpace: 'nowrap', minWidth: 'max-content', fontSize: 12, fontWeight: 700,
          '&:hover': { bgcolor: 'rgba(41,182,246,0.25)', boxShadow: 'none' },
        }}
      >
        テンプレートとして保存
      </Button>

      {/* ── クラウド同期 ── */}
      <Button
        variant="outlined"
        size="small"
        onClick={handleSyncToCloud}
        disabled={isSyncing}
        startIcon={isSyncing ? <CircularProgress size={14} /> : <CloudUploadRoundedIcon sx={{ fontSize: 15 }} />}
        sx={{
          borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)',
          color: 'rgb(var(--brand-fg-rgb) / 0.5)',
          textTransform: 'none',
          py: 0.25,
          px: 1.25,
          whiteSpace: 'nowrap',
          minWidth: 'max-content',
          fontSize: 12,
          '&:hover': { borderColor: '#29b6f6', color: 'light-dark(#0775a6, #29b6f6)', bgcolor: 'rgba(41,182,246,0.08)' },
        }}
      >
        {isSyncing ? '同期中...' : 'クラウドへ同期'}
      </Button>
    </Box>
  );

  const canvasW = presentation?.canvasSize?.width || 1587;
  const canvasH = presentation?.canvasSize?.height || 1122;

  const handleAddModel = (asset: any) => {
    if (!selectedPageId) return;
    const url = resolveAssetPreviewUrl(asset) || '';
    addElement(selectedPageId, {
      type: 'modelCard',
      x: canvasW * 0.1, y: canvasH * 0.1, w: 280, h: 280,
      zIndex: 10, rotation: 0, opacity: 100,
      data: { title: asset.name || asset.title || 'Model', subtitle: (asset as any).toolType || asset.type || '', thumbnailUrl: url }
    });
    setModelPickerOpen(false);
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'light-dark(#e4e6ea, rgb(25, 25, 30))' }}>
      {/* 3D Model Picker Dialog */}
      <Dialog open={isModelPickerOpen} onClose={() => setModelPickerOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 } }}>
        <DialogTitle sx={{ color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <ViewInArIcon sx={{ color: '#9C27B0' }} />
          3Dモデルを選択
        </DialogTitle>
        <DialogContent>
          <TextField
            placeholder="モデル名で検索..."
            size="small" fullWidth value={modelSearch}
            onChange={e => setModelSearch(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }, '& input::placeholder': { color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
          />
          {modelPickerAssets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <ViewInArIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">このプロジェクトに3Dモデルがまだありません。<br />WorkFilesからRhinoやBlenderファイルをインポートしてください。</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {modelPickerAssets.map(asset => {
                const url = resolveAssetPreviewUrl(asset) || '';
                return (
                  <Box
                    key={asset.id}
                    onClick={() => handleAddModel(asset)}
                    sx={{ width: 140, borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { borderColor: '#9C27B0', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(156,39,176,0.3)' } }}
                  >
                    <Box sx={{ height: 100, bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {url ? <Box component="img" src={url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ViewInArIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />}
                    </Box>
                    <Box sx={{ p: 1 }}>
                      <Typography sx={{ color: 'var(--brand-fg)', fontSize: 12, fontWeight: 600, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name || (asset as any).title || 'Untitled'}</Typography>
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 10 }}>{(asset as any).toolType || asset.type || 'model'}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModelPickerOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>閉じる</Button>
        </DialogActions>
      </Dialog>
      {/* DSP Topbar Header */}
      <Box sx={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'light-dark(rgba(255,255,255,0.92), rgba(10,15,25,0.85))' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            size="small" 
            startIcon={<ArrowBackRoundedIcon />} 
            onClick={onBack}
            sx={{ mr: 2, color: 'text.secondary', minWidth: 'auto', '&:hover': { color: 'text.primary' } }}
          >
            Exit
          </Button>
          <Typography variant="subtitle2" sx={{ color: 'light-dark(#0775a6, #29b6f6)', fontWeight: 600 }}>
            {selectedItem?.name || 'Untitled Presentation'}
          </Typography>
        </Box>

        {saveStatusIndicator}
      </Box>

      {/* DSP Ribbon Toolbar */}
      <DspToolbar />

      {/* DSP Main OS Split */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* MainContent: Canvas area + Speaker Notes（フローティングドックを内包） */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Canvas wrapper（フローティングドックを内包） */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
            <PresentsCanvas />
            {/* フローティングドック: 3DSL BottomDock 左セクション相当 */}
            <DspEditorDock />
          </Box>
          {/* スピーカーノートパネル（下部ドラッグ調整可能） */}
          <SpeakerNotesPanel />
        </Box>
        
        {/* Right Sidebar Portal Content */}
        <PresentsInspector />
      </Box>
    </Box>
  );
};
