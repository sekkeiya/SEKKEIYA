// src/features/layout/components/MainArea/components/toolbar/AlignVerticalButton.jsx
import React, { useMemo } from "react";
import { Tooltip, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AlignVerticalCenterRoundedIcon from "@mui/icons-material/AlignVerticalCenterRounded";

import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";

export default function AlignVerticalButton() {
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const hasSelection = (selectedItemIds?.length ?? 0) > 0;

  const requestAlign = useViewportUiStore((s) => s.requestAlign);

  const sx = useMemo(
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
    <Tooltip title="垂直中忁E��EV�E�E arrow>
      <span>
        <IconButton
          size="small"
          sx={sx}
          disabled={!hasSelection}
          onClick={() => requestAlign?.("AV")}
        >
          <AlignVerticalCenterRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
