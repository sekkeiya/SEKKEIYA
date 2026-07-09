// src/features/layout/components/MainArea/components/toolbar/SplitViewButton.jsx
import React, { useMemo } from "react";
import { ToggleButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SplitscreenRoundedIcon from "@mui/icons-material/SplitscreenRounded";

import { useViewportUiStore } from "@layout/features/layout/store/viewportUiStore";

export default function SplitViewButton() {
  const layoutMode = useViewportUiStore((s) => s.layoutMode);
  const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);

  const selected = layoutMode === "split";

  const sx = useMemo(
    () => ({
      fontWeight: 900,
      borderRadius: 1.5,
      minHeight: 30,
      minWidth: 38,
      color: alpha("#fff", 0.85),
      borderColor: alpha("#fff", 0.12),
      "&.Mui-selected": {
        color: "#fff",
        bgcolor: alpha("#6ea8ff", 0.18),
        borderColor: alpha("#6ea8ff", 0.35),
      },
    }),
    []
  );

  return (
    <Tooltip title="Split View" arrow>
      <ToggleButton
        value="split"
        selected={selected}
        size="small"
        sx={sx}
        onClick={() => setLayoutMode?.("split")}
      >
        <SplitscreenRoundedIcon fontSize="small" />
      </ToggleButton>
    </Tooltip>
  );
}
