import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, CircularProgress, useMediaQuery } from '@mui/material';
import { collection, collectionGroup, limit, onSnapshot, query, where, getDocs, or, and } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { DssDashboard } from '../../../features/dss/DssDashboard';
const DssEditorLazy = React.lazy(() => import('../../../features/dss/DssEditor').then(m => ({ default: m.DssEditor })));
import { DslDashboard } from '../../../features/dsl/DslDashboard';

import { DscDashboard } from '../../../features/dsc/DscDashboard';
import { DspDashboard } from '../../../features/dsp/DspDashboard';
import { DspTemplatesView } from '../../../features/dsp/DspTemplatesView';

interface AdapterContext {
  projectId: string;
  workspaceId: string;
  workspaceName?: string;
  appScope: string;
}

interface AdapterProps {
  payload?: AdapterContext;
}

// -------------------------------------------------------------
// App Service Layer (Hooks)
// -------------------------------------------------------------
const useWorkspaceService = (payload: AdapterContext | undefined, targetType?: string) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], assets: [] });

  useEffect(() => {
    if (!payload?.workspaceId || !payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    let targetPath = `projects/${payload.projectId}/workspaces/${payload.workspaceId}/items`;
    if (payload.appScope === '3dss') {
      targetPath = `projects/${payload.projectId}/assets`;
    }
    
    console.log(`[useWorkspaceService] 🔍 Querying path: ${targetPath} (appScope: ${payload.appScope})`);
    
    let q = query(collection(db, targetPath), limit(50));
    if (targetType) {
      q = query(collection(db, targetPath), where('type', '==', targetType), limit(50));
    }

    const unsubscribeItems = onSnapshot(q, async (snapshot) => {
      const fetchedItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);
      console.log(`[useWorkspaceService] 📦 Fetched ${fetchedItems.length} items from ${targetPath}. Example:`, fetchedItems[0]);

      const normalizeProjectAsset = (item: any): any => {
        const dims = item.dimensions || item.metadata?.dimensions || null;
        return {
          ...item,
          macroCategory: item.macroCategory || item.category || '',
          mainCategory: item.mainCategory || item.subCategory || '',
          dimensions: dims,
        };
      };

      const resolveReferences = async (items: any[]) => {
        return Promise.all(items.map(async (item: any) => {
          const targetRefId = item.assetRef || item.entityId || item.metadata?.sourceModelId || item.sourceModelId;
          if (targetRefId) {
            try {
              const assetSnap = await getDoc(doc(db, 'assets', targetRefId));
              if (assetSnap.exists()) {
                const globalData = assetSnap.data();
                // Merge global data on top, but keep the local item's unique id and status
                const merged = { ...item, ...globalData, id: item.id, status: item.status, resolvedRef: true };
                return normalizeProjectAsset(merged);
              }
            } catch (e: any) {
              if (e.code !== 'permission-denied') {
                console.error("Failed to fetch asset", e);
              }
            }
          }
          return normalizeProjectAsset(item);
        }));
      };

      if (payload.appScope === '3dss') {
        const resolvedItems = await resolveReferences(fetchedItems);
        setData((prev: any) => ({
          ...prev,
          status: 'ready',
          items: resolvedItems,
          itemCount: resolvedItems.length,
          assetCount: 0
        }));
      } else {
        setData((prev: any) => ({ 
          ...prev, 
          status: 'ready', 
          items: fetchedItems, 
          itemCount: fetchedItems.length,
          assetCount: prev.assets ? prev.assets.length : 0
        }));
      }

      setIsInitializing(false);
    }, (err) => {
      console.error(`Failed to listen to items for ${payload.appScope}`, err);
      setData((prev: any) => ({ ...prev, status: 'error', error: String(err) }));
      setIsInitializing(false);
    });

    return () => {
      unsubscribeItems();
    };
  }, [payload?.workspaceId, payload?.projectId, payload?.appScope, targetType]);

  return { isInitializing, data };
};

// Removed duplicate getDocs and collectionGroup imports
import { useAuthStore } from '../../../store/useAuthStore';
import { getDoc, doc } from 'firebase/firestore';

const useGlobalModelsService = (scope: 'global_models' | 'global_following_models' | 'my_public_models' | 'my_private_models' | 'view_public_project_models' | string) => {
  const user = useAuthStore(s => s.currentUser);
  const viewingPublicProjectId = useAppStore(s => s.viewingPublicProjectId);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], assets: [] });

  useEffect(() => {
    if (!['global_models', 'global_following_models', 'my_public_models', 'my_private_models', 'view_public_project_models'].includes(scope)) {
      setIsInitializing(false);
      return;
    }

    let unsubscribe: any;
    let isActive = true;
    const assetsCol = collection(db, 'assets');

    const setupSubscription = async () => {
      let q;
      
      if (scope === 'global_models') {
         q = query(assetsCol, 
           and(
             where('type', '==', '3d-model'), 
             or(where('visibility', '==', 'public'), where('isPublic', '==', true))
           ),
           limit(60)
         );
      } else if (scope === 'global_following_models') {
         if (!user?.uid) {
           setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
           setIsInitializing(false);
           return;
         }
          // Fetch following list with 15s timeout
          try {
            const followingRef = collection(db, `users/${user.uid}/following`);
            const fetchPromise = getDocs(followingRef);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
            const followingSnap = await Promise.race([fetchPromise, timeoutPromise]) as any;
            
            const followingIds = followingSnap.docs.map((d: any) => d.id);
            
            if (!isActive) return;
            
            if (followingIds.length === 0) {
              console.log(`[useGlobalModelsService] User ${user.uid} follows 0 users. Empty feed.`);
              setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
              setIsInitializing(false);
              return;
            }
            
           // Firestore 'in' clause limitation is 30. We take the first 30 for MVP.
           const subset = followingIds.slice(0, 30);
           q = query(assetsCol, 
             and(
               where('type', '==', '3d-model'), 
               or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
               where('ownerId', 'in', subset)
             ),
             limit(60)
           );
          } catch (err: any) {
            console.warn(`[useGlobalModelsService] Error or Timeout fetching following list. Falling back to Explore.`, err);
            
            // Timeout or error fallback logic - transition via AppStore?
            // Actually, just change the query to global_models here directly for safety, or return empty array.
            // The user requested: タイムアウト時は空配列を返すようにしてから Explore タブにフォールバックしてください。
            // We can return empty array and trigger a CustomEvent or similar, or just return empty for now.
            // A simple approach is importing useAppStore and forcing the scope change:
            import('../../../store/useAppStore').then(m => {
               m.useAppStore.getState().setGlobalModelsScope('global_models');
            });
            setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
            setIsInitializing(false);
            return;
          }
      } else if (scope === 'my_public_models') {
         if (!user?.uid) return;
         q = query(assetsCol, 
           and(
             where('type', '==', '3d-model'), 
             or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
             where('ownerId', '==', user.uid)
           ),
           limit(60)
         );
      } else if (scope === 'my_private_models') {
         if (!user?.uid) return;
         q = query(assetsCol, where('type', '==', '3d-model'), where('visibility', '==', 'private'), where('ownerId', '==', user.uid), limit(60));
      } else if (scope === 'view_public_project_models') {
         if (!viewingPublicProjectId) {
           setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
           setIsInitializing(false);
           return;
         }
         // Use same path as MY PROJECTS: projects/{id}/assets
         q = query(collection(db, `projects/${viewingPublicProjectId}/assets`), limit(60));
      } else {
         q = query(assetsCol, where('type', '==', '3d-model'), limit(60));
      }

      if (!q) return;

      unsubscribe = onSnapshot(q, async (snapshot: any) => {
         const fetchedItems = snapshot.docs
          .map((doc: any) => {
            const data = doc.data();
            return { id: doc.id, title: data.name || data.title, ...data };
          })
          .filter((item: any) => scope !== 'view_public_project_models' || (item.status !== 'archived' && item.isArchived !== true));

        const normalizeProjectAsset = (item: any): any => {
          const dims = item.dimensions || item.metadata?.dimensions || null;
          return { ...item, macroCategory: item.macroCategory || item.category || '', mainCategory: item.mainCategory || item.subCategory || '', dimensions: dims };
        };

        const resolveReferences = async (items: any[]) => {
          return Promise.all(items.map(async (item: any) => {
            const targetRefId = item.assetRef || item.entityId || item.metadata?.sourceModelId || item.sourceModelId;
            if (targetRefId) {
              try {
                const assetSnap = await getDoc(doc(db, 'assets', targetRefId));
                if (assetSnap.exists()) {
                  const globalData = assetSnap.data();

                  // Version Pinning Logic
                  const itemPinnedVersion = item.pinnedVersion || 1;
                  const masterLatestVersion = globalData.latestVersion || 1;
                  const isOutdated = masterLatestVersion > itemPinnedVersion;

                  let pinnedDownloadUrl = globalData.downloadUrl;
                  let pinnedGlbUrl = globalData.glbUrl;

                  if (globalData.versions && globalData.versions[String(itemPinnedVersion)]) {
                     const vData = globalData.versions[String(itemPinnedVersion)];
                     pinnedDownloadUrl = vData.downloadUrl || pinnedDownloadUrl;
                     pinnedGlbUrl = vData.glbUrl || pinnedGlbUrl;
                  }

                  return normalizeProjectAsset({
                    ...item,
                    ...globalData,
                    id: item.id,
                    status: item.status,
                    downloadUrl: pinnedDownloadUrl,
                    glbUrl: pinnedGlbUrl,
                    pinnedVersion: itemPinnedVersion,
                    isOutdated,
                    resolvedRef: true
                  });
                }
              } catch (e: any) {
                if (e.code !== 'permission-denied') {
                  console.error("Failed to fetch asset", e);
                }
              }
            }
            return normalizeProjectAsset(item);
          }));
        };

        const resolvedItems = scope === 'view_public_project_models'
          ? await resolveReferences(fetchedItems)
          : fetchedItems;

        console.log(`[useGlobalModelsService] Fetched & resolved ${resolvedItems.length} items for scope ${scope}`);
        setData({ 
          status: 'ready', 
          items: resolvedItems, 
          itemCount: resolvedItems.length,
          assetCount: 0 
        });
        setIsInitializing(false);
      }, (err) => {
        console.error(`Failed to listen to global models for ${scope}`, err);
        setData((prev: any) => ({ ...prev, status: 'error', error: String(err) }));
        setIsInitializing(false);
      });
    };

    setupSubscription();

    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [scope, user?.uid, viewingPublicProjectId]);

  return { isInitializing, data };
};

