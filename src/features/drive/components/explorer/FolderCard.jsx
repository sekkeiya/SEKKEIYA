import React from "react";
import { Box, Typography } from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { useDriveStore } from "../../store/useDriveStore";

export default function FolderCard({ folder }) {
  const { navigateToFolder, folders } = useDriveStore();

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
        transition: "all 0.2s",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.15)",
          transform: "translateY(-2px)",
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
