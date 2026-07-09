// src/features/layout/LayoutViewer/LeftSidebar/ViewerPlaylistPanel.jsx
import React from "react";
import { Box, Stack, Typography, Button } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

export default function ViewerPlaylistPanel({ scene, viewerConfig }) {
  const theme = useTheme();
  const border = alpha(theme.palette.common.white, 0.08);

  const items = viewerConfig?.items || [];

  return (
    <Box sx={{ p: 2, borderBottom: `1px solid ${border}` }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">推奨プラン（共有用）</Typography>

        {items.length === 0 ? (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            viewerConfig.items が未設定です（後で共有順を保存できます）
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((it, idx) => {
              const active = scene.selected.baseId === it.baseId && scene.selected.planId === it.planId;
              return (
                <Button
                  key={`${it.baseId}_${it.planId}_${idx}`}
                  variant={active ? "contained" : "outlined"}
                  onClick={() => scene.setSelection({ baseId: it.baseId, planId: it.planId })}
                  sx={{ justifyContent: "flex-start" }}
                >
                  {it.label || `#${idx + 1}  ${it.baseId} / ${it.planId}`}
                </Button>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
