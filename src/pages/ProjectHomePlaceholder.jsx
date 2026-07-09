import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Typography, Tabs, Tab } from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getProject } from "@sekkeiya/global-panel/api/projects";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function ProjectWebsitePage() {
  const { projectId, section } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // The definitive sections of a Project Website
  const SECTIONS = [
    { id: "landing", label: "Home" },
    { id: "models", label: "3D Models" },
    { id: "drawings", label: "Drawings" },
    { id: "renders", label: "Renders" },
    { id: "movies", label: "Movies" },
    { id: "articles", label: "Articles" },
    { id: "slides", label: "Slides" },
    { id: "analysis", label: "Analysis" },
  ];

  const currentSection = section || "landing";

  useEffect(() => {
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
    fetchProj();
    return () => { active = false; };
  }, [projectId]);

  const handleTabChange = (event, newSection) => {
    navigate(`/projects/${projectId}/${newSection}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#111' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 4, color: '#fff', textAlign: 'center' }}>
        <Typography variant="h5">Project Not Found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "#111", color: "#fff" }}>
      {/* Website Header Menu */}
      <Box sx={{ 
        p: 2, 
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: "#1a1a1a"
      }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {project.name}
        </Typography>

        <Tabs 
          value={currentSection} 
          onChange={handleTabChange} 
          textColor="inherit" 
          indicatorColor="primary"
          sx={{ minHeight: 48 }}
        >
          {SECTIONS.map(s => (
            <Tab key={s.id} label={s.label} value={s.id} sx={{ minHeight: 48, textTransform: "none", fontWeight: 600 }} />
          ))}
        </Tabs>
      </Box>

      {/* Section Content Area */}
      <Box sx={{ flex: 1, p: 4, overflowY: "auto" }}>
        <Typography variant="h4" sx={{ mb: 2 }}>{SECTIONS.find(s => s.id === currentSection)?.label || currentSection}</Typography>
        <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.7)" }}>
          Welcome to the {currentSection} section for {project.name}.
          {/* Will be replaced by actual generator/viewer integrations */}
        </Typography>
      </Box>
    </Box>
  );
}
