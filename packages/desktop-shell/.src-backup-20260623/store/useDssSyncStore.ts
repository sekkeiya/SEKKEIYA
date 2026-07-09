import { create } from 'zustand';
import { exists, stat, watch } from '@tauri-apps/plugin-fs';
import { dirname } from '@tauri-apps/api/path';

export interface DssSyncStatus {
  isDirty: boolean;
  localModifiedAt: number | null;
  filePath?: string;
}

interface FileWatcherState {
  unlisten?: () => void;
  debounceTimer?: any;
}

interface DssSyncState {
  statuses: Record<string, DssSyncStatus>;
  watchers: Record<string, FileWatcherState>;
  
  registerActiveModel: (
    modelId: string,
    localPath: string
  ) => void;
  
  unregisterActiveModel: (modelId: string) => void;
  
  clearDirtyStatus: (modelId: string) => void;
}

export const useDssSyncStore = create<DssSyncState>((set, get) => ({
  statuses: {},
  watchers: {},

  registerActiveModel: async (modelId, localPath) => {
    // If we're already watching this file, skip.
    if (get().watchers[modelId]) return;

    try {
      if (!(await exists(localPath))) return;

      const fileInfo = await stat(localPath);
      const initialMtime = fileInfo.mtime ? new Date(fileInfo.mtime).getTime() : null;

      // Initialize status: not dirty initially.
      set((state) => ({
        statuses: {
          ...state.statuses,
          [modelId]: {
            isDirty: false,
            localModifiedAt: initialMtime,
            filePath: localPath
          }
        }
      }));

      // Set up watch on the directory
      const dirPath = await dirname(localPath);
      const unlisten = await watch(
        dirPath,
        (event) => {
          // Check if event targets our specific file or its .3dm fallback (for Rhino glb edits)
          let isOurFile = false;
          let matchedPath = localPath;

          if (event.paths) {
            const basePath = localPath.replace(/\.[^/\\]+$/, "");
            const altPath = `${basePath}.3dm`;

            for (const p of event.paths) {
              if (p === localPath || p.includes(localPath)) {
                isOurFile = true;
                matchedPath = localPath;
                break;
              }
              if (p === altPath || p.includes(altPath)) {
                isOurFile = true;
                matchedPath = altPath;
                break;
              }
            }
          }

          if (isOurFile) {
            const watcherState = get().watchers[modelId];
            if (watcherState?.debounceTimer) {
              clearTimeout(watcherState.debounceTimer);
            }

            const timer = setTimeout(async () => {
              try {
                if (!(await exists(matchedPath))) return;
                const latestStat = await stat(matchedPath);
                const mtime = latestStat.mtime ? new Date(latestStat.mtime).getTime() : null;
                
                set((state) => {
                  const currentStatus = state.statuses[modelId];
                  if (!currentStatus) return state;

                  const isPathChanged = currentStatus.filePath !== matchedPath;
                  const isTimeUpdated = mtime && currentStatus.localModifiedAt && mtime > currentStatus.localModifiedAt;

                  // Only mark dirty if the mtime has actually advanced, or if the file extension changed (e.g., glb -> 3dm)
                  if (isTimeUpdated || isPathChanged) {
                    return {
                      statuses: {
                        ...state.statuses,
                        [modelId]: {
                          ...currentStatus,
                          isDirty: true,
                          localModifiedAt: mtime || currentStatus.localModifiedAt,
                          filePath: matchedPath
                        }
                      }
                    };
                  }
                  return state;
                });
              } catch (e) {
                console.warn(`[useDssSyncStore] Stat failed on matchedPath: ${matchedPath}`, e);
              }
            }, 1000);

            // Update debounce timer
            set((state) => ({
              watchers: {
                ...state.watchers,
                [modelId]: {
                  ...state.watchers[modelId],
                  debounceTimer: timer
                }
              }
            }));
          }
        },
        { recursive: false }
      );

      set((state) => ({
        watchers: {
          ...state.watchers,
          [modelId]: { unlisten }
        }
      }));

    } catch (err) {
      console.warn(`[useDssSyncStore] Failed to register watch for ${modelId}:`, err);
    }
  },

  unregisterActiveModel: (modelId) => {
    const watcher = get().watchers[modelId];
    if (watcher?.unlisten) {
      watcher.unlisten();
    }
    if (watcher?.debounceTimer) {
      clearTimeout(watcher.debounceTimer);
    }
    set((state) => {
      const newWatchers = { ...state.watchers };
      delete newWatchers[modelId];
      return { watchers: newWatchers };
    });
  },

  clearDirtyStatus: async (modelId) => {
    // Call this after a successful "WEBにUP" to reset the baseline.
    set((state) => {
      const currentStatus = state.statuses[modelId];
      if (currentStatus) {
        return {
          statuses: {
            ...state.statuses,
            [modelId]: {
              ...currentStatus,
              isDirty: false,
              localModifiedAt: Date.now() // Set to now to effectively ignore all previous edits
            }
          }
        };
      }
      return state;
    });
  }
}));
