import { useDriveStore } from "./store/useDriveStore";

export const useDriveUiAdapter = () => {
  const {
    folders,
    assets,
    currentFolderId,
    selectedAsset,
    isLoading,
    error,
    searchResults,
    isSearching,
    searchAssets,
    clearSearch,
    setCurrentFolderId,
    setSelectedAsset
  } = useDriveStore();

  const navigateToFolder = (folderId, allFolders = folders) => {
    setCurrentFolderId(folderId);
  };

  const navigateUp = () => {
    if (!currentFolderId) return; // Already at root

    const currentFolder = folders.find(f => f.id === currentFolderId);
    if (!currentFolder) {
      setCurrentFolderId(null);
      return;
    }

    if (currentFolder.parentId) {
      setCurrentFolderId(currentFolder.parentId);
    } else {
      // If no parentId, maybe we are at root level
      setCurrentFolderId(null);
    }
  };

  const openPreview = (asset) => {
    setSelectedAsset(asset);
  };

  const closePreview = () => {
    setSelectedAsset(null);
  };

  return {
    folders,
    assets,
    currentFolderId,
    selectedAsset,
    isLoading,
    error,
    searchResults,
    isSearching,
    searchAssets,
    clearSearch,
    navigateToFolder,
    navigateUp,
    openPreview,
    closePreview,
  };
};
