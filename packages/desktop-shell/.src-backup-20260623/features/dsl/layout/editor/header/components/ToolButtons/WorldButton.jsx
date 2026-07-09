// src/features/layout/components/Header/components/ToolButtons/WorldButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";

import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function WorldButton() {
  const theme = useTheme();
  const space = useToolsStore((s) => s.space);
  const setSpace = useToolsStore((s) => s.setSpace);

  const onClick = useCallback(() => setSpace("world"), [setSpace]);

  return (
    <Tooltip title="World">
      <IconButton
        onClick={onClick}
        sx={getToolIconButtonSx(theme, { active: space === "world" })}
      >
        <PublicRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
