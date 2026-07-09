import React from "react";
import { Box, Stack, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import MaterialPickerButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/MaterialPickerButton";
import MoveButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/MoveButton";
import RotateButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/RotateButton";
import ScaleButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/ScaleButton";
import WorldButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/WorldButton";
import LocalButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/LocalButton";
import SnapButton from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/SnapButton";
import ToolDivider from "@desktop/features/dsl/layout/editor/header/components/ToolButtons/ToolDivider";
import { useAppStore } from "@desktop/store/useAppStore";

export default function VerticalEditToolbar() {
  const setActiveWorkspaceId = useAppStore(s => s.setActiveWorkspaceId);
  const setDscShellMode = useAppStore(s => s.setDscShellMode);

  return (
    <Box
      sx={{
        position: "absolute",
        top: "50%",
        left: 10,
        transform: "translateY(-50%)",
        zIndex: 25,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        px: 0.75,
        py: 1.25,
        background: alpha("#050815", 0.72),
        backdropFilter: "blur(12px)",
        boxShadow: `0 10px 30px ${alpha("#000", 0.45)}`,
        borderRadius: 2,
        border: `1px solid ${alpha("#fff", 0.08)}`,
      }}
    >
      <MaterialPickerButton />
      <ToolDivider orientation="horizontal" sx={{ width: "80%", my: 0.5 }} />
      <MoveButton />
      <RotateButton />
      <ScaleButton />
      <ToolDivider orientation="horizontal" sx={{ width: "80%", my: 0.5 }} />
      <WorldButton />
      <LocalButton />
      <ToolDivider orientation="horizontal" sx={{ width: "80%", my: 0.5 }} />
      <SnapButton />
    </Box>
  );
}
