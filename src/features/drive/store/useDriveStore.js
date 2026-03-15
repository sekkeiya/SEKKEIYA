import { create } from 'zustand';
import { collection, query, onSnapshot, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '@/shared/config/firebase';

export const useDriveStore = create((set, get) => ({
  folders: [],
  assets: [],
  _driveAssets: [],
  _modelAssets: [],
  currentFolderId: null,
  selectedAsset: null,
  isLoading: false,
  error: null,
  
  _unsubscribeFolders: null,
  _unsubscribeAssets: null,
  _unsubscribeModels: null,

  _ensureInitialData: async (uid) => {
    console.log("== ensureInitialData start ==", { uid });
    try {
      const foldersRef = collection(db, "users", uid, "driveFolders");
      const assetsRef = collection(db, "users", uid, "driveAssets");
      
      const foldersSnapshot = await getDocs(foldersRef);
      const assetsSnapshot = await getDocs(assetsRef);
      
      console.log("existing folders count before seed:", foldersSnapshot.size);
      console.log("existing assets count before seed:", assetsSnapshot.size);
      
      const batch = writeBatch(db);

      // Cleanup duplicated auto-generated folders
      foldersSnapshot.forEach((docSnap) => {
        if (!docSnap.id.startsWith("root-")) {
          batch.delete(docSnap.ref);
        }
      });

      // Cleanup duplicated auto-generated assets (only those without a 'source' indicating they are old mock data)
      assetsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!docSnap.id.startsWith("asset-") && !docSnap.id.startsWith("3dss-") && !docSnap.id.startsWith("3dsl-") && !data.source) {
          batch.delete(docSnap.ref);
        }
      });

      console.log("Initializing default AI Drive schema for user:", uid);

      const defaultFolders = [
        { name: "3D Models", id: "root-3d-models" },
        { name: "Architectural Plans", id: "root-architectural-plans" },
        { name: "Images", id: "root-images" },
        { name: "Videos", id: "root-videos" },
        { name: "Documents", id: "root-documents" },
        { name: "AI Generated", id: "root-ai-generated" },
        { name: "Projects", id: "root-projects" }
      ];
      
      console.log("write path for folders:", foldersRef.path);
      defaultFolders.forEach((folder) => {
        const newFolderRef = doc(foldersRef, folder.id);
        batch.set(newFolderRef, {
          id: folder.id,
          name: folder.name,
          parentId: null,
          path: `/${folder.name}`,
          kind: "system",
          ownerId: uid,
          depth: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: uid,
          isDeleted: false
        }, { merge: true });
      });

      await batch.commit();
      console.log("seed created/merged folders count:", defaultFolders.length);
      console.log("== ensureInitialData end ==");
    } catch (err) {
      console.error("Failed to initialize default drive data:", err);
      console.log("== ensureInitialData end ==");
    }
  },

  initialize: (uid) => {
    if (!uid) {
      console.warn("useDriveStore initialize aborted: no authenticated user passed");
      return;
    }

    console.log(`Drive initialized for UID:`, uid);
    
    // Cleanup previous listeners if any
    get().cleanup();
    
    set({ isLoading: true, error: null });

    // Ensure initial data exists
    get()._ensureInitialData(uid);

    const foldersRef = collection(db, "users", uid, "driveFolders");
    const assetsRef = collection(db, "users", uid, "driveAssets");
    const modelsRef = collection(db, "users", uid, "models"); // 3DSS models
    
    // AI Drive is global per user, no projectId filtering
    const foldersQuery = query(foldersRef);
    const assetsQuery = query(assetsRef);
    const modelsQuery = query(modelsRef);

    console.log("Drive folders query path:", `users/${uid}/driveFolders`);
    console.log("Drive assets query path:", `users/${uid}/driveAssets`);
    console.log("Drive 3DSS models query path:", `users/${uid}/models`);

    const unsubFolders = onSnapshot(foldersQuery, (snapshot) => {
      const foldersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      set({ folders: foldersList });
    }, (error) => {
      console.error("Drive folders listener error:", error);
      set({ error: error.message, isLoading: false });
    });

    const unsubAssets = onSnapshot(assetsQuery, async (snapshot) => {
      const rawAssets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Resolve downloadURLs with fallbacks
      const assetsWithUrls = await Promise.all(rawAssets.map(async (asset) => {
        if (asset.storagePath) {
          try {
            const fileRef = ref(storage, asset.storagePath);
            const url = await getDownloadURL(fileRef);
            return { ...asset, imageUrl: url };
          } catch (err) {
            console.warn(`Failed to get download URL for asset ${asset.id}:`, err);
            // Fallback to thumbUrl or thumbnailDataUrl if storagePath fails
            return { ...asset, imageUrl: asset.imageUrl || asset.thumbUrl || asset.thumbnailDataUrl || "" };
          }
        }
        // If no storagePath, use thumbUrl or thumbnailDataUrl if they exist
        return { ...asset, imageUrl: asset.imageUrl || asset.thumbUrl || asset.thumbnailDataUrl || "" };
      }));
      
      set((state) => {
        const driveAssetSourceIds = new Set(
          assetsWithUrls.filter(a => a.source === "3dss").map(a => a.sourceId)
        );
        const filteredModels = state._modelAssets.filter(
          m => !driveAssetSourceIds.has(m.sourceId)
        );
        return { 
          _driveAssets: assetsWithUrls,
          assets: [...assetsWithUrls, ...filteredModels], 
          isLoading: false 
        };
      });
    }, (error) => {
      console.error("Drive assets listener error:", error);
      set({ error: error.message, isLoading: false });
    });

    // 3DSS Models Listener for on-the-fly integration
    const unsubModels = onSnapshot(modelsQuery, (snapshot) => {
      const mappedModels = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.title ?? data.name ?? "Untitled",
          type: "model",
          source: "3dss",
          sourceId: docSnap.id,
          folderId: "root-3d-models", // Map to 3D Models system folder
          storagePath: data.files?.glb?.path ?? data.modelFilePath ?? "",
          thumbnailPath: data.thumbnailUrl ?? data.thumbnailFilePath?.url ?? "",
          imageUrl: data.thumbnailUrl ?? data.thumbnailFilePath?.url ?? "",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          ownerId: data.authorId ?? data.createdById ?? uid,
          isDeleted: data.isDeleted ?? false,
          _raw3dss: data
        };
      }).filter(m => !m.isDeleted);

      set((state) => {
        const driveAssetSourceIds = new Set(
          state._driveAssets.filter(a => a.source === "3dss").map(a => a.sourceId)
        );
        const filteredModels = mappedModels.filter(
          m => !driveAssetSourceIds.has(m.sourceId)
        );
        return {
          _modelAssets: mappedModels,
          assets: [...state._driveAssets, ...filteredModels]
        };
      });
    }, (error) => {
      console.error("Drive models listener error:", error);
    });

    set({ _unsubscribeFolders: unsubFolders, _unsubscribeAssets: unsubAssets, _unsubscribeModels: unsubModels });
  },

  cleanup: () => {
    const { _unsubscribeFolders, _unsubscribeAssets, _unsubscribeModels } = get();
    if (_unsubscribeFolders) _unsubscribeFolders();
    if (_unsubscribeAssets) _unsubscribeAssets();
    if (_unsubscribeModels) _unsubscribeModels();
    set({
      _unsubscribeFolders: null,
      _unsubscribeAssets: null,
      _unsubscribeModels: null,
      folders: [],
      assets: [],
      _driveAssets: [],
      _modelAssets: [],
      currentFolderId: null,
      selectedAsset: null,
      isLoading: false,
      error: null
    });
  },

  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),

  // Actions
  fetchFolders: () => {}, // Handled by initialize's onSnapshot
  fetchAssets: () => {},  // Handled by initialize's onSnapshot
  navigateToFolder: (id) => set({ currentFolderId: id }),
  createFolder: async (name, parentId = null) => {
    console.log("TODO: Implement createFolder");
  },
  uploadAsset: async (file, folderId = null) => {
    console.log("TODO: Implement uploadAsset");
  },
  deleteAsset: async (assetId) => {
    console.log("TODO: Implement deleteAsset");
  },
  deleteFolder: async (folderId) => {
    console.log("TODO: Implement deleteFolder");
  }
}));
