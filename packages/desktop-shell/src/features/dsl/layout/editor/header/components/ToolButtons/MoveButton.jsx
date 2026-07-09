// src/features/layout/components/Header/components/ToolButtons/MoveButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import OpenWithRoundedIcon from "@mui/icons-material/OpenWithRounded";

import { useToolsStore } from "../../../../store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function MoveButton() {
  const theme = useTheme();
  const mode = useToolsStore((s) => s.mode);
  const setMode = useToolsStore((s) => s.setMode);

  const onClick = useCallback(() => setMode("translate"), [setMode]);

  return (
    <Tooltip title="Move (W)">
      <IconButton
        onClick={onClick}
        sx={getToolIconButtonSx(theme, { active: mode === "translate" })}
      >
        <OpenWithRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
