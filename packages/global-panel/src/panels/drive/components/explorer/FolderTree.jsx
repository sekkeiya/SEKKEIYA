import React from "react";
import { Box, Typography, Skeleton } from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import { useDriveUi } from "../../context/DriveUiContext";

export default function FolderTree() {
  const { folders, currentFolderId, navigateToFolder, isLoading, error } = useDriveUi();
  const safeFolders = Array.isArray(folders) ? folders : [];

  // Root folders (parentId === null)
  const rootFolders = safeFolders.filter((f) => f.parentId === null);

  if (error) {
    return <Typography sx={{ p: 2, color: 'error.main', fontSize: 13 }}>エラーが発生しました</Typography>;
  }

  if (isLoading && safeFolders.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1, bgcolor: "rgba(255,255,255,0.1)" }} />
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1, bgcolor: "rgba(255,255,255,0.1)" }} />
        <Skeleton variant="text" width="70%" height={24} sx={{ bgcolor: "rgba(255,255,255,0.1)" }} />
      </Box>
    );
  }

  const renderTree = (nodeArray, depth = 0) => {
    return nodeArray.map((folder) => {
      const isSelected = currentFolderId === folder.id;
      // Is this folder an ancestor of the current folder? (To show it open)
      // For a real tree, we'd check ancestors array of the current folder.
      const isOpen = isSelected || false; // Simplified for mock UI tree expansion

      // Get children
      const children = safeFolders.filter((f) => f.parentId === folder.id);

      return (
        <Box key={folder.id}>
          <Box
            onClick={() => navigateToFolder(folder.id, safeFolders)}
            sx={{
              display: "flex",
              alignItems: "center",
              py: 0.75,
              px: 1,
              pl: 1 + depth * 2,
              cursor: "pointer",
              borderRadius: 1,
              color: isSelected ? "#fff" : "rgba(255,255,255,0.7)",
              bgcolor: isSelected ? "rgba(255,255,255,0.1)" : "transparent",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.06)",
                color: "#fff",
              },
            }}
          >
            {isOpen ? (
              <FolderOpenRoundedIcon sx={{ fontSize: 18, mr: 1, color: isSelected ? "#3498db" : "inherit" }} />
            ) : (
              <FolderRoundedIcon sx={{ fontSize: 18, mr: 1, color: isSelected ? "#3498db" : "inherit" }} />
            )}
            <Typography sx={{ fontSize: 13, fontWeight: isSelected ? 600 : 500 }}>
              {folder.name}
            </Typography>
          </Box>
          {/* Render children recursively if needed in a real tree. For simplicity here, just flatten or only expand if needed. */}
          {children.length > 0 && renderTree(children, depth + 1)}
        </Box>
      );
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {/* Root "My Drive" or equivalent link */}
      <Box
        onClick={() => navigateToFolder(null, safeFolders)}
        sx={{
          display: "flex",
          alignItems: "center",
          py: 0.75,
          px: 1,
          cursor: "pointer",
          borderRadius: 1,
          color: currentFolderId === null ? "#fff" : "rgba(255,255,255,0.7)",
          bgcolor: currentFolderId === null ? "rgba(255,255,255,0.1)" : "transparent",
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.06)",
            color: "#fff",
          },
        }}
      >
        <FolderOpenRoundedIcon sx={{ fontSize: 18, mr: 1, color: currentFolderId === null ? "#3498db" : "inherit" }} />
        <Typography sx={{ fontSize: 13, fontWeight: currentFolderId === null ? 600 : 500 }}>
          すべてのプロジェクト資産
        </Typography>
      </Box>

      {renderTree(rootFolders)}
    </Box>
  );
}
