import React from "react";
import { Box, Typography } from "@mui/material";

export default function PlanDetailPanel({ planDoc, planDocLoading }) {
  if (planDocLoading) return <Box p={2}><Typography fontSize={12}>Loading Plan...</Typography></Box>;
  if (!planDoc) return <Box p={2}><Typography fontSize={12}>No Plan Selected</Typography></Box>;

  return (
    <Box sx={{ p: 2, height: "100%", overflowY: "auto", color: "rgb(var(--brand-fg-rgb) / 0.9)" }}>
      <Typography variant="caption" sx={{ color: "light-dark(#0676a8, #38bdf8)", fontWeight: 700, mb: 1, display: "block" }}>
        PLAN CONTEXT
      </Typography>
      <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600, mb: 2 }}>
        {planDoc.name || "Untitled Plan"}
      </Typography>

      <Typography variant="body2" sx={{ opacity: 0.7, mb: 2, whiteSpace: "pre-line" }}>
        {planDoc.description || "No description provided."}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 0.5, opacity: 0.8 }}>
        Area Policy
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
        {planDoc.areaPolicy || "Not specified."}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 0.5, opacity: 0.8 }}>
        Zoning Policy
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
        {planDoc.zoningPolicy || "Not specified."}
      </Typography>
    </Box>
  );
}
