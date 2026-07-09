import React from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { BRAND } from "../ui/theme";
import GlobalHeader from "./GlobalHeader";
import GlobalFooter from "./GlobalFooter";

export default function LandingLayout({ children }) {
  return (
    <Box
      style={{ backgroundColor: "#0b0f16", color: "#fff" }}
      sx={{
        minHeight: "100vh",
        bgcolor: BRAND.bg,
        color: BRAND.text,
        display: "flex",
        flexDirection: "column",
        backgroundImage:
          "radial-gradient(60% 50% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 55%)",
      }}
    >
      <GlobalHeader />
      
      <Box sx={{ flex: 1, position: "relative", mt: { xs: "60px", sm: "70px" } }}>
        {children ?? <Outlet />}
      </Box>

      <GlobalFooter />
    </Box>
  );
}