const useGlobalProjectsService = (scope: 'global_projects' | 'global_following_projects' | string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], assets: [] });

  useEffect(() => {
    if (!['global_projects', 'global_following_projects'].includes(scope)) {
      setIsInitializing(false);
      return;
    }

    let unsubscribe: any;
    let isActive = true;
    const projectsCol = collection(db, 'projects');

    const setupSubscription = async () => {
      let q;
      if (scope === 'global_projects') {
         q = query(projectsCol, where('visibility', '==', 'public'), limit(60));
      } else if (scope === 'global_following_projects') {
         if (!user?.uid) {
           setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
           setIsInitializing(false);
           return;
         }
         try {
           const followingRef = collection(db, `users/${user.uid}/following`);
           const followingSnap = await getDocs(followingRef);
           const followingIds = followingSnap.docs.map(d => d.id);
           
           if (!isActive) return;
           
           if (followingIds.length === 0) {
             setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
             setIsInitializing(false);
             return;
           }
           
           // limitation of "in" clause is 30 in firestore
           const subset = followingIds.slice(0, 30);
           q = query(projectsCol, where('visibility', '==', 'public'), where('ownerId', 'in', subset), limit(60));
          } catch (err) {
            setData({ status: 'error', error: String(err) });
            setIsInitializing(false);
            return;
          }
      }

      if (!q) return;

      unsubscribe = onSnapshot(q as any, (snapshot: any) => {
        const fetchedItems = snapshot.docs.map((doc: any) => {
          const docData = doc.data();
          return { id: doc.id, isProjectItem: true, ...docData };
        });
        console.log(`[useGlobalProjectsService] Fetched ${fetchedItems.length} items for scope ${scope}`);

        // プロジェクト一覧取得後、各プロジェクトの assets から最新4件サムネをバッチ取得
        const enrichWithThumbs = async () => {
          const FETCH_LIMIT = 50;
          const thumbsResults = await Promise.all(
            fetchedItems.map(async (project: any) => {
              try {
                const assetsSnap = await getDocs(
                  query(collection(db, 'projects', project.id, 'assets'), limit(FETCH_LIMIT))
                );
                const activeDocs = assetsSnap.docs.filter((d: any) => {
                  const data = d.data();
                  if (data.status === 'archived' || data.isArchived) return false;
                  // 3Dモデル以外（AI Drive画像/PDF参照）はモデル一覧と同様に除外
                  if (data.type === 'image' || data.type === 'pdf') return false;
                  return true;
                });
                // DssModelCard と同じサムネ解決チェーン
                const pickThumb = (data: any): string => (
                  data?.metadata?.thumbnailFilePath?.url ||
                  data?.metadata?.thumbnailUrl ||
                  data?.metadata?.thumbnail?.url ||
                  data?.thumbnailFilePath?.url ||
                  data?.thumbnailUrl ||
                  data?.thumbnail?.url ||
                  data?.imageUrl ||
                  data?.previewUrl ||
                  data?.thumbUrl ||
                  data?.coverUrl ||
                  ''
                );

                // まずprojectアセットdocから直接取得できるURLを収集
                type RawAsset = { thumbUrl: string | null; refId: string | null };
                const rawAssets: RawAsset[] = activeDocs.map((d: any) => {
                  const data = d.data();
                  const refId = data.assetRef || data.entityId || data.metadata?.sourceModelId || data.sourceModelId || null;
                  return { thumbUrl: pickThumb(data) || null, refId };
                });

                // thumbUrlが空のassetをglobalアセットから補完（最大4件のみ）
                const resolvedThumbs: string[] = [];
                for (const asset of rawAssets) {
                  if (resolvedThumbs.length >= 4) break;
                  if (asset.thumbUrl) {
                    resolvedThumbs.push(asset.thumbUrl);
                  } else if (asset.refId) {
                    try {
                      const globalSnap = await getDoc(doc(db, 'assets', asset.refId));
                      if (globalSnap.exists()) {
                        const url = pickThumb(globalSnap.data());
                        if (url) resolvedThumbs.push(url);
                      }
                    } catch { /* permission-denied 等はスキップ */ }
                  }
                }

                const assetCount = activeDocs.length;
                const assetCountOver = assetsSnap.docs.length >= FETCH_LIMIT;
                return { id: project.id, thumbs: resolvedThumbs, assetCount, assetCountOver };
              } catch {
                return { id: project.id, thumbs: [] as string[], assetCount: 0, assetCountOver: false };
              }
            })
          );

          // オーナーのプロフィール（アイコン/表示名）をユニークIDでバッチ取得
          const ownerIds: string[] = Array.from(new Set(
            fetchedItems.map((p: any) => p.ownerId).filter(Boolean)
          ));
          const ownerProfiles: Record<string, { photoURL: string | null; displayName: string | null }> = {};
          await Promise.all(ownerIds.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                const u = snap.data() as any;
                ownerProfiles[uid] = {
                  photoURL: u.photoURL || null,
                  displayName: u.displayName || null,
                };
              }
            } catch { /* permission-denied 等はスキップ */ }
          }));

          if (!isActive) return;
          const metaById: Record<string, { thumbs: string[]; assetCount: number; assetCountOver: boolean }> = {};
          thumbsResults.forEach(r => { metaById[r.id] = r; });

          const enrichedItems = fetchedItems.map((p: any) => ({
            ...p,
            assetThumbs: metaById[p.id]?.thumbs ?? [],
            assetCount: metaById[p.id]?.assetCount ?? 0,
            assetCountOver: metaById[p.id]?.assetCountOver ?? false,
            ownerPhotoUrl: (p.ownerId && ownerProfiles[p.ownerId]?.photoURL) || null,
            ownerDisplayName: (p.ownerId && ownerProfiles[p.ownerId]?.displayName) || null,
          }));

          setData({
            status: 'ready',
            items: enrichedItems,
            itemCount: enrichedItems.length,
            assetCount: 0,
          });
          setIsInitializing(false);
        };

        // まずプロジェクト一覧を即座に表示し、サムネは非同期で追加
        setData({
          status: 'ready',
          items: fetchedItems.map((p: any) => ({ ...p, assetThumbs: null })),
          itemCount: fetchedItems.length,
          assetCount: 0,
        });
        setIsInitializing(false);
        enrichWithThumbs();
      }, (err: any) => {
        console.error(`Failed to listen to global projects for ${scope}`, err);
        setData((prev: any) => ({ ...prev, status: 'error', error: String(err) }));
        setIsInitializing(false);
      });
    };

    setupSubscription();

    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

// S.Model「Local Models」サービス。LocalAssets\Models ＋ユーザー追加フォルダを Tauri で
// 走査し、3Dモデル（3dm/glb/gltf/blend）を asset:// 参照で返す（読み取り専用）。
// glb/gltf 本体・隣接コンパニオン GLB は files.glb として詳細ビューの3Dプレビューに使える。
const useLocalModelsService = (active: boolean) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });
  const reloadKey = useModelSourcesStore((s) => s.reloadKey);

  useEffect(() => {
    if (!active) { setIsInitializing(false); return; }
    let cancelled = false;
    setIsInitializing(true);

    (async () => {
      try {
        const { invoke, convertFileSrc, isTauri } = await import('@tauri-apps/api/core');
        if (!isTauri()) {
          if (!cancelled) { setData({ status: 'ready', items: [] }); setIsInitializing(false); }
          return;
        }
        const assets: any[] = await invoke('list_local_model_assets');
        const toSrc = (p?: string | null) => (p ? convertFileSrc(String(p).replace(/\\/g, '/')) : undefined);
        const items = assets.map((a) => {
          const ext = String(a.ext || '').toLowerCase();
          const files: Record<string, any> = {
            [ext]: { url: toSrc(a.path), path: a.path },
          };
          // 3dm/blend の隣接コンパニオン GLB、または glb/gltf 自身をプレビュー用 glb に割り当て。
          if (a.companionGlbPath) files.glb = { url: toSrc(a.companionGlbPath), path: a.companionGlbPath };
          // 右パネル/詳細ビューは selectedItem.glbUrl（トップレベル）を直接参照するため両方に入れる。
          const glbUrl = files.glb?.url;
          return {
            id: a.id,
            title: a.name,
            name: a.name,
            isLocal: true,
            localPath: a.path,
            topExt: ext,
            fileFormat: ext.toUpperCase(),
            previewable: !!a.previewable,
            glbUrl,
            sizeBytes: a.sizeBytes,
            sourceId: a.sourceId || 'default',
            sourceLabel: a.sourceLabel || '',
            subfolder: a.subfolder,
            files,
          };
        });
        if (!cancelled) {
          const counts: Record<string, number> = {};
          // sourceId → サブフォルダ相対パス → 直下の件数。
          const subCounts: Record<string, Record<string, number>> = {};
          for (const it of items) {
            counts[it.sourceId] = (counts[it.sourceId] || 0) + 1;
            const sub = String(it.subfolder || '');
            if (!subCounts[it.sourceId]) subCounts[it.sourceId] = {};
            subCounts[it.sourceId][sub] = (subCounts[it.sourceId][sub] || 0) + 1;
          }
          const store = useModelSourcesStore.getState();
          store.setCounts(counts);
          store.setSubfolderCounts(subCounts);
          setData({ status: 'ready', items });
          setIsInitializing(false);
        }
      } catch (e) {
        console.error('[useLocalModelsService] failed to list local models', e);
        if (!cancelled) { setData({ status: 'error', items: [], error: String(e) }); setIsInitializing(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [active, reloadKey]);

  return { isInitializing, data };
};

const useDssService = (payload?: AdapterContext) => {
  const modelsScope = useAppStore(s => s.modelsScope);
  const isGlobalModels = ['global_models', 'global_following_models', 'my_public_models', 'my_private_models', 'view_public_project_models'].includes(modelsScope);
  const isGlobalProjects = ['global_projects', 'global_following_projects'].includes(modelsScope);
  const isLocal = modelsScope === 'local_models';
  const isGlobal = isGlobalModels || isGlobalProjects;

  const projectService = useWorkspaceService(!isGlobal && !isLocal && payload ? { ...payload, appScope: '3dss' } : undefined);
  const globalModelsService = useGlobalModelsService(isGlobalModels ? modelsScope as any : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? modelsScope as any : '');
  const localModelsService = useLocalModelsService(isLocal);

  if (isLocal) return localModelsService;
  if (isGlobalModels) return globalModelsService;
  if (isGlobalProjects) return globalProjectsService;

  return projectService;
};

/**
 * 3DSP プロジェクト専用サービスフック（project_presentations / team_project_presentations）。
 * createPresentationWorkFile は projects/{projectId}/workFiles に保存するため、
 * useWorkspaceService（workspaces/{workspaceId}/items を参照）ではなく
 * workFiles コレクションを直接監視する。
 */
const useDspProjectService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    if (!payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(
      collection(db, path),
      where('appScope', '==', '3dsp'),
      limit(100),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);
      setData({ status: 'ready', items });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDspProjectService] snapshot error', err);
      setData({ status: 'error', items: [] });
      setIsInitializing(false);
    });

    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

/**
 * 3DSP グローバルスコープ用サービスフック。
 * global_presentations / my_public_presentations / my_private_presentations を担当。
 */
const useGlobalPresentationsService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const dspGlobalFilter = useAppStore(s => s.dspGlobalFilter);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    const validScopes = ['global_presentations', 'my_public_presentations', 'my_private_presentations'];
    if (!validScopes.includes(scope)) {
      setIsInitializing(false);
      return;
    }

    let unsubscribe: any;
    let isActive = true;

    const setupSubscription = async () => {
      let q: any;
      const wfGroup = collectionGroup(db, 'workFiles');

      if (scope === 'global_presentations') {
        if (dspGlobalFilter === 'all' || !user?.uid) {
          // 全ユーザーの公開Presentations
          q = query(wfGroup, where('appScope', '==', '3dsp'), where('visibility', '==', 'public'), limit(60));
        } else {
          // フォローしているユーザーの公開Presentations（フォロー 0 人なら空を返す）
          try {
            const followingSnap = await getDocs(collection(db, `users/${user.uid}/following`));
            if (!isActive) return;
            const followingIds = followingSnap.docs.map(d => d.id);
            if (followingIds.length > 0) {
              const subset = followingIds.slice(0, 30);
              q = query(wfGroup, where('appScope', '==', '3dsp'), where('visibility', '==', 'public'), where('createdBy', 'in', subset), limit(60));
            } else {
              // フォロー 0 人 → 空配列
              setData({ status: 'ready', items: [] });
              setIsInitializing(false);
              return;
            }
          } catch {
            q = query(wfGroup, where('appScope', '==', '3dsp'), where('visibility', '==', 'public'), limit(60));
          }
        }
      } else if (scope === 'my_public_presentations') {
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        q = query(wfGroup, where('appScope', '==', '3dsp'), where('visibility', '==', 'public'), where('createdBy', '==', user.uid), limit(60));
      } else if (scope === 'my_private_presentations') {
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        // visibility が private、または visibility フィールドが未設定（旧データ）も含む
        q = query(wfGroup, where('appScope', '==', '3dsp'), where('createdBy', '==', user.uid), limit(100));
      }

      if (!q) return;

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        const items = snapshot.docs
          .map((d: any) => ({ id: d.id, projectId: d.ref.parent.parent?.id, ...d.data() }))
          .filter((item: any) => item.status !== 'archived' && item.isArchived !== true)
          // my_private: visibility が private か未設定のものに絞る
          .filter((item: any) => scope !== 'my_private_presentations' || !item.visibility || item.visibility === 'private');
        setData({ status: 'ready', items });
        setIsInitializing(false);
      }, (err: any) => {
        console.error(`[useGlobalPresentationsService] Error for scope ${scope}:`, err);
        setData({ status: 'error', items: [] });
        setIsInitializing(false);
      });
    };

    setupSubscription();
    return () => { isActive = false; if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid, dspGlobalFilter]);

  return { isInitializing, data };
};

/**
 * 3DSP ルーティングサービスフック。
 * dspScope に応じてグローバル / プロジェクト / グローバルプロジェクトサービスへ振り分ける。
 */
