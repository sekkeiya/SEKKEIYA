import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthState } from "@layout/features/auth/useAuthState";
import { toSekkeiyaLoginUrl, toSekkeiyaSignupUrl } from "@layout/shared/utils/urls/sekkeiyaUrls";
import { Box, Typography } from "@mui/material";

export default function HomePage() {
  const { isAuthed, isLoading } = useAuthState();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#050815",
        }}
      >
        <Typography sx={{ color: "#fff", opacity: 0.5 }}>Loading...</Typography>
      </Box>
    );
  }

  // ログイン済みならダッシュボードへ直行
  if (isAuthed) {
    return <Navigate to={`/dashboard${location.search}${location.hash}`} replace />;
  }

  const handleLogin = () => {
    window.location.assign(toSekkeiyaLoginUrl());
  };

  const handleSignup = () => {
    window.location.assign(toSekkeiyaSignupUrl());
  };

  return (
    <div style={pageStyle}>
      <div style={contentWrapper}>
        <div style={heroSection}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 36, md: 54 },
              fontWeight: 900,
              letterSpacing: -0.5,
              lineHeight: 1.1,
              mb: 2,
              background: "linear-gradient(180deg, #ffffff 0%, #9bb7ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            S.Layout
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: 16, md: 20 },
              opacity: 0.8,
              lineHeight: 1.6,
              mb: 5,
              maxWidth: 600,
            }}
          >
            直感的な操作で3Dレイアウトを構築。
            <br />
            SEKKEIYAアカウントで今すぐ始めましょう。
          </Typography>

          <div style={actionRow}>
            <button style={btnPrimary} onClick={handleSignup}>
              新規登録して無料で始める
            </button>
            <button style={btnGhost} onClick={handleLogin}>
              ログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  color: "#eaf0ff",
  background:
    "radial-gradient(900px 420px at 50% 15%, rgba(42, 104, 255, 0.15) 0%, transparent 65%), linear-gradient(180deg, #050815 0%, #060a18 100%)",
};

const contentWrapper = {
  width: "100%",
  maxWidth: 1000,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
};

const heroSection = {
  position: "relative",
  zIndex: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const actionRow = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  justifyContent: "center",
};

const btnPrimary = {
  padding: "16px 32px",
  borderRadius: 999,
  border: "none",
  background: "#2a68ff",
  color: "white",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 8px 24px rgba(42, 104, 255, 0.35)",
  "&:hover": {
    background: "#3c76ff",
    transform: "translateY(-2px)",
  },
};

const btnGhost = {
  padding: "16px 32px",
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "rgba(255, 255, 255, 0.05)",
  color: "#eaf0ff",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
  backdropFilter: "blur(10px)",
  transition: "all 0.2s ease",
  "&:hover": {
    background: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
};
