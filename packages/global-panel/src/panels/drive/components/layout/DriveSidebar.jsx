import React from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";
import FolderTree from "../explorer/FolderTree";
import { usePanelTheme } from "../../../../theme/ThemeContext.jsx";

export default function DriveSidebar() {
  const BRAND = usePanelTheme();
  const isMobile = useMediaQuery('(max-width:900px)');

  if (isMobile) return null;

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        bgcolor: "rgba(255,255,255,0.02)",
        borderRight: `1px solid rgba(255,255,255,0.08)`,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        p: 2,
      }}
    >
      <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1, mb: 1, px: 1 }}>
        AIドライブ
      </Typography>
      <FolderTree />
    </Box>
  );
}