const useDspService = (payload?: AdapterContext) => {
  const dspScope = useAppStore(s => s.dspScope);
  // my_templates は自前でデータ取得する専用ビュー → globalPresentations サービスへ流し(validScopes ガードで空返し)、payload 依存を切る
  const isGlobalPresentations = ['global_presentations', 'my_public_presentations', 'my_private_presentations', 'my_templates'].includes(dspScope);
  const isGlobalProjects = dspScope === 'global_projects';
  const isGlobal = isGlobalPresentations || isGlobalProjects;

  const projectService = useDspProjectService(!isGlobal && payload ? payload : undefined);
  const globalPresentationsService = useGlobalPresentationsService(isGlobalPresentations ? dspScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalPresentations) return globalPresentationsService;
  if (isGlobalProjects) return globalProjectsService;
  return projectService;
};
// ──────────────────────────────────────────────────────────────────────────────
// 3DSD グローバルダイアグラムサービス
// ※ Firestore クエリは 3DSP と同じ既存 composite index に合わせ
//    type フィールドはクライアントフィルターで絞り込む
// ──────────────────────────────────────────────────────────────────────────────
const useGlobalDiagramsService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const dsdGlobalFilter = useAppStore(s => s.dsdGlobalFilter);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    const validScopes = ['global_diagrams', 'my_public_diagrams', 'my_private_diagrams'];
    if (!validScopes.includes(scope)) { setIsInitializing(false); return; }

    let unsubscribe: any;
    let isActive = true;
    const wfGroup = collectionGroup(db, 'workFiles');

    const setupSubscription = async () => {
      let q: any;

      if (scope === 'global_diagrams') {
        // global_diagrams: appScope + visibility の 2 フィールド（既存 index 範囲内）
        // following フィルターは createdBy in [...] を追加
        if (dsdGlobalFilter === 'following' && user?.uid) {
          try {
            const followingSnap = await getDocs(collection(db, `users/${user.uid}/following`));
            if (!isActive) return;
            const ids = followingSnap.docs.map(d => d.id);
            if (ids.length > 0) {
              q = query(wfGroup,
                where('appScope', '==', '3dsd'),
                where('visibility', '==', 'public'),
                where('createdBy', 'in', ids.slice(0, 30)),
                limit(80),
              );
            } else {
              setData({ status: 'ready', items: [] });
              setIsInitializing(false);
              return;
            }
          } catch {
            q = query(wfGroup, where('appScope', '==', '3dsd'), where('visibility', '==', 'public'), limit(80));
          }
        } else {
          q = query(wfGroup, where('appScope', '==', '3dsd'), where('visibility', '==', 'public'), limit(80));
        }
      } else if (scope === 'my_public_diagrams') {
        // 3DSP の my_public_presentations と同じ 3 フィールドパターン
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        q = query(wfGroup,
          where('appScope', '==', '3dsd'),
          where('visibility', '==', 'public'),
          where('createdBy', '==', user.uid),
          limit(100),
        );
      } else if (scope === 'my_private_diagrams') {
        // 3DSP の my_private_presentations と同じ 2 フィールドパターン → visibility はクライアントフィルター
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        q = query(wfGroup,
          where('appScope', '==', '3dsd'),
          where('createdBy', '==', user.uid),
          limit(100),
        );
      }

      if (!q) return;

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        let items = snapshot.docs.map((d: any) => ({
          id: d.id,
          projectId: d.ref.parent.parent?.id,
          ...d.data(),
        })).filter((item: any) =>
          // type フィルターはクライアント側で実施（composite index 不要）
          item.type === 'diagram-state' &&
          item.status !== 'archived' &&
          item.isArchived !== true,
        );

        // Private: visibility が private か未設定（旧データ）に絞る
        if (scope === 'my_private_diagrams') {
          items = items.filter((item: any) => !item.visibility || item.visibility === 'private');
        }

        setData({ status: 'ready', items });
        setIsInitializing(false);
      }, (err: any) => {
        console.error(`[useGlobalDiagramsService] Error for scope ${scope}:`, err);
        setData({ status: 'error', items: [] });
        setIsInitializing(false);
      });
    };

    setupSubscription();
    return () => { isActive = false; if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid, dsdGlobalFilter]);

  return { isInitializing, data };
};

