import { create } from 'zustand';
import { collection, query, where, onSnapshot, orderBy, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase/client';
import { uploadImageAndGetUrl } from '../lib/firebase/uploadImage';
import { useAppStore } from './useAppStore';

export type AIDriveScope = 'current_project' | 'my_library' | 'team_library' | 'all' | string;

/**
 * 端末固有のローカル参照（asset:// / C:\… / LocalAssets / asset.localhost 等）か判定。
 * これらは別端末やファイル削除後に 404 を出すため、表示用URLとしては使わない（undefined扱い）。
 */
function isLocalRef(u?: string | null): boolean {
  return !!u && (/^(asset|file|blob):/i.test(u) || /asset\.localhost|tauri\.localhost/.test(u)
    || /^[A-Za-z]:[\\/]/.test(u) || u.includes('LocalAssets') || /[\\/]SEKKEIYA[\\/]/.test(u));
}
/** ローカル参照なら undefined を返す（描画時に <img src> を出さず 404 を防ぐ）。 */
function cleanRemoteUrl(u?: string | null): string | undefined {
  return isLocalRef(u) ? undefined : (u ?? undefined);
}

export interface AIDriveAsset {
  id: string;
  projectId?: string;
  name: string;
  type: string;
  storageUrl?: string; // Replace dataUrl with storageUrl for cloud storage
  thumbnailUrl?: string; // For 3D models and files that have a separate thumbnail
  size?: number | string;
  tags?: string[];
  ownerId?: string;
  sharedUserIds?: string[];
  isTeamLibrary?: boolean;
  createdAt?: number; // timestamp
  updatedAt?: number; // timestamp
  memo?: string;
  sourceUrl?: string;
  rating?: number;
  sourceCollection?: 'assets' | 'workFiles' | string;
  isDeleted?: boolean;
  /** 公開可視性（'public' | 'private' など）。My Public/Private Folder の振り分けに使う。 */
  visibility?: string;
  /** 由来の子アプリ scope（例 '3dsl','3dsp'）。アウトプット種別の分類に使う。 */
  appScope?: string;
  /** テクスチャ等の「セット」アイテムが束ねる子ファイル数（セットでなければ undefined）。 */
  childCount?: number;
  /** セットが束ねる個々のファイル（インスペクタ表示用）。 */
  setMembers?: { name: string; url?: string; slot?: string | null }[];
}

export function resolveAssetPreviewUrl(asset: any): string | null {
  if (!asset) return null;
  return (
    asset.thumbnailUrl ||
    asset.previewUrl ||
    asset.imageUrl ||
    asset.downloadUrl ||
    asset.storageUrl ||
    asset.url ||
    asset.src ||
    asset.thumbUrl ||
    null
  );
}

// ── 大項目: SEKKEIYA のアウトプット種別（GALLERY の種別 + マテリアル/テクスチャ/記事） ──
export type OutputKind =
  | 'model' | 'layout' | 'presentation' | 'furniture' | 'diagram'
  | 'render' | 'video' | 'portfolio' | 'material' | 'texture' | 'article';

export const OUTPUT_KINDS: { key: OutputKind; label: string }[] = [
  { key: 'model', label: 'モデル' },
  { key: 'layout', label: 'レイアウト' },
  { key: 'presentation', label: 'プレゼン' },
  { key: 'furniture', label: '造作家具' },
  { key: 'diagram', label: 'ダイアグラム' },
  { key: 'render', label: '静止画パース' },
  { key: 'video', label: '動画' },
  { key: 'portfolio', label: 'ポートフォリオ' },
  { key: 'material', label: 'マテリアル' },
  { key: 'texture', label: 'テクスチャ' },
  { key: 'article', label: '記事' },
];

export const OUTPUT_KIND_LABEL: Record<OutputKind, string> =
  OUTPUT_KINDS.reduce((acc, k) => { acc[k.key] = k.label; return acc; }, {} as Record<OutputKind, string>);

/**
 * アセットを SEKKEIYA のアウトプット種別へ分類する。
 * 子アプリ scope（appScope）・Gallery の kind（type）・タグから判定。判定不能は null。
 */
export function assetOutputKind(a: { type?: string; appScope?: string; tags?: string[] }): OutputKind | null {
  const scope = (a.appScope || '').toLowerCase();
  const type = (a.type || '').toLowerCase();
  const tags = a.tags || [];
  if (tags.includes('テクスチャ')) return 'texture'; // マテリアルより先に
  if (scope === '3dsl' || type === 'layout') return 'layout';
  if (scope === '3dsp' || type === 'presentation') return 'presentation';
  if (scope === '3dsc' || type === 'furniture') return 'furniture';
  if (scope === '3dsd' || type === 'diagram') return 'diagram';
  if (scope === '3dsf' || type === 'portfolio') return 'portfolio';
  if (scope === '3dsb' || type === 'blog' || type === 'article') return 'article';
  if (scope === '3dsmt' || type === 'material') return 'material';
  if (type === 'video') return 'video';
  if (type === 'model' || type === '3d-model') return 'model';
  if (type === 'image' || type === 'screenshot' || type === 'cover') return 'render';
  return null;
}

// 軸B（粒度フィルタ）: AI Drive のアイテムを「再利用できる資産（アウトプット）」と「作業物」に分類する。
//  - 資産（アウトプット）: 認識できる種別（モデル/レイアウト/プレゼン/…/記事/テクスチャ）を持つもの
//  - 作業物              : 3Dシーンへの配置インスタンス（items_*）と、種別を判定できない作業ファイル
// 既定ビューは資産だけを表示し、作業物は別レーン（トグル）に退避してノイズを減らす。
export function isReusableAsset(a: { type?: string; sourceCollection?: string; appScope?: string; tags?: string[] } | null | undefined): boolean {
  if (!a) return false;
  const sc = a.sourceCollection || '';
  if (sc.startsWith('items_')) return false; // 3Dシーンへの配置インスタンスは作業物
  if (assetOutputKind(a)) return true;       // 認識できるアウトプット種別＝資産
  if (a.type === 'workFile') return false;   // 種別不明の作業ファイルは作業物
  return true;
}

interface AIDriveState {
  assets: AIDriveAsset[];
  /**
   * スコープ非依存の「集約プール」。全リスナーから取得・重複排除した資産の総体（削除済みも含む）。
   * activeScope で絞る前の生の union で、Drive アクセス層（driveAccess）が各子アプリ向けに
   * レイヤー/種別で純粋に絞り込むための単一ソース。UI 都合の activeScope とは独立。
   */
  pooledAssets: AIDriveAsset[];
  selectedAssetIds: string[];
  activeScope: AIDriveScope;
  isLoading: boolean;
  isViewInitialized: boolean;
  unsubscribeSnapshot?: () => void;
  
  setActiveScope: (scope: AIDriveScope) => void;
  setSelectedAssetIds: (ids: string[]) => void;
  setAssets: (assets: AIDriveAsset[]) => void;
  setIsLoading: (loading: boolean) => void;
  setIsViewInitialized: (val: boolean) => void;
  
  // Internal method to recompute final assets array from fetched maps
  updateAssets: () => void;
  
  // Method to fetch/subscribe to assets based on context
  subscribeToAssets: (projectId: string | null, userId: string | null, externalProjects?: any[]) => void;
  
  // Method to upload screenshots to Storage & Firestore
  uploadScreenshotToDrive: (dataUrl: string, userId: string, projectId?: string | null) => Promise<void>;

  // Method to upload image files directly to Drive
  uploadImageToDrive: (files: File[], projectId?: string | null) => Promise<void>;
  
  updateAsset: (assetId: string, projectId: string, updates: Partial<AIDriveAsset>) => Promise<void>;

  // Method to delete an asset
  deleteAsset: (assetId: string, projectId: string, scope?: string) => Promise<void>;

  // Method to move or copy assets to another project
  moveOrCopyAssets: (assetIds: string[], targetProjectId: string, isCopy: boolean) => Promise<void>;
}

const globalFetchedMap = new Map<string, AIDriveAsset[]>();
const globalUnsubs = new Set<() => void>();
const globalSubscribedKeys = new Set<string>();

export const useAIDriveStore = create<AIDriveState>((set, get) => ({
    assets: [],
    pooledAssets: [],
    selectedAssetIds: [],
    activeScope: 'all',
    isLoading: false,
    isViewInitialized: false,
    unsubscribeSnapshot: () => {},

    setIsViewInitialized: (val) => set({ isViewInitialized: val }),

    updateAssets: () => {
         const { activeScope } = get();
         const projectId = useAppStore.getState().activeProjectId;
         const userId = auth.currentUser?.uid;

         const allAssets = Array.from(globalFetchedMap.values()).flat();
         
         const coreAssets = allAssets.filter(a => !a.sourceCollection?.startsWith('items_'));
         const workspaceItems = allAssets.filter(a => a.sourceCollection?.startsWith('items_'));
         
         const uniqueAssets: typeof coreAssets = [];
         
         // 1. Deduplicate core assets against each other
         coreAssets.forEach(core => {
            const existingMatch = uniqueAssets.find(existing => {
               if (existing.id === core.id) return true;
               if (core.storageUrl && existing.storageUrl === core.storageUrl && core.name === existing.name) return true;
               if (core.thumbnailUrl && existing.thumbnailUrl === core.thumbnailUrl && core.name === existing.name) return true;
               return false;
            });
            
            if (existingMatch) {
               if (!existingMatch.projectIds) existingMatch.projectIds = [existingMatch.projectId].filter(Boolean) as string[];
               if (core.projectId && !existingMatch.projectIds.includes(core.projectId)) {
                 existingMatch.projectIds.push(core.projectId);
               }
            } else {
               core.projectIds = [core.projectId].filter(Boolean) as string[];
               uniqueAssets.push(core);
            }
         });
         
         workspaceItems.forEach(item => {
             const existingCore = coreAssets.find(core => 
                 (item.memo && item.memo.includes(core.id)) || 
                 (item.name === core.name && 
                  ((item.thumbnailUrl && item.thumbnailUrl === core.thumbnailUrl) || 
                   (item.storageUrl && item.storageUrl === core.storageUrl)))
             );
             
             if (existingCore) {
                 const targetCore = uniqueAssets.find(u => u.id === existingCore.id);
                 if (targetCore) {
                     if (!targetCore.projectIds) targetCore.projectIds = [targetCore.projectId].filter(Boolean) as string[];
                     if (item.projectId && !targetCore.projectIds.includes(item.projectId)) {
                         targetCore.projectIds.push(item.projectId);
                     }
                 }
                 return;
             }
             
             const existingSelf = uniqueAssets.find(existingItem => 
                 existingItem.name === item.name &&
                 existingItem.sourceCollection?.startsWith('items_') &&
                 item.thumbnailUrl && item.thumbnailUrl === existingItem.thumbnailUrl
             );
             
             if (existingSelf) {
                 if (!existingSelf.projectIds) existingSelf.projectIds = [existingSelf.projectId].filter(Boolean) as string[];
                 if (item.projectId && !existingSelf.projectIds.includes(item.projectId)) {
                     existingSelf.projectIds.push(item.projectId);
                 }
                 return;
             }
             
             item.projectIds = [item.projectId].filter(Boolean) as string[];
             uniqueAssets.push(item);
         });

         // Helper to determine if an asset is owned by the current user
         // Treat missing or 'unknown' ownerId (legacy data) as the current user's data
         const isMine = (a: AIDriveAsset) => a.ownerId === userId || !a.ownerId || a.ownerId === 'unknown';

         const activeAssets = activeScope === 'trash'
            ? uniqueAssets.filter(a => a.isDeleted)
            : uniqueAssets.filter(a => !a.isDeleted);

         // Local filtering based on activeScope
         let finalAssets = activeAssets;
         if (activeScope === 'trash') {
             finalAssets = activeAssets;
         } else if (activeScope === 'all') {
             // すべてのデータ: 自分が作成・所有しているすべてのデータと自分がアクセス可能な、他のユーザーが作成したデータを表示
             finalAssets = activeAssets;
         } else if (activeScope === 'unorganized') {
             // 未整理: 自分のデータのうち、プロジェクトに属しておらず、タグも付いていないものなどを想定（ここではタグなし等でフィルタ）
             // ※既存仕様がなかったため、とりあえず「自分のデータかつタグなし」とするか、「プロジェクト未所属かつタグなし」とする。
             // ここではより安全に「自分のデータかつ (タグが無い または フォルダが無い)」などとする手もあるが、
             // 最低限 ownerId === userId でフィルタしておく。
             finalAssets = activeAssets.filter(a => isMine(a) && (!a.tags || a.tags.length === 0));
         } else if (activeScope.startsWith('project_')) {
             const targetProjectId = activeScope.split('project_')[1];
             finalAssets = activeAssets.filter(a => a.projectId === targetProjectId || (a.projectIds && a.projectIds.includes(targetProjectId)));
         } else if (activeScope === 'my_library') {
             // マイライブラリ: 自分が作成・所有しているすべてのデータを表示（ownerIdがない古いデータも自分のもとみなす）
             finalAssets = activeAssets.filter(a => isMine(a));
         } else if (activeScope === 'my_public') {
             // My Public Folder: 自分の「公開」データのみ。
             finalAssets = activeAssets.filter(a => isMine(a) && a.visibility === 'public');
         } else if (activeScope === 'my_private') {
             // My Private Folder: 自分の「非公開」データのみ（visibility 未設定の古いデータも非公開扱い）。
             finalAssets = activeAssets.filter(a => isMine(a) && a.visibility !== 'public');
         } else if (activeScope === 'team_library') {
             // チームライブラリ: 自分がアクセス可能な他ユーザー作成データ
             finalAssets = activeAssets.filter(a => !isMine(a));
         }

         finalAssets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
         // pooledAssets = スコープ非依存の集約プール（driveAccess が純粋関数で絞り込む単一ソース）。
         set({ assets: finalAssets, pooledAssets: uniqueAssets, isLoading: false });
    },

    updateAsset: async (assetId, projectId, updates) => {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const asset = get().assets.find(a => a.id === assetId);
        const collectionName = asset?.sourceCollection || 'assets';
        let assetRef;
        
        if (collectionName === 'global_assets') {
          assetRef = doc(db, 'assets', assetId);
        } else if (collectionName.startsWith('items_')) {
          const wsId = collectionName.split('_')[1];
          assetRef = doc(db, 'projects', projectId, 'workspaces', wsId, 'items', assetId);
        } else {
          assetRef = doc(db, 'projects', projectId, collectionName, assetId);
        }

        await updateDoc(assetRef, updates);
        
        // Optimistic UI update
        set((state) => ({
          assets: state.assets.map(a => a.id === assetId ? { ...a, ...updates } : a)
        }));
      } catch (err) {
        console.error("AI Drive Update Error: ", err);
      }
    },

    deleteAsset: async (assetId, projectId, scope) => {
      try {
        const { doc, deleteDoc, updateDoc, setDoc, deleteField } = await import('firebase/firestore');
        const asset = get().assets.find(a => a.id === assetId);
        if (!asset) return;

        const collectionName = asset.sourceCollection || 'assets';
        const currentScope = scope || get().activeScope;

        // --- ヘルパー: globalFetchedMap から即時除外して再計算 ---
        const removeFromMap = (mapKey: string) => {
          const current = globalFetchedMap.get(mapKey);
          if (current) globalFetchedMap.set(mapKey, current.filter(a => a.id !== assetId));
        };
        const markDeletedInMap = (mapKey: string) => {
          const current = globalFetchedMap.get(mapKey);
          if (current) globalFetchedMap.set(mapKey, current.map(a => a.id === assetId ? { ...a, isDeleted: true } : a));
        };

        if (currentScope === 'current_project' || currentScope.startsWith('project_')) {
          // Remove from project only
          if (collectionName === 'global_assets') {
            const assetRef = doc(db, 'assets', assetId);
            await updateDoc(assetRef, { projectId: deleteField() });
            removeFromMap('global_assets');
          } else if (collectionName === 'assets' || collectionName === 'workFiles') {
            // Move to global assets to keep it in My Library
            const oldRef = doc(db, 'projects', projectId, collectionName, assetId);
            const newRef = doc(db, 'assets', assetId);

            const newData = {
              ...asset,
              projectId: null,
              sourceCollection: 'global_assets',
              ownerId: asset.ownerId || auth.currentUser?.uid
            };
            delete (newData as any).id;
            delete (newData as any).projectIds;

            await setDoc(newRef, newData);
            await deleteDoc(oldRef);
            // プロジェクトマップから即時除外（global側は次のsnapshotで追加される）
            removeFromMap(`${projectId}_${collectionName}`);
          } else if (collectionName.startsWith('items_')) {
            const wsId = collectionName.split('_')[1];
            const assetRef = doc(db, 'projects', projectId, 'workspaces', wsId, 'items', assetId);
            await deleteDoc(assetRef);
            removeFromMap(`${projectId}_items_${wsId}`);
          }

          set({ selectedAssetIds: get().selectedAssetIds.filter(id => id !== assetId) });
          get().updateAssets();

        } else {
          // Permanent delete or Soft delete
          let assetRef;
          let mapKey: string;
          if (collectionName === 'global_assets') {
            assetRef = doc(db, 'assets', assetId);
            mapKey = 'global_assets';
          } else if (collectionName.startsWith('items_')) {
            const wsId = collectionName.split('_')[1];
            assetRef = doc(db, 'projects', projectId, 'workspaces', wsId, 'items', assetId);
            mapKey = `${projectId}_items_${wsId}`;
          } else {
            assetRef = doc(db, 'projects', projectId, collectionName, assetId);
            mapKey = `${projectId}_${collectionName}`;
          }

          if (currentScope === 'trash') {
            await deleteDoc(assetRef);
            removeFromMap(mapKey);
          } else {
            await updateDoc(assetRef, { isDeleted: true, updatedAt: Date.now() });
            markDeletedInMap(mapKey);
          }

          set({ selectedAssetIds: get().selectedAssetIds.filter(id => id !== assetId) });
          get().updateAssets();
        }
      } catch (err) {
        console.error("AI Drive Delete Error: ", err);
      }
    },

    moveOrCopyAssets: async (assetIds, targetProjectId, isCopy) => {
      try {
        const { writeBatch, doc } = await import('firebase/firestore');
        const batch = writeBatch(db);
        const state = get();
        
        for (const assetId of assetIds) {
          const asset = state.assets.find(a => a.id === assetId);
          if (!asset) continue;

          // Prevent moving Workspace items (items_XXX) as they belong to specific 3D scenes
          const collectionName = asset.sourceCollection || 'assets';
          if (collectionName.startsWith('items_')) {
            console.warn(`[AI Drive] Skipping workspace item ${assetId}. Cannot move/copy 3D placed items across projects.`);
            continue;
          }

          // Same project check
          if (asset.projectId === targetProjectId) {
            console.warn(`[AI Drive] Asset ${assetId} is already in target project.`);
            continue;
          }

          if (collectionName === 'global_assets') {
             // Global assets don't have separate subcollections per project, 
             // but if they had projectIds array we could add it.
             // For now, we update the main document.
             const assetRef = doc(db, 'assets', assetId);
             batch.update(assetRef, { projectId: targetProjectId });
          } else {
             // Project-scoped asset
             const oldRef = doc(db, 'projects', asset.projectId || '', collectionName, assetId);
             
             // If copy, we create a new ID to avoid conflict if it ever gets merged
             const newId = isCopy ? `${assetId}_copy_${Date.now()}` : assetId;
             const newRef = doc(db, 'projects', targetProjectId, 'assets', newId);
             
             // Data to write
             const newData = { ...asset, projectId: targetProjectId, sourceCollection: 'assets' };
             delete (newData as any).id; // exclude the id from data

             batch.set(newRef, newData);

             // If move, delete old
             if (!isCopy) {
               batch.delete(oldRef);
             }
          }
        }
        
        await batch.commit();
        console.log(`[AI Drive] Successfully ${isCopy ? 'copied' : 'moved'} ${assetIds.length} assets to project ${targetProjectId}.`);
      } catch (err) {
        console.error("AI Drive Move/Copy Error: ", err);
      }
    },

    setActiveScope: (scope) => set({ activeScope: scope }),
    setSelectedAssetIds: (ids) => set({ selectedAssetIds: ids }),
    setAssets: (assets) => set({ assets }),
    setIsLoading: (isLoading) => set({ isLoading }),

    uploadScreenshotToDrive: async (dataUrl, userId, projectId) => {
      try {
        const { collection, addDoc } = await import('firebase/firestore');

        // Decode Base64 safely without relying on fetch() which can be restricted by Tauri/WebView2 for large data URIs
        const base64Data = dataUrl.split(',')[1];
        const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        // Calculate size roughly
        const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
        
        // Form a file object
        const fileName = `Screenshot_${Date.now()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        
        // Upload to Storage
        const storageUrl = await uploadImageAndGetUrl(file);
        
        // Save to global assets subcollection directly
        const asset: Omit<AIDriveAsset, 'id'> = {
          name: fileName,
          type: 'image',
          storageUrl,
          imageUrl: storageUrl,
          thumbnailUrl: storageUrl,
          size: `${sizeMb} MB`,
          ownerId: userId,
          projectId: projectId || null, // null means it's strictly in My Library
          sourceCollection: 'global_assets',
          createdAt: Date.now()
        };
        
        const assetsRef = collection(db, 'assets');
        await addDoc(assetsRef, asset);
        console.log("Screenshot saved to Global Drive!");
      } catch (err) {
        console.error("Failed to upload screenshot to Drive:", err);
      }
    },

    uploadImageToDrive: async (files, projectId) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Login required");
      const { collection, addDoc } = await import('firebase/firestore');
      for (const file of files) {
        const storageUrl = await uploadImageAndGetUrl(file);
        const sizeMb = (file.size / 1024 / 1024).toFixed(1);
        if (projectId) {
          // プロジェクト配下のコレクションに保存 → subscribeToAssets のプロジェクトリスナーで取得される
          const assetsRef = collection(db, 'projects', projectId, 'assets');
          await addDoc(assetsRef, {
            name: file.name,
            type: 'image',
            storageUrl,
            thumbnailUrl: storageUrl,
            size: `${sizeMb} MB`,
            ownerId: uid,
            projectId,
            sourceCollection: 'assets',
            createdAt: Date.now(),
          });
        } else {
          // グローバルアセットとして保存
          const assetsRef = collection(db, 'assets');
          await addDoc(assetsRef, {
            name: file.name,
            type: 'image',
            storageUrl,
            thumbnailUrl: storageUrl,
            size: `${sizeMb} MB`,
            ownerId: uid,
            projectId: null,
            sourceCollection: 'global_assets',
            createdAt: Date.now(),
          });
        }
        console.log('[AI Drive] Image uploaded:', file.name, '→', projectId ? `projects/${projectId}/assets` : 'assets');
      }
    },

    subscribeToAssets: (projectId, userId, externalProjects) => {
      const { activeScope } = get();
      if (!userId) return;

      console.log(`[AI Drive] subscribeToAssets called. Scope: ${activeScope}, ProjectId: ${projectId}`);
      set({ isLoading: true });

      const state = useAppStore.getState();
      const allProjects = externalProjects && externalProjects.length > 0 ? externalProjects : (state.projects || []);
      
      const updateAssets = () => get().updateAssets();

      // Helper to mount 3 listeners per project (assets, workFiles, workspaceItems)
      const attachListenersForProject = (proj: any) => {
         const projId = typeof proj === 'string' ? proj : proj?.id;
         if (!projId) return;
         if (globalSubscribedKeys.has(`project_${projId}`)) return;
         globalSubscribedKeys.add(`project_${projId}`);

         console.log(`[AI Drive] Attaching listeners for project: ${projId}`);

         // 1. Assets
         const assetsRef = collection(db, 'projects', projId, 'assets');
         const qAssets = query(assetsRef);
         
         const unsubAssets = onSnapshot(qAssets, (snapshot) => {
             const items = snapshot.docs.map(doc => {
               const data = doc.data() as any;
               return {
                 id: doc.id,
                 projectId: projId, // Ensure projectId is always present
                 ...data,
                 // ローカルパスの表示用URLは描画しない（404防止）。
                 storageUrl: cleanRemoteUrl(data.storageUrl),
                 thumbnailUrl: cleanRemoteUrl(data.thumbnailUrl),
                 sourceCollection: 'assets',
               } as AIDriveAsset;
             });
             globalFetchedMap.set(`${projId}_assets`, items);
             console.log(`[AI Drive] Fetched ${items.length} assets for ${projId}`);
             updateAssets();
         }, (error) => console.error(`Fetch Error [Assets: ${projId}]:`, error));
         globalUnsubs.add(unsubAssets);

         // 2. WorkFiles
         const wfRef = collection(db, 'projects', projId, 'workFiles');
         const qWf = query(wfRef);
         const unsubWf = onSnapshot(qWf, (snapshot) => {
             const items = snapshot.docs.map(doc => {
               const data = doc.data();
               // S.Image の画像/動画（appScope 3dsi の image-file）は「再利用資産」として扱う。
               // それ以外の各子アプリ作業ファイルは 'workFile'（＝作業物）のまま。
               const wfType = (data.appScope === '3dsi' && data.type === 'image-file')
                 ? (data.mediaType === 'video' ? 'video' : 'image')
                 : 'workFile';
               return {
                 id: doc.id,
                 projectId: projId,
                 name: data.name || data.title || 'Untitled File',
                 type: wfType,
                 storageUrl: cleanRemoteUrl(data.storageUrl || data.glbUrl || data.downloadUrl || data.url),
                 // ローカルパスのサムネは描画しない（404防止）。https の正規URLのみ採用。
                 thumbnailUrl: cleanRemoteUrl(
                    data.thumbnailUrl ||
                    data.thumbnail?.url ||
                    data.metadata?.thumbnailUrl ||
                    data.metadata?.thumbnail?.url ||
                    data.imageUrl ||
                    data.previewUrl ||
                    data.storageUrl),
                 tags: [data.toolType || 'WorkFile'],
                 ownerId: data.createdBy,
                 visibility: data.visibility,
                 appScope: data.appScope,
                 createdAt: data.createdAt ? new Date(data.createdAt).getTime() : 0,
                 updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : undefined,
                 sourceCollection: 'workFiles'
               } as AIDriveAsset;
             });
             globalFetchedMap.set(`${projId}_workFiles`, items);
             console.log(`[AI Drive] Fetched ${items.length} workFiles for ${projId}`);
             updateAssets();
         }, (error) => console.error(`Fetch Error [WorkFiles: ${projId}]:`, error));
         globalUnsubs.add(unsubWf);

         // 3. Workspace Items
         const systemWorkspaces = ['models', 'layout', 'presents', 'create', 'canvas', 'main'];
         const userWorkspaces = proj?.workspaces?.length > 0 
            ? proj.workspaces.map((w: any) => w.workspaceId || w.id) 
            : [];
         const workspacesList = Array.from(new Set([...systemWorkspaces, ...userWorkspaces]));

         workspacesList.forEach((wsId: string) => {
             const itemsRef = collection(db, 'projects', projId, 'workspaces', wsId, 'items');
             const qItems = query(itemsRef);
             const unsubItems = onSnapshot(qItems, (snapshot) => {
                 const items = snapshot.docs.map(doc => {
                   const data = doc.data();
                   return {
                     id: doc.id,
                     projectId: projId,
                     name: data.title || data.name || data.snapshot?.title || "Untitled",
                     type: data.itemType || data.type || 'item',
                     storageUrl: data.storageUrl || data.downloadUrl || data.url || data.snapshot?.thumbnailUrl || undefined, // keep existing for back-compat or depending on type
                     thumbnailUrl: 
                        data.thumbnailUrl || 
                        data.thumbnail?.url || 
                        data.metadata?.thumbnailUrl || 
                        data.metadata?.thumbnail?.url || 
                        data.imageUrl || 
                        data.previewUrl || 
                        data.snapshot?.thumbnailUrl || 
                        data.assetSnapshot?.thumbnailUrl ||
                        data.assetSnapshot?.imageUrl || 
                        data.storageUrl || undefined,
                     tags: [data.itemType || data.type ? (data.itemType || data.type).toUpperCase() : wsId.toUpperCase()],
                     ownerId: data.addedBy || data.ownerId || 'unknown',
                     createdAt: data.createdAt || Date.now(),
                     sourceCollection: `items_${wsId}`,
                     memo: data.itemRef, // store full path in memo for debugging optionally
                   } as AIDriveAsset;
                 });
                 globalFetchedMap.set(`${projId}_items_${wsId}`, items);
                 updateAssets();
             }, (error) => console.error(`Fetch Error [Items: ${projId}/${wsId}]:`, error));
             globalUnsubs.add(unsubItems);
         });
      };

      if (activeScope === 'current_project' && projectId) {
         const prj = allProjects.find((p: any) => p.id === projectId) || projectId;
         attachListenersForProject(prj);
      } else if (activeScope.startsWith('project_')) {
         const targetProjectId = activeScope.split('project_')[1];
         const prj = allProjects.find((p: any) => p.id === targetProjectId) || targetProjectId;
         attachListenersForProject(prj);
      } else {
         allProjects.forEach((proj: any) => {
             attachListenersForProject(proj);
         });
      }

      // 4. Fetch Global Assets for "all", "my_library", "team_library" scopes
      if (!globalSubscribedKeys.has('global_assets')) {
          globalSubscribedKeys.add('global_assets');
          const globalAssetsRef = collection(db, 'assets');
          console.log(`[AI Drive] Attaching listener for global assets`);
          
          const qGlobalAssets = query(globalAssetsRef, where('ownerId', '==', userId));

          const unsubGlobal = onSnapshot(qGlobalAssets, (snapshot) => {
              const items = snapshot.docs.map(doc => {
                  const data = doc.data();
                  return {
                    id: doc.id,
                    projectId: 'global', // Use 'global' to indicate it has no project
                    name: data.name || data.title || 'Untitled Model',
                    type: data.type || '3d-model',
                    // リンク（ブックマーク）等の元URL。プレビュー/「ブラウザで開く」に使う。
                    sourceUrl: data.sourceUrl,
                    storageUrl: cleanRemoteUrl(data.storageUrl || data.downloadUrl || data.url || (data.type === 'link' ? undefined : data.thumbnailUrl)),
                    thumbnailUrl: cleanRemoteUrl(
                        data.metadata?.thumbnailFilePath?.url ||
                        data.metadata?.thumbnailUrl ||
                        data.metadata?.thumbnail?.url ||
                        data.thumbnailFilePath?.url ||
                        data.thumbnailUrl ||
                        data.thumbnail?.url ||
                        data.imageUrl ||
                        data.previewUrl ||
                        data.storageUrl),
                    tags: data.tags || ['3D Model (Global)'],
                    ownerId: data.ownerId || userId,
                    visibility: data.visibility || (data.isPublic ? 'public' : undefined),
                    appScope: data.appScope,
                    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
                    isDeleted: data.isDeleted || false,
                    sourceCollection: 'global_assets'
                  } as AIDriveAsset;
              });
              globalFetchedMap.set(`global_assets`, items);
              console.log(`[AI Drive] Fetched ${items.length} global assets`);
              updateAssets();
          }, (error) => console.error(`Fetch Error [Global Assets]:`, error));
          globalUnsubs.add(unsubGlobal);
      }

      // Immediately filter existing cache for the new scope to ensure O(0) lag on second load
      updateAssets();

      // Ensure cleanup logic respects global unsubs when explicitly called
      set({ 
        unsubscribeSnapshot: () => {
          globalUnsubs.forEach(u => u());
          globalUnsubs.clear();
          globalSubscribedKeys.clear();
          globalFetchedMap.clear();
        } 
      });
    },
}));
