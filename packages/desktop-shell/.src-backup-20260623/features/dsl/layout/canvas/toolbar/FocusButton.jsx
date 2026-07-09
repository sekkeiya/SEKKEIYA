// src/features/layout/components/MainArea/components/toolbar/FocusButton.jsx
import React, { useMemo } from "react";
import { Tooltip, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";

import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";

export default function FocusButton() {
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const hasSelection = (selectedItemIds?.length ?? 0) > 0;

  const requestFocus = useViewportUiStore((s) => s.requestFocus);

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
    <Tooltip title="選択へフォーカス�E�E�E�E arrow>
      <span>
        <IconButton size="small" sx={iconBtnSx} disabled={!hasSelection} onClick={() => requestFocus?.()}>
          <CenterFocusStrongRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
