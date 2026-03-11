import React from "react";
import { Box, Typography, Stack, Chip, useTheme, alpha } from "@mui/material";

export default function ProjectBoardHero({ board, metrics = {} }) {
  const theme = useTheme();
  
  // Tokens from 3DSS
  const glassBase = "rgba(12,14,20,0.46)";
  const glassBaseStrong = "rgba(12,14,20,0.62)";
  
  const fg = "rgba(255,255,255,0.92)";
  const fgSub = "rgba(255,255,255,0.70)";
  const fgMute = "rgba(255,255,255,0.55)";
  const line = "rgba(255,255,255,0.10)";

  const topBarSx = {
    px: { xs: 2.0, md: 3.0 },
    py: 1.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${line}`,
    background: `linear-gradient(180deg, ${glassBaseStrong}, ${glassBase})`,
    backdropFilter: "saturate(1.2) blur(18px)",
  };

  const projectName = board?.name || "Untitled Project";
  // The following properties (phase, ownerName) are not strictly in UnifiedBoard yet, 
  // but we gracefully degrade
  const phaseLabel = board?.phase || "";
  const ownerIdLabel = board?.ownerId ? `User: ${board.ownerId.slice(0,6)}...` : "Unknown";

  // Use the strictly mapped coverThumbnailUrl
  const heroThumbUrl = board?.coverThumbnailUrl || "";
  const hasHeroThumb = Boolean(heroThumbUrl);

  return (
    <Box
      sx={{
        position: "relative",
        height: { xs: 200, sm: 240, md: 280 },
        backgroundImage: `
          ${hasHeroThumb ? `url(${heroThumbUrl}),` : ""}
          radial-gradient(1200px 420px at 18% 18%, rgba(120,140,255,0.15), transparent 60%),
          linear-gradient(90deg, rgba(10,10,16,0.95) 0%, rgba(10,10,16,0.50) 52%, rgba(10,10,16,0.20) 100%)
        `,
        backgroundSize: hasHeroThumb ? "100% auto, cover, cover" : "cover",
        backgroundPosition: hasHeroThumb ? "center, center, center" : "center",
        backgroundRepeat: "no-repeat",
        borderBottom: `1px solid ${line}`,
      }}
    >
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        {/* Top Info Bar */}
        <Box sx={topBarSx}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" sx={{ color: fg, fontWeight: 700 }}>
              {ownerIdLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: fgMute }}>/</Typography>
            <Typography variant="body2" sx={{ color: fgSub }}>
              {board?.boardType || "Board"}
            </Typography>
          </Stack>
        </Box>

        {/* Title Area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            p: { xs: 2.0, md: 3.0 },
            pb: { xs: 3.0, md: 4.0 },
            background: "linear-gradient(0deg, rgba(10,10,16,0.8) 0%, transparent 60%)"
          }}
        >
          <Stack spacing={1}>
            <Typography
              variant="h4"
              sx={{
                color: "rgba(255,255,255,0.96)",
                fontWeight: 900,
                textShadow: "0 4px 24px rgba(0,0,0,0.5)",
              }}
            >
              {projectName}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              {phaseLabel && (
                <Chip
                  size="small"
                  label={phaseLabel}
                  sx={{
                    px: 0.5,
                    fontWeight: 700,
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    border: "1px solid",
                    color: fg
                  }}
                />
              )}
              {board?.id && (
                <Typography variant="caption" sx={{ color: fgMute }}>
                  ID: {board.id}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
