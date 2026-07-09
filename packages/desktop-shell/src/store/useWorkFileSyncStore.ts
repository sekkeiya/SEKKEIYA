import { create } from 'zustand';
import { exists, stat, watch, readFile } from '@tauri-apps/plugin-fs';
import { dirname } from '@tauri-apps/api/path';
import { useWorkFileStore } from './useWorkFileStore';
import { WorkFileRepository } from '../features/projects/workFileRepository';
import { getLocalVersions } from '../features/projects/utils/workFileFsHelpers';
// @ts-ignore
import { convert3dmToGlb } from '../features/dss/upload/utils/convert3dmToGlb';
// @ts-ignore
import { generateThumbnailFromGlb } from '../features/dss/upload/utils/generateThumbnailFromGlb';

export type SyncStatusBadge = 'synced' | 'local_dirty' | 'local_only' | 'error' | 'checking';

export interface WorkFileSyncStatus {
  localExists: boolean;
  localModifiedAt: number | null;
  isDirty: boolean;
  statusBadge: SyncStatusBadge;
}

interface ActiveFileInfo {
  projectId: string;
  localPath: string;
  latestVersionCreatedAt: number | null;
  latestVersionId: string | null;
}

interface FileWatcherState {
  unlisten?: () => void;
  debounceTimer?: any;
}

interface WorkFileSyncState {
  statuses: Record<string, WorkFileSyncStatus>;
  activeFiles: Record<string, ActiveFileInfo>;
  watchers: Record<string, FileWatcherState>;
  
  checkStatus: (
    workFileId: string,
    localPath: string,
    latestVersionCreatedAt: number | null,
    latestVersionId: string | null
  ) => Promise<void>;
  
  checkAllActiveStatuses: () => Promise<void>;
  
  registerActiveFile: (
    workFileId: string,
    payload: ActiveFileInfo
  ) => void;
  
  unregisterActiveFile: (workFileId: string) => void;
  
  initGlobalWatchers: () => void;
}

/** Migrate legacy "SEKKEIYA (AI Drive)" paths to "SEKKEIYA". */
function normalizePath(p: string): string {
  return p.replace(/SEKKEIYA \(AI Drive\)/gi, 'SEKKEIYA');
}

