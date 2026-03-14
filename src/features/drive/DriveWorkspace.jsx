import React, { useEffect } from "react";
import { Box } from "@mui/material";
import { useDriveStore } from "./store/useDriveStore";
import { DriveLayout, DriveUiProvider, AssetPreviewModal } from "sekkeiya-global-panel";
import { useDriveUiAdapter } from "./useDriveUiAdapter";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function DriveWorkspace() {
  const { user } = useAuth();
  // Initialize and provide data
  const { initialize, cleanup, folders, assets, currentFolderId } = useDriveStore();
  const adapterState = useDriveUiAdapter();
  
  console.log("DriveWorkspace mounted");
  console.log("DriveWorkspace uid:", user?.uid);

  useEffect(() => {
    if (user?.uid) {
      initialize();
    }
    return () => cleanup();
  }, [user?.uid, initialize, cleanup]);

  useEffect(() => {
    if (user?.uid) {
      const visibleFolders = folders.filter(f => f.parentId === currentFolderId);
      const visibleAssets = assets.filter(a => a.folderId === currentFolderId);
      
      console.log("DriveWorkspace state:", { 
        currentFolderId, 
        foldersCount: folders.length, 
        assetsCount: assets.length, 
        visibleFoldersCount: visibleFolders.length, 
        visibleAssetsCount: visibleAssets.length 
      });
      
      console.log("=== AI Drive Debug Info ===");
      console.log("uid:", user.uid);
      console.log("folders count:", folders.length);
      console.log("assets count:", assets.length);
      console.log("currentFolderId:", currentFolderId);
      console.log("visibleFolders count:", visibleFolders.length);
      console.log("visibleAssets count:", visibleAssets.length);
      console.log("root 判定ルール:", "フォルダは parentId === null, アセットは folderId === null");
      console.log("===========================");
    }
  }, [user?.uid, folders, assets, currentFolderId]);

  return (
    <DriveUiProvider adapterState={adapterState}>
      <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <DriveLayout />
        {adapterState.selectedAsset && <AssetPreviewModal />}
      </Box>
    </DriveUiProvider>
  );
}
