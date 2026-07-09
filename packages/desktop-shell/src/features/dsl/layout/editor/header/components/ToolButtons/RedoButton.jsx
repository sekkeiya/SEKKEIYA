// src/features/layout/components/Header/components/ToolButtons/RedoButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";

import { getToolIconButtonSx } from "./toolButtonStyles";
import { useToolsStore } from "../../../../store/toolsStore/useToolsStore";

export default function RedoButton() {
  const theme = useTheme();
  const redo = useToolsStore((s) => s.redo);
  const hasRedo = useToolsStore((s) => Boolean(s.commands.redo));

  const handleClick = useCallback(() => redo(), [redo]);

  if (!hasRedo) return null;

  return (
    <Tooltip title="Redo (Ctrl+Y)">
      <IconButton onClick={handleClick} sx={getToolIconButtonSx(theme, { active: false })}>
        <RedoRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
