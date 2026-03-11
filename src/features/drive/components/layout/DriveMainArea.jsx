import React from "react";
import { Box, Typography } from "@mui/material";
import DriveBreadcrumbs from "../explorer/DriveBreadcrumbs";
import AssetGrid from "../explorer/AssetGrid";
import { BRAND } from "@/shared/ui/theme";

export default function DriveMainArea() {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: BRAND.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header Area */}
      <Box
        sx={{
          height: 56,
          px: 4,
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${BRAND.line}`,
          bgcolor: BRAND.panel,
        }}
      >
        <DriveBreadcrumbs />
      </Box>

      {/* Content Area */}
      <Box
        sx={{
          flex: 1,
          p: 4,
          overflowY: "auto",
        }}
      >
        <AssetGrid />
      </Box>
    </Box>
  );
}
