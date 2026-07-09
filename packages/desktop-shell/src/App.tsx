import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import MainLayout from './layouts/MainLayout';
import { WorkspaceShell } from './shared/layout/workspace/WorkspaceShell';
import { WorkspaceProvider } from './shared/layout/workspace/WorkspaceContext';
import AuthGuard from './components/Auth/AuthGuard';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
// @ts-ignore
import PublicPresentationShare from './features/dsl/layout/viewer/PublicPresentationShare.jsx';
import SiteManagementPage from './pages/SiteManagementPage';
import { useAppStore } from './store/useAppStore';
import { useAuthStore } from './store/useAuthStore';
import { useNotificationsStore } from './store/useNotificationsStore';
import { markNotificationRead } from './features/teams/api/teamsApi';
import { useDsbStore } from './features/dsb/store/useDsbStore';
import { fetchUserProjects } from './features/projects/api/fetchProjects';
import { useDccStore } from './store/useDccStore';
import { useAIDriveStore } from './store/useAIDriveStore';
import { useWorkFileSyncStore } from './store/useWorkFileSyncStore';
import { CircularProgress, Typography, Box, Dialog, Modal, Stack } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import UploadModalContent from './features/dss/upload/modal/UploadModalContent';

import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import {
  isPermissionGranted as isNotifPermissionGranted,
  requestPermission as requestNotifPermission,
  sendNotification as sendOsNotification,
  onAction as onNotificationAction,
  registerActionTypes as registerNotifActionTypes,
} from '@tauri-apps/plugin-notification';

// Rhino からのジョブ受信時に表示する通知のアクションタイプID
const RHINO_NOTIF_ACTION_TYPE = 'rhino-local-save';

import { AiStudioShell } from './features/ai-studio/AiStudioShell';
import { handleToastAction } from './store/useAiTaskNotifier';
import { installBookmarkBridge } from './features/dsk/lib/bookmarkBridge';
import { installInboxDrain } from './features/dsk/lib/inboxDrain';
import { installDiscussBridge } from './features/dsb/lib/discussBridge';
import { DccSetupModal } from './shared/components/dcc/DccSetupModal';
import DesktopMarketplace from './pages/DesktopMarketplace';
import CreatorProfilePage from './pages/CreatorProfilePage';
import MySitePage from './pages/MySitePage';
import TeamSitePage from './pages/TeamSitePage';
import GalleryPage from './pages/GalleryPage';
import { GlobalLaunchOverlay } from './components/GlobalLaunchOverlay';
import { UnsavedOnExitDialog } from './components/UnsavedOnExitDialog';
import { SetupGate } from './components/SetupGate';
import { GlobalSettingsShell } from './features/global-settings/GlobalSettingsShell';
import { StandaloneWorkspace } from './pages/StandaloneWorkspace';
import { TeamHomePage } from './features/teams/TeamHomePage';
import { TeamsManagementPage } from './features/teams/TeamsManagementPage';
import { useTeamsStore } from './store/useTeamsStore';

const isStandalone = new URLSearchParams(window.location.search).has('standalone');

const TeamsView = () => {
  const activeTeamId = useTeamsStore(s => s.activeTeamId);
  if (activeTeamId) return <TeamHomePage />;
  return <TeamsManagementPage />;
};