// ──────────────────────────────────────────────────────────────────────────────
// 3DSC グローバル家具サービス
// collectionGroup('workFiles') に appScope='3dsc' で絞り込む。
// 3DSP の useGlobalPresentationsService と同じパターン。
// ──────────────────────────────────────────────────────────────────────────────
const useGlobalFurnitureService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    const validScopes = ['global_furniture', 'global_following_furniture', 'my_public_furniture', 'my_private_furniture'];
    if (!validScopes.includes(scope)) {
      setIsInitializing(false);
      return;
    }

    let unsubscribe: any;
    let isActive = true;
    const wfGroup = collectionGroup(db, 'workFiles');

    const setupSubscription = async () => {
      let q: any;

      if (scope === 'global_following_furniture') {
        if (!user?.uid) {
          // 未ログイン → 全公開を表示
          q = query(wfGroup, where('appScope', '==', '3dsc'), where('visibility', '==', 'public'), limit(60));
        } else {
          try {
            const followingSnap = await getDocs(collection(db, `users/${user.uid}/following`));
            if (!isActive) return;
            const followingIds = followingSnap.docs.map((d: any) => d.id);
            if (followingIds.length > 0) {
              const subset = followingIds.slice(0, 30);
              q = query(wfGroup,
                where('appScope', '==', '3dsc'),
                where('visibility', '==', 'public'),
                where('createdBy', 'in', subset),
                limit(60),
              );
            } else {
              // フォロー 0 人 → 全公開にフォールバック
              q = query(wfGroup, where('appScope', '==', '3dsc'), where('visibility', '==', 'public'), limit(60));
            }
          } catch {
            // タイムアウト/エラー → global_furniture にフォールバック
            useDscStore.getState().setDscViewScope('global_furniture');
            setData({ status: 'ready', items: [] });
            setIsInitializing(false);
            return;
          }
        }
      } else if (scope === 'global_furniture') {
        q = query(wfGroup, where('appScope', '==', '3dsc'), where('visibility', '==', 'public'), limit(60));
      } else if (scope === 'my_public_furniture') {
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        q = query(wfGroup,
          where('appScope', '==', '3dsc'),
          where('visibility', '==', 'public'),
          where('createdBy', '==', user.uid),
          limit(60),
        );
      } else if (scope === 'my_private_furniture') {
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        // visibility が private か未設定（旧データ）も含む
        q = query(wfGroup, where('appScope', '==', '3dsc'), where('createdBy', '==', user.uid), limit(100));
      }

      if (!q) return;

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        let items = snapshot.docs.map((d: any) => ({
          id: d.id,
          projectId: d.ref.parent.parent?.id,
          ...d.data(),
        })).filter((item: any) => item.status !== 'archived' && item.isArchived !== true);

        // Private: visibility が private か未設定のものに絞る
        if (scope === 'my_private_furniture') {
          items = items.filter((item: any) => !item.visibility || item.visibility === 'private');
        }

        setData({ status: 'ready', items });
        setIsInitializing(false);
      }, (err: any) => {
        console.error(`[useGlobalFurnitureService] Error for scope ${scope}:`, err);
        setData({ status: 'error', items: [] });
        setIsInitializing(false);
      });
    };

    setupSubscription();
    return () => { isActive = false; if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

// useDscService: dscViewScope に応じてグローバル家具 / グローバルプロジェクト / プロジェクト専用へ振り分け
const useDscService = (payload?: AdapterContext) => {
  const dscViewScope = useDscStore(s => s.dscViewScope);
  const isGlobalFurniture = ['global_furniture', 'global_following_furniture', 'my_public_furniture', 'my_private_furniture'].includes(dscViewScope);
  const isGlobalProjects = dscViewScope === 'global_projects';
  const isGlobal = isGlobalFurniture || isGlobalProjects;

  const projectService = useWorkspaceService(!isGlobal && payload ? payload : undefined);
  const globalFurnitureService = useGlobalFurnitureService(isGlobalFurniture ? dscViewScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalFurniture) return globalFurnitureService;
  if (isGlobalProjects) return globalProjectsService;
  return projectService;
};

const useGlobalLayoutsService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], assets: [] });

  useEffect(() => {
    // スコープ切替時は isInitializing のみ立て、既存 items はそのまま残す
    // → 旧スコープのグリッドを薄表示しながら新データを待つ（体感速度改善）
    setIsInitializing(true);

    const validScopes = ['global_layouts', 'global_following_layouts', 'my_public_layouts', 'my_private_layouts'];
    if (!validScopes.includes(scope)) {
      setIsInitializing(false);
      return;
    }

    let unsubscribe: any;
    let isActive = true;
    const layoutsGroup = collectionGroup(db, 'layouts');

    const setupSubscription = async () => {
      let q: any;

      if (scope === 'global_layouts') {
        q = query(layoutsGroup, where('visibility', '==', 'public'), limit(60));
      } else if (scope === 'global_following_layouts') {
        if (!user?.uid) {
          setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
          setIsInitializing(false);
          return;
        }
        try {
          const followingRef = collection(db, `users/${user.uid}/following`);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
          const followingSnap = await Promise.race([getDocs(followingRef), timeoutPromise]) as any;
          const followingIds = followingSnap.docs.map((d: any) => d.id);

          if (!isActive) return;

          if (followingIds.length === 0) {
            setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
            setIsInitializing(false);
            return;
          }

          const subset = followingIds.slice(0, 30);
          // visibility + ownerId in [...] — 複合インデックスが必要（firestore.indexes.json 済み）
          q = query(layoutsGroup, where('visibility', '==', 'public'), where('ownerId', 'in', subset), limit(60));
        } catch (err: any) {
          import('../../../store/useAppStore').then(m => {
            m.useAppStore.getState().setDslScope('global_layouts');
          });
          setData({ status: 'ready', items: [], itemCount: 0, assetCount: 0 });
          setIsInitializing(false);
          return;
        }
      } else if (scope === 'my_public_layouts') {
        if (!user?.uid) { setIsInitializing(false); return; }
        // createdBy で全レイアウトを取得し visibility をクライアントフィルタ
        // → ownerId / visibility 未設定の旧レイアウトにも対応（単一フィールド自動インデックス使用）
        q = query(layoutsGroup, where('createdBy', '==', user.uid), limit(100));
      } else if (scope === 'my_private_layouts') {
        if (!user?.uid) { setIsInitializing(false); return; }
        // createdBy で全レイアウトを取得し、非公開 or 未設定をクライアントフィルタ
        q = query(layoutsGroup, where('createdBy', '==', user.uid), limit(100));
      }

      if (!q) return;

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        let fetchedItems = snapshot.docs.map((d: any) => {
          const data = d.data();
          // Path: projects/{projectId}/workspaces/{workspaceId}/layouts/{layoutId}
          const segs = d.ref.path.split('/');
          return {
            id: d.id,
            title: data.name || data.title,
            projectId: data.projectId || segs[1],
            workspaceId: data.workspaceId || segs[3],
            ...data,
          };
        });

        // クライアントサイドで visibility フィルタ（旧データ対応）
        if (scope === 'my_public_layouts') {
          fetchedItems = fetchedItems.filter((item: any) => item.visibility === 'public');
        } else if (scope === 'my_private_layouts') {
          // visibility 未設定（旧データ）は非公開扱いにする
          fetchedItems = fetchedItems.filter((item: any) => !item.visibility || item.visibility === 'private');
        }

        setData({ status: 'ready', items: fetchedItems, itemCount: fetchedItems.length, assetCount: 0 });
        setIsInitializing(false);
      }, (err: any) => {
        console.error(`Failed to listen to global layouts for ${scope}`, err);
        setData((prev: any) => ({ ...prev, status: 'error', error: String(err) }));
        setIsInitializing(false);
      });
    };

    setupSubscription();
    return () => { isActive = false; if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

const useDslService = () => {
  const dslScope = useAppStore(s => s.dslScope);
  const isGlobalLayouts = ['global_layouts', 'global_following_layouts', 'my_public_layouts', 'my_private_layouts'].includes(dslScope);
  const isGlobalProjects = dslScope === 'global_projects';

  const globalLayoutsService = useGlobalLayoutsService(isGlobalLayouts ? dslScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? (dslScope as any) : '');

  if (isGlobalLayouts) return globalLayoutsService;
  if (isGlobalProjects) return globalProjectsService;
  return { isInitializing: false, data: { status: 'ready', items: [], itemCount: 0 } };
};


import { useAppStore } from '../../../store/useAppStore';
import { useDsiEditorStore } from '../../../features/dsi/store/useDsiEditorStore';
import { useImageSourcesStore } from '../../../features/dsi/store/useImageSourcesStore';
import { buildTextureGroups } from '../../../features/dsi/textureGrouping';
import { useTextureSetStore } from '../../../features/dsi/store/useTextureSetStore';
import { useModelSourcesStore } from '../../../features/dss/store/useModelSourcesStore';
import { useLocalUploadStore } from '../../../features/dss/store/useLocalUploadStore';
import { useDscStore } from '../../../features/dsc/store/useDscStore';
import { useDsdStore } from '../../../features/dsd/store/useDsdStore';
import { useDsbStore } from '../../../features/dsb/store/useDsbStore';
import { DsbSidebar } from '../dsb-sidebar/DsbSidebar';
import { DsbHeaderBar } from '../../../features/dsb/DsbHeaderBar';
// 全幅ヘッダー化: ダッシュボードを経由しない分岐（テンプレート管理・未選択メッセージ等）でも
// デスクトップでは左サイドバーを埋め込む必要があるため、アダプタ側でも参照する。
import { ModelsSidebar } from '../models-sidebar/ModelsSidebar';
import { DspSidebar } from '../dsp-sidebar/DspSidebar';
import { DscSidebar } from '../dsc-sidebar/DscSidebar';
import { DslSidebar } from '../dsl-sidebar/DslSidebar';
import { useAutosaveDraft } from '../../hooks/useAutosaveDraft';
import { dsdFsHelpers } from '../../../features/dsd/utils/dsdFsHelpers';

// -------------------------------------------------------------
// View Layer Adapters
// -------------------------------------------------------------
export const DssAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const modelsScope = useAppStore(s => s.modelsScope);
  const dssShellMode = useAppStore(s => s.dssShellMode);
  const setDssShellMode = useAppStore(s => s.setDssShellMode);
  // 全幅ヘッダー化: ダッシュボード非表示の分岐でも左サイドバーを維持するため（デスクトップのみ）
  const isMobile = useMediaQuery('(max-width:768px)');
  const isGlobal = ['global_models', 'global_following_models', 'global_projects', 'global_following_projects', 'my_public_models', 'my_private_models', 'view_public_project_models'].includes(modelsScope);
  const isLocal = modelsScope === 'local_models';
  const sourceFilter = useModelSourcesStore(s => s.sourceFilter);
  const subfolderFilter = useModelSourcesStore(s => s.subfolderFilter);
  const cloudFilter = useLocalUploadStore(s => s.cloudFilter);
  const uploadRecords = useLocalUploadStore(s => s.records);
  const refreshUploadRecords = useLocalUploadStore(s => s.refresh);

  // Local Models のときクラウド保存記録を読み込む。
  useEffect(() => { if (isLocal) refreshUploadRecords(); }, [isLocal, refreshUploadRecords]);

  const { isInitializing, data } = useDssService(payload);

  // Local Models のソース別＋サブフォルダ別＋クラウド状態の絞り込み（null/all = すべて）。
  const items = useMemo(() => {
    let base = data?.items || [];
    if (isLocal && sourceFilter) {
      base = base.filter((m: any) => m.sourceId === sourceFilter);
      if (subfolderFilter) {
        base = base.filter((m: any) => {
          const sub = String(m.subfolder || '');
          return sub === subfolderFilter || sub.startsWith(subfolderFilter + '/');
        });
      }
    }
    if (isLocal && cloudFilter !== 'all') {
      base = base.filter((m: any) => {
        const rec = m.localPath ? uploadRecords[String(m.localPath).toLowerCase()] : null;
        if (cloudFilter === 'local') return !rec;
        if (cloudFilter === 'cloud') return !!rec;
        if (cloudFilter === 'public') return rec?.visibility === 'public';
        if (cloudFilter === 'private') return rec?.visibility === 'private';
        return true;
      });
    }
    return base;
  }, [data, isLocal, sourceFilter, subfolderFilter, cloudFilter, uploadRecords]);

  // S.Model エディター（3Dモデル生成）モード。S.Image と同じシェル切替パターン。
  // スコープ（プロジェクト未選択など）に関わらず、エディター指定時は必ず開く。
  if (dssShellMode === 'editor') {
    return (
      <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
        <React.Suspense fallback={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
            <CircularProgress sx={{ color: '#ff5252', mb: 2 }} />
            <Typography color="text.secondary">Loading S.Model エディター...</Typography>
          </Box>
        }>
          <DssEditorLazy payload={payload} onBack={() => setDssShellMode('dashboard')} />
        </React.Suspense>
      </Box>
    );
  }

  if (!isGlobal && !isLocal && (!payload || !payload.workspaceId || !payload.projectId)) {
    return (
      <Box sx={{ display: 'flex', height: '100%', minWidth: 0, overflow: 'hidden' }}>
        {/* ダッシュボード非表示でもプロジェクト選択用の左サイドバーは必要（デスクトップ埋め込み） */}
        {!isMobile && <ModelsSidebar />}
        <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', color: 'text.secondary' }}>
          <Typography variant="h5" color="text.primary">No Project Selected</Typography>
          <Typography variant="body1">Please select a project from the left sidebar to view its models.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden' }}>
      <DssDashboard
        payload={payload}
        items={items}
        isInitializing={isInitializing}
      />
    </Box>
  );
};

// @ts-ignore
const DspEditorLazy = React.lazy(() => import('../../../features/dsp/editor/DspEditor').then(m => ({ default: m.DspEditor })));

export const DspAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dspScope = useAppStore(s => s.dspScope);
  const isGlobal = ['global_presentations', 'my_public_presentations', 'my_private_presentations', 'global_projects', 'my_templates'].includes(dspScope);
  const { isInitializing, data } = useDspService(payload);
  const dspShellMode = useAppStore(s => s.dspShellMode);
  const selectedItem = useAppStore(s => payload?.workspaceId ? s.panelSelections[payload.workspaceId] : null);
  // 全幅ヘッダー化: ダッシュボードを経由しない分岐（テンプレート管理・未選択）でも
  // デスクトップでは左サイドバーを埋め込んで維持する（モバイルは MainLayout のドロワー）。
  const isMobile = useMediaQuery('(max-width:768px)');

  // テンプレート管理は専用ビュー（scope 駆動・shellMode に依存しない）。
  // 左サイドバー/右詳細パネルはビュー内（全幅ヘッダー下の行）に埋め込み済み。
  if (dspScope === 'my_templates') {
    return (
      <Box sx={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <DspTemplatesView />
      </Box>
    );
  }

  // グローバルスコープでは projectId が不要。プロジェクトスコープのみ必須チェック
  if (!isGlobal && (!payload || !payload.workspaceId || !payload.projectId)) {
    return (
      <Box sx={{ display: 'flex', height: '100%', minWidth: 0, overflow: 'hidden' }}>
        {!isMobile && <DspSidebar />}
        <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', color: 'text.secondary' }}>
          <Typography variant="h5" color="text.primary">No Workspace Selected</Typography>
          <Typography variant="body1">Please select a S.Slide workspace from the Project Overview to continue.</Typography>
        </Box>
      </Box>
    );
  }

  if (dspShellMode === 'editor') {
    return (
      <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
        <React.Suspense fallback={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
            <CircularProgress sx={{ color: 'light-dark(#0775a6, #29b6f6)', mb: 2 }} />
            <Typography color="text.secondary">Loading 3D Shape Presents Engine...</Typography>
          </Box>
        }>
          {selectedItem?.type === 'canvas' ? (
             <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
               <AiCanvasOverviewLazy payload={payload} />
             </Box>
          ) : (
            <DspEditorLazy 
              payload={payload} 
              onBack={() => useAppStore.getState().setDspShellMode('dashboard')} 
            />
          )}
        </React.Suspense>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden' }}>
      <DspDashboard
        payload={payload}
        items={data?.items || []}
        isInitializing={isInitializing}
      />
    </Box>
  );
};

// @ts-ignore
const DscStudioLazy = React.lazy(() => import('../../../features/dsc/create/DscStudio').then(m => ({ default: m.DscStudio })));

export const DscAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const { isInitializing, data } = useDscService(payload);
  const dscShellMode = useAppStore(s => s.dscShellMode);
  const dscViewScope = useDscStore(s => s.dscViewScope);
  const isGlobalScope = ['global_furniture', 'global_following_furniture', 'global_projects', 'my_public_furniture', 'my_private_furniture'].includes(dscViewScope);
  // 全幅ヘッダー化: ダッシュボード非表示の分岐でも左サイドバーを維持するため（デスクトップのみ）
  const isMobile = useMediaQuery('(max-width:768px)');

  // スタジオ入室時に showDscProjectBrowser をリセット → DscEditorSidebar へ自動切替
  useEffect(() => {
    if (dscShellMode === 'studio') {
      useDscStore.getState().setShowDscProjectBrowser(false);
    }
  }, [dscShellMode]);

  // 未保存状態をグローバル registry に反映 → タブの「作業中」ドット表示・未保存一覧に使う
  const dscDirty = useDscStore(s => s.dirty);
  const dscWorkFileId = useDscStore(s => s.currentWorkFileId);
  const dscFurnitureName = useDscStore(s => s.furnitureName);
  const setScopeDirtyDsc = useAppStore(s => s.setScopeDirty);
  useEffect(() => {
    const isDirty = dscShellMode === 'studio' && dscDirty;
    setScopeDirtyDsc('3dsc', isDirty);
    const wfId = dscWorkFileId || '__dsc_new__';
    const key = `3dsc:${wfId}`;
    useAppStore.getState().setWorkingFile(key, isDirty && payload?.projectId ? {
      scope: '3dsc', projectId: payload.projectId, workFileId: wfId,
      name: dscFurnitureName || '新規造作家具', isNew: !dscWorkFileId,
    } : null);
  }, [dscDirty, dscShellMode, dscWorkFileId, dscFurnitureName, payload?.projectId, setScopeDirtyDsc]);
  useEffect(() => () => { useAppStore.getState().setScopeDirty('3dsc', false); }, []);

  // グローバルスコープでは projectId は不要
  if (!isGlobalScope && (!payload || !payload.workspaceId || !payload.projectId)) {
    return (
      <Box sx={{ display: 'flex', height: '100%', minWidth: 0, overflow: 'hidden' }}>
        {/* ダッシュボード非表示でもワークスペース選択用の左サイドバーは必要（デスクトップ埋め込み） */}
        {!isMobile && <DscSidebar />}
        <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', color: 'text.secondary' }}>
          <Typography variant="h5" color="text.primary">No Workspace Selected</Typography>
          <Typography variant="body1">Please select a S.Create workspace from the Project Overview to continue.</Typography>
        </Box>
      </Box>
    );
  }

  if (dscShellMode === 'studio') {
    return (
      <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
        <React.Suspense fallback={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
            <CircularProgress sx={{ color: 'light-dark(#ad6700, #ffa726)', mb: 2 }} />
            <Typography color="text.secondary">Loading 3D Shape Create (造作ビルダー) Engine...</Typography>
          </Box>
        }>
          <DscStudioLazy 
            payload={payload} 
            onBack={() => useAppStore.getState().setDscShellMode('dashboard')} 
          />
        </React.Suspense>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden' }}>
      <DscDashboard
        payload={payload}
        items={data?.items || []}
        isInitializing={isInitializing}
      />
    </Box>
  );
};

// @ts-ignore
const DslWorkspaceLazy = React.lazy(() => import('../../../features/dsl/layout/DslWorkspace'));

const DSL_GLOBAL_SCOPES = ['global_layouts', 'global_following_layouts', 'global_projects', 'my_public_layouts', 'my_private_layouts'];

export const DslAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dslScope = useAppStore(s => s.dslScope);
  const isGlobal = DSL_GLOBAL_SCOPES.includes(dslScope);
  // 全幅ヘッダー化: ダッシュボード非表示の分岐でも左サイドバーを維持するため（デスクトップのみ）
  const isMobile = useMediaQuery('(max-width:768px)');
  // DslSidebar のルートは width:100%（親任せ）なので、埋め込み時は 240px のラッパーで幅を与える
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);

  const { isInitializing, data } = useDslService();

  if (isGlobal) {
    return (
      <Box sx={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <DslDashboard items={data?.items || []} isInitializing={isInitializing} />
      </Box>
    );
  }

  if (!payload || !payload.workspaceId || !payload.projectId) {
    return (
      <Box sx={{ display: 'flex', height: '100%', minWidth: 0, overflow: 'hidden' }}>
        {/* ダッシュボード非表示でもワークスペース選択用の左サイドバーは必要（デスクトップ埋め込み） */}
        {!isMobile && (
          <Box sx={{ width: isProjectSidebarOpen ? 240 : 0, flexShrink: 0, height: '100%', overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <DslSidebar />
          </Box>
        )}
        <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', color: 'text.secondary' }}>
          <Typography variant="h5" color="text.primary">No Workspace Selected</Typography>
          <Typography variant="body1">Please select a S.Layout workspace from the Project Overview to continue.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: 'light-dark(#a80637, #fa709a)', mb: 2 }} />
          <Typography color="text.secondary">Loading 3D Layout Engine...</Typography>
        </Box>
      }>
        <DslWorkspaceLazy
          // プロジェクト/ワークスペースが変わったらクリーンに remount し、
          // 前プロジェクトの Base/Plan 選択を持ち越さずダッシュボードを表示する。
          key={`${payload.projectId}::${payload.workspaceId}`}
          projectId={payload.projectId}
          workspaceId={payload.workspaceId}
          workspaceName={payload.workspaceName}
          appScope={payload.appScope}
        />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// AI Canvas Adapter
// -------------------------------------------------------------
// 3DSD — Shape Diagram Adapter
// -------------------------------------------------------------
// ──────────────────────────────────────────────────────────────────────────────
// 3DSD ライブラリサービス
// projects/{projectId}/workFiles から appScope='3dsd' のエクスポートを購読する
// ──────────────────────────────────────────────────────────────────────────────
const useDsdLibraryService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], diagramItems: [] });

  useEffect(() => {
    if (!payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(
      collection(db, path),
      where('appScope', '==', '3dsd'),
      limit(200),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);

      // Split into diagram-state items (editable diagrams) and export items (images/videos/PDFs)
      const diagramItems = allItems.filter((item: any) => item.type === 'diagram-state');
      const exportItems  = allItems.filter((item: any) => item.type !== 'diagram-state');

      setData({ status: 'ready', items: exportItems, diagramItems });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDsdLibraryService] snapshot error', err);
      setData({ status: 'error', items: [], diagramItems: [] });
      setIsInitializing(false);
    });

    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

const DSD_GLOBAL_SCOPES = ['global_diagrams', 'global_projects', 'my_public_diagrams', 'my_private_diagrams'];

// S.Diagram には専用の未保存フラグが無いため、保存対象フィールドのスナップショットを
// 直前の保存/読込時の基準と比較して「未保存（作業中）」を判定する。
const DSD_PERSISTED_FIELDS = [
  'currentTemplate', 'diagramTitle', 'style', 'presetShape', 'customPolygon',
  'buildingWidth', 'buildingDepth', 'buildingHeight', 'northAngle',
  'month', 'timeHour', 'latitude', 'layoutMode', 'zones', 'flows',
  'siteBoundaryW', 'siteBoundaryH', 'siteNorthAngle', 'siteElements', 'siteAccesses',
  'windDirection', 'windSpeed', 'envLayer', 'noiseSources', 'thermalSeason',
  'windViewCx', 'windViewCy', 'windViewW', 'windViewH', 'annotations',
] as const;
const pickDsdFields = (s: any): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const k of DSD_PERSISTED_FIELDS) out[k] = s[k];
  return out;
};
const serializeDsd = (s: any): string => {
  try {
    return JSON.stringify(DSD_PERSISTED_FIELDS.map((k) => s[k]));
  } catch {
    return '';
  }
};

