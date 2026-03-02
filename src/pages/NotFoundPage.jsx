import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>404</Typography>
      <Typography sx={{ opacity: 0.8, mb: 2 }}>ページが見つかりません</Typography>
      <Button variant="contained" onClick={() => navigate("/dashboard")}>
        Dashboardへ戻る
      </Button>
    </Box>
  );
}
