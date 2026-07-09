import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";

import { useWalkthroughToggle } from "../../../../canvas/tools/walkthrough/useWalkthroughToggle";

export default function WalkthroughButton() {
  const { isWalkthrough, toggle } = useWalkthroughToggle();

  return (
    <Tooltip title={isWalkthrough ? "ウォークスルー終了" : "ウォークスルー（一人称）"} placement="right">
      <IconButton
        size="small"
        onClick={toggle}
        sx={{
          color: isWalkthrough ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 70%, transparent)",
          background: isWalkthrough ? alpha("#4f8cff", 0.85) : "transparent",
          "&:hover": {
            background: isWalkthrough ? alpha("#4f8cff", 0.95) : alpha("#fff", 0.1),
          },
        }}
      >
        <DirectionsWalkIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
