// src/features/layout/components/Header/components/ToolButtons/SnapButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";

import { useToolsStore } from "../../../../store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function SnapButton() {
  const theme = useTheme();
  const snapEnabled = useToolsStore((s) => s.snapEnabled);
  const toggleSnap = useToolsStore((s) => s.toggleSnap);

  const onClick = useCallback(() => toggleSnap(), [toggleSnap]);

  return (
    <Tooltip title={snapEnabled ? "Snap: ON" : "Snap: OFF"}>
      <IconButton
        onClick={onClick}
        sx={getToolIconButtonSx(theme, { active: snapEnabled })}
      >
        <GridOnRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
