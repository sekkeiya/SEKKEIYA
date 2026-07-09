import { useCallback } from "react";
import { IconButton, Tooltip } from "@mui/material";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import { useTheme } from "@mui/material/styles";
import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { getToolIconButtonSx } from "./toolButtonStyles";

export default function FurnitureDimensionButton() {
  const theme = useTheme();
  const active = useToolsStore((s) => s.showFurnitureDimensions);
  const toggle = useToolsStore((s) => s.toggleFurnitureDimensions);

  const handleClick = useCallback(() => {
    toggle();
  }, [toggle]);

  return (
    <Tooltip title={active ? "家具位置プロット寸法 ON" : "家具位置プロット寸法"}>
      <span>
        <IconButton
          onClick={handleClick}
          sx={getToolIconButtonSx(theme, { active })}
        >
          <StraightenRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
