import React from "react";
import { Box, Typography, CircularProgress, Fade } from "@mui/material";

export default function AppInitSkeleton({
  appName,
  icon,
  boardName,
  message = "Opening workspace...",
  showSidebarCol = true,
}) {
  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        backgroundColor: "#02040a",
        color: "#fff",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      {showSidebarCol && (
        <Box
          sx={{
            width: 72,
            height: "100%",
            backgroundColor: "rgba(10, 12, 16, 0.95)",
            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 2,
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              animation: "pulse 1.5s ease-in-out infinite",
              "@keyframes pulse": {
                "0%": { opacity: 0.6 },
                "50%": { opacity: 1 },
                "100%": { opacity: 0.6 },
              },
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Box sx={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255, 255, 255, 0.05)", mb: 2 }} />
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          backgroundImage: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 60%)",
        }}
      >
        <Fade in={true} timeout={600}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.8)",
                "& > svg": {
                  fontSize: 40,
                },
              }}
            >
              {icon}
            </Box>

            <Box sx={{ textAlign: "center" }}>
              {(appName || boardName) && (
                <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 0.5, mb: 0.5 }}>
                  {appName}
                  {boardName && (
                    <Box component="span" sx={{ opacity: 0.5, ml: 1, fontWeight: 400 }}>
                      / {boardName}
                    </Box>
                  )}
                </Typography>
              )}
              
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mt: 3, opacity: 0.7 }}>
                <CircularProgress size={16} thickness={5} sx={{ color: "#fff" }} />
                <Typography variant="body2" sx={{ letterSpacing: 1, textTransform: "uppercase", fontSize: 11, fontWeight: 600 }}>
                  {message}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}
