import React from "react";
import { Box, Tooltip, ButtonBase, Typography, Chip } from "@mui/material";

export default function ToolCircle({ tool, onOpen }) {
  const disabled = !tool?.href;

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") onOpen?.();
  };

  return (
    <Tooltip title={disabled ? "開発予定です" : "新しいタブで開く"} placement="bottom" arrow>
      <Box
        sx={{
          width: { xs: 132, sm: 150 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.8,
          userSelect: "none",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <ButtonBase
          onClick={disabled ? undefined : onOpen}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          focusRipple
          sx={{
            width: "100%",
            borderRadius: 2,
            outline: "none",
            "&:focus-visible .toolCircleBtn": {
              boxShadow: "0 0 0 3px rgba(255,255,255,0.18)",
            },
          }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.8,
              cursor: disabled ? "not-allowed" : "pointer",
              py: 0.5,
            }}
          >
            <Box
              className="toolCircleBtn"
              sx={{
                mt: { xs: 2.2, sm: 3 },
                width: 54,
                height: 54,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                transition:
                  "transform 140ms ease, background 140ms ease, box-shadow 140ms ease",
                ...(disabled
                  ? {}
                  : {
                      "&:hover": {
                        transform: "translateY(-2px)",
                        bgcolor: "rgba(255,255,255,0.11)",
                      },
                      "&:active": {
                        transform: "translateY(0px) scale(0.98)",
                      },
                    }),
              }}
            >
              {React.cloneElement(tool.icon, {
                sx: { color: "rgba(255,255,255,0.9)" },
              })}
            </Box>

            <Typography
              variant="caption"
              sx={{
                fontWeight: 850,
                textAlign: "center",
                lineHeight: 1.15,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 28,
              }}
            >
              {tool.label}
            </Typography>

            <Typography
              variant="caption"
              sx={{
                opacity: 0.65,
                mt: -1.5,
                textAlign: "center",
                lineHeight: 1.15,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 28,
              }}
            >
              {tool.sub}
            </Typography>

            <Chip
              size="small"
              label={tool.badge}
              variant="outlined"
              sx={{
                height: 20,
                fontSize: 11,
                px: 0.25,
                mt: -1.15,
                color: "rgba(255,255,255,0.78)",
                borderColor: "rgba(255,255,255,0.18)",
                bgcolor: "rgba(255,255,255,0.03)",
              }}
            />
          </Box>
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}
