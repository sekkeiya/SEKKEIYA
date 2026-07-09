import React, { useState } from "react";
import { Box, Typography, Button, IconButton } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import { useAuth } from "@/features/auth/context/AuthContext";

const GRAD = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

// 匿名ユーザーが /workspace にいるときだけ表示する固定バナー。
// 「登録する」→ /signup?return_to=/workspace&upgrade=1 でアカウント昇格フローへ。
export default function GuestUpgradeBanner() {
  const { isAnonymous } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const inWorkspace = location.pathname.startsWith("/workspace");

  if (!isAnonymous || !inWorkspace || dismissed) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2.5,
        py: 1.2,
        borderRadius: "100px",
        background: "rgba(10, 8, 20, 0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(124,58,237,0.4)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.15)",
        whiteSpace: "nowrap",
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: GRAD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <LockOpenOutlinedIcon sx={{ fontSize: 15, color: "#fff" }} />
      </Box>

      <Typography sx={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
        ゲストモード
        <Box component="span" sx={{ color: "rgba(255,255,255,0.45)", mx: 0.8 }}>—</Box>
        データを保存するには登録が必要です
      </Typography>

      <Button
        size="small"
        onClick={() =>
          navigate(`/signup?return_to=${encodeURIComponent("/workspace")}&upgrade=1`)
        }
        sx={{
          background: GRAD,
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.78rem",
          borderRadius: "100px",
          textTransform: "none",
          px: 2,
          py: 0.5,
          flexShrink: 0,
          "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)" },
        }}
      >
        今すぐ登録
      </Button>

      <IconButton
        size="small"
        onClick={() => setDismissed(true)}
        sx={{ color: "rgba(255,255,255,0.35)", p: 0.5, "&:hover": { color: "rgba(255,255,255,0.7)" } }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}
