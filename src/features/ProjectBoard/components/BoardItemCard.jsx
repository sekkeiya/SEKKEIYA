import React from "react";
import { Card, CardActionArea, CardContent, CardMedia, Typography, Box, Chip } from "@mui/material";

export default function BoardItemCard({ item, onClick, renderPreview, renderMeta, renderActions }) {
  if (!item) return null;

  return (
    <Card 
      sx={{ 
        bgcolor: "#1a1a1a", 
        color: "#fff", 
        borderRadius: 2, 
        border: "1px solid rgba(255,255,255,0.08)",
        transition: "box-shadow 0.2sease, transform 0.2sease",
        "&:hover": {
          boxShadow: "0 8px 16px rgba(0,0,0,0.6)",
          borderColor: "rgba(255,255,255,0.2)",
        }
      }}
    >
      <CardActionArea onClick={() => onClick && onClick(item)}>
        {/* Slot: Custom Preview or Default Thumbnail */}
        {renderPreview ? (
          renderPreview(item)
        ) : (
          <CardMedia
            component="img"
            height="180"
            image={item.snapshot?.thumbnailUrl || "/assets/placeholder-image.png"}
            alt={item.snapshot?.title || "Item"}
            sx={{ bgcolor: "#111", objectFit: "cover" }}
          />
        )}
        
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ mb: 0.5 }}>
            {item.snapshot?.title || "Untitled"}
          </Typography>
          
          {/* Default Meta */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, opacity: 0.7 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", fontSize: "0.65rem", fontWeight: 700 }}>
              {item.itemType || "ITEM"}
            </Typography>
            <Typography variant="caption">•</Typography>
            <Typography variant="caption">
              {(() => {
                const ts = item.updatedAt || item.createdAt;
                if (!ts) return "—";
                // Firestore Timestamp Check
                const dateObj = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                return isNaN(dateObj.getTime()) ? "—" : dateObj.toLocaleDateString();
              })()}
            </Typography>
          </Box>

          {/* Slot: Custom Meta (Dimensions, Price, etc) */}
          {renderMeta && (
            <Box sx={{ mt: 1 }}>
              {renderMeta(item)}
            </Box>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1.5 }}>
              {item.tags.slice(0, 3).map((tag, idx) => (
                <Chip key={idx} label={tag} size="small" sx={{ height: 20, fontSize: "0.65rem", bgcolor: "rgba(255,255,255,0.1)", color: "#fff" }} />
              ))}
              {item.tags.length > 3 && (
                <Chip label={`+${item.tags.length - 3}`} size="small" sx={{ height: 20, fontSize: "0.65rem", bgcolor: "transparent", color: "rgba(255,255,255,0.4)" }} />
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* Slot: Custom Actions (Download, Delete, etc) */}
      {renderActions && (
        <Box sx={{ p: 1, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "flex-end" }}>
          {renderActions(item)}
        </Box>
      )}
    </Card>
  );
}
