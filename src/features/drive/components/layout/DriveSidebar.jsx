import React from "react";
import { Box, Typography } from "@mui/material";
import FolderTree from "../explorer/FolderTree";
import { BRAND } from "@/shared/ui/theme";

export default function DriveSidebar() {
  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        bgcolor: BRAND.panel,
        borderRight: `1px solid ${BRAND.line}`,
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
