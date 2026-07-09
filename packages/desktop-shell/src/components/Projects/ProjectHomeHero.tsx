import React from "react";
import { Box, Typography, Chip, Fade, Avatar, AvatarGroup, Button } from "@mui/material";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import type { DesktopProject } from "../../features/projects/types";
import { QuickStartWorkFiles } from "./QuickStartWorkFiles";
import { useAuthStore } from "../../store/useAuthStore";

interface ProjectHomeHeroProps {
  project: DesktopProject;
  onNewWorkspace?: () => void;
}

export const ProjectHomeHero: React.FC<ProjectHomeHeroProps> = ({ project }) => {
  const currentUser = useAuthStore(state => state.currentUser);
  const projectName = project.name || "Untitled Project";
  const members = project.memberIds || [project.ownerId];

  const updatedAtStr = project?.updatedAt?.toDate?.() 
    ? project.updatedAt.toDate().toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }) 
    : "Recently";

  return (
    <Box sx={{ 
      position: "relative",
      bgcolor: "var(--brand-bg)",
      display: "block",
      px: { xs: 3, md: 5, lg: 8 },
      pb: { xs: 4, md: 8 },
      pt: { xs: 12, md: 16 },
      borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
      overflow: "hidden",
      flexShrink: 0,
      boxSizing: "border-box",
      width: "100%",
      minWidth: 0
    }}>
      {/* Abstract Background Elements */}
      <Box sx={{ 
        position: "absolute", inset: 0, 
        background: "linear-gradient(145deg, #080c14 0%, #121b2b 100%)",
        opacity: 0.9, zIndex: 0 
      }} />
      <Box sx={{ 
        position: "absolute", top: "-50%", right: "-10%", width: "60%", height: "200%",
        background: "radial-gradient(circle, rgba(0, 191, 255, 0.15) 0%, transparent 60%)",
        filter: "blur(50px)",
        zIndex: 0 
      }} />
      
      <Box sx={{ position: "relative", zIndex: 1, width: '100%', minWidth: 0 }}>
        <Fade in timeout={800}>
          <Box sx={{ width: "100%", minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Chip 
                label="プロジェクト"
                size="small" 
                sx={{ bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)", color: "var(--brand-fg)", fontWeight: 700, letterSpacing: 0.5 }}
              />
              <Chip 
                label="アクティブ" 
                size="small" 
                sx={{ bgcolor: "rgba(67, 233, 123, 0.2)", color: "#43e97b", fontWeight: 700, letterSpacing: 0.5 }}
              />
            </Box>
            <Typography variant="h1" sx={{ 
              fontWeight: 900, 
              mb: 2, 
              letterSpacing: "-1px", 
              fontSize: { xs: "2.4rem", md: "3.6rem" },
              background: "linear-gradient(90deg, #ffffff 0%, #a1c4fd 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 4px 24px rgba(0,191,255,0.2)",
              wordBreak: "break-word"
            }}>
              {projectName}
            </Typography>
            <Typography variant="h6" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", maxWidth: 800, fontWeight: 400, lineHeight: 1.6, mb: 6 }}>
              {project.description || "プロジェクトのトップページです。"}
            </Typography>

            {/* Project Metadata & Quick Actions */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", mt: 4, pt: 3, borderTop: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: 14, border: "2px solid #000" } } as any}>
                  {members.map((id: string) => (
                    <Avatar 
                      key={id} 
                      src={id === currentUser?.uid && currentUser?.photoURL ? currentUser.photoURL : `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} 
                    />
                  ))}
                </AvatarGroup>
                <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", fontWeight: 600, ml: 1 }}>
                  メンバー: {members.length} 人
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "rgb(var(--brand-fg-rgb) / 0.5)" }}>
                <AccessTimeRoundedIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  更新日: {updatedAtStr}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <Button 
                startIcon={<SettingsRoundedIcon />} 
                sx={{ 
                  color: "var(--brand-fg)", 
                  bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)", 
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)" }
                }}
              >
                設定
              </Button>
            </Box>

            {/* NEW: Quick Start Area inside Hero */}
            <QuickStartWorkFiles projectId={project.id} />
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};