export const useWorkFileSyncStore = create<WorkFileSyncState>((set, get) => ({
  statuses: {},
  activeFiles: {},
  watchers: {},

  initGlobalWatchers: () => {
    const bindings = useWorkFileStore.getState().bindings;
    for (const workFileId of Object.keys(bindings)) {
      const binding = bindings[workFileId];
      // Skip if already watching
      if (get().watchers[workFileId]) continue;
      
      let projectId = binding.projectId;

      if (!projectId) {
        // Try to extract projectId from legacy localPath format
        // Path format: .../SEKKEIYA/<projectId>/WorkFiles/<workFileId>
        const match = binding.localPath.match(/[\/\\]SEKKEIYA[\/\\]([^\/\\]+)[\/\\]WorkFiles[\/\\]/i);
        // Note: For AI Drive format (Projects/<ProjectName>), this regex will capture 'Projects'.
        // We skip trying to guess the project ID for AI Drive format here, as WorkFilesList will heal it.
        projectId = match && match[1] !== 'Projects' ? match[1] : '';
      }
      
      if (!projectId) continue;

      get().registerActiveFile(workFileId, {
        projectId,
        localPath: normalizePath(binding.localPath),
        latestVersionCreatedAt: null,
        latestVersionId: null
      });
    }
  },

  checkStatus: async (workFileId, localPath, latestVersionCreatedAt, latestVersionId) => {
    localPath = normalizePath(localPath);
    try {
      const fileExists = await exists(localPath);
      let localModifiedAt: number | null = null;
      let isDirty = false;
      let statusBadge: SyncStatusBadge = 'error';

      if (fileExists) {
        const fileInfo = await stat(localPath);
        let mtime = fileInfo.mtime ? new Date(fileInfo.mtime).getTime() : null;
        
        if (fileInfo.isDirectory) {
          const vers = await getLocalVersions(localPath);
          if (vers.length > 0) {
            const latestStat = await stat(vers[0].path);
            mtime = latestStat.mtime ? new Date(latestStat.mtime).getTime() : null;
          }
        }
        
        localModifiedAt = mtime;

        if (latestVersionId) {
          // If we have a cloud version, is it dirty?
          // Adding a 5-second buffer (5000ms) to avoid false positives due to network/local save discrepancies
          if (localModifiedAt && latestVersionCreatedAt && (localModifiedAt > latestVersionCreatedAt + 5000)) {
            isDirty = true;
            statusBadge = 'local_dirty';
          } else {
            isDirty = false;
            statusBadge = 'synced';
          }
        } else {
          // No cloud version yet
          isDirty = false;
          statusBadge = 'local_only';
        }
      } else {
        // File doesn't exist locally
        if (latestVersionId) {
          // Available in cloud, missing locally
          statusBadge = 'error'; 
        } else {
          // Not in cloud, not locally -> completely missing
          statusBadge = 'error';
        }
      }

      set((state) => ({
        statuses: {
          ...state.statuses,
          [workFileId]: {
            localExists: fileExists,
            localModifiedAt,
            isDirty,
            statusBadge,
          }
        }
      }));
    } catch (error) {
      console.error(`Status check failed for ${workFileId}:`, error);
      set((state) => ({
        statuses: {
          ...state.statuses,
          [workFileId]: {
            localExists: false,
            localModifiedAt: null,
            isDirty: false,
            statusBadge: 'error'
          }
        }
      }));
    }
  },

  checkAllActiveStatuses: async () => {
    const { activeFiles, checkStatus } = get();
    const promises = Object.entries(activeFiles).map(([workFileId, info]) =>
      checkStatus(workFileId, info.localPath, info.latestVersionCreatedAt, info.latestVersionId)
    );
    await Promise.all(promises);
  },

  registerActiveFile: async (workFileId, payload) => {
    payload = { ...payload, localPath: normalizePath(payload.localPath) };

    // 同一パスで既に監視中なら、watcher を作り直さずメタ情報の更新とステータス再取得のみ行う。
    // （プロジェクト切替や再レンダーのたびに Tauri の watch を張り直すのが重く、固まる原因になる）
    const existing = get().activeFiles[workFileId];
    const existingWatcher = get().watchers[workFileId];
    if (existing && existing.localPath === payload.localPath && existingWatcher?.unlisten) {
      set((state) => ({ activeFiles: { ...state.activeFiles, [workFileId]: payload } }));
      get().checkStatus(workFileId, payload.localPath, payload.latestVersionCreatedAt, payload.latestVersionId);
      return;
    }

    // Clean up existing watcher if registering a new one
    if (existingWatcher?.unlisten) {
      existingWatcher.unlisten();
    }

    set((state) => ({
      activeFiles: {
        ...state.activeFiles,
        [workFileId]: payload
      }
    }));
    // Immediately check status upon registering
    get().checkStatus(workFileId, payload.localPath, payload.latestVersionCreatedAt, payload.latestVersionId);

    try {
      if (!(await exists(payload.localPath))) {
        // Path doesn't exist, likely a stale binding or deleted folder. Skip watcher.
        return;
      }
      
      const isDir = (await stat(payload.localPath)).isDirectory;
      const dirToWatch = isDir ? payload.localPath : await dirname(payload.localPath);
      
      const unlisten = await watch(
        dirToWatch,
        async (event) => {
          // Trigger standard status check
          get().checkStatus(workFileId, payload.localPath, payload.latestVersionCreatedAt, payload.latestVersionId);

          // Handle preview generation if a 3DM file is modified
          if ((typeof event.type === 'object' && 'modify' in event.type) || event.type === 'any') {
            const pathList = (event as any).paths || [];
            
            let modified3dm: string | undefined;
            if (isDir) {
              modified3dm = pathList.find((p: string) => p.toLowerCase().endsWith('.3dm'));
            } else {
              modified3dm = pathList.find((p: string) => p.toLowerCase() === payload.localPath.toLowerCase());
            }
            
            if (modified3dm) {
              const watcherState = get().watchers[workFileId];
              if (watcherState?.debounceTimer) {
                clearTimeout(watcherState.debounceTimer);
              }

              const newTimer = setTimeout(async () => {
                try {
                  console.log(`[Sync] File modified, generating preview for: ${modified3dm}`);
                  const fileData = await readFile(modified3dm);
                  const blob = new Blob([fileData], { type: 'application/octet-stream' });
                  const fileStr = modified3dm.split(/[\/\\]/).pop() || 'model.3dm';
                  const file = new File([blob], fileStr);

                  const glbFile = await convert3dmToGlb(file);
                  const { file: thumbFile } = await generateThumbnailFromGlb(glbFile as File, { width: 600, height: 400 });

                  console.log(`[Sync] Updating preview assets for WorkFile ${workFileId}`);
                  await WorkFileRepository.updateWorkFilePreviewAssets({
                    projectId: payload.projectId,
                    workFileId,
                    glbFile: glbFile as File,
                    thumbnailFile: thumbFile as File
                  });
                } catch (err) {
                  console.error(`[Sync] Failed to generate/update previews for ${workFileId}:`, err);
                }
              }, 2000); // Wait 2s for file write to complete

              set((state) => ({
                watchers: {
                  ...state.watchers,
                  [workFileId]: { ...state.watchers[workFileId], debounceTimer: newTimer }
                }
              }));
            }
          }
        },
        { recursive: true, delayMs: 200 }
      );

      set((state) => ({
        watchers: {
          ...state.watchers,
          [workFileId]: { ...state.watchers[workFileId], unlisten }
        }
      }));
    } catch (err) {
      console.error(`[Sync] Failed to setup watch for ${workFileId}:`, err);
    }
  },

  unregisterActiveFile: (workFileId) => {
    set((state) => {
      const existingWatcher = state.watchers[workFileId];
      if (existingWatcher?.unlisten) {
        existingWatcher.unlisten();
      }
      if (existingWatcher?.debounceTimer) {
        clearTimeout(existingWatcher.debounceTimer);
      }

      const newActive = { ...state.activeFiles };
      delete newActive[workFileId];
      
      const newStatuses = { ...state.statuses };
      delete newStatuses[workFileId];

      const newWatchers = { ...state.watchers };
      delete newWatchers[workFileId];

      return { activeFiles: newActive, statuses: newStatuses, watchers: newWatchers };
    });
  }
}));

// Setup window focus listener to automatically trigger checks.
// Only registers once when the store is imported.
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    useWorkFileSyncStore.getState().checkAllActiveStatuses();
  });
}
