import React from "react";
import { Box, Typography, Divider, CardActionArea, IconButton, Menu, MenuItem } from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { usePanelTheme } from "./theme/ThemeContext.jsx";
import useProjects from "./hooks/useProjects";
import { useProjectContext } from "./hooks/useProjectContext";

function ProjectListItem({ project, onClick, onDelete, active }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const hue = [...project.name].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <Box sx={{ position: "relative", mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          py: 1.25,
          borderRadius: 2,
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
        }}
      >
        <Box sx={{ 
          width: 24, height: 24, borderRadius: 1.5, 
          bgcolor: `hsl(${hue}, 50%, 40%)`,
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1.5
        }}>
          <FolderRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
        </Box>
        <Typography sx={{ 
          color: active ? "#ffffff" : "rgba(255,255,255,0.7)", 
          fontSize: 13, fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1
        }}>
          {project.name}
        </Typography>
      </CardActionArea>
      
      <IconButton 
        onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        size="small"
        sx={{ 
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          opacity: 0, transition: "opacity 0.2s",
          ".MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded='true']": { opacity: 1 },
          color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" }
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={(e) => { e?.stopPropagation(); setAnchorEl(null); }}
        PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 } }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDelete?.(project.id); }} sx={{ color: "#ff4d4f", fontSize: 13 }}>
          プロジェクトを削除
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default function MainSidebar({ user, onNavigateProjects }) {
  const BRAND = usePanelTheme();
  const { projects } = useProjects(user?.uid);
  const { activeProjectId, setActiveProjectId } = useProjectContext();

  const handleSelectProject = (projectId) => {
    setActiveProjectId(projectId);
    if (onNavigateProjects) {
      onNavigateProjects(projectId);
    }
  };

  const myProjects = projects.filter((p) => !p.boardType || p.boardType === "myBoards");
  const teamProjects = projects.filter((p) => p.boardType === "teamBoards");

  return (
    <Box
      sx={{
        width: 240,
        height: "100vh",
        bgcolor: BRAND.panel || "rgba(10, 12, 16, 0.95)",
        borderRight: `1px solid ${BRAND.line || "rgba(255,255,255,0.1)"}`,
        display: "flex",
        flexDirection: "column",
        py: 2,
        boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <Box sx={{ px: 2, mb: 1, pl: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
          Projects
        </Typography>
      </Box>

      {myProjects.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {myProjects.map(p => (
            <ProjectListItem 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId}
              onClick={() => handleSelectProject(p.id)} 
            />
          ))}
        </Box>
      )}

      {teamProjects.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Divider sx={{ opacity: 0.1, my: 1.5, mx: 2 }} />
          <Box sx={{ px: 2, mb: 1, pl: 3 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
              Team
            </Typography>
          </Box>
          {teamProjects.map(p => (
            <ProjectListItem 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId}
              onClick={() => handleSelectProject(p.id)} 
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