const useDsdService = (payload?: AdapterContext) => {
  const dsdScope = useAppStore(s => s.dsdScope);
  const isGlobalDiagrams = ['global_diagrams', 'my_public_diagrams', 'my_private_diagrams'].includes(dsdScope);
  const isGlobalProjects = dsdScope === 'global_projects';
  const isGlobal = DSD_GLOBAL_SCOPES.includes(dsdScope);

  const projectService = useDsdLibraryService(!isGlobal && payload ? payload : undefined);
  const globalDiagramsService = useGlobalDiagramsService(isGlobalDiagrams ? dsdScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalDiagrams) return { isInitializing: globalDiagramsService.isInitializing, data: { ...globalDiagramsService.data, diagramItems: globalDiagramsService.data.items, items: [] } };
  if (isGlobalProjects) return { isInitializing: globalProjectsService.isInitializing, data: { ...globalProjectsService.data, diagramItems: [], items: [] } };
  return projectService;
};

// @ts-ignore
const DsdDashboardLazy = React.lazy(() => import('../../../features/dsd/DsdDashboard').then(m => ({ default: m.DsdDashboard })));
// @ts-ignore
const DsdGlobalDashboardLazy = React.lazy(() => import('../../../features/dsd/DsdGlobalDashboard').then(m => ({ default: m.DsdGlobalDashboard })));
// @ts-ignore
const SunDiagramEditorLazy = React.lazy(() => import('../../../features/dsd/SunDiagramEditor').then(m => ({ default: m.SunDiagramEditor })));
// @ts-ignore
const LayoutDiagramEditorLazy = React.lazy(() => import('../../../features/dsd/LayoutDiagramEditor').then(m => ({ default: m.LayoutDiagramEditor })));
// @ts-ignore
const SiteDiagramEditorLazy = React.lazy(() => import('../../../features/dsd/SiteDiagramEditor').then(m => ({ default: m.SiteDiagramEditor })));
// @ts-ignore
const EnvironmentDiagramEditorLazy = React.lazy(() => import('../../../features/dsd/EnvironmentDiagramEditor').then(m => ({ default: m.EnvironmentDiagramEditor })));

export const DsdAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dsdShellMode = useAppStore(s => s.dsdShellMode);
  const dsdScope    = useAppStore(s => s.dsdScope);
  const currentTemplate = useDsdStore(s => s.currentTemplate);
  const { isInitializing, data } = useDsdService(payload);
  const isGlobal = DSD_GLOBAL_SCOPES.includes(dsdScope);

  // 未保存状態をグローバル registry に反映 + ダイアグラム切替で作業中状態を失わない
  // （DSP と同じ stash/restore パターン。専用 dirty フラグが無いので保存版スナップショットと比較）
  const activeDiagramId = useAppStore(s => s.activeDiagramId);
  const dsdSnapshot = useDsdStore(serializeDsd);
  const dsdSavedTick = useDsdStore(s => s.savedTick);
  const dsdSessionCount = useDsdStore(s => Object.keys(s.sessionCache).length);
  const setScopeDirtyDsd = useAppStore(s => s.setScopeDirty);
  const dsdBaselineRef = React.useRef<string | null>(null);
  const dsdPrevIdRef = React.useRef<string | null>(null);
  const dsdPrevSnapshotRef = React.useRef<string | null>(null);
  const dsdPrevFieldsRef = React.useRef<Record<string, any> | null>(null);

  // ダイアグラム切替時: 退出側が未保存なら退避し、再開側に退避があれば復元
  useEffect(() => {
    const prevId = dsdPrevIdRef.current;
    if (
      prevId &&
      dsdPrevSnapshotRef.current != null &&
      dsdPrevFieldsRef.current != null &&
      dsdBaselineRef.current != null &&
      dsdPrevSnapshotRef.current !== dsdBaselineRef.current
    ) {
      // 退出側の実フィールドはラグ ref から取得（getState は再開側で上書き済みの場合がある）
      useDsdStore.getState().setDsdSession(prevId, {
        fields: dsdPrevFieldsRef.current,
        baseline: dsdBaselineRef.current,
      });
    }

    const inc = activeDiagramId ? useDsdStore.getState().sessionCache[activeDiagramId] : undefined;
    if (inc) {
      useDsdStore.getState().loadState(inc.fields as any);
      dsdBaselineRef.current = inc.baseline; // 保存版基準 → 復元内容は未保存表示
    } else {
      dsdBaselineRef.current = serializeDsd(useDsdStore.getState());
    }
    dsdPrevIdRef.current = activeDiagramId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagramId]);

  // 保存完了: 基準を更新し、そのダイアグラムの退避を破棄
  useEffect(() => {
    dsdBaselineRef.current = serializeDsd(useDsdStore.getState());
    if (activeDiagramId) useDsdStore.getState().setDsdSession(activeDiagramId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsdSavedTick]);

  // 直近スナップショット/フィールドを保持（次回切替時の「退出側」判定・退避に使う）
  useEffect(() => {
    dsdPrevSnapshotRef.current = dsdSnapshot;
    dsdPrevFieldsRef.current = pickDsdFields(useDsdStore.getState());
  }, [dsdSnapshot]);

  const dsdDiagramTitle = useDsdStore(s => s.diagramTitle);

  // 未保存ドット: エディタ編集中の差分、または退避中セッションがあれば点灯。
  // あわせて現在編集中のダイアグラムを未保存一覧（workingFiles）へ登録。
  useEffect(() => {
    const editorDirty =
      dsdShellMode === 'editor' &&
      dsdBaselineRef.current != null &&
      dsdSnapshot !== dsdBaselineRef.current;
    setScopeDirtyDsd('3dsd', editorDirty || dsdSessionCount > 0);

    const wfId = activeDiagramId || '__dsd_new__';
    const key = `3dsd:${wfId}`;
    useAppStore.getState().setWorkingFile(key, editorDirty && payload?.projectId ? {
      scope: '3dsd', projectId: payload.projectId, workFileId: wfId,
      name: dsdDiagramTitle || '無題ダイアグラム', isNew: !activeDiagramId,
    } : null);
  }, [dsdSnapshot, dsdShellMode, dsdSessionCount, activeDiagramId, dsdDiagramTitle, payload?.projectId, setScopeDirtyDsd]);

  useEffect(() => () => { useAppStore.getState().setScopeDirty('3dsd', false); }, []);

  // 自動保存（ローカル下書きのみ）— 編集停止後に 3DSD フォルダへ書き出す
  const dsdProjectName = useAppStore(s => s.projects.find(p => p.id === payload?.projectId)?.name || 'UnnamedProject');
  const dsdEditorDirty =
    dsdShellMode === 'editor' && dsdBaselineRef.current != null && dsdSnapshot !== dsdBaselineRef.current;
  useAutosaveDraft({
    key: payload?.projectId && dsdShellMode === 'editor' ? `3dsd:${activeDiagramId || '__dsd_new__'}` : null,
    dirty: dsdEditorDirty,
    signal: dsdSnapshot,
    save: async () => {
      if (!payload?.projectId) return;
      await dsdFsHelpers.saveLocalDraft(
        payload.projectId, dsdProjectName,
        activeDiagramId || '__dsd_new__', dsdDiagramTitle || 'untitled',
        pickDsdFields(useDsdStore.getState()),
      );
    },
  });

  const handleDeleteItem = useCallback(async (item: any) => {
    if (!payload?.projectId) return;
    try {
      const { deleteDsdExport } = await import('../../../features/dsd/library/dsdExportService');
      await deleteDsdExport(payload.projectId, item.id);
    } catch (e) {
      console.error('[DsdAdapter] Delete export failed', e);
    }
  }, [payload?.projectId]);

  const handleDeleteDiagram = useCallback(async (item: any) => {
    if (!payload?.projectId) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(firestoreDb, `projects/${payload.projectId}/workFiles`, item.id));
      // Clear active diagram if it was the deleted one
      if (useAppStore.getState().activeDiagramId === item.id) {
        useAppStore.getState().setActiveDiagramId(null);
      }
    } catch (e) {
      console.error('[DsdAdapter] Delete diagram failed', e);
    }
  }, [payload?.projectId]);

  const handleSelectDiagram = useCallback((item: any) => {
    const workspaceId = payload?.workspaceId ?? 'diagram';
    useAppStore.getState().setPanelSelection(workspaceId, item);
  }, [payload?.workspaceId]);

  const handleOpenDiagram = useCallback((item: any) => {
    const store = useDsdStore.getState();
    store.loadState({
      currentTemplate: item.currentTemplate,
      diagramTitle: item.diagramTitle,
      style: item.style,
      presetShape: item.presetShape,
      customPolygon: item.customPolygon ?? [],
      buildingWidth: item.buildingWidth,
      buildingDepth: item.buildingDepth,
      buildingHeight: item.buildingHeight,
      northAngle: item.northAngle,
      month: item.month,
      timeHour: item.timeHour,
      latitude: item.latitude,
      layoutMode: item.layoutMode,
      zones: item.zones ?? [],
      flows: item.flows ?? [],
      siteBoundaryW: item.siteBoundaryW,
      siteBoundaryH: item.siteBoundaryH,
      siteNorthAngle: item.siteNorthAngle,
      siteElements: item.siteElements ?? [],
      siteAccesses: item.siteAccesses ?? [],
      windDirection: item.windDirection,
      windSpeed: item.windSpeed,
      envLayer: item.envLayer,
      noiseSources: item.noiseSources ?? [],
      thermalSeason: item.thermalSeason,
      windViewCx: item.windViewCx,
      windViewCy: item.windViewCy,
      windViewW: item.windViewW,
      windViewH: item.windViewH,
      annotations: item.annotations ?? [],
    });
    if (item.currentTemplate) store.setCurrentTemplate(item.currentTemplate);
    useAppStore.getState().setActiveDiagramId(item.id);
    useAppStore.getState().setDsdShellMode('editor');
  }, []);

  const editorComponent = currentTemplate === 'layout'
    ? <LayoutDiagramEditorLazy />
    : currentTemplate === 'site'
      ? <SiteDiagramEditorLazy />
      : currentTemplate === 'env'
        ? <EnvironmentDiagramEditorLazy />
        : <SunDiagramEditorLazy />;

  const accent = currentTemplate === 'layout' ? '#ffb74d'
    : currentTemplate === 'site' ? '#4dd0e1'
    : currentTemplate === 'env' ? '#80cbc4'
    : '#aed581';

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: accent, mb: 2 }} />
          <Typography color="text.secondary">Loading S.Diagram...</Typography>
        </Box>
      }>
        {dsdShellMode === 'editor' ? editorComponent : isGlobal ? (
          <DsdGlobalDashboardLazy
            items={data?.diagramItems || []}
            projectItems={data?.items || []}
            isInitializing={isInitializing}
            onOpenDiagram={handleOpenDiagram}
            onSelectDiagram={handleSelectDiagram}
            onDeleteDiagram={handleDeleteDiagram}
          />
        ) : (
          <DsdDashboardLazy
            items={data?.items || []}
            diagramItems={data?.diagramItems || []}
            isInitializing={isInitializing}
            onDeleteItem={handleDeleteItem}
            onDeleteDiagram={handleDeleteDiagram}
            onOpenDiagram={handleOpenDiagram}
            onSelectDiagram={handleSelectDiagram}
          />
        )}
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// 3DSR — Drawing (図面管理) Adapter
// projects/{projectId}/workFiles から appScope='3dsr' の図面/セットを購読する
// ──────────────────────────────────────────────────────────────────────────────
const useDsrLibraryService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], sets: [] });

  useEffect(() => {
    if (!payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(
      collection(db, path),
      where('appScope', '==', '3dsr'),
      limit(500),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);

      // Split into drawing files and drawing sets (folders)
      const sets  = allItems.filter((item: any) => item.type === 'drawing-set');
      const items = allItems.filter((item: any) => item.type === 'drawing-file');

      setData({ status: 'ready', items, sets });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDsrLibraryService] snapshot error', err);
      setData({ status: 'error', items: [], sets: [] });
      setIsInitializing(false);
    });

    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

const DSR_GLOBAL_SCOPES = ['global_drawings', 'global_projects', 'my_public_drawings', 'my_private_drawings'];

