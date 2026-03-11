import React, { useEffect } from "react";
import { Box } from "@mui/material";
import { useDriveStore } from "./store/useDriveStore";
import { mockFolders, mockAssets } from "./api/mockData";
import DriveLayout from "./components/layout/DriveLayout";
import AssetPreviewModal from "./components/preview/AssetPreviewModal";

export default function DrivePage({ projectId }) {
  const { setProject, setItems, selectedAsset } = useDriveStore();

  useEffect(() => {
    // Initialize Drive with project ID and mock data
    if (projectId) {
      setProject(projectId);
      setItems(
        mockFolders.filter(f => !f.isDeleted && f.projectId === projectId),
        mockAssets.filter(a => !a.isDeleted && a.projectId === projectId)
      );
    } else {
      setProject(null);
      setItems(
        mockFolders.filter(f => !f.isDeleted),
        mockAssets.filter(a => !a.isDeleted)
      );
    }
  }, [projectId, setProject, setItems]);

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <DriveLayout />
      {selectedAsset && <AssetPreviewModal />}
    </Box>
  );
}
