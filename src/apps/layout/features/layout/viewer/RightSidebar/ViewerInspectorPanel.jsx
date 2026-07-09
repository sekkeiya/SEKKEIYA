// src/features/layout/LayoutViewer/RightSidebar/ViewerInspectorPanel.jsx
import React from "react";
import { Box, Stack, Typography, Divider } from "@mui/material";

export default function ViewerInspectorPanel({ selected }) {
  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">インスペクター</Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          クリックした家具の詳細をここに表示（read-only）
        </Typography>

        <Divider sx={{ opacity: 0.2 }} />

        <Typography variant="body2">現在の選択</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Base: {selected.baseId || "-"}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Plan: {selected.planId || "-"}
        </Typography>
      </Stack>
    </Box>
  );
}
