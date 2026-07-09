import React from "react";
import { Breadcrumbs, Typography, Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";

export default function LibraryBreadcrumb({ path, onNavigateToRoot, onNavigateUpTo }) {
  if (!path || path.length === 0) return null;

  return (
    <Breadcrumbs 
      separator={<NavigateNextIcon sx={{ fontSize: 14, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }} />} 
      aria-label="library breadcrumb"
      sx={{
        "& .MuiBreadcrumbs-ol": { flexWrap: "wrap" },
        "& .MuiBreadcrumbs-li": { display: "flex", alignItems: "center" }
      }}
    >
      <Box
        component="span"
        onClick={onNavigateToRoot}
        sx={{
          display: "flex",
          alignItems: "center",
          color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
          cursor: "pointer",
          transition: "color 0.15s ease",
          "&:hover": { color: "var(--brand-fg)" },
        }}
      >
        <CategoryRoundedIcon sx={{ fontSize: 16 }} />
      </Box>

      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <Typography
            key={node.id}
            onClick={() => !isLast && onNavigateUpTo(i)}
            sx={{
              fontSize: 12,
              fontWeight: isLast ? 600 : 400,
              color: isLast ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
              cursor: isLast ? "default" : "pointer",
              transition: "color 0.15s ease",
              "&:hover": { color: isLast ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 90%, transparent)" },
            }}
          >
            {node.label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}
