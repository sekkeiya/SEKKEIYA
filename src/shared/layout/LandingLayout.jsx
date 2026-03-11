import React from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { BRAND } from "../ui/theme";
import TopRightMenu from "./TopRightMenu";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function LandingLayout() {
  const { user } = useAuth();

  return (
    <Box
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
      <Box sx={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
        {/* We keep TopRightMenu here for login/signup access on Landing Page */}
        <TopRightMenu user={user} />
      </Box>
      <Box sx={{ flex: 1, position: "relative" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
