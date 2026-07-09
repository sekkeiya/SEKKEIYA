// src/features/layout/components/Header/components/ToolButtons/MaterialPickerButton.jsx
import React, { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ColorizeRoundedIcon from "@mui/icons-material/ColorizeRounded";

import { useToolsStore } from "../../../../store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function MaterialPickerButton() {
  const theme = useTheme();
  const materialPicking = useToolsStore((s) => s.materialPicking);
  const toggleMaterialPicker = useToolsStore((s) => s.toggleMaterialPicker);

  const handleClick = useCallback(() => {
    toggleMaterialPicker();
  }, [toggleMaterialPicker]);

  return (
    <Tooltip title={materialPicking ? "Material Picker: ON" : "Material Picker: OFF"}>
      <IconButton onClick={handleClick} sx={getToolIconButtonSx(theme, { active: materialPicking })}>
        <ColorizeRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
