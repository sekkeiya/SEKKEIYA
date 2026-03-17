import React, { useState } from "react";
import { Box, Typography, TextField, InputAdornment, IconButton, CircularProgress } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import DriveBreadcrumbs from "../explorer/DriveBreadcrumbs";
import AssetGrid from "../explorer/AssetGrid";
import { usePanelTheme } from "../../../../theme/ThemeContext.jsx";
import { useDriveUi } from "../../context/DriveUiContext";

export default function DriveMainArea() {
  const BRAND = usePanelTheme();
  const { isSearching, searchAssets, clearSearch, searchResults } = useDriveUi();
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      if (query.trim()) {
        searchAssets(query);
      } else {
        clearSearch();
      }
    }
  };

  const handleClear = () => {
    setQuery("");
    clearSearch();
  };
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 内部は max-width 1240px で中央揃え */}
      <Box sx={{ width: "100%", maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header Area */}
        <Box
          sx={{
            height: 56,
            px: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid rgba(255,255,255,0.08)`,
            bgcolor: "rgba(255,255,255,0.02)",
          }}
        >
          {searchResults !== null ? (
            <Typography variant="subtitle1" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              Search Results
            </Typography>
          ) : (
            <DriveBreadcrumbs />
          )}

          {/* Search Input */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search assets with AI..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {isSearching ? (
                      <CircularProgress size={16} sx={{ color: BRAND.primary }} />
                    ) : (query || searchResults !== null) ? (
                      <IconButton size="small" onClick={handleClear}>
                        <CloseIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                ),
                sx: {
                  color: "white",
                  bgcolor: "rgba(255,255,255,0.05)",
                  borderRadius: 2,
                  "& fieldset": { borderColor: "transparent" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                  "&.Mui-focused fieldset": { borderColor: BRAND.primary },
                  width: 300,
                  "input::placeholder": {
                    color: "rgba(255,255,255,0.4)",
                    opacity: 1
                  }
                }
              }}
            />
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            flex: 1,
            p: 4,
            overflowY: "auto",
          }}
        >
          <AssetGrid />
        </Box>
      </Box> {/* End max-width wrapper */}
    </Box>
  );
}
