import React from "react";
import { Box, Typography, Stack, ToggleButton, ToggleButtonGroup, IconButton, TextField, InputAdornment, useTheme, alpha } from "@mui/material";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

export default function BoardSortBar({ 
  totalCount, 
  searchValue, onSearchChange,
  sortKey, setSortKey, 
  sortDir, setSortDir, 
  filterCount = 0, onToggleFilters, 
}) {
  const theme = useTheme();
  const fg = "rgba(255,255,255,0.92)";
  const line = "rgba(255,255,255,0.10)";

  const toggleGroupSx = {
    borderRadius: 999,
    border: `1px solid ${line}`,
    bgcolor: "rgba(0,0,0,0.18)",
    "& .MuiToggleButton-root": {
      textTransform: "none",
      fontWeight: 900,
      borderRadius: 999,
      border: 0,
      color: "rgba(255,255,255,0.78)",
      px: { xs: 1.5, sm: 2.0 },
      py: 0.55,
      whiteSpace: "nowrap",
      "&.Mui-selected": {
        color: fg,
        backgroundColor: alpha(theme.palette.primary.main, 0.22),
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
      },
      "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
    },
  };

  const iconPillSx = {
    borderRadius: 999,
    border: `1px solid rgba(255,255,255,0.14)`,
    bgcolor: "rgba(0,0,0,0.20)",
    color: fg,
    "&:hover": { bgcolor: "rgba(0,0,0,0.28)" },
  };

  const searchFieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 999,
      bgcolor: "rgba(0,0,0,0.22)",
      color: fg,
      boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
      "& fieldset": { borderColor: line },
      "&:hover fieldset": { borderColor: "rgba(255,255,255,0.18)" },
      "&.Mui-focused fieldset": { borderColor: alpha(theme.palette.primary.main, 0.55) },
    },
    "& input::placeholder": { color: "rgba(255,255,255,0.45)" },
    "& .MuiInputAdornment-root": { color: "rgba(255,255,255,0.60)" },
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, py: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, whiteSpace: "nowrap" }}>
          {totalCount} 件
        </Typography>

        {onSearchChange && (
          <TextField
            size="small"
            placeholder="Search..."
            value={searchValue || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{
              ...searchFieldSx,
              width: { xs: "100%", sm: 240, md: 320 },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sortKey}
          onChange={(_, v) => v && setSortKey(v)}
          sx={toggleGroupSx}
        >
          <ToggleButton value="latest">
            <SortRoundedIcon fontSize="small" style={{ marginRight: 6 }} />
            Updated
          </ToggleButton>
          <ToggleButton value="name">Name</ToggleButton>
        </ToggleButtonGroup>

        <IconButton 
          onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")} 
          sx={iconPillSx}
          size="small"
        >
          {sortDir === "desc" ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
        </IconButton>

        {onToggleFilters && (
          <ToggleButton
            size="small"
            selected={filterCount > 0}
            onClick={onToggleFilters}
            sx={{
              borderRadius: 999,
              border: filterCount > 0 ? "1px solid #3498db" : `1px solid rgba(255,255,255,0.14)`,
              bgcolor: filterCount > 0 ? "rgba(52, 152, 219, 0.15)" : "rgba(0,0,0,0.20)",
              color: filterCount > 0 ? "#3498db" : fg,
              px: { xs: 1.5, sm: 2 },
              py: 0.55,
              textTransform: "none",
              fontWeight: 900,
              "&:hover": { backgroundColor: filterCount > 0 ? "rgba(52, 152, 219, 0.25)" : "rgba(0,0,0,0.28)" },
              "&.Mui-selected": {
                color: "#3498db",
                backgroundColor: "rgba(52, 152, 219, 0.15)",
              }
            }}
          >
            <FilterListRoundedIcon fontSize="small" style={{ marginRight: 6 }} />
            Filters {filterCount > 0 && `(${filterCount})`}
          </ToggleButton>
        )}
      </Stack>
    </Box>
  );
}