// メインウィンドウの初期化ゲート。
// ログイン後にプロジェクト一覧を取得し（旧ダッシュボードが担っていた処理）、
// 取得が終わって isInitialized になるまではローディングを表示する。
// これにより、リロード直後に「プロジェクト未取得のアカウントサイト」が一瞬出るのを防ぐ。
const MainAppInitGate = ({ children }: { children: ReactNode }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const isInitialized = useAppStore(s => s.isInitialized);
  const setProjects = useAppStore(s => s.setProjects);

  useEffect(() => {
    if (currentUser && !isInitialized) {
      fetchUserProjects(currentUser.uid)
        .then(setProjects)
        .catch((e) => {
          console.error('[App] 初期プロジェクト取得に失敗:', e);
          // 失敗してもローディングで固まらないよう初期化済みにする
          setProjects([]);
        });
    }
  }, [currentUser, isInitialized, setProjects]);

  if (!isInitialized) {
    return (
      <Box display="flex" height="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
};

export const AppContent = () => {
  const currentMainView = useAppStore(s => s.currentMainView);
  return (
    <Routes>
      <Route path="/*" element={
        currentMainView === 'global-settings' ? <GlobalSettingsShell /> :
currentMainView === 'marketplace' ? <DesktopMarketplace /> :
        currentMainView === 'gallery' ? <GalleryPage /> :
        currentMainView === 'ai-studio' ? <AiStudioShell /> :
        currentMainView === 'creator-profile' ? <CreatorProfilePage /> :
        currentMainView === 'my-site' ? <MySitePage /> :
        currentMainView === 'team-site' ? <TeamSitePage /> :
        currentMainView === 'workspace' ? <WorkspaceShell /> :
        currentMainView === 'teams' ? <TeamsView /> :
        <SiteManagementPage />
      } />
    </Routes>
  );
};

export const GlobalModals = () => {
  const setupModalOpen = useDccStore(s => s.setupModalOpen);
  const setupModalToolId = useDccStore(s => s.setupModalToolId);
  const closeSetupModal = useDccStore(s => s.closeSetupModal);

  // ── Rhino ジョブハンドラー（全タブ共通）──────────────────
  const pendingRhinoJob = useDccStore(s => s.pendingRhinoJob);
  const clearPendingRhinoJob = useDccStore(s => s.clearPendingRhinoJob);

  // Rhino から届いた 3dm を File 化したもの。null → モーダル非表示
  const [rhinoUploadFiles, setRhinoUploadFiles] = useState<File[] | null>(null);
  // ユーザーが通知をクリック（or 直接アプリ操作）でモーダルを開いた状態
  const [rhinoUploadOpen, setRhinoUploadOpen] = useState(false);

  // ── アプリ終了時の未保存ガード ─────────────────────────────
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const allowCloseRef = useRef(false);

  useEffect(() => {
    if (isStandalone) return; // 子ウィンドウは対象外
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested(async (event) => {
          if (allowCloseRef.current) return; // 確定済み → そのまま閉じる
          const dsb = useDsbStore.getState();
          const blogEditing = dsb.mode === 'edit';
          const hasUnsaved = Object.keys(useAppStore.getState().workingFiles).length > 0;
          if (!blogEditing && !hasUnsaved) return; // 未保存なし → 通常終了
          event.preventDefault();
          // S.Blog: 作業中の記事をクラウド(正本)へ自動保存してから判断する。
          if (blogEditing) {
            try {
              const uid = useAuthStore.getState().currentUser?.uid;
              if (uid) await dsb.saveWorkingDraft(uid);
            } catch (e) { console.warn('[App] blog autosave on close failed', e); }
          }
          // 他に未保存ファイルがあれば確認ダイアログ、無ければそのまま閉じる。
          if (Object.keys(useAppStore.getState().workingFiles).length > 0) {
            setExitDialogOpen(true);
          } else {
            allowCloseRef.current = true;
            try { await getCurrentWindow().destroy(); } catch { try { await getCurrentWindow().close(); } catch {} }
          }
        });
      } catch (e) {
        console.warn('[App] onCloseRequested setup failed', e);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  // ── S.Library ブックマーク・ブリッジ（ブラウザ拡張からの一発登録）──────────
  // localhost 直結（アプリ起動中の即時受信）＋クラウド受信箱ドレイン（アプリ未起動時に
  // 拡張→Web で積まれた分を起動後に回収）の二系統。どちらも Desktop のみで動く。
  useEffect(() => {
    if (isStandalone) return; // 子ウィンドウは対象外（メインのみで購読）
    let unlistenBridge: (() => void) | undefined;
    installBookmarkBridge().then((fn) => { unlistenBridge = fn; });
    const unlistenDrain = installInboxDrain();
    // SEKKEIYA Reader（記事ウィンドウ）からの「AIと議論して書く」受信
    const unlistenDiscuss = installDiscussBridge();
    return () => {
      if (unlistenBridge) unlistenBridge();
      unlistenDrain();
      unlistenDiscuss();
    };
  }, []);

  const proceedClose = async () => {
    allowCloseRef.current = true;
    setExitDialogOpen(false);
    try {
      await getCurrentWindow().destroy();
    } catch {
      try { await getCurrentWindow().close(); } catch {}
    }
  };

  // ジョブが届いたら、3dm とサムネを読み込んで File[] を組み立てる
  useEffect(() => {
    if (!pendingRhinoJob) {
      setRhinoUploadFiles(null);
      setRhinoUploadOpen(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const job = pendingRhinoJob;
        // 1) 3dm バイナリを読み込む
        const bytes = await invoke<number[]>('read_local_binary_file', { path: job.filePath });
        if (cancelled) return;
        const ab = new Uint8Array(bytes).buffer;

        const baseName = (job.defaultTitle || 'rhino-export').replace(/[\\/:*?"<>|]/g, '_');
        const file = new File([ab], `${baseName}.3dm`, { type: 'application/octet-stream' });

        // 2) Rhino から取れた寸法を File に注入（autoExtracted=true で UI 表示用）
        if (job.width != null && job.depth != null && job.height != null) {
          (file as any).dimensionsMm = {
            width: job.width,
            depth: job.depth,
            height: job.height,
            unit: job.unitSystem || 'Millimeters',
            autoExtracted: true,
          };
        }

        // 3) サムネイル（あれば DataURL 化）
        if (job.thumbnailPath) {
          try {
            const thumbBytes = await invoke<number[]>('read_local_binary_file', { path: job.thumbnailPath });
            const thumbBlob = new Blob([new Uint8Array(thumbBytes)], { type: 'image/png' });
            (file as any).thumbnailUrl = URL.createObjectURL(thumbBlob);
          } catch (e) {
            console.warn('[App] サムネイル読み込み失敗（無視）:', e);
          }
        }

        // 4) Rhino 由来であることを示すマーカー（ローカル保存時に元の 3dm パスを使うため）
        (file as any).__rhinoSource3dmPath = job.filePath;
        (file as any).__rhinoThumbnailPath = job.thumbnailPath;
        (file as any).__rhinoCategoryGuess = job.categoryGuess;
        (file as any).__rhinoJobId = job.jobId;
        (file as any).__rhinoSource = job.source || 'rhino-selection';

        if (!cancelled) {
          setRhinoUploadFiles([file]);
        }
      } catch (e) {
        console.error('[App] Failed to prepare Rhino upload file:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [pendingRhinoJob]);

  // ── OS（Windows）レベルのトースト通知 ───────────────────────
  // 前回のジョブを覚えておき、null → 新ジョブ になった瞬間に1回だけ通知
  const prevRhinoJobRef = useRef<typeof pendingRhinoJob>(null);
  useEffect(() => {
    const wasNull = prevRhinoJobRef.current === null;
    prevRhinoJobRef.current = pendingRhinoJob;

    if (!wasNull || !pendingRhinoJob) return;

    const job = pendingRhinoJob;
    (async () => {
      try {
        // Windows: ボタン付きトーストを Rust 側 (tauri-winrt-notification) で送る
        await invoke('send_rhino_local_notification', {
          title: 'Rhinoから出力されました',
          body: job.defaultTitle
            ? `${job.defaultTitle} — SEKKEIYA で開いてアップロード`
            : 'SEKKEIYA で開いてアップロード',
        });
      } catch (e) {
        console.warn('[Notification] ボタン付き通知に失敗、フォールバック:', e);
        // フォールバック: Tauri 通知プラグイン（ボタンなし）
        try {
          let granted = await isNotifPermissionGranted();
          if (!granted) {
            const perm = await requestNotifPermission();
            granted = perm === 'granted';
          }
          if (granted) {
            await sendOsNotification({
              title: 'Rhinoから出力されました',
              body: job.defaultTitle
                ? `${job.defaultTitle} — SEKKEIYA で開いてアップロード`
                : 'SEKKEIYA で開いてアップロード',
              actionTypeId: RHINO_NOTIF_ACTION_TYPE,
            });
          }
        } catch (e2) {
          console.error('[Notification] フォールバック通知も失敗:', e2);
        }
      }
    })();
  }, [pendingRhinoJob]);

  // 起動時に1回だけアクションタイプ（通知ボタン）を登録
  useEffect(() => {
    (async () => {
      try {
        await registerNotifActionTypes([
          {
            id: RHINO_NOTIF_ACTION_TYPE,
            actions: [
              {
                id: 'open',
                title: 'SEKKEIYA Desktop で開く',
                foreground: true,
              },
              {
                id: 'dismiss',
                title: '閉じる',
                destructive: true,
              },
            ],
          },
        ]);
      } catch (e) {
        console.error('[Notification] registerActionTypes failed:', e);
      }
    })();
  }, []);

  // OS通知のクリック（本体タップ／アクションボタン）を受けてダイアログを開く
  useEffect(() => {
    let unlistenA: UnlistenFn | undefined;
    // onAction は Tauri の PluginListener（unregister() を持つ）を返す
    let unlistenB: { unregister: () => Promise<void> } | undefined;

    const bringToFront = async () => {
      try {
        const win = getCurrentWindow();
        await win.unminimize().catch(() => {});
        await win.show().catch(() => {});
        await win.setFocus().catch(() => {});
      } catch {}
    };

    let unlistenC: UnlistenFn | undefined;
    let unlistenD: UnlistenFn | undefined;

    (async () => {
      // 1) Windows: tauri-winrt-notification 経由のイベント（Rhino）
      try {
        unlistenA = await listen<string>('rhino-notification-action', async (e) => {
          const actionId = e.payload;
          if (actionId === 'dismiss') {
            useDccStore.getState().clearPendingRhinoJob();
            return;
          }
          // 'open' または 'body' → 前面化＋アップロードモーダルを開く
          await bringToFront();
          if (useDccStore.getState().pendingRhinoJob) {
            setRhinoUploadOpen(true);
          }
        });
      } catch (e) {
        console.error('[Notification] rhino-notification-action listener failed:', e);
      }

      // 2) AIタスク・選択肢トースト通知のアクション
      try {
        unlistenC = await listen<{ action: string; key: string }>('ai-toast-action', async (e) => {
          await bringToFront();
          await handleToastAction(e.payload.action, e.payload.key);
        });
      } catch (e) {
        console.error('[Notification] ai-toast-action listener failed:', e);
      }

      // 2b) 取材（AI記者）通知のアクション: アプリを前面化して取材を開く
      try {
        unlistenD = await listen<{ action: string; key: string }>('interview-notification-action', async (e) => {
          await bringToFront();
          const key = e.payload?.key;
          const store = useNotificationsStore.getState();
          const notif = store.notifications.find(n => n.id === key)
            || store.localNotifications.find(n => n.id === key);
          if (!notif) return;
          const uid = useAuthStore.getState().currentUser?.uid;
          if (uid && !notif.read) {
            try { await markNotificationRead(uid, notif.id); } catch { /* noop */ }
          }
          const openTarget = notif.url || (notif.articleId ? `https://sekkeiya.com/admin/articles/${notif.articleId}/edit` : '');
          if (openTarget) {
            try {
              const { openUrl } = await import('@tauri-apps/plugin-opener');
              await openUrl(openTarget);
            } catch {
              try { window.open(openTarget, '_blank'); } catch { /* noop */ }
            }
          }
        });
      } catch (e) {
        console.error('[Notification] interview-notification-action listener failed:', e);
      }

      // 3) フォールバック: Tauri 通知プラグインの onAction
      try {
        unlistenB = await onNotificationAction((action: any) => {
          if (action?.actionId === 'dismiss') {
            useDccStore.getState().clearPendingRhinoJob();
            return;
          }
          bringToFront();
          if (useDccStore.getState().pendingRhinoJob) {
            setRhinoUploadOpen(true);
          }
        });
      } catch (e) {
        console.error('[Notification] onAction setup failed:', e);
      }
    })();

    return () => {
      if (unlistenA) unlistenA();
      unlistenB?.unregister().catch(() => {});
      if (unlistenC) unlistenC();
      if (unlistenD) unlistenD();
    };
  }, []);

  const closeRhinoUpload = () => {
    setRhinoUploadOpen(false);
    setRhinoUploadFiles(null);
    clearPendingRhinoJob();
  };
  // ────────────────────────────────────────────────────────

  const pendingScreenshot = useAppStore(s => s.pendingScreenshot);
  const isScreenshotDialogOpen = useAppStore(s => s.isScreenshotDialogOpen);
  const setScreenshotDialogOpen = useAppStore(s => s.setScreenshotDialogOpen);
  const setPendingScreenshot = useAppStore(s => s.setPendingScreenshot);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const openAI3DCreate = useAppStore(s => s.openAI3DCreate);
  const openAIRender = useAppStore(s => s.openAIRender);
  const setAIDriveOpen = useAppStore(s => s.setAIDriveOpen);
  const setAIDriveExpanded = useAppStore(s => s.setAIDriveExpanded);
  const setAIRenderOpen = useAppStore(s => s.setAIRenderOpen);
  const setAI3DCreateOpen = useAppStore(s => s.setAI3DCreateOpen);

  const handleSelectTarget = (target: 'render' | 'create' | 'drive') => {
    if (!pendingScreenshot) return;

    if (target === 'render') {
      openAIRender({ baseImage: pendingScreenshot, projectId: activeProjectId, workspaceId: activeWorkspaceId });
    } else if (target === 'create') {
      openAI3DCreate({ baseImage: pendingScreenshot, projectId: activeProjectId, workspaceId: activeWorkspaceId });
    } else if (target === 'drive') {
      setAIDriveExpanded(true);
      setAIDriveOpen(true);
      setAIRenderOpen(false);
      setAI3DCreateOpen(false);
      setScreenshotDialogOpen(false);
      setTimeout(() => setPendingScreenshot(null), 300);
    }
  };

  const handleClose = () => {
    setScreenshotDialogOpen(false);
    setTimeout(() => setPendingScreenshot(null), 300); // 閉じきってからクリア
  };

  return (
    <>
      {/* ── Rhino アップロードモーダル（クラウド or ローカル保存はモーダル内で選択）── */}
      <Modal
        open={rhinoUploadOpen && !!rhinoUploadFiles}
        onClose={(_e, reason) => { if (reason !== 'backdropClick') closeRhinoUpload(); }}
      >
        <UploadModalContent
          open={rhinoUploadOpen && !!rhinoUploadFiles}
          onClose={closeRhinoUpload}
          initialFiles={rhinoUploadFiles ?? undefined}
          rhinoJob={pendingRhinoJob ?? undefined}
        />
      </Modal>

      {setupModalToolId && (
        <DccSetupModal
          toolId={setupModalToolId}
          open={setupModalOpen}
          onClose={closeSetupModal}
        />
      )}

      <UnsavedOnExitDialog
        open={exitDialogOpen}
        onCancel={() => setExitDialogOpen(false)}
        onProceedClose={proceedClose}
      />

      <Dialog
        open={isScreenshotDialogOpen} 
        onClose={handleClose}
        maxWidth="lg"
        sx={{ zIndex: (theme) => theme.zIndex.modal + 9999 }}
        PaperProps={{
            sx: {
                bgcolor: '#191A1D', // Eagle風のダークトーン
                color: '#fff',
                minWidth: '800px', // 600pxから拡大し、テキストを1行で収まりやすくする
                borderRadius: '16px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                 backgroundImage: 'none',
            }
        }}
        slotProps={{
            backdrop: {
                sx: {
                    bgcolor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                }
            }
        }}
      >
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '0.5px' }}>
              キャプチャ画像の用途を選択
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
              画像を送信先ツールのベース画像として登録します
            </Typography>
          </Box>

          {/* Image Preview */}
          {pendingScreenshot && (
            <Box 
              sx={{ 
                width: '100%', 
                height: '340px', 
                bgcolor: '#0E0E10', 
                borderRadius: '12px',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
              }}
            >
              <Box 
                component="img" 
                src={pendingScreenshot} 
                sx={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }} 
              />
            </Box>
          )}

          {/* Action Cards */}
          <Stack direction="row" spacing={3}>
            <Box
              component={motion.div}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectTarget('render')}
              sx={{
                flex: 1,
                bgcolor: '#202124',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                p: 4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: '140px',
                transition: 'border-color 0.2s',
                '&:hover': {
                  borderColor: '#00BFFF',
                  bgcolor: 'rgba(0, 191, 255, 0.05)'
                }
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#00BFFF' }}>AI Render</Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.6 }}>
                プロンプトベースの画像生成やコントロール用に使用します
              </Typography>
            </Box>

            <Box
              component={motion.div}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectTarget('create')}
              sx={{
                flex: 1,
                bgcolor: '#202124',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                p: 4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: '140px',
                transition: 'border-color 0.2s',
                '&:hover': {
                  borderColor: '#8A2BE2',
                  bgcolor: 'rgba(138, 43, 226, 0.05)'
                }
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#8A2BE2' }}>AI 3D Generate</Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.6 }}>
                TripoSRを用いて単一画像から3Dモデルを生成します
              </Typography>
            </Box>

            <Box
              component={motion.div}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectTarget('drive')}
              sx={{
                flex: 1,
                bgcolor: '#202124',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                p: 4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: '140px',
                transition: 'border-color 0.2s',
                '&:hover': {
                  borderColor: '#00BFFF',
                  bgcolor: 'rgba(0, 191, 255, 0.05)'
                }
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#00BFFF' }}>AI Driveに保存</Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.6 }}>
                生成元の資産としてプロジェクトのAI Driveに保管します
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Dialog>
    </>
  );
};

export const GlobalLoader = () => {
  const isGlobalLoading = useAppStore(s => s.isGlobalLoading);
  const globalLoadingMessage = useAppStore(s => s.globalLoadingMessage);

  return (
    <AnimatePresence>
      {isGlobalLoading && (
        <Box 
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          sx={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            bgcolor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "all"
          }}
        >
          <Box sx={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", mb: 4 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '2px dashed rgba(0,191,255,0.4)', borderTopColor: 'transparent' }}
            />
            <CircularProgress size={80} thickness={2} sx={{ color: "#00BFFF", zIndex: 1 }} />
          </Box>
          <Typography 
            component={motion.h5}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            variant="h5" 
            sx={{ color: "#fff", fontWeight: 800, letterSpacing: 2 }}
          >
            {globalLoadingMessage || '読み込み中...'}
          </Typography>
        </Box>
      )}
    </AnimatePresence>
  );
};

let isShortcutSetup = false;

function App() {
  useEffect(() => {
    getVersion().then((v) => {
      getCurrentWindow().setTitle(`SEKKEIYA ${v}`);
    });
  }, []);

  useEffect(() => {
    if (isShortcutSetup) return;
    isShortcutSetup = true;

    // Start background polling for DCC integrations (e.g. Rhino)
    useDccStore.getState().startPolling(10000); // 10 seconds

    let unlistenCapture: UnlistenFn | null = null;
    let unlistenCaptureReq: UnlistenFn | null = null;
    let unlistenLog: UnlistenFn | null = null;
    let isMounted = true;

    const setupShortcuts = async () => {
      try {
        const startCaptureWindow = async (target: string) => {
          console.log(`Starting capture window for target: ${target}`);
          try {
            const [x, y, width, height] = await invoke<[number, number, number, number]>('get_cursor_monitor');
            console.log(`Monitor bounds: x=${x}, y=${y}, w=${width}, h=${height}`);

            const win = new WebviewWindow(`capture-window-${Date.now()}`, {
              url: `/?capture=true&target=${target}`,
              x,
              y,
              width,
              height,
              fullscreen: true,
              transparent: true,
              alwaysOnTop: true,
              decorations: false,
              skipTaskbar: true,
              resizable: false,
              visible: false,
            });

            win.once('tauri://error', (e) => {
              console.error("Capture Window Creation Error:", e);
            });
          } catch (e) {
            console.error("Failed to create WebviewWindow:", e);
          }
        };

        let isRegistrationHandled = false;

        const registerSafe = async (shortcut: string, handler: (e: any) => void) => {
          if (isRegistrationHandled) return;
          isRegistrationHandled = true;
          try {
            await unregister(shortcut).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 100)); // Ensure OS hook is released
            await register(shortcut, handler);
            console.log(`Successfully registered ${shortcut}`);
          } catch (e: any) {
            if (e && e.toString().includes('already registered')) {
              console.log(`Shortcut ${shortcut} is already registered by another instance.`);
            } else {
              console.error(`Failed to register ${shortcut}:`, e);
            }
          }
        };

        await registerSafe('CommandOrControl+Alt+S', (e: any) => {
          console.log(`Shortcut S invoked, state: ${e.state}`);
          if (e.state === 'Pressed') {
            startCaptureWindow('ask');
          }
        });

        // 拡張メニュー「スクショを保存」→ localhost /capture → Rust emit。
        // Ctrl+Alt+S と同じく ask モードでキャプチャウィンドウを起動する。
        const captureReqUnlisten = await listen('library-capture-requested', () => {
          startCaptureWindow('ask');
        });
        if (!isMounted) captureReqUnlisten();
        else unlistenCaptureReq = captureReqUnlisten;

        const captureUnlisten = await listen<{ dataUrl: string, target: string }>('screenshot-captured', async (e) => {
          try {
            const win = getCurrentWindow();
            await win.unminimize();
            await win.maximize();
            await win.show();
            await win.setFocus();
          } catch (err) {
            console.error("Failed to restore main window:", err);
          }

          // Always add to AI Drive (My Library, not tied to a specific project)
          const { auth } = await import('./lib/firebase/client');
          const userId = auth.currentUser?.uid;
          
          if (userId) {
            useAIDriveStore.getState().uploadScreenshotToDrive(e.payload.dataUrl, userId, null);
          }

          if (e.payload.target === 'ask') {
            useAppStore.getState().setPendingScreenshot(e.payload.dataUrl);
            useAppStore.getState().setScreenshotDialogOpen(true);
          } else if (e.payload.target === 'render') {
            useAppStore.getState().openAIRender({ 
              baseImage: e.payload.dataUrl, 
              projectId: useAppStore.getState().activeProjectId, 
              workspaceId: useAppStore.getState().activeWorkspaceId 
            });
          } else if (e.payload.target === 'create') {
            useAppStore.getState().openAI3DCreate({ 
              baseImage: e.payload.dataUrl, 
              projectId: useAppStore.getState().activeProjectId, 
              workspaceId: useAppStore.getState().activeWorkspaceId 
            });
          }
        });
        
        if (!isMounted) captureUnlisten();
        else unlistenCapture = captureUnlisten;

        const logUnlisten = await listen<string>('overlay-log', (e) => {
          console.log(`[OVERLAY LOG] ${e.payload}`);
        });

        if (!isMounted) logUnlisten();
        else unlistenLog = logUnlisten;

      } catch (err) {
        console.error("Failed to setup global shortcuts:", err);
      }
    };

    const setupAiDrive = async () => {
      try {
        await invoke('setup_ai_drive');
        console.log("AI Drive mounted successfully");
      } catch (err) {
        console.error("Failed to setup AI drive:", err);
      }
    };

    useWorkFileSyncStore.getState().initGlobalWatchers();
    setupShortcuts();
    setupAiDrive();

    // Broadcast project changes to standalone child windows
    const unsubProject = useAppStore.subscribe((state, prevState) => {
      if (state.activeProjectId !== prevState.activeProjectId) {
        emit('sekkeiya://project-changed', { projectId: state.activeProjectId }).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      // Intentionally avoiding unregistering global shortcut here because StrictMode unmount 
      // followed immediately by remount causes race conditions with Tauri's OS hooks.
      // The shortcut lives as long as the application window. 
      // HMR reloads will force unregister via the setup hook above.
      isShortcutSetup = false;
      useDccStore.getState().stopPolling();
      if (unlistenCapture) unlistenCapture();
      if (unlistenCaptureReq) unlistenCaptureReq();
      if (unlistenLog) unlistenLog();
      unsubProject();
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* 公開ルート：本番プレビュー共有（未ログインで閲覧可・認証ゲートの外） */}
          <Route path="/layout/share/:shareId" element={<PublicPresentationShare />} />

          {/* 通常アプリ（認証ゲート内） */}
          <Route path="/*" element={
            <AuthGuard>
              <SetupGate>
            {isStandalone ? (
              <StandaloneWorkspace />
            ) : (
              <MainAppInitGate>
                <WorkspaceProvider>
                  <MainLayout>
                    <AppContent />
                    <GlobalModals />
                    <GlobalLoader />
                    <GlobalLaunchOverlay />
                  </MainLayout>
                </WorkspaceProvider>
              </MainAppInitGate>
            )}
              </SetupGate>
            </AuthGuard>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
