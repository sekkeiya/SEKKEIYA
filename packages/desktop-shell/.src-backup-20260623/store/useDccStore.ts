import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type DccToolId = 'rhino' | 'blender' | 'revit';
export type DccConnectionStatus = 'unknown' | 'checking' | 'not_installed' | 'not_running' | 'connected' | 'error';

export interface DccIntegrationStatus {
  status: DccConnectionStatus;
  message?: string;
}

/** Rhinoプラグインが書き出したアップロード/エクスポートジョブ */
export interface RhinoUploadSelectionJob {
  jobId: string | null;
  filePath: string;
  glbSource3dmPath: string | null;
  mesh3dmPath: string | null;
  glbPath: string | null;
  requestGlb: boolean | null;
  modelId: string | null;
  source: string | null;
  createdAt: string | null;
  defaultTitle: string | null;
  thumbnailPath: string | null;
  categoryGuess: string | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  unitSystem: string | null;
}

interface DccState {
  rhinoStatus: DccConnectionStatus;
  rhinoMessage: string | null;
  isChecking: boolean;

  /** Rhinoから届いたジョブ（処理済みはnull） */
  pendingRhinoJob: RhinoUploadSelectionJob | null;

  // Modal state
  setupModalOpen: boolean;
  setupModalToolId: DccToolId | null;

  checkRhinoConnection: () => Promise<void>;
  checkForRhinoJobs: () => Promise<void>;
  clearPendingRhinoJob: () => void;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;

  openSetupModal: (toolId: DccToolId) => void;
  closeSetupModal: () => void;
}

let pollingInterval: number | null = null;
let jobPollingInterval: number | null = null;
let visibilityHandler: (() => void) | null = null;

export const useDccStore = create<DccState>((set, get) => ({
  rhinoStatus: 'unknown',
  rhinoMessage: null,
  isChecking: false,
  pendingRhinoJob: null,
  setupModalOpen: false,
  setupModalToolId: null,

  openSetupModal: (toolId) => set({ setupModalOpen: true, setupModalToolId: toolId }),
  closeSetupModal: () => set({ setupModalOpen: false, setupModalToolId: null }),

  clearPendingRhinoJob: () => set({ pendingRhinoJob: null }),

  checkRhinoConnection: async () => {
    try {
      set({ isChecking: true });
      const result = await invoke<DccIntegrationStatus>('ping_rhino');
      set({
        rhinoStatus: result.status,
        rhinoMessage: result.message || null,
        isChecking: false,
      });
    } catch (err: any) {
      console.error('Failed to check Rhino connection:', err);
      const message = typeof err === 'string' ? err : err?.message || String(err);
      set({ rhinoStatus: 'error', rhinoMessage: message, isChecking: false });
    }
  },

  /** Rhinoからのジョブファイルをポーリングして取得する（接続中のみ有効） */
  checkForRhinoJobs: async () => {
    const { rhinoStatus, pendingRhinoJob } = get();
    // 接続中かつ未処理ジョブがない場合のみ確認
    if (rhinoStatus !== 'connected' || pendingRhinoJob !== null) return;

    try {
      const job = await invoke<RhinoUploadSelectionJob | null>('get_rhino_upload_selection_job');
      if (job) {
        console.log('[DccStore] Rhino job received:', job.jobId);
        set({ pendingRhinoJob: job });
      }
    } catch (err) {
      // ジョブがない場合は正常（エラーにしない）
      console.debug('[DccStore] No Rhino job or error:', err);
    }
  },

  startPolling: (intervalMs = 10000) => {
    if (pollingInterval) return;

    // 接続確認：即時 + 10秒ごと
    get().checkRhinoConnection();
    // @ts-ignore
    pollingInterval = window.setInterval(() => {
      if (!document.hidden && !get().isChecking) {
        get().checkRhinoConnection();
      }
    }, intervalMs);

    // ジョブポーリング：3秒ごと（Rhinoが connected のときだけ実際に問い合わせる）
    // @ts-ignore
    jobPollingInterval = window.setInterval(() => {
      if (!document.hidden) {
        get().checkForRhinoJobs();
      }
    }, 3000);

    if (!visibilityHandler) {
      visibilityHandler = () => {
        if (!document.hidden && pollingInterval && !get().isChecking) {
          get().checkRhinoConnection();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (jobPollingInterval) {
      clearInterval(jobPollingInterval);
      jobPollingInterval = null;
    }
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  },
}));
