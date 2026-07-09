// src/features/layout/components/Header/components/ToolButtons/LocalButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";

import { useToolsStore } from "../../../../store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function LocalButton() {
  const theme = useTheme();

  const space = useToolsStore((s) => s.space);
  const setSpace = useToolsStore((s) => s.setSpace);

  const onClick = useCallback(() => {
    setSpace("local");
  }, [setSpace]);

  return (
    <Tooltip title="Local">
      <IconButton
        onClick={onClick}
        sx={getToolIconButtonSx(theme, { active: space === "local" })}
      >
        <MyLocationRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
