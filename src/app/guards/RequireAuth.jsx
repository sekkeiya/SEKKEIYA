import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";

// Gate for the embedded desktop shell (and any other authenticated-only area).
// While Firebase auth initializes we show a spinner; unauthenticated users are
// redirected to /login with a return_to back to where they were heading.
export default function RequireAuth({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#0a0f19",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?return_to=${returnTo}`} replace />;
  }

  return children;
}
