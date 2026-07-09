import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";

function LibraryAssetCard({
  model,
  modelId,
  displayName,
  thumbUrl,
  isSelected,
  inPlan,
  isFluid,
  fixedSize = 160,
  cardSize,
  isAdding = false,
  onClick,
  onAddClick,
  onDragStart,
  onDragEnd,
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  // If no model ID is provided, fallback to a blank visual or just return null
  if (!modelId) return null;

  return (
    <Box
      data-debug-component="LibraryAssetCard"
      onClick={onClick}
      onPointerDownCapture={(e) => console.log('[LibraryAssetCard] pointer down capture', displayName)}
      onMouseDown={() => console.log('[LibraryAssetCard] mouse down', displayName)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => {
        console.log('[LibraryAssetCard] drag start', model);
        onDragStart(e, model);
      } : undefined}
      onDragEnd={onDragEnd}
      title="Drag to canvas"
      sx={{
        width: isFluid ? "100%" : fixedSize,
        height: isFluid ? "auto" : fixedSize,
        aspectRatio: isFluid ? "1 / 1" : undefined,
        borderRadius: 2,
        background: isSelected
          ? alpha(theme.palette.primary.main, 0.2)
          : inPlan
          ? alpha(theme.palette.primary.main, 0.1)
          : alpha("#fff", 0.02),
        border: `1px solid ${
          isSelected
            ? theme.palette.primary.main
            : inPlan
            ? alpha(theme.palette.primary.main, 0.3)
            : "transparent"
        }`,
        position: "relative",
        overflow: "hidden",
        cursor: onDragStart ? "grab" : "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s ease",
        "&:active": { transform: "scale(0.98)" },
        "&:hover": {
          borderColor: alpha(theme.palette.primary.main, 0.8),
          background: isSelected
            ? alpha(theme.palette.primary.main, 0.25)
            : inPlan
            ? alpha(theme.palette.primary.main, 0.15)
            : alpha("#fff", 0.04),
          transform: "translateY(-2px)",
          boxShadow: `0 4px 12px ${alpha("#000", 0.3)}`,
        },
        "&[data-dragging='true']": {
          opacity: 0.5,
        },
      }}
    >
      <Box
        onDragOver={(e) => e.preventDefault()}
        sx={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        {/* Thumbnail Area */}
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumbUrl ? (
            <Box
              component="img"
              src={thumbUrl}
              alt={displayName || modelId}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transform: "scale(2.4)", // Massively zoom to compensate for 3DSS camera distance padding
                scale: cardSize === "compact" ? "0.8" : "1", // Tweak visual scale for compact mode
                pointerEvents: "none",
                transition: "transform 0.2s",
              }}
              draggable={false}
            />
          ) : (
            <Inventory2RoundedIcon sx={{ fontSize: 32, opacity: 0.1 }} />
          )}
        </Box>

        {/* Floating Footer Info Area */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            p: 1.5,
            pt: 3,
            background: `linear-gradient(to top, ${alpha("#000", 0.8)} 0%, transparent 100%)`,
            pointerEvents: "none",
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 500,
              color: alpha("#fff", 0.7),
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: `0 1px 2px ${alpha("#000", 0.8)}`,
            }}
          >
            {displayName || "Asset"}
          </Typography>
        </Box>
      </Box>

      {/* ✅ Add to Layout Button Overlay */}
      {onAddClick && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
            if (!isAdding) onAddClick(e, model);
          }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking the button
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: theme.palette.primary.main,
            color: "#fff",
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            cursor: "pointer",
            zIndex: 10,
            transition: "all 0.2s ease",
            opacity: (hovered || isAdding) ? 1 : 0,
            pointerEvents: (hovered || isAdding) ? "auto" : "none",
            transform: (hovered || isAdding) ? "scale(1)" : "scale(0.8)",
            "&:hover": {
              transform: "scale(1.1)",
              bgcolor: theme.palette.primary.light,
            },
            "&:active": {
              transform: "scale(0.95)",
            },
          }}
          title={isAdding ? "Loading..." : "Add to Layout"}
        >
          {isAdding ? (
             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M21 12a9 9 0 1 1-6.219-8.56" />
               </svg>
             </Box>
          ) : (
             <Box sx={{ fontSize: 18, lineHeight: 1, fontWeight: "bold" }}>+</Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default React.memo(LibraryAssetCard, (prevProps, nextProps) => {
  return (
    prevProps.modelId === nextProps.modelId &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.inPlan === nextProps.inPlan &&
    prevProps.cardSize === nextProps.cardSize &&
    prevProps.isFluid === nextProps.isFluid &&
    prevProps.fixedSize === nextProps.fixedSize &&
    prevProps.displayName === nextProps.displayName &&
    prevProps.thumbUrl === nextProps.thumbUrl
  );
});
