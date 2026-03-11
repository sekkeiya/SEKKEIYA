import React from "react";
import { Box, Typography } from "@mui/material";

export default function BoardEmptyState({ title, description, icon }) {
  return (
    <Box 
      sx={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        py: 8,
        px: 2,
        opacity: 0.7 
      }}
    >
      {icon && (
        <Box sx={{ color: "rgba(255,255,255,0.4)", mb: 2 }}>
          {icon}
        </Box>
      )}
      <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.8)", mb: 1, fontWeight: 600 }}>
        {title || "アイテムが見つかりません"}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 400 }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}
