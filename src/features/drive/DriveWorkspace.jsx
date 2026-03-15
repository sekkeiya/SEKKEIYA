import React, { useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { useDriveStore } from "./store/useDriveStore";
import { DriveLayout, DriveUiProvider, AssetPreviewModal } from "sekkeiya-global-panel";
import { useDriveUiAdapter } from "./useDriveUiAdapter";


export default function DriveWorkspace({ uid }) {
  // Initialize and provide data
  const { initialize, cleanup, folders, assets, currentFolderId } = useDriveStore();
  const adapterState = useDriveUiAdapter();
  


  console.log("DriveWorkspace mounted");
  console.log("DriveWorkspace uid:", uid);

  useEffect(() => {
    if (uid) {
      initialize(uid);
    }
    return () => cleanup();
  }, [uid, initialize, cleanup]);

  useEffect(() => {
    if (uid) {
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
      console.log("uid:", uid);
      console.log("folders count:", folders.length);
      console.log("assets count:", assets.length);
      console.log("currentFolderId:", currentFolderId);
      console.log("visibleFolders count:", visibleFolders.length);
      console.log("visibleAssets count:", visibleAssets.length);
      console.log("root 判定ルール:", "フォルダは parentId === null, アセットは folderId === null");
      console.log("===========================");
    }
  }, [uid, folders, assets, currentFolderId]);

  if (!uid) {
    return (
      <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(10,12,16,0.95)" }}>
        <Typography sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 500, letterSpacing: 0.5 }}>
          AIドライブを利用するにはログインしてください。
        </Typography>
      </Box>
    );
  }

  return (
    <DriveUiProvider adapterState={adapterState}>
      <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <DriveLayout />
        {adapterState.selectedAsset && <AssetPreviewModal />}
      </Box>
    </DriveUiProvider>
  );
}
