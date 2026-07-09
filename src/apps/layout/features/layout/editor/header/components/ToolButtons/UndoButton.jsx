// src/features/layout/components/Header/components/ToolButtons/UndoButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";

import { getToolIconButtonSx } from "./toolButtonStyles";
import { useToolsStore } from "@layout/features/layout/store/toolsStore/useToolsStore";

export default function UndoButton() {
  const theme = useTheme();
  const undo = useToolsStore((s) => s.undo);
  const hasUndo = useToolsStore((s) => Boolean(s.commands.undo));

  const handleClick = useCallback(() => undo(), [undo]);

  if (!hasUndo) return null;

  return (
    <Tooltip title="Undo (Ctrl+Z)">
      <IconButton onClick={handleClick} sx={getToolIconButtonSx(theme, { active: false })}>
        <UndoRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
