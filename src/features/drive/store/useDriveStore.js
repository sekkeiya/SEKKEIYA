import { create } from 'zustand';
import { collection, query, onSnapshot, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { db, storage } from '@/shared/config/firebase';

export const useDriveStore = create((set, get) => ({
  folders: [],
  assets: [],
  currentFolderId: null,
  selectedAsset: null,
  isLoading: false,
  error: null,
  
  _unsubscribeFolders: null,
  _unsubscribeAssets: null,

  _ensureInitialData: async (userId) => {
    console.log("== ensureInitialData start ==", { uid: userId });
    try {
      const foldersRef = collection(db, "users", userId, "driveFolders");
      const assetsRef = collection(db, "users", userId, "driveAssets");
      
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

      // Cleanup duplicated auto-generated assets
      assetsSnapshot.forEach((docSnap) => {
        if (!docSnap.id.startsWith("asset-")) {
          batch.delete(docSnap.ref);
        }
      });

      console.log("Initializing default AI Drive schema for user:", userId);

      const defaultFolders = [
        { name: "3D Models", id: "root-3d-models" },
        { name: "Images", id: "root-images" },
        { name: "Documents", id: "root-documents" },
        { name: "Videos", id: "root-videos" },
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
          depth: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId
        }, { merge: true });
      });

      console.log("write path for assets:", assetsRef.path);
      const sampleImageRef = doc(assetsRef, "asset-sample-image");
      batch.set(sampleImageRef, {
        id: sampleImageRef.id,
        name: "sample.png",
        type: "image",
        assetKind: "image",
        folderId: "root-images", 
        storagePath: `drive/${userId}/images/sample.png`,
        downloadURL: "", 
        size: 120000,
        mimeType: "image/png",
        previewURL: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId
      }, { merge: true });

      const sampleModelRef = doc(assetsRef, "asset-sample-model");
      batch.set(sampleModelRef, {
        id: sampleModelRef.id,
        name: "example.glb",
        type: "model",
        assetKind: "model",
        folderId: "root-3d-models", 
        storagePath: `drive/${userId}/models/example.glb`,
        downloadURL: "", 
        size: 2500000,
        mimeType: "model/gltf-binary",
        previewURL: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId
      }, { merge: true });

      await batch.commit();
      console.log("seed created/merged folders count:", defaultFolders.length);
      console.log("seed created/merged assets count:", 2);
      console.log("== ensureInitialData end ==");
    } catch (err) {
      console.error("Failed to initialize default drive data:", err);
      console.log("== ensureInitialData end ==");
    }
  },

  initialize: (userId) => {
    console.log("useDriveStore initialize called", { uid: userId });
    
    if (!userId) return;

    // Cleanup previous listeners if any
    get().cleanup();
    
    set({ isLoading: true, error: null });

    // Ensure initial data exists
    get()._ensureInitialData(userId);

    const foldersRef = collection(db, "users", userId, "driveFolders");
    const assetsRef = collection(db, "users", userId, "driveAssets");
    
    // AI Drive is global per user, no projectId filtering
    const foldersQuery = query(foldersRef);
    const assetsQuery = query(assetsRef);

    console.log("read query path folders:", ["users", userId, "driveFolders"]);
    console.log("read query path assets:", ["users", userId, "driveAssets"]);

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
            // Fallback to no image URL so the UI uses an icon
            return asset;
          }
        }
        return asset;
      }));
      
      set({ assets: assetsWithUrls, isLoading: false });
    }, (error) => {
      console.error("Drive assets listener error:", error);
      set({ error: error.message, isLoading: false });
    });

    set({ _unsubscribeFolders: unsubFolders, _unsubscribeAssets: unsubAssets });
  },

  cleanup: () => {
    const { _unsubscribeFolders, _unsubscribeAssets } = get();
    if (_unsubscribeFolders) _unsubscribeFolders();
    if (_unsubscribeAssets) _unsubscribeAssets();
    set({
      _unsubscribeFolders: null,
      _unsubscribeAssets: null,
      folders: [],
      assets: [],
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
