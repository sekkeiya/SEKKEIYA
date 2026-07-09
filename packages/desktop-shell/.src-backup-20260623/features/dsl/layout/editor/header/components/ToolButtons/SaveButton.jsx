// src/features/layout/components/Header/components/ToolButtons/SaveButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import { getToolIconButtonSx } from "./toolButtonStyles";
import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";

export default function SaveButton() {
  const theme = useTheme();
  const dirty = useToolsStore((s) => s.dirty);
  const saving = useToolsStore((s) => s.saving);
  const save = useToolsStore((s) => s.save);

  const handleClick = useCallback(() => save(), [save]);

  return (
    <Tooltip title="Save (Ctrl+S)">
      <span>
        <IconButton
          disabled={!dirty || saving}
          onClick={handleClick}
          sx={{
            ...getToolIconButtonSx(theme, { active: dirty }),
            opacity: !dirty ? 0.55 : 1,
          }}
        >
          <SaveRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
