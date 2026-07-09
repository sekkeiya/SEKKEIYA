import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Typography, IconButton, Tooltip, Button } from "@mui/material";
import { useParams, useNavigate, Navigate, Outlet } from "react-router-dom";
import { getProject } from "@sekkeiya/global-panel";
import { useAuth } from "@/features/auth/context/AuthContext";
import WebsiteHeaderNav, { PROJECT_SECTIONS } from "./components/WebsiteHeaderNav";
import WorkspaceTabBar from "@/shared/layout/WorkspaceTabBar";
import LandingSection from "./sections/LandingSection";
import ResearchSection from "./sections/ResearchSection";
import StrategySection from "./sections/StrategySection";
import PersonaSection from "./sections/PersonaSection";
import AnalysisSection from "./sections/AnalysisSection";
import SettingsIcon from '@mui/icons-material/SettingsRounded';
import PublicIcon from '@mui/icons-material/PublicRounded';

export default function ProjectWebsiteLayout() {
  const { projectId, section } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    const fetchProj = async () => {
      setLoading(true);
      try {
        const p = await getProject(projectId);
        if (active) setProject(p);
      } catch (err) {
        console.error("Failed to fetch project:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (projectId) {
      fetchProj();
    }
    return () => { active = false; };
  }, [projectId, user, authLoading]);

  // If no section is provided, redirect to landing
  if (!section) {
    return <Navigate to={`/projects/${projectId}/landing`} replace />;
  }

  // Validate section
  const VALID_SECTIONS = ["landing", "research", "strategy", "persona", "analysis", "files", "schedule", "models", "drawings", "renders", "movies", "articles", "slides", "create"];
  const isValidSection = VALID_SECTIONS.includes(section);
  if (!isValidSection && section) {
    // If they typed something random, push them to landing
    return <Navigate to={`/projects/${projectId}/landing`} replace />;
  }

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#0a0f19' }}>
        <CircularProgress sx={{ color: '#00BFFF' }} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 4, color: '#fff', textAlign: 'center', bgcolor: '#0a0f19', height: '100%' }}>
        <Typography variant="h5">プロジェクトが見つかりません</Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mt: 2 }}>
          プロジェクトが削除されたか、アクセス権限がありません。
        </Typography>
      </Box>
    );
  }

  const renderSectionContent = () => {
    switch(section) {
      case "landing":
        return <LandingSection project={project} projectId={projectId} activeTab="landing" />;
      case "research":
        return <ResearchSection project={project} projectId={projectId} />;
      case "strategy":
        return <StrategySection project={project} projectId={projectId} />;
      case "persona":
        return <PersonaSection project={project} projectId={projectId} />;
      case "analysis":
        return <AnalysisSection project={project} projectId={projectId} />;
      case "files":
      case "schedule":
      case "models":
      case "drawings":
      case "renders":
      case "movies":
      case "articles":
      case "slides":
      case "create":
        return <LandingSection project={project} projectId={projectId} activeTab={section} />;
      default:
        return <LandingSection project={project} projectId={projectId} />;
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#080c14",
        color: "#fff",
        position: "relative",
      }}
    >
      {/* Workspace Tab Bar — Desktop-style app tabs at the top */}
      <WorkspaceTabBar />

      {/* Action buttons top-right */}
      <Box sx={{
        position: "absolute", top: 40 + 8, right: 24, zIndex: 100,
        display: "flex", gap: 1
      }}>
        <Tooltip title="Public Share Links (Coming Soon)">
          <IconButton size="small" sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)", color: "#fff" } }}>
            <PublicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Project Management">
          <IconButton
            size="small"
            onClick={() => navigate(`/dashboard/projects?projectId=${projectId}`)}
            sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)", color: "#fff" } }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main Website Header Nav — only for research/strategy/persona/analysis */}
      {["research", "strategy", "persona", "analysis"].includes(section) && (
        <WebsiteHeaderNav
          projectId={projectId}
          currentSection={section}
        />
      )}

      {/* Section Content Area */}
      <Box sx={{ flex: 1 }}>
        {renderSectionContent()}
      </Box>

    </Box>
  );
}

// Helper button for launching the specific child app workspace
function LaunchGeneratorButton({ section, projectId }) {
  const navigate = useNavigate();

  const handleLaunch = () => {
    // Navigate passing return_to context if supported, or just deep link.
    const baseUrl = window.location.origin;
    const returnTo = encodeURIComponent(`${baseUrl}/projects/${projectId}/${section}`);

    switch (section) {
      case "models":
        // 3DSS
        window.location.href = `/app/share/dashboard?projectId=${projectId}&source=website&return_to=${returnTo}`;
        break;
      case "drawings":
        // 3DSL
        window.location.href = `/app/layout/dashboard?projectId=${projectId}&source=website&return_to=${returnTo}`;
        break;
      case "slides":
      case "movies":
      case "renders":
        // Presents 
        window.location.href = `/app/presents/dashboard?projectId=${projectId}&source=website&return_to=${returnTo}`;
        break;
      case "create":
      case "articles":
      case "analysis":
        // Other tools mapping
        alert("この機能はまだ準備中です。");
        break;
      default:
        break;
    }
  };

  return (
    <Button 
      variant="contained" 
      onClick={handleLaunch}
      startIcon={<SettingsIcon />}
      sx={{ 
        bgcolor: "#00BFFF", color: "#000", fontWeight: 700, px: 3, py: 1, textTransform: "none", borderRadius: 8,
        "&:hover": { bgcolor: "#0099cc" },
        boxShadow: "0 0 16px rgba(0,191,255,0.3)"
      }}
    >
      {section.charAt(0).toUpperCase() + section.slice(1)} を開く
    </Button>
  );
}
