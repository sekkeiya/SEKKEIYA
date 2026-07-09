import React from "react";
import { Box, Typography } from "@mui/material";

export default function BaseDetailPanel({ baseDoc, baseDocLoading }) {
  if (baseDocLoading) return <Box p={2}><Typography fontSize={12}>Loading Base...</Typography></Box>;
  if (!baseDoc) return <Box p={2}><Typography fontSize={12}>No Base Selected</Typography></Box>;

  return (
    <Box sx={{ p: 2, height: "100%", overflowY: "auto", color: "rgba(255,255,255,0.9)" }}>
      <Typography variant="caption" sx={{ color: "#38bdf8", fontWeight: 700, mb: 1, display: "block" }}>
        BASE CONTEXT
      </Typography>
      <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600, mb: 2 }}>
        {baseDoc.name || "Untitled Base"}
      </Typography>

      <Typography variant="body2" sx={{ opacity: 0.7, mb: 2, whiteSpace: "pre-line" }}>
        {baseDoc.description || "No description provided."}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 0.5, opacity: 0.8 }}>
        Concept
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
        {baseDoc.concept || "Not specified."}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 0.5, opacity: 0.8 }}>
        Common Constraints
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
        {baseDoc.commonConstraints || "None."}
      </Typography>
    </Box>
  );
}
