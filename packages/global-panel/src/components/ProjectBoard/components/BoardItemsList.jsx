import React from "react";
import { Box, Grid, Typography, CircularProgress } from "@mui/material";
import BoardItemCard from "./BoardItemCard";

export default function BoardItemsList({ items, loading, emptyMessage, renderPreview, renderMeta, renderActions }) {
  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>
          {emptyMessage || "アイテムがありません。"}
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
          <BoardItemCard 
            item={item} 
            renderPreview={renderPreview}
            renderMeta={renderMeta}
            renderActions={renderActions}
          />
        </Grid>
      ))}
    </Grid>
  );
}
