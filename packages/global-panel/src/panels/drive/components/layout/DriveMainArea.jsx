import React from "react";
import { Box, Typography } from "@mui/material";
import DriveBreadcrumbs from "../explorer/DriveBreadcrumbs";
import AssetGrid from "../explorer/AssetGrid";
import { usePanelTheme } from "../../../../theme/ThemeContext.jsx";

export default function DriveMainArea() {
  const BRAND = usePanelTheme();
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 内部は max-width 1240px で中央揃え */}
      <Box sx={{ width: "100%", maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header Area */}
        <Box
          sx={{
            height: 56,
            px: 4,
            display: "flex",
            alignItems: "center",
            borderBottom: `1px solid rgba(255,255,255,0.08)`,
            bgcolor: "rgba(255,255,255,0.02)",
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
      </Box> {/* End max-width wrapper */}
    </Box>
  );
}
