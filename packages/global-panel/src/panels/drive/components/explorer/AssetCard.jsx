import React from "react";
import { Card, CardActionArea, Typography, Box, IconButton, Chip } from "@mui/material";
import { useDriveUi } from "../../context/DriveUiContext";
import { usePanelTheme } from "../../../../theme/ThemeContext.jsx";
import { formatBytes, formatDate } from "../../utils/formatters";

// Icon mapping based on assetKind
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import SlideshowRoundedIcon from "@mui/icons-material/SlideshowRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";

const getAssetIcon = (assetKind) => {
  switch (assetKind) {
    case "model":
      return <ViewInArRoundedIcon sx={{ fontSize: 32, color: "#2ecc71" }} />;
    case "image":
      return <ImageRoundedIcon sx={{ fontSize: 32, color: "#f1c40f" }} />;
    case "slide":
      return <SlideshowRoundedIcon sx={{ fontSize: 32, color: "#e74c3c" }} />;
    case "video":
      return <SlideshowRoundedIcon sx={{ fontSize: 32, color: "#9b59b6" }} />; // Placeholder
    default:
      return <InsertDriveFileRoundedIcon sx={{ fontSize: 32, color: "#95a5a6" }} />;
  }
};

export default function AssetCard({ asset }) {
  const { openPreview } = useDriveUi();

  return (
    <Box
      onClick={() => openPreview(asset)}
      sx={{
        bgcolor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
        transition: "all 0.2s",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.15)",
          transform: "translateY(-2px)",
          boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0,0,0,0.4)",
        },
      }}
    >
      {/* Thumbnail Area */}
      <Box sx={{ height: 120, bgcolor: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          getAssetIcon(asset.assetKind)
        )}
      </Box>
      
      {/* Details Area */}
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.9)", mb: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {asset.name}
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.5 }}>
          <Typography sx={{ fontSize: 11 }}>{formatDate(asset.createdAt)}</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{formatBytes(asset.size)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