// ──────────────────────────────────────────────────────────────────────────────
// 3DSR グローバル図面サービス
// collectionGroup('workFiles') を appScope='3dsr' + visibility で購読（3DSD と同パターン）。
// type フィルターはクライアント側で実施し、drawing-file / drawing-set に分割する。
// ──────────────────────────────────────────────────────────────────────────────
const useGlobalDrawingsService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], sets: [] });

  useEffect(() => {
    const validScopes = ['global_drawings', 'my_public_drawings', 'my_private_drawings'];
    if (!validScopes.includes(scope)) { setIsInitializing(false); return; }

    let unsubscribe: any;
    const wfGroup = collectionGroup(db, 'workFiles');
    let q: any;

    if (scope === 'global_drawings') {
      q = query(wfGroup, where('appScope', '==', '3dsr'), where('visibility', '==', 'public'), limit(120));
    } else if (scope === 'my_public_drawings') {
      if (!user?.uid) { setData({ status: 'ready', items: [], sets: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsr'), where('visibility', '==', 'public'), where('createdBy', '==', user.uid), limit(120));
    } else if (scope === 'my_private_drawings') {
      if (!user?.uid) { setData({ status: 'ready', items: [], sets: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsr'), where('createdBy', '==', user.uid), limit(200));
    }

    if (!q) { setIsInitializing(false); return; }

    unsubscribe = onSnapshot(q, (snapshot: any) => {
      let all = snapshot.docs.map((d: any) => ({
        id: d.id,
        projectId: d.ref.parent.parent?.id,
        ...d.data(),
      })).filter((item: any) => item.status !== 'archived' && item.isArchived !== true);

      // Private: visibility が private か未設定（旧データ）に絞る
      if (scope === 'my_private_drawings') {
        all = all.filter((item: any) => !item.visibility || item.visibility === 'private');
      }

      const sets = all.filter((item: any) => item.type === 'drawing-set');
      const items = all.filter((item: any) => item.type === 'drawing-file');
      setData({ status: 'ready', items, sets });
      setIsInitializing(false);
    }, (err: any) => {
      console.error(`[useGlobalDrawingsService] Error for scope ${scope}:`, err);
      setData({ status: 'error', items: [], sets: [] });
      setIsInitializing(false);
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

const useDsrService = (payload?: AdapterContext) => {
  const dsrScope = useAppStore(s => s.dsrScope);
  const isGlobalDrawings = ['global_drawings', 'my_public_drawings', 'my_private_drawings'].includes(dsrScope);
  const isGlobalProjects = dsrScope === 'global_projects';
  const isGlobal = DSR_GLOBAL_SCOPES.includes(dsrScope);

  const projectService = useDsrLibraryService(!isGlobal && payload ? payload : undefined);
  const globalDrawingsService = useGlobalDrawingsService(isGlobalDrawings ? dsrScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalDrawings) return globalDrawingsService;
  if (isGlobalProjects) return { isInitializing: globalProjectsService.isInitializing, data: { ...globalProjectsService.data, items: [], sets: [], projects: globalProjectsService.data.items } };
  return projectService;
};

// @ts-ignore
const DsrDashboardLazy = React.lazy(() => import('../../../features/dsr/DsrDashboard').then(m => ({ default: m.DsrDashboard })));

export const DsrAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dsrScope = useAppStore(s => s.dsrScope);
  const { isInitializing, data } = useDsrService(payload);
  const isGlobal = DSR_GLOBAL_SCOPES.includes(dsrScope);

  const handleDeleteItem = useCallback(async (item: any) => {
    if (!payload?.projectId) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(firestoreDb, `projects/${payload.projectId}/workFiles`, item.id));
      // Best-effort: remove the backing storage object if present
      if (item.storagePath) {
        try {
          const { ref, deleteObject } = await import('firebase/storage');
          const { storage } = await import('../../../lib/firebase/client');
          await deleteObject(ref(storage, item.storagePath));
        } catch (e) {
          console.warn('[DsrAdapter] Storage object delete skipped', e);
        }
      }
    } catch (e) {
      console.error('[DsrAdapter] Delete drawing failed', e);
    }
  }, [payload?.projectId]);

  const handleSelectItem = useCallback((item: any) => {
    const workspaceId = payload?.workspaceId ?? 'drawing';
    useAppStore.getState().setPanelSelection(workspaceId, item);
  }, [payload?.workspaceId]);

  const handleOpenProject = useCallback((project: any) => {
    if (!project?.id) return;
    useAppStore.getState().setActiveProjectId(project.id);
    useAppStore.getState().setDsrScope('project_drawings');
    useAppStore.getState().setActiveWorkspaceId('drawing');
  }, []);

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#4db6ac', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Drawing...</Typography>
        </Box>
      }>
        <DsrDashboardLazy
          payload={payload}
          drawings={data?.items || []}
          sets={data?.sets || []}
          projects={data?.projects || null}
          isInitializing={isInitializing}
          isGlobal={isGlobal}
          onDeleteItem={handleDeleteItem}
          onSelectItem={handleSelectItem}
          onOpenProject={handleOpenProject}
        />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// 3DSI — Image (画像・動画管理) Adapter
// projects/{projectId}/workFiles から appScope='3dsi' の画像/動画/セットを購読する
// （手動アップロード + S.Layout / AI Render からの参照インデックスを束ねる）
// ──────────────────────────────────────────────────────────────────────────────
const useDsiLibraryService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], sets: [] });

  useEffect(() => {
    if (!payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(
      collection(db, path),
      where('appScope', '==', '3dsi'),
      limit(500),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);

      const sets  = allItems.filter((item: any) => item.type === 'image-set');
      const items = allItems.filter((item: any) => item.type === 'image-file');

      setData({ status: 'ready', items, sets });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDsiLibraryService] snapshot error', err);
      setData({ status: 'error', items: [], sets: [] });
      setIsInitializing(false);
    });

    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

const DSI_GLOBAL_SCOPES = ['global_images', 'global_projects', 'my_public_images', 'my_private_images'];

// ──────────────────────────────────────────────────────────────────────────────
// 3DSI グローバル画像サービス（3DSR と同パターン）。
// collectionGroup('workFiles') を appScope='3dsi' + visibility で購読。
// さらに、SEKKEIYA Drive と表示を揃えるため、ユーザーのグローバル資産（collection('assets')）
// にある画像/AIレンダーもマージする。AI Render や「放り込み」はプロジェクト無しだと assets 側にしか
// 保存されず workFiles に出ないため（Drive には出るのに S.Image が空になる問題への対処）。
// ──────────────────────────────────────────────────────────────────────────────

/** http(s) の正規 URL だけ通す（ローカルパスの 404 サムネを描画しない）。 */
function httpUrlOnly(u: any): string | undefined {
  const s = typeof u === 'string' ? u.trim() : '';
  return /^https?:\/\//i.test(s) ? s : undefined;
}

/** Drive のグローバル資産ドキュメントを S.Image の image-file アイテム形へ正規化する。
 *  画像（type==='image'）のみ対象。動画・3Dモデル等は S.Image の担当外なので null を返す。 */
function assetDocToImageItem(id: string, data: any): any | null {
  const type = String(data?.type || '').toLowerCase();
  if (type !== 'image') return null; // render/texture は publishToDrive で type='image'
  const url = httpUrlOnly(data.storageUrl) || httpUrlOnly(data.imageUrl) || httpUrlOnly(data.thumbnailUrl);
  if (!url) return null; // 表示できる本体 URL が無いものは出さない
  const kind = String(data?.metadata?.kind || '').toLowerCase();
  const tags: string[] = Array.isArray(data.tags) ? data.tags : [];
  // カテゴリ（DsiCategory）を kind / タグから決定。
  const category =
    kind === 'texture' || tags.includes('テクスチャ') ? 'テクスチャ'
    : kind === 'render' || tags.includes('ai-render') || tags.includes('AIレンダー') ? 'AIレンダー'
    : '静止画';
  return {
    id,
    projectId: data.projectId ?? null,
    type: 'image-file',
    name: data.name || data.title || 'Untitled',
    title: data.name || data.title || 'Untitled',
    category,
    mediaType: 'image',
    downloadUrl: url,
    thumbnailUrl: httpUrlOnly(data.thumbnailUrl) || httpUrlOnly(data.imageUrl) || url,
    tags,
    ownerId: data.ownerId,
    createdBy: data.ownerId,
    visibility: data.visibility,
    // 実体は Drive 資産（assets）を指す参照扱い。削除時に元 Storage を消さないよう storagePath は持たせない。
    sourceType: 'ai-render',
    sourceCollection: data.sourceCollection || (data.projectId ? 'assets' : 'global_assets'),
    isDeleted: data.isDeleted === true,
    createdAt: data.createdAt,
  };
}

const useGlobalImagesService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], sets: [] });

  useEffect(() => {
    const validScopes = ['global_images', 'my_public_images', 'my_private_images'];
    if (!validScopes.includes(scope)) { setIsInitializing(false); return; }

    const wfGroup = collectionGroup(db, 'workFiles');
    let q: any;

    if (scope === 'global_images') {
      q = query(wfGroup, where('appScope', '==', '3dsi'), where('visibility', '==', 'public'), limit(120));
    } else if (scope === 'my_public_images') {
      if (!user?.uid) { setData({ status: 'ready', items: [], sets: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsi'), where('visibility', '==', 'public'), where('createdBy', '==', user.uid), limit(120));
    } else if (scope === 'my_private_images') {
      if (!user?.uid) { setData({ status: 'ready', items: [], sets: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsi'), where('createdBy', '==', user.uid), limit(200));
    }

    if (!q) { setIsInitializing(false); return; }

    const unsubs: any[] = [];
    // workFiles と assets の 2 系統を別々に保持し、届くたびに結合して反映する。
    let wfDocs: any[] = [];
    let assetDocs: any[] = [];
    let wfReady = false;
    let assetReady = false;

    const emit = () => {
      // 結合。workFiles を優先し、同一画像（downloadUrl 一致）の assets 重複は落とす
      //（プロジェクトを開いて生成した分は workFiles にリンク済みのため二重表示を防ぐ）。
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const it of [...wfDocs, ...assetDocs]) {
        const key = it.downloadUrl || it.id;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(it);
      }
      const sets = merged.filter((item: any) => item.type === 'image-set');
      const items = merged.filter((item: any) => item.type === 'image-file');
      setData({ status: 'ready', items, sets });
      if (wfReady && (assetReady || !(scope === 'my_public_images' || scope === 'my_private_images'))) {
        setIsInitializing(false);
      }
    };

    // 1) workFiles（従来）
    unsubs.push(onSnapshot(q, (snapshot: any) => {
      let all = snapshot.docs.map((d: any) => ({
        id: d.id,
        projectId: d.ref.parent.parent?.id,
        ...d.data(),
      })).filter((item: any) => item.status !== 'archived' && item.isArchived !== true);

      if (scope === 'my_private_images') {
        all = all.filter((item: any) => !item.visibility || item.visibility === 'private');
      }
      wfDocs = all;
      wfReady = true;
      emit();
    }, (err: any) => {
      console.error(`[useGlobalImagesService] workFiles error for scope ${scope}:`, err);
      wfReady = true;
      emit();
    }));

    // 2) グローバル資産（assets）— 自分のライブラリ（Private/Public Image）のみマージ。
    //    「みんなの公開（global_images）」は全ユーザー横断のため対象外（従来どおり workFiles のみ）。
    if ((scope === 'my_public_images' || scope === 'my_private_images') && user?.uid) {
      const qAssets = query(collection(db, 'assets'), where('ownerId', '==', user.uid), limit(400));
      unsubs.push(onSnapshot(qAssets, (snapshot: any) => {
        const arr = snapshot.docs
          .map((d: any) => assetDocToImageItem(d.id, d.data()))
          .filter((it: any) => it && !it.isDeleted)
          .filter((it: any) => scope === 'my_public_images'
            ? it.visibility === 'public'
            : (!it.visibility || it.visibility === 'private'));
        assetDocs = arr;
        assetReady = true;
        emit();
      }, (err: any) => {
        console.error(`[useGlobalImagesService] assets error for scope ${scope}:`, err);
        assetReady = true;
        emit();
      }));
    } else {
      assetReady = true;
    }

    return () => { unsubs.forEach((u) => { try { u?.(); } catch { /* noop */ } }); };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

// ──────────────────────────────────────────────────────────────────────────────
// 3DSI ローカル素材サービス。
// %USERPROFILE%\SEKKEIYA\LocalAssets\Images|Movies を Tauri コマンドで走査し、
// asset:// で表示できる読み取り専用の一覧を返す（Firestore 非依存・プロジェクト非依存）。
// ──────────────────────────────────────────────────────────────────────────────
const useLocalImagesService = (active: boolean) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [], sets: [] });
  // ソース（参照フォルダ）の追加・削除・トグルで再走査するためのキー。
  const reloadKey = useImageSourcesStore((s) => s.reloadKey);

  useEffect(() => {
    if (!active) { setIsInitializing(false); return; }

    let cancelled = false;
    setIsInitializing(true);

    (async () => {
      try {
        const { invoke, convertFileSrc, isTauri } = await import('@tauri-apps/api/core');
        if (!isTauri()) {
          if (!cancelled) {
            setData({ status: 'ready', items: [], sets: [] });
            setIsInitializing(false);
          }
          return;
        }
        const rawAssets: any[] = await invoke('list_local_image_assets');
        // S.Image は静止画・テクスチャのみ扱う。動画(Movies 配下含む)は S.Movie の担当なので除外。
        // ※Rust の list_local_image_assets 自体は S.Movie 等が動画取得に使うため据え置き、ここで絞る。
        const assets = rawAssets.filter((a) => a.mediaType !== 'video');
        console.log('[useLocalImagesService] found', assets.length, 'image assets (videos excluded)');
        const items = assets.map((a) => {
          const src = convertFileSrc(String(a.path).replace(/\\/g, '/'));
          return {
            id: a.id,
            title: a.name,
            name: a.name,
            mediaType: a.mediaType,
            category: a.mediaType === 'video'
              ? '動画'
              : String(a.subfolder || '').split(/[/\\]/)[0] === 'テクスチャ'
                ? 'テクスチャ'
                : '静止画',
            downloadUrl: src,
            thumbnailUrl: a.mediaType === 'image' ? src : undefined,
            isLocal: true,
            localPath: a.path,
            sizeBytes: a.sizeBytes,
            subfolder: a.subfolder,
            sourceId: a.sourceId || 'default',
            sourceLabel: a.sourceLabel || '',
          };
        });
        if (!cancelled) {
          // ソース別の枚数＋サブフォルダ別の枚数をストアへ反映（サイドバーのバッジ／フォルダツリー用）。
          const counts: Record<string, number> = {};
          // sourceId → サブフォルダ相対パス → 直下の件数。
          const subCounts: Record<string, Record<string, number>> = {};
          for (const it of items) {
            counts[it.sourceId] = (counts[it.sourceId] || 0) + 1;
            const sub = String(it.subfolder || '');
            if (!subCounts[it.sourceId]) subCounts[it.sourceId] = {};
            subCounts[it.sourceId][sub] = (subCounts[it.sourceId][sub] || 0) + 1;
          }
          // テクスチャは Base/Normal/Rough/AO の4枚で1マテリアル(=1セット)。フォルダツリーの
          // 件数を「セット数」で見せるため、テクスチャ画像をマテリアル単位に束ねてサブフォルダ別に集計する。
          const manualSets = useTextureSetStore.getState().sets;
          const textureImages = items.filter((it) => it.category === 'テクスチャ');
          const setCounts: Record<string, Record<string, number>> = {};
          for (const g of buildTextureGroups(textureImages, manualSets)) {
            const cover = g.items[0] || g.cover;
            const srcId = cover?.sourceId || 'default';
            const sub = String(cover?.subfolder || '');
            if (!setCounts[srcId]) setCounts[srcId] = {};
            setCounts[srcId][sub] = (setCounts[srcId][sub] || 0) + 1;
          }
          const imgStore = useImageSourcesStore.getState();
          imgStore.setCounts(counts);
          imgStore.setSubfolderCounts(subCounts);
          imgStore.setSubfolderSetCounts(setCounts);
          setData({ status: 'ready', items, sets: [] });
          setIsInitializing(false);
        }
      } catch (e) {
        console.error('[useLocalImagesService] failed to list local assets', e);
        if (!cancelled) {
          setData({ status: 'error', items: [], sets: [], error: String(e) });
          setIsInitializing(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [active, reloadKey]);

  return { isInitializing, data };
};

const useDsiService = (payload?: AdapterContext) => {
  const dsiScope = useAppStore(s => s.dsiScope);
  const isGlobalImages = ['global_images', 'my_public_images', 'my_private_images'].includes(dsiScope);
  const isGlobalProjects = dsiScope === 'global_projects';
  const isLocal = dsiScope === 'local_assets';
  const isGlobal = DSI_GLOBAL_SCOPES.includes(dsiScope);

  const projectService = useDsiLibraryService(!isGlobal && !isLocal && payload ? payload : undefined);
  const globalImagesService = useGlobalImagesService(isGlobalImages ? dsiScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');
  const localImagesService = useLocalImagesService(isLocal);

  if (isLocal) return localImagesService;
  if (isGlobalImages) return globalImagesService;
  if (isGlobalProjects) return { isInitializing: globalProjectsService.isInitializing, data: { ...globalProjectsService.data, items: [], sets: [], projects: globalProjectsService.data.items } };
  return projectService;
};

// @ts-ignore
const DsiDashboardLazy = React.lazy(() => import('../../../features/dsi/DsiDashboard').then(m => ({ default: m.DsiDashboard })));
const DsiEditorLazy = React.lazy(() => import('../../../features/dsi/DsiEditor').then(m => ({ default: m.DsiEditor })));

export const DsiAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dsiScope = useAppStore(s => s.dsiScope);
  const dsiShellMode = useAppStore(s => s.dsiShellMode);
  const setDsiShellMode = useAppStore(s => s.setDsiShellMode);
  const { isInitializing, data } = useDsiService(payload);
  const isGlobal = DSI_GLOBAL_SCOPES.includes(dsiScope);
  const isLocal = dsiScope === 'local_assets';
  // エディターの保存先。プロジェクトスコープは payload、横断ビュー（Private/Public Image）は
  // 開いた画像の projectId をエディターストアに保持している。ローカル素材は保存先が無いので不可。
  const editTargetProjectId = useDsiEditorStore((s) => s.targetProjectId);
  const canEdit = !isLocal && (!!payload?.projectId || !!editTargetProjectId);
  useEffect(() => {
    if (dsiShellMode === 'editor' && !canEdit) setDsiShellMode('dashboard');
  }, [dsiShellMode, canEdit, setDsiShellMode]);

  const handleDeleteItem = useCallback(async (item: any) => {
    if (!payload?.projectId) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(firestoreDb, `projects/${payload.projectId}/workFiles`, item.id));
      // 手動アップロードの実体のみ削除（参照リンクは元 Storage を守る）
      if (item.storagePath && item.sourceType !== 'layout-render' && item.sourceType !== 'ai-render') {
        try {
          const { ref, deleteObject } = await import('firebase/storage');
          const { storage } = await import('../../../lib/firebase/client');
          await deleteObject(ref(storage, item.storagePath));
        } catch (e) {
          console.warn('[DsiAdapter] Storage object delete skipped', e);
        }
      }
    } catch (e) {
      console.error('[DsiAdapter] Delete image failed', e);
    }
  }, [payload?.projectId]);

  const handleSelectItem = useCallback((item: any) => {
    const workspaceId = payload?.workspaceId ?? 'image';
    useAppStore.getState().setPanelSelection(workspaceId, item);
  }, [payload?.workspaceId]);

  const handleOpenProject = useCallback((project: any) => {
    if (!project?.id) return;
    useAppStore.getState().setActiveProjectId(project.id);
    useAppStore.getState().setDsiScope('project_images');
    useAppStore.getState().setActiveWorkspaceId('image');
  }, []);

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#ec407a', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Image...</Typography>
        </Box>
      }>
        {dsiShellMode === 'editor' && canEdit ? (
          <DsiEditorLazy payload={payload} onBack={() => setDsiShellMode('dashboard')} />
        ) : (
          <DsiDashboardLazy
            payload={payload}
            images={data?.items || []}
            sets={data?.sets || []}
            projects={data?.projects || null}
            isInitializing={isInitializing}
            isGlobal={isGlobal}
            isLocal={isLocal}
            localError={isLocal ? data?.error : undefined}
            onDeleteItem={handleDeleteItem}
            onSelectItem={handleSelectItem}
            onOpenProject={handleOpenProject}
          />
        )}
      </React.Suspense>
    </Box>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// 3DSQ — S.Quest（建築・インテリア向け学習プラットフォーム）Adapter
// projects/{projectId}/workFiles から appScope='3dsq' / type='course' のコースを購読する。
// グローバルスコープは collectionGroup('workFiles') を appScope='3dsq' + visibility で購読。
// MVP は閲覧専用カタログ（作成・受講登録は今後のフェーズ）。
// ──────────────────────────────────────────────────────────────────────────────
const useDsqLibraryService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    if (!payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(
      collection(db, path),
      where('appScope', '==', '3dsq'),
      limit(500),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true)
        .filter((item: any) => item.type === 'course');

      setData({ status: 'ready', items });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDsqLibraryService] snapshot error', err);
      setData({ status: 'error', items: [] });
      setIsInitializing(false);
    });

    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

const DSQ_GLOBAL_SCOPES = ['global_courses', 'global_projects', 'my_public_courses', 'my_private_courses'];

const useGlobalCoursesService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    const validScopes = ['global_courses', 'my_public_courses', 'my_private_courses'];
    if (!validScopes.includes(scope)) { setIsInitializing(false); return; }

    let unsubscribe: any;
    const wfGroup = collectionGroup(db, 'workFiles');
    let q: any;

    if (scope === 'global_courses') {
      q = query(wfGroup, where('appScope', '==', '3dsq'), where('visibility', '==', 'public'), limit(120));
    } else if (scope === 'my_public_courses') {
      if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsq'), where('visibility', '==', 'public'), where('createdBy', '==', user.uid), limit(120));
    } else if (scope === 'my_private_courses') {
      if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsq'), where('createdBy', '==', user.uid), limit(200));
    }

    if (!q) { setIsInitializing(false); return; }

    unsubscribe = onSnapshot(q, (snapshot: any) => {
      let all = snapshot.docs.map((d: any) => ({
        id: d.id,
        projectId: d.ref.parent.parent?.id,
        ...d.data(),
      })).filter((item: any) => item.status !== 'archived' && item.isArchived !== true && item.type === 'course');

      if (scope === 'my_private_courses') {
        all = all.filter((item: any) => !item.visibility || item.visibility === 'private');
      }

      setData({ status: 'ready', items: all });
      setIsInitializing(false);
    }, (err: any) => {
      console.error(`[useGlobalCoursesService] Error for scope ${scope}:`, err);
      setData({ status: 'error', items: [] });
      setIsInitializing(false);
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

const useDsqService = (payload?: AdapterContext) => {
  const dsqScope = useAppStore(s => s.dsqScope);
  const isGlobalCourses = ['global_courses', 'my_public_courses', 'my_private_courses'].includes(dsqScope);
  const isGlobalProjects = dsqScope === 'global_projects';
  const isGlobal = DSQ_GLOBAL_SCOPES.includes(dsqScope);

  const projectService = useDsqLibraryService(!isGlobal && payload ? payload : undefined);
  const globalCoursesService = useGlobalCoursesService(isGlobalCourses ? dsqScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalCourses) return globalCoursesService;
  if (isGlobalProjects) return { isInitializing: globalProjectsService.isInitializing, data: { ...globalProjectsService.data, items: [], projects: globalProjectsService.data.items } };
  return projectService;
};

// @ts-ignore
const DsqDashboardLazy = React.lazy(() => import('../../../features/dsq/DsqDashboard').then(m => ({ default: m.DsqDashboard })));

export const DsqAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dsqScope = useAppStore(s => s.dsqScope);
  const { isInitializing, data } = useDsqService(payload);
  const isGlobal = DSQ_GLOBAL_SCOPES.includes(dsqScope);

  const handleSelectItem = useCallback((item: any) => {
    const workspaceId = payload?.workspaceId ?? 'quest';
    useAppStore.getState().setPanelSelection(workspaceId, item);
  }, [payload?.workspaceId]);

  const handleOpenProject = useCallback((project: any) => {
    if (!project?.id) return;
    useAppStore.getState().setActiveProjectId(project.id);
    useAppStore.getState().setDsqScope('project_courses');
    useAppStore.getState().setActiveWorkspaceId('quest');
  }, []);

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#5c6bc0', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Quest...</Typography>
        </Box>
      }>
        <DsqDashboardLazy
          payload={payload}
          courses={data?.items || []}
          projects={data?.projects || null}
          isInitializing={isInitializing}
          isGlobal={isGlobal}
          onSelectItem={handleSelectItem}
          onOpenProject={handleOpenProject}
        />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// 3DSF — Portfolio (ポートフォリオ管理) Adapter
// projects/{projectId}/workFiles から appScope='3dsf' の portfolio を購読する
// ──────────────────────────────────────────────────────────────────────────────
const useDsfLibraryService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    if (!payload?.projectId) {
      setIsInitializing(false);
      return;
    }

    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(
      collection(db, path),
      where('appScope', '==', '3dsf'),
      limit(500),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true && item.type === 'portfolio');

      setData({ status: 'ready', items });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDsfLibraryService] snapshot error', err);
      setData({ status: 'error', items: [] });
      setIsInitializing(false);
    });

    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

const DSF_GLOBAL_SCOPES = ['global_portfolios', 'global_projects', 'my_public_portfolios', 'my_private_portfolios'];

// ──────────────────────────────────────────────────────────────────────────────
// 3DSF グローバルポートフォリオサービス（3DSR と同パターン）。
// collectionGroup('workFiles') を appScope='3dsf' + visibility で購読。
// ──────────────────────────────────────────────────────────────────────────────
const useGlobalPortfoliosService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    const validScopes = ['global_portfolios', 'my_public_portfolios', 'my_private_portfolios'];
    if (!validScopes.includes(scope)) { setIsInitializing(false); return; }

    let unsubscribe: any;
    const wfGroup = collectionGroup(db, 'workFiles');
    let q: any;

    if (scope === 'global_portfolios') {
      q = query(wfGroup, where('appScope', '==', '3dsf'), where('visibility', '==', 'public'), limit(120));
    } else if (scope === 'my_public_portfolios') {
      if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsf'), where('visibility', '==', 'public'), where('createdBy', '==', user.uid), limit(120));
    } else if (scope === 'my_private_portfolios') {
      if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
      q = query(wfGroup, where('appScope', '==', '3dsf'), where('createdBy', '==', user.uid), limit(200));
    }

    if (!q) { setIsInitializing(false); return; }

    unsubscribe = onSnapshot(q, (snapshot: any) => {
      let all = snapshot.docs.map((d: any) => ({
        id: d.id,
        projectId: d.ref.parent.parent?.id,
        ...d.data(),
      })).filter((item: any) => item.status !== 'archived' && item.isArchived !== true && item.type === 'portfolio');

      if (scope === 'my_private_portfolios') {
        all = all.filter((item: any) => !item.visibility || item.visibility === 'private');
      }

      setData({ status: 'ready', items: all });
      setIsInitializing(false);
    }, (err: any) => {
      console.error(`[useGlobalPortfoliosService] Error for scope ${scope}:`, err);
      setData({ status: 'error', items: [] });
      setIsInitializing(false);
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid]);

  return { isInitializing, data };
};

const useDsfService = (payload?: AdapterContext) => {
  const dsfScope = useAppStore(s => s.dsfScope);
  const isGlobalPortfolios = ['global_portfolios', 'my_public_portfolios', 'my_private_portfolios'].includes(dsfScope);
  const isGlobalProjects = dsfScope === 'global_projects';
  const isGlobal = DSF_GLOBAL_SCOPES.includes(dsfScope);

  const projectService = useDsfLibraryService(!isGlobal && payload ? payload : undefined);
  const globalPortfoliosService = useGlobalPortfoliosService(isGlobalPortfolios ? dsfScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalPortfolios) return globalPortfoliosService;
  if (isGlobalProjects) return { isInitializing: globalProjectsService.isInitializing, data: { ...globalProjectsService.data, items: [], projects: globalProjectsService.data.items } };
  return projectService;
};

// @ts-ignore
const DsfDashboardLazy = React.lazy(() => import('../../../features/dsf/DsfDashboard').then(m => ({ default: m.DsfDashboard })));

export const DsfAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dsfScope = useAppStore(s => s.dsfScope);
  const { isInitializing, data } = useDsfService(payload);
  const isGlobal = DSF_GLOBAL_SCOPES.includes(dsfScope);

  const handleSelectItem = useCallback((item: any) => {
    const workspaceId = payload?.workspaceId ?? 'portfolio';
    useAppStore.getState().setPanelSelection(workspaceId, item);
  }, [payload?.workspaceId]);

  const handleOpenProject = useCallback((project: any) => {
    if (!project?.id) return;
    useAppStore.getState().setActiveProjectId(project.id);
    useAppStore.getState().setDsfScope('project_portfolios');
    useAppStore.getState().setActiveWorkspaceId('portfolio');
  }, []);

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#7e57c2', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Portfolio...</Typography>
        </Box>
      }>
        <DsfDashboardLazy
          payload={payload}
          portfolios={data?.items || []}
          projects={data?.projects || null}
          isInitializing={isInitializing}
          isGlobal={isGlobal}
          onSelectItem={handleSelectItem}
          onOpenProject={handleOpenProject}
        />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// S.Library (3DSK) — ローカル専用ナレッジベース。
// Firestore は使わず、Tauri 経由で %USERPROFILE%\SEKKEIYA\3DSK の _index.json を読む。
// データ取得は DskDashboard 内の useDskStore が担うため、アダプタは描画だけを行う。
// @ts-ignore
const DskDashboardLazy = React.lazy(() => import('../../../features/dsk/DskDashboard').then(m => ({ default: m.DskDashboard })));

export const DskAdapter: React.FC<AdapterProps> = ({ payload }) => {
  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#26a69a', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Library...</Typography>
        </Box>
      }>
        <DskDashboardLazy payload={payload} />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// S.Blog (3DSB) — ブログ執筆ハブ。記事プールは Firestore（users/{uid}/blogArticles）。
// 保存時に①ナレッジ②公開サイトへ dual-publish する設計（Phase 2 以降）。
// データ取得は DsbDashboard 内の useDsbStore が担うため、アダプタは描画だけを行う。
// @ts-ignore
const DsbDashboardLazy = React.lazy(() => import('../../../features/dsb/DsbDashboard').then(m => ({ default: m.DsbDashboard })));
// 公式ブログモード（管理者が Admin トグルで切替）。データは officialArticles（別ストア）。
// @ts-ignore
const OfficialBlogDashboardLazy = React.lazy(() => import('../../../features/dsb/OfficialBlogDashboard').then(m => ({ default: m.OfficialBlogDashboard })));

export const DsbAdapter: React.FC<AdapterProps> = ({ payload }) => {
  // blogScope はシェル共通の状態（useDsbStore）。'official' のときだけ公式ダッシュボードを描画。
  const blogScope = useDsbStore((s) => s.blogScope);
  // 全幅ヘッダー化レイアウト（デスクトップのみ）: DsbDashboard はビューごとにヘッダーが異なるため
  // ダッシュボード側ではなくアダプタ側で左サイドバーを行として埋め込む（公式/通常の両モードをカバー）。
  const isMobile = useMediaQuery('(max-width:768px)');
  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* 全幅ヘッダーバンド（デスクトップのみ。編集モードでは自身が null を返す） */}
      {!isMobile && <DsbHeaderBar />}
      {/* 左サイドバー | ダッシュボード の 2 ゾーン行（サイドバーはストア駆動で自己サイズ調整） */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {!isMobile && <DsbSidebar />}
        <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <React.Suspense fallback={
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
              <CircularProgress sx={{ color: blogScope === 'official' ? 'light-dark(#0676a8, #38bdf8)' : 'light-dark(#921b1b, #e57373)', mb: 2 }} />
              <Typography color="text.secondary">Loading S.Blog...</Typography>
            </Box>
          }>
            {blogScope === 'official' ? <OfficialBlogDashboardLazy /> : <DsbDashboardLazy payload={payload} />}
          </React.Suspense>
        </Box>
      </Box>
    </Box>
  );
};

// -------------------------------------------------------------
// S.Movie (3DSM) — カットシーケンス + 自動編集エンジン（docs/14）。
// シーケンスはローカルドラフト（useDsmStore）、素材は LocalAssets/Movies。
// Firestore は使わないため、アダプタは描画だけを行う。
// @ts-ignore
const DsmDashboardLazy = React.lazy(() => import('../../../features/dsm/DsmDashboard').then(m => ({ default: m.DsmDashboard })));

export const DsmAdapter: React.FC<AdapterProps> = ({ payload }) => {
  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#C98A4B', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Movie...</Typography>
        </Box>
      }>
        <DsmDashboardLazy payload={payload} />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// S.Material (3DSMT) — マテリアル管理。
// 素材は projects/{projectId}/workFiles に appScope='3dsmt' で保存（S.Image/S.Create と同パターン）。
// global/public/private は collectionGroup('workFiles')、global_projects は既存サービスを再利用。
// @ts-ignore
const DsmtDashboardLazy = React.lazy(() => import('../../../features/dsmt/DsmtDashboard').then(m => ({ default: m.DsmtDashboard })));

/** プロジェクトスコープの素材（projects/{projectId}/workFiles, appScope='3dsmt'）。 */
const useDsmtProjectService = (payload?: AdapterContext) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    if (!payload?.projectId) { setIsInitializing(false); return; }
    const path = `projects/${payload.projectId}/workFiles`;
    const q = query(collection(db, path), where('appScope', '==', '3dsmt'), limit(200));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);
      setData({ status: 'ready', items });
      setIsInitializing(false);
    }, (err) => {
      console.error('[useDsmtProjectService] snapshot error', err);
      setData({ status: 'error', items: [] });
      setIsInitializing(false);
    });
    return () => unsub();
  }, [payload?.projectId]);

  return { isInitializing, data };
};

