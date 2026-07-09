// src/features/layout/components/MainArea/components/toolbar/SingleViewButton.jsx
import React, { useMemo } from "react";
import { ToggleButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CropSquareRoundedIcon from "@mui/icons-material/CropSquareRounded";

import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";

export default function SingleViewButton() {
  const layoutMode = useViewportUiStore((s) => s.layoutMode);
  const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);

  const selected = layoutMode === "single";

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
    <Tooltip title="Single View" arrow>
      <ToggleButton
        value="single"
        selected={selected}
        size="small"
        sx={sx}
        onClick={() => setLayoutMode?.("single")}
      >
        <CropSquareRoundedIcon fontSize="small" />
      </ToggleButton>
    </Tooltip>
  );
}
