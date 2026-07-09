import React from "react";
import { Box, Stack, Typography, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";

import PanToolRoundedIcon from "@mui/icons-material/PanToolRounded";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import HighlightRoundedIcon from "@mui/icons-material/HighlightRounded";
import ContentCutIcon from "@mui/icons-material/ContentCut";

import { useEditorModeStore } from "../store/useEditorModeStore";
import { useViewportUiStore } from "../store/viewportUiStore";

export default function LayoutOperationUI() {
  const layoutSubMode = useEditorModeStore((s) => s.layoutSubMode);
  const setLayoutSubMode = useEditorModeStore((s) => s.setLayoutSubMode);
  const quadModeActive = useViewportUiStore(s => s.layoutMode === "quad");
  const mode = useEditorModeStore((s) => s.editorMode);

  if (quadModeActive || mode === "layout") return null;

  return (
    <Box
      sx={{
        position: "absolute",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        zIndex: 10,
      }}
    >
      {/* View Toggle Pill */}
      <Box
        sx={{
          background: alpha("#050815", 0.8),
          backdropFilter: "blur(12px)",
          border: `1px solid ${alpha("#fff", 0.1)}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          p: 0.5,
          boxShadow: `0 8px 24px ${alpha("#000", 0.5)}`,
          gap: 0.5,
        }}
      >
        <Button
          onClick={() => setLayoutSubMode("furniture_top")}
          startIcon={<GridOnRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            minWidth: 100,
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 3,
            px: 2,
            py: 0.8,
            color: layoutSubMode === "furniture_top" ? "#fff" : alpha("#fff", 0.6),
            bgcolor: layoutSubMode === "furniture_top" ? alpha("#fff", 0.15) : "transparent",
            "&:hover": { bgcolor: alpha("#fff", 0.2) },
          }}
        >
          Layout / Top
        </Button>

        <Divider orientation="vertical" flexItem sx={{ borderColor: alpha("#fff", 0.1), my: 1 }} />

        <Button
          onClick={() => setLayoutSubMode("furniture_iso")}
          startIcon={<ViewInArRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            minWidth: 100,
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 3,
            px: 2,
            py: 0.8,
            color: layoutSubMode === "furniture_iso" ? "#fff" : alpha("#fff", 0.6),
            bgcolor: layoutSubMode === "furniture_iso" ? alpha("#fff", 0.15) : "transparent",
            "&:hover": { bgcolor: alpha("#fff", 0.2) },
          }}
        >
          Layout / Iso-A
        </Button>

        <Divider orientation="vertical" flexItem sx={{ borderColor: alpha("#fff", 0.1), my: 1 }} />

        <Button
          onClick={() => setLayoutSubMode("ceiling_top")}
          startIcon={<HighlightRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            minWidth: 100,
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 3,
            px: 2,
            py: 0.8,
            color: layoutSubMode === "ceiling_top" ? "#fff" : alpha("#fff", 0.6),
            bgcolor: layoutSubMode === "ceiling_top" ? alpha("#fff", 0.15) : "transparent",
            "&:hover": { bgcolor: alpha("#fff", 0.2) },
          }}
        >
          Layout / Ceiling
        </Button>
      </Box>

      {/* Helpful Shortcuts Pill */}
      <Box
        sx={{
          background: alpha("#050815", 0.6),
          backdropFilter: "blur(12px)",
          border: `1px solid ${alpha("#fff", 0.1)}`,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          px: 3,
          py: 1,
          boxShadow: `0 4px 12px ${alpha("#000", 0.3)}`,
          gap: 4,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: alpha("#fff", 0.1),
              border: `1px solid ${alpha("#fff", 0.2)}`,
            }}
          >
            <PanToolRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
          </Box>
          <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>
            Drag Move
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: alpha("#fff", 0.1),
              border: `1px solid ${alpha("#fff", 0.2)}`,
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>R</Typography>
          </Box>
          <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>
            Rotate
          </Typography>
        </Stack>

        {layoutSubMode === "furniture_iso" && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 1,
                height: 24,
                borderRadius: 1,
                bgcolor: alpha("#fff", 0.1),
                border: `1px solid ${alpha("#fff", 0.2)}`,
              }}
            >
              <RotateRightRoundedIcon sx={{ fontSize: 14, color: "#fff", mr: 0.5 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Right-Drag</Typography>
            </Box>
            <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>
              Turn Room
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
