import React from "react";
import { Box, Tooltip, IconButton } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import { BRAND } from "../ui/theme";
import BottomIcon from "../ui/BottomIcon";

export default function BottomBar() {
  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 72,
        borderTop: `1px solid ${BRAND.line}`,
        bgcolor: "rgba(11,15,22,0.72)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 10,
        px: 1,
      }}
    >
      <BottomIcon icon={<HomeRoundedIcon />} label="ホーム" active />
      <BottomIcon icon={<HubRoundedIcon />} label="ハブ" />
      <BottomIcon icon={<FolderRoundedIcon />} label="AIドライブ" />

      <Tooltip title="New" placement="top">
        <IconButton
          sx={{
            width: 44,
            height: 44,
            bgcolor: BRAND.panel,
            border: `1px solid ${BRAND.line}`,
            "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
          }}
        >
          <AddRoundedIcon sx={{ color: BRAND.text }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
