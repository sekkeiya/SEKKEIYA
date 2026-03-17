import React from "react";
import { Box, Typography, Grid, CircularProgress } from "@mui/material";
import { useDriveUi } from "../../context/DriveUiContext";
import FolderCard from "./FolderCard";
import AssetCard from "./AssetCard";

export default function AssetGrid() {
  const { folders, assets, currentFolderId, isLoading, searchResults, isSearching } = useDriveUi();
  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeAssets = Array.isArray(assets) ? assets : [];

  // If searching
  if (isSearching) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress size={32} sx={{ color: "rgba(255,255,255,0.3)" }} />
      </Box>
    );
  }

  if (searchResults !== null) {
    if ((searchResults?.length || 0) === 0) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", opacity: 0.5 }}>
          <Typography sx={{ mt: 2, fontWeight: 600 }}>条件に一致するアセットが見つかりません</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 2, display: "block" }}>
            検索結果 ({searchResults?.length || 0}件)
          </Typography>
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.05)' }} />
        </Box>
        <Grid container spacing={2}>
          {(searchResults || []).map((asset) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={asset.id}>
              <AssetCard asset={asset} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Filter items that belong to the current folder view
  const displayFolders = safeFolders.filter((f) => f.parentId === currentFolderId && !f.isDeleted);
  const displayAssets = safeAssets.filter((a) => a.folderId === currentFolderId && !a.isDeleted);

  const isEmpty = displayFolders.length === 0 && displayAssets.length === 0;

  if (isLoading && isEmpty) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress size={32} sx={{ color: "rgba(255,255,255,0.3)" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {displayFolders.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 2, display: "block" }}>
              フォルダ
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.05)' }} />
          </Box>
          <Grid container spacing={2}>
            {displayFolders.map((folder) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={folder.id}>
                <FolderCard folder={folder} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {displayAssets.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 2, display: "block" }}>
              ファイル
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.05)' }} />
          </Box>
          <Grid container spacing={2}>
            {displayAssets.map((asset) => (
              <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={asset.id}>
                <AssetCard asset={asset} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {isEmpty && (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: 0.3 }}>
          <Typography sx={{ mt: 2, fontWeight: 600 }}>このフォルダは空です</Typography>
        </Box>
      )}
    </Box>
  );
}