/**
 * global_materials（全公開 / フォロー中公開を dsmtGlobalFilter で切替）
 * / my_public_materials / my_private_materials。
 * クエリのフィールド構成は S.Slide(3dsp) と同一のため既存の複合 index を再利用する。
 */
const useGlobalMaterialsService = (scope: string) => {
  const user = useAuthStore(s => s.currentUser);
  const dsmtGlobalFilter = useAppStore(s => s.dsmtGlobalFilter);
  const [isInitializing, setIsInitializing] = useState(true);
  const [data, setData] = useState<any>({ status: 'initializing', items: [] });

  useEffect(() => {
    const valid = ['global_materials', 'my_public_materials', 'my_private_materials'];
    if (!valid.includes(scope)) { setIsInitializing(false); return; }

    let unsubscribe: any;
    let isActive = true;
    const wfGroup = collectionGroup(db, 'workFiles');

    const setup = async () => {
      let q: any;

      if (scope === 'global_materials') {
        if (dsmtGlobalFilter === 'following' && user?.uid) {
          // フォロー中ユーザーの公開マテリアルのみ
          try {
            const followingSnap = await getDocs(collection(db, `users/${user.uid}/following`));
            if (!isActive) return;
            const ids = followingSnap.docs.map((d) => d.id);
            if (ids.length === 0) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
            q = query(wfGroup, where('appScope', '==', '3dsmt'), where('visibility', '==', 'public'), where('createdBy', 'in', ids.slice(0, 30)), limit(80));
          } catch {
            q = query(wfGroup, where('appScope', '==', '3dsmt'), where('visibility', '==', 'public'), limit(80));
          }
        } else {
          // 全ユーザーの公開マテリアル
          q = query(wfGroup, where('appScope', '==', '3dsmt'), where('visibility', '==', 'public'), limit(80));
        }
      } else if (scope === 'my_public_materials') {
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        q = query(wfGroup, where('appScope', '==', '3dsmt'), where('visibility', '==', 'public'), where('createdBy', '==', user.uid), limit(100));
      } else if (scope === 'my_private_materials') {
        if (!user?.uid) { setData({ status: 'ready', items: [] }); setIsInitializing(false); return; }
        // visibility はクライアントフィルタ（旧データ=未設定も private 扱い）
        q = query(wfGroup, where('appScope', '==', '3dsmt'), where('createdBy', '==', user.uid), limit(100));
      }

      if (!q) { setIsInitializing(false); return; }

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        let items = snapshot.docs
          .map((d: any) => ({ id: d.id, projectId: d.ref.parent.parent?.id, ...d.data() }))
          .filter((item: any) => item.status !== 'archived' && item.isArchived !== true);
        if (scope === 'my_private_materials') {
          items = items.filter((item: any) => !item.visibility || item.visibility === 'private');
        }
        setData({ status: 'ready', items });
        setIsInitializing(false);
      }, (err: any) => {
        console.error(`[useGlobalMaterialsService] Error for scope ${scope}:`, err);
        setData({ status: 'error', items: [] });
        setIsInitializing(false);
      });
    };

    setup();
    return () => { isActive = false; if (unsubscribe) unsubscribe(); };
  }, [scope, user?.uid, dsmtGlobalFilter]);

  return { isInitializing, data };
};

