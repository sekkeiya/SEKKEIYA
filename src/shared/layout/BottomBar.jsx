import React from "react";
import { Box, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { BRAND } from "../ui/theme";

function Tab({ icon, label, active, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        transition: "opacity 0.15s",
        "&:active": { opacity: 0.6 },
      }}
    >
      <Box
        sx={{
          position: "relative",
          color: active ? "#fff" : "rgba(255,255,255,0.38)",
          transition: "color 0.2s",
          "& > svg": { fontSize: 24, display: "block" },
        }}
      >
        {icon}
        {active && (
          <Box
            sx={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%)",
              width: 4,
              height: 4,
              borderRadius: "50%",
              bgcolor: "#fff",
            }}
          />
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: active ? 700 : 400,
          color: active ? "#fff" : "rgba(255,255,255,0.38)",
          letterSpacing: 0.3,
          transition: "color 0.2s",
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function BottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const path = location.pathname;
  const activePanel = searchParams.get("panel");

  const isHome = path.startsWith("/dashboard") && !activePanel;
  const isProjects = path.startsWith("/projects") && !activePanel;
  const isDrive = activePanel === "drive";
  const isChat = activePanel === "chat";

  const togglePanel = (panel) => {
    const next = new URLSearchParams(searchParams);
    if (activePanel === panel) {
      next.delete("panel");
    } else {
      next.set("panel", panel);
    }
    setSearchParams(next);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 150,
        bgcolor: "rgba(11,15,22,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${BRAND.line}`,
        display: "flex",
        alignItems: "flex-start",
        pt: 1.25,
        height: "calc(64px + env(safe-area-inset-bottom))",
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <Tab
        icon={<HomeRoundedIcon />}
        label="ホーム"
        active={isHome}
        onClick={() => navigate("/dashboard")}
      />
      <Tab
        icon={<AccountTreeRoundedIcon />}
        label="プロジェクト"
        active={isProjects}
        onClick={() => navigate("/projects")}
      />
      <Tab
        icon={<FolderRoundedIcon />}
        label="ドライブ"
        active={isDrive}
        onClick={() => togglePanel("drive")}
      />
      <Tab
        icon={<ChatRoundedIcon />}
        label="AIチャット"
        active={isChat}
        onClick={() => togglePanel("chat")}
      />
    </Box>
  );
}
