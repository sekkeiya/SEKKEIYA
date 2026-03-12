import { create } from 'zustand';

export const useDriveStore = create((set, get) => ({
    currentProjectId: null,
    currentFolderId: null, // null means root
    folders: [],
    assets: [],
    breadcrumbs: [],
    selectedAsset: null,
    isLoading: false,

    setProject: (projectId) => set({ currentProjectId: projectId, currentFolderId: null, breadcrumbs: [] }),

    // Navigate to a specific folder and update breadcrumbs
    navigateToFolder: (folderId, allFolders) => {
        // allFolders is passed here to compute breadcrumbs, normally this would be fetched from Firestore
        // For mock, we'll just set the folderId. The component will update breadcrumbs based on the folder's ancestors.
        set({ currentFolderId: folderId });
    },

    navigateUp: (allFolders) => {
        const { currentFolderId } = get();
        if (!currentFolderId) return; // Already at root

        const currentFolder = allFolders.find(f => f.id === currentFolderId);
        if (!currentFolder || currentFolder.parentId === null) {
            set({ currentFolderId: null, breadcrumbs: [] });
        } else {
            set({ currentFolderId: currentFolder.parentId });
        }
    },

    setItems: (folders, assets) => set({ folders, assets, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),

    openPreview: (asset) => set({ selectedAsset: asset }),
    closePreview: () => set({ selectedAsset: null }),
}));