/** dsmtScope に応じてグローバル/プロジェクト/ローカルへ振り分け。 */
const useDsmtService = (payload?: AdapterContext) => {
  const dsmtScope = useAppStore(s => s.dsmtScope);
  const isGlobalMaterials = ['global_materials', 'my_public_materials', 'my_private_materials'].includes(dsmtScope);
  const isGlobalProjects = dsmtScope === 'global_projects';
  const isLocal = dsmtScope === 'local_assets';
  const isGlobal = isGlobalMaterials || isGlobalProjects || isLocal;

  const projectService = useDsmtProjectService(!isGlobal && payload ? payload : undefined);
  const globalMaterialsService = useGlobalMaterialsService(isGlobalMaterials ? dsmtScope : '');
  const globalProjectsService = useGlobalProjectsService(isGlobalProjects ? 'global_projects' : '');

  if (isGlobalMaterials) return globalMaterialsService;
  if (isGlobalProjects) return globalProjectsService;
  // local_assets は Phase B で配線。現状は空。
  if (isLocal) return { isInitializing: false, data: { status: 'ready', items: [] } };
  return projectService;
};

export const DsmtAdapter: React.FC<AdapterProps> = ({ payload }) => {
  const dsmtScope = useAppStore(s => s.dsmtScope);
  const isGlobal = ['global_materials', 'my_public_materials', 'my_private_materials', 'global_projects', 'local_assets'].includes(dsmtScope);
  const isProjects = dsmtScope === 'global_projects';
  const { isInitializing, data } = useDsmtService(payload);

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#ec407a', mb: 2 }} />
          <Typography color="text.secondary">Loading S.Material...</Typography>
        </Box>
      }>
        <DsmtDashboardLazy
          payload={payload}
          materials={isProjects ? [] : (data?.items || [])}
          projects={isProjects ? (data?.items || []) : null}
          isInitializing={isInitializing}
          isGlobal={isGlobal}
        />
      </React.Suspense>
    </Box>
  );
};

// -------------------------------------------------------------
// @ts-ignore
const AiCanvasOverviewLazy = React.lazy(() => import('../../../features/ai-canvas/Overview/AiCanvasOverview').then(m => ({ default: m.AiCanvasOverview })));

export const AiCanvasAdapter: React.FC<AdapterProps> = ({ payload }) => {
  if (!payload || !payload.workspaceId || !payload.projectId) {
    return (
      <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', color: 'text.secondary' }}>
        <Typography variant="h5" color="text.primary">No Workspace Selected</Typography>
        <Typography variant="body1">Please select an AI Canvas workspace to continue.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', bgcolor: 'background.default' }}>
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress sx={{ color: '#9c27b0', mb: 2 }} />
          <Typography color="text.secondary">Loading AI Canvas Engine...</Typography>
        </Box>
      }>
        <AiCanvasOverviewLazy payload={payload} />
      </React.Suspense>
    </Box>
  );
};
