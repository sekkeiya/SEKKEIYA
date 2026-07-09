// src/features/layout/components/Header/components/ToolButtons/ScaleButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AspectRatioRoundedIcon from "@mui/icons-material/AspectRatioRounded";

import { useToolsStore } from "@layout/features/layout/store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function ScaleButton() {
  const theme = useTheme();

  const mode = useToolsStore((s) => s.mode);
  const setMode = useToolsStore((s) => s.setMode);

  const onClick = useCallback(() => {
    setMode("scale");
  }, [setMode]);

  return (
    <Tooltip title="Scale (R)">
      <IconButton
        onClick={onClick}
        sx={getToolIconButtonSx(theme, { active: mode === "scale" })}
      >
        <AspectRatioRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
