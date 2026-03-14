import React from "react";
import { Box, Typography } from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { useDriveUi } from "../../context/DriveUiContext";

export default function FolderCard({ folder }) {
  const { navigateToFolder, folders } = useDriveUi();

  return (
    <Box
      onClick={() => navigateToFolder(folder.id, folders)}
      sx={{
        bgcolor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        p: 2,
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
        transition: "all 0.2s",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.15)",
          transform: "translateY(-2px)",
          boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0,0,0,0.4)",
        },
      }}
    >
      <FolderRoundedIcon sx={{ fontSize: 24, color: "#3498db", mr: 1.5 }} />
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.9)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {folder.name}
      </Typography>
    </Box>
  );
}
