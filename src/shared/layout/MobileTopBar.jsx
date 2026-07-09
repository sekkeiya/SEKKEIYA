import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useLocation, useNavigate } from "react-router-dom";
import { BRAND } from "../ui/theme";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useProjects } from "@sekkeiya/global-panel";

export default function MobileTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects = [] } = useProjects(user?.uid);

  const path = location.pathname;

  let title = "SEKKEIYA";
  let showBack = false;
  let backAction = null;

  const projectMatch = path.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    const project = projects.find((p) => p.id === projectMatch[1]);
    title = project?.name ?? "プロジェクト";
    showBack = true;
    backAction = () => navigate("/projects");
  } else if (path === "/projects" || path === "/projects/") {
    title = "プロジェクト一覧";
    showBack = true;
    backAction = () => navigate("/dashboard");
  } else if (path.startsWith("/dashboard/drive")) {
    title = "AIドライブ";
    showBack = true;
    backAction = () => navigate("/dashboard");
  } else if (path.startsWith("/dashboard/connections")) {
    title = "つながり";
    showBack = true;
    backAction = () => navigate("/dashboard");
  } else if (path.startsWith("/dashboard/marketplace")) {
    title = "マーケット";
    showBack = true;
    backAction = () => navigate("/dashboard");
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "calc(52px + env(safe-area-inset-top))",
        pt: "env(safe-area-inset-top)",
        zIndex: 150,
        bgcolor: "rgba(11,15,22,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BRAND.line}`,
        display: "flex",
        alignItems: "flex-end",
        px: 0.5,
        pb: 0.5,
      }}
    >
      <Box sx={{ width: 40, flexShrink: 0 }}>
        {showBack && (
          <IconButton
            onClick={backAction}
            size="small"
            sx={{
              color: BRAND.text,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>
        )}
      </Box>

      <Typography
        sx={{
          flex: 1,
          fontSize: 15,
          fontWeight: 700,
          color: BRAND.text,
          textAlign: "center",
          letterSpacing: 0.3,
          lineHeight: 1,
          pb: 0.75,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </Typography>

      <Box sx={{ width: 40, flexShrink: 0 }} />
    </Box>
  );
}
