// src/features/layout/components/MainArea/components/menu/MoveSpeedDock.jsx
import React, { useMemo } from "react";
import { Box, Stack, Tooltip, IconButton, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import DirectionsBikeIcon from "@mui/icons-material/DirectionsBike";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import SearchIcon from "@mui/icons-material/Search";

export const SPEED_MODES = {
  FLY: "fly",
  DRIVE: "drive",
  CYCLE: "cycle",
  WALK: "walk",
  INSPECT: "inspect",
};

export default function MoveSpeedDock({
  value = SPEED_MODES.WALK,
  onChange,
  speedMul = 1,
}) {
  const theme = useTheme();

  const modes = useMemo(
    () => [
      { id: SPEED_MODES.FLY, label: "Fly", icon: <FlightTakeoffIcon fontSize="small" /> },
      { id: SPEED_MODES.DRIVE, label: "Drive", icon: <DirectionsCarIcon fontSize="small" /> },
      { id: SPEED_MODES.CYCLE, label: "Cycle", icon: <DirectionsBikeIcon fontSize="small" /> },
      { id: SPEED_MODES.WALK, label: "Walk", icon: <DirectionsWalkIcon fontSize="small" /> },
      { id: SPEED_MODES.INSPECT, label: "Inspect", icon: <SearchIcon fontSize="small" /> },
    ],
    []
  );

  const frameSx = {
    borderRadius: 1.25,
    border: `1px solid ${alpha("#fff", 0.12)}`,
    bgcolor: alpha("#000", 0.28),
    backdropFilter: "blur(10px)",
    p: 0.8,
    pointerEvents: "auto",
  };

  const btnSx = (active) => ({
    width: 44,
    height: 44,
    borderRadius: 1,
    bgcolor: active ? alpha(theme.palette.primary.main, 0.18) : alpha("#fff", 0.04),
    border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.5) : alpha("#fff", 0.12)}`,
    "&:hover": {
      bgcolor: active ? alpha(theme.palette.primary.main, 0.24) : alpha("#fff", 0.08),
    },
  });

  return (
    <Box sx={frameSx}>
      <Stack spacing={0.75} alignItems="center">
        {modes.map((m) => {
          const active = value === m.id;
          return (
            <Tooltip key={m.id} title={m.label} placement="left">
              <IconButton size="small" sx={btnSx(active)} onClick={() => onChange?.(m.id)}>
                {m.icon}
              </IconButton>
            </Tooltip>
          );
        })}

        <Box sx={{ mt: 0.5, px: 0.8, py: 0.35, borderRadius: 0.8, bgcolor: alpha("#000", 0.35) }}>
          <Typography sx={{ fontSize: 11, fontWeight: 900, opacity: 0.85 }}>
            x{Number(speedMul || 1).toFixed(1)}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
