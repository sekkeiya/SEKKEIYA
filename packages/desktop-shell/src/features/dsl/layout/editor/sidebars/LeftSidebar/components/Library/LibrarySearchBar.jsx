import React from "react";
import { TextField, InputAdornment, Stack, Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import WeekendRoundedIcon from "@mui/icons-material/WeekendRounded";

export default function LibrarySearchBar({ q, setQ, tab, setTab }) {
  const theme = useTheme();

  const handleTabChange = (next) => setTab(next);

  const scopeToggleSx = (active) => ({
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: active ? alpha(theme.palette.primary.main, 0.8) : "transparent",
    color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover": {
      background: active ? alpha(theme.palette.primary.main, 1) : alpha("#fff", 0.1),
      color: "var(--brand-fg)",
    },
  });

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Library..."
        size="small"
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 18, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }} />
            </InputAdornment>
          ),
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            height: 36,
            fontSize: 13,
            color: "var(--brand-fg)",
            background: "color-mix(in srgb, var(--brand-bg) 40%, transparent)",
            borderRadius: 3,
            "& fieldset": { border: "none" },
            "&:hover fieldset": { border: "none" },
            "&.Mui-focused fieldset": { border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}` },
          },
          "& .MuiInputBase-input::placeholder": {
            color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)",
            opacity: 1,
          },
        }}
      />

      <Stack
        direction="row"
        spacing={0.25}
        sx={{
          p: 0.25,
          background: "color-mix(in srgb, var(--brand-bg) 40%, transparent)",
          borderRadius: 999,
        }}
      >
        <Tooltip title="All Models" placement="bottom" arrow>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => handleTabChange("all")}
            sx={scopeToggleSx(tab === "all")}
          >
            <PublicRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
        <Tooltip title="Project Models" placement="bottom" arrow>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => handleTabChange("project")}
            sx={scopeToggleSx(tab === "project")}
          >
            <DashboardRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
        <Tooltip title="Plan の家具" placement="bottom" arrow>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => handleTabChange("plan")}
            sx={scopeToggleSx(tab === "plan")}
          >
            <WeekendRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
