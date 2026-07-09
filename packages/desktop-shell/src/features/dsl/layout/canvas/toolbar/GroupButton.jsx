// src/features/layout/components/MainArea/components/toolbar/GroupButton.jsx
import React, { useMemo } from "react";
import { Tooltip, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import GroupWorkRoundedIcon from "@mui/icons-material/GroupWorkRounded";

import { useUiSelectionStore } from "../../store/uiSelectionStore";
import { useViewportUiStore } from "../../store/viewportUiStore";

export default function GroupButton() {
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const canMulti = (selectedItemIds?.length ?? 0) >= 2;

  const requestGroup = useViewportUiStore((s) => s.requestGroup);

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
    <Tooltip title="グループ化�E�E�E�E arrow>
      <span>
        <IconButton size="small" sx={iconBtnSx} disabled={!canMulti} onClick={() => requestGroup?.()}>
          <GroupWorkRoundedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
