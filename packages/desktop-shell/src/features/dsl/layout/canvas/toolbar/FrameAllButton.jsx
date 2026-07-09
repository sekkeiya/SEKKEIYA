// src/features/layout/components/MainArea/components/toolbar/FrameAllButton.jsx
import React, { useMemo } from "react";
import { Tooltip, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";

import { useViewportUiStore } from "../../store/viewportUiStore";

export default function FrameAllButton() {
  const requestFrameAll = useViewportUiStore((s) => s.requestFrameAll);

  const iconBtnSx = useMemo(
    () => ({
      borderRadius: 1.75,
      border: `1px solid ${alpha("#fff", 0.14)}`,
      bgcolor: alpha("#fff", 0.04),
      "&.Mui-disabled": {
        borderColor: alpha("#fff", 0.08),
        bgcolor: alpha("#fff", 0.02),
      },
    }),
    []
  );

  return (
    <Tooltip title="全体をフレーム" arrow>
      <span>
        <IconButton size="small" sx={iconBtnSx} onClick={() => requestFrameAll?.()}>
          <CenterFocusStrongRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
