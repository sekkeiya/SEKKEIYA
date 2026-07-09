// src/features/layout/components/Header/components/ToolButtons/RotateButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";

import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function RotateButton() {
  const theme = useTheme();

  const mode = useToolsStore((s) => s.mode);
  const setMode = useToolsStore((s) => s.setMode);

  const onClick = useCallback(() => {
    setMode("rotate");
  }, [setMode]);

  return (
    <Tooltip title="Rotate (E)">
      <IconButton
        onClick={onClick}
        sx={getToolIconButtonSx(theme, { active: mode === "rotate" })}
      >
        <RotateRightRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
