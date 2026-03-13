import React from "react";
import { Box } from "@mui/material";
import DriveSidebar from "./DriveSidebar";
import DriveMainArea from "./DriveMainArea";
import { usePanelTheme } from "../../../../theme/ThemeContext.jsx";

export default function DriveLayout() {
  const BRAND = usePanelTheme();
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        bgcolor: BRAND.bg,
        borderTop: `1px solid ${BRAND.line}`,
        borderLeft: `1px solid ${BRAND.line}`,
        borderTopLeftRadius: 16,
        overflow: "hidden", // Keep scroll bounds inside MainArea and Sidebar
        height: "100%"
      }}
    >
      <DriveSidebar />
      <DriveMainArea />
    </Box>
  );
}
