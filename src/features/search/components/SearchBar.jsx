import React from "react";
import { Box, Typography, TextField, InputAdornment, IconButton, Stack } from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";

export default function SearchBar({ q, setQ, onSubmit, brand }) {
  return (
    <Box component="form" onSubmit={onSubmit} sx={{ width: "100%" }}>
      <TextField
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="例：延べ床面積100㎡の住宅プランを提案して"
        inputProps={{
          style: { color: brand.text, caretColor: "rgba(255,255,255,0.92)" },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Stack direction="row" spacing={1} sx={{ pl: 0.25, alignItems: "center" }}>
                <IconButton
                  size="small"
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "rgba(255,255,255,0.07)",
                    border: `1px solid ${brand.line}`,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <AddRoundedIcon fontSize="small" sx={{ color: brand.text }} />
                </IconButton>

                <IconButton
                  size="small"
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "rgba(255,255,255,0.07)",
                    border: `1px solid ${brand.line}`,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <AttachFileRoundedIcon fontSize="small" sx={{ color: brand.text }} />
                </IconButton>
              </Stack>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ pr: 0.25 }}>
                <IconButton
                  type="submit"
                  size="small"
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "rgba(255,255,255,0.12)",
                    border: `1px solid ${brand.line}`,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
                  }}
                >
                  <ArrowForwardRoundedIcon fontSize="small" sx={{ color: brand.text }} />
                </IconButton>
              </Stack>
            </InputAdornment>
          ),
          sx: {
            minHeight: { xs: 58, sm: 64 },
            borderRadius: 3,
            bgcolor: brand.panel,
            border: `1px solid ${brand.line}`,
            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
            backdropFilter: "blur(10px)",
            px: 1,
            "& .MuiInputBase-input": { color: brand.text },
            "& .MuiInputBase-input::placeholder": { color: brand.sub2, opacity: 1 },
          },
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            transition: "box-shadow 140ms ease, border-color 140ms ease, background 140ms ease",
          },
          "& .MuiOutlinedInput-root.Mui-focused": {
            borderColor: brand.line2,
            boxShadow: `0 0 0 3px ${brand.glow}`,
            background: "rgba(255,255,255,0.08)",
          },
          "& input:-webkit-autofill": {
            WebkitTextFillColor: brand.text,
            WebkitBoxShadow: `0 0 0 1000px ${brand.bg} inset`,
            transition: "background-color 9999s ease-out 0s",
          },
        }}
      />

      <Box
        sx={{
          mt: 0.9,
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: brand.sub,
          fontSize: 12,
          px: { xs: 0.5, sm: 0.25 },
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
        <Typography variant="caption" sx={{ color: brand.sub }}>
          SEKKEIYAは統合ツールをサポートします
        </Typography>
      </Box>
    </Box>
  );
}
