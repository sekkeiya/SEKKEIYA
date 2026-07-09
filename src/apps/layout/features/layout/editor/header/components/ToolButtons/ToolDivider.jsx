// src/features/layout/components/Header/components/ToolButtons/ToolDivider.jsx
import React from "react";
import { Divider } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { getToolDividerSx } from "./toolButtonStyles";

export default function ToolDivider() {
  const theme = useTheme();
  return <Divider orientation="vertical" flexItem sx={getToolDividerSx(theme)} />;
}
