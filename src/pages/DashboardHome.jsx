import React from "react";
import { Box, Typography } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import AiSearchBar from "@/shared/components/AiSearchBar";

export default function DashboardHome() {
  const { user } = useAuth();
  
  return (
    <Box sx={{ p: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: 0.5 }}>
        Hello, {user ? user.email || "Guest" : "Guest"}
      </Typography>
      <Typography sx={{ color: "rgba(255,255,255,0.6)", mb: 6, textAlign: "center", lineHeight: 1.8 }}>
        左サイドバーからプロジェクトを選択するか、AIドライブを開いてください。<br />
        下のチャットバーから言葉でプロジェクトを作成・操作することもできます。
      </Typography>

      <AiSearchBar scope="global" />
    </Box>
  );
}
