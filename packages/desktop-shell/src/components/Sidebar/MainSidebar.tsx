import React, { useState } from 'react';
import { Box, Typography, CardActionArea, IconButton, Menu, MenuItem } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserProjects } from '../../features/projects/api/fetchProjects';
import { BRAND } from '../../styles/theme';

interface ProjectListItemProps {
  project: any;
  active: boolean;
  onClick: () => void;
}

function ProjectListItem({ project, active, onClick }: ProjectListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const hue = [...(project.name || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <Box sx={{ position: "relative", mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          bgcolor: active ? BRAND.panel2 : "transparent",
          "&:hover": { bgcolor: BRAND.panel },
        }}
      >
        <Box sx={{ 
          width: 20, height: 20, borderRadius: 1.5, 
          bgcolor: `hsl(${hue}, 50%, 40%)`,
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1
        }}>
          <FolderRoundedIcon sx={{ fontSize: 14, color: "var(--brand-fg)" }} />
        </Box>
        <Typography sx={{ 
          color: active ? BRAND.text : BRAND.sub,
          fontSize: 11, fontWeight: active ? 600 : 500,
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
          color: BRAND.sub2, "&:hover": { color: BRAND.text }
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
        PaperProps={{ sx: { bgcolor: BRAND.glass, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 2 } }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); }} sx={{ color: "#ff4d4f", fontSize: 13 }}>
          プロジェクトを削除
        </MenuItem>
      </Menu>
    </Box>
  );
}

const MainSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { projects, activeProjectId, setActiveProjectId, setProjects, isMainSidebarOpen } = useAppStore();

  React.useEffect(() => {
    if (currentUser) {
      fetchUserProjects(currentUser.uid).then(fetchedProjects => {
        setProjects(fetchedProjects);
      });
    } else {
      setProjects([]);
    }
  }, [currentUser, setProjects]);

  return (
    <Box
      sx={{
        width: isMainSidebarOpen ? 220 : 0,
        height: "100%",
        bgcolor: BRAND.panel,
        borderRight: isMainSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: "flex",
        flexDirection: "column",
        py: isMainSidebarOpen ? 1.5 : 0,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s",
      }}
    >
      <Box sx={{ px: 1.5, mb: 0.5, pl: 2.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: BRAND.sub2, textTransform: "uppercase" }}>
          Projects
        </Typography>
      </Box>

      {projects.length > 0 && (
        <Box sx={{ mb: 1.5, minWidth: 200 }}>
          {projects.map(p => (
            <ProjectListItem 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId}
              onClick={() => setActiveProjectId(p.id)} 
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default MainSidebar;
