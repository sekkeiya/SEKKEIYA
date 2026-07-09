import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

export default function LibraryCategoryTile({ label, icon, onClick, active = false }) {
  const theme = useTheme();

  return (
    <Box
      role="button"
      onClick={onClick}
      sx={{
        width: "100%",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 3,
        background: active ? alpha(theme.palette.primary.main, 0.1) : alpha("#000", 0.2),
        border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.3) : alpha("#fff", 0.05)}`,
        color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        overflow: "hidden",
        p: 1, // small padding inside so text doesn't hit the border
        "&:hover": {
          background: alpha(theme.palette.primary.main, 0.1),
          borderColor: alpha(theme.palette.primary.main, 0.3),
          transform: "scale(1.02)",
          color: "var(--brand-fg)",
        },
      }}
    >
      <Box 
        sx={{ 
          width: 32, 
          height: 32, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            "& svg": {
               fontSize: "32px !important" // force the icon size so it fits
            }
          }}
        >
          {icon}
        </Box>
        <Typography 
          sx={{ 
            fontSize: 11, // slightly smaller to avoid aggressive cutoff
            fontWeight: 600, 
            textAlign: "center", 
            lineHeight: 1.2,
            width: "100%",
            mt: 0.5,
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </Typography>
    </Box>
  );
}
